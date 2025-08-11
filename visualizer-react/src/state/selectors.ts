import type { StoreState } from './store';
import type { KeyCode, Config, Data, Layer, Command } from '../types';

// Stable empty constants to avoid returning new objects from selectors
const EMPTY_LAYERS: Readonly<Record<KeyCode, Layer>> = Object.freeze({}) as Readonly<Record<KeyCode, Layer>>;
const EMPTY_COMMANDS: Readonly<Record<KeyCode, Command>> = Object.freeze({}) as Readonly<Record<KeyCode, Command>>;

// Memoization caches for selectors that build derived objects/arrays
let memoCommandsByLayerRef: Record<KeyCode, Layer> | null = null;
let memoCommandsByLayer: Record<KeyCode, Record<KeyCode, Command>> = {};

let memoConflictsLayersRef: Record<KeyCode, Layer> | null = null;
let memoConflicts: Array<{ innerKey: KeyCode; outerKeys: KeyCode[]; count: number }> = [];

let memoInnerKeysLayerKey: KeyCode | null = null;
let memoInnerKeysCommandsRef: Record<KeyCode, Command> | null = null;
let memoInnerKeys: KeyCode[] = [];

export const selectFilter = (s: StoreState) => s.filter;
export const selectConfig = (s: StoreState) => s.config;
export const selectData = (s: StoreState) => s.data;
export const selectIsDirty = (s: StoreState) => s.isDirty;
export const selectCurrentLayerKey = (s: StoreState) => s.currentLayerKey;

export const selectCurrentLayer = (s: StoreState) => {
  const key = s.currentLayerKey;
  if (!key) return null;
  const layer = s.config?.layers?.[key] ?? null;
  return layer || null;
};

export const selectCurrentLayerCommands = (s: StoreState): Record<KeyCode, Command> | undefined => {
  const layer = selectCurrentLayer(s);
  if (layer && layer.type === 'sublayer') return layer.commands || EMPTY_COMMANDS;
  return undefined;
};

export function buildKeyClassification(data: Data | null, config: Config | null) {
  const sublayerByKey = new Set<string>(data?.base.sublayerKeys || []);
  const customByKey = new Set<string>((data?.base.customKeys || []).map((c) => c.key));
  const thirdPartyByKey = new Set<string>(data?.base.fallbackKeys || []);
  const availableByKey = new Set<string>();

  const layers: Record<string, Layer> = config?.layers ?? {} as Record<string, Layer>;
  Object.entries(layers).forEach(([key, layer]) => {
    if (layer.type === 'sublayer') sublayerByKey.add(key);
    else customByKey.add(key);
  });

  const allKeys = [
    '1','2','3','4','5','6','7','8','9','0','minus','equal',
    'q','w','e','r','t','y','u','i','o','p','open_bracket','close_bracket','backslash',
    'a','s','d','f','g','h','j','k','l','semicolon','quote',
    'z','x','c','v','b','n','m','comma','period','slash'
  ];
  allKeys.forEach((k) => {
    if (!sublayerByKey.has(k) && !customByKey.has(k) && !thirdPartyByKey.has(k)) {
      availableByKey.add(k);
    }
  });

  const classify = (code: KeyCode): 'sublayer' | 'custom' | 'available' | 'thirdparty' => {
    if (sublayerByKey.has(code)) return 'sublayer';
    if (customByKey.has(code)) return 'custom';
    if (thirdPartyByKey.has(code)) return 'thirdparty';
    if (availableByKey.has(code)) return 'available';
    return 'available';
  };

  return { sublayerByKey, customByKey, thirdPartyByKey, availableByKey, classify };
}

// Layer helpers
export function getLayerKeys(config: Config | null): KeyCode[] {
  return Object.keys(config?.layers || {});
}

export function getInnerCommandKeys(config: Config | null, outerKey: KeyCode | null): KeyCode[] {
  if (!outerKey) return [];
  const layer = config?.layers?.[outerKey];
  if (!layer) return [];
  if (layer.type === 'sublayer') return Object.keys(layer.commands || {}).sort();
  return [];
}

export const selectCurrentLayerInnerKeys = (s: StoreState): KeyCode[] =>
  {
    const key = s.currentLayerKey;
    if (!key) {
      memoInnerKeysLayerKey = null;
      memoInnerKeysCommandsRef = null;
      memoInnerKeys = [];
      return memoInnerKeys;
    }
    const layer = s.config?.layers?.[key];
    const cmdsRef = layer && layer.type === 'sublayer' ? (layer.commands || (EMPTY_COMMANDS as Record<KeyCode, Command>)) : null;
    if (memoInnerKeysLayerKey === key && memoInnerKeysCommandsRef === cmdsRef) {
      return memoInnerKeys;
    }
    memoInnerKeysLayerKey = key;
    memoInnerKeysCommandsRef = cmdsRef as Record<KeyCode, Command> | null;
    memoInnerKeys = getInnerCommandKeys(s.config, key);
    return memoInnerKeys;
  };

// Derived classification for current store snapshot
// Note: do not use selectKeyClassification directly in useStore; it returns a new object.
// Prefer computing via useMemo in components: buildKeyClassification(data, config)
export const selectKeyClassification = (s: StoreState) => buildKeyClassification(s.data, s.config);

// Normalization helpers
export const selectLayersById = (s: StoreState): Record<KeyCode, Layer> => s.config?.layers ?? (EMPTY_LAYERS as Record<KeyCode, Layer>);

export const selectCommandsByLayer = (s: StoreState): Record<KeyCode, Record<KeyCode, Command>> => {
  const layers = s.config?.layers ?? (EMPTY_LAYERS as Record<KeyCode, Layer>);
  if (memoCommandsByLayerRef === layers) {
    return memoCommandsByLayer;
  }
  const out: Record<KeyCode, Record<KeyCode, Command>> = {};
  for (const [k, layer] of Object.entries(layers)) {
    if ((layer as Layer).type === 'sublayer') {
      out[k as KeyCode] = (layer as Extract<Layer, { type: 'sublayer' }>).commands || (EMPTY_COMMANDS as Record<KeyCode, Command>);
    }
  }
  memoCommandsByLayerRef = layers;
  memoCommandsByLayer = out;
  return memoCommandsByLayer;
};

// Conflicts selector (stub): prepare structure for future incremental engine
export const selectConflicts = (s: StoreState): Array<{ innerKey: KeyCode; outerKeys: KeyCode[]; count: number }> => {
  const layers = s.config?.layers ?? ({} as Record<KeyCode, Layer>);
  if (memoConflictsLayersRef === layers) {
    return memoConflicts;
  }
  const occurrences = new Map<KeyCode, Set<KeyCode>>();
  for (const [outer, layer] of Object.entries(layers) as [KeyCode, Layer][]) {
    if (layer.type !== 'sublayer') continue;
    const cmds = layer.commands || {};
    for (const inner of Object.keys(cmds) as KeyCode[]) {
      const set = occurrences.get(inner) ?? new Set<KeyCode>();
      set.add(outer);
      occurrences.set(inner, set);
    }
  }
  const result: Array<{ innerKey: KeyCode; outerKeys: KeyCode[]; count: number }> = [];
  for (const [inner, outers] of occurrences.entries()) {
    if (outers.size > 1) {
      result.push({ innerKey: inner, outerKeys: Array.from(outers), count: outers.size });
    }
  }
  // Sort deterministic: highest count first, then innerKey asc
  result.sort((a, b) => (b.count - a.count) || a.innerKey.localeCompare(b.innerKey));
  memoConflictsLayersRef = layers;
  memoConflicts = result;
  return memoConflicts;
};
