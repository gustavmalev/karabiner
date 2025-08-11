import { SCHEMA_VERSION, type Persisted } from './schema';
import { migrateToLatest } from './migrations';

const STORAGE_KEY = 'vrx:persisted';

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, wait: number) {
  let t: number | undefined;
  return (...args: Args) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

export function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return migrateToLatest(obj);
  } catch (e) {
    console.warn('Failed to load persisted app state; ignoring', e);
    return null;
  }
}

export function buildPersisted(input: {
  config: Persisted['config'];
  locks: Persisted['locks'];
  filter: Persisted['filter'];
  keyboardLayout: Persisted['keyboardLayout'];
  aiKey: Persisted['aiKey'];
}): Persisted {
  return {
    schemaVersion: SCHEMA_VERSION,
    config: input.config,
    locks: input.locks ?? {},
    filter: input.filter,
    keyboardLayout: input.keyboardLayout,
    aiKey: input.aiKey ?? '',
  };
}

function doSave(p: Persisted, onSaved?: () => void) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    onSaved?.();
  } catch (e) {
    console.error('Persist save failed', e);
  }
}

export const savePersistedDebounced = debounce(doSave, 500);

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
