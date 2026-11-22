'use client';

import React from 'react';
import Link from 'next/link';
import {
  Building2,
  ShieldCheck,
  ArrowLeft,
  Lock,
} from 'lucide-react';

interface AuthPageLayoutProps {
  mode: 'login' | 'register';
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthPageLayout({
  mode,
  title,
  subtitle,
  children,
}: AuthPageLayoutProps) {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col justify-between bg-surface-background dark:bg-dark-background text-ink-primary dark:text-dark-ink-primary py-8 sm:py-12 px-4 transition-colors"
    >
      {/* Top Simple Bar: Logo & Return Home */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between mb-4 sm:mb-6">
        <Link href="/" className="inline-flex items-center group focus:outline-none">
          <img
            src="/images/logo-header.png"
            alt="المصايف"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors py-1.5 px-3 rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-raised"
        >
          <span>الرئيسية</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Centered Auth Card (رايق وسمبل ومطابق لهوية المنصة) */}
      <main className="w-full max-w-[440px] mx-auto my-auto space-y-5">
        {/* Clean Mode Switcher Tabs */}
        <div className="p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border grid grid-cols-2 gap-1 text-center text-xs font-bold">
          <Link
            href="/auth/login"
            className={`py-2 rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-surface dark:bg-dark-surface-raised text-ink-primary dark:text-dark-ink-primary shadow-xs border border-surface-border dark:border-dark-surface-border'
                : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/auth/register"
            className={`py-2 rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-surface dark:bg-dark-surface-raised text-ink-primary dark:text-dark-ink-primary shadow-xs border border-surface-border dark:border-dark-surface-border'
                : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            حساب جديد
          </Link>
        </div>

        {/* Card Header & Content */}
        <div className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1.5 text-start">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>منصة مرخصة برخصة فال • الهيئة العامة للعقار</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Form */}
          <div>{children}</div>
        </div>

        {/* Security & Guarantee Trust Footnote */}
        <div className="flex items-center justify-center gap-2 text-xs text-ink-muted text-center pt-1">
          <Lock className="w-3.5 h-3.5 text-accent" />
          <span>جلسة آمنة ومشفرة بالكامل • حماية البيانات (PDPL)</span>
        </div>
      </main>

      {/* Footer Copyright */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-ink-muted mt-6 pt-4">
        منصة المصايف للصفقات العقارية © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
