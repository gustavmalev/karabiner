import type { Command, Config } from '../types';

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

  let layersChanged: string[] = [];
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
