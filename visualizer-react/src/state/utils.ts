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
