import type { FastifyPluginAsync } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/types.js';

export interface HealthRouteOptions {
  db?: Kysely<Database>;
  isHealthy?: () => boolean | Promise<boolean>;
  getTimeOffsetMs?: () => number;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (fastify, options) => {
  fastify.get('/health', async (_request, reply) => {
    let healthy = true;
    if (options?.isHealthy) {
      try {
        healthy = await options.isHealthy();
      } catch {
        healthy = false;
      }
    } else if (options?.db) {
      try {
        await sql`SELECT 1`.execute(options.db);
        healthy = true;
      } catch {
        healthy = false;
      }
    }

    const offset = options?.getTimeOffsetMs ? options.getTimeOffsetMs() : 0;
    const timestamp = new Date(Date.now() + offset).toISOString();

    reply.header('Content-Type', 'application/json');

    if (!healthy) {
      return reply.status(503).send({
        status: 'service_unavailable',
        timestamp
      });
    }

    return reply.status(200).send({
      status: 'ok',
      timestamp
    });
  });
};
