import React, { useState, useEffect, useRef } from 'react';
import type { VibeHabitDatabase } from '../db/database.js';
import type { Setting } from '@vibehabit/shared';
import { liveQuery } from 'dexie';
import {
  DownloadIcon,
  UploadIcon,
  TableIcon,
  RefreshIcon,
  DatabaseIcon,
  CheckCircleIcon,
  WarningIcon,
  TrashIcon,
  GearIcon
} from '../components/common/Icons.js';
import {
  exportDatabaseToJson,
  triggerJsonDownload,
  exportHabitsToCsv,
  validateBackupJson,
  importBackupData,
  LAST_BACKUP_KEY,
  LAST_SYNC_KEY,
  type ValidationResult
} from '../utils/exportImport.js';
import { ImportPreviewModal } from '../components/data/ImportPreviewModal.js';
import { BackupWarnings } from '../components/data/BackupWarnings.js';
import { DeviceTokenForm } from '../components/data/DeviceTokenForm.js';
import { saveSetting } from '../db/operations.js';
import { useTheme } from '../theme/ThemeContext.js';

export interface DataManagementProps {
  db: VibeHabitDatabase;
  deviceId: string;
  onTriggerSync?: () => Promise<void>;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  db,
  deviceId,
  onTriggerSync
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  let theme: 'light' | 'dark' | 'system' = 'system';
  let setTheme: (theme: 'light' | 'dark' | 'system') => void = () => {};
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    setTheme = themeContext.setTheme;
  } catch {
    // Fallback if rendered outside ThemeProvider
  }

  // Database live statistics
  const [habitCount, setHabitCount] = useState<number>(0);
  const [logCount, setLogCount] = useState<number>(0);
  const [scheduleCount, setScheduleCount] = useState<number>(0);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [currentSetting, setCurrentSetting] = useState<Setting | undefined>(undefined);

  // Storage estimate
  const [storageUsageMb, setStorageUsageMb] = useState<string>('0.5');

  // Timestamps
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Import flow state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<ValidationResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Danger zone state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Live queries
  useEffect(() => {
    const subHabits = liveQuery(() => db.habits.filter((h) => !h.deleted_at).count()).subscribe({
      next: (count) => setHabitCount(count),
      error: (err) => console.warn('Error counting habits:', err)
    });

    const subLogs = liveQuery(() => db.logs.filter((l) => !l.deleted_at).count()).subscribe({
      next: (count) => setLogCount(count),
      error: (err) => console.warn('Error counting logs:', err)
    });

    const subSchedules = liveQuery(() => db.habit_schedules.filter((s) => !s.deleted_at).count()).subscribe({
      next: (count) => setScheduleCount(count),
      error: (err) => console.warn('Error counting schedules:', err)
    });

    const subOutbox = liveQuery(() => db.outbox.count()).subscribe({
      next: (count) => setOutboxCount(count),
      error: (err) => console.warn('Error counting outbox:', err)
    });

    const subSetting = liveQuery(() => db.settings.filter((s) => !s.deleted_at).first()).subscribe({
      next: (setting) => setCurrentSetting(setting),
      error: (err) => console.warn('Error observing setting:', err)
    });

    return () => {
      subHabits.unsubscribe();
      subLogs.unsubscribe();
      subSchedules.unsubscribe();
      subOutbox.unsubscribe();
      subSetting.unsubscribe();
    };
  }, [db]);

  // Load localStorage timestamps & quota
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        setLastBackupTime(localStorage.getItem(LAST_BACKUP_KEY));
        setLastSyncTime(localStorage.getItem(LAST_SYNC_KEY));
      }

      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          if (est.usage) {
            setStorageUsageMb((est.usage / (1024 * 1024)).toFixed(1));
          }
        });
      }
    } catch (err) {
      console.warn('Storage estimate check failed:', err);
    }
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // 1. Export JSON action
  const handleExportJson = async () => {
    try {
      const backup = await exportDatabaseToJson(db, deviceId);
      const dateStr = backup.exported_at.split('T')[0];
      const filename = `vibehabit_backup_${dateStr}.json`;
      triggerJsonDownload(backup, filename);
      setLastBackupTime(backup.exported_at);
      showFeedback('success', `Berkas cadangan "${filename}" berhasil diekspor.`);
    } catch (err) {
      showFeedback('error', `Gagal mengekspor data JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 2. Export CSV action
  const handleExportCsv = async () => {
    try {
      const csvContent = await exportHabitsToCsv(db);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `vibehabit_analisis_${dateStr}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showFeedback('success', `Berkas CSV "${filename}" berhasil diunduh untuk analisis eksternal.`);
    } catch (err) {
      showFeedback('error', `Gagal mengekspor CSV: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 3. File Input change handler
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const validation = validateBackupJson(text);

      if (!validation.valid || !validation.data || !validation.stats) {
        showFeedback('error', validation.error || 'Berkas JSON tidak sesuai skema valid.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setPendingBackupData(validation);
      setImportModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      showFeedback('error', 'Gagal membaca berkas dari disk lokal.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // 4. Confirm Import execution
  const handleConfirmImport = async (mode: 'merge' | 'clean_restore') => {
    if (!pendingBackupData?.data) return;

    const result = await importBackupData(db, pendingBackupData.data, mode, deviceId);
    setLastBackupTime(new Date().toISOString());

    const { habits, logs } = result.stats;
    showFeedback(
      'success',
      mode === 'clean_restore'
        ? `Pemulihan bersih selesai! ${habits} habit & ${logs} log diterapkan.`
        : `Penggabungan LWW sukses! ${habits} habit & ${logs} log diperbarui.`
    );
  };

  // 5. Day start hour preference update
  const handleDayStartHourChange = async (newHour: string) => {
    try {
      const existingSetting = currentSetting || {
        id: crypto.randomUUID(),
        jam_mulai_hari: '00:00',
        theme: 'system' as const,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      const updated: Setting = {
        ...existingSetting,
        jam_mulai_hari: newHour,
        updated_at: new Date().toISOString(),
        device_id: deviceId
      };

      await saveSetting(db, updated, deviceId);
      showFeedback('success', `Jam mulai hari diperbarui ke ${newHour}.`);
    } catch (err) {
      showFeedback('error', `Gagal mengubah jam mulai hari: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 6. Manual Trigger Sync
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (onTriggerSync) {
        await onTriggerSync();
      }
      const nowIso = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LAST_SYNC_KEY, nowIso);
      }
      setLastSyncTime(nowIso);
      showFeedback('success', 'Sinkronisasi berhasil diselesaikan.');
    } catch (err) {
      showFeedback('error', `Sinkronisasi gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 7. Clear outbox queue
  const handleClearOutbox = async () => {
    try {
      await db.outbox.clear();
      showFeedback('success', 'Antrean outbox sinkronisasi berhasil dikosongkan.');
    } catch (err) {
      showFeedback('error', `Gagal mengosongkan antrean: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 8. Reset local database
  const handleResetDatabase = async () => {
    if (resetConfirmationInput !== 'RESET') {
      showFeedback('error', 'Ketik kata "RESET" dengan tepat untuk mengonfirmasi.');
      return;
    }

    try {
      await db.transaction('rw', [db.categories, db.habits, db.habit_schedules, db.logs, db.settings, db.outbox], async () => {
        await Promise.all([
          db.categories.clear(),
          db.habits.clear(),
          db.habit_schedules.clear(),
          db.logs.clear(),
          db.settings.clear(),
          db.outbox.clear()
        ]);
      });
      setIsResetConfirmOpen(false);
      setResetConfirmationInput('');
      showFeedback('success', 'Seluruh data lokal di peramban ini telah direset.');
    } catch (err) {
      showFeedback('error', `Gagal mereset data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6 w-full animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] font-semibold tracking-wider text-teal-600 dark:text-teal-400 uppercase">
          Kedaulatan &amp; Pengelolaan Data
        </span>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Data &amp; Pengaturan
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kelola pencadangan mandiri, pemulihan bencana lapisan 4, preferensi biologis, dan koneksi server
        </p>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircleIcon className="w-4 h-4 flex-shrink-0 text-teal-600" />
          ) : (
            <WarningIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Safety Warnings Banner (PRD §8.4) */}
      <BackupWarnings
        lastSyncAt={lastSyncTime}
        lastBackupAt={lastBackupTime}
        onSyncClick={handleManualSync}
        onExportClick={handleExportJson}
      />

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Left Column: Sync Status & Storage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 md:gap-5">
          {/* Card: Status Sinkronisasi & Server Pribadi */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <RefreshIcon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Status Sinkronisasi &amp; Server Pribadi
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Protokol Tailscale HTTPS :8443 → Fastify PostgreSQL
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    outboxCount > 0
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                      : 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      outboxCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-teal-500'
                    }`}
                  />
                  <span>
                    {outboxCount > 0 ? `${outboxCount} Menunggu` : 'Tersinkron'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Jalur Server (Private Net)</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono truncate">
                    Tailscale HTTPS :8443
                  </span>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                    Terenkripsi E2E • Zero Public Port
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Stempel Sinkronisasi Terakhir</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {lastSyncTime ? new Date(lastSyncTime).toLocaleString('id-ID') : 'Belum pernah'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ID Perangkat: {deviceId.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-70"
            >
              <RefreshIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sedang Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
            </button>
          </div>

          {/* Card: Local-First Storage Info */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 pb-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <DatabaseIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Penyimpanan Lokal (IndexedDB)
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Mesin Dexie.js v4.0 • Zero-Latency Local-First Engine
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {habitCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Habit Aktif</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {logCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Log Harian</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {scheduleCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Jadwal Aktif</div>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Estimasi Ukuran Basis Data Lokal:
                </span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  ~{storageUsageMb} MB terpakai
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <CheckCircleIcon className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span>
                Data tersimpan persisten di perangkat. Bekerja 100% offline tanpa sambungan internet.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Preferences & Device Token (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 md:gap-5">
          {/* Card: Preferensi Lingkungan & Waktu */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <GearIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Preferensi Biologis &amp; Tampilan
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Ritme pergantian hari dan estetika antarmuka
                </span>
              </div>
            </div>

            {/* Jam Mulai Hari Preference */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Jam Mulai Hari (Reset Harian)
                </span>
                <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400 font-semibold">
                  {currentSetting?.jam_mulai_hari || '00:00'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih pukul berapa hari baru dimulai agar aktivitas malam hari (begadang) tidak memutus streak (PRD §7.1).
              </p>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['00:00', '03:00', '04:00', '05:00'].map((hour) => {
                  const isSelected = (currentSetting?.jam_mulai_hari || '00:00') === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => handleDayStartHourChange(hour)}
                      className={`py-1 rounded-lg text-xs font-medium font-mono transition-all ${
                        isSelected
                          ? 'bg-teal-600 text-white font-bold shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-500'
                      }`}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Switcher Preference */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Tema Visual
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nuansa Serene Focus
                </span>
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`px-2 py-1 rounded-md capitalize font-medium transition-all ${
                      theme === mode
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'system' ? 'Sistem' : mode === 'light' ? 'Terang' : 'Gelap'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Device Bearer Token Form */}
          <DeviceTokenForm />
        </div>
      </div>

      {/* Full Width Card: Kedaulatan & Backup Data Mandiri (PRD P0-7 & Lapisan 4) */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <DownloadIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Kedaulatan &amp; Backup Data Mandiri
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ekspor berkas standar terbuka, pemulihan instan tanpa ketergantungan platform (PRD P0-7)
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Ekspor Terakhir:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {lastBackupTime ? new Date(lastBackupTime).toLocaleDateString('id-ID') : 'Belum pernah'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Action 1: Export JSON */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-semibold">
                <DownloadIcon className="w-4 h-4 text-teal-600" />
                <span>Ekspor JSON Penuh</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Struktur utuh seluruh kategori, kebiasaan, versi jadwal, riwayat checklist, dan pengaturan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Unduh Berkas JSON</span>
            </button>
          </div>

          {/* Action 2: Export CSV */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-semibold">
                <TableIcon className="w-4 h-4 text-sky-600" />
                <span>Ekspor CSV / Tabel</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Format tabel baris-kolom bersih untuk dianalisis lebih lanjut di Excel, Google Sheets, atau Pandas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Unduh Berkas CSV</span>
            </button>
          </div>

          {/* Action 3: Import JSON */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-semibold">
                <UploadIcon className="w-4 h-4 text-indigo-600" />
                <span>Impor &amp; Pulihkan Cadangan</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Validasi skema Zod dengan pratinjau statistik sebelum menerapkan penggabungan aman.
              </p>
            </div>
            <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all active:scale-95 text-center">
              <UploadIcon className="w-3.5 h-3.5" />
              <span>Pilih Berkas JSON</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelected}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 pb-1">
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
            <WarningIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400">
              Zona Bahaya &amp; Sanitasi Lokal
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Operasi pembersihan antrean dan reset penyimpanan perangkat
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Clean outbox cache */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Bersihkan Antrean Outbox Sinkronisasi
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Menghapus antrean mutasi yang tertunda tanpa menghapus catatan log kebiasaan lokal Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearOutbox}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <span>Kosongkan Antrean Outbox</span>
            </button>
          </div>

          {/* Reset local data */}
          <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                Reset Data Lokal Perangkat
              </span>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Menghapus total semua habit, jadwal, dan log di peramban ini. Pastikan Anda telah mengunduh cadangan JSON.
              </p>
            </div>
            {isResetConfirmOpen ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Ketik RESET untuk konfirmasi"
                  value={resetConfirmationInput}
                  onChange={(e) => setResetConfirmationInput(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetConfirmOpen(false);
                      setResetConfirmationInput('');
                    }}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDatabase}
                    disabled={resetConfirmationInput !== 'RESET'}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                  >
                    Hapus Total
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>Reset Data Perangkat Ini</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {pendingBackupData?.data && pendingBackupData.stats && (
        <ImportPreviewModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          fileName={selectedFileName}
          stats={pendingBackupData.stats}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
};
