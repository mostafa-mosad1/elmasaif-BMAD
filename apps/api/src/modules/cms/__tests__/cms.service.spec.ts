import { Test, TestingModule } from '@nestjs/testing';
import { CmsService } from '../cms.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  CmsPageCategory,
  AnnouncementBannerType,
  FaqCategory,
  AUDIT_ACTION_CMS_PAGE_UPDATED,
  AUDIT_ACTION_BANNER_SAVED,
} from '@elmasaif/shared';
import { NotFoundException } from '@nestjs/common';

describe('CmsService', () => {
  let service: CmsService;
  let prisma: any;
  let auditService: any;
  let clockService: any;

  const mockAdminId = 'adm-00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      cmsPage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      announcementBanner: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      faqItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date('2026-11-15T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<CmsService>(CmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublishedPageBySlug', () => {
    it('should return published page dto when found and isPublished is true', async () => {
      prisma.cmsPage.findUnique.mockResolvedValueOnce({
        id: 'page-1',
        slug: 'terms-of-service',
        title: 'شروط الخدمة',
        category: CmsPageCategory.LEGAL_TERMS,
        content: 'نص الشروط والأحكام...',
        isPublished: true,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const page = await service.getPublishedPageBySlug('terms-of-service');
      expect(page.slug).toBe('terms-of-service');
      expect(page.title).toBe('شروط الخدمة');
    });

    it('should throw NotFoundException if page is not found or isPublished is false', async () => {
      prisma.cmsPage.findUnique.mockResolvedValueOnce(null);
      await expect(service.getPublishedPageBySlug('unknown')).rejects.toThrow(NotFoundException);

      prisma.cmsPage.findUnique.mockResolvedValueOnce({
        slug: 'draft-page',
        isPublished: false,
      });
      await expect(service.getPublishedPageBySlug('draft-page')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveBanners', () => {
    it('should return active banners within valid scheduling window', async () => {
      prisma.announcementBanner.findMany.mockResolvedValueOnce([
        {
          id: 'banner-1',
          title: 'صيانة المنصة',
          content: 'صيانة دورية مجدولة',
          bannerType: AnnouncementBannerType.INFO,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const banners = await service.getActiveBanners();
      expect(banners.length).toBe(1);
      expect(banners[0].title).toBe('صيانة المنصة');
    });
  });

  describe('upsertCmsPage', () => {
    it('should upsert page and record audit log', async () => {
      prisma.cmsPage.upsert.mockResolvedValueOnce({
        id: 'page-1',
        slug: 'privacy-policy',
        title: 'سياسة الخصوصية',
        category: CmsPageCategory.PRIVACY_POLICY,
        content: 'سياسة حماية البيانات والخصوصية...',
        isPublished: true,
        displayOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.upsertCmsPage(mockAdminId, {
        slug: 'privacy-policy',
        title: 'سياسة الخصوصية',
        category: CmsPageCategory.PRIVACY_POLICY,
        content: 'سياسة حماية البيانات والخصوصية...',
        isPublished: true,
        displayOrder: 2,
      });

      expect(result.slug).toBe('privacy-policy');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_CMS_PAGE_UPDATED,
        }),
      );
    });
  });
});

