import type { Filter } from '../state/types';
import { useStore } from '../state/store';
import { Tabs, Tab } from '@heroui/react';

const filters: Filter[] = ['all', 'available', 'sublayer', 'custom', 'thirdparty'];

export function FilterBar() {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  return (
    <Tabs
      aria-label="Filters"
      selectedKey={filter}
      onSelectionChange={(key) => setFilter(String(key) as Filter)}
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
