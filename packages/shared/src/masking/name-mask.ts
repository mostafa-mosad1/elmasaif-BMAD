/**
/**
 * Buyer Identity Masking Utility (Story 6.5 / FR-32, AC-4).
 * Masks customer full name (e.g. "طارق الشمري" -> "ط*** ش***")
 * to preserve privacy while demonstrating authentic transaction history.
 */

export function maskArabicName(name?: string | null): string {
  if (!name || typeof name !== 'string') {
    return 'مشتري مجهول';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return 'مشتري مجهول';
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return 'مشتري مجهول';
  }

  const maskedTokens = tokens.map((token) => {
    // If the token starts with the Arabic definite article "ال" and has additional characters,
    // mask based on the substantive first letter after "ال" (e.g. "الشمري" -> "ش***")
    if (token.startsWith('ال') && token.length > 2) {
      return `${token.charAt(2)}***`;
    }
    return `${token.charAt(0)}***`;
  });

  return maskedTokens.join(' ');
}

