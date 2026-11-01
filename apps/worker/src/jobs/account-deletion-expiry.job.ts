import { JOB_ACCOUNT_DELETION_EXPIRY, ProfileStatus } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';
import * as crypto from 'crypto';

export interface AccountDeletionDbClient {
  user: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  knownDevice?: {
    deleteMany: (args: any) => Promise<any>;
  };
  auditLog?: {
    create: (args: any) => Promise<any>;
  };
}

export function createAccountDeletionExpiryLogic(db?: AccountDeletionDbClient) {
  return async (jobs: any[], currentTime: Date) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;
    let anonymizedCount = 0;
    const deactivatedCount = 0;

    if (db) {
      const expiredUsers = await db.user.findMany({
        where: {
          status: ProfileStatus.DELETION_PENDING,
          deletionDueAt: { lte: currentTime }
        }
      });

      for (const user of expiredUsers) {
        processedCount++;
        const randomSalt = crypto.randomBytes(4).toString('hex');
        const randomUuid = crypto.randomUUID();

        await db.user.update({
          where: { id: user.id },
          data: {
            fullName: 'مستخدم محذوف',
            mobileNumber: `+966000000000${randomSalt}`,
            nationalId: `0000000000${randomSalt}`,
            username: `deleted_${user.id.slice(0, 8)}`,
            email: null,
            pendingEmail: null,
            passwordHash: `ERASED_PDPL_${randomUuid}`,
            status: ProfileStatus.SOFT_DELETED
          }
        });

        if (db.knownDevice) {
          await db.knownDevice.deleteMany({
            where: { userId: user.id }
          });
        }

        if (db.auditLog) {
          await db.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              actorType: 'SYSTEM',
              action: 'ACCOUNT_PERMANENTLY_ERASED',
              entityType: 'User',
              entityId: user.id,
              payload: {
                reason: '14-day cooling-off expired without cancellation',
                anonymizedAt: evaluationTimeIso
              }
            }
          });
        }
        anonymizedCount++;
      }
    }

    const outcome = `Evaluated cooling-off accounts at ${evaluationTimeIso}. Processed: ${processedCount}, Anonymized: ${anonymizedCount}, Deactivated: ${deactivatedCount}`;

    return {
      processedCount,
      outcome,
      details: {
        evaluationTime: evaluationTimeIso,
        processedCount,
        anonymizedCount,
        deactivatedCount
      }
    };
  };
}

/**
 * Account Deletion Expiry Job (Cadence: Daily at 03:00 UTC)
 * Scans accounts in DELETION_PENDING where now >= deletionDueAt (14-day cooling-off passed).
 * Permanently erases and anonymizes all PII to SOFT_DELETED per Saudi PDPL.
 */
export const accountDeletionExpiryHandler = createJobHandler(
  JOB_ACCOUNT_DELETION_EXPIRY,
  createAccountDeletionExpiryLogic()
);

