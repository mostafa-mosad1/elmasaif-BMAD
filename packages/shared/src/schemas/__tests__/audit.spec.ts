import { describe, it, expect } from 'vitest';
import { auditLogQuerySchema } from '../audit.schema';
import { AUDIT_ACTOR_TYPE } from '../../constants/audit';

describe('auditLogQuerySchema', () => {
  it('should accept empty object and apply defaults', () => {
    const result = auditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.entityType).toBeUndefined();
      expect(result.data.actorType).toBeUndefined();
      expect(result.data.search).toBeUndefined();
    }
  });

  it('should coerce string numbers for page and limit', () => {
    const result = auditLogQuerySchema.safeParse({
      page: '3',
      limit: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('should reject invalid page numbers (< 1)', () => {
    const result = auditLogQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100 or < 1', () => {
    const highLimit = auditLogQuerySchema.safeParse({ limit: '101' });
    expect(highLimit.success).toBe(false);

    const zeroLimit = auditLogQuerySchema.safeParse({ limit: '0' });
    expect(zeroLimit.success).toBe(false);
  });

  it('should validate and parse valid actor types', () => {
    for (const type of [AUDIT_ACTOR_TYPE.ADMIN, AUDIT_ACTOR_TYPE.USER, AUDIT_ACTOR_TYPE.SYSTEM]) {
      const result = auditLogQuerySchema.safeParse({ actorType: type });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actorType).toBe(type);
      }
    }

    const invalid = auditLogQuerySchema.safeParse({ actorType: 'UNKNOWN_ACTOR' });
    expect(invalid.success).toBe(false);
  });

  it('should normalize empty strings to undefined', () => {
    const result = auditLogQuerySchema.safeParse({
      entityType: '   ',
      actorType: '',
      search: '  ',
      startDate: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBeUndefined();
      expect(result.data.actorType).toBeUndefined();
      expect(result.data.search).toBeUndefined();
      expect(result.data.startDate).toBeUndefined();
    }
  });

  it('should validate ISO date formats', () => {
    const valid = auditLogQuerySchema.safeParse({
      startDate: '2026-11-12T10:00:00.000Z',
      endDate: '2026-11-13',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.startDate).toBe('2026-11-12T10:00:00.000Z');
      expect(valid.data.endDate).toBe('2026-11-13');
    }

    const invalid = auditLogQuerySchema.safeParse({
      startDate: 'invalid-not-a-date',
    });
    expect(invalid.success).toBe(false);
  });

  it('should enforce string length limits', () => {
    const longSearch = 'a'.repeat(201);
    const result = auditLogQuerySchema.safeParse({ search: longSearch });
    expect(result.success).toBe(false);

    const validSearch = 'a'.repeat(200);
    const validResult = auditLogQuerySchema.safeParse({ search: validSearch });
    expect(validResult.success).toBe(true);
  });
});

