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
  MapPin,
  Sparkles,
  MessagesSquare,
  Wallet,
  Scale,
  FileCheck,
  Users,
  Layers,
  Star,
  ShieldAlert,
  LifeBuoy,
  Sliders,
  ScrollText,
  ChevronDown
} from 'lucide-react';
import { NotificationBell } from '../notifications/notification-bell';

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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

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

  interface NavBadge {
    count: string | number;
    variant?: 'neutral' | 'accent' | 'danger';
  }

  interface NavItem {
    href: string;
    label: string;
    icon: typeof Building2;
    badge?: NavBadge;
  }

  interface NavSection {
    title?: string;
    items: NavItem[];
  }

  const roleNavSections: Record<UserRole, NavSection[]> = {
    [UserRole.BUYER]: [
      {
        title: 'الرئيسية والاستكشاف',
        items: [
          { href: '/app/buyer', label: 'لوحة التحكم', icon: LayoutDashboard },
          { href: '/', label: 'تصفح العقارات', icon: Search }
        ]
      },
      {
        title: 'العمليات والصفقات',
        items: [
          { href: '/app/buyer/offers', label: 'عروضي النشطة', icon: HandCoins },
          { href: '/app/buyer/deals', label: 'صفقاتي والدفع', icon: Wallet },
          { href: '/app/buyer/inquiries', label: 'استفساراتي', icon: MessagesSquare },
          { href: '/app/buyer/favorites', label: 'العقارات المفضلة', icon: Heart },
          { href: '/app/buyer/demands', label: 'طلبات الشراء', icon: FileQuestion }
        ]
      },
      {
        title: 'الحساب والتوثيق',
        items: [
          { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
          { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
        ]
      }
    ],
    [UserRole.OWNER]: [
      {
        title: 'الرئيسية والعقارات',
        items: [
          { href: '/app/owner', label: 'لوحة تحكم المالك', icon: LayoutDashboard },
          { href: '/app/owner/listings/new', label: 'طلب عرض عقار مباشر', icon: PlusCircle },
          { href: '/app/owner/contracts', label: 'عقود الوساطة الإلكترونية', icon: FileText }
        ]
      },
      {
        title: 'العروض والمحادثات',
        items: [
          { href: '/app/owner/offers', label: 'العروض الواردة', icon: HandCoins },
          { href: '/app/owner/inquiries', label: 'استفسارات العقارات', icon: MessagesSquare },
          { href: '/app/owner/demands', label: 'مطابقات طلبات الشراء', icon: Sparkles }
        ]
      },
      {
        title: 'المالية والحساب',
        items: [
          { href: '/app/settings/payout', label: 'حسابات التحويل (IBAN)', icon: CreditCard },
          { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
          { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
        ]
      }
    ],
    [UserRole.MARKETER]: [
      {
        title: 'الرئيسية وإدارة العقارات',
        items: [
          { href: '/app/marketer', label: 'لوحة تحكم الوسيط', icon: LayoutDashboard },
          { href: '/app/marketer/listings', label: 'إدارة العقارات', icon: Building },
          { href: '/app/marketer/listings/new', label: 'إضافة عقار جديد', icon: PlusCircle },
          { href: '/app/marketer/fal-license', label: 'رخصة فال العقارية', icon: ShieldCheck }
        ]
      },
      {
        title: 'العروض والمطابقات',
        items: [
          { href: '/app/marketer/offers', label: 'العروض الواردة', icon: HandCoins },
          { href: '/app/marketer/inquiries', label: 'استفسارات العقارات', icon: MessagesSquare },
          { href: '/app/marketer/demands', label: 'مطابقات طلبات الشراء', icon: Sparkles }
        ]
      },
      {
        title: 'المالية والحساب',
        items: [
          { href: '/app/settings/payout', label: 'حسابات التحويل (IBAN)', icon: CreditCard },
          { href: '/app/settings/profile', label: 'إعدادات الحساب', icon: User },
          { href: '/app/settings/identity', label: 'توثيق الهوية', icon: ShieldCheck }
        ]
      }
    ],
    [UserRole.ADMIN]: [
      {
        title: 'العمليات والقيادة',
        items: [
          { href: '/admin', label: 'لوحة تحكم المشرف', icon: LayoutDashboard },
          { href: '/admin/queues', label: 'طوابير المهام والأقفال التشغيلية', icon: Layers, badge: { count: '2', variant: 'accent' } }
        ]
      },
      {
        title: 'العقارات والتراخيص',
        items: [
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Listings.Review')
            ? [{ href: '/admin/listings/moderation', label: 'طابور مراجعة الإعلانات العقارية', icon: Building, badge: { count: '3', variant: 'accent' } }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Contracts.Review') || admin.permissions?.includes('Contracts.Manage')
            ? [{ href: '/admin/owner-requests', label: 'طلبات الملاك والعقود', icon: FileText }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Licenses.Review')
            ? [{ href: '/admin/licenses', label: 'طابور اعتماد رخص فال', icon: FileCheck, badge: { count: '1', variant: 'accent' } }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Geo.Manage')
            ? [{ href: '/admin/geo', label: 'إدارة المدن والأحياء', icon: MapPin }]
            : [])
        ]
      },
      {
        title: 'الصفقات والوساطة المالية',
        items: [
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Offers.Review')
            ? [{ href: '/admin/negotiations', label: 'طابور وساطة عروض الشراء', icon: HandCoins, badge: { count: '4', variant: 'accent' } }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Offers.Review')
            ? [{ href: '/admin/proposals', label: 'طابور مراجعة عروض المزودين', icon: Sparkles }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Offers.Review')
            ? [{ href: '/admin/backup-offers', label: 'طابور العروض الاحتياطية', icon: HandCoins }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Payments.Review')
            ? [{ href: '/admin/payments', label: 'الدفع والتسويات البنكية', icon: Wallet }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Finance.View') || admin.permissions?.includes('Finance.Audit') || admin.permissions?.includes('Finance.Export')
            ? [{ href: '/admin/finance', label: 'المؤشرات والتقارير المالية', icon: CreditCard }]
            : [])
        ]
      },
      {
        title: 'الدعم والنزاعات والرقابة',
        items: [
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Tickets.Handle')
            ? [{ href: '/admin/tickets', label: 'تذاكر الدعم الفني', icon: LifeBuoy, badge: { count: '5', variant: 'neutral' } }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Deals.DisputeResolve')
            ? [{ href: '/admin/disputes', label: 'فض النزاعات', icon: Scale, badge: { count: '1', variant: 'danger' } }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Conversations.Handle')
            ? [{ href: '/admin/conversations', label: 'طابور المحادثات', icon: MessagesSquare }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Reviews.Moderate')
            ? [{ href: '/admin/reviews', label: 'مراجعة وتدقيق التقييمات', icon: Star }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Reports.Handle')
            ? [{ href: '/admin/reports', label: 'بلاغات المخالفات والامتثال', icon: ShieldAlert, badge: { count: '2', variant: 'danger' } }]
            : [])
        ]
      },
      {
        title: 'النظام والأمان والمحتوى',
        items: [
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Rbac.Manage')
            ? [{ href: '/admin/staff', label: 'إدارة الموظفين والصلاحيات (RBAC)', icon: Users }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Fraud.View') || admin.permissions?.includes('Compliance.Manage') || admin.permissions?.includes('Security.Manage')
            ? [{ href: '/admin/fraud', label: 'سجل مكافحة الاحتيال', icon: ShieldCheck }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Audit.View')
            ? [{ href: '/admin/audit', label: 'سجل التدقيق والرقابة', icon: ScrollText }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('CMS.Manage') || admin.permissions?.includes('Content.Manage')
            ? [{ href: '/admin/cms', label: 'إدارة المحتوى والإعلانات (CMS)', icon: FileText }]
            : []),
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Settings.Manage') || admin.permissions?.includes('Settings.Commission')
            ? [{ href: '/admin/settings', label: 'إعدادات المنصة والعمولات', icon: Sliders }]
            : [])
        ]
      }
    ]
  };

  const roleTitleMap = {
    [UserRole.BUYER]: 'مساحة المشتري',
    [UserRole.OWNER]: 'مساحة المالك',
    [UserRole.MARKETER]: 'مساحة الوسيط المعتمد',
    [UserRole.ADMIN]: 'مساحة الإدارة'
  };

  const effectiveRole = isAdminRoute ? UserRole.ADMIN : activeRole;
  const navSections = (roleNavSections[effectiveRole] || roleNavSections[UserRole.BUYER]).filter(
    (section) => section.items.length > 0
  );
  const workspaceTitle = roleTitleMap[effectiveRole] || 'مساحة العمل';
  const handleActiveLogout = isAdminRoute ? logoutAdmin : logout;

  return (
    <div className="min-h-screen flex bg-surface-background dark:bg-dark-background font-sans antialiased text-ink-primary dark:text-dark-ink-primary">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Institutional Responsive Sidebar (280px) */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-[280px] bg-surface-base dark:bg-dark-surface-base border-e border-surface-border dark:border-dark-surface-border shadow-xl lg:shadow-none flex flex-col transition-transform duration-300 lg:translate-x-0 ${
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
            className="lg:hidden p-1.5 rounded-md hover:bg-surface-sunken dark:hover:bg-dark-surface-raised"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {navSections.map((section, sIdx) => {
            if (section.items.length === 0) return null;
            const sectionKey = section.title || `sec-${sIdx}`;
            const isCollapsed = Boolean(collapsedSections[sectionKey]);

            return (
              <div key={sectionKey} className="space-y-1">
                {section.title && (
                  <button
                    type="button"
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors select-none text-start cursor-pointer"
                    aria-expanded={!isCollapsed}
                  >
                    <span className="text-[11px] font-bold tracking-wider uppercase">
                      {section.title}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 text-ink-muted/70 ${
                        isCollapsed ? '-rotate-90 rtl:rotate-90' : 'rotate-0'
                      }`}
                    />
                  </button>
                )}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-primary text-white dark:bg-primary dark:text-white font-semibold shadow-xs'
                              : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised hover:text-ink-primary dark:hover:text-dark-ink-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-white' : 'text-ink-muted dark:text-dark-ink-muted'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`shrink-0 ms-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : item.badge.variant === 'danger'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : item.badge.variant === 'accent'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-surface-sunken dark:bg-dark-surface-raised text-ink-muted dark:text-dark-ink-muted'
                              }`}
                            >
                              {item.badge.count}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User / Admin Profile Footer in Sidebar */}
        {isAdminRoute && admin ? (
          <div className="p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40">
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
            <div className="p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40">
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
      <div className="flex-1 flex flex-col min-w-0 w-full lg:ps-[280px]">
        {/* Workspace Top Bar */}
        <header className="sticky top-0 z-30 h-20 w-full min-w-0 bg-surface-base/90 dark:bg-dark-surface-base/90 backdrop-blur-md border-b border-surface-border dark:border-dark-surface-border px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-raised"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <WorkspaceRoleSwitcher />
          </div>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Bell */}
            <NotificationBell />

            {/* Language Switcher */}
            <button
              onClick={handleQuickToggleLocale}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border transition-colors"
              aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Globe className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
              <span className="hidden sm:inline">{isArabic ? 'English' : 'العربية'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={handleQuickToggleTheme}
              type="button"
              className="p-2 rounded-lg text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border transition-colors"
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
        <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
