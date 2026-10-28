import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWorkerConfig } from '../config';

describe('Worker Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns valid default configuration', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/test_db';

    const config = getWorkerConfig();
    expect(config.nodeEnv).toBe('test');
    expect(config.databaseUrl).toBe('postgresql://test_user:test_pass@localhost:5432/test_db');
    expect(config.bossSchema).toBe('pgboss');
    expect(config.gracefulShutdownTimeoutMs).toBe(10000);
  });

  it('customizes bossSchema via PG_BOSS_SCHEMA if provided', () => {
    process.env.PG_BOSS_SCHEMA = 'custom_boss';
    const config = getWorkerConfig();
    expect(config.bossSchema).toBe('custom_boss');
  });

  it('throws an error if DATABASE_URL is missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;

    expect(() => getWorkerConfig()).toThrow(/DATABASE_URL is required/);
  });
});
