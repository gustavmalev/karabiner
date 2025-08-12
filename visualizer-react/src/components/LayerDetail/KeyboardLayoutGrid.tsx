import {useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {KeyTile} from '../KeyboardGrid/KeyTile';
import {numberRow, topRow, homeRow, bottomRow} from '../../utils/keys';
import type {Command} from '../../types';

export function KeyboardLayoutGrid(props: {
  baseKey?: string | null;
  sublayerCommands?: Record<string, Command>;
  tooltipByKey: Record<string, ReactNode>;
  keyHandlers: Record<string, (() => void) | undefined>;
}) {
  const {baseKey, sublayerCommands, tooltipByKey, keyHandlers} = props;

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
