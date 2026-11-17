import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  CmsPageDto,
  AnnouncementBannerDto,
  FaqItemDto,
  UpsertCmsPageInput,
  UpsertBannerInput,
  UpsertFaqItemInput,
  CmsPageCategory,
  AnnouncementBannerType,
  FaqCategory,
  AUDIT_ACTION_CMS_PAGE_UPDATED,
  AUDIT_ACTION_BANNER_SAVED,
  AUDIT_ACTION_BANNER_DELETED,
  AUDIT_ACTION_FAQ_SAVED,
  AUDIT_ACTION_FAQ_DELETED,
} from '@elmasaif/shared';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly clockService: ClockService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Public CMS Endpoints
  // ─────────────────────────────────────────────────────────────

  async getPublishedPageBySlug(slug: string): Promise<CmsPageDto> {
    const page = await this.prisma.cmsPage.findUnique({
      where: { slug },
      include: {
        authorAdmin: {
          select: { fullName: true },
        },
      },
    });

    if (!page || !page.isPublished) {
      throw new NotFoundException(`الصفحة المطلوبة (${slug}) غير متوفرة أو غير منشورة`);
    }

    return this.mapPageToDto(page);
  }

  async getActiveBanners(): Promise<AnnouncementBannerDto[]> {
    const now = this.clockService.now();

    const banners = await this.prisma.announcementBanner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return banners.map((b) => this.mapBannerToDto(b));
  }

  async getPublishedFaq(): Promise<FaqItemDto[]> {
    const items = await this.prisma.faqItem.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((f) => this.mapFaqToDto(f));
  }

  // ─────────────────────────────────────────────────────────────
  // Administrative CMS Operations
  // ─────────────────────────────────────────────────────────────

  async getAllPages(): Promise<CmsPageDto[]> {
    const pages = await this.prisma.cmsPage.findMany({
      orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }],
      include: {
        authorAdmin: {
          select: { fullName: true },
        },
      },
    });

    return pages.map((p) => this.mapPageToDto(p));
  }

  async upsertCmsPage(adminId: string, input: UpsertCmsPageInput): Promise<CmsPageDto> {
    const now = this.clockService.now();

    const page = await this.prisma.cmsPage.upsert({
      where: { slug: input.slug },
      create: {
        slug: input.slug,
        title: input.title,
        category: input.category,
        content: input.content,
        summary: input.summary ?? null,
        isPublished: input.isPublished,
        displayOrder: input.displayOrder ?? 0,
        publishedAt: input.isPublished ? now : null,
        authorAdminId: adminId,
      },
      update: {
        title: input.title,
        category: input.category,
        content: input.content,
        summary: input.summary ?? null,
        isPublished: input.isPublished,
        displayOrder: input.displayOrder ?? 0,
        publishedAt: input.isPublished ? now : null,
        authorAdminId: adminId,
      },
      include: {
        authorAdmin: {
          select: { fullName: true },
        },
      },
    });

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_CMS_PAGE_UPDATED,
      entityType: 'CmsPage',
      entityId: page.id,
      justificationReason: `تحديث صفحة المحتوى الثابت: ${page.title}`,
      metadata: {
        slug: page.slug,
        isPublished: page.isPublished,
      },
    });

    return this.mapPageToDto(page);
  }

  async getAllBanners(): Promise<AnnouncementBannerDto[]> {
    const banners = await this.prisma.announcementBanner.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return banners.map((b) => this.mapBannerToDto(b));
  }

  async createOrUpdateBanner(
    adminId: string,
    input: UpsertBannerInput,
    id?: string,
  ): Promise<AnnouncementBannerDto> {
    let banner: any;

    if (id) {
      banner = await this.prisma.announcementBanner.update({
        where: { id },
        data: {
          title: input.title,
          content: input.content,
          bannerType: input.bannerType,
          isActive: input.isActive,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          actionUrl: input.actionUrl ?? null,
          actionText: input.actionText ?? null,
        },
      });
    } else {
      banner = await this.prisma.announcementBanner.create({
        data: {
          title: input.title,
          content: input.content,
          bannerType: input.bannerType,
          isActive: input.isActive,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          actionUrl: input.actionUrl ?? null,
          actionText: input.actionText ?? null,
          createdByAdminId: adminId,
        },
      });
    }

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_BANNER_SAVED,
      entityType: 'AnnouncementBanner',
      entityId: banner.id,
      justificationReason: `حفظ شريط الإعلانات: ${banner.title}`,
      metadata: {
        bannerType: banner.bannerType,
        isActive: banner.isActive,
      },
    });

    return this.mapBannerToDto(banner);
  }

  async deleteBanner(adminId: string, id: string): Promise<void> {
    const banner = await this.prisma.announcementBanner.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException('شريط الإعلانات غير موجود');
    }

    await this.prisma.announcementBanner.delete({ where: { id } });

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_BANNER_DELETED,
      entityType: 'AnnouncementBanner',
      entityId: id,
      justificationReason: `حذف شريط الإعلانات: ${banner.title}`,
    });
  }

  async getAllFaq(): Promise<FaqItemDto[]> {
    const items = await this.prisma.faqItem.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((f) => this.mapFaqToDto(f));
  }

  async createOrUpdateFaq(
    adminId: string,
    input: UpsertFaqItemInput,
    id?: string,
  ): Promise<FaqItemDto> {
    let item: any;

    if (id) {
      item = await this.prisma.faqItem.update({
        where: { id },
        data: {
          questionAr: input.questionAr,
          answerAr: input.answerAr,
          questionEn: input.questionEn ?? null,
          answerEn: input.answerEn ?? null,
          category: input.category,
          displayOrder: input.displayOrder,
          isPublished: input.isPublished,
        },
      });
    } else {
      item = await this.prisma.faqItem.create({
        data: {
          questionAr: input.questionAr,
          answerAr: input.answerAr,
          questionEn: input.questionEn ?? null,
          answerEn: input.answerEn ?? null,
          category: input.category,
          displayOrder: input.displayOrder,
          isPublished: input.isPublished,
        },
      });
    }

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_FAQ_SAVED,
      entityType: 'FaqItem',
      entityId: item.id,
      justificationReason: `حفظ سؤال شائع: ${item.questionAr}`,
      metadata: {
        category: item.category,
        displayOrder: item.displayOrder,
        isPublished: item.isPublished,
      },
    });

    return this.mapFaqToDto(item);
  }

  async deleteFaq(adminId: string, id: string): Promise<void> {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('السؤال الشائع غير موجود');
    }

    await this.prisma.faqItem.delete({ where: { id } });

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_FAQ_DELETED,
      entityType: 'FaqItem',
      entityId: id,
      justificationReason: `حذف سؤال شائع: ${item.questionAr}`,
    });
  }

  async seedDefaultCmsData(): Promise<void> {
    const defaultPages = [
      {
        slug: 'terms-of-service',
        title: 'الشروط والأحكام',
        category: CmsPageCategory.LEGAL_TERMS,
        content: `# الشروط والأحكام لمنصة المصايف العقارية

أهلاً بكم في منصة المصايف العقارية المتوافقة مع تشريعات الهيئة العامة للعقار بالمملكة العربية السعودية ونظام حماية البيانات الشخصية (PDPL).

## 1. الأهلية والترخيص
- يلتزم الوسطاء العقاريون بتقديم رخصة فال العقارية سارية المفعول.
- تخضع كافة التعاملات للوساطة الآمنة عبر حسابات التحصيل البنكية المعتمدة.

## 2. العمولات والرسوم
- عمولة المنصة محددة بنسبة 2.5% على الصفقات المكتملة مضافاً إليها ضريبة القيمة المضافة 15%.
- رسوم خدمة توثيق عقود المالك 1,000 ريال سعودي غير قابلة للاسترداد بعد تقديم الخدمة.`,
        summary: 'شروط الاستخدام والوساطة العقارية المعتمدة وفق الأنظمة السعودية',
        isPublished: true,
        displayOrder: 1,
      },
      {
        slug: 'privacy-policy',
        title: 'سياسة الخصوصية وحماية البيانات',
        category: CmsPageCategory.PRIVACY_POLICY,
        content: `# سياسة الخصوصية - منصة المصايف

تلتزم منصة المصايف بحماية خصوصية المستخدمين وبياناتهم الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي (PDPL).

## 1. جمع البيانات ومعالجتها
نجمع البيانات الأساسية اللازمة للتحقق من الهوية الوطنية (عبر مركز المعلومات الوطني/نفاذ) ورخص فال العقارية لضمان الموثوقية والأمان.

## 2. حقوق صاحب البيانات
- الحق في الاطلاع وتعديل البيانات.
- الحق في طلب الحذف مع فترة تبريد نظامية مدتها 14 يوماً.`,
        summary: 'سياسة الامتثال لنظام حماية البيانات الشخصية السعودي PDPL',
        isPublished: true,
        displayOrder: 2,
      },
      {
        slug: 'marketer-guide',
        title: 'دليل الوسيط والمسوق العقاري',
        category: CmsPageCategory.GUIDE,
        content: `# دليل الوسيط العقاري المرخص

يوضح هذا الدليل خطوات ربط رخصة فال وإدارة العروض والطلبات العقارية وتوثيق الصفقات المكتملة وحساب العمولات.`,
        summary: 'دليل شامل للوسطاء والمسوقين العقاريين على المنصة',
        isPublished: true,
        displayOrder: 3,
      },
      {
        slug: 'buyer-guide',
        title: 'دليل المشتري والمستثمر',
        category: CmsPageCategory.GUIDE,
        content: `# دليل المشتري والمستثمر

تعرف على كيفية البحث عبر الخريطة التفاعلية، تقديم العروض، إتمام التحويلات البنكية بأمان تام خلال نافذة الـ 48 ساعة واستلام بيانات التواصل الموثقة.`,
        summary: 'خطوات الشراء والتعامل الآمن عبر منصة المصايف',
        isPublished: true,
        displayOrder: 4,
      },
      {
        slug: 'rega-licenses',
        title: 'تراخيص وامتثال الهيئة العامة للعقار (فال)',
        category: CmsPageCategory.LEGAL_TERMS,
        content: `# تراخيص وامتثال الهيئة العامة للعقار (REGA)

منصة المصايف معتمدة ومتوافقة بالكامل مع اشتراطات الهيئة العامة للعقار بالمملكة العربية السعودية، ونظام الوساطة العقارية ولائحته التنفيذية.

## تراخيص فال المعتمدة:
- رخصة فال للوساطة والتسويق العقاري.
- التزام تام بالأنظمة واللوائح والربط الإلكتروني المعتمد.
- عقود وساطة إلكترونية موثقة لحفظ حقوق كافة الأطراف.`,
        summary: 'بيانات الامتثال والربط النظامي مع الهيئة العامة للعقار ورخص فال',
        isPublished: true,
        displayOrder: 5,
      },
      {
        slug: 'brokerage-contracts',
        title: 'عقود الوساطة العقارية المعتمدة',
        category: CmsPageCategory.LEGAL_TERMS,
        content: `# عقود الوساطة العقارية المعتمدة

تعتمد منصة المصايف نماذج عقود الوساطة الإلكترونية المعتمدة من الهيئة العامة للعقار وفق نظام الوساطة العقارية.

## أنواع العقود المتاحة:
- عقد وساطة تسويق عقاري بين المالك والوسيط.
- عقد وساطة شراء وبحث عن عقار.
- إقرارات ووثائق المعاينة والاتفاقيات النظامية المعتمدة.`,
        summary: 'دليل ومعلومات عقود الوساطة العقارية المعتمدة والمطابقة لأنظمة الهيئة العامة للعقار',
        isPublished: true,
        displayOrder: 6,
      },
    ];

    for (const p of defaultPages) {
      await this.prisma.cmsPage.upsert({
        where: { slug: p.slug },
        create: p,
        update: {},
      });
    }

    const defaultFaqs = [
      {
        questionAr: 'كيف تضمن المنصة حقوق الأطراف في الصفقات العقارية؟',
        answerAr: 'تستخدم المنصة نظام وساطة آمن يعتمد على تجميد أسعار الصفقات، التحقق من إيصالات التحويل البنكي عبر فريق التدقيق المالي، وعدم الإفراج عن معلومات التواصل إلا بعد اكتمال التحقق المالي وتوقيع العقود.',
        category: FaqCategory.GENERAL,
        displayOrder: 1,
        isPublished: true,
      },
      {
        questionAr: 'ما هي شروط عمل الوسيط العقاري في المنصة؟',
        answerAr: 'يجب أن يكون لدى الوسيط رخصة فال عقارية سارية المفعول مسجلة لدى الهيئة العامة للعقار ويتم التحقق منها إدارياً وتجديدها دورياً.',
        category: FaqCategory.MARKETER,
        displayOrder: 2,
        isPublished: true,
      },
      {
        questionAr: 'كم تبلغ عمولة المنصة وكيف يتم سدادها؟',
        answerAr: 'تبلغ عمولة المنصة 2.5% على الصفقات المكتملة مضافاً إليها ضريبة القيمة المضافة 15%، ويتم سدادها عبر الحساب البنكي المعتمد للمنصة خلال نافذة السداد المحددة (48 ساعة).',
        category: FaqCategory.DEALS,
        displayOrder: 3,
        isPublished: true,
      },
    ];

    for (const f of defaultFaqs) {
      const existing = await this.prisma.faqItem.findFirst({
        where: { questionAr: f.questionAr },
      });
      if (!existing) {
        await this.prisma.faqItem.create({ data: f });
      }
    }
  }

  private mapPageToDto(page: any): CmsPageDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      category: page.category as CmsPageCategory,
      content: page.content,
      summary: page.summary ?? null,
      isPublished: page.isPublished,
      displayOrder: page.displayOrder,
      publishedAt: page.publishedAt?.toISOString?.() ?? (page.publishedAt ? String(page.publishedAt) : null),
      authorAdminId: page.authorAdminId ?? null,
      authorAdminName: page.authorAdmin?.fullName ?? null,
      createdAt: page.createdAt?.toISOString?.() ?? String(page.createdAt),
      updatedAt: page.updatedAt?.toISOString?.() ?? String(page.updatedAt),
    };
  }

  private mapBannerToDto(b: any): AnnouncementBannerDto {
    return {
      id: b.id,
      title: b.title,
      content: b.content,
      bannerType: b.bannerType as AnnouncementBannerType,
      isActive: b.isActive,
      startAt: b.startAt?.toISOString?.() ?? (b.startAt ? String(b.startAt) : null),
      endAt: b.endAt?.toISOString?.() ?? (b.endAt ? String(b.endAt) : null),
      actionUrl: b.actionUrl ?? null,
      actionText: b.actionText ?? null,
      createdByAdminId: b.createdByAdminId ?? null,
      createdAt: b.createdAt?.toISOString?.() ?? String(b.createdAt),
      updatedAt: b.updatedAt?.toISOString?.() ?? String(b.updatedAt),
    };
  }

  private mapFaqToDto(f: any): FaqItemDto {
    return {
      id: f.id,
      questionAr: f.questionAr,
      answerAr: f.answerAr,
      questionEn: f.questionEn ?? null,
      answerEn: f.answerEn ?? null,
      category: f.category as FaqCategory,
      displayOrder: f.displayOrder,
      isPublished: f.isPublished,
      createdAt: f.createdAt?.toISOString?.() ?? String(f.createdAt),
      updatedAt: f.updatedAt?.toISOString?.() ?? String(f.updatedAt),
    };
  }
}

