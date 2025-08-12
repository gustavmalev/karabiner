import { labelForKey } from '../../utils/keys';
import { Button, Tooltip } from '@heroui/react';
import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';

type KeyTileProps = {
  code: string;
  state: 'sublayer' | 'custom' | 'available' | 'thirdparty' | 'locked';
  onClick?: () => void;
  onToggleLock?: () => void;
  tooltipContent?: ReactNode;
  tooltipDelay?: number;
};

function KeyTileImpl({
  code,
  state,
  onClick,
  onToggleLock,
  tooltipContent,
  tooltipDelay,
}: KeyTileProps) {
  const color: 'primary' | 'success' | 'warning' | 'default' | 'danger' =
    state === 'sublayer'
      ? 'primary'
      : state === 'custom'
      ? 'success'
      : state === 'thirdparty'
      ? 'warning'
      : state === 'locked'
      ? 'danger'
      : 'default';
  const disabled = state === 'locked';
  const textClass = color === 'default' ? 'text-black' : 'text-white';
  const friendlyState = state === 'custom' ? 'command' : state; // friendlier label than "custom"
  const tooltip = state === 'locked' ? `${labelForKey(code)} — base layer key (locked)` : `${labelForKey(code)} — ${friendlyState}`;
  const handlePress = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);
  const handleToggle = useCallback(() => {
    if (onToggleLock) onToggleLock();
  }, [onToggleLock]);
  return (
    <div className="relative inline-flex items-center">
      <Tooltip content={tooltipContent ?? tooltip} placement="top" delay={tooltipDelay ?? 0}>
        <Button
          size="sm"
          variant="solid"
          color={color}
          isDisabled={disabled}
          onPress={handlePress}
          className={`font-medium ${textClass} rounded-medium shadow-sm hover:shadow-md transition-shadow transition-transform will-change-transform hover:-translate-y-[1px]`}
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
      {state === 'locked' && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-background"
          aria-hidden="true"
        />
      )}
      {onToggleLock && (
        <Tooltip content="Toggle lock" placement="top">
          <Button
            size="sm"
            variant="solid"
            color="default"
            onPress={handleToggle}
            className="ml-1 text-black"
          >
            🔒
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

const areEqual = (prev: KeyTileProps, next: KeyTileProps) => {
  return (
    prev.code === next.code &&
    prev.state === next.state &&
    prev.tooltipDelay === next.tooltipDelay &&
    prev.onClick === next.onClick &&
    prev.onToggleLock === next.onToggleLock &&
    prev.tooltipContent === next.tooltipContent
  );
};

export const KeyTile = memo(KeyTileImpl, areEqual);
