'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDirection } from '../providers/direction-provider';
import { SupportedLocale } from '@elmasaif/shared';
import { Building2, ShieldCheck, FileCheck, Scale, Lock, LifeBuoy } from 'lucide-react';
import { SupportTicketModal } from '../support/support-ticket-modal';

export function Footer() {
  const { locale } = useDirection();
  const isArabic = locale === SupportedLocale.AR;
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  return (
    <footer className="w-full border-t border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base text-ink-primary dark:text-dark-ink-primary transition-colors duration-200">
      {/* Regulatory Trust Marks Banner */}
      <div className="border-b border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/pages/rega-licenses" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-base/60 dark:hover:bg-dark-surface-base/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{isArabic ? 'رخصة فال العقارية' : 'REGA Fal License'}</h4>
                <p className="text-xs text-ink-muted dark:text-dark-ink-muted">{isArabic ? 'وساطة معتمدة رقم 1200028491' : 'Certified Brokerage #1200028491'}</p>
              </div>
            </Link>

            <Link href="/pages/rega-licenses" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-base/60 dark:hover:bg-dark-surface-base/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{isArabic ? 'الهيئة العامة للعقار' : 'Real Estate General Authority'}</h4>
                <p className="text-xs text-ink-muted dark:text-dark-ink-muted">{isArabic ? 'مطابق لضوابط الإعلانات العقارية' : 'Compliant with Advertising Regulations'}</p>
              </div>
            </Link>

            <Link href="/pages/calculator" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-base/60 dark:hover:bg-dark-surface-base/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold group-hover:text-accent-dark transition-colors">{isArabic ? 'نظام التحويل البنكي المزدوج' : 'Dual Wire Transfer System'}</h4>
                <p className="text-xs text-ink-muted dark:text-dark-ink-muted">{isArabic ? 'فصل عمولة المنصة عن ثمن العقار' : 'Segregated Fee & Purchase Price'}</p>
              </div>
            </Link>

            <Link href="/pages/privacy-policy" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-base/60 dark:hover:bg-dark-surface-base/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{isArabic ? 'حماية البيانات الشخصية PDPL' : 'PDPL Data Protection'}</h4>
                <p className="text-xs text-ink-muted dark:text-dark-ink-muted">{isArabic ? 'بيانات سيادية مشفرة ومحمية' : 'Encrypted Sovereign Data'}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-DEFAULT bg-primary flex items-center justify-center text-primary-foreground group-hover:bg-primary-hover transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-ink-primary dark:text-dark-ink-primary">
                {isArabic ? 'المصايف' : 'Elmasaif'}
              </span>
            </Link>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              {isArabic
                ? 'السوق العقاري المؤسسي الموثوق لصفقات البيع والشراء في المملكة العربية السعودية، مدعومًا بأنظمة التحقق والتراخيص المعتمدة.'
                : 'The institutional real estate marketplace for accredited sales and acquisitions in Saudi Arabia, governed by official verification and licensing standards.'}
            </p>
          </div>

          {/* Links Col 1 */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-ink-primary dark:text-dark-ink-primary">
              {isArabic ? 'المنصة' : 'Platform'}
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <li><Link href="/properties" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'تصفح كافة العقارات' : 'All Properties'}</Link></li>
              <li><Link href="/pages/buyer-guide" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'دليل المشتري والمستثمر' : 'Buyer Guide'}</Link></li>
              <li><Link href="/pages/marketer-guide" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'دليل المسوق والوسيط' : 'Marketer Guide'}</Link></li>
              <li><Link href="/pages/calculator" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'حاسبة العمولة والرسوم' : 'Commission Calculator'}</Link></li>
            </ul>
          </div>

          {/* Links Col 2 */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-ink-primary dark:text-dark-ink-primary">
              {isArabic ? 'الامتثال والتشريعات' : 'Compliance & Legal'}
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <li><Link href="/pages/rega-licenses" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'تراخيص الهيئة العامة للعقار' : 'REGA Licenses'}</Link></li>
              <li><Link href="/pages/terms-of-service" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'الشروط والأحكام' : 'Terms & Conditions'}</Link></li>
              <li><Link href="/pages/privacy-policy" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'سياسة حماية البيانات PDPL' : 'Privacy Policy (PDPL)'}</Link></li>
              <li><Link href="/pages/brokerage-contracts" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'عقود الوساطة الإلكترونية' : 'Brokerage Contracts'}</Link></li>
            </ul>
          </div>

          {/* Links Col 3 */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-ink-primary dark:text-dark-ink-primary">
              {isArabic ? 'المساعدة والدعم' : 'Support'}
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <li>
                <button
                  type="button"
                  onClick={() => setSupportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-accent hover:underline font-semibold transition-colors cursor-pointer"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'فتح تذكرة دعم ومساعدة' : 'Submit Support Ticket'}</span>
                </button>
              </li>
              <li><Link href="/pages/contact" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'مركز مساعدة المستفيدين' : 'Support Center'}</Link></li>
              <li><Link href="/pages/faq" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'الأسئلة المتكررة' : 'FAQs'}</Link></li>
              <li><Link href="/pages/contact" className="hover:text-primary dark:hover:text-primary-light transition-colors">{isArabic ? 'قنوات الاتصال المعتمدة' : 'Official Channels'}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Copyright */}
        <div className="mt-12 pt-8 border-t border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted dark:text-dark-ink-muted gap-4">
          <p>
            {isArabic
              ? '© 2026 منصة المصايف العقارية. جميع الحقوق محفوظة في المملكة العربية السعودية.'
              : '© 2026 Elmasaif Real Estate Platform. All rights reserved across the Kingdom of Saudi Arabia.'}
          </p>
          <div className="flex items-center gap-6">
            <span>{isArabic ? 'نظام معتمد' : 'Enterprise Verified'}</span>
            <span className="font-mono-numbers">v1.0.0</span>
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
