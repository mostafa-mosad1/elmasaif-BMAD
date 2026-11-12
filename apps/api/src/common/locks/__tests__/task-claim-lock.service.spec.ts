import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AdminRole,
  InquiryStatus,
  ListingStatus,
  OfferStatus,
  OPERATIONAL_QUEUE_TYPES,
  OPTIMISTIC_VERSION_CONFLICT,
  PaymentType,
  ProfileStatus,
  PropertyType,
  TASK_CLAIM_LEASE_DURATION_SECONDS,
} from '@elmasaif/shared';
import {
  assertOptimisticVersion,
  parseIfMatchHeader,
} from '../claim-lock';
import { TaskClaimLockService } from '../task-claim-lock.service';

describe('Story 8.3: TaskClaimLockService & Optimistic Concurrency Helpers', () => {
  const FIXED_NOW = new Date('2026-11-12T10:00:00.000Z');
  const ACTIVE_EXPIRES_AT = new Date(FIXED_NOW.getTime() + 10 * 60 * 1000); // +10m
  const EXPIRED_AT = new Date(FIXED_NOW.getTime() - 60 * 1000); // -1m

  const adminA = {
    id: 'admin-a-id',
    username: 'moderator_a',
    fullName: 'أحمد المشرف الأول',
    role: AdminRole.MODERATOR,
    permissions: ['Tasks.View', 'Tasks.Claim', 'Listings.Review'],
  };

  const adminB = {
    id: 'admin-b-id',
    username: 'moderator_b',
    fullName: 'خالد المشرف الثاني',
    role: AdminRole.MODERATOR,
    permissions: ['Tasks.View', 'Tasks.Claim', 'Listings.Review'],
  };

  const superAdmin = {
    id: 'super-admin-id',
    username: 'super_admin',
    fullName: 'سلمان المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    permissions: ['Tasks.ForceUnlock'],
  };

  const createMockModel = (defaultRecord: Record<string, any>) => ({
    findUnique: jest.fn().mockResolvedValue(defaultRecord),
    findMany: jest.fn().mockResolvedValue([defaultRecord]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    update: jest.fn().mockImplementation(async ({ data }) => ({
      ...defaultRecord,
      ...data,
    })),
  });

  const buildHarness = () => {
    const baseLockFields = {
      lockedByAdminId: null,
      lockedAt: null,
      lockExpiresAt: null,
      createdAt: new Date('2026-11-12T08:00:00.000Z'),
      updatedAt: new Date('2026-11-12T09:00:00.000Z'),
    };

    const listingRecord = {
      id: 'listing-1',
      title: 'فيلا سكنية في أبها',
      propertyType: PropertyType.VILLA,
      status: ListingStatus.PENDING_REVIEW,
      version: 2,
      ...baseLockFields,
    };

    const licenseRecord = {
      id: 'license-1',
      licenseNumber: '1200004567',
      commercialName: 'مؤسسة المصايف العقارية',
      status: ProfileStatus.UNDER_REVIEW,
      version: 1,
      ...baseLockFields,
    };

    const ownerRequestRecord = {
      id: 'owner-req-1',
      titleDeedNumber: '310122334455',
      propertyType: PropertyType.VILLA,
      status: 'SUBMITTED',
      ...baseLockFields,
    };

    const paymentRecord = {
      id: 'payment-1',
      dealId: 'deal-1',
      paymentType: PaymentType.PLATFORM_COMMISSION,
      amount: '25000.00',
      status: 'PROOF_UPLOADED',
      bankReferenceCode: 'REF-9988',
      deal: { dealNumber: 'DL-20261112-0001', version: 1 },
      ...baseLockFields,
    };

    const contractFeeRecord = {
      id: 'cfee-1',
      ownerContractId: 'contract-1',
      amount: '1000.00',
      status: 'PROOF_UPLOADED',
      bankReferenceCode: 'CF-1122',
      ...baseLockFields,
    };

    const inquiryRecord = {
      id: 'inquiry-1',
      listingId: 'listing-1',
      subject: 'استفسار عن الصك والكهرباء',
      status: InquiryStatus.PENDING_ADMIN_REVIEW,
      version: 1,
      ...baseLockFields,
    };

    const disputeRecord = {
      id: 'dispute-1',
      dealId: 'deal-1',
      reason: 'خلاف حول مطابقة الحوالة البنكية',
      status: 'OPEN',
      deal: { dealNumber: 'DL-20261112-0001', version: 3 },
      ...baseLockFields,
    };

    const offerRecord = {
      id: 'offer-1',
      listingId: 'listing-1',
      offerPrice: '950000.00',
      status: OfferStatus.PENDING_ADMIN_REVIEW,
      version: 1,
      ...baseLockFields,
    };

    const tx: Record<string, any> = {
      listing: createMockModel(listingRecord),
      falLicense: createMockModel(licenseRecord),
      ownerListingRequest: createMockModel(ownerRequestRecord),
      payment: createMockModel(paymentRecord),
      contractFeePayment: createMockModel(contractFeeRecord),
      listingInquiry: createMockModel(inquiryRecord),
      dispute: createMockModel(disputeRecord),
      offer: createMockModel(offerRecord),
      adminUser: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          const ids: string[] = where?.id?.in ?? [];
          const all = [adminA, adminB, superAdmin];
          return all.filter((a) => ids.includes(a.id));
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const prisma: any = {
      ...tx,
      $transaction: jest.fn().mockImplementation(async (cb: (client: any) => Promise<any>) => cb(tx)),
    };

    const clockService: any = {
      now: jest.fn().mockReturnValue(FIXED_NOW),
    };

    const service = new TaskClaimLockService(prisma, clockService);

    return {
      service,
      prisma,
      tx,
      clockService,
      records: {
        listingRecord,
        licenseRecord,
        ownerRequestRecord,
        paymentRecord,
        contractFeeRecord,
        inquiryRecord,
        disputeRecord,
        offerRecord,
      },
    };
  };

  describe('parseIfMatchHeader & assertOptimisticVersion (AC4)', () => {
    it('parses ETag and numeric If-Match headers and throws 409 Conflict on version mismatch', () => {
      expect(parseIfMatchHeader('"2"', 1)).toBe(2);
      expect(parseIfMatchHeader('W/"5"')).toBe(5);
      expect(parseIfMatchHeader(undefined, 3)).toBe(3);

      expect(() => assertOptimisticVersion(2, 2, 'LISTING_VERSION_CONFLICT')).not.toThrow();
      expect(() => assertOptimisticVersion(undefined, 2)).not.toThrow();

      try {
        assertOptimisticVersion(1, 2, 'LISTING_VERSION_CONFLICT');
        fail('Should have thrown ConflictException');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as Record<string, any>;
        expect(res.code).toBe('LISTING_VERSION_CONFLICT');
        expect(res.expectedVersion).toBe(1);
        expect(res.currentVersion).toBe(2);
      }
    });

    it('defaults conflict code to OPTIMISTIC_VERSION_CONFLICT', () => {
      try {
        assertOptimisticVersion(4, 5);
        fail('Should have thrown ConflictException');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as Record<string, any>;
        expect(res.code).toBe(OPTIMISTIC_VERSION_CONFLICT);
      }
    });
  });

  describe('Atomic Claim Across All 8 Operational Queues (AC2, AC3)', () => {
    it.each([
      ['listings', 'listing-1', 'listing', 'LISTING'],
      ['licenses', 'license-1', 'falLicense', 'FAL_PROFILE'],
      ['fal-profiles', 'license-1', 'falLicense', 'FAL_PROFILE'],
      ['owner-requests', 'owner-req-1', 'ownerListingRequest', 'OWNER_REQUEST'],
      ['payments', 'payment-1', 'payment', 'PAYMENT'],
      ['contract-fees', 'cfee-1', 'contractFeePayment', 'CONTRACT_FEE'],
      ['inquiries', 'inquiry-1', 'listingInquiry', 'CONVERSATION'],
      ['conversations', 'inquiry-1', 'listingInquiry', 'CONVERSATION'],
      ['disputes', 'dispute-1', 'dispute', 'DISPUTE'],
      ['offers', 'offer-1', 'offer', 'OFFER'],
    ])(
      'atomically claims item in queue "%s" with 15-minute lease and audit log',
      async (slug, entityId, modelKey, expectedQueueType) => {
        const { service, tx } = buildHarness();

        const updatedRecord = {
          ...(await tx[modelKey].findUnique()),
          lockedByAdminId: adminA.id,
          lockedAt: FIXED_NOW,
          lockExpiresAt: new Date(FIXED_NOW.getTime() + 15 * 60 * 1000),
        };
        tx[modelKey].findUnique
          .mockResolvedValueOnce(await tx[modelKey].findUnique())
          .mockResolvedValueOnce(updatedRecord);

        const result = await service.claimTask(slug, entityId, adminA);

        expect(result.queueType).toBe(expectedQueueType);
        expect(result.entityId).toBe(entityId);
        expect(result.lockInfo.isLocked).toBe(true);
        expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
        expect(result.lockInfo.lockedByAdminId).toBe(adminA.id);
        expect(result.lockInfo.lockedByAdminName).toBe(adminA.fullName);
        expect(result.lockInfo.remainingSeconds).toBe(TASK_CLAIM_LEASE_DURATION_SECONDS);

        expect(tx[modelKey].updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: entityId,
              OR: [
                { lockedByAdminId: null },
                { lockExpiresAt: { lte: FIXED_NOW } },
                { lockedByAdminId: adminA.id },
              ],
            }),
          }),
        );
        expect(tx.auditLog.create).toHaveBeenCalled();
      },
    );

    it('allows immediate lazy-expiry takeover when lockExpiresAt <= ClockService.now()', async () => {
      const { service, tx, records } = buildHarness();
      const expiredListing = {
        ...records.listingRecord,
        lockedByAdminId: adminA.id,
        lockedAt: new Date(FIXED_NOW.getTime() - 16 * 60 * 1000),
        lockExpiresAt: EXPIRED_AT,
      };
      const claimedByB = {
        ...records.listingRecord,
        lockedByAdminId: adminB.id,
        lockedAt: FIXED_NOW,
        lockExpiresAt: new Date(FIXED_NOW.getTime() + 15 * 60 * 1000),
      };

      tx.listing.findUnique
        .mockResolvedValueOnce(expiredListing)
        .mockResolvedValueOnce(claimedByB);
      tx.listing.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.claimTask('listings', 'listing-1', adminB);
      expect(result.lockInfo.lockedByAdminId).toBe(adminB.id);
      expect(result.lockInfo.lockedByAdminName).toBe(adminB.fullName);
    });

    it('throws 409 Conflict with lockInfo (lockedByAdminName, remainingSeconds) when actively locked by another admin', async () => {
      const { service, tx, records } = buildHarness();
      const lockedByA = {
        ...records.listingRecord,
        lockedByAdminId: adminA.id,
        lockedAt: FIXED_NOW,
        lockExpiresAt: ACTIVE_EXPIRES_AT,
      };

      tx.listing.findUnique.mockResolvedValue(lockedByA);
      tx.listing.updateMany.mockResolvedValueOnce({ count: 0 });

      try {
        await service.claimTask('listings', 'listing-1', adminB);
        fail('Should have thrown ConflictException');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as Record<string, any>;
        expect(res.lockInfo).toBeDefined();
        expect(res.lockInfo.isLocked).toBe(true);
        expect(res.lockInfo.lockedByAdminId).toBe(adminA.id);
        expect(res.lockInfo.lockedByAdminName).toBe(adminA.fullName);
        expect(res.lockInfo.remainingSeconds).toBe(600);
      }
    });
  });

  describe('Heartbeat Renewal (5-Minute Cadence -> +15m Lease Extension)', () => {
    it('extends lockExpiresAt to ClockService.now() + 15 minutes when held by caller', async () => {
      const { service, tx, records } = buildHarness();
      const heldByA = {
        ...records.listingRecord,
        lockedByAdminId: adminA.id,
        lockedAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 1000),
        lockExpiresAt: ACTIVE_EXPIRES_AT,
      };
      const renewedByA = {
        ...heldByA,
        lockExpiresAt: new Date(FIXED_NOW.getTime() + 15 * 60 * 1000),
      };

      tx.listing.findUnique.mockResolvedValueOnce(heldByA);
      tx.listing.update.mockResolvedValueOnce(renewedByA);

      const result = await service.heartbeatTask('listings', 'listing-1', adminA);
      expect(result.lockInfo.remainingSeconds).toBe(900);
      expect(result.lockInfo.lockedByAdminName).toBe(adminA.fullName);
    });

    it('rejects heartbeat with 409 Conflict when lock is expired or held by another admin', async () => {
      const { service, tx, records } = buildHarness();
      const expiredLock = {
        ...records.listingRecord,
        lockedByAdminId: adminA.id,
        lockedAt: new Date(FIXED_NOW.getTime() - 20 * 60 * 1000),
        lockExpiresAt: EXPIRED_AT,
      };
      tx.listing.findUnique.mockResolvedValueOnce(expiredLock);

      await expect(service.heartbeatTask('listings', 'listing-1', adminA)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('Voluntary Release & Super Admin Force-Unlock (Tasks.ForceUnlock)', () => {
    it('releases active lock held by current admin and writes AuditLog', async () => {
      const { service, tx, records } = buildHarness();
      const heldByA = {
        ...records.listingRecord,
        lockedByAdminId: adminA.id,
        lockedAt: FIXED_NOW,
        lockExpiresAt: ACTIVE_EXPIRES_AT,
      };
      tx.listing.findUnique.mockResolvedValueOnce(heldByA);

      const result = await service.releaseTask('listings', 'listing-1', adminA);
      expect(result.lockInfo.isLocked).toBe(false);
      expect(result.lockInfo.remainingSeconds).toBe(0);
      expect(tx.auditLog.create).toHaveBeenCalled();
    });

    it('force-unlocks task held by another admin with mandatory reason >= 5 chars and records previous holder in AuditLog', async () => {
      const { service, tx, records } = buildHarness();
      const heldByA = {
        ...records.disputeRecord,
        lockedByAdminId: adminA.id,
        lockedAt: FIXED_NOW,
        lockExpiresAt: ACTIVE_EXPIRES_AT,
      };
      tx.dispute.findUnique.mockResolvedValueOnce(heldByA);

      const reason = 'انقطاع جلسة المشرف المناوب والحاجة للفصل الفوري في النزاع';
      const result = await service.forceUnlockTask('disputes', 'dispute-1', superAdmin, reason);

      expect(result.lockInfo.isLocked).toBe(false);
      expect(result.previousLockedByAdminId).toBe(adminA.id);
      expect(result.previousLockedByAdminName).toBe(adminA.fullName);
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: superAdmin.id,
            entityId: 'dispute-1',
            payload: expect.objectContaining({
              reason,
              previousLockedByAdminId: adminA.id,
              previousLockedByAdminName: adminA.fullName,
            }),
          }),
        }),
      );
    });

    it('rejects force-unlock when reason is shorter than 5 characters', async () => {
      const { service } = buildHarness();
      await expect(
        service.forceUnlockTask('listings', 'listing-1', superAdmin, 'قصير'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for unknown queue slug', async () => {
      const { service } = buildHarness();
      await expect(service.claimTask('non-existent', 'id-1', adminA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('Unified Operational Queues Hub (getOperationalQueuesHub)', () => {
    it('aggregates counts and items across all 8 operational queues', async () => {
      const { service, tx, records } = buildHarness();
      tx.listing.findMany.mockResolvedValueOnce([
        {
          ...records.listingRecord,
          lockedByAdminId: adminA.id,
          lockedAt: FIXED_NOW,
          lockExpiresAt: ACTIVE_EXPIRES_AT,
        },
      ]);

      const hub = await service.getOperationalQueuesHub(superAdmin, {
        lockState: 'ALL',
        page: 1,
        limit: 20,
      });

      expect(hub.queues).toHaveLength(OPERATIONAL_QUEUE_TYPES.length);
      expect(hub.summary.totalPending).toBe(8);
      expect(hub.summary.activelyLocked).toBe(1);
      expect(hub.summary.unlockedAvailable).toBe(7);
      expect(hub.items).toHaveLength(8);
    });
  });
});

