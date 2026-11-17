import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  BrokerPublicProfileDto,
  BrokerStatsDto,
  BrokerReviewItemDto,
  RatingDistribution,
  UserRole,
  ProfileStatus,
  DealStatus,
  ListingStatus,
  maskArabicName,
  ListingSummaryItem,
  AdminReviewQueueQueryInput,
  AdminReviewModerationItemDto,
  AdminReviewModerationDetailDto,
  AdminReviewModerationQueueResponseDto,
  AdminReviewModerationCountsDto,
  AdminReviewAuditEntryDto,
  REVIEW_NOT_FOUND as SHARED_REVIEW_NOT_FOUND,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';

export const BROKER_NOT_FOUND = 'BROKER_NOT_FOUND';
export const REVIEW_NOT_FOUND = SHARED_REVIEW_NOT_FOUND;

@Injectable()
export class BrokersService {
  private readonly logger = new Logger(BrokersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Retrieves the public profile of a verified broker (Story 6.5 / FR-19, BR-06).
   * Strictly conceals personal contact information (mobile, email, nationalId, IBAN).
   * Accessible by either UserProfile.id or User.id.
   */
  async getBrokerPublicProfile(id: string): Promise<BrokerPublicProfileDto> {
    // 1. Resolve marketer UserProfile by profile ID or user ID
    let profile = await this.prisma.userProfile.findFirst({
      where: {
        id,
        role: UserRole.MARKETER,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            createdAt: true,
            status: true,
          },
        },
        falLicense: true,
        listings: {
          where: {
            status: ListingStatus.ACTIVE,
          },
          include: {
            city: { select: { nameAr: true } },
            district: { select: { nameAr: true } },
            documents: {
              where: {
                documentType: 'PHOTO',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!profile) {
      profile = await this.prisma.userProfile.findFirst({
        where: {
          userId: id,
          role: UserRole.MARKETER,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              createdAt: true,
              status: true,
            },
          },
          falLicense: true,
          listings: {
            where: {
              status: ListingStatus.ACTIVE,
            },
            include: {
              city: { select: { nameAr: true } },
              district: { select: { nameAr: true } },
              documents: {
                where: {
                  documentType: 'PHOTO',
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    }

    if (!profile) {
      // Fallback: If id is an associated UserProfile (e.g. OWNER), check if the same user has a MARKETER profile
      const associatedProfile = await this.prisma.userProfile.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (associatedProfile?.userId) {
        profile = await this.prisma.userProfile.findFirst({
          where: {
            userId: associatedProfile.userId,
            role: UserRole.MARKETER,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                createdAt: true,
                status: true,
              },
            },
            falLicense: true,
            listings: {
              where: {
                status: ListingStatus.ACTIVE,
              },
              include: {
                city: { select: { nameAr: true } },
                district: { select: { nameAr: true } },
                documents: {
                  where: {
                    documentType: 'PHOTO',
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });
      }
    }

    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        code: BROKER_NOT_FOUND,
        message: 'ملف الوسيط غير موجود أو غير متاح حالياً',
      });
    }

    // 2. Query completed deals count for this broker
    const completedDealsCount = await this.prisma.deal.count({
      where: {
        sellerProfileId: profile.id,
        status: DealStatus.COMPLETED,
      },
    });

    // 3. Query approved (non-hidden) ratings (AC-2, AC-5)
    const ratings = await this.prisma.rating.findMany({
      where: {
        targetUserId: profile.userId,
        isHidden: false,
      },
      include: {
        raterUser: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 4. Compute rating breakdown and stats
    const stats = this.computeBrokerRatingStats(
      ratings,
      completedDealsCount,
      profile.listings?.length ?? 0,
    );

    // 5. Format reviews with masked rater names (FR-32)
    const reviews: BrokerReviewItemDto[] = ratings.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      rater: {
        maskedName: maskArabicName(r.raterUser?.fullName),
      },
    }));

    // 6. Map active listings to ListingSummaryItem
    const activeListings: ListingSummaryItem[] = await Promise.all(
      (profile.listings || []).map(async (listing: any) => {
        const photoDocs = Array.isArray(listing.documents) ? listing.documents : [];
        const photos: string[] = await Promise.all(
          photoDocs
            .filter((doc: any) => Boolean(doc?.fileUrl))
            .map(async (doc: any) => {
              try {
                return await this.storageService.getPresignedDownloadUrl(doc.fileUrl, 300);
              } catch {
                return doc.fileUrl;
              }
            }),
        );
        const primaryPhotoUrl = photos[0] ?? null;

        return {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          propertyType: listing.propertyType,
          cityId: listing.cityId,
          districtId: listing.districtId,
          cityName: listing.city?.nameAr || '',
          districtName: listing.district?.nameAr || '',
          askPrice: Number(listing.askPrice),
          areaSquareMeters: listing.areaSquareMeters,
          bedrooms: listing.bedrooms,
          yearBuilt: listing.yearBuilt,
          status: listing.status,
          sellerRole: UserRole.MARKETER,
          isFalVerified: profile.falLicense?.status === ProfileStatus.ACTIVE,
          photoCount: photos.length,
          photos,
          primaryPhotoUrl,
          totalViews: listing.totalViews ?? 0,
          totalImpressions: listing.totalImpressions ?? 0,
          totalFavorites: listing.totalFavorites ?? 0,
          isFavorited: false,
          createdAt: listing.createdAt.toISOString ? listing.createdAt.toISOString() : String(listing.createdAt),
        };
      }),
    );

    // 7. Commercial Name & Fal verification status
    const commercialName =
      profile.falLicense?.commercialName?.trim() || profile.user.fullName;
    const isFalVerified = profile.falLicense?.status === ProfileStatus.ACTIVE;

    return {
      id: profile.id,
      userId: profile.userId,
      commercialName,
      fullName: profile.user.fullName,
      createdAt: profile.user.createdAt.toISOString
        ? profile.user.createdAt.toISOString()
        : String(profile.user.createdAt),
      isFalVerified,
      falLicense:
        isFalVerified && profile.falLicense
          ? {
              licenseNumber: profile.falLicense.licenseNumber,
              status: profile.falLicense.status,
              expiryDate: profile.falLicense.expiryDate
                ? profile.falLicense.expiryDate.toISOString()
                : null,
            }
          : null,
      stats,
      reviews,
      activeListings,
    };
  }

  /**
   * Story 8.4 (AC-2): Lists ratings for the Administrative Review Moderation Queue (`/admin/reviews`).
   * Supports filtering by visibility (`ALL`, `VISIBLE`, `HIDDEN`), star score (`1..5`),
   * `lowScoreOnly` (`1..2`), `targetUserId`, and keyword search, alongside global KPI counts.
   */
  async listAdminReviews(
    query: AdminReviewQueueQueryInput,
  ): Promise<AdminReviewModerationQueueResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (query.visibility === 'VISIBLE') {
      where.isHidden = false;
    } else if (query.visibility === 'HIDDEN') {
      where.isHidden = true;
    }

    if (query.score !== undefined) {
      where.score = query.score;
    } else if (query.lowScoreOnly === true) {
      where.score = { lte: 2 };
    }

    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { comment: { contains: term, mode: 'insensitive' } },
        { deal: { dealNumber: { contains: term, mode: 'insensitive' } } },
        { deal: { dealReferenceCode: { contains: term, mode: 'insensitive' } } },
        { raterUser: { fullName: { contains: term, mode: 'insensitive' } } },
        { targetUser: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows =
      (await this.prisma.rating.findMany({
        where,
        include: {
          deal: {
            select: {
              id: true,
              dealNumber: true,
              dealReferenceCode: true,
              listingId: true,
              listing: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          raterUser: {
            select: {
              id: true,
              fullName: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              fullName: true,
              profiles: {
                where: { role: UserRole.MARKETER },
                include: { falLicense: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      })) || [];

    const totalCountResult =
      typeof (this.prisma.rating as any).count === 'function'
        ? await (this.prisma.rating as any).count({ where })
        : undefined;
    const total =
      typeof totalCountResult === 'number' ? totalCountResult : rows.length;

    const allRatingsSnapshot =
      (await this.prisma.rating.findMany({
        select: {
          id: true,
          targetUserId: true,
          score: true,
          isHidden: true,
        },
      })) || rows;

    const counts: AdminReviewModerationCountsDto = {
      totalReviews: allRatingsSnapshot.length,
      visibleReviews: allRatingsSnapshot.filter((r: any) => !r.isHidden).length,
      hiddenReviews: allRatingsSnapshot.filter((r: any) => Boolean(r.isHidden))
        .length,
      lowScoreVisibleReviews: allRatingsSnapshot.filter(
        (r: any) => !r.isHidden && r.score <= 2,
      ).length,
    };

    const brokerPublicStatsMap =
      this.buildBrokerPublicStatsMap(allRatingsSnapshot);

    const adminIds = Array.from(
      new Set(
        rows
          .map((r: any) => r.hiddenByAdminId)
          .filter((id: any): id is string => Boolean(id)),
      ),
    );
    const adminMap = await this.resolveAdminNamesMap(adminIds);

    const items: AdminReviewModerationItemDto[] = rows.map((row: any) =>
      this.mapRatingToAdminItem(row, adminMap, brokerPublicStatsMap),
    );

    return {
      serverTimestamp: this.clockService.now().toISOString(),
      counts,
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Story 8.4 (AC-2): Retrieves a single review with its full deal context, broker public stats,
   * and immutable `AuditLog` moderation history (`REVIEW_HIDDEN` / `REVIEW_UNHIDDEN`).
   */
  async getAdminReviewDetail(
    ratingId: string,
  ): Promise<AdminReviewModerationDetailDto> {
    const existing: any = await this.prisma.rating.findUnique({
      where: { id: ratingId },
      include: {
        deal: {
          select: {
            id: true,
            dealNumber: true,
            dealReferenceCode: true,
            listingId: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        raterUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            fullName: true,
            profiles: {
              where: { role: UserRole.MARKETER },
              include: { falLicense: true },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: REVIEW_NOT_FOUND,
        message: 'التقييم المطلوب غير موجود',
      });
    }

    const brokerRatings =
      (await this.prisma.rating.findMany({
        where: {
          targetUserId: existing.targetUserId,
          isHidden: false,
        },
        select: {
          id: true,
          targetUserId: true,
          score: true,
          isHidden: true,
        },
      })) || [];

    const brokerPublicStatsMap = this.buildBrokerPublicStatsMap(brokerRatings);

    const auditRows: any[] =
      typeof (this.prisma.auditLog as any).findMany === 'function'
        ? (await (this.prisma.auditLog as any).findMany({
            where: {
              entityType: 'Rating',
              entityId: ratingId,
            },
            orderBy: { createdAt: 'desc' },
          })) || []
        : [];

    const adminIds = Array.from(
      new Set(
        [
          existing.hiddenByAdminId,
          ...auditRows.map((a: any) => a.actorId),
        ].filter((id: any): id is string => Boolean(id)),
      ),
    );
    const adminMap = await this.resolveAdminNamesMap(adminIds);

    const baseItem = this.mapRatingToAdminItem(
      existing,
      adminMap,
      brokerPublicStatsMap,
    );

    const auditTrail: AdminReviewAuditEntryDto[] = auditRows.map((entry: any) => {
      const payload =
        entry.payload && typeof entry.payload === 'object'
          ? (entry.payload as Record<string, any>)
          : {};
      const actorName =
        (entry.actorId && adminMap.get(entry.actorId)) ||
        payload.adminUsername ||
        'مشرف النظام';
      return {
        id: entry.id,
        action:
          entry.action === 'REVIEW_UNHIDDEN'
            ? 'REVIEW_UNHIDDEN'
            : 'REVIEW_HIDDEN',
        actorId: entry.actorId ?? null,
        actorName,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
        previousIsHidden:
          typeof payload.previousIsHidden === 'boolean'
            ? payload.previousIsHidden
            : null,
        isHidden:
          typeof payload.isHidden === 'boolean'
            ? payload.isHidden
            : entry.action !== 'REVIEW_UNHIDDEN',
        createdAt:
          entry.createdAt instanceof Date
            ? entry.createdAt.toISOString()
            : String(entry.createdAt),
        ipAddress: entry.ipAddress ?? null,
      };
    });

    return {
      ...baseItem,
      auditTrail,
    };
  }

  /**
   * Admin moderation of a review (Story 6.5 & Story 8.4 / FR-19, FR-52, AC-3, AC-8).
   * Toggles visibility without ever deleting physical Rating records, records admin identifier and
   * ClockService timestamp, creates immutable AuditLog entry, and recalculates broker public average.
   */
  async moderateReview(
    ratingId: string,
    input: { isHidden: boolean; reason: string },
    admin: { id: string; username?: string },
    ipAddress?: string,
  ) {
    const existing = await this.prisma.rating.findUnique({
      where: { id: ratingId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: REVIEW_NOT_FOUND,
        message: 'التقييم المطلوب غير موجود',
      });
    }

    const previousIsHidden = existing.isHidden;
    const now = this.clockService.now();

    const updated = await this.prisma.rating.update({
      where: { id: ratingId },
      data: {
        isHidden: input.isHidden,
        hiddenByAdminId: admin.id,
        hiddenAt: now,
        hiddenReason: input.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorType: 'ADMIN',
        action: input.isHidden ? 'REVIEW_HIDDEN' : 'REVIEW_UNHIDDEN',
        entityType: 'Rating',
        entityId: ratingId,
        payload: {
          dealId: existing.dealId,
          targetUserId: existing.targetUserId,
          raterUserId: (existing as any).raterUserId,
          score: (existing as any).score,
          commentSnapshot: (existing as any).comment ?? null,
          previousIsHidden,
          isHidden: input.isHidden,
          reason: input.reason,
          adminUsername: admin.username,
        },
        ipAddress: ipAddress || null,
        createdAt: now,
      },
    });

    const visibleRatings = await this.prisma.rating.findMany({
      where: {
        targetUserId: existing.targetUserId,
        isHidden: false,
      },
    });

    const updatedBrokerStats = this.computeBrokerRatingStats(
      Array.isArray(visibleRatings) ? visibleRatings : [],
      0,
      0,
    );

    this.logger.log(
      `Review ${ratingId} moderated by admin ${admin.id} (${admin.username}): isHidden=${input.isHidden}`,
    );

    return {
      ...updated,
      updatedBrokerStats,
    };
  }

  private computeBrokerRatingStats(
    ratings: Array<{ score: number }>,
    completedDealsCount: number,
    activeListingsCount: number,
  ): BrokerStatsDto {
    const totalReviews = ratings.length;
    let sumScore = 0;
    const distribution: RatingDistribution = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0,
    };

    for (const r of ratings) {
      sumScore += r.score;
      const bucketKey = String(r.score) as keyof RatingDistribution;
      if (distribution[bucketKey] !== undefined) {
        distribution[bucketKey] += 1;
      }
    }

    const averageRating =
      totalReviews > 0 ? Math.round((sumScore / totalReviews) * 10) / 10 : null;

    return {
      averageRating,
      totalReviews,
      completedDealsCount,
      activeListingsCount,
      ratingDistribution: distribution,
    };
  }

  private buildBrokerPublicStatsMap(
    ratings: Array<{ targetUserId: string; score: number; isHidden: boolean }>,
  ): Map<string, { averageRating: number | null; visibleCount: number }> {
    const grouped = new Map<string, number[]>();
    for (const r of ratings) {
      if (r.isHidden) continue;
      const list = grouped.get(r.targetUserId) || [];
      list.push(r.score);
      grouped.set(r.targetUserId, list);
    }

    const statsMap = new Map<
      string,
      { averageRating: number | null; visibleCount: number }
    >();
    for (const [targetUserId, scores] of grouped.entries()) {
      const visibleCount = scores.length;
      const sum = scores.reduce((acc, s) => acc + s, 0);
      const averageRating =
        visibleCount > 0 ? Math.round((sum / visibleCount) * 10) / 10 : null;
      statsMap.set(targetUserId, { averageRating, visibleCount });
    }
    return statsMap;
  }

  private async resolveAdminNamesMap(
    adminIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (
      adminIds.length === 0 ||
      !(this.prisma as any).adminUser ||
      typeof (this.prisma as any).adminUser.findMany !== 'function'
    ) {
      return map;
    }

    const admins =
      (await (this.prisma as any).adminUser.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true },
      })) || [];

    for (const admin of admins) {
      if (admin?.id && admin?.fullName) {
        map.set(admin.id, admin.fullName);
      }
    }
    return map;
  }

  private mapRatingToAdminItem(
    row: any,
    adminMap: Map<string, string>,
    brokerPublicStatsMap: Map<
      string,
      { averageRating: number | null; visibleCount: number }
    >,
  ): AdminReviewModerationItemDto {
    const marketerProfile = row.targetUser?.profiles?.[0] ?? null;
    const falLicense = marketerProfile?.falLicense ?? null;
    const isFalVerified = falLicense?.status === ProfileStatus.ACTIVE;
    const commercialName =
      falLicense?.commercialName?.trim() ||
      row.targetUser?.fullName ||
      'وسيط عقاري';
    const brokerStats = brokerPublicStatsMap.get(row.targetUserId) || {
      averageRating: null,
      visibleCount: 0,
    };
    const raterFullName = row.raterUser?.fullName || 'مشتري موثق';

    return {
      id: row.id,
      dealId: row.dealId,
      dealNumber: row.deal?.dealNumber || row.dealId,
      dealReferenceCode: row.deal?.dealReferenceCode ?? null,
      listingId: row.deal?.listingId || row.deal?.listing?.id || null,
      listingTitle: row.deal?.listing?.title || 'صفقة عقارية مكتملة',
      score: row.score,
      comment: row.comment ?? null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      isHidden: Boolean(row.isHidden),
      hiddenByAdminId: row.hiddenByAdminId ?? null,
      hiddenByAdminName: row.hiddenByAdminId
        ? adminMap.get(row.hiddenByAdminId) ?? null
        : null,
      hiddenAt: row.hiddenAt
        ? row.hiddenAt instanceof Date
          ? row.hiddenAt.toISOString()
          : String(row.hiddenAt)
        : null,
      hiddenReason: row.hiddenReason ?? null,
      rater: {
        id: row.raterUser?.id || row.raterUserId,
        fullName: raterFullName,
        maskedName: maskArabicName(raterFullName),
      },
      targetBroker: {
        userId: row.targetUserId,
        profileId: marketerProfile?.id ?? null,
        fullName: row.targetUser?.fullName || '',
        commercialName,
        licenseNumber: falLicense?.licenseNumber ?? null,
        isFalVerified,
        publicAverageRating: brokerStats.averageRating,
        publicVisibleReviewsCount: brokerStats.visibleCount,
      },
    };
  }
}
