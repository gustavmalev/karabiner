import fs from 'fs';
import path from 'path';
import os from 'os';

// Ensure directory exists
export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Return persistent icon cache dir, with fallback to project .cache
export function getIconCacheDir(): string {
  const primary = path.join(os.homedir?.() || '', '.karabiner-visualizer', 'icon-cache');
  try {
    if (!os.homedir || !os.homedir()) throw new Error('no homedir');
    ensureDir(primary);
    return primary;
  } catch (e: any) {
    const fallback = path.resolve(process.cwd(), '.cache', 'icon-cache');
    console.warn(`[cache] Could not use home cache dir; falling back to ${fallback}. Reason: ${e?.message || e}`);
    ensureDir(fallback);
    return fallback;
  }
}

// Lightweight LRU cache backed by Map
// - Evicts on either maxEntries or maxSizeBytes
// - sizeEstimator(value) -> bytes (default 1 per entry)
export class LRUCache<V = any> {
  private map = new Map<string, V>();
  private maxEntries: number;
  private maxSizeBytes: number;
  private sizeEstimator: (v: V) => number;
  private totalSize = 0;

  constructor({ maxEntries = 512, maxSizeBytes = 64 * 1024 * 1024, sizeEstimator = (v: V) => (void v, 1 as number) } = {}) {
    this.maxEntries = maxEntries;
    this.maxSizeBytes = maxSizeBytes;
    this.sizeEstimator = sizeEstimator as (v: V) => number;
  }

  private touch(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.touch(key, value);
    return value;
  }

  set(key: string, value: V) {
    const exists = this.map.has(key);
    if (exists) {
      const old = this.map.get(key)!;
      this.totalSize -= this.sizeEstimator(old);
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.totalSize += this.sizeEstimator(value);
    this.evictIfNeeded();
  }

  has(key: string) {
    return this.map.has(key);
  }

  delete(key: string) {
    if (!this.map.has(key)) return false;
    const v = this.map.get(key)!;
    this.totalSize -= this.sizeEstimator(v);
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
    this.totalSize = 0;
  }

  private evictIfNeeded() {
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string;
      this.delete(oldestKey);
    }
    while (this.totalSize > this.maxSizeBytes && this.map.size > 0) {
      const oldestKey = this.map.keys().next().value as string;
      this.delete(oldestKey);
    }
  }
}

// Compute directory size (non-recursive)
export async function getDirSizeBytes(dir: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      try {
        const st = await fs.promises.stat(path.join(dir, ent.name));
        total += st.size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

// Prune files by mtime when exceeding maxBytes
// Deletes oldest files until below maxBytes * lowWatermarkRatio
export async function pruneByMTime(dir: string, maxBytes: number, lowWatermarkRatio = 0.9) {
  const result = { prunedFiles: 0, prunedBytes: 0, finalSize: 0 };
  let files: Array<{ full: string; size: number; mtime: number }> = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = path.join(dir, ent.name);
      try {
        const st = await fs.promises.stat(full);
        files.push({ full, size: st.size, mtime: st.mtimeMs });
      } catch {}
    }
  } catch {
    return result;
  }

  let total = files.reduce((a, b) => a + b.size, 0);
  result.finalSize = total;
  if (total <= maxBytes) return result;

  files.sort((a, b) => a.mtime - b.mtime); // oldest first
  const target = Math.floor(maxBytes * lowWatermarkRatio);

  for (const f of files) {
    if (total <= target) break;
    try {
      await fs.promises.unlink(f.full);
      total -= f.size;
      result.prunedFiles += 1;
      result.prunedBytes += f.size;
    } catch {}
  }

  result.finalSize = total;
  return result;
}
