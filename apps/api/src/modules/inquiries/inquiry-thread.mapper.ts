import {
  InquiryAttachmentItem,
  InquiryAuthorRole,
  InquiryAwaitingParty,
  InquiryMessageItem,
  InquiryStatus,
  InquiryThreadItem,
  InquiryThreadSummary,
} from '@elmasaif/shared';
import { parseMaskedTypes } from './inquiry-masking';

/**
 * The single read projection for the mediated inquiry thread (Story 4.4 / AC-4).
 *
 * Buyer/seller endpoints and the admin conversation queue both map through here, so the two
 * surfaces can never disagree about what a thread looks like — and, more importantly, the
 * visibility matrix has exactly one implementation. Display names only: no mobile number, email
 * or IBAN is ever selected, so a payload cannot leak a contact channel by accident.
 */
export const INQUIRY_SUMMARY_INCLUDE = {
  listing: {
    include: {
      city: true,
      district: true,
    },
  },
  buyerProfile: { include: { user: { select: { fullName: true } } } },
  sellerProfile: { include: { user: { select: { fullName: true } } } },
  _count: { select: { messages: true } },
} as const;

export const INQUIRY_THREAD_INCLUDE = {
  ...INQUIRY_SUMMARY_INCLUDE,
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { attachments: { orderBy: { createdAt: 'asc' } } },
  },
} as const;

/** Which side of the conversation is reading. Admins see everything. */
export type InquiryViewerRole = 'BUYER' | 'SELLER' | 'ADMIN';

export function toIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Who the thread is waiting on — the same derivation the offer mediation screens use (D5). */
export function resolveInquiryAwaitingParty(
  status: InquiryStatus,
): InquiryAwaitingParty | null {
  switch (status) {
    case InquiryStatus.PENDING_ADMIN_REVIEW:
    case InquiryStatus.SELLER_RESPONDED:
      return 'ADMIN';
    case InquiryStatus.RELAYED_TO_SELLER:
      return 'SELLER';
    case InquiryStatus.RELAYED_TO_BUYER:
      return 'BUYER';
    default:
      return null;
  }
}

/**
 * AC-4, the anti-circumvention matrix in one predicate:
 *
 * - BUYER sees their own messages, every admin message, and seller messages **only once relayed**.
 * - SELLER sees their own messages, every admin message, and buyer messages **only once relayed**.
 * - ADMIN sees everything.
 *
 * A message that fails this predicate never reaches the mapper's output, so "strictly blocked"
 * is a property of the projection rather than of the caller remembering to filter.
 */
// `authorRole` is a plain `string` on purpose: Prisma's generated `$Enums.InquiryAuthorRole` is a
// string union, not the shared enum, so an enum-typed parameter would reject a database row.
export function isMessageVisibleTo(
  message: { authorRole: string; relayedAt?: Date | string | null },
  viewerRole: InquiryViewerRole,
): boolean {
  if (viewerRole === 'ADMIN') return true;
  if (message.authorRole === InquiryAuthorRole.ADMIN) return true;
  if (message.authorRole === viewerRole) return true;
  return Boolean(message.relayedAt);
}

export function toInquiryAttachmentItem(attachment: any): InquiryAttachmentItem {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: Number(attachment.fileSize ?? 0),
    createdAt: toIso(attachment.createdAt) as string,
    // Never a raw object key: verification happens per download request (AC-2, NFR2).
    downloadUrl: null,
  };
}

export function toInquiryMessageItem(
  message: any,
  viewerRole: InquiryViewerRole,
  names?: { buyerName: string | null; sellerName: string | null },
): InquiryMessageItem {
  return {
    id: message.id,
    authorRole: message.authorRole,
    authorName: resolveAuthorName(message, viewerRole, names),
    body: message.body,
    maskingApplied: Boolean(message.maskingApplied),
    maskedTypes: parseMaskedTypes(message.maskedTypes),
    relayedAt: toIso(message.relayedAt),
    createdAt: toIso(message.createdAt) as string,
    attachments: (message.attachments ?? []).map(toInquiryAttachmentItem),
  };
}

export function toInquiryThreadSummary(inquiry: any): InquiryThreadSummary {
  const listing = inquiry?.listing;

  return {
    id: inquiry.id,
    status: inquiry.status,
    subject: inquiry.subject ?? null,
    awaitingParty: resolveInquiryAwaitingParty(inquiry.status),
    buyerName: inquiry?.buyerProfile?.user?.fullName ?? null,
    sellerName: inquiry?.sellerProfile?.user?.fullName ?? null,
    lastMessageAt: toIso(inquiry.lastMessageAt) as string,
    createdAt: toIso(inquiry.createdAt) as string,
    updatedAt: toIso(inquiry.updatedAt) as string,
    messageCount: Number(inquiry?._count?.messages ?? inquiry?.messages?.length ?? 0),
    closedAt: toIso(inquiry.closedAt),
    closeReason: inquiry.closeReason ?? null,
    listing: {
      id: listing?.id ?? inquiry.listingId,
      title: listing?.title ?? '',
      propertyType: listing?.propertyType,
      cityName: listing?.city?.nameAr ?? null,
      districtName: listing?.district?.nameAr ?? null,
      askPrice: listing ? Number(listing.askPrice) : 0,
      areaSquareMeters: listing ? Number(listing.areaSquareMeters) : 0,
      status: listing?.status,
    },
  };
}

/** Full thread: the summary plus every message the viewer is allowed to see. */
export function toInquiryThreadItem(
  inquiry: any,
  viewerRole: InquiryViewerRole,
  lockInfo?: InquiryThreadSummary['lockInfo'],
): InquiryThreadItem {
  const summary = toInquiryThreadSummary(inquiry);
  const names = { buyerName: summary.buyerName, sellerName: summary.sellerName };

  return {
    ...summary,
    ...(lockInfo ? { lockInfo } : {}),
    messages: (inquiry.messages ?? [])
      .filter((message: any) => isMessageVisibleTo(message, viewerRole))
      .map((message: any) => toInquiryMessageItem(message, viewerRole, names)),
  };
}

/**
 * Authors are named from the thread's already-selected profile relations — the mapper never
 * receives a `User` row, so a mobile number cannot travel with the name.
 */
function resolveAuthorName(
  message: any,
  viewerRole: InquiryViewerRole,
  names?: { buyerName: string | null; sellerName: string | null },
): string | null {
  switch (message.authorRole) {
    case InquiryAuthorRole.BUYER:
      return names?.buyerName ?? message?.inquiry?.buyerProfile?.user?.fullName ?? null;
    case InquiryAuthorRole.SELLER:
      return names?.sellerName ?? message?.inquiry?.sellerProfile?.user?.fullName ?? null;
    case InquiryAuthorRole.ADMIN:
      return viewerRole === 'ADMIN' ? 'الإدارة' : 'فريق الوساطة';
    default:
      return null;
  }
}
