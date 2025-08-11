import { labelForKey } from '../../utils/keys';

export function KeyTile({
  code,
  state,
  onClick,
  onToggleLock,
}: {
  code: string;
  state: 'sublayer' | 'custom' | 'available' | 'thirdparty' | 'locked';
  onClick?: () => void;
  onToggleLock?: () => void;
}) {
  const style = {
    sublayer: 'bg-blue-50 border-blue-200 text-blue-700',
    custom: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    available: 'bg-white border-slate-200 text-slate-900',
    thirdparty: 'bg-amber-50 border-amber-200 text-amber-800',
    locked: 'opacity-60 pointer-events-none bg-white border-slate-200 text-slate-500',
  }[state];
  return (
    <div className={`relative inline-flex items-center`}> 
      <button
        onClick={onClick}
        className={`rounded-md border px-3 py-2 text-sm font-medium ${style}`}
        title={code}
      >
        <span className="inline-flex items-center gap-2">
          {labelForKey(code)}
          {state !== 'available' && (
            <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {state}
            </span>
          )}
        </span>
      </button>
      {onToggleLock && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-xs hover:bg-slate-50"
          title="Toggle lock"
        >
          🔒
        </button>
      )}
    </div>
  );
}
