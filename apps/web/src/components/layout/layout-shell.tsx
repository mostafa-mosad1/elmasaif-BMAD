'use client';

import React from 'react';
import { Header } from './header';
import { Footer } from './footer';
import { AnnouncementBannerBar } from './announcement-banner-bar';

export interface LayoutShellProps {
  children: React.ReactNode;
  containerClassName?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export function LayoutShell({
  children,
  containerClassName,
  hideHeader = false,
  hideFooter = false,
}: LayoutShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-background dark:bg-dark-background text-ink-primary dark:text-dark-ink-primary transition-colors duration-200">
      <AnnouncementBannerBar />
      {!hideHeader && <Header />}
      <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${containerClassName || ''}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
