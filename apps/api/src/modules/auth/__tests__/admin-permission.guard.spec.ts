import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminRole,
  AUTH_NOT_AUTHORIZED,
} from '@elmasaif/shared';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import {
  ADMIN_PERMISSION_METADATA_KEY,
  RequireAdminPermission,
  RequirePermissions,
} from '../decorators/require-admin-permission.decorator';

describe('AdminPermissionGuard & @RequirePermissions (Story 8.2) (AC: 2)', () => {
  let reflector: Reflector;
  let guard: AdminPermissionGuard;

  function createContext(
    admin: Record<string, unknown> | undefined,
    handler = () => {},
    cls = class DummyController {}
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({
        getRequest: () => ({ admin }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AdminPermissionGuard(reflector);
  });

  it('exports RequirePermissions as an alias of RequireAdminPermission setting ADMIN_PERMISSION_METADATA_KEY', () => {
    class TestController {
      @RequirePermissions('Rbac.Manage')
      singlePerm() {}

      @RequireAdminPermission('Reviews.Moderate', 'Geo.Manage')
      multiPerm() {}
    }

    const singleMeta = Reflect.getMetadata(
      ADMIN_PERMISSION_METADATA_KEY,
      TestController.prototype.singlePerm
    );
    const multiMeta = Reflect.getMetadata(
      ADMIN_PERMISSION_METADATA_KEY,
      TestController.prototype.multiPerm
    );

    expect(singleMeta).toBe('Rbac.Manage');
    expect(multiMeta).toEqual(['Reviews.Moderate', 'Geo.Manage']);
  });

  it('allows access when no permission metadata is attached to handler or class', () => {
    const ctx = createContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects missing, inactive, or soft-deleted admin with 403 AUTH_NOT_AUTHORIZED', () => {
    class SecuredController {
      @RequirePermissions('Users.View')
      viewUsers() {}
    }

    expect(() =>
      guard.canActivate(
        createContext(undefined, SecuredController.prototype.viewUsers, SecuredController)
      )
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        createContext(
          { id: 'admin-1', role: AdminRole.MODERATOR, isActive: false },
          SecuredController.prototype.viewUsers,
          SecuredController
        )
      )
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        createContext(
          {
            id: 'admin-1',
            role: AdminRole.MODERATOR,
            isActive: true,
            deletedAt: new Date('2026-11-10T00:00:00Z'),
          },
          SecuredController.prototype.viewUsers,
          SecuredController
        )
      )
    ).toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN across all protected endpoints', () => {
    class SecuredController {
      @RequirePermissions('Rbac.Manage')
      manageRbac() {}
    }

    expect(
      guard.canActivate(
        createContext(
          { id: 'super-1', role: AdminRole.SUPER_ADMIN, isActive: true },
          SecuredController.prototype.manageRbac,
          SecuredController
        )
      )
    ).toBe(true);
  });

  it('enforces dynamic custom permissions on non-SUPER_ADMIN accounts and blocks missing permissions', () => {
    class GeoController {
      @RequirePermissions('Geo.Manage')
      manageGeo() {}

      @RequirePermissions('Listings.Review')
      reviewListing() {}
    }

    // Moderator granted custom permission ['Geo.Manage'] only
    const customModerator = {
      id: 'mod-custom-1',
      role: AdminRole.MODERATOR,
      isActive: true,
      permissions: ['Geo.Manage'],
    };

    expect(
      guard.canActivate(
        createContext(
          customModerator,
          GeoController.prototype.manageGeo,
          GeoController
        )
      )
    ).toBe(true);

    // Since custom permissions override default role permissions and lack 'Listings.Review', it must be blocked
    try {
      guard.canActivate(
        createContext(
          customModerator,
          GeoController.prototype.reviewListing,
          GeoController
        )
      );
      fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse()).toMatchObject({
        code: AUTH_NOT_AUTHORIZED,
      });
    }
  });

  it('falls back to ADMIN_ROLE_PERMISSIONS when admin.permissions is empty or undefined', () => {
    class ListingsController {
      @RequirePermissions('Listings.Review')
      review() {}
    }

    expect(
      guard.canActivate(
        createContext(
          { id: 'mod-1', role: AdminRole.MODERATOR, isActive: true, permissions: [] },
          ListingsController.prototype.review,
          ListingsController
        )
      )
    ).toBe(true);
  });
});

