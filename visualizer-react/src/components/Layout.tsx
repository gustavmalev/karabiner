import React from 'react';
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
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Visualizer</h1>
            <div className="flex items-center gap-2">
              <button
                className={`rounded-md border px-3 py-1.5 text-sm ${state.isDirty ? 'border-emerald-500 text-emerald-700 hover:bg-emerald-50' : 'opacity-50'}`}
                disabled={!state.isDirty}
                onClick={onSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
