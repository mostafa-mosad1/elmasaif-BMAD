'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CmsPageDto } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { apiClient, describeApiError } from '../../../lib/api-client';
import { FileText, Calendar, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { CMS_PAGE_CATEGORY_LABELS_AR } from '../../../components/admin/cms-announcements-workspace';

function renderMarkdownContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="space-y-2 my-4 list-none pr-0">
          {currentList.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(index);
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList(index);
      elements.push(
        <h2 key={index} className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary mt-6 mb-3 border-b border-surface-border dark:border-dark-surface-border pb-2">
          {trimmed.replace(/^#\s+/, '')}
        </h2>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(index);
      elements.push(
        <h3 key={index} className="text-lg sm:text-xl font-bold text-primary dark:text-primary-light mt-6 mb-2">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList(index);
      elements.push(
        <h4 key={index} className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mt-4 mb-2">
          {trimmed.replace(/^###\s+/, '')}
        </h4>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (/^\d+\.\s+/.test(trimmed)) {
      flushList(index);
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (match) {
        elements.push(
          <div key={index} className="flex items-start gap-3 my-2 text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
              {match[1]}
            </span>
            <span className="leading-relaxed">{match[2]}</span>
          </div>
        );
      }
    } else {
      flushList(index);
      elements.push(
        <p key={index} className="text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary leading-relaxed my-3">
          {trimmed}
        </p>
      );
    }
  });

  flushList(lines.length);
  return elements;
}

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
            <div className="space-y-2 text-ink-primary dark:text-dark-ink-primary leading-relaxed">
              {renderMarkdownContent(page.content)}
            </div>

            {/* Footer Trust Badge */}
            <div className="pt-6 border-t border-border-light dark:border-dark-border flex items-center gap-3 text-xs text-ink-secondary">
              <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
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

