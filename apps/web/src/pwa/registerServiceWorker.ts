export interface ServiceWorkerRegistrationCallbacks {
  onNeedRefresh?: (registration?: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Register service worker for PWA offline shell capability.
 * Safely checks for browser support and handles lifecycle events.
 */
export async function registerServiceWorker(
  swUrl: string = '/sw.js',
  callbacks?: ServiceWorkerRegistrationCallbacks
): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    // If an updated worker is already waiting to activate
    if (registration.waiting) {
      callbacks?.onNeedRefresh?.(registration);
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New version ready to reload
            callbacks?.onNeedRefresh?.(registration);
          } else {
            // Content cached for offline use
            callbacks?.onOfflineReady?.();
          }
        }
      });
    });

    return registration;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks?.onError?.(error);
    return undefined;
  }
}

/**
 * Sends SKIP_WAITING to waiting worker to activate new version immediately.
 */
export function activateWaitingServiceWorker(registration?: ServiceWorkerRegistration): void {
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}
