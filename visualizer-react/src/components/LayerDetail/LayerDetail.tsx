import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { selectCurrentLayer, makeSelectBlockedForKey, makeSelectInnerCommands } from '../../state/selectors';
import { buildCommandFrom, parseTypeTextFrom } from '../../utils/commands';
import type { Command, Layer } from '../../types';
import { Modal } from '../Modals/Modal';
import { Button, Switch, Card, CardBody, Tooltip } from '@heroui/react';
import { overlayMotion } from '../../ui/motion';
import { KeyboardLayoutGrid } from './KeyboardLayoutGrid';
import { useKeySelection } from '../../hooks/useKeySelection';
import type { CmdType } from '../../hooks/useCommandForm';
import { CommandForm } from './CommandForm';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';
import { CommandPreview } from '../CommandPreview';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';

// CmdType moved to hooks/useCommandForm for single source of truth

export function LayerDetail() {
  const config = useStore((s) => s.config);
  const key = useStore((s) => s.currentLayerKey);
  const setConfig = useStore((s) => s.setConfig);
  const toggleBlocked = useStore((s) => s.toggleBlocked);
  const layer = useStore(selectCurrentLayer);
  const blockedForKey = useStore(useMemo(() => makeSelectBlockedForKey(key), [key]));
  const sublayerCommandsSel = useStore(useMemo(() => makeSelectInnerCommands(key), [key]));
  const [showCmdModal, setShowCmdModal] = useState<
    | null
    | { mode: 'add' | 'edit'; cmdKey?: string; prefill?: string; kind?: 'sublayer' | 'key' }
  >(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  usePerformanceMonitor('LayerDetail');

  const rows = useMemo(() => [numberRow, topRow, homeRow, bottomRow] as string[][], []);

  const onAddLayer = () => {
    if (!key) return;
    const prevLayers = (config?.layers || {}) as Record<string, Layer>;
    const newLayers: Record<string, Layer> = {
      ...prevLayers,
      [key]: { type: 'sublayer', commands: {} as Record<string, Command> },
    };
    setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
    // Clear blocked state when a layer is created for this key
    if (key && blockedForKey) toggleBlocked(key);
  };

  const onDeleteLayer = () => {
    if (!key || !config) return;
    const newLayers = { ...config.layers };
    delete newLayers[key];
    setConfig({ ...config, layers: newLayers });
  };

  const onSaveCommand = (values: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => {
    if (!key) return;
    const extra: { ignore?: boolean } = {};
    if (values.ignore !== undefined) extra.ignore = values.ignore;
    const cmd: Command = buildCommandFrom(values.type, values.text, extra);
    const prev: Record<string, Layer> = (config?.layers || {}) as Record<string, Layer>;
    const isKeyLevel = showCmdModal?.kind === 'key' || (prev[key] && (prev[key] as Layer).type === 'command');
    if (isKeyLevel) {
      const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'command', command: cmd } as Layer };
      setConfig({ ...(config || { layers: {} as Record<string, Layer> }), layers: newLayers });
      // Clear blocked state when a direct command is created for this key
      if (key && blockedForKey) toggleBlocked(key);
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
      if (key && blockedForKey) toggleBlocked(key);
    }
    setShowCmdModal(null);
  };

  const sublayerCommands: Record<string, Command> | undefined = useMemo(() => {
    if (!layer || layer.type !== 'sublayer') return undefined;
    return sublayerCommandsSel;
  }, [layer, sublayerCommandsSel]);

  const takenKeysMemo = useMemo(() => {
    return [...Object.keys(sublayerCommands || {}), ...(key ? [key] : [])];
  }, [sublayerCommands, key]);

  const tooltipByKey = useMemo(() => {
    const map: Record<string, ReactNode> = {};
    if (sublayerCommands) {
      for (const [k, cmd] of Object.entries(sublayerCommands)) {
        map[k] = <CommandPreview command={cmd} />;
      }
    }
    return map;
  }, [sublayerCommands]);

  const { keyHandlers } = useKeySelection({ rows, baseKey: key, ...(sublayerCommands ? { sublayerCommands } : {}), setShowCmdModal });

  const onDeleteInner = (ik: string) => {
    if (!key || !config || !sublayerCommands) return;
    const prev: Record<string, Layer> = config.layers;
    const base = prev[key];
    if (!base || base.type !== 'sublayer') return;
    const commands = { ...base.commands };
    delete commands[ik];
    // If no commands remain, remove the entire layer
    if (Object.keys(commands).length === 0) {
      const newLayers: Record<string, Layer> = { ...prev };
      delete newLayers[key];
      setConfig({ ...config, layers: newLayers });
    } else {
      const newLayers: Record<string, Layer> = { ...prev, [key]: { type: 'sublayer', commands } };
      setConfig({ ...config, layers: newLayers });
    }
  };

  // Build CommandForm initial value. Only pass the prop when defined to satisfy exactOptionalPropertyTypes.
  const cmdFormInitial = useMemo(() => {
    if (!showCmdModal) return undefined;
    if (showCmdModal.mode === 'add') {
      if (showCmdModal.kind === 'key') {
        return { type: 'app' as CmdType, text: '', ignore: false };
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
    if (showCmdModal.mode === 'edit' && showCmdModal.kind === 'key' && key) {
      const node = config?.layers?.[key];
      if (node && (node as Layer).type === 'command') {
        const parsed = parseTypeTextFrom((node as Extract<Layer, { type: 'command' }>).command as Command);
        return {
          type: parsed.type as CmdType,
          text: parsed.text || '',
          ignore: parsed.type === 'raycast' ? (parsed.ignoreRaycast ?? false) : false,
        };
      }
    }
    return undefined;
  }, [showCmdModal, sublayerCommands, key, config]);

  return (
    <Card className="border">
      <CardBody className="min-h-40 overflow-visible !p-2 md:!p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Layer Detail</h2>
            {key && !layer && (
              <Tooltip content="Mark this base key as blocked by a third-party app. You won't be able to add or edit commands while blocked." placement="bottom" motionProps={overlayMotion}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">Blocked (3rd-party)</span>
                  <Switch size="sm" isSelected={!!(key && blockedForKey)} onValueChange={() => key && toggleBlocked(key)} />
                </div>
              </Tooltip>
            )}
          </div>
          {key && !layer && (
            <div className="flex items-center gap-2">
              <Tooltip content="Create a sublayer for this key" placement="left" motionProps={overlayMotion}>
                <Button size="sm" variant="solid" color="primary" onPress={onAddLayer} isDisabled={!!(key && blockedForKey)}>
                  Add Layer
                </Button>
              </Tooltip>
              <Tooltip content="Bind a command directly to this key (no sublayer)" placement="left" motionProps={overlayMotion}>
                <Button size="sm" variant="flat" color="secondary" onPress={() => setShowCmdModal({ mode: 'add', kind: 'key' })} isDisabled={!!(key && blockedForKey)}>
                  Add Key
                </Button>
              </Tooltip>
            </div>
          )}
          {key && layer && (
            <div className="flex items-center gap-2">
              {layer.type === 'sublayer' ? (
                <>
                  <Tooltip content="Add a new inner command with AI suggestion" placement="left" motionProps={overlayMotion}>
                    <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'add' })}>Add with AI</Button>
                  </Tooltip>
                  <Tooltip content="Delete this sublayer" placement="left" motionProps={overlayMotion}>
                    <Button size="sm" variant="solid" color="danger" onPress={() => setConfirmDeleteOpen(true)}>Delete Layer</Button>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip content="Edit the command bound to this key" placement="left" motionProps={overlayMotion}>
                    <Button size="sm" variant="solid" color="secondary" onPress={() => setShowCmdModal({ mode: 'edit', kind: 'key' })}>Edit Command</Button>
                  </Tooltip>
                  <Tooltip content="Remove this key binding" placement="left" motionProps={overlayMotion}>
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
            {blockedForKey ? (
              <span>This key is marked as blocked. Unblock it to add a layer or a direct command.</span>
            ) : (
              <span>No config for {key}.</span>
            )}
          </div>
        )}
        {key && layer && layer.type === 'sublayer' && (
          <KeyboardLayoutGrid
            baseKey={key}
            {...(sublayerCommands ? { sublayerCommands } : {})}
            tooltipByKey={tooltipByKey}
            keyHandlers={keyHandlers}
          />
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

        <Modal open={!!showCmdModal} onClose={() => setShowCmdModal(null)} isDismissable={false} isKeyboardDismissDisabled hideCloseButton>
          <CommandForm
            onCancel={() => setShowCmdModal(null)}
            onSave={(v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => {
              if (showCmdModal?.mode === 'edit' && showCmdModal.cmdKey && v.innerKey !== showCmdModal.cmdKey) {
                // remove old key when renaming
                onDeleteInner(showCmdModal.cmdKey);
              }
              onSaveCommand(v);
            }}
            takenKeys={takenKeysMemo}
            baseKey={key}
            {...(cmdFormInitial ? { initial: cmdFormInitial } : {})}
            mode={showCmdModal?.mode || 'add'}
            isKeyLevel={showCmdModal?.kind === 'key'}
            isBlocked={!!(key && !layer && blockedForKey)}
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
          isDismissable
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

