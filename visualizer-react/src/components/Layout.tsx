import React, { useState } from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip } from '@heroui/react';
import { useAppState } from '../state/appState';
import { saveConfig } from '../api/client';
import { ExportButton } from '../features/export/ExportButton';
import { ImportDialog } from '../features/import/ImportDialog';

export function Layout({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useAppState();
  const [importOpen, setImportOpen] = useState(false);

  async function onSave() {
    if (!state.config) return;
    try {
      await saveConfig(state.config);
      dispatch({ type: 'markSaved' });
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
          <Tooltip content="Import layout JSON" placement="bottom">
            <div className="inline-block">
              <Button variant="flat" onPress={() => setImportOpen(true)}>Import</Button>
            </div>
          </Tooltip>
          <ExportButton />
          <Tooltip content="Save changes" placement="bottom">
            <div className="inline-block">
              <Button variant="solid" color="primary" isDisabled={!state.isDirty} onPress={onSave}>
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
