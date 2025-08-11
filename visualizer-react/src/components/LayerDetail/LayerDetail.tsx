import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { selectCurrentLayer } from '../../state/selectors';
import { buildCommandFrom, parseTypeTextFrom, getCommandDescription } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';
import { Button, Input, Select, SelectItem, Switch, Autocomplete, AutocompleteItem, Card, CardBody, Tooltip, Avatar } from '@heroui/react';
import { KeyTile } from '../KeyboardGrid/KeyTile';
import { numberRow, topRow, homeRow, bottomRow, labelForKey } from '../../utils/keys';
import { windowCommandItems } from '../../data/windowCommands';

type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export function LayerDetail() {
  const config = useStore((s) => s.config);
  const key = useStore((s) => s.currentLayerKey);
  const setConfig = useStore((s) => s.setConfig);
  const blocked = useStore((s) => s.blockedKeys);
  const toggleBlocked = useStore((s) => s.toggleBlocked);
  const layer = useStore(selectCurrentLayer);
  const [showCmdModal, setShowCmdModal] = useState<
    | null
    | { mode: 'add' | 'edit'; cmdKey?: string; prefill?: string; kind?: 'sublayer' | 'key' }
  >(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // sizing based on container
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = Math.min(16, Math.max(10, Math.round(containerWidth / 120)));
  const rows = useMemo(() => [numberRow, topRow, homeRow, bottomRow] as string[][], []);
  const keySize = useMemo(() => {
    if (!containerWidth) return 34;
    // Offsets in "key units" used as margin-left = offset * keySize
    const offsets = [0, 0.5, 1, 1.5];
    // For each row, find the maximum key size that fits: width >= keySize*(len+offset) + gap*(len-1)
    const candidates = rows.map((row, i) => {
      const len = row.length;
      const offset = offsets[i] ?? 0;
      return (containerWidth - (len - 1) * gap) / (len + offset);
    });
    const size = Math.min(...candidates);
    return Math.max(24, Math.min(72, size));
  }, [containerWidth, rows, gap]);

  const onAddLayer = () => {
    if (!key) return;
    const prevLayers = (config?.layers || {}) as Record<string, Layer>;
    const newLayers: Record<string, Layer> = {
      ...prevLayers,
      [key]: { type: 'sublayer', commands: {} as Record<string, Command> },
    };
    setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
    // Clear blocked state when a layer is created for this key
    if (blocked[key]) toggleBlocked(key);
  };

  const onDeleteLayer = () => {
    if (!key || !config) return;
    const newLayers = { ...config.layers };
    delete newLayers[key];
    setConfig({ ...config, layers: newLayers });
  };

  const onSaveCommand = (values: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => {
    if (!key) return;
    const cmd: Command = buildCommandFrom(values.type, values.text, { ignore: values.ignore });
    const prev: Record<string, Layer> = (config?.layers || {}) as Record<string, Layer>;
    const isKeyLevel = showCmdModal?.kind === 'key' || (prev[key] && (prev[key] as Layer).type === 'command');
    if (isKeyLevel) {
      const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'command', command: cmd } as Layer };
      setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
      // Clear blocked state when a direct command is created for this key
      if (blocked[key]) toggleBlocked(key);
    } else {
      const base: Layer = prev[key] || ({ type: 'sublayer', commands: {} as Record<string, Command> } as const);
      const commands = {
        ...((base.type === 'sublayer' ? base.commands : {}) as Record<string, Command>),
      } as Record<string, Command>;
      const innerKey = (values.innerKey || values.text?.[0] || 'a').toLowerCase();
      commands[innerKey] = cmd;
      const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
      setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
      // Creating the first inner command also implies the key is set up; clear blocked
      if (blocked[key]) toggleBlocked(key);
    }
    setShowCmdModal(null);
  };

  const sublayerCommands: Record<string, Command> | undefined = useMemo(() => {
    if (!layer || layer.type !== 'sublayer') return undefined;
    return layer.commands;
  }, [layer]);

  const onDeleteInner = (ik: string) => {
    if (!key || !config || !sublayerCommands) return;
    const prev: Record<string, Layer> = config.layers;
    const base = prev[key];
    if (!base || base.type !== 'sublayer') return;
    const commands = { ...base.commands };
    delete commands[ik];
    const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
    setConfig({ ...config, layers: newLayers });
  };

  return (
    <Card className="border">
      <CardBody className="min-h-40 overflow-visible !p-2 md:!p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Layer Detail</h2>
            {key && !layer && (
              <Tooltip content="Mark this base key as blocked by a third-party app. You won't be able to add or edit commands while blocked." placement="bottom">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">Blocked (3rd-party)</span>
                  <Switch size="sm" isSelected={!!(key && blocked[key])} onValueChange={() => key && toggleBlocked(key)} />
                </div>
              </Tooltip>
            )}
          </div>
          {key && !layer && (
            <div className="flex items-center gap-2">
              <Tooltip content="Create a sublayer for this key" placement="left">
                <Button size="sm" variant="solid" color="primary" onPress={onAddLayer} isDisabled={!!(key && blocked[key])}>
                  Add Layer
                </Button>
              </Tooltip>
              <Tooltip content="Bind a command directly to this key (no sublayer)" placement="left">
                <Button size="sm" variant="flat" color="secondary" onPress={() => setShowCmdModal({ mode: 'add', kind: 'key' })} isDisabled={!!(key && blocked[key])}>
                  Add Key
                </Button>
              </Tooltip>
            </div>
          )}
          {key && layer && (
            <div className="flex items-center gap-2">
              {layer.type === 'sublayer' ? (
                <>
                  <Tooltip content="Add a new inner command with AI suggestion" placement="left">
                    <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'add' })}>Add with AI</Button>
                  </Tooltip>
                  <Tooltip content="Delete this sublayer" placement="left">
                    <Button size="sm" variant="solid" color="danger" onPress={() => setConfirmDeleteOpen(true)}>Delete Layer</Button>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip content="Edit the command bound to this key" placement="left">
                    <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'edit', kind: 'key' })}>Edit Command</Button>
                  </Tooltip>
                  <Tooltip content="Remove this key binding" placement="left">
                    <Button size="sm" variant="solid" color="danger" onPress={() => setConfirmDeleteOpen(true)}>Delete Key</Button>
                  </Tooltip>
                </>
              )}
            </div>
          )}
        </div>

      {!key && <div className="text-sm text-slate-400">Select a base key to view details.</div>}
      {key && !layer && (
        <div className="text-sm text-slate-400">
          {blocked[key] ? (
            <span>This key is marked as blocked. Unblock it to add a layer or a direct command.</span>
          ) : (
            <span>No config for {key}.</span>
          )}
        </div>
      )}
      {key && layer && layer.type === 'sublayer' && (
        <div
          ref={containerRef}
          className="space-y-3"
          style={{ ['--key-size']: `${keySize}px`, ['--key-gap']: `${gap}px` } as CSSProperties}
        >
          <div className="text-xs text-default-500">Click a key to add/edit an inner command for this sublayer.</div>
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={"flex"}
              style={{ gap: 'var(--key-gap)', marginLeft: `calc(var(--key-size) * ${idx * 0.5})` }}
            >
              {row.map((code) => {
                const lower = code.toLowerCase();
                const isBase = key?.toLowerCase() === lower;
                const existing = !!sublayerCommands?.[lower];
                const stateForKey: 'locked' | 'custom' | 'available' = isBase ? 'locked' : (existing ? 'custom' : 'available');
                const cmd = existing && sublayerCommands ? sublayerCommands[lower] : undefined;
                return (
                  <KeyTile
                    key={code}
                    code={lower}
                    state={stateForKey}
                    tooltipContent={cmd ? <CommandPreview command={cmd} /> : undefined}
                    tooltipDelay={0}
                    onClick={
                      isBase
                        ? undefined
                        : () => (
                            existing
                              ? setShowCmdModal({ mode: 'edit', cmdKey: lower })
                              : setShowCmdModal({ mode: 'add', prefill: lower })
                          )
                    }
                  />
                );
              })}
            </div>
          ))}
          {(!sublayerCommands || Object.keys(sublayerCommands).length === 0) && (
            <div className="text-sm text-slate-400">No inner commands yet — choose a key to add one.</div>
          )}
        </div>
      )}
      {key && layer && layer.type === 'command' && (
        <div className="space-y-2">
          <div className="text-sm text-default-600">This key runs:</div>
          <div className="rounded border bg-content1 p-3 text-sm">
            <CommandPreview command={layer.command} />
          </div>
          <div className="text-xs text-default-500">Use Edit to change the command or Delete to clear this key.</div>
        </div>
      )}

      <Modal open={!!showCmdModal} onClose={() => setShowCmdModal(null)}>
        <CommandForm
          onCancel={() => setShowCmdModal(null)}
          onSave={(v) => {
            if (showCmdModal?.mode === 'edit' && showCmdModal.cmdKey && v.innerKey !== showCmdModal.cmdKey) {
              // remove old key when renaming
              onDeleteInner(showCmdModal.cmdKey);
            }
            onSaveCommand(v);
          }}
          takenKeys={[...Object.keys(sublayerCommands || {}), ...(key ? [key] : [])]}
          initial={(() => {
            if (!showCmdModal) return undefined;
            if (showCmdModal.mode === 'add') {
              if (showCmdModal.kind === 'key') {
                return { type: 'app' as CmdType, text: '', ignore: false } as any;
              }
              return showCmdModal.prefill ? { type: 'app' as CmdType, text: '', ignore: false, innerKey: showCmdModal.prefill } : undefined;
            }
            if (showCmdModal.mode === 'edit' && showCmdModal.cmdKey) {
              const cmd = sublayerCommands?.[showCmdModal.cmdKey];
              if (!cmd) return undefined;
              const parsed = parseTypeTextFrom(cmd);
              return {
                type: parsed.type as CmdType,
                text: parsed.text || '',
                ignore: parsed.type === 'raycast' ? (parsed.ignoreRaycast ?? false) : false,
                innerKey: showCmdModal.cmdKey,
              };
            }
            if (showCmdModal.mode === 'edit' && showCmdModal.kind === 'key' && key && config?.layers?.[key]?.type === 'command') {
              const parsed = parseTypeTextFrom((config.layers[key] as any).command);
              return {
                type: parsed.type as CmdType,
                text: parsed.text || '',
                ignore: parsed.type === 'raycast' ? (parsed.ignoreRaycast ?? false) : false,
              } as any;
            }
            return undefined;
          })()}
          mode={showCmdModal?.mode || 'add'}
          isKeyLevel={showCmdModal?.kind === 'key'}
          isBlocked={!!(key && !layer && blocked[key])}
          onDelete={() => {
            if (showCmdModal?.mode === 'edit' && showCmdModal.cmdKey) {
              onDeleteInner(showCmdModal.cmdKey);
              setShowCmdModal(null);
            }
            if (showCmdModal?.mode === 'edit' && showCmdModal.kind === 'key' && key && config) {
              const newLayers = { ...config.layers } as Record<string, Layer>;
              delete newLayers[key];
              setConfig({ ...config, layers: newLayers });
              setShowCmdModal(null);
            }
          }}
        />
      </Modal>

      {/* Confirm delete layer */}
      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
        hideCloseButton
        size="sm"
      >
        <div className="space-y-4">
          <h3 className="text-base font-semibold">{layer?.type === 'command' ? 'Delete Key?' : 'Delete Layer?'}</h3>
          <p className="text-sm text-default-600">{layer?.type === 'command' ? 'This will remove the direct command bound to key ' : 'This will remove the entire sublayer and all its inner commands for key '}<span className="font-semibold">{key}</span>. This action cannot be undone.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="solid" color="default" className="text-black" onPress={() => setConfirmDeleteOpen(false)} autoFocus>Cancel</Button>
            <Button
              variant="solid"
              color="danger"
              onPress={() => {
                onDeleteLayer();
                setConfirmDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      </CardBody>
    </Card>
  );
}

// Compact, pretty preview for a bound command (key-level)
function CommandPreview({ command }: { command: Command }) {
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
    try { press = parsed.text ? JSON.parse(parsed.text) : {}; } catch {}
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
}

function CommandForm({ onCancel, onSave, takenKeys, initial, mode, onDelete, isKeyLevel, isBlocked }: {
  onCancel: () => void;
  onSave: (v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => void;
  takenKeys: string[];
  initial?: { type: CmdType; text: string; ignore?: boolean; innerKey: string };
  mode: 'add' | 'edit';
  onDelete?: () => void;
  isKeyLevel?: boolean;
  isBlocked?: boolean;
}) {
  const apps = useStore((s) => s.apps);
  const aiKey = useStore((s) => s.aiKey);
  const setAIKey = useStore((s) => s.setAIKey);
  const hasAIKey = !!aiKey;
  const [type, setType] = useState<CmdType>(initial?.type || 'app');
  const [text, setText] = useState(initial?.text || '');
  const [ignore, setIgnore] = useState(!!initial?.ignore);
  const [innerKey, setInnerKey] = useState(initial?.innerKey || '');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestedKey, setAiSuggestedKey] = useState<string>('');
  const [aiRationale, setAiRationale] = useState<string>('');
  const [confirmDeleteCmdOpen, setConfirmDeleteCmdOpen] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(aiKey || '');
  const typeOptions: CmdType[] = ['app', 'window', 'raycast', 'key', 'shell'];
  const disabledTypes = new Set<CmdType>(['shell']);
  const typeDescriptions: Partial<Record<CmdType, string>> = { shell: 'Coming soon' };
  const isAIMode = mode === 'add' && !initial?.innerKey && !isKeyLevel; // Disable AI flow for key-level binding

  // Build full key list and mark taken ones as disabled
  const allKeyCodes = useMemo(() => [
    ...numberRow,
    ...topRow,
    ...homeRow,
    ...bottomRow,
  ], []);
  const takenInnerKeys = useMemo(() => takenKeys.map((k) => k.toLowerCase()), [takenKeys]);
  const keyOptions = useMemo(() => {
    return allKeyCodes.map((code) => ({
      id: code,
      label: labelForKey(code),
      disabled: takenInnerKeys.includes(code.toLowerCase()),
    }));
  }, [allKeyCodes, takenInnerKeys]);
  const appItems = useMemo(() => apps.map(a => ({ id: a.name, label: a.name, iconUrl: a.iconUrl, categoryLabel: a.categoryLabel })), [apps]);

  // Window command helpers
  const [windowQuery, setWindowQuery] = useState<string>('');
  const getWindowLabel = (slug: string): string => {
    const f = windowCommandItems.find(i => i.id === slug);
    if (f) return f.label;
    return slug ? slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : '';
  };
  useEffect(() => {
    if (type === 'window') {
      setWindowQuery(getWindowLabel(text));
    }
  }, [type, text]);

  // Key recording helpers
  type KeyPress = { key_code?: string; modifiers?: string[] };
  const [isRecording, setIsRecording] = useState(false);
  const [keyPress, setKeyPress] = useState<KeyPress>({});
  const modifierLabels: Record<string, string> = {
    left_command: 'cmd', right_command: 'cmd',
    left_option: 'opt', right_option: 'opt',
    left_control: 'ctrl', right_control: 'ctrl',
    left_shift: 'shift', right_shift: 'shift',
    fn: 'fn',
  };
  const eventToKarabiner = (e: KeyboardEvent): KeyPress => {
    const mods: string[] = [];
    if (e.metaKey) mods.push('left_command');
    if (e.altKey) mods.push('left_option');
    if (e.ctrlKey) mods.push('left_control');
    if (e.shiftKey) mods.push('left_shift');
    // try to detect fn? not available from KeyboardEvent reliably
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
    return { key_code, modifiers: mods };
  };
  const isModifierOnly = (e: KeyboardEvent) => ['ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight','ControlLeft','ControlRight'].includes(e.code);
  useEffect(() => {
    if (!isRecording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isModifierOnly(e)) return; // wait for a non-modifier key
      const kp = eventToKarabiner(e);
      if (kp.key_code) {
        setKeyPress(kp);
        setText(JSON.stringify(kp));
        setIsRecording(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isRecording]);
  useEffect(() => {
    if (type === 'key') {
      try {
        const parsed = text ? JSON.parse(text) as KeyPress : {};
        setKeyPress(parsed || {});
      } catch {
        // ignore
      }
    }
  }, [type, text]);
  const recordedLabel = useMemo(() => {
    const mods = (keyPress.modifiers || []).map(m => modifierLabels[m] || m);
    const base = keyPress.key_code ? labelForKey(keyPress.key_code) : '';
    return [...mods.map(m => m.toUpperCase()), base].filter(Boolean).join(' + ');
  }, [keyPress]);
  const canSave = useMemo(() => {
    const textTrim = (text || '').trim();
    const typeOk = (
      (type === 'key' && !!keyPress.key_code) ||
      (type !== 'key' && textTrim.length > 0)
    );
    const innerKeyOk = isKeyLevel || isAIMode || !!innerKey;
    const notBlocked = !isBlocked;
    return typeOk && innerKeyOk && notBlocked;
  }, [type, text, keyPress, innerKey, isKeyLevel, isAIMode, isBlocked]);

  // Improved mnemonic + ergonomics suggestion with rationale
  function suggestInnerKey(): { key: string | null; reason: string } {
    const available = allKeyCodes
      .map((c) => c.toLowerCase())
      .filter((c) => !takenInnerKeys.includes(c));
    const isLetter = (c: string) => /^[a-z]$/.test(c);
    const availableLetters = available.filter(isLetter);

    // Preference order by comfort: home > top > bottom (letters only)
    const comfortOrder = [
      ...homeRow,
      ...topRow,
      ...bottomRow,
    ].map((c) => c.toLowerCase());
    const comfortOrderLetters = Array.from(new Set(comfortOrder.filter(isLetter)));
    const comfortRank = (c: string) => {
      const i = comfortOrderLetters.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    // Build candidate mnemonic letters from the name, favoring word initials
    let sourceLabel = (text || '').trim();
    if (type === 'raycast') {
      try {
        const raw = sourceLabel.replace(/^"|"$/g, '');
        const last = raw.split('/').filter(Boolean).pop() || raw;
        sourceLabel = last.replace(/[?#].*$/, '');
      } catch {
        // ignore
      }
    }
    const slug = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const stop = new Set(['the','a','an','of','and','for','to','in','on','with','by','at']);
    const words = slug.split(/\s+/).filter((w) => w && !stop.has(w));
    const initials = Array.from(new Set(words.map((w) => w[0]).filter((ch) => /[a-z]/.test(ch))));
    const others: string[] = [];
    for (const w of words) {
      for (const ch of w.slice(1)) if (/[a-z]/.test(ch)) others.push(ch);
    }
    const uniqueOthers = Array.from(new Set(others));
    // Add app category-derived letters (from LSApplicationCategoryType) when selecting an app
    const categoryLetters: string[] = [];
    if (type === 'app') {
      const match = apps.find(a => a.name.toLowerCase() === sourceLabel.toLowerCase());
      const uti = match?.category || '';
      const tail = uti.split('.').pop() || '';
      // Example: "productivity", "developer-tools" -> take first letters of tokens
      const tokens = tail.split('-').filter(Boolean);
      for (const t of tokens) if (t[0] && /[a-z]/.test(t[0])) categoryLetters.push(t[0]);
    }
    const mnemonicCandidates = [...categoryLetters, ...initials, ...uniqueOthers];

    // 1) Best mnemonic available by comfort
    const mnemonicAvailable = mnemonicCandidates.filter((ch) => availableLetters.includes(ch));
    if (mnemonicAvailable.length) {
      const choice = mnemonicAvailable.reduce((best, ch) => (comfortRank(ch) < comfortRank(best) ? ch : best));
      const isCat = categoryLetters.includes(choice);
      const isInitial = initials.includes(choice);
      const whyInitial = isCat ? 'category letter' : (isInitial ? 'first letter' : 'mnemonic letter');
      const first = initials[0];
      const pre = first && choice !== first && !availableLetters.includes(first)
        ? `First letter ${first.toUpperCase()} is taken; `
        : '';
      const rowHint = comfortRank(choice) <= comfortRank('a') ? ' on a comfortable row' : '';
      return { key: choice, reason: `${pre}Picked ${choice.toUpperCase()} — ${whyInitial} from “${sourceLabel}”${rowHint}.` };
    }

    // 2) Category initial fallback (by command type; for app, we already tried app category above)
    const categoryInitial: Record<CmdType, string> = { app: 'a', window: 'w', raycast: 'r', shell: 's', key: 'k' };
    const cat = categoryInitial[type];
    if (type !== 'app' && cat && availableLetters.includes(cat)) {
      return { key: cat, reason: `No mnemonic letters free; picked category letter ${cat.toUpperCase()} for ${type}.` };
    }

    // 3) Next-best: any free letter by comfort
    if (availableLetters.length) {
      const choice = availableLetters.reduce((best, ch) => (comfortRank(ch) < comfortRank(best) ? ch : best));
      return { key: choice, reason: `No mnemonic or category letter free; picked comfortable letter ${choice.toUpperCase()}.` };
    }

    // 4) Last resort: any free non-letter (prefer comfortable area order: home/top/bottom/number)
    const nonLetterPreferred = [
      ...homeRow,
      ...topRow,
      ...bottomRow,
      ...numberRow,
    ].map((c) => c.toLowerCase()).filter((c) => !isLetter(c));
    const anyNonLetter = nonLetterPreferred.find((c) => available.includes(c)) || available[0];
    if (anyNonLetter) {
      return { key: anyNonLetter, reason: `No letters available — picked free key ${labelForKey(anyNonLetter)}.` };
    }
    return { key: null, reason: 'No free keys available in this sublayer.' };
  }
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{mode === 'edit' ? 'Edit Command' : (isAIMode ? 'Add with AI' : 'Add Command')}</h3>
      <div className="grid grid-cols-1 gap-4">
        <Select
          label="Type"
          selectedKeys={new Set([type])}
          onSelectionChange={(keys) => {
            const v = Array.from(keys as Set<string>)[0] as CmdType | undefined;
            if (v) setType(v);
          }}
        >
          {typeOptions.map((t) => (
            <SelectItem key={t} isDisabled={disabledTypes.has(t)} description={typeDescriptions[t]}>
              {t}
            </SelectItem>
          ))}
        </Select>
        {type === 'app' ? (
          <Autocomplete
            label="App"
            labelPlacement="outside"
            placeholder="Search installed apps"
            defaultItems={appItems}
            allowsCustomValue
            radius="sm"
            size="lg"
            isVirtualized
            itemHeight={56}
            maxListboxHeight={320}
            isClearable={false}
            inputValue={text}
            onInputChange={(val) => setText((val || '').trimStart())}
            onSelectionChange={(key) => {
              const id = String(key || '');
              const label = appItems.find(i => i.id === id)?.label || id;
              setText(label);
            }}
            // Show icon of the selected app inside the input
            startContent={(apps.find(a => a.name.toLowerCase() === (text || '').toLowerCase())?.iconUrl) ? (
              <span className="inline-flex h-5 w-5 items-center justify-center shrink-0">
                <Avatar src={apps.find(a => a.name.toLowerCase() === (text || '').toLowerCase())!.iconUrl} radius="sm" className="h-5 w-5" />
              </span>
            ) : null}
            // Remove white focus ring/border on highlighted items and popover
            classNames={{
              base: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0',
              listbox: 'outline-none',
              listboxWrapper: 'outline-none ring-0 border-0',
              popoverContent: 'outline-none border-0 ring-0',
              endContentWrapper: 'hidden',
              clearButton: 'hidden',
              selectorButton: 'hidden',
            }}
            popoverProps={{
              offset: 8,
              classNames: {
                base: 'rounded-medium',
                content: 'p-1.5 border-0 bg-background',
              },
            }}
            listboxProps={{
              hideSelectedIcon: true,
              topContent: (
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-default-500">Apps</div>
              ),
              itemClasses: {
                base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none text-default-500 transition-opacity px-2 py-1.5 data-[hover=true]:text-foreground data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
                wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
                selectedIcon: 'hidden',
              },
            }}
          >
            {(item) => (
              <AutocompleteItem key={item.id} textValue={item.label}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 min-h-[44px]">
                    <Avatar
                      src={item.iconUrl}
                      name={item.label}
                      size="sm"
                      radius="sm"
                      className="shrink-0 bg-transparent overflow-hidden h-5 w-5"
                      imgProps={{ loading: 'lazy', decoding: 'async' }}
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-small text-default-800">{item.label}</span>
                      {item.categoryLabel ? (
                        <span className="text-tiny text-default-400">{item.categoryLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>
        ) : type === 'window' ? (
          <Autocomplete
            label="Window"
            placeholder="Search window actions"
            defaultItems={windowCommandItems}
            allowsCustomValue={false}
            radius="sm"
            isClearable={false}
            inputValue={windowQuery}
            onInputChange={(val) => setWindowQuery(val || '')}
            onSelectionChange={(key) => {
              const id = String(key || '');
              const label = windowCommandItems.find(i => i.id === id)?.label || getWindowLabel(id);
              setText(id);
              setWindowQuery(label);
            }}
            classNames={{
              base: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 [&_[data-slot=inner-wrapper]]:!items-center [&_[data-slot=inner-wrapper]]:gap-1',
              listbox: 'outline-none',
              listboxWrapper: 'outline-none ring-0 border-0',
              popoverContent: 'outline-none border-0 ring-0',
              endContentWrapper: 'hidden',
              clearButton: 'hidden',
              selectorButton: 'hidden',
            }}
            popoverProps={{
              offset: 8,
              classNames: {
                base: 'rounded-medium',
                content: 'p-1 border-0 bg-background',
              },
            }}
            listboxProps={{
              hideSelectedIcon: true,
              itemClasses: {
                base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none text-default-500 transition-opacity data-[hover=true]:text-foreground data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
                wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
                selectedIcon: 'hidden',
              },
            }}
          >
            {(item) => (
              <AutocompleteItem key={item.id}>
                {item.label}
              </AutocompleteItem>
            )}
          </Autocomplete>
        ) : (
          type === 'raycast' ? (
            <Input label="Raycast deeplink" placeholder="Paste Raycast deeplink (raycast://…)" value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            type !== 'key' && (
              <Input label="Text" placeholder="e.g. Safari" value={text} onChange={(e) => setText(e.target.value)} />
            )
          )
        )}
        {type === 'key' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="solid" color={isRecording ? 'danger' : 'secondary'} onPress={() => setIsRecording(r => !r)}>
              {isRecording ? 'Stop' : 'Record'}
            </Button>
            <div className="text-sm text-default-600 min-h-6">
              {recordedLabel || (isRecording ? 'Press a key combo…' : 'No key captured')}
            </div>
            {keyPress.key_code && (
              <Button size="sm" variant="flat" onPress={() => { setKeyPress({}); setText(''); }}>Clear</Button>
            )}
          </div>
        )}
        {isAIMode && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-default-500">
              {hasAIKey ? 'Gemini suggestions enabled' : 'Gemini suggestions disabled'}
            </div>
            <Button size="sm" variant="flat" onPress={() => { setApiKeyInput(aiKey || ''); setShowApiKeyModal(true); }}>
              {hasAIKey ? 'Update API key' : 'Set API key'}
            </Button>
          </div>
        )}
        {type === 'raycast' && (
          <Tooltip content={"If enabled, uses 'open -g' so Raycast opens in the background and doesn't take focus"} placement="right">
            <Switch isSelected={ignore} onValueChange={setIgnore}>
              Open in background
            </Switch>
          </Tooltip>
        )}
        {!isKeyLevel && (
          !isAIMode ? (
            <Autocomplete
              label="Inner key"
              labelPlacement="outside"
              placeholder={`Choose a key${takenKeys.length ? ` — taken: ${takenKeys.join(',')}` : ''}`}
              defaultItems={keyOptions}
              allowsCustomValue={false}
              radius="sm"
              size="lg"
              isClearable={false}
              inputValue={innerKey}
              onInputChange={(val) => setInnerKey((val || '').toLowerCase())}
              onSelectionChange={(key) => setInnerKey(String(key || ''))}
              classNames={{
                base: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0',
                listbox: 'outline-none',
                listboxWrapper: 'outline-none ring-0 border-0',
                popoverContent: 'outline-none border-0 ring-0',
                endContentWrapper: 'hidden',
                clearButton: 'hidden',
                selectorButton: 'hidden',
              }}
              popoverProps={{
                offset: 8,
                classNames: {
                  base: 'rounded-medium',
                  content: 'p-1 border-0 bg-background',
                },
              }}
              listboxProps={{
                topContent: (
                  <div className="px-2 py-1 text-[11px] leading-none text-default-500">
                    Keys
                  </div>
                ),
                hideSelectedIcon: true,
                itemClasses: {
                  base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none px-2.5 py-1.5 data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
                  wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
                  selectedIcon: 'hidden',
                },
              }}
            >
              {(item) => (
                <AutocompleteItem
                  key={item.id}
                  isDisabled={item.disabled}
                  description={item.disabled ? 'Already taken' : undefined}
                >
                  {item.label}
                </AutocompleteItem>
              )}
            </Autocomplete>
          ) : (
            <div className="text-sm text-default-600">
              {aiSuggestedKey ? (
                <div>
                  Suggested key: <span className="font-semibold">{labelForKey(aiSuggestedKey)}</span>
                  {aiRationale && <div className="mt-1 text-default-500">{aiRationale}</div>}
                </div>
              ) : (
                <div>Click Suggest to propose an inner key based on your command name and availability.</div>
              )}
            </div>
          )
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Tooltip content="Close without saving" placement="top">
          <Button variant="solid" color="default" className="text-black" onPress={onCancel}>Cancel</Button>
        </Tooltip>
        {mode === 'edit' && onDelete && (
          <Tooltip content="Delete this command" placement="top">
            <Button variant="solid" color="danger" onPress={() => setConfirmDeleteCmdOpen(true)}>Delete</Button>
          </Tooltip>
        )}
        {!isAIMode ? (
          <Tooltip content="Save command" placement="top">
            <Button variant="solid" color="primary" isDisabled={!canSave} onPress={() => onSave({ type, text, ignore, innerKey })}>Save</Button>
          </Tooltip>
        ) : aiSuggestedKey ? (
          <Tooltip content="Save command" placement="top">
            <Button variant="solid" color="primary" isDisabled={!canSave} onPress={() => onSave({ type, text, ignore, innerKey: aiSuggestedKey })}>Save</Button>
          </Tooltip>
        ) : (
          <Tooltip content={hasAIKey ? 'Suggest an inner key' : 'Add your Gemini API key to enable suggestions'} placement="top">
            <span className="inline-block">
              <Button
                variant="solid"
                color="primary"
                isDisabled={!hasAIKey || !text.trim()}
                isLoading={isSuggesting}
                onPress={async () => {
                  setIsSuggesting(true);
                  try {
                    const { key, reason } = suggestInnerKey();
                    if (key) {
                      setAiSuggestedKey(key);
                      setInnerKey(key);
                      setAiRationale(reason);
                    } else {
                      setAiRationale('No free keys available in this sublayer.');
                    }
                  } finally {
                    setIsSuggesting(false);
                  }
                }}
              >
                Suggest
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
      {/* Confirm delete inner command */}
      {/* Update API key modal */}
      <Modal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        isDismissable={true}
        size="sm"
      >
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Gemini API key</h3>
          <Input
            type="password"
            label="API key"
            placeholder="Paste your Gemini API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="solid" color="default" className="text-black" onPress={() => setShowApiKeyModal(false)}>Cancel</Button>
            <Button
              variant="solid"
              color="primary"
              onPress={() => {
                setAIKey(apiKeyInput.trim());
                setShowApiKeyModal(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDeleteCmdOpen}
        onClose={() => setConfirmDeleteCmdOpen(false)}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
        hideCloseButton
        size="sm"
      >
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Delete Command?</h3>
          <p className="text-sm text-default-600">This will remove the inner command for key <span className="font-semibold">{innerKey || initial?.innerKey}</span>. This action cannot be undone.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="solid" color="default" className="text-black" onPress={() => setConfirmDeleteCmdOpen(false)} autoFocus>Cancel</Button>
            <Button
              variant="solid"
              color="danger"
              onPress={() => {
                if (onDelete) onDelete();
                setConfirmDeleteCmdOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
