import os from 'os';
import fs from 'fs';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { KARABINER_JSON } from '../services/config-service.js';
import { iconCacheInfo } from '../services/app-service.js';

export default fp(async function healthPlugin(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const mem = process.memoryUsage();
    const load = os.loadavg();
    const info = {
      status: 'ok',
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      cpuLoad: { '1m': load[0], '5m': load[1], '15m': load[2] },
      now: new Date().toISOString(),
    };
    return reply.type('application/json').send(info);
  });

  app.get('/ready', async (_req, reply) => {
    const cache = iconCacheInfo();
    let karabinerReadable = false;
    try { fs.accessSync(KARABINER_JSON, fs.constants.R_OK); karabinerReadable = true; } catch {}

    const ready = karabinerReadable;
    const detail = {
      ready,
      karabinerJson: { path: KARABINER_JSON, readable: karabinerReadable },
      iconCache: { dir: cache.diskCacheDir, memMaxBytes: cache.MEM_LRU_MAX_BYTES, diskMaxBytes: cache.DISK_CACHE_MAX_BYTES },
    };
    return reply.code(ready ? 200 : 503).type('application/json').send(detail);
  });
});
