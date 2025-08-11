import type { Command } from '../types';

type Action = {
  shell_command?: string;
  key_code?: string;
  modifiers?: string[];
};

export function buildCommandFrom(
  type: 'app' | 'window' | 'raycast' | 'shell' | 'key',
  text: string,
  options: { ignore?: boolean } = {}
): Command {
  const value = String(text || '').trim();
  if (type === 'app' && value) {
    return { to: [{ shell_command: `open -a '${value}.app'` }], description: `Open ${value}` };
  }
  if (type === 'window' && value) {
    return {
      to: [{ shell_command: `open -g raycast://extensions/raycast/window-management/${value}` }],
      description: `Window: ${value}`,
    };
  }
  if (type === 'raycast' && value) {
    const ignore = options.ignore === true;
    const deeplink = value.startsWith('raycast://') ? value : `raycast://${value}`;
    const prefix = ignore ? '-g ' : '';
    return { to: [{ shell_command: `open ${prefix}${deeplink}` }], description: `Open ${deeplink}` };
  }
  if (type === 'shell' && value) {
    return { to: [{ shell_command: value }], description: value };
  }
  if (type === 'key') {
    // Expect JSON: { key_code: string; modifiers?: string[] }
    try {
      const parsed = value ? JSON.parse(value) as { key_code?: string; modifiers?: string[] } : {};
      if (parsed && parsed.key_code) {
        return { to: [{ key_code: parsed.key_code, modifiers: parsed.modifiers || [] }], description: 'Keypress' };
      }
    } catch {
      // fall through to default
    }
    // Fallback (no capture yet)
    return { to: [{ key_code: 'escape' }], description: 'Keypress' };
  }
  return { to: [{ key_code: 'escape' }], description: value || 'Custom command' };
}

export function parseTypeTextFrom(command?: Command):
  | { type: 'app'; text: string }
  | { type: 'window'; text: string }
  | { type: 'raycast'; text: string; ignoreRaycast?: boolean }
  | { type: 'shell'; text: string }
  | { type: 'key'; text: string }
  | { type: 'app'; text: string } {
  try {
    const action: Action = (command?.to?.[0] as Action) || {};
    const sc = action.shell_command || '';
    if (sc.startsWith('open -a ')) {
      const m = sc.match(/open -a '(.+)\.app'/);
      return { type: 'app', text: m ? m[1] : '' } as const;
    }
    if (sc.startsWith('open -g raycast://extensions/raycast/window-management/')) {
      return { type: 'window', text: sc.split('/').pop() || '' } as const;
    }
    if (/^open\s+(-g\s+)?raycast:\/\//.test(sc)) {
      const ignore = /^open\s+-g\s+raycast:\/\//.test(sc);
      const deeplink = sc.replace(/^open\s+(-g\s+)?/, '');
      return { type: 'raycast', text: deeplink, ignoreRaycast: ignore } as const;
    }
    if (sc) return { type: 'shell', text: sc } as const;
    if (action.key_code) return { type: 'key', text: JSON.stringify({ key_code: action.key_code, modifiers: action.modifiers || [] }) } as const;
  } catch {
    // ignore parse errors
  }
  return { type: 'app', text: '' } as const;
}

export function getCommandDescription(cmd?: Command): string {
  if (!cmd) return '';
  if (cmd.description) return cmd.description;
  if (cmd.to && cmd.to.length) {
    const t = cmd.to[0];
    if (t.shell_command) return `shell: ${t.shell_command}`;
    if (t.key_code) return `${t.modifiers?.join('+') || ''}${t.modifiers?.length ? '+' : ''}${t.key_code}`;
  }
  return '';
}
