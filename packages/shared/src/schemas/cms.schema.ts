import { z } from 'zod';
import { CmsPageCategory, AnnouncementBannerType, FaqCategory } from '../enums/cms';

export const upsertCmsPageSchema = z.object({
  slug: z
    .string()
    .min(3, 'الرابط الدائم يجب ألا يقل عن 3 أحرف')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'الرابط الدائم يجب أن يتكون من أحرف صغيرة وأرقام وشرطات فقط'),
  title: z.string().min(3, 'العنوان يجب ألا يقل عن 3 أحرف'),
  category: z.nativeEnum(CmsPageCategory),
  content: z.string().min(10, 'المحتوى يجب ألا يقل عن 10 أحرف'),
  summary: z.string().optional().nullable(),
  isPublished: z.boolean().default(true),
  displayOrder: z.coerce.number().int().default(0),
});

export const upsertBannerSchema = z.object({
  title: z.string().min(3, 'العنوان يجب ألا يقل عن 3 أحرف'),
  content: z.string().min(5, 'المحتوى يجب ألا يقل عن 5 أحرف'),
  bannerType: z.nativeEnum(AnnouncementBannerType).default(AnnouncementBannerType.INFO),
  isActive: z.boolean().default(true),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  actionUrl: z.string().optional().nullable(),
  actionText: z.string().optional().nullable(),
});

export const upsertFaqItemSchema = z.object({
  questionAr: z.string().min(5, 'السؤال بالعربية يجب ألا يقل عن 5 أحرف'),
  answerAr: z.string().min(10, 'الإجابة بالعربية يجب ألا تقل عن 10 أحرف'),
  questionEn: z.string().optional().nullable(),
  answerEn: z.string().optional().nullable(),
  category: z.nativeEnum(FaqCategory).default(FaqCategory.GENERAL),
  displayOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(true),
});

