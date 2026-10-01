import React from 'react';
import { WarningIcon, RefreshIcon, DownloadIcon } from '../common/Icons.js';

export interface BackupWarningsProps {
  lastSyncAt?: string | null;
  lastBackupAt?: string | null;
  onSyncClick?: () => void;
  onExportClick?: () => void;
}

export const BackupWarnings: React.FC<BackupWarningsProps> = ({
  lastSyncAt,
  lastBackupAt,
  onSyncClick,
  onExportClick
}) => {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let isSyncOverdue = false;
  let syncDaysAgo = 0;
  if (!lastSyncAt) {
    isSyncOverdue = true;
    syncDaysAgo = -1; // never
  } else {
    const syncMs = Date.parse(lastSyncAt);
    if (!isNaN(syncMs)) {
      syncDaysAgo = Math.floor((nowMs - syncMs) / dayMs);
      if (syncDaysAgo >= 7) {
        isSyncOverdue = true;
      }
    }
  }

  let isBackupOverdue = false;
  let backupDaysAgo = 0;
  if (!lastBackupAt) {
    isBackupOverdue = true;
    backupDaysAgo = -1; // never
  } else {
    const backupMs = Date.parse(lastBackupAt);
    if (!isNaN(backupMs)) {
      backupDaysAgo = Math.floor((nowMs - backupMs) / dayMs);
      if (backupDaysAgo >= 30) {
        isBackupOverdue = true;
      }
    }
  }

  if (!isSyncOverdue && !isBackupOverdue) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {isSyncOverdue && (
        <div className="p-3.5 md:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
              <WarningIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs">
              <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                Peringatan Sinkronisasi (PRD §8.4)
              </span>
              <span className="mt-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {syncDaysAgo < 0
                  ? 'Perangkat ini belum pernah berhasil melakukan sinkronisasi ke server VPS.'
                  : `Sinkronisasi terakhir berhasil ${syncDaysAgo} hari lalu (melebihi batas aman 7 hari).`}
              </span>
            </div>
          </div>
          {onSyncClick && (
            <button
              type="button"
              onClick={onSyncClick}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm self-end sm:self-auto transition-all active:scale-95"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              <span>Sinkronkan Sekarang</span>
            </button>
          )}
        </div>
      )}

      {isBackupOverdue && (
        <div className="p-3.5 md:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
              <WarningIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs">
              <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                Peringatan Perlindungan Cadangan Data
              </span>
              <span className="mt-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {backupDaysAgo < 0
                  ? 'Belum ada berkas cadangan JSON yang diekspor dari peramban ini.'
                  : `Cadangan data JSON terakhir diekspor ${backupDaysAgo} hari lalu (melebihi batas aman 30 hari).`}
              </span>
            </div>
          </div>
          {onExportClick && (
            <button
              type="button"
              onClick={onExportClick}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm self-end sm:self-auto transition-all active:scale-95"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Ekspor Cadangan Sekarang</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
