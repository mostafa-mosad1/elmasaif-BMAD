import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../ui';

export interface ContactShieldingCalloutProps {
  className?: string;
}

/**
 * Institutional reminder that the seller's direct contact stays shielded by the platform
 * until deal completion (BR-06 / FR-18). Purely presentational — no contact data is rendered.
 */
export function ContactShieldingCallout({
  className = '',
}: ContactShieldingCalloutProps) {
  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-transparent dark:from-emerald-500/[0.08] dark:via-transparent dark:to-transparent border border-emerald-500/25 dark:border-emerald-500/30 flex items-start gap-3.5 transition-all shadow-sm ${className}`}
      data-testid="contact-shielding-callout"
    >
      <span className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
        <ShieldCheck className="w-5 h-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          حماية بيانات البائع
        </h3>
        <p className="text-xs leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          تبقى بيانات التواصل المباشرة للبائع (الجوال والبريد) محجوبة تماماً عبر المنصة ولا
          تُكشف إلا بعد إتمام الصفقة.
        </p>
      </div>
    </div>
  );
}
