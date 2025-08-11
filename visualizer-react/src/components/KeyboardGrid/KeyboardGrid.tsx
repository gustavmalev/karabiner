import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state/appState';
import { KeyTile } from './KeyTile';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';
// No extra UI elements here to keep layout clean

export function KeyboardGrid() {
  const { state, dispatch } = useAppState();
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

  const sublayerByKey = new Set<string>(state.data?.base.sublayerKeys || []);
  const customByKey = new Set<string>((state.data?.base.customKeys || []).map((c) => c.key));
  const thirdPartyByKey = new Set<string>(state.data?.base.fallbackKeys || []);
  const availableByKey = new Set<string>();

  // Merge with current config
  const layers = state.config?.layers || {};
  Object.entries(layers).forEach(([key, layer]) => {
    if ((layer as any).type === 'sublayer') sublayerByKey.add(key);
    else customByKey.add(key);
  });

  const allKeys = [...numberRow, ...topRow, ...homeRow, ...bottomRow];
  allKeys.forEach((k) => {
    if (!sublayerByKey.has(k) && !customByKey.has(k) && !thirdPartyByKey.has(k)) {
      availableByKey.add(k);
    }
  });

  const classify = (code: string): 'sublayer' | 'custom' | 'available' | 'thirdparty' => {
    if (sublayerByKey.has(code)) return 'sublayer';
    if (customByKey.has(code)) return 'custom';
    if (thirdPartyByKey.has(code)) return 'thirdparty';
    if (availableByKey.has(code)) return 'available';
    return 'available';
  };

  const passesFilter = (code: string) => {
    const cls = classify(code);
    const f = state.filter;
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
          onClick={() => dispatch({ type: 'setCurrentLayerKey', key: code })}
        />
      ))}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      style={{
        // expose CSS vars so children can size
        ['--key-size' as any]: `${keySize}px`,
        ['--key-gap' as any]: `${gap}px`,
      }}
    >
      {/* Offsets in key units so they scale with size */}
      <Row keys={numberRow} offsetUnits={0} />
      <Row keys={topRow} offsetUnits={0.5} />
      <Row keys={homeRow} offsetUnits={1} />
      <Row keys={bottomRow} offsetUnits={1.5} />
    </div>
  );
}
