import React, { useState, useEffect } from 'react';
import { registerServiceWorker, activateWaitingServiceWorker } from '../../pwa/registerServiceWorker.js';

export interface ReloadPromptProps {
  needRefresh?: boolean;
  offlineReady?: boolean;
  onReload?: () => void;
  onDismiss?: () => void;
  /** Whether to auto-register SW when props are uncontrolled */
  autoRegister?: boolean;
}

export const ReloadPrompt: React.FC<ReloadPromptProps> = ({
  needRefresh: controlledNeedRefresh,
  offlineReady: controlledOfflineReady,
  onReload: controlledOnReload,
  onDismiss: controlledOnDismiss,
  autoRegister = false
}) => {
  const [internalNeedRefresh, setInternalNeedRefresh] = useState(false);
  const [internalOfflineReady, setInternalOfflineReady] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>();

  useEffect(() => {
    if (!autoRegister) return;

    registerServiceWorker('/sw.js', {
      onNeedRefresh: (reg) => {
        if (reg) setSwRegistration(reg);
        setInternalNeedRefresh(true);
      },
      onOfflineReady: () => setInternalOfflineReady(true)
    }).then((reg) => {
      if (reg) setSwRegistration(reg);
    });
  }, [autoRegister]);

  const isNeedRefresh = controlledNeedRefresh !== undefined ? controlledNeedRefresh : internalNeedRefresh;
  const isOfflineReady = controlledOfflineReady !== undefined ? controlledOfflineReady : internalOfflineReady;

  if (!isNeedRefresh && !isOfflineReady) {
    return null;
  }

  const handleReload = () => {
    if (controlledOnReload) {
      controlledOnReload();
    } else {
      if (swRegistration) {
        activateWaitingServiceWorker(swRegistration);
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  const handleDismiss = () => {
    if (controlledOnDismiss) {
      controlledOnDismiss();
    } else {
      setInternalNeedRefresh(false);
      setInternalOfflineReady(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Pemberitahuan Pembaruan Aplikasi"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:right-6 md:max-w-md z-50 p-4 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-xl border border-slate-200 dark:border-slate-700 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isNeedRefresh ? (
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isNeedRefresh ? 'Pembaruan Tersedia' : 'Aplikasi Siap Digunakan Offline'}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {isNeedRefresh
              ? 'Versi baru VibeHabit siap digunakan. Muat ulang untuk menerapkan pembaruan.'
              : 'Seluruh fitur inti VibeHabit kini dapat diakses 100% tanpa internet.'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {isNeedRefresh && (
              <button
                type="button"
                onClick={handleReload}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-700 active:scale-95 text-white transition-all shadow-sm"
              >
                Muat Ulang
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 transition-all"
            >
              {isNeedRefresh ? 'Nanti' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
