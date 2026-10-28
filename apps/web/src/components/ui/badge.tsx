import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StatusBadgeVariant } from '@elmasaif/shared';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-semibold rounded-pill tracking-tight transition-colors';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const variantStyles: Record<StatusBadgeVariant, string> = {
    verified:
      'bg-status-verifiedBg text-status-verified border border-status-verifiedBorder dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
    pending:
      'bg-status-pendingBg text-status-pending border border-status-pendingBorder dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
    danger:
      'bg-status-dangerBg text-status-danger border border-status-dangerBorder dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60',
    info:
      'bg-status-infoBg text-status-info border border-status-infoBorder dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
    neutral:
      'bg-status-neutralBg text-status-neutral border border-status-neutralBorder dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
  };

  return (
    <span
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
