import { labelForKey } from '../../utils/keys';
import { Button, Tooltip } from '@heroui/react';

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
  const color: 'primary' | 'success' | 'warning' | 'default' =
    state === 'sublayer' ? 'primary' : state === 'custom' ? 'success' : state === 'thirdparty' ? 'warning' : 'default';
  const disabled = state === 'locked';
  const textClass = color === 'default' ? 'text-black' : 'text-white';
  const tooltip = `${labelForKey(code)} — ${state}`;
  return (
    <div className="relative inline-flex items-center">
      <Tooltip content={tooltip} placement="top">
        <Button
          size="sm"
          variant="solid"
          color={color}
          isDisabled={disabled}
          onPress={onClick}
          className={`font-medium ${textClass}`}
          style={{
            // Prefer CSS var set by parent; fallback to previous clamp sizes
            width: 'var(--key-size, clamp(2.4rem, 3.2vw, 3.8rem))',
            minWidth: 'var(--key-size, clamp(2.4rem, 3.2vw, 3.8rem))',
            height: 'calc(var(--key-size, 3rem) * var(--key-h, 0.85))',
            minHeight: 'calc(var(--key-size, 3rem) * var(--key-h, 0.85))',
          }}
        >
          <span style={{ fontSize: 'calc(var(--key-size, 3rem) * var(--key-font, 0.35))' }}>{labelForKey(code)}</span>
        </Button>
      </Tooltip>
      {onToggleLock && (
        <Tooltip content="Toggle lock" placement="top">
          <Button
            size="sm"
            variant="solid"
            color="default"
            onPress={onToggleLock}
            className="ml-1 text-black"
          >
            🔒
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
