---
baseline_commit: ad56db8
---

# Story 6.2: Automated Daily Fal Expiry Enforcement Worker Job

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform compliance officer,
I want an automated daily background worker job verifying Fal license expirations,
so that expired brokers are restricted and non-compliant listings are suspended automatically, while warning notifications are dispatched at 30, 7, and 1 days prior to expiration, and in-flight deals continue uninterrupted.

## Acceptance Criteria

1. **Automated Daily Expiry Enforcement Background Worker Job (`JOB_FAL_LICENSE_EXPIRY`, `FR-7`, `BR-14`):**
   - **Given** the dedicated background worker process (`apps/worker`).
   - **When** the `fal-license-expiry` job triggers on its registered daily schedule at 00:05 UTC (`5 0 * * *`).
   - **Then** it executes via `pg-boss` with singleton key `fal-license-expiry`, `retryLimit: 3`, `retryDelay: 120`, `retryBackoff: true`, `expireInMinutes: 30`.
   - **And** evaluates temporal deadlines using `workerClock.now()` (or injected `currentTime: Date`), never raw unmockable `new Date()`.
   - **And** queries candidate `FalLicense` records where `status = ProfileStatus.ACTIVE` (or `status != ProfileStatus.COMPLIANCE_RESTRICTED`) and `expiryDate <= currentTime`.
   - **And** logs structured telemetry: `[Job: fal-license-expiry] Started at {time}` and `[Job: fal-license-expiry] Completed in {ms}ms with outcome: {summary}`.
   - **And** if no licenses are expired, completes cleanly with `processedCount: 0`.

2. **Atomic Profile Compliance Restriction (`FR-7`, `BR-14`, `EXPERIENCE.md §5`):**
   - **Given** a marketer with an approved Fal license whose expiration date has passed (`expiryDate <= currentTime`).
   - **When** the daily expiry job processes the record:
   - **Then** within an atomic Prisma `$transaction`:
     - Updates `FalLicense`:
       - `status = ProfileStatus.COMPLIANCE_RESTRICTED`
       - `version = { increment: 1 }`
     - Updates the associated `UserProfile`:
       - `status = ProfileStatus.COMPLIANCE_RESTRICTED`
     - Inserts an immutable `AuditLog` entry:
       - `actorId = 'SYSTEM'`, `actorType = 'SYSTEM'`
       - `action = 'FAL_LICENSE_RESTRICTED_EXPIRED'`
       - `entityType = 'FalLicense'`, `entityId = license.id`
       - `payload`: `{ licenseNumber, commercialName, expiryDate: license.expiryDate.toISOString(), restrictedAt: currentTime.toISOString() }`
     - Dispatches event/notification `fal.license_expired_restricted` to the marketer.

3. **Automatic Compliance Suspension of Active Listings (`FR-7`, `BR-14`, `UC-43`):**
   - **Given** a marketer transitioning to `COMPLIANCE_RESTRICTED`.
   - **When** the expiry job evaluates the marketer's portfolio:
   - **Then** within the same atomic transaction:
     - Finds all `Listing` records belonging to this marketer (`sellerProfileId = userProfile.id`) where `status = ListingStatus.ACTIVE`.
     - For each qualifying active listing:
       - Updates `Listing`:
         - `status = ListingStatus.UNDER_COMPLIANCE_REVIEW`
         - `complianceReason = 'انتهت صلاحية رخصة فال للمسوق وتم تعليق الإعلان آلياً لحين تجديد الرخصة والامتثال'`
         - `complianceCategory = 'FAL_LICENSE_EXPIRED'`
         - `complianceActionAt = currentTime`
         - `complianceOfficerId = 'SYSTEM'`
         - `version = { increment: 1 }`
       - Inserts an immutable `AuditLog` entry:
         - `actorId = 'SYSTEM'`, `actorType = 'SYSTEM'`
         - `action = 'LISTING_SUSPENDED_COMPLIANCE_FAL_EXPIRED'`
         - `entityType = 'Listing'`, `entityId = listing.id`
         - `payload`: `{ listingId: listing.id, listingTitle: listing.title, previousStatus: 'ACTIVE', reason: 'FAL_LICENSE_EXPIRED' }`
     - Dispatches notification/event `listing.under_compliance_review` summarizing the suspended listings.

4. **Strict Protection of In-Flight Deals & Non-Active Listings (`FR-7`, `BR-14`, `UJ-2`):**
   - **Given** listings belonging to the expired marketer:
   - **Then** any listing currently bound to an active, non-terminal deal (`status = ListingStatus.RESERVED` or with an active Deal in `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`):
     - MUST NOT be moved to `UNDER_COMPLIANCE_REVIEW`.
     - Remains in `ListingStatus.RESERVED` so the deal, payment proof submission, and administrative transfer verification continue completely uninterrupted.
   - **And** listings in any other non-active status (`DRAFT`, `PENDING_REVIEW`, `PENDING_FEE`, `ARCHIVED`, `SOLD`, `BLOCKED`, `SUSPENDED`, `REJECTED`):
     - Are strictly excluded and remain in their current status with zero modifications.

5. **Automated Daily Expiry Warning Notifications Job (`JOB_FAL_EXPIRY_WARNINGS`, `FR-7`, `[ASSUMPTION: A-05]`):**
   - **Given** the background worker process (`apps/worker`).
   - **When** the `fal-expiry-warnings` job triggers on its registered daily schedule at 05:00 UTC / 08:00 KSA (`0 5 * * *`).
   - **Then** it executes via `pg-boss` with singleton key `fal-expiry-warnings`, `retryLimit: 3`, `retryDelay: 120`, `retryBackoff: true`, `expireInMinutes: 30`.
   - **And** evaluates temporal windows using `workerClock.now()` (or injected `currentTime: Date`).
   - **And** scans all active Fal licenses (`status = ProfileStatus.ACTIVE`) whose `expiryDate > currentTime` and computes exact calendar days remaining:
     - Window 1: Exactly 30 days prior (`calendarDaysRemaining === 30`).
     - Window 2: Exactly 7 days prior (`calendarDaysRemaining === 7`).
     - Window 3: Exactly 1 day prior (`calendarDaysRemaining === 1`).
   - **And** enforces an Idempotency Guard:
     - Verifies whether an `AuditLog` entry with `action = 'FAL_EXPIRY_WARNING_DISPATCHED'`, `entityId = license.id`, and `payload.daysRemaining = days` was already logged on the current calendar date (`createdAt >= startOfCurrentDate`).
     - If already dispatched today, skips to prevent duplicate daily warnings upon job retry.
   - **And** if eligible:
     - Inserts an `AuditLog` entry:
       - `actorId = 'SYSTEM'`, `actorType = 'SYSTEM'`
       - `action = 'FAL_EXPIRY_WARNING_DISPATCHED'`
       - `entityType = 'FalLicense'`, `entityId = license.id`
       - `payload`: `{ daysRemaining, expiryDate: license.expiryDate.toISOString(), licenseNumber: license.licenseNumber }`
     - Dispatches warning notification/event `fal.expiry_warning` with payload `{ daysRemaining, expiryDate, licenseNumber, marketerUserId: userProfile.userId }`.

6. **Marketer Workspace API Guard & UI Restriction Banners (`FR-3`, `FR-7`, `FR-59`, `EXPERIENCE.md §5`):**
   - **Given** an authenticated user whose marketer profile or Fal license is `COMPLIANCE_RESTRICTED`:
   - **When** attempting to create a new property listing (`POST /api/v1/listings`):
     - The request is rejected with HTTP `403 Forbidden` and error code `FAL_COMPLIANCE_RESTRICTED` ("لا يمكن إنشاء إعلانات جديدة نظراً لانتهاء صلاحية رخصة فال وتقييد الحساب للامتثال").
   - **And** on `/app/marketer` (Marketer Operational Dashboard):
     - When `falLicense.status === ProfileStatus.COMPLIANCE_RESTRICTED`:
       - Renders a prominent red/danger compliance restriction card:
         «تم تقييد حسابك لانتهاء صلاحية رخصة فال. تم تعليق ظهور إعلاناتك النشطة آلياً، بينما تستمر الصفقات الجارية دون انقطاع. يرجى تجديد الرخصة لاستعادة نشاط الحساب.»
       - Disables the "إضافة عقار جديد" (New Listing) button with a clear tooltip / message.
       - Features a primary CTA button "تجديد رخصة فال" linking to `/app/marketer/fal-license` (or `/app/marketer/onboarding`).
       - Active listings table displays status badge `معلق للامتثال` (`UNDER_COMPLIANCE_REVIEW`).
     - When `falLicense.status === ProfileStatus.ACTIVE` but `daysRemaining <= 30`:
       - Renders an amber alert banner showing countdown of remaining days:
         «تنبيه: تنتهي صلاحية رخصة فال خلال X يوم. يرجى تجديد الرخصة في الوقت المحدد لتفادي تعليق الإعلانات».

7. **Pure Logic Helpers & Shared Contracts (`packages/shared`):**
   - Pure functions in `packages/shared/src/licensing/expiry.ts`:
     - `isFalLicenseExpired(license: { expiryDate: Date | string }, currentTime: Date): boolean`
     - `calculateCalendarDaysRemaining(expiryDate: Date | string, currentTime: Date): number`
     - `getFalLicenseWarningWindow(expiryDate: Date | string, currentTime: Date): 30 | 7 | 1 | null`
     - `isListingEligibleForComplianceSuspension(listing: { status: ListingStatus }): boolean`
   - Unit tests covering all leap-year, timezone, and edge boundary conditions.

8. **End-to-End Suite Health & Zero Regressions:**
   - Worker tests verify:
     - 0 expired licenses -> clean no-op, 0 processed.
     - Expired active license -> `FalLicense` & `UserProfile` set to `COMPLIANCE_RESTRICTED`.
     - Expired marketer's active listings -> set to `UNDER_COMPLIANCE_REVIEW` with compliance metadata.
     - Expired marketer's reserved listings (in-flight deals) -> unchanged in `RESERVED`.
     - Non-active listings (`DRAFT`, `PENDING_REVIEW`, `ARCHIVED`, etc.) -> unchanged.
     - 30-day, 7-day, 1-day warning trigger -> audit log created, notification dispatched.
     - Repeated warning runs on the same calendar day -> idempotent skip.
   - All workspace tests (`@elmasaif/shared`, `apps/api`, `apps/worker`, `apps/web`) pass cleanly.

## Tasks / Subtasks

- [x] **Task 1: Shared Constants, Pure Evaluation Helpers & Unit Tests (`packages/shared`)** (AC: #1, #2, #3, #4, #5, #7)
  - [x] 1.1 In `packages/shared/src/constants/licensing.ts`:
    - Export audit actions:
      - `AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED = 'FAL_LICENSE_RESTRICTED_EXPIRED'`
      - `AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED = 'LISTING_SUSPENDED_COMPLIANCE_FAL_EXPIRED'`
      - `AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED = 'FAL_EXPIRY_WARNING_DISPATCHED'`
    - Export notification event constants:
      - `NOTIFICATION_FAL_EXPIRY_WARNING = 'fal.expiry_warning'`
      - `NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED = 'fal.license_expired_restricted'`
      - `NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW = 'listing.under_compliance_review'`
    - Export compliance metadata:
      - `COMPLIANCE_CATEGORY_FAL_EXPIRED = 'FAL_LICENSE_EXPIRED'`
      - `COMPLIANCE_REASON_FAL_EXPIRED_AR = 'انتهت صلاحية رخصة فال للمسوق وتم تعليق الإعلان آلياً لحين تجديد الرخصة والامتثال'`
    - Export error code:
      - `FAL_COMPLIANCE_RESTRICTED = 'FAL_COMPLIANCE_RESTRICTED'`
  - [x] 1.2 Create `packages/shared/src/licensing/expiry.ts`:
    - Implement `isFalLicenseExpired(license: { expiryDate: Date | string }, currentTime: Date): boolean`.
    - Implement `calculateCalendarDaysRemaining(expiryDate: Date | string, currentTime: Date): number`.
    - Implement `getFalLicenseWarningWindow(expiryDate: Date | string, currentTime: Date): 30 | 7 | 1 | null`.
    - Implement `isListingEligibleForComplianceSuspension(listing: { status: ListingStatus }): boolean` (returns true ONLY if `status === ListingStatus.ACTIVE`).
  - [x] 1.3 Export helpers in `packages/shared/src/licensing/index.ts` and `packages/shared/src/index.ts`.
  - [x] 1.4 Add unit tests in `packages/shared/src/licensing/__tests__/expiry.spec.ts`.
  - [x] 1.5 Run `npm run build --workspace=@elmasaif/shared`.

- [x] **Task 2: Worker Job Implementation — Fal License Expiry (`apps/worker`)** (AC: #1, #2, #3, #4)
  - [x] 2.1 Define `FalLicenseExpiryDbClient` interface in `apps/worker/src/jobs/fal-license-expiry.job.ts`.
  - [x] 2.2 Implement `createFalLicenseExpiryLogic(db?: FalLicenseExpiryDbClient)`:
    - Finds active/non-restricted Fal licenses where `expiryDate <= currentTime`.
    - For each expired license, within a transaction:
      - Updates `FalLicense.status = ProfileStatus.COMPLIANCE_RESTRICTED` (and increments version).
      - Updates `UserProfile.status = ProfileStatus.COMPLIANCE_RESTRICTED`.
      - Finds all `Listing` records where `sellerProfileId = profile.id` and `status = ListingStatus.ACTIVE`.
      - Updates qualifying listings to `UNDER_COMPLIANCE_REVIEW` with `complianceReason`, `complianceCategory`, `complianceActionAt = currentTime`, and `complianceOfficerId = 'SYSTEM'`.
      - Confirms that listings in `RESERVED` (in-flight deals) are untouched.
      - Writes `AuditLog` entries for license restriction and listing suspensions.
    - Returns processed counts and structured outcome summary.
  - [x] 2.3 Wire up default handler in `fal-license-expiry.job.ts` with `getPrismaClient()` (if available) and register in `apps/worker/src/jobs/index.ts`.
  - [x] 2.4 Add unit tests in `apps/worker/src/jobs/__tests__/fal-license-expiry.job.spec.ts`.

- [x] **Task 3: Worker Job Implementation — Fal Expiry Warnings (`apps/worker`)** (AC: #5)
  - [x] 3.1 Define `FalExpiryWarningsDbClient` interface in `apps/worker/src/jobs/fal-expiry-warnings.job.ts`.
  - [x] 3.2 Implement `createFalExpiryWarningsLogic(db?: FalExpiryWarningsDbClient)`:
    - Finds active Fal licenses where `expiryDate > currentTime`.
    - Evaluates warning window (30, 7, 1 days).
    - Checks `AuditLog` for existing warning on current calendar day (Idempotency Guard).
    - Logs warning `AuditLog` and dispatches notification event for eligible licenses.
    - Returns dispatched alert count and summary.
  - [x] 3.3 Add unit tests in `apps/worker/src/jobs/__tests__/fal-expiry-warnings.job.spec.ts`.

- [x] **Task 4: API Listing Creation Guard for Restricted Marketers (`apps/api`)** (AC: #6)
  - [x] 4.1 In `apps/api/src/modules/listings/listings.service.ts` (or listing creation controller/guard):
    - Verify marketer profile status and `falLicense.status` before permitting listing creation.
    - If `status === ProfileStatus.COMPLIANCE_RESTRICTED`, throw `ForbiddenException` (`FAL_COMPLIANCE_RESTRICTED`).
  - [x] 4.2 In `apps/api/src/modules/licenses/licenses.service.ts`:
    - Ensure `getMyFalLicense` returns current warning state and `daysRemaining`.
  - [x] 4.3 Add/update unit tests in `apps/api/src/modules/listings/__tests__/listings.service.spec.ts`.

- [x] **Task 5: Marketer Workspace UI Warning & Compliance Restriction States (`apps/web`)** (AC: #6)
  - [x] 5.1 In `apps/web/src/app/app/marketer/page.tsx`:
    - Fetch marketer Fal license status via `GET /api/v1/users/fal-license`.
    - If `COMPLIANCE_RESTRICTED`:
      - Render red compliance restriction card with Arabic explanation.
      - Disable "إضافة عقار جديد" button.
      - Add CTA "تجديد رخصة فال" pointing to `/app/marketer/fal-license`.
    - If `ACTIVE` with `daysRemaining <= 30`:
      - Render amber warning card indicating days until expiration.
    - Ensure listings in `UNDER_COMPLIANCE_REVIEW` display the appropriate badge in the listings table.
  - [x] 5.2 In `apps/web/src/app/app/marketer/onboarding/page.tsx`:
    - If `COMPLIANCE_RESTRICTED`, display status card with explanation and prompt to proceed with renewal (pre-fills for Story 6.3).
  - [x] 5.3 Write unit tests in `apps/web/src/app/app/marketer/__tests__/marketer-compliance-states.spec.tsx`.

- [x] **Task 6: Verification & Full Suite Sanity Checks** (AC: #1 through #8)
  - [x] 6.1 Run test suites across workspaces:
    - `npm test --workspace=@elmasaif/shared`
    - `npm test --workspace=apps/worker`
    - `npm test --workspace=apps/api`
    - `npm test --workspace=apps/web`
  - [x] 6.2 Run builds across workspaces:
    - `npm run build --workspace=@elmasaif/shared`
    - `npm run build --workspace=apps/worker`
    - `npm run build --workspace=apps/api`
    - `npm run build --workspace=apps/web`

## Dev Notes

- **Deterministic Time Invariant:** Both `fal-license-expiry` and `fal-expiry-warnings` jobs MUST obtain current time exclusively via `workerClock.now()` (or injected `currentTime: Date`). Raw unmockable `new Date()` calls are strictly forbidden in domain and scheduling logic.
- **In-Flight Deals Protection:** A foundational business rule (`FR-7`, `BR-14`) states that existing in-flight deals continue unaffected to completion. Listings in `ListingStatus.RESERVED` MUST NOT be suspended; only `ListingStatus.ACTIVE` listings are moved to `UNDER_COMPLIANCE_REVIEW`.
- **Worker Job Architecture:** Reuses the established `createJobHandler` wrapper and dependency-injectable logic pattern established in Story 5.5 (`payment-deadline-expiry.job.ts`) and Story 1.9 (`account-deletion-expiry.job.ts`).
- **Idempotency Guard:** `fal-expiry-warnings` runs daily at 05:00 UTC. If pg-boss retries the job due to transient database or network blips, checking the `AuditLog` for existing warning records on the current calendar day prevents duplicate notification spam to users.
- **Shared Package Rebuild:** Remember that `apps/worker`, `apps/api`, and `apps/web` import compiled `@elmasaif/shared`. Run `npm run build --workspace=@elmasaif/shared` immediately after creating or modifying files in `packages/shared`.

### Project Structure Notes

- Worker job files to implement / update:
  - `apps/worker/src/jobs/fal-license-expiry.job.ts` (UPDATE)
  - `apps/worker/src/jobs/fal-expiry-warnings.job.ts` (UPDATE)
  - `apps/worker/src/jobs/__tests__/fal-license-expiry.job.spec.ts` (NEW)
  - `apps/worker/src/jobs/__tests__/fal-expiry-warnings.job.spec.ts` (NEW)
- Shared package files:
  - `packages/shared/src/licensing/expiry.ts` (NEW)
  - `packages/shared/src/licensing/__tests__/expiry.spec.ts` (NEW)
  - `packages/shared/src/licensing/index.ts` (NEW / UPDATE)
  - `packages/shared/src/constants/licensing.ts` (UPDATE)
- Web app files:
  - `apps/web/src/app/app/marketer/page.tsx` (UPDATE)
  - `apps/web/src/app/app/marketer/onboarding/page.tsx` (UPDATE)
  - `apps/web/src/app/app/marketer/__tests__/marketer-compliance-states.spec.tsx` (NEW)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Automated Daily Fal Expiry Enforcement Worker Job]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-7: Automated Fal Expiry Enforcement]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#BR-14: Fal License Expiry Listing Suspension]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#2. Asynchronous Jobs & pg-boss Worker Topology]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#5. Fal License Profile State Transitions]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Journey 2: Sara Onboards as a Fal-Certified Marketer]
- [Source: _bmad-output/implementation-artifacts/5-5-automated-payment-timeout-worker-job.md]
- [Source: _bmad-output/implementation-artifacts/6-1-fal-license-onboarding-administrative-verification.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

- Verified all unit and integration tests across 4 workspaces: `@elmasaif/shared`, `apps/worker`, `apps/api`, `apps/web`.
- Confirmed TypeScript compilation (`tsc`) and Next.js / Nest build across all workspaces.

### Completion Notes List

- Implemented pure evaluation helpers in `packages/shared/src/licensing/expiry.ts`: `isFalLicenseExpired`, `calculateCalendarDaysRemaining`, `getFalLicenseWarningWindow`, `isListingEligibleForComplianceSuspension`.
- Exported licensing constants in `packages/shared/src/constants/licensing.ts` (`AUDIT_ACTION_FAL_LICENSE_RESTRICTED_EXPIRED`, `AUDIT_ACTION_LISTING_SUSPENDED_FAL_EXPIRED`, `AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED`, `NOTIFICATION_FAL_EXPIRY_WARNING`, `NOTIFICATION_FAL_LICENSE_EXPIRED_RESTRICTED`, `NOTIFICATION_LISTING_UNDER_COMPLIANCE_REVIEW`, `COMPLIANCE_CATEGORY_FAL_EXPIRED`, `COMPLIANCE_REASON_FAL_EXPIRED_AR`, `FAL_COMPLIANCE_RESTRICTED`).
- Implemented `createFalLicenseExpiryLogic` in `apps/worker/src/jobs/fal-license-expiry.job.ts`: scans expired licenses (`expiryDate <= currentTime`), executes atomic transitions to `COMPLIANCE_RESTRICTED` on `FalLicense` and `UserProfile`, suspends only `ACTIVE` listings to `UNDER_COMPLIANCE_REVIEW` with compliance metadata and audit logs, and strictly preserves `RESERVED` listings (in-flight deals) and non-active statuses.
- Implemented `createFalExpiryWarningsLogic` in `apps/worker/src/jobs/fal-expiry-warnings.job.ts`: scans active Fal licenses nearing expiration in 30, 7, and 1 days windows, incorporates Idempotency Guard against duplicate daily warning dispatches, and logs audit entries.
- Added API restriction guard in `apps/api/src/modules/listings/listings.service.ts`: blocks listing creation with HTTP 403 `FAL_COMPLIANCE_RESTRICTED` when marketer profile or Fal license is `COMPLIANCE_RESTRICTED`.
- Enriched `getMyFalLicense` in `apps/api/src/modules/licenses/licenses.service.ts` to return `daysRemaining`, `isExpired`, and `warningWindow`.
- Enhanced Marketer Dashboard (`apps/web/src/app/app/marketer/page.tsx`): dynamically renders red compliance restriction banner, disables "إضافة عقار جديد" button, provides direct renewal CTA, renders amber warning banner for licenses expiring within 30 days, and displays `معلق للامتثال` (`UNDER_COMPLIANCE_REVIEW`) status badges and notices.
- Updated `ListingStatusBadge` in `apps/web/src/components/listings/listing-status-badge.tsx` to handle `UNDER_COMPLIANCE_REVIEW`.
- Updated `MarketerOnboardingPage` in `apps/web/src/app/app/marketer/onboarding/page.tsx` to display restriction explanation card and pre-fill form data for renewals.
- Authored comprehensive test suites in `@elmasaif/shared`, `apps/worker`, `apps/api`, and `apps/web`.

### File List

- packages/shared/src/constants/licensing.ts (MODIFIED)
- packages/shared/src/licensing/expiry.ts (NEW)
- packages/shared/src/licensing/index.ts (NEW)
- packages/shared/src/licensing/__tests__/expiry.spec.ts (NEW)
- packages/shared/src/index.ts (MODIFIED)
- apps/worker/src/jobs/fal-license-expiry.job.ts (MODIFIED)
- apps/worker/src/jobs/fal-expiry-warnings.job.ts (MODIFIED)
- apps/worker/src/jobs/__tests__/fal-license-expiry.job.spec.ts (NEW)
- apps/worker/src/jobs/__tests__/fal-expiry-warnings.job.spec.ts (NEW)
- apps/api/src/modules/listings/listings.service.ts (MODIFIED)
- apps/api/src/modules/listings/__tests__/listings.service.spec.ts (MODIFIED)
- apps/api/src/modules/licenses/licenses.service.ts (MODIFIED)
- apps/api/src/modules/licenses/__tests__/licenses.service.spec.ts (MODIFIED)
- apps/web/src/components/listings/listing-status-badge.tsx (MODIFIED)
- apps/web/src/app/app/marketer/page.tsx (MODIFIED)
- apps/web/src/app/app/marketer/onboarding/page.tsx (MODIFIED)
- apps/web/src/app/app/marketer/__tests__/marketer-compliance-states.spec.tsx (NEW)
- _bmad-output/implementation-artifacts/sprint-status.yaml (MODIFIED)
- _bmad-output/implementation-artifacts/6-2-automated-daily-fal-expiry-enforcement-worker-job.md (MODIFIED)

