import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { AppInfo, Config, Data, KeyCode } from '../types';
import { getApps, getConfig, getData } from '../api/client';

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
  | { type: 'markSaved' };

const STORAGE_KEYS = {
  locks: 'vrx_locks',
  filter: 'vrx_filter',
  layout: 'vrx_layout',
  aiKey: 'vrx_aiKey',
};

const initialState = (): State => {
  const locks = JSON.parse(localStorage.getItem(STORAGE_KEYS.locks) || '{}');
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
      return { ...state, config: action.config };
    case 'setApps':
      return { ...state, apps: action.apps };
    case 'setCurrentLayerKey':
      return { ...state, currentLayerKey: action.key };
    case 'setFilter': {
      localStorage.setItem(STORAGE_KEYS.filter, action.filter);
      return { ...state, filter: action.filter };
    }
    case 'toggleLock': {
      const locks = { ...state.locks, [action.key]: !state.locks[action.key] };
      localStorage.setItem(STORAGE_KEYS.locks, JSON.stringify(locks));
      return { ...state, locks };
    }
    case 'setKeyboardLayout': {
      localStorage.setItem(STORAGE_KEYS.layout, action.layout);
      return { ...state, keyboardLayout: action.layout };
    }
    case 'setAIKey': {
      localStorage.setItem(STORAGE_KEYS.aiKey, action.aiKey);
      return { ...state, aiKey: action.aiKey };
    }
    case 'markDirty':
      return { ...state, isDirty: true };
    case 'markSaved':
      return { ...state, isDirty: false };
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
    (async () => {
      const [data, config, apps] = await Promise.all([getData(), getConfig(), getApps()]);
      dispatch({ type: 'setData', data });
      dispatch({ type: 'setConfig', config });
      dispatch({ type: 'setApps', apps });
    })().catch((e) => console.error(e));
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
