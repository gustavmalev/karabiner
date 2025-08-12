// Lightweight shallow comparison and helpers for Zustand selectors
// Avoid importing react or the store here to prevent circular deps.

export function shallow<T extends Record<string, unknown>>(objA: T, objB: T): boolean {
  if (Object.is(objA, objB)) return true;
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;
  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i]!;
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!Object.is((objA as Record<string, unknown>)[k], (objB as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) {
    out[k] = obj[k];
  }
  return out;
}

// Simple stable deep equality via stable stringify
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const helper = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    const objV = v as Record<string, unknown>;
    if (seen.has(objV as object)) return undefined; // avoid cycles; treat as undefined
    seen.add(objV as object);
    if (Array.isArray(v)) return v.map((x) => helper(x));
    const obj: Record<string, unknown> = {};
    const keys = Object.keys(objV).sort();
    for (const k of keys) obj[k] = helper(objV[k]);
    return obj;
  };
  return JSON.stringify(helper(value));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return stableStringify(a) === stableStringify(b);
  } catch {
    return false;
  }
}
