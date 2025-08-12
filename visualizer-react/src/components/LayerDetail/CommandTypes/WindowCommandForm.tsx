import {Autocomplete, AutocompleteItem} from '@heroui/react';

export type WindowItem = { id: string; label: string };

export function WindowCommandForm(props: {
  items: WindowItem[];
  query: string;
  setQuery: (v: string) => void;
  setText: (v: string) => void;
  getLabel: (id: string) => string;
}) {
  const {items, query, setQuery, setText, getLabel} = props;
  return (
    <Autocomplete
      label="Window"
      labelPlacement="outside"
      placeholder="Search window actions"
      defaultItems={items}
      allowsCustomValue={false}
      radius="sm"
      size="lg"
      isVirtualized
      itemHeight={36}
      maxListboxHeight={320}
      isClearable={false}
      inputValue={query}
      onInputChange={(val) => setQuery(val || '')}
      onSelectionChange={(key) => {
        const id = String(key || '');
        const label = items.find(i => i.id === id)?.label || getLabel(id);
        setText(id);
        setQuery(label);
      }}
      classNames={{
        base: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0',
        listbox: 'outline-none',
        listboxWrapper: 'outline-none ring-0 border-0',
        popoverContent: 'outline-none border-0 ring-0',
        endContentWrapper: 'hidden',
        clearButton: 'hidden',
        selectorButton: 'hidden',
      }}
      popoverProps={{
        offset: 8,
        classNames: {
          base: 'rounded-medium',
          content: 'p-1.5 border-0 bg-background',
        },
      }}
      listboxProps={{
        hideSelectedIcon: true,
        topContent: (
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-default-500">Window actions</div>
        ),
        itemClasses: {
          base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none text-default-500 transition-opacity px-2 py-1.5 data-[hover=true]:text-foreground data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
          wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
          selectedIcon: 'hidden',
        },
      }}
    >
      {(item) => (
        <AutocompleteItem key={item.id}>
          {item.label}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
