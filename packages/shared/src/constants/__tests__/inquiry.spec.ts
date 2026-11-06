import { describe, it, expect } from 'vitest';
import {
  MAX_INQUIRY_ATTACHMENTS,
  INQUIRY_MESSAGE_MIN_LENGTH,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_SUBJECT_MAX_LENGTH,
  INQUIRY_LOCK_DURATION_MS,
  INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS,
  INQUIRY_QUEUE_STATUSES,
  CLAIMABLE_INQUIRY_STATUSES,
  BUYER_FOLLOW_UP_STATUSES,
  INQUIRY_STATUS_LABELS_AR,
  INQUIRY_STATUS_BADGE_VARIANTS,
  INQUIRY_AUTHOR_LABELS_AR,
  INQUIRY_AWAITING_PARTY_LABELS_AR,
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_LISTING_NOT_FOUND,
  INQUIRY_LISTING_NOT_INQUIRABLE,
  INQUIRY_SELF_SUBMISSION_FORBIDDEN,
  INQUIRY_BUYER_PROFILE_REQUIRED,
  INQUIRY_SELLER_PROFILE_REQUIRED,
  INQUIRY_NOT_FOUND,
  INQUIRY_NOT_PARTY,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_CLOSED,
  INQUIRY_CLOSE_REASON_REQUIRED,
  INQUIRY_ATTACHMENT_LIMIT_EXCEEDED,
  INQUIRY_ATTACHMENT_NOT_FOUND,
  INQUIRY_ATTACHMENT_NOT_OWNED,
  INQUIRY_ATTACHMENT_NOT_CLEAN,
  INQUIRY_LOCK_REQUIRED,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_FORCE_UNLOCK_REASON_REQUIRED,
  InquiryStatus,
  InquiryAuthorRole,
} from '../../index';

describe('Mediated inquiry constants (Story 4.4 / FR-35, FR-51, AD-10)', () => {
  it('exposes the structured error codes consumed by the API and the web', () => {
    expect(INQUIRY_LISTING_NOT_FOUND).toBe('INQUIRY_LISTING_NOT_FOUND');
    expect(INQUIRY_LISTING_NOT_INQUIRABLE).toBe('INQUIRY_LISTING_NOT_INQUIRABLE');
    expect(INQUIRY_SELF_SUBMISSION_FORBIDDEN).toBe('INQUIRY_SELF_SUBMISSION_FORBIDDEN');
    expect(INQUIRY_BUYER_PROFILE_REQUIRED).toBe('INQUIRY_BUYER_PROFILE_REQUIRED');
    expect(INQUIRY_SELLER_PROFILE_REQUIRED).toBe('INQUIRY_SELLER_PROFILE_REQUIRED');
    expect(INQUIRY_NOT_FOUND).toBe('INQUIRY_NOT_FOUND');
    expect(INQUIRY_NOT_PARTY).toBe('INQUIRY_NOT_PARTY');
    expect(INQUIRY_INVALID_STATE_TRANSITION).toBe('INQUIRY_INVALID_STATE_TRANSITION');
    expect(INQUIRY_CLOSED).toBe('INQUIRY_CLOSED');
    expect(INQUIRY_CLOSE_REASON_REQUIRED).toBe('INQUIRY_CLOSE_REASON_REQUIRED');
    expect(INQUIRY_ATTACHMENT_LIMIT_EXCEEDED).toBe('INQUIRY_ATTACHMENT_LIMIT_EXCEEDED');
    expect(INQUIRY_ATTACHMENT_NOT_FOUND).toBe('INQUIRY_ATTACHMENT_NOT_FOUND');
    expect(INQUIRY_ATTACHMENT_NOT_OWNED).toBe('INQUIRY_ATTACHMENT_NOT_OWNED');
    expect(INQUIRY_ATTACHMENT_NOT_CLEAN).toBe('INQUIRY_ATTACHMENT_NOT_CLEAN');
    expect(INQUIRY_LOCK_REQUIRED).toBe('INQUIRY_LOCK_REQUIRED');
    expect(INQUIRY_LOCK_CONFLICT).toBe('INQUIRY_LOCK_CONFLICT');
    expect(INQUIRY_LOCK_EXPIRED).toBe('INQUIRY_LOCK_EXPIRED');
    expect(INQUIRY_FORCE_UNLOCK_REASON_REQUIRED).toBe('INQUIRY_FORCE_UNLOCK_REASON_REQUIRED');
  });

  it('caps attachments at five and bounds the message body at 1–2000 characters', () => {
    expect(MAX_INQUIRY_ATTACHMENTS).toBe(5);
    expect(INQUIRY_MESSAGE_MIN_LENGTH).toBe(1);
    expect(INQUIRY_MESSAGE_MAX_LENGTH).toBe(2000);
    expect(INQUIRY_SUBJECT_MAX_LENGTH).toBe(200);
  });

  it('uses the 15-minute claim lease with a 5-minute heartbeat inside it', () => {
    expect(INQUIRY_LOCK_DURATION_MS).toBe(15 * 60 * 1000);
    expect(INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS).toBeLessThan(INQUIRY_LOCK_DURATION_MS);
  });

  it('keeps queue membership a strict subset of claim legality', () => {
    for (const status of INQUIRY_QUEUE_STATUSES) {
      expect(CLAIMABLE_INQUIRY_STATUSES).toContain(status);
    }
    expect(INQUIRY_QUEUE_STATUSES.length).toBeLessThan(CLAIMABLE_INQUIRY_STATUSES.length);
    expect(CLAIMABLE_INQUIRY_STATUSES).toContain(InquiryStatus.RELAYED_TO_SELLER);
    expect(CLAIMABLE_INQUIRY_STATUSES).toContain(InquiryStatus.RELAYED_TO_BUYER);
  });

  it('never lists a closed or terminal thread in the queue or as claimable', () => {
    expect(INQUIRY_QUEUE_STATUSES).not.toContain(InquiryStatus.CLOSED);
    expect(CLAIMABLE_INQUIRY_STATUSES).not.toContain(InquiryStatus.CLOSED);
    expect(BUYER_FOLLOW_UP_STATUSES).not.toContain(InquiryStatus.CLOSED);
  });

  it('only lets a buyer follow up from the states the relay loop allows', () => {
    expect(BUYER_FOLLOW_UP_STATUSES).toEqual([
      InquiryStatus.PENDING_ADMIN_REVIEW,
      InquiryStatus.RELAYED_TO_BUYER,
    ]);
  });

  it('labels every inquiry status', () => {
    const statuses = Object.values(InquiryStatus);
    expect(Object.keys(INQUIRY_STATUS_LABELS_AR).sort()).toEqual([...statuses].sort());
    for (const status of statuses) {
      expect(INQUIRY_STATUS_LABELS_AR[status].length).toBeGreaterThan(0);
      expect(INQUIRY_STATUS_BADGE_VARIANTS[status]).toBeTruthy();
    }
  });

  it('labels every author role and every awaiting party', () => {
    const roles = Object.values(InquiryAuthorRole);
    expect(Object.keys(INQUIRY_AUTHOR_LABELS_AR).sort()).toEqual([...roles].sort());
    expect(Object.keys(INQUIRY_AWAITING_PARTY_LABELS_AR).sort()).toEqual([
      'ADMIN',
      'BUYER',
      'SELLER',
    ]);
  });

  it('exposes every audit action the inquiry module may emit', () => {
    expect(Object.values(INQUIRY_AUDIT_ACTIONS)).toEqual([
      'INQUIRY_SUBMITTED',
      'INQUIRY_MESSAGE_ADDED',
      'INQUIRY_CONTACT_MASKED',
      'INQUIRY_RELAYED_TO_SELLER',
      'INQUIRY_RELAYED_TO_BUYER',
      'INQUIRY_CLOSED',
      'INQUIRY_MODERATION_CLAIMED',
      'INQUIRY_MODERATION_RELEASED',
      'INQUIRY_MODERATION_FORCE_UNLOCKED',
    ]);
  });
});
