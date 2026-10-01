import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';
import { createDatabase, type VibeHabitDatabase } from '../src/db/database.js';
import {
  saveCategory,
  saveHabit,
  saveHabitSchedule,
  saveHabitLog,
  saveSetting
} from '../src/db/operations.js';
import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  BackupData
} from '@vibehabit/shared';
import {
  exportDatabaseToJson,
  exportHabitsToCsv,
  validateBackupJson,
  importBackupData,
  LAST_BACKUP_KEY,
  LAST_SYNC_KEY,
  DEVICE_TOKEN_KEY
} from '../src/utils/exportImport.js';
import { BackupWarnings } from '../src/components/data/BackupWarnings.js';
import { DeviceTokenForm } from '../src/components/data/DeviceTokenForm.js';
import { ImportPreviewModal } from '../src/components/data/ImportPreviewModal.js';
import { DataManagement } from '../src/pages/DataManagement.js';

describe('Data Management & Disaster Recovery (T015)', () => {
  let db: VibeHabitDatabase;
  const testDeviceId = 'device-laptop-test';
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const nowIso = new Date().toISOString();

  beforeEach(() => {
    db = createDatabase(`test_data_${Date.now()}_${Math.random()}`);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('exportDatabaseToJson & exportHabitsToCsv', () => {
    it('creates a complete structured JSON backup matching backupDataSchema', async () => {
      // Seed data
      const cat: Category = {
        id: validUuid,
        nama: 'Kebugaran',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveCategory(db, cat, testDeviceId);

      const habit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        nama: 'Lari Pagi',
        category_id: cat.id,
        mode: 'quantitative',
        satuan: 'km',
        archived: false,
        created_date: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, habit, testDeviceId);

      const schedule: HabitSchedule = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        habit_id: habit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 5,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabitSchedule(db, schedule, testDeviceId);

      const log: HabitLog = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        habit_id: habit.id,
        tanggal: '2026-09-24',
        nilai: 5.2,
        selesai: true,
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabitLog(db, log, testDeviceId);

      const setting: Setting = {
        id: '123e4567-e89b-12d3-a456-426614174005',
        jam_mulai_hari: '04:00',
        theme: 'dark',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveSetting(db, setting, testDeviceId);

      const backup = await exportDatabaseToJson(db, testDeviceId);

      expect(backup.version).toBe(1);
      expect(backup.device_id).toBe(testDeviceId);
      expect(backup.data.categories).toHaveLength(1);
      expect(backup.data.habits).toHaveLength(1);
      expect(backup.data.habit_schedules).toHaveLength(1);
      expect(backup.data.logs).toHaveLength(1);
      expect(backup.data.settings).toHaveLength(1);

      // Verify localStorage recorded last backup time
      if (typeof localStorage !== 'undefined') {
        expect(localStorage.getItem(LAST_BACKUP_KEY)).toBe(backup.exported_at);
      }
    });

    it('generates a CSV formatted string with correct headers and values', async () => {
      const habit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        nama: 'Membaca Buku',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, habit, testDeviceId);

      const log: HabitLog = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        habit_id: habit.id,
        tanggal: '2026-09-20',
        nilai: null,
        selesai: true,
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabitLog(db, log, testDeviceId);

      // Add earlier log inserted later to verify chronological sorting
      const earlierLog: HabitLog = {
        id: '123e4567-e89b-12d3-a456-426614174006',
        habit_id: habit.id,
        tanggal: '2026-09-18',
        nilai: null,
        selesai: true,
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabitLog(db, earlierLog, testDeviceId);

      const csv = await exportHabitsToCsv(db);
      expect(csv).toContain('Habit,Kategori,Mode,Tanggal,Nilai,Satuan,Selesai');
      expect(csv).toContain('"Membaca Buku",Tanpa Kategori,checklist,2026-09-20,,,1');
      expect(csv).toContain('"Membaca Buku",Tanpa Kategori,checklist,2026-09-18,,,1');

      // Verify 2026-09-18 appears before 2026-09-20 in CSV lines
      const pos18 = csv.indexOf('2026-09-18');
      const pos20 = csv.indexOf('2026-09-20');
      expect(pos18).toBeLessThan(pos20);
    });
  });

  describe('validateBackupJson', () => {
    it('accepts valid JSON snapshots and computes preview statistics', () => {
      const validBackup: BackupData = {
        version: 1,
        exported_at: nowIso,
        app_version: '0.1.0',
        device_id: 'phone-1',
        data: {
          categories: [],
          habits: [
            {
              id: validUuid,
              nama: 'Olahraga',
              category_id: null,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'phone-1'
            }
          ],
          habit_schedules: [],
          logs: [],
          settings: []
        }
      };

      const result = validateBackupJson(validBackup);
      expect(result.valid).toBe(true);
      expect(result.stats?.habitCount).toBe(1);
      expect(result.stats?.logCount).toBe(0);
      expect(result.stats?.sourceDeviceId).toBe('phone-1');
    });

    it('rejects invalid JSON string or schema violation', () => {
      const resultInvalidString = validateBackupJson('{ malformed json');
      expect(resultInvalidString.valid).toBe(false);

      const resultInvalidSchema = validateBackupJson({ version: 'not-a-number' });
      expect(resultInvalidSchema.valid).toBe(false);
      expect(resultInvalidSchema.error).toContain('Format berkas cadangan tidak valid');
    });
  });

  describe('importBackupData (Merge LWW & Clean Restore)', () => {
    it('performs safe Merge LWW without overwriting newer local records', async () => {
      const oldTime = '2026-09-20T10:00:00.000Z';
      const newTime = '2026-09-24T10:00:00.000Z';

      // Local habit with newer timestamp
      const localHabit: Habit = {
        id: validUuid,
        nama: 'Versi Lokal Baru',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: newTime,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, localHabit, testDeviceId);

      // Incoming backup with older timestamp for same habit
      const backup: BackupData = {
        version: 1,
        exported_at: oldTime,
        device_id: 'other-device',
        data: {
          categories: [],
          habits: [
            {
              id: validUuid,
              nama: 'Versi Cadangan Lama',
              category_id: null,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: oldTime,
              deleted_at: null,
              device_id: 'other-device'
            }
          ],
          habit_schedules: [],
          logs: [],
          settings: []
        }
      };

      await importBackupData(db, backup, 'merge', testDeviceId);

      // Local newer habit must NOT have been overwritten
      const stored = await db.habits.get(validUuid);
      expect(stored?.nama).toBe('Versi Lokal Baru');
    });

    it('applies newer incoming records in Merge LWW mode and enqueues outbox', async () => {
      const oldTime = '2026-09-20T10:00:00.000Z';
      const newTime = '2026-09-24T10:00:00.000Z';

      // Local habit with older timestamp
      const localHabit: Habit = {
        id: validUuid,
        nama: 'Versi Lokal Lama',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: oldTime,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, localHabit, testDeviceId);

      // Incoming backup with newer timestamp
      const backup: BackupData = {
        version: 1,
        exported_at: newTime,
        device_id: 'other-device',
        data: {
          categories: [],
          habits: [
            {
              id: validUuid,
              nama: 'Versi Cadangan Baru',
              category_id: null,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: newTime,
              deleted_at: null,
              device_id: 'other-device'
            }
          ],
          habit_schedules: [],
          logs: [],
          settings: []
        }
      };

      const result = await importBackupData(db, backup, 'merge', testDeviceId);
      expect(result.stats.habits).toBe(1);

      // Stored habit should now be updated to incoming newer version
      const stored = await db.habits.get(validUuid);
      expect(stored?.nama).toBe('Versi Cadangan Baru');

      // Outbox must contain mutation for sync engine
      const outbox = await db.outbox.toArray();
      expect(outbox.some((item) => item.record_id === validUuid)).toBe(true);
    });

    it('performs Clean Restore by replacing all local data with backup dataset', async () => {
      // Existing habit that is NOT in the backup
      const existingHabit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174099',
        nama: 'Akan Terhapus Bersih',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, existingHabit, testDeviceId);

      const restoreHabitId = '123e4567-e89b-12d3-a456-426614174088';
      const backup: BackupData = {
        version: 1,
        exported_at: nowIso,
        device_id: 'backup-device',
        data: {
          categories: [],
          habits: [
            {
              id: restoreHabitId,
              nama: 'Habit Hasil Restore',
              category_id: null,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'backup-device'
            }
          ],
          habit_schedules: [],
          logs: [],
          settings: []
        }
      };

      const result = await importBackupData(db, backup, 'clean_restore', testDeviceId);
      expect(result.mode).toBe('clean_restore');
      expect(result.stats.habits).toBe(1);

      // Old habit is gone
      const oldHabit = await db.habits.get(existingHabit.id);
      expect(oldHabit).toBeUndefined();

      // New restored habit is present
      const restoredHabit = await db.habits.get(restoreHabitId);
      expect(restoredHabit?.nama).toBe('Habit Hasil Restore');
    });
  });

  describe('BackupWarnings Component', () => {
    it('shows warning when sync has never occurred or is > 7 days old', () => {
      const htmlNever = renderToStaticMarkup(
        <BackupWarnings lastSyncAt={null} lastBackupAt={nowIso} />
      );
      expect(htmlNever).toContain('Peringatan Sinkronisasi (PRD §8.4)');

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const htmlOld = renderToStaticMarkup(
        <BackupWarnings lastSyncAt={eightDaysAgo} lastBackupAt={nowIso} />
      );
      expect(htmlOld).toContain('Sinkronisasi terakhir berhasil 8 hari lalu');
    });

    it('shows warning when backup has never occurred or is > 30 days old', () => {
      const htmlNever = renderToStaticMarkup(
        <BackupWarnings lastSyncAt={nowIso} lastBackupAt={null} />
      );
      expect(htmlNever).toContain('Peringatan Perlindungan Cadangan Data');

      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const htmlOld = renderToStaticMarkup(
        <BackupWarnings lastSyncAt={nowIso} lastBackupAt={thirtyOneDaysAgo} />
      );
      expect(htmlOld).toContain('Cadangan data JSON terakhir diekspor 31 hari lalu');
    });

    it('renders null when both sync and backup are fresh', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const html = renderToStaticMarkup(
        <BackupWarnings lastSyncAt={yesterday} lastBackupAt={yesterday} />
      );
      expect(html).toBe('');
    });
  });

  describe('DeviceTokenForm Component', () => {
    it('renders device token input form', () => {
      const html = renderToStaticMarkup(<DeviceTokenForm />);
      expect(html).toContain('Autentikasi Token Perangkat');
      expect(html).toContain('API Bearer Token');
      expect(html).toContain('Simpan Token');
    });
  });

  describe('ImportPreviewModal Component', () => {
    it('renders pre-import statistics badges and merge strategy selector', () => {
      const stats = {
        categoryCount: 2,
        habitCount: 5,
        scheduleCount: 5,
        logCount: 120,
        exportedAt: nowIso,
        sourceDeviceId: 'source-device-1',
        version: 1
      };

      const html = renderToStaticMarkup(
        <ImportPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          fileName="backup_vibehabit.json"
          stats={stats}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain('Pratinjau Data Impor');
      expect(html).toContain('backup_vibehabit.json');
      expect(html).toContain('>5<'); // 5 habits
      expect(html).toContain('>120<'); // 120 logs
      expect(html).toContain('Gabungkan (Merge LWW)');
      expect(html).toContain('Pulihkan Bersih (Clean Restore)');
    });

    it('returns null when isOpen is false', () => {
      const stats = {
        categoryCount: 0,
        habitCount: 0,
        scheduleCount: 0,
        logCount: 0,
        exportedAt: nowIso,
        version: 1
      };
      const html = renderToStaticMarkup(
        <ImportPreviewModal
          isOpen={false}
          onClose={vi.fn()}
          fileName="test.json"
          stats={stats}
          onConfirm={vi.fn()}
        />
      );
      expect(html).toBe('');
    });
  });

  describe('Full DataManagement Page Integration', () => {
    it('renders the complete data management page structure', () => {
      const html = renderToStaticMarkup(
        <DataManagement db={db} deviceId={testDeviceId} />
      );

      expect(html).toContain('Data &amp; Pengaturan');
      expect(html).toContain('Status Sinkronisasi &amp; Server Pribadi');
      expect(html).toContain('Penyimpanan Lokal (IndexedDB)');
      expect(html).toContain('Kedaulatan &amp; Backup Data Mandiri');
      expect(html).toContain('Ekspor JSON Penuh');
      expect(html).toContain('Ekspor CSV / Tabel');
      expect(html).toContain('Impor &amp; Pulihkan Cadangan');
      expect(html).toContain('Zona Bahaya &amp; Sanitasi Lokal');
    });
  });
});
