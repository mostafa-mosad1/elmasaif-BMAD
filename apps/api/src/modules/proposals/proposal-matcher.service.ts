import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  DemandStatus,
  ListingStatus,
  MATCH_AREA_TOLERANCE_PERCENT,
} from '@elmasaif/shared';

/**
 * Automated demand-matching engine (Story 3.7 / FR-22, UJ-4, AD-9).
 *
 * Runs SYNCHRONOUSLY, API-side, at the end of `DemandsService.createDemand` — NOT as a
 * worker job (AD-7 has no matching job and `apps/worker` is Prisma-free, so a job would be
 * a production no-op). It evaluates ACTIVE (non-RESERVED) listings whose propertyType +
 * cityId equal the demand's, `askPrice <= maxBudget`, and area within ±20% of the demand's
 * min/max range, persists one immutable `DemandMatch` row per qualifying listing (provider =
 * the listing's seller), and flips the demand ACTIVE → MATCHED when at least one match exists.
 *
 * Idempotent by construction: the `(demandId, listingId)` unique constraint means a re-run
 * (or a re-triggered publish) simply skips already-matched rows. There is NO Top-N truncation.
 */
@Injectable()
export class ProposalMatcherService {
  private readonly logger = new Logger(ProposalMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  async matchDemand(demandId: string): Promise<{ matchCount: number }> {
    const demand = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!demand) {
      return { matchCount: 0 };
    }

    // Only a freshly-published ACTIVE demand is matched; anything else is left untouched.
    if (demand.status !== DemandStatus.ACTIVE) {
      return { matchCount: 0 };
    }

    const tol = MATCH_AREA_TOLERANCE_PERCENT;
    const listings = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        propertyType: demand.propertyType,
        cityId: demand.cityId,
        askPrice: { lte: demand.maxBudget },
        areaSquareMeters: {
          gte: Number(demand.minArea) * (1 - tol),
          lte: Number(demand.maxArea) * (1 + tol),
        },
      },
      select: { id: true, sellerProfileId: true },
    });

    let matchCount = 0;
    for (const listing of listings) {
      try {
        await this.prisma.demandMatch.create({
          data: {
            demandId,
            listingId: listing.id,
            providerProfileId: listing.sellerProfileId,
          },
        });
        matchCount++;
      } catch (err: any) {
        // Unique (demandId, listingId) — already alerted on a prior run; skip, stay idempotent.
        if (err?.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }

    if (matchCount > 0) {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.demand.update({
          where: { id: demandId },
          data: { status: DemandStatus.MATCHED },
        });
        await tx.auditLog.create({
          data: {
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
            action: 'DEMAND_MATCHED',
            entityType: 'Demand',
            entityId: demandId,
            payload: {
              matchCount,
              matchedAt: this.clockService.now().toISOString(),
            },
          },
        });
      });

      // TODO(8.8): persist 'demand.matched' in-app notification per provider. The DemandMatch
      // rows + the provider matching-demands query ARE the MVP alert surface; durable push/email
      // and the Notification model are deferred to Story 8.8.
    }

    this.logger.log(`Demand ${demandId} matched against ${matchCount} listing(s)`);
    return { matchCount };
  }
}
