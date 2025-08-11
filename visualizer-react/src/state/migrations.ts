import { z } from 'zod';
import { SCHEMA_VERSION, zPersisted, type Persisted } from './schema';

// Map of migration steps from version n -> n+1
// Each function must be a pure transformation and safe to run exactly once.
const migrations: Record<number, (input: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 -> 2: introduce blockedKeys (default {})
  1: (s) => {
    const blocked = typeof (s as any).blockedKeys === 'object' && (s as any).blockedKeys !== null ? (s as any).blockedKeys : {};
    return { ...s, blockedKeys: blocked, schemaVersion: 2 } as Record<string, unknown>;
  },
  // 2 -> 3: add lastSavedAt (null) and snapshots ([])
  2: (s) => {
    const withDefaults = {
      ...s,
      lastSavedAt: null,
      snapshots: Array.isArray((s as any).snapshots) ? (s as any).snapshots : [],
      schemaVersion: 3,
    } as Record<string, unknown>;
    return withDefaults;
  },
  // 3 -> 4: add settings with showUndoRedo default true
  3: (s) => {
    const settings = typeof (s as any).settings === 'object' && (s as any).settings !== null
      ? (s as any).settings
      : { showUndoRedo: true };
    return { ...s, settings, schemaVersion: 4 } as Record<string, unknown>;
  },
};

export function migrateToLatest(raw: unknown): Persisted {
  // We accept an object with a schemaVersion field (number) and progressively migrate.
  const base: Record<string, unknown> = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const from = typeof base.schemaVersion === 'number' ? (base.schemaVersion as number) : SCHEMA_VERSION;

  let current: Record<string, unknown> = { ...base };
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`Missing migration step for ${v} -> ${v + 1}`);
    current = step(current);
  }

  // Ensure final schemaVersion matches latest
  if (current.schemaVersion !== SCHEMA_VERSION) (current as Record<string, unknown>).schemaVersion = SCHEMA_VERSION;

  // Validate using zod and narrow the type
  const parsed = zPersisted.safeParse(current);
  if (!parsed.success) {
    // Provide a concise error
    const issue = parsed.error.issues[0];
    throw new Error(`Persisted state invalid at ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  return parsed.data;
}

// A small helper to validate exported/imported layout objects that are a subset of Persisted
export const zExported = z.object({
  schemaVersion: z.number().int().nonnegative(),
  exportedAt: z.string().datetime(),
  config: zPersisted.shape.config,
});
export type Exported = z.infer<typeof zExported>;
