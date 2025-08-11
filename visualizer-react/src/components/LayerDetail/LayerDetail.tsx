import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { selectCurrentLayer } from '../../state/selectors';
import { buildCommandFrom, parseTypeTextFrom, getCommandDescription } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';
import { Button, Input, Select, SelectItem, Switch, Autocomplete, AutocompleteItem, Card, CardBody, Tooltip } from '@heroui/react';
import { KeyTile } from '../KeyboardGrid/KeyTile';
import { numberRow, topRow, homeRow, bottomRow, labelForKey } from '../../utils/keys';
import { windowCommandItems } from '../../data/windowCommands';

type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export function LayerDetail() {
  const config = useStore((s) => s.config);
  const key = useStore((s) => s.currentLayerKey);
  const setConfig = useStore((s) => s.setConfig);
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
    } else {
      const base: Layer = prev[key] || ({ type: 'sublayer', commands: {} as Record<string, Command> } as const);
      const commands = {
        ...((base.type === 'sublayer' ? base.commands : {}) as Record<string, Command>),
      } as Record<string, Command>;
      const innerKey = (values.innerKey || values.text?.[0] || 'a').toLowerCase();
      commands[innerKey] = cmd;
      const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
      setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
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
          <h2 className="text-sm font-semibold">Layer Detail</h2>
          {key && !layer && (
            <div className="flex items-center gap-2">
              <Tooltip content="Create a sublayer for this key" placement="left">
                <Button size="sm" variant="solid" color="primary" onPress={onAddLayer}>
                  Add Layer
                </Button>
              </Tooltip>
              <Tooltip content="Bind a command directly to this key (no sublayer)" placement="left">
                <Button size="sm" variant="flat" color="secondary" onPress={() => setShowCmdModal({ mode: 'add', kind: 'key' })}>
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
      {key && !layer && <div className="text-sm text-slate-400">No config for {key}.</div>}
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
                return (
                  <KeyTile
                    key={code}
                    code={lower}
                    state={stateForKey}
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
            {getCommandDescription(layer.command) || 'Command'}
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

function CommandForm({ onCancel, onSave, takenKeys, initial, mode, onDelete, isKeyLevel }: {
  onCancel: () => void;
  onSave: (v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => void;
  takenKeys: string[];
  initial?: { type: CmdType; text: string; ignore?: boolean; innerKey: string };
  mode: 'add' | 'edit';
  onDelete?: () => void;
  isKeyLevel?: boolean;
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
  const appItems = useMemo(() => apps.map(a => ({ id: a.name, label: a.name })), [apps]);

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
  const canSave = type !== 'key' || !!keyPress.key_code;

  // Simple mnemonic-based suggestion per philosophy
  function suggestInnerKey(): { key: string | null; reason: string } {
    const available = allKeyCodes
      .map((c) => c.toLowerCase())
      .filter((c) => !takenInnerKeys.includes(c));
    const isLetter = (c: string) => /^[a-z]$/.test(c);
    const availableLetters = available.filter(isLetter);
    // Build candidate letters from name depending on type
    let sourceLabel = (text || '').trim();
    if (type === 'raycast') {
      // Try to parse last path segment of a Raycast deeplink: raycast://extensions/owner/ext/command
      try {
        const raw = sourceLabel.replace(/^"|"$/g, '');
        const last = raw.split('/').filter(Boolean).pop() || raw;
        sourceLabel = last.replace(/[?#].*$/, '');
      } catch {
        // ignore parse issues
      }
    }
    const slug = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const words = slug.split(/\s+/).filter(Boolean);
    const lettersFromWords: string[] = [];
    for (const w of words) {
      for (const ch of w) {
        if (/[a-z]/.test(ch)) lettersFromWords.push(ch);
      }
    }
    const nameLetters = Array.from(new Set(lettersFromWords));

    const firstInitial = nameLetters[0];
    // 1) Exact initial or any remaining mnemonic letter from the name/slug
    for (const [idx, ch] of nameLetters.entries()) {
      if (ch && availableLetters.includes(ch)) {
        if (idx === 0) {
          return { key: ch, reason: `Picked ${ch.toUpperCase()} from the name “${sourceLabel}”.` };
        }
        const why = firstInitial && firstInitial !== ch && !availableLetters.includes(firstInitial)
          ? `First letter ${firstInitial.toUpperCase()} is taken; `
          : '';
        return { key: ch, reason: `${why}Picked ${ch.toUpperCase()} from the name “${sourceLabel}”.` };
      }
    }

    // 2) Category initial fallback
    const categoryInitial: Record<CmdType, string> = { app: 'a', window: 'w', raycast: 'r', shell: 's', key: 'k' };
    const cat = categoryInitial[type];
    if (cat && availableLetters.includes(cat)) {
      const pre = firstInitial && !availableLetters.includes(firstInitial)
        ? `First letter ${firstInitial.toUpperCase()} is taken; `
        : `No clear mnemonic letter available; `;
      return { key: cat, reason: `${pre}picked category letter ${cat.toUpperCase()} for ${type}.` };
    }

    // 3) Next-best: first free letter
    if (availableLetters.length) {
      const pre = firstInitial && !availableLetters.includes(firstInitial)
        ? `First letter ${firstInitial.toUpperCase()} is taken; `
        : `No clear mnemonic letter available; `;
      return { key: availableLetters[0], reason: `${pre}picked the first free letter ${availableLetters[0].toUpperCase()}.` };
    }

    // 4) Last resort: any free key (non-letter)
    if (available.length) {
      return { key: available[0], reason: `No letters available — picked the first free key ${labelForKey(available[0])}.` };
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
            placeholder="Search installed apps"
            defaultItems={appItems}
            allowsCustomValue
            inputValue={text}
            onInputChange={(val) => setText((val || '').trimStart())}
            onSelectionChange={(key) => setText(String(key || ''))}
          >
            {(item) => (
              <AutocompleteItem key={item.id}>
                {item.label}
              </AutocompleteItem>
            )}
          </Autocomplete>
        ) : type === 'window' ? (
          <Autocomplete
            label="Window"
            placeholder="Search window actions"
            defaultItems={windowCommandItems}
            allowsCustomValue={false}
            inputValue={windowQuery}
            onInputChange={(val) => setWindowQuery(val || '')}
            onSelectionChange={(key) => {
              const id = String(key || '');
              const label = windowCommandItems.find(i => i.id === id)?.label || getWindowLabel(id);
              setText(id);
              setWindowQuery(label);
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
        {!hasAIKey && isAIMode && (
          <Input
            label="Gemini API key"
            placeholder="Paste your Gemini API key to enable suggestions"
            value={aiKey}
            onChange={(e) => setAIKey(e.target.value)}
          />
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
              placeholder={`Choose a key${takenKeys.length ? ` — taken: ${takenKeys.join(',')}` : ''}`}
              defaultItems={keyOptions}
              allowsCustomValue={false}
              inputValue={innerKey}
              onInputChange={(val) => setInnerKey((val || '').toLowerCase())}
              onSelectionChange={(key) => setInnerKey(String(key || ''))}
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
                    // Placeholder: local heuristic suggestion per philosophy. Hook Gemini here later.
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
