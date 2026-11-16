'use client';

import React from 'react';
import {
  Clock,
  FileText,
  Image as ImageIcon,
  CreditCard,
  MapPin,
  Lock,
  Eye,
} from 'lucide-react';
import { DocumentVisibility, PropertyType } from '@elmasaif/shared';
import { ListingWizardFormState } from '../types';

interface ReviewStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
  isSubmitting: boolean;
}

const PROPERTY_TYPE_NAMES: Record<PropertyType, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري / مكاتب',
  [PropertyType.FARM]: 'مزرعة',
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TITLE_DEED: 'صك الملكية الإلكتروني',
  OWNER_AUTHORIZATION: 'عقد تفويض المالك / وساطة',
  FLOOR_PLAN: 'مخطط هندسي',
  COMMERCIAL_REGISTRATION: 'سجل تجاري',
  OTHER: 'مستند إضافي',
};

export function ReviewStep({ formData, updateForm, errors, isSubmitting }: ReviewStepProps) {
  const numPrice = Number(formData.askPrice);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">المراجعة والاعتماد النهائي</h2>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
          يرجى مراجعة كافة تفاصيل الإعلان والوثائق المرفقة بعناية قبل إرساله إلى إدارة المنصة للاعتماد.
        </p>
      </div>

      {/* Status Notice Card */}
      <div className="p-4 bg-accent-light/30 dark:bg-amber-950/20 border border-accent/30 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent" />
          <div>
            <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">حالة العقار عند الإرسال:</span>
            <div className="text-sm font-bold text-accent-dark dark:text-accent">
              قيد مراجعة الإدارة (PendingAdminReview)
            </div>
          </div>
        </div>
        <span className="text-[11px] px-2.5 py-1 bg-accent text-white font-bold rounded-full">
          مرحلة الفحص والتدقيق
        </span>
      </div>

      {/* Main Review Summary Card */}
      <div className="border border-surface-border dark:border-dark-surface-border rounded-2xl bg-surface-base dark:bg-dark-surface-base p-6 space-y-6 shadow-level1">
        {/* Section 1: Basic Info & Pricing */}
        <div>
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-3">
            {formData.title || 'بدون عنوان'}
          </h3>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed mb-4">
            {formData.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-xs">
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block mb-0.5">نوع العقار</span>
              <span className="font-bold text-ink-primary dark:text-dark-ink-primary">
                {PROPERTY_TYPE_NAMES[formData.propertyType] || formData.propertyType}
              </span>
            </div>
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block mb-0.5">السعر المطلوب</span>
              <span className="font-bold text-accent-dark dark:text-accent font-mono text-sm">
                {isNaN(numPrice) ? '0' : numPrice.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block mb-0.5">المساحة الإجمالية</span>
              <span className="font-bold text-ink-primary dark:text-dark-ink-primary">
                {formData.areaSquareMeters} م²
              </span>
            </div>
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block mb-0.5">غرف النوم</span>
              <span className="font-bold text-ink-primary dark:text-dark-ink-primary">
                {formData.bedrooms ? `${formData.bedrooms} غرف` : 'غير محدد'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Location & Coordinates */}
        <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
          <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary mb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-accent" />
            الموقع الجغرافي والإحداثيات
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border p-3 rounded-lg">
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block">المدينة والحي:</span>
              <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                {formData.cityName ? `${formData.cityName} - ` : ''}{formData.districtName || 'محدد عبر المعرفات الرسمية'}
              </span>
            </div>
            {formData.streetName && (
              <div>
                <span className="text-ink-muted dark:text-dark-ink-muted block">الشارع:</span>
                <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">{formData.streetName}</span>
              </div>
            )}
            <div>
              <span className="text-ink-muted dark:text-dark-ink-muted block">الإحداثيات:</span>
              <span className="font-mono text-ink-secondary dark:text-dark-ink-secondary" dir="ltr">
                {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Payout IBAN */}
        <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
          <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary mb-2 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-accent" />
            حساب الصرف المعتمد
          </h4>
          <div className="p-3 bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg flex items-center justify-between text-xs">
            <span className="text-ink-secondary dark:text-dark-ink-secondary">الآيبان السعودي المسجل:</span>
            <span className="font-mono font-bold text-ink-primary dark:text-dark-ink-primary tracking-wider" dir="ltr">
              {formData.payoutIban}
            </span>
          </div>
        </div>

        {/* Section 4: Photos Gallery Preview */}
        <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
          <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary mb-2 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-accent" />
            معرض الصور ({formData.photos.length} صور)
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {formData.photos.map((photo, i) => (
              <div
                key={photo.fileUrl || i}
                className="relative aspect-square rounded-lg overflow-hidden border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl || photo.fileUrl}
                  alt={`Thumb ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {photo.isPrimary && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-accent text-white text-[9px] font-bold rounded">
                    رئيسية
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Documents List with Privacy Badges */}
        <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
          <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-accent" />
            المستندات المصنفة ({formData.documents.length})
          </h4>
          <div className="space-y-2">
            {formData.documents.map((doc, i) => {
              const isAdminOnly = doc.visibility === DocumentVisibility.ADMIN_ONLY;
              return (
                <div
                  key={doc.fileUrl || i}
                  className="p-2.5 bg-surface-sunken dark:bg-dark-surface-sunken rounded-lg flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                    {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                  </span>
                  {isAdminOnly ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Lock className="w-3 h-3" />
                      خاص بالإدارة (محمي)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Eye className="w-3 h-3" />
                      عام (يظهر للمشتري)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legal Declaration Checkbox */}
      <div className="p-4 bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.agreedToTerms}
            disabled={isSubmitting}
            onChange={(e) => updateForm({ agreedToTerms: e.target.checked })}
            className="w-4 h-4 mt-0.5 text-accent rounded border-surface-borderStrong focus:ring-accent disabled:opacity-50"
          />
          <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            <span className="font-bold block text-ink-primary dark:text-dark-ink-primary mb-0.5">
              الإقرار القانوني بصحة البيانات والوثائق
            </span>
            أقر بصفتي المالك أو المسوق العقاري المرخص بأن جميع البيانات والمعلومات والوثائق المدخلة صحيحة ومطابقة للسجلات الرسمية، وأتحمل كامل المسؤولية النظامية أمام منصة المصايف والجهات الرقابية المختصة.
          </div>
        </label>
        {errors.agreedToTerms && (
          <p className="text-xs text-red-500 mt-2 mr-7">{errors.agreedToTerms}</p>
        )}
      </div>
    </div>
  );
}
