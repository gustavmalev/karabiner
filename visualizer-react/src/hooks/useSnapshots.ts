import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListParams } from '../services/database';
import { listSnapshots, getSnapshot, createSnapshot, createSnapshotsBulk, deleteSnapshotsBulk, invalidateCaches } from '../services/snapshot-service';
import { measureAsync } from '../utils/performance';

export type UseSnapshotsOptions = {
  pageSize?: number;
  sortBy?: ListParams['sortBy'];
  sortDir?: ListParams['sortDir'];
  namePrefix?: string;
};

export function useSnapshots(opts: UseSnapshotsOptions = {}) {
  const { pageSize = 20, sortBy = 'createdAt', sortDir = 'desc', namePrefix } = opts;
  const [items, setItems] = useState<Awaited<ReturnType<typeof listSnapshots>>['data']>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const offsetRef = useRef(0);

  const baseParams: ListParams = useMemo(() => {
    const p: ListParams = { limit: pageSize, offset: 0, sortBy, sortDir };
    if (namePrefix !== undefined) (p as any).namePrefix = namePrefix;
    return p;
  }, [pageSize, sortBy, sortDir, namePrefix]);

  const loadPage = useCallback(async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : offsetRef.current;
    const params = { ...baseParams, offset };
    const { result } = await measureAsync(() => listSnapshots(params), 'listSnapshots');
    const { data, durationMs } = result;
    setTotalTimeMs((t) => t + durationMs);
    setItems((prev) => reset ? data : [...prev, ...data]);
    offsetRef.current = offset + (data?.length ?? 0);
    setHasMore((data?.length ?? 0) === (baseParams.limit ?? pageSize));
    setLoading(false);
  }, [baseParams, pageSize]);

  useEffect(() => {
    // initial load or when params change
    offsetRef.current = 0;
    setItems([]);
    setHasMore(true);
    void loadPage(true);
  }, [loadPage]);

  const reload = useCallback(async () => {
    invalidateCaches();
    offsetRef.current = 0;
    setItems([]);
    setHasMore(true);
    await loadPage(true);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) await loadPage(false);
  }, [hasMore, loading, loadPage]);

  const getFull = useCallback(async (id: string) => getSnapshot(id), []);

  const createOne = useCallback(async (s: { id: string; name: string; config: unknown; createdAt?: number }) => {
    await createSnapshot(s);
    await reload();
  }, [reload]);

  const createBulk = useCallback(async (list: { id: string; name: string; config: unknown; createdAt?: number }[]) => {
    await createSnapshotsBulk(list);
    await reload();
  }, [reload]);

  const deleteBulk = useCallback(async (ids: string[]) => {
    await deleteSnapshotsBulk(ids);
    await reload();
  }, [reload]);

  return {
    items,
    loading,
    hasMore,
    totalTimeMs,
    loadMore,
    reload,
    getFull,
    createOne,
    createBulk,
    deleteBulk,
  };
}
