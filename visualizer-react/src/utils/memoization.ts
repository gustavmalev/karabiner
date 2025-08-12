// Shared memoization and comparison utilities
// Keep these React-agnostic except where explicitly noted

export function shallowEqual<T extends Record<string, any>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i]!;
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!Object.is((a as any)[k], (b as any)[k])) return false;
  }
  return true;
}

export function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (Object.is(a, b)) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

export function memoizeByRef<Args extends any[], R>(fn: (...args: Args) => R) {
  let lastArgs: Args | null = null;
  let lastResult: R | undefined;
  return (...args: Args): R => {
    if (lastArgs && args.length === lastArgs.length) {
      let same = true;
      for (let i = 0; i < args.length; i++) {
        if (!Object.is(args[i], lastArgs[i]!)) { same = false; break; }
      }
      if (same) return lastResult as R;
    }
    lastArgs = args;
    lastResult = fn(...args);
    return lastResult as R;
  };
}

// React-specific: comparator factory for React.memo to compare specific prop keys
export function propsAreEqualByKeys<K extends string>(...keys: K[]) {
  return (prev: Record<K, any>, next: Record<K, any>) => {
    for (const k of keys) if (!Object.is(prev[k], next[k])) return false;
    return true;
  };
}
