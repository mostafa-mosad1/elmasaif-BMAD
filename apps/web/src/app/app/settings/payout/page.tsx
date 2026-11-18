'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { UserRole } from '@elmasaif/shared';
import { WorkspaceShell } from '../../../../components/layout/workspace-shell';
import { useAuth } from '../../../../components/providers/auth-provider';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  MonospaceIbanCard,
  PayoutAccountItem
} from '../../../../components/payout/monospace-iban-card';
import { PayoutAccountModal } from '../../../../components/payout/payout-account-modal';
import { DeletePayoutModal } from '../../../../components/payout/delete-payout-modal';

export default function PayoutSettingsPage() {
  const { activeRole } = useAuth();

  const [accounts, setAccounts] = useState<PayoutAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PayoutAccountItem | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<PayoutAccountItem | null>(null);

  const isSeller =
    activeRole === UserRole.MARKETER || activeRole === UserRole.OWNER;

  const loadAccounts = useCallback(async () => {
    if (!isSeller) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/users/payout-accounts', {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل استرجاع حسابات التحويل البنكي');
      }
      setAccounts(data.data || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'حدث خطأ أثناء تحميل الحسابات');
    } finally {
      setLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (account: PayoutAccountItem) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const handleOpenDelete = (account: PayoutAccountItem) => {
    setDeletingAccount(account);
    setDeleteModalOpen(true);
  };

  return (
    <WorkspaceShell>
      <div dir="rtl" className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-border pb-5 dark:border-dark-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                <Building2 className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
                حسابات التحويل البنكي (IBAN)
              </h1>
            </div>
            <p className="mt-1 text-sm text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                معتمدة وفقاً لمعايير الهيئة العامة للعقار والبنك المركزي السعودي (ساما) بتشفير AES-256 وحماية الصفقات.
              </span>
            </p>
          </div>

          {isSeller && (
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadAccounts}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handleOpenAdd}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة حساب بنكي جديد</span>
              </Button>
            </div>
          )}
        </div>

        {/* Role Restriction Banner for Non-Sellers (Buyers) */}
        {!isSeller && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-6 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="text-base font-bold">
                  إدارة حسابات التحويل البنكي مقتصرة على المسوقين وملاك العقارات
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  أنت متواجد حالياً في مساحة المشتري. حسابات التحويل والآيبان مخصصة فقط لاستلام مبالغ وعوائد بيع العقارات والسعي العقاري.
                </p>
                <div className="pt-2">
                  <Link href="/app/settings/profile">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <span>التبديل إلى مساحة المالك أو الوسيط</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seller Content View */}
        {isSeller && (
          <>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-secondary">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="text-xs">جاري تحميل حسابات التحويل البنكي...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-2xl border border-surface-border bg-surface p-8 dark:border-dark-surface-border dark:bg-dark-surface-raised">
                <EmptyState
                  icon={<Building2 className="h-10 w-10 text-emerald-600" />}
                  title="لا توجد حسابات بنكية مسجلة"
                  description="قم بإضافة وتوثيق حساب بنكي سعودي (IBAN) بصيغة Mod-97 لتتمكن من استلام مبالغ المبيعات والصفقات العقارية مباشرة."
                  actionLabel="إضافة أول حساب بنكي"
                  onAction={handleOpenAdd}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((account) => (
                  <MonospaceIbanCard
                    key={account.id}
                    account={account}
                    onEdit={handleOpenEdit}
                    onDelete={handleOpenDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <PayoutAccountModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={loadAccounts}
          initialData={editingAccount}
        />

        <DeletePayoutModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onSuccess={loadAccounts}
          account={deletingAccount}
        />
      </div>
    </WorkspaceShell>
  );
}
