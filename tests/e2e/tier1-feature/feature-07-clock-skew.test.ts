import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createMutation,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 07: Clock Skew & Future Timestamp Rejection', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('rejects sync request with 409 CLOCK_SKEW when client_time is > 5 minutes in future', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const skewedClientTime = new Date(serverTimeMs + 6 * 60 * 1000).toISOString(); // +6 min

    const req = createSyncRequest([], { client_time: skewedClientTime });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(409);
    expect((res.body as any).error).toBe('CLOCK_SKEW');
  });

  it('rejects sync request with 409 CLOCK_SKEW when client_time is > 5 minutes in past', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const skewedClientTime = new Date(serverTimeMs - 6 * 60 * 1000).toISOString(); // -6 min

    const req = createSyncRequest([], { client_time: skewedClientTime });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(409);
    expect((res.body as any).error).toBe('CLOCK_SKEW');
  });

  it('includes server_time in 409 CLOCK_SKEW response body for client clock synchronization', () => {
    const skewedClientTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const req = createSyncRequest([], { client_time: skewedClientTime });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(409);
    expect((res.body as any).server_time).toBeDefined();
    expect(!isNaN(Date.parse((res.body as any).server_time))).toBe(true);
  });

  it('rejects individual mutation whose updated_at is > 5 minutes in future into rejected array', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const futureUpdatedAt = new Date(serverTimeMs + 6 * 60 * 1000).toISOString();

    const futureHabit = createHabit({
      nama: 'Future Habit Attack',
      updated_at: futureUpdatedAt
    });

    const mutation = createMutation('habits', futureHabit, 'future-mut-01');
    const req = createSyncRequest([mutation], {
      client_time: harness.server.getServerTimeIso() // Valid request client_time
    });

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(200);

    const body = res.body as any;
    expect(body.applied).not.toContain('future-mut-01');
    expect(body.rejected.length).toBe(1);
    expect(body.rejected[0].mutation_id).toBe('future-mut-01');
    expect(body.rejected[0].reason).toMatch(/future/i);
    expect(harness.server.habits.has(futureHabit.id)).toBe(false);
  });

  it('accepts sync requests and mutations within the 5 minutes clock tolerance window', () => {
    const serverTimeMs = harness.server.getServerTime().getTime();
    const validClientTime = new Date(serverTimeMs + 4 * 60 * 1000).toISOString(); // +4 min (within window)

    const validHabit = createHabit({
      nama: 'Tolerance Habit',
      updated_at: validClientTime
    });

    const mutation = createMutation('habits', validHabit, 'valid-mut-01');
    const req = createSyncRequest([mutation], { client_time: validClientTime });

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(200);

    const body = res.body as any;
    expect(body.applied).toContain('valid-mut-01');
    expect(body.rejected.length).toBe(0);
    expect(harness.server.habits.has(validHabit.id)).toBe(true);
  });
});
