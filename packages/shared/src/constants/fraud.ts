import { FraudStatus, FraudSeverity, FraudEventType } from '../enums/fraud';

export const AUDIT_ACTION_FRAUD_LOGGED = 'FRAUD_LOGGED';
export const AUDIT_ACTION_FRAUD_RESOLVED = 'FRAUD_RESOLVED';
export const AUDIT_ACTION_PENALTY_RECORDED = 'COMPLIANCE_PENALTY_RECORDED';
export const AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED = 'MARKETER_FRAUD_SUSPENDED';

export const FRAUD_STATUS_LABELS_AR: Record<FraudStatus, string> = {
  [FraudStatus.OPEN]: 'مفتوحة قيد المتابعة',
  [FraudStatus.INVESTIGATING]: 'قيد التحقيق',
  [FraudStatus.RESOLVED]: 'معالجة ومغلقة',
  [FraudStatus.DISMISSED]: 'محفوظة لعدم الثبوت',
};

export const FRAUD_SEVERITY_LABELS_AR: Record<FraudSeverity, string> = {
  [FraudSeverity.LOW]: 'منخفض (Low)',
  [FraudSeverity.MEDIUM]: 'متوسط (Medium)',
  [FraudSeverity.HIGH]: 'مرتفع (High)',
  [FraudSeverity.CRITICAL]: 'حرج جداً (Critical)',
};

export const FRAUD_EVENT_TYPE_LABELS_AR: Record<FraudEventType, string> = {
  [FraudEventType.REPEATED_REJECTED_PROOFS]: 'تكرار رفض إثباتات الدفع',
  [FraudEventType.REPEATED_IBAN_CHANGES]: 'تكرار تعديل الحسابات البنكية',
  [FraudEventType.REPEATED_CANCELLATIONS]: 'تكرار إلغاء الصفقات',
  [FraudEventType.SUSPICIOUS_MESSAGING]: 'رسائل ومراسلات مشبوهة خارج المنصة',
  [FraudEventType.UNAUTHORIZED_BROKER_ACTIVITY]: 'نشاط وساطة عقارية غير مرخص',
  [FraudEventType.MANUAL_SUSPICIOUS_REPORT]: 'تقرير شبهة يدوي من المشرف',
};
