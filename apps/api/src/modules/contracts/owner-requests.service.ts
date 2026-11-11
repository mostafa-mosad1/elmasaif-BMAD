import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserRole,
  ListingStatus,
  OwnerListingRequestStatus,
  OwnerContractStatus,
  DocumentVisibility,
  ScanStatus,
  AUTH_NOT_AUTHORIZED,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
  OWNER_REQUEST_NOT_FOUND,
  OWNER_REQUEST_PAYOUT_IBAN_NOT_OWNED,
  type CreateOwnerListingRequestInput,
  type OwnerListingRequestItem,
} from '@elmasaif/shared';

@Injectable()
export class OwnerRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createListingRequest(userId: string, dto: CreateOwnerListingRequestInput) {
    // 1. Verify user has an active OWNER profile
    const ownerProfile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        role: UserRole.OWNER,
        status: 'ACTIVE',
      },
    });

    if (!ownerProfile) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'يجب أن يكون لديك ملف مالك عقار نشط لتقديم طلب الإدراج',
      });
    }

    // 2. Validate payout IBAN ownership
    const cleanIban = dto.payoutIban.replace(/\s+/g, '').toUpperCase();
    const last4 = cleanIban.slice(-4);
    const registeredPayout = await this.prisma.payoutAccount.findFirst({
      where: {
        profileId: ownerProfile.id,
        OR: [
          { ibanMasked: { contains: last4 } },
          { ibanLast4: last4 },
        ],
      },
    });

    if (!registeredPayout) {
      throw new BadRequestException({
        code: OWNER_REQUEST_PAYOUT_IBAN_NOT_OWNED,
        message: 'رقم الآيبان المحدد غير مرتبط بحسابات الصرف المسجلة في ملف المالك الشخصي',
      });
    }

    // 3. Verify City and District exist and are active
    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, isActive: true },
    });
    if (!city) {
      throw new BadRequestException({
        code: GEO_CITY_INACTIVE,
        message: 'المدينة المحددة غير موجودة أو غير مفعلة',
      });
    }

    const district = await this.prisma.district.findFirst({
      where: { id: dto.districtId, cityId: dto.cityId, isActive: true },
    });
    if (!district) {
      throw new BadRequestException({
        code: GEO_DISTRICT_INACTIVE,
        message: 'الحي المحدد غير موجود أو غير مفعل أو لا يتبع المدينة المحددة',
      });
    }

    // 4. Atomically create Listing, OwnerListingRequest, PropertyDocuments, and AuditLog
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          title: dto.title,
          description: dto.description,
          propertyType: dto.propertyType,
          cityId: dto.cityId,
          districtId: dto.districtId,
          streetName: dto.streetName ?? null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          askPrice: dto.askPrice,
          areaSquareMeters: dto.areaSquareMeters,
          bedrooms: dto.bedrooms ?? null,
          yearBuilt: dto.yearBuilt ?? null,
          status: ListingStatus.PENDING_REVIEW,
          sellerProfileId: ownerProfile.id,
          payoutIban: cleanIban,
        },
      });

      // Prepare photo and legal documents
      const photoDocs = dto.photos.map((photo) => ({
        listingId: listing.id,
        documentType: 'PHOTO',
        fileUrl: photo.fileUrl,
        mimeType: photo.mimeType,
        fileSize: photo.fileSize,
        visibility: DocumentVisibility.PUBLIC,
        scanStatus: ScanStatus.CLEAN,
      }));

      const legalDocs = dto.documents.map((doc) => ({
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

      const ownerRequest = await tx.ownerListingRequest.create({
        data: {
          ownerProfileId: ownerProfile.id,
          listingId: listing.id,
          propertyType: dto.propertyType,
          cityId: dto.cityId,
          districtId: dto.districtId,
          titleDeedNumber: dto.titleDeedNumber,
          status: OwnerListingRequestStatus.PENDING,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'OWNER_LISTING_REQUEST_CREATED',
          entityType: 'OwnerListingRequest',
          entityId: ownerRequest.id,
          payload: {
            listingId: listing.id,
            propertyTitle: listing.title,
            askPrice: Number(listing.askPrice),
            cityId: listing.cityId,
            districtId: listing.districtId,
          },
        },
      });

      return {
        id: ownerRequest.id,
        listingId: listing.id,
        status: ownerRequest.status,
        propertyTitle: listing.title,
        propertyType: listing.propertyType,
        cityName: city.nameAr,
        districtName: district.nameAr,
        askPrice: Number(listing.askPrice),
        createdAt: ownerRequest.createdAt.toISOString(),
      };
    });
  }

  async getMyListingRequests(userId: string): Promise<OwnerListingRequestItem[]> {
    const ownerProfile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        role: UserRole.OWNER,
      },
    });

    if (!ownerProfile) {
      return [];
    }

    const requests = await this.prisma.ownerListingRequest.findMany({
      where: { ownerProfileId: ownerProfile.id },
      include: {
        listing: {
          include: {
            city: true,
            district: true,
            ownerContract: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      listingId: req.listingId,
      propertyTitle: req.listing?.title ?? '',
      propertyType: req.propertyType as any,
      cityName: req.listing?.city?.nameAr ?? '',
      districtName: req.listing?.district?.nameAr ?? '',
      askPrice: Number(req.listing?.askPrice ?? 0),
      status: req.status as OwnerListingRequestStatus,
      rejectionReason: req.rejectionReason,
      modificationNotes: req.modificationNotes,
      createdAt: req.createdAt.toISOString(),
      contractId: req.listing?.ownerContract?.id ?? null,
      contractStatus: (req.listing?.ownerContract?.status as unknown as OwnerContractStatus) ?? null,
    }));
  }

  async getListingRequestDetail(userId: string, id: string) {
    const ownerProfile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        role: UserRole.OWNER,
      },
    });

    if (!ownerProfile) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول إلى هذا الطلب',
      });
    }

    const request = await this.prisma.ownerListingRequest.findFirst({
      where: {
        id,
        ownerProfileId: ownerProfile.id,
      },
      include: {
        listing: {
          include: {
            city: true,
            district: true,
            documents: true,
            ownerContract: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب الإدراج غير موجود',
      });
    }

    return {
      id: request.id,
      listingId: request.listingId,
      propertyTitle: request.listing?.title ?? '',
      propertyType: request.propertyType,
      cityName: request.listing?.city?.nameAr ?? '',
      districtName: request.listing?.district?.nameAr ?? '',
      askPrice: Number(request.listing?.askPrice ?? 0),
      status: request.status as OwnerListingRequestStatus,
      rejectionReason: request.rejectionReason,
      modificationNotes: request.modificationNotes,
      createdAt: request.createdAt.toISOString(),
      documents: request.listing?.documents ?? [],
      contract: request.listing?.ownerContract
        ? {
            id: request.listing.ownerContract.id,
            status: request.listing.ownerContract.status as unknown as OwnerContractStatus,
            contractFee: Number(request.listing.ownerContract.contractFee),
            expiresAt: request.listing.ownerContract.expiresAt.toISOString(),
          }
        : null,
    };
  }
}
