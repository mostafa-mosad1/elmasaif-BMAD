import type { InquiryAuthorRole, InquiryStatus } from '../enums';
import type { ContactMaskType } from '../masking/contact-mask';
import type { ClaimLockInfo } from './locks';
import type { OfferListingSummary } from './offer';

/**
 * Story 4.4 / AC-3: the claim lease for the conversation queue is the very same projection the
 * offer queues use — aliased here so inquiry code reads naturally without a second shape.
 */
export type InquiryLockInfo = ClaimLockInfo;

/** Who the thread is currently waiting on, derived from `InquiryStatus` in one place (the mapper). */
export type InquiryAwaitingParty = 'ADMIN' | 'SELLER' | 'BUYER';

/**
 * One downloadable file attached to an inquiry message (Story 4.4 / AC-2).
 *
 * `downloadUrl` is a short-lived presigned URL produced by `StorageService.getVerifiedDownloadUrl`
 * — never a raw object key, and `null` whenever the object is not `CLEAN` (fail-closed).
 */
export interface InquiryAttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  downloadUrl: string | null;
}

/**
 * One entry of a mediated thread, already filtered for the requesting viewer (AC-4).
 *
 * `maskedTypes` carries detection *types* only — the original contact values never leave the
 * masking engine, so they can never appear in a payload (AC-1).
 */
export interface InquiryMessageItem {
  id: string;
  authorRole: InquiryAuthorRole;
  authorName: string | null;
  body: string;
  maskingApplied: boolean;
  maskedTypes: ContactMaskType[];
  relayedAt: string | null;
  createdAt: string;
  attachments: InquiryAttachmentItem[];
}

/**
 * Thread summary shared by the buyer list, the seller inbox and the admin queue (Story 4.4 /
 * AC-3, AC-4). The listing projection is inherited from `OfferListingSummary` — deliberately not
 * re-declared. Display names only: no mobile number, email or IBAN is ever part of this shape.
 */
export interface InquiryThreadSummary {
  id: string;
  status: InquiryStatus;
  subject: string | null;
  awaitingParty: InquiryAwaitingParty | null;
  buyerName: string | null;
  sellerName: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  closedAt: string | null;
  closeReason: string | null;
  listing: OfferListingSummary;
  lockInfo?: InquiryLockInfo;
}

/** The full mediated thread returned by `GET /inquiries/:id` and every admin mutation. */
export interface InquiryThreadItem extends InquiryThreadSummary {
  messages: InquiryMessageItem[];
}

/** Body of `POST /inquiries/attachments` — a draft attachment, linked to a message later. */
export interface InquiryAttachmentDraft {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}
