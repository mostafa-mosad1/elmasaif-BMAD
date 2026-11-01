export type JobName =
  | 'payment-deadline-expiry'
  | 'offer-expiry-checker'
  | 'demand-expiry-checker'
  | 'fal-license-expiry'
  | 'fal-expiry-warnings'
  | 'owner-fee-reminders'
  | 'notification-retention'
  | 'account-deletion-expiry';

export interface JobScheduleConfig {
  name: JobName;
  cadence: string;
  singletonKey: string;
  retryLimit: number;
  retryDelay: number;
  retryBackoff: boolean;
  expireInMinutes: number;
  description: string;
}

export type JobConfig = JobScheduleConfig;

export interface JobExecutionResult {
  jobName: JobName;
  success: boolean;
  processedCount: number;
  durationMs: number;
  timestamp: string;
  details?: Record<string, unknown>;
  error?: string;
}

export interface JobPayload {
  triggeredAt?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
