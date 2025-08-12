import fastify from 'fastify';
import cors from '@fastify/cors';
import apiRoutes from './routes/api.js';
import staticRoutes from './routes/static.js';
import { KARABINER_JSON, RULES_TS } from './services/config-service.js';
import { iconCacheInfo, maybePruneDiskCache } from './services/app-service.js';
import { ENV } from './config/environment.js';
import loggingPlugin from './plugins/logging.js';
import healthPlugin from './plugins/health.js';
import registerErrorHandling from './middleware/error-handler.js';

async function buildServer() {
  const app = fastify({
    logger: {
      level: ENV.LOG_LEVEL,
      redact: ['req.headers.authorization']
    },
    genReqId: () => Math.random().toString(36).slice(2, 10),
  });

  // CORS for API routes (keeps old behavior)
  await app.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] });

  // Observability
  await app.register(loggingPlugin);
  await app.register(healthPlugin);

  // Routes
  await app.register(apiRoutes);
  await app.register(staticRoutes);

  // Global error + 404 handlers
  await registerErrorHandling(app);

  return app;
}

async function start() {
  const app = await buildServer();
  await app.listen({ port: ENV.PORT, host: '0.0.0.0' });
  const cache = iconCacheInfo();
  app.log.info(`Karabiner Configuration Editor running at http://localhost:${ENV.PORT}`);
  app.log.info(`Reading data from: ${KARABINER_JSON}`);
  app.log.info(`Managing configuration: ${RULES_TS}`);
  app.log.info(`[cache] icon disk dir: ${cache.diskCacheDir}`);
  app.log.info(`[cache] mem LRU: maxEntries=${cache.MEM_LRU_MAX_ENTRIES} maxBytes=${cache.MEM_LRU_MAX_BYTES}`);
  app.log.info(`[cache] disk maxBytes=${cache.DISK_CACHE_MAX_BYTES}`);
  // fire-and-forget initial prune
  maybePruneDiskCache(true).catch(() => {});
}

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', e);
  process.exit(1);
});
