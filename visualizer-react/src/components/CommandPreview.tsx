import { memo, type ReactNode } from 'react';
import { useStore } from '../state/store';
import type { Command } from '../types';
import { Avatar } from '@heroui/react';
import { windowCommandItems } from '../data/windowCommands';
import { parseTypeTextFrom, getCommandDescription } from '../utils/commands';
import { labelForKey } from '../utils/keys';

// Compact, pretty preview for a bound command (key-level)
export const CommandPreview = memo(function CommandPreview({ command }: { command: Command }) {
  const apps = useStore((s) => s.apps);
  const parsed = parseTypeTextFrom(command);

  const TypePill = ({ children }: { children: ReactNode }) => (
    <span className="inline-flex items-center rounded-md bg-default-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-default-600">
      {children}
    </span>
  );

  const Row = ({ left, right }: { left: ReactNode; right?: ReactNode }) => (
    <div className="flex flex-wrap items-center gap-2">
      {left}
      {right}
    </div>
  );

  const modSymbol: Record<string, string> = {
    left_command: '⌘', right_command: '⌘',
    left_option: '⌥', right_option: '⌥',
    left_control: '⌃', right_control: '⌃',
    left_shift: '⇧', right_shift: '⇧',
    fn: 'fn',
  };
  const KeyPill = ({ label }: { label: string }) => (
    <span className="inline-flex items-center rounded-md bg-default-100 px-2 py-0.5 text-xs font-medium text-default-700">
      {label}
    </span>
  );

  const getWindowLabel = (slug: string): string => {
    const f = windowCommandItems.find((i) => i.id === slug);
    if (f) return f.label;
    return slug ? slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : '';
  };

  const formatRaycast = (deeplink: string): string => {
    try {
      const url = new URL(deeplink);
      const segs = url.pathname.split('/').filter(Boolean);
      const last = segs[segs.length - 1] || '';
      const pretty = last.replace(/[-_]+/g, ' ');
      return pretty.charAt(0).toUpperCase() + pretty.slice(1);
    } catch {
      const tail = deeplink.split('/').filter(Boolean).pop() || deeplink;
      const pretty = tail.replace(/[-_]+/g, ' ');
      return pretty.charAt(0).toUpperCase() + pretty.slice(1);
    }
  };

  if (parsed.type === 'app') {
    const app = apps.find((a) => a.name.toLowerCase() === (parsed.text || '').toLowerCase());
    return (
      <Row
        left={(
          <>
            <TypePill>App</TypePill>
            {app?.iconUrl ? (
              <Avatar src={app.iconUrl} radius="sm" className="h-4 w-4" />
            ) : (
              <span className="inline-block h-4 w-4 rounded-sm bg-default-200" />
            )}
            <span className="font-medium text-default-700">{parsed.text || 'App'}</span>
          </>
        )}
      />
    );
  }
  if (parsed.type === 'window') {
    const label = getWindowLabel(parsed.text);
    return (
      <Row left={<><TypePill>Window</TypePill><span className="font-medium text-default-700">{label}</span></>} />
    );
  }
  if (parsed.type === 'raycast') {
    const label = formatRaycast(parsed.text);
    return (
      <Row
        left={(
          <>
            <TypePill>Raycast</TypePill>
            <span className="font-medium text-default-700">{label}</span>
            {parsed.ignoreRaycast ? <span className="text-xxs rounded bg-default-100 px-2 py-0.5 text-[10px] text-default-500">bg</span> : null}
          </>
        )}
      />
    );
  }
  if (parsed.type === 'shell') {
    return (
      <Row
        left={(
          <>
            <TypePill>Shell</TypePill>
            <code className="rounded bg-default-100 px-2 py-0.5 font-mono text-[12px] text-default-700">
              {parsed.text}
            </code>
          </>
        )}
      />
    );
  }
  if (parsed.type === 'key') {
    let press: { key_code?: string; modifiers?: string[] } = {};
    try { press = parsed.text ? JSON.parse(parsed.text) : {}; } catch { /* ignore */ }
    const parts = [
      ...(press.modifiers || []).map((m) => modSymbol[m] || m),
      press.key_code ? labelForKey(press.key_code) : '',
    ].filter(Boolean);
    return (
      <Row
        left={(
          <>
            <TypePill>Keypress</TypePill>
            {parts.map((p, i) => (
              <KeyPill key={`${p}-${i}`} label={String(p)} />
            ))}
          </>
        )}
      />
    );
  }
  // Fallback
  return <span className="text-default-600">{getCommandDescription(command) || 'Command'}</span>;
});
