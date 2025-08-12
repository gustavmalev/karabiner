import { Button, Tooltip } from '@heroui/react';
import { overlayMotion } from '../../ui/motion';
import { useStore } from '../../state/store';
import { buildPersisted, exportJson } from '../../state/persistence';

export function ExportButton() {
  const config = useStore((s) => s.config);
  const locks = useStore((s) => s.locks);
  const filter = useStore((s) => s.filter);
  const keyboardLayout = useStore((s) => s.keyboardLayout);
  const aiKey = useStore((s) => s.aiKey);
  const blockedKeys = useStore((s) => s.blockedKeys);
  const onExport = () => {
    if (!config) return;
    const p = buildPersisted({ config, locks, filter, keyboardLayout, aiKey, blockedKeys });
    exportJson(p);
  };
  return (
    <Tooltip content="Export layout JSON" placement="bottom" motionProps={overlayMotion}>
      <div className="inline-block">
        <Button variant="flat" onPress={onExport} isDisabled={!config}>Export</Button>
      </div>
    </Tooltip>
  );
}
