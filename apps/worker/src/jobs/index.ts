import {
  JOB_PAYMENT_DEADLINE_EXPIRY,
  JOB_OFFER_EXPIRY_CHECKER,
  JOB_DEMAND_EXPIRY_CHECKER,
  JOB_FAL_LICENSE_EXPIRY,
  JOB_FAL_EXPIRY_WARNINGS,
  JOB_OWNER_FEE_REMINDERS,
  JOB_NOTIFICATION_RETENTION,
  JOB_ACCOUNT_DELETION_EXPIRY,
  JOB_BACKUP_OFFER_RECONCILIATION,
  JobName,
  JobExecutionResult
} from '@elmasaif/shared';
import PgBoss from 'pg-boss';

import { paymentDeadlineExpiryHandler } from './payment-deadline-expiry.job';
import { offerExpiryCheckerHandler } from './offer-expiry-checker.job';
import { demandExpiryCheckerHandler } from './demand-expiry-checker.job';
import { falLicenseExpiryHandler } from './fal-license-expiry.job';
import { falExpiryWarningsHandler } from './fal-expiry-warnings.job';
import { ownerFeeRemindersHandler } from './owner-fee-reminders.job';
import { notificationRetentionHandler } from './notification-retention.job';
import { accountDeletionExpiryHandler } from './account-deletion-expiry.job';
import { backupOfferReconciliationHandler } from './backup-offer-reconciliation.job';

export * from './job-wrapper';
export * from './payment-deadline-expiry.job';
export * from './offer-expiry-checker.job';
export * from './demand-expiry-checker.job';
export * from './fal-license-expiry.job';
export {
  type FalExpiryWarningsDbClient,
  createFalExpiryWarningsLogic,
  falExpiryWarningsHandler,
} from './fal-expiry-warnings.job';
export * from './owner-fee-reminders.job';
export * from './notification-retention.job';
export * from './account-deletion-expiry.job';
export * from './backup-offer-reconciliation.job';

export type JobHandlerFunction = (jobs: PgBoss.Job[] | PgBoss.Job) => Promise<JobExecutionResult>;

export const jobHandlersMap: Record<JobName, JobHandlerFunction> = {
  [JOB_PAYMENT_DEADLINE_EXPIRY]: paymentDeadlineExpiryHandler,
  [JOB_OFFER_EXPIRY_CHECKER]: offerExpiryCheckerHandler,
  [JOB_DEMAND_EXPIRY_CHECKER]: demandExpiryCheckerHandler,
  [JOB_FAL_LICENSE_EXPIRY]: falLicenseExpiryHandler,
  [JOB_FAL_EXPIRY_WARNINGS]: falExpiryWarningsHandler,
  [JOB_OWNER_FEE_REMINDERS]: ownerFeeRemindersHandler,
  [JOB_NOTIFICATION_RETENTION]: notificationRetentionHandler,
  [JOB_ACCOUNT_DELETION_EXPIRY]: accountDeletionExpiryHandler,
  [JOB_BACKUP_OFFER_RECONCILIATION]: backupOfferReconciliationHandler
};
