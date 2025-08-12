import type { Command, Config, Layer, KeyCode } from '../types';

export type ConfigDiff = {
  layersAdded: string[];
  layersRemoved: string[];
  layersChanged: string[];
  commandsAdded: number;
  commandsRemoved: number;
  commandsChanged: number;
};

function isEqualCommand(a: Command | undefined, b: Command | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffConfigs(current: Config | null | undefined, incoming: Config): ConfigDiff {
  const aLayers = new Set(Object.keys(current?.layers || {}));
  const bLayers = new Set(Object.keys(incoming.layers || {}));

  const layersAdded = [...bLayers].filter((k) => !aLayers.has(k));
  const layersRemoved = [...aLayers].filter((k) => !bLayers.has(k));
  const common = [...aLayers].filter((k) => bLayers.has(k));

  const layersChanged: string[] = [];
  let commandsAdded = 0;
  let commandsRemoved = 0;
  let commandsChanged = 0;

  for (const k of common) {
    const a = current!.layers[k];
    const b = incoming.layers[k];
    if (!a || !b || a.type !== b.type) {
      layersChanged.push(k);
      continue;
    }
    if (a.type === 'command' && b.type === 'command') {
      if (!isEqualCommand(a.command, b.command)) layersChanged.push(k);
      continue;
    }
    if (a.type === 'sublayer' && b.type === 'sublayer') {
      const aCmds = a.commands || {};
      const bCmds = b.commands || {};
      const aKeys = new Set(Object.keys(aCmds));
      const bKeys = new Set(Object.keys(bCmds));
      const added = [...bKeys].filter((x) => !aKeys.has(x));
      const removed = [...aKeys].filter((x) => !bKeys.has(x));
      const commonInner = [...aKeys].filter((x) => bKeys.has(x));
      const changed = commonInner.filter((ck) => !isEqualCommand(aCmds[ck], bCmds[ck]));
      commandsAdded += added.length;
      commandsRemoved += removed.length;
      commandsChanged += changed.length;
      if (added.length || removed.length || changed.length) layersChanged.push(k);
    }
  }

  return { layersAdded, layersRemoved, layersChanged, commandsAdded, commandsRemoved, commandsChanged };
}

// --- Detailed diff for UI rendering ---

export type DetailedDiff = {
  layersAdded: KeyCode[];
  layersRemoved: KeyCode[];
  layersChanged: KeyCode[];
  changedLayers: Array<
    | {
        key: KeyCode;
        type: 'command';
        typeChanged: boolean;
        from?: Layer;
        to?: Layer;
      }
    | {
        key: KeyCode;
        type: 'sublayer';
        typeChanged: boolean;
        from?: Layer;
        to?: Layer;
        sublayer: {
          added: Array<{ key: KeyCode; to: Command }>;
          removed: Array<{ key: KeyCode; from: Command }>;
          changed: Array<{ key: KeyCode; from: Command; to: Command }>;
          moved: Array<{ from: KeyCode; to: KeyCode; command: Command }>;
        };
      }
  >;
};

function sig(c?: Command): string {
  return JSON.stringify(c ?? null);
}

export function diffConfigsDetailed(current: Config | null | undefined, incoming: Config): DetailedDiff {
  const aLayers = new Set(Object.keys(current?.layers || {}));
  const bLayers = new Set(Object.keys(incoming.layers || {}));

  const layersAdded = [...bLayers].filter((k) => !aLayers.has(k));
  const layersRemoved = [...aLayers].filter((k) => !bLayers.has(k));
  const common = [...aLayers].filter((k) => bLayers.has(k));

  const layersChanged: KeyCode[] = [];
  const changedLayers: DetailedDiff['changedLayers'] = [];

  // Include detailed entries for newly added layers (show their contents)
  for (const key of layersAdded) {
    const b = incoming.layers[key];
    if (!b) continue;
    if (b.type === 'command') {
      changedLayers.push({ key, type: 'command', typeChanged: true, from: undefined, to: b });
    } else if (b.type === 'sublayer') {
      const bCmds = b.commands || {};
      const added = Object.keys(bCmds).map((k) => ({ key: k as KeyCode, to: bCmds[k] }));
      changedLayers.push({
        key,
        type: 'sublayer',
        typeChanged: true,
        from: undefined,
        to: b,
        sublayer: { added, removed: [], changed: [], moved: [] },
      });
    }
  }

  // Include detailed entries for removed layers (show their previous contents)
  for (const key of layersRemoved) {
    const a = current?.layers?.[key];
    if (!a) continue;
    if (a.type === 'command') {
      changedLayers.push({ key, type: 'command', typeChanged: true, from: a, to: undefined });
    } else if (a.type === 'sublayer') {
      const aCmds = a.commands || {};
      const removed = Object.keys(aCmds).map((k) => ({ key: k as KeyCode, from: aCmds[k] }));
      changedLayers.push({
        key,
        type: 'sublayer',
        typeChanged: true,
        from: a,
        to: undefined,
        sublayer: { added: [], removed, changed: [], moved: [] },
      });
    }
  }

  for (const key of common) {
    const a = current!.layers[key];
    const b = incoming.layers[key];
    if (!a || !b || a.type !== b.type) {
      layersChanged.push(key);
      changedLayers.push({ key, type: (b?.type as any) || 'command', typeChanged: true, from: a, to: b } as any);
      continue;
    }

    if (a.type === 'command' && b.type === 'command') {
      if (sig(a.command) !== sig(b.command)) {
        layersChanged.push(key);
        changedLayers.push({ key, type: 'command', typeChanged: false, from: a, to: b });
      }
      continue;
    }

    if (a.type === 'sublayer' && b.type === 'sublayer') {
      const aCmds = a.commands || {};
      const bCmds = b.commands || {};
      const aKeys = new Set(Object.keys(aCmds));
      const bKeys = new Set(Object.keys(bCmds));

      let addedKeys = [...bKeys].filter((x) => !aKeys.has(x));
      let removedKeys = [...aKeys].filter((x) => !bKeys.has(x));
      const commonInner = [...aKeys].filter((x) => bKeys.has(x));

      const changedInner = commonInner.filter((ck) => sig(aCmds[ck]) !== sig(bCmds[ck]));

      // Detect moves: pair up removed/added with identical command signature
      const removedBySig = new Map<string, KeyCode[]>();
      for (const k of removedKeys) {
        const s = sig(aCmds[k]);
        removedBySig.set(s, [...(removedBySig.get(s) || []), k]);
      }
      const addedBySig = new Map<string, KeyCode[]>();
      for (const k of addedKeys) {
        const s = sig(bCmds[k]);
        addedBySig.set(s, [...(addedBySig.get(s) || []), k]);
      }

      const moved: Array<{ from: KeyCode; to: KeyCode; command: Command }> = [];
      for (const [s, rKeys] of removedBySig.entries()) {
        const aKeysForSig = [...rKeys];
        const bKeysForSig = [...(addedBySig.get(s) || [])];
        const count = Math.min(aKeysForSig.length, bKeysForSig.length);
        for (let i = 0; i < count; i++) {
          const fromKey = aKeysForSig[i];
          const toKey = bKeysForSig[i];
          moved.push({ from: fromKey, to: toKey, command: aCmds[fromKey] });
        }
      }
      // Remove moved keys from added/removed lists
      const movedFrom = new Set(moved.map((m) => m.from));
      const movedTo = new Set(moved.map((m) => m.to));
      addedKeys = addedKeys.filter((k) => !movedTo.has(k));
      removedKeys = removedKeys.filter((k) => !movedFrom.has(k));

      if (addedKeys.length || removedKeys.length || changedInner.length || moved.length) {
        layersChanged.push(key);
        changedLayers.push({
          key,
          type: 'sublayer',
          typeChanged: false,
          from: a,
          to: b,
          sublayer: {
            added: addedKeys.map((k) => ({ key: k, to: bCmds[k] })),
            removed: removedKeys.map((k) => ({ key: k, from: aCmds[k] })),
            changed: changedInner.map((k) => ({ key: k, from: aCmds[k], to: bCmds[k] })),
            moved,
          },
        });
      }
    }
  }

  return { layersAdded, layersRemoved, layersChanged, changedLayers };
}
