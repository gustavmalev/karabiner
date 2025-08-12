import { SCHEMA_VERSION, zPersisted, type Persisted } from './schema';
import { migrateToLatest, migrateLegacyLocalStorageToIndexedDB } from './migrations';
import { db, PERSISTED_ID, BACKUP_ID } from './database';

const STORAGE_KEY = 'vrx:persisted';

function hasIndexedDB() {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  } catch {
    return false;
  }
}

// Full export: read latest persisted from storage and download as JSON
export async function exportFullState() {
  const persisted = await loadPersisted();
  if (!persisted) throw new Error('No persisted state to export');
  const out = { ...persisted, exportedAt: new Date().toISOString() } as Persisted;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `app-state-v${out.schemaVersion}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Utility to merge two persisted states; incoming wins where ambiguous
export function mergePersisted(base: Persisted, incoming: Persisted): Persisted {
  const snapshotsMap = new Map<string, Persisted['snapshots'][number]>();
  for (const s of base.snapshots ?? []) snapshotsMap.set(s.id, s);
  for (const s of incoming.snapshots ?? []) snapshotsMap.set(s.id, s); // incoming overrides duplicates
  const snapshots = Array.from(snapshotsMap.values()).sort((a, b) => a.createdAt - b.createdAt);
  const mergedSettings = { ...(base.settings ?? {}), ...(incoming.settings ?? {}) } as Persisted['settings'];
  const limit = mergedSettings?.maxSnapshots ?? 100;
  let trimmed = snapshots;
  if (limit > 0 && trimmed.length > limit) trimmed = trimmed.slice(trimmed.length - limit);
  return {
    schemaVersion: SCHEMA_VERSION,
    config: incoming.config, // prefer imported configuration
    locks: { ...(base.locks ?? {}), ...(incoming.locks ?? {}) },
    filter: incoming.filter ?? base.filter,
    keyboardLayout: incoming.keyboardLayout ?? base.keyboardLayout,
    aiKey: incoming.aiKey ?? base.aiKey ?? '',
    blockedKeys: { ...(base.blockedKeys ?? {}), ...(incoming.blockedKeys ?? {}) },
    lastSavedAt: incoming.lastSavedAt ?? base.lastSavedAt ?? null,
    snapshots: trimmed,
    settings: mergedSettings ?? { showUndoRedo: true, maxSnapshots: 100 },
  };
}

export type ImportMode = 'replace' | 'merge';

// Import a JSON file and return the final Persisted written to storage.
// Does not modify the in-memory store; caller should apply the returned state to the store.
export async function importFullState(file: File, mode: ImportMode = 'replace'): Promise<Persisted> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON file');
  }
  // Validate and migrate to latest schema
  let incoming: Persisted;
  try {
    incoming = migrateToLatest(parsed);
  } catch (e: any) {
    throw new Error(`Import failed validation: ${e?.message || 'unknown error'}`);
  }
  // Load current for merge mode
  const current = await loadPersisted();
  const finalPersisted: Persisted = mode === 'merge' && current ? mergePersisted(current, incoming) : incoming;
  // Validate final shape
  const res = zPersisted.safeParse(finalPersisted);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new Error(`Final state invalid at ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  // Backup current state (if any) before overwriting
  try {
    if (current) {
      await db.persisted.put({ id: BACKUP_ID, ...current });
    }
  } catch (e) {
    console.warn('Failed to write backup copy before import', e);
  }
  // Write to storage
  await db.persisted.put({ id: PERSISTED_ID, ...finalPersisted });
  return finalPersisted;
}

export async function loadPersisted(): Promise<Persisted | null> {
  // 1) Try IndexedDB first
  if (hasIndexedDB()) {
    try {
      const row = await db.persisted.get(PERSISTED_ID);
      if (row) {
        const { id: _id, ...rest } = row as any;
        const migrated = migrateToLatest(rest);
        // If migration bumped the version, write back
        if (migrated.schemaVersion !== row.schemaVersion) {
          await db.persisted.put({ id: PERSISTED_ID, ...migrated });
        }
        return migrated;
      }
    } catch (e) {
      console.warn('IndexedDB load failed, will try localStorage fallback', e);
    }
  }

  // 2) Fallback: migrate legacy localStorage into IndexedDB (one-time)
  try {
    const migrated = await migrateLegacyLocalStorageToIndexedDB();
    return migrated;
  } catch (e) {
    console.warn('Failed to load persisted app state (legacy path); ignoring', e);
    return null;
  }
}

export function buildPersisted(input: {
  config: Persisted['config'];
  locks: Persisted['locks'];
  filter: Persisted['filter'];
  keyboardLayout: Persisted['keyboardLayout'];
  aiKey: Persisted['aiKey'];
  blockedKeys: Persisted['blockedKeys'];
  lastSavedAt?: Persisted['lastSavedAt'];
  snapshots?: Persisted['snapshots'];
  settings?: Persisted['settings'];
}): Persisted {
  return {
    schemaVersion: SCHEMA_VERSION,
    config: input.config,
    locks: input.locks ?? {},
    filter: input.filter,
    keyboardLayout: input.keyboardLayout,
    aiKey: input.aiKey ?? '',
    blockedKeys: input.blockedKeys ?? {},
    lastSavedAt: input.lastSavedAt ?? null,
    snapshots: input.snapshots ?? [],
    settings: input.settings ?? { showUndoRedo: true, maxSnapshots: 100 },
  };
}

// Simple queue to serialize writes and avoid race conditions
let saveQueue: Promise<void> = Promise.resolve();

async function doSave(p: Persisted, onSaved?: () => void) {
  // Prefer IndexedDB; fallback to localStorage
  if (hasIndexedDB()) {
    try {
      await db.persisted.put({ id: PERSISTED_ID, ...p });
      onSaved?.();
      return;
    } catch (e) {
      console.warn('IndexedDB save failed, falling back to localStorage', e);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    onSaved?.();
  } catch (e) {
    console.error('Persist save failed (localStorage)', e);
  }
}

// Public: immediate async save, queued to preserve order
export function savePersistedAsync(p: Persisted) {
  saveQueue = saveQueue.then(() => doSave(p)).catch((e) => console.warn('Save queue error', e));
  return saveQueue;
}

export function exportJson(p: Persisted) {
  const blob = new Blob([
    JSON.stringify({
      schemaVersion: p.schemaVersion,
      exportedAt: new Date().toISOString(),
      config: p.config,
    }, null, 2),
  ], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `layout-v${p.schemaVersion}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
