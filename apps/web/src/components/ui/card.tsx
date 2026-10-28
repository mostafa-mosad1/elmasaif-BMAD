import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  sunken?: boolean;
}

export function Card({
  className,
  hoverEffect = false,
  sunken = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-card border transition-all duration-200',
          sunken
            ? 'bg-surface-sunken dark:bg-dark-surface-sunken border-surface-border dark:border-dark-surface-border'
            : 'bg-surface-base dark:bg-dark-surface-base border-surface-border dark:border-dark-surface-border shadow-level1',
          hoverEffect && 'luxury-card',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('flex flex-col space-y-1.5 mb-4', className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx(
          'text-lg font-bold tracking-tight text-ink-primary dark:text-dark-ink-primary',
          className
        )
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={twMerge(
        clsx('text-sm text-ink-secondary dark:text-dark-ink-secondary', className))
      }
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('text-ink-primary dark:text-dark-ink-primary', className))} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center pt-4 border-t border-surface-border dark:border-dark-surface-border mt-4',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
