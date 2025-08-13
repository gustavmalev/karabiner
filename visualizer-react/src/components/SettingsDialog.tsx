import { Switch, Button, Input, Select, SelectItem } from './ui';
import { Modal } from './Modals/Modal';
import { useStore } from '../state/store';
import { exportFullState, importFullState, type ImportMode } from '../state/persistence';
import { useRef, useState } from 'react';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setState = useStore.setState;

  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Settings</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Show Undo/Redo buttons</div>
            <div className="text-xs text-default-500">Hides the toolbar Undo/Redo</div>
          </div>
          <Switch
            isSelected={!!settings.showUndoRedo}
            onValueChange={(v) => setSettings({ showUndoRedo: v })}
            aria-label="Show Undo/Redo buttons"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Max snapshots</div>
            <div className="text-xs text-default-500">0 = unlimited. Applies to newly created snapshots.</div>
          </div>
          <div className="w-28">
            <Input
              aria-label="Max snapshots"
              type="number"
              min={0}
              size="sm"
              value={String(settings.maxSnapshots ?? 0)}
              onValueChange={(val) => {
                const n = Math.max(0, Number.parseInt(val || '0', 10) || 0);
                setSettings({ maxSnapshots: n });
              }}
            />
          </div>
        </div>
        <div className="pt-2 border-t border-default-200/50" />
        <div className="space-y-3">
          <div className="text-sm font-medium">Backup and Restore</div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm">Export full backup</div>
              <div className="text-xs text-default-500">Exports configuration, snapshots, settings.</div>
            </div>
            <Button
              size="sm"
              onPress={async () => {
                setError(null);
                try {
                  await exportFullState();
                } catch (e: any) {
                  setError(e?.message || 'Export failed');
                }
              }}
            >Export</Button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm">Import backup</div>
                <div className="text-xs text-default-500">Choose a JSON file previously exported.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  aria-label="Import file"
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Button size="sm" variant="flat" onPress={() => fileInputRef.current?.click()}>
                  {file ? 'Change file' : 'Choose file'}
                </Button>
                <div className="text-xs text-default-500 max-w-[200px] truncate">{file ? file.name : 'No file selected'}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-default-500">Conflict resolution</div>
              <div className="w-56">
                <Select
                  aria-label="Import mode"
                  selectedKeys={new Set([importMode])}
                  onSelectionChange={(keys) => {
                    const v = Array.from(keys as Set<string>)[0] as ImportMode | undefined;
                    if (v) setImportMode(v);
                  }}
                  size="sm"
                >
                  <SelectItem key="merge" description="Keep existing data when conflicts occur">Merge</SelectItem>
                  <SelectItem key="replace" description="Overwrite all existing data">Replace</SelectItem>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                color="primary"
                isDisabled={!file || busy}
                onPress={async () => {
                  if (!file) return;
                  setError(null);
                  const proceed = importMode === 'replace'
                    ? window.confirm('This will overwrite existing data. Continue?')
                    : true;
                  if (!proceed) return;
                  try {
                    setBusy(true);
                    const p = await importFullState(file, importMode);
                    // Hydrate in-memory store
                    setState({
                      config: p.config,
                      lastSavedConfig: p.config,
                      lastSavedAt: p.lastSavedAt ?? null,
                      filter: p.filter,
                      locks: p.locks,
                      blockedKeys: p.blockedKeys,
                      keyboardLayout: p.keyboardLayout,
                      aiKey: p.aiKey,
                      isDirty: false,
                      snapshots: p.snapshots ?? [],
                      settings: (p as any).settings ?? { showUndoRedo: true, maxSnapshots: 100 },
                    });
                    setFile(null);
                  } catch (e: any) {
                    setError(e?.message || 'Import failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >{busy ? 'Importing…' : 'Import'}</Button>
            </div>
            {error && (
              <div className="text-xs text-danger-500">{error}</div>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="flat" onPress={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
