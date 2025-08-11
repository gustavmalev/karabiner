import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The client assets live one directory up at `visualizer-react/`
const VISUALIZER_DIR = path.resolve(__dirname, '..');

function resolveKarabinerJson() {
  if (process.env.KARABINER_JSON) {
    return path.resolve(process.env.KARABINER_JSON);
  }
  // Support a local karabiner.json next to the project root (repo root)
  const local = path.join(path.resolve(VISUALIZER_DIR, '..'), 'karabiner.json');
  if (fs.existsSync(local)) return local;
  // Default to user's Karabiner config path
  const home = path.join(os.homedir(), '.config', 'karabiner', 'karabiner.json');
  return home;
}

const KARABINER_JSON = resolveKarabinerJson();
const STATIC_DIR = VISUALIZER_DIR; // serve the visualizer-react/ directory as the web root (not used in Vite dev)
const PORT = Number(process.env.PORT || 5178);

// Always-resolved path to the user's Karabiner config file (for applying changes)
const USER_KARABINER_JSON = path.join(os.homedir(), '.config', 'karabiner', 'karabiner.json');

// Rules.ts configuration path
function resolveRulesTs() {
  if (process.env.RULES_TS) {
    return path.resolve(process.env.RULES_TS);
  }
  // Default to rules.ts in the parent directory (repo root)
  const rulesPath = path.join(path.resolve(VISUALIZER_DIR, '..'), 'rules.ts');
  return rulesPath;
}

const RULES_TS = resolveRulesTs();

function readKarabinerJson() {
  try {
    const raw = fs.readFileSync(KARABINER_JSON, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readRulesTs() {
  try {
    const raw = fs.readFileSync(RULES_TS, 'utf8');
    return raw;
  } catch {
    return null;
  }
}

function writeRulesTs(content) {
  try {
    fs.writeFileSync(RULES_TS, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function helperToCommand(helperCall) {
    const { _helper, args } = helperCall;
    switch (_helper) {
        case 'open':
            const what = args.join(' ');
            return { to: [{ shell_command: `open ${what}` }], description: `Open ${what}` };
        case 'app':
            return { to: [{ shell_command: `open -a '${args[0]}.app'` }], description: `Open ${args[0]}` };
        case 'window':
            return { to: [{ shell_command: `open -g raycast://extensions/raycast/window-management/${args[0]}` }], description: `Window: ${args[0]}` };
        case 'shell':
             return { to: [{ shell_command: args[0] }], description: args[0] };
    }
    return { to: [{ key_code: 'void' }] };
}

// Parse rules.ts to extract layer configurations
function parseRulesConfig() {
  const content = readRulesTs();
  if (!content) return null;
  
  try {
    const layers = {};
    const hyperSubLayersContentRegex = /createHyperSubLayers\s*\(\s*\{([\s\S]*?)\}\s*\)/;
    const match = content.match(hyperSubLayersContentRegex);

    if (!match || !match[1]) {
      console.error("Could not find createHyperSubLayers object in rules.ts");
      return { layers: {} };
    }
    
    const layersObjectString = `{${match[1]}}`;

    const dummyHelpers = `
        const open = (...what) => ({_helper: 'open', args: what});
        const app = (what) => ({_helper: 'app', args: [what]});
        const window = (what) => ({_helper: 'window', args: [what]});
        const shell = (what) => ({_helper: 'shell', args: [what]});
    `;

    const layersObject = (new Function(`${dummyHelpers}; return ${layersObjectString}`))();

    for (const [key, value] of Object.entries(layersObject)) {
        if (value._helper) { // It's a command created by a helper
            layers[key] = {
                type: 'command',
                command: helperToCommand(value)
            };
        } else if (value.to) { // It's a raw command object
            layers[key] = {
                type: 'command',
                command: value
            };
        } else { // It's a sublayer
            const commands = {};
            for (const [cmdKey, cmdValue] of Object.entries(value)) {
                if (cmdValue._helper) {
                    commands[cmdKey] = helperToCommand(cmdValue);
                } else {
                    commands[cmdKey] = cmdValue;
                }
            }
            layers[key] = {
                type: 'sublayer',
                commands: commands
            };
        }
    }
    return { layers };

  } catch (error) {
    console.error('Error parsing rules.ts:', error);
    return null;
  }
}

function generateCommandCode(command) {
  if (!command || !command.to || !command.to[0]) {
    return '{ to: [{ key_code: "void" }] }';
  }

  const action = command.to[0];

  if (action.key_code) {
    let modifiers = '[]';
    if (action.modifiers && action.modifiers.length > 0) {
        modifiers = `[${action.modifiers.map(m => `'${m}'`).join(', ')}]`;
    }
    const desc = command.description ? `, description: '${command.description.replace(/'/g, "\\'")}'` : '';
    return `{ to: [{ key_code: '${action.key_code}', modifiers: ${modifiers} }]${desc} }`;
  }

  if (action.shell_command) {
    const cmd = action.shell_command;

    if (cmd.startsWith("open -a")) {
      const appMatch = cmd.match(/'([^']+)\.app'/);
      if (appMatch) return `app('${appMatch[1]}')`;
    }

    if (cmd.startsWith("open -g raycast://extensions/raycast/window-management/")) {
      const wmCommand = cmd.split('/').pop();
      return `window('${wmCommand}')`;
    }

    if (cmd.startsWith("open")) {
      const arg = cmd.substring(5).trim();
      return `open('${arg.replace(/'/g, "\\'")}')`;
    }

    const escapedCmd = cmd.replace(/'/g, "\\'").replace(/`/g, '\\`');
    return `shell('${escapedCmd}')`;
  }

  return '{ to: [{ key_code: "void" }] }';
}

// Generate rules.ts content from configuration
function generateRulesTs(config) {
  const { layers } = config;

  let layersStringEntries = [];
  for (const [key, layerConfig] of Object.entries(layers)) {
    if (layerConfig.type === 'sublayer') {
      let inner = Object.entries(layerConfig.commands || {})
        .map(([cmdKey, cmd]) => `      ${cmdKey}: ${generateCommandCode(cmd)}`)
        .join(',\n');
      layersStringEntries.push(`    ${key}: {\n${inner}${inner ? '\n' : ''}    }`);
    } else if (layerConfig.type === 'command') {
      layersStringEntries.push(`    ${key}: ${generateCommandCode(layerConfig.command)}`);
    }
  }
  const layersString = layersStringEntries.join(',\n');

  const content = `import fs from "fs";
import { KarabinerRules } from "./types";
import { createHyperSubLayers, app, open, window, shell } from "./utils";

const rules: KarabinerRules[] = [
  // Define the Hyper key itself
  {
    description: "Hyper Key (⌃⌥⇧⌘)",
    manipulators: [
      {
        description: "Caps Lock -> Hyper Key",
        from: {
          key_code: "caps_lock",
          modifiers: {
            optional: ["any"],
          },
        },
        to: [
          {
            set_variable: {
              name: "hyper",
              value: 1,
            },
          },
        ],
        to_after_key_up: [
          {
            set_variable: {
              name: "hyper",
              value: 0,
            },
          },
        ],
        to_if_alone: [
          {
            key_code: "escape",
          },
        ],
        type: "basic",
      },
    ],
  },
  ...createHyperSubLayers({
${layersString}
  }),
];

fs.writeFileSync(
  "karabiner.json",
  JSON.stringify(
    {
      global: {
        show_in_menu_bar: false,
      },
      profiles: [
        {
          name: "Default",
          complex_modifications: {
            rules,
          },
        },
      ],
    },
    null,
    2
  )
);
`;
  return content;
}

export { 
  __dirname as SERVER_DIR, 
  VISUALIZER_DIR, 
  KARABINER_JSON, 
  USER_KARABINER_JSON,
  RULES_TS,
  STATIC_DIR, 
  PORT, 
  readKarabinerJson,
  readRulesTs,
  writeRulesTs,
  parseRulesConfig,
  generateRulesTs
};
