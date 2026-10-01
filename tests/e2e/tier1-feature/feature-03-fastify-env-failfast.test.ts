import { describe, it, expect } from 'vitest';
import { validateServerConfig } from '../harness/index.js';

describe('Tier 1 - Feature 03: Fastify Env Config & Fail-fast', () => {
  it('fails fast on startup when DATABASE_URL is missing or empty', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: '',
        deviceTokens: { 'device-1': 'token-hash' }
      });
    }).toThrow(/DATABASE_URL is required/);
  });

  it('fails fast when DATABASE_URL is not a valid PostgreSQL URI', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'mysql://user:pass@localhost:3306/db',
        deviceTokens: { 'device-1': 'token-hash' }
      });
    }).toThrow(/valid PostgreSQL connection string/);
  });

  it('fails fast when DEVICE_TOKENS is missing or empty', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgresql://vibehabit:vibehabit@localhost:5432/vibehabit_test',
        deviceTokens: {}
      });
    }).toThrow(/DEVICE_TOKENS must contain at least one valid device entry/);
  });

  it('enforces strict loopback binding to 127.0.0.1', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgresql://vibehabit:vibehabit@localhost:5432/vibehabit_test',
        deviceTokens: { 'device-1': 'hash' },
        host: '0.0.0.0' // Disallowed outside container
      });
    }).toThrow(/must strictly bind to 127.0.0.1/);
  });

  it('successfully boots Fastify server when environment is fully compliant', () => {
    const config = validateServerConfig({
      databaseUrl: 'postgresql://vibehabit:vibehabit@localhost:5432/vibehabit_test',
      deviceTokens: { 'device-1': 'valid-sha256-hash' },
      port: 3001,
      host: '127.0.0.1'
    });

    expect(config.port).toBe(3001);
    expect(config.host).toBe('127.0.0.1');
    expect(config.databaseUrl).toBe('postgresql://vibehabit:vibehabit@localhost:5432/vibehabit_test');
    expect(config.deviceTokens['device-1']).toBe('valid-sha256-hash');
  });
});
