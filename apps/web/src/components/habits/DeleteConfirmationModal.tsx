import React from 'react';
import type { Habit } from '@vibehabit/shared';
import { WarningIcon, TrashIcon } from '../common/Icons.js';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  habit: Habit | null;
  totalLogsCount: number;
  streakDays: number;
  isDeleting?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  habit,
  totalLogsCount,
  streakDays,
  isDeleting = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !habit) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 md:p-6 flex flex-col items-center text-center">
        {/* Warning Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
          <TrashIcon className="w-6 h-6" />
        </div>

        {/* Title */}
        <h2 id="delete-dialog-title" className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
          Hapus &ldquo;{habit.nama}&rdquo;?
        </h2>

        {/* Description */}
        <p id="delete-dialog-desc" className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          Tindakan ini akan menghapus kebiasaan beserta seluruh riwayat catatan dan jadwal secara permanen dari perangkat ini.
        </p>

        {/* Data Loss Warning Box */}
        <div className="w-full mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <WarningIcon className="w-4 h-4 flex-shrink-0" />
          <span>
            {totalLogsCount} log riwayat • Streak {streakDays} hari akan dihapus
          </span>
        </div>

        {/* Action Buttons */}
        <div className="w-full mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full h-11 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <TrashIcon className="w-4 h-4" />
            <span>{isDeleting ? 'Menghapus...' : 'Hapus Permanen'}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
