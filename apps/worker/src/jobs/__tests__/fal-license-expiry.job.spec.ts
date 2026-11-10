import { describe, it, expect, vi } from 'vitest';
import {
  AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED,
  AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED,
  COMPLIANCE_CATEGORY_FAL_EXPIRED,
  COMPLIANCE_REASON_FAL_EXPIRED_AR,
  ListingStatus,
  NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED,
  NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW,
  ProfileStatus,
} from '@elmasaif/shared';
import {
  createFalLicenseExpiryLogic,
  type FalLicenseExpiryDbClient,
} from '../fal-license-expiry.job';

describe('Story 6.2: Fal License Expiry Worker Job', () => {
  const currentTime = new Date('2026-11-10T00:05:00.000Z');
  const expiredDate = new Date('2026-11-09T23:59:59.000Z');
  const futureDate = new Date('2026-11-20T00:00:00.000Z');

  const createMockDb = (licenses: any[] = [], listings: any[] = []) => {
    const calls = {
      licenseUpdates: [] as any[],
      profileUpdates: [] as any[],
      listingUpdates: [] as any[],
      auditLogs: [] as any[],
    };

    const db: FalLicenseExpiryDbClient = {
      $transaction: vi.fn(async (callback: any) => callback(db)),
      falLicense: {
        findMany: vi.fn().mockImplementation((args: any) => {
          // Filter candidate licenses based on status and expiryDate
          return Promise.resolve(
            licenses.filter((l) => {
              const statusMatch =
                args?.where?.status?.not === ProfileStatus.COMPLIANCE_RESTRICTED
                  ? l.status !== ProfileStatus.COMPLIANCE_RESTRICTED
                  : args?.where?.status === ProfileStatus.ACTIVE
                  ? l.status === ProfileStatus.ACTIVE
                  : true;
              const dateMatch = args?.where?.expiryDate?.lte
                ? new Date(l.expiryDate) <= args.where.expiryDate.lte
                : true;
              return statusMatch && dateMatch;
            }),
          );
        }),
        update: vi.fn().mockImplementation((args: any) => {
          calls.licenseUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      userProfile: {
        update: vi.fn().mockImplementation((args: any) => {
          calls.profileUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      listing: {
        findMany: vi.fn().mockImplementation((args: any) => {
          return Promise.resolve(
            listings.filter((listing) => {
              const sellerMatch = args?.where?.sellerProfileId
                ? listing.sellerProfileId === args.where.sellerProfileId
                : true;
              const statusMatch = args?.where?.status
                ? listing.status === args.where.status
                : true;
              return sellerMatch && statusMatch;
            }),
          );
        }),
        update: vi.fn().mockImplementation((args: any) => {
          calls.listingUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation((args: any) => {
          calls.auditLogs.push(args);
          return Promise.resolve(args);
        }),
      },
    };

    return { db, calls };
  };

  it('completes cleanly with processedCount = 0 when no expired licenses exist', async () => {
    const { db } = createMockDb([]);
    const logic = createFalLicenseExpiryLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('0 expired profiles');
  });

  it('restricts expired Fal licenses and associated UserProfile atomically', async () => {
    const mockLicense = {
      id: 'lic-1',
      profileId: 'prof-1',
      licenseNumber: '1100001234',
      commercialName: 'Al-Khobar Realty',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiredDate,
      version: 1,
      profile: { id: 'prof-1', userId: 'user-1' },
    };

    const { db, calls } = createMockDb([mockLicense], []);
    const logic = createFalLicenseExpiryLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(1);

    // Verify atomic transaction was invoked
    expect(db.$transaction).toHaveBeenCalled();

    // Verify FalLicense update
    expect(calls.licenseUpdates).toHaveLength(1);
    expect(calls.licenseUpdates[0]).toEqual({
      where: { id: 'lic-1' },
      data: {
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
        version: { increment: 1 },
      },
    });

    // Verify UserProfile update
    expect(calls.profileUpdates).toHaveLength(1);
    expect(calls.profileUpdates[0]).toEqual({
      where: { id: 'prof-1' },
      data: {
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
      },
    });

    // Verify FalLicense audit log
    const licenseAudit = calls.auditLogs.find(
      (a: any) => a.data.action === AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED,
    );
    expect(licenseAudit).toBeDefined();
    expect(licenseAudit.data).toMatchObject({
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
      entityType: 'FalLicense',
      entityId: 'lic-1',
      payload: {
        licenseNumber: '1100001234',
        commercialName: 'Al-Khobar Realty',
        expiryDate: expiredDate.toISOString(),
        restrictedAt: currentTime.toISOString(),
      },
    });
  });

  it('suspends ACTIVE listings of expired marketer to UNDER_COMPLIANCE_REVIEW with metadata and audit', async () => {
    const mockLicense = {
      id: 'lic-1',
      profileId: 'prof-1',
      licenseNumber: '1100001234',
      commercialName: 'Al-Khobar Realty',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiredDate,
      version: 1,
      profile: { id: 'prof-1', userId: 'user-1' },
    };

    const activeListing = {
      id: 'listing-1',
      title: 'Luxury Villa',
      sellerProfileId: 'prof-1',
      status: ListingStatus.ACTIVE,
    };

    const { db, calls } = createMockDb([mockLicense], [activeListing]);
    const logic = createFalLicenseExpiryLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(1);

    // Verify listing update
    expect(calls.listingUpdates).toHaveLength(1);
    expect(calls.listingUpdates[0]).toEqual({
      where: { id: 'listing-1' },
      data: {
        status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
        complianceReason: COMPLIANCE_REASON_FAL_EXPIRED_AR,
        complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        complianceActionAt: currentTime,
        complianceOfficerId: 'SYSTEM',
        version: { increment: 1 },
      },
    });

    // Verify listing audit log
    const listingAudit = calls.auditLogs.find(
      (a: any) => a.data.action === AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED,
    );
    expect(listingAudit).toBeDefined();
    expect(listingAudit.data).toMatchObject({
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
      entityType: 'Listing',
      entityId: 'listing-1',
      payload: {
        listingId: 'listing-1',
        listingTitle: 'Luxury Villa',
        previousStatus: 'ACTIVE',
        reason: 'FAL_LICENSE_EXPIRED',
      },
    });
  });

  it('strictly protects RESERVED listings (in-flight deals) and non-active statuses from suspension', async () => {
    const mockLicense = {
      id: 'lic-1',
      profileId: 'prof-1',
      licenseNumber: '1100001234',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiredDate,
      version: 1,
      profile: { id: 'prof-1', userId: 'user-1' },
    };

    const reservedListing = {
      id: 'listing-reserved',
      title: 'Reserved Villa with in-flight deal',
      sellerProfileId: 'prof-1',
      status: ListingStatus.RESERVED,
    };

    const draftListing = {
      id: 'listing-draft',
      title: 'Draft Apartment',
      sellerProfileId: 'prof-1',
      status: ListingStatus.DRAFT,
    };

    const archivedListing = {
      id: 'listing-archived',
      title: 'Archived Land',
      sellerProfileId: 'prof-1',
      status: ListingStatus.ARCHIVED,
    };

    const { db, calls } = createMockDb(
      [mockLicense],
      [reservedListing, draftListing, archivedListing],
    );
    const logic = createFalLicenseExpiryLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(1);
    // Listing updates should be 0 because none are ACTIVE
    expect(calls.listingUpdates).toHaveLength(0);
  });

  it('dispatches notification events when notificationDispatcher is provided', async () => {
    const mockLicense = {
      id: 'lic-1',
      profileId: 'prof-1',
      licenseNumber: '1100001234',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiredDate,
      version: 1,
      profile: { id: 'prof-1', userId: 'user-1' },
    };

    const activeListing = {
      id: 'listing-1',
      title: 'Villa',
      sellerProfileId: 'prof-1',
      status: ListingStatus.ACTIVE,
    };

    const { db } = createMockDb([mockLicense], [activeListing]);
    const mockDispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    };

    const logic = createFalLicenseExpiryLogic(db, {
      notificationDispatcher: mockDispatcher,
    });
    await logic([], currentTime);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED,
      expect.objectContaining({
        licenseNumber: '1100001234',
        marketerUserId: 'user-1',
      }),
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW,
      expect.objectContaining({
        count: 1,
        listingIds: ['listing-1'],
        marketerUserId: 'user-1',
      }),
    );
  });
});

