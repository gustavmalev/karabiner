import { Button, Tooltip } from '@heroui/react';
import { useAppState } from '../../state/appState';
import { buildPersisted } from '../../state/persistence';
import { exportJson } from '../../state/persistence';

export function ExportButton() {
  const { state } = useAppState();
  const onExport = () => {
    if (!state.config) return;
    const p = buildPersisted({
      config: state.config,
      locks: state.locks,
      filter: state.filter,
      keyboardLayout: state.keyboardLayout,
      aiKey: state.aiKey,
    });
    exportJson(p);
  };
  return (
    <Tooltip content="Export layout JSON" placement="bottom">
      <div className="inline-block">
        <Button variant="flat" onPress={onExport} isDisabled={!state.config}>Export</Button>
      </div>
    </Tooltip>
  );
}
