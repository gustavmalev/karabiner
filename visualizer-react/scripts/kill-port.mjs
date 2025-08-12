#!/usr/bin/env node
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).map((p) => Number(p)).filter((n) => Number.isFinite(n));
if (ports.length === 0) {
  console.error('Usage: node scripts/kill-port.mjs <port> [port2 port3 ...]');
  process.exit(1);
}

const isMacOrLinux = process.platform === 'darwin' || process.platform === 'linux';
if (!isMacOrLinux) {
  console.warn('[kill-port] Non-unix platform detected; skipping. Please close processes manually on this OS.');
  process.exit(0);
}

for (const port of ports) {
  try {
    // Find PIDs listening on the port and kill them
    const pids = execSync(`lsof -ti tcp:${port} || true`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (pids.length === 0) {
      console.log(`[kill-port] No process found on port ${port}`);
      continue;
    }
    console.log(`[kill-port] Killing ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);
    execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'inherit' });
  } catch (e) {
    console.warn(`[kill-port] Failed to kill processes on port ${port}:`, e?.message || e);
  }
}
