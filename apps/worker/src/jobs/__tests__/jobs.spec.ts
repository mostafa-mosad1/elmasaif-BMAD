import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_PAYMENT_DEADLINE_EXPIRY,
  JOB_OFFER_EXPIRY_CHECKER,
  JOB_DEMAND_EXPIRY_CHECKER,
  JOB_FAL_LICENSE_EXPIRY,
  JOB_FAL_EXPIRY_WARNINGS,
  JOB_OWNER_FEE_REMINDERS,
  JOB_NOTIFICATION_RETENTION
} from '@elmasaif/shared';
import {
  paymentDeadlineExpiryHandler,
  offerExpiryCheckerHandler,
  demandExpiryCheckerHandler,
  falLicenseExpiryHandler,
  falExpiryWarningsHandler,
  ownerFeeRemindersHandler,
  notificationRetentionHandler,
  jobHandlersMap
} from '../index';
import { workerClock } from '../../clock';

describe('Canonical Background Job Handlers (AC: 3)', () => {
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const jobs = [
    { name: JOB_PAYMENT_DEADLINE_EXPIRY, handler: paymentDeadlineExpiryHandler },
    { name: JOB_OFFER_EXPIRY_CHECKER, handler: offerExpiryCheckerHandler },
    { name: JOB_DEMAND_EXPIRY_CHECKER, handler: demandExpiryCheckerHandler },
    { name: JOB_FAL_LICENSE_EXPIRY, handler: falLicenseExpiryHandler },
    { name: JOB_FAL_EXPIRY_WARNINGS, handler: falExpiryWarningsHandler },
    { name: JOB_OWNER_FEE_REMINDERS, handler: ownerFeeRemindersHandler },
    { name: JOB_NOTIFICATION_RETENTION, handler: notificationRetentionHandler }
  ];

  it('exposes all 7 job handlers in the jobHandlersMap', () => {
    expect(Object.keys(jobHandlersMap)).toHaveLength(7);
    for (const job of jobs) {
      expect(jobHandlersMap[job.name]).toBe(job.handler);
    }
  });

  for (const { name, handler } of jobs) {
    describe(`Job Handler: ${name}`, () => {
      it('executes successfully, logs telemetry with start and duration, and returns JobExecutionResult', async () => {
        const mockJob: any = { id: `test-${name}-id`, name, data: {} };
        const result = await handler([mockJob]);

        expect(result).toBeDefined();
        expect(result.jobName).toBe(name);
        expect(result.success).toBe(true);
        expect(typeof result.durationMs).toBe('number');
        expect(typeof result.processedCount).toBe('number');
        expect(typeof result.timestamp).toBe('string');

        // Check start and completion telemetry
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`[Job: ${name}] Started at`));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`[Job: ${name}] Completed in`));
      });

      it('evaluates against workerClock.now()', async () => {
        const clockNowSpy = vi.spyOn(workerClock, 'now');
        const mockJob: any = { id: `test-${name}-id`, name, data: {} };

        await handler([mockJob]);
        expect(clockNowSpy).toHaveBeenCalled();
        clockNowSpy.mockRestore();
      });

      it('catches failures, logs structured dead-letter error, and re-throws to enable pg-boss retries', async () => {
        const mockJob: any = { id: `test-${name}-id`, name, data: { simulateError: true } };

        await expect(handler([mockJob])).rejects.toThrow();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Worker DeadLetter / Job Error]'),
          expect.anything()
        );
      });
    });
  }
});
