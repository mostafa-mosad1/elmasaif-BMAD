import {
  AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
  JOB_FAL_EXPIRY_WARNINGS,
  NOTIFICATION_FAL_EXPIRY_WARNING,
  ProfileStatus,
  getFalLicenseWarningWindow,
} from '@elmasaif/shared';
import { createJobHandler, type JobHandlerLogic } from './job-wrapper';

export interface FalExpiryWarningsDbClient {
  falLicense: {
    findMany: (args: any) => Promise<any[]>;
  };
  auditLog?: {
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
}

export interface NotificationDispatcher {
  dispatch: (event: string, payload: any) => Promise<void> | void;
}

/**
 * Fal Expiry Warnings Sweep Logic (Story 6.2 / FR-7, [ASSUMPTION: A-05], AD-7).
 *
 * Scans active Fal profiles where expiryDate > currentTime.
 * Evaluates warning windows: 30 days, 7 days, 1 day.
 * Enforces an Idempotency Guard against duplicate warnings on the same calendar day.
 * Records immutable AuditLog entries and dispatches urgent warning notifications.
 */
export function createFalExpiryWarningsLogic(
  db?: FalExpiryWarningsDbClient,
  options?: { notificationDispatcher?: NotificationDispatcher },
): JobHandlerLogic {
  return async (_jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;

    if (db) {
      // Find active Fal licenses with expiryDate in future
      const candidateLicenses = await db.falLicense.findMany({
        where: {
          status: ProfileStatus.ACTIVE,
          expiryDate: { gt: currentTime },
        },
        include: {
          profile: true,
        },
      });

      // Calculate start of current calendar day in UTC
      const startOfDay = new Date(
        Date.UTC(
          currentTime.getUTCFullYear(),
          currentTime.getUTCMonth(),
          currentTime.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );

      for (const license of candidateLicenses) {
        const warningWindow = getFalLicenseWarningWindow(license.expiryDate, currentTime);
        if (warningWindow === null) {
          continue;
        }

        // Idempotency Guard: did we already dispatch a warning for this license today?
        if (db.auditLog) {
          const alreadyLogged = await db.auditLog.findFirst({
            where: {
              entityId: license.id,
              action: AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
              createdAt: { gte: startOfDay },
            },
          });

          if (alreadyLogged) {
            continue;
          }
        }

        const expiryDateIso =
          license.expiryDate instanceof Date
            ? license.expiryDate.toISOString()
            : new Date(license.expiryDate).toISOString();

        if (db.auditLog) {
          await db.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              actorType: 'SYSTEM',
              action: AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
              entityType: 'FalLicense',
              entityId: license.id,
              payload: {
                daysRemaining: warningWindow,
                expiryDate: expiryDateIso,
                licenseNumber: license.licenseNumber,
              },
            },
          });
        }

        if (options?.notificationDispatcher) {
          await options.notificationDispatcher.dispatch(NOTIFICATION_FAL_EXPIRY_WARNING, {
            daysRemaining: warningWindow,
            expiryDate: expiryDateIso,
            licenseNumber: license.licenseNumber,
            marketerUserId: license.profile?.userId,
            profileId: license.profileId,
          });
        }

        processedCount++;
      }
    }

    const outcome = `Evaluated Fal renewal warning windows at ${evaluationTimeIso}. Dispatched ${processedCount} alerts.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso, processedCount },
    };
  };
}

/**
 * Fal Expiry Warnings Job (Cadence: Daily at 05:00 UTC / 08:00 KSA)
 * Scans profiles expiring in 30, 7, and 1 days.
 * Dispatches urgent renewal alerts via in-app and email.
 */
export const falExpiryWarningsHandler = createJobHandler(
  JOB_FAL_EXPIRY_WARNINGS,
  createFalExpiryWarningsLogic(),
);
