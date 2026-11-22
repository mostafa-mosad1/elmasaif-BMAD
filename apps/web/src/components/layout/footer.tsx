'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDirection } from '../providers/direction-provider';
import { SupportedLocale } from '@elmasaif/shared';
import { 
  Building2, 
  ShieldCheck, 
  FileCheck, 
  Scale, 
  Lock, 
  LifeBuoy, 
  ArrowUpLeft, 
  ArrowUpRight,
  Landmark,
  BadgeCheck
} from 'lucide-react';
import { SupportTicketModal } from '../support/support-ticket-modal';

export function Footer() {
  const { locale } = useDirection();
  const isArabic = locale === SupportedLocale.AR;
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const trustBadges = [
    {
      title: isArabic ? 'رخصة فال العقارية' : 'REGA Fal License',
      desc: isArabic ? 'وساطة وتسويق معتمد برقم 1200028491' : 'Certified Brokerage #1200028491',
      tag: isArabic ? 'معتمد رسمياً' : 'Official License',
      href: '/pages/rega-licenses',
      icon: ShieldCheck,
    },
    {
      title: isArabic ? 'الهيئة العامة للعقار' : 'REGA Compliance',
      desc: isArabic ? 'مطابق لاشتراطات وضوابط الإعلانات والموثوقية' : 'Compliant with Ad & Listing Regulations',
      tag: isArabic ? 'امتثال تشريعي' : 'Full Compliance',
      href: '/pages/rega-licenses',
      icon: Scale,
    },
    {
      title: isArabic ? 'نظام التحويل البنكي المزدوج' : 'Direct Bank Settlement',
      desc: isArabic ? 'فصل عمولة المنصة عن ثمن العقار بحسابات مباشرة' : 'Zero-Holding Platform vs Property Accounts',
      tag: isArabic ? 'أمان مالي' : 'Secure Escrow',
      href: '/pages/calculator',
      icon: Landmark,
    },
    {
      title: isArabic ? 'حماية البيانات وتدقيق الصكوك' : 'Deed Verification & PDPL',
      desc: isArabic ? 'فحص صكوك فوري وتشفير سيادي للبيانات' : 'Instant Deed Check & Sovereign PDPL Data',
      tag: isArabic ? 'أمان سيادي' : 'PDPL Protected',
      href: '/pages/privacy-policy',
      icon: FileCheck,
    },
  ];

  return (
    <footer className="w-full border-t border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base text-ink-primary dark:text-dark-ink-primary transition-colors duration-200">
      {/* Regulatory Trust Marks Banner (تصميم فخم، عصري، متناسق مع الهوية الذهبية) */}
      <div className="relative border-b border-surface-border/70 dark:border-dark-surface-border/70 py-7 sm:py-8 bg-gradient-to-b from-surface-sunken/40 via-surface-base to-surface-sunken/20 dark:from-dark-surface-raised/20 dark:via-dark-surface-base dark:to-dark-surface-raised/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Bar with Live Compliance Pulse */}
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tracking-wide">
                {isArabic ? 'منظومة الامتثال والتوثيق العقاري المعتمد' : 'Accredited Saudi Real Estate & Security Framework'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-muted dark:text-dark-ink-muted">
              <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isArabic ? 'مرخص من الهيئة العامة للعقار' : 'Licensed by REGA'}</span>
            </div>
          </div>

          {/* Luxury Micro-Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {trustBadges.map((badge, idx) => {
              const Icon = badge.icon;
              return (
                <Link
                  key={idx}
                  href={badge.href}
                  className="group relative p-4 rounded-2xl bg-surface/90 dark:bg-dark-surface-raised/70 border border-surface-border/80 dark:border-dark-surface-border/80 hover:border-amber-500/50 dark:hover:border-amber-400/50 hover:bg-surface dark:hover:bg-dark-surface-raised hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  {/* Subtle hover background highlight */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Card Header: Icon & Tag */}
                  <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-amber-600 group-hover:text-white dark:group-hover:text-slate-950 group-hover:scale-105 group-hover:border-transparent transition-all duration-300 shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-sunken/80 dark:bg-dark-surface-sunken text-ink-muted dark:text-dark-ink-secondary border border-surface-border/60 dark:border-dark-surface-border/60 group-hover:border-amber-500/30 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                      {badge.tag}
                    </span>
                  </div>

                  {/* Card Typography */}
                  <div className="relative z-10">
                    <h4 className="text-xs sm:text-[13px] font-bold text-ink-primary dark:text-dark-ink-primary group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center justify-between gap-1">
                      <span className="truncate">{badge.title}</span>
                      {isArabic ? (
                        <ArrowUpLeft className="w-3.5 h-3.5 shrink-0 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-amber-600 dark:text-amber-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-amber-600 dark:text-amber-400" />
                      )}
                    </h4>
                    <p className="text-[11px] text-ink-muted dark:text-dark-ink-secondary mt-1 leading-snug line-clamp-2">
                      {badge.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 sm:pt-16 sm:pb-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-10">
          {/* Brand Col with Official Logo */}
          <div className="lg:col-span-4 space-y-5">
            <Link href="/" className="inline-block group focus:outline-none">
              <img
                src="/images/logo.png"
                alt={isArabic ? 'المصايف - عقارات بكل ثقة' : 'El Masaif Real Estate'}
                className="h-16 sm:h-20 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              />
            </Link>
            <p className="text-sm sm:text-[15px] text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-sm">
              {isArabic
                ? 'السوق العقاري المؤسسي الموثوق لصفقات البيع والشراء في المملكة العربية السعودية، مدعومًا بأنظمة التحقق والتراخيص المعتمدة.'
                : 'The institutional real estate marketplace for accredited sales and acquisitions in Saudi Arabia, governed by official verification and licensing standards.'}
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-ink-muted dark:text-dark-ink-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                {isArabic
                  ? 'منصة وساطة معتمدة بموجب الأنظمة واللوائح السعودية'
                  : 'Certified brokerage platform under Saudi regulations'}
              </span>
            </div>
          </div>

          {/* Links Col 1: Platform */}
          <div className="lg:col-span-2">
            <h4 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-5 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-amber-500" />
              <span>{isArabic ? 'المنصة' : 'Platform'}</span>
            </h4>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link
                  href="/properties"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'تصفح كافة العقارات' : 'All Properties'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/buyer-guide"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'دليل المشتري والمستثمر' : 'Buyer Guide'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/marketer-guide"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'دليل المسوق والوسيط' : 'Marketer Guide'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/calculator"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'حاسبة العمولة والرسوم' : 'Commission Calculator'}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Col 2: Legal & Compliance */}
          <div className="lg:col-span-3">
            <h4 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-5 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-amber-500" />
              <span>{isArabic ? 'الامتثال والتشريعات' : 'Compliance & Legal'}</span>
            </h4>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link
                  href="/pages/rega-licenses"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'تراخيص الهيئة العامة للعقار' : 'REGA Licenses'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/terms-of-service"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'الشروط والأحكام' : 'Terms & Conditions'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/privacy-policy"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'سياسة حماية البيانات PDPL' : 'Privacy Policy (PDPL)'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pages/brokerage-contracts"
                  className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                  <span>{isArabic ? 'عقود الوساطة الإلكترونية' : 'Brokerage Contracts'}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Col 3: Support & Help */}
          <div className="lg:col-span-3">
            <h4 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-5 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-amber-500" />
              <span>{isArabic ? 'المساعدة والدعم' : 'Support'}</span>
            </h4>
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => setSupportModalOpen(true)}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-white dark:hover:text-slate-950 font-bold text-sm border border-amber-500/25 transition-all duration-200 shadow-2xs cursor-pointer group"
                >
                  <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:text-white dark:group-hover:text-slate-950 transition-colors" />
                  <span>{isArabic ? 'فتح تذكرة دعم ومساعدة' : 'Submit Support Ticket'}</span>
                </button>
              </div>

              <ul className="space-y-3.5 text-sm pt-1">
                <li>
                  <Link
                    href="/pages/contact"
                    className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                  >
                    <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                    <span>{isArabic ? 'مركز مساعدة المستفيدين' : 'Support Center'}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pages/faq"
                    className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                  >
                    <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                    <span>{isArabic ? 'الأسئلة المتكررة' : 'FAQs'}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pages/contact"
                    className="group inline-flex items-center gap-2 text-ink-secondary dark:text-dark-ink-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:translate-x-[-3px] transition-all duration-200"
                  >
                    <span className="w-1 h-1 rounded-full bg-surface-border dark:bg-dark-surface-border group-hover:bg-amber-500 transition-colors" />
                    <span>{isArabic ? 'قنوات الاتصال المعتمدة' : 'Official Channels'}</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Legal Copyright */}
        <div className="mt-14 pt-8 border-t border-surface-border/80 dark:border-dark-surface-border/80 flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm text-ink-muted dark:text-dark-ink-muted gap-4">
          <p className="text-center sm:text-start leading-relaxed">
            {isArabic
              ? '© 2026 منصة المصايف العقارية. جميع الحقوق محفوظة في المملكة العربية السعودية.'
              : '© 2026 Elmasaif Real Estate Platform. All rights reserved across the Kingdom of Saudi Arabia.'}
          </p>
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary font-medium text-xs border border-surface-border/60 dark:border-dark-surface-border/60">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isArabic ? 'نظام معتمد' : 'Enterprise Verified'}</span>
            </span>
            <span className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted">v1.0.0</span>
          </div>
        </div>
      </div>

      <SupportTicketModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
      />
    </footer>
  );
}
