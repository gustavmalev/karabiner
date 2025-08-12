import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import { getIconCacheDir, LRUCache, getDirSizeBytes, pruneByMTime, ensureDir } from '../utils/cache.js';
import { ENV } from '../config/environment.js';
import type { AppBase, AppInfo } from '../types/index.js';

// TTL cache for app list
function makeTTLCache<T>(ttlMs: number) {
  let data: T | null = null;
  let expiry = 0;
  let hits = 0;
  let misses = 0;
  return {
    get() {
      const now = Date.now();
      if (data && now < expiry) {
        hits++; return { hit: true as const, value: data };
      }
      misses++; return { hit: false as const, value: null };
    },
    set(v: T) { data = v; expiry = Date.now() + ttlMs; },
    invalidate() { data = null; expiry = 0; },
    metrics() { return { hits, misses }; }
  };
}

// Simple concurrency limiter (generic)
function pLimit<T>(concurrency: number) {
  let active = 0;
  const queue: Array<{ fn: () => Promise<T>, resolve: (v: T) => void, reject: (e: any) => void }> = [];
  const runNext = () => {
    if (active >= concurrency) return;
    const item = queue.shift(); if (!item) return;
    active++;
    const { fn, resolve, reject } = item;
    Promise.resolve()
      .then(fn)
      .then((v) => { active--; resolve(v); runNext(); }, (e) => { active--; reject(e); runNext(); });
  };
  return (fn: () => Promise<T>) => new Promise<T>((resolve, reject) => { queue.push({ fn, resolve, reject }); runNext(); });
}

async function withRetries<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 120): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (e) {
      lastErr = e; if (attempt < retries) await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

const APP_LIST_TTL_MS = 5 * 60 * 1000; // 5 minutes
const appListCache = makeTTLCache<AppInfo[]>(APP_LIST_TTL_MS);

// Icon caches
const MEM_LRU_MAX_ENTRIES = ENV.ICON_MEM_LRU_MAX_ENTRIES;
const MEM_LRU_MAX_BYTES = ENV.ICON_MEM_LRU_MAX_MB * 1024 * 1024;
const DISK_CACHE_MAX_BYTES = ENV.ICON_DISK_CACHE_MAX_MB * 1024 * 1024;

const memIconLRU = new LRUCache<{ buf: Buffer; sourceMTime: number }>({
  maxEntries: MEM_LRU_MAX_ENTRIES,
  maxSizeBytes: MEM_LRU_MAX_BYTES,
  sizeEstimator: (v) => (v?.buf ? v.buf.length : 1)
});
const inFlightIconTasks = new Map<string, Promise<Buffer | null>>();
const diskCacheDir = getIconCacheDir();
ensureDir(diskCacheDir);

let memHits = 0, memMisses = 0;
let diskHits = 0, diskMisses = 0;
let iconGenerations = 0;
let lastPruneCheck = 0;

export async function maybePruneDiskCache(force = false) {
  const now = Date.now();
  if (!force && now - lastPruneCheck < 15000) return; // throttle to every 15s
  lastPruneCheck = now;
  try {
    const size = await getDirSizeBytes(diskCacheDir);
    if (size > DISK_CACHE_MAX_BYTES) {
      const r = await pruneByMTime(diskCacheDir, DISK_CACHE_MAX_BYTES, 0.9);
      console.log(`[cache] prune: files=${r.prunedFiles} bytes=${r.prunedBytes} final=${r.finalSize}`);
    }
  } catch (e: any) {
    console.warn('[cache] prune check failed:', e?.message || e);
  }
}

export function logCacheMetrics() {
  const m = appListCache.metrics();
  console.log(`[perf] apps hits=${m.hits} misses=${m.misses} | mem hits=${memHits} misses=${memMisses} | disk hits=${diskHits} misses=${diskMisses} | gens=${iconGenerations}`);
}

export async function listInstalledApps(): Promise<AppBase[]> {
  const dirs = ['/Applications', '/System/Applications', path.join(os.homedir(), 'Applications')];
  const seen = new Set<string>();
  const apps: AppBase[] = [];

  const dirEntries = await Promise.all(dirs.map(async (dir) => {
    try { const entries = await fs.promises.readdir(dir, { withFileTypes: true }); return { dir, entries }; }
    catch { return { dir, entries: [] as fs.Dirent[] }; }
  }));

  for (const { dir, entries } of dirEntries) {
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name.endsWith('.app')) {
        const fullPath = path.join(dir, ent.name);
        const base = ent.name.replace(/\.app$/i, '');
        if (!seen.has(base)) { seen.add(base); apps.push({ name: base, path: fullPath }); }
      }
    }
  }
  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

async function readInfoPlistJSON(appPath: string): Promise<any | null> {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) return null;
  return new Promise((resolve) => {
    exec(`plutil -convert json -o - ${JSON.stringify(plist)}`,(err, stdout) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(String(stdout || '{}'))); } catch { resolve(null); }
    });
  });
}

function categoryLabelFromUTI(uti?: string) {
  if (!uti) return undefined;
  const m = String(uti).split('.').pop();
  if (!m) return undefined;
  return m.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function hashPath(p: string) { return crypto.createHash('sha1').update(p).digest('hex'); }
function statMTimeSafe(p: string) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

function findIcnsForApp(plist: any, appPath: string): string | null {
  const resources = path.join(appPath, 'Contents', 'Resources');
  if (!fs.existsSync(resources)) return null;
  let cand: string | null = null;
  const addExt = (n: string) => (n.toLowerCase().endsWith('.icns') ? n : `${n}.icns`);
  const tryFile = (n: string) => { const f = path.join(resources, addExt(n)); return fs.existsSync(f) ? f : null; };
  if (plist) {
    if (plist.CFBundleIconFile) cand = tryFile(plist.CFBundleIconFile);
    if (!cand && plist.CFBundleIcons && plist.CFBundleIcons.CFBundlePrimaryIcon && Array.isArray(plist.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles)) {
      for (const n of plist.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles) { cand = tryFile(n); if (cand) break; }
    }
  }
  if (!cand) {
    for (const g of ['AppIcon', 'Icon', 'icon', 'appicon']) { cand = tryFile(g); if (cand) break; }
  }
  return cand;
}

const iconLimiter = pLimit<Buffer | null>(3);
export async function getOrCreateIconPNGBuffer(appPath: string, size = 64): Promise<Buffer | null> {
  const keyBase = `${hashPath(appPath)}-${size}`;
  const outPng = path.join(diskCacheDir, `${keyBase}.png`);

  const plist = await readInfoPlistJSON(appPath);
  const icns = findIcnsForApp(plist, appPath);
  const sourceMTime = icns ? statMTimeSafe(icns) : statMTimeSafe(path.join(appPath, 'Contents'));

  const cacheKey = `${appPath}|${size}`;
  const mem = memIconLRU.get(cacheKey);
  if (mem && mem.sourceMTime === sourceMTime && mem.buf) { memHits++; return mem.buf; }
  memMisses++;

  const inFlight = inFlightIconTasks.get(cacheKey);
  if (inFlight) return inFlight;

  const task = iconLimiter(async () => {
    if (fs.existsSync(outPng)) {
      try {
        const st = await fs.promises.stat(outPng);
        if (st.mtimeMs >= sourceMTime) {
          const buf = await fs.promises.readFile(outPng);
          memIconLRU.set(cacheKey, { buf, sourceMTime });
          diskHits++; return buf;
        }
      } catch { /* stale on disk */ }
    }
    diskMisses++;

    if (icns) {
      const cmd = `sips -s format png ${JSON.stringify(icns)} --out ${JSON.stringify(outPng)}`;
      try {
        await withRetries(() => new Promise<void>((resolve, reject) => exec(cmd, (err) => (err ? reject(err) : resolve()))));
        if (fs.existsSync(outPng)) {
          const buf = await fs.promises.readFile(outPng);
          memIconLRU.set(cacheKey, { buf, sourceMTime });
          iconGenerations++; await maybePruneDiskCache(false);
          return buf;
        }
      } catch {}
    }

    const qlCmd = `qlmanage -t -s ${size} -o ${JSON.stringify(diskCacheDir)} ${JSON.stringify(appPath)}`;
    try {
      await withRetries(() => new Promise<void>((resolve) => exec(qlCmd, () => resolve())));
      try {
        const files = fs.readdirSync(diskCacheDir).filter((f) => f.endsWith('.png'));
        if (files.length) {
          const full = files.map((f) => ({ f, t: fs.statSync(path.join(diskCacheDir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0].f;
          fs.copyFileSync(path.join(diskCacheDir, full), outPng);
          const buf = await fs.promises.readFile(outPng);
          memIconLRU.set(cacheKey, { buf, sourceMTime });
          iconGenerations++; await maybePruneDiskCache(false);
          return buf;
        }
      } catch {}
    } catch {}

    return null;
  }).finally(() => { inFlightIconTasks.delete(cacheKey); });

  inFlightIconTasks.set(cacheKey, task);
  return task;
}

export async function getOrCreateIconsBatch(appPaths: string[], size = 64, concurrency = 3): Promise<(Buffer | null)[]> {
  const limiter = pLimit<Buffer | null>(concurrency);
  return Promise.all(appPaths.map((p) => limiter(() => getOrCreateIconPNGBuffer(p, size))));
}

export async function enrichApp(app: AppBase): Promise<AppInfo> {
  const plist = await readInfoPlistJSON(app.path);
  const bundleId = plist?.CFBundleIdentifier as string | undefined;
  const name = (plist?.CFBundleDisplayName || plist?.CFBundleName || app.name) as string;
  const category = plist?.LSApplicationCategoryType as string | undefined;
  const categoryLabel = categoryLabelFromUTI(category);
  const iconUrl = `/api/app-icon?path=${encodeURIComponent(app.path)}`;
  return { name, path: app.path, bundleId, category, categoryLabel, iconUrl };
}

export async function enrichAppsBatch(apps: AppBase[], concurrency = 3): Promise<AppInfo[]> {
  const limiter = pLimit<AppInfo>(concurrency);
  return Promise.all(apps.map((app) => limiter(() => enrichApp(app))));
}

export async function getAppsCached(forceRefresh = false): Promise<AppInfo[]> {
  if (!forceRefresh) {
    const cached = appListCache.get();
    if (cached.hit) { console.log('[cache] /api/apps HIT'); return cached.value!; }
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

export function iconCacheInfo() {
  return { diskCacheDir, MEM_LRU_MAX_ENTRIES, MEM_LRU_MAX_BYTES, DISK_CACHE_MAX_BYTES };
}
