import type { AppInfo, Config, Data } from '../types';
import { AppsResponseSchema, ConfigSchema, DataSchema, SaveConfigResponseSchema } from '../types/api';
import { assertValid, parseJsonResponse } from '../utils/validation';

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

type RetryOpts = { attempts?: number; baseDelayMs?: number };

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, opts: RetryOpts = {}) {
  const attempts = Math.max(1, Math.min(10, opts.attempts ?? 3));
  const base = Math.max(50, opts.baseDelayMs ?? 250);
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(input, { ...init, signal: ctrl.signal });
      clearTimeout(timeout);
      if (!r.ok && r.status >= 500 && r.status < 600 && i < attempts - 1) {
        // retry on 5xx
        const delay = base * Math.pow(2, i) + Math.floor(Math.random() * 100);
        await sleep(delay);
        continue;
      }
      return r;
    } catch (e: any) {
      lastErr = e;
      // network/abort -> backoff
      if (i < attempts - 1) {
        const delay = base * Math.pow(2, i) + Math.floor(Math.random() * 100);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function getData(): Promise<Data> {
  const r = await fetchWithRetry('/api/data');
  return parseJsonResponse(r, DataSchema, 'GET /api/data');
}

export async function getConfig(): Promise<Config> {
  const r = await fetchWithRetry('/api/config');
  return parseJsonResponse(r, ConfigSchema, 'GET /api/config');
}

export async function saveConfig(config: Config): Promise<void> {
  // Validate input before sending
  const safe = assertValid(ConfigSchema, config, 'saveConfig input');
  const r = await fetchWithRetry('/api/config', {
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
  const r = await fetchWithRetry('/api/apps');
  return parseJsonResponse(r, AppsResponseSchema, 'GET /api/apps');
}

