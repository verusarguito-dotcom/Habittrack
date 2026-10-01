import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';

describe('apps/server - Health Check Route & Fastify Bootstrap', () => {
  const mockConfig: ServerConfig = {
    databaseUrl: 'postgresql://localhost:5432/vibehabit_test',
    deviceTokens: { 'dev-1': 'token-hash-123' },
    host: '127.0.0.1',
    port: 3001,
    nodeEnv: 'test',
    staticDistPath: 'apps/web/dist'
  };

  it('GET /api/v1/health returns 200 OK with ISO timestamp and application/json header', async () => {
    const app = await buildApp({ config: mockConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');

    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(!isNaN(Date.parse(body.timestamp))).toBe(true);

    await app.close();
  });

  it('GET /api/v1/health returns 503 when unhealthy', async () => {
    let healthy = false;
    const app = await buildApp({
      config: mockConfig,
      isHealthy: () => healthy
    });

    const resDown = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });
    expect(resDown.statusCode).toBe(503);
    expect(resDown.json().status).toBe('service_unavailable');

    healthy = true;
    const resUp = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });
    expect(resUp.statusCode).toBe(200);
    expect(resUp.json().status).toBe('ok');

    await app.close();
  });

  it('reflects configured server time offset in timestamp', async () => {
    const offset = 60000; // +1 minute
    const app = await buildApp({
      config: mockConfig,
      getTimeOffsetMs: () => offset
    });

    const before = Date.now();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });
    const parsedTime = new Date(res.json().timestamp).getTime();

    expect(parsedTime).toBeGreaterThanOrEqual(before + offset - 50);

    await app.close();
  });

  it('checks db connection when db instance is provided without isHealthy callback', async () => {
    const createMockDb = (healthy: boolean) => ({
      getExecutor: () => ({
        adapter: { supportsTransactionalDdl: () => true },
        transformQuery: (q: any) => q,
        compileQuery: () => ({ sql: 'SELECT 1', parameters: [] }),
        executeQuery: async () => {
          if (!healthy) {
            throw new Error('Connection refused');
          }
          return { rows: [{ '?column?': 1 }] };
        }
      })
    } as any);

    const appHealthy = await buildApp({
      config: mockConfig,
      db: createMockDb(true)
    });

    const resHealthy = await appHealthy.inject({
      method: 'GET',
      url: '/api/v1/health'
    });
    expect(resHealthy.statusCode).toBe(200);
    expect(resHealthy.json().status).toBe('ok');
    await appHealthy.close();

    const appUnhealthy = await buildApp({
      config: mockConfig,
      db: createMockDb(false)
    });

    const resUnhealthy = await appUnhealthy.inject({
      method: 'GET',
      url: '/api/v1/health'
    });
    expect(resUnhealthy.statusCode).toBe(503);
    expect(resUnhealthy.json().status).toBe('service_unavailable');
    await appUnhealthy.close();
  });
});
