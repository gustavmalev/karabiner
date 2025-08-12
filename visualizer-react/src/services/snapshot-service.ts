import { appDb, clearSnapshotCaches, getSnapshotBlob, getSnapshotMeta, listSnapshotMetas, putSnapshot, deleteSnapshots, type ListParams, type SnapshotMeta } from './database';
import { measureAsync } from '../utils/performance';

// Public API for snapshots with caching + batch operations

export type SnapshotSummary = SnapshotMeta;
export type SnapshotFull = { meta: SnapshotMeta; config: unknown };

// Query cache key builder
const keyOf = (params: ListParams) => `list:${params.sortBy ?? 'createdAt'}:${params.sortDir ?? 'desc'}:${params.limit ?? 20}:${params.offset ?? 0}:${params.namePrefix ?? ''}`;

const listCache = new Map<string, SnapshotSummary[]>();

export async function listSnapshots(params: ListParams = {}): Promise<{ data: SnapshotSummary[]; durationMs: number }> {
  const key = keyOf(params);
  const cached = listCache.get(key);
  if (cached) return { data: cached, durationMs: 0 };
  const { result, durationMs } = await measureAsync(() => listSnapshotMetas(params));
  listCache.set(key, result);
  return { data: result, durationMs };
}

export async function getSnapshot(id: string): Promise<SnapshotFull | undefined> {
  const [meta, blob] = await Promise.all([
    getSnapshotMeta(id),
    getSnapshotBlob(id),
  ]);
  if (!meta || !blob) return undefined;
  return { meta, config: blob.config };
}

export async function createSnapshot(input: { id: string; name: string; config: unknown; createdAt?: number }) {
  await putSnapshot(input.id, input.name, input.config, input.createdAt);
  invalidateCaches();
}

export async function createSnapshotsBulk(list: { id: string; name: string; config: unknown; createdAt?: number }[]) {
  await appDb.transaction('rw', appDb.snapshots, appDb.snapshotBlobs, async () => {
    const metas: SnapshotMeta[] = list.map(({ id, name, config, createdAt }) => {
      const s = tryCalcSize(config);
      const base = { id, name, createdAt: createdAt ?? Date.now() } as const;
      return (s === undefined) ? base as unknown as SnapshotMeta : { ...base, size: s } as SnapshotMeta;
    });
    const blobs = list.map(({ id, config }) => ({ id, config }));
    await appDb.snapshots.bulkPut(metas);
    await appDb.snapshotBlobs.bulkPut(blobs);
  });
  invalidateCaches();
}

export async function deleteSnapshotsBulk(ids: string[]) {
  await deleteSnapshots(ids);
  invalidateCaches();
}

export function invalidateCaches() {
  listCache.clear();
  clearSnapshotCaches();
}

function tryCalcSize(obj: unknown): number | undefined {
  try { return JSON.stringify(obj).length; } catch { return undefined; }
}
