---
baseline_commit: 0c836f63ac8bb01a0aa8eb4f7987a782d5112972
---

# Story 1.6: Password Recovery & Authenticated Password Change

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want to recover access via a secure step-up OTP flow when I forget my password, and update my password securely from account settings when authenticated,
So that I can regain access to my account without exposing account existence to attackers, and maintain full control over my account security while invalidating compromised sessions.

## Acceptance Criteria

1. **Anti-Enumeration Password Recovery Initiation (`packages/shared` & `apps/api` per FR-46, UJ-1):**
   - **Given** a user on the public password recovery screen submitting a Saudi mobile number via `POST /api/v1/auth/forgot-password`
   - **When** the client submits `mobileNumber`
   - **Then** the endpoint validates the mobile number using `saudiMobileNormalizedSchema` (format `^(\+966|0)5[0-9]{8}$`, normalized to `+9665XXXXXXXX`).
   - **And** the endpoint returns an **identical HTTP status (200 OK), message, and execution timing** regardless of whether the mobile number exists in the database:
     ```json
     {
       "code": "AUTH_RESET_INITIATED",
       "message": "إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور",
       "data": {
         "resendAvailableInSeconds": 60
       }
     }
     ```
   - **And** timing attack protection is enforced: if the user does not exist, the server executes dummy simulated work (e.g. constant-time delay or simulated HMAC/Argon2 execution) so that response timing cannot be used to deduce account existence.
   - **And** if the account exists but is in `DEACTIVATED`, `DISABLED`, or `SOFT_DELETED` status, no OTP is dispatched, and the endpoint silently returns the same generic success response.
   - **And** if the account is `ACTIVE` (or `DELETION_PENDING`):
     - Dispatches a 6-digit OTP using `OtpService.generateAndSendOtp(user.mobileNumber, 'PASSWORD_RESET')`.
     - Enforces standard OTP parameters: 300s expiry, 60s resend throttle, max 3 hourly requests per phone (`AUTH_OTP_THROTTLED`, `AUTH_OTP_MAX_EXCEEDED`).

2. **Step-Up OTP Verification & Short-Lived Reset Challenge Token (`apps/api` per FR-46):**
   - **Given** an active password recovery flow
   - **When** submitting the 6-digit OTP code via `POST /api/v1/auth/reset-password/verify-otp` with `mobileNumber` and `code`
   - **Then** the server verifies the code using `OtpService.verifyOtp(mobileNumber, 'PASSWORD_RESET', code)`:
     - 3 consecutive incorrect OTP entries lock password reset attempts for 15 minutes (`HTTP 423 Locked`, `AUTH_OTP_LOCKED`).
     - Expired OTP returns HTTP 400 Bad Request with `AUTH_OTP_EXPIRED`.
   - **And** upon successful OTP verification:
     - The OTP record is cleaned up via `OtpService.cleanupOtp`.
     - Generates a cryptographically signed HMAC-SHA256 reset challenge token (`resetToken`) containing `userId`, `mobileNumber`, and an expiration of 15 minutes (`900` seconds).
     - Returns HTTP 200 OK with:
       ```json
       {
         "code": "AUTH_RESET_OTP_VERIFIED",
         "message": "تم تأكيد رمز التحقق بنجاح",
         "data": {
           "resetToken": "...",
           "expiresInSeconds": 900
         }
       }
       ```

3. **Atomic Password Reset, Session Revocation & Audit Logging (`apps/api` per FR-46, AD-5):**
   - **Given** a verified reset challenge token
   - **When** the client submits a new password via `POST /api/v1/auth/reset-password` containing `resetToken` and `newPassword`
   - **Then** the server verifies the cryptographic signature and expiration of `resetToken`:
     - If invalid or expired, returns HTTP 400 Bad Request with `AUTH_RESET_TOKEN_INVALID` or `AUTH_RESET_TOKEN_EXPIRED`.
   - **And** validates `newPassword` against security requirements:
     - Minimum 8 characters, containing at least one letter and at least one number (`/^(?=.*[A-Za-z])(?=.*\d)/`).
     - **Prohibits reusing the current password:** verifies `newPassword` against the user's stored `passwordHash` via `argon2.verify(user.passwordHash, newPassword)`. If identical, rejects the request immediately with HTTP 400 Bad Request and error code `AUTH_PASSWORD_SAME_AS_CURRENT` ("كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية").
   - **And** executes the reset atomically inside a Prisma transaction (`prisma.$transaction`):
     - Hashes `newPassword` using Argon2id (`argon2.hash(newPassword, { type: argon2.argon2id })`).
     - Updates `User.passwordHash = newHash`.
     - Resets `User.failedLoginAttempts = 0` and clears `User.lockedUntil = null`.
     - **Revokes ALL existing active sessions** for this user across all devices: `prisma.session.deleteMany({ where: { userId: user.id } })`.
     - Inserts an immutable `AuditLog` entry:
       - `actorId: user.id`
       - `actorType: 'USER'`
       - `action: 'AUTH_PASSWORD_RESET'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `ipAddress: req.ip`
       - `payload: { source: 'forgot_password_recovery' }`
   - **And** dispatches a security notification alert to the user's registered mobile number (`auth.security_alert`).
   - **And** returns HTTP 200 OK with `AUTH_PASSWORD_RESET_SUCCESS` ("تم إعادة تعيين كلمة المرور بنجاح وإلغاء كافة الجلسات النشطة").

4. **Authenticated Password Change with Current Session Preservation (`apps/api` per FR-47, UJ-1):**
   - **Given** an authenticated user changing their password in account settings
   - **When** submitting `currentPassword` and `newPassword` via `POST /api/v1/auth/change-password` (guarded by `SessionAuthGuard`)
   - **Then** the server verifies `currentPassword` against the stored `user.passwordHash`:
     - If `currentPassword` does not match:
       - Increments `user.failedLoginAttempts` by 1.
       - If `failedLoginAttempts >= 5`, sets `user.lockedUntil = ClockService.now() + 15 minutes` and returns HTTP 423 Locked with `AUTH_ACCOUNT_LOCKED`.
       - Otherwise returns HTTP 401 Unauthorized with `AUTH_INVALID_CREDENTIALS` ("كلمة المرور الحالية غير صحيحة").
     - If `currentPassword` matches:
       - Resets `user.failedLoginAttempts = 0`.
   - **And** checks that `newPassword` differs from `currentPassword`:
     - If `await argon2.verify(user.passwordHash, newPassword)` is true, rejects immediately with HTTP 400 Bad Request and error code `AUTH_PASSWORD_SAME_AS_CURRENT`.
   - **And** enforces password complexity (minimum 8 characters, at least one letter and at least one number).
   - **And** executes the update in an atomic Prisma transaction:
     - Hashes `newPassword` with Argon2id.
     - Updates `User.passwordHash = newHash`.
     - **Revocation Rule (FR-47):** Revokes all OTHER concurrent active sessions belonging to this user EXCEPT the requesting session token (`prisma.session.deleteMany({ where: { userId: user.id, token: { not: currentSessionToken } } })`). The user remains signed in on the current client.
     - Inserts an immutable `AuditLog` entry:
       - `actorId: user.id`
       - `actorType: 'USER'`
       - `action: 'AUTH_PASSWORD_CHANGED'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `ipAddress: req.ip`
       - `payload: { sessionPreserved: true }`
   - **And** dispatches a security notification alert to the user's registered mobile number (`auth.security_alert`).
   - **And** returns HTTP 200 OK with `AUTH_PASSWORD_CHANGE_SUCCESS` ("تم تغيير كلمة المرور بنجاح وتم إلغاء الجلسات الأخرى النشطة").

5. **Public Forgot Password Wizard UI (`apps/web` at `/auth/forgot-password` per DESIGN.md & EXPERIENCE.md):**
   - **Given** a user navigating to `/auth/forgot-password` (or clicking "نسيت كلمة المرور؟" on the login page)
   - **When** interacting with the recovery wizard:
     - **Step 1 (Mobile Number Entry):**
       - Input field for Saudi mobile number with placeholder `05XXXXXXXX` or `+9665XXXXXXXX`.
       - Client-side validation using `saudiMobileNormalizedSchema`.
       - Submission shows loading indicator and transitions to Step 2 with generic confirmation message regardless of account presence.
     - **Step 2 (OTP Verification):**
       - 6-box segmented numeric input (`OtpInput`, `48px x 48px`, auto-advance, paste support).
       - Shows masked mobile number: `+966 5X XXX 1234`.
       - 60-second countdown timer on resend button ("إعادة إرسال الرمز بعد XX ثانية").
       - Displays remaining attempt countdown or 15-minute lockout alert banner if locked.
     - **Step 3 (New Password Configuration):**
       - Password inputs: "كلمة المرور الجديدة" and "تأكيد كلمة المرور الجديدة" with eye reveal/hide toggle (`Eye` / `EyeOff` icons).
       - Dynamic password requirement checklist:
         - 8 خانات على الأقل
         - يتضمن حرفاً واحداً على الأقل
         - يتضمن رقماً واحداً على الأقل
         - تطابق كلمتي المرور
       - Live checkmark icons turning emerald upon meeting criteria.
       - Error banner if server returns `AUTH_PASSWORD_SAME_AS_CURRENT`.
     - **Success View:**
       - Institutional milestone card with `CheckCircle2` icon.
       - Headline: "تم إعادة تعيين كلمة المرور بنجاح".
       - Description: "تم تأمين حسابك وإلغاء كافة الجلسات النشطة السابقة. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة".
       - Primary CTA button: "تسجيل الدخول" redirecting to `/auth/login`.

6. **Authenticated Password Change Settings UI (`apps/web` at `/app/settings/password` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user accessing security settings
   - **When** visiting `/app/settings/password` (wrapped in `WorkspaceShell`):
     - Displays breadcrumbs: "الإعدادات > كلمة المرور والأمان".
     - Informational security banner: "تنبيه أمني: تغيير كلمة المرور سيؤدي إلى إنهاء كافة الجلسات النشطة على أجهزتك الأخرى باستثناء هذا المتصفح".
     - Form fields:
       - "كلمة المرور الحالية" (with reveal toggle).
       - "كلمة المرور الجديدة" (with reveal toggle and dynamic complexity checklist).
       - "تأكيد كلمة المرور الجديدة" (with match validation).
     - Link to forgot password flow if current password is forgotten ("نسيت كلمة المرور الحالية؟").
     - On submission:
       - Displays inline error if current password is wrong (`AUTH_INVALID_CREDENTIALS`).
       - Displays lockout countdown banner if account locked (`AUTH_ACCOUNT_LOCKED`).
       - Displays warning if new password matches current password (`AUTH_PASSWORD_SAME_AS_CURRENT`).
       - On success: shows emerald confirmation banner and clears inputs.
   - **And** `/app/settings/profile` includes a direct navigation card for "كلمة المرور والأمان" linking to `/app/settings/password`.

7. **Automated Verification & Testing Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Shared schema tests validating `forgotPasswordSchema`, `verifyResetOtpSchema`, `resetPasswordSchema`, `changePasswordSchema`, and password complexity rules.
     - Backend unit tests for `AuthService` verifying:
       - Anti-enumeration behavior and constant-time / identical response.
       - Inactive account protection (deactivated/disabled accounts cannot reset).
       - OTP generation and verification for purpose `'PASSWORD_RESET'`.
       - 3-attempt OTP lockout.
       - Short-lived HMAC reset token generation and validation.
       - Rejection of identical old and new password (`AUTH_PASSWORD_SAME_AS_CURRENT`).
       - Argon2id password hashing.
       - Full session revocation on forgot-password reset (`Session.deleteMany`).
       - Single session preservation on authenticated password change (`token: { not: currentSessionToken }`).
       - Brute-force lockout on repeated wrong current password submissions (5 attempts $\to$ 15 min lock).
       - Immutable `AuditLog` creation for both flows.
     - Backend controller tests for `AuthController` endpoints (`forgot-password`, `reset-password/verify-otp`, `reset-password`, `change-password`).
     - Frontend component tests for `ForgotPasswordForm` and `ChangePasswordForm`.
     - Zero TypeScript errors (`npm run build`), zero lint warnings (`npm run lint`).

## Tasks / Subtasks

- [x] Task 1: Shared Constants, Error Codes, Schemas & Types in `packages/shared` (AC: 1, 2, 3, 4)
  - [x] 1.1 Update `packages/shared/src/constants/auth.ts`:
    - Add error and status codes:
      - `AUTH_RESET_INITIATED = 'AUTH_RESET_INITIATED'`
      - `AUTH_RESET_OTP_VERIFIED = 'AUTH_RESET_OTP_VERIFIED'`
      - `AUTH_PASSWORD_SAME_AS_CURRENT = 'AUTH_PASSWORD_SAME_AS_CURRENT'`
      - `AUTH_RESET_TOKEN_INVALID = 'AUTH_RESET_TOKEN_INVALID'`
      - `AUTH_RESET_TOKEN_EXPIRED = 'AUTH_RESET_TOKEN_EXPIRED'`
      - `AUTH_PASSWORD_RESET_SUCCESS = 'AUTH_PASSWORD_RESET_SUCCESS'`
      - `AUTH_PASSWORD_CHANGE_SUCCESS = 'AUTH_PASSWORD_CHANGE_SUCCESS'`
    - Add configuration constant: `PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 900` (15 minutes).
  - [x] 1.2 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Define `passwordComplexitySchema`: `z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات').regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'كلمة المرور يجب أن تتضمن حرفاً ورقماً على الأقل')`.
    - Define `forgotPasswordSchema`: `z.object({ mobileNumber: saudiMobileNormalizedSchema })`.
    - Define `verifyResetOtpSchema`: `z.object({ mobileNumber: saudiMobileNormalizedSchema, code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام') })`.
    - Define `resetPasswordSchema`: `z.object({ resetToken: z.string().min(1, 'رمز التحدي مطلوب'), newPassword: passwordComplexitySchema })`.
    - Define `changePasswordSchema`: `z.object({ currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'), newPassword: passwordComplexitySchema })`.
  - [x] 1.3 Update `packages/shared/src/types/auth.ts` (or re-export in `packages/shared/src/index.ts`):
    - Export TypeScript types: `ForgotPasswordInput`, `VerifyResetOtpInput`, `ResetPasswordInput`, `ChangePasswordInput`.
  - [x] 1.4 Create unit tests in `packages/shared/src/schemas/__tests__/password.spec.ts`:
    - Test phone normalization in forgot password schema.
    - Test OTP length and format.
    - Test password complexity validation (min length, letters, numbers).
    - Test change password input validation.

- [x] Task 2: Backend Password Recovery Logic in `apps/api/src/modules/auth/auth.service.ts` (AC: 1, 2, 3)
  - [x] 2.1 Add HMAC-SHA256 Token Helpers for Password Reset Challenge:
    - Create `generateResetToken(userId: string, mobileNumber: string): string` with 15-minute expiration (`ClockService.now() + 900s`).
    - Create `verifyResetToken(token: string): { userId: string; mobileNumber: string }` verifying signature and expiration.
  - [x] 2.2 Implement `forgotPassword(dto: ForgotPasswordInput, ip: string, userAgent: string)`:
    - Look up user by normalized `mobileNumber`.
    - Enforce constant-time timing protection: if user is not found, execute simulated dummy work (e.g. dummy hash verification) and return generic response.
    - If user exists:
      - If status is `DEACTIVATED`, `DISABLED`, or `SOFT_DELETED`, do not send OTP; return generic response.
      - If status is `ACTIVE` or `DELETION_PENDING`:
        - Dispatch OTP via `this.otpService.generateAndSendOtp(user.mobileNumber, 'PASSWORD_RESET')`.
    - Return envelope with code `AUTH_RESET_INITIATED`, generic message, and `resendAvailableInSeconds: 60`.
  - [x] 2.3 Implement `verifyResetOtp(dto: VerifyResetOtpInput)`:
    - Verify OTP via `this.otpService.verifyOtp(dto.mobileNumber, 'PASSWORD_RESET', dto.code)`.
    - Find user by `dto.mobileNumber`.
    - Clean up OTP via `this.otpService.cleanupOtp(otpRecord.id)`.
    - Generate signed `resetToken`.
    - Return `{ resetToken, expiresInSeconds: 900 }`.
  - [x] 2.4 Implement `resetPassword(dto: ResetPasswordInput, ip: string, userAgent: string)`:
    - Verify `resetToken` and extract `userId`.
    - Fetch user from Prisma.
    - Check if `newPassword` matches current password: `await argon2.verify(user.passwordHash, dto.newPassword)`. If true, throw `AUTH_PASSWORD_SAME_AS_CURRENT` (HTTP 400).
    - Hash `dto.newPassword` with Argon2id (`type: argon2.argon2id`).
    - Execute atomic transaction:
      - Update `User`: `passwordHash = newHash`, `failedLoginAttempts = 0`, `lockedUntil = null`.
      - Delete all sessions: `this.prisma.session.deleteMany({ where: { userId: user.id } })`.
      - Create immutable `AuditLog`: `action: 'AUTH_PASSWORD_RESET'`, `actorId: user.id`, `actorType: 'USER'`, `entityType: 'User'`, `entityId: user.id`, `ipAddress: ip`, `payload: { source: 'forgot_password_recovery' }`.
    - Log security alert event (`auth.security_alert`).
    - Return success response.

- [x] Task 3: Backend Authenticated Password Change Logic in `apps/api/src/modules/auth/auth.service.ts` (AC: 4)
  - [x] 3.1 Implement `changePassword(userId: string, currentSessionToken: string, dto: ChangePasswordInput, ip: string, userAgent: string)`:
    - Look up user by `userId`.
    - Check lockout state (`user.lockedUntil && this.clockService.now() < user.lockedUntil` $\to$ throw HTTP 423 `AUTH_ACCOUNT_LOCKED`).
    - Verify `currentPassword` with `argon2.verify(user.passwordHash, dto.currentPassword)`.
    - If incorrect:
      - Increment `user.failedLoginAttempts`.
      - If `failedLoginAttempts >= 5`, set `user.lockedUntil = ClockService.now() + 15 minutes` and throw HTTP 423 `AUTH_ACCOUNT_LOCKED`.
      - Otherwise throw HTTP 401 `AUTH_INVALID_CREDENTIALS`.
    - If correct:
      - Reset `failedLoginAttempts = 0`.
    - Check that `newPassword !== currentPassword`: if `await argon2.verify(user.passwordHash, dto.newPassword)` is true, throw HTTP 400 `AUTH_PASSWORD_SAME_AS_CURRENT`.
    - Hash `dto.newPassword` with Argon2id.
    - Execute atomic transaction:
      - Update `User.passwordHash = newHash`.
      - Revoke all other active sessions EXCEPT current session:
        `this.prisma.session.deleteMany({ where: { userId: user.id, token: { not: currentSessionToken } } })`.
      - Create immutable `AuditLog`: `action: 'AUTH_PASSWORD_CHANGED'`, `actorId: user.id`, `actorType: 'USER'`, `entityType: 'User'`, `entityId: user.id`, `ipAddress: ip`, `payload: { sessionPreserved: true }`.
    - Log security alert event (`auth.security_alert`).
    - Return success response.

- [x] Task 4: Backend REST Controller Endpoints in `apps/api/src/modules/auth/auth.controller.ts` (AC: 1, 2, 3, 4)
  - [x] 4.1 Add endpoints to `AuthController`:
    - `POST /auth/forgot-password`: public endpoint with `forgotPasswordSchema`.
    - `POST /auth/reset-password/verify-otp`: public endpoint with `verifyResetOtpSchema`.
    - `POST /auth/reset-password`: public endpoint with `resetPasswordSchema`.
    - `POST /auth/change-password`: protected with `@UseGuards(SessionAuthGuard)`, accepts `changePasswordSchema`, extracts `@CurrentUser() user: SessionUser`, `req.cookies[SESSION_COOKIE_NAME]`, `req.ip`, and `req.headers['user-agent']`.
  - [x] 4.2 Unit tests in `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`:
    - Test forgot password anti-enumeration (registered vs unregistered returns identical payload).
    - Test dummy delay / timing handling.
    - Test deactivated user silent suppression.
    - Test OTP verification and challenge token issuance.
    - Test password reset with session invalidation and audit log.
    - Test password reset rejecting same password.
    - Test change password with wrong current password and 5-attempt lockout.
    - Test change password revoking all other sessions while preserving current session.
  - [x] 4.3 Controller tests in `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`.

- [x] Task 5: Frontend Public Forgot Password Wizard in `apps/web` (AC: 5)
  - [x] 5.1 Create `apps/web/src/components/auth/forgot-password-form.tsx`:
    - 3-step progressive state machine (`step = 1 | 2 | 3 | 'success'`).
    - Step 1: Saudi mobile number input, format validation, clear anti-enumeration helper text.
    - Step 2: 6-digit `OtpInput`, masked phone display (`+966 5X XXX 1234`), 60s countdown timer on resend, lockout alert banner if 3 attempts failed.
    - Step 3: New password and confirm password inputs, eye reveal toggle, dynamic checklist indicator for min 8 chars, letter, number, and match.
    - Success view: Milestone card with confirmation message and CTA button to `/auth/login`.
  - [x] 5.2 Create `apps/web/src/app/auth/forgot-password/page.tsx`:
    - Responsive layout with `LayoutShell`, institutional header, El Masaif brand crest.
  - [x] 5.3 Component tests in `apps/web/src/components/auth/__tests__/forgot-password-form.spec.tsx`.

- [x] Task 6: Frontend Authenticated Password Change Settings in `apps/web` (AC: 6)
  - [x] 6.1 Create `apps/web/src/components/auth/change-password-form.tsx`:
    - Current password input with reveal toggle.
    - New password input with reveal toggle and dynamic requirement checklist.
    - Confirm new password input.
    - Advisory banner on other active session termination.
    - Handling for wrong current password, lockout countdown, and same password errors.
    - Emerald success banner and form reset upon completion.
  - [x] 6.2 Create `apps/web/src/app/app/settings/password/page.tsx`:
    - Dedicated page in RTL Arabic wrapped in `WorkspaceShell`.
    - Breadcrumbs and header explaining password security.
  - [x] 6.3 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Add "كلمة المرور والأمان" navigation card pointing to `/app/settings/password`.
  - [x] 6.4 Component tests in `apps/web/src/components/auth/__tests__/change-password-form.spec.tsx`.

- [x] Task 7: Verification, Test Suites & Quality Gates (AC: 7)
  - [x] 7.1 Execute all shared unit tests: `npm test -w packages/shared`.
  - [x] 7.2 Execute backend unit and integration tests: `npm test -w apps/api`.
  - [x] 7.3 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 7.4 Run lint checks: `npm run lint`.
  - [x] 7.5 Run workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **Anti-Enumeration Protection (FR-46, AD-5):**
  - Public password recovery endpoints must NEVER disclose whether an account exists.
  - Returns identical HTTP status (`200 OK`), message ("إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور"), and constant-time execution timing regardless of mobile number existence.
  - If a user is not found, simulated dummy processing or constant-time sleep ensures response latency cannot be measured to infer account existence.
  - Inactive accounts (`DEACTIVATED`, `DISABLED`, `SOFT_DELETED`) must not be permitted to initiate recovery, but must also return the identical generic success message.
- **Argon2id Password Hashing & Same Password Prohibition (AD-5, FR-46, FR-47):**
  - Passwords are strictly hashed with Argon2id (`argon2.hash(password, { type: argon2.argon2id })`).
  - Both forgot password reset and authenticated password change MUST verify that the new password is NOT identical to the current password using `argon2.verify(user.passwordHash, newPassword)`. If identical, reject with `AUTH_PASSWORD_SAME_AS_CURRENT`.
- **Session Revocation Differential Policy (AD-1, AD-5, FR-46, FR-47):**
  - **Forgot Password Reset:** Complete security reset across all devices. ALL active sessions in the `Session` table belonging to the user are deleted (`prisma.session.deleteMany({ where: { userId: user.id } })`). The user must log in afresh.
  - **Authenticated Password Change:** The user is already verified on their current session. The system revokes all OTHER concurrent sessions while preserving the requesting session (`prisma.session.deleteMany({ where: { userId: user.id, token: { not: currentSessionToken } } })`).
- **Brute-Force & Lockout Defenses (FR-1, FR-46, FR-47):**
  - Forgot Password OTP: 3 consecutive failed OTP entries lock recovery for 15 minutes (`AUTH_OTP_LOCKED`, HTTP 423).
  - Authenticated Password Change: Submitting an incorrect current password increments `failedLoginAttempts`. 5 consecutive failed attempts lock the entire account for 15 minutes (`AUTH_ACCOUNT_LOCKED`, HTTP 423).
- **Cryptographic Challenge Token (`resetToken`):**
  - After OTP is verified in recovery step 2, a short-lived HMAC-SHA256 signed token (`resetToken`) valid for 15 minutes (`900` seconds) is issued to authorize the password update in step 3.
  - Token payload contains `userId`, `mobileNumber`, and expiration timestamp `exp`.
- **Immutable Audit Logging (AD-3, AD-5):**
  - Both operations must insert insert-only records in `AuditLog` within database transactions:
    - `action: 'AUTH_PASSWORD_RESET'` for recovery.
    - `action: 'AUTH_PASSWORD_CHANGED'` for authenticated change.
- **Security Notification Alert (FR-46, FR-47, AD-5):**
  - Both operations dispatch security event alerts (`auth.security_alert`) via SMS / in-app channels.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `packages/shared/src/constants/auth.ts` | UPDATE | Add password recovery error codes (`AUTH_RESET_INITIATED`, `AUTH_PASSWORD_SAME_AS_CURRENT`, etc.) and expiry constants. |
| `packages/shared/src/schemas/auth.schema.ts` | UPDATE | Define `forgotPasswordSchema`, `verifyResetOtpSchema`, `resetPasswordSchema`, `changePasswordSchema`, and password complexity schema. |
| `packages/shared/src/types/auth.ts` | UPDATE | Export TypeScript input and response types for password recovery and change. |
| `packages/shared/src/schemas/__tests__/password.spec.ts` | NEW | Unit tests for password validation schemas, normalization, and complexity rules. |
| `apps/api/src/modules/auth/auth.service.ts` | UPDATE | Implement `forgotPassword`, `verifyResetOtp`, `resetPassword`, `changePassword`, HMAC challenge tokens, anti-enumeration timing protection, and session revocation logic. |
| `apps/api/src/modules/auth/auth.controller.ts` | UPDATE | Expose `POST /auth/forgot-password`, `POST /auth/reset-password/verify-otp`, `POST /auth/reset-password`, and `POST /auth/change-password`. |
| `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` | UPDATE | Unit tests for password recovery, anti-enumeration, session revocation, same-password rejection, and lockout rules. |
| `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts` | UPDATE | Controller tests for password endpoints and guard verification. |
| `apps/web/src/components/auth/forgot-password-form.tsx` | NEW | 3-step password recovery wizard with OTP and password strength checks. |
| `apps/web/src/app/auth/forgot-password/page.tsx` | NEW | Dedicated public forgot password page in `LayoutShell`. |
| `apps/web/src/components/auth/change-password-form.tsx` | NEW | Authenticated password change form with current password verification and session revocation warning. |
| `apps/web/src/app/app/settings/password/page.tsx` | NEW | Authenticated password change page wrapped in `WorkspaceShell`. |
| `apps/web/src/app/app/settings/profile/page.tsx` | UPDATE | Add navigation card for "كلمة المرور والأمان" pointing to `/app/settings/password`. |
| `apps/web/src/components/auth/__tests__/forgot-password-form.spec.tsx` | NEW | Component tests for public recovery wizard. |
| `apps/web/src/components/auth/__tests__/change-password-form.spec.tsx` | NEW | Component tests for authenticated password change form. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE | Mark `1-6-password-recovery-authenticated-password-change: ready-for-dev`. |

### Preserved Behaviors

- **Existing Auth Endpoints:** `register`, `verify-otp`, `login`, `login/step-up`, `me`, and `logout` remain fully functional and guarded.
- **Session Auth Guard & Cookies:** `SessionAuthGuard`, `elmasaif_session` cookie name, 30-day rolling expiration, and HttpOnly/Secure flags remain intact.
- **Brute-Force Lockout Engine:** Existing `failedLoginAttempts` counter and 15-minute `lockedUntil` logic is reused and preserved.
- **Pluggable OTP Engine:** `OtpService` rate limiting, static dev code (`123456`), and production guards are leveraged without disruption.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6:-Password-Recovery-&-Authenticated-Password-Change]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-46:-Forgot-Password-&-Password-Reset-via-Step-Up-OTP]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-47:-Change-Password]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#8.-Security-&-Account-Recovery-Modals]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#8.-User-Security-&-Account-Lifecycle-Flows]
- [Source: _bmad-output/implementation-artifacts/1-1-saudi-mobile-registration-otp-verification-legal-consent-tra.md]
- [Source: _bmad-output/implementation-artifacts/1-2-returning-user-login-session-handling-lockout.md]
- [Source: _bmad-output/implementation-artifacts/1-5-seller-payout-account-management-monospace-iban-card.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Step 1: Resolved target story 1.6 from user input `1-6-password-recovery-authenticated-password-change`.
- Step 2: Analyzed core planning artifacts including Epics (`epics.md` Story 1.6), PRD (`prd.md` FR-46, FR-47), Architecture (`ARCHITECTURE-SPINE.md` AD-1, AD-5), and UX specifications (`DESIGN.md`, `EXPERIENCE.md`).
- Step 3: Examined previous story intelligence from Story 1.1 (registration OTP), Story 1.2 (session handling, lockout, step-up OTP), and Story 1.5 (crypto, audit logs, Monospace card).
- Step 4: Outlined all technical guardrails: anti-enumeration identical response & timing protection, 3-attempt OTP lockout, short-lived signed HMAC reset challenge token, same-password prohibition, Argon2id hashing, complete session revocation on recovery, single-session preservation on authenticated password change, and immutable audit logs.
- Step 5: Drafted master implementation tasks across shared schemas, backend service & controller, frontend public recovery wizard, and settings password change form.

### Completion Notes List

- Completed implementation of Story 1.6: Password Recovery & Authenticated Password Change per FR-46, FR-47, AD-1, AD-5, and UX specifications.
- Implemented shared schemas, types, and constants in `packages/shared`:
  - `passwordComplexitySchema`, `forgotPasswordSchema`, `verifyResetOtpSchema`, `resetPasswordSchema`, `changePasswordSchema`.
  - Domain codes: `AUTH_RESET_INITIATED`, `AUTH_RESET_OTP_VERIFIED`, `AUTH_PASSWORD_SAME_AS_CURRENT`, `AUTH_RESET_TOKEN_INVALID`, `AUTH_RESET_TOKEN_EXPIRED`, `AUTH_PASSWORD_RESET_SUCCESS`, `AUTH_PASSWORD_CHANGE_SUCCESS`, `PASSWORD_RESET_TOKEN_EXPIRY_SECONDS`.
- Implemented backend recovery & change logic in `AuthService` and `AuthController`:
  - Anti-enumeration protection with simulated constant-time execution and identical responses.
  - Inactive account silent suppression (`DEACTIVATED`, `DISABLED`, `SOFT_DELETED`).
  - Short-lived HMAC-SHA256 signed challenge token (`resetToken`) with 15-minute expiration.
  - Prohibition of reusing current password (`AUTH_PASSWORD_SAME_AS_CURRENT`).
  - Argon2id password hashing.
  - Complete session revocation on forgot-password recovery (`Session.deleteMany({ where: { userId } })`).
  - Single-session preservation on authenticated password change (`token: { not: currentSessionToken }`).
  - Brute-force lockout protection (5 failed password change attempts lock account for 15 minutes).
  - Immutable audit logs (`AUTH_PASSWORD_RESET`, `AUTH_PASSWORD_CHANGED`) and security alert event logging.
- Implemented frontend recovery wizard and settings UI in `apps/web`:
  - `ForgotPasswordForm`: 3-step progressive state machine (mobile input, 6-digit `OtpInput`, new password with dynamic checklist, institutional success milestone card).
  - `/auth/forgot-password/page.tsx`: public recovery page in `LayoutShell`.
  - `ChangePasswordForm`: authenticated password update form with advisory banner, reveal toggles, and live criteria validation.
  - `/app/settings/password/page.tsx`: dedicated security settings page.
  - `/app/settings/profile/page.tsx`: navigation card linking to password settings.
- Auth State Sync & Client Redirection Fix:
  - Fixed client-side auth state desynchronization between `LoginForm` / `RegisterForm` and `AppWorkspaceLayout`:
    - Added `setSessionUser` to `AuthProvider` (`AuthContextType`) for immediate synchronous state transition upon login / step-up verification.
    - Updated `LoginForm` to extract query parameter `redirect` (defaulting to `/app/buyer` or specified route) and automatically redirect already-authenticated users.
    - Updated `LoginForm` and `RegisterForm` to update `setSessionUser` and await `refreshSession()` before client routing.
    - Added `<React.Suspense>` boundary in `apps/web/src/app/auth/login/page.tsx`.
    - Added `apps/web/src/app/not-found.tsx` for Next.js 15 static generation resilience.
- Verification & Quality Gates:
  - 100% test pass rate across `packages/shared` (120 tests), `apps/api` (234 tests), and `apps/web` (67 tests).
  - Zero TypeScript compiler errors across all monorepo workspaces.
  - Zero lint warnings or errors via `npm run lint`.
  - Full production build passing with all 15 static Next.js pages generated.

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/schemas/__tests__/password.spec.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`
- `apps/web/src/components/auth/forgot-password-form.tsx`
- `apps/web/src/app/auth/forgot-password/page.tsx`
- `apps/web/src/components/auth/change-password-form.tsx`
- `apps/web/src/app/app/settings/password/page.tsx`
- `apps/web/src/app/app/settings/profile/page.tsx`
- `apps/web/src/components/auth/__tests__/forgot-password-form.spec.tsx`
- `apps/web/src/components/auth/__tests__/change-password-form.spec.tsx`
- `apps/web/src/components/providers/auth-provider.tsx`
- `apps/web/src/components/auth/login-form.tsx`
- `apps/web/src/components/auth/register-form.tsx`
- `apps/web/src/app/auth/login/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `_bmad-output/implementation-artifacts/1-6-password-recovery-authenticated-password-change.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

