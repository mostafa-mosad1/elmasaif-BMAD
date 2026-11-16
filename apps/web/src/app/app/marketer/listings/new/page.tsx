'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { UserRole } from '@elmasaif/shared';
import { ListingWizard } from '../../../../../components/listings';

export default function MarketerNewListingPage() {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
        <Link href="/app/marketer" className="hover:text-accent dark:hover:text-accent transition-colors">
          لوحة تحكم الوسيط
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link href="/app/marketer/listings" className="hover:text-accent dark:hover:text-accent transition-colors">
          العقارات المعروضة
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">إضافة عقار جديد</span>
      </nav>

      {/* Reusable Listing Creation Wizard for Marketers */}
      <ListingWizard userRole={UserRole.MARKETER} onSuccessRedirectUrl="/app/marketer" />
    </div>
  );
}
