import { useState } from 'react';
import { Button, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react';
import { useStore, type NamedSnapshot } from '../../state/store';
import { SnapshotsDialog } from './SnapshotsDialog';

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

export function HistoryMenu() {
  const [manageOpen, setManageOpen] = useState(false);
  const snapshots = useStore((s) => s.snapshots);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const revertToSnapshot = useStore((s) => s.revertToSnapshot);

  const onCreateSnapshot = () => {
    // Delay prompt until after the dropdown closes to avoid being suppressed
    setTimeout(() => {
      const name = window.prompt('Snapshot name', 'Snapshot');
      if (name == null) return;
      createSnapshot(name);
    }, 0);
  };

  const recent: NamedSnapshot[] = [...snapshots].slice(-6).reverse();

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button size="sm" variant="flat">History</Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="History menu" onAction={(key) => {
          if (key === 'manage') setManageOpen(true);
          else if (typeof key === 'string' && key.startsWith('snap:')) {
            const id = key.slice(5);
            revertToSnapshot(id);
          }
        }}>
          <DropdownItem key="create" onPress={onCreateSnapshot}>Create snapshot</DropdownItem>
          <DropdownItem key="manage">Manage snapshots…</DropdownItem>
          {recent.length > 0 ? (<DropdownItem key="sep" className="h-[1px] p-0 bg-default-200" isReadOnly />) : null}
          {recent.length === 0 ? (
            <DropdownItem key="empty" isReadOnly className="text-default-400">No snapshots</DropdownItem>
          ) : null}
          {(
            recent.map((s) => (
              <DropdownItem key={`snap:${s.id}`}>
                <div className="flex flex-col">
                  <span className="text-sm">{s.name}</span>
                  <span className="text-[10px] text-default-500">{timeAgo(s.createdAt)}</span>
                </div>
              </DropdownItem>
            )) as unknown as any
          )}
        </DropdownMenu>
      </Dropdown>
      <SnapshotsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </>
  );
}
