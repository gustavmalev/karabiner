import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state/appState';
import { buildCommandFrom, parseTypeTextFrom } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';
import { Button, Input, Select, SelectItem, Switch, Autocomplete, AutocompleteItem, Card, CardBody, Tooltip } from '@heroui/react';
import { KeyTile } from '../KeyboardGrid/KeyTile';
import { numberRow, topRow, homeRow, bottomRow, labelForKey } from '../../utils/keys';

type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export function LayerDetail() {
  const { state, dispatch } = useAppState();
  const key = state.currentLayerKey;
  const layer = key ? state.config?.layers[key] : null;
  const [showCmdModal, setShowCmdModal] = useState<null | { mode: 'add' | 'edit'; cmdKey?: string; prefill?: string }>(null);
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
    const newLayers: Record<string, Layer> = {
      ...(state.config?.layers || {}),
      [key]: { type: 'sublayer', commands: {} as Record<string, Command> },
    };
    dispatch({ type: 'setConfig', config: { ...(state.config || { layers: {} as Record<string, Layer> }), layers: newLayers } });
    dispatch({ type: 'markDirty' });
  };

  const onDeleteLayer = () => {
    if (!key || !state.config) return;
    const newLayers = { ...state.config.layers };
    delete newLayers[key];
    dispatch({ type: 'setConfig', config: { ...state.config, layers: newLayers } });
    dispatch({ type: 'markDirty' });
  };

  const onSaveCommand = (values: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => {
    if (!key) return;
    const cmd: Command = buildCommandFrom(values.type, values.text, { ignore: values.ignore });
    const prev: Record<string, Layer> = (state.config?.layers || {}) as Record<string, Layer>;
    const base: Layer = prev[key] || ({ type: 'sublayer', commands: {} as Record<string, Command> } as const);
    const commands = {
      ...((base.type === 'sublayer' ? base.commands : {}) as Record<string, Command>),
    } as Record<string, Command>;
    const innerKey = (values.innerKey || values.text?.[0] || 'a').toLowerCase();
    commands[innerKey] = cmd;
    const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
    dispatch({ type: 'setConfig', config: { ...(state.config || { layers: {} as Record<string, Layer> }), layers: newLayers } });
    dispatch({ type: 'markDirty' });
    setShowCmdModal(null);
  };

  const sublayerCommands = (layer && (layer as any).commands) as Record<string, Command> | undefined;

  const onDeleteInner = (ik: string) => {
    if (!key || !state.config || !sublayerCommands) return;
    const prev: Record<string, Layer> = state.config.layers;
    const base = prev[key];
    if (!base || base.type !== 'sublayer') return;
    const commands = { ...base.commands };
    delete commands[ik];
    const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
    dispatch({ type: 'setConfig', config: { ...state.config, layers: newLayers } });
    dispatch({ type: 'markDirty' });
  };

  return (
    <Card className="border">
      <CardBody className="min-h-40 overflow-visible !p-2 md:!p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Layer Detail</h2>
          {key && !layer && (
            <Tooltip content="Create a sublayer for this key" placement="left">
              <Button size="sm" variant="solid" color="primary" onPress={onAddLayer}>
                Add Layer
              </Button>
            </Tooltip>
          )}
          {key && layer && (
            <div className="flex items-center gap-2">
              <Tooltip content="Add a new inner command with AI suggestion" placement="left">
                <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'add' })}>Add with AI</Button>
              </Tooltip>
              <Tooltip content="Delete this sublayer" placement="left">
                <Button size="sm" variant="solid" color="danger" onPress={() => setConfirmDeleteOpen(true)}>Delete Layer</Button>
              </Tooltip>
            </div>
          )}
        </div>

      {!key && <div className="text-sm text-slate-400">Select a base key to view details.</div>}
      {key && !layer && <div className="text-sm text-slate-400">No config for {key}.</div>}
      {key && layer && layer.type === 'sublayer' && (
        <div
          ref={containerRef}
          className="space-y-3"
          style={{ ['--key-size' as any]: `${keySize}px`, ['--key-gap' as any]: `${gap}px` }}
        >
          <div className="text-xs text-default-500">Click a key to add/edit an inner command for this sublayer.</div>
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={"flex"}
              style={{ gap: 'var(--key-gap)', marginLeft: `calc(var(--key-size) * ${idx * 0.5})` }}
            >
              {row.map((code) => {
                const existing = !!sublayerCommands?.[code.toLowerCase()];
                const stateForKey: 'custom' | 'available' = existing ? 'custom' : 'available';
                return (
                  <KeyTile
                    key={code}
                    code={code.toLowerCase()}
                    state={stateForKey}
                    onClick={() =>
                      existing
                        ? setShowCmdModal({ mode: 'edit', cmdKey: code.toLowerCase() })
                        : setShowCmdModal({ mode: 'add', prefill: code.toLowerCase() })
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
          takenKeys={Object.keys(sublayerCommands || {})}
          initial={(() => {
            if (!showCmdModal) return undefined;
            if (showCmdModal.mode === 'add') {
              return showCmdModal.prefill ? { type: 'app' as CmdType, text: '', ignore: false, innerKey: showCmdModal.prefill } : undefined;
            }
            if (showCmdModal.mode === 'edit' && showCmdModal.cmdKey) {
              const cmd = sublayerCommands?.[showCmdModal.cmdKey];
              if (!cmd) return undefined;
              const parsed = parseTypeTextFrom(cmd);
              return { type: parsed.type as CmdType, text: (parsed as any).text || '', ignore: (parsed as any).ignoreRaycast || false, innerKey: showCmdModal.cmdKey };
            }
            return undefined;
          })()}
          mode={showCmdModal?.mode || 'add'}
          onDelete={() => {
            if (showCmdModal?.mode === 'edit' && showCmdModal.cmdKey) {
              onDeleteInner(showCmdModal.cmdKey);
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
          <h3 className="text-base font-semibold">Delete Layer?</h3>
          <p className="text-sm text-default-600">This will remove the entire sublayer and all its inner commands for key <span className="font-semibold">{key}</span>. This action cannot be undone.</p>
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

function CommandForm({ onCancel, onSave, takenKeys, initial, mode, onDelete }: {
  onCancel: () => void;
  onSave: (v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => void;
  takenKeys: string[];
  initial?: { type: CmdType; text: string; ignore?: boolean; innerKey: string };
  mode: 'add' | 'edit';
  onDelete?: () => void;
}) {
  const { state, dispatch } = useAppState();
  const hasAIKey = !!state.aiKey;
  const [type, setType] = useState<CmdType>(initial?.type || 'app');
  const [text, setText] = useState(initial?.text || '');
  const [ignore, setIgnore] = useState(!!initial?.ignore);
  const [innerKey, setInnerKey] = useState(initial?.innerKey || '');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestedKey, setAiSuggestedKey] = useState<string>('');
  const [aiRationale, setAiRationale] = useState<string>('');
  const [confirmDeleteCmdOpen, setConfirmDeleteCmdOpen] = useState(false);
  const typeOptions: CmdType[] = ['app', 'window', 'raycast', 'shell', 'key'];
  const disabledTypes = new Set<CmdType>(['shell', 'key', 'window']);
  const typeDescriptions: Partial<Record<CmdType, string>> = { shell: 'Coming soon', key: 'Coming soon', window: 'Coming soon' };
  const isAIMode = mode === 'add' && !initial?.innerKey; // Only the Add-with-AI path shows suggestion UI

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
  const appItems = useMemo(() => state.apps.map(a => ({ id: a.name, label: a.name })), [state.apps]);

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
        const raw = sourceLabel.replace(/^\"|\"$/g, '');
        const last = raw.split('/').filter(Boolean).pop() || raw;
        sourceLabel = last.replace(/[?#].*$/, '');
      } catch {}
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
        ) : (
          <Input label="Text" placeholder="e.g. Safari" value={text} onChange={(e) => setText(e.target.value)} />
        )}
        {!hasAIKey && isAIMode && (
          <Input
            label="Gemini API key"
            placeholder="Paste your Gemini API key to enable suggestions"
            value={state.aiKey}
            onChange={(e) => dispatch({ type: 'setAIKey', aiKey: e.target.value })}
          />
        )}
        {type === 'raycast' && (
          <Switch isSelected={ignore} onValueChange={setIgnore}>
            Ignore
          </Switch>
        )}
        {!isAIMode ? (
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
            <Button variant="solid" color="primary" onPress={() => onSave({ type, text, ignore, innerKey })}>Save</Button>
          </Tooltip>
        ) : aiSuggestedKey ? (
          <Tooltip content="Save command" placement="top">
            <Button variant="solid" color="primary" onPress={() => onSave({ type, text, ignore, innerKey: aiSuggestedKey })}>Save</Button>
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
                onDelete && onDelete();
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
