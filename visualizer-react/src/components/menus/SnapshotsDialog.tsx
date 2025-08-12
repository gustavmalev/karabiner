import { useEffect, useMemo, useState } from 'react';
import { Button, Listbox, ListboxItem, Input } from '@heroui/react';
import { Modal } from '../Modals/Modal';
import { useStore } from '../../state/store';
import { SnapshotDiff } from './SnapshotDiff';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function SnapshotsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snapshots = useStore((s) => s.snapshots);
  const current = useStore((s) => s.config);
  const revertToSnapshot = useStore((s) => s.revertToSnapshot);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);

  const [query, setQuery] = useState('');
  const pageSize = 50;
  const listAll = useMemo(() => [...snapshots].reverse(), [snapshots]);
  const listFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listAll;
    return listAll.filter((s) => s.name.toLowerCase().includes(q));
  }, [listAll, query]);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(listFiltered.length / pageSize));
  useEffect(() => {
    // Reset page if query changes or total pages shrink
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);
  const start = (page - 1) * pageSize;
  const listPage = listFiltered.slice(start, start + pageSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => listFiltered.find((s) => s.id === (selectedId || listFiltered[0]?.id)) || null, [listFiltered, selectedId]);

  function onRevert(id: string) {
    revertToSnapshot(id);
    onClose();
  }

  function onDelete(id: string) {
    if (window.confirm('Delete this snapshot?')) deleteSnapshot(id);
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Snapshots</h3>
          {selected ? (
            <div className="flex items-center gap-2 text-[11px] text-default-500">
              <span>Comparing to current</span>
            </div>
          ) : null}
        </div>

        {listFiltered.length === 0 ? (
          <div className="text-sm text-default-500">No snapshots yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px,1fr]">
            <div className="rounded-medium border border-default-200">
              <div className="flex items-center gap-2 p-2 border-b border-default-200">
                <Input
                  size="sm"
                  aria-label="Search snapshots"
                  placeholder="Search snapshots..."
                  value={query}
                  onValueChange={(v) => { setQuery(v); setPage(1); }}
                />
                <div className="text-[11px] text-default-500 whitespace-nowrap px-1">
                  {listFiltered.length} total
                </div>
              </div>
              <Listbox
                aria-label="Snapshots"
                selectionMode="single"
                selectedKeys={(selected && listPage.some((x) => x.id === selected.id)) ? new Set([selected.id]) : new Set()}
                onSelectionChange={(keys) => {
                  const id = Array.from(keys as Set<React.Key>)[0];
                  if (typeof id === 'string') setSelectedId(id);
                }}
                className="max-h-96 overflow-auto"
              >
                {listPage.map((s) => (
                  <ListboxItem
                    key={s.id}
                    textValue={s.name}
                    onPress={() => setSelectedId(s.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onDelete(s.id);
                    }}
                    endContent={(
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Delete snapshot"
                        className="text-danger hover:bg-danger/10 rounded-small px-1 py-0.5 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{s.name}</span>
                      <span className="text-[11px] text-default-500">{timeAgo(s.createdAt)}</span>
                    </div>
                  </ListboxItem>
                ))}
              </Listbox>
              <div className="flex items-center justify-between gap-2 p-2 border-t border-default-200 text-[11px] text-default-600">
                <div>Page {page} / {totalPages}</div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="flat" isDisabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button size="sm" variant="flat" isDisabled={page >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {selected ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{selected.name}</span>
                      <span className="text-[11px] text-default-500">{timeAgo(selected.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" color="primary" onPress={() => onRevert(selected.id)}>
                        Revert to this snapshot
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-medium border border-default-200 p-3">
                    <SnapshotDiff base={current} target={selected.config} />
                  </div>
                </>
              ) : (
                <div className="text-sm text-default-500">Select a snapshot to see details.</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
