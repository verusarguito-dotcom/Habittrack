import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Kysely } from 'kysely';
import type { Database } from './db/types.js';
import { loadConfigFromEnv, validateServerConfig, type ServerConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { syncRoutes } from './routes/sync.js';

export interface AppOptions {
  config?: ServerConfig;
  db?: Kysely<Database>;
  isHealthy?: () => boolean | Promise<boolean>;
  getTimeOffsetMs?: () => number;
  isAdvisoryLockHeld?: () => boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ? validateServerConfig(options.config) : loadConfigFromEnv();

  const app = Fastify({
    logger: config.nodeEnv === 'development'
  });

  // Health check routes
  await app.register(healthRoutes, {
    prefix: '/api/v1',
    db: options.db,
    isHealthy: options.isHealthy,
    getTimeOffsetMs: options.getTimeOffsetMs
  });

  // Sync routes
  await app.register(syncRoutes, {
    prefix: '/api/v1',
    db: options.db,
    deviceTokens: config.deviceTokens,
    getTimeOffsetMs: options.getTimeOffsetMs,
    isAdvisoryLockHeld: options.isAdvisoryLockHeld
  });

  // Ensure static directory exists
  const staticPath = path.resolve(config.staticDistPath);
  if (!fs.existsSync(staticPath)) {
    fs.mkdirSync(staticPath, { recursive: true });
  }

  // Register static file serving for PWA
  await app.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
    wildcard: true
  });

  // SPA fallback for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`
      });
    }

    // Do not serve index.html for static asset requests with file extensions
    const pathname = request.url.split('?')[0] ?? '';
    if (path.extname(pathname) !== '') {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Static asset ${pathname} not found`
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`
      });
    }

    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return reply.sendFile('index.html');
    }

    return reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'Not found'
    });
  });

  return app;
}
