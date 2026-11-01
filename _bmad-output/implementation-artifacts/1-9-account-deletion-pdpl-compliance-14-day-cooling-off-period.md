---
baseline_commit: 58ce7b491906aa4a53d8544261d751b6b1c31764
---

# Story 1.9: Account Deletion, PDPL Compliance & 14-Day Cooling-Off Period

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to request account deletion in compliance with Saudi Personal Data Protection Law (PDPL) regulations,
So that my personal data can be deleted or anonymized according to statutory retention rules, while active deals remain strictly protected and transacted records are preserved per commercial law.

## Acceptance Criteria

1. **Pre-Flight Eligibility & Active Commitment Blocking (`apps/api` per FR-50, UJ-1):**
   - **Given** an authenticated user requesting account deletion via `GET /api/v1/users/delete-account/eligibility` or `POST /api/v1/users/delete-account/initiate`
   - **When** evaluating user account eligibility across all linked role profiles (`Buyer`, `Seller`, `Owner`, `Marketer`):
   - **Then** the system checks three mandatory blocking conditions:
     1. **Active Deals Check:** Any Deal involving the user's role profiles (`buyerProfileId` or `sellerProfileId`) where status is non-terminal:
        - `Deal.status` in `['AWAITING_PAYMENT_PROOF', 'UNDER_ADMIN_AUDIT', 'PAYMENT_REJECTED']` (or `status NOT IN ['COMPLETED', 'CANCELLED', 'TERMINATED']`).
        - If active deals exist, strictly blocks deletion with HTTP 409 Conflict and error code `AUTH_DELETION_ACTIVE_DEAL_BLOCK` ("لا يمكن حذف أو تعطيل الحساب لوجود صفقات عقارية جارية غير مكتملة").
     2. **Open Disputes Check:** Any Dispute involving user's deals or initiated by the user where `Dispute.status === 'OPEN'`:
        - If open disputes exist, strictly blocks deletion with HTTP 409 Conflict and error code `AUTH_DELETION_OPEN_DISPUTE_BLOCK` ("لا يمكن حذف أو تعطيل الحساب لوجود نزاعات مفتوحة قيد التحقيق").
     3. **Pending Owner Listing Contracts Check:** Any linked `OwnerListingRequest` with `status === 'PENDING'`, or any `OwnerContract` in `PENDING_FEE` or with unverified fee payment (`feePayments.some(fp => fp.status === 'PENDING')`):
        - If pending contracts exist, strictly blocks deletion with HTTP 409 Conflict and error code `AUTH_DELETION_ACTIVE_CONTRACT_BLOCK` ("لا يمكن حذف أو تعطيل الحساب لوجود طلبات عقارية أو عقود وساطة معلقة الرسوم").
   - **And** logs a blocked audit attempt if triggered:
     - `AuditLog`: `action: 'ACCOUNT_DELETION_BLOCKED'`, `actorId: user.id`, `actorType: 'USER'`, `entityType: 'User'`, `entityId: user.id`, `payload: { reason: blockedReason, details }`.
   - **And** if no blocking conditions exist, returns eligibility summary:
     ```json
     {
       "eligible": true,
       "hasTransactionHistory": false,
       "mode": "COOLING_OFF",
       "coolingOffDays": 14,
       "message": "حسابك مؤهل لطلب الحذف مع مهلة نظامية مدتها 14 يوماً"
     }
     ```

2. **Deletion Initiation & Step-Up OTP Dispatch (`apps/api` & `packages/shared` per FR-50, UJ-1, AD-3):**
   - **Given** an eligible authenticated user submitting deletion initiation via `POST /api/v1/users/delete-account/initiate`
   - **When** the client submits `{ currentPassword: string }`:
     - Endpoint validates `currentPassword` is provided and non-empty.
     - Verifies `currentPassword` against `User.passwordHash` using Argon2id.
     - If password verification fails:
       - Increments failed attempt telemetry.
       - Rejects with HTTP 401 Unauthorized and error code `AUTH_INVALID_CREDENTIALS` ("كلمة المرور غير صحيحة").
   - **Then** evaluates blocking conditions (AC 1) as a server-side guard.
   - **And** generates a 6-digit OTP dispatched to user's registered Saudi mobile number (`mobileNumber`):
     - Purpose: `'ACCOUNT_DELETION'`.
     - Expiry: `OTP_EXPIRY_SECONDS = 300` (5 minutes).
     - Throttle: `OTP_THROTTLE_SECONDS = 60` (60 seconds resend cooldown).
   - **And** generates a tamper-proof deletion challenge token (`deletionToken`):
     - HMAC-SHA256 signed payload containing `{ userId, exp: ClockService.now() + 900 }` (15-minute expiration) encoded in base64url.
     - Expiration constant: `DELETION_TOKEN_EXPIRY_SECONDS = 900` (15 minutes).
   - **And** inserts an immutable `AuditLog` entry:
     - `actorId: user.id`
     - `actorType: 'USER'`
     - `action: 'ACCOUNT_DELETION_INITIATED'`
     - `entityType: 'User'`
     - `entityId: user.id`
     - `ipAddress: req.ip`
     - `payload: { mobileNumber: maskedPhone, tokenExpiresInSeconds: 900 }`
   - **And** returns HTTP 200 OK with:
     ```json
     {
       "code": "AUTH_DELETION_INITIATED",
       "message": "تم إرسال رمز التحقق إلى رقم جوالك المسجل لتأكيد حذف الحساب",
       "data": {
         "deletionToken": "...",
         "resendAvailableInSeconds": 60,
         "maskedMobileNumber": "+966 5X XXX 1234"
       }
     }
     ```

3. **Deletion Confirmation & Zero-History Branch: 14-Day Cooling-Off (`apps/api` per FR-50, A-13, 8.2):**
   - **Given** an authenticated user submitting deletion confirmation via `POST /api/v1/users/delete-account/confirm`
   - **When** the client submits `{ deletionToken: string, code: string }`:
     - Verifies `deletionToken` signature and checks `ClockService.now() <= token.exp`. If invalid or expired, rejects with HTTP 400 Bad Request `AUTH_DELETION_TOKEN_INVALID` or `AUTH_DELETION_TOKEN_EXPIRED`.
     - Verifies 6-digit OTP using `OtpService.verifyOtp(user.mobileNumber, 'ACCOUNT_DELETION', dto.code)`.
     - Re-verifies eligibility (blocking conditions from AC 1) to prevent race conditions.
   - **And** scans user's historical records across all 9 statutory categories:
     1. Listings: `Listing.count({ where: { marketerProfile: { userId } } })`
     2. Offers: `Offer.count({ where: { OR: [{ buyerProfile: { userId } }, { listing: { marketerProfile: { userId } } }] } })`
     3. Deals: `Deal.count({ where: { OR: [{ buyerProfile: { userId } }, { sellerProfile: { userId } }] } })`
     4. Payments: `Payment.count({ where: { deal: { OR: [{ buyerProfile: { userId } }, { sellerProfile: { userId } }] } })`
     5. Contracts: `OwnerContract.count({ where: { ownerProfile: { userId } } })`
     6. Conversations: `Conversation.count({ where: { OR: [{ buyerProfileId: { in: profileIds } }, { sellerProfileId: { in: profileIds } }] } })`
     7. Ratings: `Rating.count({ where: { OR: [{ authorId: userId }, { recipientId: userId }] } })`
     8. Disputes: `Dispute.count({ where: { initiatorId: userId } })`
     9. Demands: `Demand.count({ where: { buyerProfile: { userId } } })`
   - **Then** if transaction count across ALL 9 categories equals 0 (Zero Transaction History):
     - Executes state transition inside a Prisma transaction (`prisma.$transaction`):
       1. Updates `User`:
          - `status: ProfileStatus.DELETION_PENDING`
          - `deletionRequestedAt: ClockService.now()`
          - `deletionDueAt: new Date(ClockService.now().getTime() + 14 * 24 * 60 * 60 * 1000)` (14 days cooling-off)
       2. Revokes all active user sessions:
          - `prisma.session.deleteMany({ where: { userId } })`
       3. Inserts an immutable `AuditLog` entry:
          - `actorId: user.id`
          - `actorType: 'USER'`
          - `action: 'ACCOUNT_DELETION_REQUESTED'`
          - `entityType: 'User'`
          - `entityId: user.id`
          - `ipAddress: req.ip`
          - `payload: { status: 'DELETION_PENDING', coolingOffDays: 14, deletionDueAt: user.deletionDueAt }`
     - Clears the session cookie (`elmasaif_session`) in HTTP response headers.
     - Returns HTTP 200 OK with:
       ```json
       {
         "code": "AUTH_DELETION_COOLING_OFF",
         "message": "تمت جدولة حذف الحساب بنجاح. دخل الحساب في فترة مهلة نظامية مدتها 14 يوماً. يمكنك إلغاء طلب الحذف في أي وقت بمجرد تسجيل الدخول مجدداً خلال هذه الفترة",
         "data": {
           "status": "DELETION_PENDING",
           "deletionRequestedAt": "2026-11-01T...",
           "deletionDueAt": "2026-11-15T...",
           "coolingOffDays": 14
         }
       }
       ```

4. **Deletion Confirmation & Historical Records Branch: Statutory Retention Deactivation (`apps/api` per FR-50, BR-18):**
   - **Given** an authenticated user confirming account deletion whose transaction count across any of the 9 statutory categories > 0
   - **When** confirming deletion with valid `deletionToken` and OTP:
   - **Then** hard deletion is strictly prohibited per BR-18 and Saudi commercial/tax retention mandates.
   - **And** the system executes institutional deactivation inside a Prisma transaction (`prisma.$transaction`):
     1. Updates `User`:
        - `status: ProfileStatus.DEACTIVATED`
        - `deletionRequestedAt: ClockService.now()`
        - `deletionDueAt: null` (no cooling-off; retained indefinitely or per statutory schedule)
     2. Updates all attached `UserProfile`s:
        - `status: ProfileStatus.DEACTIVATED`
     3. Archives any published listings (`Listing`):
        - Updates `Listing.status = ARCHIVED` for any non-terminal listing authored by the user.
     4. Conceals public profile from public searches and broker directories.
     5. Preserves all underlying financial, tax, invoice, payment, deal, and contract records unmodified.
     6. Revokes all active user sessions:
        - `prisma.session.deleteMany({ where: { userId } })`
     7. Inserts an immutable `AuditLog` entry:
        - `actorId: user.id`
        - `actorType: 'USER'`
        - `action: 'ACCOUNT_DEACTIVATED_STATUTORY_RETENTION'`
        - `entityType: 'User'`
        - `entityId: user.id`
        - `ipAddress: req.ip`
        - `payload: { status: 'DEACTIVATED', transactionHistoryDetected: true, statutoryRetentionRule: 'BR-18', commercialLawRetention: true }`
   - **And** clears the session cookie (`elmasaif_session`) in HTTP response headers.
   - **And** returns HTTP 200 OK with:
     ```json
     {
       "code": "AUTH_ACCOUNT_DEACTIVATED_STATUTORY",
       "message": "تم تعطيل الحساب وإخفاء ملفك الشخصي بنجاح. نظراً لوجود تعاملات تجارية ومالية سابقة، سيتم الاحتفاظ بالسجلات التعاقدية والمالية وفقاً للمدد المقررة في الأنظمة التجارية والضريبية السعودية (BR-18)",
       "data": {
         "status": "DEACTIVATED",
         "deletionRequestedAt": "2026-11-01T...",
         "retainedRecords": true
       }
     }
     ```

5. **Cooling-Off Cancellation via Login & Explicit Revocation (`apps/api` per FR-2, FR-50, A-13):**
   - **Given** a user account with status `ProfileStatus.DELETION_PENDING` within the 14-day cooling-off window (`ClockService.now() < deletionDueAt`)
   - **When** the user logs in via `POST /api/v1/auth/login`:
     - Password verification succeeds.
     - System detects `user.status === ProfileStatus.DELETION_PENDING`.
     - Automatically cancels deletion request and restores account:
       - `User.status = ProfileStatus.ACTIVE`
       - `User.deletionRequestedAt = null`
       - `User.deletionDueAt = null`
     - Inserts an immutable `AuditLog` entry:
       - `actorId: user.id`
       - `actorType: 'USER'`
       - `action: 'ACCOUNT_DELETION_CANCELLED'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `ipAddress: req.ip`
       - `payload: { reason: 'User authenticated during 14-day cooling-off window', restoredStatus: 'ACTIVE' }`
     - Returns login response with `deletionCancelled: true` and informational notification.
   - **When** an authenticated user with `status === DELETION_PENDING` submits explicit cancellation via `POST /api/v1/users/delete-account/cancel`:
     - Resets `status = ProfileStatus.ACTIVE`, `deletionRequestedAt = null`, `deletionDueAt = null`.
     - Inserts immutable `AuditLog` entry (`action: 'ACCOUNT_DELETION_CANCELLED'`).
     - Returns HTTP 200 OK with `AUTH_DELETION_CANCELLED` ("تم إلغاء طلب حذف الحساب واستعادة نشاط الحساب بنجاح").
   - **When** a user with status `DEACTIVATED`, `DISABLED`, or `SOFT_DELETED` attempts to log in:
     - Strictly refused with HTTP 403 Forbidden:
       - `DEACTIVATED`: `AUTH_ACCOUNT_DEACTIVATED` ("هذا الحساب معطل. نظراً لوجود تعاملات تجارية سابقة، تم تعطيل الحساب والاحتفاظ بالسجلات المالية نظامياً. يرجى التواصل مع الدعم الفني").
       - `DISABLED` or `SOFT_DELETED`: `AUTH_ACCOUNT_DISABLED` ("هذا الحساب موقوف أو محذوف من قبل الإدارة").

6. **Automated Cooling-Off Expiration & PDPL Permanent Anonymization (`apps/worker` & `apps/api` per FR-50, AD-7, 8.2):**
   - **Given** accounts in `ProfileStatus.DELETION_PENDING` where `ClockService.now() >= deletionDueAt`
   - **When** the scheduled background worker job `account-deletion-expiry` executes (daily schedule via pg-boss or on demand):
   - **Then** queries all users matching:
     - `where: { status: ProfileStatus.DELETION_PENDING, deletionDueAt: { lte: ClockService.now() } }`
   - **And** for each expired account, re-verifies zero transaction history:
     - If unexpected transactions exist, moves account to `ProfileStatus.DEACTIVATED` with audit alert.
     - Otherwise, permanently anonymizes all Personally Identifiable Information (PII) per Saudi PDPL:
       - `fullName: 'مستخدم محذوف'`
       - `mobileNumber: '+966000000000' + randomSalt` (unique anonymized placeholder preventing index collision)
       - `nationalId: '0000000000' + randomSalt` (unique placeholder)
       - `username: 'deleted_' + user.id.slice(0, 8)`
       - `email: null`
       - `pendingEmail: null`
       - `passwordHash: 'ERASED_PDPL_' + randomUUID`
       - `status: ProfileStatus.SOFT_DELETED`
     - Deletes all records in `KnownDevice` for this user (`prisma.knownDevice.deleteMany({ where: { userId } })`).
     - Inserts an immutable `AuditLog` entry:
       - `actorId: 'SYSTEM'`
       - `actorType: 'SYSTEM'`
       - `action: 'ACCOUNT_PERMANENTLY_ERASED'`
       - `entityType: 'User'`
       - `entityId: user.id`
       - `payload: { reason: '14-day cooling-off expired without cancellation', anonymizedAt: ClockService.now() }`
   - **And** job returns execution summary `{ processedCount, anonymizedCount, deactivatedCount }`.

7. **Account Deletion Settings Web UI (`apps/web` at `/app/settings/delete-account` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user navigating to `/app/settings/delete-account`
   - **When** rendering the page wrapped in `WorkspaceShell`:
     - Displays breadcrumbs: "لوحة التحكم > إعدادات الحساب > حذف الحساب".
     - Header: Title "حذف الحساب والامتثال لنظام حماية البيانات الشخصية (PDPL)" with red shield/alert emblem.
     - **PDPL Statutory Disclosure Banner (Amber/Rose):**
       - Clear Arabic explanation of Saudi PDPL user rights.
       - Explains the **14-day cooling-off period** for accounts with no prior transaction history, noting that logging in cancels the deletion request.
       - Explains statutory retention mandates under Saudi commercial and tax law (BR-18) for accounts with transactions.
       - Discloses that accounts with active deals, open disputes, or pending contracts cannot be deleted until those matters are resolved.
     - **Pre-Flight Eligibility State:**
       - If user is blocked (active deal/dispute/contract), displays a prominent alert card detailing the blocking reason and links to `/app/deals` or `/app/disputes`, disabling the deletion submission.
     - **Deletion Request Wizard / Form:**
       - **Step 1: Password Confirmation:**
         - Password input field with toggleable show/hide password.
         - Button: "طلب رمز التحقق لحذف الحساب" with loading spinner and disabled state when empty.
       - **Step 2: Step-Up OTP Verification:**
         - Rendered after valid password and token receipt.
         - 6-digit segmented OTP input with auto-focus.
         - 60-second cooldown timer for resending OTP.
         - Destructive action button: "تأكيد حذف الحساب نهائياً" (`Button variant="destructive"`).
     - **Post-Submission Feedback Card:**
       - For Zero-History accounts: Amber milestone card with calendar emblem:
         - "تم جدولة حذف حسابك بنجاح. دخل الحساب في فترة مهلة نظامية مدتها 14 يوماً حتى ({deletionDueAt}). يمكنك إلغاء الحذف في أي وقت بتسجيل الدخول".
       - For Transacted accounts: Institutional card:
         - "تم تعطيل الحساب بنجاح وإخفاء بياناتك الشخصية من البحث العام، مع حفظ السجلات المالية والتعاقدية نظامياً".
       - Primary button redirecting to `/auth/login`.
     - **Profile Settings Integration:**
       - Updates `/app/settings/profile` to include a "منطقة الحذف والأمان" card linking to `/app/settings/delete-account`.

8. **Automated Verification & Testing Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, `apps/worker`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Shared schema tests validating `initiateAccountDeletionSchema`, `confirmAccountDeletionSchema`, and deletion error codes.
     - Backend unit tests for `AccountDeletionService` verifying:
       - Active deal, open dispute, and pending owner contract blocking (HTTP 409).
       - Password verification and OTP dispatch with deletion challenge token.
       - Correct detection of 0 vs >0 transaction history across all 9 categories.
       - Branch A: Status `DELETION_PENDING`, 14-day calculation via `ClockService`, session revocation, and audit logging.
       - Branch B: Status `DEACTIVATED`, profile hiding, listing archiving, and statutory audit logging.
       - Login-based cancellation restoring `ACTIVE` status and clearing due dates.
       - Explicit cancellation endpoint resetting status.
     - Backend controller tests for `AccountDeletionController` endpoints.
     - Worker unit tests for `account-deletion-expiry` job verifying permanent anonymization of PII after 14 days.
     - Frontend component tests for `AccountDeletionWizard` and `/app/settings/delete-account`.
     - Zero TypeScript errors (`npm run build`), zero lint warnings (`npm run lint`).

## Tasks / Subtasks

- [x] Task 1: Shared Constants, Error Codes, Schemas & Types in `packages/shared` (AC: 1, 2, 3, 4, 5, 6)
  - [x] 1.1 Update `packages/shared/src/constants/auth.ts`:
    - Add domain error and status codes:
      - `AUTH_DELETION_INITIATED = 'AUTH_DELETION_INITIATED'`
      - `AUTH_DELETION_ACTIVE_DEAL_BLOCK = 'AUTH_DELETION_ACTIVE_DEAL_BLOCK'`
      - `AUTH_DELETION_OPEN_DISPUTE_BLOCK = 'AUTH_DELETION_OPEN_DISPUTE_BLOCK'`
      - `AUTH_DELETION_ACTIVE_CONTRACT_BLOCK = 'AUTH_DELETION_ACTIVE_CONTRACT_BLOCK'`
      - `AUTH_DELETION_COOLING_OFF = 'AUTH_DELETION_COOLING_OFF'`
      - `AUTH_ACCOUNT_DEACTIVATED_STATUTORY = 'AUTH_ACCOUNT_DEACTIVATED_STATUTORY'`
      - `AUTH_DELETION_CANCELLED = 'AUTH_DELETION_CANCELLED'`
      - `AUTH_DELETION_TOKEN_INVALID = 'AUTH_DELETION_TOKEN_INVALID'`
      - `AUTH_DELETION_TOKEN_EXPIRED = 'AUTH_DELETION_TOKEN_EXPIRED'`
      - `AUTH_ACCOUNT_PERMANENTLY_ERASED = 'AUTH_ACCOUNT_PERMANENTLY_ERASED'`
    - Add configuration constants:
      - `DELETION_COOLING_OFF_DAYS = 14`
      - `DELETION_TOKEN_EXPIRY_SECONDS = 900`
  - [x] 1.2 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Define `initiateAccountDeletionSchema`: `z.object({ currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة') })`.
    - Define `confirmAccountDeletionSchema`: `z.object({ deletionToken: z.string().min(1, 'رمز التحدي مطلوب'), code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام') })`.
    - Define `cancelAccountDeletionSchema`: `z.object({}).optional()`.
  - [x] 1.3 Update `packages/shared/src/types/auth.ts` and re-export in `packages/shared/src/index.ts`:
    - Export TypeScript input types: `InitiateAccountDeletionInput`, `ConfirmAccountDeletionInput`.
    - Export TypeScript response interfaces: `AccountDeletionEligibilityResponse`, `InitiateAccountDeletionResponse`, `ConfirmAccountDeletionResponse`.
  - [x] 1.4 Update `packages/shared/src/constants/jobs.ts`:
    - Define `JOB_ACCOUNT_DELETION_EXPIRY = 'account-deletion-expiry'`.
  - [x] 1.5 Create unit tests in `packages/shared/src/schemas/__tests__/account-deletion.spec.ts`:
    - Test validation of password schema, token schema, and OTP code schema.

- [x] Task 2: Backend Account Deletion Service in `apps/api/src/modules/users/account-deletion.service.ts` (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Implement eligibility and blocking checks:
    - Check active non-terminal deals (`[AWAITING_PAYMENT_PROOF, UNDER_ADMIN_AUDIT, PAYMENT_REJECTED]`).
    - Check open disputes (`status === 'OPEN'`).
    - Check pending owner listing requests and contracts in `PENDING_FEE`.
    - Throw appropriate HTTP 409 Conflict with descriptive Arabic error messages if blocked.
  - [x] 2.2 Implement 9-category transaction history counter:
    - Count across `Listing`, `Offer`, `Deal`, `Payment`, `OwnerContract`, `Conversation`, `Rating`, `Dispute`, and `Demand`.
  - [x] 2.3 Implement `initiateDeletion(userId: string, dto: InitiateAccountDeletionInput, ip: string)`:
    - Verify password via Argon2id.
    - Check blocking eligibility.
    - Dispatch 6-digit OTP to user's mobile number (`ACCOUNT_DELETION`).
    - Generate HMAC-SHA256 signed `deletionToken` (15 min expiry).
    - Log `ACCOUNT_DELETION_INITIATED` in `AuditLog`.
  - [x] 2.4 Implement `confirmDeletion(userId: string, dto: ConfirmAccountDeletionInput, ip: string)`:
    - Verify `deletionToken` signature and expiry via `ClockService.now()`.
    - Verify OTP via `OtpService.verifyOtp`.
    - Re-verify blocking conditions.
    - Check transaction history count:
      - If 0: Transition `User.status = DELETION_PENDING`, set `deletionRequestedAt`, set `deletionDueAt` (+14 days), revoke sessions, log `ACCOUNT_DELETION_REQUESTED`.
      - If > 0: Transition `User.status = DEACTIVATED`, update profiles to `DEACTIVATED`, archive listings, revoke sessions, log `ACCOUNT_DEACTIVATED_STATUTORY_RETENTION`.
  - [x] 2.5 Implement `cancelDeletion(userId: string, ip: string)`:
    - Reset `status = ACTIVE`, clear dates, log `ACCOUNT_DELETION_CANCELLED`.
  - [x] 2.6 Update `apps/api/src/modules/auth/auth.service.ts`:
    - Ensure `login()` records `ACCOUNT_DELETION_CANCELLED` audit log when restoring `DELETION_PENDING` accounts to `ACTIVE`.
    - Ensure `login()` strictly refuses `DEACTIVATED`, `DISABLED`, and `SOFT_DELETED` accounts with proper HTTP 403 error codes.

- [x] Task 3: Backend REST Controller Endpoints in `apps/api/src/modules/users/account-deletion.controller.ts` (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Create `apps/api/src/modules/users/account-deletion.controller.ts`:
    - `GET /users/delete-account/eligibility`: Guarded by `SessionAuthGuard`, returns eligibility and transaction history summary.
    - `POST /users/delete-account/initiate`: Guarded by `SessionAuthGuard`, validates `initiateAccountDeletionSchema`, invokes `accountDeletionService.initiateDeletion`.
    - `POST /users/delete-account/confirm`: Guarded by `SessionAuthGuard`, validates `confirmAccountDeletionSchema`, invokes `accountDeletionService.confirmDeletion`.
    - `POST /users/delete-account/cancel`: Guarded by `SessionAuthGuard`, invokes `accountDeletionService.cancelDeletion`.
  - [x] 3.2 Register `AccountDeletionService` and `AccountDeletionController` in `apps/api/src/modules/users/users.module.ts`.
  - [x] 3.3 Create unit tests in `apps/api/src/modules/users/__tests__/account-deletion.service.spec.ts`:
    - Test active deal, open dispute, and pending contract blocking.
    - Test password verification failure.
    - Test zero-transaction branch -> `DELETION_PENDING` with 14-day calculation.
    - Test historical-transaction branch -> `DEACTIVATED` with statutory retention.
    - Test deletion cancellation via login and explicit endpoint.
  - [x] 3.4 Create controller tests in `apps/api/src/modules/users/__tests__/account-deletion.controller.spec.ts`.

- [x] Task 4: Background Worker Job in `apps/worker/src/jobs/account-deletion-expiry.job.ts` (AC: 6)
  - [x] 4.1 Implement `accountDeletionExpiryHandler` in `apps/worker/src/jobs/account-deletion-expiry.job.ts`:
    - Query users where `status === DELETION_PENDING` and `deletionDueAt <= ClockService.now()`.
    - Anonymize PII (name, phone, national ID, username, clear email/password).
    - Set `status = SOFT_DELETED`.
    - Clean up `KnownDevice` records.
    - Log `ACCOUNT_PERMANENTLY_ERASED` in `AuditLog`.
  - [x] 4.2 Register job in `apps/worker/src/jobs/index.ts` and `apps/worker/src/scheduler.ts`.
  - [x] 4.3 Create unit tests in `apps/worker/src/jobs/__tests__/account-deletion-expiry.spec.ts`.

- [x] Task 5: Frontend Account Deletion Danger Zone UI in `apps/web` (AC: 7)
  - [x] 5.1 Create `apps/web/src/components/auth/account-deletion-wizard.tsx`:
    - PDPL statutory information alert banner.
    - Pre-flight blocking alert if active deals or disputes exist.
    - Step 1: Current password input with submit button.
    - Step 2: 6-digit OTP segmented field with 60s cooldown resend timer.
    - Red destructive confirmation button.
    - Post-completion milestone cards for cooling-off vs deactivation.
  - [x] 5.2 Create `apps/web/src/app/app/settings/delete-account/page.tsx`:
    - Embed `AccountDeletionWizard` wrapped in institutional page layout with breadcrumbs.
  - [x] 5.3 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Add "منطقة الحذف والأمان" card linking to `/app/settings/delete-account`.
  - [x] 5.4 Component tests in `apps/web/src/components/auth/__tests__/account-deletion-wizard.spec.tsx`.

- [x] Task 6: Verification, Test Suites & Quality Gates (AC: 8)
  - [x] 6.1 Execute shared package tests: `npx vitest run packages/shared/src/schemas/__tests__/account-deletion.spec.ts`.
  - [x] 6.2 Execute backend unit and integration tests: `npx jest --config apps/api/package.json account-deletion`.
  - [x] 6.3 Execute worker unit tests: `npm test -w apps/worker`.
  - [x] 6.4 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 6.5 Run lint checks across all workspaces: `npm run lint`.
  - [x] 6.6 Run production workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **Saudi PDPL Compliance & Right to Erasure (FR-50, 8.2):**
  - Under the Saudi Personal Data Protection Law (PDPL), users have the right to request erasure of their personal data.
  - However, this right is governed by statutory retention exceptions:
    - Saudi commercial law and ZATCA tax regulations require maintaining commercial and tax records (contracts, invoices, wire transfers, payment proofs) for statutory retention periods (typically 5 to 10 years).
    - Real estate regulatory framework (REGA) mandates maintaining broker deal records and Fal transaction history.
  - Therefore, the system defines two deterministic branches:
    - **Zero Transaction History (Clean Accounts):** Enters `DELETION_PENDING` for a **14-day cooling-off period** (`A-13`). If the user does not log in, personal data is permanently anonymized and the account transitions to `SOFT_DELETED`.
    - **Historical Transaction Records:** Enters `DEACTIVATED`. Personal data is removed from public view and directories, while transactional and financial records are preserved per `BR-18`.
- **Strict Active Commitment Blocking Guards:**
  - Neither deletion nor deactivation is permitted while an account has pending or active legal commitments.
  - Specifically:
    1. Active Deals: Any deal where `status NOT IN ['COMPLETED', 'CANCELLED', 'TERMINATED']`.
    2. Open Disputes: Any dispute where `status === 'OPEN'`.
    3. Pending Owner Contracts: Any `OwnerListingRequest` with `status === 'PENDING'`, or `OwnerContract` in `PENDING_FEE` or with unverified fee payment.
  - Any request meeting these conditions is rejected with HTTP 409 Conflict.
- **Step-Up Authentication & Deletion Challenge Token:**
  - Deletion requires dual-layer step-up re-authentication:
    1. Re-entry of current password (verified via Argon2id).
    2. 6-digit OTP sent to registered Saudi mobile number (`ACCOUNT_DELETION` purpose).
  - To bridge between password verification and OTP confirmation without persisting mutable state in the database, the server issues a signed HMAC-SHA256 `deletionToken` expiring in 15 minutes (`DELETION_TOKEN_EXPIRY_SECONDS = 900`).
- **Cooling-Off Window & Login Cancellation (FR-2, FR-50, A-13):**
  - The cooling-off period is exactly 14 calendar days calculated using `ClockService.now()`:
    `deletionDueAt = new Date(ClockService.now().getTime() + 14 * 24 * 60 * 60 * 1000)`.
  - If the user authenticates during this window, the login logic automatically resets `status = ACTIVE`, clears `deletionRequestedAt` and `deletionDueAt`, and logs `ACCOUNT_DELETION_CANCELLED`.
  - Session revocation: Confirming deletion immediately revokes all active session cookies in `prisma.session` to ensure the user cannot perform unauthorized actions during the cooling-off period.
- **Audit Logging Standards (AD-3, AD-6, BR-19):**
  - Every account deletion lifecycle event writes an immutable record to `AuditLog`:
    - `ACCOUNT_DELETION_INITIATED`: Password verified, OTP dispatched.
    - `ACCOUNT_DELETION_BLOCKED`: Deletion blocked due to active deal/dispute/contract.
    - `ACCOUNT_DELETION_REQUESTED`: Zero-history account entered `DELETION_PENDING` (14 days).
    - `ACCOUNT_DEACTIVATED_STATUTORY_RETENTION`: Historical account entered `DEACTIVATED` (BR-18).
    - `ACCOUNT_DELETION_CANCELLED`: Deletion cancelled via login or explicit action.
    - `ACCOUNT_PERMANENTLY_ERASED`: Background worker completed PII anonymization to `SOFT_DELETED`.

### Project Structure Notes

- **Database Model Alignment:**
  - `User` in `apps/api/prisma/schema.prisma` already defines:
    - `status: ProfileStatus @default(ACTIVE)`
    - `deletionRequestedAt: DateTime?`
    - `deletionDueAt: DateTime?`
  - `ProfileStatus` enum already includes `DELETION_PENDING`, `DEACTIVATED`, `DISABLED`, `SOFT_DELETED`.
- **REST Endpoints Mapping:**
  - `GET /api/v1/users/delete-account/eligibility` -> Pre-flight check returning eligibility and mode.
  - `POST /api/v1/users/delete-account/initiate` -> Validates password, checks blocks, sends OTP, returns `deletionToken`.
  - `POST /api/v1/users/delete-account/confirm` -> Validates OTP & token, routes to Branch A (cooling-off) or Branch B (deactivation), revokes sessions.
  - `POST /api/v1/users/delete-account/cancel` -> Explicit cancellation endpoint.
- **Worker Job Alignment:**
  - `JOB_ACCOUNT_DELETION_EXPIRY = 'account-deletion-expiry'` added to `packages/shared/src/constants/jobs.ts` and `apps/worker/src/jobs/`.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `packages/shared/src/constants/auth.ts` | UPDATE | Add deletion domain error/status codes (`AUTH_DELETION_INITIATED`, `AUTH_DELETION_ACTIVE_DEAL_BLOCK`, `AUTH_DELETION_COOLING_OFF`, `AUTH_ACCOUNT_DEACTIVATED_STATUTORY`, etc.) and configuration constants. |
| `packages/shared/src/constants/jobs.ts` | UPDATE | Define `JOB_ACCOUNT_DELETION_EXPIRY = 'account-deletion-expiry'`. |
| `packages/shared/src/schemas/auth.schema.ts` | UPDATE | Define `initiateAccountDeletionSchema`, `confirmAccountDeletionSchema`, `cancelAccountDeletionSchema`. |
| `packages/shared/src/types/auth.ts` | UPDATE | Export TypeScript interfaces for deletion inputs and API responses. |
| `packages/shared/src/schemas/__tests__/account-deletion.spec.ts` | NEW | Unit tests for account deletion validation schemas. |
| `apps/api/src/modules/users/account-deletion.service.ts` | NEW | Implement eligibility checks, 9-category history scanning, OTP dispatch, challenge token generation, Branch A (cooling-off) & Branch B (deactivation) state transitions, and cancellation. |
| `apps/api/src/modules/users/account-deletion.controller.ts` | NEW | Expose endpoints: `GET /users/delete-account/eligibility`, `POST /users/delete-account/initiate`, `POST /users/delete-account/confirm`, `POST /users/delete-account/cancel`. |
| `apps/api/src/modules/users/users.module.ts` | UPDATE | Register `AccountDeletionService` and `AccountDeletionController`. |
| `apps/api/src/modules/auth/auth.service.ts` | UPDATE | Ensure login cancellation records `ACCOUNT_DELETION_CANCELLED` audit log, and forbidden error codes for deactivated/disabled users are returned. |
| `apps/api/src/modules/users/__tests__/account-deletion.service.spec.ts` | NEW | Unit tests covering blocking rules, password step-up, cooling-off 14-day calculation, deactivation branch, and cancellation. |
| `apps/api/src/modules/users/__tests__/account-deletion.controller.spec.ts` | NEW | Controller tests for account deletion REST endpoints. |
| `apps/worker/src/jobs/account-deletion-expiry.job.ts` | NEW | Scheduled background worker job to permanently anonymize PII for expired `DELETION_PENDING` accounts. |
| `apps/worker/src/jobs/index.ts` | UPDATE | Register `accountDeletionExpiryHandler` in worker job map. |
| `apps/worker/src/jobs/__tests__/account-deletion-expiry.spec.ts` | NEW | Unit tests for worker expiration and PII anonymization. |
| `apps/web/src/components/auth/account-deletion-wizard.tsx` | NEW | Interactive account deletion component with PDPL disclosures, blocking alert, password step-up, OTP segmented input, and completion state cards. |
| `apps/web/src/app/app/settings/delete-account/page.tsx` | NEW | Dedicated Account Deletion page in user settings. |
| `apps/web/src/app/app/settings/profile/page.tsx` | UPDATE | Add Danger Zone link/card pointing to `/app/settings/delete-account`. |
| `apps/web/src/components/auth/__tests__/account-deletion-wizard.spec.tsx` | NEW | Component tests for account deletion wizard interactions and states. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE | Mark `1-9-account-deletion-pdpl-compliance-14-day-cooling-off-period: ready-for-dev`. |

### Preserved Behaviors

- **Existing Auth & Profile Endpoints:** `users/profile`, `users/profiles`, `users/phone-change`, `users/payout`, `users/identity`, and `auth/*` remain completely intact.
- **Session Authentication Guard:** All account deletion routes are protected by `SessionAuthGuard` (requiring valid cookie session).
- **Statutory Data Retention (BR-18):** Completed financial, tax, payment, deal, and contract records are NEVER deleted; they are preserved per statutory Saudi commercial retention schedules.
- **Immediate Cancellation via Login:** If a user logs in during the 14-day cooling-off period, their account is seamlessly restored to `ACTIVE` without administrative intervention.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.9:-Account-Deletion,-PDPL-Compliance-&-14-Day-Cooling-Off-Period]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-50:-Right-to-Erasure-/-Account-Deletion-Request]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-2:-Returning-User-Login,-Session-Handling-&-Lockout]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#BR-18:-Statutory-Data-Retention]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#8.2-Privacy-&-Saudi-PDPL-Compliance]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#1.-User,-Account-&-Legal-Consent-(ConsentRecord)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-3-Authentication,-Multi-Role-Identity-&-Saudi-Citizen-Legal-Consent]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-7-Dedicated-Background-Worker-(pg-boss-Scheduler)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#8.-Security-&-Account-Recovery-Modals]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#8.-User-Security-&-Account-Lifecycle-Flows]
- [Source: _bmad-output/implementation-artifacts/1-7-secure-mobile-number-update-with-dual-otp.md]
- [Source: _bmad-output/implementation-artifacts/1-8-profile-editing-mandatory-email-verification.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Evaluated core planning requirements: `epics.md` Story 1.9, `prd.md` FR-50, FR-2, BR-18, A-13, and section 8.2 PDPL compliance.
- Analyzed existing codebase architectures: `phone-change.service.ts` active deal/dispute blocking patterns, `auth.service.ts` login status machine and cooling-off restoration, `apps/worker` pg-boss scheduled jobs, and `apps/web/src/app/app/settings/profile/page.tsx`.
- Formulated dual-branch execution model: Branch A (Zero Transaction History -> `DELETION_PENDING` + 14-day cooling-off via `ClockService`) and Branch B (Historical Records -> `DEACTIVATED` + statutory retention under BR-18).
- Designed step-up security flow: Argon2id password verification, 6-digit Saudi mobile OTP dispatch, and 15-minute HMAC-SHA256 deletion challenge token.
- Specified background worker job `account-deletion-expiry` to ensure permanent PII anonymization to `SOFT_DELETED` upon cooling-off completion.

### Completion Notes List

- Task 1 completed: Shared constants, error codes, Zod validation schemas, TypeScript interfaces, and job constants defined in `packages/shared`. Unit tests in `packages/shared/src/schemas/__tests__/account-deletion.spec.ts` passed 100% (6/6). Full shared package test suite passing (150/150).
- Task 2 completed: Backend `AccountDeletionService` implemented with pre-flight active commitment blocking (active deals, open disputes, pending contracts), 9-category statutory history counter, Argon2id step-up password verification, OTP dispatch with HMAC deletion challenge token, Branch A (14-day cooling-off `DELETION_PENDING`) and Branch B (statutory retention deactivation `DEACTIVATED`), and deletion cancellation. `auth.service.ts` updated with `ACCOUNT_DELETION_CANCELLED` audit logging during login. Unit tests in `account-deletion.service.spec.ts` passing 100% (10/10).
- Task 3 completed: Backend REST Controller `AccountDeletionController` implemented exposing `GET /users/delete-account/eligibility`, `POST /users/delete-account/initiate`, `POST /users/delete-account/confirm` (with session cookie clearance), and `POST /users/delete-account/cancel`. Registered in `UsersModule`. Controller unit tests in `account-deletion.controller.spec.ts` passing 100% (5/5). All 25 `auth.service.spec.ts` tests also passing.
- Task 4 completed: Background worker job `account-deletion-expiry` implemented in `apps/worker/src/jobs/account-deletion-expiry.job.ts`. Registered in `jobHandlersMap` and `BACKGROUND_JOB_DEFINITIONS` with daily schedule. Unit tests in `account-deletion-expiry.spec.ts` and `scheduler.spec.ts` passing 100% (45/45 across worker suite).
- Task 5 completed: Frontend `AccountDeletionWizard` created with PDPL disclosure banner, active deal/dispute blocking alerts, Step 1 password confirmation, Step 2 OTP segmented input with 60s resend cooldown, destructive confirmation button, and post-submission cooling-off / statutory deactivation cards. Settings page created at `/app/settings/delete-account` and linked from `/app/settings/profile` Danger Zone card. Component unit tests in `account-deletion-wizard.spec.tsx` passing 100% (3/3). Full web test suite passing (81/81).
- Task 6 completed: Complete verification executed. Shared unit tests (150/150), backend Jest tests (287/287), worker tests (45/45), frontend Vitest tests (81/81), `npm run lint` (0 errors), and production builds across all 4 workspaces (`@elmasaif/shared`, `@elmasaif/api`, `@elmasaif/worker`, `@elmasaif/web`) all passed with zero errors.
- Story status updated to `review`.

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/constants/jobs.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/types/jobs.ts`
- `packages/shared/src/schemas/__tests__/account-deletion.spec.ts`
- `packages/shared/src/constants/__tests__/jobs.spec.ts`
- `apps/api/src/modules/users/account-deletion.service.ts`
- `apps/api/src/modules/users/account-deletion.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/users/__tests__/account-deletion.service.spec.ts`
- `apps/api/src/modules/users/__tests__/account-deletion.controller.spec.ts`
- `apps/api/src/modules/users/__tests__/profile.service.spec.ts`
- `apps/worker/src/jobs/account-deletion-expiry.job.ts`
- `apps/worker/src/jobs/index.ts`
- `apps/worker/src/jobs/__tests__/account-deletion-expiry.spec.ts`
- `apps/worker/src/jobs/__tests__/jobs.spec.ts`
- `apps/worker/src/__tests__/scheduler.spec.ts`
- `apps/web/src/components/auth/account-deletion-wizard.tsx`
- `apps/web/src/app/app/settings/delete-account/page.tsx`
- `apps/web/src/app/app/settings/profile/page.tsx`
- `apps/web/src/components/auth/__tests__/account-deletion-wizard.spec.tsx`
- `_bmad-output/implementation-artifacts/1-9-account-deletion-pdpl-compliance-14-day-cooling-off-period.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

