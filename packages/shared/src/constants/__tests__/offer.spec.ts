import { describe, it, expect } from 'vitest';
import {
  ACTIVE_OFFER_STATUSES,
  TERMINAL_OFFER_STATUSES,
  EXPIRABLE_OFFER_STATUSES,
  OFFER_STATUS_LABELS_AR,
  OFFER_AWAITING_PARTY_LABELS_AR,
  OFFER_REJECTION_REASONS,
  OFFER_REJECTION_REASON_LABELS_AR,
  OFFER_HISTORY_ACTIONS,
  OFFER_HISTORY_ACTION_LABELS_AR,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_ACTIVE_EXISTS,
  OFFER_SELF_SUBMISSION_FORBIDDEN,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_NOT_FOUND,
  OFFER_NOT_PARTY,
  OFFER_SELLER_PROFILE_REQUIRED,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_ALREADY_EXPIRED,
  OFFER_MAX_ROUNDS_REACHED,
  OFFER_COUNTER_PRICE_OUT_OF_RANGE,
  OFFER_REJECTION_REASON_REQUIRED,
  OFFER_REJECTION_NOTE_REQUIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_FORCE_UNLOCK_REASON_REQUIRED,
  OFFER_BACKUP_NOT_QUEUED,
  OFFER_BACKUP_ALREADY_ACTIVATED,
  OFFER_BACKUP_PRIMARY_DEAL_ACTIVE,
  OFFER_BACKUP_LISTING_UNAVAILABLE,
  BACKUP_QUEUE_STATES,
  BACKUP_QUEUE_STATE_LABELS_AR,
  BACKUP_QUEUE_STATE_ORDER,
  OFFER_EXPIRY_HOURS,
  OFFER_LOCK_DURATION_MS,
  OFFER_LOCK_HEARTBEAT_INTERVAL_MS,
  MAX_COUNTER_ROUNDS,
  LOW_PRICE_THRESHOLD_PERCENT,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  OfferStatus,
} from '../../index';

describe('Buyer Offer Constants (Story 4.1 / FR-25, BR-11, A-07)', () => {
  it('exposes the structured error codes consumed by the API and the web', () => {
    expect(OFFER_LISTING_NOT_FOUND).toBe('OFFER_LISTING_NOT_FOUND');
    expect(OFFER_LISTING_NOT_OFFERABLE).toBe('OFFER_LISTING_NOT_OFFERABLE');
    expect(OFFER_PRICE_OUT_OF_RANGE).toBe('OFFER_PRICE_OUT_OF_RANGE');
    expect(OFFER_LOW_PRICE_CONFIRMATION_REQUIRED).toBe('OFFER_LOW_PRICE_CONFIRMATION_REQUIRED');
    expect(OFFER_ACTIVE_EXISTS).toBe('OFFER_ACTIVE_EXISTS');
    expect(OFFER_SELF_SUBMISSION_FORBIDDEN).toBe('OFFER_SELF_SUBMISSION_FORBIDDEN');
    expect(OFFER_BUYER_PROFILE_REQUIRED).toBe('OFFER_BUYER_PROFILE_REQUIRED');
    // Declared for Story 4.2's admin/seller endpoints.
    expect(OFFER_NOT_FOUND).toBe('OFFER_NOT_FOUND');
  });

  it('pins the 7-day expiry window (PRD FR-26 OfferExpiryDays)', () => {
    expect(OFFER_EXPIRY_HOURS).toBe(168);
  });

  it('pins the sub-50% low-price threshold (BR-11)', () => {
    expect(LOW_PRICE_THRESHOLD_PERCENT).toBe(0.5);
  });

  it('reuses (does not redefine) the listing price envelope', () => {
    expect(MIN_LISTING_PRICE_SAR).toBe(1);
    expect(MAX_LISTING_PRICE_SAR).toBe(50_000_000);
  });

  it('labels every OfferStatus in Arabic with no gaps', () => {
    const statuses = Object.values(OfferStatus);
    // Story 4.3 added the terminal CLOSED_BACKUP member (9 active + 5 terminal).
    expect(statuses).toHaveLength(14);
    for (const status of statuses) {
      expect(OFFER_STATUS_LABELS_AR[status]).toBeTruthy();
    }
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.PENDING_ADMIN_REVIEW]).toBe('قيد المراجعة الإدارية');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.EXPIRED]).toBe('منتهي الصلاحية');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.WITHDRAWN]).toBe('مسحوب');
    // Story 4.2 mediation members.
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.RELAYED_TO_BUYER]).toBe('معروض على المشتري');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.REJECTED_BY_ADMIN]).toBe('مرفوض إدارياً');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL]).toBe(
      'معتمد — بانتظار الموافقة النهائية',
    );
    // Story 4.3 terminal member.
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.CLOSED_BACKUP]).toBe('مغلق — اكتملت الصفقة الأساسية');
  });

  it('partitions the enum into disjoint active and terminal sets that cover every member', () => {
    const active = new Set(ACTIVE_OFFER_STATUSES);
    const terminal = new Set(TERMINAL_OFFER_STATUSES);

    for (const status of ACTIVE_OFFER_STATUSES) {
      expect(terminal.has(status)).toBe(false);
    }

    const union = new Set([...ACTIVE_OFFER_STATUSES, ...TERMINAL_OFFER_STATUSES]);
    expect(union.size).toBe(Object.values(OfferStatus).length);
    for (const status of Object.values(OfferStatus)) {
      expect(union.has(status)).toBe(true);
    }

    // The intake status must never be treated as terminal, or A-07 stops blocking duplicates.
    expect(active.has(OfferStatus.PENDING_ADMIN_REVIEW)).toBe(true);
    expect(terminal.has(OfferStatus.REJECTED_BY_SELLER)).toBe(true);
    expect(terminal.has(OfferStatus.EXPIRED)).toBe(true);
    expect(terminal.has(OfferStatus.WITHDRAWN)).toBe(true);

    // Story 4.2 members: an agreed offer stays active (listings guard) but admin veto is terminal.
    expect(active.has(OfferStatus.RELAYED_TO_BUYER)).toBe(true);
    expect(active.has(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL)).toBe(true);
    expect(terminal.has(OfferStatus.REJECTED_BY_ADMIN)).toBe(true);

    // Story 4.3: a backup closed by the winning deal is terminal — it must never be offerable again.
    expect(terminal.has(OfferStatus.CLOSED_BACKUP)).toBe(true);
    expect(active.has(OfferStatus.CLOSED_BACKUP)).toBe(false);
    expect(EXPIRABLE_OFFER_STATUSES).not.toContain(OfferStatus.CLOSED_BACKUP);
  });
});

describe('Offer mediation constants (Story 4.2 / FR-26, FR-55, AD-10)', () => {
  it('exposes the mediation error codes consumed by the API and the web', () => {
    expect(OFFER_NOT_PARTY).toBe('OFFER_NOT_PARTY');
    expect(OFFER_SELLER_PROFILE_REQUIRED).toBe('OFFER_SELLER_PROFILE_REQUIRED');
    expect(OFFER_INVALID_STATE_TRANSITION).toBe('OFFER_INVALID_STATE_TRANSITION');
    expect(OFFER_ALREADY_EXPIRED).toBe('OFFER_ALREADY_EXPIRED');
    expect(OFFER_MAX_ROUNDS_REACHED).toBe('OFFER_MAX_ROUNDS_REACHED');
    expect(OFFER_COUNTER_PRICE_OUT_OF_RANGE).toBe('OFFER_COUNTER_PRICE_OUT_OF_RANGE');
    expect(OFFER_REJECTION_REASON_REQUIRED).toBe('OFFER_REJECTION_REASON_REQUIRED');
    expect(OFFER_REJECTION_NOTE_REQUIRED).toBe('OFFER_REJECTION_NOTE_REQUIRED');
    expect(OFFER_LOCK_REQUIRED).toBe('OFFER_LOCK_REQUIRED');
    expect(OFFER_LOCK_CONFLICT).toBe('OFFER_LOCK_CONFLICT');
    expect(OFFER_LOCK_EXPIRED).toBe('OFFER_LOCK_EXPIRED');
    expect(OFFER_FORCE_UNLOCK_REASON_REQUIRED).toBe('OFFER_FORCE_UNLOCK_REASON_REQUIRED');
  });

  it('pins the round cap and the 15-minute / 5-minute claim-lock lease (AD-10)', () => {
    expect(MAX_COUNTER_ROUNDS).toBe(5);
    expect(OFFER_LOCK_DURATION_MS).toBe(15 * 60 * 1000);
    expect(OFFER_LOCK_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('expires every active status except a mutually-agreed offer', () => {
    const expirable = new Set(EXPIRABLE_OFFER_STATUSES);

    expect(expirable.size).toBe(ACTIVE_OFFER_STATUSES.length - 1);
    expect(expirable.has(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL)).toBe(false);
    for (const status of EXPIRABLE_OFFER_STATUSES) {
      expect(ACTIVE_OFFER_STATUSES).toContain(status);
    }

    expect(expirable.has(OfferStatus.PENDING_ADMIN_REVIEW)).toBe(true);
    expect(expirable.has(OfferStatus.RELAYED_TO_SELLER)).toBe(true);
    expect(expirable.has(OfferStatus.RELAYED_TO_BUYER)).toBe(true);
    expect(expirable.has(OfferStatus.COUNTER_OFFERED)).toBe(true);
  });

  it('covers every structured rejection reason with a label', () => {
    expect([...OFFER_REJECTION_REASONS]).toEqual([
      'PRICE_TOO_LOW',
      'FINANCING_UNAVAILABLE',
      'PROPERTY_UNAVAILABLE',
      'TERMS_MISMATCH',
      'OTHER',
    ]);
    for (const reason of OFFER_REJECTION_REASONS) {
      expect(OFFER_REJECTION_REASON_LABELS_AR[reason]).toBeTruthy();
    }
  });

  it('keeps the 4.1 history literal stable and labels every mediation action', () => {
    // 4.1 already persists 'OFFER_SUBMITTED' rows — the constant must not change that value.
    expect(OFFER_HISTORY_ACTIONS.SUBMITTED).toBe('OFFER_SUBMITTED');

    for (const action of Object.values(OFFER_HISTORY_ACTIONS)) {
      expect(action.startsWith('OFFER_')).toBe(true);
      expect(OFFER_HISTORY_ACTION_LABELS_AR[action]).toBeTruthy();
    }

    expect(OFFER_HISTORY_ACTIONS.RELAYED_TO_SELLER).toBe('OFFER_RELAYED_TO_SELLER');
    expect(OFFER_HISTORY_ACTIONS.RELAYED_TO_BUYER).toBe('OFFER_RELAYED_TO_BUYER');
    expect(OFFER_HISTORY_ACTIONS.EXPIRED).toBe('OFFER_EXPIRED');
  });

  it('labels the three awaiting-party chips', () => {
    expect(OFFER_AWAITING_PARTY_LABELS_AR.ADMIN).toBe('بانتظار الإدارة');
    expect(OFFER_AWAITING_PARTY_LABELS_AR.SELLER).toBe('بانتظار البائع');
    expect(OFFER_AWAITING_PARTY_LABELS_AR.BUYER).toBe('بانتظار المشتري');
  });
});

describe('Backup offer queue constants (Story 4.3 / FR-27, OQ-04)', () => {
  it('exposes the activation refusal codes consumed by the API and the web', () => {
    expect(OFFER_BACKUP_NOT_QUEUED).toBe('OFFER_BACKUP_NOT_QUEUED');
    expect(OFFER_BACKUP_ALREADY_ACTIVATED).toBe('OFFER_BACKUP_ALREADY_ACTIVATED');
    expect(OFFER_BACKUP_PRIMARY_DEAL_ACTIVE).toBe('OFFER_BACKUP_PRIMARY_DEAL_ACTIVE');
    expect(OFFER_BACKUP_LISTING_UNAVAILABLE).toBe('OFFER_BACKUP_LISTING_UNAVAILABLE');
  });

  it('labels the new backup history actions', () => {
    expect(OFFER_HISTORY_ACTIONS.BACKUP_ACTIVATED).toBe('OFFER_BACKUP_ACTIVATED');
    expect(OFFER_HISTORY_ACTIONS.BACKUP_CLOSED).toBe('OFFER_BACKUP_CLOSED');
    expect(OFFER_HISTORY_ACTION_LABELS_AR['OFFER_BACKUP_ACTIVATED']).toBe('تفعيل عرض احتياطي');
    expect(OFFER_HISTORY_ACTION_LABELS_AR['OFFER_BACKUP_CLOSED']).toBe(
      'إغلاق عرض احتياطي بعد اكتمال الصفقة الأساسية',
    );
  });

  it('pins the four queue states and their display order', () => {
    expect([...BACKUP_QUEUE_STATES]).toEqual(['SURFACED', 'QUEUED', 'FROZEN', 'CLOSABLE']);

    for (const state of BACKUP_QUEUE_STATES) {
      expect(BACKUP_QUEUE_STATE_LABELS_AR[state]).toBeTruthy();
    }
    expect(BACKUP_QUEUE_STATE_LABELS_AR.SURFACED).toBe('جاهز للتفعيل');
    expect(BACKUP_QUEUE_STATE_LABELS_AR.QUEUED).toBe('في الانتظار');
    expect(BACKUP_QUEUE_STATE_LABELS_AR.FROZEN).toBe('مجمّد — العقار غير متاح');
    expect(BACKUP_QUEUE_STATE_LABELS_AR.CLOSABLE).toBe('جاهز للإغلاق');

    // AC 2: the queue reads SURFACED → QUEUED → FROZEN → CLOSABLE, in that order, always.
    expect(BACKUP_QUEUE_STATE_ORDER.SURFACED).toBe(0);
    expect(BACKUP_QUEUE_STATE_ORDER.QUEUED).toBe(1);
    expect(BACKUP_QUEUE_STATE_ORDER.FROZEN).toBe(2);
    expect(BACKUP_QUEUE_STATE_ORDER.CLOSABLE).toBe(3);
    expect(BACKUP_QUEUE_STATE_ORDER.SURFACED).toBeLessThan(BACKUP_QUEUE_STATE_ORDER.QUEUED);
    expect(BACKUP_QUEUE_STATE_ORDER.QUEUED).toBeLessThan(BACKUP_QUEUE_STATE_ORDER.FROZEN);
    expect(BACKUP_QUEUE_STATE_ORDER.FROZEN).toBeLessThan(BACKUP_QUEUE_STATE_ORDER.CLOSABLE);
  });
});
