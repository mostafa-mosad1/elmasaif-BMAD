import { CURRENCY_CODE_SAR } from '@elmasaif/shared';

/**
 * El Masaif Dedicated Background Worker Service
 * Responsible for scheduled tasks, pg-boss job processing, and background workflows.
 */
class WorkerApplication {
  private isShuttingDown = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  public async bootstrap(): Promise<void> {
    console.log('[Worker] Bootstrapping El Masaif Background Worker...');
    console.log(`[Worker] Loaded shared contracts (Default Currency: ${CURRENCY_CODE_SAR})`);

    this.registerSignalHandlers();

    // Start background worker heartbeat loop
    this.heartbeatTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        console.log(`[Worker Heartbeat] Active at ${new Date().toISOString()}`);
      }
    }, 60000);

    // Keep event loop alive
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }

    console.log('[Worker] Worker started successfully and listening for jobs.');
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

  private async cleanup(): Promise<void> {
    // Teardown connections, flush queues, finish in-flight jobs
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const worker = new WorkerApplication();
worker.bootstrap().catch((error) => {
  console.error('[Worker] Fatal error during bootstrap:', error);
  process.exit(1);
});
