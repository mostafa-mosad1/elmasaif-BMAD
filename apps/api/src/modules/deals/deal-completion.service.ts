import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DEAL_COMPLETED,
  DEAL_NOT_FOUND,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  INVOICE_GENERATED,
  ListingStatus,
  OwnerContractStatus,
  computeVatBreakdown,
  generateInvoiceNumber,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { BackupOffersService } from '../offers/backup-offers.service';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';

export interface DealCompletionActor {
  id: string;
  fullName: string;
}

/**
 * Story 5.4 / AC-1, AC-2, AR14, FR-68: Atomic Deal Completion & Contact Release.
 *
 * Executes the atomic transaction finalizing a deal once both wire transfers are confirmed:
 * 1. Locks Deal and Listing rows FOR UPDATE (${id}::text).
 * 2. Deal -> COMPLETED with completedAt.
 * 3. Listing -> SOLD.
 * 4. Linked OwnerContract -> COMPLETED.
 * 5. Queued backup offers closed via BackupOffersService.
 * 6. Generates immutable InvoiceRecord with 15% VAT and partyDetails snapshot.
 * 7. Writes DEAL_COMPLETED and INVOICE_GENERATED audit log entries.
 */
@Injectable()
export class DealCompletionService {
  private readonly logger = new Logger(DealCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly backupOffersService: BackupOffersService,
  ) {}

  async completeDeal(
    dealId: string,
    actor: DealCompletionActor | AuthenticatedAdminActor,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      return this.completeDealInTransaction(dealId, actor, tx);
    });
  }

  async completeDealInTransaction(
    dealId: string,
    actor: DealCompletionActor | AuthenticatedAdminActor,
    tx: any,
  ) {
    const now = this.clockService.now();

    // 1. Lock Deal row FOR UPDATE casting ${dealId}::text (trap T-1)
    await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: {
        payments: true,
        listing: true,
        buyerProfile: {
          include: {
            user: true,
          },
        },
        sellerProfile: {
          include: {
            user: true,
            falLicense: true,
          },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException({
        code: DEAL_NOT_FOUND,
        message: 'الصفقة غير موجودة',
      });
    }

    // Idempotency: if deal is already completed, return it cleanly
    if (deal.status === DealStatus.COMPLETED) {
      this.logger.log(`Deal ${dealId} is already COMPLETED. Returning without changes.`);
      return deal;
    }

    // Assert both required payment proofs are confirmed
    const payments = deal.payments || [];
    const hasPlatformCommission = payments.some(
      (p: any) =>
        p.paymentType === 'PLATFORM_COMMISSION' &&
        p.status === DEAL_PAYMENT_STATUS.CONFIRMED,
    );
    const hasSellerPurchasePrice = payments.some(
      (p: any) =>
        p.paymentType === 'SELLER_PURCHASE_PRICE' &&
        p.status === DEAL_PAYMENT_STATUS.CONFIRMED,
    );

    if (!hasPlatformCommission || !hasSellerPurchasePrice) {
      throw new ConflictException({
        code: 'DEAL_PAYMENTS_NOT_CONFIRMED',
        message: 'لا يمكن إكمال الصفقة قبل تأكيد جميع الدفعات البنكية المطلوبة',
      });
    }

    // 2. Lock Listing row FOR UPDATE casting ${listingId}::text (trap T-1)
    await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${deal.listingId}::text FOR UPDATE`;

    // 3. Update Deal: status = COMPLETED, completedAt = now, version++
    const completedDeal = await tx.deal.update({
      where: { id: dealId },
      data: {
        status: DealStatus.COMPLETED,
        completedAt: now,
        version: { increment: 1 },
      },
    });

    // 4. Update Listing: status = SOLD, version++
    await tx.listing.update({
      where: { id: deal.listingId },
      data: {
        status: ListingStatus.SOLD,
        version: { increment: 1 },
      },
    });

    // 5. Update linked OwnerContract (if exists on listingId): status = COMPLETED
    await tx.ownerContract.updateMany({
      where: { listingId: deal.listingId },
      data: {
        status: OwnerContractStatus.COMPLETED,
        updatedAt: now,
      },
    });

    // 6. Close remaining backup offers on listing
    await this.backupOffersService.closeRemainingBackupOffersForListing(
      deal.listingId,
      {
        reason: 'PRIMARY_DEAL_COMPLETED',
        actorAdminId: actor.id,
        closedAt: now,
      },
      tx,
    );

    // 7. Generate & insert immutable InvoiceRecord (if not already existing)
    const existingInvoice = await tx.invoiceRecord.findFirst({
      where: { dealId: deal.id },
    });

    let invoiceNumber: string;
    if (!existingInvoice) {
      const vat = computeVatBreakdown(String(deal.platformCommission), 0.15);
      invoiceNumber = generateInvoiceNumber(deal.dealNumber, now);

      const partyDetails = {
        buyer: {
          profileId: deal.buyerProfile.id,
          userId: deal.buyerProfile.userId,
          fullName: deal.buyerProfile.user?.fullName ?? '',
          nationalId: deal.buyerProfile.user?.nationalId ?? null,
          mobileNumber: deal.buyerProfile.user?.mobileNumber ?? '',
          email: deal.buyerProfile.user?.email ?? null,
        },
        seller: {
          profileId: deal.sellerProfile.id,
          userId: deal.sellerProfile.userId,
          fullName: deal.sellerProfile.user?.fullName ?? '',
          nationalId: deal.sellerProfile.user?.nationalId ?? null,
          crNumber: deal.sellerProfile.falLicense?.crNumber ?? null,
          commercialName: deal.sellerProfile.falLicense?.commercialName ?? null,
          mobileNumber: deal.sellerProfile.user?.mobileNumber ?? '',
          email: deal.sellerProfile.user?.email ?? null,
        },
        deal: {
          dealNumber: deal.dealNumber,
          dealPrice: String(deal.dealPrice),
          commissionRateSnapshot: String(deal.commissionRateSnapshot),
          platformCommission: String(deal.platformCommission),
          totalAmount: String(deal.totalAmount),
        },
      };

      await tx.invoiceRecord.create({
        data: {
          invoiceNumber,
          dealId: deal.id,
          sellerId: deal.sellerProfileId,
          buyerId: deal.buyerProfileId,
          subtotalAmount: vat.subtotalAmount,
          vatAmount: vat.vatAmount,
          vatRate: 0.15,
          totalAmount: vat.totalAmount,
          vatTreatment: vat.vatTreatment,
          partyDetails,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorType: 'ADMIN',
          action: INVOICE_GENERATED,
          entityType: 'InvoiceRecord',
          entityId: invoiceNumber,
          payload: {
            dealId: deal.id,
            invoiceNumber,
            totalAmount: vat.totalAmount,
            vatAmount: vat.vatAmount,
            subtotalAmount: vat.subtotalAmount,
            createdAt: now.toISOString(),
          },
        },
      });
    } else {
      invoiceNumber = existingInvoice.invoiceNumber;
    }

    // 8. Write AuditLog for DEAL_COMPLETED
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: 'ADMIN',
        action: DEAL_COMPLETED,
        entityType: 'Deal',
        entityId: deal.id,
        payload: {
          dealId: deal.id,
          dealNumber: deal.dealNumber,
          listingId: deal.listingId,
          dealPrice: String(deal.dealPrice),
          platformCommission: String(deal.platformCommission),
          completedAt: now.toISOString(),
        },
      },
    });

    this.logger.log(`Deal ${dealId} atomically completed by actor ${actor.id}`);
    return completedDeal;
  }
}

