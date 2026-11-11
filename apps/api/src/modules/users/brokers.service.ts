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
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';

export const BROKER_NOT_FOUND = 'BROKER_NOT_FOUND';
export const REVIEW_NOT_FOUND = 'REVIEW_NOT_FOUND';

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

    const stats: BrokerStatsDto = {
      averageRating,
      totalReviews,
      completedDealsCount,
      activeListingsCount: profile.listings?.length ?? 0,
      ratingDistribution: distribution,
    };

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
   * Admin moderation of a review (Story 6.5 / FR-52, AC-8).
   * Toggles visibility, records admin identifier and timestamp, and creates AuditLog entry.
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
          previousIsHidden,
          isHidden: input.isHidden,
          reason: input.reason,
          adminUsername: admin.username,
        },
        ipAddress: ipAddress || null,
        createdAt: now,
      },
    });

    this.logger.log(
      `Review ${ratingId} moderated by admin ${admin.id} (${admin.username}): isHidden=${input.isHidden}`,
    );

    return updated;
  }
}

