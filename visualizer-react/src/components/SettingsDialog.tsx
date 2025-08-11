import { Switch, Button } from '@heroui/react';
import { Modal } from './Modals/Modal';
import { useStore } from '../state/store';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Settings</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Show Undo/Redo buttons</div>
            <div className="text-xs text-default-500">Hides the toolbar Undo/Redo</div>
          </div>
          <Switch
            isSelected={!!settings.showUndoRedo}
            onValueChange={(v) => setSettings({ showUndoRedo: v })}
            aria-label="Show Undo/Redo buttons"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="flat" onPress={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
