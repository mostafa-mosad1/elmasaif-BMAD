/**
 * Mediated listing inquiries — the single contact-masking engine (Story 4.4 / FR-35, NFR1).
 *
 * Off-platform deal circumvention and personal contact leakage are prevented by redacting every
 * detection *before* persistence, on the client for the live preview and again on the server as
 * the authoritative gate. This module is the **only** place in the monorepo allowed to own the
 * detection patterns: `apps/web` and `apps/api` both import `maskContactDetails` from here.
 *
 * The result never carries the matched substrings — only their type, offset and length — so a
 * caller cannot accidentally echo a phone number or an email into an API response or an audit
 * payload.
 */

export type ContactMaskType = 'PHONE' | 'EMAIL' | 'HANDLE';

export interface ContactMaskDetection {
  type: ContactMaskType;
  /** Offset of the matched span in the **original** input string. */
  start: number;
  length: number;
}

export interface ContactMaskResult {
  maskedText: string;
  detections: ContactMaskDetection[];
  wasMasked: boolean;
}

export const CONTACT_MASK_PLACEHOLDER = '*';

/**
 * Length-preserving digit normalization for detection only: Arabic-Indic (`٠-٩`, U+0660–U+0669)
 * and extended Arabic-Indic (`۰-۹`, U+06F0–U+06F9) map 1:1 onto ASCII `0-9`. Because the mapping
 * is character-for-character, offsets found in the normalized string are valid offsets in the
 * original string.
 */
export function normalizeDigits(input: string): string {
  let normalized = '';
  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index);
    if (codePoint >= 0x0660 && codePoint <= 0x0669) {
      normalized += String.fromCharCode(0x30 + (codePoint - 0x0660));
    } else if (codePoint >= 0x06f0 && codePoint <= 0x06f9) {
      normalized += String.fromCharCode(0x30 + (codePoint - 0x06f0));
    } else {
      normalized += input[index];
    }
  }
  return normalized;
}

/**
 * Saudi mobile numbers — exactly two alternatives, both applied to the *normalized* text:
 *
 * - domestic `05XXXXXXXX`, allowing a single optional space/dash between digit groups;
 * - international `+9665XXXXXXXX` / `009665XXXXXXXX` / `966 5XXXXXXXX`.
 *
 * A bare `5XXXXXXXX` alternative is deliberately absent: it would mask legitimate prices, land
 * areas and reference numbers.
 */
const PHONE_PATTERNS: readonly RegExp[] = [
  /\b05\d(?:[\s-]?\d){7}\b/g,
  /(?:\+|00)?966[\s-]?5\d(?:[\s-]?\d){7}/g,
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Handles and external platform links. The `@handle` form accepts Arabic letters so a Saudi
 * handle written in Arabic is caught, and the URL form covers the platforms the platform's
 * anti-circumvention policy (PRD R-04) calls out explicitly.
 */
const HANDLE_PATTERNS: readonly RegExp[] = [
  /@[A-Za-z0-9_.\u0600-\u06FF]{2,}/g,
  /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|telegram\.me|snapchat\.com\/add|instagram\.com|twitter\.com|x\.com|tiktok\.com\/@)[^\s]*/gi,
];

interface RawSpan {
  type: ContactMaskType;
  start: number;
  length: number;
}

function collectSpans(text: string, patterns: readonly RegExp[], type: ContactMaskType): RawSpan[] {
  const spans: RawSpan[] = [];
  for (const pattern of patterns) {
    // Every pattern is declared with `g`; resetting `lastIndex` keeps repeated calls stable.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match !== null) {
      if (match[0].length > 0) {
        spans.push({ type, start: match.index, length: match[0].length });
      }
      match = pattern.exec(text);
    }
  }
  return spans;
}

/**
 * Sorts by start offset, then merges overlapping/adjacent duplicates. Without the merge an
 * `@handle` nested inside a URL match would be rewritten twice and corrupt every later offset.
 * The merged span keeps the type of the earliest detection.
 */
function mergeSpans(spans: RawSpan[]): RawSpan[] {
  if (spans.length === 0) return [];

  const sorted = [...spans].sort((left, right) =>
    left.start === right.start ? right.length - left.length : left.start - right.start,
  );

  const merged: RawSpan[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    const previousEnd = previous.start + previous.length;

    if (current.start < previousEnd) {
      const currentEnd = current.start + current.length;
      previous.length = Math.max(previousEnd, currentEnd) - previous.start;
      continue;
    }
    merged.push(current);
  }

  return merged;
}

/**
 * Masks every detected phone number, email address and external handle/link in `input` with
 * `*` characters of the same length, preserving every other character (including Arabic text and
 * RTL punctuation) byte-for-byte.
 *
 * Idempotent by construction: the placeholder is not a digit, an `@`, nor the start of an email
 * local part followed by a domain, so masking an already-masked string detects nothing and
 * returns `wasMasked: false`.
 */
export function maskContactDetails(input: string): ContactMaskResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { maskedText: typeof input === 'string' ? input : '', detections: [], wasMasked: false };
  }

  const normalized = normalizeDigits(input);

  const spans = mergeSpans([
    ...collectSpans(normalized, PHONE_PATTERNS, 'PHONE'),
    ...collectSpans(normalized, [EMAIL_PATTERN], 'EMAIL'),
    ...collectSpans(normalized, HANDLE_PATTERNS, 'HANDLE'),
  ]);

  if (spans.length === 0) {
    return { maskedText: input, detections: [], wasMasked: false };
  }

  let maskedText = '';
  let cursor = 0;

  for (const span of spans) {
    maskedText += input.slice(cursor, span.start);
    maskedText += CONTACT_MASK_PLACEHOLDER.repeat(span.length);
    cursor = span.start + span.length;
  }
  maskedText += input.slice(cursor);

  return {
    maskedText,
    detections: spans.map((span) => ({ type: span.type, start: span.start, length: span.length })),
    wasMasked: true,
  };
}

/**
 * The distinct detection types, in detection order — exactly what an `AuditLog` payload is
 * allowed to record (types and counts only, never the detected values).
 */
export function summarizeMaskDetections(detections: readonly ContactMaskDetection[]): {
  types: ContactMaskType[];
  count: number;
} {
  const types: ContactMaskType[] = [];
  for (const detection of detections) {
    if (!types.includes(detection.type)) types.push(detection.type);
  }
  return { types, count: detections.length };
}
