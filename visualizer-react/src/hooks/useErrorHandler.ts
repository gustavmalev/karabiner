import { useCallback } from 'react';
import { useNotifications } from './useNotifications';

export type ErrorCategory = 'network' | 'validation' | 'server' | 'unknown';

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function categorizeError(err: unknown): ErrorCategory {
  const msg = getMessage(err).toLowerCase();
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'network';
  if (msg.includes('invalid') || msg.includes('validation')) return 'validation';
  if (msg.includes('server') || msg.includes(' 5')) return 'server';
  return 'unknown';
}

export function useErrorHandler() {
  const { notify } = useNotifications();

  const handle = useCallback((err: unknown, context?: string) => {
    const cat = categorizeError(err);
    const base = context ? `${context}: ` : '';
    const desc = getMessage(err);
    switch (cat) {
      case 'network':
        notify({ type: 'error', message: `${base}Network error`, description: 'Check your connection and try again.' });
        break;
      case 'validation':
        notify({ type: 'error', message: `${base}Invalid input`, description: desc || 'Please review your data.' });
        break;
      case 'server':
        notify({ type: 'error', message: `${base}Server error`, description: 'Please try again shortly.' });
        break;
      default:
        notify({ type: 'error', message: `${base}Unexpected error`, description: desc || 'Please try again.' });
        break;
    }
    // Also surface to console for debugging
    // eslint-disable-next-line no-console
    console.error(err);
  }, [notify]);

  return { handle } as const;
}
