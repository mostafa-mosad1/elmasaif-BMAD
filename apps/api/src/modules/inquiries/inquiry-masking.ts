import {
  MASKED_CONTACT_TYPES,
  maskContactDetails,
  summarizeMaskDetections,
  type ContactMaskType,
} from '@elmasaif/shared';

/**
 * Story 4.4 / AC-1, D4: the server-side masking gate.
 *
 * Every inbound body the platform persists passes through here — buyer message, seller reply and
 * the administrator's relay note alike. Admin-authored text is masked too: an administrator
 * relaying a seller's wording is the last line of defence, not an exemption.
 *
 * The masking engine itself lives in `packages/shared` and is shared verbatim with the web form;
 * nothing in this module may re-declare a contact pattern.
 */
export interface MaskedBody {
  /** What gets persisted — the masked text, never the original. */
  body: string;
  maskingApplied: boolean;
  /** Detection *types* only, for the projection and the audit payload. */
  types: ContactMaskType[];
  /** How many spans were masked — recorded, never the spans themselves. */
  count: number;
  /** Comma-joined code list for the single nullable `maskedTypes` column (no arrays in db push). */
  maskedTypes: string | null;
}

export function maskInquiryBody(input: string): MaskedBody {
  const { maskedText, detections } = maskContactDetails(input);
  const { types, count } = summarizeMaskDetections(detections);

  return {
    body: maskedText,
    maskingApplied: detections.length > 0,
    types,
    count,
    maskedTypes: types.length > 0 ? types.join(',') : null,
  };
}

/** Reads the stored comma-joined list back into typed codes, dropping anything unknown. */
export function parseMaskedTypes(value: string | null | undefined): ContactMaskType[] {
  if (!value) return [];
  return value
    .split(',')
    .map((code) => code.trim())
    .filter((code): code is ContactMaskType =>
      MASKED_CONTACT_TYPES.includes(code as ContactMaskType),
    );
}
