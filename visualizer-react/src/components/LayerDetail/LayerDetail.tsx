import { useState } from 'react';
import { useAppState } from '../../state/appState';
import { buildCommandFrom, getCommandDescription, parseTypeTextFrom } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';

type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

export function LayerDetail() {
  const { state, dispatch } = useAppState();
  const key = state.currentLayerKey;
  const layer = key ? state.config?.layers[key] : null;
  const [showCmdModal, setShowCmdModal] = useState<null | { mode: 'add' | 'edit'; cmdKey?: string }>(null);

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
    <div className="rounded-lg border bg-white/5 p-4 min-h-40">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Layer Detail</h2>
        {key && !layer && (
          <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-white/10" onClick={onAddLayer}>
            Add Layer
          </button>
        )}
        {key && layer && (
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-white/10" onClick={() => setShowCmdModal({ mode: 'add' })}>
              Add Command
            </button>
            <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-white/10" onClick={onDeleteLayer}>
              Delete Layer
            </button>
          </div>
        )}
      </div>

      {!key && <div className="text-sm text-slate-400">Select a base key to view details.</div>}
      {key && !layer && <div className="text-sm text-slate-400">No config for {key}.</div>}
      {key && layer && layer.type === 'sublayer' && (
        <div className="space-y-2">
          {Object.keys(sublayerCommands || {}).length === 0 && <div className="text-sm text-slate-400">No inner commands yet.</div>}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sublayerCommands || {}).map(([ik, cmd]) => (
              <div key={ik} className="rounded-md border border-slate-200 bg-white p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-medium text-slate-800">{ik}</div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{parseTypeTextFrom(cmd).type}</span>
                    <button className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50" onClick={() => setShowCmdModal({ mode: 'edit', cmdKey: ik })}>Edit</button>
                    <button className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50" onClick={() => onDeleteInner(ik)}>Delete</button>
                  </div>
                </div>
                <div className="text-slate-700">{getCommandDescription(cmd) || '—'}</div>
              </div>
            ))}
          </div>
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
            if (!showCmdModal || showCmdModal.mode === 'add' || !showCmdModal.cmdKey) return undefined;
            const cmd = sublayerCommands?.[showCmdModal.cmdKey];
            if (!cmd) return undefined;
            const parsed = parseTypeTextFrom(cmd);
            return { type: parsed.type as CmdType, text: (parsed as any).text || '', ignore: (parsed as any).ignoreRaycast || false, innerKey: showCmdModal.cmdKey };
          })()}
          mode={showCmdModal?.mode || 'add'}
        />
      </Modal>
    </div>
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
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{mode === 'edit' ? 'Edit Command' : 'Add Command'}</h3>
      <div className="grid grid-cols-4 items-center gap-2 text-sm">
        <label className="text-right text-slate-600">Type</label>
        <select className="col-span-3 rounded border border-slate-300 bg-white p-2 text-slate-900" value={type} onChange={(e) => setType(e.target.value as CmdType)}>
          <option value="app">app</option>
          <option value="window">window</option>
          <option value="raycast">raycast</option>
          <option value="shell">shell</option>
          <option value="key">key</option>
        </select>
        <label className="text-right text-slate-600">Text</label>
        <input className="col-span-3 rounded border border-slate-300 bg-white p-2 text-slate-900" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Safari" />
        {type === 'raycast' && (
          <>
            <label className="text-right text-slate-600">Ignore</label>
            <input className="col-span-3" type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
          </>
        )}
        <label className="text-right text-slate-600">Inner key</label>
        <input className="col-span-3 rounded border border-slate-300 bg-white p-2 text-slate-900" value={innerKey} onChange={(e) => setInnerKey(e.target.value)} placeholder={`a-z${takenKeys.length ? `, taken: ${takenKeys.join(',')}` : ''}`} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" onClick={onCancel}>Cancel</button>
        <button
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => onSave({ type, text, ignore, innerKey })}
        >
          Save
        </button>
      </div>
    </div>
  );
}
