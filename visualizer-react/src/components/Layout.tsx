import React, { useState } from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip } from '@heroui/react';
import { useStore } from '../state/store';
import { saveConfig } from '../api/client';
import { ImportDialog } from '../features/import/ImportDialog';
import { FileMenu } from './menus/FileMenu';
import { HistoryMenu } from './menus/HistoryMenu';
import { SettingsDialog } from './SettingsDialog';

export function Layout({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const config = useStore((s) => s.config);
  const isDirty = useStore((s) => s.isDirty);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const markSaved = useStore((s) => s.markSaved);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const revertToSaved = useStore((s) => s.revertToSaved);
  const historyCount = useStore((s) => s.history.length);
  const futureCount = useStore((s) => s.future.length);
  const importOpen = useStore((s) => s.importDialogOpen);
  const closeImportDialog = useStore((s) => s.closeImportDialog);
  const showUndoRedo = useStore((s) => s.settings.showUndoRedo);

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

  function timeAgo(ts: number | null): string {
    if (!ts) return '';
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  return (
    <div className="min-h-screen light bg-background text-foreground">
      <Navbar maxWidth="2xl" isBordered>
        <NavbarBrand>
          <h1
            className="text-base font-semibold cursor-pointer select-none"
            title="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            Visualizer
          </h1>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          <HistoryMenu />
          <FileMenu />
          {showUndoRedo && historyCount > 0 && (
            <Tooltip content="Undo (Cmd/Ctrl+Z)" placement="bottom">
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => undo()}>
                  <span>Undo</span>
                  {historyCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-default-200 text-foreground/80 text-[10px] h-4 min-w-4 px-1">{historyCount}</span>
                  )}
                </Button>
              </div>
            </Tooltip>
          )}
          {showUndoRedo && futureCount > 0 && (
            <Tooltip content="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)" placement="bottom">
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => redo()}>
                  <span>Redo</span>
                  {futureCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-default-200 text-foreground/80 text-[10px] h-4 min-w-4 px-1">{futureCount}</span>
                  )}
                </Button>
              </div>
            </Tooltip>
          )}
          <div className="hidden sm:block text-xs text-default-500 mr-2 select-none">
            {isDirty ? 'Unsaved changes' : (lastSavedAt ? `Saved ${timeAgo(lastSavedAt)}` : '')}
          </div>
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
      <ImportDialog open={importOpen} onClose={() => closeImportDialog()} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
