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

// Best-effort: query macOS KnowledgeC (Screen Time) DB for most used apps by bundle
async function getScreenTimeTopApps(days = 7, limit = 15) {
  const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Knowledge', 'knowledgeC.db');
  const exists = fs.existsSync(dbPath);
  if (!exists) return { apps: [], note: 'Screen Time DB not accessible' };

  const sinceSeconds = Math.floor((Date.now() - days * 24 * 3600 * 1000) / 1000);
  // Query adapted to count app in-foreground events. This may require Full Disk Access.
  const sql = `
    SELECT
      ZSTRUCTUREDMETADATA.ZBUNDLEID as bundle,
      COUNT(*) as cnt
    FROM ZOBJECT
    JOIN ZSTRUCTUREDMETADATA ON ZOBJECT.ZSTRUCTUREDMETADATA = ZSTRUCTUREDMETADATA.Z_PK
    WHERE ZSTREAMNAME = 'com.apple.mobiletimer.app.in.foreground'
       OR ZSTREAMNAME = 'com.apple.runningboard.assertions'
       OR ZSTREAMNAME = 'com.apple.appusage.ApplicationUsage'
    AND ZOBJECT.ZSTARTDATE > ${sinceSeconds}
    GROUP BY bundle
    ORDER BY cnt DESC
    LIMIT ${limit};`;

  return new Promise((resolve) => {
    exec(`sqlite3 ${JSON.stringify(dbPath)} ${JSON.stringify(sql)}`, (err, stdout) => {
      if (err) {
        resolve({ apps: [], note: 'Permission required or query failed' });
        return;
      }
      const lines = String(stdout || '').trim().split('\n').filter(Boolean);
      const apps = lines.map(line => {
        const [bundle, cnt] = line.split('|');
        return { bundle: bundle || '', count: Number(cnt || 0) };
      }).filter(a => a.bundle);
      resolve({ apps });
    });
  });
}

// Utility: list installed apps by scanning standard folders
async function listInstalledApps() {
  const dirs = [
    '/Applications',
    '/System/Applications',
    path.join(os.homedir(), 'Applications')
  ];

  const seen = new Set();
  const apps = [];

  for (const dir of dirs) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
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
    } catch (e) {
      // Ignore missing dirs
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

// Convert icns to png and cache in tmp
async function getOrCreateIconPng(appPath, size = 64) {
  const tmp = path.join(os.tmpdir(), 'karabiner-app-icons');
  ensureDir(tmp);
  const key = `${hashPath(appPath)}-${size}.png`;
  const outPng = path.join(tmp, key);
  if (fs.existsSync(outPng)) return outPng;
  const plist = await readInfoPlistJSON(appPath);
  const icns = findIcnsForApp(plist, appPath);
  if (!icns) return null;
  return new Promise((resolve) => {
    exec(`sips -s format png ${JSON.stringify(icns)} --out ${JSON.stringify(outPng)}`, (err) => {
      if (!err && fs.existsSync(outPng)) return resolve(outPng);
      // Fallback: try QuickLook thumbnail of the app bundle
      exec(`qlmanage -t -s ${size} -o ${JSON.stringify(tmp)} ${JSON.stringify(appPath)}`, () => {
        // Find most recent png in tmp for this app hash
        try {
          const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png'));
          if (files.length) {
            const full = files.map((f) => ({ f, t: fs.statSync(path.join(tmp, f)).mtimeMs }))
              .sort((a, b) => b.t - a.t)[0].f;
            fs.copyFileSync(path.join(tmp, full), outPng);
            return resolve(outPng);
          }
        } catch {}
        resolve(null);
      });
    });
  });
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
      const baseApps = await listInstalledApps();
      const enriched = await Promise.all(baseApps.map(enrichApp));
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
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'icon generation failed' }));
      }
      return;
    }

    // Standalone handler for screentime (outside header block for consistency)
    if (url.pathname === '/api/screentime' && req.method === 'GET') {
      try {
        const top = await getScreenTimeTopApps();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(top));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ apps: [], note: 'Unavailable' }));
      }
      return;
    }
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
