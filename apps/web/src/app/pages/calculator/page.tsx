'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { Card, Badge, Button } from '../../../components/ui';
import {
  Banknote,
  ShieldCheck,
  Building2,
  CheckCircle2,
  ArrowRight,
  Info,
  Scale,
  Lock,
} from 'lucide-react';
import { formatSar } from '../../../components/listings/commission-calculator';

export default function CommissionCalculatorPage() {
  const [dealPriceInput, setDealPriceInput] = useState<string>('1500000');

  const dealPrice = Number(dealPriceInput) || 0;
  // REGA Regulations: Platform brokerage commission is 2.5%
  const commissionRate = 0.025;
  const platformCommission = dealPrice * commissionRate;
  // VAT 15% applied only on the platform commission (not on property purchase price)
  const vatRate = 0.15;
  const vatAmount = platformCommission * vatRate;
  const totalCommissionWithVat = platformCommission + vatAmount;
  const netSellerPrice = dealPrice;
  const grandTotal = netSellerPrice + totalCommissionWithVat;

  return (
    <LayoutShell>
      <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-10" dir="rtl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
          <Link href="/" className="hover:text-primary transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <span className="text-ink-primary dark:text-dark-ink-primary font-medium">
            حاسبة العمولة والرسوم العقارية
          </span>
        </div>

        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2">
            <Badge
              variant="verified"
              size="md"
              icon={<Scale className="w-4 h-4 text-accent" />}
            >
              مطابق لضوابط الهيئة العامة للعقار (REGA)
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
            حاسبة العمولة والسعي العقاري
          </h1>
          <p className="text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            احسب التكاليف المالية وسعي الوساطة العقارية (2.5%) وضريبة القيمة المضافة بشفافية تامة وفق نموذج التحويل البنكي المزدوج المعتمد.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inputs Section */}
          <div className="lg:col-span-5 bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 shadow-sm space-y-6">
            <div className="space-y-1 border-b border-surface-border dark:border-dark-surface-border pb-4">
              <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                <span>إدخال قيمة الصفقة</span>
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                حدد السعر المتفق عليه للعقار لحساب تفاصيل السعي والضريبة.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                سعر العقار الإجمالي (ريال سعودي)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={dealPriceInput}
                  onChange={(e) => setDealPriceInput(e.target.value)}
                  placeholder="مثال: 1,500,000"
                  className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl px-4 py-3 text-lg font-bold text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted">
                  ر.س
                </span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-ink-muted block">
                مبالغ شائعة للمعاينة:
              </span>
              <div className="flex flex-wrap gap-2">
                {['500000', '1000000', '2500000', '5000000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDealPriceInput(amt)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-surface-border hover:border-primary/40 text-ink-secondary hover:text-primary transition-colors font-mono"
                  >
                    {formatSar(Number(amt))}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 text-xs text-ink-secondary space-y-2">
              <div className="font-bold text-primary flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>الضوابط النظامية للسعي:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-ink-secondary">
                <li>عمولة الوساطة محددة بـ 2.5% من إجمالي ثمن العقار.</li>
                <li>ضريبة القيمة المضافة (15%) تطبق حصراً على مبلغ العمولة وليس على كامل ثمن العقار.</li>
                <li>التحويل يتم مباشرة من حساب المشتري عبر نظام التحويل المزدوج.</li>
              </ul>
            </div>
          </div>

          {/* Results Summary Section */}
          <div className="lg:col-span-7 bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary border-b border-surface-border dark:border-dark-surface-border pb-4">
              التفصيل المالي لنموذج التحويل المزدوج
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Leg 1: Platform Commission */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    الدفعة الأولى (المنصة)
                  </span>
                  <span className="text-xs text-ink-muted">سعي + ضريبة</span>
                </div>
                <div>
                  <div className="text-xs text-ink-secondary">سعي الوساطة (2.5%):</div>
                  <div className="text-base font-bold font-mono text-ink-primary">
                    {formatSar(platformCommission)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-ink-secondary">ضريبة القيمة المضافة (15%):</div>
                  <div className="text-sm font-semibold font-mono text-ink-muted">
                    {formatSar(vatAmount)}
                  </div>
                </div>
                <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">المجموع لحساب المنصة:</span>
                  <span className="text-base font-bold font-mono text-primary">
                    {formatSar(totalCommissionWithVat)}
                  </span>
                </div>
              </div>

              {/* Leg 2: Seller Net Purchase Price */}
              <div className="p-4 rounded-xl border border-accent/30 bg-accent-light/40 dark:bg-accent/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent-dark dark:text-accent bg-accent-light dark:bg-accent/20 px-2.5 py-0.5 rounded-full">
                    الدفعة الثانية (البائع)
                  </span>
                  <span className="text-xs text-ink-muted">ثمن العقار الصافي</span>
                </div>
                <div>
                  <div className="text-xs text-ink-secondary">المبلغ المحول لحساب المالك:</div>
                  <div className="text-xl font-bold font-mono text-accent-dark dark:text-accent mt-1">
                    {formatSar(netSellerPrice)}
                  </div>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed pt-2">
                  يتحول مباشرة من بنك المشتري إلى آيبان البائع المعتمد دون أي استقطاع من ثمن العقار.
                </p>
              </div>
            </div>

            {/* Total Grand Card */}
            <div className="p-5 rounded-xl border-2 border-primary bg-primary text-white space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold opacity-90">
                  إجمالي المبلغ المدفوع من المشتري لإتمام الصفقة:
                </span>
                <span className="text-2xl font-extrabold font-mono">
                  {formatSar(grandTotal)}
                </span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed pt-1">
                يشمل قيمة العقار بالكامل + سعي الوساطة المعتمد + ضريبة القيمة المضافة على السعي.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Link
                href="/properties"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors"
              >
                <span>تصفح العقارات المتاحة للبيع الآن</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Link>

              <Link
                href="/pages/terms-of-service"
                className="text-xs font-semibold text-primary hover:underline"
              >
                الاطلاع على الشروط واللوائح المالية
              </Link>
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}

