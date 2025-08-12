import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import crypto from 'crypto';
import { PORT, KARABINER_JSON, USER_KARABINER_JSON, RULES_TS, VISUALIZER_DIR, readKarabinerJson, parseRulesConfig, generateRulesTs, writeRulesTs } from './config.mjs';
import { analyze } from './analyze.mjs';
import { serveStatic } from './static.mjs';

const PROJECT_ROOT = path.resolve(VISUALIZER_DIR, '..');

// ------------------------------
// Caching, concurrency & logging
// ------------------------------

const APP_LIST_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeTTLCache(ttlMs) {
  let data = null;
  let expiry = 0;
  let hits = 0;
  let misses = 0;
  return {
    get() {
      const now = Date.now();
      if (data && now < expiry) {
        hits++;
        return { hit: true, value: data };
      }
      misses++;
      return { hit: false, value: null };
    },
    set(v) {
      data = v;
      expiry = Date.now() + ttlMs;
    },
    invalidate() {
      data = null;
      expiry = 0;
    },
    metrics() {
      return { hits, misses };
    }
  };
}

// Simple concurrency limiter (p-limit like)
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    active++;
    const { fn, resolve, reject } = item;
    Promise.resolve()
      .then(fn)
      .then(
        (v) => {
          active--;
          resolve(v);
          runNext();
        },
        (e) => {
          active--;
          reject(e);
          runNext();
        }
      );
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

// Retry helper
async function withRetries(fn, retries = 2, baseDelayMs = 120) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        const delay = baseDelayMs * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// App list cache (enriched)
const appListCache = makeTTLCache(APP_LIST_TTL_MS);

// Icon cache keyed by hash(appPath)+size
const iconCache = new Map(); // key -> { pngPath, sourceMTime }
const inFlightIconTasks = new Map(); // key -> Promise<string|null>
let iconCacheHits = 0;
let iconCacheMisses = 0;

function logCacheMetrics() {
  const m = appListCache.metrics();
  console.log(
    `[perf] apps cache hits=${m.hits} misses=${m.misses} | icon hits=${iconCacheHits} misses=${iconCacheMisses}`
  );
}

// (Removed) getScreenTimeTopApps helper — unused

// Utility: list installed apps by scanning standard folders (parallel)
async function listInstalledApps() {
  const dirs = [
    '/Applications',
    '/System/Applications',
    path.join(os.homedir(), 'Applications')
  ];

  const seen = new Set();
  const apps = [];

  const dirEntries = await Promise.all(
    dirs.map(async (dir) => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        return { dir, entries };
      } catch (e) {
        // Ignore missing or unreadable dirs
        return { dir, entries: [] };
      }
    })
  );

  for (const { dir, entries } of dirEntries) {
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name.endsWith('.app')) {
        const fullPath = path.join(dir, ent.name);
        // Derive a human name from folder name (strip .app)
        const base = ent.name.replace(/\.app$/i, '');
        if (!seen.has(base)) {
          seen.add(base);
          apps.push({ name: base, path: fullPath });
        }
      }
    }
  }

  // Sort by name client expects sorted
  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

// Read and parse Info.plist as JSON via plutil
async function readInfoPlistJSON(appPath) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) return null;
  return new Promise((resolve) => {
    exec(`plutil -convert json -o - ${JSON.stringify(plist)}`, (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(String(stdout || '{}')));
      } catch {
        resolve(null);
      }
    });
  });
}

function categoryLabelFromUTI(uti) {
  if (!uti) return undefined;
  const m = String(uti).split('.').pop();
  if (!m) return undefined;
  // simple label: split hyphens and capitalize
  return m
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function hashPath(p) {
  return crypto.createHash('sha1').update(p).digest('hex');
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// Attempt to find an .icns file referenced by the app bundle
function findIcnsForApp(plist, appPath) {
  const resources = path.join(appPath, 'Contents', 'Resources');
  if (!fs.existsSync(resources)) return null;
  let cand = null;
  const addExt = (n) => (n.toLowerCase().endsWith('.icns') ? n : `${n}.icns`);
  const tryFile = (n) => {
    const f = path.join(resources, addExt(n));
    return fs.existsSync(f) ? f : null;
  };
  if (plist) {
    if (plist.CFBundleIconFile) cand = tryFile(plist.CFBundleIconFile);
    if (!cand && plist.CFBundleIcons && plist.CFBundleIcons.CFBundlePrimaryIcon && Array.isArray(plist.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles)) {
      for (const n of plist.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles) {
        cand = tryFile(n);
        if (cand) break;
      }
    }
  }
  if (!cand) {
    // common fallbacks
    const guesses = ['AppIcon', 'Icon', 'icon', 'appicon'];
    for (const g of guesses) {
      cand = tryFile(g);
      if (cand) break;
    }
  }
  return cand;
}

// Compute icon source mtime for invalidation
function statMTimeSafe(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

// Convert icns to png and cache in tmp (with in-memory cache, invalidation, retries and concurrency limiting)
const iconLimiter = pLimit(3);
async function getOrCreateIconPng(appPath, size = 64) {
  const tmp = path.join(os.tmpdir(), 'karabiner-app-icons');
  ensureDir(tmp);
  const keyBase = `${hashPath(appPath)}-${size}`;
  const key = `${keyBase}.png`;
  const outPng = path.join(tmp, key);

  // Determine current source signature
  const plist = await readInfoPlistJSON(appPath);
  const icns = findIcnsForApp(plist, appPath);
  const sourceMTime = icns ? statMTimeSafe(icns) : statMTimeSafe(path.join(appPath, 'Contents'));

  // Check in-memory cache
  const cacheKey = `${appPath}|${size}`;
  const cached = iconCache.get(cacheKey);
  if (cached && cached.sourceMTime === sourceMTime && fs.existsSync(cached.pngPath)) {
    iconCacheHits++;
    return cached.pngPath;
  }
  iconCacheMisses++;

  // De-duplicate concurrent generations
  const inFlight = inFlightIconTasks.get(cacheKey);
  if (inFlight) return inFlight;

  const task = iconLimiter(async () => {
    // Disk cache short-circuit
    if (fs.existsSync(outPng)) {
      iconCache.set(cacheKey, { pngPath: outPng, sourceMTime });
      return outPng;
    }

    if (icns) {
      // Try sips first with retries
      const cmd = `sips -s format png ${JSON.stringify(icns)} --out ${JSON.stringify(outPng)}`;
      try {
        await withRetries(() =>
          new Promise((resolve, reject) =>
            exec(cmd, (err) => (err ? reject(err) : resolve()))
          )
        );
        if (fs.existsSync(outPng)) {
          iconCache.set(cacheKey, { pngPath: outPng, sourceMTime });
          return outPng;
        }
      } catch (_) {
        // fallthrough to QuickLook
      }
    }

    // Fallback: QuickLook thumbnail of the app bundle
    const qlCmd = `qlmanage -t -s ${size} -o ${JSON.stringify(tmp)} ${JSON.stringify(appPath)}`;
    try {
      await withRetries(() =>
        new Promise((resolve) => exec(qlCmd, () => resolve()))
      );
      // Find most recent png in tmp for this app hash
      try {
        const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png'));
        if (files.length) {
          const full = files
            .map((f) => ({ f, t: fs.statSync(path.join(tmp, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t)[0].f;
          fs.copyFileSync(path.join(tmp, full), outPng);
          iconCache.set(cacheKey, { pngPath: outPng, sourceMTime });
          return outPng;
        }
      } catch {}
    } catch {}

    return null;
  })
    .finally(() => {
      inFlightIconTasks.delete(cacheKey);
    });

  inFlightIconTasks.set(cacheKey, task);
  return task;
}

// Batch icon processing with concurrency limits
async function getOrCreateIconsBatch(appPaths, size = 64, concurrency = 3) {
  const limiter = pLimit(concurrency);
  return Promise.all(appPaths.map((p) => limiter(() => getOrCreateIconPng(p, size))));
}

async function enrichApp(app) {
  const plist = await readInfoPlistJSON(app.path);
  const bundleId = plist?.CFBundleIdentifier;
  const name = plist?.CFBundleDisplayName || plist?.CFBundleName || app.name;
  const category = plist?.LSApplicationCategoryType;
  const categoryLabel = categoryLabelFromUTI(category);
  const iconUrl = `/api/app-icon?path=${encodeURIComponent(app.path)}`;
  return { name, path: app.path, bundleId, category, categoryLabel, iconUrl };
}

// Batch enrich with concurrency limit
async function enrichAppsBatch(apps, concurrency = 3) {
  const limiter = pLimit(concurrency);
  return Promise.all(apps.map((app) => limiter(() => enrichApp(app))));
}

async function getAppsCached(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = appListCache.get();
    if (cached.hit) {
      console.log('[cache] /api/apps HIT');
      return cached.value;
    }
    console.log('[cache] /api/apps MISS');
  } else {
    appListCache.invalidate();
    console.log('[cache] /api/apps REFRESH');
  }

  const baseApps = await listInstalledApps();
  const enriched = await enrichAppsBatch(baseApps, 3);
  appListCache.set(enriched);
  return enriched;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');

    // CORS headers for API requests
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200).end();
        return;
      }

    if (url.pathname === '/api/apps' && req.method === 'GET') {
      const refresh = url.searchParams.get('refresh') === '1';
      const enriched = await getAppsCached(refresh);
      logCacheMetrics();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(enriched));
      return;
    }

    if (url.pathname === '/api/app-icon' && req.method === 'GET') {
      const appPath = url.searchParams.get('path');
      const size = Math.max(32, Math.min(256, Number(url.searchParams.get('size') || 64)));
      if (!appPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'path required' }));
        return;
      }
      try {
        const png = await getOrCreateIconPng(appPath, size);
        if (png && fs.existsSync(png)) {
          const buf = fs.readFileSync(png);
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }).end(buf);
        } else {
          res.writeHead(404).end();
        }
        logCacheMetrics();
      } catch (e) {
        console.error('[icon] generation failed:', e?.message || e);
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'icon generation failed' }));
      }
      return;
    }

    // (Removed) /api/screentime endpoint — unused
    }

    if (url.pathname === '/api/data') {
      const json = readKarabinerJson();
      if (!json) {
        res
          .writeHead(500, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: `Could not read karabiner.json at ${KARABINER_JSON}` }));
        return;
      }
      const result = analyze(json);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/config') {
      if (req.method === 'GET') {
        // Get current configuration
        const config = parseRulesConfig();
        if (!config) {
          res
            .writeHead(500, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ error: `Could not read rules.ts at ${RULES_TS}` }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(config));
        return;
      }
      
      if (req.method === 'POST') {
        // Save configuration
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            console.log('[POST /api/config] Received config');
            const rulesContent = generateRulesTs(config);
            const success = writeRulesTs(rulesContent);
            
            if (!success) {
              res
                .writeHead(500, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ error: 'Failed to write rules.ts' }));
              return;
            }

            // Build karabiner.json by running the project build script
            exec('npm run build', { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
              if (err) {
                console.error('[build] Error:', err.message);
                console.error('[build] Stderr:', stderr);
                res
                  .writeHead(500, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify({ error: 'rules.ts saved, but failed to build karabiner.json', detail: err.message }));
                return;
              }
              console.log('[build] Success');

              // After successful build, copy the generated karabiner.json to the user's Karabiner config path
              try {
                const targetDir = path.dirname(USER_KARABINER_JSON);
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }
                // Always copy from the freshly built file in the project root.
                // KARABINER_JSON may point to the user's file (or another location) based on startup state.
                const builtJson = path.join(PROJECT_ROOT, 'karabiner.json');
                fs.copyFileSync(builtJson, USER_KARABINER_JSON);
                console.log(`[apply] Copied ${builtJson} -> ${USER_KARABINER_JSON}`);
              } catch (copyErr) {
                console.error('[apply] Failed to copy karabiner.json to user config:', copyErr);
                res.writeHead(500, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify({ success: false, error: 'Built karabiner.json but failed to apply to user config path', detail: String(copyErr) }));
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: true, message: 'Configuration saved, built, and applied to Karabiner config' }));
            });
          } catch (error) {
            res
              .writeHead(400, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ error: 'Invalid JSON in request body', detail: error.message }));
          }
        });
        return;
      }
    }

    serveStatic(req, res);
  } catch (e) {
    const detail = e && e.stack ? e.stack : String(e);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Server error', detail }));
  }
});

server.listen(PORT, () => {
  console.log(`Karabiner Configuration Editor running at http://localhost:${PORT}`);
  console.log(`Reading data from: ${KARABINER_JSON}`);
  console.log(`Managing configuration: ${RULES_TS}`);
});
