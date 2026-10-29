import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  AUTH_MARKETER_NOT_APPROVED
} from '@elmasaif/shared';

describe('UsersService (AC: 1, 2)', () => {
  let service: UsersService;
  let mockPrisma: any;
  let mockClock: any;

  const mockDate = new Date('2026-10-29T12:00:00.000Z');

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn()
      },
      userProfile: {
        findUnique: jest.fn(),
        create: jest.fn()
      },
      session: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      identityDocument: {
        findFirst: jest.fn()
      }
    };

    mockClock = {
      now: jest.fn().mockReturnValue(mockDate)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock }
      ]
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfiles', () => {
    it('returns activeRole, profiles, and availableRoles', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        token: 'token-123',
        activeRole: UserRole.BUYER
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        fullName: 'فهد السبيعي',
        mobileNumber: '+966501112233',
        username: 'fahad_s',
        profiles: [
          {
            id: 'p-1',
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE,
            payoutIban: null,
            falLicense: null,
            createdAt: mockDate
          }
        ]
      });

      const result = await service.getUserProfiles('u-1', 'token-123');

      expect(result.activeRole).toBe(UserRole.BUYER);
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].role).toBe(UserRole.BUYER);
      expect(result.availableRoles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: UserRole.BUYER, available: true }),
          expect.objectContaining({ role: UserRole.OWNER, isInstant: true }),
          expect.objectContaining({ role: UserRole.MARKETER, requiresFal: true })
        ])
      );
    });
  });

  describe('switchActiveRole - Instantaneous Owner Role', () => {
    it('creates OWNER profile automatically if user switches to OWNER without one', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        fullName: 'فهد السبيعي',
        mobileNumber: '+966501112233',
        username: 'fahad_s',
        profiles: [
          {
            id: 'p-1',
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE,
            falLicense: null
          }
        ]
      });

      mockPrisma.userProfile.create.mockResolvedValueOnce({
        id: 'p-new-owner',
        userId: 'u-1',
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE
      });

      mockPrisma.session.update.mockResolvedValueOnce({
        id: 'sess-1',
        token: 'token-123',
        activeRole: UserRole.OWNER
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        fullName: 'فهد السبيعي',
        mobileNumber: '+966501112233',
        username: 'fahad_s',
        profiles: [
          {
            id: 'p-1',
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE,
            falLicense: null
          },
          {
            id: 'p-new-owner',
            role: UserRole.OWNER,
            status: ProfileStatus.ACTIVE,
            falLicense: null
          }
        ]
      });

      const result = await service.switchActiveRole('u-1', 'token-123', UserRole.OWNER);

      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          role: UserRole.OWNER,
          status: ProfileStatus.ACTIVE
        }
      });
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { token: 'token-123' },
        data: { activeRole: UserRole.OWNER }
      });
      expect(result.activeRole).toBe(UserRole.OWNER);
      expect(result.profiles).toHaveLength(2);
    });

    it('switches to existing OWNER profile without creating a new one', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        profiles: [
          { id: 'p-1', role: UserRole.BUYER, status: ProfileStatus.ACTIVE, falLicense: null },
          { id: 'p-2', role: UserRole.OWNER, status: ProfileStatus.ACTIVE, falLicense: null }
        ]
      });

      mockPrisma.session.update.mockResolvedValueOnce({
        id: 'sess-1',
        activeRole: UserRole.OWNER
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        fullName: 'فهد السبيعي',
        mobileNumber: '+966501112233',
        username: 'fahad_s',
        profiles: [
          { id: 'p-1', role: UserRole.BUYER, status: ProfileStatus.ACTIVE, falLicense: null },
          { id: 'p-2', role: UserRole.OWNER, status: ProfileStatus.ACTIVE, falLicense: null }
        ]
      });

      const result = await service.switchActiveRole('u-1', 'token-123', UserRole.OWNER);

      expect(mockPrisma.userProfile.create).not.toHaveBeenCalled();
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { token: 'token-123' },
        data: { activeRole: UserRole.OWNER }
      });
      expect(result.activeRole).toBe(UserRole.OWNER);
    });
  });

  describe('switchActiveRole - Marketer Fal License Barrier', () => {
    it('throws HTTP 403 Forbidden with AUTH_MARKETER_NOT_APPROVED if no marketer profile exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        profiles: [
          { id: 'p-1', role: UserRole.BUYER, status: ProfileStatus.ACTIVE, falLicense: null }
        ]
      });

      await expect(
        service.switchActiveRole('u-1', 'token-123', UserRole.MARKETER)
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: AUTH_MARKETER_NOT_APPROVED
          }),
          status: HttpStatus.FORBIDDEN
        })
      );

      expect(mockPrisma.session.update).not.toHaveBeenCalled();
    });

    it('throws HTTP 403 Forbidden with AUTH_MARKETER_NOT_APPROVED if marketer profile status is UNDER_REVIEW', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        profiles: [
          {
            id: 'p-m',
            role: UserRole.MARKETER,
            status: ProfileStatus.UNDER_REVIEW,
            falLicense: { status: ProfileStatus.UNDER_REVIEW }
          }
        ]
      });

      await expect(
        service.switchActiveRole('u-1', 'token-123', UserRole.MARKETER)
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: AUTH_MARKETER_NOT_APPROVED
          }),
          status: HttpStatus.FORBIDDEN
        })
      );
    });

    it('successfully switches to MARKETER role if profile and FalLicense are ACTIVE', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        profiles: [
          {
            id: 'p-m',
            role: UserRole.MARKETER,
            status: ProfileStatus.ACTIVE,
            falLicense: {
              status: ProfileStatus.ACTIVE,
              licenseNumber: 'FL-123456'
            }
          }
        ]
      });

      mockPrisma.session.update.mockResolvedValueOnce({
        id: 'sess-1',
        activeRole: UserRole.MARKETER
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        fullName: 'سارة المسوقة',
        mobileNumber: '+966559988776',
        username: 'sara_broker',
        profiles: [
          {
            id: 'p-m',
            role: UserRole.MARKETER,
            status: ProfileStatus.ACTIVE,
            falLicense: {
              status: ProfileStatus.ACTIVE,
              licenseNumber: 'FL-123456'
            }
          }
        ]
      });

      const result = await service.switchActiveRole('u-1', 'token-123', UserRole.MARKETER);

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { token: 'token-123' },
        data: { activeRole: UserRole.MARKETER }
      });
      expect(result.activeRole).toBe(UserRole.MARKETER);
    });
  });

  describe('attachOwnerProfile', () => {
    it('creates owner profile when not existing', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.userProfile.create.mockResolvedValue({
        id: 'p-owner',
        userId: 'u-1',
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE
      });

      const profile = await service.attachOwnerProfile('u-1');

      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          role: UserRole.OWNER,
          status: ProfileStatus.ACTIVE
        }
      });
      expect(profile.role).toBe(UserRole.OWNER);
    });

    it('returns existing owner profile if already attached', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'p-owner-exist',
        userId: 'u-1',
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE
      });

      const profile = await service.attachOwnerProfile('u-1');

      expect(mockPrisma.userProfile.create).not.toHaveBeenCalled();
      expect(profile.id).toBe('p-owner-exist');
    });
  });

  describe('verifyBuyerIdentityPrerequisite (AC: 4, BR-10)', () => {
    it('returns true when a clean identity document exists in PENDING_REVIEW or VERIFIED status', async () => {
      mockPrisma.identityDocument.findFirst.mockResolvedValue({ id: 'id-doc-1' });

      const allowed = await service.verifyBuyerIdentityPrerequisite('user-1');

      expect(allowed).toBe(true);
      expect(mockPrisma.identityDocument.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: { in: ['PENDING_REVIEW', 'VERIFIED'] },
          fileObject: { scanStatus: 'CLEAN' }
        },
        select: { id: true }
      });
    });

    it('returns false when no clean document exists or when rejected', async () => {
      mockPrisma.identityDocument.findFirst.mockResolvedValue(null);

      const allowed = await service.verifyBuyerIdentityPrerequisite('user-unverified');

      expect(allowed).toBe(false);
    });
  });
});
