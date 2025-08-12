import React, { useMemo, useState } from 'react';
import { Button, Navbar, NavbarBrand, NavbarContent, Tooltip } from '@heroui/react';
import { overlayMotion } from '../ui/motion';
import { useStore } from '../state/store';
import { saveConfig, getConfig } from '../api/client';
import { ImportDialog } from '../features/import/ImportDialog';
import { FileMenu } from './menus/FileMenu';
import { HistoryMenu } from './menus/HistoryMenu';
import { SettingsDialog } from './SettingsDialog';
import { diffConfigsDetailed, type DetailedDiff } from '../utils/diff';
import { CommandPreview } from './CommandPreview';
import { Modal } from './Modals/Modal';

export function Layout({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const config = useStore((s) => s.config);
  const isDirty = useStore((s) => s.isDirty);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const lastSavedConfig = useStore((s) => s.lastSavedConfig);
  const markSaved = useStore((s) => s.markSaved);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const revertToSaved = useStore((s) => s.revertToSaved);
  const resumeDialogOpen = useStore((s) => s.resumeDialogOpen);
  const closeResumeDialog = useStore((s) => s.closeResumeDialog);
  const historyCount = useStore((s) => s.history.length);
  const futureCount = useStore((s) => s.future.length);
  const importOpen = useStore((s) => s.importDialogOpen);
  const closeImportDialog = useStore((s) => s.closeImportDialog);
  const showUndoRedo = useStore((s) => s.settings.showUndoRedo);

  async function onSave() {
    if (!config) return;
    try {
      // Optimistic: clear dirty indicators immediately
      markSaved();
      await saveConfig(config);
      // Background sync with server-applied config (in case of normalization)
      try {
        const serverConfig = await getConfig();
        useStore.setState({ lastSavedConfig: serverConfig, isDirty: false, lastSavedAt: Date.now() });
      } catch {}
      if (resumeDialogOpen) closeResumeDialog();
    } catch (e) {
      console.error('Failed to save config', e);
      // Revert optimistic clear if save failed
      useStore.setState({ isDirty: true });
      // TODO: add toast later
    }
  }

  function timeAgo(ts: number | null): string {
    if (!ts) return '';
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  const detailed = useMemo(() => {
    if (!lastSavedConfig || !config) return null;
    return diffConfigsDetailed(lastSavedConfig, config);
  }, [lastSavedConfig, config]);

  const detailedCounts = useMemo(() => {
    if (!detailed) return null;
    let innerAdded = 0, innerRemoved = 0, innerChanged = 0, moved = 0, typeChanged = 0;
    for (const e of detailed.changedLayers) {
      if (e.type === 'sublayer') {
        innerAdded += e.sublayer.added.length;
        innerRemoved += e.sublayer.removed.length;
        innerChanged += e.sublayer.changed.length;
        moved += e.sublayer.moved.length;
      }
      if (e.typeChanged) typeChanged++;
    }
    return {
      baseAdded: detailed.layersAdded.length,
      baseRemoved: detailed.layersRemoved.length,
      baseChanged: detailed.layersChanged.length,
      innerAdded,
      innerRemoved,
      innerChanged,
      moved,
      typeChanged,
    };
  }, [detailed]);

  const DiffTooltip = (
    <div className="text-xs max-w-[320px]">
      <div className="font-semibold mb-1">Apply to Karabiner</div>
      {isDirty ? (
        <div className="space-y-2">
          {/* Compact list of added/removed/changed base keys */}
          {detailed && detailed.layersAdded.length > 0 && (
            <div><span className="font-medium">Added keys:</span> {detailed.layersAdded.slice(0,6).join(', ')}{detailed.layersAdded.length > 6 ? ` +${detailed.layersAdded.length - 6}` : ''}</div>
          )}
          {detailed && detailed.layersRemoved.length > 0 && (
            <div><span className="font-medium">Removed keys:</span> {detailed.layersRemoved.slice(0,6).join(', ')}{detailed.layersRemoved.length > 6 ? ` +${detailed.layersRemoved.length - 6}` : ''}</div>
          )}
          {detailed && detailed.layersChanged.length > 0 && (
            <div><span className="font-medium">Changed keys:</span> {detailed.layersChanged.slice(0,6).join(', ')}{detailed.layersChanged.length > 6 ? ` +${detailed.layersChanged.length - 6}` : ''}</div>
          )}
          {/* Always show a numeric summary so command edits are visible */}
          {detailedCounts && (
            <div className="text-[11px] text-default-500">
              <span>Summary: </span>
              <span>{detailedCounts.baseAdded} added</span>
              <span> · {detailedCounts.baseRemoved} removed</span>
              <span> · {detailedCounts.baseChanged} changed</span>
              {(detailedCounts.innerAdded + detailedCounts.innerRemoved + detailedCounts.innerChanged + detailedCounts.moved) > 0 && (
                <span>
                  {' '}· inner: +{detailedCounts.innerAdded}/-{detailedCounts.innerRemoved}/~{detailedCounts.innerChanged}
                  {detailedCounts.moved ? `, ${detailedCounts.moved} moved` : ''}
                </span>
              )}
              {detailedCounts.typeChanged ? <span> · {detailedCounts.typeChanged} type changes</span> : null}
            </div>
          )}
          {/* Detailed preview for first few changed layers, matching LayerDetail style */}
          {detailed && (
            (() => {
              const det = detailed;
              const toShow = det.changedLayers.slice(0, 3);
              if (toShow.length === 0) return null;
              return (
                <div className="space-y-2">
                  {toShow.map((entry) => (
                    <div key={entry.key} className="rounded bg-content1 border p-2">
                      <div className="mb-1 text-[11px] text-default-500">{entry.key}</div>
                      {entry.typeChanged ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[11px] text-default-500">type</div>
                          <span className="rounded bg-default-100 text-default-700 text-[10px] px-1.5 py-0.5">{(entry as any).from?.type || 'none'}</span>
                          <div className="text-[11px] text-default-500">→</div>
                          <span className="rounded bg-default-100 text-default-700 text-[10px] px-1.5 py-0.5">{(entry as any).to?.type || 'none'}</span>
                          {((entry as any).from?.type === 'command' || (entry as any).to?.type === 'command') && (
                            <>
                              <div className="text-[11px] text-default-500">from</div>
                              {((entry as any).from?.type === 'command') ? <CommandPreview command={(entry as any).from.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                              <div className="text-[11px] text-default-500">to</div>
                              {((entry as any).to?.type === 'command') ? <CommandPreview command={(entry as any).to.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                            </>
                          )}
                        </div>
                      ) : entry.type === 'command' ? (
                        <div className="flex items-center gap-2">
                          <div className="text-[11px] text-default-500">from</div>
                          {entry.from && entry.from.type === 'command' ? <CommandPreview command={entry.from.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                          <div className="text-[11px] text-default-500">to</div>
                          {entry.to && entry.to.type === 'command' ? <CommandPreview command={entry.to.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {entry.sublayer.added.slice(0,2).map((i) => (
                            <div key={`add-${entry.key}-${i.key}`} className="flex items-center gap-2">
                              <span className="rounded bg-success-100 text-success-700 text-[10px] px-1.5 py-0.5">+ {i.key}</span>
                              <CommandPreview command={i.to} />
                            </div>
                          ))}
                          {entry.sublayer.removed.slice(0,2).map((i) => (
                            <div key={`rem-${entry.key}-${i.key}`} className="flex items-center gap-2">
                              <span className="rounded bg-danger-100 text-danger-700 text-[10px] px-1.5 py-0.5">- {i.key}</span>
                              <CommandPreview command={i.from} />
                            </div>
                          ))}
                          {entry.sublayer.changed.slice(0,1).map((i) => (
                            <div key={`chg-${entry.key}-${i.key}`} className="flex items-center gap-2">
                              <span className="rounded bg-warning-100 text-warning-700 text-[10px] px-1.5 py-0.5">{i.key}</span>
                              <CommandPreview command={i.from} />
                              <span className="text-[11px] text-default-500">to</span>
                              <CommandPreview command={i.to} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {det.changedLayers.length > 3 && (
                    <div className="text-default-500 text-[11px]">+{det.changedLayers.length - 3} more changed keys…</div>
                  )}
                </div>
              );
            })()
          )}
          <div className="text-default-500 mt-1">This will write rules.ts, build karabiner.json and apply it.</div>
        </div>
      ) : (
        <div>No unapplied changes</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen light bg-background text-foreground">
      <Navbar maxWidth="2xl" isBordered>
        <NavbarBrand>
          <h1
            className="text-base font-semibold cursor-pointer select-none"
            title="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            Visualizer
          </h1>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          <HistoryMenu />
          <FileMenu />
          {showUndoRedo && historyCount > 0 && (
            <Tooltip content="Undo (Cmd/Ctrl+Z)" placement="bottom" motionProps={overlayMotion}>
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => undo()}>
                  <span>Undo</span>
                  {historyCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-default-200 text-foreground/80 text-[10px] h-4 min-w-4 px-1">{historyCount}</span>
                  )}
                </Button>
              </div>
            </Tooltip>
          )}
          {showUndoRedo && futureCount > 0 && (
            <Tooltip content="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)" placement="bottom" motionProps={overlayMotion}>
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => redo()}>
                  <span>Redo</span>
                  {futureCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-default-200 text-foreground/80 text-[10px] h-4 min-w-4 px-1">{futureCount}</span>
                  )}
                </Button>
              </div>
            </Tooltip>
          )}
          <div className="hidden sm:block text-xs text-default-500 mr-2 select-none">
            {isDirty ? 'Unapplied changes' : (lastSavedAt ? `Applied ${timeAgo(lastSavedAt)}` : '')}
          </div>
          <Tooltip content={DiffTooltip} placement="bottom" motionProps={overlayMotion}>
            <div className="inline-block">
              <Button variant="solid" color="primary" isDisabled={!isDirty} onPress={onSave}>
                Apply
              </Button>
            </div>
          </Tooltip>
          {isDirty && (
            <Tooltip content="Revert to last saved" placement="bottom" motionProps={overlayMotion}>
              <div className="inline-block">
                <Button size="sm" variant="flat" onPress={() => revertToSaved()}>Cancel</Button>
              </div>
            </Tooltip>
          )}
        </NavbarContent>
      </Navbar>
      <main className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</main>
      <ImportDialog open={importOpen} onClose={() => closeImportDialog()} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* Resume changes dialog on startup */}
      <Modal open={!!resumeDialogOpen} onClose={() => closeResumeDialog()} isDismissable={false} isKeyboardDismissDisabled hideCloseButton size="md">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Unapplied changes found</h3>
            <p className="text-sm text-default-600">We detected local edits that were not applied. You can restore them or discard and revert to your last applied Karabiner config.</p>
          </div>
          {lastSavedConfig && config ? (
            (() => {
              const det: DetailedDiff = diffConfigsDetailed(lastSavedConfig, config);
              const hasAny = det.layersAdded.length || det.layersRemoved.length || det.layersChanged.length;
              return (
                <div className="space-y-3 max-h-[50vh] overflow-auto pr-1">
                  {/* Summary counts to ensure edits are always reflected */}
                  {det.changedLayers.length > 0 && (
                    <div className="text-[11px] text-default-500">
                      {(() => {
                        let innerA = 0, innerR = 0, innerC = 0, mv = 0, typeC = 0;
                        for (const e of det.changedLayers) {
                          if (e.type === 'sublayer') {
                            innerA += e.sublayer.added.length;
                            innerR += e.sublayer.removed.length;
                            innerC += e.sublayer.changed.length;
                            mv += e.sublayer.moved.length;
                          }
                          if (e.typeChanged) typeC++;
                        }
                        return `Summary: ${det.layersAdded.length} added · ${det.layersRemoved.length} removed · ${det.layersChanged.length} changed` +
                          ((innerA+innerR+innerC+mv) ? ` · inner: +${innerA}/-${innerR}/~${innerC}${mv?`, ${mv} moved`:''}` : '') +
                          (typeC ? ` · ${typeC} type changes` : '');
                      })()}
                    </div>
                  )}
                  {det.layersAdded.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-success-700">Added keys</div>
                      <div className="text-xs text-default-600">{det.layersAdded.join(', ')}</div>
                    </div>
                  )}
                  {det.layersRemoved.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-danger-700">Removed keys</div>
                      <div className="text-xs text-default-600">{det.layersRemoved.join(', ')}</div>
                    </div>
                  )}
                  {det.changedLayers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-warning-700">Changed</div>
                      {det.changedLayers.slice(0, 10).map((entry) => (
                        <div key={entry.key} className="rounded border bg-content1 p-2">
                          <div className="mb-1 text-xs text-default-500">{entry.key}</div>
                          {entry.typeChanged ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-default-500">type</span>
                              <span className="rounded bg-default-100 text-default-700 text-[10px] px-1.5 py-0.5">{(entry as any).from?.type || 'none'}</span>
                              <span className="text-[11px] text-default-500">→</span>
                              <span className="rounded bg-default-100 text-default-700 text-[10px] px-1.5 py-0.5">{(entry as any).to?.type || 'none'}</span>
                              {((entry as any).from?.type === 'command' || (entry as any).to?.type === 'command') && (
                                <>
                                  <span className="text-[11px] text-default-500">from</span>
                                  {((entry as any).from?.type === 'command') ? <CommandPreview command={(entry as any).from.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                                  <span className="text-[11px] text-default-500">to</span>
                                  {((entry as any).to?.type === 'command') ? <CommandPreview command={(entry as any).to.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                                </>
                              )}
                            </div>
                          ) : entry.type === 'command' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-default-500">from</span>
                              {entry.from && entry.from.type === 'command' ? <CommandPreview command={entry.from.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                              <span className="text-[11px] text-default-500">to</span>
                              {entry.to && entry.to.type === 'command' ? <CommandPreview command={entry.to.command} /> : <span className="text-default-500 text-[11px] italic">none</span>}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {entry.sublayer.added.map((i) => (
                                <div key={`add-${entry.key}-${i.key}`} className="flex items-center gap-2">
                                  <span className="rounded bg-success-100 text-success-700 text-[10px] px-1.5 py-0.5">+ {i.key}</span>
                                  <CommandPreview command={i.to} />
                                </div>
                              ))}
                              {entry.sublayer.removed.map((i) => (
                                <div key={`rem-${entry.key}-${i.key}`} className="flex items-center gap-2">
                                  <span className="rounded bg-danger-100 text-danger-700 text-[10px] px-1.5 py-0.5">- {i.key}</span>
                                  <CommandPreview command={i.from} />
                                </div>
                              ))}
                              {entry.sublayer.changed.map((i) => (
                                <div key={`chg-${entry.key}-${i.key}`} className="flex items-center gap-2">
                                  <span className="rounded bg-warning-100 text-warning-700 text-[10px] px-1.5 py-0.5">{i.key}</span>
                                  <CommandPreview command={i.from} />
                                  <span className="text-[11px] text-default-500">to</span>
                                  <CommandPreview command={i.to} />
                                </div>
                              ))}
                              {entry.sublayer.moved.map((m) => (
                                <div key={`mov-${entry.key}-${m.from}-${m.to}`} className="flex items-center gap-2">
                                  <span className="rounded bg-default-100 text-default-600 text-[10px] px-1.5 py-0.5">{m.from} → {m.to}</span>
                                  <CommandPreview command={m.command} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {det.changedLayers.length > 10 && (
                        <div className="text-default-500 text-[11px]">+{det.changedLayers.length - 10} more…</div>
                      )}
                    </div>
                  )}
                  {!hasAny && (<div className="text-xs text-default-500">No differences detected.</div>)}
                </div>
              );
            })()
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="flat" onPress={() => { closeResumeDialog(); }}>Keep local edits</Button>
            <Button color="danger" variant="solid" onPress={() => { revertToSaved(); closeResumeDialog(); }}>Discard local edits</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
