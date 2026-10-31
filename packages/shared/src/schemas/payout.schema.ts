import { z } from 'zod';
import { saudiIbanSchema } from './index';

export const SAUDI_BANK_NAMES: Record<string, string> = {
  '80': 'مصرف الراجحي',
  '10': 'البنك الأهلي السعودي',
  '50': 'بنك الرياض',
  '05': 'مصرف الإنماء',
  '20': 'بنك الأول SABB',
  '15': 'بنك البلاد',
  '45': 'البنك السعودي الفرنسي',
  '30': 'البنك العربي الوطني',
  '65': 'بنك الجزيرة',
  '60': 'بنك مسقط',
  '76': 'بنك الخليج الدولي',
  '85': 'بنك الإمارات دبي الوطني',
  '90': 'بنك دي 360',
  '95': 'إس تي سي بنك'
};

export function getSaudiBankName(iban: string): string | null {
  if (!iban) return null;
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  if (cleanIban.length < 6 || !cleanIban.startsWith('SA')) {
    return null;
  }
  const bankCode = cleanIban.substring(4, 6);
  return SAUDI_BANK_NAMES[bankCode] || null;
}

export function formatSaudiIban(iban: string): string {
  if (!iban) return '';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  const chunks = clean.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : clean;
}

export function maskSaudiIban(iban: string): string {
  if (!iban) return '';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (clean.length < 8) return clean;
  const prefix = clean.substring(0, 4);
  const suffix = clean.substring(clean.length - 4);
  return `${prefix} **** **** **** **** ${suffix}`;
}

export const createPayoutAccountSchema = z.object({
  accountHolderName: z
    .string()
    .trim()
    .min(3, 'اسم صاحب الحساب يجب أن يتكون من 3 أحرف على الأقل')
    .max(100, 'اسم صاحب الحساب لا يتجاوز 100 حرف'),
  iban: saudiIbanSchema,
  otpCode: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام'),
  isDefault: z.boolean().optional().default(true)
});

export const updatePayoutAccountSchema = z.object({
  accountHolderName: z
    .string()
    .trim()
    .min(3, 'اسم صاحب الحساب يجب أن يتكون من 3 أحرف على الأقل')
    .max(100, 'اسم صاحب الحساب لا يتجاوز 100 حرف')
    .optional(),
  iban: saudiIbanSchema.optional(),
  otpCode: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام'),
  isDefault: z.boolean().optional()
});

export const payoutAccountResponseSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  accountHolderName: z.string(),
  bankName: z.string().nullable().optional(),
  ibanMasked: z.string(),
  ibanLast4: z.string(),
  ibanFormatted: z.string().optional(),
  isDefault: z.boolean(),
  hasCommercialNameMismatch: z.boolean(),
  isBoundToActiveDeal: z.boolean().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

