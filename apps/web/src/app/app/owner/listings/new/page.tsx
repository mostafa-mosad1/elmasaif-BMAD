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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
        <Link href="/app/owner" className="hover:text-accent dark:hover:text-accent transition-colors">
          لوحة تحكم المالك
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link href="/app/owner/listings" className="hover:text-accent dark:hover:text-accent transition-colors">
          عقاراتي
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">إضافة عقار جديد</span>
      </nav>

      {/* Reusable Listing Creation Wizard for Owners */}
      <ListingWizard userRole={UserRole.OWNER} onSuccessRedirectUrl="/app/owner" />
    </div>
  );
}

