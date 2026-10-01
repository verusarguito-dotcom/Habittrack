import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';

describe('apps/server - Static File Serving (@fastify/static)', () => {
  const testDistDir = path.resolve(process.cwd(), 'apps/server/tests/fixtures/dist');

  beforeAll(() => {
    fs.mkdirSync(testDistDir, { recursive: true });
    fs.writeFileSync(path.join(testDistDir, 'index.html'), '<html><body>VibeHabit PWA</body></html>');
    fs.writeFileSync(path.join(testDistDir, 'app.js'), 'console.log("VibeHabit App");');
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testDistDir)) {
        fs.rmSync(testDistDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  const mockConfig: ServerConfig = {
    databaseUrl: 'postgresql://localhost:5432/vibehabit_test',
    deviceTokens: { 'dev-1': 'token-hash-123' },
    host: '127.0.0.1',
    port: 3001,
    nodeEnv: 'test',
    staticDistPath: testDistDir
  };

  it('serves static files from configured staticDistPath', async () => {
    const app = await buildApp({ config: mockConfig });

    const resHtml = await app.inject({
      method: 'GET',
      url: '/'
    });
    expect(resHtml.statusCode).toBe(200);
    expect(resHtml.body).toContain('VibeHabit PWA');

    const resJs = await app.inject({
      method: 'GET',
      url: '/app.js'
    });
    expect(resJs.statusCode).toBe(200);
    expect(resJs.body).toContain('console.log("VibeHabit App");');

    await app.close();
  });

  it('falls back to index.html for SPA non-API routes', async () => {
    const app = await buildApp({ config: mockConfig });

    const resSpa = await app.inject({
      method: 'GET',
      url: '/habits/manage'
    });
    expect(resSpa.statusCode).toBe(200);
    expect(resSpa.body).toContain('VibeHabit PWA');

    await app.close();
  });

  it('returns 404 JSON for non-existent API routes', async () => {
    const app = await buildApp({ config: mockConfig });

    const resApi404 = await app.inject({
      method: 'GET',
      url: '/api/v1/nonexistent'
    });
    expect(resApi404.statusCode).toBe(404);
    expect(resApi404.json().error).toBe('NOT_FOUND');

    await app.close();
  });

  it('returns 404 for missing static assets with file extensions instead of serving index.html', async () => {
    const app = await buildApp({ config: mockConfig });

    const resMissingJs = await app.inject({
      method: 'GET',
      url: '/assets/nonexistent-chunk.js'
    });
    expect(resMissingJs.statusCode).toBe(404);
    expect(resMissingJs.json().error).toBe('NOT_FOUND');

    const resMissingCss = await app.inject({
      method: 'GET',
      url: '/theme.css'
    });
    expect(resMissingCss.statusCode).toBe(404);
    expect(resMissingCss.json().error).toBe('NOT_FOUND');

    await app.close();
  });

  it('returns 404 for non-GET/HEAD methods on unmatched routes', async () => {
    const app = await buildApp({ config: mockConfig });

    const resPost = await app.inject({
      method: 'POST',
      url: '/habits/manage'
    });
    expect(resPost.statusCode).toBe(404);
    expect(resPost.json().error).toBe('NOT_FOUND');

    await app.close();
  });
});
