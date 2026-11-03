import {
  Injectable,
  Logger,
  BadRequestException,
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
  DocumentVisibility,
  ScanStatus,
  LISTING_NOT_FOUND,
  LISTING_MARKETER_AUTH_DOC_REQUIRED,
  LISTING_OWNER_DEED_REQUIRED,
  LISTING_FAL_LICENSE_REQUIRED,
  LISTING_INVALID_IBAN,
  LISTING_MALWARE_DETECTED,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
  MAX_LISTING_FILE_SIZE_BYTES,
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
  async getPublicActiveListings(limit = 24): Promise<any> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(limit) || 24)),
      include: {
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
      },
    });

    const items = await Promise.all(
      listings.map(async (listing: any) => {
        const photos = Array.isArray(listing.documents) ? listing.documents : [];
        let primaryPhotoUrl: string | null = null;
        if (photos.length > 0 && photos[0].fileUrl) {
          try {
            primaryPhotoUrl = await this.storageService.getPresignedDownloadUrl(
              photos[0].fileUrl,
              300,
            );
          } catch {
            primaryPhotoUrl = photos[0].fileUrl;
          }
        }

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
          sellerRole: listing.sellerProfile?.role || UserRole.OWNER,
          photoCount: photos.length,
          primaryPhotoUrl,
          createdAt: listing.createdAt,
        };
      }),
    );

    return { items };
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
        sellerProfile: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    const items = await Promise.all(
      listings.map(async (listing: any) => {
        const docs = Array.isArray(listing.documents) ? listing.documents : [];
        const photos = docs.filter((d: any) => d.documentType === 'PHOTO');
        const legalDocs = docs.filter((d: any) => d.documentType !== 'PHOTO');
        let primaryPhotoUrl: string | null = null;
        if (photos.length > 0 && photos[0].fileUrl) {
          try {
            primaryPhotoUrl = await this.storageService.getPresignedDownloadUrl(
              photos[0].fileUrl,
              300,
            );
          } catch {
            primaryPhotoUrl = photos[0].fileUrl;
          }
        }

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
          status: listing.status,
          rejectionReason: (listing as any).rejectionReason ?? null,
          reviewedAt: (listing as any).reviewedAt ?? null,
          sellerRole: listing.sellerProfile?.role || UserRole.OWNER,
          photoCount: photos.length,
          documentCount: legalDocs.length,
          primaryPhotoUrl,
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
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${id}' غير موجود`,
      });
    }

    const isSeller = Boolean(
      requesterUserId && listing.sellerProfile?.userId === requesterUserId,
    );
    const canViewPrivate = isSeller || requesterIsAdmin;

    // Filter documents based on visibility permissions
    let documentsToReturn = listing.documents;
    if (!canViewPrivate) {
      // Public visitors & buyers: only see PUBLIC documents
      documentsToReturn = listing.documents.filter(
        (doc: any) => doc.visibility === DocumentVisibility.PUBLIC,
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
      ...(canViewPrivate ? { payoutIban: listing.payoutIban } : {}),
      version: listing.version,
      photos,
      documents,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
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
}
