import { describe, it, expect } from 'vitest';
import type { StoreState } from '../store';
import type { Config, Data, Layer, Command, KeyCode } from '../../types';
import {
  buildKeyClassification,
  getInnerCommandKeys,
  selectConflicts,
  selectCurrentLayerInnerKeys,
  selectCommandsByLayer,
} from '../selectors';

function mockState(partial: Partial<StoreState>): StoreState {
  return {
    data: null,
    config: null,
    apps: [],
    currentLayerKey: null,
    filter: 'all',
    locks: {},
    keyboardLayout: 'ansi',
    aiKey: '',
    isDirty: false,
    setData: () => {},
    setConfig: () => {},
    setApps: () => {},
    setCurrentLayerKey: () => {},
    setFilter: () => {},
    toggleLock: () => {},
    setKeyboardLayout: () => {},
    setAIKey: () => {},
    markDirty: () => {},
    markSaved: () => {},
    ...partial,
  } as StoreState;
}

const mkSublayer = (cmds: Record<KeyCode, Command>): Layer => ({ type: 'sublayer', commands: cmds });

describe('selectors', () => {
  it('buildKeyClassification classifies keys based on data+config', () => {
    const data: Data = {
      base: {
        sublayerKeys: ['q'],
        customKeys: [{ key: 'x', label: 'Custom X' }],
        fallbackKeys: ['z'],
      },
    } as unknown as Data;
    const config: Config = { layers: { q: mkSublayer({}), a: mkSublayer({}) } as Record<string, Layer> } as Config;

    const c = buildKeyClassification(data, config);
    expect(c.classify('q')).toBe('sublayer');
    expect(c.classify('x')).toBe('custom');
    expect(c.classify('z')).toBe('thirdparty');
    expect(c.classify('b')).toBe('available');
  });

  it('selectCommandsByLayer memoizes by layers reference', () => {
    const layers: Record<string, Layer> = {
      a: mkSublayer({ x: { type: 'key', text: 'X' } as Command }),
      b: mkSublayer({ y: { type: 'key', text: 'Y' } as Command }),
    } as Record<string, Layer>;
    const config: Config = { layers } as Config;
    const s = mockState({ config });
    const ref1 = selectCommandsByLayer(s);
    const ref2 = selectCommandsByLayer(s);
    expect(ref2).toBe(ref1);
    // New layers object (same contents) should produce a new reference
    const s2 = mockState({ config: { layers: { ...layers } as Record<string, Layer> } as Config });
    const ref3 = selectCommandsByLayer(s2);
    expect(ref3).not.toBe(ref1);
  });

  it('selectConflicts memoizes by layers reference', () => {
    const layers: Record<string, Layer> = {
      a: mkSublayer({ x: { type: 'key', text: 'X' } as Command }),
      b: mkSublayer({ x: { type: 'key', text: 'X' } as Command }),
    } as Record<string, Layer>;
    const config: Config = { layers } as Config;
    const s = mockState({ config });
    const ref1 = selectConflicts(s);
    const ref2 = selectConflicts(s);
    expect(ref2).toBe(ref1);
    const s2 = mockState({ config: { layers: { ...layers } as Record<string, Layer> } as Config });
    const ref3 = selectConflicts(s2);
    expect(ref3).not.toBe(ref1);
  });

  it('selectCurrentLayerInnerKeys memoizes by layer key and commands reference', () => {
    const commands1: Record<KeyCode, Command> = { k: { type: 'key', text: 'K' } as Command };
    const layerA: Layer = mkSublayer(commands1);
    const layers: Record<string, Layer> = { a: layerA } as Record<string, Layer>;
    const config: Config = { layers } as Config;
    const s = mockState({ config, currentLayerKey: 'a' as KeyCode });
    const ref1 = selectCurrentLayerInnerKeys(s);
    const ref2 = selectCurrentLayerInnerKeys(s);
    expect(ref2).toBe(ref1);
    // Change commands reference for the same layer
    (layers['a'] as any).commands = { k: { type: 'key', text: 'K' } as Command, j: { type: 'key', text: 'J' } as Command } as Record<KeyCode, Command>;
    const ref3 = selectCurrentLayerInnerKeys(s);
    expect(ref3).not.toBe(ref1);
    expect(ref3).toEqual(['j', 'k'].sort());
  });

  it('getInnerCommandKeys returns inner keys for current sublayer', () => {
    const config: Config = { layers: { a: mkSublayer({ j: { type: 'key', text: 'J' } as Command }) } as Record<string, Layer> } as Config;
    expect(getInnerCommandKeys(config, 'a' as KeyCode)).toEqual(['j']);
    expect(getInnerCommandKeys(config, 'b' as KeyCode)).toEqual([]);
  });

  it('selectCurrentLayerInnerKeys uses state to compute inner keys', () => {
    const config: Config = { layers: { a: mkSublayer({ k: { type: 'key', text: 'K' } as Command }) } as Record<string, Layer> } as Config;
    const s = mockState({ config, currentLayerKey: 'a' as KeyCode });
    expect(selectCurrentLayerInnerKeys(s)).toEqual(['k']);
  });

  it('selectConflicts detects duplicate inner keys across sublayers', () => {
    const config: Config = {
      layers: {
        a: mkSublayer({ x: { type: 'key', text: 'X' } as Command }),
        s: mkSublayer({ x: { type: 'key', text: 'X' } as Command, y: { type: 'key', text: 'Y' } as Command }),
        d: mkSublayer({ y: { type: 'key', text: 'Y' } as Command }),
      } as Record<string, Layer>,
    } as Config;
    const s = mockState({ config });
    const conflicts = selectConflicts(s);
    // x appears in a,s and y appears in s,d
    const innerKeys = conflicts.map((c) => c.innerKey).sort();
    expect(innerKeys).toEqual(['x', 'y']);
    const x = conflicts.find((c) => c.innerKey === 'x')!;
    const y = conflicts.find((c) => c.innerKey === 'y')!;
    expect(x.count).toBe(2);
    expect(y.count).toBe(2);
  });
});
