import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { ActiveRoleGuard } from '../guards/active-role.guard';
import { ROLES_KEY } from '../decorators/require-role.decorator';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  AUTH_ROLE_NOT_AUTHORIZED
} from '@elmasaif/shared';

describe('UsersController & ActiveRoleGuard (AC: 1, 2, 3)', () => {
  let controller: UsersController;
  let mockUsersService: any;
  let mockPrismaService: any;
  let mockClockService: any;
  let activeRoleGuard: ActiveRoleGuard;

  beforeEach(async () => {
    mockUsersService = {
      getUserProfiles: jest.fn(),
      switchActiveRole: jest.fn(),
      attachOwnerProfile: jest.fn()
    };

    mockPrismaService = {
      session: {
        findUnique: jest.fn()
      }
    };

    mockClockService = {
      now: jest.fn().mockReturnValue(new Date('2026-10-29T12:00:00.000Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClockService, useValue: mockClockService },
        SessionAuthGuard,
        ActiveRoleGuard,
        Reflector
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
    activeRoleGuard = module.get<ActiveRoleGuard>(ActiveRoleGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/profiles', () => {
    it('returns user profiles and activeRole', async () => {
      mockUsersService.getUserProfiles.mockResolvedValue({
        activeRole: UserRole.BUYER,
        profiles: [],
        availableRoles: []
      });

      const req: any = {
        user: { id: 'user-1', sessionToken: 'token-abc' },
        headers: { 'x-request-id': 'req-123' }
      };

      const res = await controller.getProfiles(req);

      expect(mockUsersService.getUserProfiles).toHaveBeenCalledWith('user-1', 'token-abc');
      expect(res.code).toBe('SUCCESS');
      expect(res.data.activeRole).toBe(UserRole.BUYER);
    });
  });

  describe('POST /users/profiles/switch', () => {
    it('switches role and returns updated session user', async () => {
      const updatedUser = {
        id: 'user-1',
        fullName: 'فهد',
        mobileNumber: '+966501112233',
        username: 'fahad',
        role: 'OWNER',
        activeRole: UserRole.OWNER,
        profiles: []
      };

      mockUsersService.switchActiveRole.mockResolvedValue(updatedUser);

      const req: any = {
        user: { id: 'user-1', sessionToken: 'token-abc', activeRole: UserRole.BUYER },
        headers: { 'x-request-id': 'req-switch-1' }
      };

      const res = await controller.switchRole({ role: UserRole.OWNER }, req);

      expect(mockUsersService.switchActiveRole).toHaveBeenCalledWith(
        'user-1',
        'token-abc',
        UserRole.OWNER
      );
      expect(req.user.activeRole).toBe(UserRole.OWNER);
      expect(res.code).toBe('SUCCESS');
      expect(res.data.user.activeRole).toBe(UserRole.OWNER);
    });
  });

  describe('POST /users/profiles/attach-owner', () => {
    it('attaches owner profile', async () => {
      const ownerProfile = {
        id: 'p-owner',
        userId: 'user-1',
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE
      };
      mockUsersService.attachOwnerProfile.mockResolvedValue(ownerProfile);

      const req: any = {
        user: { id: 'user-1' },
        headers: { 'x-request-id': 'req-attach-1' }
      };

      const res = await controller.attachOwner(req);

      expect(mockUsersService.attachOwnerProfile).toHaveBeenCalledWith('user-1');
      expect(res.code).toBe('SUCCESS');
      expect(res.data.role).toBe(UserRole.OWNER);
    });
  });

  describe('ActiveRoleGuard (AC: 3)', () => {
    function createMockContext(user: any, handlerRoles?: UserRole[]): ExecutionContext {
      const handler = () => {};
      if (handlerRoles) {
        Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler);
      }
      return {
        getHandler: () => handler,
        getClass: () => class TestController {},
        switchToHttp: () => ({
          getRequest: () => ({ user, headers: { 'x-request-id': 'test-req-id' } })
        })
      } as unknown as ExecutionContext;
    }

    it('allows request when no roles metadata is set', () => {
      const context = createMockContext({ activeRole: UserRole.BUYER });
      expect(activeRoleGuard.canActivate(context)).toBe(true);
    });

    it('allows request when activeRole matches @RequireRole', () => {
      const context = createMockContext(
        { activeRole: UserRole.OWNER },
        [UserRole.OWNER]
      );
      expect(activeRoleGuard.canActivate(context)).toBe(true);
    });

    it('rejects request with HTTP 403 Forbidden and AUTH_ROLE_NOT_AUTHORIZED when activeRole does not match', () => {
      const context = createMockContext(
        { activeRole: UserRole.BUYER },
        [UserRole.OWNER]
      );

      try {
        activeRoleGuard.canActivate(context);
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = err.getResponse();
        expect(response.code).toBe(AUTH_ROLE_NOT_AUTHORIZED);
        expect(response.details.requiredRoles).toEqual([UserRole.OWNER]);
        expect(response.details.currentActiveRole).toBe(UserRole.BUYER);
      }
    });
  });
});
