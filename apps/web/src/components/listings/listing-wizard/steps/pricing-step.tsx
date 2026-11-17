'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, AlertCircle, PlusCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { MIN_LISTING_PRICE_SAR, MAX_LISTING_PRICE_SAR } from '@elmasaif/shared';
import { ListingWizardFormState } from '../types';
import { PayoutAccountItem } from '../../../payout/monospace-iban-card';

interface PricingStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
}

export function PricingStep({ formData, updateForm, errors }: PricingStepProps) {
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentIban = formData.payoutIban;

  useEffect(() => {
    let isMounted = true;
    async function loadPayoutAccounts() {
      setLoadingAccounts(true);
      try {
        const res = await apiClient<{ data: PayoutAccountItem[] }>('/users/payout-accounts');
        if (isMounted) {
          const list = res?.data || [];
          setPayoutAccounts(list);
          // If no account currently selected and accounts exist, select default or first
          if (!currentIban && list.length > 0) {
            const defaultAcc = list.find((a) => a.isDefault) || list[0];
            const ibanValue = defaultAcc.ibanFormatted || defaultAcc.ibanMasked;
            if (ibanValue) {
              updateForm({ payoutIban: ibanValue });
            }
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setFetchError(err instanceof Error ? err.message : 'تعذر تحميل حسابات التحويل البنكي');
        }
      } finally {
        if (isMounted) {
          setLoadingAccounts(false);
        }
      }
    }

    loadPayoutAccounts();
    return () => {
      isMounted = false;
    };
  }, [currentIban, updateForm]);

  const numPrice = Number(formData.askPrice);
  const isPriceValid =
    formData.askPrice !== '' &&
    !isNaN(numPrice) &&
    numPrice >= MIN_LISTING_PRICE_SAR &&
    numPrice <= MAX_LISTING_PRICE_SAR;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">السعر وحساب الصرف</h2>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
          حدد السعر المطلوب لبيع العقار واختر الحساب البنكي المعتمد لاستلام مستحقات البيع.
        </p>
      </div>

      {/* Ask Price Input */}
      <div>
        <label htmlFor="ask-price" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
          السعر المطلوب (ريال سعودي) <span className="text-status-danger">*</span>
        </label>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2">
          يجب أن يكون السعر محدداً بدقة بين 1 و 50,000,000 ريال سعودي (لا يسمح بالنطاقات السعرية أو الإيجار).
        </p>
        <div className="relative">
          <input
            id="ask-price"
            type="number"
            min={MIN_LISTING_PRICE_SAR}
            max={MAX_LISTING_PRICE_SAR}
            step="1"
            value={formData.askPrice}
            onChange={(e) => updateForm({ askPrice: e.target.value ? Number(e.target.value) : '' })}
            placeholder="مثال: 3500000"
            className={`w-full px-4 py-3 rounded-lg border text-base font-semibold transition-colors focus:outline-none focus:ring-2 pl-24 bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted ${
              errors.askPrice || (formData.askPrice !== '' && !isPriceValid)
                ? 'border-status-danger focus:ring-status-danger/20'
                : 'border-surface-border dark:border-dark-surface-border focus:border-accent focus:ring-accent/20'
            }`}
          />
          <div className="absolute left-3 top-3 px-2 py-0.5 bg-surface-base dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary text-xs font-bold rounded">
            ر.س SAR
          </div>
        </div>

        {errors.askPrice && <p className="text-xs text-status-danger mt-1">{errors.askPrice}</p>}

        {isPriceValid && (
          <div className="mt-2 text-sm text-accent-dark dark:text-accent font-medium">
            المبلغ كتابة: {numPrice.toLocaleString('ar-SA')} ريال سعودي
          </div>
        )}
      </div>

      {/* Payout IBAN Selection */}
      <div className="border-t border-surface-border dark:border-dark-surface-border pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <label className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-accent" />
              حساب الصرف البنكي المعتمد <span className="text-status-danger">*</span>
            </label>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
              الحساب البنكي السعودي الذي ستودع فيه أموال الصفقة عند إتمام البيع.
            </p>
          </div>
          <Link
            href="/app/settings/payout"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark dark:text-accent hover:underline transition-colors w-fit"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            إدارة وتوثيق حسابات الصرف
          </Link>
        </div>

        {fetchError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
        )}

        {loadingAccounts ? (
          <div className="p-6 text-center text-sm text-ink-muted bg-surface-sunken dark:bg-dark-surface-sunken rounded-xl border border-surface-border dark:border-dark-surface-border animate-pulse">
            جاري تحميل حسابات الصرف المسجلة...
          </div>
        ) : payoutAccounts.length === 0 ? (
          <div className="p-6 text-center bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <AlertCircle className="w-8 h-8 text-accent mx-auto mb-2" />
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              لا يوجد حساب صرف بنكي مسجل
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 max-w-md mx-auto">
              يلزم ربط وتوثيق حساب بنكي سعودي مسجل باسمك لتتمكن من إنشاء الإعلان واستلام عوائد البيع بأمان.
            </p>
            <Link
              href="/app/settings/payout"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              إضافة وتوثيق حساب بنكي الآن
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {payoutAccounts.map((account) => {
              const accountIban = account.ibanFormatted || account.ibanMasked;
              const isSelected = formData.payoutIban === accountIban || formData.payoutIban === account.ibanMasked;
              return (
                <div
                  key={account.id}
                  onClick={() => updateForm({ payoutIban: accountIban })}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-accent bg-accent-light/30 dark:bg-amber-950/20 shadow-sm'
                      : 'border-surface-border dark:border-dark-surface-border hover:border-surface-borderStrong dark:hover:border-dark-surface-borderStrong bg-surface-base dark:bg-dark-surface-base'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent text-white'
                          : 'border-surface-border dark:border-dark-surface-border'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                          {account.accountHolderName}
                        </span>
                        {account.bankName && (
                          <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                            ({account.bankName})
                          </span>
                        )}
                        {account.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 bg-accent-light dark:bg-amber-950/60 text-accent-dark dark:text-accent border border-accent/30 font-semibold rounded-full">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 tracking-wider" dir="ltr">
                        {account.ibanMasked}
                      </div>
                    </div>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {errors.payoutIban && <p className="text-xs text-status-danger mt-2">{errors.payoutIban}</p>}
      </div>
    </div>
  );
}
