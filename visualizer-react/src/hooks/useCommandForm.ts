import {useCallback, useEffect, useMemo, useState} from 'react';
import {useStore} from '../state/store';
import {numberRow, topRow, homeRow, bottomRow, labelForKey} from '../utils/keys';
import {windowCommandItems} from '../data/windowCommands';
import type { AppItem } from '../components/LayerDetail/CommandTypes/AppCommandForm';

export type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export type KeyPress = { key_code?: string; modifiers?: string[] };

export type CommandFormInit = {
  type?: CmdType;
  text?: string;
  ignore?: boolean;
  innerKey?: string;
};

export function useCommandForm(params: {
  initial?: CommandFormInit;
  takenKeys: string[];
  mode: 'add' | 'edit';
  isKeyLevel?: boolean;
}) {
  const {initial, takenKeys, mode, isKeyLevel} = params;

  const apps = useStore((s) => s.apps);

  const [type, setType] = useState<CmdType>(initial?.type || 'app');
  const [text, setText] = useState(initial?.text || '');
  const [ignore, setIgnore] = useState(!!initial?.ignore);
  const [innerKey, setInnerKey] = useState(initial?.innerKey || '');

  // rows and keys
  const rows = useMemo(() => [numberRow, topRow, homeRow, bottomRow] as string[][], []);
  const allKeyCodes = useMemo(() => rows.flat(), [rows]);
  const takenInnerKeys = useMemo(() => takenKeys.map((k) => k.toLowerCase()), [takenKeys]);
  const keyOptions = useMemo(() => allKeyCodes.map((code) => ({
    id: code,
    label: labelForKey(code),
    disabled: takenInnerKeys.includes(code.toLowerCase()),
  })), [allKeyCodes, takenInnerKeys]);
  const appItems = useMemo<AppItem[]>(() => apps.map(a => {
    const item: { id: string; label: string } & Partial<{ iconUrl: string; categoryLabel: string }> = {
      id: a.name,
      label: a.name,
    };
    if (a.iconUrl) item.iconUrl = a.iconUrl;
    if ((a as any).categoryLabel) item.categoryLabel = (a as any).categoryLabel as string;
    return item;
  }), [apps]);

  // window helpers
  const [windowQuery, setWindowQuery] = useState<string>('');
  const getWindowLabel = useCallback((slug: string): string => {
    const f = windowCommandItems.find(i => i.id === slug);
    if (f) return f.label;
    return slug ? slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : '';
  }, []);
  useEffect(() => {
    if (type === 'window') setWindowQuery(getWindowLabel(text));
  }, [type, text, getWindowLabel]);

  // key recording
  const [isRecording, setIsRecording] = useState(false);
  const [keyPress, setKeyPress] = useState<KeyPress>({});
  const modifierLabels: Record<string, string> = {
    left_command: 'cmd', right_command: 'cmd',
    left_option: 'opt', right_option: 'opt',
    left_control: 'ctrl', right_control: 'ctrl',
    left_shift: 'shift', right_shift: 'shift',
    fn: 'fn',
  };
  const eventToKarabiner = useCallback((e: KeyboardEvent): KeyPress => {
    const mods: string[] = [];
    if (e.metaKey) mods.push('left_command');
    if (e.altKey) mods.push('left_option');
    if (e.ctrlKey) mods.push('left_control');
    if (e.shiftKey) mods.push('left_shift');
    const code = e.code;
    const map: Record<string, string> = {
      ArrowLeft: 'left_arrow', ArrowRight: 'right_arrow', ArrowUp: 'up_arrow', ArrowDown: 'down_arrow',
      Escape: 'escape', Enter: 'return_or_enter', Backspace: 'delete_or_backspace', Delete: 'delete_forward',
      Tab: 'tab', Space: 'spacebar', Minus: 'hyphen', Equal: 'equal_sign',
      BracketLeft: 'open_bracket', BracketRight: 'close_bracket', Backslash: 'backslash',
      Semicolon: 'semicolon', Quote: 'quote', Backquote: 'grave_accent_and_tilde',
      Comma: 'comma', Period: 'period', Slash: 'slash',
    };
    let key_code = map[code];
    if (!key_code) {
      if (/^Key[A-Z]$/.test(code)) key_code = code.slice(3).toLowerCase();
      else if (/^Digit[0-9]$/.test(code)) key_code = code.slice(5);
      else if (/^F[0-9]{1,2}$/.test(code)) key_code = code.toLowerCase();
    }
    const out: KeyPress = { modifiers: mods };
    if (key_code) out.key_code = key_code;
    return out;
  }, []);
  const isModifierOnly = useCallback((e: KeyboardEvent) => ['ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight','ControlLeft','ControlRight'].includes(e.code), []);
  useEffect(() => {
    if (!isRecording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isModifierOnly(e)) return;
      const kp = eventToKarabiner(e);
      if (kp.key_code) {
        setKeyPress(kp);
        setText(JSON.stringify(kp));
        setIsRecording(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isRecording, isModifierOnly, eventToKarabiner]);
  useEffect(() => {
    if (type === 'key') {
      try {
        const parsed = text ? JSON.parse(text) as KeyPress : {};
        setKeyPress(parsed || {});
      } catch { /* ignore */ }
    }
  }, [type, text]);
  const recordedLabel = useMemo(() => {
    const mods = (keyPress.modifiers || []).map(m => modifierLabels[m] || m);
    const base = keyPress.key_code ? labelForKey(keyPress.key_code) : '';
    return [...mods.map(m => m.toUpperCase()), base].filter(Boolean).join(' + ');
  }, [keyPress]);

  const isAIMode = mode === 'add' && !initial?.innerKey && !isKeyLevel;
  const canSave = useMemo(() => {
    const textTrim = (text || '').trim();
    const typeOk = (
      (type === 'key' && !!keyPress.key_code) ||
      (type !== 'key' && textTrim.length > 0)
    );
    const innerKeyOk = isKeyLevel || isAIMode || !!innerKey;
    return typeOk && innerKeyOk;
  }, [type, text, keyPress, innerKey, isKeyLevel, isAIMode]);

  return {
    // values
    type, setType,
    text, setText,
    ignore, setIgnore,
    innerKey, setInnerKey,
    rows,
    keyOptions,
    appItems,
    // window
    windowQuery, setWindowQuery, getWindowLabel,
    // key record
    isRecording, setIsRecording, keyPress, setKeyPress, recordedLabel,
    // flags
    isAIMode, canSave,
  } as const;
}
