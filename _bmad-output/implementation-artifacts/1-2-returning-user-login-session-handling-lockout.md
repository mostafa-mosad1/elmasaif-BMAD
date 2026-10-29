---
baseline_commit: 79c6f35afd5ab90049b34809f68fd4e56ab50bc1
---

# Story 1.2: Returning User Login, Session Handling & Lockout

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want to log in using my mobile number or username and password with automated brute-force defense and device recognition,
So that I can securely access my account across sessions while protecting my profile against credential stuffing and unauthorized takeover.

## Acceptance Criteria

1. **Returning User Credential Validation & Normalization (`packages/shared` & `apps/api`):**
   - **Given** a registered user on the login screen submitting credentials via `POST /api/v1/auth/login`
   - **When** submitting `identifier` (Saudi mobile number or username) and `password`
   - **Then** validation strictly enforces:
     - `identifier`: minimum 3 characters; if matching Saudi mobile format (`^(\+966|0)?5[0-9]{8}$`), it is normalized to E.164 `+9665XXXXXXXX`; otherwise treated as lowercase trimmed `username`
     - `password`: minimum 8 characters string
     - `deviceId`: optional client device token string (from cookie `elmasaif_device_id` or header `x-device-id`)
   - **And** credentials are verified:
     - Look up user by normalized `mobileNumber` or `username`
     - Verify password hash using `argon2.verify(user.passwordHash, dto.password)`
   - **And** if user does not exist or password hash does not match:
     - If user exists, increment `failedLoginAttempts` by 1
     - Return HTTP 401 Unauthorized with generic error code `AUTH_INVALID_CREDENTIALS` and generic message ("اسم المستخدم أو كلمة المرور غير صحيحة") to prevent account enumeration.

2. **Automated 5-Attempt Brute-Force Lockout (`apps/api/src/modules/auth`):**
   - **Given** any login attempt on an existing user account
   - **When** evaluating the user's lockout state:
     - If `user.lockedUntil` is set and `ClockService.now() < user.lockedUntil`:
       - The request is immediately rejected without checking password
       - Returns HTTP 423 Locked with error code `AUTH_ACCOUNT_LOCKED` and generic message ("تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة"), returning retry details (`lockedUntil` and `retryAfterSeconds`)
   - **And** upon the 5th consecutive failed password submission:
     - Set `user.lockedUntil = ClockService.now() + 15 minutes` (`15 * 60 * 1000`)
     - Set `user.failedLoginAttempts = 5`
     - Return HTTP 423 Locked with error code `AUTH_ACCOUNT_LOCKED`
   - **And** upon any successful password verification:
     - Reset `user.failedLoginAttempts = 0` and `user.lockedUntil = null`.

3. **Account Lifecycle & Status Guardrails (`apps/api/src/modules/auth` per AD-5, FR-2, FR-50):**
   - **Given** valid credentials matching a user account
   - **When** inspecting `user.status`:
     - If `user.status === ProfileStatus.DELETION_PENDING`:
       - Immediately cancel the deletion request
       - Restore user status to `ProfileStatus.ACTIVE`
       - Clear `deletionRequestedAt = null` and `deletionDueAt = null`
       - Include notification in login response: `deletionCancelled: true`
     - If `user.status === ProfileStatus.DEACTIVATED`:
       - Reject login with HTTP 403 Forbidden and error code `AUTH_ACCOUNT_DEACTIVATED` ("هذا الحساب معطل. يرجى التواصل مع الدعم الفني")
     - If `user.status === ProfileStatus.DISABLED` or `ProfileStatus.SOFT_DELETED`:
       - Reject login with HTTP 403 Forbidden and error code `AUTH_ACCOUNT_DISABLED` ("هذا الحساب موقوف من قبل الإدارة").

4. **Device Recognition & Step-Up OTP Verification (`apps/api/src/modules/auth` per FR-2):**
   - **Given** valid credentials and an active account
   - **When** determining device familiarity:
     - Compute `deviceHash = sha256(deviceId || (ipAddress + userAgent))`
     - Query `KnownDevice` table in PostgreSQL for `userId = user.id` and `deviceHash = deviceHash`
     - Check if device is recognized and has an active footprint (or if session is expired)
   - **Then** if the device is UNRECOGNIZED (not found in `KnownDevice` for this user):
     - Generate and dispatch a 6-digit step-up OTP via `OtpService.generateAndSendOtp(user.mobileNumber, 'LOGIN_STEP_UP', { userId: user.id, deviceHash })`
     - Create a temporary signed challenge token (`stepUpToken` expiring in 300 seconds)
     - Return HTTP 200 OK with envelope:
       ```json
       {
         "code": "AUTH_STEP_UP_REQUIRED",
         "message": "تم إرسال رمز التحقق الإضافي لتأكيد جهاز الدخول الجديد",
         "data": {
           "stepUpRequired": true,
           "mobileNumber": "+966 5X XXX 1234",
           "stepUpToken": "...",
           "resendAvailableInSeconds": 60
         }
       }
       ```
     - Do NOT issue session cookie yet.
   - **And** when submitting step-up OTP via `POST /api/v1/auth/login/step-up`:
     - Validate `stepUpToken`, `mobileNumber`, and 6-digit `code`
     - Verify OTP via `OtpService.verifyOtp(mobileNumber, 'LOGIN_STEP_UP', code)`
     - Upon valid code:
       - Upsert `KnownDevice` record (`userId`, `deviceHash`, `userAgent`, `ipAddress`, `lastSeenAt = ClockService.now()`)
       - Log security alert event (`auth.security_alert`) for new device login
       - Issue full 30-day session cookie and return standard `AUTH_LOGIN_SUCCESS` envelope.

5. **Server-Side Session Management & HttpOnly Cookie Issuance (`apps/api` per AD-1, AD-5):**
   - **Given** successful authentication (immediate on recognized device or post step-up OTP)
   - **When** establishing the session:
     - Generate cryptographically secure 32-byte token (`crypto.randomBytes(32).toString('hex')`)
     - Persist session in PostgreSQL `Session` table:
       - `userId = user.id`
       - `token = sessionToken`
       - `ipAddress = request.ip`
       - `userAgent = request.headers['user-agent']`
       - `expiresAt = ClockService.now() + 30 days` (rolling 30-day expiration)
     - Set `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `elmasaif_session` on the response:
       - `Secure: true` in production (`NODE_ENV === 'production'`), `false` in local development
       - `maxAge: 30 * 24 * 60 * 60 * 1000` (30 days in ms)
     - Set client device cookie `elmasaif_device_id` (MaxAge 1 year, SameSite=Lax) if new device ID generated
     - Update `KnownDevice.lastSeenAt = ClockService.now()`
     - Return HTTP 200 OK with standard response envelope containing user profile and active roles.

6. **Frontend Institutional Login Screen & Step-Up Wizard (`apps/web/src/app/auth/login` per DESIGN.md & EXPERIENCE.md):**
   - **Given** a user opening `/auth/login`
   - **When** the page renders:
     - Wrapped in `LayoutShell` with institutional branding (Sovereign Emerald `#1B4332`, Desert Gold `#C69C45`, RTL Arabic typography `IBM Plex Sans Arabic`)
     - Renders centered card with El Masaif emblem and title ("تسجيل الدخول إلى منصة المصايف")
     - **Form Inputs:**
       - Identifier input (Saudi mobile number with `+966` prefix helper or username)
       - Password input with toggleable show/hide eye icon
       - "تذكر هذا الجهاز" (Remember this device) checkbox
       - Forgot password link ("نسيت كلمة المرور؟" routing to `/auth/forgot-password`)
       - Submit button ("تسجيل الدخول", `Button variant="primary"`)
       - Registration prompt ("ليس لديك حساب؟ إنشاء حساب جديد" routing to `/auth/register`)
     - **Step-Up OTP Step:**
       - If API returns `AUTH_STEP_UP_REQUIRED`, smoothly transition to 6-digit OTP verification card
       - Uses reusable `OtpInput` component with auto-focus hops and LTR monospace numbers
       - Displays masked phone number (`+966 5X XXX 1234`) and new device security badge
       - 60-second countdown timer for resending OTP ("إعادة إرسال الرمز")
     - **Security Banners:**
       - If account is locked (423 `AUTH_ACCOUNT_LOCKED`), displays an prominent institutional amber/red warning banner with a live 15-minute countdown timer
       - If deletion request was cancelled, shows a celebratory green toast notification ("تم إلغاء طلب حذف الحساب واستعادة نشاطه بنجاح").

7. **Shared Contracts, Enums & Error Codes (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** consumed by backend and frontend:
     - Exports Zod schemas: `loginSchema`, `verifyStepUpOtpSchema`
     - Exports TypeScript types: `LoginInput`, `VerifyStepUpOtpInput`, `LoginResponse`, `StepUpRequiredResponse`
     - Exports constants: `LOGIN_MAX_FAILED_ATTEMPTS = 5`, `LOGIN_LOCKOUT_MINUTES = 15`, `DEVICE_COOKIE_NAME = 'elmasaif_device_id'`
     - Exports error codes: `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, `AUTH_ACCOUNT_DEACTIVATED`, `AUTH_ACCOUNT_DISABLED`, `AUTH_STEP_UP_REQUIRED`, `AUTH_STEP_UP_INVALID`, `AUTH_STEP_UP_LOCKED`.

8. **Automated Unit, Service & Integration Test Gates:**
   - **Given** the monorepo test runner
   - **When** executing tests across workspaces (`npm test`):
     - 100% of test suites pass without regression:
       - Schema validation tests in `packages/shared/src/schemas/__tests__/auth.spec.ts`
       - Backend auth service tests in `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (covering valid login, invalid password, 5-attempt lockout, 15-minute locked rejection, DeletionPending restoration, Deactivated/Disabled refusal, device recognition, and step-up OTP)
       - Backend controller tests in `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`
       - Frontend component tests in `apps/web/src/components/auth/__tests__/login-form.spec.ts`
     - Zero lint errors (`npm run lint`) and clean workspace builds (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Shared Contracts, Schemas & Constants in `packages/shared` (AC: 1, 7)
  - [x] 1.1 Update `packages/shared/src/constants/auth.ts`:
    - Export `LOGIN_MAX_FAILED_ATTEMPTS = 5`
    - Export `LOGIN_LOCKOUT_MINUTES = 15`
    - Export `DEVICE_COOKIE_NAME = 'elmasaif_device_id'`
    - Export domain error codes:
      - `AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS'`
      - `AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED'`
      - `AUTH_ACCOUNT_DEACTIVATED = 'AUTH_ACCOUNT_DEACTIVATED'`
      - `AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED'`
      - `AUTH_STEP_UP_REQUIRED = 'AUTH_STEP_UP_REQUIRED'`
      - `AUTH_STEP_UP_INVALID = 'AUTH_STEP_UP_INVALID'`
      - `AUTH_STEP_UP_LOCKED = 'AUTH_STEP_UP_LOCKED'`
  - [x] 1.2 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Enhance `loginSchema` with:
      - `identifier`: string min(3) trimmed
      - `password`: string min(8)
      - `deviceId`: optional string
      - `rememberDevice`: optional boolean default(true)
    - Create `verifyStepUpOtpSchema` with:
      - `mobileNumber`: saudiMobileNormalizedSchema
      - `code`: string length(6)
      - `stepUpToken`: string min(1)
      - `deviceId`: optional string
  - [x] 1.3 Update `packages/shared/src/types/auth.ts`:
    - Export types `LoginInput`, `VerifyStepUpOtpInput`, `LoginResponse`, `StepUpRequiredResponse`
  - [x] 1.4 Author unit tests in `packages/shared/src/schemas/__tests__/auth.spec.ts` for login and step-up schemas.

- [x] Task 2: Database Schema & Relational Models in `apps/api/prisma/schema.prisma` (AC: 2, 4)
  - [x] 2.1 Update `apps/api/prisma/schema.prisma`:
    - Update `User` model:
      - Add `failedLoginAttempts Int @default(0) @map("failed_login_attempts")`
      - Add `lockedUntil DateTime? @map("locked_until")`
      - Add `knownDevices KnownDevice[]`
    - Add `KnownDevice` model mapped to `known_devices`:
      - `id`: String `@id @default(uuid())`
      - `userId`: String `@map("user_id")`
      - `deviceHash`: String `@map("device_hash")`
      - `userAgent`: String? `@map("user_agent")`
      - `ipAddress`: String? `@map("ip_address")`
      - `lastSeenAt`: DateTime `@default(now()) @map("last_seen_at")`
      - `createdAt`: DateTime `@default(now()) @map("created_at")`
      - `user`: User `@relation(fields: [userId], references: [id], onDelete: Cascade)`
      - `@@unique([userId, deviceHash])`
      - `@@index([userId])`
      - `@@map("known_devices")`
  - [x] 2.2 Run `npm run prisma:generate` to regenerate Prisma Client types.

- [x] Task 3: Backend Login & Lockout Engine in `apps/api/src/modules/auth/auth.service.ts` (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Implement `login(dto: LoginInput, ip: string, userAgent: string, deviceId?: string)`:
    - Normalize identifier (if Saudi phone pattern, normalize via E.164 `+9665XXXXXXXX`, else lowercase username).
    - Query `User` by `mobileNumber` or `username`, including `profiles` and `knownDevices`.
    - Check active lockout: if `user.lockedUntil && ClockService.now() < user.lockedUntil`, calculate remaining seconds and throw `HttpException` with HTTP 423 Locked and `AUTH_ACCOUNT_LOCKED`.
    - If user not found:
      - Run dummy Argon2id hash verify to maintain constant time and throw HTTP 401 `AUTH_INVALID_CREDENTIALS`.
    - Verify password via `argon2.verify(user.passwordHash, dto.password)`:
      - If invalid:
        - Increment `user.failedLoginAttempts` in DB.
        - If `failedLoginAttempts + 1 >= 5`: set `lockedUntil = ClockService.now() + 15 minutes` and throw HTTP 423 Locked with `AUTH_ACCOUNT_LOCKED`.
        - Else throw HTTP 401 `AUTH_INVALID_CREDENTIALS` (with remaining attempts in dev/debug envelope if appropriate).
    - If valid:
      - Reset `failedLoginAttempts = 0` and `lockedUntil = null`.
      - Check Account Status:
        - If `user.status === ProfileStatus.DEACTIVATED`: throw HTTP 403 `AUTH_ACCOUNT_DEACTIVATED`.
        - If `user.status === ProfileStatus.DISABLED` or `ProfileStatus.SOFT_DELETED`: throw HTTP 403 `AUTH_ACCOUNT_DISABLED`.
        - If `user.status === ProfileStatus.DELETION_PENDING`: cancel deletion (`status = ACTIVE`, `deletionRequestedAt = null`, `deletionDueAt = null`).
      - Device Recognition:
        - Compute `deviceHash = crypto.createHash('sha256').update(deviceId || (ip + userAgent)).digest('hex')`.
        - Check if `KnownDevice` exists for `(user.id, deviceHash)`.
        - If NOT found (unrecognized device):
          - Dispatch step-up OTP via `otpService.generateAndSendOtp(user.mobileNumber, 'LOGIN_STEP_UP', { userId: user.id, deviceHash, deviceId })`.
          - Create HMAC signed `stepUpToken` containing `userId`, `mobileNumber`, and expiry (300s).
          - Return `{ stepUpRequired: true, mobileNumber: maskPhone(user.mobileNumber), stepUpToken, resendAvailableInSeconds: 60 }`.
        - If recognized:
          - Update `KnownDevice.lastSeenAt = ClockService.now()`.
          - Create rolling 30-day `Session` in DB (`expiresAt = ClockService.now() + 30 days`).
          - Return `{ user: sessionUser, sessionToken, sessionExpiresAt, deletionCancelled }`.
  - [x] 3.2 Implement `verifyStepUpOtp(dto: VerifyStepUpOtpInput, ip: string, userAgent: string)`:
    - Verify HMAC signature and expiration on `stepUpToken`.
    - Verify OTP code via `otpService.verifyOtp(dto.mobileNumber, 'LOGIN_STEP_UP', dto.code)`.
    - Upsert `KnownDevice` for `(metadata.userId, metadata.deviceHash)` with `lastSeenAt = ClockService.now()`.
    - Create rolling 30-day `Session` in DB.
    - Return `{ user: sessionUser, sessionToken, sessionExpiresAt }`.
  - [x] 3.3 Author comprehensive unit tests in `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`:
    - Test successful login on recognized device.
    - Test invalid password incrementing attempts and triggering 15-minute lock on 5th attempt.
    - Test rejection with 423 while locked.
    - Test restoration of `DeletionPending` account.
    - Test refusal of `Deactivated` and `Disabled` accounts.
    - Test step-up OTP dispatch on unrecognized device and subsequent verification.

- [x] Task 4: Backend REST Controller Endpoints in `apps/api/src/modules/auth/auth.controller.ts` (AC: 1, 4, 5)
  - [x] 4.1 Implement `POST /api/v1/auth/login`:
    - Validate body using `ZodValidationPipe(loginSchema)`.
    - Extract IP, User-Agent, and device identifier from cookie `elmasaif_device_id` or header `x-device-id`.
    - If new device ID needed, generate UUID.
    - Call `authService.login(...)`.
    - If `stepUpRequired: true`: return HTTP 200 with step-up envelope (no session cookie).
    - If authenticated: set `elmasaif_session` cookie (HttpOnly, Secure in prod, SameSite=Lax, 30 days) and `elmasaif_device_id` cookie (1 year), return standard success envelope.
  - [x] 4.2 Implement `POST /api/v1/auth/login/step-up`:
    - Validate body using `ZodValidationPipe(verifyStepUpOtpSchema)`.
    - Call `authService.verifyStepUpOtp(...)`.
    - Set `elmasaif_session` cookie and `elmasaif_device_id` cookie.
    - Return standard `AUTH_LOGIN_SUCCESS` envelope.
  - [x] 4.3 Author unit tests in `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`.

- [x] Task 5: Frontend Login Screen & Components in `apps/web` (AC: 6)
  - [x] 5.1 Create `apps/web/src/components/auth/login-form.tsx`:
    - Two-state machine:
      - State 1: Credential Form (Identifier, Password with visibility toggle, Remember Device checkbox, submit button).
      - State 2: Step-Up OTP Verification (masked phone display, 6-digit `OtpInput`, 60-second countdown resend timer).
    - Account lockout banner with live 15-minute countdown display.
    - Handles generic error messages in Arabic per `DESIGN.md`.
    - Sets/persists `elmasaif_device_id` in client cookie or localStorage if not present.
    - Upon success, redirects to `/app/buyer` (or return URL).
  - [x] 5.2 Create `apps/web/src/app/auth/login/page.tsx`:
    - Server/client Next.js page wrapped in `LayoutShell`.
    - Renders centered card with institutional emblem, title ("تسجيل الدخول"), and `LoginForm`.
  - [x] 5.3 Author component tests in `apps/web/src/components/auth/__tests__/login-form.spec.ts`.

- [x] Task 6: Verification, End-to-End Test & Build Gates (AC: 8)
  - [x] 6.1 Run shared tests: `npm test --workspace=@elmasaif/shared`.
  - [x] 6.2 Run backend tests: `npm test --workspace=@elmasaif/api`.
  - [x] 6.3 Run frontend tests: `npm test --workspace=@elmasaif/web`.
  - [x] 6.4 Run full monorepo build: `npm run build`.
  - [x] 6.5 Run full monorepo lint: `npm run lint`.

## Dev Notes

- **Password Verification Security & Timing-Attack Mitigation (AD-5):**
  - Always use `argon2.verify(user.passwordHash, dto.password)`.
  - If user is not found, execute a dummy verification against a static pre-computed Argon2id hash before throwing `AUTH_INVALID_CREDENTIALS` to prevent timing-based user enumeration.
  - Always return identical HTTP 401 `AUTH_INVALID_CREDENTIALS` message ("اسم المستخدم أو كلمة المرور غير صحيحة") whether the user exists or not.

- **Brute-Force Lockout Standard (PRD FR-2, Assumption A-04):**
  - Lockout threshold: strictly 5 failed attempts.
  - Lockout duration: strictly 15 minutes (`15 * 60 * 1000` ms).
  - When locked: return HTTP 423 Locked with `AUTH_ACCOUNT_LOCKED`.
  - Successful login MUST reset `failedLoginAttempts = 0` and `lockedUntil = null`.

- **Deterministic Time Evaluation (AD-11, Story 0.5):**
  - All temporal calculations (`lockedUntil`, `sessionExpiresAt`, `stepUpTokenExpiry`, `lastSeenAt`) MUST use `ClockService.now()`, NEVER direct `new Date()` or `Date.now()`.

- **Device Recognition Logic (FR-2, AD-5):**
  - Client device token: stored in cookie `elmasaif_device_id` (UUIDv4) or passed via header `x-device-id`.
  - Server computes cryptographic fingerprint `deviceHash = sha256(deviceId + ':' + userAgent + ':' + ipSubnet)`.
  - If no `KnownDevice` matches `(user.id, deviceHash)`, trigger step-up OTP with purpose `'LOGIN_STEP_UP'`.
  - Once step-up OTP is verified, upsert `KnownDevice` and issue 30-day session cookie.

- **Account Lifecycle Rules (AD-5, FR-2, FR-50):**
  - `DeletionPending`: Logging in automatically cancels the pending deletion and restores the account to `ACTIVE`.
  - `Deactivated`: Account has transaction history and requested deletion; login strictly prohibited (`AUTH_ACCOUNT_DEACTIVATED`).
  - `Disabled` / `SoftDeleted`: Administratively banned or permanently erased; login strictly prohibited (`AUTH_ACCOUNT_DISABLED`).

### Source Tree Components to Touch

#### Files Being Modified (UPDATE):
1. `apps/api/prisma/schema.prisma`:
   - *Current state:* Defines `User` without `failedLoginAttempts` or `lockedUntil`. Defines `Session` without `KnownDevice` relation.
   - *What changes:* Add `failedLoginAttempts` and `lockedUntil` to `User`. Add `KnownDevice` model.
   - *What must be preserved:* All existing models (`User`, `UserProfile`, `Session`, `ConsentRecord`, `OtpVerification`, etc.) and relations.
2. `packages/shared/src/constants/auth.ts`:
   - *Current state:* Exports OTP limits and basic auth error codes.
   - *What changes:* Add `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `DEVICE_COOKIE_NAME`, and login error codes (`AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, `AUTH_ACCOUNT_DEACTIVATED`, `AUTH_ACCOUNT_DISABLED`, `AUTH_STEP_UP_REQUIRED`).
   - *What must be preserved:* All existing constants.
3. `packages/shared/src/schemas/auth.schema.ts`:
   - *Current state:* Exports registration and OTP schemas.
   - *What changes:* Export enhanced `loginSchema` and `verifyStepUpOtpSchema`.
   - *What must be preserved:* Existing `registerSchema`, `saudiMobileNormalizedSchema`, etc.
4. `packages/shared/src/types/auth.ts`:
   - *Current state:* Exports registration types and `SessionUser`.
   - *What changes:* Export `LoginInput`, `VerifyStepUpOtpInput`, `LoginResponse`.
   - *What must be preserved:* Existing types.
5. `apps/api/src/modules/auth/auth.service.ts`:
   - *Current state:* Contains `register`, `verifyRegistrationOtp`, `resendOtp`, `validateSession`, `logout`.
   - *What changes:* Implement `login` and `verifyStepUpOtp` with brute-force lockout, device recognition, and account lifecycle handlers.
   - *What must be preserved:* Existing registration and session validation methods.
6. `apps/api/src/modules/auth/auth.controller.ts`:
   - *Current state:* Endpoints `register`, `verify-otp`, `otp/resend`, `me`, `logout`.
   - *What changes:* Add `POST /login` and `POST /login/step-up`.
   - *What must be preserved:* All existing endpoints.
7. `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`:
   - *Current state:* Tests registration and session creation.
   - *What changes:* Add unit test suite for login, lockout, device recognition, and account statuses.
8. `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`:
   - *Current state:* Tests registration controller endpoints.
   - *What changes:* Add tests for login and step-up endpoints.
9. `packages/shared/src/schemas/__tests__/auth.spec.ts`:
   - *Current state:* Tests registration schemas.
   - *What changes:* Add tests for login and step-up schemas.

#### Files Being Created (NEW):
1. `apps/web/src/app/auth/login/page.tsx`: Next.js login page wrapped in `LayoutShell`.
2. `apps/web/src/components/auth/login-form.tsx`: Sovereign login form component with credentials state, step-up OTP state, and lockout countdown banner.
3. `apps/web/src/components/auth/__tests__/login-form.spec.ts`: Component tests for login form wizard.

### Project Structure Notes

```
apps/api/src/modules/auth/
├── __tests__/
│   ├── auth.controller.spec.ts     (UPDATE)
│   ├── auth.service.spec.ts        (UPDATE)
│   └── otp.service.spec.ts         (PRESERVE)
├── auth.controller.ts              (UPDATE)
├── auth.service.ts                 (UPDATE)
└── ...

apps/web/src/
├── app/
│   └── auth/
│       ├── login/
│       │   └── page.tsx            (NEW)
│       └── register/
│           └── page.tsx            (PRESERVE)
└── components/
    └── auth/
        ├── __tests__/
        │   ├── login-form.spec.ts  (NEW)
        │   ├── otp-input.spec.ts   (PRESERVE)
        │   └── register-form.spec.ts (PRESERVE)
        ├── login-form.tsx          (NEW)
        ├── otp-input.tsx           (PRESERVE - REUSE)
        └── register-form.tsx       (PRESERVE)

packages/shared/src/
├── constants/
│   └── auth.ts                     (UPDATE)
├── schemas/
│   ├── __tests__/
│   │   └── auth.spec.ts            (UPDATE)
│   └── auth.schema.ts              (UPDATE)
└── types/
    └── auth.ts                     (UPDATE)
```

### Previous Story Intelligence & Learnings

- **From Story 1.1 (`1-1-saudi-mobile-registration-otp-verification-legal-consent-tra.md`):**
  - Reusable `OtpInput` (`apps/web/src/components/auth/otp-input.tsx`) handles auto-focus hop, backspace, clipboard paste, and monospace numerals (`dir="ltr"`). Reuse directly for step-up OTP.
  - `OtpService` in `apps/api/src/modules/auth/otp/otp.service.ts` supports arbitrary `purpose` strings. Use `'LOGIN_STEP_UP'` as the purpose for step-up OTP verification.
  - HTTP 423 Locked constant `HTTP_STATUS_LOCKED = 423` is already used in `otp.service.ts`.
  - Session cookie configuration must maintain `HttpOnly`, `SameSite: 'lax'`, `Path: '/'`, `Secure: process.env.NODE_ENV === 'production'`, and 30-day maxAge.
- **From Story 0.5 (`0-5-deterministic-clockservice-hard-startup-guard.md`):**
  - Always use `ClockService.now()` for all date checks, lockout timestamps, and session calculations. Never use raw `new Date()` or `Date.now()`.
- **From Story 0.3 (`0-3-same-origin-api-proxy-http-presentation-boundary.md`):**
  - Cookies must remain strictly same-origin via Next.js rewrites (`/api/*` proxied to backend).
- **From Story 0.8 (`0-8-sovereign-design-system-foundation-rtl-layout-shell.md`):**
  - Maintain Sovereign Emerald and Desert Gold branding, RTL direction, and IBM Plex Sans Arabic typography.

### Testing Standards Summary

- **Frameworks:** Jest for `apps/api`, Vitest for `apps/web` and `packages/shared`.
- **Coverage Expectation:** 100% test coverage for:
  - Phone normalization and identifier parsing.
  - Password verification via Argon2id.
  - 5-attempt brute-force counter and 15-minute account lockout.
  - Account lifecycle status gates (DeletionPending cancellation, Deactivated / Disabled refusal).
  - Unrecognized device detection and step-up OTP verification.
  - Rolling 30-day session issuance and cookie setting.
- **Verification Gates:**
  1. `npm test` passes across all monorepo workspaces.
  2. `npm run lint` passes with 0 errors.
  3. `npm run build` succeeds cleanly across all workspaces.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Returning User Login, Session Handling & Lockout]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Identity, Auth & Saudi User Governance]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-2: Returning User Login & Session Handling]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-50: Account Deletion & Statutory Retention Schedules]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#Assumption A-03 & A-04]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1 — Monorepo Layout, Same-Origin API Proxy & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2 — Strict Presentation / Domain Separation & Explicit Action Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-11 — Deterministic Time Simulation (Injectable ClockService)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#User Security & Account Lifecycle Flows]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High) via Antigravity Pair Programmer

### Debug Log References

- Fixed TypeScript type narrowing on discriminated union boolean properties (`stepUpRequired === false` and `stepUpRequired === true`) in `AuthService` and `AuthController`.
- Fixed `Badge` component variant in `apps/web/src/components/auth/login-form.tsx` from invalid `'warning'` to sovereign design token `'pending'`.
- Cleaned up ESLint unused variable and explicit any warnings across workspaces.

### Completion Notes List

- ✅ Implemented returning user login with Saudi mobile / username normalization and Argon2id hash verification with constant-time dummy verify on nonexistent users to prevent enumeration (AC 1).
- ✅ Implemented 5-attempt brute-force lockout with 15-minute freeze and immediate HTTP 423 Locked rejection (AC 2).
- ✅ Handled account lifecycle statuses: auto-cancellation of `DELETION_PENDING` with celebratory flag, and HTTP 403 rejection of `DEACTIVATED`, `DISABLED`, and `SOFT_DELETED` profiles (AC 3).
- ✅ Implemented device recognition via SHA-256 fingerprinting with HMAC-signed challenge token, step-up OTP challenge via `OtpService`, and subsequent verification upserting `KnownDevice` (AC 4).
- ✅ Implemented server-side session management with rolling 30-day HttpOnly cookie (`elmasaif_session`) and 1-year device cookie (`elmasaif_device_id`) (AC 5).
- ✅ Built institutional Arabic login page (`/auth/login`) with `LoginForm` state machine, 15-minute live lockout countdown banner, show/hide password toggle, remember device option, and 6-digit `OtpInput` step-up card (AC 6).
- ✅ Exported shared constants, error codes, and Zod schemas (`loginSchema`, `verifyStepUpOtpSchema`) in `packages/shared` (AC 7).
- ✅ Verified 100% test pass rate across 290 unit/service/component tests, clean Next.js production build, and 0 lint warnings (AC 8).

### File List

- `packages/shared/src/constants/auth.ts` (Modified)
- `packages/shared/src/enums/index.ts` (Modified)
- `packages/shared/src/schemas/auth.schema.ts` (Modified)
- `packages/shared/src/schemas/index.ts` (Modified)
- `packages/shared/src/types/auth.ts` (Modified)
- `packages/shared/src/types/index.ts` (Modified)
- `packages/shared/src/schemas/__tests__/auth.spec.ts` (Modified)
- `apps/api/prisma/schema.prisma` (Modified)
- `apps/api/src/modules/auth/auth.service.ts` (Modified)
- `apps/api/src/modules/auth/auth.controller.ts` (Modified)
- `apps/api/src/modules/auth/otp/providers/sms-otp.provider.ts` (Modified)
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (Modified)
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts` (Modified)
- `apps/web/src/components/auth/login-form.tsx` (New)
- `apps/web/src/components/auth/__tests__/login-form.spec.ts` (New)
- `apps/web/src/app/auth/login/page.tsx` (New)

### Change Log

- `2026-10-29`: Completed implementation of Story 1.2: Returning User Login, Session Handling & Lockout. All 6 tasks completed, 100% automated tests passing, builds clean. Status moved to `review`.

