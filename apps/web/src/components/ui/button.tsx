'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-DEFAULT transition-all duration-150 focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variantStyles = {
      primary:
        'bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm hover:shadow active:bg-primary-dark',
      secondary:
        'bg-surface-base dark:bg-dark-surface-base text-ink-primary dark:text-dark-ink-primary border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-raised',
      outline:
        'bg-transparent text-primary dark:text-primary-light border border-primary hover:bg-primary-light dark:hover:bg-primary-dark/20',
      ghost:
        'bg-transparent text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken hover:text-ink-primary dark:hover:text-dark-ink-primary',
      danger:
        'bg-status-danger hover:bg-red-700 text-white shadow-sm active:bg-red-800',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ms-1 me-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
