import { ServiceUnavailableException } from '@nestjs/common';
import { DEAL_PLATFORM_ACCOUNT_UNAVAILABLE } from '@elmasaif/shared';
import {
  PLATFORM_ACCOUNT_HOLDER_NAME_KEY,
  PLATFORM_COLLECTION_IBAN_KEY,
  PlatformAccountService,
} from '../platform-account';

describe('PlatformAccountService (Story 5.2) (AC: 4, D5)', () => {
  const platformIban = 'SA4210000001234567890123';
  const holderName = 'شركة المصيف العقارية';

  const buildService = (env: Record<string, string | undefined>) => {
    const configService: any = {
      get: jest.fn((key: string) => env[key]),
    };
    return new PlatformAccountService(configService);
  };

  const configured = () =>
    buildService({
      [PLATFORM_COLLECTION_IBAN_KEY]: platformIban,
      [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: holderName,
    });

  /** The refusal must survive `HttpExceptionFilter` as a 503 with a code the web can key off. */
  const expectUnavailable = (service: PlatformAccountService) => {
    let caught: any;
    try {
      service.getAccount();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect(caught.getStatus()).toBe(503);
    expect(caught.getResponse()).toEqual({
      code: DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
      message: 'تعذر تحميل حساب المنصة المعتمد للتحصيل. يرجى التواصل مع الدعم الفني.',
    });
  };

  it('returns the raw IBAN, its grouped form and the holder name', () => {
    const account = configured().getAccount();

    expect(account.iban).toBe(platformIban);
    expect(account.ibanFormatted).toBe('SA42 1000 0001 2345 6789 0123');
    expect(account.accountHolderName).toBe(holderName);
  });

  it('derives the bank name from the IBAN bank code (10 → البنك الأهلي السعودي)', () => {
    expect(configured().getAccount().bankName).toBe('البنك الأهلي السعودي');
  });

  it('normalizes spaces and lower case before validating', () => {
    const service = buildService({
      [PLATFORM_COLLECTION_IBAN_KEY]: 'sa42 1000 0001 2345 6789 0123',
      [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: `  ${holderName}  `,
    });

    const account = service.getAccount();
    expect(account.iban).toBe(platformIban);
    expect(account.accountHolderName).toBe(holderName);
  });

  it('refuses with 503 DEAL_PLATFORM_ACCOUNT_UNAVAILABLE when the IBAN is missing', () => {
    expectUnavailable(
      buildService({ [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: holderName }),
    );
  });

  it('refuses when the IBAN fails the ISO-7064 mod-97 check (never a fallback IBAN)', () => {
    expectUnavailable(
      buildService({
        [PLATFORM_COLLECTION_IBAN_KEY]: 'SA0080000000608010167519',
        [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: holderName,
      }),
    );
  });

  it('refuses when the holder name is empty or shorter than 3 characters', () => {
    expectUnavailable(
      buildService({
        [PLATFORM_COLLECTION_IBAN_KEY]: platformIban,
        [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: '   ',
      }),
    );
    expectUnavailable(
      buildService({
        [PLATFORM_COLLECTION_IBAN_KEY]: platformIban,
        [PLATFORM_ACCOUNT_HOLDER_NAME_KEY]: 'شر',
      }),
    );
  });

  it('does not mask or truncate the IBAN — the buyer is wiring money to it', () => {
    const account = configured().getAccount();

    expect(account.iban).toHaveLength(24);
    expect(account.iban).not.toContain('*');
  });
});
