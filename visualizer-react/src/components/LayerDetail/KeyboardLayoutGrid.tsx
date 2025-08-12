import {useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {KeyTile} from '../KeyboardGrid/KeyTile';
import {numberRow, topRow, homeRow, bottomRow} from '../../utils/keys';
import type {Command} from '../../types';
import { useStore } from '../../state/store';
import { diffConfigsDetailed, type DetailedDiff } from '../../utils/diff';

export function KeyboardLayoutGrid(props: {
  baseKey?: string | null;
  sublayerCommands?: Record<string, Command>;
  tooltipByKey: Record<string, ReactNode>;
  keyHandlers: Record<string, (() => void) | undefined>;
}) {
  const {baseKey, sublayerCommands, tooltipByKey, keyHandlers} = props;
  const lastSavedConfig = useStore((s) => s.lastSavedConfig);
  const config = useStore((s) => s.config);

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

  const rows = useMemo(() => [numberRow, topRow, homeRow, bottomRow] as string[][], []);
  const gap = useMemo(() => Math.min(14, Math.max(8, Math.round(containerWidth / 140))), [containerWidth]);
  const keySize = useMemo(() => {
    if (!containerWidth) return 34;
    const offsets = [0, 0.5, 1, 1.5];
    const candidates = rows.map((row, i) => {
      const len = row.length;
      const offset = offsets[i] ?? 0;
      return (containerWidth - (len - 1) * gap) / (len + offset);
    });
    const size = Math.min(...candidates);
    return Math.max(24, Math.min(72, size));
  }, [containerWidth, rows, gap]);

  // Build inner-key dirty map for the current sublayer so we can show +/-/~/↔ badges
  const dirtyByInnerKey = useMemo(() => {
    const out: Record<string, 'add' | 'remove' | 'change' | 'move'> = {};
    if (!baseKey || !config) return out;
    const det: DetailedDiff = diffConfigsDetailed(lastSavedConfig, config);

    // If the entire sublayer is new, mark existing inner keys as added
    if (det.layersAdded.includes(baseKey)) {
      for (const k of Object.keys(sublayerCommands || {})) out[k] = 'add';
    }

    const entry = det.changedLayers.find((e) => e.key === baseKey && (e as any).type === 'sublayer') as Extract<
      DetailedDiff['changedLayers'][number],
      { type: 'sublayer'; sublayer: any }
    > | undefined;
    if (!entry || entry.type !== 'sublayer') return out;
    for (const a of entry.sublayer.added) out[a.key] = 'add';
    for (const r of entry.sublayer.removed) out[r.key] = 'remove';
    for (const c of entry.sublayer.changed) out[c.key] = 'change';
    for (const m of entry.sublayer.moved) {
      out[m.from] = 'move';
      out[m.to] = 'move';
    }
    return out;
  }, [baseKey, lastSavedConfig, config, sublayerCommands]);

  return (
    <div
      ref={containerRef}
      className="space-y-3"
      style={{
        ['--key-size']: `${keySize}px`,
        ['--key-gap']: `${gap}px`,
        ['--key-font']: '0.38',
        ['--key-h']: '0.9',
      } as CSSProperties}
    >
      <div className="text-xs text-default-500">Click a key to add/edit an inner command for this sublayer.</div>
      {rows.map((row, idx) => (
        <div key={idx} className={"flex"} style={{ gap: 'var(--key-gap)', marginLeft: `calc(var(--key-size) * ${idx * 0.5})` }}>
          {row.map((code) => {
            const lower = code.toLowerCase();
            const isBase = baseKey?.toLowerCase() === lower;
            const existing = !!sublayerCommands?.[lower];
            const stateForKey: 'locked' | 'custom' | 'available' = isBase ? 'locked' : (existing ? 'custom' : 'available');
            const tooltipContent = tooltipByKey[lower];
            return (
              <KeyTile
                key={code}
                code={lower}
                state={stateForKey}
                dirty={dirtyByInnerKey[lower]}
                tooltipContent={tooltipContent}
                tooltipDelay={0}
                onClick={keyHandlers[lower]}
              />
            );
          })}
        </div>
      ))}
      {(!sublayerCommands || Object.keys(sublayerCommands).length === 0) && (
        <div className="text-sm text-slate-400">No inner commands yet — choose a key to add one.</div>
      )}
    </div>
  );
}
