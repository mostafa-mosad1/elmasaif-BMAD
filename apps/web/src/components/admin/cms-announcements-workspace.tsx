'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CmsPageCategory,
  AnnouncementBannerType,
  FaqCategory,
  CmsPageDto,
  AnnouncementBannerDto,
  FaqItemDto,
  UpsertCmsPageInput,
  UpsertBannerInput,
  UpsertFaqItemInput,
} from '@elmasaif/shared';
import {
  FileText,
  Megaphone,
  HelpCircle,
  PlusCircle,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Calendar,
  ExternalLink,
  X,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';

export const CMS_PAGE_CATEGORY_LABELS_AR: Record<CmsPageCategory, string> = {
  [CmsPageCategory.LEGAL_TERMS]: 'الشروط والأحكام',
  [CmsPageCategory.PRIVACY_POLICY]: 'سياسة الخصوصية',
  [CmsPageCategory.FAQ]: 'الأسئلة الشائعة',
  [CmsPageCategory.GUIDE]: 'دليل المستخدم',
  [CmsPageCategory.ANNOUNCEMENT]: 'إعلانات عامة',
};

export const BANNER_TYPE_LABELS_AR: Record<AnnouncementBannerType, string> = {
  [AnnouncementBannerType.INFO]: 'معلومات (أزرق)',
  [AnnouncementBannerType.WARNING]: 'تحذير (أصفر)',
  [AnnouncementBannerType.ALERT]: 'تنبيه طارئ (أحمر)',
  [AnnouncementBannerType.SUCCESS]: 'إشعار إيجابي (أخضر)',
};

export const FAQ_CATEGORY_LABELS_AR: Record<FaqCategory, string> = {
  [FaqCategory.GENERAL]: 'عام',
  [FaqCategory.BUYER]: 'المشترون',
  [FaqCategory.MARKETER]: 'المسوقون العقاريون',
  [FaqCategory.OWNER]: 'ملاك العقارات',
  [FaqCategory.DEALS]: 'الصفقات والعقود',
};

export type CmsTab = 'PAGES' | 'BANNERS' | 'FAQ';

export interface CmsAnnouncementsWorkspaceProps {
  initialTab?: CmsTab;
  initialPages?: CmsPageDto[];
  initialBanners?: AnnouncementBannerDto[];
  initialFaqs?: FaqItemDto[];
}

export function CmsAnnouncementsWorkspace({
  initialTab = 'PAGES',
  initialPages = [],
  initialBanners = [],
  initialFaqs = [],
}: CmsAnnouncementsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<CmsTab>(initialTab);

  // Data states
  const [pages, setPages] = useState<CmsPageDto[]>(initialPages);
  const [banners, setBanners] = useState<AnnouncementBannerDto[]>(initialBanners);
  const [faqs, setFaqs] = useState<FaqItemDto[]>(initialFaqs);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CmsPageDto | null>(null);

  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AnnouncementBannerDto | null>(null);

  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItemDto | null>(null);

  // Form States - Page
  const [pageSlug, setPageSlug] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [pageCategory, setPageCategory] = useState<CmsPageCategory>(CmsPageCategory.LEGAL_TERMS);
  const [pageContent, setPageContent] = useState('');
  const [pageSummary, setPageSummary] = useState('');
  const [pageIsPublished, setPageIsPublished] = useState(true);
  const [pageDisplayOrder, setPageDisplayOrder] = useState(0);
  const [previewPageMarkdown, setPreviewPageMarkdown] = useState(false);

  // Form States - Banner
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerContent, setBannerContent] = useState('');
  const [bannerType, setBannerType] = useState<AnnouncementBannerType>(AnnouncementBannerType.INFO);
  const [bannerIsActive, setBannerIsActive] = useState(true);
  const [bannerStartAt, setBannerStartAt] = useState('');
  const [bannerEndAt, setBannerEndAt] = useState('');
  const [bannerActionUrl, setBannerActionUrl] = useState('');
  const [bannerActionText, setBannerActionText] = useState('');

  // Form States - FAQ
  const [faqQuestionAr, setFaqQuestionAr] = useState('');
  const [faqAnswerAr, setFaqAnswerAr] = useState('');
  const [faqQuestionEn, setFaqQuestionEn] = useState('');
  const [faqAnswerEn, setFaqAnswerEn] = useState('');
  const [faqCategory, setFaqCategory] = useState<FaqCategory>(FaqCategory.GENERAL);
  const [faqDisplayOrder, setFaqDisplayOrder] = useState(0);
  const [faqIsPublished, setFaqIsPublished] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/admin/cms/pages');
      setPages(res?.data || res || []);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل صفحات المحتوى');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/admin/cms/banners');
      setBanners(res?.data || res || []);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل أشرطة التنبيهات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFaqs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/admin/cms/faq');
      setFaqs(res?.data || res || []);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل الأسئلة الشائعة');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'PAGES') fetchPages();
    if (activeTab === 'BANNERS') fetchBanners();
    if (activeTab === 'FAQ') fetchFaqs();
  }, [activeTab, fetchPages, fetchBanners, fetchFaqs]);

  // Page Form Handlers
  const handleOpenPageModal = (page?: CmsPageDto) => {
    setFormError(null);
    if (page) {
      setEditingPage(page);
      setPageSlug(page.slug);
      setPageTitle(page.title);
      setPageCategory(page.category);
      setPageContent(page.content);
      setPageSummary(page.summary || '');
      setPageIsPublished(page.isPublished);
      setPageDisplayOrder(page.displayOrder);
    } else {
      setEditingPage(null);
      setPageSlug('');
      setPageTitle('');
      setPageCategory(CmsPageCategory.LEGAL_TERMS);
      setPageContent('');
      setPageSummary('');
      setPageIsPublished(true);
      setPageDisplayOrder(0);
    }
    setPreviewPageMarkdown(false);
    setIsPageModalOpen(true);
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: UpsertCmsPageInput = {
        slug: pageSlug.trim().toLowerCase(),
        title: pageTitle.trim(),
        category: pageCategory,
        content: pageContent.trim(),
        summary: pageSummary.trim() || undefined,
        isPublished: pageIsPublished,
        displayOrder: pageDisplayOrder,
      };

      await apiClient.post('/admin/cms/pages', payload);
      setSuccessMessage('تم حفظ صفحة المحتوى بنجاح');
      setIsPageModalOpen(false);
      fetchPages();
    } catch (err) {
      const parsed = describeApiError(err);
      setFormError(parsed.message || 'فشل حفظ صفحة المحتوى');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Banner Form Handlers
  const handleOpenBannerModal = (banner?: AnnouncementBannerDto) => {
    setFormError(null);
    if (banner) {
      setEditingBanner(banner);
      setBannerTitle(banner.title);
      setBannerContent(banner.content);
      setBannerType(banner.bannerType);
      setBannerIsActive(banner.isActive);
      setBannerStartAt(banner.startAt ? banner.startAt.slice(0, 16) : '');
      setBannerEndAt(banner.endAt ? banner.endAt.slice(0, 16) : '');
      setBannerActionUrl(banner.actionUrl || '');
      setBannerActionText(banner.actionText || '');
    } else {
      setEditingBanner(null);
      setBannerTitle('');
      setBannerContent('');
      setBannerType(AnnouncementBannerType.INFO);
      setBannerIsActive(true);
      setBannerStartAt('');
      setBannerEndAt('');
      setBannerActionUrl('');
      setBannerActionText('');
    }
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: UpsertBannerInput = {
        title: bannerTitle.trim(),
        content: bannerContent.trim(),
        bannerType,
        isActive: bannerIsActive,
        startAt: bannerStartAt ? new Date(bannerStartAt).toISOString() : null,
        endAt: bannerEndAt ? new Date(bannerEndAt).toISOString() : null,
        actionUrl: bannerActionUrl.trim() || null,
        actionText: bannerActionText.trim() || null,
      };

      if (editingBanner) {
        await apiClient.post(`/admin/cms/banners/${editingBanner.id}`, payload);
      } else {
        await apiClient.post('/admin/cms/banners', payload);
      }

      setSuccessMessage('تم حفظ شريط الإعلانات بنجاح');
      setIsBannerModalOpen(false);
      fetchBanners();
    } catch (err) {
      const parsed = describeApiError(err);
      setFormError(parsed.message || 'فشل حفظ شريط الإعلانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;
    try {
      await apiClient.delete(`/admin/cms/banners/${id}`);
      setSuccessMessage('تم حذف شريط الإعلانات بنجاح');
      fetchBanners();
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'فشل حذف الإعلان');
    }
  };

  // FAQ Form Handlers
  const handleOpenFaqModal = (faq?: FaqItemDto) => {
    setFormError(null);
    if (faq) {
      setEditingFaq(faq);
      setFaqQuestionAr(faq.questionAr);
      setFaqAnswerAr(faq.answerAr);
      setFaqQuestionEn(faq.questionEn || '');
      setFaqAnswerEn(faq.answerEn || '');
      setFaqCategory(faq.category);
      setFaqDisplayOrder(faq.displayOrder);
      setFaqIsPublished(faq.isPublished);
    } else {
      setEditingFaq(null);
      setFaqQuestionAr('');
      setFaqAnswerAr('');
      setFaqQuestionEn('');
      setFaqAnswerEn('');
      setFaqCategory(FaqCategory.GENERAL);
      setFaqDisplayOrder(0);
      setFaqIsPublished(true);
    }
    setIsFaqModalOpen(true);
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: UpsertFaqItemInput = {
        questionAr: faqQuestionAr.trim(),
        answerAr: faqAnswerAr.trim(),
        questionEn: faqQuestionEn.trim() || null,
        answerEn: faqAnswerEn.trim() || null,
        category: faqCategory,
        displayOrder: faqDisplayOrder,
        isPublished: faqIsPublished,
      };

      if (editingFaq) {
        await apiClient.post(`/admin/cms/faq/${editingFaq.id}`, payload);
      } else {
        await apiClient.post('/admin/cms/faq', payload);
      }

      setSuccessMessage('تم حفظ السؤال الشائع بنجاح');
      setIsFaqModalOpen(false);
      fetchFaqs();
    } catch (err) {
      const parsed = describeApiError(err);
      setFormError(parsed.message || 'فشل حفظ السؤال الشائع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السؤال الشائع؟')) return;
    try {
      await apiClient.delete(`/admin/cms/faq/${id}`);
      setSuccessMessage('تم حذف السؤال الشائع بنجاح');
      fetchFaqs();
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'فشل حذف السؤال الشائع');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-border dark:border-dark-surface-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary dark:text-emerald-400" />
            نظام إدارة المحتوى (CMS) والتنبيهات
          </h1>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            إدارة الصفحات القانونية الثابتة، أشرطة الإعلانات والتنبيهات العلوية، وبنك الأسئلة الشائعة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'PAGES' && (
            <button
              onClick={() => handleOpenPageModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-xs transition-colors text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة صفحة جديدة</span>
            </button>
          )}

          {activeTab === 'BANNERS' && (
            <button
              onClick={() => handleOpenBannerModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-xs transition-colors text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إنشاء شريط إعلاني</span>
            </button>
          )}

          {activeTab === 'FAQ' && (
            <button
              onClick={() => handleOpenFaqModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-xs transition-colors text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة سؤال شائع</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'PAGES') fetchPages();
              if (activeTab === 'BANNERS') fetchBanners();
              if (activeTab === 'FAQ') fetchFaqs();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-surface dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface-border dark:border-dark-surface-border space-x-reverse space-x-2">
        <button
          onClick={() => setActiveTab('PAGES')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'PAGES'
              ? 'border-primary text-primary dark:text-emerald-400'
              : 'border-transparent text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>الصفحات الثابتة (Static Pages)</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken text-xs font-mono">
            {pages.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('BANNERS')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'BANNERS'
              ? 'border-primary text-primary dark:text-emerald-400'
              : 'border-transparent text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>أشرطة الإعلانات والتنبيهات (Banners)</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken text-xs font-mono">
            {banners.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('FAQ')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'FAQ'
              ? 'border-primary text-primary dark:text-emerald-400'
              : 'border-transparent text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>الأسئلة الشائعة (FAQ)</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken text-xs font-mono">
            {faqs.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pages Table */}
      {activeTab === 'PAGES' && (
        <div className="bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/70 text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">عنوان الصفحة</th>
                  <th className="px-4 py-3 font-semibold">الرابط الدائم (Slug)</th>
                  <th className="px-4 py-3 font-semibold">التصنيف</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">آخر تحديث</th>
                  <th className="px-4 py-3 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {isLoading && pages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <span>جارٍ تحميل الصفحات...</span>
                    </td>
                  </tr>
                ) : pages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      لا توجد صفحات منشورة حالياً
                    </td>
                  </tr>
                ) : (
                  pages.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40 transition-colors text-ink-primary dark:text-dark-ink-primary"
                    >
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary dark:text-emerald-400">
                        /pages/{p.slug}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary">
                          {CMS_PAGE_CATEGORY_LABELS_AR[p.category] || p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.isPublished ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                            <Eye className="w-3.5 h-3.5" />
                            <span>منشورة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-secondary bg-surface-sunken dark:bg-dark-surface-sunken dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border px-2 py-0.5 rounded-full font-medium">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>مسودة</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                        {new Date(p.updatedAt).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <a
                            href={`/pages/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-ink-secondary hover:text-primary dark:hover:text-emerald-400 rounded-md transition-colors"
                            title="معاينة الصفحة العامة"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleOpenPageModal(p)}
                            className="p-1.5 text-ink-secondary hover:text-primary dark:hover:text-emerald-400 rounded-md transition-colors"
                            title="تعديل المحتوى"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Banners Table */}
      {activeTab === 'BANNERS' && (
        <div className="bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/70 text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">العنوان</th>
                  <th className="px-4 py-3 font-semibold">المحتوى</th>
                  <th className="px-4 py-3 font-semibold">النوع</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">فترة العرض</th>
                  <th className="px-4 py-3 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {isLoading && banners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <span>جارٍ تحميل أشرطة التنبيهات...</span>
                    </td>
                  </tr>
                ) : banners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      لا توجد أشرطة تنبيهات مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  banners.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-primary dark:text-dark-ink-primary">{b.title}</td>
                      <td className="px-4 py-3 text-ink-secondary dark:text-dark-ink-secondary text-xs max-w-xs truncate">
                        {b.content}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            b.bannerType === AnnouncementBannerType.ALERT
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              : b.bannerType === AnnouncementBannerType.WARNING
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              : b.bannerType === AnnouncementBannerType.SUCCESS
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          {BANNER_TYPE_LABELS_AR[b.bannerType] || b.bannerType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-secondary bg-surface-sunken dark:bg-dark-surface-sunken dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border px-2 py-0.5 rounded-full font-medium">
                            معطل
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                        {b.startAt || b.endAt ? (
                          <div className="flex flex-col">
                            <span>من: {b.startAt ? new Date(b.startAt).toLocaleDateString('ar-SA') : 'الآن'}</span>
                            <span>إلى: {b.endAt ? new Date(b.endAt).toLocaleDateString('ar-SA') : 'دائم'}</span>
                          </div>
                        ) : (
                          <span>دائم مستمر</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenBannerModal(b)}
                            className="p-1.5 text-ink-secondary hover:text-primary dark:hover:text-emerald-400 rounded-md transition-colors"
                            title="تعديل الشريط"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(b.id)}
                            className="p-1.5 text-ink-secondary hover:text-rose-600 rounded-md transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: FAQ Table */}
      {activeTab === 'FAQ' && (
        <div className="bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/70 text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">السؤال (بالعربية)</th>
                  <th className="px-4 py-3 font-semibold">التصنيف</th>
                  <th className="px-4 py-3 font-semibold">الترتيب</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {isLoading && faqs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <span>جارٍ تحميل الأسئلة الشائعة...</span>
                    </td>
                  </tr>
                ) : faqs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-secondary dark:text-dark-ink-secondary">
                      لا توجد أسئلة شائعة مسجلة
                    </td>
                  </tr>
                ) : (
                  faqs.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink-primary dark:text-dark-ink-primary">{f.questionAr}</span>
                          <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary line-clamp-1">{f.answerAr}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary">
                          {FAQ_CATEGORY_LABELS_AR[f.category] || f.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary dark:text-dark-ink-secondary">{f.displayOrder}</td>
                      <td className="px-4 py-3">
                        {f.isPublished ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                            منشور
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-secondary bg-surface-sunken dark:bg-dark-surface-sunken dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border px-2 py-0.5 rounded-full font-medium">
                            مسودة
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenFaqModal(f)}
                            className="p-1.5 text-ink-secondary hover:text-primary dark:hover:text-emerald-400 rounded-md transition-colors"
                            title="تعديل السؤال"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFaq(f.id)}
                            className="p-1.5 text-ink-secondary hover:text-rose-600 rounded-md transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Page Modal */}
      {isPageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsPageModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-surface-sunken dark:bg-dark-surface-sunken border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-light dark:bg-amber-950/60 text-accent-dark dark:text-accent flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    {editingPage ? 'تعديل صفحة المحتوى' : 'إنشاء صفحة محتوى جديدة'}
                  </h2>
                  <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    {editingPage ? 'تحديث النصوص والصياغة القانونية والمعلوماتية للمنصة' : 'إضافة صفحة ثابتة جديدة برابط دائم مخصص'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPageModalOpen(false)}
                className="p-2 text-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePage} className="p-6 space-y-5 overflow-y-auto bg-surface-base dark:bg-dark-surface-base">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5">
                    عنوان الصفحة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الشروط والأحكام"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5">
                    الرابط الدائم (Slug) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    placeholder="terms-of-service"
                    value={pageSlug}
                    onChange={(e) => setPageSlug(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary font-mono text-left placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5">التصنيف</label>
                  <select
                    value={pageCategory}
                    onChange={(e) => setPageCategory(e.target.value as CmsPageCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  >
                    {Object.values(CmsPageCategory).map((c) => (
                      <option key={c} value={c}>
                        {CMS_PAGE_CATEGORY_LABELS_AR[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5">ترتيب العرض</label>
                  <input
                    type="number"
                    value={pageDisplayOrder}
                    onChange={(e) => setPageDisplayOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>

                <div className="flex items-end">
                  <label className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken cursor-pointer hover:bg-surface-sunken/80 dark:hover:bg-dark-surface-raised transition-colors">
                    <input
                      type="checkbox"
                      checked={pageIsPublished}
                      onChange={(e) => setPageIsPublished(e.target.checked)}
                      className="w-4 h-4 text-accent rounded-sm focus:ring-accent accent-accent"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary block">نشر الصفحة للعامة</span>
                      <span className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary block">إتاحة الصفحة عبر الرابط</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5">الملخص الموجز</label>
                <input
                  type="text"
                  placeholder="ملخص يظهر في بطاقات البحث ومعاينات المشاركة..."
                  value={pageSummary}
                  onChange={(e) => setPageSummary(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
                    محتوى الصفحة (Markdown) <span className="text-rose-500">*</span>
                  </label>
                  <div className="inline-flex rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewPageMarkdown(false)}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        !previewPageMarkdown
                          ? 'bg-surface-base dark:bg-dark-surface-raised text-ink-primary dark:text-dark-ink-primary shadow-xs font-bold'
                          : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      تحرير النصوص
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewPageMarkdown(true)}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        previewPageMarkdown
                          ? 'bg-surface-base dark:bg-dark-surface-raised text-ink-primary dark:text-dark-ink-primary shadow-xs font-bold'
                          : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      معاينة المحتوى
                    </button>
                  </div>
                </div>

                {previewPageMarkdown ? (
                  <div className="p-4 border border-surface-border dark:border-dark-surface-border rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken min-h-[220px] max-h-[350px] overflow-y-auto text-sm text-ink-primary dark:text-dark-ink-primary leading-relaxed" dir="rtl">
                    <div className="whitespace-pre-wrap font-sans space-y-2">{pageContent || 'لا يوجد محتوى للمعاينة'}</div>
                  </div>
                ) : (
                  <textarea
                    rows={9}
                    required
                    dir="rtl"
                    placeholder="# عنوان الصفحة&#10;&#10;اكتب المحتوى بصيغة Markdown..."
                    value={pageContent}
                    onChange={(e) => setPageContent(e.target.value)}
                    className="w-full p-3.5 text-sm font-sans leading-relaxed bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y shadow-xs"
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setIsPageModalOpen(false)}
                  className="px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised font-semibold text-xs rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingPage ? 'حفظ التعديلات' : 'إنشاء الصفحة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Banner Modal */}
      {isBannerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsBannerModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-surface-sunken dark:bg-dark-surface-sunken border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-light dark:bg-amber-950/60 text-accent-dark dark:text-accent flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    {editingBanner ? 'تعديل شريط الإعلانات' : 'إنشاء شريط إعلاني جديد'}
                  </h2>
                  <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    {editingBanner ? 'تعديل تفاصيل الشريط الإعلاني والتنبيهات العلوية' : 'إضافة شريط تنبيه جديد يظهر في أعلى صفحات المنصة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="p-2 text-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveBanner} className="p-6 space-y-4 overflow-y-auto bg-surface-base dark:bg-dark-surface-base">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">
                  عنوان الإعلان <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تنبيه بخصوص تحديث الصيانة"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">
                  محتوى التنبيه <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  dir="rtl"
                  placeholder="نص التنبيه الذي سيظهر في الشريط العلوي..."
                  value={bannerContent}
                  onChange={(e) => setBannerContent(e.target.value)}
                  className="w-full p-3 text-sm font-sans leading-relaxed bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">نوع الشريط</label>
                  <select
                    value={bannerType}
                    onChange={(e) => setBannerType(e.target.value as AnnouncementBannerType)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  >
                    {Object.values(AnnouncementBannerType).map((t) => (
                      <option key={t} value={t}>
                        {BANNER_TYPE_LABELS_AR[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken cursor-pointer hover:bg-surface-sunken/80 dark:hover:bg-dark-surface-raised transition-colors">
                    <input
                      type="checkbox"
                      checked={bannerIsActive}
                      onChange={(e) => setBannerIsActive(e.target.checked)}
                      className="w-4 h-4 text-accent rounded-sm focus:ring-accent accent-accent"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary block">تفعيل الشريط فوراً</span>
                      <span className="text-[11px] text-ink-muted dark:text-dark-ink-secondary block">إظهار الإعلان للمستخدمين</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">تاريخ البدء</label>
                  <input
                    type="datetime-local"
                    value={bannerStartAt}
                    onChange={(e) => setBannerStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">تاريخ الانتهاء</label>
                  <input
                    type="datetime-local"
                    value={bannerEndAt}
                    onChange={(e) => setBannerEndAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">رابط الإجراء (URL)</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="https://... أو /pages/..."
                    value={bannerActionUrl}
                    onChange={(e) => setBannerActionUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary font-mono text-left focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">نص زر الإجراء</label>
                  <input
                    type="text"
                    placeholder="مثال: اعرف المزيد"
                    value={bannerActionText}
                    onChange={(e) => setBannerActionText(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised font-semibold text-xs rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingBanner ? 'حفظ التعديلات' : 'إنشاء الشريط'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {isFaqModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFaqModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-surface-sunken dark:bg-dark-surface-sunken border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-light dark:bg-amber-950/60 text-accent-dark dark:text-accent flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    {editingFaq ? 'تعديل السؤال الشائع' : 'إضافة سؤال شائع جديد'}
                  </h2>
                  <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    {editingFaq ? 'تحديث صيغة السؤال والإجابة المعتمدة' : 'إضافة سؤال جديد إلى بنك الأسئلة الشائعة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="p-2 text-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFaq} className="p-6 space-y-4 overflow-y-auto bg-surface-base dark:bg-dark-surface-base">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">
                  السؤال (بالعربية) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="كيف يتم توثيق رخصة فال في المنصة؟"
                  value={faqQuestionAr}
                  onChange={(e) => setFaqQuestionAr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">
                  الإجابة (بالعربية) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  dir="rtl"
                  placeholder="اكتب الإجابة المفصلة..."
                  value={faqAnswerAr}
                  onChange={(e) => setFaqAnswerAr(e.target.value)}
                  className="w-full p-3 text-sm font-sans leading-relaxed bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">التصنيف</label>
                  <select
                    value={faqCategory}
                    onChange={(e) => setFaqCategory(e.target.value as FaqCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  >
                    {Object.values(FaqCategory).map((c) => (
                      <option key={c} value={c}>
                        {FAQ_CATEGORY_LABELS_AR[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1.5">الترتيب</label>
                  <input
                    type="number"
                    value={faqDisplayOrder}
                    onChange={(e) => setFaqDisplayOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-base dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken cursor-pointer hover:bg-surface-sunken/80 dark:hover:bg-dark-surface-raised transition-colors">
                  <input
                    type="checkbox"
                    checked={faqIsPublished}
                    onChange={(e) => setFaqIsPublished(e.target.checked)}
                    className="w-4 h-4 text-accent rounded-sm focus:ring-accent accent-accent"
                  />
                  <div>
                    <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary block">نشر السؤال في صفحة الأسئلة الشائعة</span>
                    <span className="text-[11px] text-ink-muted dark:text-dark-ink-secondary block">إظهار السؤال والإجابة للمستخدمين والزوار</span>
                  </div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setIsFaqModalOpen(false)}
                  className="px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised font-semibold text-xs rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingFaq ? 'حفظ التعديلات' : 'إنشاء السؤال'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

