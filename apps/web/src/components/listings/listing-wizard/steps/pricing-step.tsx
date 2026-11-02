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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">السعر وحساب الصرف</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          حدد السعر المطلوب لبيع العقار واختر الحساب البنكي المعتمد لاستلام مستحقات البيع.
        </p>
      </div>

      {/* Ask Price Input */}
      <div>
        <label htmlFor="ask-price" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          السعر المطلوب (ريال سعودي) <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
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
            className={`w-full px-4 py-3 rounded-lg border text-base font-semibold transition-colors focus:outline-none focus:ring-2 pl-24 ${
              errors.askPrice || (formData.askPrice !== '' && !isPriceValid)
                ? 'border-red-500 focus:ring-red-200'
                : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
            }`}
          />
          <div className="absolute left-3 top-3 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded">
            ر.س SAR
          </div>
        </div>

        {errors.askPrice && <p className="text-xs text-red-500 mt-1">{errors.askPrice}</p>}

        {isPriceValid && (
          <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            المبلغ كتابة: {numPrice.toLocaleString('ar-SA')} ريال سعودي
          </div>
        )}
      </div>

      {/* Payout IBAN Selection */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              حساب الصرف البنكي المعتمد <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              الحساب البنكي السعودي الذي ستودع فيه أموال الصفقة عند إتمام البيع.
            </p>
          </div>
          <Link
            href="/app/settings/payout"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors w-fit"
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
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse">
            جاري تحميل حسابات الصرف المسجلة...
          </div>
        ) : payoutAccounts.length === 0 ? (
          <div className="p-6 text-center bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              لا يوجد حساب صرف بنكي مسجل
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 max-w-md mx-auto">
              يلزم ربط وتوثيق حساب بنكي سعودي مسجل باسمك لتتمكن من إنشاء الإعلان واستلام عوائد البيع بأمان.
            </p>
            <Link
              href="/app/settings/payout"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
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
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {account.accountHolderName}
                        </span>
                        {account.bankName && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({account.bankName})
                          </span>
                        )}
                        {account.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold rounded-full">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-600 dark:text-slate-300 mt-1 tracking-wider" dir="ltr">
                        {account.ibanMasked}
                      </div>
                    </div>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {errors.payoutIban && <p className="text-xs text-red-500 mt-2">{errors.payoutIban}</p>}
      </div>
    </div>
  );
}
