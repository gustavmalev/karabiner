import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state/appState';
import { buildCommandFrom, parseTypeTextFrom } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';
import { Button, Input, Select, SelectItem, Switch, Autocomplete, AutocompleteItem, Card, CardBody, Tooltip } from '@heroui/react';
import { KeyTile } from '../KeyboardGrid/KeyTile';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';

type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export function LayerDetail() {
  const { state, dispatch } = useAppState();
  const key = state.currentLayerKey;
  const layer = key ? state.config?.layers[key] : null;
  const [showCmdModal, setShowCmdModal] = useState<null | { mode: 'add' | 'edit'; cmdKey?: string; prefill?: string }>(null);

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
              <Tooltip content="Add a new inner command" placement="left">
                <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'add' })}>Add Command</Button>
              </Tooltip>
              <Tooltip content="Delete this sublayer" placement="left">
                <Button size="sm" variant="solid" color="danger" onPress={onDeleteLayer}>Delete Layer</Button>
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
        />
      </Modal>
      </CardBody>
    </Card>
  );
}

function CommandForm({ onCancel, onSave, takenKeys, initial, mode }: {
  onCancel: () => void;
  onSave: (v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => void;
  takenKeys: string[];
  initial?: { type: CmdType; text: string; ignore?: boolean; innerKey: string };
  mode: 'add' | 'edit';
}) {
  const [type, setType] = useState<CmdType>(initial?.type || 'app');
  const [text, setText] = useState(initial?.text || '');
  const [ignore, setIgnore] = useState(!!initial?.ignore);
  const [innerKey, setInnerKey] = useState(initial?.innerKey || '');
  const typeOptions: CmdType[] = ['app', 'window', 'raycast', 'shell', 'key'];
  const keyOptions = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ id: String.fromCharCode(97 + i) })), []);
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{mode === 'edit' ? 'Edit Command' : 'Add Command'}</h3>
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
            <SelectItem key={t}>
              {t}
            </SelectItem>
          ))}
        </Select>
        <Input label="Text" placeholder="e.g. Safari" value={text} onChange={(e) => setText(e.target.value)} />
        {type === 'raycast' && (
          <Switch isSelected={ignore} onValueChange={setIgnore}>
            Ignore
          </Switch>
        )}
        <Autocomplete
          label="Inner key"
          placeholder={`a-z${takenKeys.length ? `, taken: ${takenKeys.join(',')}` : ''}`}
          defaultItems={keyOptions}
          allowsCustomValue
          inputValue={innerKey}
          onInputChange={(val) => setInnerKey((val || '').toLowerCase())}
          onSelectionChange={(key) => setInnerKey(String(key || ''))}
        >
          {(item) => (
            <AutocompleteItem key={item.id}>
              {item.id}
            </AutocompleteItem>
          )}
        </Autocomplete>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Tooltip content="Close without saving" placement="top">
          <Button variant="solid" color="default" className="text-black" onPress={onCancel}>Cancel</Button>
        </Tooltip>
        <Tooltip content="Save command" placement="top">
          <Button variant="solid" color="primary" onPress={() => onSave({ type, text, ignore, innerKey })}>Save</Button>
        </Tooltip>
      </div>
    </div>
  );
}
