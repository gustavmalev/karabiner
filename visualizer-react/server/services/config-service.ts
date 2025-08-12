import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import type { RulesConfig, CommandAction, LayerDef } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The client assets live one directory up at `visualizer-react/`
export const VISUALIZER_DIR = path.resolve(__dirname, '..');
export const STATIC_DIR = VISUALIZER_DIR; // Serve the visualizer-react/ directory as the web root
export const PORT = Number(process.env.PORT || 5178);
export const PROJECT_ROOT = path.resolve(VISUALIZER_DIR, '..');

function resolveKarabinerJson() {
  if (process.env.KARABINER_JSON) {
    return path.resolve(process.env.KARABINER_JSON);
  }
  const local = path.join(PROJECT_ROOT, 'karabiner.json');
  if (fs.existsSync(local)) return local;
  const home = path.join(os.homedir(), '.config', 'karabiner', 'karabiner.json');
  return home;
}

export const KARABINER_JSON = resolveKarabinerJson();
export const USER_KARABINER_JSON = path.join(os.homedir(), '.config', 'karabiner', 'karabiner.json');

function resolveRulesTs() {
  if (process.env.RULES_TS) {
    return path.resolve(process.env.RULES_TS);
  }
  return path.join(PROJECT_ROOT, 'rules.ts');
}

export const RULES_TS = resolveRulesTs();

export function readKarabinerJson(): any | null {
  try {
    const raw = fs.readFileSync(KARABINER_JSON, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readRulesTs(): string | null {
  try {
    return fs.readFileSync(RULES_TS, 'utf8');
  } catch {
    return null;
  }
}

export function writeRulesTs(content: string): boolean {
  try {
    fs.writeFileSync(RULES_TS, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function helperToCommand(helperCall: any): CommandAction {
  const { _helper, args } = helperCall || {};
  switch (_helper) {
    case 'open': {
      const what = (args || []).join(' ');
      return { to: [{ shell_command: `open ${what}` }], description: `Open ${what}` };
    }
    case 'app':
      return { to: [{ shell_command: `open -a '${args?.[0]}.app'` }], description: `Open ${args?.[0]}` };
    case 'window':
      return { to: [{ shell_command: `open -g raycast://extensions/raycast/window-management/${args?.[0]}` }], description: `Window: ${args?.[0]}` };
    case 'shell':
      return { to: [{ shell_command: args?.[0] }] };
    default:
      return { to: [{ key_code: 'void' }] } as CommandAction;
  }
}

export function parseRulesConfig(): RulesConfig | null {
  const content = readRulesTs();
  if (!content) return null;
  try {
    const layers: RulesConfig['layers'] = {};
    const hyperSubLayersContentRegex = /createHyperSubLayers\s*\(\s*\{([\s\S]*?)\}\s*\)/;
    const match = content.match(hyperSubLayersContentRegex);
    if (!match || !match[1]) {
      console.error('Could not find createHyperSubLayers object in rules.ts');
      return { layers: {} };
    }
    const layersObjectString = `{${match[1]}}`;
    const dummyHelpers = `
      const open = (...what) => ({_helper: 'open', args: what});
      const app = (what) => ({_helper: 'app', args: [what]});
      const window = (what) => ({_helper: 'window', args: [what]});
      const shell = (what) => ({_helper: 'shell', args: [what]});
    `;
    const layersObject = new Function(`${dummyHelpers}; return ${layersObjectString}`)();

    for (const [key, value] of Object.entries(layersObject as Record<string, any>)) {
      if ((value as any)._helper) {
        (layers as any)[key] = { type: 'command', command: helperToCommand(value) } satisfies LayerDef;
      } else if ((value as any).to) {
        (layers as any)[key] = { type: 'command', command: value } satisfies LayerDef;
      } else {
        const commands: Record<string, CommandAction> = {};
        for (const [cmdKey, cmdValue] of Object.entries(value || {})) {
          if ((cmdValue as any)?._helper) commands[cmdKey] = helperToCommand(cmdValue);
          else commands[cmdKey] = cmdValue as CommandAction;
        }
        (layers as any)[key] = { type: 'sublayer', commands } satisfies LayerDef;
      }
    }
    return { layers };
  } catch (error) {
    console.error('Error parsing rules.ts:', error);
    return null;
  }
}

function generateCommandCode(command: CommandAction): string {
  if (!command || !command.to || !command.to[0]) {
    return '{ to: [{ key_code: "void" }] }';
  }
  const action = command.to[0];
  if ((action as any).key_code) {
    const mods = (action as any).modifiers || [];
    const modifiers = Array.isArray(mods) && mods.length > 0 ? `[${mods.map((m: string) => `'${m}'`).join(', ')}]` : '[]';
    const desc = command.description ? `, description: '${command.description.replace(/'/g, "\\'")}'` : '';
    return `{ to: [{ key_code: '${(action as any).key_code}', modifiers: ${modifiers} }]${desc} }`;
  }
  if ((action as any).shell_command) {
    const cmd = (action as any).shell_command as string;
    if (cmd.startsWith('open -a')) {
      const appMatch = cmd.match(/'([^']+)\.app'/);
      if (appMatch) return `app('${appMatch[1]}')`;
    }
    if (cmd.startsWith('open -g raycast://extensions/raycast/window-management/')) {
      const wmCommand = cmd.split('/').pop();
      return `window('${wmCommand}')`;
    }
    if (cmd.startsWith('open')) {
      const arg = cmd.substring(5).trim();
      return `open('${arg.replace(/'/g, "\\'")}')`;
    }
    const escapedCmd = cmd.replace(/'/g, "\\'").replace(/`/g, '\\`');
    return `shell('${escapedCmd}')`;
  }
  return '{ to: [{ key_code: "void" }] }';
}

export function generateRulesTs(config: RulesConfig): string {
  const { layers } = config;
  const layersStringEntries: string[] = [];
  for (const [key, layerConfig] of Object.entries(layers)) {
    if ((layerConfig as any).type === 'sublayer') {
      const cmds = ((layerConfig as any).commands || {}) as Record<string, CommandAction>;
      const inner = Object.entries(cmds)
        .map(([cmdKey, cmd]) => `      ${cmdKey}: ${generateCommandCode(cmd as CommandAction)}`)
        .join(',\n');
      layersStringEntries.push(`    ${key}: {\n${inner}${inner ? '\n' : ''}    }`);
    } else if ((layerConfig as any).type === 'command') {
      layersStringEntries.push(`    ${key}: ${generateCommandCode(((layerConfig as any).command) as CommandAction)}`);
    }
  }
  const layersString = layersStringEntries.join(',\n');
  const content = `import fs from "fs";\nimport { KarabinerRules } from "./types";\nimport { createHyperSubLayers, app, open, window, shell } from "./utils";\n\nconst rules: KarabinerRules[] = [\n  {\n    description: "Hyper Key (⌃⌥⇧⌘)",\n    manipulators: [\n      {\n        description: "Caps Lock -> Hyper Key",\n        from: { key_code: "caps_lock", modifiers: { optional: ["any"] } },\n        to: [{ set_variable: { name: "hyper", value: 1 } }],\n        to_after_key_up: [{ set_variable: { name: "hyper", value: 0 } }],\n        to_if_alone: [{ key_code: "escape" }],\n        type: "basic",\n      },\n    ],\n  },\n  ...createHyperSubLayers({\n${layersString}\n  }),\n];\n\nfs.writeFileSync(\n  "karabiner.json",\n  JSON.stringify(\n    {\n      global: { show_in_menu_bar: false },\n      profiles: [{ name: "Default", complex_modifications: { rules } }],\n    },\n    null,\n    2\n  )\n);\n`;
  return content;
}

// Analyze function migrated from analyze.mjs
function isFallbackManipulator(manip: any) {
  try {
    const fromKey = manip?.from?.key_code;
    const to = manip?.to?.[0];
    const mods = to?.modifiers || [];
    return (
      to?.key_code === fromKey && Array.isArray(mods) && ['left_shift', 'left_command', 'left_control', 'left_option'].every((m) => mods.includes(m))
    );
  } catch {
    return false;
  }
}

export function analyze(json: any) {
  const rules = json?.profiles?.[0]?.complex_modifications?.rules || [];
  const baseCustom: Record<string, { description?: string; detail: unknown }> = {};
  const baseFallback = new Set<string>();
  const sublayerKeys = new Set<string>();
  const layers: Record<string, { title?: string; commands: Array<{ key: string; description?: string; detail: unknown }> }> = {};

  for (const rule of rules) {
    const desc = rule?.description || '';
    if (desc.startsWith('Hyper Key + ')) {
      const key = desc.replace('Hyper Key + ', '');
      const firstManip = rule?.manipulators?.[0];
      if (isFallbackManipulator(firstManip)) baseFallback.add(key);
      else baseCustom[key] = { description: firstManip?.description, detail: firstManip?.to || firstManip };
    }
    if (desc.startsWith('Hyper Key sublayer "')) {
      const key = (desc.match(/Hyper Key sublayer \"(.+?)\"/)?.[1]) || '';
      if (!key) continue;
      sublayerKeys.add(key);
      const manips = Array.isArray(rule?.manipulators) ? rule.manipulators : [];
      const first = manips[0];
      const title = first?.to?.find((t: any) => t?.set_notification_message)?.set_notification_message?.text;
      const cmds: Array<{ key: string; description?: string; detail: unknown }> = [];
      for (let i = 1; i < manips.length; i++) {
        const m = manips[i];
        const fromKey = m?.from?.key_code; if (!fromKey) continue;
        cmds.push({ key: fromKey, description: m?.description, detail: m?.to || m });
      }
      layers[key] = { title, commands: cmds };
    }
  }
  for (const k of Object.keys(baseCustom)) baseFallback.delete(k);
  for (const k of sublayerKeys) baseFallback.delete(k);
  const seenKeys = new Set<string>();
  for (const rule of rules) {
    for (const manip of rule?.manipulators || []) {
      const fk = manip?.from?.key_code; if (fk) seenKeys.add(fk);
    }
  }
  return {
    base: {
      sublayerKeys: Array.from(sublayerKeys).sort(),
      customKeys: Object.keys(baseCustom).sort().map((k) => ({ key: k, description: baseCustom[k].description, detail: baseCustom[k].detail })),
      fallbackKeys: Array.from(baseFallback).sort(),
    },
    layers,
    stats: {
      totalBaseCustom: Object.keys(baseCustom).length,
      totalBaseFallback: baseFallback.size,
      totalSublayers: sublayerKeys.size,
      seenBaseKeys: Array.from(seenKeys).sort(),
    },
  };
}
