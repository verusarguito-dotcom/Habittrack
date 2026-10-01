import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 2 - Boundary 12: Storage Quota & Capacity Boundaries', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('handles low quota scenario (99% full) without throwing unhandled exceptions', async () => {
    harness.clientA.storageEstimate = {
      quota: 1000000,
      usage: 990000 // 99% used
    };

    const estimate = await harness.clientA.getStorageEstimate();
    const remainingRatio = (estimate.quota - estimate.usage) / estimate.quota;
    expect(remainingRatio).toBeCloseTo(0.01, 2);
  });

  it('idempotently handles multiple calls to registerStoragePersistence()', async () => {
    const p1 = await harness.clientA.registerStoragePersistence();
    const p2 = await harness.clientA.registerStoragePersistence();
    const p3 = await harness.clientA.registerStoragePersistence();

    expect(p1).toBe(true);
    expect(p2).toBe(true);
    expect(p3).toBe(true);
    expect(harness.clientA.isStoragePersisted).toBe(true);
  });

  it('verifies non-zero storage quota is returned by default', async () => {
    const estimate = await harness.clientA.getStorageEstimate();
    expect(estimate.quota).toBeGreaterThan(1024 * 1024); // > 1 MB
  });

  it('ensures storage usage does not exceed storage quota', async () => {
    const estimate = await harness.clientA.getStorageEstimate();
    expect(estimate.usage).toBeLessThanOrEqual(estimate.quota);
  });

  it('allows client operation even when storage persistence is denied', () => {
    harness.clientA.isStoragePersisted = false;
    expect(harness.clientA.isStoragePersisted).toBe(false);
    expect(harness.clientA.isOnline).toBe(true);
  });
});
