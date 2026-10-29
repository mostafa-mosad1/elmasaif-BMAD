import { describe, it, expect } from 'vitest';
import {
  switchRoleSchema,
  userProfileSummarySchema,
  sessionUserSchema
} from '../auth.schema';
import { UserRole, ProfileStatus } from '../../enums';
import {
  AUTH_ROLE_NOT_AUTHORIZED,
  AUTH_MARKETER_NOT_APPROVED,
  AUTH_PROFILE_NOT_FOUND
} from '../../constants/auth';
import type { WorkspaceNavigationItem } from '../../types/auth';

describe('Shared Roles & Profile Switching Schemas (AC: 1, 8)', () => {
  describe('switchRoleSchema', () => {
    it('accepts valid UserRole values', () => {
      expect(switchRoleSchema.parse({ role: UserRole.BUYER }).role).toBe(UserRole.BUYER);
      expect(switchRoleSchema.parse({ role: UserRole.MARKETER }).role).toBe(UserRole.MARKETER);
      expect(switchRoleSchema.parse({ role: UserRole.OWNER }).role).toBe(UserRole.OWNER);
    });

    it('rejects invalid role strings', () => {
      expect(() => switchRoleSchema.parse({ role: 'INVALID_ROLE' })).toThrow();
      expect(() => switchRoleSchema.parse({ role: '' })).toThrow();
      expect(() => switchRoleSchema.parse({})).toThrow();
    });
  });

  describe('userProfileSummarySchema', () => {
    it('validates a complete user profile summary', () => {
      const profile = userProfileSummarySchema.parse({
        id: 'prof-123',
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        payoutIban: 'SA0380000000608010167519',
        falLicenseNumber: 'FL-998877',
        falStatus: ProfileStatus.ACTIVE,
        createdAt: '2026-10-29T12:00:00Z'
      });
      expect(profile.id).toBe('prof-123');
      expect(profile.role).toBe(UserRole.MARKETER);
      expect(profile.status).toBe(ProfileStatus.ACTIVE);
      expect(profile.payoutIban).toBe('SA0380000000608010167519');
      expect(profile.falLicenseNumber).toBe('FL-998877');
      expect(profile.falStatus).toBe(ProfileStatus.ACTIVE);
    });

    it('validates a minimal profile with optional fields null or undefined', () => {
      const profile = userProfileSummarySchema.parse({
        id: 'prof-456',
        role: UserRole.BUYER,
        status: ProfileStatus.ACTIVE
      });
      expect(profile.id).toBe('prof-456');
      expect(profile.role).toBe(UserRole.BUYER);
      expect(profile.payoutIban).toBeUndefined();
    });
  });

  describe('sessionUserSchema', () => {
    it('validates sessionUserSchema with activeRole and profiles array', () => {
      const user = sessionUserSchema.parse({
        id: 'user-uuid-1',
        fullName: 'أحمد القحطاني',
        mobileNumber: '+966501234567',
        username: 'ahmed_q',
        activeRole: UserRole.OWNER,
        profiles: [
          {
            id: 'prof-1',
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE
          },
          {
            id: 'prof-2',
            role: UserRole.OWNER,
            status: ProfileStatus.ACTIVE
          }
        ]
      });

      expect(user.activeRole).toBe(UserRole.OWNER);
      expect(user.profiles).toHaveLength(2);
      expect(user.profiles[1].role).toBe(UserRole.OWNER);
    });

    it('defaults activeRole to BUYER if missing and backward compatible with role', () => {
      const user = sessionUserSchema.parse({
        id: 'user-uuid-legacy',
        fullName: 'سالم الدوسري',
        mobileNumber: '+966551234567',
        username: 'salem_d',
        role: 'BUYER'
      });

      expect(user.activeRole).toBe(UserRole.BUYER);
      expect(Array.isArray(user.profiles)).toBe(true);
    });
  });

  describe('Auth Constants & Error Codes', () => {
    it('exports expected role error codes', () => {
      expect(AUTH_ROLE_NOT_AUTHORIZED).toBe('AUTH_ROLE_NOT_AUTHORIZED');
      expect(AUTH_MARKETER_NOT_APPROVED).toBe('AUTH_MARKETER_NOT_APPROVED');
      expect(AUTH_PROFILE_NOT_FOUND).toBe('AUTH_PROFILE_NOT_FOUND');
    });

    it('allows typing WorkspaceNavigationItem', () => {
      const navItem: WorkspaceNavigationItem = {
        title: 'لوحة التحكم',
        href: '/app/buyer',
        icon: 'LayoutDashboard',
        badge: undefined
      };
      expect(navItem.href).toBe('/app/buyer');
    });
  });
});
