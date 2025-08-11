import { useMemo } from 'react';
import { Button, Listbox, ListboxItem } from '@heroui/react';
import { Modal } from '../Modals/Modal';
import { useStore } from '../../state/store';

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
  const revertToSnapshot = useStore((s) => s.revertToSnapshot);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);

  const list = useMemo(() => [...snapshots].reverse(), [snapshots]);

  function onRevert(id: string) {
    revertToSnapshot(id);
    onClose();
  }

  function onDelete(id: string) {
    // quick confirm for now; can be replaced by a nicer confirm dialog later
    if (window.confirm('Delete this snapshot?')) deleteSnapshot(id);
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Snapshots</h3>
        {list.length === 0 ? (
          <div className="text-sm text-default-500">No snapshots yet.</div>
        ) : (
          <Listbox aria-label="Snapshots" selectionMode="single" className="max-h-80 overflow-auto">
            {list.map((s) => (
              <ListboxItem
                key={s.id}
                textValue={s.name}
                onPress={() => onRevert(s.id)}
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
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
