import { describe, expect, it } from 'vitest';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SLA_FIRST_RESPONSE_HOURS,
  TICKET_SLA_RESOLUTION_HOURS,
  TICKET_SLA_WARNING_THRESHOLD_MINUTES,
  TICKET_STATUSES,
  VIOLATION_ACTIONS,
  VIOLATION_CATEGORIES,
  VIOLATION_REPORT_MAX_ATTACHMENTS,
  VIOLATION_REPORT_STATUSES,
  VIOLATION_TARGET_TYPES,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  SUPPORT_ATTACHMENT_MAX_FILE_SIZE,
} from '../../constants/support';
import {
  adjudicateViolationReportSchema,
  adminTicketQueueQuerySchema,
  adminViolationQueueQuerySchema,
  createSupportTicketSchema,
  createTicketMessageSchema,
  createViolationReportSchema,
  dismissViolationReportSchema,
  updateSupportTicketStatusSchema,
} from '../support.schema';

describe('Story 8.5 / Support & Violation Reporting Schemas & Constants', () => {
  describe('Canonical SLA Constants & Limits (AC1 / FR-37, FR-38)', () => {
    it('enforces expected SLA hours and attachment constraints', () => {
      expect(TICKET_SLA_FIRST_RESPONSE_HOURS).toBe(4);
      expect(TICKET_SLA_RESOLUTION_HOURS).toBe(48);
      expect(TICKET_SLA_WARNING_THRESHOLD_MINUTES).toBe(60);
      expect(VIOLATION_REPORT_MAX_ATTACHMENTS).toBe(5);
      expect(SUPPORT_TICKET_MAX_ATTACHMENTS).toBe(5);
      expect(SUPPORT_ATTACHMENT_MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('exposes full enum arrays for violation and ticket lifecycles', () => {
      expect(VIOLATION_TARGET_TYPES).toContain('LISTING');
      expect(VIOLATION_CATEGORIES).toContain('FRAUDULENT_LISTING');
      expect(VIOLATION_REPORT_STATUSES).toEqual(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']);
      expect(VIOLATION_ACTIONS).toContain('LISTING_REMOVED');
      expect(TICKET_CATEGORIES).toContain('TECHNICAL_ISSUE');
      expect(TICKET_PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
      expect(TICKET_STATUSES).toEqual(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
    });
  });

  describe('createViolationReportSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('validates a complete violation report payload', () => {
      const payload = {
        targetType: 'LISTING' as const,
        targetListingId: validUuid,
        category: 'FRAUDULENT_LISTING' as const,
        description: 'هذا الإعلان يحتوي على صور مأخوذة من منصة أخرى وسعر غير حقيقي.',
        attachments: ['https://storage.elmasaif.sa/reports/doc1.pdf'],
        reporterName: 'سعد التميمي',
        reporterEmail: 'saad@example.com',
        reporterPhone: '0512345678',
      };

      const result = createViolationReportSchema.parse(payload);
      expect(result.targetType).toBe('LISTING');
      expect(result.targetListingId).toBe(validUuid);
      expect(result.category).toBe('FRAUDULENT_LISTING');
      expect(result.attachments).toHaveLength(1);
    });

    it('validates minimal violation report payload with defaults', () => {
      const payload = {
        targetType: 'BROKER' as const,
        category: 'UNAUTHORIZED_BROKER' as const,
        description: 'الوسيط يمارس الوساطة بدون رخصة فال سارية.',
      };

      const result = createViolationReportSchema.parse(payload);
      expect(result.attachments).toEqual([]);
      expect(result.reporterName).toBeUndefined();
    });

    it('rejects short descriptions under 10 characters', () => {
      const payload = {
        targetType: 'OTHER' as const,
        category: 'OTHER' as const,
        description: 'قصير',
      };

      expect(() => createViolationReportSchema.parse(payload)).toThrow(/at least 10 characters/);
    });

    it('rejects more than 5 attachments', () => {
      const payload = {
        targetType: 'LISTING' as const,
        category: 'MISLEADING_INFORMATION' as const,
        description: 'تفاصيل الإعلان غير صحيحة والمساحة مبالغ فيها بشكل واضح.',
        attachments: ['1', '2', '3', '4', '5', '6'],
      };

      expect(() => createViolationReportSchema.parse(payload)).toThrow(/Maximum 5 attachments/);
    });

    it('validates Saudi mobile number patterns or empty string', () => {
      const base = {
        targetType: 'USER' as const,
        category: 'ABUSIVE_BEHAVIOR' as const,
        description: 'المستخدم يرسل رسائل مسيئة عبر المحادثة.',
      };

      expect(createViolationReportSchema.parse({ ...base, reporterPhone: '0501234567' }).reporterPhone).toBe(
        '0501234567',
      );
      expect(createViolationReportSchema.parse({ ...base, reporterPhone: '+966501234567' }).reporterPhone).toBe(
        '+966501234567',
      );
      expect(createViolationReportSchema.parse({ ...base, reporterPhone: '' }).reporterPhone).toBe('');
      expect(() => createViolationReportSchema.parse({ ...base, reporterPhone: '0123456789' })).toThrow(
        /Invalid Saudi mobile number/,
      );
    });
  });

  describe('adjudicateViolationReportSchema and dismissViolationReportSchema', () => {
    it('validates adjudication with valid action and notes', () => {
      const parsed = adjudicateViolationReportSchema.parse({
        action: 'LISTING_REMOVED',
        notes: 'تم التحقق من زيف الصك وتم حجب الإعلان نهائياً.',
      });
      expect(parsed.action).toBe('LISTING_REMOVED');
      expect(parsed.status).toBe('RESOLVED');
    });

    it('rejects adjudication with notes shorter than 5 characters', () => {
      expect(() =>
        adjudicateViolationReportSchema.parse({
          action: 'NO_ACTION',
          notes: 'تم',
        }),
      ).toThrow(/at least 5 characters/);
    });

    it('validates dismissal with explanatory notes', () => {
      const parsed = dismissViolationReportSchema.parse({
        notes: 'البلاغ كيدي والوثائق المرفقة في الإعلان سليمة تماماً.',
      });
      expect(parsed.notes).toContain('البلاغ كيدي');
    });
  });

  describe('createSupportTicketSchema', () => {
    it('validates valid support ticket payload', () => {
      const payload = {
        category: 'TECHNICAL_ISSUE' as const,
        subject: 'تعذر رفع إثبات الحوالة البنكية',
        description: 'عند الضغط على زر تحميل ملف الإيصال تظهر رسالة خطأ 500 في صفحة إتمام الصفقة.',
        priority: 'HIGH' as const,
        contactName: 'فهد المطيري',
        contactEmail: 'fahad@example.com',
        contactPhone: '0555555555',
        attachments: ['https://storage.elmasaif.sa/tickets/screenshot1.png'],
      };

      const result = createSupportTicketSchema.parse(payload);
      expect(result.priority).toBe('HIGH');
      expect(result.contactEmail).toBe('fahad@example.com');
      expect(result.attachments).toHaveLength(1);
    });

    it('rejects invalid email and short subject/description', () => {
      expect(() =>
        createSupportTicketSchema.parse({
          category: 'PAYMENT_ISSUE',
          subject: 'لا',
          description: 'صغير',
          contactName: 'أحمد',
          contactEmail: 'not-an-email',
        }),
      ).toThrow();
    });
  });

  describe('updateSupportTicketStatusSchema', () => {
    it('allows transition to IN_PROGRESS without resolution summary', () => {
      const result = updateSupportTicketStatusSchema.parse({
        status: 'IN_PROGRESS',
      });
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('requires resolutionSummary when status is RESOLVED', () => {
      expect(() =>
        updateSupportTicketStatusSchema.parse({
          status: 'RESOLVED',
        }),
      ).toThrow(/Resolution summary is mandatory/);

      const valid = updateSupportTicketStatusSchema.parse({
        status: 'RESOLVED',
        resolutionSummary: 'تم حل المشكلة التقنية وتم التحقق من رفع إيصال الدفع بنجاح.',
      });
      expect(valid.resolutionSummary).toBeDefined();
    });

    it('requires resolutionSummary when status is CLOSED', () => {
      expect(() =>
        updateSupportTicketStatusSchema.parse({
          status: 'CLOSED',
          resolutionSummary: 'لا',
        }),
      ).toThrow(/Resolution summary is mandatory/);
    });
  });

  describe('createTicketMessageSchema', () => {
    it('validates staff internal note', () => {
      const result = createTicketMessageSchema.parse({
        message: 'تم مراجعة سجلات الحوالة مع البنك وننتظر تأكيد قسم المحاسبة.',
        isInternal: true,
      });
      expect(result.isInternal).toBe(true);
      expect(result.attachments).toEqual([]);
    });

    it('rejects empty message', () => {
      expect(() =>
        createTicketMessageSchema.parse({
          message: '   ',
        }),
      ).toThrow();
    });
  });

  describe('Query schemas: adminViolationQueueQuerySchema & adminTicketQueueQuerySchema', () => {
    it('coerces string pagination parameters and applies defaults', () => {
      const violationQuery = adminViolationQueueQuerySchema.parse({
        status: 'PENDING',
        page: '2',
        limit: '15',
      });
      expect(violationQuery.page).toBe(2);
      expect(violationQuery.limit).toBe(15);
      expect(violationQuery.status).toBe('PENDING');

      const ticketQuery = adminTicketQueueQuerySchema.parse({
        page: '1',
        slaState: 'NEARING_BREACH',
      });
      expect(ticketQuery.slaState).toBe('NEARING_BREACH');
      expect(ticketQuery.status).toBe('ALL');
    });
  });
});

