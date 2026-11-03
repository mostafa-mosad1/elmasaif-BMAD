import React from 'react';
import { ListingStatus } from '@elmasaif/shared';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Archive,
  AlertTriangle,
  Ban,
  Lock,
} from 'lucide-react';

export interface ListingStatusBadgeProps {
  status: ListingStatus | string;
  className?: string;
}

export function ListingStatusBadge({ status, className = '' }: ListingStatusBadgeProps) {
  switch (status) {
    case ListingStatus.ACTIVE:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold ${className}`}
          data-testid="status-badge-active"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>معتمد ومنشور في السوق</span>
        </span>
      );

    case ListingStatus.ARCHIVED:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold ${className}`}
          data-testid="status-badge-archived"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>مؤرشف</span>
        </span>
      );

    case ListingStatus.SUSPENDED:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold ${className}`}
          data-testid="status-badge-suspended"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>معلق للامتثال</span>
        </span>
      );

    case ListingStatus.BLOCKED:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold ${className}`}
          data-testid="status-badge-blocked"
        >
          <Ban className="w-3.5 h-3.5" />
          <span>محظور</span>
        </span>
      );

    case ListingStatus.REJECTED:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs font-bold ${className}`}
          data-testid="status-badge-rejected"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>مرفوض من الإدارة</span>
        </span>
      );

    case ListingStatus.RESERVED:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-bold ${className}`}
          data-testid="status-badge-reserved"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>محجوز</span>
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold ${className}`}
          data-testid="status-badge-pending"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>بانتظار المراجعة الإدارية</span>
        </span>
      );
  }
}

