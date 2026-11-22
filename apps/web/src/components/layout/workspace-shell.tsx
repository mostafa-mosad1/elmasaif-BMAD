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
  ScrollText
} from 'lucide-react';
import { SupportTicketModal } from '../support/support-ticket-modal';

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const { user, activeRole, logout } = useAuth();
  const { admin, logoutAdmin } = useAdminAuth();
  const { locale } = useDirection();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const isArabic = locale === SupportedLocale.AR;
  const isAdminRoute = Boolean(pathname?.startsWith('/admin'));

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
          { href: '/app/owner/listings', label: 'إدارة العقارات', icon: Building },
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
          ...(!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Users.Review') || admin.permissions?.includes('Users.Verify') || admin.permissions?.includes('Licenses.Review') || admin.permissions?.includes('Compliance.Manage')
            ? [{ href: '/admin/identity', label: 'توثيق الهويات الوطنية', icon: ShieldCheck }]
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

  const filteredNavSections = React.useMemo(() => {
    if (!sidebarSearch.trim()) return navSections;
    const q = sidebarSearch.toLowerCase().trim();
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (section.title && section.title.toLowerCase().includes(q))
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, sidebarSearch]);

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

      {/* Institutional Floating Island Sidebar (Detached Container) */}
      <aside
        className={`fixed z-50 w-[300px] lg:w-[320px] bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-xl lg:shadow-md flex flex-col min-h-0 overflow-hidden overscroll-contain transition-all duration-300 ${
          mobileSidebarOpen
            ? 'inset-y-0 start-0 translate-x-0 h-full max-h-screen'
            : isArabic
            ? 'inset-y-0 start-0 translate-x-full lg:translate-x-0'
            : 'inset-y-0 start-0 -translate-x-full lg:translate-x-0'
        } lg:top-4 lg:start-4 lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)] lg:rounded-2xl`}
      >
        {/* Institutional Crest Header */}
        <div className="h-20 shrink-0 flex items-center justify-between px-6 border-b border-surface-border dark:border-dark-surface-border bg-surface-sunken/20 dark:bg-dark-surface-sunken/20">
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-ink-primary dark:text-dark-ink-primary">
                  المصايف
                </span>
                {isAdminRoute && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20">
                    الإدارة
                  </span>
                )}
              </div>
              <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted font-medium">
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

        {/* Quick Navigation Filter for Admin */}
        {isAdminRoute && (
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-surface-border/50 dark:border-dark-surface-border/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="البحث السريع في القوائم الإدارية..."
                className="w-full ps-8 pe-7 py-2 text-xs rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarSearch('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-0.5"
                  aria-label="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 space-y-4">
          {filteredNavSections.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              لا توجد عناصر مطابقة لـ &quot;{sidebarSearch}&quot;
            </div>
          ) : (
            filteredNavSections.map((section, sIdx) => {
              if (section.items.length === 0) return null;
              return (
                <div key={section.title || sIdx} className="space-y-1.5">
                  {section.title && (
                    <div className="px-3 py-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-wider text-ink-muted dark:text-dark-ink-muted uppercase">
                        {section.title}
                      </span>
                      <span className="text-[10px] text-ink-muted opacity-60 font-mono">
                        {section.items.length}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group ${
                            isActive
                              ? 'bg-primary text-white dark:bg-primary dark:text-white shadow-xs ring-1 ring-primary/20'
                              : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised hover:text-ink-primary dark:hover:text-dark-ink-primary'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={`w-[19px] h-[19px] shrink-0 transition-transform group-hover:scale-105 ${
                                isActive ? 'text-accent' : 'text-ink-muted dark:text-dark-ink-muted'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`shrink-0 ms-1.5 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
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
                </div>
              );
            })
          )}
        </nav>

        {/* User Help / Support Action */}
        {!isAdminRoute && (
          <div className="shrink-0 px-3.5 py-2 border-t border-surface-border dark:border-dark-surface-border">
            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-raised text-ink-secondary dark:text-dark-ink-secondary transition-colors cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4 text-accent" />
              <span>{isArabic ? 'طلب دعم فني ومساعدة' : 'Help & Support'}</span>
            </button>
          </div>
        )}

        {/* User / Admin Profile Footer in Sidebar */}
        {isAdminRoute && admin ? (
          <div className="shrink-0 p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/60 dark:bg-dark-surface-sunken/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shrink-0 shadow-xs border border-accent/20">
                    {admin.fullName ? admin.fullName.charAt(0) : 'A'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-dark-surface-base" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate text-ink-primary dark:text-dark-ink-primary">
                      {admin.fullName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-ink-muted dark:text-dark-ink-muted truncate">
                    <span className="font-semibold text-accent">{admin.role}</span>
                    <span>•</span>
                    <span className="truncate">{admin.email}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutAdmin}
                className="p-2 rounded-xl text-ink-muted hover:text-status-danger hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="تسجيل الخروج الإداري"
                aria-label="Logout Admin"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          user && (
            <div className="shrink-0 p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40">
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
      <div className="flex-1 flex flex-col min-w-0 w-full lg:ps-[356px]">
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
            {!isAdminRoute ? (
              <WorkspaceRoleSwitcher />
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/25 bg-accent/10 text-accent font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>لوحة الإدارة والتحكم</span>
                {admin?.role && (
                  <span className="hidden sm:inline font-mono text-[11px] opacity-80 border-s border-accent/30 ps-2">
                    {admin.role}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
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

      <SupportTicketModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        defaultContactName={user?.fullName || ''}
      />
    </div>
  );
}
