'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  MapPin,
  Search,
  CheckCircle2,
  FileCheck,
  Banknote,
  Lock,
  Sparkles,
  ChevronLeft,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { LayoutShell } from '../components/layout';
import { Button, Badge, Card, EmptyState } from '../components/ui';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [showEmptyStateDemo, setShowEmptyStateDemo] = useState(false);

  const categories = [
    'الكل',
    'فلل وقصور',
    'أراضي استثمارية',
    'شقق تمليك',
    'عمائر سكنية',
    'عقارات تجارية',
  ];

  return (
    <LayoutShell>
      {/* Hero Section */}
      <section className="relative pt-8 pb-16 sm:pt-12 sm:pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Institutional Trust Badge */}
          <div className="inline-flex items-center gap-2 mb-6">
            <Badge
              variant="verified"
              size="md"
              icon={<ShieldCheck className="w-4 h-4 text-status-verified" />}
            >
              مرخص ومعتمد وفق أنظمة الهيئة العامة للعقار (REGA)
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-ink-primary dark:text-dark-ink-primary leading-tight tracking-tight">
            السوق المؤسسي الموثوق <br />
            <span className="text-primary dark:text-primary-light">لصفقات بيع العقارات</span> في السعودية
          </h1>

          <p className="mt-5 text-base sm:text-lg text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-2xl mx-auto">
            منظومة وساطة عقارية محكومة لحماية المشترين والملاك والوسطاء المرخصين. مفاوضات رسمية ملزمة، تدقيق حكومي فوري، وتحويلات بنكية مباشرة بدون حجز أموال.
          </p>
        </div>

        {/* Main Search Panel */}
        <div className="mt-10 max-w-4xl mx-auto bg-surface-base dark:bg-dark-surface-base rounded-2xl shadow-level2 border border-surface-border dark:border-dark-surface-border p-4 sm:p-6 text-start">
          <div className="flex items-center gap-2 border-b border-surface-border dark:border-dark-surface-border pb-4 mb-5 overflow-x-auto">
            {categories.map((tab, idx) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSelectedCategory(idx);
                  if (idx === 5) {
                    setShowEmptyStateDemo(true);
                  } else {
                    setShowEmptyStateDemo(false);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-DEFAULT text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === idx
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                المدينة أو المنطقة
              </label>
              <select className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-DEFAULT px-3 py-2 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option>الرياض (العاصمة)</option>
                <option>جدة (عروس البحر)</option>
                <option>الدمام والخبر</option>
                <option>مكة المكرمة</option>
                <option>المدينة المنورة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                نوع العقار
              </label>
              <select className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-DEFAULT px-3 py-2 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option>فيلا سكنية</option>
                <option>قطعة أرض</option>
                <option>شقة فاخرة</option>
                <option>عمارة تجارية</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                الميزانية التقريبية
              </label>
              <select className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-DEFAULT px-3 py-2 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option>أي سعر</option>
                <option>1,000,000 - 3,000,000 ر.س</option>
                <option>3,000,000 - 6,000,000 ر.س</option>
                <option>أكثر من 6,000,000 ر.س</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="primary"
                size="md"
                className="w-full py-2.5"
                onClick={() => setShowEmptyStateDemo(!showEmptyStateDemo)}
              >
                <Search className="w-4 h-4" />
                <span>بحث في العقارات</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Pillars Row */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-start">
          <Card className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-status-verifiedBg text-status-verified flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">رخص فال المعتمدة</h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
                حظر الوسطاء غير المرخصين وحصر التسويق على رخص الهيئة العامة للعقار الرسمية.
              </p>
            </div>
          </Card>

          <Card className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">قناة وساطة محمية</h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
                حجب قنوات الاتصال الشخصية لمنع الصيد والتخطي حتى يتم توثيق واعتماد الصفقة.
              </p>
            </div>
          </Card>

          <Card className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">تحويل بنكي مباشر</h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
                قيمة العقار تتحول مباشرة لحساب البائع بدون احتجاز أموال الملايين في وسيط رقمي.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Zero-Result Institutional Empty State Demonstration Section (AC 5) */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary dark:text-primary-light text-sm font-semibold mb-1">
              <SlidersHorizontal className="w-4 h-4 text-accent" />
              <span>معاينة المكونات المؤسسية</span>
            </div>
            <h2 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              حالات البحث الصفري (Institutional Zero-Result State)
            </h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmptyStateDemo(!showEmptyStateDemo)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{showEmptyStateDemo ? 'إخفاء المعاينة' : 'عرض حالة البحث الصفري'}</span>
          </Button>
        </div>

        {showEmptyStateDemo ? (
          <EmptyState
            title="لا توجد صفقات مطابقة للمحددات الحالية"
            description="لم نتمكن من العثور على أي عقارات تطابق معايير التصفية المحددة. يرجى تجربة توسيع نطاق البحث أو إعادة تعيين الفلاتر."
            actionLabel="إعادة ضبط الفلاتر"
            onAction={() => {
              setSelectedCategory(0);
              setShowEmptyStateDemo(false);
            }}
            secondaryActionLabel="تقديم طلب شراء مخصص"
            secondaryActionHref="/#demands"
          />
        ) : (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-surface-border dark:border-dark-surface-border text-xs text-ink-muted dark:text-dark-ink-muted">
            انقر على «عرض حالة البحث الصفري» أو اختر تصنيف «عقارات تجارية» بالأعلى لمعاينة تصميم المكون السيادي للنتائج الصفرية.
          </div>
        )}
      </section>

      {/* Featured Verified Listings */}
      <section id="listings" className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary dark:text-primary-light text-sm font-semibold mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>عقارات مميزة ومدققة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-primary dark:text-dark-ink-primary">
              أحدث صفقات البيع المتاحة حالياً
            </h2>
          </div>
          <Link
            href="/#listings"
            className="text-sm font-semibold text-primary dark:text-primary-light hover:underline flex items-center gap-1 group"
          >
            <span>استعراض كافة العقارات</span>
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <Card hoverEffect className="overflow-hidden flex flex-col p-0">
            <div className="relative aspect-[16/10] bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-primary-light text-sm font-medium">
                صورة العقار (فيلا مودرن في النرجس)
              </div>
              <div className="absolute top-3 right-3 z-20">
                <Badge variant="verified" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5 text-status-verified" />}>
                  معلن مرخص (فال)
                </Badge>
              </div>
              <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-pill text-xs font-mono">
                1/12
              </div>
              <div className="absolute bottom-3 right-3 z-20 text-white font-mono-numbers text-xl font-bold">
                3,200,000 <span className="text-xs font-sans font-normal">ر.س</span>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2">
                  <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                  <span>الرياض، حي النرجس</span>
                </div>
                <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary line-clamp-1">
                  فيلا درج صالة مودرن مع مسبح ومصعد
                </h3>
                <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm font-mono-numbers">450 م²</span>
                    المساحة
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">5 غرف</span>
                    الغرف
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">6 دورات</span>
                    المياه
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between">
                <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  سعي المنصة: <span className="font-bold text-primary dark:text-primary-light font-mono-numbers">80,000 ر.س</span>
                </div>
                <Button variant="outline" size="sm">
                  تقديم عرض
                </Button>
              </div>
            </div>
          </Card>

          {/* Card 2 */}
          <Card hoverEffect className="overflow-hidden flex flex-col p-0">
            <div className="relative aspect-[16/10] bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-primary-light text-sm font-medium">
                صورة العقار (أرض تجارية بالخبر)
              </div>
              <div className="absolute top-3 right-3 z-20">
                <Badge variant="verified" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5 text-status-verified" />}>
                  معلن مرخص (فال)
                </Badge>
              </div>
              <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-pill text-xs font-mono">
                1/6
              </div>
              <div className="absolute bottom-3 right-3 z-20 text-white font-mono-numbers text-xl font-bold">
                4,850,000 <span className="text-xs font-sans font-normal">ر.س</span>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2">
                  <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                  <span>الخبر، حي الشاطئ</span>
                </div>
                <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary line-clamp-1">
                  أرض تجارية سكنية على شارعين رئيسيين
                </h3>
                <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm font-mono-numbers">920 م²</span>
                    المساحة
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">تجاري/سكني</span>
                    الاستخدام
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm font-mono-numbers">30 م</span>
                    عرض الشارع
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between">
                <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  سعي المنصة: <span className="font-bold text-primary dark:text-primary-light font-mono-numbers">121,250 ر.س</span>
                </div>
                <Button variant="outline" size="sm">
                  تقديم عرض
                </Button>
              </div>
            </div>
          </Card>

          {/* Card 3 */}
          <Card hoverEffect className="overflow-hidden flex flex-col p-0">
            <div className="relative aspect-[16/10] bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <div className="w-full h-full bg-stone-900 flex items-center justify-center text-primary-light text-sm font-medium">
                صورة العقار (مكتب تجاري في جدة)
              </div>
              <div className="absolute top-3 right-3 z-20">
                <Badge variant="pending" size="sm" icon={<Building2 className="w-3.5 h-3.5 text-status-pending" />}>
                  عرض مالك مباشر
                </Badge>
              </div>
              <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-pill text-xs font-mono">
                1/8
              </div>
              <div className="absolute bottom-3 right-3 z-20 text-white font-mono-numbers text-xl font-bold">
                1,850,000 <span className="text-xs font-sans font-normal">ر.س</span>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2">
                  <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                  <span>جدة، حي الروضة</span>
                </div>
                <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary line-clamp-1">
                  مكتب تجاري مؤثث بالكامل في برج تنفيذي
                </h3>
                <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm font-mono-numbers">210 م²</span>
                    المساحة
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">الدور 6</span>
                    الطابق
                  </div>
                  <div>
                    <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">3 مواقف</span>
                    المواقف
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between">
                <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  سعي المنصة: <span className="font-bold text-primary dark:text-primary-light font-mono-numbers">46,250 ر.س</span>
                </div>
                <Button variant="outline" size="sm">
                  تقديم عرض
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Dual Wire Transfer Transparency Banner */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 sm:p-10 shadow-level1">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold text-primary dark:text-primary-light bg-primary-light dark:bg-primary-dark/30 px-3 py-1 rounded-pill border border-primary/20">
              هندسة الأمان المالي
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-primary dark:text-dark-ink-primary mt-3">
              نموذج التحويل البنكي المزدوج (Dual Wire Transfer)
            </h2>
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-2 leading-relaxed">
              حرصاً على الامتثال للأنظمة المالية السعودية، لا تحتجز منصة المصايف أموال شراء العقار في محافظ إلكترونية، بل تتم الحوالات مباشرة بين الحسابات البنكية الرسمية:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment 1 */}
            <div className="p-5 rounded-xl border border-primary/30 bg-primary-light/40 dark:bg-primary-dark/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded">
                    الدفعة الأولى
                  </span>
                  <span className="text-xs font-bold text-primary dark:text-primary-light">سعي المنصة (2.5%)</span>
                </div>
                <h4 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mt-3">
                  حوالة إلى حساب منصة المصايف
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
                  يتم تحويل نسبة عمولة الوساطة (2.5%) مباشرة إلى آيبان المنصة الرسمي مع تضمين رمز مرجع الصفقة الصادر إلكترونياً (مثل: <code className="font-mono-numbers bg-surface-base dark:bg-dark-surface-base px-1.5 py-0.5 rounded border border-surface-border dark:border-dark-surface-border text-primary dark:text-primary-light">ELM-408-C</code>).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-primary/20 flex items-center gap-2 text-xs text-primary dark:text-primary-light font-semibold">
                <CheckCircle2 className="w-4 h-4 text-status-verified" />
                <span>تدقيق إداري فوري لإيصال السعي</span>
              </div>
            </div>

            {/* Payment 2 */}
            <div className="p-5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary bg-surface-border dark:bg-dark-surface-border px-2 py-0.5 rounded">
                    الدفعة الثانية
                  </span>
                  <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">قيمة العقار الصافية</span>
                </div>
                <h4 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mt-3">
                  حوالة مباشرة إلى حساب البائع
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
                  يقوم المشتري بتحويل قيمة العقار المتفق عليها مباشرة من حسابه البنكي إلى آيبان البائع المعتمد والموثق لدى المنصة (مالك مباشر أو وسيط مرخص).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary font-semibold">
                <CheckCircle2 className="w-4 h-4 text-status-verified" />
                <span>فك حجب بيانات البائع بعد اكتمال التدقيق للإفراغ</span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
              مهلة إيداع الإيصالات هي 48 ساعة من تاريخ الموافقة النهائية مع تمديد إداري تلقائي فور رفع الإيصالات.
            </span>
          </div>
        </div>
      </section>
    </LayoutShell>
  );
}
