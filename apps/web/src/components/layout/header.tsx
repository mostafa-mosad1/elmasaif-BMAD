'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDirection } from '../providers/direction-provider';
import { useTheme } from '../providers/theme-provider';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../ui/button';
import { SupportedLocale } from '@elmasaif/shared';
import {
  Building2,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';

export function Header() {
  const { locale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, activeRole, logout } = useAuth();
  const pathname = usePathname() || '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = locale === SupportedLocale.AR;

  const navLinks = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/properties', label: isArabic ? 'تصفح العقارات' : 'Browse Properties' },
    { href: '/pages/calculator', label: isArabic ? 'حاسبة السعي' : 'Commission Calculator' },
    { href: '/pages/rega-licenses', label: isArabic ? 'الامتثال والتراخيص' : 'Compliance' },
    { href: '/pages/faq', label: isArabic ? 'الأسئلة الشائعة' : 'FAQs' },
  ];

  // Hash anchors never match the pathname, so only real routes get highlighted.
  const isActive = (href: string) => pathname === href;

  const iconBtn =
    'inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20';

  const divider = 'w-px h-6 bg-surface-border dark:border-dark-surface-border mx-1 shrink-0';

  return (
    <header className="sticky top-0 z-50 w-full nav-blur border-b border-surface-border dark:border-dark-surface-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-[72px]">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl p-1 -ms-1 transition-transform duration-200 hover:scale-[1.02]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:bg-primary-hover transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                {isArabic ? 'المصايف' : 'Elmasaif'}
              </span>
              <span className="hidden sm:block text-[11px] text-ink-muted dark:text-dark-ink-muted font-medium">
                {isArabic ? 'منصة الصفقات العقارية المعتمدة' : 'Verified Real Estate Platform'}
              </span>
            </div>
          </Link>

          {/* Primary navigation (desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group relative py-2.5 px-3.5 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg ${
                    active
                      ? 'text-primary dark:text-primary-light font-bold'
                      : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary font-medium'
                  }`}
                >
                  <span>{link.label}</span>

                  {/* Underline filling from right to left */}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-2.5 h-[2.5px] bg-primary dark:bg-primary-light rounded-full animate-fill-rtl shadow-sm"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-2.5 h-[2px] bg-ink-muted/30 dark:bg-dark-ink-muted/30 rounded-full origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Utilities + auth (desktop) */}
          <div className="hidden lg:flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              type="button"
              className={iconBtn}
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              )}
            </button>

            <span className={divider} aria-hidden="true" />

            {user ? (
              <div className="flex items-center gap-2.5">
                <Link href={`/app/${(activeRole || 'BUYER').toLowerCase()}`}>
                  <Button variant="primary" size="sm" className="gap-1.5 rounded-xl font-bold text-xs h-9 shadow-xs hover:shadow-sm transition-all">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className={iconBtn}
                  aria-label={isArabic ? 'تسجيل الخروج' : 'Logout'}
                  title={isArabic ? 'تسجيل الخروج' : 'Logout'}
                >
                  <LogOut className="w-4 h-4 text-ink-secondary dark:text-dark-ink-secondary hover:text-rose-600 dark:hover:text-rose-400 transition-colors" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="rounded-xl font-bold text-xs h-9 px-3.5">
                    {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button variant="primary" size="sm" className="rounded-xl font-bold text-xs h-9 px-4 shadow-sm hover:shadow-md transition-all">
                    {isArabic ? 'إنشاء حساب' : 'Register'}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Compact controls (mobile / tablet) */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              type="button"
              className={iconBtn}
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              type="button"
              className={iconBtn}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / tablet menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-4 py-4 space-y-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`relative flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                    active
                      ? 'text-primary dark:text-primary-light font-bold bg-primary/10 dark:bg-primary/20 border-r-4 border-primary dark:border-primary-light shadow-xs'
                      : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken font-medium'
                  }`}
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="flex flex-col gap-2.5 pt-1">
              <Link
                href={`/app/${(activeRole || 'BUYER').toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full"
              >
                <Button variant="primary" size="sm" className="gap-1.5 w-full rounded-xl font-bold">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors w-full"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تسجيل الخروج' : 'Logout'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold">
                  {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                </Button>
              </Link>
              <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full rounded-xl font-bold">
                  {isArabic ? 'حساب جديد' : 'Register'}
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
