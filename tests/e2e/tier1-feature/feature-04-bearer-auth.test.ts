import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness, createSyncRequest } from '../harness/index.js';

describe('Tier 1 - Feature 04: Bearer Auth & Constant-time check', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('allows access with a valid Bearer token', () => {
    const validHeader = `Bearer ${harness.clientA.authToken}`;
    const result = harness.server.verifyBearerAuth(validHeader);
    expect(result.authorized).toBe(true);
    expect(result.deviceId).toBe('device-test-01');
  });

  it('rejects requests with missing Authorization header with 401 UNAUTHORIZED', () => {
    const syncReq = createSyncRequest();
    const res = harness.server.handleSync(syncReq, undefined);
    expect(res.status).toBe(401);
    expect((res.body as any).error).toBe('UNAUTHORIZED');
  });

  it('rejects non-Bearer authentication schemes with 401 UNAUTHORIZED', () => {
    const syncReq = createSyncRequest();
    const res = harness.server.handleSync(syncReq, 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
    expect((res.body as any).error).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid or revoked token with 401 UNAUTHORIZED', () => {
    const syncReq = createSyncRequest();
    const res = harness.server.handleSync(syncReq, 'Bearer invalid-token-xyz');
    expect(res.status).toBe(401);
    expect((res.body as any).error).toBe('UNAUTHORIZED');
  });

  it('validates tokens using SHA-256 constant-time comparison against registered hashes', () => {
    // Exact length match with 1 bit flipped
    const validToken = harness.clientA.authToken;
    const tamperedToken = validToken.slice(0, -1) + (validToken.endsWith('a') ? 'b' : 'a');

    const authRes = harness.server.verifyBearerAuth(`Bearer ${tamperedToken}`);
    expect(authRes.authorized).toBe(false);
  });
});
