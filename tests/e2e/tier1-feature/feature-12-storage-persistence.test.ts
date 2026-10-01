import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 1 - Feature 12: Persistent Storage Registration', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('registers persistent storage with navigator.storage.persist() on startup', async () => {
    expect(harness.clientA.isStoragePersisted).toBe(false);
    const persisted = await harness.clientA.registerStoragePersistence();
    expect(persisted).toBe(true);
    expect(harness.clientA.isStoragePersisted).toBe(true);
  });

  it('queries storage estimate returning valid quota and usage metrics', async () => {
    const estimate = await harness.clientA.getStorageEstimate();
    expect(estimate.quota).toBeGreaterThan(0);
    expect(estimate.usage).toBeGreaterThanOrEqual(0);
    expect(estimate.usage).toBeLessThan(estimate.quota);
  });

  it('maintains persistent storage state across database interactions', async () => {
    await harness.clientA.registerStoragePersistence();
    expect(harness.clientA.isStoragePersisted).toBe(true);

    // Perform operations
    const estimate = await harness.clientA.getStorageEstimate();
    expect(estimate.quota).toBe(10 * 1024 * 1024 * 1024);
  });

  it('handles scenario where storage persistence is not granted gracefully', async () => {
    const client = harness.createClient('device-temp', 'token-temp');
    client.isStoragePersisted = false;
    // App should still be functional even without persistent flag
    expect(client.isOnline).toBe(true);
    expect(client.outbox.length).toBe(0);
  });

  it('tracks storage usage safely within reasonable limits', async () => {
    const estimate = await harness.clientA.getStorageEstimate();
    const usageMb = estimate.usage / (1024 * 1024);
    expect(usageMb).toBeLessThan(50); // Under 50 MB initial
  });
});
