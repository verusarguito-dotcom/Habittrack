import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { createDatabase, type VibeHabitDatabase } from '../src/db/database.js';
import { getSetting, saveSetting } from '../src/db/operations.js';
import type { Setting } from '@vibehabit/shared';

describe('Theme Switcher & Settings Persistence (T011)', () => {
  let db: VibeHabitDatabase;

  beforeEach(() => {
    db = createDatabase(`test_theme_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('defaults to system theme when no setting is saved in Dexie', async () => {
    const setting = await getSetting(db);
    expect(setting).toBeUndefined();
  });

  it('persists theme selection to Dexie settings table', async () => {
    const settingId = 'set-001';
    const deviceId = 'dev-test-theme';
    const initialSetting: Setting = {
      id: settingId,
      jam_mulai_hari: '04:00',
      theme: 'dark',
      device_token_hash: null,
      updated_at: new Date().toISOString(),
      deleted_at: null,
      device_id: deviceId
    };

    await saveSetting(db, initialSetting, deviceId);

    const fetched = await getSetting(db);
    expect(fetched).toBeDefined();
    expect(fetched?.theme).toBe('dark');
    expect(fetched?.jam_mulai_hari).toBe('04:00');
  });

  it('updates theme from light to dark to system in Dexie settings table', async () => {
    const deviceId = 'dev-theme-update';
    const settingId = 'set-002';

    // 1. Save light theme
    await saveSetting(
      db,
      {
        id: settingId,
        jam_mulai_hari: '04:00',
        theme: 'light',
        device_token_hash: null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: deviceId
      },
      deviceId
    );

    let current = await getSetting(db);
    expect(current?.theme).toBe('light');

    // 2. Switch to dark theme
    await saveSetting(
      db,
      {
        ...current!,
        theme: 'dark',
        updated_at: new Date().toISOString()
      },
      deviceId
    );

    current = await getSetting(db);
    expect(current?.theme).toBe('dark');

    // 3. Switch to system theme
    await saveSetting(
      db,
      {
        ...current!,
        theme: 'system',
        updated_at: new Date().toISOString()
      },
      deviceId
    );

    current = await getSetting(db);
    expect(current?.theme).toBe('system');
  });

  it('enqueues outbox mutation upon saving theme change', async () => {
    const deviceId = 'dev-theme-outbox';
    const settingId = 'set-003';

    await saveSetting(
      db,
      {
        id: settingId,
        jam_mulai_hari: '04:00',
        theme: 'dark',
        device_token_hash: null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: deviceId
      },
      deviceId
    );

    const outbox = await db.outbox.toArray();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.table).toBe('settings');
    expect(outbox[0]?.record_id).toBe(settingId);
    expect((outbox[0]?.record as Setting).theme).toBe('dark');
  });
});
