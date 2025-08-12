import React, { useMemo } from 'react';
import { getCommandDescription } from '../../utils/commands';
import type { Config, KeyCode, Command } from '../../types';
import { diffConfigsDetailed, type DetailedDiff } from '../../utils/diff';

export function SnapshotDiff({ base, target }: { base: Config | null | undefined; target: Config | null | undefined }) {
  const diff: DetailedDiff | null = useMemo(() => {
    if (!target) return null;
    return diffConfigsDetailed(base || { layers: {} }, target);
  }, [base, target]);

  if (!diff) return <div className="text-sm text-default-500">No diff available.</div>;

  const Pill = ({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'success' | 'danger' | 'warning' | 'primary' }) => {
    const colorMap: Record<string, string> = {
      default: 'bg-default-100 text-default-700',
      success: 'bg-success-100 text-success-700',
      danger: 'bg-danger-100 text-danger-700',
      warning: 'bg-warning-100 text-warning-800',
      primary: 'bg-primary-100 text-primary-800',
    };
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorMap[color]}`}>{children}</span>
    );
  };

  const Row = ({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      {right ? <div className="text-xs text-default-500">{right}</div> : null}
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-default-600">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const CommandArrow = ({ from, to }: { from?: Command; to?: Command }) => (
    <div className="flex items-center gap-2">
      {from ? <code className="rounded bg-default-100 px-2 py-0.5 text-[12px]">{getCommandDescription(from) || '—'}</code> : <Pill color="success">new</Pill>}
      <span className="text-default-400">→</span>
      {to ? <code className="rounded bg-default-100 px-2 py-0.5 text-[12px]">{getCommandDescription(to) || '—'}</code> : <Pill color="danger">removed</Pill>}
    </div>
  );

  const Key = ({ k }: { k: KeyCode }) => (
    <span className="inline-flex items-center rounded bg-default-200 px-1.5 py-0.5 text-[11px] font-medium text-default-700">{k}</span>
  );

  return (
    <div className="space-y-4">
      {diff.layersAdded.length === 0 && diff.layersRemoved.length === 0 && diff.layersChanged.length === 0 ? (
        <div className="text-sm text-default-500">No changes.</div>
      ) : null}

      {diff.layersAdded.length > 0 && (
        <Section title="Layers added">
          {diff.layersAdded.map((k) => (
            <Row key={`add-${k}`} left={<><Pill color="success">added</Pill><Key k={k} /></>} />
          ))}
        </Section>
      )}

      {diff.layersRemoved.length > 0 && (
        <Section title="Layers removed">
          {diff.layersRemoved.map((k) => (
            <Row key={`rem-${k}`} left={<><Pill color="danger">removed</Pill><Key k={k} /></>} />
          ))}
        </Section>
      )}

      {diff.changedLayers.length > 0 && (
        <Section title="Layers changed">
          {diff.changedLayers.map((c) => (
            <div key={`chg-${c.key}`} className="rounded-medium border border-default-200 p-2">
              <div className="mb-2 flex items-center gap-2">
                <Key k={c.key} />
                {c.typeChanged ? <Pill color="warning">type changed</Pill> : <Pill color="primary">{c.type}</Pill>}
              </div>
              {c.typeChanged && (() => {
                const fromCmd = c.from?.type === 'command' ? c.from.command : undefined;
                const toCmd = c.to?.type === 'command' ? c.to.command : undefined;
                return (
                  <div className="mb-2">
                    <CommandArrow {...(fromCmd ? { from: fromCmd } : {})} {...(toCmd ? { to: toCmd } : {})} />
                  </div>
                );
              })()}
              {c.type === 'command' && !c.typeChanged && (() => {
                const fromCmd = c.from?.type === 'command' ? c.from.command : undefined;
                const toCmd = c.to?.type === 'command' ? c.to.command : undefined;
                return (
                  <div className="mb-1">
                    <CommandArrow {...(fromCmd ? { from: fromCmd } : {})} {...(toCmd ? { to: toCmd } : {})} />
                  </div>
                );
              })()}
              {c.type === 'sublayer' && c.sublayer && (
                <div className="space-y-2">
                  {c.sublayer.moved.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-default-600">Moved</div>
                      {c.sublayer.moved.map((m, i) => (
                        <Row key={`mv-${i}`} left={<><Pill color="primary">moved</Pill><Key k={m.from} /><span className="text-default-400">→</span><Key k={m.to} /><CommandArrow from={m.command} to={m.command} /></>} />
                      ))}
                    </div>
                  )}
                  {c.sublayer.added.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-default-600">Added</div>
                      {c.sublayer.added.map(({ key, to }) => (
                        <Row key={`addk-${key}`} left={<><Pill color="success">added</Pill><Key k={key} /><CommandArrow to={to} /></>} />
                      ))}
                    </div>
                  )}
                  {c.sublayer.removed.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-default-600">Removed</div>
                      {c.sublayer.removed.map(({ key, from }) => (
                        <Row key={`remk-${key}`} left={<><Pill color="danger">removed</Pill><Key k={key} /><CommandArrow from={from} /></>} />
                      ))}
                    </div>
                  )}
                  {c.sublayer.changed.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-default-600">Changed</div>
                      {c.sublayer.changed.map(({ key, from, to }) => (
                        <Row key={`chgk-${key}`} left={<><Pill color="warning">changed</Pill><Key k={key} /><CommandArrow from={from} to={to} /></>} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
