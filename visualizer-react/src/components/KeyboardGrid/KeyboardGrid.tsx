import { useAppState } from '../../state/appState';
import { KeyTile } from './KeyTile';
import { numberRow, topRow, homeRow, bottomRow } from '../../utils/keys';

export function KeyboardGrid() {
  const { state, dispatch } = useAppState();

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

  const Row = ({ label, keys }: { label: string; keys: string[] }) => (
    <div className="grid grid-cols-12 items-start gap-2">
      <div className="col-span-12 flex items-center gap-2 text-xs text-slate-500">
        <div className="w-20 shrink-0 text-right pr-2 uppercase tracking-wide">{label}</div>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="col-span-12 flex flex-wrap gap-2">
        {keys.filter(passesFilter).map((code) => (
          <KeyTile
            key={code}
            code={code}
            state={classify(code)}
            onClick={() => dispatch({ type: 'setCurrentLayerKey', key: code })}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Row label="Number" keys={numberRow} />
      <Row label="Top" keys={topRow} />
      <Row label="Home" keys={homeRow} />
      <Row label="Bottom" keys={bottomRow} />
    </div>
  );
}
