import { CONTRACT_FEE_PAYMENT_STATUS, type ContractFeePaymentStatus } from '@elmasaif/shared';

export function formatLockCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CONTRACT_FEE_STATUS_CONFIG: Record<
  ContractFeePaymentStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  [CONTRACT_FEE_PAYMENT_STATUS.PENDING]: {
    label: 'بانتظار السداد',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  [CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED]: {
    label: 'تم رفع الإشعار (بانتظار التدقيق)',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  [CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW]: {
    label: 'قيد التدقيق الإداري',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  [CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED]: {
    label: 'مؤكد ومعتمد',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  [CONTRACT_FEE_PAYMENT_STATUS.REJECTED]: {
    label: 'إشعار مرفوض',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  [CONTRACT_FEE_PAYMENT_STATUS.EXPIRED]: {
    label: 'منتهي الصلاحية',
    bg: 'bg-surface-sunken dark:bg-dark-surface-sunken',
    text: 'text-ink-secondary dark:text-dark-ink-secondary',
    border: 'border-surface-border dark:border-dark-surface-border',
  },
};

