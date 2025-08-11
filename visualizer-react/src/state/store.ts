import { create } from 'zustand';
import type { AppInfo, Config, Data, KeyCode } from '../types';
import type { Filter, KeyboardLayout } from './types';
import { buildPersisted, loadPersisted, savePersistedDebounced } from './persistence';
import { getApps, getConfig, getData } from '../api/client';

type StoreSnapshot = {
  config: Config | null;
};

export type StoreState = {
  // data
  data: Data | null;
  config: Config | null;
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
  // history
  history: StoreSnapshot[];
  future: StoreSnapshot[];
  historyLimit: number;

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
  undo: () => void;
  redo: () => void;
};

type StoreBase = {
  data: Data | null;
  config: Config | null;
  apps: AppInfo[];
  currentLayerKey: KeyCode | null;
  filter: Filter;
  locks: Record<KeyCode, boolean>;
  blockedKeys: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  aiKey: string;
  isDirty: boolean;
  history: StoreSnapshot[];
  future: StoreSnapshot[];
  historyLimit: number;
};

const initial = (): StoreBase => ({
  data: null,
  config: null,
  apps: [],
  currentLayerKey: null,
  filter: 'all',
  locks: {},
  blockedKeys: {},
  keyboardLayout: 'ansi',
  aiKey: '',
  isDirty: false,
  history: [],
  future: [],
  historyLimit: 50,
});

const makeSnapshot = (s: StoreState): StoreSnapshot => ({
  config: s.config,
});

export const useStore = create<StoreState>((set, _get) => ({
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
  markSaved: () => set({ isDirty: false }),
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
}));

// Initialize store: hydrate from persisted, then fetch data/apps and config (if needed)
export async function initializeStore() {
  const persisted = loadPersisted();
  if (persisted) {
    useStore.setState({
      config: persisted.config,
      filter: persisted.filter,
      locks: persisted.locks,
      blockedKeys: persisted.blockedKeys,
      keyboardLayout: persisted.keyboardLayout,
      aiKey: persisted.aiKey,
      isDirty: false,
    });
  }
  const [data, apps] = await Promise.all([getData(), getApps()]);
  useStore.setState({ data });
  if (!persisted) {
    const config = await getConfig();
    useStore.setState({ config, isDirty: false });
  }
  useStore.setState({ apps });
}

// During migration, we can disable auto-persistence here and let the legacy provider handle it
export const enableStorePersistence = true;

// Subscribe to changes and persist locally with debounce when dirty
let prevSnapshot: Pick<StoreState, 'config' | 'locks' | 'blockedKeys' | 'filter' | 'keyboardLayout' | 'aiKey' | 'isDirty'> = {
  config: null,
  locks: {},
  blockedKeys: {},
  filter: 'all',
  keyboardLayout: 'ansi',
  aiKey: '',
  isDirty: false,
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
    } as typeof prevSnapshot;

    const changed =
      snap.config !== prevSnapshot.config ||
      snap.locks !== prevSnapshot.locks ||
      snap.blockedKeys !== prevSnapshot.blockedKeys ||
      snap.filter !== prevSnapshot.filter ||
      snap.keyboardLayout !== prevSnapshot.keyboardLayout ||
      snap.aiKey !== prevSnapshot.aiKey ||
      snap.isDirty !== prevSnapshot.isDirty;

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
        });
        // Do not clear dirty here; server Save controls that
        savePersistedDebounced(p);
      }
    }
  });
}
