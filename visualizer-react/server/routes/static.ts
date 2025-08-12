import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { STATIC_DIR } from '../services/config-service.js';

export default async function staticRoutes(app: FastifyInstance) {
  await app.register(fastifyStatic, {
    root: path.resolve(STATIC_DIR),
    prefix: '/',
    index: ['index.html'],
    cacheControl: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  });
}
