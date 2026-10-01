/**
 * Local device identification utilities.
 */

const DEVICE_ID_KEY = 'vibehabit_device_id';

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default-dev-device-01';
  }
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
