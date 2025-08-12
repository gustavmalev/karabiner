import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

// Adds basic request/response logging using Fastify's built-in logger (pino)
export default fp(async function loggingPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    req.log.debug({ method: req.method, url: req.url, id: req.id }, 'request received');
  });

  app.addHook('onResponse', async (req, reply) => {
    req.log.info({ statusCode: reply.statusCode, url: req.url, id: req.id }, 'request completed');
  });
});
