import { Dexie, type Table } from 'dexie';
import type { Persisted } from './schema';

export type PersistedRow = Persisted & { id: string };

class KVDatabase extends Dexie {
  // Single-record table holding the entire persisted app state
  public persisted!: Table<PersistedRow, string>;

  constructor() {
    super('KarabinerVisualizer');
    // Primary key: id
    this.version(1).stores({
      persisted: 'id',
    });
  }
}

export const db = new KVDatabase();
export const PERSISTED_ID = 'main';
export const BACKUP_ID = 'backup';

// Convenience helpers for callers
export async function getPersistedRow() {
  return db.persisted.get(PERSISTED_ID);
}

export async function putPersistedRow(p: Persisted) {
  return db.persisted.put({ id: PERSISTED_ID, ...p });
}

export async function getBackupRow() {
  return db.persisted.get(BACKUP_ID);
}

export async function putBackupRow(p: Persisted) {
  return db.persisted.put({ id: BACKUP_ID, ...p });
}

export async function clearAllRows() {
  return db.persisted.clear();
}
