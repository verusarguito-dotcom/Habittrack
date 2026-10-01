import { describe, it, expect } from 'vitest';
import {
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema,
  settingSchema,
  syncRequestSchema,
  syncResponseSchema,
  clockSkewErrorResponseSchema,
  outboxEntrySchema,
  outboxActionSchema,
  isoDateTimeStringSchema,
  backupDataSchema
} from '../src/schemas/index.js';
import type {
  ClockSkewErrorResponse,
  OutboxEntry,
  OutboxAction
} from '../src/types/index.js';

describe('Domain Schemas Validation (T002)', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const nowIso = new Date().toISOString();

  describe('categorySchema', () => {
    it('validates a valid category', () => {
      const data = {
        id: validUuid,
        nama: 'Kesehatan',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-laptop-1'
      };
      const parsed = categorySchema.parse(data);
      expect(parsed.nama).toBe('Kesehatan');
      expect(parsed.deleted_at).toBeNull();
    });

    it('rejects empty category name', () => {
      const data = {
        id: validUuid,
        nama: '',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      expect(() => categorySchema.parse(data)).toThrow();
    });
  });

  describe('habitSchema', () => {
    it('validates checklist habit', () => {
      const data = {
        id: validUuid,
        nama: 'Minum Air 2L',
        category_id: validUuid,
        mode: 'checklist' as const,
        satuan: null,
        archived: false,
        created_date: '2026-09-29',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitSchema.parse(data);
      expect(parsed.mode).toBe('checklist');
    });

    it('validates quantitative habit with unit', () => {
      const data = {
        id: validUuid,
        nama: 'Membaca Buku',
        category_id: null,
        mode: 'quantitative' as const,
        satuan: 'halaman',
        archived: false,
        created_date: '2026-09-29',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitSchema.parse(data);
      expect(parsed.satuan).toBe('halaman');
    });

    it('rejects invalid date format for created_date', () => {
      const data = {
        id: validUuid,
        nama: 'Invalid Date Habit',
        category_id: null,
        mode: 'checklist' as const,
        satuan: null,
        archived: false,
        created_date: '29-09-2026', // wrong format
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      expect(() => habitSchema.parse(data)).toThrow();
    });

    it('applies default values for omitted optional fields', () => {
      const minimalData = {
        id: validUuid,
        nama: 'Meditasi',
        mode: 'checklist' as const,
        created_date: '2026-09-29',
        updated_at: nowIso,
        device_id: 'device-1'
      };
      const parsed = habitSchema.parse(minimalData);
      expect(parsed.category_id).toBeNull();
      expect(parsed.satuan).toBeNull();
      expect(parsed.deleted_at).toBeNull();
      expect(parsed.server_seq).toBeNull();
      expect(parsed.archived).toBe(false);
    });
  });

  describe('habitScheduleSchema', () => {
    it('validates daily schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'daily' as const,
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.tipe_frekuensi).toBe('daily');
    });

    it('validates specific days schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'specific_days' as const,
        hari_terjadwal: [1, 3, 5],
        jumlah_per_minggu: null,
        target: 30,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.hari_terjadwal).toEqual([1, 3, 5]);
    });

    it('validates x_per_week schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'x_per_week' as const,
        hari_terjadwal: null,
        jumlah_per_minggu: 3,
        target: 1,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.jumlah_per_minggu).toBe(3);
    });
  });

  describe('habitLogSchema', () => {
    it('validates completed log', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tanggal: '2026-09-29',
        nilai: 30,
        selesai: true,
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitLogSchema.parse(data);
      expect(parsed.selesai).toBe(true);
      expect(parsed.nilai).toBe(30);
    });

    it('validates uncompleted partial log', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tanggal: '2026-09-29',
        nilai: 15,
        selesai: false,
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitLogSchema.parse(data);
      expect(parsed.selesai).toBe(false);
      expect(parsed.nilai).toBe(15);
    });
  });

  describe('settingSchema', () => {
    it('validates custom day start hour and theme', () => {
      const data = {
        id: validUuid,
        jam_mulai_hari: '04:00',
        theme: 'dark' as const,
        device_id: 'device-1',
        device_token_hash: null,
        updated_at: nowIso,
        deleted_at: null
      };
      const parsed = settingSchema.parse(data);
      expect(parsed.jam_mulai_hari).toBe('04:00');
      expect(parsed.theme).toBe('dark');
    });

    it('rejects invalid jam_mulai_hari format', () => {
      const data = {
        id: validUuid,
        jam_mulai_hari: '25:00', // invalid hour
        theme: 'dark' as const,
        device_id: 'device-1',
        device_token_hash: null,
        updated_at: nowIso,
        deleted_at: null
      };
      expect(() => settingSchema.parse(data)).toThrow();
    });
  });

  describe('syncProtocolSchema', () => {
    it('validates a sync request with mutations', () => {
      const req = {
        protocol_version: 1,
        device_id: validUuid,
        client_time: nowIso,
        client_last_server_seq: 42,
        mutations: [
          {
            mutation_id: validUuid,
            table: 'habits' as const,
            record: {
              id: validUuid,
              nama: 'Olahraga',
              category_id: null,
              mode: 'checklist' as const,
              satuan: null,
              archived: false,
              created_date: '2026-09-29',
              updated_at: nowIso,
              deleted_at: null,
              device_id: validUuid
            }
          }
        ]
      };
      const parsed = syncRequestSchema.parse(req);
      expect(parsed.mutations.length).toBe(1);
      expect(parsed.protocol_version).toBe(1);
    });

    it('validates a sync response', () => {
      const res = {
        server_time: nowIso,
        applied: [validUuid],
        rejected: [{ mutation_id: 'mut-fail', reason: 'Clock skew detected' }],
        changes: [],
        new_server_seq: 43,
        has_more: false
      };
      const parsed = syncResponseSchema.parse(res);
      expect(parsed.applied.length).toBe(1);
      expect(parsed.rejected.length).toBe(1);
      expect(parsed.has_more).toBe(false);
    });
  });

  describe('clockSkewErrorResponseSchema', () => {
    it('validates a valid clock skew error response', () => {
      const data: ClockSkewErrorResponse = {
        error: 'CLOCK_SKEW',
        message: 'Clock skew detected: client is 10 minutes ahead of server',
        server_time: nowIso
      };
      const parsed = clockSkewErrorResponseSchema.parse(data);
      expect(parsed.error).toBe('CLOCK_SKEW');
      expect(parsed.message).toBe(data.message);
      expect(parsed.server_time).toBe(nowIso);
    });

    it('rejects invalid error discriminator', () => {
      const data = {
        error: 'OTHER_ERROR',
        message: 'Some error',
        server_time: nowIso
      };
      expect(() => clockSkewErrorResponseSchema.parse(data)).toThrow();
    });

    it('rejects invalid server_time timestamp', () => {
      const data = {
        error: 'CLOCK_SKEW',
        message: 'Skew detected',
        server_time: 'not-a-valid-timestamp'
      };
      expect(() => clockSkewErrorResponseSchema.parse(data)).toThrow();
    });

    it('rejects missing fields', () => {
      expect(() => clockSkewErrorResponseSchema.parse({ error: 'CLOCK_SKEW' })).toThrow();
    });
  });

  describe('outboxEntrySchema', () => {
    it('validates valid outbox entries for each action and table', () => {
      const actions: OutboxAction[] = ['insert', 'update', 'delete'];
      const tables = ['categories', 'habits', 'habit_schedules', 'logs', 'settings'] as const;

      for (const action of actions) {
        for (const table of tables) {
          const entry: OutboxEntry = {
            id: validUuid,
            table,
            record_id: validUuid,
            action,
            payload: { nama: 'Test', count: 42, active: true },
            created_at: nowIso
          };
          const parsed = outboxEntrySchema.parse(entry);
          expect(parsed.id).toBe(validUuid);
          expect(parsed.table).toBe(table);
          expect(parsed.action).toBe(action);
          expect(parsed.record_id).toBe(validUuid);
          expect(parsed.payload).toEqual({ nama: 'Test', count: 42, active: true });
          expect(parsed.created_at).toBe(nowIso);
        }
      }
    });

    it('rejects invalid UUID in id', () => {
      const entry = {
        id: 'not-a-uuid',
        table: 'habits',
        record_id: validUuid,
        action: 'insert',
        payload: {},
        created_at: nowIso
      };
      expect(() => outboxEntrySchema.parse(entry)).toThrow();
    });

    it('rejects invalid table name', () => {
      const entry = {
        id: validUuid,
        table: 'unknown_table',
        record_id: validUuid,
        action: 'insert',
        payload: {},
        created_at: nowIso
      };
      expect(() => outboxEntrySchema.parse(entry)).toThrow();
    });

    it('rejects invalid action', () => {
      const entry = {
        id: validUuid,
        table: 'habits',
        record_id: validUuid,
        action: 'upsert',
        payload: {},
        created_at: nowIso
      };
      expect(() => outboxEntrySchema.parse(entry)).toThrow();
    });

    it('rejects empty record_id', () => {
      const entry = {
        id: validUuid,
        table: 'habits',
        record_id: '',
        action: 'insert',
        payload: {},
        created_at: nowIso
      };
      expect(() => outboxEntrySchema.parse(entry)).toThrow();
    });

    it('rejects invalid created_at timestamp', () => {
      const entry = {
        id: validUuid,
        table: 'habits',
        record_id: validUuid,
        action: 'insert',
        payload: {},
        created_at: '2026-99-99T99:99:99Z'
      };
      expect(() => outboxEntrySchema.parse(entry)).toThrow();
    });
  });

  describe('backupDataSchema (T015 Data Portability)', () => {
    it('validates a complete structured backup snapshot', () => {
      const backup = {
        version: 1,
        exported_at: nowIso,
        app_version: '0.1.0',
        device_id: 'device-laptop-1',
        data: {
          categories: [
            {
              id: validUuid,
              nama: 'Kesehatan',
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'device-laptop-1'
            }
          ],
          habits: [
            {
              id: validUuid,
              nama: 'Meditasi',
              category_id: validUuid,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'device-laptop-1'
            }
          ],
          habit_schedules: [
            {
              id: validUuid,
              habit_id: validUuid,
              tipe_frekuensi: 'daily',
              hari_terjadwal: null,
              jumlah_per_minggu: null,
              target: null,
              effective_from: '2026-09-01',
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'device-laptop-1'
            }
          ],
          logs: [
            {
              id: validUuid,
              habit_id: validUuid,
              tanggal: '2026-09-20',
              nilai: null,
              selesai: true,
              updated_at: nowIso,
              deleted_at: null,
              device_id: 'device-laptop-1'
            }
          ],
          settings: []
        }
      };

      const parsed = backupDataSchema.parse(backup);
      expect(parsed.version).toBe(1);
      expect(parsed.data.habits).toHaveLength(1);
      expect(parsed.data.categories).toHaveLength(1);
      expect(parsed.data.logs).toHaveLength(1);
    });

    it('rejects backup with invalid version or malformed data records', () => {
      const invalidBackup = {
        version: 0, // must be >= 1
        exported_at: 'invalid-date',
        data: {
          habits: [{ id: 'not-a-uuid' }]
        }
      };
      expect(() => backupDataSchema.parse(invalidBackup)).toThrow();
    });
  });
});
