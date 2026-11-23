import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { QuarantineService } from '../storage/quarantine.service';
import {
  UserRole,
  ProfileStatus,
  ListingStatus,
  OfferStatus,
  ACTIVE_DEAL_STATUSES,
  DocumentVisibility,
  ScanStatus,
  PriceSuggestionStatus,
  PriceSuggestionItem,
  RespondPriceSuggestionInput,
  ArchiveListingInput,
  LISTING_NOT_FOUND,
  LISTING_ROLE_UNAUTHORIZED,
  LISTING_INVALID_STATE_TRANSITION,
  LISTING_MARKETER_AUTH_DOC_REQUIRED,
  LISTING_OWNER_DEED_REQUIRED,
  LISTING_FAL_LICENSE_REQUIRED,
  FAL_COMPLIANCE_RESTRICTED,
  LISTING_INVALID_IBAN,
  LISTING_MALWARE_DETECTED,
  LISTING_ARCHIVE_BLOCKED_RESERVED,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS,
  LISTING_NOT_ARCHIVED,
  LISTING_NOT_SUSPENDED,
  LISTING_ALREADY_BLOCKED,
  LISTING_PERMANENTLY_BLOCKED,
  LISTING_COMPLIANCE_SUSPENDED,
  PRICE_SUGGESTION_NOT_FOUND,
  PRICE_SUGGESTION_ALREADY_RESPONDED,
  ListingEngagementEventType,
  BatchListingEngagementInput,
  ListingAnalyticsSummary,
  ListingSearchSort,
  ListingSearchQuery,
  SearchListingsResponse,
  ListingMapQuery,
  MapListingItem,
  ListingSummaryItem,
  MAX_MAP_RESULTS,
  SIMILAR_LISTINGS_MAX,
  SIMILAR_LISTINGS_PRICE_TOLERANCE,
  FAVORITES_LIMIT_REACHED,
  MAX_FAVORITES_PER_USER,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
  MAX_LISTING_FILE_SIZE_BYTES,
  DEFAULT_PAGE_SIZE,
  ACTIVE_OFFER_STATUSES,
} from '@elmasaif/shared';
import { CreateListingDto } from './dto/create-listing.dto';
import { UploadListingMediaResponse } from './dto/upload-listing-media.dto';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
    private readonly quarantineService: QuarantineService,
  ) {}

  private mapPriceSuggestionItem(s: any): PriceSuggestionItem {
    return {
      id: s.id,
      listingId: s.listingId,
      currentAskPrice: Number(s.currentAskPrice),
      suggestedPrice: Number(s.suggestedPrice),
      reason: s.reason,
      status: s.status as PriceSuggestionStatus,
      suggestedByAdminId: s.suggestedByAdminId,
      suggestedByAdminName: s.suggestedByAdminName,
      sellerResponseNote: s.sellerResponseNote ?? null,
      respondedAt: s.respondedAt
        ? s.respondedAt instanceof Date
          ? s.respondedAt.toISOString()
          : String(s.respondedAt)
        : null,
      createdAt:
        s.createdAt instanceof Date
          ? s.createdAt.toISOString()
          : String(s.createdAt),
    };
  }

  /**
   * Creates a new property listing with validation of location, pricing,
   * role permissions, Fal licensing, and classified legal documents.
   */
  async createListing(
    userId: string,
    activeRole: UserRole,
    dto: CreateListingDto,
  ): Promise<any> {
    // 1. Verify User Profile & Role Authorization
    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: activeRole,
        },
      },
      include: {
        falLicense: true,
      },
    });

    if (activeRole === UserRole.MARKETER) {
      if (
        profile?.status === ProfileStatus.COMPLIANCE_RESTRICTED ||
        profile?.falLicense?.status === ProfileStatus.COMPLIANCE_RESTRICTED
      ) {
        throw new ForbiddenException({
          code: FAL_COMPLIANCE_RESTRICTED,
          message:
            'لا يمكن إنشاء إعلانات جديدة نظراً لانتهاء صلاحية رخصة فال وتقييد الحساب للامتثال',
        });
      }
    }

    if (!profile || profile.status !== ProfileStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'LISTING_ROLE_UNAUTHORIZED',
        message: 'الملف التعريفي غير نشط أو غير مصرح له بإنشاء إعلانات عقارية',
      });
    }

    // 2. Role-Specific Legal Document & License Enforcements
    if (activeRole === UserRole.MARKETER) {
      // Fal License must be verified and active
      const fal = profile.falLicense;
      const now = this.clockService.now();
      const isFalActive =
        fal &&
        fal.status === ProfileStatus.ACTIVE &&
        (!fal.expiryDate || new Date(fal.expiryDate) > now);

      if (!isFalActive) {
        throw new ForbiddenException({
          code: LISTING_FAL_LICENSE_REQUIRED,
          message: 'يتطلب إنشاء الإعلان وسيطاً معتمداً برخصة فال عقارية سارية ومفعلة',
        });
      }

      // Marketer must provide at least one OWNER_AUTHORIZATION document
      const hasAuthDoc = dto.documents?.some(
        (doc) => doc.documentType === 'OWNER_AUTHORIZATION',
      );
      if (!hasAuthDoc) {
        throw new BadRequestException({
          code: LISTING_MARKETER_AUTH_DOC_REQUIRED,
          message: 'مطلوب إرفاق عقد تفويض المالك أو اتفاقية الوساطة لإنشاء الإعلان',
        });
      }
    } else if (activeRole === UserRole.OWNER) {
      // Owner must provide at least one TITLE_DEED document
      const hasDeed = dto.documents?.some(
        (doc) => doc.documentType === 'TITLE_DEED',
      );
      if (!hasDeed) {
        throw new BadRequestException({
          code: LISTING_OWNER_DEED_REQUIRED,
          message: 'مطلوب إرفاق صك الملكية الإلكتروني المعتمد لإنشاء الإعلان',
        });
      }
    }

    // 3. Geographic Master Data Validation
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city || !city.isActive) {
      throw new BadRequestException({
        code: GEO_CITY_INACTIVE,
        message: 'المدينة المحددة غير موجودة أو غير مفعلة',
      });
    }

    const district = await this.prisma.district.findUnique({
      where: {
        id_cityId: {
          id: dto.districtId,
          cityId: dto.cityId,
        },
      },
    });
    if (!district || !district.isActive) {
      throw new BadRequestException({
        code: GEO_DISTRICT_INACTIVE,
        message: 'الحي المحدد غير موجود أو غير مفعل أو لا يتبع المدينة المحددة',
      });
    }

    // 4. Payout IBAN Verification
    const cleanIban = dto.payoutIban.replace(/\s+/g, '').toUpperCase();
    const last4 = cleanIban.slice(-4);
    const registeredPayout = await this.prisma.payoutAccount.findFirst({
      where: {
        profileId: profile.id,
        OR: [
          { ibanMasked: { contains: last4 } },
          { ibanLast4: last4 },
        ],
      },
    });

    if (!registeredPayout) {
      throw new BadRequestException({
        code: LISTING_INVALID_IBAN,
        message: 'رقم الآيبان المحدد غير مرتبط بحسابات الصرف المسجلة في ملفك الشخصي',
      });
    }

    // 5. Photos normalization (ensure at least 1 primary photo)
    let hasPrimary = false;
    const normalizedPhotos = dto.photos.map((photo) => {
      if (photo.isPrimary && !hasPrimary) {
        hasPrimary = true;
        return { ...photo, isPrimary: true };
      }
      return { ...photo, isPrimary: false };
    });
    if (!hasPrimary && normalizedPhotos.length > 0) {
      normalizedPhotos[0].isPrimary = true;
    }

    // 6. Documents classification & privacy override
    const sensitiveDocTypes = ['TITLE_DEED', 'OWNER_AUTHORIZATION', 'COMMERCIAL_REGISTRATION'];
    const classifiedDocuments = dto.documents.map((doc) => {
      const isSensitive = sensitiveDocTypes.includes(doc.documentType);
      return {
        ...doc,
        visibility: isSensitive ? DocumentVisibility.ADMIN_ONLY : doc.visibility,
      };
    });

    // 7. Atomic Database Transaction
    return this.prisma.$transaction(async (tx) => {
      // A. Create Listing record
      const listing = await tx.listing.create({
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          propertyType: dto.propertyType,
          cityId: dto.cityId,
          districtId: dto.districtId,
          streetName: dto.streetName ? dto.streetName.trim() : null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          askPrice: new Prisma.Decimal(dto.askPrice),
          areaSquareMeters: dto.areaSquareMeters,
          bedrooms: dto.bedrooms ?? null,
          yearBuilt: dto.yearBuilt ?? null,
          payoutIban: cleanIban,
          status: ListingStatus.PENDING_REVIEW,
          sellerProfileId: profile.id,
          version: 1,
        },
      });

      // B. Create PropertyDocument records for photos
      const photoDocs = normalizedPhotos.map((photo) => ({
        listingId: listing.id,
        documentType: 'PHOTO',
        fileUrl: photo.fileUrl,
        mimeType: photo.mimeType,
        fileSize: photo.fileSize,
        visibility: DocumentVisibility.PUBLIC,
        scanStatus: ScanStatus.CLEAN,
      }));

      // C. Create PropertyDocument records for classified documents
      const legalDocs = classifiedDocuments.map((doc) => ({
        listingId: listing.id,
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        visibility: doc.visibility,
        scanStatus: ScanStatus.CLEAN,
      }));

      if (photoDocs.length > 0 || legalDocs.length > 0) {
        await tx.propertyDocument.createMany({
          data: [...photoDocs, ...legalDocs],
        });
      }

      // D. Create Immutable AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'LISTING_CREATED',
          entityType: 'Listing',
          entityId: listing.id,
          payload: {
            title: listing.title,
            propertyType: listing.propertyType,
            cityId: listing.cityId,
            districtId: listing.districtId,
            askPrice: Number(listing.askPrice),
            photoCount: photoDocs.length,
            documentCount: legalDocs.length,
          },
        },
      });

      this.logger.log(`Listing '${listing.id}' successfully created by user '${userId}' (Status: PENDING_REVIEW)`);
      return listing;
    });
  }

  /**
   * Lists public ACTIVE property listings for the marketplace home/search view.
   */
  async getPublicActiveListings(limit = 24, requesterUserId?: string): Promise<any> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(limit) || 24)),
      include: this.getPublicListingInclude(),
    });

    const favoritedListingIds = await this.resolveFavoritedListingIds(
      requesterUserId,
      listings.map((listing: any) => listing.id),
    );
    const items = await this.toSummaryItems(listings, favoritedListingIds);

    return { items };
  }

  /**
   * Multi-criteria public search over active sale listings (Story 3.1).
   * Returns ONLY `ACTIVE` or `RESERVED` listings; every other status is always excluded.
   * Filters are combined with AND across fields; free text matches title OR description
   * case-insensitively. Results are paginated and sortable.
   */
  async searchListings(
    query: ListingSearchQuery,
    requesterUserId?: string,
  ): Promise<SearchListingsResponse> {
    const where: Prisma.ListingWhereInput = {
      status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
    };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.cityId) where.cityId = query.cityId;
    if (query.districtId) where.districtId = query.districtId;
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.priceMin != null || query.priceMax != null) {
      where.askPrice = {
        ...(query.priceMin != null && { gte: query.priceMin }),
        ...(query.priceMax != null && { lte: query.priceMax }),
      };
    }
    if (query.areaMin != null || query.areaMax != null) {
      where.areaSquareMeters = {
        ...(query.areaMin != null && { gte: query.areaMin }),
        ...(query.areaMax != null && { lte: query.areaMax }),
      };
    }
    if (query.bedroomsMin != null) where.bedrooms = { gte: query.bedroomsMin };
    // NOTE (Story 3.1 limitation): isFalVerified is currently derived from seller role.
    // True Fal-license validity is owned by Epic 6. We filter MARKETER profiles to match
    // the badge behavior and do NOT fabricate a license check here.
    if (query.falOnly) where.sellerProfile = { is: { role: UserRole.MARKETER } };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const [total, listings] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy: this.buildSearchOrderBy(query.sort),
        skip,
        take: limit,
        include: this.getPublicListingInclude(),
      }),
    ]);

    const favoritedListingIds = await this.resolveFavoritedListingIds(
      requesterUserId,
      listings.map((listing: any) => listing.id),
    );
    const items = await this.toSummaryItems(listings, favoritedListingIds);
    const totalPages = Math.ceil(total / limit);

    return { items, meta: { total, page, limit, totalPages } };
  }

  /**
   * Bounding-box query for the interactive clustered map (Story 3.2 / FR-16).
   * Returns up to MAX_MAP_RESULTS lightweight items within the viewport; does NOT presign photos.
   */
  async getListingsForMap(query: ListingMapQuery): Promise<{ items: MapListingItem[] }> {
    const where: Prisma.ListingWhereInput = {
      status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
      latitude: { gte: query.swLat, lte: query.neLat },
      longitude: { gte: query.swLng, lte: query.neLng },
    };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.cityId) where.cityId = query.cityId;
    if (query.districtId) where.districtId = query.districtId;
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.priceMin != null || query.priceMax != null) {
      where.askPrice = {
        ...(query.priceMin != null && { gte: query.priceMin }),
        ...(query.priceMax != null && { lte: query.priceMax }),
      };
    }
    if (query.areaMin != null || query.areaMax != null) {
      where.areaSquareMeters = {
        ...(query.areaMin != null && { gte: query.areaMin }),
        ...(query.areaMax != null && { lte: query.areaMax }),
      };
    }
    if (query.bedroomsMin != null) where.bedrooms = { gte: query.bedroomsMin };
    if (query.falOnly) where.sellerProfile = { is: { role: UserRole.MARKETER } };

    const listings = await this.prisma.listing.findMany({
      where,
      take: MAX_MAP_RESULTS,
      select: {
        id: true,
        title: true,
        propertyType: true,
        latitude: true,
        longitude: true,
        askPrice: true,
        areaSquareMeters: true,
        status: true,
        sellerProfile: { select: { role: true } },
        documents: {
          where: { documentType: 'PHOTO', visibility: DocumentVisibility.PUBLIC },
          select: { fileUrl: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const items: MapListingItem[] = await Promise.all(
      listings.map(async (l: any) => {
        let primaryPhotoUrl: string | null = null;
        const photoDoc = l.documents?.[0];
        if (photoDoc?.fileUrl) {
          try {
            primaryPhotoUrl = await this.storageService.getPresignedDownloadUrl(photoDoc.fileUrl, 300);
          } catch {
            primaryPhotoUrl = photoDoc.fileUrl;
          }
        }
        return {
          id: l.id,
          title: l.title,
          propertyType: l.propertyType,
          latitude: l.latitude,
          longitude: l.longitude,
          askPrice: Number(l.askPrice),
          areaSquareMeters: l.areaSquareMeters,
          status: l.status,
          isFalVerified: l.sellerProfile?.role === UserRole.MARKETER,
          primaryPhotoUrl,
        };
      }),
    );

    return { items };
  }

  /**
   * Similar listings engine (Story 3.4 / FR-18).
   * Returns up to SIMILAR_LISTINGS_MAX ACTIVE listings matching the base listing's
   * propertyType + cityId, always excluding the base listing itself. District
   * matches are preferred; any remaining capacity fills from city-wide ACTIVE candidates. The base listing must
   * be ACTIVE or this throws LISTING_NOT_FOUND (same semantics as getListingById).
   */
  async getSimilarListings(
    id: string,
    requesterUserId?: string,
  ): Promise<{ items: ListingSummaryItem[] }> {
    const base = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        propertyType: true,
        cityId: true,
        districtId: true,
        askPrice: true,
      },
    });

    if (!base || base.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${id}' غير موجود`,
      });
    }

    const baseWhere: Prisma.ListingWhereInput = {
      status: ListingStatus.ACTIVE,
      propertyType: base.propertyType,
      cityId: base.cityId,
      id: { not: id },
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'asc' },
    ];
    const include = this.getPublicListingInclude();

    // Pass 1 — same district (preferred)
    const districtCandidates: any[] = base.districtId
      ? await this.prisma.listing.findMany({
          where: { ...baseWhere, districtId: base.districtId },
          take: SIMILAR_LISTINGS_MAX,
          orderBy,
          include,
        })
      : [];

    let collected: any[] = districtCandidates;

    // Pass 2 — city fallback to fill any remaining capacity (never duplicates)
    if (districtCandidates.length < SIMILAR_LISTINGS_MAX) {
      const remaining = SIMILAR_LISTINGS_MAX - districtCandidates.length;
      const alreadyIds = [id, ...districtCandidates.map((l: any) => l.id)];
      const cityFallback = await this.prisma.listing.findMany({
        where: {
          ...baseWhere,
          id: { notIn: alreadyIds },
        },
        take: remaining,
        orderBy,
        include,
      });
      collected = [...districtCandidates, ...cityFallback];
    }

    const favoritedListingIds = await this.resolveFavoritedListingIds(
      requesterUserId,
      collected.map((listing: any) => listing.id),
    );
    const items = (await this.toSummaryItems(
      collected,
      favoritedListingIds,
    )) as ListingSummaryItem[];

    return { items };
  }

  /**
   * Returns every listing the authenticated buyer has favorited, newest-saved first,
   * joined to the LIVE listing row (no status filter) so RESERVED/SOLD/ARCHIVED
   * favorites surface their current status badge. Capped at MAX_FAVORITES_PER_USER by
   * construction; photos presign through the shared `toSummaryItems` mapper.
   */
  async getBuyerFavorites(userId: string): Promise<{ items: ListingSummaryItem[] }> {
    const favorites = await this.prisma.listingFavorite.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { listingId: 'asc' }],
      include: {
        listing: {
          include: this.getPublicListingInclude(),
        },
      },
    });

    const listings = favorites.map((favorite: any) => favorite.listing).filter(Boolean);
    const favoritedIds = new Set<string>(listings.map((listing: any) => listing.id));
    const items = (await this.toSummaryItems(
      listings,
      favoritedIds,
    )) as ListingSummaryItem[];

    return { items };
  }

  /**
   * Shared include shape for public listing reads (city, district, public PHOTO docs,
   * seller role, offers count). Used by both the home feed and multi-criteria search.
   */
  private getPublicListingInclude(): Prisma.ListingInclude {
    return {
      city: true,
      district: true,
      documents: {
        where: {
          documentType: 'PHOTO',
          visibility: DocumentVisibility.PUBLIC,
        },
      },
      sellerProfile: {
        select: {
          id: true,
          role: true,
        },
      },
      _count: {
        select: {
          offers: true,
        },
      },
    };
  }

  /**
   * Maps a validated sort token to a stable Prisma orderBy (tie-break on id for consistent paging).
   */
  private buildSearchOrderBy(
    sort?: ListingSearchSort,
  ): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case ListingSearchSort.PRICE_ASC:
        return [{ askPrice: 'asc' }, { id: 'asc' }];
      case ListingSearchSort.PRICE_DESC:
        return [{ askPrice: 'desc' }, { id: 'asc' }];
      case ListingSearchSort.NEWEST:
      default:
        return [{ createdAt: 'desc' }, { id: 'asc' }];
    }
  }

  /**
   * Resolves the set of listing IDs the requester has favorited (single query, no-op when anonymous).
   */
  private async resolveFavoritedListingIds(
    requesterUserId: string | undefined,
    listingIds: string[],
  ): Promise<Set<string>> {
    if (!requesterUserId || !this.prisma.listingFavorite || listingIds.length === 0) {
      return new Set<string>();
    }
    const userFavorites = await this.prisma.listingFavorite.findMany({
      where: {
        userId: requesterUserId,
        listingId: { in: listingIds },
      },
      select: { listingId: true },
    });
    return new Set(userFavorites.map((favorite: any) => favorite.listingId));
  }

  /**
   * Maps raw Prisma listing rows to `ListingSummaryItem` shapes: presigned photos, Fal badge,
   * favorite flag, and engagement counters. Shared by the home feed and search to avoid duplication.
   */
  private async toSummaryItems(
    listings: any[],
    favoritedListingIds: Set<string>,
  ): Promise<any[]> {
    return Promise.all(
      listings.map(async (listing: any) => {
        const photoDocs = Array.isArray(listing.documents) ? listing.documents : [];
        const photos: string[] = await Promise.all(
          photoDocs
            .filter((doc: any) => Boolean(doc?.fileUrl))
            .map(async (doc: any) => {
              try {
                return await this.storageService.getPresignedDownloadUrl(
                  doc.fileUrl,
                  300,
                );
              } catch {
                return doc.fileUrl;
              }
            }),
        );
        const primaryPhotoUrl = photos[0] ?? null;
        const sellerRole = listing.sellerProfile?.role || UserRole.OWNER;

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
          sellerRole,
          isFalVerified: sellerRole === UserRole.MARKETER,
          photoCount: photos.length,
          photos,
          primaryPhotoUrl,
          totalViews: listing.totalViews ?? 0,
          totalImpressions: listing.totalImpressions ?? 0,
          totalFavorites: listing.totalFavorites ?? 0,
          isFavorited: favoritedListingIds.has(listing.id),
          createdAt: listing.createdAt,
        };
      }),
    );
  }

  /**
   * Lists all property listings created by the authenticated user (across OWNER / MARKETER profiles)
   * including moderation status (PENDING_REVIEW, ACTIVE, REJECTED) and rejectionReason.
   */
  async getMyListings(userId: string): Promise<any> {
    const listings = await this.prisma.listing.findMany({
      where: {
        sellerProfile: {
          userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        city: true,
        district: true,
        documents: {
          select: {
            id: true,
            documentType: true,
            fileUrl: true,
            visibility: true,
          },
        },
        priceSuggestions: {
          orderBy: { createdAt: 'desc' },
        },
        sellerProfile: {
          select: {
            id: true,
            role: true,
          },
        },
        _count: {
          select: {
            offers: true,
          },
        },
      },
    });

    const items = await Promise.all(
      listings.map(async (listing: any) => {
        const docs = Array.isArray(listing.documents) ? listing.documents : [];
        const photoDocs = docs.filter((d: any) => d.documentType === 'PHOTO');
        const legalDocs = docs.filter((d: any) => d.documentType !== 'PHOTO');
        const photos: string[] = await Promise.all(
          photoDocs
            .filter((doc: any) => Boolean(doc?.fileUrl))
            .map(async (doc: any) => {
              try {
                return await this.storageService.getPresignedDownloadUrl(
                  doc.fileUrl,
                  300,
                );
              } catch {
                return doc.fileUrl;
              }
            }),
        );
        const primaryPhotoUrl = photos[0] ?? null;
        const sellerRole = listing.sellerProfile?.role || UserRole.OWNER;
        const rawSuggestions = Array.isArray(listing.priceSuggestions)
          ? listing.priceSuggestions
          : [];
        const priceSuggestions = rawSuggestions.map((s: any) =>
          this.mapPriceSuggestionItem(s),
        );
        const activePriceSuggestion =
          priceSuggestions.find(
            (s: PriceSuggestionItem) => s.status === PriceSuggestionStatus.PENDING,
          ) ?? null;

        return {
          id: listing.id,
          title: listing.title,
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
          rejectionReason: (listing as any).rejectionReason ?? null,
          reviewedAt: (listing as any).reviewedAt ?? null,
          complianceReason: (listing as any).complianceReason ?? null,
          complianceCategory: (listing as any).complianceCategory ?? null,
          complianceActionAt: (listing as any).complianceActionAt
            ? new Date((listing as any).complianceActionAt).toISOString()
            : null,
          complianceOfficerId: (listing as any).complianceOfficerId ?? null,
          archivedAt: (listing as any).archivedAt
            ? new Date((listing as any).archivedAt).toISOString()
            : null,
          archiveReason: (listing as any).archiveReason ?? null,
          sellerRole,
          isFalVerified: sellerRole === UserRole.MARKETER,
          photoCount: photos.length,
          photos,
          documentCount: legalDocs.length,
          primaryPhotoUrl,
          totalViews: listing.totalViews ?? 0,
          totalImpressions: listing.totalImpressions ?? 0,
          totalFavorites: listing.totalFavorites ?? 0,
          offersCount: listing._count?.offers ?? 0,
          activePriceSuggestion,
          priceSuggestions,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
        };
      }),
    );

    return { items };
  }

  /**
   * Retrieves listing details with document visibility filtering and signed URLs.
   */
  async getListingById(
    id: string,
    requesterUserId?: string,
    requesterIsAdmin = false,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        city: true,
        district: true,
        documents: true,
        priceSuggestions: {
          orderBy: { createdAt: 'desc' },
        },
        sellerProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                mobileNumber: true,
                email: true,
                nationalId: true,
              },
            },
          },
        },
        _count: {
          select: {
            offers: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${id}' غير موجود`,
      });
    }

    const isFavorited =
      requesterUserId && this.prisma.listingFavorite
        ? Boolean(
            await this.prisma.listingFavorite.findUnique({
            where: {
              userId_listingId: {
                userId: requesterUserId,
                listingId: id,
              },
            },
          }),
        )
      : false;

    const isSeller = Boolean(
      requesterUserId && listing.sellerProfile?.userId === requesterUserId,
    );
    const canViewPrivate = isSeller || requesterIsAdmin;

    if (
      [
        ListingStatus.ARCHIVED,
        ListingStatus.SUSPENDED,
        ListingStatus.BLOCKED,
      ].includes(listing.status as any) &&
      !canViewPrivate
    ) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${id}' غير متاح حالياً`,
      });
    }

    // Filter documents based on visibility permissions
    let documentsToReturn = listing.documents;
    if (!canViewPrivate) {
      // Public visitors & buyers: only see PUBLIC documents
      documentsToReturn = await Promise.all(
        listing.documents
          .filter((doc: any) => doc.visibility === DocumentVisibility.PUBLIC)
          .map(async (doc: any) => {
            // Buyer-facing galleries need real fetchable URLs, so PUBLIC photos are
            // pre-signed exactly like the feed/search summaries (Story 3.3 / AC#2).
            if (doc.documentType !== 'PHOTO') {
              return doc;
            }
            try {
              const presignedUrl = await this.storageService.getPresignedDownloadUrl(
                doc.fileUrl,
                300,
              );
              return {
                ...doc,
                fileUrl: presignedUrl,
              };
            } catch {
              return doc;
            }
          }),
      );
    } else {
      // Authorized seller or admin: generate short-lived pre-signed download URLs (<= 300s)
      documentsToReturn = await Promise.all(
        listing.documents.map(async (doc: any) => {
          try {
            const presignedUrl = await this.storageService.getPresignedDownloadUrl(
              doc.fileUrl,
              300,
            );
            return {
              ...doc,
              fileUrl: presignedUrl,
            };
          } catch {
            return doc;
          }
        }),
      );
    }

    // Conceal sensitive seller direct contact information for public / buyer requesters per BR-06
    const sanitizedSellerProfile = listing.sellerProfile
      ? {
          id: listing.sellerProfile.id,
          userId: listing.sellerProfile.userId,
          role: listing.sellerProfile.role,
          user: {
            id: listing.sellerProfile.user.id,
            fullName: listing.sellerProfile.user.fullName,
            username: listing.sellerProfile.user.username,
            ...(canViewPrivate
              ? {
                  mobileNumber: listing.sellerProfile.user.mobileNumber,
                  email: listing.sellerProfile.user.email,
                  nationalId: listing.sellerProfile.user.nationalId,
                }
              : {}),
          },
        }
      : null;

    const photos = documentsToReturn.filter((d: any) => d.documentType === 'PHOTO');
    const documents = documentsToReturn.filter((d: any) => d.documentType !== 'PHOTO');

    const rawSuggestions = Array.isArray((listing as any).priceSuggestions)
      ? (listing as any).priceSuggestions
      : [];
    const priceSuggestions = canViewPrivate
      ? rawSuggestions.map((s: any) => this.mapPriceSuggestionItem(s))
      : undefined;
    const activePriceSuggestion = canViewPrivate
      ? priceSuggestions?.find(
          (s: PriceSuggestionItem) => s.status === PriceSuggestionStatus.PENDING,
        ) ?? null
      : undefined;

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      propertyType: listing.propertyType,
      cityId: listing.cityId,
      districtId: listing.districtId,
      cityName: listing.city?.nameAr,
      districtName: listing.district?.nameAr,
      streetName: listing.streetName,
      latitude: listing.latitude,
      longitude: listing.longitude,
      askPrice: Number(listing.askPrice),
      areaSquareMeters: listing.areaSquareMeters,
      bedrooms: listing.bedrooms,
      yearBuilt: listing.yearBuilt,
      status: listing.status,
      sellerProfileId: listing.sellerProfileId,
      sellerProfile: sanitizedSellerProfile,
      ...(canViewPrivate
        ? {
            payoutIban: listing.payoutIban,
            activePriceSuggestion,
            priceSuggestions,
          }
        : {}),
      version: listing.version,
      complianceReason: (listing as any).complianceReason ?? null,
      complianceCategory: (listing as any).complianceCategory ?? null,
      complianceActionAt: (listing as any).complianceActionAt
        ? new Date((listing as any).complianceActionAt).toISOString()
        : null,
      complianceOfficerId: (listing as any).complianceOfficerId ?? null,
      archivedAt: (listing as any).archivedAt
        ? new Date((listing as any).archivedAt).toISOString()
        : null,
      archiveReason: (listing as any).archiveReason ?? null,
      photos,
      documents,
      totalViews: listing.totalViews ?? 0,
      totalImpressions: listing.totalImpressions ?? 0,
      totalFavorites: listing.totalFavorites ?? 0,
      isFavorited,
      offersCount: listing._count?.offers ?? 0,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  /**
   * Seller accepts an active PENDING administrative price suggestion (FR-57, BR-13).
   * Atomically updates PriceSuggestion.status = ACCEPTED, updates Listing.askPrice = suggestedPrice,
   * increments Listing.version, and returns the listing to PENDING_REVIEW for moderation confirmation.
   */
  async acceptPriceSuggestion(
    listingId: string,
    suggestionId: string,
    userId: string,
    dto: RespondPriceSuggestionInput = {},
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: {
          select: {
            id: true,
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    if (listing.sellerProfile?.userId !== userId) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'غير مصرح لك بالرد على مقترح السعر؛ هذا الإعلان لا يتبع لحسابك',
      });
    }

    if (
      listing.status !== ListingStatus.PENDING_REVIEW &&
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: LISTING_INVALID_STATE_TRANSITION,
        message: `لا يمكن قبول مقترح السعر لأن حالة الإعلان الحالية هي ${listing.status}`,
      });
    }

    const suggestion = await this.prisma.priceSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion || suggestion.listingId !== listingId) {
      throw new NotFoundException({
        code: PRICE_SUGGESTION_NOT_FOUND,
        message: 'مقترح تعديل السعر المطلوب غير موجود أو لا يتبع لهذا الإعلان',
      });
    }

    if (suggestion.status !== PriceSuggestionStatus.PENDING) {
      throw new ConflictException({
        code: PRICE_SUGGESTION_ALREADY_RESPONDED,
        message: 'تم الرد على مقترح تعديل السعر مسبقاً أو تم استبداله بمقترح أحدث',
      });
    }

    const now = this.clockService.now();
    const sellerResponseNote = dto?.sellerResponseNote?.trim() || null;
    const previousAskPrice = Number(listing.askPrice);
    const newAskPrice = Number(suggestion.suggestedPrice);
    const previousStatus = listing.status;
    const newStatus = ListingStatus.PENDING_REVIEW;

    return this.prisma.$transaction(async (tx) => {
      const updatedSuggestion = await tx.priceSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: PriceSuggestionStatus.ACCEPTED,
          sellerResponseNote,
          respondedAt: now,
        },
      });

      const updatedListing = await tx.listing.update({
        where: { id: listingId },
        data: {
          askPrice: new Prisma.Decimal(newAskPrice),
          status: newStatus,
          version: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'LISTING_PRICE_SUGGESTION_ACCEPTED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            suggestionId,
            previousAskPrice,
            newAskPrice,
            previousStatus,
            newStatus,
            sellerResponseNote,
            respondedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(
        `Seller '${userId}' accepted price suggestion '${suggestionId}' on listing '${listingId}' (${previousAskPrice} -> ${newAskPrice} SAR, status: ${newStatus})`,
      );

      return {
        suggestion: this.mapPriceSuggestionItem(updatedSuggestion),
        listing: {
          id: updatedListing.id,
          askPrice: Number(updatedListing.askPrice),
          status: updatedListing.status,
          version: updatedListing.version,
        },
      };
    });
  }

  /**
   * Seller declines an active PENDING administrative price suggestion without penalty (FR-57).
   * Preserves Listing.askPrice and Listing.status completely unchanged.
   */
  async declinePriceSuggestion(
    listingId: string,
    suggestionId: string,
    userId: string,
    dto: RespondPriceSuggestionInput = {},
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: {
          select: {
            id: true,
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    if (listing.sellerProfile?.userId !== userId) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'غير مصرح لك بالرد على مقترح السعر؛ هذا الإعلان لا يتبع لحسابك',
      });
    }

    const suggestion = await this.prisma.priceSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion || suggestion.listingId !== listingId) {
      throw new NotFoundException({
        code: PRICE_SUGGESTION_NOT_FOUND,
        message: 'مقترح تعديل السعر المطلوب غير موجود أو لا يتبع لهذا الإعلان',
      });
    }

    if (suggestion.status !== PriceSuggestionStatus.PENDING) {
      throw new ConflictException({
        code: PRICE_SUGGESTION_ALREADY_RESPONDED,
        message: 'تم الرد على مقترح تعديل السعر مسبقاً أو تم استبداله بمقترح أحدث',
      });
    }

    const now = this.clockService.now();
    const sellerResponseNote = dto?.sellerResponseNote?.trim() || null;
    const preservedAskPrice = Number(listing.askPrice);
    const suggestedPrice = Number(suggestion.suggestedPrice);

    return this.prisma.$transaction(async (tx) => {
      const updatedSuggestion = await tx.priceSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: PriceSuggestionStatus.DECLINED,
          sellerResponseNote,
          respondedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'LISTING_PRICE_SUGGESTION_DECLINED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            suggestionId,
            preservedAskPrice,
            suggestedPrice,
            sellerResponseNote,
            respondedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(
        `Seller '${userId}' declined price suggestion '${suggestionId}' on listing '${listingId}' (preserved askPrice: ${preservedAskPrice} SAR)`,
      );

      return {
        suggestion: this.mapPriceSuggestionItem(updatedSuggestion),
        listing: {
          id: listing.id,
          askPrice: preservedAskPrice,
          status: listing.status,
          version: listing.version,
        },
      };
    });
  }

  /**
   * Uploads and stages a property media file or document through quarantine scanning.
   */
  async uploadMediaOrDocument(
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    userId: string,
    purpose: 'photo' | 'document' = 'photo',
  ): Promise<UploadListingMediaResponse> {
    if (!file) {
      throw new BadRequestException('الملف مطلوب للرفع');
    }

    if (file.size > MAX_LISTING_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت)`,
      );
    }

    const photoMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const docMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const allowedMimes = purpose === 'photo' ? photoMimes : docMimes;

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `نوع الملف غير مدعوم (${file.mimetype}). الأنواع المسموحة: ${allowedMimes.join(', ')}`,
      );
    }

    // 1. Stage in quarantine partition
    const staged = await this.quarantineService.stageFileForQuarantine({
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      buffer: file.buffer,
      userId,
    });

    // 2. Scan and promote clean file to operational listings partition
    const outcome = await this.quarantineService.scanAndProcess(
      staged.fileObjectId,
      'listings',
      { userId },
      userId,
    );

    if (!outcome.isClean) {
      throw new BadRequestException({
        code: LISTING_MALWARE_DETECTED,
        message: `تم اكتشاف تهديد أمني (${outcome.threatName || 'برمجية خبيثة'}) في الملف وتم حجزه بالعزل`,
      });
    }

    return {
      fileUrl: outcome.fileObject.key,
      key: outcome.fileObject.key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      scanStatus: outcome.fileObject.scanStatus,
    };
  }

  /**
   * Archives an authored listing when no longer available.
   * Enforces ownership, reserved status lock guard, active deal guard, and active offer guard.
   * Automatically withdraws open non-deal offers, clears claim locks, and writes audit log.
   */
  async archiveListing(
    listingId: string,
    userId: string,
    dto?: ArchiveListingInput,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: true,
        deals: true,
        offers: true,
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    // 1. Ownership Guard
    if (listing.sellerProfile?.userId !== userId) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'غير مصرح لك بأرشفة هذا الإعلان لعدم تطابق الملكية',
      });
    }

    // 2. Reserved Lock Guard
    if (listing.status === ListingStatus.RESERVED) {
      throw new ConflictException({
        code: LISTING_ARCHIVE_BLOCKED_RESERVED,
        message: 'لا يمكن أرشفة العقار المحجوز لوجود إجراءات صفقة جارية',
      });
    }

    if (listing.status === ListingStatus.BLOCKED) {
      throw new ConflictException({
        code: LISTING_PERMANENTLY_BLOCKED,
        message: 'لا يمكن أرشفة إعلان محظور نهائياً من قبل الامتثال والرقابة',
      });
    }

    if (listing.status === ListingStatus.SUSPENDED) {
      throw new ConflictException({
        code: LISTING_COMPLIANCE_SUSPENDED,
        message: 'لا يمكن أرشفة إعلان موقوف مؤقتاً من قبل الامتثال والرقابة',
      });
    }

    // 3. Active Deal Guard (non-terminal deals) — Story 5.1: the shared predicate.
    const activeDeals = listing.deals.filter((deal: any) =>
      ACTIVE_DEAL_STATUSES.includes(deal.status),
    );

    if (activeDeals.length > 0) {
      throw new ConflictException({
        code: LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL,
        message: 'لا يمكن أرشفة الإعلان لوجود صفقة بيع جارية ونشطة مرتبطة به',
      });
    }

    // 4. Active Unexpired Approved Offers Guard
    const now = this.clockService.now();
    // Story 4.2: the open-offer set is the shared constant, so every future status stays covered.
    const activeOffers = listing.offers.filter((offer: any) => {
      const isUnexpired = new Date(offer.expiresAt).getTime() > now.getTime();
      return isUnexpired && ACTIVE_OFFER_STATUSES.includes(offer.status as any);
    });

    if (activeOffers.length > 0) {
      throw new ConflictException({
        code: LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS,
        message: 'لا يمكن أرشفة الإعلان لوجود عروض شراء نشطة وغير منتهية الصلاحية قيد المراجعة أو مقبولة',
      });
    }

    // 5. Execute atomic transaction
    return this.prisma.$transaction(async (tx) => {
      const updatedListing = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ARCHIVED,
          version: { increment: 1 },
          archivedAt: now,
          archiveReason: dto?.reason || null,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      // Automatically withdraw outstanding open non-deal offers
      await tx.offer.updateMany({
        where: {
          listingId,
          status: { in: [...ACTIVE_OFFER_STATUSES] as any },
        },
        data: {
          status: OfferStatus.WITHDRAWN,
        },
      });

      // Immutable AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'LISTING_ARCHIVED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            previousStatus: listing.status,
            newStatus: ListingStatus.ARCHIVED,
            sellerUserId: userId,
            reason: dto?.reason ?? null,
            archivedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Listing '${listingId}' archived by seller '${userId}'`);
      return updatedListing;
    });
  }

  /**
   * Unarchives and reactivates an authored listing.
   * Enforces seller profile status, licensing, and compliance blocking rules.
   */
  async unarchiveListing(listingId: string, userId: string): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: {
          include: {
            falLicense: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    // 1. Ownership Guard
    if (listing.sellerProfile?.userId !== userId) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'غير مصرح لك بإلغاء أرشفة هذا الإعلان لعدم تطابق الملكية',
      });
    }

    // 2. Listing is currently in ARCHIVED status
    if (listing.status === ListingStatus.BLOCKED) {
      throw new ConflictException({
        code: LISTING_PERMANENTLY_BLOCKED,
        message: 'لا يمكن تنشيط إعلان محظور نهائياً بموجب قرار الامتثال',
      });
    }
    if (listing.status === ListingStatus.SUSPENDED) {
      throw new ConflictException({
        code: LISTING_COMPLIANCE_SUSPENDED,
        message: 'لا يمكن تنشيط إعلان موقوف بموجب قرار الامتثال والرقابة',
      });
    }
    if (listing.status !== ListingStatus.ARCHIVED) {
      throw new BadRequestException({
        code: LISTING_NOT_ARCHIVED,
        message: 'الإعلان ليس في حالة مؤرشفة لتتم إعادة تنشيطه',
      });
    }

    // 3. Seller Profile Good Standing Guard
    const profile = listing.sellerProfile;
    if (!profile || profile.status !== ProfileStatus.ACTIVE) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'الملف التعريفي للبائع غير نشط أو مقيد ولا يمكن تنشيط الإعلان',
      });
    }

    if (profile.role === UserRole.MARKETER && !profile.falLicense) {
      throw new ForbiddenException({
        code: LISTING_FAL_LICENSE_REQUIRED,
        message: 'يلزم وجود رخصة فال سارية لإلغاء أرشفة وتنشيط الإعلان',
      });
    }

    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx) => {
      const updatedListing = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
          archivedAt: null,
          archiveReason: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'LISTING_UNARCHIVED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            previousStatus: ListingStatus.ARCHIVED,
            newStatus: ListingStatus.ACTIVE,
            sellerUserId: userId,
            unarchivedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Listing '${listingId}' unarchived and reactivated by seller '${userId}'`);
      return updatedListing;
    });
  }

  /**
   * Asynchronously ingests engagement event batches (impressions and detail views).
   * Aggregates events per listing per day (truncated to midnight UTC), updates
   * ListingDailyMetric and increments lifetime counters on Listing.
   * Adheres strictly to Saudi PDPL: no visitor identifiers or IP addresses stored.
   */
  async recordBatchEngagement(
    dto: BatchListingEngagementInput,
  ): Promise<{ processed: number }> {
    if (!dto.events || dto.events.length === 0) {
      return { processed: 0 };
    }

    const now = this.clockService.now();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const aggregates: Record<
      string,
      { impressions: number; detailViews: number }
    > = {};

    for (const event of dto.events) {
      if (!aggregates[event.listingId]) {
        aggregates[event.listingId] = { impressions: 0, detailViews: 0 };
      }
      const count = event.count ?? 1;
      if (event.eventType === ListingEngagementEventType.IMPRESSION) {
        aggregates[event.listingId].impressions += count;
      } else if (event.eventType === ListingEngagementEventType.DETAIL_VIEW) {
        aggregates[event.listingId].detailViews += count;
      }
    }

    const listingIds = Object.keys(aggregates);
    const existingListings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true },
    });
    const validListingIdSet = new Set(existingListings.map((l: any) => l.id));

    for (const listingId of listingIds) {
      if (!validListingIdSet.has(listingId)) {
        continue;
      }
      const { impressions, detailViews } = aggregates[listingId];
      try {
        await this.prisma.$transaction(async (tx: any) => {
          await tx.listingDailyMetric.upsert({
            where: {
              listingId_date: {
                listingId,
                date: todayUtc,
              },
            },
            create: {
              listingId,
              date: todayUtc,
              impressions,
              detailViews,
              favoriteAdds: 0,
            },
            update: {
              impressions: { increment: impressions },
              detailViews: { increment: detailViews },
            },
          });

          await tx.listing.update({
            where: { id: listingId },
            data: {
              totalImpressions: { increment: impressions },
              totalViews: { increment: detailViews },
            },
          });
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to record engagement for listing ${listingId}: ${err?.message}`,
        );
      }
    }

    return { processed: dto.events.length };
  }

  /**
   * Toggles bookmark favorite for an authenticated user on a target listing.
   * Atomically creates/deletes ListingFavorite, updates Listing.totalFavorites,
   * and increments favoriteAdds in ListingDailyMetric on add.
   */
  async toggleFavorite(
    listingId: string,
    userId: string,
  ): Promise<{ isFavorited: boolean; totalFavorites: number }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, totalFavorites: true },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    return this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.listingFavorite.findUnique({
        where: {
          userId_listingId: {
            userId,
            listingId,
          },
        },
      });

      if (existing) {
        await tx.listingFavorite.delete({
          where: { id: existing.id },
        });

        const newTotal = Math.max(0, (listing.totalFavorites ?? 1) - 1);
        await tx.listing.update({
          where: { id: listingId },
          data: { totalFavorites: newTotal },
        });

        return { isFavorited: false, totalFavorites: newTotal };
      } else {
        const count = await tx.listingFavorite.count({ where: { userId } });
        if (count >= MAX_FAVORITES_PER_USER) {
          throw new ConflictException({
            code: FAVORITES_LIMIT_REACHED,
            message:
              'لقد بلغت الحد الأقصى للمفضلة (100 عقار). إزالة عقار آخر للإضافة.',
          });
        }

        await tx.listingFavorite.create({
          data: {
            userId,
            listingId,
            createdAt: this.clockService.now(),
          },
        });

        const updatedListing = await tx.listing.update({
          where: { id: listingId },
          data: { totalFavorites: { increment: 1 } },
          select: { totalFavorites: true },
        });

        const now = this.clockService.now();
        const todayUtc = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );

        await tx.listingDailyMetric.upsert({
          where: {
            listingId_date: {
              listingId,
              date: todayUtc,
            },
          },
          create: {
            listingId,
            date: todayUtc,
            impressions: 0,
            detailViews: 0,
            favoriteAdds: 1,
          },
          update: {
            favoriteAdds: { increment: 1 },
          },
        });

        return {
          isFavorited: true,
          totalFavorites: updatedListing.totalFavorites,
        };
      }
    });
  }

  /**
   * Retrieves comprehensive engagement analytics and conversion rates for an authored listing.
   * Accessible by the authenticated listing seller or an authorized administrator.
   */
  async getListingAnalytics(
    listingId: string,
    userId: string,
    days = 30,
    isAdmin = false,
  ): Promise<ListingAnalyticsSummary> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: {
          select: { userId: true },
        },
        _count: {
          select: { offers: true },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    if (!isAdmin && listing.sellerProfile?.userId !== userId) {
      throw new ForbiddenException({
        code: LISTING_ROLE_UNAUTHORIZED,
        message: 'غير مصرح لك باستعراض إحصائيات هذا الإعلان',
      });
    }

    const now = this.clockService.now();
    const startDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (days - 1),
      ),
    );

    const dailyMetrics = await this.prisma.listingDailyMetric.findMany({
      where: {
        listingId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const mappedDaily = dailyMetrics.map((m: any) => ({
      date:
        m.date instanceof Date
          ? m.date.toISOString().split('T')[0]
          : String(m.date).split('T')[0],
      impressions: m.impressions,
      detailViews: m.detailViews,
      favoriteAdds: m.favoriteAdds,
    }));

    const offersCount = listing._count?.offers ?? 0;
    const conversionRatio =
      listing.totalViews > 0
        ? Number(((offersCount / listing.totalViews) * 100).toFixed(2))
        : 0;

    return {
      listingId: listing.id,
      totalViews: listing.totalViews ?? 0,
      totalImpressions: listing.totalImpressions ?? 0,
      totalFavorites: listing.totalFavorites ?? 0,
      offersCount,
      conversionRatio,
      dailyMetrics: mappedDaily,
    };
  }
}
