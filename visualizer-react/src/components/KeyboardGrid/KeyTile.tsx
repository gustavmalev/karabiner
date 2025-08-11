import { labelForKey } from '../../utils/keys';
import { Button, Kbd } from '@heroui/react';

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
  return (
    <div className="relative inline-flex items-center">
      <Button
        size="sm"
        variant={state === 'available' ? 'bordered' : 'solid'}
        color={color}
        isDisabled={disabled}
        onPress={onClick}
        title={code}
        className="font-medium"
        style={{
          // Prefer CSS var set by parent; fallback to previous clamp sizes
          width: 'var(--key-size, clamp(2.4rem, 3.2vw, 3.8rem))',
          minWidth: 'var(--key-size, clamp(2.4rem, 3.2vw, 3.8rem))',
          height: 'calc(var(--key-size, 3rem) * var(--key-h, 0.85))',
          minHeight: 'calc(var(--key-size, 3rem) * var(--key-h, 0.85))',
        }}
      >
        <Kbd style={{ fontSize: 'calc(var(--key-size, 3rem) * var(--key-font, 0.35))' }}>{labelForKey(code)}</Kbd>
      </Button>
      {onToggleLock && (
        <Button
          size="sm"
          variant="light"
          onPress={onToggleLock}
          className="ml-1"
          title="Toggle lock"
        >
          🔒
        </Button>
      )}
    </div>
  );
}
