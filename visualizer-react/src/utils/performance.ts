export type PerfSample = {
  name: string;
  durationMs: number;
  ts: number;
};

const history: PerfSample[] = [];

export function markStart(_name: string): number {
  return performance.now();
}

export function markEnd(name: string, start: number): PerfSample {
  const durationMs = performance.now() - start;
  const sample: PerfSample = { name, durationMs, ts: Date.now() };
  history.push(sample);
  if (history.length > 200) history.shift();
  return sample;
}

export async function measureAsync<T>(fn: () => Promise<T> | T, name?: string): Promise<{ result: T; durationMs: number }> {
  const t0 = performance.now();
  const result = await fn();
  const durationMs = performance.now() - t0;
  if (name) history.push({ name, durationMs, ts: Date.now() });
  return { result, durationMs };
}

export function getPerfHistory(filter?: string): PerfSample[] {
  if (!filter) return [...history];
  return history.filter((s) => s.name.includes(filter));
}
