import type { Filter } from '../state/appState';
import { useAppState } from '../state/appState';

const filters: Filter[] = ['all', 'available', 'sublayer', 'custom', 'thirdparty'];

export function FilterBar() {
  const { state, dispatch } = useAppState();
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => dispatch({ type: 'setFilter', filter: f })}
          className={
            'inline-flex items-center rounded-md border px-3 py-1.5 text-sm ' +
            (state.filter === f ? 'border-slate-300 bg-slate-100' : 'border-slate-200 hover:bg-slate-50')
          }
        >
          {f}
        </button>
      ))}
    </div>
  );
}
