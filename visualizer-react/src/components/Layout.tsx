import React, { useState } from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip } from '@heroui/react';
import { useStore } from '../state/store';
import { saveConfig } from '../api/client';
import { ExportButton } from '../features/export/ExportButton';
import { ImportDialog } from '../features/import/ImportDialog';

export function Layout({ children }: { children: React.ReactNode }) {
  const config = useStore((s) => s.config);
  const isDirty = useStore((s) => s.isDirty);
  const markSaved = useStore((s) => s.markSaved);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const historyCount = useStore((s) => s.history.length);
  const futureCount = useStore((s) => s.future.length);
  const [importOpen, setImportOpen] = useState(false);

  async function onSave() {
    if (!config) return;
    try {
      await saveConfig(config);
      markSaved();
    } catch (e) {
      console.error('Failed to save config', e);
      // TODO: add toast later
    }
  }

  return (
    <div className="min-h-screen light bg-background text-foreground">
      <Navbar maxWidth="2xl" isBordered>
        <NavbarBrand>
          <h1 className="text-base font-semibold">Visualizer</h1>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          <Tooltip content="Undo (Cmd/Ctrl+Z)" placement="bottom">
            <div className="inline-block">
              <Button size="sm" variant="flat" onPress={() => undo()} isDisabled={!historyCount}>
                Undo {historyCount ? `(${historyCount})` : ''}
              </Button>
            </div>
          </Tooltip>
          <Tooltip content="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)" placement="bottom">
            <div className="inline-block">
              <Button size="sm" variant="flat" onPress={() => redo()} isDisabled={!futureCount}>
                Redo {futureCount ? `(${futureCount})` : ''}
              </Button>
            </div>
          </Tooltip>
          <Tooltip content="Import layout JSON" placement="bottom">
            <div className="inline-block">
              <Button variant="flat" onPress={() => setImportOpen(true)}>Import</Button>
            </div>
          </Tooltip>
          <ExportButton />
          <Tooltip content="Save changes" placement="bottom">
            <div className="inline-block">
              <Button variant="solid" color="primary" isDisabled={!isDirty} onPress={onSave}>
                Save
              </Button>
            </div>
          </Tooltip>
        </NavbarContent>
      </Navbar>
      <main className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</main>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
