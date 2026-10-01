import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  SyncMutation,
  SyncRequest,
  SyncTable
} from '@vibehabit/shared';

/**
 * Deterministic counter for reproducible IDs and timestamps in tests.
 */
let idCounter = 1;
let timeCounter = Date.now();

export function resetGenerators(seedTime = Date.now()): void {
  idCounter = 1;
  timeCounter = seedTime;
}

/**
 * Deterministic UUID generator (valid UUIDv4 format).
 */
export function generateDeterministicUuid(prefix = '00000000'): string {
  const count = (idCounter++).toString(16).padStart(12, '0');
  const safePrefix = prefix.replace(/[^0-9a-f]/gi, '0').slice(0, 8).padEnd(8, '0');
  return `${safePrefix}-0000-4000-8000-${count}`;
}

/**
 * Deterministic ISO timestamp generator, advancing by stepMs on each call.
 */
export function generateDeterministicTimestamp(stepMs = 1): string {
  const iso = new Date(timeCounter).toISOString();
  timeCounter += stepMs;
  return iso;
}

export function getCurrentDeterministicTimestamp(): string {
  return new Date(timeCounter).toISOString();
}

export function setDeterministicTime(timestamp: string | number): void {
  timeCounter = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
}

/**
 * Entity Factories
 */
export function createCategory(overrides: Partial<Category> = {}): Category {
  const now = generateDeterministicTimestamp();
  return {
    id: overrides.id ?? generateDeterministicUuid('cat00000'),
    nama: overrides.nama ?? 'Olahraga',
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'device-test-01',
    server_seq: overrides.server_seq ?? null
  };
}

export function createHabit(overrides: Partial<Habit> = {}): Habit {
  const now = generateDeterministicTimestamp();
  return {
    id: overrides.id ?? generateDeterministicUuid('hab00000'),
    nama: overrides.nama ?? 'Lari Pagi',
    category_id: overrides.category_id !== undefined ? overrides.category_id : null,
    mode: overrides.mode ?? 'checklist',
    satuan: overrides.satuan !== undefined ? overrides.satuan : null,
    archived: overrides.archived ?? false,
    created_date: overrides.created_date ?? '2026-09-29',
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'device-test-01',
    server_seq: overrides.server_seq ?? null
  };
}

export function createHabitSchedule(overrides: Partial<HabitSchedule> = {}): HabitSchedule {
  const now = generateDeterministicTimestamp();
  return {
    id: overrides.id ?? generateDeterministicUuid('sch00000'),
    habit_id: overrides.habit_id ?? generateDeterministicUuid('hab00000'),
    tipe_frekuensi: overrides.tipe_frekuensi ?? 'daily',
    hari_terjadwal: overrides.hari_terjadwal !== undefined ? overrides.hari_terjadwal : null,
    jumlah_per_minggu: overrides.jumlah_per_minggu !== undefined ? overrides.jumlah_per_minggu : null,
    target: overrides.target !== undefined ? overrides.target : 1,
    effective_from: overrides.effective_from ?? '2026-09-29',
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'device-test-01',
    server_seq: overrides.server_seq ?? null
  };
}

export function createHabitLog(overrides: Partial<HabitLog> = {}): HabitLog {
  const now = generateDeterministicTimestamp();
  return {
    id: overrides.id ?? generateDeterministicUuid('log00000'),
    habit_id: overrides.habit_id ?? generateDeterministicUuid('hab00000'),
    tanggal: overrides.tanggal ?? '2026-09-29',
    nilai: overrides.nilai !== undefined ? overrides.nilai : 1,
    selesai: overrides.selesai ?? true,
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'device-test-01',
    server_seq: overrides.server_seq ?? null
  };
}

export function createSetting(overrides: Partial<Setting> = {}): Setting {
  const now = generateDeterministicTimestamp();
  return {
    id: overrides.id ?? generateDeterministicUuid('set00000'),
    jam_mulai_hari: overrides.jam_mulai_hari ?? '00:00',
    theme: overrides.theme ?? 'system',
    device_token_hash: overrides.device_token_hash ?? null,
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'device-test-01',
    server_seq: overrides.server_seq ?? null
  };
}

export function createMutation(
  table: SyncTable,
  record: Category | Habit | HabitSchedule | HabitLog | Setting,
  mutationId?: string
): SyncMutation {
  return {
    mutation_id: mutationId ?? generateDeterministicUuid('mut00000'),
    table,
    record
  };
}

export function createSyncRequest(
  mutations: SyncMutation[] = [],
  overrides: Partial<SyncRequest> = {}
): SyncRequest {
  const now = new Date().toISOString();
  return {
    protocol_version: overrides.protocol_version ?? 1,
    device_id: overrides.device_id ?? 'device-test-01',
    client_time: overrides.client_time ?? now,
    client_last_server_seq: overrides.client_last_server_seq ?? 0,
    mutations
  };
}
