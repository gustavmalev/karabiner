import Dexie from 'dexie';
import type { Table } from 'dexie';

export type SnapshotMeta = {
  id: string;
  name: string;
  createdAt: number; // epoch ms
  size?: number; // approximate JSON size
  tags?: string[];
};

export type SnapshotBlob = {
  id: string; // same as meta id
  config: unknown; // opaque configuration payload
};

// Use a dedicated DB name to avoid interfering with existing state DB
// Existing persisted state lives in src/state/database.ts ('KarabinerVisualizer').
// We keep snapshot data in a separate DB to prevent version conflicts.
const DB_NAME = 'KarabinerVisualizerSnapshots';

export class AppDatabase extends Dexie {
  // Existing table from legacy v1
  persisted!: Table<any, string>;
  // New optimized tables
  snapshots!: Table<SnapshotMeta, string>;
  snapshotBlobs!: Table<SnapshotBlob, string>;

  constructor() {
    super(DB_NAME);

    // v1 is defined in src/state/database.ts as { persisted: 'id' }
    // Define upgraded schema here with v2 preserving v1 table and adding new ones with indexes.
    this.version(2).stores({
      // Keep legacy table
      persisted: 'id',
      // Indexes: by createdAt, name, and compound [name+createdAt] for sorted queries
      snapshots: 'id, createdAt, name, [name+createdAt]',
      // Blob table keyed by id for payload
      snapshotBlobs: 'id',
    }).upgrade(async (tx) => {
      // No-op migration here; migration can be handled by a separate process if needed
      // Keeping upgrade hook for future use.
      void tx; // silence unused
    });
  }
}

export const appDb = new AppDatabase();

// Simple LRU cache for query results and snapshots
class LRU<K, V> {
  private map = new Map<K, V>();
  private capacity: number;
  constructor(capacity = 100) {
    this.capacity = capacity;
  }
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: K, val: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.capacity) {
      const first = this.map.keys().next().value as K | undefined;
      if (first !== undefined) this.map.delete(first);
    }
  }
  clear() { this.map.clear(); }
}

export const snapshotMetaCache = new LRU<string, SnapshotMeta>(200);
export const snapshotBlobCache = new LRU<string, SnapshotBlob>(50);

export type ListParams = {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'name';
  sortDir?: 'asc' | 'desc';
  namePrefix?: string;
};

export async function listSnapshotMetas(params: ListParams = {}): Promise<SnapshotMeta[]> {
  const { limit = 20, offset = 0, sortBy = 'createdAt', sortDir = 'desc', namePrefix } = params;
  let coll = sortBy === 'name' ? appDb.snapshots.orderBy('name') : appDb.snapshots.orderBy('createdAt');
  if (namePrefix) {
    // Efficient prefix query when sorted by name
    if (sortBy === 'name') {
      const lower = namePrefix;
      const upper = namePrefix + '\uffff';
      coll = appDb.snapshots.where('name').between(lower, upper, true, true) as any;
    }
  }
  let list = await (coll as any).toArray();
  if (sortDir === 'desc') list = list.reverse();
  const sliced = list.slice(offset, offset + limit);
  // warm cache
  for (const m of sliced) snapshotMetaCache.set(m.id, m);
  return sliced;
}

export async function getSnapshotMeta(id: string): Promise<SnapshotMeta | undefined> {
  const cached = snapshotMetaCache.get(id);
  if (cached) return cached;
  const m = await appDb.snapshots.get(id);
  if (m) snapshotMetaCache.set(m.id, m);
  return m ?? undefined;
}

export async function getSnapshotBlob(id: string): Promise<SnapshotBlob | undefined> {
  const cached = snapshotBlobCache.get(id);
  if (cached) return cached;
  const b = await appDb.snapshotBlobs.get(id);
  if (b) snapshotBlobCache.set(b.id, b);
  return b ?? undefined;
}

export async function putSnapshot(id: string, name: string, config: unknown, createdAt = Date.now()) {
  const size = tryCalcSize(config);
  const meta: SnapshotMeta = (size === undefined)
    ? { id, name, createdAt }
    : { id, name, createdAt, size };
  const blob: SnapshotBlob = { id, config };
  await appDb.transaction('rw', appDb.snapshots, appDb.snapshotBlobs, async () => {
    await appDb.snapshots.put(meta);
    await appDb.snapshotBlobs.put(blob);
  });
  snapshotMetaCache.set(id, meta);
  snapshotBlobCache.set(id, blob);
}

export async function deleteSnapshots(ids: string[]) {
  await appDb.transaction('rw', appDb.snapshots, appDb.snapshotBlobs, async () => {
    await appDb.snapshots.bulkDelete(ids);
    await appDb.snapshotBlobs.bulkDelete(ids);
  });
  // Clear caches to avoid stale entries
  await clearSnapshotCaches();
}

export async function clearSnapshotCaches() {
  snapshotMetaCache.clear();
  snapshotBlobCache.clear();
}

function tryCalcSize(obj: unknown): number | undefined {
  try { return JSON.stringify(obj).length; } catch { return undefined; }
}
