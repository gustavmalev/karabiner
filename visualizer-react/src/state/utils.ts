// Lightweight shallow comparison and helpers for Zustand selectors
// Avoid importing react or the store here to prevent circular deps.

export function shallow<T extends Record<string, any>>(objA: T, objB: T): boolean {
  if (Object.is(objA, objB)) return true;
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;
  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i]!;
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!Object.is((objA as any)[k], (objB as any)[k])) return false;
  }
  return true;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) {
    (out as any)[k] = (obj as any)[k];
  }
  return out;
}

// Simple stable deep equality via stable stringify
function stableStringify(value: any): string {
  const seen = new WeakSet<any>();
  const helper = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return undefined; // avoid cycles; treat as undefined
    seen.add(v);
    if (Array.isArray(v)) return v.map((x) => helper(x));
    const obj: Record<string, any> = {};
    const keys = Object.keys(v).sort();
    for (const k of keys) obj[k] = helper(v[k]);
    return obj;
  };
  return JSON.stringify(helper(value));
}

export function deepEqual(a: any, b: any): boolean {
  try {
    return stableStringify(a) === stableStringify(b);
  } catch {
    return false;
  }
}
