import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createMutation,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 07: Clock Skew Strict Thresholds (5 minutes / 300,000ms)', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('permits request comfortably within 5-minute threshold (+290 seconds forward)', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const thresholdTime = new Date(serverTimeMs + 290000).toISOString();

    const req = createSyncRequest([], { client_time: thresholdTime });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(200);
  });

  it('rejects request beyond 5-minute threshold (+310 seconds forward) with 409 CLOCK_SKEW', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const overThresholdTime = new Date(serverTimeMs + 310000).toISOString();

    const req = createSyncRequest([], { client_time: overThresholdTime });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(409);
    expect((res.body as any).error).toBe('CLOCK_SKEW');
  });

  it('permits request comfortably within 5-minute threshold (-290 seconds backward)', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const thresholdPast = new Date(serverTimeMs - 290000).toISOString();

    const req = createSyncRequest([], { client_time: thresholdPast });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(200);
  });

  it('rejects request beyond 5-minute threshold (-310 seconds backward) with 409 CLOCK_SKEW', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const overThresholdPast = new Date(serverTimeMs - 310000).toISOString();

    const req = createSyncRequest([], { client_time: overThresholdPast });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(409);
    expect((res.body as any).error).toBe('CLOCK_SKEW');
  });

  it('permits mutation updated_at within 5 minutes, rejects mutation >5 minutes in future', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const validTime = new Date(serverTimeMs + 200000).toISOString(); // +3.3m
    const invalidFutureTime = new Date(serverTimeMs + 360000).toISOString(); // +6m

    const validHabit = createHabit({ nama: 'Valid 200s', updated_at: validTime });
    const invalidHabit = createHabit({ nama: 'Invalid 360s', updated_at: invalidFutureTime });

    const m1 = createMutation('habits', validHabit, 'm-valid-300');
    const m2 = createMutation('habits', invalidHabit, 'm-invalid-301');

    const req = createSyncRequest([m1, m2], {
      client_time: harness.server.getServerTimeIso()
    });

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(200);

    const body = res.body as any;
    expect(body.applied).toContain('m-valid-300');
    expect(body.applied).not.toContain('m-invalid-301');
    expect(body.rejected.length).toBe(1);
    expect(body.rejected[0].mutation_id).toBe('m-invalid-301');
  });
});
