import type { StorageEstimate } from './types.js';

export async function registerStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
          return true;
        }
      }
      if (typeof navigator.storage.persist === 'function') {
        return await navigator.storage.persist();
      }
    } catch {
      return false;
    }
  }
  return false;
}

export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        return await navigator.storage.persisted();
      }
    } catch {
      return false;
    }
  }
  return false;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        return {
          quota: est.quota ?? 0,
          usage: est.usage ?? 0
        };
      }
    } catch {
      return { quota: 0, usage: 0 };
    }
  }
  return { quota: 0, usage: 0 };
}
