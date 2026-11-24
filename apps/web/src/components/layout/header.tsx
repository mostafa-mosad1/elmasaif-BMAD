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
  Compass,
  Calculator,
  ShieldCheck,
  Home,
  HelpCircle,
} from 'lucide-react';

export function Header() {
  const { locale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, activeRole, logout } = useAuth();
  const pathname = usePathname() || '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = locale === SupportedLocale.AR;

  const navLinks = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home', icon: Home },
    { href: '/properties', label: isArabic ? 'تصفح العقارات' : 'Browse Properties', icon: Compass },
    { href: '/pages/calculator', label: isArabic ? 'حاسبة السعي' : 'Commission Calculator', icon: Calculator },
    { href: '/pages/rega-licenses', label: isArabic ? 'الامتثال والتراخيص' : 'Compliance', icon: ShieldCheck },
    { href: '/pages/faq', label: isArabic ? 'الأسئلة الشائعة' : 'FAQs', icon: HelpCircle },
  ];

  // Hash anchors never match the pathname, so only real routes get highlighted.
  const isActive = (href: string) => pathname === href;

  const iconBtn =
    'inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer';

  const divider = 'w-px h-6 bg-surface-border dark:border-dark-surface-border mx-1 shrink-0';

  return (
    <header className="sticky top-0 z-50 w-full nav-blur border-b border-surface-border/80 dark:border-dark-surface-border/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-[72px]">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0 group focus:outline-none focus:ring-2 focus:ring-accent/30 rounded-xl p-1 -ms-1 transition-transform duration-200 hover:scale-[1.02]"
          >
            <img
              src="/images/logo-header.png"
              alt={isArabic ? 'المصايف - منصة الصفقات العقارية المعتمدة' : 'Elmasaif Real Estate Platform'}
              className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          {/* Primary Navigation Island (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-raised/60 border border-surface-border/60 dark:border-dark-surface-border/60 backdrop-blur-sm">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1.5 px-3.5 text-xs sm:text-[13px] font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                    active
                      ? 'bg-surface dark:bg-dark-surface-base text-primary dark:text-white shadow-xs border border-surface-border/80 dark:border-dark-surface-border'
                      : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white hover:bg-surface/50 dark:hover:bg-dark-surface-base/40'
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                    <span>{link.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Utilities + Auth (Desktop) */}
          <div className="hidden lg:flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              type="button"
              className={iconBtn}
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
              title={resolvedTheme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <span className={divider} aria-hidden="true" />

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={`/app/${(activeRole || 'BUYER').toLowerCase()}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-sunken hover:bg-surface-border/70 dark:bg-dark-surface-raised dark:hover:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary border border-surface-border dark:border-dark-surface-border hover:border-accent/40 dark:hover:border-accent/40 transition-all duration-150 cursor-pointer shadow-2xs group"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-accent group-hover:scale-105 transition-transform" />
                  <span>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
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
                <Link
                  href="/auth/login"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-all cursor-pointer"
                >
                  {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                </Link>

                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover text-white dark:text-slate-950 text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  <span>{isArabic ? 'إنشاء حساب' : 'Register'}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Compact controls (Mobile / Tablet) */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              type="button"
              className={iconBtn}
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
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

      {/* Mobile / Tablet Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-surface-border dark:border-dark-surface-border bg-surface/95 dark:bg-dark-surface-base/95 backdrop-blur-md px-4 py-5 space-y-4 shadow-level3 animate-in fade-in slide-in-from-top-2 duration-200" dir={isArabic ? 'rtl' : 'ltr'}>
          <nav className="flex flex-col gap-1.5">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm rounded-xl font-bold transition-all duration-200 ${
                    active
                      ? 'bg-primary dark:bg-slate-800 text-white dark:text-white shadow-xs border border-transparent dark:border-accent/40'
                      : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-ink-muted dark:text-dark-ink-muted'}`} />
                    <span>{link.label}</span>
                  </div>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Auth Actions */}
          <div className="pt-2 border-t border-surface-border/60 dark:border-dark-surface-border/60">
            {user ? (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/app/${(activeRole || 'BUYER').toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="primary" size="sm" className="gap-2 w-full rounded-xl font-bold py-2.5">
                    <LayoutDashboard className="w-4 h-4 text-accent" />
                    <span>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors w-full cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تسجيل الخروج' : 'Logout'}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold py-2.5 text-xs">
                    {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full rounded-xl font-bold py-2.5 text-xs bg-accent text-slate-950 hover:bg-accent-hover">
                    {isArabic ? 'إنشاء حساب' : 'Register'}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
