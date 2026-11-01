import { describe, it, expect } from 'vitest';
import {
  JOB_PAYMENT_DEADLINE_EXPIRY,
  JOB_OFFER_EXPIRY_CHECKER,
  JOB_DEMAND_EXPIRY_CHECKER,
  JOB_FAL_LICENSE_EXPIRY,
  JOB_FAL_EXPIRY_WARNINGS,
  JOB_OWNER_FEE_REMINDERS,
  JOB_NOTIFICATION_RETENTION,
  JOB_ACCOUNT_DELETION_EXPIRY,
  BACKGROUND_JOB_DEFINITIONS,
  BACKGROUND_JOBS,
  JobName,
  JobScheduleConfig,
  JobExecutionResult
} from '../../index';

describe('Canonical Background Job Contracts & Definitions', () => {
  const expectedJobs: JobName[] = [
    JOB_PAYMENT_DEADLINE_EXPIRY,
    JOB_OFFER_EXPIRY_CHECKER,
    JOB_DEMAND_EXPIRY_CHECKER,
    JOB_FAL_LICENSE_EXPIRY,
    JOB_FAL_EXPIRY_WARNINGS,
    JOB_OWNER_FEE_REMINDERS,
    JOB_NOTIFICATION_RETENTION,
    JOB_ACCOUNT_DELETION_EXPIRY
  ];

  it('defines exact string constants for all cataloged jobs', () => {
    expect(JOB_PAYMENT_DEADLINE_EXPIRY).toBe('payment-deadline-expiry');
    expect(JOB_OFFER_EXPIRY_CHECKER).toBe('offer-expiry-checker');
    expect(JOB_DEMAND_EXPIRY_CHECKER).toBe('demand-expiry-checker');
    expect(JOB_FAL_LICENSE_EXPIRY).toBe('fal-license-expiry');
    expect(JOB_FAL_EXPIRY_WARNINGS).toBe('fal-expiry-warnings');
    expect(JOB_OWNER_FEE_REMINDERS).toBe('owner-fee-reminders');
    expect(JOB_NOTIFICATION_RETENTION).toBe('notification-retention');
    expect(JOB_ACCOUNT_DELETION_EXPIRY).toBe('account-deletion-expiry');
  });

  it('contains exactly 7 cataloged jobs in BACKGROUND_JOB_DEFINITIONS', () => {
    const keys = Object.keys(BACKGROUND_JOB_DEFINITIONS);
    expect(keys).toHaveLength(8);
    for (const job of expectedJobs) {
      expect(BACKGROUND_JOB_DEFINITIONS[job]).toBeDefined();
    }
  });

  it('verifies BACKGROUND_JOBS alias maps to BACKGROUND_JOB_DEFINITIONS', () => {
    expect(BACKGROUND_JOBS).toBe(BACKGROUND_JOB_DEFINITIONS);
  });

  it('verifies all 7 jobs have valid crons, non-empty singleton keys, and retry backoff', () => {
    const cronRegex = /^(@(reboot|yearly|annually|monthly|weekly|daily|midnight|hourly))|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})$/;

    for (const jobName of expectedJobs) {
      const def: JobScheduleConfig = BACKGROUND_JOB_DEFINITIONS[jobName];

      expect(def.name).toBe(jobName);
      expect(def.singletonKey).toBe(jobName);
      expect(typeof def.cadence).toBe('string');
      expect(def.cadence.trim().length).toBeGreaterThan(0);
      expect(cronRegex.test(def.cadence)).toBe(true);

      expect(def.retryLimit).toBeGreaterThanOrEqual(1);
      expect(def.retryDelay).toBeGreaterThanOrEqual(1);
      expect(def.retryBackoff).toBe(true);
      expect(def.expireInMinutes).toBeGreaterThanOrEqual(1);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('verifies specific cadences match architecture specifications', () => {
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_PAYMENT_DEADLINE_EXPIRY].cadence).toBe('* * * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_OFFER_EXPIRY_CHECKER].cadence).toBe('*/5 * * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_DEMAND_EXPIRY_CHECKER].cadence).toBe('0 * * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_FAL_LICENSE_EXPIRY].cadence).toBe('5 0 * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_FAL_EXPIRY_WARNINGS].cadence).toBe('0 5 * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_OWNER_FEE_REMINDERS].cadence).toBe('0 6 * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_NOTIFICATION_RETENTION].cadence).toBe('0 2 * * *');
    expect(BACKGROUND_JOB_DEFINITIONS[JOB_ACCOUNT_DELETION_EXPIRY].cadence).toBe('0 3 * * *');
  });

  it('supports typing of JobExecutionResult', () => {
    const successResult: JobExecutionResult = {
      jobName: JOB_PAYMENT_DEADLINE_EXPIRY,
      success: true,
      processedCount: 5,
      durationMs: 42,
      timestamp: new Date().toISOString(),
      details: { cancelledDeals: ['deal-1', 'deal-2'] }
    };
    expect(successResult.success).toBe(true);
    expect(successResult.processedCount).toBe(5);

    const errorResult: JobExecutionResult = {
      jobName: JOB_OFFER_EXPIRY_CHECKER,
      success: false,
      processedCount: 0,
      durationMs: 15,
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    };
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Database connection failed');
  });
});
