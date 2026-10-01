import { describe, it, expect } from 'vitest';
import { calculateBackoffMs } from '../src/sync/backoff.js';
import { SyncStateMachine } from '../src/sync/state.js';

describe('Network Resilience, Backoff & UI State Machine (T010)', () => {
  it('guarantees attempt 0 starts at base backoff of exactly 2000ms (without jitter)', () => {
    const backoff = calculateBackoffMs(0, 0);
    expect(backoff).toBe(2000);
  });

  it('caps exponential backoff strictly at 60,000ms for large attempt numbers (e.g. attempt 20)', () => {
    const backoffLarge = calculateBackoffMs(20, 0);
    expect(backoffLarge).toBe(60000);
  });

  it('ensures jitter adds non-negative random perturbation', () => {
    const base = calculateBackoffMs(2, 0);
    const withJitter = calculateBackoffMs(2, 0.2); // 20% jitter
    expect(withJitter).toBeGreaterThanOrEqual(base);
    expect(withJitter).toBeLessThanOrEqual(base * 1.25);
  });

  it('maintains strict monotonically non-decreasing backoff across sequential retry attempts', () => {
    let prev = 0;
    for (let i = 0; i <= 6; i++) {
      const current = calculateBackoffMs(i, 0);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  it('reports "Tersinkron" when outbox is empty and connected', () => {
    const sm = new SyncStateMachine();
    sm.update(0);
    expect(sm.getState()).toBe('Tersinkron');
  });

  it('reports "Menunggu sinkron (n)" when there are pending outbox items', () => {
    const sm = new SyncStateMachine();
    sm.update(3);
    expect(sm.getState()).toBe('Menunggu sinkron (3)');
  });

  it('reports "Server tidak terjangkau (Tailscale aktif?)" on server/network failure', () => {
    const sm = new SyncStateMachine();
    sm.setError('SERVER_UNREACHABLE');
    expect(sm.getState()).toBe('Server tidak terjangkau (Tailscale aktif?)');
  });

  it('reports "Jam perangkat tidak akurat (>5 menit)" on 409 clock skew', () => {
    const sm = new SyncStateMachine();
    sm.setError('CLOCK_SKEW');
    expect(sm.getState()).toBe('Jam perangkat tidak akurat (>5 menit)');
  });

  it('resets error state back to Tersinkron after successful sync with 0 pending items', () => {
    const sm = new SyncStateMachine();
    sm.setError('SERVER_UNREACHABLE');
    expect(sm.getState()).toBe('Server tidak terjangkau (Tailscale aktif?)');

    sm.clearError();
    sm.update(0);
    expect(sm.getState()).toBe('Tersinkron');
  });
});
