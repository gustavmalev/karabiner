import { useMemo, useState } from 'react';
import { Button, Input, Kbd } from '@heroui/react';
import { Modal } from '../../components/Modals/Modal';
import { useStore } from '../../state/store';
import { zExported } from '../../state/migrations';
import { diffConfigs } from '../../utils/diff';
import type { Config } from '../../types';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const storeConfig = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ schemaVersion: number; exportedAt?: string; config: Config } | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await readFileAsText(f);
      setError(null);
      // Try strict exported format first
      try {
        const j = JSON.parse(txt);
        const r = zExported.parse(j);
        setParsed({ schemaVersion: r.schemaVersion, exportedAt: r.exportedAt, config: r.config });
        return;
      } catch (zerr) {
        // Fallback: try lenient { schemaVersion, config }
        try {
          const j = JSON.parse(txt);
          if (typeof j.schemaVersion === 'number' && j.config && typeof j.config === 'object') {
            setParsed({ schemaVersion: j.schemaVersion, config: j.config as Config });
            return;
          }
          throw zerr;
        } catch {
          setParsed(null);
          setError('Invalid import file: not a recognized layout JSON.');
        }
      }
    } catch {
      setError('Failed to read file');
    }
  }

  const summary = useMemo(() => {
    if (!parsed) return null;
    return diffConfigs(storeConfig, parsed.config);
  }, [parsed, storeConfig]);

  function onConfirm() {
    if (!parsed) return;
    // Apply incoming config; setConfig marks dirty
    setConfig(parsed.config);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Import Layout</h3>
        <div className="flex items-center gap-2">
          <Input type="file" aria-label="Choose JSON file" onChange={onPickFile} className="max-w-full" />
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}
        {!error && parsed && summary && (
          <div className="space-y-2 text-sm">
            <div className="text-default-600">Schema v{parsed.schemaVersion}{parsed.exportedAt ? ` · exported ${new Date(parsed.exportedAt).toLocaleString()}` : ''}</div>
            <ul className="list-disc pl-5">
              <li><b>Layers added:</b> {summary.layersAdded.length} {summary.layersAdded.length ? `(${summary.layersAdded.join(', ')})` : ''}</li>
              <li><b>Layers removed:</b> {summary.layersRemoved.length} {summary.layersRemoved.length ? `(${summary.layersRemoved.join(', ')})` : ''}</li>
              <li><b>Layers changed:</b> {summary.layersChanged.length} {summary.layersChanged.length ? `(${summary.layersChanged.join(', ')})` : ''}</li>
              <li><b>Commands added:</b> {summary.commandsAdded}</li>
              <li><b>Commands removed:</b> {summary.commandsRemoved}</li>
              <li><b>Commands changed:</b> {summary.commandsChanged}</li>
            </ul>
            <div className="text-default-500">Confirm to replace the current layout with the imported one. You can undo later (<Kbd>Cmd</Kbd>+<Kbd>Z</Kbd>).</div>
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>Cancel</Button>
          <Button color="primary" variant="solid" onPress={onConfirm} isDisabled={!parsed}>Import</Button>
        </div>
      </div>
    </Modal>
  );
}
