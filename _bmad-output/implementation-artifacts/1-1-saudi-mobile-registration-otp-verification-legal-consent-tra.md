---
baseline_commit: caa828b2f5b1310c48267a1c77ed64278d941bba
---

# Story 1.1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Saudi citizen or resident visitor,
I want to register an account using my Saudi mobile number and verify it via a 6-digit OTP while signing the required legal consent,
So that I can establish a verified, PDPL-compliant account on the platform with an automatic Buyer role.

## Acceptance Criteria

1. **Saudi Mobile Number & Registration Form Validation (`packages/shared` & `apps/api`):**
   - **Given** a visitor submitting registration details via `POST /api/v1/auth/register`
   - **When** the client submits `fullName`, `mobileNumber`, `nationalId`, `password`, `termsAccepted`, `privacyAccepted`, and optional `username`
   - **Then** validation strictly enforces:
     - `fullName`: 3–100 characters, trimmed, containing valid Arabic or Latin characters
     - `mobileNumber`: matches regex `^(\+966|0)5[0-9]{8}$` and is normalized strictly to E.164 Saudi format `+9665XXXXXXXX` (rejecting any other prefix or invalid pattern with `AUTH_INVALID_PHONE`)
     - `nationalId`: matches regex `^[12][0-9]{9}$` (10 digits starting with 1 for Saudi Citizen or 2 for Resident Iqama per `saudiNationalIdSchema`)
     - `password`: minimum 8 characters, containing at least one letter and at least one number (`^(?=.*[A-Za-z])(?=.*\d)`)
     - `termsAccepted` and `privacyAccepted`: must be strictly `true` (untrue/missing returns `AUTH_CONSENT_REQUIRED`)
     - `username`: optional; if provided, must be 3–30 alphanumeric/underscore characters (`^[a-zA-Z0-9_-]+$`); if omitted, defaults deterministically to `u_${normalizedPhone.replace('+', '')}`
   - **And** the system checks uniqueness against existing active accounts:
     - If `mobileNumber` is already in use, returns HTTP 409 Conflict with error code `AUTH_PHONE_ALREADY_EXISTS`
     - If `nationalId` is already in use, returns HTTP 409 Conflict with error code `AUTH_NATIONAL_ID_ALREADY_EXISTS`
     - If `username` is already in use, returns HTTP 409 Conflict with error code `AUTH_USERNAME_ALREADY_EXISTS`.

2. **OTP Generation, Expiration & Anti-Flooding Throttling (`apps/api/src/modules/auth/otp`):**
   - **Given** valid registration details passing initial pre-checks
   - **When** the registration step initiates OTP dispatch
   - **Then** an OTP verification record is persisted in the database with:
     - A cryptographically generated 6-digit numeric code (or `123456` if using the development `StaticOtpProvider`)
     - Expiration timestamp set to `ClockService.now() + 300 seconds` (5 minutes)
     - Resend throttle timestamp set to `ClockService.now() + 60 seconds` (1 minute)
   - **And** resend requests (`POST /api/v1/auth/otp/resend`) submitted before 60 seconds elapse are rejected with HTTP 429 Too Many Requests and error code `AUTH_OTP_THROTTLED`
   - **And** maximum OTP dispatches are capped at 3 requests per hour per phone number; exceeding this returns HTTP 429 and error code `AUTH_OTP_MAX_EXCEEDED`
   - **And** the pluggable `OtpProvider` interface cleanly separates development from production:
     - Local/test environments use `StaticOtpProvider` (`123456`) logging to NestJS logger
     - Production requires an external SMS gateway provider (e.g. Unifonic, Taqnyat)
     - `StartupGuardService` (`OnApplicationBootstrap`) asserts that if `NODE_ENV === 'production'` and `OTP_PROVIDER === 'static'` or `ENABLE_STATIC_OTP === 'true'`, startup is aborted immediately via `process.exit(1)` per `AD-5` / `R-05`.

3. **OTP Verification Lockout & Brute-Force Defense (`apps/api/src/modules/auth`):**
   - **Given** an active registration OTP flow
   - **When** the client submits a verification code via `POST /api/v1/auth/verify-otp`
   - **Then** if the code does not match:
     - The failed attempt counter increments
     - The endpoint returns HTTP 400 Bad Request with error code `AUTH_OTP_INVALID` and remaining attempt count (`details: { remainingAttempts: N }`)
   - **And** upon the 3rd consecutive failed entry:
     - Verification for that mobile number is locked for 15 minutes (`lockedUntil = ClockService.now() + 15 minutes`)
     - Subsequent attempts return HTTP 423 Locked with error code `AUTH_OTP_LOCKED` and retry-after details
   - **And** if `ClockService.now() > expiresAt`, the endpoint returns HTTP 400 Bad Request with error code `AUTH_OTP_EXPIRED`.

4. **Atomic Account Creation & Immutable PDPL Legal Consent Tracking (`apps/api/src/modules/auth`):**
   - **Given** successful 6-digit OTP verification
   - **When** committing the new account
   - **Then** the creation runs inside a single atomic database transaction (`prisma.$transaction`):
     - **`User` record created:** `fullName`, `mobileNumber`, `nationalId`, `username`, `status = ProfileStatus.ACTIVE`, `passwordHash` hashed using Argon2id (`argon2.hash(password, { type: argon2.argon2id })`)
     - **`UserProfile` record created:** bound to `User.id` with `role = UserRole.BUYER` and `status = ProfileStatus.ACTIVE`
     - **`ConsentRecord` record created:** immutable, insert-only record with:
       - `userId = User.id`
       - `termsVersion = "1.0"` (from configuration / constant)
       - `privacyVersion = "1.0"` (from configuration / constant)
       - `consentTimestamp = ClockService.now()`
       - `ipAddress = request.ip`
       - `userAgent = request.headers['user-agent'] || 'unknown'`
       - `source = 'REGISTRATION_WEB'`
     - **OTP Record cleaned:** verification record marked as used/consumed.

5. **Server-Side Session Management & HttpOnly Cookie Issuance (`apps/api/src/modules/auth`):**
   - **Given** a successfully committed new user account
   - **When** finalizing the authentication response
   - **Then** a server-side session is created in the `Session` table in PostgreSQL:
     - `userId = User.id`
     - `token = crypto.randomBytes(32).toString('hex')`
     - `ipAddress = request.ip`
     - `userAgent = request.headers['user-agent']`
     - `expiresAt = ClockService.now() + 30 days` (rolling 30-day session)
   - **And** an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `elmasaif_session` is set on the response:
     - `Secure: true` if `NODE_ENV === 'production'`, `false` in local development
     - `maxAge: 30 * 24 * 60 * 60 * 1000` (30 days in ms)
   - **And** the HTTP response returns HTTP 201 Created with standard envelope:
     ```json
     {
       "code": "AUTH_REGISTRATION_SUCCESS",
       "message": "تم إنشاء الحساب وتأكيد رقم الجوال بنجاح",
       "data": {
         "user": {
           "id": "uuid",
           "fullName": "...",
           "mobileNumber": "+9665XXXXXXXX",
           "username": "...",
           "role": "BUYER"
         }
       },
       "requestId": "uuid"
     }
     ```
   - **And** an authenticated session inspection endpoint `GET /api/v1/auth/me` returns the current user profile, and `POST /api/v1/auth/logout` revokes the session in PostgreSQL and clears the cookie.

6. **Frontend Registration & 6-Digit OTP Wizard (`apps/web/src/app/auth/register`):**
   - **Given** any visitor opening `apps/web/auth/register`
   - **When** the page renders
   - **Then** it presents an institutional, sovereign two-step card layout wrapped in `LayoutShell` styled strictly to `DESIGN.md`:
     - **Step 1 (Registration Details):**
       - Full Name input (Arabic/English, 3–100 chars)
       - Saudi Mobile Number input with prefixed `+966` and formatted placeholder (`5XXXXXXXX`)
       - National ID / Iqama input (10 digits starting with 1 or 2, monospace font `font-mono`)
       - Password input with toggleable show/hide eye icon and real-time complexity validation checklist
       - Two explicit legal checkboxes:
         - "أوافق على شروط الاستخدام والأحكام العامة لمنصة المصايف" with modal/new-tab link
         - "أوافق على سياسة الخصوصية وحماية البيانات الشخصية وفقاً لنظام (PDPL) السعودي" with modal/new-tab link
       - Submit button: "المتابعة والتحقق من الجوال" (`Button variant="primary"`)
     - **Step 2 (6-Digit OTP Verification):**
       - Masked mobile display (e.g. `+966 5X XXX 1234`) with an option to edit/change the number
       - Reusable 6-digit numeric input with auto-hop focus, paste support, and backspace handling
       - Live 60-second countdown timer for resend ("إعادة إرسال الرمز بعد [ثانية]"); button disabled until counter reaches 0
       - 300-second overall expiration badge
       - Clear inline error display for wrong codes, remaining attempt warnings, and 15-minute lockout banners
     - **Success Transition:**
       - Upon valid OTP entry, display smooth success state and redirect to `/app/buyer` (or homepage with authenticated user header).

7. **Shared Contracts, Enums & Error Codes (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported across `apps/api` and `apps/web`
   - **Then** exports:
     - Zod schemas: `registerSchema`, `verifyOtpRegisterSchema`, `resendOtpSchema`, `sessionUserSchema`
     - TypeScript types: `RegisterInput`, `VerifyOtpRegisterInput`, `ResendOtpInput`, `AuthUserResponse`, `SessionUser`
     - Domain constants: `OTP_EXPIRY_SECONDS = 300`, `OTP_THROTTLE_SECONDS = 60`, `OTP_MAX_HOURLY_REQUESTS = 3`, `OTP_LOCKOUT_ATTEMPTS = 3`, `OTP_LOCKOUT_MINUTES = 15`, `DEFAULT_TERMS_VERSION = '1.0'`, `DEFAULT_PRIVACY_VERSION = '1.0'`, `SESSION_COOKIE_NAME = 'elmasaif_session'`, `SESSION_EXPIRY_DAYS = 30`
     - Error codes: `AUTH_INVALID_PHONE`, `AUTH_PHONE_ALREADY_EXISTS`, `AUTH_NATIONAL_ID_ALREADY_EXISTS`, `AUTH_USERNAME_ALREADY_EXISTS`, `AUTH_OTP_THROTTLED`, `AUTH_OTP_MAX_EXCEEDED`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_INVALID`, `AUTH_OTP_LOCKED`, `AUTH_CONSENT_REQUIRED`.

8. **Automated Unit, Service & Integration Test Gates:**
   - **Given** the monorepo test suite
   - **When** running tests across workspaces (`npm test`)
   - **Then** 100% of test suites pass:
     - Shared validation tests in `packages/shared/src/schemas/__tests__/auth.spec.ts`
     - Backend tests in `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` and `otp.service.spec.ts`
     - Backend controller tests in `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`
     - Frontend component tests in `apps/web/src/components/auth/__tests__/register-form.spec.ts` and `otp-input.spec.ts`
     - Zero lint errors (`npm run lint`) and clean workspace builds (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Shared Contracts, Validation Schemas & Auth Constants in `packages/shared` (AC: 1, 7)
  - [x] 1.1 Create `packages/shared/src/constants/auth.ts`:
    - Export `OTP_EXPIRY_SECONDS = 300`
    - Export `OTP_THROTTLE_SECONDS = 60`
    - Export `OTP_MAX_HOURLY_REQUESTS = 3`
    - Export `OTP_LOCKOUT_ATTEMPTS = 3`
    - Export `OTP_LOCKOUT_MINUTES = 15`
    - Export `DEFAULT_TERMS_VERSION = '1.0'`
    - Export `DEFAULT_PRIVACY_VERSION = '1.0'`
    - Export `SESSION_COOKIE_NAME = 'elmasaif_session'`
    - Export `SESSION_EXPIRY_DAYS = 30`
    - Export standard auth error code constants: `AUTH_INVALID_PHONE`, `AUTH_PHONE_ALREADY_EXISTS`, `AUTH_NATIONAL_ID_ALREADY_EXISTS`, `AUTH_USERNAME_ALREADY_EXISTS`, `AUTH_OTP_THROTTLED`, `AUTH_OTP_MAX_EXCEEDED`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_INVALID`, `AUTH_OTP_LOCKED`, `AUTH_CONSENT_REQUIRED`.
  - [x] 1.2 Create `packages/shared/src/schemas/auth.schema.ts`:
    - Create `saudiMobileNormalizedSchema` that strips spaces/dashes, validates against `^(\+966|0)5[0-9]{8}$`, and normalizes to `+9665XXXXXXXX`.
    - Create `registerSchema` with `fullName` (3–100 chars), `mobileNumber`, `nationalId`, `password` (min 8 chars, 1 letter, 1 number), `username` (optional), `termsAccepted` (`z.literal(true)`), `privacyAccepted` (`z.literal(true)`).
    - Create `verifyOtpRegisterSchema` with `mobileNumber`, `code` (`z.string().length(6)`).
    - Create `resendOtpSchema` with `mobileNumber`.
    - Create `sessionUserSchema` for authenticated session payloads.
  - [x] 1.3 Create `packages/shared/src/types/auth.ts`:
    - Infer types: `RegisterInput`, `VerifyOtpRegisterInput`, `ResendOtpInput`, `SessionUser`.
  - [x] 1.4 Export from `packages/shared/src/index.ts` and author unit test suite in `packages/shared/src/schemas/__tests__/auth.spec.ts`.

- [x] Task 2: Database Schema & Relational Models in `apps/api/prisma/schema.prisma` (AC: 2, 3, 4)
  - [x] 2.1 Update `apps/api/prisma/schema.prisma`:
    - Add model `OtpVerification` mapped to `otp_verifications`:
      - `id`: String `@id @default(uuid())`
      - `mobileNumber`: String
      - `otpCode`: String
      - `purpose`: String (`REGISTRATION`, `LOGIN_STEP_UP`, `PASSWORD_RESET`, etc.)
      - `attempts`: Int `@default(0)`
      - `maxAttempts`: Int `@default(3)`
      - `expiresAt`: DateTime
      - `resendAvailableAt`: DateTime
      - `lockedUntil`: DateTime?
      - `hourlyCount`: Int `@default(1)`
      - `lastSentAt`: DateTime `@default(now())`
      - `metadata`: Json? (to hold registration payload during pending OTP verification)
      - `createdAt`: DateTime `@default(now())`
      - `updatedAt`: DateTime `@updatedAt`
      - Index `@@index([mobileNumber, purpose])`
    - Verify `User`, `ConsentRecord`, `UserProfile`, and `Session` models have appropriate relational mappings.
  - [x] 2.2 Run `npm run prisma:generate` in `apps/api` to generate client types.

- [x] Task 3: Backend OTP Engine & Startup Guard Verification in `apps/api` (AC: 2, 3)
  - [x] 3.1 Create `apps/api/src/modules/auth/otp/otp-provider.interface.ts`:
    - Define `OtpProvider` interface with `sendOtp(mobileNumber: string, code: string): Promise<boolean>`.
  - [x] 3.2 Create `apps/api/src/modules/auth/otp/providers/static-otp.provider.ts`:
    - Implements `OtpProvider`, logs code to NestJS Logger, returns true.
  - [x] 3.3 Create `apps/api/src/modules/auth/otp/providers/sms-otp.provider.ts`:
    - Implements `OtpProvider` with structured SMS gateway integration contract.
  - [x] 3.4 Create `apps/api/src/modules/auth/otp/otp.service.ts`:
    - Inject `PrismaService`, `ClockService`, `ConfigService`, and `OtpProvider`.
    - Method `generateAndSendOtp(mobileNumber: string, purpose: string, metadata?: Record<string, any>)`:
      - Check if phone is locked (`lockedUntil > ClockService.now()`); if locked, throw `HttpException` with `AUTH_OTP_LOCKED`.
      - Check hourly count limit (max 3 dispatches in the rolling 60-minute window); if exceeded, throw `AUTH_OTP_MAX_EXCEEDED`.
      - Check resend throttle (`resendAvailableAt > ClockService.now()`); if throttled, throw `AUTH_OTP_THROTTLED`.
      - Generate 6-digit code (use `123456` if static provider enabled, otherwise cryptographically random 6 digits).
      - Upsert/create `OtpVerification` record with `expiresAt = ClockService.now() + 300s`, `resendAvailableAt = ClockService.now() + 60s`.
      - Call `otpProvider.sendOtp(mobileNumber, code)`.
    - Method `verifyOtp(mobileNumber: string, purpose: string, code: string)`:
      - Check if locked; if locked throw `AUTH_OTP_LOCKED`.
      - Fetch latest verification record.
      - Check if expired (`ClockService.now() > expiresAt`); throw `AUTH_OTP_EXPIRED`.
      - Compare code:
        - If mismatch: increment `attempts`. If `attempts >= 3`, set `lockedUntil = ClockService.now() + 15 minutes` and throw `AUTH_OTP_LOCKED`. Otherwise throw `AUTH_OTP_INVALID` with remaining attempts.
        - If match: return verification record with metadata.
  - [x] 3.5 Unit test `otp.service.spec.ts` verifying expiry, throttling, 3-attempt lockout, and production guard safety.

- [x] Task 4: Backend Auth Module, Service & Controller in `apps/api` (AC: 1, 4, 5)
  - [x] 4.1 Create `apps/api/src/modules/auth/auth.service.ts`:
    - Inject `PrismaService`, `ClockService`, `OtpService`, `ConfigService`.
    - Method `register(dto: RegisterInput, ip: string, userAgent: string)`:
      - Normalize mobile number to `+9665XXXXXXXX`.
      - Check uniqueness for `mobileNumber`, `nationalId`, and `username`.
      - Hash password using `argon2.hash(dto.password, { type: argon2.argon2id })`.
      - Store pending registration in OTP metadata and dispatch OTP via `otpService.generateAndSendOtp`.
      - Return `{ success: true, message: 'OTP_SENT', mobileNumber: normalizedPhone, resendAvailableInSeconds: 60 }`.
    - Method `verifyRegistrationOtp(dto: VerifyOtpRegisterInput, ip: string, userAgent: string)`:
      - Verify OTP via `otpService.verifyOtp(mobileNumber, 'REGISTRATION', dto.code)`.
      - Retrieve pending registration metadata.
      - Execute interactive database transaction (`prisma.$transaction`):
        1. Create `User` (`fullName`, `mobileNumber`, `nationalId`, `username`, `passwordHash`, `status: ACTIVE`).
        2. Create `UserProfile` (`userId: user.id`, `role: BUYER`, `status: ACTIVE`).
        3. Create `ConsentRecord` (`userId: user.id`, `termsVersion: '1.0'`, `privacyVersion: '1.0'`, `consentTimestamp: ClockService.now()`, `ipAddress: ip`, `userAgent: userAgent`, `source: 'REGISTRATION_WEB'`).
        4. Create `Session` (`userId: user.id`, `token: crypto.randomBytes(32).toString('hex')`, `ipAddress: ip`, `userAgent: userAgent`, `expiresAt: ClockService.now() + 30 days`).
        5. Delete/mark consumed OTP record.
      - Return `{ user, sessionToken, sessionExpiresAt }`.
    - Method `resendOtp(dto: ResendOtpInput)`:
      - Trigger `otpService.generateAndSendOtp` with existing purpose and metadata.
    - Method `validateSession(token: string)`:
      - Query `Session` where `token` matches and `expiresAt > ClockService.now()`, include `User` and `User.profiles`.
    - Method `logout(token: string)`:
      - Delete `Session` from database.
  - [x] 4.2 Create `apps/api/src/modules/auth/auth.controller.ts`:
    - `POST /api/v1/auth/register`: validates body with `ZodValidationPipe(registerSchema)`, calls `authService.register`.
    - `POST /api/v1/auth/verify-otp`: validates body with `ZodValidationPipe(verifyOtpRegisterSchema)`, calls `authService.verifyRegistrationOtp`, sets `elmasaif_session` HttpOnly cookie on `res`, returns user envelope.
    - `POST /api/v1/auth/otp/resend`: validates body with `ZodValidationPipe(resendOtpSchema)`, calls `authService.resendOtp`.
    - `GET /api/v1/auth/me`: uses `SessionAuthGuard` to return authenticated user profile.
    - `POST /api/v1/auth/logout`: clears cookie and revokes session.
  - [x] 4.3 Create `apps/api/src/modules/auth/guards/session-auth.guard.ts` and `decorators/current-user.decorator.ts`.
  - [x] 4.4 Register `AuthModule` in `apps/api/src/app.module.ts`.
  - [x] 4.5 Unit tests in `auth.service.spec.ts` and `auth.controller.spec.ts`.

- [x] Task 5: Frontend Registration & OTP Components in `apps/web` (AC: 6)
  - [x] 5.1 Create `apps/web/src/components/auth/otp-input.tsx`:
    - Reusable 6-digit numeric input with focus management:
      - Auto-focuses next input upon typing a digit
      - Handles backspace navigation to previous input
      - Handles clipboard paste of 6-digit code
      - Enforces monospace numerals with `font-mono` and `direction: ltr`
      - Emits `onComplete(code: string)` when all 6 digits are entered.
  - [x] 5.2 Create `apps/web/src/components/auth/terms-modal.tsx`:
    - Modal dialog rendering institutional Terms of Service and Saudi PDPL Privacy Policy summary.
  - [x] 5.3 Create `apps/web/src/components/auth/register-form.tsx`:
    - Two-step state machine:
      - Step 1: Form with Full Name, Saudi Mobile, National ID, Password (with strength helper), Consent Checkboxes. Calls `apiClient.post('/auth/register', data)`.
      - Step 2: 6-Digit OTP screen with countdown timer (60s throttle), resend button, attempt warning banners, and lockout indicator. Calls `apiClient.post('/auth/verify-otp', data)`.
      - Handles errors gracefully, displaying standard Arabic error messages from `ApiError`.
  - [x] 5.4 Create `apps/web/src/app/auth/register/page.tsx`:
    - Server/client Next.js page wrapped with `LayoutShell`.
    - Renders centered card with El Masaif emblem, institutional title ("إنشاء حساب جديد"), step subtitle, and `RegisterForm`.
  - [x] 5.5 Update `apps/web/src/components/layout/header.tsx` to ensure register and login buttons route seamlessly.
  - [x] 5.6 Component unit tests in `apps/web/src/components/auth/__tests__/register-form.spec.ts` and `otp-input.spec.ts`.

- [x] Task 6: Verification, End-to-End Test & Build Gates (AC: 8)
  - [x] 6.1 Run shared workspace tests: `npm test --workspace=@elmasaif/shared`.
  - [x] 6.2 Run backend workspace tests: `npm test --workspace=@elmasaif/api`.
  - [x] 6.3 Run frontend workspace tests: `npm test --workspace=@elmasaif/web`.
  - [x] 6.4 Run full monorepo build: `npm run build`.
  - [x] 6.5 Run monorepo lint: `npm run lint`.

## Dev Notes

- **Saudi Mobile Normalization & Regex Standards (PRD FR-1):**
  - Acceptable inputs: `05XXXXXXXX`, `5XXXXXXXX`, `+9665XXXXXXXX`.
  - Strict regex: `/^(\+966|0)5[0-9]{8}$/`.
  - Normalized storage format: `+9665XXXXXXXX`.
  - Mismatched formats must return HTTP 400 Bad Request with code `AUTH_INVALID_PHONE`.

- **PDPL Legal Consent Architecture (AD-5, NFR6, PRD FR-1):**
  - An insert-only `ConsentRecord` table is used for legal compliance. Columns: `userId`, `termsVersion`, `privacyVersion`, `consentTimestamp`, `ipAddress`, `userAgent`, `source`.
  - No default values on consent fields.
  - Consents are captured atomically upon registration in the same transaction as user creation.

- **Argon2id Password Security (AD-5):**
  - Use `argon2` with `argon2.argon2id` variant.
  - Complexity requirement: at least 8 characters, at least one letter and at least one number (`/^(?=.*[A-Za-z])(?=.*\d)/`).

- **Pluggable OTP & Hard Production Startup Guard (AD-5, R-05, Story 0.5):**
  - `StaticOtpProvider` returns static code `123456`.
  - `StartupGuardService` in `apps/api/src/common/guards/startup-guard.service.ts` already enforces that if `NODE_ENV === 'production'`, `OTP_PROVIDER === 'static'` or `ENABLE_STATIC_OTP === 'true'` calls `process.exit(1)`. This must be preserved and tested.

- **Time Determinism (AD-11, Story 0.5):**
  - All temporal calculations (`expiresAt`, `resendAvailableAt`, `lockedUntil`, `consentTimestamp`, `sessionExpiresAt`) MUST use `ClockService.now()`, NEVER direct `new Date()` or `Date.now()`.

- **Session Security & Same-Origin Proxy (AD-1, AD-2, AD-5):**
  - Session cookie: `elmasaif_session`.
  - Configured with `HttpOnly: true`, `SameSite: 'lax'`, `Path: '/'`, `Secure: process.env.NODE_ENV === 'production'`.
  - Rolling 30-day expiry (`30 * 24 * 60 * 60 * 1000` ms).
  - Web client proxies all requests through `/api/v1/*` via Next.js rewrites (`next.config.js`), ensuring cookies remain strictly same-origin.

### Source Tree Components to Touch

#### Files Being Modified (UPDATE):
1. `apps/api/prisma/schema.prisma`:
   - *Current state:* Defines `User`, `ConsentRecord`, `Session`, `AdminUser`, `UserProfile`. No dedicated `OtpVerification` model.
   - *What changes:* Add `OtpVerification` model with fields for phone, purpose, attempts, expiry, resend throttle, lockout timestamp, and metadata JSON.
   - *What must be preserved:* All existing models (`User`, `ConsentRecord`, `UserProfile`, `City`, `District`, `Deal`, etc.) and relations.
2. `apps/api/src/app.module.ts`:
   - *Current state:* Imports `PrismaModule`, `HealthModule`, `StorageModule`, `GeoModule`, `ClockModule`.
   - *What changes:* Import and register `AuthModule`.
   - *What must be preserved:* Existing middlewares, guards, and throttler settings.
3. `packages/shared/src/schemas/index.ts`:
   - *Current state:* Contains basic `registerSchema` and `otpVerifySchema`.
   - *What changes:* Re-export enhanced auth schemas from `./auth.schema.ts`.
   - *What must be preserved:* Existing schemas (`saudiIbanSchema`, `saudiMobileSchema`, `saudiNationalIdSchema`, `createListingSchema`, etc.).
4. `packages/shared/src/constants/index.ts`:
   - *Current state:* Exports brand colors, job constants, storage constants, UI constants.
   - *What changes:* Re-export auth constants and error codes from `./auth.ts`.
   - *What must be preserved:* All existing constants.
5. `packages/shared/src/types/index.ts`:
   - *Current state:* Exports basic DTO types.
   - *What changes:* Re-export auth types from `./auth.ts`.
   - *What must be preserved:* All existing types.
6. `packages/shared/src/index.ts`:
   - *Current state:* Barrel exports schemas, enums, constants, types.
   - *What changes:* Ensure new auth exports are available.
7. `apps/web/src/components/layout/header.tsx`:
   - *Current state:* Links to `/auth/register` and `/auth/login`.
   - *What changes:* Verify links and active state styling.

#### Files Being Created (NEW):
1. `packages/shared/src/constants/auth.ts`: Auth rate limits, OTP timings, cookie settings, and standard error codes.
2. `packages/shared/src/schemas/auth.schema.ts`: Zod validation schemas for registration, OTP verification, and resend.
3. `packages/shared/src/types/auth.ts`: TypeScript interfaces for auth inputs and session payloads.
4. `packages/shared/src/schemas/__tests__/auth.spec.ts`: Unit tests for auth schemas.
5. `apps/api/src/modules/auth/auth.module.ts`: NestJS Auth module declaring controller, service, and providers.
6. `apps/api/src/modules/auth/auth.controller.ts`: REST controller handling register, verify-otp, resend-otp, me, and logout.
7. `apps/api/src/modules/auth/auth.service.ts`: Business logic orchestrating registration, Argon2id hashing, PDPL consent, session creation, and cookies.
8. `apps/api/src/modules/auth/otp/otp.service.ts`: OTP lifecycle service managing generation, storage, expiry, throttling, and 3-attempt lockout.
9. `apps/api/src/modules/auth/otp/otp-provider.interface.ts`: Interface contract for OTP dispatch providers.
10. `apps/api/src/modules/auth/otp/providers/static-otp.provider.ts`: Development static provider (`123456`).
11. `apps/api/src/modules/auth/otp/providers/sms-otp.provider.ts`: Production SMS gateway contract provider.
12. `apps/api/src/modules/auth/guards/session-auth.guard.ts`: Guard verifying incoming session cookie against PostgreSQL session table.
13. `apps/api/src/modules/auth/decorators/current-user.decorator.ts`: Param decorator extracting authenticated user from request.
14. `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`: Unit tests for auth service.
15. `apps/api/src/modules/auth/__tests__/otp.service.spec.ts`: Unit tests for OTP service (expiration, throttling, lockout).
16. `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`: Unit tests for auth controller endpoints.
17. `apps/web/src/app/auth/register/page.tsx`: Next.js registration page.
18. `apps/web/src/components/auth/register-form.tsx`: Client-side multi-step registration wizard.
19. `apps/web/src/components/auth/otp-input.tsx`: Reusable 6-digit OTP input with focus hops and LTR monospace numbers.
20. `apps/web/src/components/auth/terms-modal.tsx`: Modal dialog displaying Terms and PDPL Policy.
21. `apps/web/src/components/auth/__tests__/register-form.spec.ts`: Component tests for registration wizard.
22. `apps/web/src/components/auth/__tests__/otp-input.spec.ts`: Component tests for OTP input component.

### Project Structure Notes

```
apps/api/src/modules/auth/
├── __tests__/
│   ├── auth.controller.spec.ts
│   ├── auth.service.spec.ts
│   └── otp.service.spec.ts
├── decorators/
│   └── current-user.decorator.ts
├── guards/
│   └── session-auth.guard.ts
├── otp/
│   ├── providers/
│   │   ├── sms-otp.provider.ts
│   │   └── static-otp.provider.ts
│   ├── otp-provider.interface.ts
│   └── otp.service.ts
├── auth.controller.ts
├── auth.module.ts
└── auth.service.ts

apps/web/src/
├── app/
│   └── auth/
│       └── register/
│           └── page.tsx
└── components/
    └── auth/
        ├── __tests__/
        │   ├── otp-input.spec.ts
        │   └── register-form.spec.ts
        ├── otp-input.tsx
        ├── register-form.tsx
        └── terms-modal.tsx

packages/shared/src/
├── constants/
│   ├── auth.ts
│   └── index.ts
├── schemas/
│   ├── __tests__/
│   │   └── auth.spec.ts
│   ├── auth.schema.ts
│   └── index.ts
└── types/
    ├── auth.ts
    └── index.ts
```

### Previous Story Intelligence & Learnings

- **From Story 0.8 (`0-8-sovereign-design-system-foundation-rtl-layout-shell.md`):** Reusable UI primitives (`Button`, `Card`, `Badge`) and layout shell (`LayoutShell`) are in place. Always use `Button variant="primary"` for submission, `font-mono` for numeric codes and Saudi national IDs with `direction: ltr; display: inline-block;`.
- **From Story 0.5 (`0-5-deterministic-clockservice-hard-startup-guard.md`):** `ClockService` is mandatory for all datetime evaluations (`ClockService.now()`). The `StartupGuardService` actively halts the application if static OTP is enabled in production (`NODE_ENV === 'production'`).
- **From Story 0.4 (`0-4-master-geographic-tables-initial-prisma-schema.md`):** Prisma models map camelCase properties to snake_case table and column names (`@map`, `@@map`). `ConsentRecord` table is already defined as insert-only.
- **From Story 0.3 (`0-3-same-origin-api-proxy-http-presentation-boundary.md`):** Session authentication requires `HttpOnly` cookies strictly proxied through Next.js rewrites so they remain same-origin. `apiClient` in `apps/web/src/lib/api-client.ts` automatically sends cookies via `credentials: 'include'`.
- **From Story 0.1 (`0-1-monorepo-foundation-workspace-tooling.md`):** Shared package contracts must be built (`npm run build:shared`) before running dependent builds in `apps/api` and `apps/web`.

### Testing Standards Summary

- **Frameworks:** Jest for `apps/api`, Vitest for `apps/web` and `packages/shared`.
- **Execution:**
  - `npm test --workspace=@elmasaif/shared`
  - `npm test --workspace=@elmasaif/api`
  - `npm test --workspace=@elmasaif/web`
- **Coverage Expectation:** 100% test coverage for OTP throttling, 3-attempt lockout, Saudi phone normalization, PDPL consent capture, and session cookie issuance.
- **Verification Gates:**
  1. All unit and integration tests pass with 0 failures (`npm test`).
  2. Workspace linting passes with 0 errors (`npm run lint`).
  3. Production build succeeds cleanly across all workspaces (`npm run build`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Identity, Auth & Saudi User Governance]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#NFR-6: Privacy & Saudi PDPL Compliance]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1 — Monorepo Layout, Same-Origin API Proxy & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2 — Strict Presentation / Domain Separation & Explicit Action Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-11 — Deterministic Time Simulation (Injectable ClockService)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Information Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#User Security & Account Lifecycle Flows]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High) via Antigravity Pair Programmer

### Debug Log References

- Fixed NestJS HttpStatus 423 by defining domain constant `HTTP_STATUS_LOCKED = 423` in `otp.service.ts`.
- Resolved unused imports and types in `apps/web/src/components/auth/register-form.tsx` for clean Next.js production builds.

### Completion Notes List

- Implemented shared auth contracts, constants, and Zod schemas in `packages/shared`:
  - `saudiMobileNormalizedSchema` normalizes input to E.164 `+9665XXXXXXXX` format.
  - `registerSchema` enforces Saudi National ID / Iqama regex (`^[12][0-9]{9}$`), Argon2id password requirements, and mandatory PDPL consents.
  - 100% test coverage with 16 test cases passing in `packages/shared/src/schemas/__tests__/auth.spec.ts`.
- Created `OtpVerification` model in `apps/api/prisma/schema.prisma` and generated Prisma Client types.
- Implemented backend OTP engine in `apps/api/src/modules/auth/otp`:
  - Pluggable `OtpProvider` interface with `StaticOtpProvider` (`123456`) and `SmsOtpProvider`.
  - Rate limiting with 60s throttle and 3 requests/hour cap.
  - 3-attempt brute-force lockout locking phone verification for 15 minutes (`lockedUntil`).
  - Unit tested in `otp.service.spec.ts` with 8 passing test cases.
- Implemented `AuthService` and `AuthController` in `apps/api/src/modules/auth`:
  - `POST /api/v1/auth/register` initiates registration with conflict pre-checks (409 for phone, national ID, username).
  - `POST /api/v1/auth/verify-otp` commits user, BUYER role, immutable PDPL consent record, and server-side session in atomic `$transaction`.
  - Sets HttpOnly `elmasaif_session` cookie (Lax, Secure in prod, 30 days).
  - Protected `GET /api/v1/auth/me` and `POST /api/v1/auth/logout`.
  - Unit tested in `auth.service.spec.ts` and `auth.controller.spec.ts` with 10 passing test cases.
- Implemented Sovereign UI components in `apps/web`:
  - `OtpInput` with auto-hop focus, backspace handling, clipboard paste, and monospace numerals (`dir="ltr"`).
  - `TermsModal` rendering institutional Terms of Service and Saudi PDPL policy summary.
  - `RegisterForm` two-step state machine with real-time complexity checklist, countdown timer, and attempt banners.
  - Next.js registration page `/auth/register` wrapped in `LayoutShell`.
  - Component unit tests in `register-form.spec.ts` and `otp-input.spec.ts` with 8 passing test cases.
- Full verification gates pass:
  - 100% test pass rate across all monorepo suites (`packages/shared`, `apps/api`, `apps/web`, `apps/worker`).
  - Monorepo linting passes with 0 errors (`npm run lint`).
  - Monorepo build passes cleanly (`npm run build`).

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/schemas/__tests__/auth.spec.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/types/index.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/otp/otp-provider.interface.ts`
- `apps/api/src/modules/auth/otp/otp.service.ts`
- `apps/api/src/modules/auth/otp/providers/static-otp.provider.ts`
- `apps/api/src/modules/auth/otp/providers/sms-otp.provider.ts`
- `apps/api/src/modules/auth/guards/session-auth.guard.ts`
- `apps/api/src/modules/auth/decorators/current-user.decorator.ts`
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`
- `apps/api/src/modules/auth/__tests__/otp.service.spec.ts`
- `apps/web/src/components/auth/otp-input.tsx`
- `apps/web/src/components/auth/terms-modal.tsx`
- `apps/web/src/components/auth/register-form.tsx`
- `apps/web/src/app/auth/register/page.tsx`
- `apps/web/src/components/auth/__tests__/otp-input.spec.ts`
- `apps/web/src/components/auth/__tests__/register-form.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-1-saudi-mobile-registration-otp-verification-legal-consent-tra.md`

### Change Log

- 2026-10-29: Implemented Story 1.1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking across `packages/shared`, `apps/api`, and `apps/web`. Added tests, verification gates, and updated status to review.
