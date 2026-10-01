import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyBearerAuth, createAuthPreHandler } from '../src/middleware/auth.js';
import Fastify from 'fastify';

describe('apps/server - Bearer Authentication Middleware', () => {
  const tokenPlain = 'test-secret-token-32-chars-long!!';
  const tokenHash = crypto.createHash('sha256').update(tokenPlain).digest('hex');
  const deviceTokens = {
    'device-laptop': tokenHash
  };

  it('authorizes request with valid Bearer token', () => {
    const res = verifyBearerAuth(`Bearer ${tokenPlain}`, deviceTokens);
    expect(res.authorized).toBe(true);
    expect(res.deviceId).toBe('device-laptop');
  });

  it('rejects missing Authorization header', () => {
    const res = verifyBearerAuth(undefined, deviceTokens);
    expect(res.authorized).toBe(false);
    expect(res.error).toBe('UNAUTHORIZED');
  });

  it('rejects non-Bearer scheme like Basic or Token', () => {
    const res = verifyBearerAuth(`Basic ${tokenPlain}`, deviceTokens);
    expect(res.authorized).toBe(false);
  });

  it('rejects lowercase bearer or uppercase BEARER prefix', () => {
    expect(verifyBearerAuth(`bearer ${tokenPlain}`, deviceTokens).authorized).toBe(false);
    expect(verifyBearerAuth(`BEARER ${tokenPlain}`, deviceTokens).authorized).toBe(false);
  });

  it('rejects empty token after Bearer', () => {
    expect(verifyBearerAuth('Bearer ', deviceTokens).authorized).toBe(false);
    expect(verifyBearerAuth('Bearer    ', deviceTokens).authorized).toBe(false);
  });

  it('trims whitespace around valid token', () => {
    const res = verifyBearerAuth(`Bearer    ${tokenPlain}   `, deviceTokens);
    expect(res.authorized).toBe(true);
    expect(res.deviceId).toBe('device-laptop');
  });

  it('rejects tampered token using constant-time comparison', () => {
    const tampered = tokenPlain.slice(0, -1) + 'x';
    const res = verifyBearerAuth(`Bearer ${tampered}`, deviceTokens);
    expect(res.authorized).toBe(false);
  });

  it('integrates as Fastify preHandler hook rejecting unauthorized requests with 401', async () => {
    const app = Fastify();
    app.addHook('preHandler', createAuthPreHandler(deviceTokens));
    app.get('/protected', async (req) => ({ ok: true, deviceId: (req as any).deviceId }));

    const resUnauth = await app.inject({
      method: 'GET',
      url: '/protected'
    });
    expect(resUnauth.statusCode).toBe(401);
    expect(resUnauth.json().error).toBe('UNAUTHORIZED');

    const resAuth = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${tokenPlain}`
      }
    });
    expect(resAuth.statusCode).toBe(200);
    expect(resAuth.json().deviceId).toBe('device-laptop');
  });
});
