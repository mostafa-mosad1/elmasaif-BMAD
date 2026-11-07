import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DealPlatformAccount,
  formatSaudiIban,
  getSaudiBankName,
  saudiIbanSchema,
} from '@elmasaif/shared';

/** The two env keys this provider owns. Exported so specs and `.env.example` cannot drift. */
export const PLATFORM_COLLECTION_IBAN_KEY = 'PLATFORM_COLLECTION_IBAN';
export const PLATFORM_ACCOUNT_HOLDER_NAME_KEY = 'PLATFORM_ACCOUNT_HOLDER_NAME';

/**
 * Story 5.2 / AC-4, D5: the account the buyer wires «سعي المنصة» to.
 *
 * Story 5.1 refused to invent a source of truth for the platform IBAN, and a platform settings
 * table belongs to Story 8.6. Until then this provider is the seam: an explicit, validated,
 * loudly-failing read of two environment keys.
 *
 * A missing or malformed value is a **503 `DEAL_PLATFORM_ACCOUNT_UNAVAILABLE`**, never a 500 and
 * never a hard-coded fallback — a wrong IBAN on a 48-hour deadline is a real-money defect (D5).
 * The raw IBAN is returned to the buyer (they are wiring money to it, masking it would be absurd)
 * but it is never logged here.
 */
@Injectable()
export class PlatformAccountService {
  private readonly logger = new Logger(PlatformAccountService.name);

  constructor(private readonly configService: ConfigService) {}

  getAccount(): DealPlatformAccount {
    const iban = (this.configService.get<string>(PLATFORM_COLLECTION_IBAN_KEY) ?? '')
      .replace(/\s+/g, '')
      .toUpperCase();
    const accountHolderName = (this.configService.get<string>(
      PLATFORM_ACCOUNT_HOLDER_NAME_KEY,
    ) ?? '').trim();

    // `saudiIbanSchema` is the house ISO-7064 mod-97 check. Re-implementing the checksum here
    // would be a second, silently divergent copy.
    const parsed = saudiIbanSchema.safeParse(iban);
    if (!parsed.success || accountHolderName.length < 3 || accountHolderName.length > 100) {
      // No IBAN, no holder name — not even a masked fragment: this line is the only trace.
      this.logger.error(
        'Platform collection account is not configured: set PLATFORM_COLLECTION_IBAN and PLATFORM_ACCOUNT_HOLDER_NAME',
      );
      throw new ServiceUnavailableException({
        code: DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
        message: 'تعذر تحميل حساب المنصة المعتمد للتحصيل. يرجى التواصل مع الدعم الفني.',
      });
    }

    return {
      iban,
      ibanFormatted: formatSaudiIban(iban),
      accountHolderName,
      // TODO(8.6): the platform collection account becomes a platform setting.
      bankName: getSaudiBankName(iban) ?? 'بنك غير محدد',
    };
  }
}
