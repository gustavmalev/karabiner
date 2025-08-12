import type { AppInfo, Config, Data, KeyCode } from '../types';

// UI enums
export type Filter = 'all' | 'available' | 'sublayer' | 'custom' | 'thirdparty';
export type KeyboardLayout = 'ansi' | 'iso';

// Snapshots
export type StoreSnapshot = {
  config: Config | null;
};

export type NamedSnapshot = {
  id: string;
  name: string;
  createdAt: number;
  config: Config | null;
};

// App slice (remote data etc.)
export interface AppSlice {
  data: Data | null;
  apps: AppInfo[];
  setData: (data: Data) => void;
  setApps: (apps: AppInfo[]) => void;
}

// UI slice (view state, preferences)
export interface UISlice {
  currentLayerKey: KeyCode | null;
  filter: Filter;
  locks: Record<KeyCode, boolean>;
  blockedKeys: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  aiKey: string;
  importDialogOpen: boolean;
  settings: { showUndoRedo: boolean; maxSnapshots: number };

  setCurrentLayerKey: (key: KeyCode | null) => void;
  setFilter: (filter: Filter) => void;
  toggleLock: (key: KeyCode) => void;
  toggleBlocked: (key: KeyCode) => void;
  setKeyboardLayout: (layout: KeyboardLayout) => void;
  setAIKey: (aiKey: string) => void;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  setSettings: (patch: Partial<{ showUndoRedo: boolean; maxSnapshots: number }>) => void;
}

// Config slice (document + history)
export interface ConfigSlice {
  config: Config | null;
  lastSavedConfig: Config | null;
  lastSavedAt: number | null;
  isDirty: boolean;
  history: StoreSnapshot[];
  future: StoreSnapshot[];
  historyLimit: number;
  snapshots: NamedSnapshot[];
  // snapshot limit is now user-configurable via settings; 0 means unlimited

  setConfig: (config: Config) => void;
  markDirty: () => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  revertToSaved: () => void;
  createSnapshot: (name: string) => void;
  revertToSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
}

// The full store state is a composition of slices. The keys remain flat for DX.
export type StoreState = AppSlice & UISlice & ConfigSlice;
