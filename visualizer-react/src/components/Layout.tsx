import React from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip } from '@heroui/react';
import { useAppState } from '../state/appState';
import { saveConfig } from '../api/client';

export function Layout({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useAppState();

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
        <NavbarContent justify="end">
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
    </div>
  );
}
