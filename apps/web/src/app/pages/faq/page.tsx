'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FaqItemDto, FaqCategory } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { apiClient } from '../../../lib/api-client';
import {
  HelpCircle,
  Search,
  ChevronDown,
  MessageCircleQuestion,
  RefreshCw,
  Building2,
  User,
  ShieldCheck,
  Briefcase,
  FileText,
  BadgeCheck,
  CreditCard,
  PhoneCall,
  Sparkles,
  X,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export const FAQ_CATEGORY_CONFIG: Record<
  FaqCategory,
  { label: string; icon: React.ReactNode; description: string }
> = {
  [FaqCategory.GENERAL]: {
    label: 'عام والامتثال',
    icon: <ShieldCheck className="w-4 h-4" />,
    description: 'معلومات عامة حول المنصة وأنظمة الهيئة العامة للعقار',
  },
  [FaqCategory.BUYER]: {
    label: 'المشترون',
    icon: <User className="w-4 h-4" />,
    description: 'تقديم العروض، حجز المعاينات، وضمانات الشراء الآمن',
  },
  [FaqCategory.MARKETER]: {
    label: 'الوسطاء المرخصون',
    icon: <Briefcase className="w-4 h-4" />,
    description: 'رخص فال، اتفاقيات الوساطة، واستحقاق السعي',
  },
  [FaqCategory.OWNER]: {
    label: 'ملاك العقارات',
    icon: <Building2 className="w-4 h-4" />,
    description: 'إضافة العقارات، تدقيق الصكوك، وتفويض المسوقين',
  },
  [FaqCategory.DEALS]: {
    label: 'الصفقات والمالية',
    icon: <CreditCard className="w-4 h-4" />,
    description: 'السعي النظامي 2.5%، التحويلات البنكية، والتوثيق',
  },
};

const CURATED_DEFAULT_FAQS: FaqItemDto[] = [
  {
    id: 'faq-curated-1',
    questionAr: 'كيف تضمن المنصة حقوق الأطراف في الصفقات العقارية؟',
    answerAr:
      'تعتمد منصة المصايف على منظومة وساطة رقمية متكاملة ومحكومة بالكامل وفق أنظمة الهيئة العامة للعقار (REGA). تشمل الحماية التدقيق اللحظي للصكوك الإلكترونية عبر منصة البورصة العقارية، وتوثيق تراخيص فال للمسوقين، وإبرام عقود وساطة نظامية ملزمة مع توثيق التحويلات البنكية المباشرة بدون احتجاز غير نظامي للأموال.',
    category: FaqCategory.GENERAL,
    displayOrder: 1,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-2',
    questionAr: 'هل جميع العقارات المعروضة مفحوصة وموثقة برخص فال العقارية؟',
    answerAr:
      'نعم، تخضع كافة العقارات المعروضة في منصة المصايف للتدقيق الإلزامي، حيث يُشترط وجود رخصة فال عقارية سارية المفعول لكل مسوّق مع رقم ترخيص إعلاني معتمد، بالإضافة إلى مطابقة بيانات الصك العقاري وموقع العقار على الخريطة المكانية.',
    category: FaqCategory.GENERAL,
    displayOrder: 2,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-3',
    questionAr: 'كيف أقدّم عرض شراء رسمي على أي عقار أو فيلا؟',
    answerAr:
      'يمكنك الدخول إلى صفحة العقار والضغط على زر «تقديم عرض شراء»، ثم تحديد قيمة السعر المقترح وشروط العرض وخطاب الرغبة الجادة. يقوم الوسيط المرخص المسؤول برفع العرض رسمياً للمالك مع إشعارك لحظياً بحالة العرض وقبوله عبر المنصة.',
    category: FaqCategory.BUYER,
    displayOrder: 3,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-4',
    questionAr: 'كيف يتم حجز موعد لمعاينة العقار على أرض الواقع؟',
    answerAr:
      'من خلال بطاقة العقار، يمكنك النقر على «استفسار أو طلب معاينة» واختيار الموعد المناسب. يتواصل معك الوسيط المرخص فوراً لتنسيق المعاينة الميدانية ومرافقتك للإطلاع على العقار وتشطيباته وكافة مواصفاته الفنية.',
    category: FaqCategory.BUYER,
    displayOrder: 4,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-5',
    questionAr: 'كيف يمكن للمالك إضافة عقاره وتوثيق الصك الإلكتروني؟',
    answerAr:
      'يسجل المالك حسابه بالهوية الوطنية عبر النفاذ الموحد، ثم يقوم بإضافة بيانات العقار ورفع صورة الصك الإلكتروني أو رقم وثيقة الملكية. يتولى فريق الامتثال تدقيق الصك للتأكد من سريانه وعدم وجود نزاعات أو رهونات غير معلنة قبل طرحه للعرض.',
    category: FaqCategory.OWNER,
    displayOrder: 5,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-6',
    questionAr: 'ما هي آلية تفويض وسيط عقاري معتمد لتسويق عقار المالك؟',
    answerAr:
      'تتيح منصة المصايف إنشاء «عقد وساطة وتسويق إلكتروني» بين المالك والوسيط المرخص وفق صيغ الهيئة العامة للعقار، مما يحمي المالك من العشوائية ويضمن التزام المسوق بالقنوات والحدود التسويقية المتفق عليها.',
    category: FaqCategory.OWNER,
    displayOrder: 6,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-7',
    questionAr: 'ما هي شروط تفعيل حساب المسوق العقاري (الوسيط)؟',
    answerAr:
      'يتطلب تفعيل حساب المسوق توفر رخصة فال سارية للوساطة والتسويق صادرة من الهيئة العامة للعقار (REGA)، وإدخال رقم وثيقة العمل الحر أو السجل التجاري، والحساب البنكي المعتمد (IBAN) لاستقبال السعي النظامي.',
    category: FaqCategory.MARKETER,
    displayOrder: 7,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-8',
    questionAr: 'كيف تضمن المنصة استلام الوسيط لحقه في السعي العقاري؟',
    answerAr:
      'كل صفقة تُدار عبر نظام أوامر الدفع المشروطة؛ حيث يُلزم المشتري أو البائع بسداد السعي المعتمد 2.5% لحساب المنصة المعتمد، ولا يتم إتمام إفراغ العقار نهائياً أو إغلاق الصفقة إلا بعد تأكيد السداد وإصدار الفاتورة الضريبية وتحويل عمولة المسوق لحسابه مباشرة.',
    category: FaqCategory.MARKETER,
    displayOrder: 8,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-9',
    questionAr: 'كم تبلغ عمولة السعي في الصفقات العقارية وكيف تُحسب؟',
    answerAr:
      'يبلغ السعي النظامي 2.5% من إجمالي قيمة صفقة البيع وفق نظام الوساطة العقارية في المملكة، وتُضاف ضريبة القيمة المضافة (15%) على قيمة السعي فقط وليس على إجمالي قيمة العقار. يمكنك استخدام «حاسبة السعي» في المنصة لحساب الدفعات بدقة متناهية.',
    category: FaqCategory.DEALS,
    displayOrder: 9,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'faq-curated-10',
    questionAr: 'ما هي نافذة سداد إشعار السعي عند اكتمال الاتفاق؟',
    answerAr:
      'تمنح المنصة الأطراف نافذة سداد نظامية مدتها 48 ساعة من تاريخ اعتماد أمر الدفع لتحويل المبلغ ورفع إيصال التحويل البنكي المعتمد. يقوم قسم المراجعة المالية بالتحقق الآلي واليدوي من الإشعار خلال ساعتي عمل.',
    category: FaqCategory.DEALS,
    displayOrder: 10,
    isPublished: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
];

export default function PublicFaqPage() {
  const [faqs, setFaqs] = useState<FaqItemDto[]>(CURATED_DEFAULT_FAQS);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  // Single-open accordion state: only one question open at a time
  const [openId, setOpenId] = useState<string | null>(CURATED_DEFAULT_FAQS[0]?.id || null);

  useEffect(() => {
    let isMounted = true;

    async function loadFaqs() {
      setIsLoading(true);
      try {
        const res: any = await apiClient.get('/cms/faq');
        const items: FaqItemDto[] = res?.data || res || [];
        if (isMounted) {
          if (Array.isArray(items) && items.length > 0) {
            // Merge database FAQs with curated defaults ensuring no duplicate questions
            const existingQuestions = new Set(items.map((i) => i.questionAr.trim()));
            const complementary = CURATED_DEFAULT_FAQS.filter(
              (c) => !existingQuestions.has(c.questionAr.trim()),
            );
            const combined = [...items, ...complementary].sort(
              (a, b) => (a.displayOrder || 99) - (b.displayOrder || 99),
            );
            setFaqs(combined);
            setOpenId(combined[0]?.id || null);
          } else {
            setFaqs(CURATED_DEFAULT_FAQS);
            setOpenId(CURATED_DEFAULT_FAQS[0]?.id || null);
          }
        }
      } catch {
        if (isMounted) {
          setFaqs(CURATED_DEFAULT_FAQS);
          setOpenId(CURATED_DEFAULT_FAQS[0]?.id || null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadFaqs();

    return () => {
      isMounted = false;
    };
  }, []);

  // When clicking an item: if it is open, close it; if it is closed, open it and close any other open item.
  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      if (selectedCategory !== 'ALL' && faq.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchAr =
          faq.questionAr.toLowerCase().includes(q) || faq.answerAr.toLowerCase().includes(q);
        const matchEn =
          faq.questionEn?.toLowerCase().includes(q) || faq.answerEn?.toLowerCase().includes(q);
        return matchAr || matchEn;
      }
      return true;
    });
  }, [faqs, selectedCategory, search]);

  return (
    <LayoutShell>
      <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10" dir="rtl">
        {/* Top Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 dark:bg-accent/15 border border-accent/25 text-accent text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>مركز المعرفة والشفافية • معتمد برخص فال REGA</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-ink-primary dark:text-dark-ink-primary tracking-tight leading-tight">
            الأسئلة الشائعة والإرشادات النظامية
          </h1>

          <p className="text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-2xl mx-auto">
            إجابات دقيقة وموثقة حول منظومة الصفقات العقارية، تدقيق الصكوك، التزامات البائع والمشتري، واحتساب السعي النظامي بكل شفافية.
          </p>
        </div>

        {/* Search Bar & Stats */}
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="relative rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-level1 p-1.5 transition-all focus-within:border-accent/60 focus-within:shadow-level2">
            <div className="flex items-center gap-3 px-3 py-1">
              <Search className="w-5 h-5 text-accent shrink-0" />
              <input
                type="text"
                placeholder="ابحث بكلمات مثل: الصكوك، السعي 2.5%، رخصة فال، عروض الشراء..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-1 rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-ink-muted hover:text-ink-primary transition-colors cursor-pointer"
                  aria-label="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {search.trim() && (
            <div className="text-center text-xs font-semibold text-ink-muted">
              تم العثور على {filteredFaqs.length} سؤال مطابق لكلمة «{search}»
            </div>
          )}
        </div>

        {/* Categories Tab Strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-primary dark:bg-slate-800 text-white dark:text-white shadow-sm ring-1 ring-white/10 dark:ring-accent/40 scale-[1.02]'
                : 'bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken hover:text-ink-primary dark:hover:text-white'
            }`}
          >
            <span>جميع الأسئلة</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                selectedCategory === 'ALL'
                  ? 'bg-white/20 dark:bg-white/20 text-white dark:text-white'
                  : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-muted dark:text-dark-ink-secondary'
              }`}
            >
              {faqs.length}
            </span>
          </button>

          {Object.values(FaqCategory).map((cat) => {
            const config = FAQ_CATEGORY_CONFIG[cat];
            const count = faqs.filter((f) => f.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-primary dark:bg-slate-800 text-white dark:text-white shadow-sm ring-1 ring-white/10 dark:ring-accent/40 scale-[1.02]'
                    : 'bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken hover:text-ink-primary dark:hover:text-white'
                }`}
              >
                <span className={isSelected ? 'text-accent' : 'text-accent/80'}>
                  {config?.icon}
                </span>
                <span>{config?.label || cat}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isSelected
                      ? 'bg-white/20 dark:bg-white/20 text-white dark:text-white'
                      : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-muted dark:text-dark-ink-secondary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* FAQs Accordion Container */}
        <div className="space-y-3.5 max-w-4xl mx-auto">
          {isLoading && faqs.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-accent" />
              <p className="text-sm font-bold text-ink-secondary">جارٍ تحميل بنك الأسئلة المعتمدة...</p>
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-8 space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto">
                <MessageCircleQuestion className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                لم نجد أي نتيجة مطابقة لبحثك
              </h3>
              <p className="text-xs text-ink-secondary max-w-md mx-auto">
                جرب البحث بكلمات أخرى أو اختر تصنيفاً محدداً من القائمة أعلاه للاطلاع على الإجابات المنظمة.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface-border/60 text-xs font-bold text-primary dark:text-accent transition-colors cursor-pointer"
              >
                <span>إعادة ضبط الفلاتر</span>
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isOpen = openId === faq.id;
              const catConfig = FAQ_CATEGORY_CONFIG[faq.category];

              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'bg-surface dark:bg-dark-surface-raised border-accent/40 dark:border-accent/50 shadow-level2 ring-1 ring-accent/15'
                      : 'bg-surface/80 dark:bg-dark-surface-raised/80 border-surface-border dark:border-dark-surface-border hover:border-surface-border/80 dark:hover:border-dark-surface-border/80 hover:bg-surface'
                  }`}
                >
                  {/* Question Header Button */}
                  <button
                    type="button"
                    onClick={() => handleToggle(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-5 text-start flex items-center justify-between gap-4 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Number Indicator */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-black transition-all duration-300 ${
                          isOpen
                            ? 'bg-primary dark:bg-slate-800 text-white dark:text-white border border-transparent dark:border-accent/40 shadow-xs scale-105'
                            : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary group-hover:text-primary dark:group-hover:text-white group-hover:bg-primary/10'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="space-y-1 min-w-0">
                        {/* Category Label Pill */}
                        {catConfig && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent">
                            {catConfig.icon}
                            <span>{catConfig.label}</span>
                          </div>
                        )}
                        <h3
                          className={`text-sm sm:text-base font-black transition-colors ${
                            isOpen
                              ? 'text-primary dark:text-accent'
                              : 'text-ink-primary dark:text-dark-ink-primary group-hover:text-primary dark:group-hover:text-primary-light'
                          }`}
                        >
                          {faq.questionAr}
                        </h3>
                      </div>
                    </div>

                    {/* Smooth Rotating Chevron Icon */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen
                          ? 'bg-accent text-white rotate-180 shadow-xs'
                          : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-muted group-hover:text-ink-primary group-hover:bg-surface-border/50'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4 transition-transform duration-300" />
                    </div>
                  </button>

                  {/* Smooth Collapsing Answer Panel with CSS Grid Animation */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 sm:px-6 pb-5 pt-2 border-t border-surface-border/50 dark:border-dark-surface-border/50 space-y-3">
                        <div className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed whitespace-pre-wrap">
                          {faq.answerAr}
                        </div>

                        {faq.answerEn && (
                          <div
                            className="mt-3 pt-3 border-t border-surface-border/40 dark:border-dark-surface-border/40 text-xs text-ink-muted leading-relaxed"
                            dir="ltr"
                          >
                            <span className="font-semibold text-[10px] text-ink-secondary block mb-1">
                              English Summary:
                            </span>
                            {faq.answerEn}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>إجراء نظامي موثق وخاضع لاشتراطات الوساطة العقارية</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Luxury Assistance & Contact Box */}
        <div className="max-w-4xl mx-auto rounded-3xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-6 sm:p-8 shadow-level2 relative overflow-hidden">
          {/* Subtle gold glow */}
          <div className="absolute top-0 end-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-start">
            <div className="space-y-1.5 max-w-lg">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
                <ShieldCheck className="w-4 h-4" />
                <span>فريق الامتثال والدعم القانوني المالي</span>
              </span>
              <h4 className="text-base sm:text-lg font-black text-ink-primary dark:text-dark-ink-primary">
                هل لديك استفسار قانوني أو صفقة خاصة ترغب ببحثها؟
              </h4>
              <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                مستشارونا العقاريون والماليون متواجدون لمساعدتك في تدقيق الصكوك، صياغة عروض الشراء، وتسهيل الإفراغ البنكي المعتمد.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <Link
                href="/pages/calculator"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken hover:bg-surface-border/50 text-xs font-bold text-ink-primary dark:text-dark-ink-primary border border-surface-border dark:border-dark-surface-border transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-accent" />
                <span>حاسبة السعي 2.5%</span>
              </Link>

              <Link
                href="/pages/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all"
              >
                <span>تواصل معنا الآن</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
