import { describe, expect, it } from 'vitest';
import { maskArabicName } from '../name-mask';

describe('maskArabicName (Story 6.5 / AC-4, FR-32)', () => {
  it('masks standard two-part Arabic names with "ال" prefix on family name', () => {
    // "طارق الشمري" -> "ط*** ش***"
    expect(maskArabicName('طارق الشمري')).toBe('ط*** ش***');
  });

  it('masks multi-part Arabic names correctly', () => {
    // "محمد أحمد علي" -> "م*** أ*** ع***"
    expect(maskArabicName('محمد أحمد علي')).toBe('م*** أ*** ع***');
  });

  it('masks single-word Arabic name', () => {
    expect(maskArabicName('سارة')).toBe('س***');
  });

  it('masks name where word starts with ال and has length > 2', () => {
    // "الراجحي" -> "ر***"
    expect(maskArabicName('الراجحي')).toBe('ر***');
  });

  it('handles names with extra whitespace and tabs', () => {
    expect(maskArabicName('  عبدالله   المطيري  ')).toBe('ع*** م***');
  });

  it('returns default fallback when input is empty or null or undefined', () => {
    expect(maskArabicName('')).toBe('مشتري مجهول');
    expect(maskArabicName(null as unknown as string)).toBe('مشتري مجهول');
    expect(maskArabicName(undefined as unknown as string)).toBe('مشتري مجهول');
    expect(maskArabicName('   ')).toBe('مشتري مجهول');
  });
});

