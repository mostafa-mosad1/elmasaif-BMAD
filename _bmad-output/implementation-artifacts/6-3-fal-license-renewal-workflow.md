---
baseline_commit: 638f47d
---

# Story 6.3: Fal License Renewal Workflow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a marketer with an expiring or compliance-restricted Fal license,
I want to upload a renewed official REGA Fal certificate and specify an extended future expiration date for expedited administrative review,
so that my broker profile returns to active standing, new listing creation and offer submission are re-enabled, and eligible listings held in `UNDER_COMPLIANCE_REVIEW` are automatically reinstated to `ACTIVE`.

## Acceptance Criteria

1. **Marketer Fal Renewal Submission & Strict Expiry Validation (`FR-8`, `UC-43`, `BR-14`):**
   - **Given** an authenticated marketer whose Fal license is either:
     - Currently `COMPLIANCE_RESTRICTED` (expired), OR
     - Currently `ACTIVE` but in an expiring warning window (`daysRemaining <= 30`), OR
     - Currently `REJECTED` from a previous renewal attempt
   - **When** submitting a renewal request via `POST /api/v1/users/fal-license/renew` (or `POST /api/v1/users/fal-license` with renewal intent):
     - The payload requires:
       - `certificateUrl`: Valid document key or storage path (uploaded via `StorageService` to quarantine partition, virus-scanned and clean, <= 10MB PDF/JPEG/PNG).
       - `expiryDate`: ISO date-time string strictly in the future (`expiryDate > ClockService.now()`). Expiration dates in the past or on the current date are rejected immediately with HTTP `400 Bad Request` and error code `FAL_EXPIRED_DATE` ("تاريخ انتهاء رخصة فال يجب أن يكون في المستقبل").
       - `extendedDateCheck`: When renewing an existing active license, the new `expiryDate` must be strictly later than the current `license.expiryDate` (`newExpiryDate > currentExpiryDate`). Attempting to set an equal or earlier expiration date is rejected with HTTP `400 Bad Request` and error code `FAL_RENEWAL_DATE_NOT_EXTENDED` ("تاريخ الانتهاء الجديد يجب أن يكون أبعد من تاريخ الانتهاء الحالي").
       - `licenseNumber`: Must match the existing marketer's registered license number.
       - `commercialName`: Defaults to current commercial name if omitted, or updates if provided (3–100 chars).
       - `crNumber`: Defaults to current 10-digit CR if omitted, or validates format (`/^\d{10}$/`).
       - `supportingDocumentUrls`: Optional array of up to 5 storage keys/paths for supporting renewal documentation.
   - **Then** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - `certificateUrl = body.certificateUrl`
       - `expiryDate = new Date(body.expiryDate)`
       - `commercialName = body.commercialName || falLicense.commercialName`
       - `crNumber = body.crNumber || falLicense.crNumber`
       - `supportingDocumentUrls = body.supportingDocumentUrls || []`
       - `status = ProfileStatus.RENEWAL_UNDER_REVIEW`
       - `rejectionReason = null`
       - `reviewedByAdminId = null`
       - `reviewedAt = null`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Updates `UserProfile`:
       - If currently `COMPLIANCE_RESTRICTED`, transitions `status = ProfileStatus.RENEWAL_UNDER_REVIEW`
       - If currently `ACTIVE`, preserves `UserProfile.status = ProfileStatus.ACTIVE` so the marketer can manage non-suspended operations until expiry, while displaying the pending renewal review state
     - Inserts an immutable `AuditLog` entry:
       - `actorId = user.id`, `actorType = 'USER'`
       - `action = 'FAL_LICENSE_RENEWAL_SUBMITTED'`
       - `entityType = 'FalLicense'`, `entityId = falLicense.id`
       - `payload`: `{ licenseNumber, previousExpiryDate: falLicense.expiryDate.toISOString(), newExpiryDate: expiryDate.toISOString(), previousStatus: falLicense.status }`
     - Dispatches notification/event `fal.renewal_submitted` to the marketer.
     - Returns HTTP `200 OK` with `{ statusCode: 200, message: 'تم استلام طلب تجديد رخصة فال بنجاح وجارٍ مراجعته إدارياً', data: falLicense }`.

2. **Admin Licensing Queue Filtering & Prioritization of Renewals (`Licenses.Review`, `FR-8`, `FR-51`, `AD-10`):**
   - **Given** an administrator with `Licenses.Review` permission querying the queue (`GET /api/v1/admin/licenses`):
   - **When** filtering or sorting applications:
     - Supports filter `status = ProfileStatus.RENEWAL_UNDER_REVIEW` as well as mixed queues.
     - Items with `status = ProfileStatus.RENEWAL_UNDER_REVIEW` are surfaced with a prominent badge `طلب تجديد` (Renewal Request) distinct from initial applications `طلب جديد`.
     - Queue item summary includes: `isRenewal: true`, `suspendedListingsCount` (count of marketer's active listings currently held in `UNDER_COMPLIANCE_REVIEW`), `previousExpiryDate`, and `newExpiryDate`.
     - Prioritization: Expedited SLA sorting prioritizes renewals where `suspendedListingsCount > 0` or accounts already restricted to minimize broker business downtime.

3. **Admin Claim Locking & Task Lease Compliance on Renewals (`FR-51`, `AD-10`):**
   - **Given** a renewal application in `RENEWAL_UNDER_REVIEW`:
   - **When** an administrator inspects and acts on the application:
     - Adheres strictly to the established 15-minute lease mechanism (`POST /api/v1/admin/licenses/:id/claim`, `heartbeat`, `release`, and `force-unlock`).
     - Decisions (`approve`, `reject`) strictly require the caller to hold the active claim lock (`lockedByAdminId === admin.id && lockExpiresAt > ClockService.now()`), otherwise rejected with HTTP `409 Conflict` (`LICENSE_LOCK_REQUIRED`).
     - Optimistic concurrency `version` check is strictly enforced (`409 Conflict` `LICENSE_VERSION_CONFLICT`).

4. **Administrative Renewal Approval & Automatic Reinstatement of Suspended Listings (`FR-8`, `BR-14`, `UC-43`, `UC-62`):**
   - **Given** an administrator holding the active claim lock on an application in `RENEWAL_UNDER_REVIEW`:
   - **When** submitting an approval via `POST /api/v1/admin/licenses/:id/approve` with `{ version: number }`:
   - **Then** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - `status = ProfileStatus.ACTIVE`
       - `reviewedByAdminId = admin.id`
       - `reviewedAt = ClockService.now()`
       - `rejectionReason = null`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Updates `UserProfile`:
       - `status = ProfileStatus.ACTIVE`
     - Inserts `AuditLog` entry for the license:
       - `actorId = admin.id`, `actorType = 'ADMIN'`
       - `action = 'FAL_LICENSE_RENEWAL_APPROVED'`
       - `entityType = 'FalLicense'`, `entityId = falLicense.id`
       - `payload`: `{ adminName: admin.fullName, newExpiryDate: falLicense.expiryDate.toISOString() }`
     - Evaluates the marketer's property portfolio for automatic compliance reinstatement:
       - Finds all `Listing` records belonging to this marketer (`sellerProfileId = falLicense.profileId`) where:
         - `status = ListingStatus.UNDER_COMPLIANCE_REVIEW` AND
         - `complianceCategory = 'FAL_LICENSE_EXPIRED'` (only listings suspended due to Fal expiry!)
       - For each qualifying listing:
         - Updates `Listing`:
           - `status = ListingStatus.ACTIVE`
           - `complianceReason = null`
           - `complianceCategory = null`
           - `complianceActionAt = null`
           - `complianceOfficerId = null`
           - `version = { increment: 1 }`
         - Inserts an immutable `AuditLog` entry:
           - `actorId = admin.id`, `actorType = 'ADMIN'`
           - `action = 'LISTING_REINSTATED_FAL_RENEWED'`
           - `entityType = 'Listing'`, `entityId = listing.id`
           - `payload`: `{ listingId: listing.id, listingTitle: listing.title, previousStatus: 'UNDER_COMPLIANCE_REVIEW', newStatus: 'ACTIVE', reason: 'FAL_LICENSE_RENEWED' }`
     - Dispatches notification/event `fal.license_approved` (or `fal.renewal_approved`) to the marketer.
     - If listings were reinstated, dispatches notification/event `listing.compliance_reinstated` summarizing the count and IDs of reactivated listings.
     - Releases the claim lock cleanly.
     - Returns HTTP `200 OK` with:
       ```json
       {
         "statusCode": 200,
         "message": "تم اعتماد تجديد رخصة فال بنجاح وإعادة تنشيط الإعلانات المعلقة للامتثال",
         "data": {
           "licenseId": "...",
           "status": "ACTIVE",
           "reinstatedListingsCount": 3
         }
       }
       ```

5. **Exclusion of Non-Eligible Listings from Auto-Reinstatement (`FR-7`, `FR-8`, `UC-66`):**
   - **Given** listings belonging to the marketer:
   - **Then** any listing held in `UNDER_COMPLIANCE_REVIEW` for reasons OTHER than Fal expiry (`complianceCategory !== 'FAL_LICENSE_EXPIRED'`, e.g. title deed fraud, deceptive pricing, misleading photos):
     - MUST NOT be reinstated automatically.
     - Remains in `UNDER_COMPLIANCE_REVIEW` awaiting independent manual compliance resolution.
   - **And** listings in any other status (`BLOCKED`, `HIDDEN`, `RESERVED`, `ARCHIVED`, `DRAFT`, `PENDING_REVIEW`):
     - Are strictly excluded and remain completely unchanged.

6. **Administrative Renewal Rejection with Mandatory Feedback (`Licenses.Review`, `FR-8`, `UC-62`):**
   - **Given** an administrator holding the active claim lock on an application in `RENEWAL_UNDER_REVIEW`:
   - **When** submitting a rejection via `POST /api/v1/admin/licenses/:id/reject` with `{ rejectionReason: string, version: number }`:
   - **Then** the backend verifies:
     - `rejectionReason` contains at least 10 non-whitespace characters (`LICENSE_REJECTION_REASON_REQUIRED`).
     - Active claim lock is held by the caller and not expired (`LICENSE_LOCK_REQUIRED`).
     - Optimistic concurrency `version` matches (`LICENSE_VERSION_CONFLICT`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - If current date has passed original expiry (`ClockService.now() >= expiryDate`):
         - `status = ProfileStatus.COMPLIANCE_RESTRICTED`
       - If current date has NOT yet reached original expiry (`ClockService.now() < expiryDate`):
         - `status = ProfileStatus.ACTIVE` (returns to active until expiry date arrives, but retains rejection feedback for the renewal)
       - `rejectionReason = body.rejectionReason.trim()`
       - `reviewedByAdminId = admin.id`
       - `reviewedAt = ClockService.now()`
       - `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`
       - `version = { increment: 1 }`
     - Updates `UserProfile`:
       - Sets `status` matching `FalLicense.status` (`COMPLIANCE_RESTRICTED` or `ACTIVE`)
     - Inserts an immutable `AuditLog` entry:
       - `actorId = admin.id`, `actorType = 'ADMIN'`
       - `action = 'FAL_LICENSE_RENEWAL_REJECTED'`
       - `entityType = 'FalLicense'`, `entityId = falLicense.id`
       - `payload`: `{ rejectionReason: body.rejectionReason.trim(), adminName: admin.fullName }`
     - Dispatches notification/event `fal.renewal_rejected` to the marketer including `rejectionReason`.
     - Returns HTTP `200 OK` with `{ statusCode: 200, message: 'تم رفض طلب تجديد رخصة فال وتوثيق السبب للمستخدم' }`.

7. **Marketer Workspace Renewal UI (`apps/web` per `EXPERIENCE.md §5` and `DESIGN.md`):**
   - **Given** the Marketer License & Onboarding screen (`/app/marketer/fal-license` or `/app/marketer/onboarding`):
   - **When** `falLicense.status === ProfileStatus.COMPLIANCE_RESTRICTED`:
     - Displays prominent high-urgency compliance banner:
       «تم تقييد حسابك لانتهاء صلاحية رخصة فال. يمكنك رفع شهادة الرخصة المجددة وتاريخ الانتهاء الجديد لإعادة تنشيط الحساب والإعلانات فوراً.»
     - Displays pre-filled non-editable license number and commercial name.
     - Displays dedicated certificate drag-and-drop upload zone with upload progress (PDF, JPEG, PNG <= 10MB).
     - Displays future expiration date input with `minDate = tomorrow`.
     - Primary CTA: "إرسال طلب تجديد الرخصة" (Submit Renewal Request).
     - If previous renewal was rejected, displays alert box with the administrative rejection reason in Arabic.
   - **When** `falLicense.status === ProfileStatus.RENEWAL_UNDER_REVIEW`:
     - Renders dedicated "طلب تجديد الرخصة قيد المراجعة" card with amber badge and pulse animation.
     - Summarizes renewal details: submitted certificate, requested expiration date, submission timestamp.
     - Informs user of expected turnaround (24-hour review SLA).
     - Provides "تحديث حالة الطلب" (Refresh Status) button.
   - **When** `falLicense.status === ProfileStatus.ACTIVE` and `daysRemaining <= 30`:
     - Renders warning countdown banner with action button: "تجديد مبكر لرخصة فال" (Renew License Early).
     - Clicking button switches to renewal upload form allowing early submission while maintaining broker account operations.

8. **Admin Detail Inspection UI for Renewals (`apps/web` per `EXPERIENCE.md §5`):**
   - **Given** an administrator inspecting a renewal at `/admin/licenses/:id`:
   - **When** `status === ProfileStatus.RENEWAL_UNDER_REVIEW`:
     - Renders distinctive `طلب تجديد رخصة فال` header badge with comparison block:
       - Previous Expiration Date vs New Requested Expiration Date.
       - Count of marketer's suspended listings held in `UNDER_COMPLIANCE_REVIEW` that will be automatically reinstated upon approval.
     - Secure document viewer for the newly uploaded certificate with 5-minute presigned download URL.
     - Primary decision buttons:
       - "اعتماد التجديد وتنشيط الإعلانات" (Approve Renewal & Reinstate Listings) with confirmation modal stating how many listings will be reactivated.
       - "رفض طلب التجديد" (Reject Renewal) opening mandatory feedback modal (>= 10 characters).

9. **Shared Constants, Schemas & Helper Functions (`packages/shared`):**
   - Export constants in `packages/shared/src/constants/licensing.ts`:
     - `AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED = 'FAL_LICENSE_RENEWAL_SUBMITTED'`
     - `AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED = 'FAL_LICENSE_RENEWAL_APPROVED'`
     - `AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED = 'FAL_LICENSE_RENEWAL_REJECTED'`
     - `AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED = 'LISTING_REINSTATED_FAL_RENEWED'`
     - `NOTIFICATION_FAL_RENEWAL_SUBMITTED = 'fal.renewal_submitted'`
     - `NOTIFICATION_FAL_RENEWAL_APPROVED = 'fal.renewal_approved'`
     - `NOTIFICATION_FAL_RENEWAL_REJECTED = 'fal.renewal_rejected'`
     - `NOTIFICATION_LISTING_COMPLIANCE_REINSTATED = 'listing.compliance_reinstated'`
     - `FAL_RENEWAL_DATE_NOT_EXTENDED = 'FAL_RENEWAL_DATE_NOT_EXTENDED'`
   - Define and export renewal validation schema in `packages/shared/src/schemas/licensing.schema.ts`:
     - `renewFalLicenseSchema` (with `certificateUrl`, future `expiryDate`, optional `commercialName`, `crNumber`, `supportingDocumentUrls`).
   - Define pure helper in `packages/shared/src/licensing/expiry.ts`:
     - `isListingEligibleForReinstatement(listing: { status: ListingStatus; complianceCategory?: string | null }): boolean`:
       - Returns `true` strictly if `listing.status === ListingStatus.UNDER_COMPLIANCE_REVIEW` AND `listing.complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED`.
       - Returns `false` for any other status or category.

10. **Automated Verification & Zero Regression Test Suite:**
    - Unit tests in `packages/shared` verifying `isListingEligibleForReinstatement` and `renewFalLicenseSchema`.
    - Unit tests in `apps/api` for `LicensesService.renewFalLicense`:
      - Rejection of past or non-extended expiration dates.
      - Rejection when profile is not marketer or does not exist.
      - Atomic update to `RENEWAL_UNDER_REVIEW`, incrementing version, creating audit log.
    - Unit tests in `apps/api` for `AdminLicensesService.approveLicense` handling renewals:
      - Validates approval transitions `RENEWAL_UNDER_REVIEW` -> `ACTIVE`.
      - Automatically reinstates marketer's listings with `UNDER_COMPLIANCE_REVIEW` + `FAL_LICENSE_EXPIRED` to `ACTIVE`.
      - Excludes non-expired-compliance listings (e.g. general compliance review, reserved, blocked).
      - Creates listing audit logs and increments listing versions.
    - Unit tests in `apps/api` for `AdminLicensesService.rejectLicense` handling renewals:
      - Rejection with mandatory feedback (>= 10 chars).
      - Reverts to `COMPLIANCE_RESTRICTED` if past original expiry, or `ACTIVE` if still within original validity window.
    - Component and integration tests in `apps/web` verifying:
      - Marketer `/app/marketer/fal-license` UI in `COMPLIANCE_RESTRICTED`, `RENEWAL_UNDER_REVIEW`, and expiring `ACTIVE` states.
      - Admin `/admin/licenses` and `/admin/licenses/:id` renewal indicators, listing reinstatement counts, and decision actions.

## Tasks / Subtasks

- [x] **Task 1: Shared Constants, Schema Validators & Pure Helpers (`packages/shared`)** (AC: #1, #4, #5, #6, #9)
  - [x] 1.1 In `packages/shared/src/constants/licensing.ts`:
    - Export `AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED = 'FAL_LICENSE_RENEWAL_SUBMITTED'`
    - Export `AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED = 'FAL_LICENSE_RENEWAL_APPROVED'`
    - Export `AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED = 'FAL_LICENSE_RENEWAL_REJECTED'`
    - Export `AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED = 'LISTING_REINSTATED_FAL_RENEWED'`
    - Export `NOTIFICATION_FAL_RENEWAL_SUBMITTED = 'fal.renewal_submitted'`
    - Export `NOTIFICATION_FAL_RENEWAL_APPROVED = 'fal.renewal_approved'`
    - Export `NOTIFICATION_FAL_RENEWAL_REJECTED = 'fal.renewal_rejected'`
    - Export `NOTIFICATION_LISTING_COMPLIANCE_REINSTATED = 'listing.compliance_reinstated'`
    - Export `FAL_RENEWAL_DATE_NOT_EXTENDED = 'FAL_RENEWAL_DATE_NOT_EXTENDED'`
  - [x] 1.2 In `packages/shared/src/schemas/licensing.schema.ts`:
    - Export `renewFalLicenseSchema` validating `certificateUrl`, future `expiryDate`, optional `commercialName`, `crNumber`, and `supportingDocumentUrls`.
    - Export type `RenewFalLicenseInput = z.infer<typeof renewFalLicenseSchema>`.
  - [x] 1.3 In `packages/shared/src/licensing/expiry.ts`:
    - Implement `isListingEligibleForReinstatement(listing: { status: ListingStatus; complianceCategory?: string | null }): boolean`.
  - [x] 1.4 Re-export new constants, schemas, types, and helpers in `packages/shared/src/index.ts`.
  - [x] 1.5 Add unit tests in `packages/shared/src/licensing/__tests__/expiry.spec.ts` and `licensing.schema.spec.ts`.
  - [x] 1.6 Run `npm run build --workspace=@elmasaif/shared`.

- [x] **Task 2: Marketer Renewal API Endpoint & Service Logic (`apps/api`)** (AC: #1, #3)
  - [x] 2.1 In `apps/api/src/modules/licenses/licenses.controller.ts`:
    - Add endpoint `@Post('renew')` with `SessionAuthGuard` accepting `RenewFalLicenseInput` via `ZodValidationPipe(renewFalLicenseSchema)`.
  - [x] 2.2 In `apps/api/src/modules/licenses/licenses.service.ts`:
    - Implement `renewFalLicense(userId: string, input: RenewFalLicenseInput)`:
      - Validates caller has a marketer profile and existing `FalLicense`.
      - Enforces strict future date check: `newExpiryDate > ClockService.now()` (`FAL_EXPIRED_DATE`).
      - If current license is not expired, enforces `newExpiryDate > license.expiryDate` (`FAL_RENEWAL_DATE_NOT_EXTENDED`).
      - In Prisma `$transaction`:
        - Updates `FalLicense`: `certificateUrl`, `expiryDate`, `commercialName`, `crNumber`, `status = ProfileStatus.RENEWAL_UNDER_REVIEW`, clears rejection and lock fields, increments `version`.
        - If `userProfile.status === ProfileStatus.COMPLIANCE_RESTRICTED`, updates `userProfile.status = ProfileStatus.RENEWAL_UNDER_REVIEW`.
        - Inserts `AuditLog` entry `FAL_LICENSE_RENEWAL_SUBMITTED`.
      - Dispatches notification `fal.renewal_submitted`.
      - Returns HTTP 200 with updated license data.
  - [x] 2.3 Also update `submitFalLicense` to handle re-submissions when in `COMPLIANCE_RESTRICTED` or `REJECTED` state seamlessly.
  - [x] 2.4 Add unit tests in `apps/api/src/modules/licenses/__tests__/licenses.service.spec.ts`.

- [x] **Task 3: Admin Approval Automatic Listing Reinstatement & Rejection Workflow (`apps/api`)** (AC: #2, #3, #4, #5, #6)
  - [x] 3.1 In `apps/api/src/modules/licenses/admin-licenses.service.ts`:
    - In `getLicensingQueue`:
      - Add computed fields: `isRenewal: license.status === ProfileStatus.RENEWAL_UNDER_REVIEW`.
      - Count marketer's listings with `status === ListingStatus.UNDER_COMPLIANCE_REVIEW && complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED` as `suspendedListingsCount`.
    - In `getLicenseDetail`:
      - Return `isRenewal`, `previousExpiryDate`, `suspendedListingsCount`, and list of affected listing IDs/titles.
    - In `approveLicense`:
      - When `license.status === ProfileStatus.RENEWAL_UNDER_REVIEW` (or if marketer has compliance-suspended listings):
        - Find qualifying listings: `sellerProfileId === license.profileId`, `status === ListingStatus.UNDER_COMPLIANCE_REVIEW`, `complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED`.
        - Within the same atomic transaction:
          - Revert each listing to `ListingStatus.ACTIVE`, clear compliance fields (`complianceReason = null`, `complianceCategory = null`, `complianceActionAt = null`, `complianceOfficerId = null`), increment `version`.
          - Insert `AuditLog` entry for each listing: `action = 'LISTING_REINSTATED_FAL_RENEWED'`.
          - Log license approval with `action = 'FAL_LICENSE_RENEWAL_APPROVED'` (or `FAL_LICENSE_APPROVED`).
        - Dispatch `listing.compliance_reinstated` notification if `reinstatedListingsCount > 0`.
    - In `rejectLicense`:
      - When `license.status === ProfileStatus.RENEWAL_UNDER_REVIEW`:
        - If `now >= license.expiryDate`, update `FalLicense.status = ProfileStatus.COMPLIANCE_RESTRICTED` and `UserProfile.status = ProfileStatus.COMPLIANCE_RESTRICTED`.
        - If `now < license.expiryDate`, update `FalLicense.status = ProfileStatus.ACTIVE` and `UserProfile.status = ProfileStatus.ACTIVE`.
        - Set `rejectionReason = dto.rejectionReason.trim()`.
        - Insert `AuditLog` entry `FAL_LICENSE_RENEWAL_REJECTED`.
        - Dispatch `fal.renewal_rejected` notification.
  - [x] 3.2 Add comprehensive unit tests in `apps/api/src/modules/licenses/__tests__/admin-licenses.service.spec.ts`.

- [x] **Task 4: Marketer Workspace Frontend Renewal UI (`apps/web`)** (AC: #7)
  - [x] 4.1 In `apps/web/src/app/app/marketer/fal-license/page.tsx` and `onboarding/page.tsx`:
    - Support `ProfileStatus.COMPLIANCE_RESTRICTED`:
      - Prominent red alert banner stating the account is restricted due to expired Fal license.
      - Render streamlined renewal form with pre-filled license number and commercial name.
      - Certificate file uploader with drag-and-drop and progress bar.
      - Future date picker with `minDate = tomorrow`.
      - Submission button calls `POST /api/v1/users/fal-license/renew` (or `/api/v1/users/fal-license`).
      - Display previous rejection feedback if applicable.
    - Support `ProfileStatus.RENEWAL_UNDER_REVIEW`:
      - Render dedicated renewal review card: «طلب تجديد رخصة فال قيد المراجعة الإدارية».
      - Display summary of submitted renewal info and 24-hour review SLA notice.
      - Refresh button calling `fetchLicenseStatus`.
    - Support `ProfileStatus.ACTIVE` with expiring warning (`daysRemaining <= 30`):
      - In addition to the alert countdown banner, provide a "تجديد مبكر لرخصة فال" button that expands or navigates to the renewal form for seamless early renewal.
  - [x] 4.2 In `apps/web/src/app/app/marketer/page.tsx`:
    - Ensure compliance restriction card button and expiring license warning button link directly to `/app/marketer/fal-license`.
  - [x] 4.3 Add component unit tests in `apps/web/src/app/app/marketer/__tests__/marketer-compliance-states.spec.tsx`.

- [x] **Task 5: Admin Licensing Workspace Renewal Inspection & Decision UI (`apps/web`)** (AC: #2, #8)
  - [x] 5.1 In Admin Licensing Queue (`/admin/licenses`):
    - Display distinct badge for `RENEWAL_UNDER_REVIEW` (`طلب تجديد`) with purple/amber styling distinct from initial submissions (`طلب جديد`).
    - Display suspended listings count pill (`X إعلانات معلقة`).
  - [x] 5.2 In Admin License Detail (`/admin/licenses/:id`):
    - Show renewal comparison banner highlighting previous vs renewed expiration dates.
    - List the marketer's listings that will be automatically reactivated upon approval.
    - Confirmation modal for approval explicitly mentioning: «سيتم اعتماد التجديد وإعادة تفعيل X إعلانات معلقة للامتثال آلياً».
    - Rejection modal capturing mandatory justification reason.
  - [x] 5.3 Add tests for admin renewal views and decision workflows.

- [x] **Task 6: Verification & End-to-End Regression Testing** (AC: #10)
  - [x] 6.1 Run unit tests in `packages/shared`, `apps/api`, `apps/worker`, and `apps/web`.
  - [x] 6.2 Test edge cases:
    - Attempting renewal with past or today's date -> rejected.
    - Attempting renewal with equal/earlier date on active license -> rejected.
    - Renewal approval when marketer has 0 suspended listings -> clean approval, 0 reinstated.
    - Renewal approval when marketer has 3 suspended listings (FAL_EXPIRED) and 1 suspended listing (MISLEADING_INFO) -> only the 3 FAL_EXPIRED listings reinstated to ACTIVE.
    - Renewal approval when marketer has reserved listing with in-flight deal -> reserved listing stays RESERVED.
  - [x] 6.3 Verify all linting, formatting, and type checks pass cleanly.

## Dev Notes

### Architecture Patterns and Constraints

- **Deterministic Time via ClockService (`AR13`):**
  Never use raw `new Date()` for business logic evaluations. All temporal evaluations (future date checks, renewal comparisons, lock expiry, audit timestamps) must use `ClockService.now()`.
- **Atomic State Transitions & Optimistic Concurrency (`AR12`, `FR-51`):**
  All approval and reinstatement operations must execute within an atomic Prisma `$transaction`. Optimistic concurrency `version` checks must be strictly applied before committing any decision.
- **Exclusive Task Claim Locking (`FR-51`, `AD-10`):**
  Adhere to the 15-minute lease mechanism established in Story 6.1. Any decision endpoint (`approve`, `reject`) must verify that the calling admin holds the active claim lock (`lockedByAdminId === admin.id && lockExpiresAt > ClockService.now()`).
- **Targeted Listing Reinstatement Guard (`FR-7`, `FR-8`):**
  When reinstating listings upon renewal approval:
  ```ts
  const eligibleListings = await tx.listing.findMany({
    where: {
      sellerProfileId: license.profileId,
      status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
      complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
    },
  });
  ```
  Only listings matching both `ListingStatus.UNDER_COMPLIANCE_REVIEW` AND `complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED` must be updated to `ListingStatus.ACTIVE`. All other listings must remain strictly untouched!
- **Presigned URLs (`NFR-2`):**
  Short-lived presigned download URLs for renewal certificates must have a maximum lifetime of 300 seconds (5 minutes) and must never be persisted to the database.

### Source Tree Components to Touch

- `packages/shared/src/constants/licensing.ts` - Add renewal audit actions, notification event names, and error codes.
- `packages/shared/src/schemas/licensing.schema.ts` - Add `renewFalLicenseSchema` and `RenewFalLicenseInput`.
- `packages/shared/src/licensing/expiry.ts` - Implement `isListingEligibleForReinstatement`.
- `packages/shared/src/licensing/index.ts` & `packages/shared/src/index.ts` - Re-export constants, types, and helpers.
- `apps/api/src/modules/licenses/licenses.controller.ts` - Add `POST /users/fal-license/renew` endpoint.
- `apps/api/src/modules/licenses/licenses.service.ts` - Implement `renewFalLicense` logic.
- `apps/api/src/modules/licenses/admin-licenses.service.ts` - Update `approveLicense` to automatically reinstate eligible suspended listings and `rejectLicense` to handle renewal rejection.
- `apps/web/src/app/app/marketer/fal-license/page.tsx` & `apps/web/src/app/app/marketer/onboarding/page.tsx` - Implement `COMPLIANCE_RESTRICTED`, `RENEWAL_UNDER_REVIEW`, and early-renewal UI states.
- `apps/web/src/app/admin/licenses/page.tsx` & `apps/web/src/app/admin/licenses/[id]/page.tsx` - Update admin queue and detail screens to display renewal badges, suspended listing tallies, and reinstatement confirmations.

### Testing Standards Summary

- Framework: Jest / Vitest for unit & integration testing, React Testing Library for frontend components.
- Mocking: Mock `PrismaService`, `ClockService`, `StorageService`, and `NotificationDispatcher`.
- Coverage:
  - 100% pure function coverage for `isListingEligibleForReinstatement`.
  - Date boundary checks: past dates, today's date, non-extended dates.
  - Transaction atomicity: verified rollback if any listing update fails.
  - Selective reinstatement: verify only listings with `complianceCategory === 'FAL_LICENSE_EXPIRED'` are reactivated.

### Project Structure Notes

- Alignment with monorepo layout:
  - Contracts, validation schemas, and domain helpers in `packages/shared/src/licensing`.
  - NestJS API modules in `apps/api/src/modules/licenses`.
  - Background worker jobs in `apps/worker/src/jobs`.
  - Next.js App Router client pages in `apps/web/src/app/app/marketer/fal-license` and `apps/web/src/app/admin/licenses`.
- Preserves Arabic RTL UI standards and Tailwind tokens from `DESIGN.md`.

### References

- [Epics: Story 6.3](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/epics.md#L816-L826)
- [PRD: FR-7, FR-8](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md)
- [UX Specifications: EXPERIENCE.md §5 Marketer Workspace](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#L255-L265)
- [Architecture Spine: State Transitions & Task Claim Locking](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#L280-L290)
- [Story 6.1 Implementation](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/implementation-artifacts/6-1-fal-license-onboarding-administrative-verification.md)
- [Story 6.2 Implementation](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/implementation-artifacts/6-2-automated-daily-fal-expiry-enforcement-worker-job.md)

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

- Verified existing `ProfileStatus.RENEWAL_UNDER_REVIEW` enum in `schema.prisma` and `@elmasaif/shared`.
- Inspected `apps/api/src/modules/licenses/admin-licenses.service.ts` to identify gaps where listing reinstatement was missing in `approveLicense`.
- Inspected `apps/worker/src/jobs/fal-license-expiry.job.ts` to mirror the suspension metadata (`complianceCategory = 'FAL_LICENSE_EXPIRED'`) for exact matching during reinstatement.
- Verified RTL Arabic UI components in `apps/web/src/app/app/marketer/onboarding/page.tsx` and `fal-license/page.tsx`.

### Completion Notes List

- Implemented complete Fal license renewal lifecycle spanning frontend, backend, and shared libraries.
- Added shared constants, Zod schema `renewFalLicenseSchema`, and pure helper `isListingEligibleForReinstatement`.
- Added marketer renewal endpoint `POST /api/v1/users/fal-license/renew` with strict future date validation and extended date verification for active licenses.
- Updated admin queue and detail services: populated `isRenewal`, `previousExpiryDate`, `suspendedListingsCount`, and `suspendedListings`.
- Implemented targeted listing auto-reinstatement upon renewal approval: selectively transitions listings in `UNDER_COMPLIANCE_REVIEW` with `complianceCategory === 'FAL_LICENSE_EXPIRED'` to `ACTIVE`, leaving listings with other compliance reasons untouched.
- Implemented renewal rejection: reverts to `COMPLIANCE_RESTRICTED` if past original expiry or maintains `ACTIVE` if within validity window.
- Updated marketer workspace UI with early renewal CTA, restricted renewal mode, and review waiting screen.
- Updated admin workspace UI with renewal indicators, suspended listings pills, comparison cards, and renewal confirmation modals.
- All test suites passing: 43 shared test files (560 tests), 2 API Jest test suites (23 tests), and 2 Web Vitest test suites (11 tests).

### File List

- `packages/shared/src/constants/licensing.ts` (Modified)
- `packages/shared/src/schemas/licensing.schema.ts` (Modified)
- `packages/shared/src/types/licensing.ts` (Modified)
- `packages/shared/src/licensing/expiry.ts` (Modified)
- `packages/shared/src/licensing/__tests__/expiry.spec.ts` (Modified)
- `packages/shared/src/schemas/__tests__/licensing.schema.spec.ts` (Modified)
- `apps/api/src/modules/licenses/licenses.controller.ts` (Modified)
- `apps/api/src/modules/licenses/licenses.service.ts` (Modified)
- `apps/api/src/modules/licenses/admin-licenses.service.ts` (Modified)
- `apps/api/src/modules/licenses/__tests__/licenses.service.spec.ts` (Modified)
- `apps/api/src/modules/licenses/__tests__/admin-licenses.service.spec.ts` (Modified)
- `apps/web/src/app/app/marketer/onboarding/page.tsx` (Modified)
- `apps/web/src/app/app/marketer/__tests__/marketer-compliance-states.spec.tsx` (Modified)
- `apps/web/src/app/admin/licenses/page.tsx` (Modified)
- `apps/web/src/app/admin/licenses/[id]/page.tsx` (Modified)
- `apps/web/src/app/admin/licenses/__tests__/admin-licenses-page.spec.tsx` (Modified)
- `_bmad-output/implementation-artifacts/6-3-fal-license-renewal-workflow.md` (Updated status to review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Updated status to review)

