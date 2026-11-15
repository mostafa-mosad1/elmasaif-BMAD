'use client';

import React, { useEffect, useState } from 'react';
import { FaqItemDto, FaqCategory } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { apiClient } from '../../../lib/api-client';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  MessageCircleQuestion,
  RefreshCw,
  Building2,
  User,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { FAQ_CATEGORY_LABELS_AR } from '../../../components/admin/cms-announcements-workspace';

export default function PublicFaqPage() {
  const [faqs, setFaqs] = useState<FaqItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [openIds, setOpenIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadFaqs() {
      setIsLoading(true);
      try {
        const res: any = await apiClient.get('/cms/faq');
        const items = res?.data || res || [];
        if (isMounted) {
          setFaqs(items);
          // Open first 2 items by default if available
          if (items.length > 0) {
            setOpenIds([items[0].id, items[1]?.id].filter(Boolean));
          }
        }
      } catch {
        // handle gracefully
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadFaqs();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const filteredFaqs = faqs.filter((faq) => {
    if (selectedCategory !== 'ALL' && faq.category !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchAr = faq.questionAr.toLowerCase().includes(q) || faq.answerAr.toLowerCase().includes(q);
      const matchEn =
        faq.questionEn?.toLowerCase().includes(q) || faq.answerEn?.toLowerCase().includes(q);
      return matchAr || matchEn;
    }
    return true;
  });

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
            <HelpCircle className="w-4 h-4" />
            <span>مركز المساعدة والأسئلة الشائعة</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary">
            كيف يمكننا مساعدتك اليوم؟
          </h1>
          <p className="text-sm sm:text-base text-ink-secondary max-w-xl mx-auto">
            إجابات شاملة ومباشرة عن كل ما يتعلق بتسجيل الحساب، توثيق فال، حجز المعاينات، والصفقات العقارية.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto">
          <Search className="w-5 h-5 absolute top-3.5 right-4 text-ink-secondary" />
          <input
            type="text"
            placeholder="ابحث عن سؤال، موضوع، أو معلومة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-surface-card dark:bg-dark-surface-card border border-border-light dark:border-dark-border rounded-xl text-ink-primary text-sm shadow-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-card dark:bg-dark-surface-card border border-border-light text-ink-secondary hover:bg-surface-elevated'
            }`}
          >
            جميع الأسئلة ({faqs.length})
          </button>
          {Object.values(FaqCategory).map((cat) => {
            const count = faqs.filter((f) => f.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-card dark:bg-dark-surface-card border border-border-light text-ink-secondary hover:bg-surface-elevated'
                }`}
              >
                {FAQ_CATEGORY_LABELS_AR[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* FAQs Accordion List */}
        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="py-16 text-center text-ink-secondary">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <span>جارٍ تحميل الأسئلة الشائعة...</span>
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="py-16 text-center bg-surface-card rounded-2xl border border-border-light p-8">
              <MessageCircleQuestion className="w-12 h-12 mx-auto mb-3 text-ink-tertiary" />
              <p className="font-bold text-ink-primary">لم يتم العثور على أي أسئلة مطابقة</p>
              <p className="text-xs text-ink-secondary mt-1">جرب البحث بكلمات أخرى أو اختر تصنيفاً مختلفاً</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className="bg-surface-card dark:bg-dark-surface-card border border-border-light dark:border-dark-border rounded-xl overflow-hidden transition-all duration-150"
                >
                  <button
                    onClick={() => toggleOpen(faq.id)}
                    className="w-full p-5 text-right flex items-center justify-between gap-4 hover:bg-surface-elevated/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        ؟
                      </span>
                      <span className="font-bold text-sm sm:text-base text-ink-primary dark:text-dark-ink-primary">
                        {faq.questionAr}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-ink-secondary shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-ink-secondary shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed border-t border-border-light/60 dark:border-dark-border/60">
                      <p className="whitespace-pre-wrap">{faq.answerAr}</p>
                      {faq.answerEn && (
                        <p className="mt-3 text-xs text-ink-tertiary border-t border-border-light pt-2" dir="ltr">
                          {faq.answerEn}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </LayoutShell>
  );
}

