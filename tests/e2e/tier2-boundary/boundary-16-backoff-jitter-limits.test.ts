import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 2 - Boundary 16: Backoff & Jitter Limit Constraints', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('guarantees attempt 0 starts at base backoff of exactly 2000ms (without jitter)', () => {
    const backoff = harness.clientA.calculateBackoffMs(0, 0);
    expect(backoff).toBe(2000);
  });

  it('caps exponential backoff strictly at 60,000ms for large attempt numbers (e.g. attempt 20)', () => {
    const backoffLarge = harness.clientA.calculateBackoffMs(20, 0);
    expect(backoffLarge).toBe(60000);
  });

  it('ensures jitter adds non-negative random perturbation', () => {
    const base = harness.clientA.calculateBackoffMs(2, 0);
    const withJitter = harness.clientA.calculateBackoffMs(2, 0.2); // 20% jitter
    expect(withJitter).toBeGreaterThanOrEqual(base);
    expect(withJitter).toBeLessThanOrEqual(base * 1.25);
  });

  it('maintains strict monotonically non-decreasing backoff across sequential retry attempts', () => {
    let prev = 0;
    for (let i = 0; i <= 6; i++) {
      const current = harness.clientA.calculateBackoffMs(i, 0);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  it('resets retry attempt counter back to 0 immediately upon successful sync', async () => {
    harness.clientA.retryAttempt = 5;
    harness.clientA.updateUiSyncState('Server tidak terjangkau (Tailscale aktif?)');

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(harness.clientA.retryAttempt).toBe(0);
    expect(harness.clientA.syncState).toBe('Tersinkron');
  });
});
