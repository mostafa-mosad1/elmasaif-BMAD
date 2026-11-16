'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_PERMISSIONS,
  AdminAccountStatusAction,
  AdminPermissionGroupMeta,
  AdminPlatformUserSummaryDto,
  AdminRole,
  AdminSessionUser,
  AdminStaffSummaryDto,
} from '@elmasaif/shared';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Sliders,
  Ban,
  CheckCircle2,
  Trash2,
  Archive,
  AlertTriangle,
  Users,
  Lock,
  History,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { AdminPasswordResetModal } from './admin-password-reset-modal';

export interface AdminCreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (staff: AdminStaffSummaryDto) => void;
  permissionGroups?: AdminPermissionGroupMeta[];
  rolePresets?: Record<AdminRole, string[]>;
}

export function AdminCreateStaffModal({
  isOpen,
  onClose,
  onCreated,
  permissionGroups = ADMIN_PERMISSION_GROUPS,
  rolePresets = ADMIN_ROLE_PERMISSIONS,
}: AdminCreateStaffModalProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>(AdminRole.MODERATOR);
  const [initialPassword, setInitialPassword] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    () => [...(rolePresets[AdminRole.MODERATOR] ?? [])]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleRoleChange = (nextRole: AdminRole) => {
    setRole(nextRole);
    setSelectedPermissions([...(rolePresets[nextRole] ?? [])]);
  };

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey)
        ? prev.filter((k) => k !== permKey)
        : [...prev, permKey]
    );
  };

  const toggleGroup = (group: AdminPermissionGroupMeta) => {
    const keys = group.permissions.map((p) => p.key);
    const allSelected = keys.every((k) => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<{
        code: string;
        data: { staff: AdminStaffSummaryDto };
      }>('/admin/staff', {
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        role,
        initialPassword,
        permissions: selectedPermissions,
      });

      if (response?.data?.staff) {
        onCreated?.(response.data.staff);
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر إنشاء حساب الموظف');
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء إنشاء حساب الموظف');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-staff-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-4xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 id="create-staff-modal-title" className="text-base font-bold">
              إنشاء حساب موظف إداري جديد وتخصيص الصلاحيات (RBAC)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                الاسم الكامل للموظف
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: فهد القحطاني"
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                اسم المستخدم الإداري (Username)
              </label>
              <input
                type="text"
                dir="ltr"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ops_moderator_01"
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 text-sm font-mono text-end"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                البريد الإلكتروني الوظيفي
              </label>
              <input
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@elmasaif.sa"
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 text-sm font-mono text-end"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                كلمة المرور الأولية (تخضع لمعايير Argon2id)
              </label>
              <input
                type="password"
                dir="ltr"
                required
                minLength={8}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Staff@Elmasaif2026"
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 text-sm font-mono text-end"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              الدور الوظيفي الأساسي (Role Preset)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {Object.values(AdminRole).map((roleOption) => (
                <button
                  key={roleOption}
                  type="button"
                  onClick={() => handleRoleChange(roleOption)}
                  className={`p-3 rounded-xl border text-start transition-colors ${
                    role === roleOption
                      ? 'border-accent bg-accent/10 text-accent-dark dark:text-accent font-bold'
                      : 'border-surface-border dark:border-dark-surface-border text-ink-secondary hover:bg-surface-sunken'
                  }`}
                >
                  <div className="text-xs font-bold">{ADMIN_ROLE_LABELS[roleOption]}</div>
                  <div dir="ltr" className="text-[11px] font-mono opacity-75">
                    {roleOption}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                مصفوفة الصلاحيات الدقيقة حسب النطاق التشغيلي (Area.Action) — تم تحديد ({selectedPermissions.length}) صلاحية
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPermissions([...(rolePresets[role] ?? [])])}
                className="text-xs font-semibold text-accent hover:underline"
              >
                إعادة ضبط حسب القالب الافتراضي للدور
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissionGroups.map((group) => (
                <div
                  key={group.groupKey}
                  className="p-3.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/50 dark:bg-dark-surface/40 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-1.5">
                    <span className="text-xs font-bold text-accent-dark dark:text-accent">
                      {group.groupLabelAr}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="text-[11px] font-semibold text-ink-secondary hover:text-ink-primary"
                    >
                      تبديل الكل
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {group.permissions.map((perm) => {
                      const checked = selectedPermissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className="flex items-center justify-between gap-2 text-xs cursor-pointer py-0.5"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(perm.key)}
                              className="rounded border-surface-border text-accent focus:ring-accent accent-accent"
                            />
                            <span className="text-ink-primary dark:text-dark-ink-primary">
                              {perm.labelAr}
                            </span>
                          </div>
                          <code dir="ltr" className="text-[10px] font-mono text-ink-muted">
                            {perm.key}
                          </code>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border dark:border-dark-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-surface-border text-xs font-bold text-ink-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedPermissions.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الإنشاء...' : 'إنشاء حساب الموظف وحفظ الصلاحيات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface AdminPermissionsModalProps {
  isOpen: boolean;
  targetStaff: AdminStaffSummaryDto | null;
  onClose: () => void;
  onSaved?: (staff: AdminStaffSummaryDto) => void;
  permissionGroups?: AdminPermissionGroupMeta[];
  rolePresets?: Record<AdminRole, string[]>;
}

export function AdminPermissionsModal({
  isOpen,
  targetStaff,
  onClose,
  onSaved,
  permissionGroups = ADMIN_PERMISSION_GROUPS,
  rolePresets = ADMIN_ROLE_PERMISSIONS,
}: AdminPermissionsModalProps) {
  const [role, setRole] = useState<AdminRole>(
    targetStaff?.role ?? AdminRole.MODERATOR
  );
  const [fullName, setFullName] = useState(targetStaff?.fullName ?? '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    () => [...(targetStaff?.permissions ?? [])]
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (targetStaff) {
      setRole(targetStaff.role);
      setFullName(targetStaff.fullName);
      setSelectedPermissions([...(targetStaff.permissions ?? [])]);
      setReason('');
      setErrorMessage(null);
    }
  }, [targetStaff]);

  if (!isOpen || !targetStaff) {
    return null;
  }

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey)
        ? prev.filter((k) => k !== permKey)
        : [...prev, permKey]
    );
  };

  const applyPreset = (presetRole: AdminRole) => {
    setRole(presetRole);
    setSelectedPermissions([...(rolePresets[presetRole] ?? [])]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || reason.trim().length < 3 || selectedPermissions.length === 0) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.patch<{
        code: string;
        data: { staff: AdminStaffSummaryDto };
      }>(`/admin/staff/${targetStaff.id}/permissions`, {
        role,
        fullName: fullName.trim(),
        permissions: selectedPermissions,
        reason: reason.trim(),
      });

      if (response?.data?.staff) {
        onSaved?.(response.data.staff);
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر تحديث صلاحيات الموظف');
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء تحديث الصلاحيات');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-permissions-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-4xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-accent" />
            <h2 id="edit-permissions-modal-title" className="text-base font-bold">
              تعديل مصفوفة الصلاحيات الدقيقة (Dynamic RBAC) — {targetStaff.fullName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                الاسم الوظيفي الكامل
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                الدور الأساسي (تطبيق قالب افتراضي)
              </label>
              <select
                value={role}
                onChange={(e) => applyPreset(e.target.value as AdminRole)}
                className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2 text-sm"
              >
                {Object.values(AdminRole).map((r) => (
                  <option key={r} value={r}>
                    {ADMIN_ROLE_LABELS[r]} ({r})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {permissionGroups.map((group) => (
              <div
                key={group.groupKey}
                className="p-3.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/50 dark:bg-dark-surface/40 space-y-2"
              >
                <div className="text-xs font-bold text-accent-dark dark:text-accent border-b border-surface-border pb-1.5">
                  {group.groupLabelAr}
                </div>
                <div className="space-y-1.5">
                  {group.permissions.map((perm) => {
                    const checked = selectedPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex items-center justify-between gap-2 text-xs cursor-pointer py-0.5"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(perm.key)}
                            className="rounded border-surface-border text-accent focus:ring-accent accent-accent"
                          />
                          <span>{perm.labelAr}</span>
                        </div>
                        <code dir="ltr" className="text-[10px] font-mono text-ink-muted">
                          {perm.key}
                        </code>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="permissions-update-reason"
              className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
            >
              سبب تعديل الصلاحيات (إلزامي لسجل التدقيق الرقابي AuditLog)
            </label>
            <textarea
              id="permissions-update-reason"
              rows={2}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تفويض المشرف بصلاحيات إضافية لمراجعة التقييمات وفك أقفال المهام..."
              className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface p-3 text-sm"
            />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              تنبيه أمني: سيتم إلغاء جميع الجلسات النشطة للموظف فوراً لضمان سريان الصلاحيات المحدثة وتوثيق اللقطة قبل وبعد التعديل (beforeSnapshot / afterSnapshot).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-surface-border text-xs font-bold text-ink-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3 || selectedPermissions.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ مصفوفة الصلاحيات وإلغاء الجلسات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface AdminStaffManagementProps {
  initialStaff?: AdminStaffSummaryDto[];
  initialUsers?: AdminPlatformUserSummaryDto[];
  initialTab?: 'STAFF' | 'USERS';
}

export function AdminStaffManagement({
  initialStaff = [],
  initialUsers = [],
  initialTab = 'STAFF',
}: AdminStaffManagementProps) {
  const { admin, hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'STAFF' | 'USERS'>(initialTab);
  const [staffList, setStaffList] = useState<AdminStaffSummaryDto[]>(initialStaff);
  const [usersList, setUsersList] = useState<AdminPlatformUserSummaryDto[]>(initialUsers);
  const [permissionGroups, setPermissionGroups] = useState<AdminPermissionGroupMeta[]>(
    ADMIN_PERMISSION_GROUPS
  );
  const [rolePresets, setRolePresets] = useState<Record<AdminRole, string[]>>(
    ADMIN_ROLE_PERMISSIONS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStaffPermissions, setEditingStaffPermissions] =
    useState<AdminStaffSummaryDto | null>(null);
  const [selectedAdminForReset, setSelectedAdminForReset] =
    useState<AdminSessionUser | null>(null);

  // Lifecycle action dialog state
  const [lifecycleModal, setLifecycleModal] = useState<{
    scope: 'STAFF' | 'USER';
    targetId: string;
    targetName: string;
    action: AdminAccountStatusAction | 'HARD_DELETE';
    hasHistory: boolean;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);

  const canManageRbac =
    !admin || hasPermission('Rbac.Manage') || admin?.role === AdminRole.SUPER_ADMIN;
  const canManageUsersStatus =
    !admin ||
    hasPermission('Users.Status') ||
    hasPermission('Users.HardDelete') ||
    admin?.role === AdminRole.SUPER_ADMIN;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, usersRes] = await Promise.allSettled([
        apiClient.get<{
          code: string;
          data: {
            staff: AdminStaffSummaryDto[];
            permissionGroups?: AdminPermissionGroupMeta[];
            rolePresets?: Record<AdminRole, string[]>;
          };
        }>('/admin/staff'),
        apiClient.get<{
          code: string;
          data: { users: AdminPlatformUserSummaryDto[] };
        }>('/admin/users'),
      ]);

      if (staffRes.status === 'fulfilled' && staffRes.value?.data?.staff) {
        setStaffList(staffRes.value.data.staff);
        if (staffRes.value.data.permissionGroups) {
          setPermissionGroups(staffRes.value.data.permissionGroups);
        }
        if (staffRes.value.data.rolePresets) {
          setRolePresets(staffRes.value.data.rolePresets);
        }
      }

      if (usersRes.status === 'fulfilled' && usersRes.value?.data?.users) {
        setUsersList(usersRes.value.data.users);
      }
    } catch {
      // Ignore in SSR/preview
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialStaff.length === 0 && initialUsers.length === 0) {
      loadData();
    }
  }, [initialStaff.length, initialUsers.length, loadData]);

  const handleConfirmLifecycleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifecycleModal || lifecycleReason.trim().length < 3 || isLifecycleSubmitting) {
      return;
    }

    setIsLifecycleSubmitting(true);
    setFeedbackBanner(null);

    try {
      const { scope, targetId, action } = lifecycleModal;
      if (scope === 'STAFF') {
        if (action === 'HARD_DELETE') {
          await apiClient.delete(`/admin/staff/${targetId}`, {
            body: JSON.stringify({ reason: lifecycleReason.trim() }),
          });
          setStaffList((prev) => prev.filter((s) => s.id !== targetId));
          setFeedbackBanner({
            type: 'success',
            message: 'تم الحذف النهائي لحساب الموظف لعدم وجود سجل عمليات مرتبط به',
          });
        } else {
          const res = await apiClient.post<{
            code: string;
            message: string;
            data: { staff: AdminStaffSummaryDto };
          }>(`/admin/staff/${targetId}/status`, {
            action,
            reason: lifecycleReason.trim(),
          });
          if (res?.data?.staff) {
            setStaffList((prev) =>
              prev.map((s) => (s.id === targetId ? res.data.staff : s))
            );
          }
          setFeedbackBanner({
            type: 'success',
            message: res?.message || 'تم تحديث حالة حساب الموظف بنجاح',
          });
        }
      } else {
        if (action === 'HARD_DELETE') {
          await apiClient.delete(`/admin/users/${targetId}`, {
            body: JSON.stringify({ reason: lifecycleReason.trim() }),
          });
          setUsersList((prev) => prev.filter((u) => u.id !== targetId));
          setFeedbackBanner({
            type: 'success',
            message: 'تم الحذف النهائي لحساب المستخدم لعدم وجود سجل معاملات مرتبط به',
          });
        } else {
          const res = await apiClient.post<{
            code: string;
            message: string;
            data: { user: AdminPlatformUserSummaryDto };
          }>(`/admin/users/${targetId}/status`, {
            action,
            reason: lifecycleReason.trim(),
          });
          if (res?.data?.user) {
            setUsersList((prev) =>
              prev.map((u) => (u.id === targetId ? res.data.user : u))
            );
          }
          setFeedbackBanner({
            type: 'success',
            message: res?.message || 'تم تحديث حالة حساب المستخدم بنجاح',
          });
        }
      }
      setLifecycleModal(null);
      setLifecycleReason('');
    } catch (err) {
      if (err instanceof ApiError) {
        setFeedbackBanner({
          type: 'error',
          message: err.message,
        });
      } else {
        setFeedbackBanner({
          type: 'error',
          message: 'تعذر تنفيذ العملية المطلوبة',
        });
      }
    } finally {
      setIsLifecycleSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>الصلاحيات الديناميكية الدقيقة وحوكمة الحسابات • FR-40 &amp; FR-43 &amp; BR-18</span>
          </div>
          <h1 className="text-2xl font-bold">
            إدارة الموظفين والصلاحيات (RBAC) وحوكمة حسابات المستخدمين
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            تخصيص صلاحيات الموظفين حسب كل نطاق تشغيلي (<code dir="ltr">Area.Action</code>)، وإدارة التفعيل والتعطيل والحذف الناعم، مع حظر الحذف النهائي لأي حساب يرتبط بسجل عمليات أو معاملات سابقة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageRbac && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-xs font-bold shadow-sm hover:bg-accent-light transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>إنشاء حساب موظف جديد</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 text-white border border-white/25 text-xs font-bold hover:bg-white/25 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="alert"
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline ms-4"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border dark:border-dark-surface-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('STAFF')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'STAFF'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface dark:bg-dark-surface-raised text-ink-secondary hover:bg-surface-sunken'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>حسابات الموظفين ومصفوفة الصلاحيات ({staffList.length})</span>
        </button>

        {canManageUsersStatus && (
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'USERS'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface dark:bg-dark-surface-raised text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>حوكمة حسابات مستخدمي المنصة ({usersList.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: Staff Accounts Table */}
      {activeTab === 'STAFF' && (
        <section className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                سجل موظفي الإدارة ومصفوفة الصلاحيات الممنوحة (Staff Accounts &amp; Granular RBAC)
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                يُمنع الحذف النهائي لأي حساب موظف يرتبط بسجل عمليات أو تدقيق سابق وفق القاعدة النظامية (BR-18 / FR-43).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                <tr>
                  <th className="py-3 px-4 text-start font-bold">الموظف والحساب</th>
                  <th className="py-3 px-4 text-start font-bold">الدور الأساسي</th>
                  <th className="py-3 px-4 text-start font-bold">حالة الحساب</th>
                  <th className="py-3 px-4 text-start font-bold">الصلاحيات الدقيقة (Area.Action)</th>
                  <th className="py-3 px-4 text-start font-bold">سجل العمليات (BR-18)</th>
                  <th className="py-3 px-4 text-start font-bold">الإجراءات الإدارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {staffList.map((staff) => {
                  const isSoftDeleted = Boolean(staff.deletedAt);
                  const previewPerms = (staff.permissions ?? []).slice(0, 4);
                  const remainingPerms = Math.max(0, (staff.permissions?.length ?? 0) - 4);

                  return (
                    <tr key={staff.id} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                          {staff.fullName}
                        </div>
                        <div dir="ltr" className="font-mono text-[11px] text-ink-secondary text-end">
                          {staff.username} • {staff.email}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-accent/15 text-accent-dark dark:text-accent">
                          {ADMIN_ROLE_LABELS[staff.role] || staff.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isSoftDeleted ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            محذوف ناعماً
                          </span>
                        ) : staff.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                            معطل
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-accent-dark dark:text-accent me-1">
                            ({staff.permissions?.length ?? 0}) صلاحية:
                          </span>
                          {previewPerms.map((p) => (
                            <code
                              key={p}
                              dir="ltr"
                              className="px-1.5 py-0.5 rounded bg-surface-sunken dark:bg-dark-surface border border-surface-border text-[10px] font-mono"
                            >
                              {p}
                            </code>
                          ))}
                          {remainingPerms > 0 && (
                            <span className="text-[11px] text-ink-muted font-semibold">
                              +{remainingPerms} أخرى
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {staff.hasOperationalHistory ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <History className="w-3 h-3" />
                            <span>سجل عمليات مرتبط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-sunken text-ink-muted">
                            <span>بدون سجل</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingStaffPermissions(staff)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>تعديل الصلاحيات</span>
                          </button>

                          {staff.isActive ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLifecycleModal({
                                  scope: 'STAFF',
                                  targetId: staff.id,
                                  targetName: staff.fullName,
                                  action: 'DISABLE',
                                  hasHistory: staff.hasOperationalHistory,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>تعطيل</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setLifecycleModal({
                                  scope: 'STAFF',
                                  targetId: staff.id,
                                  targetName: staff.fullName,
                                  action: 'ENABLE',
                                  hasHistory: staff.hasOperationalHistory,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تفعيل</span>
                            </button>
                          )}

                          {!isSoftDeleted && (
                            <button
                              type="button"
                              onClick={() =>
                                setLifecycleModal({
                                  scope: 'STAFF',
                                  targetId: staff.id,
                                  targetName: staff.fullName,
                                  action: 'SOFT_DELETE',
                                  hasHistory: staff.hasOperationalHistory,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border text-ink-secondary hover:bg-surface-sunken font-bold transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>حذف ناعم</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setLifecycleModal({
                                scope: 'STAFF',
                                targetId: staff.id,
                                targetName: staff.fullName,
                                action: 'HARD_DELETE',
                                hasHistory: staff.hasOperationalHistory,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف نهائي</span>
                          </button>

                          <button
                            type="button"
                            disabled={!staff.isActive}
                            onClick={() => setSelectedAdminForReset(staff)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken disabled:opacity-40 font-bold transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>رابط استعادة كلمة المرور</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Platform User Governance */}
      {activeTab === 'USERS' && (
        <section className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-surface-border dark:border-dark-surface-border">
            <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              حوكمة حسابات مستخدمي المنصة (Platform User Lifecycle &amp; BR-18 Guarded Deletion)
            </h2>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              إدارة تفعيل وتعطيل والحذف الناعم لحسابات المتعاملين (<code dir="ltr">Users.Status</code>)، والحذف النهائي المشروط بعدم وجود أي سجل معاملات (<code dir="ltr">Users.HardDelete</code>).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                <tr>
                  <th className="py-3 px-4 text-start font-bold">المستخدم ورقم الجوال</th>
                  <th className="py-3 px-4 text-start font-bold">الأدوار وتوثيق الهوية</th>
                  <th className="py-3 px-4 text-start font-bold">حالة الحساب</th>
                  <th className="py-3 px-4 text-start font-bold">سجل المعاملات (BR-18)</th>
                  <th className="py-3 px-4 text-start font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {usersList.map((u) => {
                  const hasHistory = u.transactionHistoryCount > 0;
                  const isSoftDeleted = Boolean(u.deletedAt) || u.status === 'SOFT_DELETED';

                  return (
                    <tr key={u.id} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                          {u.fullName}
                        </div>
                        <div dir="ltr" className="font-mono text-[11px] text-ink-secondary text-end">
                          {u.phone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold">{u.role}</span> •{' '}
                        <span className="text-ink-secondary">{u.verificationStatus}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isSoftDeleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            محذوف ناعماً
                          </span>
                        ) : u.isActive ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            نشط
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                            معطل
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasHistory ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <History className="w-3 h-3" />
                            <span>{`سجل معاملات مرتبط (${u.transactionHistoryCount})`}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-sunken text-ink-muted">
                            بدون سجل معاملات
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.isActive ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLifecycleModal({
                                  scope: 'USER',
                                  targetId: u.id,
                                  targetName: u.fullName,
                                  action: 'DISABLE',
                                  hasHistory,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-800 font-bold"
                            >
                              تعطيل
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setLifecycleModal({
                                  scope: 'USER',
                                  targetId: u.id,
                                  targetName: u.fullName,
                                  action: 'ENABLE',
                                  hasHistory,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 font-bold"
                            >
                              تفعيل
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setLifecycleModal({
                                scope: 'USER',
                                targetId: u.id,
                                targetName: u.fullName,
                                action: 'SOFT_DELETE',
                                hasHistory,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-surface-border text-ink-secondary font-bold"
                          >
                            حذف ناعم
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setLifecycleModal({
                                scope: 'USER',
                                targetId: u.id,
                                targetName: u.fullName,
                                action: 'HARD_DELETE',
                                hasHistory,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 font-bold"
                          >
                            حذف نهائي
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Lifecycle Confirmation Modal */}
      {lifecycleModal && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-surface dark:bg-dark-surface-raised border border-surface-border rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-primary text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                تأكيد إجراء حوكمة الحساب — {lifecycleModal.targetName}
              </h3>
              <button
                type="button"
                onClick={() => setLifecycleModal(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmLifecycleAction} className="p-6 space-y-4">
              {lifecycleModal.action === 'HARD_DELETE' && lifecycleModal.hasHistory && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>تحذير نظامي (BR-18 / FR-43): الحذف النهائي محظور لوجود سجل مرتبط</span>
                  </div>
                  <p>
                    يرتبط هذا الحساب بسجل عمليات أو معاملات سابقة؛ سيرفض الخادم الحذف النهائي برمز (
                    <code dir="ltr">
                      {lifecycleModal.scope === 'STAFF'
                        ? 'ADMIN_HARD_DELETE_HISTORY_EXISTS'
                        : 'USER_HARD_DELETE_HISTORY_EXISTS'}
                    </code>
                    ). يرجى استخدام <strong>التعطيل</strong> أو <strong>الحذف الناعم</strong> بدلاً من ذلك.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-primary">
                  السبب الإلزامي لتنفيذ الإجراء (يُوثق في AuditLog)
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                  placeholder="أدخل مبرر الإجراء الإداري..."
                  className="w-full rounded-xl border border-surface-border p-3 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLifecycleModal(null)}
                  className="px-4 py-2 rounded-xl border border-surface-border text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLifecycleSubmitting || lifecycleReason.trim().length < 3}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {isLifecycleSubmitting ? 'جاري التنفيذ...' : 'تأكيد الإجراء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <AdminCreateStaffModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        permissionGroups={permissionGroups}
        rolePresets={rolePresets}
        onCreated={(created) => {
          setStaffList((prev) => [...prev, created]);
          setFeedbackBanner({
            type: 'success',
            message: `تم إنشاء حساب الموظف (${created.fullName}) وتخصيص صلاحياته بنجاح`,
          });
        }}
      />

      <AdminPermissionsModal
        isOpen={Boolean(editingStaffPermissions)}
        targetStaff={editingStaffPermissions}
        onClose={() => setEditingStaffPermissions(null)}
        permissionGroups={permissionGroups}
        rolePresets={rolePresets}
        onSaved={(updated) => {
          setStaffList((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
          setFeedbackBanner({
            type: 'success',
            message: `تم تحديث مصفوفة صلاحيات (${updated.fullName}) وإلغاء جلساته النشطة فوراً`,
          });
        }}
      />

      <AdminPasswordResetModal
        isOpen={Boolean(selectedAdminForReset)}
        targetAdmin={selectedAdminForReset}
        onClose={() => setSelectedAdminForReset(null)}
      />
    </div>
  );
}

