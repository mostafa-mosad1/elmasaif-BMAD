'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'w-full max-w-xl mx-auto rounded-card border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken p-8 sm:p-12 text-center transition-all duration-200',
          className
        )
      )}
    >
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-xl bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center border border-primary/20 shadow-sm">
          {icon ? (
            icon
          ) : (
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          )}
        </div>
      </div>

      <h3 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary mb-2 tracking-tight">
        {title}
      </h3>

      <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-md mx-auto mb-8 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionHref ? (
              <Link href={actionHref}>
                <Button variant="primary" size="md">
                  {actionLabel}
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="md" onClick={onAction}>
                {actionLabel}
              </Button>
            )
          )}

          {secondaryActionLabel && (
            secondaryActionHref ? (
              <Link href={secondaryActionHref}>
                <Button variant="secondary" size="md">
                  {secondaryActionLabel}
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="md" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
