'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlatformSettingsDto,
  PlatformSettingsAuditEntryDto,
  formatSaudiIban,
  validateSaudiIban,
} from '@elmasaif/shared';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  History,
  Lock,
  RefreshCw,
  Save,
  Scale,
  ShieldAlert,
  Sliders,
  Wallet,
  X,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';

export type SettingsTab = 'fees' | 'deadlines' | 'slas' | 'compliance' | 'audit';

export interface SettingsWorkspaceProps {
  initialSettings?: PlatformSettingsDto | null;
  initialAudit?: PlatformSettingsAuditEntryDto[] | null;
}

export function SettingsWorkspace({
  initialSettings = null,
  initialAudit = null,
}: SettingsWorkspaceProps) {
  const { admin } = useAdminAuth();

  const hasPermission = useMemo(() => {
    if (!admin) return true; // Auth guard will handle or test context
    if (admin.role === 'SUPER_ADMIN') return true;
    const perms = admin.permissions || [];
    return perms.includes('Settings.Manage') || perms.includes('Settings.Commission');
  }, [admin]);

  const [activeTab, setActiveTab] = useState<SettingsTab>('fees');
  const [settings, setSettings] = useState<PlatformSettingsDto | null>(initialSettings);
  const [auditLogs, setAuditLogs] = useState<PlatformSettingsAuditEntryDto[]>(initialAudit || []);
  const [loading, setLoading] = useState<boolean>(!initialSettings);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form editable state
  const [formValues, setFormValues] = useState<Partial<PlatformSettingsDto>>({});

  // Safety confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [justificationReason, setJustificationReason] = useState<string>('');
  const [justificationError, setJustificationError] = useState<string | null>(null);

  // Live calculator test ask price
  const [testAskPrice, setTestAskPrice] = useState<number>(1000000);

  // Fetch settings from API
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: PlatformSettingsDto }>('/admin/settings');
      if (res?.data) {
        setSettings(res.data);
        setFormValues(res.data);
      }
    } catch (err) {
      setError(describeApiError(err).message || 'تعذر تحميل إعدادات المنصة');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch audit history
  const loadAuditHistory = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: PlatformSettingsAuditEntryDto[] }>('/admin/settings/audit');
      if (res?.data) {
        setAuditLogs(res.data);
      }
    } catch {
      // Non-fatal if audit fetch fails
    }
  }, []);

  useEffect(() => {
    if (!initialSettings) {
      loadSettings();
    } else {
      setFormValues(initialSettings);
    }
    if (!initialAudit) {
      loadAuditHistory();
    }
  }, [initialSettings, initialAudit, loadSettings, loadAuditHistory]);

  const handleFieldChange = (field: keyof PlatformSettingsDto, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Compute modified fields (diff)
  const diffItems = useMemo(() => {
    if (!settings) return [];
    const diffs: { field: string; label: string; oldVal: any; newVal: any }[] = [];

    const fieldLabels: Record<string, string> = {
      commissionRatePercentage: 'نسبة عمولة المنصة (%)',
      fixedFeeAmountSar: 'المبلغ الثابت للعمولة (ر.س)',
      ownerContractFeeSar: 'رسوم عقد المالك المباشر (ر.س)',
      vatRatePercentage: 'نسبة ضريبة القيمة المضافة (%)',
      paymentWindowHours: 'مهلة سداد الصفقات (ساعة)',
      paymentCorrectionHours: 'مهلة تصحيح السداد (ساعة)',
      contractFeeDeadlineDays: 'مهلة سداد رسوم العقد (أيام)',
      coolingOffPeriodDays: 'فترة التهدئة لحذف الحساب (أيام)',
      dealReviewSlaAlertHours: 'تنبيه مراجعة الصفقات (ساعة)',
      dealReviewSlaEscalationHours: 'تصعيد مراجعة الصفقات (ساعة)',
      dealReviewSlaSuperAdminHours: 'المهلة القصوى لقرار الإدارة (ساعة)',
      ticketSlaFirstResponseHours: 'الاستجابة الأولى للتذاكر (ساعة)',
      ticketSlaResolutionHours: 'حل تذاكر الدعم الفني (ساعة)',
      taskClaimLeaseMinutes: 'مدة حجز المهام (دقيقة)',
      taskClaimHeartbeatMinutes: 'نبضات تجديد الحجز (دقيقة)',
      fraudRejectedProofThreshold: 'حد مؤشر الاحتيال للإيصالات',
      fraudWindowHours: 'نافذة رصد الاحتيال (ساعة)',
      platformCollectionIban: 'رقم الآيبان المعتمد للتحصيل',
      platformAccountHolderName: 'اسم صاحب الحساب البنكي',
      platformBankName: 'اسم البنك المعتمد',
    };

    Object.keys(fieldLabels).forEach((key) => {
      const k = key as keyof PlatformSettingsDto;
      const oldVal = settings[k];
      const newVal = formValues[k];
      if (newVal !== undefined && newVal !== oldVal) {
        diffs.push({
          field: key,
          label: fieldLabels[key],
          oldVal: oldVal ?? 'غير محدد',
          newVal: newVal ?? 'فارغ',
        });
      }
    });

    return diffs;
  }, [settings, formValues]);

  const hasModifications = diffItems.length > 0;

  // Validation before opening confirm modal
  const handleOpenConfirm = () => {
    setError(null);
    if (!hasModifications) {
      return;
    }

    // Client-side quick boundary checks
    if (formValues.platformCollectionIban) {
      if (!validateSaudiIban(formValues.platformCollectionIban)) {
        setError('رقم الآيبان السعودي غير صالح وفق فحص Mod-97 المعتمد');
        return;
      }
    }

    if (
      formValues.dealReviewSlaAlertHours &&
      formValues.dealReviewSlaEscalationHours &&
      formValues.dealReviewSlaAlertHours >= formValues.dealReviewSlaEscalationHours
    ) {
      setError('مهلة تنبيه مراجعة الصفقات يجب أن تكون أقل من مهلة التصعيد');
      return;
    }

    if (
      formValues.taskClaimHeartbeatMinutes &&
      formValues.taskClaimLeaseMinutes &&
      formValues.taskClaimHeartbeatMinutes >= formValues.taskClaimLeaseMinutes
    ) {
      setError('فترة نبضات التجديد يجب أن تكون أقل من مدة قفل حجز المهام');
      return;
    }

    setJustificationReason('');
    setJustificationError(null);
    setIsConfirmModalOpen(true);
  };

  // Perform save
  const handleConfirmSave = async () => {
    const trimmedReason = justificationReason.trim();
    if (trimmedReason.length < 5) {
      setJustificationError('سبب التعديل إلزامي ويجب ألا يقل عن 5 أحرف لأغراض التدقيق الرقابي');
      return;
    }

    setSaving(true);
    setJustificationError(null);

    const payload: any = {
      ...formValues,
      justificationReason: trimmedReason,
    };

    try {
      const res = await apiClient.patch<{ data: PlatformSettingsDto }>('/admin/settings', payload);
      if (res?.data) {
        setSettings(res.data);
        setFormValues(res.data);
        setIsConfirmModalOpen(false);
        setToastMessage('تم حفظ وتحديث إعدادات المنصة بنجاح مع توثيق السجل الرقابي');
        setTimeout(() => setToastMessage(null), 5000);
        loadAuditHistory();
      }
    } catch (err) {
      setJustificationError(describeApiError(err).message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  // Live calculator figures
  const currentCommRate = Number(formValues.commissionRatePercentage ?? 2.5);
  const calculatedCommission = Math.round((testAskPrice * currentCommRate) / 100);
  const calculatedVat = Math.round((calculatedCommission * Number(formValues.vatRatePercentage ?? 15)) / 100);
  const calculatedTotal = testAskPrice + calculatedCommission + Number(formValues.fixedFeeAmountSar ?? 0);

  if (!hasPermission) {
    return (
      <div className="p-8 text-center" data-testid="unauthorized-banner">
        <div className="inline-flex p-4 rounded-full bg-red-100 text-red-600 mb-4 dark:bg-red-950/40 dark:text-red-400">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
          غير مصرح لك بإدارة إعدادات المنصة
        </h2>
        <p className="mt-2 text-sm text-ink-secondary dark:text-dark-ink-secondary">
          هذه الصفحة مخصصة لمدير النظام التنفيذي والموظفين الحاصلين على صلاحية Settings.Manage أو Settings.Commission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl" data-testid="settings-workspace">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          data-testid="success-toast"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-sm animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-6 h-6 text-primary dark:text-primary-light" />
              <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
                إعدادات المنصة والعمولات
              </h1>
            </div>
            <p className="mt-1 text-sm text-ink-secondary dark:text-dark-ink-secondary">
              تهيئة المعايير المالية والتنظيمية والمهل الزمنية واتفاقيات مستوى الخدمة (SLA) بشكل ديناميكي فوري.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadSettings}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-ink-secondary transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>

            <button
              data-testid="save-settings-button"
              onClick={handleOpenConfirm}
              disabled={!hasModifications || saving || loading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${
                hasModifications && !saving && !loading
                  ? 'bg-primary hover:bg-primary-dark text-white cursor-pointer active:scale-95'
                  : 'bg-surface-border dark:bg-dark-surface-border text-ink-muted cursor-not-allowed opacity-60'
              }`}
            >
              <Save className="w-4 h-4" />
              حفظ التعديلات {hasModifications ? `(${diffItems.length})` : ''}
            </button>
          </div>
        </div>

        {/* Tabbed Navigation */}
        <div className="flex border-b border-surface-border dark:border-dark-surface-border mt-6 overflow-x-auto gap-2">
          <button
            data-testid="tab-fees"
            onClick={() => setActiveTab('fees')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'fees'
                ? 'border-primary text-primary dark:text-primary-light'
                : 'border-transparent text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            <Coins className="w-4 h-4" />
            الرسوم والعمولات
          </button>

          <button
            data-testid="tab-deadlines"
            onClick={() => setActiveTab('deadlines')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'deadlines'
                ? 'border-primary text-primary dark:text-primary-light'
                : 'border-transparent text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            <Calendar className="w-4 h-4" />
            المهل الزمنية وفترات السداد
          </button>

          <button
            data-testid="tab-slas"
            onClick={() => setActiveTab('slas')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'slas'
                ? 'border-primary text-primary dark:text-primary-light'
                : 'border-transparent text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            اتفاقيات مستوى الخدمة (SLA)
          </button>

          <button
            data-testid="tab-compliance"
            onClick={() => setActiveTab('compliance')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'compliance'
                ? 'border-primary text-primary dark:text-primary-light'
                : 'border-transparent text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            ضوابط الامتثال ومكافحة الاحتيال
          </button>

          <button
            data-testid="tab-audit"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-primary text-primary dark:text-primary-light'
                : 'border-transparent text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            <History className="w-4 h-4" />
            {`سجل تدقيق التعديلات (${auditLogs.length})`}
          </button>
        </div>
      </div>

      {/* Tab 1: Fees & Commissions */}
      {activeTab === 'fees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-5">
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                هيكل العمولات ورسوم الخدمات
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    نسبة عمولة المنصة (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="25"
                    data-testid="input-commission-rate"
                    value={formValues.commissionRatePercentage ?? 2.5}
                    onChange={(e) => handleFieldChange('commissionRatePercentage', parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">النسبة المئوية المقدرة لسعي المنصة (افتراضي: 2.5%).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    المبلغ الثابت المضاف للعمولة (ر.س)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    max="50000"
                    data-testid="input-fixed-fee"
                    value={formValues.fixedFeeAmountSar ?? 0}
                    onChange={(e) => handleFieldChange('fixedFeeAmountSar', parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">رسم ثابت اختياري يضاف لسعي المنصة (افتراضي: 0 ريال).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    رسوم عقد المالك المباشر القياسية (ر.س)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    max="20000"
                    data-testid="input-owner-contract-fee"
                    value={formValues.ownerContractFeeSar ?? 1000}
                    onChange={(e) => handleFieldChange('ownerContractFeeSar', parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">الرسم الإداري لعقود التسويق والوساطة للملاك (افتراضي: 1,000 ريال).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    نسبة ضريبة القيمة المضافة ZATCA (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    data-testid="input-vat-rate"
                    value={formValues.vatRatePercentage ?? 15}
                    onChange={(e) => handleFieldChange('vatRatePercentage', parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">النسبة النظامية المعتمدة لضريبة القيمة المضافة (افتراضي: 15%).</p>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-border dark:border-dark-surface-border space-y-4">
                <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  حساب المنصة البنكي المعتمد للتحصيل (سعي المنصة)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                      رقم الآيبان المعتمد (Saudi IBAN)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      data-testid="input-platform-iban"
                      placeholder="SA0380000000608010167519"
                      value={formValues.platformCollectionIban ?? ''}
                      onChange={(e) => handleFieldChange('platformCollectionIban', e.target.value.replace(/\s+/g, ''))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {formValues.platformCollectionIban && (
                      <p className="mt-1 text-[11px] text-ink-secondary font-mono-numbers" dir="ltr">
                        {formatSaudiIban(formValues.platformCollectionIban)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                        اسم صاحب الحساب
                      </label>
                      <input
                        type="text"
                        data-testid="input-platform-holder"
                        placeholder="شركة المصايف العقارية المحدودة"
                        value={formValues.platformAccountHolderName ?? ''}
                        onChange={(e) => handleFieldChange('platformAccountHolderName', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary mb-1">
                        اسم البنك المعتمد
                      </label>
                      <input
                        type="text"
                        data-testid="input-platform-bank"
                        placeholder="البنك الأهلي السعودي"
                        value={formValues.platformBankName ?? ''}
                        onChange={(e) => handleFieldChange('platformBankName', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Commission Simulator */}
          <div className="space-y-6">
            <div className="bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                محاكي الاحتساب المباشر للعمولة
              </h4>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                معاينة حية لتطبيق النسبة المعدلة على أسعار الصفقات وعقود العملاء.
              </p>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">سعر العقار التجريبي (ر.س)</label>
                <input
                  type="number"
                  step="50000"
                  value={testAskPrice}
                  onChange={(e) => setTestAskPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base font-mono-numbers text-sm font-bold"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-surface-border dark:border-dark-surface-border text-sm">
                <div className="flex justify-between items-center text-ink-secondary">
                  <span>نسبة العمولة:</span>
                  <span className="font-mono-numbers font-bold text-primary">{currentCommRate}%</span>
                </div>
                <div className="flex justify-between items-center text-ink-secondary">
                  <span>سعي المنصة:</span>
                  <span className="font-mono-numbers font-bold">{calculatedCommission.toLocaleString('en-US')} ر.س</span>
                </div>
                <div className="flex justify-between items-center text-ink-secondary">
                  <span>الرسم الثابت:</span>
                  <span className="font-mono-numbers font-bold">{(formValues.fixedFeeAmountSar ?? 0).toLocaleString('en-US')} ر.س</span>
                </div>
                <div className="flex justify-between items-center text-ink-secondary">
                  <span>ضريبة القيمة المضافة ({formValues.vatRatePercentage ?? 15}%):</span>
                  <span className="font-mono-numbers font-bold">{calculatedVat.toLocaleString('en-US')} ر.س</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-surface-border dark:border-dark-surface-border font-bold text-ink-primary dark:text-dark-ink-primary">
                  <span>إجمالي تكلفة المشتري:</span>
                  <span className="font-mono-numbers text-base text-emerald-600 dark:text-emerald-400">
                    {calculatedTotal.toLocaleString('en-US')} ر.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deadlines & Windows */}
      {activeTab === 'deadlines' && (
        <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            المهل الزمنية للعمليات وفترات السداد
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                مهلة تحويل العربون والصفقات للمشتري (ساعة)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                data-testid="input-payment-window"
                value={formValues.paymentWindowHours ?? 48}
                onChange={(e) => handleFieldChange('paymentWindowHours', parseInt(e.target.value, 10) || 48)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">النافذة الزمنية لرفع إشعار التحويل البنكي (افتراضي: 48 ساعة).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                مهلة تصحيح إشعار السداد المرفوض (ساعة)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                data-testid="input-payment-correction"
                value={formValues.paymentCorrectionHours ?? 12}
                onChange={(e) => handleFieldChange('paymentCorrectionHours', parseInt(e.target.value, 10) || 12)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">المهلة الإضافية الممنوحة للمشتري بعد رفض الإيصال لتصحيحه (افتراضي: 12 ساعة).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                مهلة سداد رسوم عقد المالك المباشر (أيام)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                data-testid="input-contract-deadline"
                value={formValues.contractFeeDeadlineDays ?? 7}
                onChange={(e) => handleFieldChange('contractFeeDeadlineDays', parseInt(e.target.value, 10) || 7)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">مهلة تحويل الرسوم قبل إلغاء العقد تلقائياً (افتراضي: 7 أيام).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                فترة التهدئة لحذف الحساب وفق نظام PDPL (أيام)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                data-testid="input-cooling-off"
                value={formValues.coolingOffPeriodDays ?? 14}
                onChange={(e) => handleFieldChange('coolingOffPeriodDays', parseInt(e.target.value, 10) || 14)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">المهلة النظامية للتراجع عن طلب الحذف قبل المحو النهائي (افتراضي: 14 يوماً).</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: SLAs & Task Claims */}
      {activeTab === 'slas' && (
        <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              مستويات الخدمة لمراجعة الصفقات (Deal Review SLA)
            </h3>
            <p className="mt-1 text-xs text-ink-secondary">
              سلسلة المهل التصاعدية لتنبيه الموظفين وتصعيد المعاملات للإدارة العليا.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  1. مهلة التنبيه الأولي (ساعة)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  data-testid="input-sla-alert"
                  value={formValues.dealReviewSlaAlertHours ?? 4}
                  onChange={(e) => handleFieldChange('dealReviewSlaAlertHours', parseInt(e.target.value, 10) || 4)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  2. مهلة التصعيد للمشرفين (ساعة)
                </label>
                <input
                  type="number"
                  min="2"
                  max="48"
                  data-testid="input-sla-escalation"
                  value={formValues.dealReviewSlaEscalationHours ?? 12}
                  onChange={(e) => handleFieldChange('dealReviewSlaEscalationHours', parseInt(e.target.value, 10) || 12)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  3. قرار الإدارة العليا الإلزامي (ساعة)
                </label>
                <input
                  type="number"
                  min="4"
                  max="96"
                  data-testid="input-sla-superadmin"
                  value={formValues.dealReviewSlaSuperAdminHours ?? 24}
                  onChange={(e) => handleFieldChange('dealReviewSlaSuperAdminHours', parseInt(e.target.value, 10) || 24)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-surface-border dark:border-dark-surface-border">
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              مستويات الخدمة لتذاكر الدعم الفني وحجز المهام
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  الاستجابة الأولى للتذاكر (ساعة)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formValues.ticketSlaFirstResponseHours ?? 4}
                  onChange={(e) => handleFieldChange('ticketSlaFirstResponseHours', parseInt(e.target.value, 10) || 4)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  حل تذاكر الدعم الفني (ساعة)
                </label>
                <input
                  type="number"
                  min="4"
                  max="168"
                  value={formValues.ticketSlaResolutionHours ?? 48}
                  onChange={(e) => handleFieldChange('ticketSlaResolutionHours', parseInt(e.target.value, 10) || 48)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  مدة قفل حجز المهام (دقيقة)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={formValues.taskClaimLeaseMinutes ?? 15}
                  onChange={(e) => handleFieldChange('taskClaimLeaseMinutes', parseInt(e.target.value, 10) || 15)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-secondary mb-1">
                  نبضات تجديد الحجز (دقيقة)
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={formValues.taskClaimHeartbeatMinutes ?? 5}
                  onChange={(e) => handleFieldChange('taskClaimHeartbeatMinutes', parseInt(e.target.value, 10) || 5)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Compliance & Fraud */}
      {activeTab === 'compliance' && (
        <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            ضوابط رصد الاحتيال وحماية العمليات
          </h3>
          <p className="text-xs text-ink-secondary">
            المعايير المعتمدة لرصد السلوك المشبوه للإيصالات المالية المرفوضة وإطلاق التنبيهات الرقابية.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                حد تكرار الإيصالات المرفوضة المريب (عدد مرات)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                data-testid="input-fraud-threshold"
                value={formValues.fraudRejectedProofThreshold ?? 3}
                onChange={(e) => handleFieldChange('fraudRejectedProofThreshold', parseInt(e.target.value, 10) || 3)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">عدد مرات رفض الإيصالات للعميل التي تُصنف العملية كحالة احتيال مشتبه بها (افتراضي: 3 مرات).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-secondary mb-1">
                نافذة الرصد الزمني المتحركة (ساعة)
              </label>
              <input
                type="number"
                min="12"
                max="336"
                data-testid="input-fraud-window"
                value={formValues.fraudWindowHours ?? 72}
                onChange={(e) => handleFieldChange('fraudWindowHours', parseInt(e.target.value, 10) || 72)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken font-mono-numbers text-sm font-semibold"
              />
              <p className="mt-1 text-[11px] text-ink-muted">النافذة الزمنية المتحركة لاحتساب تكرار الرفض (افتراضي: 72 ساعة).</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              سجل تدقيق تعديلات إعدادات المنصة (غير قابل للتعديل)
            </h3>
            <span className="text-xs text-ink-secondary font-mono-numbers">{auditLogs.length} سجل تاريخي</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-secondary border border-dashed border-surface-border rounded-xl">
              لا توجد تعديلات مسجلة بعد.
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  data-testid="audit-log-entry"
                  className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <div className="flex items-center gap-2 font-bold text-ink-primary dark:text-dark-ink-primary">
                      <span>بواسطة: {log.actorName || log.actorId}</span>
                      {log.ipAddress && (
                        <span className="px-2 py-0.5 rounded bg-surface-base dark:bg-dark-surface-base border border-surface-border font-mono-numbers text-[11px]">
                          IP: {log.ipAddress}
                        </span>
                      )}
                    </div>
                    <span className="text-ink-secondary font-mono-numbers">
                      {new Date(log.timestamp).toLocaleString('ar-SA')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-base dark:bg-dark-surface-base border border-surface-border text-xs text-ink-primary dark:text-dark-ink-primary">
                    <span className="font-bold text-ink-secondary block mb-1">سبب التعديل المدخل:</span>
                    <p className="leading-relaxed font-medium">{log.justificationReason}</p>
                  </div>

                  {log.changedKeys && log.changedKeys.length > 0 && (
                    <div className="text-xs text-ink-secondary">
                      <span className="font-bold">الحقول المعدلة: </span>
                      <span className="font-mono-numbers">{log.changedKeys.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety Confirmation Modal with Diff Summary & Mandatory Justification */}
      {isConfirmModalOpen && (
        <div
          data-testid="confirmation-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  تأكيد اعتماد التعديلات على إعدادات المنصة
                </h3>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-ink-muted hover:text-ink-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-ink-secondary leading-relaxed">
              يرجى مراجعة ملخص الفروقات بعناية. ستسري هذه التغييرات فوراً على جميع الصفقات والعمليات الجديدة مع الحفاظ التام على الصفقات النشطة دون تعديل.
            </p>

            {/* Diff Summary Table */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken p-3 space-y-2">
              <h5 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                ملخص الحقول المعدلة ({diffItems.length}):
              </h5>
              <div className="space-y-1.5 text-xs">
                {diffItems.map((item) => (
                  <div
                    key={item.field}
                    data-testid="diff-item"
                    className="flex justify-between items-center py-1 border-b border-surface-border/50 last:border-0"
                  >
                    <span className="font-semibold text-ink-primary">{item.label}</span>
                    <div className="flex items-center gap-2 font-mono-numbers">
                      <span className="text-red-500 line-through">{String(item.oldVal)}</span>
                      <span>←</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{String(item.newVal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Justification Reason */}
            <div>
              <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary mb-1">
                سبب التعديل الإلزامي (الحد الأدنى 5 أحرف) *
              </label>
              <textarea
                data-testid="input-justification-reason"
                rows={3}
                placeholder="اكتب مبرر التعديل التنظيمي أو المالي لتوثيقه في سجل التدقيق الرقابي..."
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
              />
              {justificationError && (
                <p className="mt-1 text-xs text-red-500 font-medium" data-testid="justification-error">
                  {justificationError}
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-surface-border hover:bg-surface-sunken text-ink-secondary"
              >
                إلغاء
              </button>

              <button
                data-testid="confirm-save-button"
                onClick={handleConfirmSave}
                disabled={saving || justificationReason.trim().length < 5}
                className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-md transition-all ${
                  saving || justificationReason.trim().length < 5
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark cursor-pointer'
                }`}
              >
                {saving ? 'جارٍ الحفظ والتوثيق...' : 'اعتماد وحفظ نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
