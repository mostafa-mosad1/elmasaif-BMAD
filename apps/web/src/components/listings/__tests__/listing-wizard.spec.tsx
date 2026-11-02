import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ListingWizard } from '../listing-wizard/listing-wizard';
import { BasicInfoStep } from '../listing-wizard/steps/basic-info-step';
import { DocumentsStep } from '../listing-wizard/steps/documents-step';
import { ReviewStep } from '../listing-wizard/steps/review-step';
import { UserRole, PropertyType, DocumentVisibility } from '@elmasaif/shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('ListingWizard Component (Story 2.2) (AC: 1, 2, 4)', () => {
  const initialFormState = {
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
    agreedToTerms: false,
  };

  it('renders the 6-step progress indicator and initial step 1 heading', () => {
    const html = renderToString(
      React.createElement(ListingWizard, { userRole: UserRole.MARKETER }),
    );

    expect(html).toContain('إضافة عقار جديد للبيع');
    expect(html).toContain('الأساسية');
    expect(html).toContain('الموقع');
    expect(html).toContain('السعر');
    expect(html).toContain('الصور');
    expect(html).toContain('المستندات');
    expect(html).toContain('المراجعة');
    expect(html).toContain('البيانات الأساسية للعقار');
  });

  it('strictly omits bathrooms from the basic info step per BR-13', () => {
    const html = renderToString(
      React.createElement(BasicInfoStep, {
        formData: initialFormState,
        updateForm: vi.fn(),
        errors: {},
      }),
    );

    expect(html).toContain('عدد غرف النوم');
    expect(html).toContain('المساحة (م²)');
    // Bathrooms must NOT exist anywhere in the component
    expect(html.toLowerCase()).not.toContain('حمام');
    expect(html.toLowerCase()).not.toContain('دورات مياه');
    expect(html.toLowerCase()).not.toContain('bathrooms');
  });

  it('renders role-adaptive mandatory document banner for Marketer (عقد تفويض المالك)', () => {
    const html = renderToString(
      React.createElement(DocumentsStep, {
        formData: initialFormState,
        updateForm: vi.fn(),
        errors: {},
        userRole: UserRole.MARKETER,
      }),
    );

    expect(html).toContain('عقد تفويض المالك أو اتفاقية الوساطة');
    expect(html).toContain('خاص بالإدارة');
  });

  it('renders role-adaptive mandatory document banner for Owner (صك الملكية الإلكتروني)', () => {
    const html = renderToString(
      React.createElement(DocumentsStep, {
        formData: initialFormState,
        updateForm: vi.fn(),
        errors: {},
        userRole: UserRole.OWNER,
      }),
    );

    expect(html).toContain('صك الملكية الإلكتروني');
    expect(html).toContain('خاص بالإدارة');
  });

  it('renders review step summary with PendingAdminReview status and legal declaration', () => {
    const reviewFormState = {
      ...initialFormState,
      title: 'فيلا فاخرة للبيع في حي الملقا',
      description: 'فيلا حديثة متكاملة الخدمات والضمانات',
      askPrice: 4200000,
      areaSquareMeters: 400,
      bedrooms: 5,
      payoutIban: 'SA0380000000608010167519',
      photos: [
        { fileUrl: 'p1.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: true },
        { fileUrl: 'p2.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false },
        { fileUrl: 'p3.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false },
      ],
      documents: [
        {
          documentType: 'TITLE_DEED' as const,
          fileUrl: 'deed.pdf',
          mimeType: 'application/pdf',
          fileSize: 2000,
          visibility: DocumentVisibility.ADMIN_ONLY,
        },
      ],
      agreedToTerms: true,
    };

    const html = renderToString(
      React.createElement(ReviewStep, {
        formData: reviewFormState,
        updateForm: vi.fn(),
        errors: {},
        isSubmitting: false,
      }),
    );

    expect(html).toContain('فيلا فاخرة للبيع في حي الملقا');
    expect(html).toContain('PendingAdminReview');
    expect(html).toContain('صك الملكية الإلكتروني');
    expect(html).toContain('خاص بالإدارة (محمي)');
    expect(html).toContain('الإقرار القانوني بصحة البيانات والوثائق');
  });
});

