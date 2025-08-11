import { labelForKey } from '../../utils/keys';
import { Button, Tooltip } from '@heroui/react';
import type { ReactNode } from 'react';

export function KeyTile({
  code,
  state,
  onClick,
  onToggleLock,
  tooltipContent,
  tooltipDelay,
}: {
  code: string;
  state: 'sublayer' | 'custom' | 'available' | 'thirdparty' | 'locked';
  onClick?: () => void;
  onToggleLock?: () => void;
  tooltipContent?: ReactNode;
  tooltipDelay?: number;
}) {
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
  return (
    <div className="relative inline-flex items-center">
      <Tooltip content={tooltipContent ?? tooltip} placement="top" delay={tooltipDelay ?? 0}>
        <Button
          size="sm"
          variant="solid"
          color={color}
          isDisabled={disabled}
          onPress={onClick}
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
