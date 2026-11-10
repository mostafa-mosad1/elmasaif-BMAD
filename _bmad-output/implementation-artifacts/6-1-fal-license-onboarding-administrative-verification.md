---
baseline_commit: d7733ac
---

# Story 6.1: Fal License Onboarding & Administrative Verification

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a licensed real estate broker or marketer applicant,
I want to submit my official REGA Fal license certificate, license number, future expiration date, commercial name, 10-digit Commercial Registration (CR), and supporting documents for administrative review under task claim locking,
so that I can undergo institutional compliance verification, receive administrative approval or corrective feedback, and become authorized to publish and manage real estate listings on the platform.

## Acceptance Criteria

1. **Marketer Fal License Onboarding & Client/Server Validation (`FR-6`, `UJ-2`, `UC-04`):**
   - **Given** an authenticated user wishing to activate or upgrade to the `Marketer` role (`UserRole.MARKETER`)
   - **When** navigating to the Marketer Onboarding workspace (`/app/marketer/onboarding` or `/app/marketer/fal-license`) or submitting via `POST /api/v1/users/fal-license`:
   - **Then** the endpoint accepts and strictly validates the submission payload:
     - `licenseNumber`: Valid Saudi REGA Fal license number (string of 10 to 12 digits, regex `/^\d{10,12}$/`). Duplicate active license numbers are rejected with `409 Conflict` (`FAL_LICENSE_ALREADY_EXISTS`).
     - `certificateUrl`: Valid document key or storage path (uploaded via `StorageService` to quarantine partition, scanned and clean).
     - `expiryDate`: ISO date-time string strictly in the future (`expiryDate > ClockService.now()`). Expiration dates in the past or on the current date are rejected immediately on both client and server with HTTP `400 Bad Request` and error code `FAL_EXPIRED_DATE` ("تاريخ انتهاء رخصة فال يجب أن يكون في المستقبل").
     - `commercialName`: Commercial / brokerage office name under license (string, 3–100 characters).
     - `crNumber`: 10-digit Saudi Commercial Registration number (regex `/^\d{10}$/`). Invalid CR formats return `400 Bad Request` (`FAL_INVALID_CR_NUMBER`).
     - `supportingDocumentUrls`: Optional array of up to 5 storage keys/paths for supporting documents (e.g. power of attorney, commercial register certificate, REGA authorization letters).
   - **And** within an atomic Prisma `$transaction`:
     - Creates or updates `UserProfile` with `role = UserRole.MARKETER` and `status = ProfileStatus.UNDER_REVIEW`.
     - Upserts `FalLicense`:
       - `licenseNumber = body.licenseNumber`
       - `certificateUrl = body.certificateUrl`
       - `expiryDate = new Date(body.expiryDate)`
       - `commercialName = body.commercialName`
       - `crNumber = body.crNumber`
       - `supportingDocumentUrls = body.supportingDocumentUrls || []`
       - `status = ProfileStatus.UNDER_REVIEW`
       - `rejectionReason = null`
       - `reviewedByAdminId = null`
       - `reviewedAt = null`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Inserts an immutable `AuditLog` entry:
       - `actorId = user.id`, `actorType = 'USER'`, `action = 'FAL_LICENSE_SUBMITTED'`, `entityType = 'FalLicense'`, `entityId = falLicense.id`.
     - Returns HTTP `201 Created` (or `200 OK` on resubmission) with `{ statusCode: 201, message: 'تم إرسال طلب اعتماد رخصة فال بنجاح وجارٍ التدقيق الإداري', data: falLicense }`.

2. **Admin Licensing Queue Listing & Filtering (`Licenses.Review`, `FR-6`, `FR-51`, `AD-10`):**
   - **Given** an authenticated administrator with permission `Licenses.Review` (such as `SUPER_ADMIN`, `MODERATOR`, or `COMPLIANCE_OFFICER`)
   - **When** querying the Admin Licensing Queue screen (`/admin/licenses` or `GET /api/v1/admin/licenses`):
   - **Then** the endpoint returns a paginated list of Fal license applications:
     - Filters by status: defaults to `UNDER_REVIEW`, with options for `ACTIVE`, `REJECTED`, `COMPLIANCE_RESTRICTED`, `RENEWAL_UNDER_REVIEW`.
     - Search query: matches license number, commercial name, CR number, or applicant full name / phone.
     - Ordering: oldest submission first (`createdAt ASC` or `updatedAt ASC`) to ensure first-in, first-reviewed SLA compliance.
     - Each item in the queue includes: `id`, `licenseNumber`, `commercialName`, `crNumber`, `expiryDate`, `status`, `createdAt`, `updatedAt`, `applicantName`, `applicantPhone`, `applicantNationalId`, and current task lock information (`isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminId`, `lockedByAdminName`, `lockedAt`, `lockExpiresAt`, `remainingSeconds`).
     - Expired locks (`lockExpiresAt <= ClockService.now()`) are dynamically evaluated and presented as unlocked / available for claiming.

3. **Exclusive 15-Minute Task Claim Lease Acquisition (`FR-51`, `AD-10`):**
   - **Given** an authenticated administrator with `Licenses.Review` permission
   - **When** claiming an application for review (`POST /api/v1/admin/licenses/:id/claim`):
   - **Then** the backend atomically verifies lock status:
     - If the license review is unlocked (`lockedByAdminId == null` or `lockExpiresAt <= ClockService.now()`) OR already locked by the calling admin (`lockedByAdminId === admin.id`):
       - Acquires/extends a 15-minute lease (`15 * 60 * 1000` ms) using `ClockService.now()`.
       - Sets `lockedByAdminId = admin.id`, `lockedAt = now`, `lockExpiresAt = now + 15 minutes`.
       - Inserts `AuditLog`: `action = 'FAL_LICENSE_CLAIMED'`, `actorId = admin.id`, `actorType = 'ADMIN'`, `entityType = 'FalLicense'`.
       - Returns HTTP `200 OK` with updated lock metadata.
     - If actively leased by another administrator (`lockedByAdminId !== admin.id` AND `lockExpiresAt > ClockService.now()`):
       - Rejects with HTTP `409 Conflict` and error code `LICENSE_LOCK_CONFLICT` ("طلب الترخيص قيد المراجعة حالياً من قبل مشرف آخر"), returning `lockedByAdminId`, `lockedByAdminName`, `lockedAt`, and `lockExpiresAt`.

4. **5-Minute Client Heartbeat Renewal & Explicit Lock Release (`FR-51`, `AD-10`):**
   - **Given** an administrator actively holding a claim lock on the review screen (`/admin/licenses/:id`)
   - **When** the review page remains active:
     - Client automatically dispatches a heartbeat request (`POST /api/v1/admin/licenses/:id/heartbeat`) every 5 minutes (`300_000` ms).
     - The endpoint verifies `lockedByAdminId === admin.id` and `lockExpiresAt > ClockService.now()`.
     - Extends `lockExpiresAt = ClockService.now() + 15 minutes` and returns the new expiry.
     - If the lock has expired or was force-unlocked, rejects with HTTP `409 Conflict` (`LICENSE_LOCK_EXPIRED`).
   - **And** when the admin navigates away or clicks "Release Task" (`POST /api/v1/admin/licenses/:id/release`):
     - Clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`.
     - Inserts `AuditLog`: `action = 'FAL_LICENSE_RELEASED'`.

5. **Super Admin Force-Unlock Override (`Tasks.ForceUnlock`, `AD-10`):**
   - **Given** an administrator with `Tasks.ForceUnlock` permission (`SUPER_ADMIN`)
   - **When** an application is locked by another operator and the Super Admin submits a force-unlock request (`POST /api/v1/admin/licenses/:id/force-unlock` with `{ reason: string }` min 5 chars):
   - **Then** the backend:
     - Verifies `Tasks.ForceUnlock` permission.
     - Clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`.
     - Inserts `AuditLog`: `action = 'FAL_LICENSE_FORCE_UNLOCKED'`, `actorId = superAdmin.id`, `actorType = 'ADMIN'`, `entityType = 'FalLicense'`, recording `previousLockHolderId` and `reason`.
     - Returns HTTP `200 OK`.

6. **Application Inspection & Secure Document Access (`Licenses.Review`, `NFR-2`):**
   - **Given** an administrator viewing the license verification screen (`GET /api/v1/admin/licenses/:id`)
   - **Then** the endpoint returns complete application details:
     - License credentials: `licenseNumber`, `commercialName`, `crNumber`, `expiryDate`, `status`, `rejectionReason`.
     - Marketer applicant profile: `fullName`, `phoneNumber`, `nationalId` (if uploaded), `createdAt`.
     - Document access: Mints short-lived presigned download URLs (`<= 300` seconds / 5 minutes) on demand via `StorageService.getVerifiedDownloadUrl` for `certificateUrl` and all `supportingDocumentUrls`. Presigned URLs are NEVER stored in the database.
     - Lock state: `isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminName`, `lockedAt`, `lockExpiresAt`, `remainingSeconds`.
   - **And** if Admin B opens the detail view while Admin A holds an active lease:
     - An amber read-only banner (`bg-amber-50 border-amber-300 text-amber-900`) displays Admin A's name and a live countdown timer (`MM:SS` in `JetBrains Mono`).
     - All mutation action buttons (Approve, Reject, Release) are disabled for Admin B.

7. **Administrative Approval Decision (`Licenses.Review`, `FR-6`, `AD-10`):**
   - **Given** an administrator holding the active claim lock on an application in `UNDER_REVIEW` (or `RENEWAL_UNDER_REVIEW`)
   - **When** submitting an approval via `POST /api/v1/admin/licenses/:id/approve` with `{ version: number }`:
   - **Then** the backend verifies:
     1. The license status is `UNDER_REVIEW` or `RENEWAL_UNDER_REVIEW` (otherwise `400 Bad Request` `LICENSE_INVALID_STATE`).
     2. The caller holds an active, non-expired claim lock (`lockedByAdminId === admin.id && lockExpiresAt > ClockService.now()`, otherwise `409 Conflict` `LICENSE_LOCK_REQUIRED`).
     3. Optimistic concurrency `version` matches the database record (`409 Conflict` `LICENSE_VERSION_CONFLICT`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - `status = ProfileStatus.ACTIVE`
       - `reviewedByAdminId = admin.id`
       - `reviewedAt = ClockService.now()`
       - `rejectionReason = null`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Updates the applicant's `UserProfile`:
       - `status = ProfileStatus.ACTIVE`
     - Inserts `AuditLog`:
       - `action = 'FAL_LICENSE_APPROVED'`, `actorId = admin.id`, `actorType = 'ADMIN'`, `entityType = 'FalLicense'`, `entityId = falLicense.id`.
     - Dispatches notification/event `fal.license_approved` to the applicant.
     - Returns HTTP `200 OK` with `{ statusCode: 200, message: 'تم اعتماد رخصة فال وتفعيل حساب المسوق بنجاح' }`.
   - **And** the user is now permitted to switch to `UserRole.MARKETER` via `POST /api/v1/users/profiles/switch` and access `/app/marketer`.

8. **Administrative Rejection Decision with Mandatory Feedback (`Licenses.Review`, `FR-6`, `AD-10`):**
   - **Given** an administrator holding the active claim lock on an application in `UNDER_REVIEW`
   - **When** submitting a rejection via `POST /api/v1/admin/licenses/:id/reject` with `{ rejectionReason: string, version: number }`:
   - **Then** the backend verifies:
     1. `rejectionReason` is provided and contains at least 10 characters (trimmed).
     2. The license status is `UNDER_REVIEW` (or `RENEWAL_UNDER_REVIEW`).
     3. Active claim lock is held by the caller and not expired.
     4. `version` matches.
   - **And** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - `status = ProfileStatus.REJECTED`
       - `rejectionReason = body.rejectionReason.trim()`
       - `reviewedByAdminId = admin.id`
       - `reviewedAt = ClockService.now()`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Updates applicant's `UserProfile`:
       - `status = ProfileStatus.SUSPENDED` (or `REJECTED`)
     - Inserts `AuditLog`:
       - `action = 'FAL_LICENSE_REJECTED'`, `actorId = admin.id`, `actorType = 'ADMIN'`, `entityType = 'FalLicense'`, payload `{ rejectionReason }`.
     - Dispatches notification/event `fal.license_rejected` to the applicant containing `rejectionReason`.
     - Returns HTTP `200 OK` with `{ statusCode: 200, message: 'تم رفض طلب اعتماد رخصة فال مع توثيق سبب الرفض للمستخدم' }`.

9. **Applicant Re-Submission Workflow (`UC-05A`, `FR-6`):**
   - **Given** an applicant whose Fal license was rejected (`status === 'REJECTED'`)
   - **When** visiting `/app/marketer/onboarding`:
   - **Then** the page renders an alert box displaying the administrative rejection rationale (`rejectionReason`) in clear Arabic text, with pre-filled previous inputs.
   - **And** when submitting corrected details (new certificate or updated CR/date):
     - Re-submitting calls `POST /api/v1/users/fal-license`.
     - Atomically transitions `FalLicense.status = ProfileStatus.UNDER_REVIEW` and `UserProfile.status = ProfileStatus.UNDER_REVIEW`.
     - Clears previous rejection details and re-queues the application in the Admin Licensing Queue.

10. **Frontend User & Admin Experiences (`apps/web` per `EXPERIENCE.md`):**
    - **Marketer Onboarding Screen (`apps/web/src/app/app/marketer/onboarding/page.tsx`):**
      - Responsive Arabic RTL form adhering to `DESIGN.md`.
      - Certificate drag-and-drop file upload with progress bar (PDF, JPEG, PNG <= 10MB).
      - Future date picker with `minDate = tomorrow` prohibiting past dates.
      - 10-digit CR input formatted with numeric keypad on mobile.
      - Dynamic state presentation:
        - `UNDER_REVIEW`: Informative pending banner ("طلبك قيد المراجعة من قبل إدارة المنصة").
        - `REJECTED`: Alert card with red border, rejection notes, and editable form for re-submission.
        - `ACTIVE`: Congratulatory green card with verified badge and CTA button "الانتقال إلى مساحة المسوق".
    - **Admin Licensing Queue Screen (`apps/web/src/app/admin/licenses/page.tsx`):**
      - Filter tabs (`قيد المراجعة`, `المعتمدة`, `المرفوضة`, `الكل`), search input, and pagination.
      - Table listing applicants, commercial names, CR numbers, Fal numbers, expiry dates, submission timestamps, and lock badges.
      - Action button: "مراجعة وتدقيق" triggering claim and redirecting to detail view.
    - **Admin License Verification Detail Screen (`apps/web/src/app/admin/licenses/[id]/page.tsx`):**
      - Document viewer / download action for Fal certificate and supporting docs.
      - Applicant identity and contact card.
      - 15-minute lease countdown timer with automatic 5-minute heartbeat renewal.
      - Amber banner if leased by another administrator.
      - Super Admin "Force Unlock" action modal.
      - "اعتماد الرخصة" (Approve) button with confirmation modal.
      - "رفض الطلب" (Reject) button opening a modal with mandatory 10+ character rejection note.

## Tasks / Subtasks

- [x] **Task 1: Prisma Schema Enhancements & DB Push (`apps/api/prisma`)** (AC: #1, #7, #8)
  - [x] 1.1 Inspect `model FalLicense` in `apps/api/prisma/schema.prisma` (lines 289–308).
  - [x] 1.2 Add required fields to `FalLicense`:
    - `rejectionReason String? @map("rejection_reason")`
    - `reviewedByAdminId String? @map("reviewed_by_admin_id")`
    - `reviewedAt DateTime? @map("reviewed_at")`
    - `supportingDocumentUrls String[] @default([]) @map("supporting_document_urls")`
    - `version Int @default(1)`
  - [x] 1.3 Add enum values `REJECTED` and `RENEWAL_UNDER_REVIEW` to `ProfileStatus` in `schema.prisma` (if not present) and update relations.
  - [x] 1.4 Execute `npm run prisma:push` (ensures `prisma/sql/deal-invariants.sql` is preserved; never bare `prisma db push`) and `npm run prisma:generate`.

- [x] **Task 2: Shared Constants, Enums, Zod Schemas & Types (`packages/shared`)** (AC: #1, #2, #3, #7, #8)
  - [x] 2.1 Update `packages/shared/src/enums/index.ts`:
    - Ensure `ProfileStatus` exports `REJECTED = 'REJECTED'` and `RENEWAL_UNDER_REVIEW = 'RENEWAL_UNDER_REVIEW'`.
  - [x] 2.2 Create `packages/shared/src/constants/licensing.ts`:
    - `FAL_LOCK_DURATION_MINUTES = 15`
    - `FAL_LOCK_DURATION_MS = 15 * 60 * 1000`
    - `FAL_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000`
    - Error codes: `FAL_EXPIRED_DATE`, `FAL_INVALID_CR_NUMBER`, `FAL_LICENSE_ALREADY_EXISTS`, `FAL_INVALID_LICENSE_NUMBER`, `LICENSE_LOCK_CONFLICT`, `LICENSE_LOCK_REQUIRED`, `LICENSE_LOCK_EXPIRED`, `LICENSE_VERSION_CONFLICT`, `LICENSE_INVALID_STATE`, `LICENSE_REJECTION_REASON_REQUIRED`, `LICENSE_NOT_FOUND`.
  - [x] 2.3 Create `packages/shared/src/schemas/licensing.schema.ts`:
    - `submitFalLicenseSchema`: `{ licenseNumber: z.string().regex(/^\d{10,12}$/), certificateUrl: z.string().min(1), expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)), commercialName: z.string().trim().min(3).max(100), crNumber: z.string().regex(/^\d{10}$/), supportingDocumentUrls: z.array(z.string()).max(5).optional() }`
    - `licensingQueueQuerySchema`: `{ status?: ProfileStatus, search?: string, page?: z.coerce.number().int().min(1).default(1), limit?: z.coerce.number().int().min(1).max(50).default(20) }`
    - `approveFalLicenseSchema`: `{ version: z.number().int().positive() }`
    - `rejectFalLicenseSchema`: `{ version: z.number().int().positive(), rejectionReason: z.string().trim().min(10, 'سبب الرفض يجب ألا يقل عن 10 أحرف').max(1000) }`
    - `forceUnlockFalLicenseSchema`: `{ reason: z.string().trim().min(5, 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف').max(500) }`
  - [x] 2.4 Create `packages/shared/src/types/licensing.ts` defining input and response types (`SubmitFalLicenseInput`, `LicensingQueueQuery`, `ApproveFalLicenseInput`, `RejectFalLicenseInput`, `ForceUnlockFalLicenseInput`, `FalLicenseDetailResponse`, `FalLockInfo`).
  - [x] 2.5 Export all licensing items from `packages/shared/src/index.ts` and build shared package: `npm run build --workspace=@elmasaif/shared`.
  - [x] 2.6 Add unit tests in `packages/shared/src/schemas/__tests__/licensing.schema.spec.ts`.

- [x] **Task 3: Backend User Fal Onboarding Module & Endpoints (`apps/api/src/modules/licenses`)** (AC: #1, #9)
  - [x] 3.1 Create `apps/api/src/modules/licenses/licenses.service.ts`:
    - `submitFalLicense(userId: string, input: SubmitFalLicenseInput)`:
      - Validates `expiryDate > clockService.now()`, throws `BadRequestException` (`FAL_EXPIRED_DATE`) if past/today.
      - Checks uniqueness of `licenseNumber` across other profiles (throws `FAL_LICENSE_ALREADY_EXISTS` on collision).
      - Upserts `UserProfile` (`role: MARKETER`, `status: UNDER_REVIEW`).
      - Upserts `FalLicense` with status `UNDER_REVIEW`, reset lock fields, increment version.
      - Creates `AuditLog` (`FAL_LICENSE_SUBMITTED`).
    - `getMyFalLicense(userId: string)`:
      - Retrieves current user's marketer profile and `FalLicense` with signed URLs for certificate and documents.
  - [x] 3.2 Create `apps/api/src/modules/licenses/licenses.controller.ts`:
    - `POST /api/v1/users/fal-license` (`@UseGuards(SessionAuthGuard)`)
    - `GET /api/v1/users/fal-license` (`@UseGuards(SessionAuthGuard)`)
  - [x] 3.3 Register controller, service, and exports in `apps/api/src/modules/licenses/licenses.module.ts` and import in `apps/api/src/app.module.ts`.

- [x] **Task 4: Backend Admin Licensing Queue & Claim Locking Service (`apps/api/src/modules/licenses`)** (AC: #2, #3, #4, #5, #6, #7, #8)
  - [x] 4.1 Create `apps/api/src/modules/licenses/admin-licenses.service.ts`:
    - `getLicensingQueue(query, currentAdminId)`: Paginated query with search, status filtering, and resolved active locks (`isLocked`, `lockedByAdminName`, `remainingSeconds`).
    - `getLicenseDetail(licenseId, currentAdminId)`: Returns full record with <= 300s presigned download URLs via `StorageService.getVerifiedDownloadUrl` for certificate and all supporting docs, plus lock info.
    - `claimLicense(licenseId, admin)`: Verifies unlocked or held by same admin; acquires 15m lease (`lockedByAdminId = admin.id`, `lockedAt = now`, `lockExpiresAt = now + 15m`), logs `FAL_LICENSE_CLAIMED`. Throws `409` (`LICENSE_LOCK_CONFLICT`) if held by another admin.
    - `heartbeatLicenseLock(licenseId, admin)`: Verifies lock held by caller; extends `lockExpiresAt = now + 15m`.
    - `releaseLicenseLock(licenseId, admin)`: Clears lock fields; logs `FAL_LICENSE_RELEASED`.
    - `forceUnlockLicense(licenseId, admin, dto)`: Requires `Tasks.ForceUnlock`; clears lock fields; logs `FAL_LICENSE_FORCE_UNLOCKED`.
    - `approveLicense(licenseId, admin, dto)`: Validates status is `UNDER_REVIEW`/`RENEWAL_UNDER_REVIEW`, caller holds active lock, and version matches. In transaction: updates `FalLicense.status = ACTIVE`, `UserProfile.status = ACTIVE`, clears lock, increments version, logs `FAL_LICENSE_APPROVED`, dispatches `fal.license_approved` event.
    - `rejectLicense(licenseId, admin, dto)`: Validates status, lock, version, and rejectionReason >= 10 chars. In transaction: updates `FalLicense.status = REJECTED`, `UserProfile.status = SUSPENDED`, sets `rejectionReason`, clears lock, increments version, logs `FAL_LICENSE_REJECTED`, dispatches `fal.license_rejected` event.
  - [x] 4.2 Create `apps/api/src/modules/licenses/admin-licenses.controller.ts`:
    - Mount at `@Controller('admin/licenses')` with `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)`.
    - `GET /api/v1/admin/licenses` (`@RequireAdminPermission('Licenses.Review')`)
    - `GET /api/v1/admin/licenses/:id` (`@RequireAdminPermission('Licenses.Review')`)
    - `POST /api/v1/admin/licenses/:id/claim` (`@RequireAdminPermission('Licenses.Review')`)
    - `POST /api/v1/admin/licenses/:id/heartbeat` (`@RequireAdminPermission('Licenses.Review')`)
    - `POST /api/v1/admin/licenses/:id/release` (`@RequireAdminPermission('Licenses.Review')`)
    - `POST /api/v1/admin/licenses/:id/force-unlock` (`@RequireAdminPermission('Tasks.ForceUnlock')`)
    - `POST /api/v1/admin/licenses/:id/approve` (`@RequireAdminPermission('Licenses.Review')`)
    - `POST /api/v1/admin/licenses/:id/reject` (`@RequireAdminPermission('Licenses.Review')`)
  - [x] 4.3 Add comprehensive unit tests in `apps/api/src/modules/licenses/__tests__/admin-licenses.service.spec.ts` and `licenses.service.spec.ts`.

- [x] **Task 5: Frontend Marketer Onboarding & Status Page (`apps/web`)** (AC: #1, #9, #10)
  - [x] 5.1 Create `apps/web/src/app/app/marketer/onboarding/page.tsx`:
    - RTL form in Arabic with license number, commercial name, 10-digit CR, future expiry date picker, and certificate file upload.
    - Integrated with `StorageService.uploadQuarantineFile` for client-direct drag-and-drop file staging.
    - Dynamic status banners:
      - `UNDER_REVIEW`: Waiting banner with institutional badge.
      - `REJECTED`: Alert card highlighting admin rejection notes and re-submission button.
      - `ACTIVE`: Success card with verified badge and button to enter marketer dashboard.
  - [x] 5.2 Update `apps/web/src/components/layout/workspace-role-switcher.tsx` to link to `/app/marketer/onboarding` when marketer profile is not active.
  - [x] 5.3 Write unit tests in `apps/web/src/app/app/marketer/onboarding/__tests__/onboarding-page.spec.tsx`.

- [x] **Task 6: Frontend Admin Licensing Queue & Review Detail Screen (`apps/web`)** (AC: #2, #3, #4, #5, #6, #7, #8, #10)
  - [x] 6.1 Create `apps/web/src/app/admin/licenses/page.tsx`:
    - Institutional table with status tabs (`قيد المراجعة`, `معتمدة`, `مرفوضة`, `الكل`), search input, pagination, and "مراجعة وتدقيق" action button.
  - [x] 6.2 Create `apps/web/src/app/admin/licenses/[id]/page.tsx`:
    - Certificate preview/download via presigned URL.
    - Marketer and business credentials display (commercial name, CR number, Fal license number, expiry date).
    - 15-minute claim lease countdown timer with automatic 5-minute heartbeat interval.
    - Amber read-only banner when leased by another operator with Super Admin "Force Unlock" dialog.
    - Action buttons: "اعتماد الرخصة" (Approve) and "رفض الطلب" (Reject with required note).
  - [x] 6.3 Add navigation link to `/admin/licenses` in `apps/web/src/components/layout/workspace-shell.tsx` under `[UserRole.ADMIN]` for admins with `Licenses.Review` or `SUPER_ADMIN`.
  - [x] 6.4 Write unit tests in `apps/web/src/app/admin/licenses/__tests__/admin-licenses-page.spec.tsx`.

- [x] **Task 7: End-to-End Verification & Integrity Checks** (AC: #1 through #10)
  - [x] 7.1 Verify that past expiry dates are rejected with `FAL_EXPIRED_DATE` on both client and server.
  - [x] 7.2 Verify atomic state transition: approved license enables `switchRole(UserRole.MARKETER)`.
  - [x] 7.3 Run all tests across workspaces (`npm run test --workspace=@elmasaif/shared`, `npm run test --workspace=apps/api`, `npm run test --workspace=apps/web`).
  - [x] 7.4 Verify clean build across all packages.

## Dev Notes

- **Task Claim Locking Pattern:** Reuses the established 15-minute lease duration and 5-minute heartbeat interval implemented in Story 2.4 (`AdminListingsService`) and Story 5.3 (`AdminPaymentsService`).
- **Deterministic Time:** Always inject and use `ClockService.now()` for deterministic time comparisons (`expiryDate > clockService.now()`, lease expiration, audit timestamps). Never call bare `new Date()` for domain validation or lock calculations.
- **Sovereign S3 / Quarantine Storage (NFR-2):** Never persist short-lived presigned download URLs in the database. Store the storage key / file path, and dynamically mint verified download URLs (`<= 300` seconds / 5 minutes) on read via `StorageService.getVerifiedDownloadUrl`.
- **Database Push Caution:** Always run `npm run prisma:push` (which re-executes `prisma/sql/deal-invariants.sql` to preserve custom partial unique indexes like `deal_single_active_listing`), never bare `prisma db push`. Re-run `npm run prisma:generate` after modifying `schema.prisma`.
- **Shared Package Build:** `packages/shared/dist` is what `apps/api` and `apps/web` import. Rebuild shared (`npm run build --workspace=@elmasaif/shared`) whenever types, constants, or schemas change.
- **Optimistic Concurrency:** All admin mutating actions (approve, reject) MUST send the expected record `version` and fail with HTTP 409 `LICENSE_VERSION_CONFLICT` if the version has changed.

### Project Structure Notes

- New module in `apps/api`:
  - `apps/api/src/modules/licenses/licenses.module.ts`
  - `apps/api/src/modules/licenses/licenses.controller.ts`
  - `apps/api/src/modules/licenses/licenses.service.ts`
  - `apps/api/src/modules/licenses/admin-licenses.controller.ts`
  - `apps/api/src/modules/licenses/admin-licenses.service.ts`
- Shared additions:
  - `packages/shared/src/constants/licensing.ts`
  - `packages/shared/src/schemas/licensing.schema.ts`
  - `packages/shared/src/types/licensing.ts`
- Web app additions:
  - `apps/web/src/app/app/marketer/onboarding/page.tsx`
  - `apps/web/src/app/admin/licenses/page.tsx`
  - `apps/web/src/app/admin/licenses/[id]/page.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1: Fal License Onboarding & Administrative Verification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-6: Fal License Submission & Administrative Review]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-51: Distributed Admin Task Claim & Locking]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#3. Distributed Admin Task Claim & Locking (FR-51)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#5. Fal License Profile State Transitions]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Journey 2: Sara Onboards as a Fal-Certified Marketer]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

- Verified `ADMIN_ROLE_PERMISSIONS`: `Licenses.Review` assigned to `SUPER_ADMIN`, `MODERATOR`, and `COMPLIANCE_OFFICER`.
- Verified `UsersService.switchActiveRole`: requires `marketerProfile.status === ACTIVE && marketerProfile.falLicense.status === ACTIVE`.
- Verified existing `FalLicense` model in `apps/api/prisma/schema.prisma` with existing lock fields (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`).

### Completion Notes List

- Implemented comprehensive Marketer Fal License onboarding and administrative review lifecycle.
- Schema enhancements: Added `REJECTED` and `RENEWAL_UNDER_REVIEW` to `ProfileStatus` enum, and enhanced `FalLicense` model with rejection tracking, review audit timestamps, supporting documents list, and optimistic concurrency versioning.
- Shared package additions: Defined `licensing.ts` constants and error codes, robust Zod validation schemas (`submitFalLicenseSchema`, `licensingQueueQuerySchema`, `approveFalLicenseSchema`, `rejectFalLicenseSchema`, `forceUnlockFalLicenseSchema`), TypeScript types (`FalLicenseQueueItem`, `FalLicenseDetailResponse`), and unit tests.
- Backend modules:
  - User endpoints: `POST /api/v1/users/fal-license` and `GET /api/v1/users/fal-license` with future date validation, uniqueness check, atomic profile/license upsert, and audit logging.
  - Admin endpoints: `GET /api/v1/admin/licenses`, `GET /api/v1/admin/licenses/:id`, `POST /api/v1/admin/licenses/:id/claim`, `POST /api/v1/admin/licenses/:id/heartbeat`, `POST /api/v1/admin/licenses/:id/release`, `POST /api/v1/admin/licenses/:id/force-unlock`, `POST /api/v1/admin/licenses/:id/approve`, `POST /api/v1/admin/licenses/:id/reject` with 15-minute claim locking, 5-minute heartbeat renewal, optimistic concurrency checks, and verified download URLs.
- Frontend web application:
  - Responsive RTL Arabic Marketer Onboarding form (`apps/web/src/app/app/marketer/onboarding/page.tsx`) with file upload, future date picker, and dynamic status views (`UNDER_REVIEW`, `ACTIVE`, `REJECTED` alert card).
  - Linked workspace role switcher to onboarding page for non-active marketers.
  - Institutional Admin Licensing Queue page (`apps/web/src/app/admin/licenses/page.tsx`) with status tabs, search, pagination, and lock countdown badges.
  - Admin License Verification detail screen (`apps/web/src/app/admin/licenses/[id]/page.tsx`) with 15-minute lease timer, heartbeat renewal, amber read-only banner when locked by another operator, approve modal, reject modal with 10+ char note, and super admin force-unlock modal.
  - Added sidebar navigation link in `workspace-shell.tsx` under `[UserRole.ADMIN]`.
- All tests across shared, api, and web pass 100%, and all packages build cleanly.

### File List

- `apps/api/prisma/schema.prisma` (UPDATE)
- `packages/shared/src/constants/licensing.ts` (NEW)
- `packages/shared/src/constants/index.ts` (UPDATE)
- `packages/shared/src/enums/index.ts` (UPDATE)
- `packages/shared/src/schemas/licensing.schema.ts` (NEW)
- `packages/shared/src/schemas/__tests__/licensing.schema.spec.ts` (NEW)
- `packages/shared/src/schemas/index.ts` (UPDATE)
- `packages/shared/src/types/licensing.ts` (NEW)
- `packages/shared/src/types/index.ts` (UPDATE)
- `apps/api/src/modules/licenses/licenses.module.ts` (NEW)
- `apps/api/src/modules/licenses/licenses.controller.ts` (NEW)
- `apps/api/src/modules/licenses/licenses.service.ts` (NEW)
- `apps/api/src/modules/licenses/admin-licenses.controller.ts` (NEW)
- `apps/api/src/modules/licenses/admin-licenses.service.ts` (NEW)
- `apps/api/src/modules/licenses/__tests__/licenses.service.spec.ts` (NEW)
- `apps/api/src/modules/licenses/__tests__/admin-licenses.service.spec.ts` (NEW)
- `apps/api/src/common/pipes/zod-validation.pipe.ts` (UPDATE)
- `apps/api/src/app.module.ts` (UPDATE)
- `apps/web/src/app/app/marketer/onboarding/page.tsx` (NEW)
- `apps/web/src/app/app/marketer/onboarding/__tests__/onboarding-page.spec.tsx` (NEW)
- `apps/web/src/app/admin/licenses/page.tsx` (NEW)
- `apps/web/src/app/admin/licenses/__tests__/admin-licenses-page.spec.tsx` (NEW)
- `apps/web/src/app/admin/licenses/[id]/page.tsx` (NEW)
- `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE)
- `apps/web/src/components/layout/workspace-role-switcher.tsx` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `_bmad-output/implementation-artifacts/6-1-fal-license-onboarding-administrative-verification.md` (UPDATE)

