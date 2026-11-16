'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  PropertyType,
  UserRole,
  SAUDI_BOUNDS,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  MIN_LISTING_PHOTOS,
} from '@elmasaif/shared';
import { apiClient, ApiError } from '../../../lib/api-client';
import {
  ListingWizardFormState,
  ListingWizardProps,
  WizardStepId,
  WizardStepDefinition,
} from './types';
import { BasicInfoStep } from './steps/basic-info-step';
import { LocationStep } from './steps/location-step';
import { PricingStep } from './steps/pricing-step';
import { MediaStep } from './steps/media-step';
import { DocumentsStep } from './steps/documents-step';
import { ReviewStep } from './steps/review-step';

const WIZARD_STEPS: WizardStepDefinition[] = [
  { id: 1, title: 'البيانات الأساسية', shortTitle: 'الأساسية', description: 'نوع العقار والتفاصيل الفنية' },
  { id: 2, title: 'الموقع الجغرافي', shortTitle: 'الموقع', description: 'المدينة والحي والإحداثيات' },
  { id: 3, title: 'السعر وحساب الصرف', shortTitle: 'السعر', description: 'سعر البيع ورقم الآيبان' },
  { id: 4, title: 'الصور والوسائط', shortTitle: 'الصور', description: 'صور العقار بجودة عالية' },
  { id: 5, title: 'المستندات والوثائق', shortTitle: 'المستندات', description: 'الصك والتفويض والتراخيص' },
  { id: 6, title: 'المراجعة والاعتماد', shortTitle: 'المراجعة', description: 'تأكيد البيانات وإرسال الإعلان' },
];

export function ListingWizard({ userRole, onSuccessRedirectUrl }: ListingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStepId>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [formData, setFormData] = useState<ListingWizardFormState>({
    title: '',
    propertyType: PropertyType.VILLA,
    description: '',
    areaSquareMeters: '',
    bedrooms: '',
    yearBuilt: '',
    cityId: '',
    districtId: '',
    streetName: '',
    latitude: 24.7136,
    longitude: 46.6753,
    askPrice: '',
    payoutIban: '',
    photos: [],
    documents: [],
    titleDeedNumber: '',
    agreedToTerms: false,
  });

  const updateForm = (updates: Partial<ListingWizardFormState>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setErrors({});
    setSubmitError(null);
  };

  const validateStep = (step: WizardStepId): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title || formData.title.trim().length < 5) {
        newErrors.title = 'عنوان الإعلان مطلوب ويجب ألا يقل عن 5 أحرف';
      }
      if (!formData.description || formData.description.trim().length < 10) {
        newErrors.description = 'وصف العقار مطلوب ويجب ألا يقل عن 10 أحرف';
      }
      if (!formData.areaSquareMeters || Number(formData.areaSquareMeters) <= 0) {
        newErrors.areaSquareMeters = 'مساحة العقار مطلوبة ويجب أن تكون أكبر من صفر';
      }
    } else if (step === 2) {
      if (!formData.cityId) {
        newErrors.cityId = 'يرجى اختيار المدينة من القائمة';
      }
      if (!formData.districtId) {
        newErrors.districtId = 'يرجى اختيار الحي من القائمة';
      }
      const lat = Number(formData.latitude);
      if (isNaN(lat) || lat < SAUDI_BOUNDS.minLat || lat > SAUDI_BOUNDS.maxLat) {
        newErrors.latitude = 'خط العرض خارج النطاق الجغرافي للمملكة (16.0 - 32.5)';
      }
      const lng = Number(formData.longitude);
      if (isNaN(lng) || lng < SAUDI_BOUNDS.minLng || lng > SAUDI_BOUNDS.maxLng) {
        newErrors.longitude = 'خط الطول خارج النطاق الجغرافي للمملكة (34.5 - 55.7)';
      }
    } else if (step === 3) {
      const price = Number(formData.askPrice);
      if (isNaN(price) || price < MIN_LISTING_PRICE_SAR || price > MAX_LISTING_PRICE_SAR) {
        newErrors.askPrice = `السعر مطلوب ويجب أن يكون بين 1 و 50,000,000 ريال سعودي`;
      }
      if (!formData.payoutIban) {
        newErrors.payoutIban = 'يرجى اختيار حساب الصرف البنكي المعتمد';
      }
    } else if (step === 4) {
      if (formData.photos.length < MIN_LISTING_PHOTOS) {
        newErrors.photos = `يجب رفع ${MIN_LISTING_PHOTOS} صور على الأقل قبل المتابعة`;
      }
    } else if (step === 5) {
      if (userRole === UserRole.MARKETER) {
        const hasAuth = formData.documents.some((d) => d.documentType === 'OWNER_AUTHORIZATION');
        if (!hasAuth) {
          newErrors.documents = 'مطلوب إرفاق عقد تفويض المالك أو وساطة للإعلان';
        }
      } else if (userRole === UserRole.OWNER) {
        const hasDeed = formData.documents.some((d) => d.documentType === 'TITLE_DEED');
        if (!hasDeed) {
          newErrors.documents = 'مطلوب إرفاق صك الملكية الإلكتروني للإعلان';
        }
      }
    } else if (step === 6) {
      if (!formData.agreedToTerms) {
        newErrors.agreedToTerms = 'يجب الموافقة على الإقرار القانوني للمتابعة';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 6) {
        setCurrentStep((prev) => (prev + 1) as WizardStepId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        propertyType: formData.propertyType,
        cityId: formData.cityId,
        districtId: formData.districtId,
        streetName: formData.streetName ? formData.streetName.trim() : null,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        askPrice: Number(formData.askPrice),
        areaSquareMeters: Number(formData.areaSquareMeters),
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        yearBuilt: formData.yearBuilt ? Number(formData.yearBuilt) : null,
        payoutIban: formData.payoutIban,
        photos: formData.photos.map((p) => ({
          fileUrl: p.fileUrl,
          mimeType: p.mimeType,
          fileSize: p.fileSize,
          isPrimary: p.isPrimary,
        })),
        documents: formData.documents.map((d) => ({
          documentType: d.documentType,
          fileUrl: d.fileUrl,
          mimeType: d.mimeType,
          fileSize: d.fileSize,
          visibility: d.visibility,
        })),
      };

      if (userRole === UserRole.OWNER) {
        await apiClient.post('/owner/listing-requests', {
          ...payload,
          titleDeedNumber: formData.titleDeedNumber || '1000000000',
        });
      } else {
        await apiClient.post('/listings', payload);
      }
      setIsSuccessModalOpen(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || 'فشل إرسال الإعلان');
      } else if (err instanceof Error) {
        setSubmitError(err.message || 'حدث خطأ غير متوقع أثناء إرسال الإعلان');
      } else {
        setSubmitError('حدث خطأ غير متوقع أثناء إرسال الإعلان');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultRedirect = userRole === UserRole.MARKETER ? '/app/marketer' : '/app/owner';
  const targetRedirect = onSuccessRedirectUrl || defaultRedirect;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6" dir="rtl">
      {/* Wizard Header & Progress Stepper */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-ink-primary dark:text-dark-ink-primary mb-2">
          إضافة عقار جديد للبيع
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          أكمل خطوات المعالج لنشر العقار مع ضمان حماية الوثائق القانونية الحساسة.
        </p>

        {/* Stepper Bar */}
        <div className="mt-6 border-b border-surface-border dark:border-dark-surface-border pb-5">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step) => {
              const isPassed = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isPassed
                        ? 'bg-accent text-white shadow-sm'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 font-black'
                        : 'bg-surface-sunken dark:bg-dark-surface-raised text-ink-muted dark:text-dark-ink-muted'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span
                    className={`text-[11px] mt-2 hidden sm:block text-center font-semibold ${
                      isCurrent
                        ? 'text-primary dark:text-primary-light font-bold'
                        : isPassed
                        ? 'text-ink-primary dark:text-dark-ink-primary'
                        : 'text-ink-muted dark:text-dark-ink-muted'
                    }`}
                  >
                    {step.shortTitle}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Submit Error Banner */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 sm:p-8 shadow-level1">
        {currentStep === 1 && (
          <BasicInfoStep formData={formData} updateForm={updateForm} errors={errors} />
        )}
        {currentStep === 2 && (
          <LocationStep formData={formData} updateForm={updateForm} errors={errors} />
        )}
        {currentStep === 3 && (
          <PricingStep formData={formData} updateForm={updateForm} errors={errors} />
        )}
        {currentStep === 4 && (
          <MediaStep formData={formData} updateForm={updateForm} errors={errors} />
        )}
        {currentStep === 5 && (
          <DocumentsStep
            formData={formData}
            updateForm={updateForm}
            errors={errors}
            userRole={userRole}
          />
        )}
        {currentStep === 6 && (
          <ReviewStep
            formData={formData}
            updateForm={updateForm}
            errors={errors}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Step Navigation Actions */}
        <div className="mt-8 pt-6 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between gap-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-raised text-sm font-semibold text-ink-primary dark:text-dark-ink-primary transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold shadow-sm hover:shadow transition-all"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال العقار...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>إرسال العقار للاعتماد (PendingReview)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl max-w-md w-full p-6 text-center border border-surface-border dark:border-dark-surface-border shadow-level3 space-y-4">
            <div className="w-14 h-14 rounded-full bg-accent-light dark:bg-amber-950/60 text-accent dark:text-amber-400 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-ink-primary dark:text-dark-ink-primary">
              تم إرسال العقار بنجاح!
            </h3>

            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              تم استلام بيانات العقار وحفظ الوثائق المشفرة، والإعلان الآن قيد مراجعة وتدقيق الإدارة (PendingAdminReview).
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push(targetRedirect)}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl shadow-sm transition-colors text-sm"
              >
                الانتقال إلى قائمة العقارات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
