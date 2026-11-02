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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/app/marketer" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
          لوحة تحكم الوسيط
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link href="/app/marketer/listings" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
          العقارات المعروضة
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">إضافة عقار جديد</span>
      </nav>

      {/* Reusable Listing Creation Wizard for Marketers */}
      <ListingWizard userRole={UserRole.MARKETER} onSuccessRedirectUrl="/app/marketer" />
    </div>
  );
}
