import { formatHalalas, parseSarToHalalas } from './money';

export interface VatBreakdown {
  subtotalAmount: string;
  vatAmount: string;
  vatRate: string;
  totalAmount: string;
  vatTreatment: string;
}

/**
 * Pure fixed-point VAT calculation helper (FR-68, AR14).
 *
 * Given a gross total commission amount and a VAT rate (default 15%),
 * derives the VAT-exclusive subtotal and VAT amount using round-half-up
 * fixed-point arithmetic so that `subtotalAmount + vatAmount === totalAmount` exactly.
 */
export function computeVatBreakdown(
  totalAmountStr: string,
  vatRateNumber: number = 0.15,
): VatBreakdown {
  const totalHalalas = parseSarToHalalas(totalAmountStr);

  if (vatRateNumber < 0) {
    throw new Error(`VAT rate must be non-negative, received ${vatRateNumber}`);
  }

  // Scale vatRate to basis points (e.g. 0.15 -> 1500 bp; 1.00 -> 10000 bp)
  const vatRateBp = BigInt(Math.round(vatRateNumber * 10000));
  const rateFactor = 10000n + vatRateBp;

  const subtotalHalalas =
    rateFactor === 10000n
      ? totalHalalas
      : (totalHalalas * 10000n + rateFactor / 2n) / rateFactor;

  const vatHalalas = totalHalalas - subtotalHalalas;

  const vatRateFormatted = vatRateNumber.toFixed(2);
  const vatTreatment = vatRateNumber === 0.15 ? 'STANDARD_RATE_15' : 'CUSTOM_RATE';

  return {
    subtotalAmount: formatHalalas(subtotalHalalas),
    vatAmount: formatHalalas(vatHalalas),
    vatRate: vatRateFormatted,
    totalAmount: formatHalalas(totalHalalas),
    vatTreatment,
  };
}

/**
 * Generates an immutable, gapless invoice number: `INV-${yyyyMMdd}-${dealNumber}`.
 */
export function generateInvoiceNumber(dealNumber: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `INV-${yyyy}${mm}${dd}-${dealNumber}`;
}

