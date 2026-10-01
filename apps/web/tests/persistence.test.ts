import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  registerStoragePersistence,
  isStoragePersisted,
  getStorageEstimate
} from '../src/db/persistence.js';

describe('Client Storage Persistence (T009)', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  it('registers persistent storage with navigator.storage.persist() on startup', async () => {
    let persistCalled = false;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(false),
          persist: vi.fn().mockImplementation(async () => {
            persistCalled = true;
            return true;
          }),
          estimate: vi.fn().mockResolvedValue({ quota: 1000000, usage: 1000 })
        }
      },
      writable: true,
      configurable: true
    });

    const result = await registerStoragePersistence();
    expect(result).toBe(true);
    expect(persistCalled).toBe(true);
  });

  it('skips persist() if already persisted', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(true),
          persist: persistMock,
          estimate: vi.fn().mockResolvedValue({ quota: 1000000, usage: 1000 })
        }
      },
      writable: true,
      configurable: true
    });

    const result = await registerStoragePersistence();
    expect(result).toBe(true);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('handles environment where navigator.storage is undefined gracefully', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true
    });

    const persisted = await registerStoragePersistence();
    expect(persisted).toBe(false);

    const isPersist = await isStoragePersisted();
    expect(isPersist).toBe(false);

    const est = await getStorageEstimate();
    expect(est.quota).toBe(0);
    expect(est.usage).toBe(0);
  });

  it('queries storage estimate returning quota and usage safely', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(true),
          persist: vi.fn().mockResolvedValue(true),
          estimate: vi.fn().mockResolvedValue({ quota: 50000000, usage: 123456 })
        }
      },
      writable: true,
      configurable: true
    });

    const est = await getStorageEstimate();
    expect(est.quota).toBe(50000000);
    expect(est.usage).toBe(123456);
  });
});
