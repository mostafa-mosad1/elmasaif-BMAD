import { describe, it, expect } from 'vitest';
import {
  maskContactDetails,
  normalizeDigits,
  summarizeMaskDetections,
} from '../contact-mask';

/**
 * Story 4.4 / AC-1: the shared masking engine is the only place that owns contact-detection
 * patterns, so these tests are the contract both `apps/web` (live preview) and `apps/api`
 * (authoritative gate) rely on.
 */
describe('maskContactDetails — Story 4.4 / AC-1', () => {
  describe('Saudi mobile number variants', () => {
    it('masks the domestic 05XXXXXXXX form with asterisks of the same length', () => {
      const result = maskContactDetails('اتصل بي 0551234567');
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).toBe('اتصل بي **********');
      expect(result.maskedText).not.toContain('0551234567');
      expect(result.detections).toEqual([{ type: 'PHONE', start: 8, length: 10 }]);
    });

    it('masks the +9665XXXXXXXX international form', () => {
      const result = maskContactDetails('+966512345678');
      expect(result.maskedText).toBe('*************');
      expect(result.detections[0]).toMatchObject({ type: 'PHONE', start: 0, length: 13 });
    });

    it('masks the 009665XXXXXXXX international form', () => {
      const result = maskContactDetails('00966512345678');
      expect(result.maskedText).toBe('**************');
      expect(result.wasMasked).toBe(true);
    });

    it('masks the bare 9665XXXXXXXX form', () => {
      const result = maskContactDetails('966512345678');
      expect(result.maskedText).toBe('************');
      expect(result.detections[0].type).toBe('PHONE');
    });

    it('masks a number written with spaces between digit groups', () => {
      const result = maskContactDetails('055 123 4567');
      expect(result.maskedText).toBe('************');
      expect(result.maskedText).not.toContain('123');
    });

    it('masks a number written with dashes between digit groups', () => {
      const result = maskContactDetails('055-123-4567');
      expect(result.maskedText).toBe('************');
    });

    it('masks an international number with a space after the country code', () => {
      const result = maskContactDetails('966 551234567');
      expect(result.maskedText).toBe('*************');
      expect(result.wasMasked).toBe(true);
    });

    it('does not mask a bare 9-digit figure (prices, areas and references stay readable)', () => {
      const result = maskContactDetails('السعر 551234567 ريال');
      expect(result.wasMasked).toBe(false);
      expect(result.maskedText).toBe('السعر 551234567 ريال');
      expect(result.detections).toEqual([]);
    });
  });

  describe('Arabic-Indic digits', () => {
    it('detects a domestic number written with Arabic-Indic digits', () => {
      const result = maskContactDetails('٠٥٥١٢٣٤٥٦٧');
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).toBe('**********');
      expect(result.detections[0]).toMatchObject({ type: 'PHONE', start: 0, length: 10 });
    });

    it('detects an international number written with extended Arabic-Indic digits', () => {
      const result = maskContactDetails('+۹۶۶۵۱۲۳۴۵۶۷۸');
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).toBe('*************');
    });

    it('normalizes both digit families onto ASCII without changing the length', () => {
      const input = '٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ 0123456789';
      expect(normalizeDigits(input)).toBe('0123456789 0123456789 0123456789');
      expect(normalizeDigits(input)).toHaveLength(input.length);
    });
  });

  describe('email addresses', () => {
    it('masks an email address', () => {
      const result = maskContactDetails('راسلني على buyer@example.com');
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).toBe('راسلني على *****************');
      expect(result.detections[0].type).toBe('EMAIL');
      expect(result.maskedText).not.toContain('example');
    });

    it('masks an email with a plus tag and a dotted local part', () => {
      const result = maskContactDetails('first.last+tag@sub.example.co');
      expect(result.maskedText).toBe('*'.repeat('first.last+tag@sub.example.co'.length));
    });

    it('leaves a lone @ sign untouched when it is not an email or a handle', () => {
      const result = maskContactDetails('السعر 5000 @ العقار');
      expect(result.wasMasked).toBe(false);
    });
  });

  describe('handles and external platform links', () => {
    it('masks an @handle', () => {
      const result = maskContactDetails('حسابي @my_snap');
      expect(result.maskedText).toBe('حسابي ********');
      expect(result.detections[0].type).toBe('HANDLE');
    });

    it('masks an Arabic @handle', () => {
      const result = maskContactDetails('حسابي @اسم_الحساب');
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).not.toContain('@');
    });

    it.each([
      'wa.me/966512345678',
      'https://wa.me/966512345678',
      't.me/my_channel',
      'telegram.me/my_channel',
      'snapchat.com/add/my_snap',
      'instagram.com/my_page',
      'twitter.com/my_handle',
      'x.com/my_handle',
      'tiktok.com/@my_handle',
    ])('masks the external link %s', (link) => {
      const result = maskContactDetails(`تواصل عبر ${link} مباشرة`);
      expect(result.wasMasked).toBe(true);
      expect(result.maskedText).toContain('*'.repeat(link.length));
      expect(result.maskedText).not.toContain(link);
    });
  });

  describe('multiple matches, overlap merge and preservation', () => {
    it('masks several detections of different types in one message', () => {
      const result = maskContactDetails('اتصل بي 0551234567 أو buyer@example.com أو @my_snap');
      expect(result.wasMasked).toBe(true);
      expect(result.detections).toHaveLength(3);
      expect(result.detections.map((detection) => detection.type)).toEqual([
        'PHONE',
        'EMAIL',
        'HANDLE',
      ]);
      expect(result.maskedText).not.toMatch(/0551|example|@my_snap/);
    });

    it('merges an overlapping @handle inside an email into a single span', () => {
      const result = maskContactDetails('buyer@example.com');
      expect(result.detections).toHaveLength(1);
      expect(result.detections[0].type).toBe('EMAIL');
      expect(result.maskedText).toBe('*****************');
    });

    it('merges a nested @handle inside an external link into one span', () => {
      const result = maskContactDetails('https://tiktok.com/@my_handle');
      expect(result.detections).toHaveLength(1);
      expect(result.maskedText).toBe('*'.repeat('https://tiktok.com/@my_handle'.length));
    });

    it('preserves Arabic wording, punctuation and newlines exactly', () => {
      const input = 'السلام عليكم،\nهل العقار متاح؟\nشكراً.';
      const result = maskContactDetails(input);
      expect(result.wasMasked).toBe(false);
      expect(result.maskedText).toBe(input);
    });

    it('keeps the surrounding Arabic text intact around a masked span', () => {
      const result = maskContactDetails('جوال 0551234567 متاح');
      expect(result.maskedText).toBe('جوال ********** متاح');
    });
  });

  describe('idempotency and non-disclosure', () => {
    it('is a no-op on an already-masked string', () => {
      const first = maskContactDetails('0551234567 buyer@example.com @my_snap');
      expect(first.wasMasked).toBe(true);

      const second = maskContactDetails(first.maskedText);
      expect(second.wasMasked).toBe(false);
      expect(second.detections).toEqual([]);
      expect(second.maskedText).toBe(first.maskedText);
    });

    it('never returns the detected values — only type, offset and length', () => {
      const result = maskContactDetails('0551234567 buyer@example.com @my_snap');
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('0551234567');
      expect(serialized).not.toContain('buyer@example.com');
      expect(serialized).not.toContain('my_snap');
      for (const detection of result.detections) {
        expect(Object.keys(detection).sort()).toEqual(['length', 'start', 'type']);
      }
    });

    it('handles empty and non-string input defensively', () => {
      expect(maskContactDetails('')).toEqual({ maskedText: '', detections: [], wasMasked: false });
      expect(
        maskContactDetails(undefined as unknown as string),
      ).toEqual({ maskedText: '', detections: [], wasMasked: false });
    });
  });

  describe('summarizeMaskDetections', () => {
    it('reports distinct types and the total count without any value', () => {
      const result = maskContactDetails('0551234567 / 0547654321 / a@b.co');
      const summary = summarizeMaskDetections(result.detections);
      expect(summary.types).toEqual(['PHONE', 'EMAIL']);
      expect(summary.count).toBe(3);
      expect(JSON.stringify(summary)).not.toContain('0551');
    });

    it('returns an empty summary when nothing was masked', () => {
      expect(summarizeMaskDetections([])).toEqual({ types: [], count: 0 });
    });
  });
});
