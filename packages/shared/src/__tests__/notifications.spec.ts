import { describe, it, expect } from 'vitest';
import {
  NotificationChannel,
  NotificationCategory,
  NOTIFICATION_DEAL_CREATED,
  NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
  NOTIFICATION_DEAL_PROOF_REJECTED,
  NOTIFICATION_DEAL_COMPLETED,
  NOTIFICATION_DEAL_TIMEOUT_CANCELLED,
  NOTIFICATION_DEAL_DISPUTED,
  NOTIFICATION_CONTRACT_READY_FOR_SIGNATURE,
  NOTIFICATION_FAL_EXPIRY_WARNING,
  NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED,
  NOTIFICATION_AUTH_SECURITY_ALERT,
  MANDATORY_NOTIFICATION_EVENTS,
  NOTIFICATION_NOT_FOUND,
  notificationQuerySchema,
} from '../index';

describe('Shared Notification Contracts', () => {
  it('should export all NotificationChannel and NotificationCategory enum values', () => {
    expect(NotificationChannel.IN_APP).toBe('IN_APP');
    expect(NotificationChannel.EMAIL).toBe('EMAIL');
    expect(NotificationChannel.SMS).toBe('SMS');

    expect(NotificationCategory.DEAL).toBe('DEAL');
    expect(NotificationCategory.LISTING).toBe('LISTING');
    expect(NotificationCategory.CONTRACT).toBe('CONTRACT');
    expect(NotificationCategory.LICENSING).toBe('LICENSING');
    expect(NotificationCategory.DEMAND).toBe('DEMAND');
    expect(NotificationCategory.SUPPORT).toBe('SUPPORT');
    expect(NotificationCategory.SECURITY).toBe('SECURITY');
    expect(NotificationCategory.SYSTEM).toBe('SYSTEM');
  });

  it('should define mandatory notification events set accurately', () => {
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_CREATED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_PROOF_REJECTED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_COMPLETED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_TIMEOUT_CANCELLED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_DEAL_DISPUTED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_FAL_EXPIRY_WARNING);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_AUTH_SECURITY_ALERT);
    expect(MANDATORY_NOTIFICATION_EVENTS).toContain(NOTIFICATION_CONTRACT_READY_FOR_SIGNATURE);
    expect(NOTIFICATION_NOT_FOUND).toBe('NOTIFICATION_NOT_FOUND');
  });

  describe('notificationQuerySchema', () => {
    it('should parse valid query parameters with defaults', () => {
      const parsed = notificationQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.unreadOnly).toBe(false);
      expect(parsed.category).toBeUndefined();
    });

    it('should coerce string parameters from HTTP query', () => {
      const parsed = notificationQuerySchema.parse({
        page: '2',
        limit: '50',
        unreadOnly: 'true',
        category: 'DEAL',
      });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
      expect(parsed.unreadOnly).toBe(true);
      expect(parsed.category).toBe(NotificationCategory.DEAL);
    });

    it('should reject invalid limits or negative pages', () => {
      expect(() => notificationQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => notificationQuerySchema.parse({ limit: 150 })).toThrow();
      expect(() => notificationQuerySchema.parse({ category: 'UNKNOWN' })).toThrow();
    });
  });
});

