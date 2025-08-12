import { Spinner } from '@heroui/react';
import type { CSSProperties } from 'react';

export function LoadingSpinner({ size = 'sm', label, style }: { size?: 'sm' | 'md' | 'lg'; label?: string; style?: CSSProperties }) {
  return (
    <div className="inline-flex items-center gap-2" style={style}>
      <Spinner size={size} color="primary" />
      {label ? <span className="text-xs text-default-600">{label}</span> : null}
    </div>
  );
}
