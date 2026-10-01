-- Migration: 001_init.sql
-- Description: Create initial schema for VibeHabit domain tables and global sequence

-- 1. Create global sequence for server_seq
CREATE SEQUENCE IF NOT EXISTS vibehabit_server_seq START WITH 1 INCREMENT BY 1;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(255) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);

CREATE INDEX IF NOT EXISTS idx_categories_server_seq ON categories(server_seq);

-- 3. Habits Table
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('checklist', 'quantitative')),
    satuan VARCHAR(50) NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_date DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(255) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);

CREATE INDEX IF NOT EXISTS idx_habits_server_seq ON habits(server_seq);
CREATE INDEX IF NOT EXISTS idx_habits_category_id ON habits(category_id);

-- 4. Habit Schedules Table
CREATE TABLE IF NOT EXISTS habit_schedules (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tipe_frekuensi VARCHAR(50) NOT NULL CHECK (tipe_frekuensi IN ('daily', 'specific_days', 'x_per_week')),
    hari_terjadwal JSONB NULL,
    jumlah_per_minggu INTEGER NULL,
    target NUMERIC NULL,
    effective_from DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(255) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);

CREATE INDEX IF NOT EXISTS idx_habit_schedules_server_seq ON habit_schedules(server_seq);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_habit_id ON habit_schedules(habit_id);

-- 5. Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    nilai NUMERIC NULL,
    selesai BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(255) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq'),
    CONSTRAINT uq_logs_habit_tanggal UNIQUE (habit_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_logs_server_seq ON logs(server_seq);
CREATE INDEX IF NOT EXISTS idx_logs_habit_tanggal ON logs(habit_id, tanggal);

-- 6. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY,
    jam_mulai_hari VARCHAR(10) NOT NULL DEFAULT '00:00',
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    device_token_hash VARCHAR(255) NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(255) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);

CREATE INDEX IF NOT EXISTS idx_settings_server_seq ON settings(server_seq);
