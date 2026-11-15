import { z } from 'zod';
import { CmsPageCategory, AnnouncementBannerType, FaqCategory } from '../enums/cms';
import { upsertCmsPageSchema, upsertBannerSchema, upsertFaqItemSchema } from '../schemas/cms.schema';

export type UpsertCmsPageInput = z.infer<typeof upsertCmsPageSchema>;
export type UpsertBannerInput = z.infer<typeof upsertBannerSchema>;
export type UpsertFaqItemInput = z.infer<typeof upsertFaqItemSchema>;

export interface CmsPageDto {
  id: string;
  slug: string;
  title: string;
  category: CmsPageCategory;
  content: string;
  summary?: string | null;
  isPublished: boolean;
  displayOrder: number;
  publishedAt?: string | null;
  authorAdminId?: string | null;
  authorAdminName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementBannerDto {
  id: string;
  title: string;
  content: string;
  bannerType: AnnouncementBannerType;
  isActive: boolean;
  startAt?: string | null;
  endAt?: string | null;
  actionUrl?: string | null;
  actionText?: string | null;
  createdByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FaqItemDto {
  id: string;
  questionAr: string;
  answerAr: string;
  questionEn?: string | null;
  answerEn?: string | null;
  category: FaqCategory;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

