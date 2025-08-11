import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { buildKeyClassification } from '../../state/selectors';
import { KeyTile } from './KeyTile';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';
// No extra UI elements here to keep layout clean

export function KeyboardGrid() {
  const data = useStore((s) => s.data);
  const config = useStore((s) => s.config);
  const blockedKeys = useStore((s) => s.blockedKeys);
  const filter = useStore((s) => s.filter);
  const setCurrentLayerKey = useStore((s) => s.setCurrentLayerKey);
  const { classify } = useMemo(() => buildKeyClassification(data, config, blockedKeys), [data, config, blockedKeys]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure container width to size keys to the box
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
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


  const passesFilter = (code: string) => {
    const cls = classify(code);
    const f = filter;
    if (f === 'all') return true;
    if (f === 'thirdparty') return cls === 'thirdparty';
    return cls === f;
  };

  const Row = ({ keys, offsetUnits }: { keys: string[]; offsetUnits: number }) => (
    <div
      className={"flex"}
      style={{
        gap: `var(--key-gap)`,
        marginLeft: `calc(var(--key-size) * ${offsetUnits})`,
      }}
    >
      {keys.filter(passesFilter).map((code) => (
        <KeyTile
          key={code}
          code={code}
          state={classify(code)}
          onClick={() => setCurrentLayerKey(code)}
        />
      ))}
    </div>
  );

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
      <Row keys={numberRow} offsetUnits={0} />
      <Row keys={topRow} offsetUnits={0.5} />
      <Row keys={homeRow} offsetUnits={1} />
      <Row keys={bottomRow} offsetUnits={1.5} />
    </div>
  );
}
