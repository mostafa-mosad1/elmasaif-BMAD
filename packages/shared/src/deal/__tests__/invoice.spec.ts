import { describe, it, expect } from 'vitest';
import { computeVatBreakdown, generateInvoiceNumber } from '../invoice';

describe('VAT and invoice helpers (Story 5.4)', () => {
  describe('computeVatBreakdown', () => {
    it('computes exact 15% VAT breakdown where subtotal + vat === total (FR-68, AR14)', () => {
      // 50,000 SAR commission
      const breakdown = computeVatBreakdown('50000.00', 0.15);
      expect(breakdown.totalAmount).toBe('50000.00');
      expect(breakdown.vatRate).toBe('0.15');
      expect(breakdown.vatTreatment).toBe('STANDARD_RATE_15');
      expect(breakdown.subtotalAmount).toBe('43478.26');
      expect(breakdown.vatAmount).toBe('6521.74');

      // Verify exact arithmetic match
      const subtotalBig = BigInt(breakdown.subtotalAmount.replace('.', ''));
      const vatBig = BigInt(breakdown.vatAmount.replace('.', ''));
      const totalBig = BigInt(breakdown.totalAmount.replace('.', ''));
      expect(subtotalBig + vatBig).toBe(totalBig);
    });

    it('handles rounding edge cases without precision loss', () => {
      // 100.00 SAR: 100 / 1.15 = 86.9565... => 86.96 subtotal, 13.04 VAT
      const b1 = computeVatBreakdown('100.00', 0.15);
      expect(b1.subtotalAmount).toBe('86.96');
      expect(b1.vatAmount).toBe('13.04');
      expect(b1.totalAmount).toBe('100.00');

      // 1,150.00 SAR: 1150 / 1.15 = 1000.00 exact
      const b2 = computeVatBreakdown('1150.00', 0.15);
      expect(b2.subtotalAmount).toBe('1000.00');
      expect(b2.vatAmount).toBe('150.00');
      expect(b2.totalAmount).toBe('1150.00');

      // 0.00 SAR
      const b3 = computeVatBreakdown('0.00', 0.15);
      expect(b3.subtotalAmount).toBe('0.00');
      expect(b3.vatAmount).toBe('0.00');
      expect(b3.totalAmount).toBe('0.00');
    });

    it('rejects invalid inputs', () => {
      expect(() => computeVatBreakdown('-50.00', 0.15)).toThrow();
      expect(() => computeVatBreakdown('abc', 0.15)).toThrow();
    });
  });

  describe('generateInvoiceNumber', () => {
    it('generates INV-${yyyyMMdd}-${dealNumber}', () => {
      const date = new Date(Date.UTC(2026, 10, 7, 12, 0, 0)); // 2026-11-07
      const invoiceNumber = generateInvoiceNumber('DL-20261107-0001', date);
      expect(invoiceNumber).toBe('INV-20261107-DL-20261107-0001');
    });
  });
});

