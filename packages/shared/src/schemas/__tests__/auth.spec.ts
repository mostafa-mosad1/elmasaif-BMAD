import { describe, it, expect } from 'vitest';
import {
  saudiMobileNormalizedSchema,
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  sessionUserSchema,
  loginSchema,
  verifyStepUpOtpSchema
} from '../auth.schema';
import {
  OTP_EXPIRY_SECONDS,
  OTP_THROTTLE_SECONDS,
  OTP_MAX_HOURLY_REQUESTS,
  OTP_LOCKOUT_ATTEMPTS,
  OTP_LOCKOUT_MINUTES,
  DEFAULT_TERMS_VERSION,
  DEFAULT_PRIVACY_VERSION,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
  DEVICE_COOKIE_NAME,
  AUTH_INVALID_PHONE,
  AUTH_PHONE_ALREADY_EXISTS,
  AUTH_NATIONAL_ID_ALREADY_EXISTS,
  AUTH_USERNAME_ALREADY_EXISTS,
  AUTH_OTP_THROTTLED,
  AUTH_OTP_MAX_EXCEEDED,
  AUTH_OTP_EXPIRED,
  AUTH_OTP_INVALID,
  AUTH_OTP_LOCKED,
  AUTH_CONSENT_REQUIRED,
  AUTH_INVALID_CREDENTIALS,
  AUTH_ACCOUNT_LOCKED,
  AUTH_ACCOUNT_DEACTIVATED,
  AUTH_ACCOUNT_DISABLED,
  AUTH_STEP_UP_REQUIRED,
  AUTH_STEP_UP_INVALID,
  AUTH_STEP_UP_LOCKED
} from '../../constants/auth';

describe('Shared Auth Constants (AC: 1, 7)', () => {
  it('exports expected OTP timing and throttle constants', () => {
    expect(OTP_EXPIRY_SECONDS).toBe(300);
    expect(OTP_THROTTLE_SECONDS).toBe(60);
    expect(OTP_MAX_HOURLY_REQUESTS).toBe(3);
    expect(OTP_LOCKOUT_ATTEMPTS).toBe(3);
    expect(OTP_LOCKOUT_MINUTES).toBe(15);
  });

  it('exports expected legal and session defaults', () => {
    expect(DEFAULT_TERMS_VERSION).toBe('1.0');
    expect(DEFAULT_PRIVACY_VERSION).toBe('1.0');
    expect(SESSION_COOKIE_NAME).toBe('elmasaif_session');
    expect(SESSION_EXPIRY_DAYS).toBe(30);
  });

  it('exports expected login and lockout constants', () => {
    expect(LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(LOGIN_LOCKOUT_MINUTES).toBe(15);
    expect(DEVICE_COOKIE_NAME).toBe('elmasaif_device_id');
  });

  it('exports all domain error codes', () => {
    expect(AUTH_INVALID_PHONE).toBe('AUTH_INVALID_PHONE');
    expect(AUTH_PHONE_ALREADY_EXISTS).toBe('AUTH_PHONE_ALREADY_EXISTS');
    expect(AUTH_NATIONAL_ID_ALREADY_EXISTS).toBe('AUTH_NATIONAL_ID_ALREADY_EXISTS');
    expect(AUTH_USERNAME_ALREADY_EXISTS).toBe('AUTH_USERNAME_ALREADY_EXISTS');
    expect(AUTH_OTP_THROTTLED).toBe('AUTH_OTP_THROTTLED');
    expect(AUTH_OTP_MAX_EXCEEDED).toBe('AUTH_OTP_MAX_EXCEEDED');
    expect(AUTH_OTP_EXPIRED).toBe('AUTH_OTP_EXPIRED');
    expect(AUTH_OTP_INVALID).toBe('AUTH_OTP_INVALID');
    expect(AUTH_OTP_LOCKED).toBe('AUTH_OTP_LOCKED');
    expect(AUTH_CONSENT_REQUIRED).toBe('AUTH_CONSENT_REQUIRED');
    expect(AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
    expect(AUTH_ACCOUNT_LOCKED).toBe('AUTH_ACCOUNT_LOCKED');
    expect(AUTH_ACCOUNT_DEACTIVATED).toBe('AUTH_ACCOUNT_DEACTIVATED');
    expect(AUTH_ACCOUNT_DISABLED).toBe('AUTH_ACCOUNT_DISABLED');
    expect(AUTH_STEP_UP_REQUIRED).toBe('AUTH_STEP_UP_REQUIRED');
    expect(AUTH_STEP_UP_INVALID).toBe('AUTH_STEP_UP_INVALID');
    expect(AUTH_STEP_UP_LOCKED).toBe('AUTH_STEP_UP_LOCKED');
  });
});

describe('Login Schema & Step-Up OTP Schema (AC: 1, 7)', () => {
  it('normalizes Saudi mobile identifier to +9665XXXXXXXX', () => {
    const result1 = loginSchema.parse({
      identifier: '0501234567',
      password: 'password123'
    });
    expect(result1.identifier).toBe('+966501234567');
    expect(result1.rememberDevice).toBe(true);

    const result2 = loginSchema.parse({
      identifier: '+966 50 123 4567',
      password: 'password123'
    });
    expect(result2.identifier).toBe('+966501234567');

    const result3 = loginSchema.parse({
      identifier: '501234567',
      password: 'password123'
    });
    expect(result3.identifier).toBe('+966501234567');
  });

  it('normalizes username identifier to lowercase trimmed string', () => {
    const result = loginSchema.parse({
      identifier: '  Saudi_Admin  ',
      password: 'password123',
      deviceId: 'device-uuid-1',
      rememberDevice: false
    });
    expect(result.identifier).toBe('saudi_admin');
    expect(result.deviceId).toBe('device-uuid-1');
    expect(result.rememberDevice).toBe(false);
  });

  it('rejects identifiers with fewer than 3 characters', () => {
    expect(() => loginSchema.parse({
      identifier: 'ab',
      password: 'password123'
    })).toThrow();
  });

  it('rejects passwords with fewer than 8 characters', () => {
    expect(() => loginSchema.parse({
      identifier: 'testuser',
      password: 'short'
    })).toThrow();
  });

  it('validates verifyStepUpOtpSchema successfully', () => {
    const result = verifyStepUpOtpSchema.parse({
      mobileNumber: '0501234567',
      code: '123456',
      stepUpToken: 'valid-jwt-or-hmac-token',
      deviceId: 'client-device-123'
    });
    expect(result.mobileNumber).toBe('+966501234567');
    expect(result.code).toBe('123456');
    expect(result.stepUpToken).toBe('valid-jwt-or-hmac-token');
    expect(result.deviceId).toBe('client-device-123');
  });

  it('rejects invalid OTP length or missing token in verifyStepUpOtpSchema', () => {
    expect(() => verifyStepUpOtpSchema.parse({
      mobileNumber: '0501234567',
      code: '12345',
      stepUpToken: 'token'
    })).toThrow();

    expect(() => verifyStepUpOtpSchema.parse({
      mobileNumber: '0501234567',
      code: '123456',
      stepUpToken: ''
    })).toThrow();
  });
});

describe('Saudi Mobile Normalization Schema (AC: 1)', () => {
  it('normalizes local 05XXXXXXXX format to +9665XXXXXXXX', () => {
    const parsed = saudiMobileNormalizedSchema.parse('0501234567');
    expect(parsed).toBe('+966501234567');
  });

  it('preserves +9665XXXXXXXX format', () => {
    const parsed = saudiMobileNormalizedSchema.parse('+966512345678');
    expect(parsed).toBe('+966512345678');
  });

  it('handles and strips spaces and dashes', () => {
    const parsed = saudiMobileNormalizedSchema.parse('050 123 4567');
    expect(parsed).toBe('+966501234567');

    const parsedDashes = saudiMobileNormalizedSchema.parse('+966-50-123-4567');
    expect(parsedDashes).toBe('+966501234567');
  });

  it('rejects invalid mobile formats with AUTH_INVALID_PHONE message', () => {
    expect(() => saudiMobileNormalizedSchema.parse('0612345678')).toThrow();
    expect(() => saudiMobileNormalizedSchema.parse('+971501234567')).toThrow();
    expect(() => saudiMobileNormalizedSchema.parse('050123456')).toThrow(); // 9 digits
    expect(() => saudiMobileNormalizedSchema.parse('05012345678')).toThrow(); // 11 digits
  });
});

describe('Register Schema (AC: 1, 7)', () => {
  const validData = {
    fullName: 'عبدالله محمد',
    mobileNumber: '0501234567',
    nationalId: '1023456789',
    password: 'Password123',
    termsAccepted: true,
    privacyAccepted: true
  };

  it('successfully parses valid registration payload and auto-generates username', () => {
    const result = registerSchema.parse(validData);
    expect(result.fullName).toBe('عبدالله محمد');
    expect(result.mobileNumber).toBe('+966501234567');
    expect(result.username).toBe('u_966501234567');
    expect(result.termsAccepted).toBe(true);
    expect(result.privacyAccepted).toBe(true);
  });

  it('preserves custom valid username if provided', () => {
    const result = registerSchema.parse({
      ...validData,
      username: 'abdullah_sa'
    });
    expect(result.username).toBe('abdullah_sa');
  });

  it('rejects invalid username formats', () => {
    expect(() => registerSchema.parse({ ...validData, username: 'ab' })).toThrow(); // < 3 chars
    expect(() => registerSchema.parse({ ...validData, username: 'user name with spaces' })).toThrow();
  });

  it('validates Saudi citizen (1) and Iqama (2) national IDs strictly', () => {
    expect(registerSchema.parse({ ...validData, nationalId: '1098765432' }).nationalId).toBe('1098765432');
    expect(registerSchema.parse({ ...validData, nationalId: '2098765432' }).nationalId).toBe('2098765432');
    expect(() => registerSchema.parse({ ...validData, nationalId: '3098765432' })).toThrow();
    expect(() => registerSchema.parse({ ...validData, nationalId: '123' })).toThrow();
  });

  it('strictly rejects when termsAccepted or privacyAccepted is not true', () => {
    expect(() => registerSchema.parse({ ...validData, termsAccepted: false })).toThrow();
    expect(() => registerSchema.parse({ ...validData, privacyAccepted: false })).toThrow();
  });

  it('strictly validates password complexity', () => {
    expect(() => registerSchema.parse({ ...validData, password: 'short' })).toThrow();
    expect(() => registerSchema.parse({ ...validData, password: 'onlyletters' })).toThrow();
    expect(() => registerSchema.parse({ ...validData, password: '12345678' })).toThrow();
  });
});

describe('Verify OTP and Resend Schemas (AC: 1, 7)', () => {
  it('validates 6-digit OTP code', () => {
    const result = verifyOtpRegisterSchema.parse({
      mobileNumber: '0501234567',
      code: '123456'
    });
    expect(result.code).toBe('123456');
    expect(result.mobileNumber).toBe('+966501234567');

    expect(() => verifyOtpRegisterSchema.parse({
      mobileNumber: '0501234567',
      code: '12345' // 5 digits
    })).toThrow();
  });

  it('validates resend schema', () => {
    const result = resendOtpSchema.parse({
      mobileNumber: '0501234567'
    });
    expect(result.mobileNumber).toBe('+966501234567');
  });

  it('validates sessionUserSchema', () => {
    const user = sessionUserSchema.parse({
      id: 'uuid-1234',
      fullName: 'عبدالله محمد',
      mobileNumber: '+966501234567',
      username: 'u_966501234567',
      role: 'BUYER'
    });
    expect(user.id).toBe('uuid-1234');
    expect(user.role).toBe('BUYER');
  });
});
