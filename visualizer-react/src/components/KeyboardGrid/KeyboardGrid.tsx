import { useEffect, useMemo, useRef, useState, useCallback, memo, type CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { buildKeyClassification, selectData, selectConfig, selectBlockedKeys, selectFilter, selectDirtyByBaseKey } from '../../state/selectors';
import { KeyTile } from './KeyTile';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
// No extra UI elements here to keep layout clean

export function KeyboardGrid() {
  const data = useStore(selectData);
  const config = useStore(selectConfig);
  const blockedKeys = useStore(selectBlockedKeys);
  const filter = useStore(selectFilter);
  const setCurrentLayerKey = useStore((s) => s.setCurrentLayerKey);
  const dirtyByKey = useStore(selectDirtyByBaseKey);
  const { classify } = useMemo(() => buildKeyClassification(data, config, blockedKeys), [data, config, blockedKeys]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  usePerformanceMonitor('KeyboardGrid');

  // Measure container width to size keys to the box
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const first = entries[0];
      if (!first) return;
      const w = first.contentRect.width;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => [numberRow, topRow, homeRow, bottomRow], []);
  const offsets = useMemo(() => [0, 0.5, 1, 1.5], []);

  // Base gap between keys in px (responsive but bounded)
  const gap = Math.min(16, Math.max(10, Math.round(containerWidth / 100)));
  const keySize = useMemo(() => {
    if (!containerWidth) return 36; // sensible default
    // Compute size so EACH row (with its offset) fits; pick the smallest candidate
    const candidates = rows.map((r, i) => {
      const len = r.length;
      const off = offsets[i] ?? 0;
      return (containerWidth - (len - 1) * gap) / (len + off);
    });
    const size = Math.min(...candidates);
    // clamp key size
    return Math.max(28, Math.min(72, size));
  }, [containerWidth, rows, offsets, gap]);


  const passesFilter = useCallback((code: string) => {
    const cls = classify(code);
    const f = filter;
    if (f === 'all') return true;
    if (f === 'thirdparty') return cls === 'thirdparty';
    return cls === f;
  }, [classify, filter]);

  const filteredRows = useMemo(() => rows.map((r) => r.filter(passesFilter)), [rows, passesFilter]);

  // Dirty map now provided by selector; memoized globally

  const keyHandlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const r of rows) {
      for (const code of r) {
        map[code] = () => setCurrentLayerKey(code);
      }
    }
    return map;
  }, [setCurrentLayerKey, rows]);

  const Row = useMemo(() => memo(({ keys, offsetUnits }: { keys: string[]; offsetUnits: number }) => (
    <div
      className={"flex"}
      style={{
        gap: `var(--key-gap)`,
        marginLeft: `calc(var(--key-size) * ${offsetUnits})`,
      }}
    >
      {keys.map((code) => (
        <KeyTile
          key={code}
          code={code}
          state={classify(code)}
          {...(dirtyByKey[code] ? { dirty: dirtyByKey[code] } as const : {})}
          {...(keyHandlers[code] ? { onClick: keyHandlers[code] } : {})}
        />
      ))}
    </div>
  ), (prev, next) => prev.keys === next.keys && prev.offsetUnits === next.offsetUnits), [classify, keyHandlers, dirtyByKey]);

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      style={
        {
          // expose CSS vars so children can size
          ['--key-size']: `${keySize}px`,
          ['--key-gap']: `${gap}px`,
        } as CSSProperties
      }
    >
      {/* Offsets in key units so they scale with size */}
      <Row keys={filteredRows[0] ?? []} offsetUnits={0} />
      <Row keys={filteredRows[1] ?? []} offsetUnits={0.5} />
      <Row keys={filteredRows[2] ?? []} offsetUnits={1} />
      <Row keys={filteredRows[3] ?? []} offsetUnits={1.5} />
    </div>
  );
}
