'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CmsPageDto } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { apiClient, describeApiError } from '../../../lib/api-client';
import { FileText, Calendar, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { CMS_PAGE_CATEGORY_LABELS_AR } from '../../../components/admin/cms-announcements-workspace';

export default function CmsPageReader() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const [page, setPage] = useState<CmsPageDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    async function fetchPage() {
      setIsLoading(true);
      setError(null);
      try {
        const res: any = await apiClient.get(`/cms/pages/${slug}`);
        if (isMounted) {
          setPage(res?.data || res);
        }
      } catch (err) {
        if (isMounted) {
          const parsed = describeApiError(err);
          setError(parsed.message || 'الصفحة المطلوبة غير موجودة أو لم يتم نشرها بعد.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPage();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-xs text-ink-secondary mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <span>صفحات المنصة</span>
          {page && (
            <>
              <span>/</span>
              <span className="text-ink-primary font-medium">{page.title}</span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-ink-secondary">جارٍ تحميل محتوى الصفحة...</p>
          </div>
        ) : error || !page ? (
          <div className="bg-surface-card dark:bg-dark-surface-card rounded-2xl border border-border-light dark:border-dark-border p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
              الصفحة غير موجودة
            </h1>
            <p className="text-sm text-ink-secondary max-w-md mx-auto">
              {error || 'عذراً، الصفحة التي تبحث عنها غير متوفرة أو تمت إزالتها.'}
            </p>
            <div className="pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <span>العودة للرئيسية</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <article className="bg-surface-card dark:bg-dark-surface-card rounded-2xl border border-border-light dark:border-dark-border p-6 sm:p-10 shadow-sm space-y-8">
            {/* Header info */}
            <div className="border-b border-border-light dark:border-dark-border pb-6 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                  {CMS_PAGE_CATEGORY_LABELS_AR[page.category] || page.category}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-ink-tertiary mr-auto">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>آخر تحديث: {new Date(page.updatedAt).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>

              <h1 className="text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary">
                {page.title}
              </h1>

              {page.summary && (
                <p className="text-base text-ink-secondary leading-relaxed pt-1">
                  {page.summary}
                </p>
              )}
            </div>

            {/* Main Content */}
            <div className="prose dark:prose-invert max-w-none text-ink-primary dark:text-dark-ink-primary text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
              {page.content}
            </div>

            {/* Footer Trust Badge */}
            <div className="pt-6 border-t border-border-light dark:border-dark-border flex items-center gap-3 text-xs text-ink-secondary">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                وثيقة معتمدة ومحدثة من الإدارة القانونية لمنصة المصايف وفق اشتراطات الهيئة العامة للعقار.
              </span>
            </div>
          </article>
        )}
      </div>
    </LayoutShell>
  );
}

