---
baseline_commit: 451931e0504a62a3b44485517b0eec855f59deed
---
# Story 2.6: Listing Archiving, Suspension & Compliance Blocking

Status: ready-for-review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a property seller (`MARKETER` or `OWNER`) or an administrative compliance officer / Super Admin (`Listings.Compliance`),
I want to archive my inactive property listings when no longer available, and allow compliance administrators to suspend (temporarily hide) or permanently block violating listings,
so that non-compliant or inactive properties are immediately removed from public search while active deals, seller autonomy, and audit trails remain strictly protected.

## Acceptance Criteria

1. **Seller Listing Archiving & In-Flight Deal / Offer Protection (`FR-14`, `UC-38`, `BR-16`, `NFR11`):**
   - **Given** an authenticated seller (`listing.sellerProfile.userId === req.user.id`) inspecting an authored listing in `ACTIVE`, `DRAFT`, or `REJECTED` status
   - **When** the seller submits an archiving request via `POST /api/v1/listings/:id/archive` with optional `reason` (max 500 chars)
   - **Then** the backend validates:
     1. Ownership: Caller must be the owner of the listing (`403 Forbidden` `LISTING_ROLE_UNAUTHORIZED` if `listing.sellerProfile.userId !== req.user.id`).
     2. Reserved Lock Guard: Listing must NOT be in `RESERVED` status (`409 Conflict` `LISTING_ARCHIVE_BLOCKED_RESERVED`).
     3. Active Deal Guard: Listing must have ZERO active/non-terminal deals (deals with status `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, or `PAYMENT_REJECTED`) (`409 Conflict` `LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL`).
     4. Active Unexpired Approved Offers Guard: Listing must have ZERO unexpired offers accepted or undergoing active review (`ACCEPTED_BY_SELLER`, `ACCEPTED_BY_BUYER`, `RELAYED_TO_SELLER`, `IN_REVIEW` where `expiresAt > ClockService.now()`) (`409 Conflict` `LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `Listing.status = ListingStatus.ARCHIVED`.
     - Increments `Listing.version` by `1` (`NFR11` optimistic concurrency).
     - Sets `archivedAt = ClockService.now()` and `archiveReason = dto.reason`.
     - Automatically withdraws or expires any outstanding open non-deal offers on this listing (`OfferStatus.WITHDRAWN`).
     - Clears any active administrative claim locks (`lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`).
     - Records an immutable `AuditLog` entry (`LISTING_ARCHIVED`) capturing `previousStatus`, `newStatus: ARCHIVED`, `sellerUserId`, and `reason`.

2. **Seller Listing Unarchiving & Reactivation Pipeline (`UC-38`, `BR-13`):**
   - **Given** an authenticated seller inspecting an authored listing with `status === ListingStatus.ARCHIVED`
   - **When** the seller submits an unarchive request via `POST /api/v1/listings/:id/unarchive`
   - **Then** the backend validates:
     1. Caller is the authorized listing owner (`403 Forbidden` `LISTING_ROLE_UNAUTHORIZED`).
     2. Listing is currently in `ARCHIVED` status (`400 Bad Request` `LISTING_NOT_ARCHIVED`).
     3. Seller profile is in good standing (if `UserRole.MARKETER`, `FalLicense` must not be expired or restricted; if `UserRole.OWNER`, linked contract must be valid).
     4. Listing was NOT suspended or blocked by compliance (`LISTING_PERMANENTLY_BLOCKED` / `LISTING_COMPLIANCE_SUSPENDED`).
   - **And** within an atomic Prisma `$transaction`:
     - Transitions `Listing.status = ListingStatus.ACTIVE` (or `ListingStatus.PENDING_REVIEW` if licensing requires re-review), increments `Listing.version` by `1`.
     - Clears `archivedAt = null` and `archiveReason = null`.
     - Records an immutable `AuditLog` entry (`LISTING_UNARCHIVED`).

3. **Administrative Compliance Suspension / Hiding (`FR-14`, `UC-66`, `Listings.Compliance`):**
   - **Given** an authenticated administrator with `Listings.Compliance` permission (`COMPLIANCE_OFFICER` or `SUPER_ADMIN`) inspecting any listing (`ACTIVE`, `PENDING_REVIEW`, `UNDER_COMPLIANCE_REVIEW`, or `ARCHIVED`)
   - **When** the administrator submits a compliance suspension via `POST /api/v1/admin/listings/:id/suspend` with mandatory `complianceReason` (10–1,000 chars) and optional `suspensionCategory` (`MISLEADING_SPECIFICATIONS`, `INVALID_FAL_LICENSE`, `UNAUTHORIZED_BROKERAGE`, `FRAUD_SUSPICION`, `OTHER`)
   - **Then** the backend validates:
     1. Listing exists (`404 Not Found`).
     2. Current status is not already `SUSPENDED` or `BLOCKED` (`409 Conflict` `LISTING_INVALID_STATE_TRANSITION`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `Listing.status = ListingStatus.SUSPENDED`, increments `Listing.version` by `1`.
     - Sets `complianceReason = dto.complianceReason`, `complianceCategory = dto.suspensionCategory`, `complianceActionAt = ClockService.now()`, and `complianceOfficerId = req.admin.id`.
     - Cancels all pending non-deal buyer offers (`OfferStatus.WITHDRAWN`).
     - If the listing was `RESERVED` with an active Deal, the Deal remains active and continues to completion (`BR-14`, `ARCHITECTURE-SPINE.md` Section 3), but the listing is completely hidden from public marketplace search.
     - Releases any active task claim locks on the listing.
     - Dispatches a structured compliance suspension notification email and in-app alert to the seller with the compliance reason.
     - Records an immutable `AuditLog` entry (`LISTING_COMPLIANCE_SUSPENDED`) capturing `complianceReason`, `suspensionCategory`, `adminId`, and `adminName`.

4. **Administrative Compliance Permanent Blocking (`FR-14`, `UC-66`, `BR-16`, `Listings.Compliance`):**
   - **Given** an authenticated administrator with `Listings.Compliance` permission (`COMPLIANCE_OFFICER` or `SUPER_ADMIN`)
   - **When** the administrator submits a permanent blocking action via `POST /api/v1/admin/listings/:id/block` with mandatory `blockingReason` (10–1,000 chars) and `violationCode`
   - **Then** the backend validates:
     1. Listing exists (`404 Not Found`).
     2. Listing is not already `BLOCKED` (`409 Conflict` `LISTING_ALREADY_BLOCKED`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `Listing.status = ListingStatus.BLOCKED`, increments `Listing.version` by `1`.
     - Sets `complianceReason = dto.blockingReason`, `complianceActionAt = ClockService.now()`, and `complianceOfficerId = req.admin.id`.
     - Cancels all pending non-deal offers (`OfferStatus.WITHDRAWN`).
     - Releases all task claim locks.
     - Dispatches a high-priority compliance ban notification to the seller.
     - Records an immutable `AuditLog` entry (`LISTING_COMPLIANCE_BLOCKED`).
     - A `BLOCKED` listing is strictly barred from unarchiving, reactivation, or seller editing.

5. **Administrative Compliance Restoration / Unsuspend (`UC-66`, `Listings.Compliance`):**
   - **Given** an authenticated administrator with `Listings.Compliance` permission inspecting a `SUSPENDED` listing
   - **When** the administrator submits an unsuspend action via `POST /api/v1/admin/listings/:id/unsuspend` with mandatory `resolutionNotes` (10–1,000 chars)
   - **Then** the backend validates:
     1. Listing exists and status is `ListingStatus.SUSPENDED` (`400 Bad Request` `LISTING_NOT_SUSPENDED`).
   - **And** within an atomic Prisma `$transaction`:
     - Updates `Listing.status = ListingStatus.ACTIVE` (or `ListingStatus.PENDING_REVIEW` if seller license or major parameters require moderation verification).
     - Increments `Listing.version` by `1`.
     - Clears `complianceReason = null`, `complianceCategory = null`, `complianceActionAt = null`, and `complianceOfficerId = null`.
     - Records an immutable `AuditLog` entry (`LISTING_COMPLIANCE_UNSUSPENDED`) with `resolutionNotes` and `adminId`.
     - Dispatches a notification to the seller informing them that compliance suspension has been resolved and the listing is restored.

6. **Public Marketplace Search Exclusion & Private Access Isolation (`FR-14`, `FR-15`, `FR-17`, `FR-20`):**
   - **Given** a buyer or unauthenticated public visitor calling `GET /api/v1/listings` or filtering listings
   - **When** a listing has status `ARCHIVED`, `SUSPENDED`, or `BLOCKED`
   - **Then** the listing is **strictly omitted** from public search results, count tallies, and map cluster markers.
   - **And** if a direct query `GET /api/v1/listings/:id` is executed:
     - Public consumers and unrelated buyers receive `404 Not Found` (or an informative status badge `مؤرشف` / `غير متاح حالياً` if retrieved by a buyer who previously bookmarked it in favorites per `FR-20`).
     - Only the authenticated author (`sellerProfile.userId === req.user.id`) or an authorized administrator (`AdminSessionAuthGuard`) can access the listing details when in `ARCHIVED`, `SUSPENDED`, or `BLOCKED` status.

7. **Admin Back-Office & Seller Dashboard UI Integration (`aapps/web`):**
   - **Given** an administrator on `/admin/listings/[id]/review` or `/admin/listings/moderation`:
     - If the admin has `Listings.Compliance` permission, the review screen displays dedicated compliance action controls:
       - **إيقاف مؤقت للامتثال (Suspend Listing)**: opens modal for `complianceReason` and `suspensionCategory`.
       - **حظر نهائي للإعلان (Block Listing)**: opens red modal with confirmation barrier for permanent ban.
       - If listing is `SUSPENDED`: displays prominent amber compliance banner with reason, officer name, and **رفع الإيقاف وإعادة التنشيط (Unsuspend Listing)** button.
       - If listing is `BLOCKED`: displays prominent red blocked banner with violation details.
     - `ListingModerationQueue`: adds filter tabs or dropdown options for `معلق للامتثال (SUSPENDED)` and `محظور (BLOCKED)` with status counters.
   - **Given** a seller on `/app/marketer` or `/app/owner`:
     - When listing is `ACTIVE`: displays an **أرشفة الإعلان (Archive Listing)** button with a confirmation modal explaining that active deals prevent archiving and open offers will be withdrawn.
     - When listing is `ARCHIVED`: displays badge `مؤرشف (Archived)` and an **إعادة النشر (Unarchive / Reactivate)** action.
     - When listing is `SUSPENDED` or `BLOCKED`: displays an institutional notice badge/banner explaining that the listing was suspended or blocked by the compliance department with the official reason, disabling edit actions.

## Tasks / Subtasks

- [x] **Task 1: Shared Enums, Error Constants, Zod Schemas & TypeScript Types (`packages/shared`)** (AC: #1, #2, #3, #4, #5, #6)
  - [x] 1.1 Update `ListingStatus` enum in `packages/shared/src/enums/index.ts` to include `ARCHIVED`, `SUSPENDED`, and `BLOCKED`.
  - [x] 1.2 Update `packages/shared/src/constants/listing.ts` with compliance and archiving error codes and constants:
    - `LISTING_ARCHIVE_BLOCKED_RESERVED = 'LISTING_ARCHIVE_BLOCKED_RESERVED'`
    - `LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL = 'LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL'`
    - `LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS = 'LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS'`
    - `LISTING_NOT_ARCHIVED = 'LISTING_NOT_ARCHIVED'`
    - `LISTING_NOT_SUSPENDED = 'LISTING_NOT_SUSPENDED'`
    - `LISTING_ALREADY_BLOCKED = 'LISTING_ALREADY_BLOCKED'`
    - `LISTING_PERMANENTLY_BLOCKED = 'LISTING_PERMANENTLY_BLOCKED'`
    - `LISTING_COMPLIANCE_REASON_REQUIRED = 'LISTING_COMPLIANCE_REASON_REQUIRED'`
  - [x] 1.3 Update `packages/shared/src/schemas/listing.schema.ts` with Zod validation schemas:
    - `archiveListingSchema`: `{ reason: z.string().trim().max(500).optional() }`
    - `suspendListingSchema`: `{ complianceReason: z.string().trim().min(10).max(1000), suspensionCategory: z.enum(['MISLEADING_SPECIFICATIONS', 'INVALID_FAL_LICENSE', 'UNAUTHORIZED_BROKERAGE', 'FRAUD_SUSPICION', 'OTHER']).optional() }`
    - `blockListingSchema`: `{ blockingReason: z.string().trim().min(10).max(1000), violationCode: z.string().trim().min(3).max(50).optional() }`
    - `unsuspendListingSchema`: `{ resolutionNotes: z.string().trim().min(10).max(1000) }`
  - [x] 1.4 Update `packages/shared/src/types/listing.ts` with TypeScript interfaces: `ArchiveListingInput`, `SuspendListingInput`, `BlockListingInput`, `UnsuspendListingInput`, and extend `ListingDetailResponse` / `ListingSummaryItem` / `ModerationQueueItem` with compliance fields (`complianceReason`, `complianceCategory`, `complianceActionAt`, `archivedAt`, `archiveReason`).
  - [x] 1.5 Add comprehensive unit tests in `packages/shared/src/schemas/__tests__/listing-compliance.spec.ts` validating all new schemas and edge cases.

- [x] **Task 2: Prisma Schema Evolution & Client Generation (`aapps/api/prisma`)** (AC: #1, #3, #4, #5)
  - [x] 2.1 Update `aapps/api/prisma/schema.prisma`:
    - Add `ARCHIVED`, `SUSPENDED`, `BLOCKED` to `enum ListingStatus`.
    - Add compliance and archiving audit fields to `model Listing`:
      - `complianceReason String? @map("compliance_reason")`
      - `complianceCategory String? @map("compliance_category")`
      - `complianceActionAt DateTime? @map("compliance_action_at")`
      - `complianceOfficerId String? @map("compliance_officer_id")`
      - `archivedAt DateTime? @map("archived_at")`
      - `archiveReason String? @map("archive_reason")`
  - [x] 2.2 Run `npx --workspace=aapps/api prisma generate` to refresh the Prisma Client.

- [x] **Task 3: Backend Seller Archiving & Unarchiving Endpoints (`aapps/api/src/modules/listings`)** (AC: #1, #2, #6)
  - [x] 3.1 Update `ListingsService` (`aapps/api/src/modules/listings/listings.service.ts`):
    - Implement `archiveListing(listingId: string, userId: string, dto: ArchiveListingInput)`:
      - Validates caller owns the listing (`LISTING_ROLE_UNAUTHORIZED`).
      - Checks listing status is NOT `RESERVED` (`LISTING_ARCHIVE_BLOCKED_RESERVED`).
      - Checks for active deals: query `deals` where status is NOT `COMPLETED`, `CANCELLED`, or `TERMINATED` (`LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL`).
      - Checks for active unexpired approved offers (`LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS`).
      - Within `prisma.$transaction`: updates status to `ListingStatus.ARCHIVED`, increments `version`, sets `archivedAt = clockService.now()`, sets `archiveReason`, updates any open non-deal offers to `WITHDRAWN`, and logs `LISTING_ARCHIVED` in `AuditLog`.
    - Implement `unarchiveListing(listingId: string, userId: string)`:
      - Validates caller owns the listing.
      - Validates current status is `ARCHIVED` (and not `SUSPENDED` or `BLOCKED`).
      - Within `prisma.$transaction`: updates status to `ListingStatus.ACTIVE`, increments `version`, clears archive fields, and logs `LISTING_UNARCHIVED` in `AuditLog`.
    - Update `getPublicActiveListings`: ensure query filter strictly includes only `ListingStatus.ACTIVE` (and `RESERVED` where applicable), excluding `ARCHIVED`, `SUSPENDED`, and `BLOCKED`.
    - Update `getListingById`: ensure `ARCHIVED`, `SUSPENDED`, and `BLOCKED` listings throw `404 Not Found` unless caller is the author seller or an admin.
  - [x] 3.2 Update `ListingsController` (`aapps/api/src/modules/listings/listings.controller.ts`):
    - Add `POST /api/v1/listings/:id/archive` guarded by `@UseGuards(SessionAuthGuard)`.
    - Add `POST /api/v1/listings/:id/unarchive` guarded by `@UseGuards(SessionAuthGuard)`.

- [x] **Task 4: Backend Administrative Compliance Endpoints (`aapps/api/src/modules/listings`)** (AC: #3, #4, #5, #6)
  - [x] 4.1 Update `AdminListingsService` (`aapps/api/src/modules/listings/admin-listings.service.ts`):
    - Implement `suspendListing(listingId: string, admin: AdminUser, dto: SuspendListingInput)`:
      - Checks listing exists.
      - Within `prisma.$transaction`: updates status to `ListingStatus.SUSPENDED`, increments `version`, sets compliance fields with `clockService.now()`, cancels pending non-deal offers, releases task claim locks, and logs `LISTING_COMPLIANCE_SUSPENDED` in `AuditLog`.
      - Dispatches compliance notification email to seller via `EmailTransportService`.
    - Implement `blockListing(listingId: string, admin: AdminUser, dto: BlockListingInput)`:
      - Checks listing exists.
      - Within `prisma.$transaction`: updates status to `ListingStatus.BLOCKED`, increments `version`, sets compliance fields, cancels pending non-deal offers, releases claim locks, and logs `LISTING_COMPLIANCE_BLOCKED` in `AuditLog`.
      - Dispatches high-priority ban notification to seller.
    - Implement `unsuspendListing(listingId: string, admin: AdminUser, dto: UnsuspendListingInput)`:
      - Checks listing exists and status is `SUSPENDED` (`LISTING_NOT_SUSPENDED`).
      - Within `prisma.$transaction`: updates status to `ListingStatus.ACTIVE`, increments `version`, clears compliance fields, and logs `LISTING_COMPLIANCE_UNSUSPENDED` in `AuditLog`.
      - Dispatches restoration notification to seller.
  - [x] 4.2 Update `AdminListingsController` (`aapps/api/src/modules/listings/admin-listings.controller.ts`):
    - Add `POST /api/v1/admin/listings/:id/suspend` guarded by `@RequireAdminPermission('Listings.Compliance')`.
    - Add `POST /api/v1/admin/listings/:id/block` guarded by `@RequireAdminPermission('Listings.Compliance')`.
    - Add `POST /api/v1/admin/listings/:id/unsuspend` guarded by `@RequireAdminPermission('Listings.Compliance')`.
  - [x] 4.3 Write comprehensive unit and integration tests in `aapps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts`, covering:
    - Seller archiving with deal guard rejection (`409 Conflict`).
    - Seller archiving with reserved status rejection (`409 Conflict`).
    - Seller archiving with active offers rejection (`409 Conflict`).
    - Seller successful archiving and offer cancellation.
    - Seller unarchiving success and state restoration.
    - Admin compliance suspension with audit log and email alert.
    - Admin permanent blocking prohibiting unarchiving.
    - Admin unsuspend restoring listing to active.
    - Non-compliance admins rejected with `403 Forbidden`.

- [x] **Task 5: Frontend Seller Dashboard Archiving & Compliance Notices (`aapps/web`)** (AC: #1, #2, #6, #7)
  - [x] 5.1 Update `/app/marketer/page.tsx` and `/app/owner/page.tsx`:
    - Add **أرشفة الإعلان** action button on `ACTIVE` listings with confirmation modal and reason input.
    - Add **إعادة النشر (إلغاء الأرشفة)** action button on `ARCHIVED` listings.
    - Render a distinct compliance warning alert banner on `SUSPENDED` or `BLOCKED` listings displaying the official compliance reason and disabling property edits.
    - Add status badge mappings for `ARCHIVED` (`مؤرشف`), `SUSPENDED` (`معلق للامتثال`), and `BLOCKED` (`محظور`).
  - [x] 5.2 Add Vitest unit tests in `aapps/web/src/components/listings/__tests__/seller-listing-archive.spec.tsx` verifying modal interactions, API calls, and status badge rendering.

- [x] **Task 6: Frontend Admin Compliance Management & Moderation Queue (`aapps/web`)** (AC: #3, #4, #5, #7)
  - [x] 6.1 Update `aapps/web/src/components/admin/listing-moderation-review.tsx`:
    - Add **إجراءات الامتثال والرقابة (`FR-14`, `UC-66`)** panel visible to operators with `Listings.Compliance` permission.
    - Add **إيقاف مؤقت (Suspend)** button triggering suspension dialog with reason and category.
    - Add **حظر نهائي (Block)** button triggering dangerous action confirmation dialog.
    - When listing is in `SUSPENDED` status, render an amber banner with details and an **إلغاء الإيقاف وإعادة التنشيط (Unsuspend)** action button with resolution notes.
  - [x] 6.2 Update `aapps/web/src/components/admin/listing-moderation-queue.tsx`:
    - Add status filter chips/tabs for `معلق للامتثال` (`SUSPENDED`) and `محظور` (`BLOCKED`).
  - [x] 6.3 Add Vitest unit tests in `aapps/web/src/components/admin/__tests__/listing-compliance.spec.tsx` verifying compliance actions, permission gating, and unsuspend flows.

## Dev Notes

### Architectural & Domain Guardrails
- **In-Flight Deals Are Sacrosanct (`FR-14`, `BR-14`, `ARCHITECTURE-SPINE.md` lines 254–262, 282):**
  - Archiving by a seller is strictly prohibited if a listing is `RESERVED` or attached to an active Deal (`AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`).
  - When an admin suspends or blocks a listing for compliance violations (`FR-14`), the listing is immediately hidden from public search and unmediated offers are cancelled, but in-flight Deals continue unaffected toward completion or dispute resolution.
- **Role-Based Access Control (`AD-12`, `packages/shared/src/constants/auth.ts`):**
  - Compliance endpoints (`POST /api/v1/admin/listings/:id/suspend`, `POST /api/v1/admin/listings/:id/block`, `POST /api/v1/admin/listings/:id/unsuspend`) are guarded by `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` and `@RequireAdminPermission('Listings.Compliance')`.
  - Both `AdminRole.SUPER_ADMIN` and `AdminRole.COMPLIANCE_OFFICER` have `Listings.Compliance` in `ADMIN_ROLE_PERMISSIONS`. Moderators lacking this permission receive `403 Forbidden`.
- **Audit Log Integrity (`BR-19`, `NFR6`, `AuditLog`):**
  - Every transition (`LISTING_ARCHIVED`, `LISTING_UNARCHIVED`, `LISTING_COMPLIANCE_SUSPENDED`, `LISTING_COMPLIANCE_BLOCKED`, `LISTING_COMPLIANCE_UNSUSPENDED`) must insert an immutable audit record in the database within the same atomic transaction containing `actorId`, `actorType`, `entityId`, `action`, `previousState`, `newState`, and `metadata` (reasons, violation codes).
- **Deterministic Time Simulation (`ClockService`):**
  - All timestamps (`archivedAt`, `complianceActionAt`, offer expiration evaluations) must use `this.clockService.now()`. Never use bare `new Date()` in domain logic.
- **Optimistic Concurrency Control (`NFR11`):**
  - Every state mutation on `Listing` increments `version` by `1` to prevent race conditions during simultaneous moderation or seller actions.

### Current State of Files Being Modified (From Codebase Inspection)

1. **`packages/shared/src/enums/index.ts`:**
   - *Current state:* `enum ListingStatus` contains `DRAFT`, `PENDING_REVIEW`, `PENDING_FEE`, `ACTIVE`, `RESERVED`, `SOLD`, `REJECTED`, `UNDER_COMPLIANCE_REVIEW`.
   - *What this story changes:* Adds `ARCHIVED = 'ARCHIVED'`, `SUSPENDED = 'SUSPENDED'`, `BLOCKED = 'BLOCKED'`.
   - *What must be preserved:* All existing enum values and order.

2. **`packages/shared/src/constants/listing.ts`:**
   - *Current state:* Defines price suggestion constants, minimum/maximum price bounds, and lock constants.
   - *What this story changes:* Exports compliance error codes (`LISTING_ARCHIVE_BLOCKED_*`, `LISTING_COMPLIANCE_REASON_REQUIRED`, `LISTING_ALREADY_BLOCKED`, etc.).

3. **`aapps/api/prisma/schema.prisma`:**
   - *Current state:* `model Listing` has lock fields (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`) and rejection fields (`rejectionReason`, `reviewedByAdminId`, `reviewedAt`).
   - *What this story changes:* Extends `enum ListingStatus` with `ARCHIVED`, `SUSPENDED`, `BLOCKED`, and adds `complianceReason`, `complianceCategory`, `complianceActionAt`, `complianceOfficerId`, `archivedAt`, and `archiveReason` to `model Listing`.
   - *What must be preserved:* Composite foreign keys, indexes, relations to `City`, `District`, `UserProfile`, `PropertyDocument`, `PriceSuggestion`, `Offer`, `Deal`.

4. **`aapps/api/src/modules/listings/listings.service.ts` & `listings.controller.ts`:**
   - *Current state:* Implements listing creation, upload, detail retrieval, price suggestion responses.
   - *What this story changes:* Adds `archiveListing` and `unarchiveListing`; adjusts `getPublicActiveListings` to filter out non-active/non-reserved listings, and `getListingById` to restrict archived/suspended/blocked listings to author and admins.
   - *What must be preserved:* Quarantine media pipeline, private document signed URLs, price suggestion accept/decline flows.

5. **`aapps/api/src/modules/listings/admin-listings.service.ts` & `admin-listings.controller.ts`:**
   - *Current state:* Handles queue retrieval, claim locking, approve/reject, and price suggestions.
   - *What this story changes:* Adds `suspendListing`, `blockListing`, and `unsuspendListing` methods and controller endpoints with `@RequireAdminPermission('Listings.Compliance')`.
   - *What must be preserved:* 15-minute claim locking logic, optimistic locking `version` increments, audit logging.

6. **`aapps/web/src/app/app/marketer/page.tsx`, `aapps/web/src/app/app/owner/page.tsx`:**
   - *Current state:* Renders active/rejected listing cards and price suggestion cards.
   - *What this story changes:* Adds archive/unarchive action controls, confirmation modals, and compliance warning banners on suspended/blocked listings.

7. **`aapps/web/src/components/admin/listing-moderation-review.tsx`, `listing-moderation-queue.tsx`:**
   - *Current state:* Renders property specs, document review, price suggestion form, and approve/reject actions.
   - *What this story changes:* Adds compliance action controls (Suspend, Block, Unsuspend) guarded by `Listings.Compliance` permission, and queue status filtering for `SUSPENDED` and `BLOCKED`.

### Project Structure Notes

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/enums/index.ts`
  - `packages/shared/src/constants/listing.ts`
  - `packages/shared/src/schemas/listing.schema.ts`
  - `packages/shared/src/types/listing.ts`
  - `packages/shared/src/schemas/__tests__/listing-compliance.spec.ts`
- **Backend API (`aapps/api`):**
  - `aapps/api/prisma/schema.prisma`
  - `aapps/api/src/modules/listings/listings.service.ts`
  - `aapps/api/src/modules/listings/listings.controller.ts`
  - `aapps/api/src/modules/listings/admin-listings.service.ts`
  - `aapps/api/src/modules/listings/admin-listings.controller.ts`
  - `aapps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts`
- **Frontend Web (`aapps/web`):**
  - `aapps/web/src/app/app/marketer/page.tsx`
  - `aapps/web/src/app/app/owner/page.tsx`
  - `aapps/web/src/components/admin/listing-moderation-review.tsx`
  - `aapps/web/src/components/admin/listing-moderation-queue.tsx`
  - `aapps/web/src/components/listings/__tests__/seller-listing-archive.spec.tsx`
  - `aapps/web/src/components/admin/__tests__/listing-compliance.spec.tsx`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 2.6: Listing Archiving, Suspension & Compliance Blocking]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md`#FR-14: Listing Archiving & Compliance Suspension, #BR-14, #BR-16]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#3. Property Listing State Machine Transitions, #AD-11, #AD-12]
- [Source: `_bmad-output/ideal.md`#UC-38 Archive a listing, #UC-66 Compliance actions]
- [Source: `_bmad-output/implementation-artifacts/2-5-admin-price-suggestion-seller-response.md`]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

### Completion Notes List

- Task 1 Completed: Updated packages/shared with ARCHIVED, SUSPENDED, and BLOCKED statuses in ListingStatus enum; added SuspensionCategory enum; declared all compliance & archiving error constants; created archiveListingSchema, suspendListingSchema, blockListingSchema, and unsuspendListingSchema Zod schemas; updated TypeScript types and extended ListingDetailResponse, ListingSummaryItem, and ModerationQueueItem. Unit tests verified in packages/shared/src/schemas/__tests__/listing-compliance.spec.ts (18 tests passing).
- Task 2 Completed: Updated aapps/api/prisma/schema.prisma adding ARCHIVED, SUSPENDED, and BLOCKED to ListingStatus enum; added WITHDRAWN to OfferStatus enum; added complianceReason, complianceCategory, complianceActionAt, complianceOfficerId, archivedAt, and archiveReason to model Listing; generated Prisma client with npx --workspace=aapps/api prisma generate.
- Task 3 Completed: Implemented archiveListing and unarchiveListing in ListingsService with strict guards: caller ownership, reserved status lock (409 Conflict), active in-flight deals (409 Conflict), active unexpired approved offers (409 Conflict). Atomic transaction increments version, updates status, records immutable AuditLog, clears claim locks, and transitions unmediated offers to WITHDRAWN. Updated getListingById to isolate archived, suspended, and blocked listings from public access with 404 (accessible to listing author seller and administrators). Exposed POST /api/v1/listings/:id/archive and POST /api/v1/listings/:id/unarchive in ListingsController.
- Task 4 Completed: Implemented suspendListing, blockListing, and unsuspendListing in AdminListingsService with @RequireAdminPermission('Listings.Compliance') in AdminListingsController. Actions perform atomic updates, increment optimistic lock version, release claim locks, cancel pending offers, log immutable AuditLog records, and dispatch seller notifications via EmailTransportService. Verified in aapps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts (19 tests passing). Full aapps/api test suite passed (42 test suites, 411 tests passing).
- Task 5 Completed: Created SellerListingArchiveActions and ListingStatusBadge in aapps/web/src/components/listings. Integrated archive modals, unarchive action triggers, status badges, and compliance alert banners (amber for SUSPENDED, red for BLOCKED) into /app/marketer and /app/owner. Verified with Vitest tests in aapps/web/src/components/listings/__tests__/seller-listing-archive.spec.tsx (9 tests passing).
- Task 6 Completed: Added compliance filter tabs in ListingModerationQueue. Implemented compliance actions panel in ListingModerationReview guarded by Listings.Compliance permission, with Suspend, Block, and Unsuspend dialogs and compliance alert banners. Verified with Vitest tests in aapps/web/src/components/admin/__tests__/listing-compliance.spec.tsx (6 tests passing). Full aapps/web test suite passed (34 test files, 141 tests passing).
- Full workspace build (npm run build) completed cleanly across all packages and applications.

### File List

- packages/shared/src/enums/index.ts
- packages/shared/src/constants/listing.ts
- packages/shared/src/schemas/listing.schema.ts
- packages/shared/src/types/listing.ts
- packages/shared/src/schemas/__tests__/listing-compliance.spec.ts
- apps/api/prisma/schema.prisma
- apps/api/src/modules/listings/listings.service.ts
- apps/api/src/modules/listings/listings.controller.ts
- apps/api/src/modules/listings/admin-listings.service.ts
- apps/api/src/modules/listings/admin-listings.controller.ts
- apps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts
- apps/web/src/components/listings/seller-listing-archive-modal.tsx
- apps/web/src/components/listings/listing-status-badge.tsx
- apps/web/src/components/listings/index.ts
- apps/web/src/app/app/marketer/page.tsx
- apps/web/src/app/app/owner/page.tsx
- apps/web/src/components/admin/listing-moderation-review.tsx
- apps/web/src/components/admin/listing-moderation-queue.tsx
- apps/web/src/components/listings/__tests__/seller-listing-archive.spec.tsx
- apps/web/src/components/admin/__tests__/listing-compliance.spec.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
