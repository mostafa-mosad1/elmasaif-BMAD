'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDirection } from '../providers/direction-provider';
import { useTheme } from '../providers/theme-provider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SupportedLocale } from '@elmasaif/shared';
import { Building2, Sun, Moon, Globe, ShieldCheck, Menu, X } from 'lucide-react';

export function Header() {
  const { locale, toggleLocale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = locale === SupportedLocale.AR;

  const navLinks = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/#listings', label: isArabic ? 'تصفح الصفقات' : 'Browse Deals' },
    { href: '/#demands', label: isArabic ? 'الطلبات النشطة' : 'Active Demands' },
    { href: '/#compliance', label: isArabic ? 'الامتثال والتراخيص' : 'Compliance' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full nav-blur border-b border-surface-border dark:border-dark-surface-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Regulatory Badge */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-1">
              <div className="w-10 h-10 rounded-DEFAULT bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:bg-primary-hover transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                  {isArabic ? 'المصايف' : 'Elmasaif'}
                </span>
                <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted font-medium">
                  {isArabic ? 'منصة الصفقات العقارية المعتمدة' : 'Verified Real Estate Platform'}
                </span>
              </div>
            </Link>

            <Badge variant="verified" size="sm" className="hidden md:inline-flex items-center gap-1" icon={<ShieldCheck className="w-3.5 h-3.5 text-status-verified" />}>
              {isArabic ? 'مرخص من فال' : 'REGA Fal Licensed'}
            </Badge>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary hover:text-primary dark:hover:text-primary-light hover:bg-surface-sunken dark:hover:bg-dark-surface-raised rounded-DEFAULT transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Action Controls & Utilities */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Language Switcher */}
            <button
              onClick={toggleLocale}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Globe className="w-4 h-4 text-primary dark:text-primary-light" />
              <span>{isArabic ? 'English' : 'العربية'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2 rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-accent" />
              ) : (
                <Moon className="w-4 h-4 text-ink-secondary" />
              )}
            </button>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2 ms-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="primary" size="sm">
                  {isArabic ? 'إنشاء حساب' : 'Register'}
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2 rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="p-2 rounded-DEFAULT text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-ink-primary dark:text-dark-ink-primary rounded-DEFAULT hover:bg-surface-sunken dark:hover:bg-dark-surface-raised"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="pt-3 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between">
            <button
              onClick={() => {
                toggleLocale();
                setMobileMenuOpen(false);
              }}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-DEFAULT border border-surface-border dark:border-dark-surface-border"
            >
              <Globe className="w-4 h-4 text-primary" />
              <span>{isArabic ? 'English' : 'العربية'}</span>
            </button>

            <div className="flex items-center gap-2">
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm">
                  {isArabic ? 'دخول' : 'Sign In'}
                </Button>
              </Link>
              <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm">
                  {isArabic ? 'حساب جديد' : 'Register'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
