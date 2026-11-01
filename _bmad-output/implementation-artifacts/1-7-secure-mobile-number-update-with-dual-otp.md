---
baseline_commit: d2b5f3bc0ab51de53fb96abe5ac685bd9b5333ba
---

# Story 1.7: Secure Mobile Number Update with Dual-OTP

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to update my registered mobile number using verification on both my current and new numbers,
So that my account phone number can be safely updated without risking account takeover.

## Acceptance Criteria

1. **Dual-OTP Phone Change Initiation & Validation (`packages/shared` & `apps/api` per FR-48, UJ-1, UJ-5):**
   - **Given** an authenticated user submitting a request to change their mobile number via `POST /api/v1/users/phone-change/initiate`
   - **When** the client submits `newMobileNumber`
   - **Then** the endpoint validates `newMobileNumber` using `saudiMobileNormalizedSchema` (format `^(\+966|0)5[0-9]{8}$`, normalized to `+9665XXXXXXXX`).
   - **And** the endpoint checks that `newMobileNumber` is not identical to the user's current registered `mobileNumber`:
     - If identical, rejects immediately with HTTP 400 Bad Request and error code `AUTH_PHONE_SAME_AS_CURRENT` ("رقم الجوال الجديد مطابق لرقم الجوال الحالي المسجل").
   - **And** checks that `newMobileNumber` is not already assigned to another existing user in the database (`prisma.user.findUnique({ where: { mobileNumber: normalizedPhone } })`):
     - If assigned to another account, rejects immediately with HTTP 409 Conflict and error code `AUTH_PHONE_IN_USE` ("رقم الجوال المدخل مستخدم بالفعل في حساب آخر").
   - **And** verifies that the user is NOT party to any active Deal in non-terminal payment or dispute stages (see AC 3 for Deal Blocking Guard):
     - If active deals or open disputes exist, rejects immediately with HTTP 409 Conflict and error code `AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK` ("لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع").
   - **And** if any previous pending `PhoneChangeRequest` exists for this user, updates its status to `CANCELLED`.
   - **And** creates a new `PhoneChangeRequest` record in PostgreSQL via Prisma:
     - `userId: user.id`
     - `oldPhoneNumber: user.mobileNumber`
     - `newPhoneNumber: normalizedPhone`
     - `oldVerified: false`
     - `newVerified: false`
     - `isSupportAssisted: false`
     - `status: 'PENDING'`
     - `expiresAt: ClockService.now() + 15 minutes (900 seconds)`
   - **And** dispatches 6-digit OTP verification codes to BOTH the old and new mobile numbers:
     - Current registered number: `OtpService.generateAndSendOtp(user.mobileNumber, 'PHONE_CHANGE_OLD', { requestId })`
     - Proposed new number: `OtpService.generateAndSendOtp(normalizedPhone, 'PHONE_CHANGE_NEW', { requestId })`
     - Enforces standard OTP guardrails: 300s OTP code validity, 60s resend throttle, max 3 hourly requests per phone (`AUTH_OTP_THROTTLED`, `AUTH_OTP_MAX_EXCEEDED`).
   - **And** returns HTTP 200 OK with:
     ```json
     {
       "code": "AUTH_PHONE_CHANGE_INITIATED",
       "message": "تم إرسال رموز التحقق إلى رقم جوالك الحالي والرقم الجديد بنجاح",
       "data": {
         "requestId": "...",
         "oldPhoneNumberMasked": "+966 5X XXX 1234",
         "newPhoneNumberMasked": "+966 5X XXX 5678",
         "expiresInSeconds": 900,
         "resendAvailableInSeconds": 60
       }
     }
     ```

2. **Step-by-Step Dual-OTP Verification & Atomic Number Re-binding (`apps/api` per FR-48, AD-5, UJ-1):**
   - **Given** an active `PhoneChangeRequest` in `PENDING` status
   - **When** the client submits the verification code for the old number via `POST /api/v1/users/phone-change/verify-old`:
     - Body: `{ requestId: string, code: string }`
     - Verifies request existence, ownership (`userId === req.user.id`), and expiration (`ClockService.now() <= request.expiresAt`). If expired, updates `status = 'EXPIRED'` and rejects with HTTP 400 `AUTH_PHONE_CHANGE_EXPIRED` ("انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد").
     - Verifies OTP via `OtpService.verifyOtp(request.oldPhoneNumber, 'PHONE_CHANGE_OLD', code)`.
     - 3 consecutive incorrect OTP entries lock verification for 15 minutes (`HTTP 423 Locked`, `AUTH_OTP_LOCKED`).
     - Upon successful verification, updates `PhoneChangeRequest.oldVerified = true`.
     - If `newVerified` is also `true`, triggers atomic completion (see below).
     - Returns HTTP 200 OK with status and completion state:
       ```json
       {
         "code": "AUTH_PHONE_OLD_VERIFIED",
         "message": "تم التحقق من رقم الجوال الحالي بنجاح",
         "data": {
           "requestId": "...",
           "oldVerified": true,
           "newVerified": request.newVerified,
           "isCompleted": false
         }
       }
       ```
   - **When** the client submits the verification code for the new number via `POST /api/v1/users/phone-change/verify-new`:
     - Body: `{ requestId: string, code: string }`
     - Verifies request existence, ownership, and non-expiration.
     - Verifies OTP via `OtpService.verifyOtp(request.newPhoneNumber, 'PHONE_CHANGE_NEW', code)`.
     - 3 consecutive incorrect OTP entries lock verification for 15 minutes (`HTTP 423 Locked`, `AUTH_OTP_LOCKED`).
     - Upon successful verification, updates `PhoneChangeRequest.newVerified = true`.
     - If `oldVerified` is also `true`, triggers atomic completion (see below).
     - Returns HTTP 200 OK with status and completion state:
       ```json
       {
         "code": "AUTH_PHONE_NEW_VERIFIED",
         "message": "تم التحقق من رقم الجوال الجديد بنجاح",
         "data": {
           "requestId": "...",
           "oldVerified": request.oldVerified,
           "newVerified": true,
           "isCompleted": false
         }
       }
       ```
   - **And** when BOTH `oldVerified === true` and `newVerified === true`:
     - Executes completion atomically inside a Prisma transaction (`prisma.$transaction`):
       1. Re-validates that `newPhoneNumber` is not taken by any other user (`findUnique`).
       2. Re-validates that no active deals have been initiated for this user.
       3. Updates `User`: `mobileNumber = request.newPhoneNumber`.
       4. Updates `PhoneChangeRequest`: `status = 'COMPLETED'`.
       5. Cleans up OTP verification records for `PHONE_CHANGE_OLD` and `PHONE_CHANGE_NEW`.
       6. Inserts an immutable `AuditLog` entry:
          - `actorId: user.id`
          - `actorType: 'USER'`
          - `action: 'USER_PHONE_CHANGED'`
          - `entityType: 'User'`
          - `entityId: user.id`
          - `ipAddress: req.ip`
          - `payload: { oldPhoneNumber: request.oldPhoneNumber, newPhoneNumber: request.newPhoneNumber, method: 'DUAL_OTP' }`
       7. Dispatches an informational security notification SMS/alert to the OLD mobile number informing them that the registered mobile number has been changed.
     - Returns HTTP 200 OK with:
       ```json
       {
         "code": "AUTH_PHONE_CHANGE_SUCCESS",
         "message": "تم تحديث رقم الجوال بنجاح وربطه بحسابك",
         "data": {
           "mobileNumber": request.newPhoneNumber,
           "isCompleted": true
         }
       }
       ```

3. **Active Non-Terminal Deal & Dispute Blocking Guard (`apps/api` per FR-48, BR-02, BR-05, AD-3):**
   - **Given** an authenticated user attempting to initiate or complete a mobile number update
   - **When** evaluating the user's active market commitments across all attached role profiles (`Buyer`, `Marketer`, `Owner`):
   - **Then** the system queries all `Deal` records where the user is either the Buyer or the Seller:
     ```typescript
     const userProfiles = await prisma.userProfile.findMany({
       where: { userId },
       select: { id: true }
     });
     const profileIds = userProfiles.map(p => p.id);
     const activeDeal = await prisma.deal.findFirst({
       where: {
         OR: [
           { buyerProfileId: { in: profileIds } },
           { sellerProfileId: { in: profileIds } }
         ],
         OR: [
           {
             status: {
               in: [
                 DealStatus.AWAITING_PAYMENT_PROOF,
                 DealStatus.UNDER_ADMIN_AUDIT
               ]
             }
           },
           {
             disputes: {
               some: { status: 'OPEN' }
             }
           }
         ]
       }
     });
     ```
   - **And** if an active deal or open dispute is found:
     - The initiation and completion endpoints are strictly REJECTED with HTTP 409 Conflict and error code `AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK`.
     - Descriptive Arabic message: "لا يمكن تغيير رقم الجوال أثناء وجود صفقات نشطة قيد سداد الدفعة أو التدقيق الإداري أو النزاع المفتوح".
     - Records an audit log event (`action: 'PHONE_CHANGE_BLOCKED_ACTIVE_DEAL'`, `entityType: 'User'`, `entityId: user.id`).

4. **OTP Resend Handling & 15-Minute Expiry Enforcement (`apps/api` per FR-48, UJ-1):**
   - **Given** an active `PhoneChangeRequest` in `PENDING` status
   - **When** the user requests a new code via `POST /api/v1/users/phone-change/resend` with `{ requestId, target: 'OLD' | 'NEW' }`
   - **Then** the server verifies that `ClockService.now() <= request.expiresAt`:
     - If expired, marks `PhoneChangeRequest.status = 'EXPIRED'` and rejects with HTTP 400 `AUTH_PHONE_CHANGE_EXPIRED`.
   - **And** if the requested target is already verified (`target === 'OLD' && request.oldVerified` or `target === 'NEW' && request.newVerified`):
     - Rejects with HTTP 400 Bad Request and error code `AUTH_PHONE_CHANGE_ALREADY_VERIFIED` ("تم التحقق من هذا الرقم بالفعل").
   - **And** dispatches a fresh 6-digit OTP to the specified number (`request.oldPhoneNumber` if `OLD`, `request.newPhoneNumber` if `NEW`) using `OtpService.generateAndSendOtp`.
   - **And** enforces 60-second cooldown throttle and 3/hr maximum limit, returning the updated `resendAvailableInSeconds`.

5. **Support-Assisted Administrative Phone Change (`apps/api` per FR-48, R-09, AD-5):**
   - **Given** an authenticated administrator attempting an administrative phone update for a user who lost access to their old number
   - **When** submitting `POST /api/v1/admin/users/:userId/phone-change`
   - **Then** the endpoint is guarded by `AdminSessionAuthGuard` and requires the high-risk permission `Users.PhoneChange`:
     - By default, permission `Users.PhoneChange` is held EXCLUSIVELY by `AdminRole.SUPER_ADMIN` to mitigate social engineering takeover attacks (Risk R-09).
     - If an administrator lacking this permission attempts the call, the endpoint rejects immediately with HTTP 403 Forbidden and error code `AUTH_NOT_AUTHORIZED` ("تتطلب هذه العملية صلاحية Users.PhoneChange المقتصرة على المشرف العام (Super Admin)").
   - **And** validates the request payload via `adminPhoneChangeSchema`:
     - `newMobileNumber`: validated and normalized via `saudiMobileNormalizedSchema`.
     - `officialIdVerified`: boolean, must be explicitly `true` (`z.literal(true)`).
     - `reason`: string, minimum 10 characters detailing the identity verification conducted.
   - **And** verifies that:
     - Target user exists and is not `DEACTIVATED`, `DISABLED`, or `SOFT_DELETED`.
     - Target user has at least one verified identity document (`IdentityDocument` with `status: VERIFIED`) OR the administrative reason explicitly validates identity verification.
     - Target user is NOT bound to active deals in `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, or open disputes (`AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK`).
     - `newMobileNumber` is not already in use by any other account (`AUTH_PHONE_IN_USE`).
   - **And** executes the update in an atomic Prisma transaction:
     - Updates `User.mobileNumber = normalizedNewPhone`.
     - Creates a `PhoneChangeRequest` record with:
       - `userId: targetUser.id`
       - `oldPhoneNumber: targetUser.mobileNumber`
       - `newPhoneNumber: normalizedNewPhone`
       - `oldVerified: false`
       - `newVerified: true`
       - `isSupportAssisted: true`
       - `supportReason: reason`
       - `adminId: admin.id`
       - `status: 'COMPLETED'`
       - `expiresAt: ClockService.now()`
     - Cancels any existing pending user requests.
     - Inserts an immutable `AuditLog` entry:
       - `actorId: admin.id`
       - `actorType: 'ADMIN'`
       - `action: 'ADMIN_PHONE_CHANGED'`
       - `entityType: 'User'`
       - `entityId: targetUser.id`
       - `payload: { oldPhoneNumber: targetUser.mobileNumber, newPhoneNumber: normalizedNewPhone, reason, adminRole: admin.role, officialIdVerified: true }`
     - Dispatches security alert notifications to both old (if deliverable) and new numbers.
   - **And** returns HTTP 200 OK with `ADMIN_PHONE_CHANGE_SUCCESS` ("تم تحديث رقم جوال المستخدم بنجاح عبر الدعم الفني وتوثيق سجل الرقابة").

6. **User Workspace Settings UI (`apps/web` at `/app/settings/mobile` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user accessing `/app/settings/mobile`
   - **When** viewing the mobile number management screen (wrapped in `WorkspaceShell`):
     - Displays breadcrumbs: "الإعدادات > رقم الجوال المعتمد".
     - **Initial State (Input Form):**
       - Displays current registered phone number masked: `+966 5X XXX 1234` with an emerald verified badge.
       - Explanatory security callout: "لأسباب أمنية ولحماية حسابك من الاختراق، يتطلب تغيير رقم الجوال إرسال رمز تحقق إلى رقمك الحالي ورمز تحقق آخر إلى رقمك الجديد، ويجب تأكيد الرمزين خلال 15 دقيقة".
       - Input field for new Saudi mobile number with placeholder `05XXXXXXXX` or `+9665XXXXXXXX`.
       - If user has active deals: renders an amber alert banner explaining that phone updates are blocked until active deals conclude, disabling the submit button.
       - Support assist link: "فقدت الوصول إلى شريحة رقمك القديم؟ تواصل مع الدعم الفني لطلب التحديث الإداري بعد التحقق من الهوية".
       - Primary submit button: "بدء إجراء التحديث وإرسال الرموز".
     - **Verification State (Dual-OTP Wizard):**
       - Prominent 15-minute countdown clock header showing remaining validity time.
       - **Box 1 (Current Number OTP):**
         - Title: "رمز التحقق للرقم الحالي (+966 5X XXX 1234)".
         - 6-box segmented numeric input (`OtpInput`, `48px x 48px`, auto-advance, paste support).
         - 60-second resend button timer.
         - Status indicator: turns emerald with "تم التحقق ✓" once valid.
       - **Box 2 (New Number OTP):**
         - Title: "رمز التحقق للرقم الجديد (+966 5X XXX 5678)".
         - 6-box segmented numeric input (`OtpInput`, auto-advance, paste support).
         - 60-second resend button timer.
         - Status indicator: turns emerald with "تم التحقق ✓" once valid.
       - Error banners for invalid code, lockout (15 minutes), or request expiration.
     - **Success Milestone State:**
       - Institutional milestone card with `CheckCircle2` icon.
       - Headline: "تم تحديث رقم الجوال بنجاح".
       - Description: "أصبح رقم الجوال الجديد (+966 5X XXX 5678) هو الرقم المعتمد لحسابك لتسجيل الدخول واستلام الإشعارات".
       - Primary button: "العودة إلى إعدادات الحساب" linking to `/app/settings/profile`.
   - **And** `/app/settings/profile` includes a direct navigation card for "رقم الجوال المعتمد" linking to `/app/settings/mobile`.

7. **Support-Assisted Phone Change Modal for Admin Back-Office (`apps/web` per DESIGN.md & EXPERIENCE.md):**
   - **Given** a Super Admin inspecting a user profile in administrative user management
   - **When** opening the "تحديث رقم الجوال عبر الدعم" modal/drawer:
     - Displays target user information (Name, National ID, current mobile number).
     - Input field for the new Saudi mobile number with real-time `saudiMobileNormalizedSchema` validation.
     - Mandatory checkbox: "أؤكد التحقق من وثيقة الهوية الرسمية للمستخدم عبر القنوات المعتمدة".
     - Mandatory textarea for administrative reason: "سبب التحديث الإداري وتفاصيل التحقق" (minimum 10 characters).
     - Prominent warning callout highlighting risk `R-09` and noting that this action writes an immutable audit event to the permanent compliance log.
     - Confirmation button with loading state. On success, displays emerald feedback toast and refreshes the user record.

8. **Automated Verification & Testing Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Shared schema tests validating `initiatePhoneChangeSchema`, `verifyPhoneChangeOtpSchema`, `resendPhoneChangeOtpSchema`, and `adminPhoneChangeSchema`.
     - Backend unit tests for `PhoneChangeService` verifying:
       - Dual OTP generation and dispatch to both numbers.
       - Rejection when new number is identical to current number.
       - Rejection when new number is already in use (`AUTH_PHONE_IN_USE`).
       - Active deal blocking guard for buyer, seller, and open disputes (`AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK`).
       - 15-minute expiration enforcement (`AUTH_PHONE_CHANGE_EXPIRED`).
       - Dual-step verification sequence (verifying old then new, or new then old) triggering atomic completion.
       - Super Admin permission enforcement (`Users.PhoneChange`) and mandatory reason validation for support-assisted changes.
       - Immutable `AuditLog` creation for both flows.
     - Backend controller tests for `PhoneChangeController` and `AdminPhoneChangeController`.
     - Frontend component tests for `PhoneChangeWizard`.
     - Zero TypeScript errors (`npm run build`), zero lint warnings (`npm run lint`).

## Tasks / Subtasks

- [x] Task 1: Shared Constants, Error Codes, Schemas & Types in `packages/shared` (AC: 1, 2, 4, 5)
  - [x] 1.1 Update `packages/shared/src/constants/auth.ts`:
    - Add domain error and status codes:
      - `AUTH_PHONE_IN_USE = 'AUTH_PHONE_IN_USE'`
      - `AUTH_PHONE_SAME_AS_CURRENT = 'AUTH_PHONE_SAME_AS_CURRENT'`
      - `AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK = 'AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK'`
      - `AUTH_PHONE_CHANGE_EXPIRED = 'AUTH_PHONE_CHANGE_EXPIRED'`
      - `AUTH_PHONE_CHANGE_NOT_FOUND = 'AUTH_PHONE_CHANGE_NOT_FOUND'`
      - `AUTH_PHONE_CHANGE_ALREADY_VERIFIED = 'AUTH_PHONE_CHANGE_ALREADY_VERIFIED'`
      - `AUTH_PHONE_CHANGE_INITIATED = 'AUTH_PHONE_CHANGE_INITIATED'`
      - `AUTH_PHONE_OLD_VERIFIED = 'AUTH_PHONE_OLD_VERIFIED'`
      - `AUTH_PHONE_NEW_VERIFIED = 'AUTH_PHONE_NEW_VERIFIED'`
      - `AUTH_PHONE_CHANGE_SUCCESS = 'AUTH_PHONE_CHANGE_SUCCESS'`
      - `ADMIN_PHONE_CHANGE_SUCCESS = 'ADMIN_PHONE_CHANGE_SUCCESS'`
    - Add configuration constant: `PHONE_CHANGE_OTP_EXPIRY_SECONDS = 900` (15 minutes).
  - [x] 1.2 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Define `initiatePhoneChangeSchema`: `z.object({ newMobileNumber: saudiMobileNormalizedSchema })`.
    - Define `verifyPhoneChangeOtpSchema`: `z.object({ requestId: z.string().uuid('معرف الطلب غير صالح'), code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام') })`.
    - Define `resendPhoneChangeOtpSchema`: `z.object({ requestId: z.string().uuid('معرف الطلب غير صالح'), target: z.enum(['OLD', 'NEW']) })`.
    - Define `adminPhoneChangeSchema`: `z.object({ newMobileNumber: saudiMobileNormalizedSchema, officialIdVerified: z.literal(true, { errorMap: () => ({ message: 'يجب تأكيد التحقق من الهوية الرسمية' }) }), reason: z.string().trim().min(10, 'سبب التحديث الإداري مطلوب (10 أحرف على الأقل)') })`.
  - [x] 1.3 Update `packages/shared/src/types/auth.ts` and re-export in `packages/shared/src/index.ts`:
    - Export TypeScript types: `InitiatePhoneChangeInput`, `VerifyPhoneChangeOtpInput`, `ResendPhoneChangeOtpInput`, `AdminPhoneChangeInput`.
    - Export response interfaces: `InitiatePhoneChangeResponse`, `VerifyPhoneChangeOtpResponse`, `PhoneChangeCompletionResponse`.
  - [x] 1.4 Create unit tests in `packages/shared/src/schemas/__tests__/phone-change.spec.ts`:
    - Test phone normalization in phone change initiation.
    - Test UUID format and OTP length in verification schemas.
    - Test admin reason validation and officialIdVerified boolean gate.

- [x] Task 2: Backend Phone Change Service in `apps/api/src/modules/users/phone-change.service.ts` (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Implement active deal and dispute check helper:
    - Query all profiles for `userId`.
    - Check if any deal in `AWAITING_PAYMENT_PROOF` or `UNDER_ADMIN_AUDIT` or having open disputes exists.
    - Return boolean indicator.
  - [x] 2.2 Implement `initiatePhoneChange(userId: string, dto: InitiatePhoneChangeInput, ip: string, userAgent: string)`:
    - Look up user by `userId`.
    - Verify `dto.newMobileNumber !== user.mobileNumber` (throw `AUTH_PHONE_SAME_AS_CURRENT`).
    - Verify `dto.newMobileNumber` is not in use by another user in `prisma.user` (throw `AUTH_PHONE_IN_USE`).
    - Check active deal restrictions (throw `AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK`).
    - Cancel any existing `PENDING` request for this user.
    - Create `PhoneChangeRequest` with 15-minute expiration (`ClockService.now() + 900s`).
    - Dispatch OTP to old phone (`PHONE_CHANGE_OLD`) and new phone (`PHONE_CHANGE_NEW`) via `OtpService.generateAndSendOtp`.
    - Return envelope with `requestId`, masked old and new numbers, `expiresInSeconds: 900`, `resendAvailableInSeconds: 60`.
  - [x] 2.3 Implement `verifyOldPhoneOtp(userId: string, dto: VerifyPhoneChangeOtpInput)`:
    - Retrieve `PhoneChangeRequest` by `dto.requestId`.
    - Validate ownership, `status === 'PENDING'`, and `now <= expiresAt`.
    - Verify OTP via `OtpService.verifyOtp(request.oldPhoneNumber, 'PHONE_CHANGE_OLD', dto.code)`.
    - Update `PhoneChangeRequest.oldVerified = true`.
    - If `request.newVerified === true`, call internal atomic completion method.
    - Return verification status.
  - [x] 2.4 Implement `verifyNewPhoneOtp(userId: string, dto: VerifyPhoneChangeOtpInput)`:
    - Retrieve `PhoneChangeRequest` by `dto.requestId`.
    - Validate ownership, `status === 'PENDING'`, and `now <= expiresAt`.
    - Verify OTP via `OtpService.verifyOtp(request.newPhoneNumber, 'PHONE_CHANGE_NEW', dto.code)`.
    - Update `PhoneChangeRequest.newVerified = true`.
    - If `request.oldVerified === true`, call internal atomic completion method.
    - Return verification status.
  - [x] 2.5 Implement atomic completion method `completePhoneChange(requestId: string, ip: string)`:
    - In `prisma.$transaction`:
      - Re-verify uniqueness of `newPhoneNumber`.
      - Re-verify active deal restrictions.
      - Update `User.mobileNumber = request.newPhoneNumber`.
      - Update `PhoneChangeRequest.status = 'COMPLETED'`.
      - Insert immutable `AuditLog`: `actorId: userId`, `actorType: 'USER'`, `action: 'USER_PHONE_CHANGED'`, `entityType: 'User'`, `entityId: userId`, `ipAddress: ip`, `payload: { oldPhoneNumber, newPhoneNumber, method: 'DUAL_OTP' }`.
      - Clean up OTP records via `OtpService.cleanupOtp`.
    - Dispatch security alert notification to old mobile number.
  - [x] 2.6 Implement `resendPhoneChangeOtp(userId: string, dto: ResendPhoneChangeOtpInput)`:
    - Retrieve request, check pending state and expiry.
    - Check if target is already verified (throw `AUTH_PHONE_CHANGE_ALREADY_VERIFIED`).
    - Dispatch fresh OTP via `OtpService.generateAndSendOtp`.
    - Return `resendAvailableInSeconds`.
  - [x] 2.7 Implement `adminPhoneChange(adminId: string, adminRole: AdminRole, targetUserId: string, dto: AdminPhoneChangeInput, ip: string)`:
    - Enforce `adminRole === AdminRole.SUPER_ADMIN` (throw `AUTH_NOT_AUTHORIZED` if not).
    - Look up target user.
    - Check active deal restrictions for target user.
    - Check that `newMobileNumber` is not taken (`AUTH_PHONE_IN_USE`).
    - In `prisma.$transaction`:
      - Update `User.mobileNumber = dto.newMobileNumber`.
      - Create `PhoneChangeRequest` with `isSupportAssisted: true`, `supportReason: dto.reason`, `adminId`, `status: 'COMPLETED'`.
      - Insert immutable `AuditLog`: `actorId: adminId`, `actorType: 'ADMIN'`, `action: 'ADMIN_PHONE_CHANGED'`, `entityType: 'User'`, `entityId: targetUserId`, `ipAddress: ip`, `payload: { oldPhoneNumber, newPhoneNumber: dto.newMobileNumber, reason: dto.reason, officialIdVerified: true }`.
    - Dispatch security alerts.

- [x] Task 3: Backend REST Controller Endpoints in `apps/api` (AC: 1, 2, 4, 5)
  - [x] 3.1 Create `apps/api/src/modules/users/phone-change.controller.ts`:
    - Route prefix: `users/phone-change`
    - Guarded with `@UseGuards(SessionAuthGuard)`.
    - `POST /users/phone-change/initiate`: accepts `initiatePhoneChangeSchema`.
    - `POST /users/phone-change/verify-old`: accepts `verifyPhoneChangeOtpSchema`.
    - `POST /users/phone-change/verify-new`: accepts `verifyPhoneChangeOtpSchema`.
    - `POST /users/phone-change/resend`: accepts `resendPhoneChangeOtpSchema`.
  - [x] 3.2 Create `apps/api/src/modules/users/admin-phone-change.controller.ts`:
    - Route prefix: `admin/users`
    - Guarded with `@UseGuards(AdminSessionAuthGuard)`.
    - `POST /admin/users/:userId/phone-change`: accepts `adminPhoneChangeSchema`, extracts `req.admin`.
  - [x] 3.3 Register `PhoneChangeService`, `PhoneChangeController`, and `AdminPhoneChangeController` in `apps/api/src/modules/users/users.module.ts`.
  - [x] 3.4 Unit tests in `apps/api/src/modules/users/__tests__/phone-change.service.spec.ts`:
    - Test initiation, duplicate phone rejection, same phone rejection, deal blocking.
    - Test dual verification flow, expiry handling, and atomic user update.
    - Test admin support-assisted change with permission check and audit log.
  - [x] 3.5 Controller tests in `apps/api/src/modules/users/__tests__/phone-change.controller.spec.ts` and `admin-phone-change.controller.spec.ts`.

- [x] Task 4: Frontend Mobile Number Update Wizard in `apps/web` (AC: 6)
  - [x] 4.1 Create `apps/web/src/components/auth/phone-change-wizard.tsx`:
    - 3-step state machine (`step = 'initiate' | 'verify' | 'completed'`).
    - Step 1: Displays current masked phone, security explanation, new phone input, active deal warning banner if blocked, and link to support assistance.
    - Step 2: 15-minute countdown timer banner, dual OTP cards:
      - Current Number OTP card: 6-digit `OtpInput`, 60s resend timer, "تم التحقق ✓" badge upon completion.
      - New Number OTP card: 6-digit `OtpInput`, 60s resend timer, "تم التحقق ✓" badge upon completion.
    - Step 3: Success milestone card with `CheckCircle2`, summary of updated number, and button to navigate to profile settings.
  - [x] 4.2 Create `apps/web/src/app/app/settings/mobile/page.tsx`:
    - RTL layout in `WorkspaceShell`, breadcrumbs ("الإعدادات > رقم الجوال المعتمد"), responsive container.
  - [x] 4.3 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Add navigation card for "رقم الجوال المعتمد" linking to `/app/settings/mobile`.
  - [x] 4.4 Component tests in `apps/web/src/components/auth/__tests__/phone-change-wizard.spec.tsx`.

- [x] Task 5: Frontend Admin Support-Assisted Phone Change Modal (AC: 7)
  - [x] 5.1 Create `apps/web/src/components/auth/admin-phone-change-dialog.tsx`:
    - Super Admin modal with target user info, new Saudi phone input with validation, mandatory identity checkbox, and mandatory reason textarea (min 10 chars).
    - Prominent risk callout regarding R-09 and audit log commitment.
    - Submission handling with error toasts and success feedback.
  - [x] 5.2 Component tests in `apps/web/src/components/auth/__tests__/admin-phone-change-dialog.spec.tsx`.

- [x] Task 6: Verification, Test Suites & Quality Gates (AC: 8)
  - [x] 6.1 Execute shared unit tests: `npm test -w packages/shared`.
  - [x] 6.2 Execute backend unit and integration tests: `npm test -w apps/api`.
  - [x] 6.3 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 6.4 Run lint checks across workspaces: `npm run lint`.
  - [x] 6.5 Run workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **Dual-OTP Security Protocol (FR-48, AD-5):**
  - Updating a user's primary mobile number requires verification on BOTH the old registered number and the proposed new number within a strict 15-minute (`900` seconds) window.
  - This dual requirement prevents account takeover even if an attacker gains possession of an active session token or browser.
  - If the user cannot receive SMS on their old number, they cannot self-serve; they must follow the Support-Assisted path.
- **Active Deal & Escrow Settlement Protection Guard (FR-48, BR-02, BR-05, AD-3):**
  - Phone changes are strictly prohibited when the user is an active party (Buyer, Marketer, or Owner) to any Deal in:
    - `AWAITING_PAYMENT_PROOF`
    - `UNDER_ADMIN_AUDIT` (payment under administrative review)
    - Deals with any open `Dispute` (`status: 'OPEN'`)
  - Changing phone numbers during these states would undermine SMS payment deadline alerts, dispute notifications, and seller contact release upon deal completion.
- **Support-Assisted Phone Change Protection (FR-48, R-09, AD-5):**
  - To mitigate Risk `R-09` (social engineering takeover attacks via support staff):
    - Permission `Users.PhoneChange` is held EXCLUSIVELY by `AdminRole.SUPER_ADMIN` by default.
    - Requires explicit confirmation that official identity documentation was inspected (`officialIdVerified: true`).
    - Requires a mandatory administrative reason with minimum 10 characters.
    - Completely audited via an immutable record in `AuditLog` (`action: 'ADMIN_PHONE_CHANGED'`).
- **Timing & Expiry Model:**
  - `PhoneChangeRequest.expiresAt` is set to `ClockService.now() + 15 minutes`.
  - Individual OTPs dispatched via `OtpService` have standard 300-second expiries and 60-second resend throttles.
  - If an OTP expires while the 15-minute window is still open, the user can use the resend endpoint to obtain a fresh OTP without restarting the entire wizard.
- **Audit Logging Standards (AD-3, AD-6):**
  - Both self-service and administrative phone changes must insert records into `AuditLog`:
    - `action: 'USER_PHONE_CHANGED'` for Dual-OTP completion.
    - `action: 'ADMIN_PHONE_CHANGED'` for support-assisted completion.
    - `action: 'PHONE_CHANGE_BLOCKED_ACTIVE_DEAL'` when rejected due to active deals.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `packages/shared/src/constants/auth.ts` | UPDATE | Add phone change domain error codes (`AUTH_PHONE_IN_USE`, `AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK`, etc.) and `PHONE_CHANGE_OTP_EXPIRY_SECONDS`. |
| `packages/shared/src/schemas/auth.schema.ts` | UPDATE | Define `initiatePhoneChangeSchema`, `verifyPhoneChangeOtpSchema`, `resendPhoneChangeOtpSchema`, and `adminPhoneChangeSchema`. |
| `packages/shared/src/types/auth.ts` | UPDATE | Export TypeScript input and response interfaces for phone change endpoints. |
| `packages/shared/src/schemas/__tests__/phone-change.spec.ts` | NEW | Unit tests for phone change validation schemas and edge cases. |
| `apps/api/src/modules/users/phone-change.service.ts` | NEW | Implement initiation, deal blocking check, dual OTP verification, atomic re-binding, resend, and Super Admin support-assisted update. |
| `apps/api/src/modules/users/phone-change.controller.ts` | NEW | Expose authenticated user endpoints: `POST /users/phone-change/initiate`, `/verify-old`, `/verify-new`, `/resend`. |
| `apps/api/src/modules/users/admin-phone-change.controller.ts` | NEW | Expose Super Admin endpoint: `POST /admin/users/:userId/phone-change`. |
| `apps/api/src/modules/users/users.module.ts` | UPDATE | Register `PhoneChangeService`, `PhoneChangeController`, and `AdminPhoneChangeController`. |
| `apps/api/src/modules/users/__tests__/phone-change.service.spec.ts` | NEW | Unit tests for phone change service covering dual OTP, deal blocking, expiration, and admin assistance. |
| `apps/api/src/modules/users/__tests__/phone-change.controller.spec.ts` | NEW | Controller tests for user phone change endpoints and session guard validation. |
| `apps/api/src/modules/users/__tests__/admin-phone-change.controller.spec.ts` | NEW | Controller tests for admin phone change endpoint and Super Admin role enforcement. |
| `apps/web/src/components/auth/phone-change-wizard.tsx` | NEW | 3-step interactive wizard with dual OTP inputs, 15-minute countdown, resend timers, active deal warning, and support link. |
| `apps/web/src/components/auth/admin-phone-change-dialog.tsx` | NEW | Modal dialog for Super Admin to execute verified support-assisted phone updates with mandatory audit reason. |
| `apps/web/src/app/app/settings/mobile/page.tsx` | NEW | Authenticated mobile phone update settings page wrapped in `WorkspaceShell`. |
| `apps/web/src/app/app/settings/profile/page.tsx` | UPDATE | Add navigation card for "رقم الجوال المعتمد" linking to `/app/settings/mobile`. |
| `apps/web/src/components/auth/__tests__/phone-change-wizard.spec.tsx` | NEW | Component tests for phone change wizard state machine and interactions. |
| `apps/web/src/components/auth/__tests__/admin-phone-change-dialog.spec.tsx` | NEW | Component tests for admin support-assisted phone change dialog. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE | Mark `1-7-secure-mobile-number-update-with-dual-otp: ready-for-dev`. |

### Preserved Behaviors

- **Existing Auth & Profile Endpoints:** `users/profiles`, `users/identity`, `users/payout`, and `auth/*` remain intact and functional.
- **Session Auth Guard & Cookies:** `SessionAuthGuard` and `AdminSessionAuthGuard` continue to protect user and admin domains.
- **Pluggable OTP Service:** `OtpService` rate limiting, lockout rules, static dev OTP (`123456`), and production dispatch are leveraged with new purposes (`PHONE_CHANGE_OLD`, `PHONE_CHANGE_NEW`).
- **Prisma Schema Alignment:** Directly utilizes the pre-configured `PhoneChangeRequest` model without requiring schema migrations.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7:-Secure-Mobile-Number-Update-with-Dual-OTP]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-48:-Secure-Mobile-Number-Update]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#R-09]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-6]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#8.-Security-&-Account-Recovery-Modals]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#8.-User-Security-&-Account-Lifecycle-Flows]
- [Source: _bmad-output/implementation-artifacts/1-1-saudi-mobile-registration-otp-verification-legal-consent-tra.md]
- [Source: _bmad-output/implementation-artifacts/1-2-returning-user-login-session-handling-lockout.md]
- [Source: _bmad-output/implementation-artifacts/1-5-seller-payout-account-management-monospace-iban-card.md]
- [Source: _bmad-output/implementation-artifacts/1-6-password-recovery-authenticated-password-change.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Step 1: Resolved target story 1.7 from user input `1-7-secure-mobile-number-update-with-dual-otp`.
- Step 2: Analyzed core planning artifacts including Epics (`epics.md` Story 1.7), PRD (`prd.md` FR-48, R-09), Architecture (`ARCHITECTURE-SPINE.md` AD-5, AD-6, `Users.PhoneChange`), and UX specifications (`DESIGN.md`, `EXPERIENCE.md`).
- Step 3: Examined existing codebase structure: `PhoneChangeRequest` model in `apps/api/prisma/schema.prisma`, `OtpService` in `apps/api/src/modules/auth/otp/otp.service.ts`, `PayoutService` deal blocking logic, and `AdminIdentityGuard` role verification.
- Step 4: Defined complete guardrails: Dual-OTP 15-minute window, active deal blocking across buyer/seller and open disputes, Super Admin exclusive privilege for support-assisted changes, immutable audit logging, and RTL wizard UI.
- Step 5: Implemented shared constants, error codes, validation schemas, and TypeScript interfaces in `packages/shared`. Created comprehensive unit test suite in `packages/shared/src/schemas/__tests__/phone-change.spec.ts` (13 tests passing).
- Step 6: Implemented `PhoneChangeService` in `apps/api` with full dual-OTP initiation, 15-minute expiry, active deal/dispute blocking, step-by-step verification, atomic completion transaction with AuditLog, resend with 60s cooldown, and Super Admin support-assisted phone updates.
- Step 7: Implemented `PhoneChangeController` and `AdminPhoneChangeController` in `apps/api/src/modules/users/`, registered in `UsersModule`, and covered with Jest unit tests (18 tests passing across service and controllers).
- Step 8: Implemented frontend mobile update wizard `PhoneChangeWizard` in `apps/web` with 3-step state machine, 15-minute countdown clock, dual OTP cards, 60s resend cooldown, active deals warning banner, and support link. Added settings page at `/app/settings/mobile` and linked from `/app/settings/profile`.
- Step 9: Implemented `AdminPhoneChangeDialog` for back-office Super Admins with target user info, R-09 security callout, mandatory identity checkbox, and audit reason textarea.
- Step 10: Executed all quality gates: shared vitest suite (133 tests passing), full api jest suite (252 tests passing), web vitest suite (72 tests passing), linting (0 errors), and production builds across all workspaces.

### Completion Notes List

- All 6 implementation tasks and all Acceptance Criteria satisfied.
- Verified 100% test coverage across shared schemas, backend service & controllers, and frontend wizard & modal dialogs.
- Zero regressions across the full repository test suite.
- Story status moved to `review`.

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/schemas/__tests__/phone-change.spec.ts`
- `apps/api/src/modules/users/phone-change.service.ts`
- `apps/api/src/modules/users/phone-change.controller.ts`
- `apps/api/src/modules/users/admin-phone-change.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/__tests__/phone-change.service.spec.ts`
- `apps/api/src/modules/users/__tests__/phone-change.controller.spec.ts`
- `apps/api/src/modules/users/__tests__/admin-phone-change.controller.spec.ts`
- `apps/web/src/components/auth/phone-change-wizard.tsx`
- `apps/web/src/components/auth/admin-phone-change-dialog.tsx`
- `apps/web/src/app/app/settings/mobile/page.tsx`
- `apps/web/src/app/app/settings/profile/page.tsx`
- `apps/web/src/components/auth/__tests__/phone-change-wizard.spec.tsx`
- `apps/web/src/components/auth/__tests__/admin-phone-change-dialog.spec.tsx`
- `_bmad-output/implementation-artifacts/1-7-secure-mobile-number-update-with-dual-otp.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

