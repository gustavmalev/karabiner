import { Button, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '../ui';
import { useStore } from '../../state/store';
import { buildPersisted, exportJson } from '../../state/persistence';

export function FileMenu() {
  const config = useStore((s) => s.config);
  const locks = useStore((s) => s.locks);
  const filter = useStore((s) => s.filter);
  const keyboardLayout = useStore((s) => s.keyboardLayout);
  const aiKey = useStore((s) => s.aiKey);
  const blockedKeys = useStore((s) => s.blockedKeys);
  const openImportDialog = useStore((s) => s.openImportDialog);

  const onExport = () => {
    if (!config) return;
    const p = buildPersisted({ config, locks, filter, keyboardLayout, aiKey, blockedKeys });
    exportJson(p);
  };

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button size="sm" variant="flat">File</Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="File menu" onAction={(key) => {
        if (key === 'import') openImportDialog();
        else if (key === 'export') onExport();
      }}>
        <DropdownItem key="import">Import…</DropdownItem>
        <DropdownItem key="export" isDisabled={!config}>Export</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
