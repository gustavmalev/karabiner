import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { AppInfo, Config, Data, KeyCode } from '../types';
import { getApps, getConfig, getData } from '../api/client';
import { buildPersisted, loadPersisted, savePersistedDebounced } from './persistence';

export type Filter = 'all' | 'available' | 'sublayer' | 'custom' | 'thirdparty';
export type KeyboardLayout = 'ansi' | 'iso';

type State = {
  data: Data | null;
  config: Config | null;
  apps: AppInfo[];
  currentLayerKey: KeyCode | null;
  filter: Filter;
  locks: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  isDirty: boolean;
  aiKey: string;
};

type Action =
  | { type: 'setData'; data: Data }
  | { type: 'setConfig'; config: Config }
  | { type: 'setApps'; apps: AppInfo[] }
  | { type: 'setCurrentLayerKey'; key: KeyCode | null }
  | { type: 'setFilter'; filter: Filter }
  | { type: 'toggleLock'; key: KeyCode }
  | { type: 'setKeyboardLayout'; layout: KeyboardLayout }
  | { type: 'setAIKey'; aiKey: string }
  | { type: 'markDirty' }
  | { type: 'markSaved' }
  | {
      type: 'hydrate';
      payload: {
        data?: Data | null;
        config?: Config | null;
        apps?: AppInfo[];
        filter?: Filter;
        locks?: Record<KeyCode, boolean>;
        keyboardLayout?: KeyboardLayout;
        aiKey?: string;
      };
    };

// Legacy keys (kept only to read if needed; unified persistence is used now)
const STORAGE_KEYS = {
  locks: 'vrx_locks',
  filter: 'vrx_filter',
  layout: 'vrx_layout',
  aiKey: 'vrx_aiKey',
};

const initialState = (): State => {
  // Start with sensible defaults; a later hydrate will replace these from persisted or server
  const locks = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.locks) || '{}'); } catch { return {}; }
  })();
  const storedFilter = (localStorage.getItem(STORAGE_KEYS.filter) as Filter | 'locked' | null) || 'all';
  const filter: Filter = storedFilter === 'locked' ? 'all' : (storedFilter as Filter);
  const keyboardLayout = (localStorage.getItem(STORAGE_KEYS.layout) as KeyboardLayout) || 'ansi';
  const aiKey = localStorage.getItem(STORAGE_KEYS.aiKey) || '';
  return {
    data: null,
    config: null,
    apps: [],
    currentLayerKey: null,
    filter,
    locks,
    keyboardLayout,
    isDirty: false,
    aiKey,
  };
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setData':
      return { ...state, data: action.data };
    case 'setConfig':
      return { ...state, config: action.config, isDirty: true };
    case 'setApps':
      return { ...state, apps: action.apps };
    case 'setCurrentLayerKey':
      return { ...state, currentLayerKey: action.key };
    case 'setFilter': {
      return { ...state, filter: action.filter, isDirty: true };
    }
    case 'toggleLock': {
      const locks = { ...state.locks, [action.key]: !state.locks[action.key] };
      return { ...state, locks, isDirty: true };
    }
    case 'setKeyboardLayout': {
      return { ...state, keyboardLayout: action.layout, isDirty: true };
    }
    case 'setAIKey': {
      return { ...state, aiKey: action.aiKey, isDirty: true };
    }
    case 'markDirty':
      return { ...state, isDirty: true };
    case 'markSaved':
      return { ...state, isDirty: false };
    case 'hydrate': {
      const p = action.payload;
      return {
        ...state,
        data: p.data ?? state.data,
        config: p.config ?? state.config,
        apps: p.apps ?? state.apps,
        filter: p.filter ?? state.filter,
        locks: p.locks ?? state.locks,
        keyboardLayout: p.keyboardLayout ?? state.keyboardLayout,
        aiKey: p.aiKey ?? state.aiKey,
        isDirty: false,
      };
    }
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as State, initialState);

  useEffect(() => {
    // First try to hydrate from local persisted state
    const persisted = loadPersisted();
    if (persisted) {
      dispatch({
        type: 'hydrate',
        payload: {
          config: persisted.config,
          filter: persisted.filter,
          locks: persisted.locks,
          keyboardLayout: persisted.keyboardLayout,
          aiKey: persisted.aiKey,
        },
      });
    }

    // Always fetch data/apps; fetch config only if none present
    (async () => {
      const [data, apps] = await Promise.all([getData(), getApps()]);
      dispatch({ type: 'setData', data });

      if (!persisted) {
        const config = await getConfig();
        // Hydrate config without marking dirty
        dispatch({ type: 'hydrate', payload: { config } });
      }
      dispatch({ type: 'setApps', apps });
    })().catch((e) => console.error(e));
  }, []);

  // Autosave to localStorage with 500ms debounce whenever dirty
  useEffect(() => {
    if (!state.isDirty || !state.config) return;
    const persisted = buildPersisted({
      config: state.config,
      locks: state.locks,
      filter: state.filter,
      keyboardLayout: state.keyboardLayout,
      aiKey: state.aiKey,
    });
    // Persist locally but do not clear the server dirty flag; server Save controls that
    savePersistedDebounced(persisted);
  }, [state.isDirty, state.config, state.locks, state.filter, state.keyboardLayout, state.aiKey]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
