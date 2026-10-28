import PgBoss from 'pg-boss';
import { JobName, JobExecutionResult } from '@elmasaif/shared';
import { workerClock } from '../clock';

export interface JobHandlerLogic {
  (jobs: PgBoss.Job[], currentTime: Date): Promise<{
    processedCount: number;
    outcome: string;
    details?: Record<string, unknown>;
  }>;
}

export function createJobHandler(
  jobName: JobName,
  logic: JobHandlerLogic
): (jobs: PgBoss.Job[] | PgBoss.Job) => Promise<JobExecutionResult> {
  return async (incomingJobs: PgBoss.Job[] | PgBoss.Job): Promise<JobExecutionResult> => {
    const jobs = Array.isArray(incomingJobs) ? incomingJobs : [incomingJobs];
    const startedAt = workerClock.nowIso();
    const startTime = workerClock.nowTimestamp();

    console.log(`[Job: ${jobName}] Started at ${startedAt} (Received ${jobs.length} jobs)`);

    try {
      // Check for test error simulation
      for (const job of jobs) {
        if ((job.data as any)?.simulateError) {
          throw new Error(`Simulated failure for ${jobName}`);
        }
      }

      const currentTime = workerClock.now();
      const { processedCount, outcome, details } = await logic(jobs, currentTime);

      const durationMs = workerClock.nowTimestamp() - startTime;
      console.log(`[Job: ${jobName}] Completed in ${durationMs}ms with outcome: ${outcome}`);

      return {
        jobName,
        success: true,
        processedCount,
        durationMs,
        timestamp: workerClock.nowIso(),
        details
      };
    } catch (error: any) {
      const durationMs = workerClock.nowTimestamp() - startTime;
      console.error(
        `[Worker DeadLetter / Job Error] [Job: ${jobName}] Failed after ${durationMs}ms: ${error?.message || error}`,
        error
      );
      // Re-throw so pg-boss marks the job as failed and activates retry backoff
      throw error;
    }
  };
}
