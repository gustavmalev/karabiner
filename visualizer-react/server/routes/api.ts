import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { getAppsCached, logCacheMetrics, getOrCreateIconPNGBuffer } from '../services/app-service.js';
import { analyze, generateRulesTs, parseRulesConfig, readKarabinerJson, RULES_TS, USER_KARABINER_JSON, PROJECT_ROOT } from '../services/config-service.js';

export default async function apiRoutes(app: FastifyInstance) {
  app.get('/api/apps', async (req, reply) => {
    const refresh = (req.query as any)?.refresh === '1';
    const enriched = await getAppsCached(Boolean(refresh));
    logCacheMetrics();
    return reply.type('application/json').send(enriched);
  });

  app.get('/api/app-icon', async (req, reply) => {
    const q = req.query as any;
    const appPath = q?.path as string;
    const sizeRaw = Number(q?.size || 64);
    const size = Math.max(32, Math.min(256, isFinite(sizeRaw) ? sizeRaw : 64));
    if (!appPath) {
      return reply.code(400).type('application/json').send({ error: 'path required' });
    }
    try {
      const buf = await getOrCreateIconPNGBuffer(appPath, size);
      if (buf && Buffer.isBuffer(buf)) {
        return reply.header('Cache-Control', 'public, max-age=86400').type('image/png').send(buf);
      }
      return reply.code(404).send();
    } catch (e: any) {
      app.log.error({ err: e }, '[icon] generation failed');
      return reply.code(500).type('application/json').send({ error: 'icon generation failed' });
    }
  });

  app.get('/api/data', async (_req, reply) => {
    const json = readKarabinerJson();
    if (!json) {
      return reply.code(500).type('application/json').send({ error: `Could not read karabiner.json` });
    }
    const result = analyze(json);
    return reply.type('application/json').send(result);
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/api/config',
    handler: async (req, reply) => {
      if (req.method === 'GET') {
        const config = parseRulesConfig();
        if (!config) {
          return reply.code(500).type('application/json').send({ error: `Could not read rules.ts at ${RULES_TS}` });
        }
        return reply.type('application/json').send(config);
      }

      // POST: Save configuration
      const body = (req.body ?? {}) as any;
      try {
        const config = typeof body === 'string' ? JSON.parse(body) : body;
        app.log.info('[POST /api/config] Received config');
        const rulesContent = generateRulesTs(config);
        fs.writeFileSync(RULES_TS, rulesContent, 'utf8');
        // fs.writeFileSync returns void; we verify by reading back
        if (!fs.existsSync(RULES_TS)) {
          return reply.code(500).type('application/json').send({ error: 'Failed to write rules.ts' });
        }

        // Build karabiner.json by running project build script at repo root
        await new Promise<void>((resolve, reject) => {
          exec('npm run build', { cwd: PROJECT_ROOT }, (err, _stdout, stderr) => {
            if (err) {
              app.log.error({ err, stderr }, '[build] failed');
              reject(err);
            } else {
              app.log.info('[build] success');
              resolve();
            }
          });
        });

        // After successful build, copy the generated karabiner.json to the user's Karabiner config path
        try {
          const targetDir = path.dirname(USER_KARABINER_JSON);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          const builtJson = path.join(PROJECT_ROOT, 'karabiner.json');
          fs.copyFileSync(builtJson, USER_KARABINER_JSON);
          app.log.info(`[apply] Copied ${builtJson} -> ${USER_KARABINER_JSON}`);
        } catch (copyErr: any) {
          app.log.error({ err: copyErr }, '[apply] Failed to copy karabiner.json to user config');
          return reply.code(500).type('application/json').send({ success: false, error: 'Built karabiner.json but failed to apply to user config path', detail: String(copyErr) });
        }

        return reply.type('application/json').send({ success: true, message: 'Configuration saved, built, and applied to Karabiner config' });
      } catch (error: any) {
        return reply.code(400).type('application/json').send({ error: 'Invalid JSON in request body', detail: error?.message });
      }
    }
  });
}
