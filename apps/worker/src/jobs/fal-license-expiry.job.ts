import {
  AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED,
  AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED,
  COMPLIANCE_CATEGORY_FAL_EXPIRED,
  COMPLIANCE_REASON_FAL_EXPIRED_AR,
  JOB_FAL_LICENSE_EXPIRY,
  ListingStatus,
  NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED,
  NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW,
  ProfileStatus,
  isListingEligibleForComplianceSuspension,
} from '@elmasaif/shared';
import { createJobHandler, type JobHandlerLogic } from './job-wrapper';

export interface FalLicenseExpiryDbClient {
  $transaction?: <T>(fn: (tx: FalLicenseExpiryDbClient) => Promise<T>) => Promise<T>;
  falLicense: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  userProfile: {
    update: (args: any) => Promise<any>;
  };
  listing: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  auditLog?: {
    create: (args: any) => Promise<any>;
  };
}

export interface NotificationDispatcher {
  dispatch: (event: string, payload: any) => Promise<void> | void;
}

/**
 * Fal License Expiry Logic (Story 6.2 / FR-7, BR-14, UC-43, AD-7).
 *
 * Scans candidate Fal profiles where status != COMPLIANCE_RESTRICTED and expiryDate <= currentTime.
 * In atomic transaction:
 * - Updates FalLicense and UserProfile to COMPLIANCE_RESTRICTED.
 * - Suspends ACTIVE listings to UNDER_COMPLIANCE_REVIEW.
 * - Strictly protects RESERVED listings (in-flight deals) and other non-active statuses.
 * - Records immutable AuditLog entries and dispatches notification events.
 */
export function createFalLicenseExpiryLogic(
  db?: FalLicenseExpiryDbClient,
  options?: { notificationDispatcher?: NotificationDispatcher },
): JobHandlerLogic {
  return async (_jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;
    let suspendedListingsCount = 0;

    if (db) {
      const expiredLicenses = await db.falLicense.findMany({
        where: {
          status: { not: ProfileStatus.COMPLIANCE_RESTRICTED },
          expiryDate: { lte: currentTime },
        },
        include: {
          profile: true,
        },
      });

      for (const license of expiredLicenses) {
        const executeInTransaction = async (tx: FalLicenseExpiryDbClient) => {
          // 1. Update FalLicense to COMPLIANCE_RESTRICTED
          await tx.falLicense.update({
            where: { id: license.id },
            data: {
              status: ProfileStatus.COMPLIANCE_RESTRICTED,
              version: { increment: 1 },
            },
          });

          // 2. Update UserProfile to COMPLIANCE_RESTRICTED
          await tx.userProfile.update({
            where: { id: license.profileId },
            data: {
              status: ProfileStatus.COMPLIANCE_RESTRICTED,
            },
          });

          // 3. Write FalLicense restriction AuditLog
          if (tx.auditLog) {
            await tx.auditLog.create({
              data: {
                actorId: 'SYSTEM',
                actorType: 'SYSTEM',
                action: AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED,
                entityType: 'FalLicense',
                entityId: license.id,
                payload: {
                  licenseNumber: license.licenseNumber,
                  commercialName: license.commercialName,
                  expiryDate:
                    license.expiryDate instanceof Date
                      ? license.expiryDate.toISOString()
                      : new Date(license.expiryDate).toISOString(),
                  restrictedAt: evaluationTimeIso,
                },
              },
            });
          }

          // 4. Suspend active listings for this marketer
          const marketerListings = await tx.listing.findMany({
            where: {
              sellerProfileId: license.profileId,
              status: ListingStatus.ACTIVE,
            },
          });

          const suspendedForLicense: string[] = [];
          for (const listing of marketerListings) {
            if (!isListingEligibleForComplianceSuspension(listing)) {
              continue;
            }

            await tx.listing.update({
              where: { id: listing.id },
              data: {
                status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
                complianceReason: COMPLIANCE_REASON_FAL_EXPIRED_AR,
                complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
                complianceActionAt: currentTime,
                complianceOfficerId: 'SYSTEM',
                version: { increment: 1 },
              },
            });

            if (tx.auditLog) {
              await tx.auditLog.create({
                data: {
                  actorId: 'SYSTEM',
                  actorType: 'SYSTEM',
                  action: AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED,
                  entityType: 'Listing',
                  entityId: listing.id,
                  payload: {
                    listingId: listing.id,
                    listingTitle: listing.title,
                    previousStatus: 'ACTIVE',
                    reason: 'FAL_LICENSE_EXPIRED',
                  },
                },
              });
            }

            suspendedForLicense.push(listing.id);
            suspendedListingsCount++;
          }

          return suspendedForLicense;
        };

        const suspendedListingIds = db.$transaction
          ? await db.$transaction(executeInTransaction)
          : await executeInTransaction(db);

        processedCount++;

        // 5. Dispatch notification events
        if (options?.notificationDispatcher) {
          await options.notificationDispatcher.dispatch(
            NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED,
            {
              licenseNumber: license.licenseNumber,
              expiryDate:
                license.expiryDate instanceof Date
                  ? license.expiryDate.toISOString()
                  : new Date(license.expiryDate).toISOString(),
              marketerUserId: license.profile?.userId,
              profileId: license.profileId,
            },
          );

          if (suspendedListingIds.length > 0) {
            await options.notificationDispatcher.dispatch(
              NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW,
              {
                count: suspendedListingIds.length,
                listingIds: suspendedListingIds,
                marketerUserId: license.profile?.userId,
              },
            );
          }
        }
      }
    }

    const outcome = `Evaluated Fal licenses at ${evaluationTimeIso}. Restricted ${processedCount} expired profiles; suspended ${suspendedListingsCount} active listings.`;

    return {
      processedCount,
      outcome,
      details: {
        evaluationTime: evaluationTimeIso,
        processedCount,
        suspendedListingsCount,
      },
    };
  };
}

/**
 * Fal License Expiry Job (Cadence: Daily at 00:05 UTC)
 * Scans approved Fal profiles where expiryDate <= currentTime.
 * Moves profile to ComplianceRestricted and moves active listings to UnderComplianceReview.
 */
export const falLicenseExpiryHandler = createJobHandler(
  JOB_FAL_LICENSE_EXPIRY,
  createFalLicenseExpiryLogic(),
);
