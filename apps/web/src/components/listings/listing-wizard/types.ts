import { PropertyType, DocumentVisibility, UserRole } from '@elmasaif/shared';

export interface WizardPhotoItem {
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  previewUrl?: string;
  originalName?: string;
}

export interface WizardDocumentItem {
  documentType: 'TITLE_DEED' | 'OWNER_AUTHORIZATION' | 'FLOOR_PLAN' | 'COMMERCIAL_REGISTRATION' | 'OTHER';
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  visibility: DocumentVisibility;
  originalName?: string;
  isLocked?: boolean;
}

export interface ListingWizardFormState {
  // Step 1: Basic Info
  title: string;
  propertyType: PropertyType;
  description: string;
  areaSquareMeters: number | string;
  bedrooms: number | string;
  yearBuilt: number | string;

  // Step 2: Location
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  streetName: string;
  latitude: number | string;
  longitude: number | string;

  // Step 3: Pricing & Payout
  askPrice: number | string;
  payoutIban: string;

  // Step 4: Photos
  photos: WizardPhotoItem[];

  // Step 5: Documents
  documents: WizardDocumentItem[];

  // Step 6: Confirmation
  agreedToTerms: boolean;
}

export interface ListingWizardProps {
  userRole: UserRole.MARKETER | UserRole.OWNER;
  onSuccessRedirectUrl?: string;
}

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6;

export interface WizardStepDefinition {
  id: WizardStepId;
  title: string;
  shortTitle: string;
  description: string;
}

