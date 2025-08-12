import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ENV } from '../config/environment.js';

export default async function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    const statusCode = (err.statusCode && typeof err.statusCode === 'number') ? err.statusCode : 500;
    app.log.error({ err, statusCode }, 'Unhandled error');
    const baseError = { message: err.message, code: err.code } as { message: string; code?: string };
    const errorPayload = ENV.DEV ? { ...baseError, stack: err.stack } : baseError;
    reply.code(statusCode).type('application/json').send({ error: errorPayload });
  });

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).type('application/json').send({ error: { message: `Route not found: ${req.method} ${req.url}` } });
  });
}
