import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 06: Lock Concurrency & Contention', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('immediately returns 503 LOCK_CONTENTION when advisory lock is held', () => {
    (harness.server as any).advisoryLockHeld = true;

    const start = performance.now();
    const req = createSyncRequest();
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const elapsed = performance.now() - start;

    expect(res.status).toBe(503);
    expect((res.body as any).error).toBe('LOCK_CONTENTION');
    expect(elapsed).toBeLessThan(50); // Fast rejection without blocking

    (harness.server as any).advisoryLockHeld = false;
  });

  it('guarantees lock release when payload parsing fails', () => {
    const res = harness.server.handleSync({ invalid: true }, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(400);
    expect((harness.server as any).advisoryLockHeld).toBe(false);
  });

  it('guarantees lock release when client clock skew is detected', () => {
    const skewedTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const req = createSyncRequest([], { client_time: skewedTime });

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(409);
    expect((harness.server as any).advisoryLockHeld).toBe(false);
  });

  it('allows immediate subsequent transaction after lock release', () => {
    const req1 = createSyncRequest([]);
    const res1 = harness.server.handleSync(req1, `Bearer ${harness.clientA.authToken}`);
    expect(res1.status).toBe(200);

    const req2 = createSyncRequest([]);
    const res2 = harness.server.handleSync(req2, `Bearer ${harness.clientB.authToken}`);
    expect(res2.status).toBe(200);
  });

  it('survives rapid acquire-release stress cycles (50 cycles)', () => {
    for (let i = 0; i < 50; i++) {
      const req = createSyncRequest([]);
      const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
      expect(res.status).toBe(200);
      expect((harness.server as any).advisoryLockHeld).toBe(false);
    }
  });
});
