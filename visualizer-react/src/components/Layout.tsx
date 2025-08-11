import React, { useState } from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { useStore } from '../state/store';
import { saveConfig } from '../api/client';
import { ImportDialog } from '../features/import/ImportDialog';
import { buildPersisted, exportJson } from '../state/persistence';

export function Layout({ children }: { children: React.ReactNode }) {
  const config = useStore((s) => s.config);
  const locks = useStore((s) => s.locks);
  const filter = useStore((s) => s.filter);
  const keyboardLayout = useStore((s) => s.keyboardLayout);
  const aiKey = useStore((s) => s.aiKey);
  const blockedKeys = useStore((s) => s.blockedKeys);
  const isDirty = useStore((s) => s.isDirty);
  const markSaved = useStore((s) => s.markSaved);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const revertToSaved = useStore((s) => s.revertToSaved);
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

  function onExport() {
    if (!config) return;
    const p = buildPersisted({ config, locks, filter, keyboardLayout, aiKey, blockedKeys });
    exportJson(p);
  }

  return (
    <div className="min-h-screen light bg-background text-foreground">
      <Navbar maxWidth="2xl" isBordered>
        <NavbarBrand>
          <h1 className="text-base font-semibold">Visualizer</h1>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          {historyCount > 0 && (
            <Tooltip content="Undo (Cmd/Ctrl+Z)" placement="bottom">
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => undo()}>
                  Undo {historyCount ? `(${historyCount})` : ''}
                </Button>
              </div>
            </Tooltip>
          )}
          {futureCount > 0 && (
            <Tooltip content="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)" placement="bottom">
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => redo()}>
                  Redo {futureCount ? `(${futureCount})` : ''}
                </Button>
              </div>
            </Tooltip>
          )}
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="flat">File</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="File menu" onAction={(key) => {
              if (key === 'import') setImportOpen(true);
              else if (key === 'export') onExport();
            }}>
              <DropdownItem key="import">Import…</DropdownItem>
              <DropdownItem key="export" isDisabled={!config}>Export</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Tooltip content="Save changes" placement="bottom">
            <div className="inline-block">
              <Button variant="solid" color="primary" isDisabled={!isDirty} onPress={onSave}>
                Save
              </Button>
            </div>
          </Tooltip>
          {isDirty && (
            <Tooltip content="Revert to last saved" placement="bottom">
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => revertToSaved()}>Cancel</Button>
              </div>
            </Tooltip>
          )}
        </NavbarContent>
      </Navbar>
      <main className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</main>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
