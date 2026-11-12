import { describe, expect, it } from 'vitest';
import {
  TASK_CLAIM_LEASE_DURATION_MS,
  TASK_CLAIM_LEASE_DURATION_SECONDS,
  TASK_CLAIM_HEARTBEAT_INTERVAL_MS,
  TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS,
  TASK_FORCE_UNLOCK_MIN_REASON_LENGTH,
  TASK_CLAIM_ACQUIRED,
  TASK_CLAIM_RENEWED,
  TASK_CLAIM_RELEASED,
  TASK_CLAIM_FORCE_UNLOCKED,
  TASK_CLAIM_LOCK_CONFLICT,
  TASK_CLAIM_LOCK_REQUIRED,
  TASK_CLAIM_LOCK_EXPIRED,
  TASK_CLAIM_NOT_CLAIMABLE,
  TASK_CLAIM_ENTITY_NOT_FOUND,
  TASK_FORCE_UNLOCK_REASON_REQUIRED,
  OPTIMISTIC_VERSION_CONFLICT,
  OPERATIONAL_QUEUES_SUMMARY_RETRIEVED,
  OPERATIONAL_QUEUE_TYPES,
  OPERATIONAL_QUEUE_SLUGS,
  OPERATIONAL_QUEUE_METADATA,
  resolveOperationalQueueType,
  forceUnlockTaskSchema,
  operationalQueueFilterSchema,
  ifMatchVersionSchema,
  parseIfMatchVersion,
} from '../index';

describe('Story 8.3: Shared Queue Lock Constants, Types & Schemas', () => {
  describe('Canonical Lock Lease Constants & Error Codes', () => {
    it('exports 15-minute claim lease and 5-minute heartbeat constants (AD-10, FR-51)', () => {
      expect(TASK_CLAIM_LEASE_DURATION_MS).toBe(15 * 60 * 1000);
      expect(TASK_CLAIM_LEASE_DURATION_SECONDS).toBe(900);
      expect(TASK_CLAIM_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
      expect(TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS).toBe(300);
      expect(TASK_FORCE_UNLOCK_MIN_REASON_LENGTH).toBe(5);
    });

    it('exports standardized domain & status codes', () => {
      expect(TASK_CLAIM_ACQUIRED).toBe('TASK_CLAIM_ACQUIRED');
      expect(TASK_CLAIM_RENEWED).toBe('TASK_CLAIM_RENEWED');
      expect(TASK_CLAIM_RELEASED).toBe('TASK_CLAIM_RELEASED');
      expect(TASK_CLAIM_FORCE_UNLOCKED).toBe('TASK_CLAIM_FORCE_UNLOCKED');
      expect(TASK_CLAIM_LOCK_CONFLICT).toBe('TASK_CLAIM_LOCK_CONFLICT');
      expect(TASK_CLAIM_LOCK_REQUIRED).toBe('TASK_CLAIM_LOCK_REQUIRED');
      expect(TASK_CLAIM_LOCK_EXPIRED).toBe('TASK_CLAIM_LOCK_EXPIRED');
      expect(TASK_CLAIM_NOT_CLAIMABLE).toBe('TASK_CLAIM_NOT_CLAIMABLE');
      expect(TASK_CLAIM_ENTITY_NOT_FOUND).toBe('TASK_CLAIM_ENTITY_NOT_FOUND');
      expect(TASK_FORCE_UNLOCK_REASON_REQUIRED).toBe('TASK_FORCE_UNLOCK_REASON_REQUIRED');
      expect(OPTIMISTIC_VERSION_CONFLICT).toBe('OPTIMISTIC_VERSION_CONFLICT');
      expect(OPERATIONAL_QUEUES_SUMMARY_RETRIEVED).toBe('OPERATIONAL_QUEUES_SUMMARY_RETRIEVED');
    });
  });

  describe('Operational Queue Registry & Metadata (8 Canonical Queues)', () => {
    it('registers all 8 canonical operational queues with Arabic labels and route metadata', () => {
      expect(OPERATIONAL_QUEUE_TYPES).toEqual([
        'LISTING',
        'FAL_PROFILE',
        'OWNER_REQUEST',
        'PAYMENT',
        'CONTRACT_FEE',
        'CONVERSATION',
        'DISPUTE',
        'OFFER',
      ]);

      for (const queueType of OPERATIONAL_QUEUE_TYPES) {
        const meta = OPERATIONAL_QUEUE_METADATA[queueType];
        expect(meta).toBeDefined();
        expect(meta.queueType).toBe(queueType);
        expect(meta.labelAr.length).toBeGreaterThan(2);
        expect(meta.primarySlug.length).toBeGreaterThan(2);
        expect(meta.adminWorkspaceHref).toMatch(/^\/admin\//);
      }
    });

    it('resolves all canonical queue types and URL slug aliases', () => {
      expect(OPERATIONAL_QUEUE_SLUGS).toEqual(
        expect.arrayContaining([
          'listings',
          'licenses',
          'fal-profiles',
          'owner-requests',
          'payments',
          'contract-fees',
          'conversations',
          'inquiries',
          'disputes',
          'offers',
        ]),
      );

      expect(resolveOperationalQueueType('LISTING')).toBe('LISTING');
      expect(resolveOperationalQueueType('listings')).toBe('LISTING');
      expect(resolveOperationalQueueType('FAL_PROFILE')).toBe('FAL_PROFILE');
      expect(resolveOperationalQueueType('licenses')).toBe('FAL_PROFILE');
      expect(resolveOperationalQueueType('fal-profiles')).toBe('FAL_PROFILE');
      expect(resolveOperationalQueueType('owner-requests')).toBe('OWNER_REQUEST');
      expect(resolveOperationalQueueType('payments')).toBe('PAYMENT');
      expect(resolveOperationalQueueType('contract-fees')).toBe('CONTRACT_FEE');
      expect(resolveOperationalQueueType('conversations')).toBe('CONVERSATION');
      expect(resolveOperationalQueueType('inquiries')).toBe('CONVERSATION');
      expect(resolveOperationalQueueType('disputes')).toBe('DISPUTE');
      expect(resolveOperationalQueueType('offers')).toBe('OFFER');
      expect(resolveOperationalQueueType('unknown-queue')).toBeNull();
    });
  });

  describe('forceUnlockTaskSchema', () => {
    it('accepts valid trimmed reason >= 5 characters', () => {
      const parsed = forceUnlockTaskSchema.parse({
        reason: '   انقطاع اتصال المشرف المناوب لأكثر من عشر دقائق   ',
      });
      expect(parsed.reason).toBe('انقطاع اتصال المشرف المناوب لأكثر من عشر دقائق');
    });

    it('rejects empty or short reasons (< 5 chars)', () => {
      expect(forceUnlockTaskSchema.safeParse({ reason: '' }).success).toBe(false);
      expect(forceUnlockTaskSchema.safeParse({ reason: '   ab  ' }).success).toBe(false);
    });
  });

  describe('operationalQueueFilterSchema', () => {
    it('applies defaults for lockState, page, and limit', () => {
      const parsed = operationalQueueFilterSchema.parse({});
      expect(parsed).toEqual({
        lockState: 'ALL',
        page: 1,
        limit: 20,
      });
    });

    it('validates queueType and lockState filters', () => {
      const parsed = operationalQueueFilterSchema.parse({
        queueType: 'LISTING',
        lockState: 'MY_CLAIMS',
        page: '2',
        limit: '50',
      });
      expect(parsed).toEqual({
        queueType: 'LISTING',
        lockState: 'MY_CLAIMS',
        page: 2,
        limit: 50,
      });
    });
  });

  describe('ifMatchVersionSchema & parseIfMatchVersion', () => {
    it('parses standard ETag / If-Match headers ("3", W/"3", 3)', () => {
      expect(parseIfMatchVersion('"3"')).toBe(3);
      expect(parseIfMatchVersion('W/"7"')).toBe(7);
      expect(parseIfMatchVersion('12')).toBe(12);
      expect(parseIfMatchVersion(4)).toBe(4);
      expect(ifMatchVersionSchema.parse('"5"')).toBe(5);
      expect(ifMatchVersionSchema.parse('W/"9"')).toBe(9);
    });

    it('falls back to bodyVersion when header is absent and returns undefined for invalid values', () => {
      expect(parseIfMatchVersion(undefined, 2)).toBe(2);
      expect(parseIfMatchVersion(['"8"'], 2)).toBe(8);
      expect(parseIfMatchVersion(undefined, undefined)).toBeUndefined();
      expect(parseIfMatchVersion('invalid-etag')).toBeUndefined();
      expect(parseIfMatchVersion('0')).toBeUndefined();
      expect(parseIfMatchVersion('-3')).toBeUndefined();
    });
  });
});

