---
baseline_commit: 8fc92cb3ca5fe6c26ed4c86a8e46264524f9b3ad
---

# Story 1.8: Profile Editing & Mandatory Email Verification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to edit my display name and email address with email confirmation,
So that my contact details remain accurate and verified for transactional notices.

## Acceptance Criteria

1. **Profile Editing Initiation & Name Update (`packages/shared` & `apps/api` per FR-49, UJ-1):**
   - **Given** an authenticated user submitting profile updates via `PATCH /api/v1/users/profile`
   - **When** the client submits `fullName` (display name):
     - The endpoint validates `fullName`: string between 3 and 100 characters (`z.string().trim().min(3).max(100)`), rejecting empty or invalid lengths with HTTP 400 Bad Request.
   - **Then** the endpoint strictly enforces that non-identifier fields only may be modified:
     - Primary mobile number (`mobileNumber`), system username (`username`), and national identifier (`nationalId`) cannot be altered via this endpoint. If provided, they are ignored or rejected.
   - **And** if `fullName` differs from the user's current `fullName`:
     - Updates `User.fullName` in PostgreSQL via Prisma.
     - Evaluates Marketer commercial registration name alignment (see AC 5).
     - Inserts an immutable `AuditLog` entry:
       - `actorId: user.id`
       - `actorType: 'USER'`
       - `action: 'USER_PROFILE_UPDATED'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `ipAddress: req.ip`
       - `payload: { field: 'fullName', oldValue: previousFullName, newValue: updatedFullName }`
   - **And** returns HTTP 200 OK with the updated profile summary.

2. **Mandatory Pending Email State & Verification Token Dispatch (`apps/api` per FR-49, UJ-1, AR-3):**
   - **Given** an authenticated user updating their contact email via `PATCH /api/v1/users/profile`
   - **When** the client submits a new `email`:
     - Validates format using standard email schema (`z.string().trim().toLowerCase().email('صيغة البريد الإلكتروني غير صالحة')`).
   - **Then** the endpoint verifies that `email` is not identical to the user's current active verified email:
     - If identical, rejects with HTTP 400 Bad Request and error code `AUTH_EMAIL_SAME_AS_CURRENT` ("البريد الإلكتروني المدخل مطابق للبريد الحالي المسجل").
   - **And** checks that `email` is not already verified or assigned to another active account in `User` (`where: { email: normalizedEmail }`):
     - If taken, rejects with HTTP 409 Conflict and error code `AUTH_EMAIL_IN_USE` ("البريد الإلكتروني المدخل مستخدم بالفعل في حساب آخر").
   - **And** retains the account's existing active `email` without disruption:
     - All transactional notices (e.g. deals, contracts, OTP receipts) continue to use the previous verified email until the new email is verified.
   - **And** stores the new email in pending state:
     - Updates `User.pendingEmail = normalizedEmail`.
   - **And** generates a secure, tamper-proof email verification token:
     - Token format: HMAC-SHA256 signed payload containing `{ userId, pendingEmail: normalizedEmail, exp: ClockService.now() + 86400 }` (24-hour expiration) encoded in base64url.
     - Expiration constant: `EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS = 86400` (24 hours).
   - **And** dispatches an email containing the verification link (`/auth/verify-email?token=<token>`):
     - In production: dispatched via platform notification/email transport.
     - In development: logged to console/logger (`[auth.email_verification] Verification link: ...`).
   - **And** inserts an immutable `AuditLog` entry:
     - `actorId: user.id`
     - `actorType: 'USER'`
     - `action: 'USER_EMAIL_CHANGE_REQUESTED'`
     - `entityType: 'User'`
     - `entityId: user.id`
     - `ipAddress: req.ip`
     - `payload: { currentEmail: user.email, pendingEmail: normalizedEmail, expiresInSeconds: 86400 }`
   - **And** returns HTTP 200 OK with:
     ```json
     {
       "code": "AUTH_EMAIL_VERIFICATION_INITIATED",
       "message": "تم حفظ الاسم وإرسال رابط تأكيد إلى بريدك الإلكتروني الجديد. يرجى تفعيله خلال 24 ساعة",
       "data": {
         "id": "...",
         "fullName": "...",
         "email": "old@example.com",
         "pendingEmail": "new@example.com",
         "isEmailPending": true,
         "emailVerifiedAt": "..."
       }
     }
     ```

3. **Email Verification Confirmation & Atomic Email Re-binding (`apps/api` per FR-49, UJ-1, AR-3):**
   - **Given** a verification token from an email verification link
   - **When** the client submits verification via `POST /api/v1/users/email/verify` with `{ token: string }`:
   - **Then** the server verifies token integrity and expiration using `ClockService.now()`:
     - If signature is tampered or malformed, rejects with HTTP 400 Bad Request and error code `AUTH_EMAIL_VERIFICATION_INVALID` ("رابط التحقق من البريد الإلكتروني غير صالح").
     - If `ClockService.now() > token.exp`, rejects with HTTP 400 Bad Request and error code `AUTH_EMAIL_VERIFICATION_EXPIRED` ("انتهت صلاحية رابط التحقق من البريد الإلكتروني (24 ساعة). يرجى طلب رابط جديد").
   - **And** validates that target `User` exists and has `pendingEmail === token.pendingEmail`:
     - If `user.pendingEmail` is null or does not match `token.pendingEmail`, rejects with HTTP 400 Bad Request and error code `AUTH_EMAIL_VERIFICATION_STALE` ("طلب التحقق من البريد الإلكتروني غير متطابق أو تم إلغاؤه مسبقاً").
   - **And** verifies that `token.pendingEmail` is still not occupied by another registered user:
     - If taken in the interim, rejects with HTTP 409 Conflict: `AUTH_EMAIL_IN_USE`.
   - **And** executes atomic re-binding inside a Prisma transaction (`prisma.$transaction`):
     1. Updates `User`:
        - `email: user.pendingEmail`
        - `pendingEmail: null`
        - `emailVerifiedAt: ClockService.now()`
     2. Inserts an immutable `AuditLog` entry:
        - `actorId: user.id`
        - `actorType: 'USER'`
        - `action: 'USER_EMAIL_VERIFIED'`
        - `entityType: 'User'`
        - `entityId: user.id`
        - `ipAddress: req.ip`
        - `payload: { oldEmail: user.email, newEmail: user.pendingEmail, verifiedAt: ClockService.now() }`
   - **And** returns HTTP 200 OK with:
     ```json
     {
       "code": "AUTH_EMAIL_VERIFIED_SUCCESS",
       "message": "تم تأكيد البريد الإلكتروني بنجاح وتحديث بيانات الحساب",
       "data": {
         "email": "new@example.com",
         "emailVerifiedAt": "2026-11-01T..."
       }
     }
     ```

4. **Resend Email Verification Link & Cancel Pending Request (`apps/api` per FR-49):**
   - **Given** an authenticated user with an active `pendingEmail`
   - **When** the client requests a fresh verification link via `POST /api/v1/users/email/resend`:
     - Checks if `user.pendingEmail` exists:
       - If null, rejects with HTTP 400 Bad Request and error code `AUTH_NO_PENDING_EMAIL` ("لا يوجد بريد إلكتروني معلق بانتظار التحقق").
     - Enforces a 60-second resend cooldown throttle (`EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60`):
       - If requested within 60 seconds of the previous dispatch, rejects with HTTP 429 Too Many Requests and error code `AUTH_OTP_THROTTLED`.
     - Dispatches a fresh signed token and returns HTTP 200 OK with `AUTH_EMAIL_VERIFICATION_RESENT` and `resendAvailableInSeconds: 60`.
   - **When** the client cancels the pending update via `DELETE /api/v1/users/email/pending`:
     - Checks if `user.pendingEmail` exists:
       - If null, rejects with HTTP 400 Bad Request `AUTH_NO_PENDING_EMAIL`.
     - Clears `User.pendingEmail = null`.
     - Inserts an immutable `AuditLog` entry (`action: 'USER_EMAIL_CHANGE_CANCELLED'`, `payload: { cancelledPendingEmail }`).
     - Returns HTTP 200 OK with `AUTH_EMAIL_PENDING_CANCELLED` ("تم إلغاء طلب تحديث البريد الإلكتروني المعلق بنجاح").

5. **Licensed Marketer Commercial Name Mismatch Warning Guard (`apps/api` per FR-5, FR-49):**
   - **Given** an authenticated user updating their `fullName` in profile settings
   - **When** the user holds an active or review-stage `MARKETER` role profile with an associated `FalLicense`:
   - **Then** the system checks if the new `fullName` diverges from the licensee's commercial registration name (`falLicense.commercialName`):
     ```typescript
     const isMarketer = user.profiles.some(p => p.role === UserRole.MARKETER && p.falLicense);
     const commercialName = user.profiles.find(p => p.role === UserRole.MARKETER)?.falLicense?.commercialName;
     const hasMismatch = isMarketer && commercialName && (newFullName.trim().toLowerCase() !== commercialName.trim().toLowerCase());
     ```
   - **And** if a mismatch is detected:
     - The profile update is NOT blocked, but:
     - Flags `hasCommercialNameMismatch: true` in the response envelope.
     - Attaches warning code `COMMERCIAL_NAME_MISMATCH` and descriptive message: "تنبيه: الاسم المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال. تم تسجيل إشعار رقابي للمطابقة الإدارية".
     - Inserts an immutable `AuditLog` entry:
       - `actorId: user.id`
       - `actorType: 'USER'`
       - `action: 'PROFILE_NAME_MISMATCH_WARNING'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `payload: { newFullName, commercialName, falLicenseNumber: falLicense.licenseNumber }`

6. **User Profile Settings UI (`apps/web` at `/app/settings/profile` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user navigating to `/app/settings/profile`
   - **When** rendering the profile management page wrapped in `WorkspaceShell`:
     - Displays breadcrumbs: "لوحة التحكم > إعدادات الحساب > البيانات الشخصية".
     - Header: Title "إعدادات الحساب" and subtitle "إدارة الاسم والبريد الإلكتروني والبيانات المعتمدة".
     - **Profile Editing Form Card:**
       - Full Name (`fullName`): editable text input with real-time character counter (3-100 chars).
       - Email Address (`email`): editable input field. Displays verified badge (`CheckCircle2`, emerald) if `emailVerifiedAt` is present.
       - System Username (`username`): read-only input with institutional lock badge.
       - Mobile Number (`mobileNumber`): read-only masked phone (`+966 5X XXX 1234`) with "تحديث رقم الجوال" link pointing to `/app/settings/mobile`.
       - National ID (`nationalId`): read-only masked national identifier with link to `/app/settings/identity`.
       - Primary submit button: "حفظ التغييرات" with active/disabled state and loading spinner.
     - **Pending Email Verification Alert Banner:**
       - Rendered prominently in amber when `user.pendingEmail` is present:
         - Alert headline: "البريد الإلكتروني الجديد قيد التحقق".
         - Explanation: "تم إرسال رابط تأكيد إلى ({user.pendingEmail}). الحساب مستمر في استخدام بريدك الحالي ({user.email || 'غير محدد'}) حتى يتم فتح الرابط وتأكيده".
         - Secondary action: "إعادة إرسال الرابط" button with 60-second countdown cooldown timer.
         - Cancel action: "إلغاء التحديث" button to abort pending change.
     - **Marketer Commercial Name Mismatch Warning Banner:**
       - If `hasCommercialNameMismatch` is active, displays an amber callout:
         - "تنبيه نظامي: اسمك المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال ({commercialName}). تم إشعار فريق الرقابة الإدارية".
     - **Settings Sub-navigation Cards (Preserved):**
       - "رقم الجوال المعتمد" -> `/app/settings/mobile`
       - "كلمة المرور والأمان" -> `/app/settings/password`
       - "التحقق من الهوية" -> `/app/settings/identity`
       - "حسابات التحويل البنكي (IBAN)" -> `/app/settings/payout`

7. **Email Verification Landing Page UI (`apps/web` at `/auth/verify-email` per DESIGN.md & EXPERIENCE.md):**
   - **Given** any user (authenticated or unauthenticated) clicking an email verification link
   - **When** navigating to `/auth/verify-email?token=<token>`:
     - Automatically submits token to `POST /api/v1/users/email/verify`.
     - **Loading State:** Centered card with institutional spinner: "جاري التحقق من صلاحية رابط البريد الإلكتروني...".
     - **Success State:**
       - Institutional milestone card with `CheckCircle2` icon (emerald-500).
       - Headline: "تم تأكيد البريد الإلكتروني بنجاح".
       - Message: "أصبح بريدك الإلكتروني الجديد معتمداً ورسمياً لاستلام إشعارات الصفقات والوثائق التعاقدية".
       - Primary button: "الذهاب إلى إعدادات الحساب" (`/app/settings/profile`) or "تسجيل الدخول" if session not present.
     - **Error State:**
       - Card with `AlertCircle` icon (rose-500).
       - Headline: "تعذر التحقق من البريد الإلكتروني".
       - Specific error messages:
         - Expired token: "انتهت صلاحية رابط التحقق (24 ساعة). يرجى تسجيل الدخول وطلب رابط جديد من إعدادات الحساب".
         - Stale/cancelled token: "تم إلغاء هذا الطلب أو تم تحديث البريد الإلكتروني بطلب أحدث".
         - In-use email: "البريد الإلكتروني مستخدم بالفعل في حساب آخر".
       - Action buttons: "العودة إلى إعدادات الحساب" or "تسجيل الدخول".

8. **Automated Verification & Testing Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Shared schema tests validating `updateUserProfileSchema`, `verifyEmailSchema`, email regex, and error codes.
     - Backend unit tests for `ProfileService` (or `UsersService`) verifying:
       - Full name updates with length constraints and audit logging.
       - New email submission setting `pendingEmail` without altering active `email`.
       - Rejection when new email is identical to current email (`AUTH_EMAIL_SAME_AS_CURRENT`).
       - Rejection when new email is already registered (`AUTH_EMAIL_IN_USE`).
       - Marketer commercial name mismatch detection and audit log (`PROFILE_NAME_MISMATCH_WARNING`).
       - Token signature verification, 24-hour expiration enforcement, and stale request detection.
       - Atomic email re-binding in Prisma transaction.
       - Resend cooldown throttle (60s) and cancellation of pending email.
     - Backend controller tests for `ProfileController` endpoints.
     - Frontend component tests for Profile Editor (`ProfileEditor`) and Email Verification Page (`VerifyEmailPage`).
     - Zero TypeScript errors (`npm run build`), zero lint warnings (`npm run lint`).

## Tasks / Subtasks

- [x] Task 1: Shared Constants, Error Codes, Schemas & Types in `packages/shared` (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Update `packages/shared/src/constants/auth.ts`:
    - Add domain error and status codes:
      - `AUTH_EMAIL_IN_USE = 'AUTH_EMAIL_IN_USE'`
      - `AUTH_EMAIL_SAME_AS_CURRENT = 'AUTH_EMAIL_SAME_AS_CURRENT'`
      - `AUTH_EMAIL_VERIFICATION_INITIATED = 'AUTH_EMAIL_VERIFICATION_INITIATED'`
      - `AUTH_EMAIL_VERIFICATION_EXPIRED = 'AUTH_EMAIL_VERIFICATION_EXPIRED'`
      - `AUTH_EMAIL_VERIFICATION_INVALID = 'AUTH_EMAIL_VERIFICATION_INVALID'`
      - `AUTH_EMAIL_VERIFICATION_STALE = 'AUTH_EMAIL_VERIFICATION_STALE'`
      - `AUTH_EMAIL_VERIFIED_SUCCESS = 'AUTH_EMAIL_VERIFIED_SUCCESS'`
      - `AUTH_EMAIL_VERIFICATION_RESENT = 'AUTH_EMAIL_VERIFICATION_RESENT'`
      - `AUTH_EMAIL_PENDING_CANCELLED = 'AUTH_EMAIL_PENDING_CANCELLED'`
      - `AUTH_NO_PENDING_EMAIL = 'AUTH_NO_PENDING_EMAIL'`
      - `COMMERCIAL_NAME_MISMATCH = 'COMMERCIAL_NAME_MISMATCH'`
    - Add configuration constants:
      - `EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS = 86400` (24 hours)
      - `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60` (60 seconds)
  - [x] 1.2 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Define `updateUserProfileSchema`: `z.object({ fullName: z.string().trim().min(3, 'الاسم يجب ألا يقل عن 3 أحرف').max(100, 'الاسم يجب ألا يزيد عن 100 حرف').optional(), email: z.string().trim().toLowerCase().email('صيغة البريد الإلكتروني غير صالحة').optional() }).refine(data => data.fullName !== undefined || data.email !== undefined, { message: 'يجب تقديم حقل واحد على الأقل للتحديث' })`.
    - Define `verifyEmailSchema`: `z.object({ token: z.string().trim().min(1, 'رمز التحقق مطلوب') })`.
    - Define `resendEmailVerificationSchema`: `z.object({}).optional()`.
    - Update `sessionUserSchema`: include `email: z.string().nullable().optional()`, `pendingEmail: z.string().nullable().optional()`, `emailVerifiedAt: z.union([z.date(), z.string()]).nullable().optional()`.
  - [x] 1.3 Update `packages/shared/src/types/auth.ts` and re-export in `packages/shared/src/index.ts`:
    - Export TypeScript types: `UpdateUserProfileInput`, `VerifyEmailInput`, `ResendEmailVerificationInput`.
    - Export response interfaces: `UpdateUserProfileResponse`, `VerifyEmailResponse`, `ResendEmailVerificationResponse`.
  - [x] 1.4 Create unit tests in `packages/shared/src/schemas/__tests__/profile.spec.ts`:
    - Test validation of `fullName` minimum and maximum length.
    - Test email format validation and normalization.
    - Test verification token schema.

- [x] Task 2: Backend Profile & Email Verification Service in `apps/api/src/modules/users/profile.service.ts` (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Implement token generation and verification helpers:
    - `generateEmailVerificationToken(userId: string, pendingEmail: string): string`: HMAC-SHA256 signature with 24-hour expiration (`ClockService.now() + 86400s`), base64url encoded.
    - `verifyEmailVerificationToken(token: string): { userId: string; pendingEmail: string; exp: number }`: signature verification and expiration check using `ClockService.now()`.
  - [x] 2.2 Implement `updateProfile(userId: string, dto: UpdateUserProfileInput, ip: string, userAgent: string)`:
    - Look up user by `userId` including `profiles` and attached `falLicense`.
    - If `dto.fullName` provided:
      - Check marketer commercial name mismatch (`normalizedFullName !== commercialName`).
      - Flag `hasCommercialNameMismatch = true` and log `PROFILE_NAME_MISMATCH_WARNING` if mismatched.
      - Update `User.fullName = dto.fullName`.
      - Log `USER_PROFILE_UPDATED` in `AuditLog`.
    - If `dto.email` provided:
      - Check `dto.email !== user.email` (throw `AUTH_EMAIL_SAME_AS_CURRENT`).
      - Check `prisma.user.findFirst({ where: { email: dto.email, id: { not: userId } } })` (throw `AUTH_EMAIL_IN_USE`).
      - Set `User.pendingEmail = dto.email`.
      - Generate verification token and dispatch email verification.
      - Log `USER_EMAIL_CHANGE_REQUESTED` in `AuditLog`.
    - Return updated profile with warning indicators if applicable.
  - [x] 2.3 Implement `verifyEmail(dto: VerifyEmailInput, ip: string)`:
    - Decode and verify token signature and expiration.
    - Find target user by `userId`.
    - Verify `user.pendingEmail === token.pendingEmail` (throw `AUTH_EMAIL_VERIFICATION_STALE` if not).
    - Re-verify uniqueness of `token.pendingEmail`.
    - In `prisma.$transaction`:
      - Update `User`: `email = user.pendingEmail`, `pendingEmail = null`, `emailVerifiedAt = ClockService.now()`.
      - Insert `AuditLog`: `action: 'USER_EMAIL_VERIFIED'`, `payload: { oldEmail, newEmail, verifiedAt }`.
    - Return success response.
  - [x] 2.4 Implement `resendVerificationEmail(userId: string, ip: string)`:
    - Look up user; verify `pendingEmail` is present (throw `AUTH_NO_PENDING_EMAIL` if null).
    - Check 60-second cooldown throttle.
    - Generate fresh token, dispatch email, and return `resendAvailableInSeconds: 60`.
  - [x] 2.5 Implement `cancelPendingEmail(userId: string, ip: string)`:
    - Look up user; verify `pendingEmail` is present.
    - Update `User.pendingEmail = null`.
    - Insert `AuditLog`: `action: 'USER_EMAIL_CHANGE_CANCELLED'`.
    - Return cancellation confirmation.

- [x] Task 3: Backend REST Controller Endpoints in `apps/api/src/modules/users/profile.controller.ts` (AC: 1, 2, 3, 4)
  - [x] 3.1 Create `apps/api/src/modules/users/profile.controller.ts`:
    - `PATCH /users/profile`: Guarded by `SessionAuthGuard`, validates `updateUserProfileSchema`, invokes `profileService.updateProfile`.
    - `GET /users/profile`: Guarded by `SessionAuthGuard`, returns current user profile with pending email status.
    - `POST /users/email/verify`: Public endpoint (no auth guard, accessible directly from email link), validates `verifyEmailSchema`, invokes `profileService.verifyEmail`.
    - `POST /users/email/resend`: Guarded by `SessionAuthGuard`, invokes `profileService.resendVerificationEmail`.
    - `DELETE /users/email/pending`: Guarded by `SessionAuthGuard`, invokes `profileService.cancelPendingEmail`.
  - [x] 3.2 Register `ProfileService` and `ProfileController` in `apps/api/src/modules/users/users.module.ts`.
  - [x] 3.3 Create unit tests in `apps/api/src/modules/users/__tests__/profile.service.spec.ts`:
    - Test full name update, length validation, and audit log creation.
    - Test pending email setting without altering active email.
    - Test commercial name mismatch warning for Marketers.
    - Test token generation, 24-hour expiration, and atomic verification.
    - Test resend cooldown throttle and cancellation of pending email.
  - [x] 3.4 Create controller tests in `apps/api/src/modules/users/__tests__/profile.controller.spec.ts`.

- [x] Task 4: Frontend Profile Editor & Pending Email Banner in `apps/web` (AC: 6)
  - [x] 4.1 Create `apps/web/src/components/auth/profile-editor.tsx`:
    - Full Name input with real-time character length feedback (3-100 chars).
    - Contact Email input with verified status badge.
    - Read-only institutional fields: Username, Mobile Number (with "تحديث" link), National ID.
    - Prominent Amber Banner for `pendingEmail`:
      - Shows proposed email, explanation that old email is still active.
      - "إعادة إرسال الرابط" button with 60s cooldown timer.
      - "إلغاء التحديث" button calling `DELETE /api/v1/users/email/pending`.
    - Marketer Commercial Name Mismatch Warning Banner:
      - Appears if `hasCommercialNameMismatch` is returned.
    - Submit button with loading spinner and disabled state when untouched.
  - [x] 4.2 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Integrate `ProfileEditor` component at the top of the settings page.
    - Preserve existing sub-navigation cards (Mobile, Password, Identity, Payout Accounts) cleanly beneath the editor.
  - [x] 4.3 Component tests in `apps/web/src/components/auth/__tests__/profile-editor.spec.tsx`:
    - Test editing full name and email.
    - Test pending email banner rendering and resend cooldown timer.
    - Test commercial name mismatch alert rendering.

- [x] Task 5: Frontend Email Verification Landing Page in `apps/web` (AC: 7)
  - [x] 5.1 Create `apps/web/src/app/auth/verify-email/page.tsx`:
    - Reads `token` from URL query parameter using `useSearchParams()`.
    - Automatically triggers `POST /api/v1/users/email/verify`.
    - Handles 3 states:
      - `loading`: institutional skeleton/spinner.
      - `success`: milestone card with `CheckCircle2`, emerald badge, and navigation to `/app/settings/profile`.
      - `error`: alert card with `AlertCircle`, clear Arabic error message, and action button to retry or return to settings.
  - [x] 5.2 Component tests in `apps/web/src/components/auth/__tests__/verify-email.spec.tsx`.

- [x] Task 6: Verification, Test Suites & Quality Gates (AC: 8)
  - [x] 6.1 Execute shared package unit tests: `npm test -w packages/shared`.
  - [x] 6.2 Execute backend unit and integration tests: `npm test -w apps/api`.
  - [x] 6.3 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 6.4 Run lint checks across all workspaces: `npm run lint`.
  - [x] 6.5 Run production workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **Mandatory Pending Email State (FR-49, UJ-1, AR-3):**
  - Unlike simple profile updates, email addresses cannot be altered directly in-place.
  - When an authenticated user requests an email change, the new address is stored in `User.pendingEmail`, while the existing verified `User.email` continues to be used for all transactional notifications, deal contracts, and legal alerts.
  - Only when the user opens the email verification link and validates the token is `User.email` updated to `pendingEmail`, `pendingEmail` set to `null`, and `emailVerifiedAt` set to the current timestamp via `ClockService.now()`.
- **Email Verification Token Security:**
  - Token uses HMAC-SHA256 signature with the platform secret (`SESSION_SECRET` or dedicated key), encoding `{ userId, pendingEmail, exp }`.
  - Expiration is set to 24 hours (`86400` seconds).
  - Public verification endpoint `POST /api/v1/users/email/verify` does not require an active session cookie, allowing users to verify directly from any email client or device without being forced to log in on that specific browser first.
  - Stale verification prevention: If the user changes their pending email again before verifying, or cancels it, the older token is rejected (`AUTH_EMAIL_VERIFICATION_STALE`).
- **Marketer Commercial Name Mismatch Warning Guard (FR-5, FR-49):**
  - Saudi Fal licensing regulations require that licensed marketers operate under names conforming to their commercial registration or Fal license certificates.
  - When a user holding a `MARKETER` role profile updates their `fullName`, the system queries their `FalLicense.commercialName`.
  - If `fullName` diverges from `commercialName`, the system does NOT block the update, but returns a warning code `COMMERCIAL_NAME_MISMATCH` and writes an immutable audit log entry `PROFILE_NAME_MISMATCH_WARNING` for administrative compliance monitoring.
- **Audit Logging Standards (AD-3, AD-6):**
  - All profile attribute updates write an immutable record to `AuditLog`:
    - `action: 'USER_PROFILE_UPDATED'` recording previous and new values.
    - `action: 'USER_EMAIL_CHANGE_REQUESTED'` recording `currentEmail` and `pendingEmail`.
    - `action: 'USER_EMAIL_VERIFIED'` recording verified email and timestamp.
    - `action: 'USER_EMAIL_CHANGE_CANCELLED'` recording cancelled pending email.
    - `action: 'PROFILE_NAME_MISMATCH_WARNING'` recording licensee name discrepancy.

### Project Structure Notes

- **Database Model Alignment:**
  - `User` in `apps/api/prisma/schema.prisma` already includes `pendingEmail String?` and `emailVerifiedAt DateTime?`.
  - Note: Ensure `email String? @unique` exists on `User` to store the active verified email.
- **REST Endpoints Mapping:**
  - `PATCH /api/v1/users/profile` -> Update full name and/or initiate email change.
  - `GET /api/v1/users/profile` -> Fetch user profile details including verification state.
  - `POST /api/v1/users/email/verify` -> Public endpoint to verify email with token.
  - `POST /api/v1/users/email/resend` -> Resend verification link with 60s cooldown throttle.
  - `DELETE /api/v1/users/email/pending` -> Cancel pending email update.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `packages/shared/src/constants/auth.ts` | UPDATE | Add email verification and profile domain error/status codes (`AUTH_EMAIL_IN_USE`, `AUTH_EMAIL_SAME_AS_CURRENT`, `AUTH_EMAIL_VERIFICATION_INITIATED`, `AUTH_EMAIL_VERIFIED_SUCCESS`, `COMMERCIAL_NAME_MISMATCH`, etc.) and expiry constants. |
| `packages/shared/src/schemas/auth.schema.ts` | UPDATE | Define `updateUserProfileSchema`, `verifyEmailSchema`, and update `sessionUserSchema`. |
| `packages/shared/src/types/auth.ts` | UPDATE | Export TypeScript input and response interfaces for profile editing and email verification. |
| `packages/shared/src/schemas/__tests__/profile.spec.ts` | NEW | Unit tests for profile update schemas, email validation, and token schemas. |
| `apps/api/prisma/schema.prisma` | UPDATE | Ensure `email String? @unique` is declared on `model User`. |
| `apps/api/src/modules/users/profile.service.ts` | NEW | Implement profile updating, email change request, token generation/verification, commercial name mismatch check, resend cooldown, and atomic verification. |
| `apps/api/src/modules/users/profile.controller.ts` | NEW | Expose endpoints: `PATCH /users/profile`, `GET /users/profile`, `POST /users/email/verify`, `POST /users/email/resend`, `DELETE /users/email/pending`. |
| `apps/api/src/modules/users/users.module.ts` | UPDATE | Register `ProfileService` and `ProfileController`. |
| `apps/api/src/modules/users/__tests__/profile.service.spec.ts` | NEW | Unit tests for profile service covering full name updates, email transitions, commercial name mismatch, and token expiration. |
| `apps/api/src/modules/users/__tests__/profile.controller.spec.ts` | NEW | Controller tests for profile editing and email verification endpoints. |
| `apps/web/src/components/auth/profile-editor.tsx` | NEW | Interactive profile editing component with name counter, pending email banner, 60s resend cooldown, and mismatch callout. |
| `apps/web/src/app/app/settings/profile/page.tsx` | UPDATE | Embed `ProfileEditor` while preserving existing navigation cards for Mobile, Password, Identity, and Payout Accounts. |
| `apps/web/src/app/auth/verify-email/page.tsx` | NEW | Email verification landing page handling loading, success milestone card, and error states. |
| `apps/web/src/components/auth/__tests__/profile-editor.spec.tsx` | NEW | Component tests for profile editor interactions, pending email banner, and resend button. |
| `apps/web/src/components/auth/__tests__/verify-email.spec.tsx` | NEW | Component tests for email verification landing page state transitions. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE | Mark `1-8-profile-editing-mandatory-email-verification: ready-for-dev`. |

### Preserved Behaviors

- **Existing Auth & Identity Endpoints:** `users/profiles`, `users/identity`, `users/payout`, `users/phone-change`, and `auth/*` remain completely intact.
- **Session Auth Guards:** `SessionAuthGuard` continues to guard authenticated profile settings, while `POST /users/email/verify` is made accessible for external email link clicks.
- **Transactional Communication Continuity:** The account continues to use its current verified email for all transactional notifications until the new pending email is verified.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.8:-Profile-Editing-&-Mandatory-Email-Verification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-49:-User-Profile-Editing]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-5:-Seller-Payout-Account-Management]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#1.-User,-Account-&-Legal-Consent-(ConsentRecord)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#8.-Security-&-Account-Recovery-Modals]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#8.-User-Security-&-Account-Lifecycle-Flows]
- [Source: _bmad-output/implementation-artifacts/1-5-seller-payout-account-management-monospace-iban-card.md]
- [Source: _bmad-output/implementation-artifacts/1-7-secure-mobile-number-update-with-dual-otp.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Analyzed core planning artifacts: `epics.md` Story 1.8, `prd.md` FR-49 and FR-5, `ARCHITECTURE-SPINE.md` user account specifications, `DESIGN.md`, and `EXPERIENCE.md`.
- Evaluated existing codebase patterns: `users.controller.ts`, `payout.service.ts` commercial name mismatch logic, `phone-change.service.ts` audit logging & ClockService integration, and `apps/web/src/app/app/settings/profile/page.tsx`.
- Formulated comprehensive acceptance criteria covering: full name updates with character length constraints, pending email isolation, HMAC-SHA256 signed verification tokens with 24-hour expiration, commercial name mismatch warning for Fal licensed marketers, 60s cooldown resend throttling, atomic verification transactions, and RTL UI components.
- Established rigorous quality gates and checklist compliance to prevent developer mistakes.

### Completion Notes List

- Story file created with complete implementation requirements and guardrails.
- Status set to `ready-for-dev`.

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/schemas/__tests__/profile.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/users/profile.service.ts`
- `apps/api/src/modules/users/profile.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/__tests__/profile.service.spec.ts`
- `apps/api/src/modules/users/__tests__/profile.controller.spec.ts`
- `apps/web/src/components/auth/profile-editor.tsx`
- `apps/web/src/app/app/settings/profile/page.tsx`
- `apps/web/src/app/auth/verify-email/page.tsx`
- `apps/web/src/components/auth/__tests__/profile-editor.spec.tsx`
- `apps/web/src/components/auth/__tests__/verify-email.spec.tsx`
- `_bmad-output/implementation-artifacts/1-8-profile-editing-mandatory-email-verification.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

