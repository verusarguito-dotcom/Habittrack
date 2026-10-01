import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 16: Network Resilience, Backoff & UI State Machine', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('reports "Menunggu sinkron (n)" when offline with n uncommitted outbox items', () => {
    harness.disconnectClient(harness.clientA);
    const h1 = createHabit({ nama: 'Offline 1' });
    const h2 = createHabit({ nama: 'Offline 2' });

    harness.clientA.saveHabit(h1);
    harness.clientA.saveHabit(h2);

    expect(harness.clientA.syncState).toBe('Menunggu sinkron (2)');
  });

  it('reports "Server tidak terjangkau (Tailscale aktif?)" when server is down or unreachable', async () => {
    harness.server.setServerDown(true);
    const habit = createHabit({ nama: 'Unreachable Test' });
    harness.clientA.saveHabit(habit);

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(false);
    expect(res.error).toBe('SERVER_UNREACHABLE');
    expect(harness.clientA.syncState).toBe('Server tidak terjangkau (Tailscale aktif?)');
    expect(harness.clientA.retryAttempt).toBe(1);
  });

  it('reports "Jam perangkat tidak akurat (>5 menit)" when server responds with 409 CLOCK_SKEW', async () => {
    // Offset client clock by +10 minutes
    harness.clientA.setClockOffset(10 * 60 * 1000);
    const habit = createHabit({ nama: 'Clock Skewed Habit' });
    harness.clientA.saveHabit(habit);

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(false);
    expect(res.error).toBe('CLOCK_SKEW');
    expect(harness.clientA.syncState).toBe('Jam perangkat tidak akurat (>5 menit)');
  });

  it('computes exponential backoff between 2s and 60s with jitter', () => {
    // Attempt 0: base 2000ms * 2^0 = 2000ms + jitter
    const backoff0 = harness.clientA.calculateBackoffMs(0, 0);
    expect(backoff0).toBe(2000);

    // Attempt 1: base 2000ms * 2^1 = 4000ms
    const backoff1 = harness.clientA.calculateBackoffMs(1, 0);
    expect(backoff1).toBe(4000);

    // Attempt 2: base 2000ms * 2^2 = 8000ms
    const backoff2 = harness.clientA.calculateBackoffMs(2, 0);
    expect(backoff2).toBe(8000);

    // Attempt 10: capped at 60,000ms (60s)
    const backoff10 = harness.clientA.calculateBackoffMs(10, 0);
    expect(backoff10).toBe(60000);

    // With 10% jitter
    const backoffWithJitter = harness.clientA.calculateBackoffMs(0, 0.1);
    expect(backoffWithJitter).toBe(2200);
  });

  it('resumes automatic synchronization and resets retry counter when network is restored', async () => {
    harness.server.setServerDown(true);
    const habit = createHabit({ nama: 'Recovered Habit' });
    harness.clientA.saveHabit(habit);

    await harness.clientA.sync(harness.server);
    expect(harness.clientA.retryAttempt).toBe(1);

    // Server recovers
    harness.server.setServerDown(false);
    const res = await harness.clientA.sync(harness.server);

    expect(res.success).toBe(true);
    expect(harness.clientA.retryAttempt).toBe(0);
    expect(harness.clientA.syncState).toBe('Tersinkron');
    expect(harness.server.habits.has(habit.id)).toBe(true);
  });
});
