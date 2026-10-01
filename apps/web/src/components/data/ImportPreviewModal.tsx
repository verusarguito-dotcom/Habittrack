import React, { useState } from 'react';
import type { ImportPreviewStats } from '../../utils/exportImport.js';
import { WarningIcon, CloseIcon } from '../common/Icons.js';

export interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  stats: ImportPreviewStats;
  onConfirm: (mode: 'merge' | 'clean_restore') => Promise<void>;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  onClose,
  fileName,
  stats,
  onConfirm
}) => {
  const [selectedMode, setSelectedMode] = useState<'merge' | 'clean_restore'>('merge');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedMode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 md:p-6 shadow-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
              Pratinjau Data Impor
            </span>
            <h2 id="import-dialog-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Pulihkan Berkas Cadangan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* File info and statistics pills */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Nama Berkas:</span>
            <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[240px]">
              {fileName}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Stempel Ekspor:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {new Date(stats.exportedAt).toLocaleString('id-ID')}
            </span>
          </div>
          {stats.sourceDeviceId && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Perangkat Asal:</span>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                {stats.sourceDeviceId}
              </span>
            </div>
          )}

          {/* Stats Badges */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <div className="text-base font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                {stats.habitCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Habit</div>
            </div>
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <div className="text-base font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {stats.logCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Log</div>
            </div>
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {stats.scheduleCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Jadwal</div>
            </div>
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <div className="text-base font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {stats.categoryCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Kategori</div>
            </div>
          </div>
        </div>

        {/* Merge Mode Options */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Pilih Strategi Penerapan:
          </span>

          {/* Option A: Merge LWW */}
          <label
            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              selectedMode === 'merge'
                ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
            }`}
          >
            <input
              type="radio"
              name="import-mode"
              value="merge"
              checked={selectedMode === 'merge'}
              onChange={() => setSelectedMode('merge')}
              className="mt-0.5 text-teal-600 focus:ring-teal-500"
            />
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">
                Gabungkan (Merge LWW) — Rekomendasi Aman
              </span>
              <span className="text-slate-500 dark:text-slate-400 mt-0.5">
                Memadukan data tanpa menghapus riwayat lokal yang sudah ada. Record dengan timestamp lebih baru dipertahankan secara otomatis.
              </span>
            </div>
          </label>

          {/* Option B: Clean Restore */}
          <label
            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              selectedMode === 'clean_restore'
                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
            }`}
          >
            <input
              type="radio"
              name="import-mode"
              value="clean_restore"
              checked={selectedMode === 'clean_restore'}
              onChange={() => setSelectedMode('clean_restore')}
              className="mt-0.5 text-rose-600 focus:ring-rose-500"
            />
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Pulihkan Bersih (Clean Restore)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold">
                  Timpa Total
                </span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 mt-0.5">
                Mengosongkan semua data lokal peramban saat ini, lalu menggantinya 100% dengan isi berkas cadangan ini.
              </span>
            </div>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <WarningIcon className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-95 ${
              selectedMode === 'clean_restore'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {isSubmitting ? 'Memproses Impor...' : 'Terapkan Impor Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
