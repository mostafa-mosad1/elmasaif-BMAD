import { CURRENCY_CODE_SAR } from '@elmasaif/shared';
import { assertWorkerProductionSafety } from './startup-guard';
import { workerClock } from './clock';
import { getWorkerConfig } from './config';
import { WorkerScheduler } from './scheduler';

/**
 * El Masaif Dedicated Background Worker Service
 * Responsible for scheduled tasks, pg-boss job processing, and background workflows.
 */
export class WorkerApplication {
  private isShuttingDown = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private scheduler: WorkerScheduler | null = null;

  public async bootstrap(): Promise<void> {
    assertWorkerProductionSafety();

    const config = getWorkerConfig();

    console.log('[Worker] Bootstrapping El Masaif Background Worker...');
    console.log(`[Worker] Loaded shared contracts (Default Currency: ${CURRENCY_CODE_SAR})`);
    console.log(`[Worker] Environment: ${config.nodeEnv}`);

    this.scheduler = new WorkerScheduler({
      databaseUrl: config.databaseUrl,
      bossSchema: config.bossSchema,
      gracefulShutdownTimeoutMs: config.gracefulShutdownTimeoutMs
    });

    try {
      await this.scheduler.start();
    } catch (error: any) {
      if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
        console.warn(
          `[Worker] PostgreSQL/PgBoss unavailable during startup in ${config.nodeEnv} mode. Worker entering standby polling mode: ${error?.message || error}`
        );
      } else {
        throw error;
      }
    }

    this.registerSignalHandlers();

    // Start background worker heartbeat loop
    this.heartbeatTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        console.log(`[Worker Heartbeat] Active at ${workerClock.nowIso()}`);
      }
    }, config.heartbeatIntervalMs);

    // Keep event loop alive
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }

    console.log('[Worker] Worker started successfully and listening for jobs.');
  }

  public getScheduler(): WorkerScheduler | null {
    return this.scheduler;
  }

  private registerSignalHandlers(): void {
    const handleShutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }
      this.isShuttingDown = true;
      console.log(`[Worker] Received ${signal}. Initiating graceful shutdown...`);

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      try {
        await this.cleanup();
        console.log('[Worker] Graceful shutdown completed cleanly.');
        process.exit(0);
      } catch (error) {
        console.error('[Worker] Error during worker shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  }

  public async cleanup(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.stop();
      this.scheduler = null;
    }
  }
}

// Only auto-bootstrap when run directly, not when required by tests
if (require.main === module || !process.env.VITEST) {
  const worker = new WorkerApplication();
  worker.bootstrap().catch((error) => {
    console.error('[Worker] Fatal error during bootstrap:', error);
    process.exit(1);
  });
}
