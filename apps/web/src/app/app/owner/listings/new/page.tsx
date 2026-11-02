'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { UserRole } from '@elmasaif/shared';
import { ListingWizard } from '../../../../../components/listings';

export default function OwnerNewListingPage() {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/app/owner" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
          لوحة تحكم المالك
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link href="/app/owner/listings" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
          عقاراتي
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">إضافة عقار جديد</span>
      </nav>

      {/* Reusable Listing Creation Wizard for Owners */}
      <ListingWizard userRole={UserRole.OWNER} onSuccessRedirectUrl="/app/owner" />
    </div>
  );
}

