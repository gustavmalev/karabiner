import type { Command } from '../types';

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
    const action = command?.to?.[0] || {};
    const sc = (action as any).shell_command || '';
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
    if ((action as any).key_code) return { type: 'key', text: '' } as const;
  } catch {}
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
