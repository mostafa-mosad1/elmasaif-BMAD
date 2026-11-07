'use client';

import React from 'react';
import { ExternalLink, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import type { ReleasedPartyContact } from '@elmasaif/shared';
import { Card, CardContent } from '../ui';

export const DEAL_SELLER_CONTACT_TITLE_AR = 'بيانات التواصل المباشر مع البائع لإتمام الإفراغ';

export const DEAL_NOTARY_GUIDANCE_AR =
  'الخطوة التالية: التنسيق مع البائع وتوثيق إفراغ صك العقار لدى كاتب العدل أو عبر البوابة الإلكترونية لوزارة العدل (منصة ناجز).';

export interface DealSellerContactCardProps {
  sellerContact?: ReleasedPartyContact | null;
  className?: string;
}

export function DealSellerContactCard({ sellerContact, className }: DealSellerContactCardProps) {
  if (!sellerContact) return null;

  const phoneHref = `tel:${sellerContact.mobileNumber}`;
  const mailHref = sellerContact.email ? `mailto:${sellerContact.email}` : undefined;

  return (
    <Card
      className={`border-surface-borderStrong shadow-sm ${className ?? ''}`}
      data-testid="deal-seller-contact-card"
    >
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-4 dark:border-dark-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                {DEAL_SELLER_CONTACT_TITLE_AR}
              </h2>
              <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
                تم فك حجب بيانات التواصل بعد تأكيد التحويلات لإتمام الإفراغ
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-status-verifiedBg px-2.5 py-1 text-xs font-semibold text-status-verified">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            هوية موثقة
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Seller Name */}
          <div className="rounded-xl border border-surface-border bg-surface-ground p-4 dark:border-dark-surface-border dark:bg-dark-surface-ground">
            <span className="block text-xs text-ink-muted dark:text-dark-ink-muted">
              اسم البائع المعتمد
            </span>
            <span
              className="mt-1 block text-sm font-bold text-ink-primary dark:text-dark-ink-primary"
              data-testid="seller-contact-name"
            >
              {sellerContact.fullName}
            </span>
          </div>

          {/* Seller Phone */}
          <div className="rounded-xl border border-surface-border bg-surface-ground p-4 dark:border-dark-surface-border dark:bg-dark-surface-ground">
            <span className="block text-xs text-ink-muted dark:text-dark-ink-muted">
              رقم الجوال الموثق
            </span>
            <a
              href={phoneHref}
              dir="ltr"
              className="mt-1 inline-flex items-center gap-2 font-mono text-sm font-bold text-primary hover:underline"
              data-testid="seller-contact-phone"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {sellerContact.mobileNumber}
            </a>
          </div>

          {/* Seller Email */}
          {sellerContact.email ? (
            <div className="rounded-xl border border-surface-border bg-surface-ground p-4 sm:col-span-2 dark:border-dark-surface-border dark:bg-dark-surface-ground">
              <span className="block text-xs text-ink-muted dark:text-dark-ink-muted">
                البريد الإلكتروني
              </span>
              <a
                href={mailHref}
                dir="ltr"
                className="mt-1 inline-flex items-center gap-2 font-mono text-sm font-medium text-primary hover:underline"
                data-testid="seller-contact-email"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {sellerContact.email}
              </a>
            </div>
          ) : null}
        </div>

        {/* Notary Guidance Notice */}
        <div
          role="note"
          className="rounded-xl border border-accent/20 bg-accent-light/50 p-4 text-xs leading-relaxed text-ink-secondary dark:text-dark-ink-secondary"
        >
          <div className="flex items-start gap-2.5">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <p>{DEAL_NOTARY_GUIDANCE_AR}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

