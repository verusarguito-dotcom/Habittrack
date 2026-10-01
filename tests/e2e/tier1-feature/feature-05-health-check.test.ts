import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 1 - Feature 05: Health Check Route', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('returns HTTP 200 OK for health check probe', () => {
    const res = harness.server.handleHealthCheck();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns ISO 8601 timestamp in health check response', () => {
    const res = harness.server.handleHealthCheck();
    expect(typeof res.body.timestamp).toBe('string');
    expect(!isNaN(Date.parse(res.body.timestamp))).toBe(true);
  });

  it('reflects accurate server time including configured offsets', () => {
    harness.server.setServerTimeOffset(60000); // +1 minute
    const res = harness.server.handleHealthCheck();
    const serverTimeMs = new Date(res.body.timestamp).getTime();
    const nowMs = Date.now();
    expect(serverTimeMs).toBeGreaterThanOrEqual(nowMs + 59000);
  });

  it('returns application/json content type header', () => {
    const res = harness.server.handleHealthCheck();
    expect(res.headers['Content-Type']).toBe('application/json');
  });

  it('returns 503 Service Unavailable when server is down or under maintenance', () => {
    harness.server.setServerDown(true);
    const res = harness.server.handleHealthCheck();
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('service_unavailable');
  });
});
