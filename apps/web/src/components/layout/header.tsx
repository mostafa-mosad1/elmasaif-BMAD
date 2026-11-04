'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDirection } from '../providers/direction-provider';
import { useTheme } from '../providers/theme-provider';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { WorkspaceRoleSwitcher } from './workspace-role-switcher';
import { ProfileMenu } from './profile-menu';
import { SupportedLocale } from '@elmasaif/shared';
import {
  Building2,
  Sun,
  Moon,
  Globe,
  ShieldCheck,
  Menu,
  X,
  LayoutDashboard,
} from 'lucide-react';

export function Header() {
  const { locale, toggleLocale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, activeRole } = useAuth();
  const pathname = usePathname() || '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = locale === SupportedLocale.AR;

  const navLinks = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/properties', label: isArabic ? 'تصفح العقارات' : 'Browse Properties' },
    { href: '/#demands', label: isArabic ? 'الطلبات النشطة' : 'Active Demands' },
    { href: '/#compliance', label: isArabic ? 'الامتثال والتراخيص' : 'Compliance' },
  ];

  // Hash anchors never match the pathname, so only real routes get highlighted.
  const isActive = (href: string) => pathname === href;

  const iconBtn =
    'inline-flex items-center justify-center w-9 h-9 rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20';

  const pillBtn =
    'inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20';

  const divider = 'w-px h-8 bg-surface-border dark:bg-dark-surface-border mx-1 shrink-0';

  const navLinkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium rounded-DEFAULT transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
      isActive(href)
        ? 'text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/15'
        : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full nav-blur border-b border-surface-border dark:border-dark-surface-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-20">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-1 -ms-1"
          >
            <div className="w-10 h-10 rounded-DEFAULT bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:bg-primary-hover transition-colors">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                {isArabic ? 'المصايف' : 'Elmasaif'}
              </span>
              <span className="hidden sm:block text-[10px] text-ink-muted dark:text-dark-ink-muted font-medium">
                {isArabic ? 'منصة الصفقات العقارية المعتمدة' : 'Verified Real Estate Platform'}
              </span>
            </div>
          </Link>

          {/* Regulatory badge */}
          <Badge
            variant="verified"
            size="sm"
            className="hidden xl:inline-flex items-center gap-1 shrink-0"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-status-verified" />}
          >
            {isArabic ? 'مرخص من فال' : 'REGA Fal Licensed'}
          </Badge>

          {/* Primary navigation (desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Utilities + auth (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={toggleLocale} type="button" className={pillBtn} aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}>
              <Globe className="w-4 h-4 text-primary dark:text-primary-light" />
              <span>{isArabic ? 'English' : 'العربية'}</span>
            </button>

            <button
              onClick={toggleTheme}
              type="button"
              className={iconBtn}
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-accent" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <span className={divider} aria-hidden="true" />

            {user ? (
              <ProfileMenu />
            ) : (
              <div className="flex items-center gap-2">
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
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4" />}
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
        <div className="lg:hidden border-t border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base px-4 py-4 space-y-4">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 text-sm font-medium rounded-DEFAULT transition-colors ${
                  isActive(link.href)
                    ? 'text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/15'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 pt-3 border-t border-surface-border dark:border-dark-surface-border">
            <button onClick={toggleLocale} type="button" className={pillBtn} aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}>
              <Globe className="w-4 h-4 text-primary dark:text-primary-light" />
              <span>{isArabic ? 'English' : 'العربية'}</span>
            </button>
            <Badge
              variant="verified"
              size="sm"
              className="ms-auto items-center gap-1"
              icon={<ShieldCheck className="w-3.5 h-3.5 text-status-verified" />}
            >
              {isArabic ? 'مرخص من فال' : 'Fal Licensed'}
            </Badge>
          </div>

          {user ? (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <WorkspaceRoleSwitcher />
              <Link href={`/app/${activeRole.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'مساحة العمل' : 'Workspace'}</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full">
                  {isArabic ? 'تسجيل الدخول' : 'Sign In'}
                </Button>
              </Link>
              <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">
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
