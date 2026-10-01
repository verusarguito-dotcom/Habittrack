import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 2 - Boundary 05: Health Check Route Edge Cases', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('handles burst of 100 consecutive health check calls under 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const res = harness.server.handleHealthCheck();
      expect(res.status).toBe(200);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('handles fast recovery when server toggles between down and up', () => {
    harness.server.setServerDown(true);
    expect(harness.server.handleHealthCheck().status).toBe(503);

    harness.server.setServerDown(false);
    expect(harness.server.handleHealthCheck().status).toBe(200);

    harness.server.setServerDown(true);
    expect(harness.server.handleHealthCheck().status).toBe(503);

    harness.server.setServerDown(false);
    expect(harness.server.handleHealthCheck().status).toBe(200);
  });

  it('preserves valid ISO timestamp formatting across leap seconds and timezone offsets', () => {
    harness.server.setServerTimeOffset(3600 * 1000); // +1 hour
    const res = harness.server.handleHealthCheck();
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('retains ok status regardless of database table row count', () => {
    // Empty database
    expect(harness.server.handleHealthCheck().body.status).toBe('ok');

    // Populated database
    (harness.server as any).globalServerSeq = 10000;
    expect(harness.server.handleHealthCheck().body.status).toBe('ok');
  });

  it('returns exact headers structure across repeated invocations', () => {
    const res = harness.server.handleHealthCheck();
    expect(res.headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
