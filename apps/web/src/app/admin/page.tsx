'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AdminRole,
  AdminSessionUser,
  ADMIN_SESSION_INACTIVITY_HOURS,
  ExecutiveDashboardMetricsDto,
} from '@elmasaif/shared';
import {
  ShieldCheck,
  MapPin,
  KeyRound,
  Clock,
  Lock,
  Users,
  ArrowLeft,
  Building2,
  FileText,
  CreditCard,
  Layers,
  Star,
  ShieldAlert,
  LifeBuoy,
  Sliders,
  ScrollText,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Activity,
  FileCheck,
  BadgeAlert,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAdminAuth } from '../../components/providers/admin-auth-provider';
import { AdminPasswordResetModal } from '../../components/admin/admin-password-reset-modal';

export default function AdminDashboardPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [staffList, setStaffList] = useState<AdminSessionUser[]>([]);
  const [metrics, setMetrics] = useState<ExecutiveDashboardMetricsDto | null>(null);
  const [selectedAdminForReset, setSelectedAdminForReset] =
    useState<AdminSessionUser | null>(null);

  const canManageRbac =
    hasPermission('Rbac.Manage') || admin?.role === AdminRole.SUPER_ADMIN;
  const canManageGeo =
    hasPermission('Geo.Manage') || admin?.role === AdminRole.SUPER_ADMIN;
  const canReviewContracts =
    hasPermission('Contracts.Review') ||
    hasPermission('Contracts.Manage') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;
  const canReviewListings =
    hasPermission('Listings.Review') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;
  const canModerateReviews =
    hasPermission('Reviews.Moderate') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;
  const canHandleReports =
    hasPermission('Reports.Handle') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;
  const canHandleTickets =
    hasPermission('Tickets.Handle') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;
  const canViewAudit =
    hasPermission('Audit.View') ||
    admin?.role === AdminRole.SUPER_ADMIN;
  const canManageSettings =
    hasPermission('Settings.Manage') ||
    hasPermission('Settings.Commission') ||
    admin?.role === AdminRole.SUPER_ADMIN;
  const canViewFraud =
    hasPermission('Fraud.View') ||
    hasPermission('Compliance.Manage') ||
    hasPermission('Security.Manage') ||
    admin?.role === AdminRole.SUPER_ADMIN;
  const canViewFinance =
    hasPermission('Finance.View') ||
    hasPermission('Finance.Audit') ||
    hasPermission('Finance.Export') ||
    admin?.role === AdminRole.SUPER_ADMIN;
  const canManageCms =
    hasPermission('CMS.Manage') ||
    hasPermission('Content.Manage') ||
    admin?.role === AdminRole.SUPER_ADMIN;

  const loadDashboardData = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        statusCode: number;
        data: ExecutiveDashboardMetricsDto;
      }>('/admin/executive/dashboard');
      if (res?.data) {
        setMetrics(res.data);
      }
    } catch {
      // Ignore in preview / unauthenticated
    }

    if (canManageRbac) {
      try {
        const response = await apiClient.get<{
          code: string;
          data: { staff: AdminSessionUser[] };
        }>('/admin/auth/staff');
        if (response?.data?.staff) {
          setStaffList(response.data.staff);
        }
      } catch {
        // Ignore in preview
      }
    }
  }, [canManageRbac]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalSlaWarnings =
    (metrics?.slaWarnings.dealsExpiringSoon12h || 0) +
    (metrics?.slaWarnings.ticketsSlaBreached || 0) +
    (metrics?.slaWarnings.listingsPendingOver24h || 0);

  const totalQueueBacklog =
    (metrics?.pendingQueues.listingsModeration || 0) +
    (metrics?.pendingQueues.falVerifications || 0) +
    (metrics?.pendingQueues.paymentProofReviews || 0) +
    (metrics?.pendingQueues.contractFeeReviews || 0) +
    (metrics?.pendingQueues.unassignedDisputes || 0) +
    (metrics?.pendingQueues.openTickets || 0) +
    (metrics?.pendingQueues.pendingViolationReports || 0);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Executive Sovereign Banner */}
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>النطاق الإداري المعزول • لوحة القيادة والعمليات التنفيذية (FR-66)</span>
          </div>
          <h1 className="text-2xl font-bold">
            مركز العمليات والرقابة التنفيذية — المصايف
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            مرحباً {admin?.fullName || 'بالمشرف الإداري'}. تراقب هذه اللوحة مؤشرات التدفق المالي اللحظي، طوابير التدقيق التشغيلية، إنذارات اتفاقيات مستوى الخدمة (SLA)، وسجلات الامتثال. الجلسة صالحة لـ {ADMIN_SESSION_INACTIVITY_HOURS} ساعات من السكون.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/queues"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-xs font-bold shadow-sm hover:bg-accent-light transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>طوابير العمليات والأقفال</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          {canViewFinance && (
            <Link
              href="/admin/finance"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-xs font-bold shadow-sm hover:bg-accent-light transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>التقارير المالية</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canViewFraud && (
            <Link
              href="/admin/fraud"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-xs font-bold shadow-sm hover:bg-accent-light transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>مكافحة الاحتيال</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canManageCms && (
            <Link
              href="/admin/cms"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white border border-white/30 text-xs font-bold shadow-sm hover:bg-white/30 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>إدارة المحتوى (CMS)</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* SLA Alert Warning Banners */}
      {totalSlaWarnings > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <BadgeAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                تنبيه اتفاقيات مستوى الخدمة (SLA Alerts) — {totalSlaWarnings} مهام تتطلب تدخلاً عاجلاً
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
                {Boolean(metrics?.slaWarnings.dealsExpiringSoon12h) && (
                  <span>• {metrics?.slaWarnings.dealsExpiringSoon12h} صفقات متبقي عليها أقل من 12 ساعة للدفع</span>
                )}
                {Boolean(metrics?.slaWarnings.ticketsSlaBreached) && (
                  <span>• {metrics?.slaWarnings.ticketsSlaBreached} تذاكر تجاوزت الحد الزمني للرد أو الإغلاق</span>
                )}
                {Boolean(metrics?.slaWarnings.listingsPendingOver24h) && (
                  <span>• {metrics?.slaWarnings.listingsPendingOver24h} عقارات معلقة للمراجعة لأكثر من 24 ساعة</span>
                )}
              </div>
            </div>
          </div>
          <Link
            href="/admin/queues"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0"
          >
            <span>معالجة الطوابير</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 48h Deals */}
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
              نشاط الصفقات (آخر 48 ساعة)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-ink-primary dark:text-dark-ink-primary">
              {metrics?.dealCounts48h.totalVolumeLast48hSar?.toLocaleString('ar-SA') || 0}{' '}
              <span className="text-xs font-normal text-ink-secondary">ر.س</span>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              {metrics?.dealCounts48h.activeInPaymentWindow || 0} في نافذة السداد •{' '}
              {metrics?.dealCounts48h.completedLast48h || 0} مكتملة •{' '}
              {metrics?.dealCounts48h.pendingReviewLast48h || 0} قيد التدقيق
            </p>
          </div>
        </div>

        {/* Card 2: Queue Backlog */}
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
              إجمالي الطوابير المعلقة
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-ink-primary dark:text-dark-ink-primary">
              {totalQueueBacklog} <span className="text-xs font-normal text-ink-secondary">مهمة</span>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              {metrics?.pendingQueues.paymentProofReviews || 0} سداد •{' '}
              {metrics?.pendingQueues.listingsModeration || 0} عقارات •{' '}
              {metrics?.pendingQueues.falVerifications || 0} رخص فال
            </p>
          </div>
        </div>

        {/* Card 3: SLA Warnings */}
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
              إنذارات المهلة (SLA)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {totalSlaWarnings} <span className="text-xs font-normal text-ink-secondary">تحذير</span>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              {metrics?.slaWarnings.dealsExpiringSoon12h || 0} سداد وشيك •{' '}
              {metrics?.slaWarnings.ticketsSlaBreached || 0} تذاكر متأخرة
            </p>
          </div>
        </div>

        {/* Card 4: 30-Day Revenue */}
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
              إيرادات المنصة (30 يوماً)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-primary dark:text-accent">
              {(
                (metrics?.financialThroughput30d.commissionsSar || 0) +
                (metrics?.financialThroughput30d.contractFeesSar || 0)
              ).toLocaleString('ar-SA')}{' '}
              <span className="text-xs font-normal text-ink-secondary">ر.س</span>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              {metrics?.financialThroughput30d.commissionsSar?.toLocaleString('ar-SA') || 0} عمولات •{' '}
              {metrics?.financialThroughput30d.contractFeesSar?.toLocaleString('ar-SA') || 0} عقود
            </p>
          </div>
        </div>
      </div>

      {/* Operational Queues Navigation Hub */}
      <section className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              طوابير العمليات ومراكز التدقيق والمراجعة
            </h2>
          </div>
          <Link
            href="/admin/queues"
            className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1"
          >
            <span>عرض كافة الطوابير والأقفال</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/admin/payments"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-accent transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              إيصالات السداد
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-accent/15 text-accent-dark dark:text-accent text-[10px] font-bold">
              {metrics?.pendingQueues.paymentProofReviews || 0} معلق
            </span>
          </Link>

          <Link
            href="/admin/listings/moderation"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-accent transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              الإعلانات العقارية
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
              {metrics?.pendingQueues.listingsModeration || 0} معلق
            </span>
          </Link>

          <Link
            href="/admin/licenses"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-accent transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              رخص فال العقارية
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
              {metrics?.pendingQueues.falVerifications || 0} معلق
            </span>
          </Link>

          <Link
            href="/admin/contract-fees"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-accent transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              رسوم عقود الملاك
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              {metrics?.pendingQueues.contractFeeReviews || 0} معلق
            </span>
          </Link>

          <Link
            href="/admin/fraud"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-red-500 transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-red-50 text-red-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              مكافحة الاحتيال
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              {metrics?.pendingQueues.pendingViolationReports || 0} بلاغ
            </span>
          </Link>

          <Link
            href="/admin/finance"
            className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border hover:border-accent transition-colors text-center space-y-1.5 group"
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              التقارير المالية
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
              تصدير CSV
            </span>
          </Link>
        </div>
      </section>

      {/* Security & Session Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-accent font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>عزل الجلسات (Dual-Realm)</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            تعمل الجلسة الإدارية عبر ملف تعريف ارتباط مستقل (<code dir="ltr">elmasaif_admin_session</code>) وجداول بيانات منفصلة تماماً عن حسابات المتعاملين.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-accent font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>مهلة عدم النشاط ({ADMIN_SESSION_INACTIVITY_HOURS} ساعات)</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            تتجدد صلاحية الجلسة تلقائياً مع كل إجراء إداري، وتُغلق الجلسة حتمياً بعد مرور 8 ساعات من السكون، مع الحماية ضد التخمين (قفل 15 دقيقة بعد 5 محاولات).
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-accent font-bold text-sm">
            <KeyRound className="w-4 h-4" />
            <span>إعادة تعيين كلمات المرور (FR-70)</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            يُحظر تعيين كلمات مرور مؤقتة؛ يُصدر المشرف العام رابطاً مشفراً صالحاً لـ 15 دقيقة وللمرة الواحدة فقط مع إلغاء فوري للجلسات النشطة.
          </p>
        </div>
      </div>

      {/* Super Admin Staff Password Reset Management Section */}
      {canManageRbac && (
        <section className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-accent" />
              <div>
                <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  إدارة حسابات المشرفين وإعادة تعيين كلمات المرور (Rbac.Manage)
                </h2>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  إصدار روابط إعادة تعيين كلمة المرور الصالحة لمدة 15 دقيقة وللاستخدام مرة واحدة لمنسوبي الإدارة.
                </p>
              </div>
            </div>
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>إدارة الموظفين والصلاحيات (RBAC)</span>
            </Link>
          </div>

          <div className="divide-y divide-surface-border dark:divide-dark-surface-border">
            {staffList.map((staff) => (
              <div
                key={staff.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      {staff.fullName}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent-dark dark:text-accent">
                      {staff.role}
                    </span>
                    {!staff.isActive && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        معطل
                      </span>
                    )}
                  </div>
                  <p dir="ltr" className="text-xs font-mono text-ink-secondary text-end">
                    {staff.username} • {staff.email}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!staff.isActive}
                  onClick={() => setSelectedAdminForReset(staff)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken disabled:opacity-40 text-xs font-bold transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>إرسال رابط إعادة تعيين كلمة المرور</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <AdminPasswordResetModal
        isOpen={Boolean(selectedAdminForReset)}
        targetAdmin={selectedAdminForReset}
        onClose={() => setSelectedAdminForReset(null)}
      />
    </div>
  );
}
