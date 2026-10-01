import { describe, it, expect } from 'vitest';
import { validateServerConfig, parseDeviceTokens, loadConfigFromEnv } from '../src/config.js';

describe('apps/server - Server Configuration & Validation', () => {
  it('parses comma-separated device token strings correctly', () => {
    const raw = 'laptop:hash123, hp:hash456, tablet:hash789 ';
    const tokens = parseDeviceTokens(raw);
    expect(tokens).toEqual({
      laptop: 'hash123',
      hp: 'hash456',
      tablet: 'hash789'
    });
  });

  it('fails fast when DATABASE_URL is missing or empty', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: '',
        deviceTokens: { d1: 'h1' }
      });
    }).toThrow(/DATABASE_URL is required/);
  });

  it('fails fast when DATABASE_URL is not a valid PostgreSQL URI', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'mysql://localhost:3306/db',
        deviceTokens: { d1: 'h1' }
      });
    }).toThrow(/valid PostgreSQL connection string/);
  });

  it('fails fast when DEVICE_TOKENS is missing or empty', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgresql://localhost:5432/db',
        deviceTokens: {}
      });
    }).toThrow(/DEVICE_TOKENS must contain at least one valid device entry/);
  });

  it('fails fast when binding host is not 127.0.0.1 outside container', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgresql://localhost:5432/db',
        deviceTokens: { d1: 'h1' },
        host: '0.0.0.0'
      });
    }).toThrow(/strictly bind to 127.0.0.1/);
  });

  it('permits 0.0.0.0 binding inside container environment (CONTAINER=true)', () => {
    const prev = process.env.CONTAINER;
    try {
      process.env.CONTAINER = 'true';
      const config = validateServerConfig({
        databaseUrl: 'postgresql://localhost:5432/db',
        deviceTokens: { d1: 'h1' },
        host: '0.0.0.0'
      });
      expect(config.host).toBe('0.0.0.0');
    } finally {
      if (prev !== undefined) process.env.CONTAINER = prev;
      else delete process.env.CONTAINER;
    }
  });

  it('accepts valid configuration and provides defaults', () => {
    const config = validateServerConfig({
      databaseUrl: 'postgresql://localhost:5432/vibehabit',
      deviceTokens: { 'dev-1': 'hash1' }
    });

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3001);
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/vibehabit');
    expect(config.deviceTokens['dev-1']).toBe('hash1');
  });

  it('loads valid configuration from process.env format', () => {
    const config = loadConfigFromEnv({
      DATABASE_URL: 'postgres://vibehabit_user:secret@localhost:5432/vibehabit',
      DEVICE_TOKENS: 'laptop:abc123hash,hp:def456hash',
      PORT: '3001',
      HOST: '127.0.0.1'
    });

    expect(config.port).toBe(3001);
    expect(config.deviceTokens.laptop).toBe('abc123hash');
    expect(config.deviceTokens.hp).toBe('def456hash');
  });

  it('fails fast when DEVICE_TOKENS contains malformed entries', () => {
    // Missing colon
    expect(() => parseDeviceTokens('laptop:hash,malformed_token')).toThrow(/Malformed DEVICE_TOKENS entry/);
    // Missing device ID
    expect(() => parseDeviceTokens(':hash123')).toThrow(/Malformed DEVICE_TOKENS entry/);
    // Missing token hash
    expect(() => parseDeviceTokens('laptop:')).toThrow(/Malformed DEVICE_TOKENS entry/);

    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgresql://localhost:5432/db',
        deviceTokens: 'laptop:validhash,brokenentry'
      });
    }).toThrow(/Malformed DEVICE_TOKENS entry/);
  });

  it('supports custom STATIC_DIST_PATH from environment', () => {
    const customDist = '/custom/web/dist';
    const config = loadConfigFromEnv({
      DATABASE_URL: 'postgres://vibehabit_user:secret@localhost:5432/vibehabit',
      DEVICE_TOKENS: 'laptop:abc123hash',
      STATIC_DIST_PATH: customDist
    });
    expect(config.staticDistPath).toBe(customDist);
  });
});
