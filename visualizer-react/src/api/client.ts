import type { AppInfo, Config, Data } from '../types';

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.url} ${r.status}`);
  return r.json();
}

export async function getData(): Promise<Data> {
  return json(await fetch('/api/data'));
}

export async function getConfig(): Promise<Config> {
  return json(await fetch('/api/config'));
}

export async function saveConfig(config: Config): Promise<void> {
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!r.ok) throw new Error('saveConfig failed');
}

export async function getApps(): Promise<AppInfo[]> {
  return json(await fetch('/api/apps'));
}

