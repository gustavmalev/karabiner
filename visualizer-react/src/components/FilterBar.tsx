import type { Filter } from '../state/appState';
import { useAppState } from '../state/appState';
import { Tabs, Tab } from '@heroui/react';

const filters: Filter[] = ['all', 'available', 'sublayer', 'custom', 'thirdparty'];

export function FilterBar() {
  const { state, dispatch } = useAppState();
  return (
    <Tabs
      aria-label="Filters"
      selectedKey={state.filter}
      onSelectionChange={(key) => dispatch({ type: 'setFilter', filter: String(key) as Filter })}
      variant="underlined"
      color="primary"
      size="sm"
    >
      {filters.map((f) => (
        <Tab key={f} title={f} />
      ))}
    </Tabs>
  );
}
