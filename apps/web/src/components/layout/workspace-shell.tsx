'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useDirection } from '../providers/direction-provider';
import { useTheme } from '../providers/theme-provider';
import { WorkspaceRoleSwitcher } from './workspace-role-switcher';
import { UserRole, SupportedLocale, ThemeMode } from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';
import {
  Building2,
  LayoutDashboard,
  Search,
  HandCoins,
  Heart,
  FileQuestion,
  User,
  PlusCircle,
  FileText,
  CreditCard,
  Building,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Globe,
  Menu,
  X,
  MapPin
} from 'lucide-react';

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const { user, activeRole, logout } = useAuth();
  const { admin, logoutAdmin } = useAdminAuth();
  const { locale, toggleLocale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isArabic = locale === SupportedLocale.AR;
  const isAdminRoute = Boolean(pathname?.startsWith('/admin'));

  const handleQuickToggleLocale = () => {
    const nextLocale = isArabic ? SupportedLocale.EN : SupportedLocale.AR;
    toggleLocale();
    if (user) {
      apiClient('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: nextLocale })
      }).catch(() => {});
    }
  };

  const handleQuickToggleTheme = () => {
    const nextTheme = resolvedTheme === 'dark' ? ThemeMode.LIGHT : ThemeMode.DARK;
    toggleTheme();
    if (user) {
      apiClient('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ themeMode: nextTheme })
      }).catch(() => {});
    }
  };

  const roleNavItems = {
    [UserRole.BUYER]: [
      { href: '/app/buyer', label: 'لوحة التحكم', icon: LayoutDashboard },
      { href: '/', label: 'تصفح العقارات', icon: Search },
      { href: '/app/buyer/offers', label: 'عروضي النشطة', icon: HandCoins },
      { href: '/app/buyer/favorites', label: 'العقارات المفضلة', icon: Heart },
      { href: '/app/buyer/demands', label: 'طلبات الشراء', icon: FileQuestion },
      { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
      { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
    ],
    [UserRole.OWNER]: [
      { href: '/app/owner', label: 'لوحة تحكم المالك', icon: LayoutDashboard },
      { href: '/app/owner/listings/new', label: 'طلب عرض عقار مباشر', icon: PlusCircle },
      { href: '/app/owner/contracts', label: 'عقود الوساطة الإلكترونية', icon: FileText },
      { href: '/app/settings/payout', label: 'حسابات التحويل (IBAN)', icon: CreditCard },
      { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
      { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
    ],
    [UserRole.MARKETER]: [
      { href: '/app/marketer', label: 'لوحة تحكم الوسيط', icon: LayoutDashboard },
      { href: '/app/marketer/listings', label: 'إدارة العقارات', icon: Building },
      { href: '/app/marketer/listings/new', label: 'إضافة عقار جديد', icon: PlusCircle },
      { href: '/app/marketer/fal-license', label: 'رخصة فال العقارية', icon: ShieldCheck },
      { href: '/app/settings/payout', label: 'حسابات التحويل (IBAN)', icon: CreditCard },
      { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
      { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
    ],
    [UserRole.ADMIN]: [
      { href: '/admin', label: 'لوحة تحكم المشرف', icon: LayoutDashboard },
      ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Geo.Manage')
        ? [{ href: '/admin/geo', label: 'إدارة المدن والأحياء', icon: MapPin }]
        : [])
    ]
  };

  const roleTitleMap = {
    [UserRole.BUYER]: 'مساحة المشتري',
    [UserRole.OWNER]: 'مساحة المالك',
    [UserRole.MARKETER]: 'مساحة الوسيط المعتمد',
    [UserRole.ADMIN]: 'مساحة الإدارة'
  };

  const effectiveRole = isAdminRoute ? UserRole.ADMIN : activeRole;
  const navItems = roleNavItems[effectiveRole] || roleNavItems[UserRole.BUYER];
  const workspaceTitle = roleTitleMap[effectiveRole] || 'مساحة العمل';
  const handleActiveLogout = isAdminRoute ? logoutAdmin : logout;

  return (
    <div className="min-h-screen flex bg-surface-sunken dark:bg-dark-surface font-sans antialiased text-ink-primary dark:text-dark-ink-primary">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Institutional Responsive Sidebar (280px) */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-[280px] bg-surface dark:bg-dark-surface-raised border-e border-surface-border dark:border-dark-surface-border flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          mobileSidebarOpen
            ? 'translate-x-0'
            : isArabic
            ? 'translate-x-full'
            : '-translate-x-full'
        }`}
      >
        {/* Institutional Crest Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-surface-border dark:border-dark-surface-border">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-ink-primary dark:text-dark-ink-primary">
                المصايف
              </span>
              <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted font-medium">
                {workspaceTitle}
              </span>
            </div>
          </Link>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-md hover:bg-surface-sunken dark:hover:bg-dark-surface"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface hover:text-ink-primary dark:hover:text-dark-ink-primary'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : 'text-ink-muted'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / Admin Profile Footer in Sidebar */}
        {isAdminRoute && admin ? (
          <div className="p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                  {admin.fullName ? admin.fullName.charAt(0) : 'A'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-semibold truncate">{admin.fullName}</span>
                  <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted truncate">
                    {admin.role} • {admin.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutAdmin}
                className="p-1.5 rounded-md text-ink-muted hover:text-status-rejected hover:bg-surface dark:hover:bg-dark-surface-raised transition-colors"
                title="تسجيل الخروج الإداري"
                aria-label="Logout Admin"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          user && (
            <div className="p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                    {user.fullName ? user.fullName.charAt(0) : 'U'}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-semibold truncate">{user.fullName}</span>
                    <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted truncate">
                      {user.mobileNumber}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 rounded-md text-ink-muted hover:text-status-rejected hover:bg-surface dark:hover:bg-dark-surface-raised transition-colors"
                  title="تسجيل الخروج"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        )}
      </aside>

      {/* Main Workspace Content Area */}
      <div className="flex-1 flex flex-col lg:ps-[280px]">
        {/* Workspace Top Bar */}
        <header className="sticky top-0 z-30 h-20 bg-surface/90 dark:bg-dark-surface-raised/90 backdrop-blur-md border-b border-surface-border dark:border-dark-surface-border px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <WorkspaceRoleSwitcher />
          </div>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <button
              onClick={handleQuickToggleLocale}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface border border-surface-border dark:border-dark-surface-border transition-colors"
              aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Globe className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
              <span className="hidden sm:inline">{isArabic ? 'English' : 'العربية'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={handleQuickToggleTheme}
              type="button"
              className="p-2 rounded-lg text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface border border-surface-border dark:border-dark-surface-border transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Activate Light Mode' : 'تفعيل الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-accent" />
              ) : (
                <Moon className="w-4 h-4 text-ink-secondary" />
              )}
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleActiveLogout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-status-rejected hover:bg-status-rejected/10 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* Page Children Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
