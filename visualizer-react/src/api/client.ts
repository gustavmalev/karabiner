import type { AppInfo, Config, Data } from '../types';
import { AppsResponseSchema, ConfigSchema, DataSchema, SaveConfigResponseSchema } from '../types/api';
import { assertValid, parseJsonResponse } from '../utils/validation';

export async function getData(): Promise<Data> {
  const r = await fetch('/api/data');
  return parseJsonResponse(r, DataSchema, 'GET /api/data');
}

export async function getConfig(): Promise<Config> {
  const r = await fetch('/api/config');
  return parseJsonResponse(r, ConfigSchema, 'GET /api/config');
}

export async function saveConfig(config: Config): Promise<void> {
  // Validate input before sending
  const safe = assertValid(ConfigSchema, config, 'saveConfig input');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safe),
  });
  const resp = await parseJsonResponse(r, SaveConfigResponseSchema, 'POST /api/config');
  if (resp.success !== true) {
    const msg = resp.error || resp.message || 'saveConfig failed';
    throw new Error(msg);
  }
}

export async function getApps(): Promise<AppInfo[]> {
  const r = await fetch('/api/apps');
  return parseJsonResponse(r, AppsResponseSchema, 'GET /api/apps');
}

