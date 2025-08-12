import {Autocomplete, AutocompleteItem, Avatar} from '@heroui/react';

export type AppItem = { id: string; label: string; iconUrl?: string; categoryLabel?: string };

export function AppCommandForm(props: {
  items: AppItem[];
  text: string;
  setText: (v: string) => void;
}) {
  const {items, text, setText} = props;
  const selected = items.find(a => a.label.toLowerCase() === (text || '').toLowerCase());
  return (
    <Autocomplete
      label="App"
      labelPlacement="outside"
      placeholder="Search installed apps"
      defaultItems={items}
      allowsCustomValue
      radius="sm"
      size="lg"
      isVirtualized
      itemHeight={56}
      maxListboxHeight={320}
      isClearable={false}
      inputValue={text}
      onInputChange={(val) => setText((val || '').trimStart())}
      onSelectionChange={(key) => {
        const id = String(key || '');
        const label = items.find(i => i.id === id)?.label || id;
        setText(label);
      }}
      startContent={selected?.iconUrl ? (
        <span className="inline-flex h-5 w-5 items-center justify-center shrink-0">
          <Avatar src={selected.iconUrl} radius="sm" className="h-5 w-5" />
        </span>
      ) : null}
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
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-default-500">Apps</div>
        ),
        itemClasses: {
          base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none text-default-500 transition-opacity px-2 py-1.5 data-[hover=true]:text-foreground data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
          wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
          selectedIcon: 'hidden',
        },
      }}
    >
      {(item) => (
        <AutocompleteItem key={item.id} textValue={item.label}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-h-[44px]">
              <Avatar
                src={item.iconUrl}
                name={item.label}
                size="sm"
                radius="sm"
                className="shrink-0 bg-transparent overflow-hidden h-5 w-5"
                imgProps={{ loading: 'lazy', decoding: 'async' }}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-small text-default-800">{item.label}</span>
                {item.categoryLabel ? (
                  <span className="text-tiny text-default-400">{item.categoryLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
