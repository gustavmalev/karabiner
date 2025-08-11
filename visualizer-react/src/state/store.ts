import { create } from 'zustand';
import type { AppInfo, Config, Data, KeyCode } from '../types';
import type { Filter, KeyboardLayout } from './types';
import { buildPersisted, loadPersisted, savePersistedDebounced } from './persistence';
import { getApps, getConfig, getData } from '../api/client';

type StoreSnapshot = {
  config: Config | null;
};

export type NamedSnapshot = {
  id: string;
  name: string;
  createdAt: number;
  config: Config | null;
};

export type StoreState = {
  // data
  data: Data | null;
  config: Config | null;
  lastSavedConfig: Config | null;
  lastSavedAt: number | null;
  apps: AppInfo[];
  // ui
  currentLayerKey: KeyCode | null;
  filter: Filter;
  locks: Record<KeyCode, boolean>;
  blockedKeys: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  aiKey: string;
  // status
  isDirty: boolean;
  // dialogs
  importDialogOpen: boolean;
  // history
  history: StoreSnapshot[];
  future: StoreSnapshot[];
  historyLimit: number;
  // named snapshots (separate from undo/redo)
  snapshots: NamedSnapshot[];
  snapshotsLimit: number;
  // settings
  settings: { showUndoRedo: boolean };

  // actions
  setData: (data: Data) => void;
  setConfig: (config: Config) => void;
  setApps: (apps: AppInfo[]) => void;
  setCurrentLayerKey: (key: KeyCode | null) => void;
  setFilter: (filter: Filter) => void;
  toggleLock: (key: KeyCode) => void;
  toggleBlocked: (key: KeyCode) => void;
  setKeyboardLayout: (layout: KeyboardLayout) => void;
  setAIKey: (aiKey: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  undo: () => void;
  redo: () => void;
  revertToSaved: () => void;
  createSnapshot: (name: string) => void;
  revertToSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  setSettings: (patch: Partial<{ showUndoRedo: boolean }>) => void;
};

type StoreBase = {
  data: Data | null;
  config: Config | null;
  lastSavedConfig: Config | null;
  lastSavedAt: number | null;
  apps: AppInfo[];
  currentLayerKey: KeyCode | null;
  filter: Filter;
  locks: Record<KeyCode, boolean>;
  blockedKeys: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  aiKey: string;
  isDirty: boolean;
  importDialogOpen: boolean;
  history: StoreSnapshot[];
  future: StoreSnapshot[];
  historyLimit: number;
  snapshots: NamedSnapshot[];
  snapshotsLimit: number;
  settings: { showUndoRedo: boolean };
};

const initial = (): StoreBase => ({
  data: null,
  config: null,
  lastSavedConfig: null,
  lastSavedAt: null,
  apps: [],
  currentLayerKey: null,
  filter: 'all',
  locks: {},
  blockedKeys: {},
  keyboardLayout: 'ansi',
  aiKey: '',
  isDirty: false,
  importDialogOpen: false,
  history: [],
  future: [],
  historyLimit: 50,
  snapshots: [],
  snapshotsLimit: 10,
  settings: { showUndoRedo: true },
});

const makeSnapshot = (s: StoreState): StoreSnapshot => ({
  config: s.config,
});

export const useStore = create<StoreState>((set, get) => ({
  ...initial(),
  setData: (data) => set({ data }),
  setConfig: (config) => set((prev) => {
    const hist = [...prev.history, makeSnapshot(prev as StoreState)];
    if (hist.length > prev.historyLimit) hist.shift();
    return { config, isDirty: true, history: hist, future: [] } as Partial<StoreState> as StoreState;
  }),
  setApps: (apps) => set({ apps }),
  setCurrentLayerKey: (key) => set({ currentLayerKey: key }),
  setFilter: (filter) => set({ filter }),
  toggleLock: (key) => set((prev) => ({
    locks: { ...prev.locks, [key]: !prev.locks[key] } as Record<KeyCode, boolean>,
  } as Partial<StoreState> as StoreState)),
  toggleBlocked: (key) => set((prev) => ({
    blockedKeys: { ...prev.blockedKeys, [key]: !prev.blockedKeys[key] } as Record<KeyCode, boolean>,
  } as Partial<StoreState> as StoreState)),
  setKeyboardLayout: (layout) => set({ keyboardLayout: layout }),
  setAIKey: (aiKey) => set({ aiKey }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, lastSavedConfig: get().config || null, lastSavedAt: Date.now() }),
  openImportDialog: () => set({ importDialogOpen: true }),
  closeImportDialog: () => set({ importDialogOpen: false }),
  undo: () => set((prev) => {
    if (prev.history.length === 0) return {} as StoreState;
    const last = prev.history[prev.history.length - 1];
    const newHistory = prev.history.slice(0, -1);
    const newFuture = [...prev.future, { config: prev.config } as StoreSnapshot];
    return {
      config: last.config,
      history: newHistory,
      future: newFuture,
      isDirty: true,
    } as Partial<StoreState> as StoreState;
  }),
  redo: () => set((prev) => {
    if (prev.future.length === 0) return {} as StoreState;
    const last = prev.future[prev.future.length - 1];
    const newFuture = prev.future.slice(0, -1);
    const newHistory = [...prev.history, { config: prev.config } as StoreSnapshot];
    if (newHistory.length > prev.historyLimit) newHistory.shift();
    return {
      config: last.config,
      history: newHistory,
      future: newFuture,
      isDirty: true,
    } as Partial<StoreState> as StoreState;
  }),
  revertToSaved: () => set((prev) => {
    const saved = (prev as StoreState).lastSavedConfig;
    if (!saved) return {} as StoreState;
    return {
      config: saved,
      isDirty: false,
      history: [],
      future: [],
    } as Partial<StoreState> as StoreState;
  }),
  createSnapshot: (name: string) => set((prev) => {
    const entry: NamedSnapshot = {
      id: `${Date.now()}`,
      name: name?.trim() || 'Snapshot',
      createdAt: Date.now(),
      config: prev.config,
    };
    const list = [...prev.snapshots, entry];
    while (list.length > prev.snapshotsLimit) list.shift();
    return { snapshots: list } as Partial<StoreState> as StoreState;
  }),
  revertToSnapshot: (id: string) => set((prev) => {
    const snap = prev.snapshots.find((s) => s.id === id);
    if (!snap) return {} as StoreState;
    return {
      config: snap.config,
      isDirty: true,
      history: [...prev.history, { config: prev.config } as StoreSnapshot],
      future: [],
    } as Partial<StoreState> as StoreState;
  }),
  deleteSnapshot: (id: string) => set((prev) => {
    const list = prev.snapshots.filter((s) => s.id !== id);
    return { snapshots: list } as Partial<StoreState> as StoreState;
  }),
  setSettings: (patch) => set((prev) => ({ settings: { ...prev.settings, ...patch } } as Partial<StoreState> as StoreState)),
}));

// Initialize store: hydrate from persisted, then fetch data/apps and config (if needed)
export async function initializeStore() {
  const persisted = loadPersisted();
  if (persisted) {
    useStore.setState({
      config: persisted.config,
      lastSavedConfig: persisted.config,
      lastSavedAt: persisted.lastSavedAt ?? null,
      filter: persisted.filter,
      locks: persisted.locks,
      blockedKeys: persisted.blockedKeys,
      keyboardLayout: persisted.keyboardLayout,
      aiKey: persisted.aiKey,
      isDirty: false,
      snapshots: persisted.snapshots ?? [],
      settings: (persisted as any).settings ?? { showUndoRedo: true },
    });
  }
  const [data, apps] = await Promise.all([getData(), getApps()]);
  useStore.setState({ data });
  if (!persisted) {
    const config = await getConfig();
    useStore.setState({ config, lastSavedConfig: config, lastSavedAt: null, isDirty: false, snapshots: [] });
  }
  useStore.setState({ apps });
}

// During migration, we can disable auto-persistence here and let the legacy provider handle it
export const enableStorePersistence = true;

// Subscribe to changes and persist locally with debounce when dirty
let prevSnapshot: Pick<StoreState, 'config' | 'locks' | 'blockedKeys' | 'filter' | 'keyboardLayout' | 'aiKey' | 'isDirty' | 'lastSavedAt' | 'snapshots' | 'settings'> = {
  config: null,
  locks: {},
  blockedKeys: {},
  filter: 'all',
  keyboardLayout: 'ansi',
  aiKey: '',
  isDirty: false,
  lastSavedAt: null,
  snapshots: [],
  settings: { showUndoRedo: true },
};

if (typeof window !== 'undefined' && enableStorePersistence) {
  useStore.subscribe((state) => {
    const snap = {
      config: state.config,
      locks: state.locks,
      blockedKeys: state.blockedKeys,
      filter: state.filter,
      keyboardLayout: state.keyboardLayout,
      aiKey: state.aiKey,
      isDirty: state.isDirty,
      lastSavedAt: state.lastSavedAt,
      snapshots: state.snapshots,
      settings: state.settings,
    } as typeof prevSnapshot;

    const changed =
      snap.config !== prevSnapshot.config ||
      snap.locks !== prevSnapshot.locks ||
      snap.blockedKeys !== prevSnapshot.blockedKeys ||
      snap.filter !== prevSnapshot.filter ||
      snap.keyboardLayout !== prevSnapshot.keyboardLayout ||
      snap.aiKey !== prevSnapshot.aiKey ||
      snap.isDirty !== prevSnapshot.isDirty ||
      snap.lastSavedAt !== prevSnapshot.lastSavedAt ||
      snap.snapshots !== prevSnapshot.snapshots ||
      snap.settings !== prevSnapshot.settings;

    if (changed) {
      prevSnapshot = snap;
      if (snap.config) {
        const p = buildPersisted({
          config: snap.config,
          locks: snap.locks,
          blockedKeys: snap.blockedKeys,
          filter: snap.filter,
          keyboardLayout: snap.keyboardLayout,
          aiKey: snap.aiKey,
          lastSavedAt: snap.lastSavedAt,
          snapshots: snap.snapshots,
          settings: snap.settings,
        });
        // Do not clear dirty here; server Save controls that
        savePersistedDebounced(p);
      }
    }
  });
}
