'use client';

import React from 'react';
import { FileText, Printer, Shield } from 'lucide-react';
import type { DealInvoiceSummary } from '@elmasaif/shared';
import { Button, Card, CardContent } from '../ui';

export const DEAL_INVOICE_TITLE_AR = 'فاتورة سعي المنصة الضريبية';

export function formatInvoiceAmount(amount: string | number): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}

export interface DealInvoiceCardProps {
  invoice?: DealInvoiceSummary | null;
  className?: string;
}

export function DealInvoiceCard({ invoice, className }: DealInvoiceCardProps) {
  if (!invoice) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formattedDate = new Date(invoice.createdAt).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card
      className={`border-surface-borderStrong shadow-sm ${className ?? ''}`}
      data-testid="deal-invoice-card"
    >
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4 dark:border-dark-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                {DEAL_INVOICE_TITLE_AR}
              </h2>
              <span
                dir="ltr"
                className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted"
                data-testid="invoice-number"
              >
                {invoice.invoiceNumber}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handlePrint}
            aria-label="طباعة الفاتورة الضريبية"
            data-testid="print-invoice-btn"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            طباعة الفاتورة
          </Button>
        </div>

        {/* VAT Tax Details Table */}
        <dl className="divide-y divide-surface-border dark:divide-dark-surface-border text-xs">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-ink-secondary dark:text-dark-ink-secondary">تاريخ الإصدار</dt>
            <dd className="font-medium text-ink-primary dark:text-dark-ink-primary">
              {formattedDate}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-ink-secondary dark:text-dark-ink-secondary">
              المبلغ الخاضع للضريبة (قبل الضريبة)
            </dt>
            <dd
              dir="ltr"
              className="font-mono font-semibold text-ink-primary dark:text-dark-ink-primary"
              data-testid="invoice-subtotal"
            >
              {formatInvoiceAmount(invoice.subtotalAmount)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-ink-secondary dark:text-dark-ink-secondary">
              ضريبة القيمة المضافة (15%)
            </dt>
            <dd
              dir="ltr"
              className="font-mono font-semibold text-ink-primary dark:text-dark-ink-primary"
              data-testid="invoice-vat"
            >
              {formatInvoiceAmount(invoice.vatAmount)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3 font-bold text-sm bg-surface-ground/50 px-2 rounded-lg dark:bg-dark-surface-ground/50">
            <dt className="text-ink-primary dark:text-dark-ink-primary">إجمالي السعي الشامل للضريبة</dt>
            <dd
              dir="ltr"
              className="font-mono text-primary text-base"
              data-testid="invoice-total"
            >
              {formatInvoiceAmount(invoice.totalAmount)}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-ground p-3 text-[11px] text-ink-muted dark:border-dark-surface-border dark:bg-dark-surface-ground dark:text-dark-ink-muted">
          <Shield className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            فاتورة ضريبية نظامية صادرة وفق متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA).
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
