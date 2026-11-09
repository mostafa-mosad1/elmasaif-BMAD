import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CancelDealByBuyerInput,
  DEAL_CANCEL_INVALID_STATE,
  DEAL_CANCEL_NOT_PARTY,
  DEAL_CANCEL_PROOF_EXISTS,
  DEAL_CANCEL_REASON_BUYER,
  DEAL_CANCEL_REASON_SELLER,
  DEAL_CANCELLED_BY_BUYER,
  DEAL_CANCELLED_BY_SELLER,
  DEAL_NOT_FOUND,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  ListingStatus,
  RejectSellerCancelInput,
  SELLER_CANCEL_REQUEST_NOT_FOUND,
  SELLER_CANCEL_REQUEST_PENDING,
  SELLER_CANCELLATION_REJECTED,
  SELLER_CANCELLATION_REQUESTED,
  SellerCancelRequestInput,
  UserRole,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';

/**
 * Story 5.6 / AC-1, AC-2, AC-3: Deals Cancellation Service.
 *
 * Implements atomic, anti-deadlock row locking and transactional handling for:
 * 1. Pre-payment buyer deal cancellation.
 * 2. Pre-payment seller cancellation requests.
 * 3. Administrative approval or rejection of seller cancellation requests.
 *
 * Canonical anti-deadlock lock hierarchy:
 * 1. Deal: SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE
 * 2. Listing: SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE
 * 3. Payments: SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE
 */
@Injectable()
export class DealsCancellationService {
  private readonly logger = new Logger(DealsCancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Pre-Payment Buyer Cancellation (AC-1, FR-34, BR-07).
   */
  async cancelByBuyer(
    userId: string,
    activeRole: UserRole,
    dealId: string,
    input?: CancelDealByBuyerInput,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          payments: true,
          listing: true,
        },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      // Validate caller is buyer
      const callerProfile = await tx.userProfile.findFirst({
        where: { userId, role: activeRole },
      });

      if (!callerProfile || deal.buyerProfileId !== callerProfile.id) {
        throw new ForbiddenException({
          code: DEAL_CANCEL_NOT_PARTY,
          message: 'يحق لمشتري الصفقة فقط إلغاء الصفقة',
        });
      }

      // Validate deal status is AWAITING_PAYMENT_PROOF
      if (deal.status !== DealStatus.AWAITING_PAYMENT_PROOF) {
        throw new ConflictException({
          code: DEAL_CANCEL_INVALID_STATE,
          message: 'لا يمكن إلغاء الصفقة إلا في مرحلة انتظار إثبات الدفع',
        });
      }

      // Validate that NO payment proof has been uploaded
      const hasProof = deal.payments.some(
        (p: any) => p.status !== DEAL_PAYMENT_STATUS.PENDING,
      );
      if (hasProof) {
        throw new ConflictException({
          code: DEAL_CANCEL_PROOF_EXISTS,
          message: 'لا يمكن إلغاء الصفقة بعد رفع إثبات الدفع؛ يمكنك تقديم نزاع بدلاً من ذلك',
        });
      }

      // 2. Lock Listing row FOR UPDATE
      if (deal.listingId) {
        await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${deal.listingId}::text FOR UPDATE`;
      }

      // 3. Lock Payments rows FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`;

      // Update Deal
      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.CANCELLED,
          cancellationReason: DEAL_CANCEL_REASON_BUYER,
          version: { increment: 1 },
        },
      });

      // Revert Listing to ACTIVE
      if (deal.listingId) {
        await tx.listing.update({
          where: { id: deal.listingId },
          data: {
            status: ListingStatus.ACTIVE,
            version: { increment: 1 },
          },
        });
      }

      // Update all deal payments to EXPIRED
      await tx.payment.updateMany({
        where: { dealId: deal.id },
        data: {
          status: DEAL_PAYMENT_STATUS.EXPIRED,
        },
      });

      // Insert AuditLog
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: DEAL_CANCELLED_BY_BUYER,
          entityType: 'Deal',
          entityId: deal.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            listingId: deal.listingId,
            reason: input?.reason?.trim() || null,
            cancelledAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Deal ${deal.dealNumber} cancelled by buyer ${userId}`);

      return {
        dealId: updatedDeal.id,
        status: updatedDeal.status,
      };
    });
  }

  /**
   * Pre-Payment Seller Cancellation Request (AC-2, UC-46).
   */
  async requestSellerCancellation(
    userId: string,
    activeRole: UserRole,
    dealId: string,
    input: SellerCancelRequestInput,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          payments: true,
        },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      // Validate caller is seller
      const callerProfile = await tx.userProfile.findFirst({
        where: { userId, role: activeRole },
      });

      if (!callerProfile || deal.sellerProfileId !== callerProfile.id) {
        throw new ForbiddenException({
          code: DEAL_CANCEL_NOT_PARTY,
          message: 'يحق لبائع الصفقة فقط تقديم طلب إلغاء',
        });
      }

      // Validate deal status
      if (deal.status !== DealStatus.AWAITING_PAYMENT_PROOF) {
        throw new ConflictException({
          code: DEAL_CANCEL_INVALID_STATE,
          message: 'لا يمكن تقديم طلب إلغاء إلا في مرحلة انتظار إثبات الدفع',
        });
      }

      // Validate no proofs uploaded
      const hasProof = deal.payments.some(
        (p: any) => p.status !== DEAL_PAYMENT_STATUS.PENDING,
      );
      if (hasProof) {
        throw new ConflictException({
          code: DEAL_CANCEL_PROOF_EXISTS,
          message: 'لا يمكن طلب الإلغاء بعد رفع إثبات الدفع؛ يمكنك تقديم نزاع بدلاً من ذلك',
        });
      }

      // Validate no pending cancellation request
      if (deal.sellerCancellationRequestedAt) {
        throw new ConflictException({
          code: SELLER_CANCEL_REQUEST_PENDING,
          message: 'يوجد طلب إلغاء قيد المراجعة الإدارية بالفعل',
        });
      }

      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          sellerCancellationRequestedAt: now,
          sellerCancellationReason: input.reason.trim(),
          version: { increment: 1 },
        },
      });

      // Insert AuditLog
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: SELLER_CANCELLATION_REQUESTED,
          entityType: 'Deal',
          entityId: deal.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            reason: input.reason.trim(),
            requestedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Seller cancellation requested for deal ${deal.dealNumber} by user ${userId}`);

      return {
        dealId: updatedDeal.id,
        sellerCancellationRequestedAt: updatedDeal.sellerCancellationRequestedAt,
        sellerCancellationReason: updatedDeal.sellerCancellationReason,
      };
    });
  }

  /**
   * Administrative Approval of Seller Cancellation Request (AC-3 Outcome A).
   */
  async approveSellerCancellation(adminId: string, dealId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          payments: true,
          listing: true,
        },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      if (!deal.sellerCancellationRequestedAt) {
        throw new ConflictException({
          code: SELLER_CANCEL_REQUEST_NOT_FOUND,
          message: 'لا يوجد طلب إلغاء مقدم من البائع لهذه الصفقة',
        });
      }

      if (deal.status !== DealStatus.AWAITING_PAYMENT_PROOF) {
        throw new ConflictException({
          code: DEAL_CANCEL_INVALID_STATE,
          message: 'لا يمكن إلغاء الصفقة في حالتها الحالية',
        });
      }

      // 2. Lock Listing row FOR UPDATE
      if (deal.listingId) {
        await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${deal.listingId}::text FOR UPDATE`;
      }

      // 3. Lock Payments rows FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`;

      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.CANCELLED,
          cancellationReason: DEAL_CANCEL_REASON_SELLER,
          version: { increment: 1 },
        },
      });

      if (deal.listingId) {
        await tx.listing.update({
          where: { id: deal.listingId },
          data: {
            status: ListingStatus.ACTIVE,
            version: { increment: 1 },
          },
        });
      }

      await tx.payment.updateMany({
        where: { dealId: deal.id },
        data: {
          status: DEAL_PAYMENT_STATUS.EXPIRED,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: DEAL_CANCELLED_BY_SELLER,
          entityType: 'Deal',
          entityId: deal.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            listingId: deal.listingId,
            approvedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Admin ${adminId} approved seller cancellation for deal ${deal.dealNumber}`);

      return {
        dealId: updatedDeal.id,
        status: updatedDeal.status,
      };
    });
  }

  /**
   * Administrative Rejection of Seller Cancellation Request (AC-3 Outcome B).
   */
  async rejectSellerCancellation(
    adminId: string,
    dealId: string,
    input: RejectSellerCancelInput,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      if (!deal.sellerCancellationRequestedAt) {
        throw new ConflictException({
          code: SELLER_CANCEL_REQUEST_NOT_FOUND,
          message: 'لا يوجد طلب إلغاء مقدم من البائع لهذه الصفقة',
        });
      }

      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          sellerCancellationRequestedAt: null,
          sellerCancellationReason: null,
          version: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: SELLER_CANCELLATION_REJECTED,
          entityType: 'Deal',
          entityId: deal.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            note: input.note.trim(),
            rejectedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Admin ${adminId} rejected seller cancellation for deal ${deal.dealNumber}`);

      return {
        dealId: updatedDeal.id,
        status: updatedDeal.status,
      };
    });
  }
}

