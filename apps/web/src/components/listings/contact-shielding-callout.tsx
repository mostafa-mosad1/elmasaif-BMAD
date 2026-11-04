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
    <Card
      sunken
      className={`p-4 flex items-start gap-3 ${className}`}
      data-testid="contact-shielding-callout"
    >
      <span className="shrink-0 w-9 h-9 rounded-card bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center border border-primary/20">
        <ShieldCheck className="w-5 h-5" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary mb-1">
          حماية بيانات البائع
        </h3>
        <p className="text-xs leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          تبقى بيانات التواصل المباشرة للبائع (الجوال والبريد) محجوبة تماماً عبر المنصة ولا
          تُكشف إلا بعد إتمام الصفقة.
        </p>
      </div>
    </Card>
  );
}
