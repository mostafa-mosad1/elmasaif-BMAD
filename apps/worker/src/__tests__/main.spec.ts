import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerApplication } from '../main';

// Mock pg-boss
vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue(undefined),
    work: vi.fn().mockResolvedValue('worker-id-123'),
    on: vi.fn()
  }));

  return {
    default: MockPgBoss
  };
});

describe('WorkerApplication Lifecycle (AC: 1, 6)', () => {
  let app: WorkerApplication;
  let logSpy: any;
  let warnSpy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/test_db';

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    app = new WorkerApplication();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.cleanup();
  });

  it('bootstraps successfully and initializes scheduler', async () => {
    await app.bootstrap();

    expect(app.getScheduler()).not.toBeNull();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Worker] Bootstrapping El Masaif Background Worker...'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Worker] Worker started successfully'));
  });

  it('cleans up resources on shutdown', async () => {
    await app.bootstrap();
    const scheduler = app.getScheduler();
    const stopSpy = vi.spyOn(scheduler!, 'stop');

    await app.cleanup();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(app.getScheduler()).toBeNull();
  });

  it('fails gracefully with diagnostic warnings in dev/test if scheduler start fails', async () => {
    process.env.NODE_ENV = 'development';
    const failingApp = new WorkerApplication();

    // Force PgBoss mock to throw on start once
    const PgBoss = (await import('pg-boss')).default;
    (PgBoss as any).mockImplementationOnce(() => ({
      start: vi.fn().mockRejectedValue(new Error('PostgreSQL connection timeout')),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    }));

    await expect(failingApp.bootstrap()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PostgreSQL/PgBoss unavailable during startup')
    );
    await failingApp.cleanup();
  });
});
