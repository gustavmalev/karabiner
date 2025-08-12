import { useEffect, useRef } from 'react';

/**
 * Simple performance monitor to track render counts and durations per component instance.
 * Usage: const perf = usePerformanceMonitor('KeyboardGrid'); perf.mark('after-calc');
 */
export function usePerformanceMonitor(name: string, { log = false }: { log?: boolean } = {}) {
  const renders = useRef(0);
  const lastTS = useRef<number>(performance.now());

  renders.current += 1;

  const mark = (label: string) => {
    const now = performance.now();
    const diff = now - lastTS.current;
    lastTS.current = now;
    if (log) {
      // eslint-disable-next-line no-console
      console.debug(`[perf] ${name}#${renders.current} ${label} +${diff.toFixed(2)}ms`);
    }
  };

  useEffect(() => {
    const start = performance.now();
    return () => {
      const total = performance.now() - start;
      if (log) {
        // eslint-disable-next-line no-console
        console.debug(`[perf] ${name} unmount after ${renders.current} renders, life ${total.toFixed(2)}ms`);
      }
    };
  }, [log, name]);

  return { renders, mark } as const;
}
