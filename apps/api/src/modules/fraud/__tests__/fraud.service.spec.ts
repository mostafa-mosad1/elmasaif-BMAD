import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from '../fraud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  FraudEventType,
  FraudSeverity,
  FraudStatus,
  ProfileStatus,
  ListingStatus,
  AUDIT_ACTION_FRAUD_LOGGED,
  AUDIT_ACTION_FRAUD_RESOLVED,
  AUDIT_ACTION_PENALTY_RECORDED,
  AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED,
} from '@elmasaif/shared';

describe('FraudService', () => {
  let service: FraudService;
  let prisma: any;
  let auditService: any;
  let clockService: any;

  const mockAdminId = 'adm-00000000-0000-0000-0000-000000000001';
  const mockUserId = 'usr-00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      fraudLog: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: mockUserId, status: ProfileStatus.COMPLIANCE_RESTRICTED }),
      },
      userProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      platformSetting: {
        findUnique: jest.fn().mockResolvedValue({
          fraudRejectedProofThreshold: 3,
          fraudWindowHours: 72,
        }),
      },
      payment: {
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date('2026-11-15T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<FraudService>(FraudService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFraudLog', () => {
    it('should create a fraud log entry with sequential caseNumber and audit log', async () => {
      prisma.fraudLog.count.mockResolvedValueOnce(5);
      const mockCreated = {
        id: 'frd-uuid-1',
        caseNumber: 'FRD-2026-0006',
        eventType: FraudEventType.MANUAL_SUSPICIOUS_REPORT,
        severity: FraudSeverity.HIGH,
        status: FraudStatus.OPEN,
        description: 'Suspicious off-platform payment solicitation',
        detectedReasons: ['Reported by buyer', 'Matched forbidden contact phrases'],
        loggedByAdminId: mockAdminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.fraudLog.create.mockResolvedValueOnce(mockCreated);

      const result = await service.createFraudLog(mockAdminId, {
        eventType: FraudEventType.MANUAL_SUSPICIOUS_REPORT,
        severity: FraudSeverity.HIGH,
        description: 'Suspicious off-platform payment solicitation',
        detectedReasons: ['Reported by buyer', 'Matched forbidden contact phrases'],
      });

      expect(result.caseNumber).toBe('FRD-2026-0006');
      expect(prisma.fraudLog.create).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_FRAUD_LOGGED,
        }),
      );
    });

    it('should suspend marketer and transition listings to UNDER_COMPLIANCE_REVIEW if suspendMarketer is true', async () => {
      prisma.fraudLog.count.mockResolvedValueOnce(0);
      const mockCreated = {
        id: 'frd-uuid-2',
        caseNumber: 'FRD-2026-0001',
        eventType: FraudEventType.UNAUTHORIZED_BROKER_ACTIVITY,
        severity: FraudSeverity.CRITICAL,
        status: FraudStatus.OPEN,
        targetUserId: mockUserId,
        marketerSuspended: true,
        description: 'Operating without valid FAL license and spoofing ID',
        detectedReasons: ['FAL check failed'],
        loggedByAdminId: mockAdminId,
      };
      prisma.fraudLog.create.mockResolvedValueOnce(mockCreated);

      await service.createFraudLog(mockAdminId, {
        targetUserId: mockUserId,
        eventType: FraudEventType.UNAUTHORIZED_BROKER_ACTIVITY,
        severity: FraudSeverity.CRITICAL,
        description: 'Operating without valid FAL license and spoofing ID',
        detectedReasons: ['FAL check failed'],
        suspendMarketer: true,
        penaltySar: 1000,
        penaltyReason: 'Violation of licensing and brokerage regulations',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { status: ProfileStatus.COMPLIANCE_RESTRICTED },
      });
      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: {
          sellerProfile: { userId: mockUserId },
          status: { in: [ListingStatus.ACTIVE, ListingStatus.PENDING_REVIEW, ListingStatus.RESERVED] },
        },
        data: { status: ListingStatus.UNDER_COMPLIANCE_REVIEW },
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_PENALTY_RECORDED,
        }),
      );
    });
  });

  describe('resolveFraudLog', () => {
    it('should update status to RESOLVED with resolution notes and record audit log', async () => {
      const existing = {
        id: 'frd-uuid-1',
        caseNumber: 'FRD-2026-0001',
        status: FraudStatus.OPEN,
      };
      prisma.fraudLog.findUnique.mockResolvedValueOnce(existing);
      prisma.fraudLog.update.mockResolvedValueOnce({
        ...existing,
        status: FraudStatus.RESOLVED,
        resolutionNotes: 'Investigation confirmed legitimate transaction documentation',
        resolvedByAdminId: mockAdminId,
      });

      const res = await service.resolveFraudLog(mockAdminId, 'frd-uuid-1', {
        status: FraudStatus.RESOLVED,
        resolutionNotes: 'Investigation confirmed legitimate transaction documentation',
      });

      expect(res.status).toBe(FraudStatus.RESOLVED);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_FRAUD_RESOLVED,
        }),
      );
    });
  });

  describe('recordAutomatedFraudEventIfThresholdReached', () => {
    it('should trigger automated fraud case if rejected proof count reaches threshold', async () => {
      prisma.payment.count.mockResolvedValueOnce(3); // >= 3 rejected proofs
      prisma.fraudLog.count.mockResolvedValueOnce(0); // 0 cases for year count
      prisma.fraudLog.findFirst = jest.fn().mockResolvedValueOnce(null); // no existing open case

      prisma.fraudLog.create.mockResolvedValueOnce({
        id: 'frd-auto-1',
        caseNumber: 'FRD-2026-0001',
        eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
        severity: FraudSeverity.HIGH,
      });

      const created = await service.recordAutomatedFraudEventIfThresholdReached(
        mockUserId,
        FraudEventType.REPEATED_REJECTED_PROOFS,
      );

      expect(created).toBeDefined();
      expect(prisma.fraudLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
            severity: FraudSeverity.HIGH,
            targetUserId: mockUserId,
          }),
        }),
      );
    });
  });
});
