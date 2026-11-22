'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Gavel,
  ShieldCheck,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export function MarketplaceAppHero() {
  const router = useRouter();

  return (
    <section className="relative pt-6 pb-12 sm:pt-10 sm:pb-16 overflow-hidden">
      {/* Floating Keyframe Animations */}
      <style>{`
        @keyframes floatCard1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes floatCard2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(-1.5deg); }
        }
        @keyframes floatCard3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(0.8deg); }
        }
        .animate-float-1 {
          animation: floatCard1 4.5s ease-in-out infinite;
          will-change: transform;
        }
        .animate-float-2 {
          animation: floatCard2 5.5s ease-in-out infinite 0.8s;
          will-change: transform;
        }
        .animate-float-3 {
          animation: floatCard3 5s ease-in-out infinite 1.6s;
          will-change: transform;
        }
      `}</style>

      {/* Ambient Lighting Background */}
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        {/* Right Column: Hero Content & Search */}
        <div className="lg:col-span-7 space-y-6 text-start">
          {/* Hero Trust Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 dark:bg-accent/15 border border-accent/25 text-accent text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <ShieldCheck className="w-4 h-4 shrink-0 text-accent" />
            <span>منصة وساطة معتمدة برخص فال العقارية (REGA)</span>
          </div>

          {/* Heading with Elegant Gold Gradient */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-ink-primary dark:text-dark-ink-primary leading-[1.28] tracking-tight">
            <span>اكتشف عقارك المثالي</span>{' '}
            <span className="bg-gradient-to-l from-amber-600 via-amber-500 to-amber-400 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500 bg-clip-text text-transparent block sm:inline font-black drop-shadow-xs">
              مع منصة المصايف
            </span>
          </h1>

          {/* Description */}
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-xl">
            وجهتك الموثوقة لصفقات البيع والاستثمار في أرقى الفلل والمصايف والفرص العقارية بالمملكة. تدقيق فوري للصكوك، عقود وساطة نظامية، وتجربة سلسة تحمي حقوقك بالكامل.
          </p>

          {/* Action Links & CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover text-white dark:text-slate-950 text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all hover:-translate-y-0.5"
            >
              <span>تصفح كافة العقارات والصفقات</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white text-xs sm:text-sm font-semibold transition-all hover:-translate-y-0.5"
            >
              <span>تسجيل وسيط أو مالك عقار</span>
            </Link>
          </div>

          {/* Stats Ribbon */}
          <div className="pt-4 border-t border-surface-border/60 dark:border-dark-surface-border/60 grid grid-cols-3 gap-4 max-w-lg">
            <div className="space-y-0.5">
              <div className="text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary tabular-nums">
                +10K
              </div>
              <div className="text-[11px] text-ink-muted">عقار مدرج وموثق</div>
            </div>

            <div className="space-y-0.5">
              <div className="text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary tabular-nums">
                +25K
              </div>
              <div className="text-[11px] text-ink-muted">مستخدم ومتعامل</div>
            </div>

            <div className="space-y-0.5">
              <div className="text-xl sm:text-2xl font-black text-accent tabular-nums">
                +1.4B <span className="text-[11px] font-normal text-ink-secondary">ر.س</span>
              </div>
              <div className="text-[11px] text-ink-muted">حجم الصفقات المدارة</div>
            </div>
          </div>
        </div>

        {/* Left Column: World-Class Institutional Real Estate Showcase Deck */}
        <div className="lg:col-span-5 relative flex items-center justify-center pt-8 pb-4 lg:py-0">
          {/* Ambient Decorative Light */}
          <div className="absolute w-80 h-80 bg-accent/15 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Floating Card 1: Verified Title Deed (Top-Start) */}
          <div className="animate-float-1 pointer-events-none absolute -top-4 -start-2 sm:start-0 z-20 p-3 rounded-2xl bg-surface/95 dark:bg-dark-surface-raised/95 backdrop-blur-md border border-surface-border dark:border-dark-surface-border shadow-level2 max-w-[220px]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold text-accent">تدقيق الصك العقاري</span>
                <strong className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                  صك إلكتروني موثق ونشط
                </strong>
              </div>
            </div>
          </div>

          {/* Floating Card 2: ROI Metric (Middle-End) */}
          <div className="animate-float-2 pointer-events-none absolute top-1/3 -end-3 sm:end-0 z-20 p-3 rounded-2xl bg-surface/95 dark:bg-dark-surface-raised/95 backdrop-blur-md border border-surface-border dark:border-dark-surface-border shadow-level2 max-w-[190px]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-medium text-ink-muted">عائد الاستثمار</span>
                <strong className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
                  +14.8% سنوياً
                </strong>
              </div>
            </div>
          </div>

          {/* Floating Card 3: Live Mediation / Active Offers (Bottom-Start) */}
          <div className="animate-float-3 pointer-events-none absolute -bottom-3 -start-2 sm:start-2 z-20 p-3 rounded-2xl bg-surface/95 dark:bg-dark-surface-raised/95 backdrop-blur-md border border-surface-border dark:border-dark-surface-border shadow-level2 max-w-[210px]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                <Gavel className="w-4 h-4 text-accent" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-accent">وساطة شراء مباشرة</span>
                <strong className="block text-xs font-black text-ink-primary dark:text-dark-ink-primary">
                  تم استلام ٣ عروض رسمية
                </strong>
              </div>
            </div>
          </div>

          {/* Main Luxury Deal Card (Professional Showcase Deck) */}
          <Link
            href="/properties"
            className="block w-full max-w-[380px] sm:max-w-[400px] rounded-3xl overflow-hidden bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-level3 relative group transition-all duration-300 hover:shadow-level4 hover:-translate-y-1 hover:border-accent/40 cursor-pointer"
          >
            {/* Real Estate Visual Header */}
            <div className="relative h-56 sm:h-64 bg-slate-900 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Status Top Badges */}
              <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/15">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>معتمد برخصة فال</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold">
                  متاح للتفاوض
                </span>
              </div>

              {/* Price & Location Bottom */}
              <div className="absolute bottom-3.5 inset-x-3.5 flex items-end justify-between text-white">
                <div>
                  <div className="flex items-center gap-1 text-[11px] text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>الرياض • حي النرجس</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                    ٣٬٢٠٠٬٠٠٠ <span className="text-xs font-normal text-white/70">ر.س</span>
                  </div>
                </div>

                <div className="text-end">
                  <span className="text-[10px] text-white/70 block">السعي النظامي</span>
                  <span className="text-xs font-bold text-accent font-mono">2.5% معتمد</span>
                </div>
              </div>
            </div>

            {/* Property Body Content */}
            <div className="p-4 sm:p-5 space-y-3.5 text-start">
              <div>
                <h3 className="text-sm sm:text-base font-black text-ink-primary dark:text-dark-ink-primary group-hover:text-accent transition-colors truncate">
                  فيلا مودرن ذكية مع مسبح خاص وتشطيبات فاخرة
                </h3>
                <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
                  مبنية وفق كود البناء السعودي مع ضمانات إنشائية وهندسية معتمدة.
                </p>
              </div>

              {/* Property Features Strip */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-surface-border/60 dark:border-dark-surface-border/60 text-center text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-ink-muted block">المساحة</span>
                  <strong className="text-ink-primary dark:text-dark-ink-primary font-mono font-bold">٤٥٠ م²</strong>
                </div>
                <div className="space-y-0.5 border-x border-surface-border/60 dark:border-dark-surface-border/60">
                  <span className="text-[10px] text-ink-muted block">الغرف</span>
                  <strong className="text-ink-primary dark:text-dark-ink-primary font-mono font-bold">٥ أجنحة</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-ink-muted block">عمر العقار</span>
                  <strong className="text-ink-primary dark:text-dark-ink-primary font-bold">جديد (٢٠٢٤)</strong>
                </div>
              </div>

              {/* Verified Broker Profile Footer */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                    س
                  </div>
                  <div className="text-start leading-tight">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">سعد الشمري</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className="text-[10px] text-ink-muted font-mono">فال #12000045</span>
                  </div>
                </div>

                <span
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken group-hover:bg-primary group-hover:text-white dark:group-hover:bg-accent dark:group-hover:text-slate-950 text-xs font-bold text-primary dark:text-accent transition-all duration-200"
                >
                  <span>تصفح كافة العقارات</span>
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
