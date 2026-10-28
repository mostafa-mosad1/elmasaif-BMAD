import PgBoss from 'pg-boss';
import { BACKGROUND_JOB_DEFINITIONS } from '@elmasaif/shared';
import { jobHandlersMap } from './jobs';

export interface WorkerSchedulerOptions {
  databaseUrl: string;
  bossSchema?: string;
  gracefulShutdownTimeoutMs?: number;
}

export class WorkerScheduler {
  private readonly boss: PgBoss;
  private readonly options: WorkerSchedulerOptions;
  private isStarted = false;

  constructor(options: WorkerSchedulerOptions) {
    this.options = options;
    this.boss = new PgBoss({
      connectionString: options.databaseUrl,
      schema: options.bossSchema || 'pgboss'
    });
  }

  public getBossInstance(): PgBoss {
    return this.boss;
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    console.log('[WorkerScheduler] Initializing PgBoss scheduler...');

    // Attach global error handler
    this.boss.on('error', (err: Error) => {
      console.error('[PgBoss Error] Encountered pg-boss error:', err);
    });

    try {
      await this.boss.start();
      console.log('[WorkerScheduler] PgBoss instance started successfully.');

      await this.registerSchedules();
      await this.registerHandlers();

      this.isStarted = true;
      console.log('[WorkerScheduler] All background schedules and worker queues registered cleanly.');
    } catch (error) {
      console.error('[WorkerScheduler] Failed to connect or initialize PgBoss:', error);
      throw error;
    }
  }

  public async registerSchedules(): Promise<void> {
    for (const job of Object.values(BACKGROUND_JOB_DEFINITIONS)) {
      await this.boss.schedule(
        job.name,
        job.cadence,
        {},
        {
          singletonKey: job.singletonKey,
          retryLimit: job.retryLimit,
          retryDelay: job.retryDelay,
          retryBackoff: job.retryBackoff,
          expireInMinutes: job.expireInMinutes
        }
      );
      console.log(
        `[WorkerScheduler] Registered schedule: "${job.name}" (cron: "${job.cadence}", singletonKey: "${job.singletonKey}")`
      );
    }
  }

  public async registerHandlers(): Promise<void> {
    for (const [jobName, handler] of Object.entries(jobHandlersMap)) {
      await this.boss.work(jobName, handler as any);
      console.log(`[WorkerScheduler] Attached worker queue handler for: "${jobName}"`);
    }
  }

  public async stop(): Promise<void> {
    const timeout = this.options.gracefulShutdownTimeoutMs || 10000;
    console.log(`[WorkerScheduler] Stopping PgBoss (graceful: true, timeout: ${timeout}ms)...`);

    try {
      await this.boss.stop({
        graceful: true,
        timeout
      });
      this.isStarted = false;
      console.log('[WorkerScheduler] PgBoss stopped cleanly.');
    } catch (error) {
      console.error('[WorkerScheduler] Error stopping PgBoss:', error);
      throw error;
    }
  }
}
