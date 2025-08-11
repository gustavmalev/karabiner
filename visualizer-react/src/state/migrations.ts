import { z } from 'zod';
import { SCHEMA_VERSION, zPersisted, type Persisted } from './schema';

// Map of migration steps from version n -> n+1
// Each function must be a pure transformation and safe to run exactly once.
const migrations: Record<number, (input: any) => any> = {
  // 0 -> 1 example (placeholder). If we ever had version 0, we'd transform to 1.
  // 0: (s) => ({ ...s, schemaVersion: 1 }),
};

export function migrateToLatest(raw: unknown): Persisted {
  // We accept an object with a schemaVersion field (number) and progressively migrate.
  const base = (typeof raw === 'object' && raw !== null ? (raw as any) : {}) as { schemaVersion?: number };
  const from = typeof base.schemaVersion === 'number' ? base.schemaVersion : SCHEMA_VERSION;

  let current: any = { ...base };
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`Missing migration step for ${v} -> ${v + 1}`);
    current = step(current);
  }

  // Ensure final schemaVersion matches latest
  if (current.schemaVersion !== SCHEMA_VERSION) current.schemaVersion = SCHEMA_VERSION;

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
