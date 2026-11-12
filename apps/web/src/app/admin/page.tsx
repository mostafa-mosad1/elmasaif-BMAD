'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AdminRole,
  AdminSessionUser,
  ADMIN_SESSION_INACTIVITY_HOURS,
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
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAdminAuth } from '../../components/providers/admin-auth-provider';
import { AdminPasswordResetModal } from '../../components/admin/admin-password-reset-modal';

export default function AdminDashboardPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [staffList, setStaffList] = useState<AdminSessionUser[]>([]);
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

  const loadStaff = useCallback(async () => {
    if (!canManageRbac) return;
    try {
      const response = await apiClient.get<{
        code: string;
        data: { staff: AdminSessionUser[] };
      }>('/admin/auth/staff');
      if (response?.data?.staff) {
        setStaffList(response.data.staff);
      }
    } catch {
      // Ignore error when unauthenticated in preview
    }
  }, [canManageRbac]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Executive Sovereign Banner */}
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 text-[#D8F3DC] px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>النطاق الإداري المعزول • AD-5 &amp; FR-39</span>
          </div>
          <h1 className="text-2xl font-bold">
            لوحة العمليات والأمان الإداري — المصايف
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            مرحباً {admin?.fullName || 'بالمشرف الإداري'}. الجلسة الإدارية الحالية معزولة بالكامل عن جلسات المتعاملين وتخضع لسياسة الإغلاق التلقائي بعد {ADMIN_SESSION_INACTIVITY_HOURS} ساعات من عدم النشاط.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/queues"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>طوابير المهام والأقفال التشغيلية</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          {canManageRbac && (
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>إدارة الموظفين والصلاحيات (RBAC)</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canReviewContracts && (
            <>
              <Link
                href="/admin/owner-requests"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>طلبات الملاك والعقود</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/contract-fees"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white border border-white/30 text-xs font-bold shadow-sm hover:bg-white/30 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>تدقيق رسوم العقود والنشر</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
          {canReviewListings && (
            <Link
              href="/admin/listings/moderation"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
            >
              <Building2 className="w-4 h-4" />
              <span>طابور مراجعة الإعلانات العقارية</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canModerateReviews && (
            <Link
              href="/admin/reviews"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
            >
              <Star className="w-4 h-4" />
              <span>مراجعة وتدقيق التقييمات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canHandleReports && (
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>بلاغات المخالفات والامتثال</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canHandleTickets && (
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors"
            >
              <LifeBuoy className="w-4 h-4 text-primary-600" />
              <span>تذاكر الدعم الفني</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          )}
          {canManageGeo ? (
            <Link
              href="/admin/geo"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 text-white border border-white/25 text-xs font-bold shadow-sm hover:bg-white/25 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>إدارة المدن والأحياء</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 text-[#D8F3DC] text-xs font-semibold border border-white/15">
              <span>الدور الحالي: {admin?.role || 'MODERATOR'} (مراجعة العمليات)</span>
            </span>
          )}
        </div>
      </div>

      {/* Security & Session Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-[#1B4332] dark:text-emerald-400 font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>عزل الجلسات (Dual-Realm)</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            تعمل الجلسة الإدارية عبر ملف تعريف ارتباط مستقل (<code dir="ltr">elmasaif_admin_session</code>) وجداول بيانات منفصلة تماماً عن حسابات المستخدمين.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-[#1B4332] dark:text-emerald-400 font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>مهلة عدم النشاط (8 ساعات)</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            تتجدد صلاحية الجلسة تلقائياً مع كل إجراء إداري، وتُغلق الجلسة حتمياً بعد مرور 8 ساعات من السكون، مع الحماية ضد التخمين (قفل 15 دقيقة بعد 5 محاولات).
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-2">
          <div className="flex items-center gap-2 text-[#1B4332] dark:text-emerald-400 font-bold text-sm">
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
              <Users className="w-5 h-5 text-[#1B4332]" />
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-bold hover:bg-[#1B4332]/90 transition-colors"
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
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1B4332]/10 text-[#1B4332] dark:text-emerald-300">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#1B4332] text-[#1B4332] dark:text-emerald-300 hover:bg-[#1B4332] hover:text-white disabled:opacity-40 text-xs font-bold transition-colors"
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

