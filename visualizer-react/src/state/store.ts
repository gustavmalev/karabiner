import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { KeyCode } from '../types';
import type { StoreSnapshot, NamedSnapshot, StoreState, AppSlice, UISlice, ConfigSlice } from './types';
import { buildPersisted, loadPersisted, savePersistedAsync } from './persistence';
import { shallow } from './utils';
import { getApps, getConfig, getData } from '../api/client';

const initialBase = () => ({
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
  settings: { showUndoRedo: true, maxSnapshots: 100 },
});

const makeSnapshot = (s: StoreState): StoreSnapshot => ({
  config: s.config,
});

// Slice creators
const createAppSlice = (set: any): AppSlice => ({
  data: null,
  apps: [],
  setData: (data) => set({ data }),
  setApps: (apps) => set({ apps }),
});

const createUISlice = (set: any): UISlice => ({
  currentLayerKey: null,
  filter: 'all',
  locks: {},
  blockedKeys: {},
  keyboardLayout: 'ansi',
  aiKey: '',
  importDialogOpen: false,
  settings: { showUndoRedo: true, maxSnapshots: 100 },

  setCurrentLayerKey: (key) => set({ currentLayerKey: key }),
  setFilter: (filter) => set({ filter }),
  toggleLock: (key) => set((prev: StoreState) => ({
    locks: { ...prev.locks, [key]: !prev.locks[key] } as Record<KeyCode, boolean>,
  } as Partial<StoreState> as StoreState)),
  toggleBlocked: (key) => set((prev: StoreState) => ({
    blockedKeys: { ...prev.blockedKeys, [key]: !prev.blockedKeys[key] } as Record<KeyCode, boolean>,
  } as Partial<StoreState> as StoreState)),
  setKeyboardLayout: (layout) => set({ keyboardLayout: layout }),
  setAIKey: (aiKey) => set({ aiKey }),
  openImportDialog: () => set({ importDialogOpen: true }),
  closeImportDialog: () => set({ importDialogOpen: false }),
  setSettings: (patch) => set((prev: StoreState) => ({ settings: { ...prev.settings, ...patch } } as Partial<StoreState> as StoreState)),
});

const createConfigSlice = (set: any, get: any): ConfigSlice => ({
  config: null,
  lastSavedConfig: null,
  lastSavedAt: null,
  isDirty: false,
  history: [],
  future: [],
  historyLimit: 50,
  snapshots: [],

  setConfig: (config) => set((prev: StoreState) => {
    const hist = [...prev.history, makeSnapshot(prev as StoreState)];
    if (hist.length > prev.historyLimit) hist.shift();
    return { config, isDirty: true, history: hist, future: [] } as Partial<StoreState> as StoreState;
  }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, lastSavedConfig: get().config || null, lastSavedAt: Date.now() }),
  undo: () => set((prev: StoreState) => {
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
  redo: () => set((prev: StoreState) => {
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
  revertToSaved: () => set((prev: StoreState) => {
    const saved = prev.lastSavedConfig;
    if (!saved) return {} as StoreState;
    return {
      config: saved,
      isDirty: false,
      history: [],
      future: [],
    } as Partial<StoreState> as StoreState;
  }),
  createSnapshot: (name: string) => set((prev: StoreState) => {
    const entry: NamedSnapshot = {
      id: `${Date.now()}`,
      name: name?.trim() || 'Snapshot',
      createdAt: Date.now(),
      config: prev.config,
    };
    const list = [...prev.snapshots, entry];
    const limit = (get().settings?.maxSnapshots ?? 100);
    if (limit > 0) {
      while (list.length > limit) list.shift();
    }
    return { snapshots: list } as Partial<StoreState> as StoreState;
  }),
  revertToSnapshot: (id: string) => set((prev: StoreState) => {
    const snap = prev.snapshots.find((s) => s.id === id);
    if (!snap) return {} as StoreState;
    return {
      config: snap.config,
      isDirty: true,
      history: [...prev.history, { config: prev.config } as StoreSnapshot],
      future: [],
    } as Partial<StoreState> as StoreState;
  }),
  deleteSnapshot: (id: string) => set((prev: StoreState) => {
    const list = prev.snapshots.filter((s) => s.id !== id);
    return { snapshots: list } as Partial<StoreState> as StoreState;
  }),
});

export const useStore = create<StoreState>()(subscribeWithSelector((set, get) => ({
  ...initialBase(),
  ...createAppSlice(set),
  ...createUISlice(set),
  ...createConfigSlice(set, get),
})));

// Initialize store: hydrate from persisted, then fetch data/apps and config (if needed)
export async function initializeStore() {
  const persisted = await loadPersisted();
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
      settings: (persisted as any).settings ?? { showUndoRedo: true, maxSnapshots: 100 },
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

// Subscribe to changes and persist locally immediately (async, queued) when dirty
if (typeof window !== 'undefined' && enableStorePersistence) {
  useStore.subscribe(
    (s) => ({
      config: s.config,
      locks: s.locks,
      blockedKeys: s.blockedKeys,
      filter: s.filter,
      keyboardLayout: s.keyboardLayout,
      aiKey: s.aiKey,
      lastSavedAt: s.lastSavedAt,
      snapshots: s.snapshots,
      settings: s.settings,
    }),
    (snap, prev) => {
      if (shallow(snap, prev)) return;
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
        void savePersistedAsync(p);
      }
    }
  );
}
