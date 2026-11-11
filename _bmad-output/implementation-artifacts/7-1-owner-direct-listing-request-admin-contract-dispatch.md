---
baseline_commit: 85a97be23f990fe66f4619b0aa7a107ef4f21650
---

# Story 7.1: Owner Direct Listing Request & Admin Contract Dispatch

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a direct property owner,
I want to submit a listing request and receive an official electronic contract dispatched by platform administration,
So that I can formalize terms to sell my property directly on the marketplace in compliance with Saudi real estate regulations.

## Acceptance Criteria

1. **Owner Direct Listing Request Submission (`/app/owner/listings/new` & `/app/owner/direct-listing`) (`FR-69`, `FR-9`, `UC-50`, `UJ-3`):**
   - **Given** an authenticated user operating under an active `OWNER` profile
   - **When** the owner submits property details (title, description, property type, city ID, district ID, street name, coordinates, ask price, area in m², optional bedrooms/year built, verified payout IBAN, photos, and electronic title deed document)
   - **Then** the backend validates:
     - Mandatory title deed document (`PropertyDocument.documentType === 'TITLE_DEED'`) classified as `ADMIN_ONLY` visibility (`LISTING_OWNER_DEED_REQUIRED`)
     - Payout IBAN belongs to one of the owner's registered payout accounts
     - City and district IDs exist and are active in Saudi geographic master tables (`GEO_CITY_INACTIVE`, `GEO_DISTRICT_INACTIVE`)
     - Ask price is within valid marketplace bounds (`MIN_LISTING_PRICE_SAR` to `MAX_LISTING_PRICE_SAR`)
   - **And** atomically creates:
     - A `Listing` in status `PENDING_REVIEW`
     - An `OwnerListingRequest` row linked to `ownerProfileId`, `listingId`, geographic identifiers, title deed number, and status `PENDING`
     - `PropertyDocument` rows for photos and legal documents
     - An `AuditLog` entry with action `OWNER_LISTING_REQUEST_CREATED`
   - **And** returns HTTP 201 Created with the request details.

2. **Admin Owner Requests Operational Queue (`/admin/owner-requests`) (`FR-51`, `FR-69`, `UC-67`, `UJ-3`, `UJ-5`):**
   - **Given** an administrator authenticated with `AdminSessionAuthGuard` and `@RequireAdminPermission('Contracts.Review')` or `@RequireAdminPermission('Contracts.Manage')`
   - **When** calling `GET /api/v1/admin/owner-requests`
   - **Then** the endpoint returns a paginated list of owner listing requests supporting filtering by status (`PENDING`, `APPROVED_PENDING_SIGNATURE`, `REJECTED`, `MODIFICATION_REQUESTED`) and search by owner name or property title
   - **And** each queue item includes:
     - Request ID, property title, property type, city name, district name, ask price, and submission timestamp
     - Owner legal name, masked mobile number, and owner profile ID
     - Active 15-minute claim lock metadata (`ClaimLockInfo`) computed via `buildClaimLockInfo` from `apps/api/src/common/locks/claim-lock.ts`
     - Current request status badge.

3. **15-Minute Claim Locking & Task Lease Management (`FR-51`, `AD-10`):**
   - **Given** an administrator inspecting an owner listing request in the queue
   - **When** calling `POST /api/v1/admin/owner-requests/:id/claim`:
     - If unlocked or previous lease expired (`lockExpiresAt <= ClockService.now()`): atomically sets `lockedByAdminId = admin.id`, `lockedAt = now`, `lockExpiresAt = now + 15 minutes` and returns HTTP 200 with updated `ClaimLockInfo`
     - If actively locked by another admin: returns HTTP 409 Conflict with error code `OWNER_REQUEST_LOCK_CONFLICT` and holder identity
   - **When** calling `POST /api/v1/admin/owner-requests/:id/heartbeat`:
     - If caller holds the lock: extends `lockExpiresAt` by 15 minutes from `ClockService.now()`
     - If lock expired or not held: returns HTTP 409 Conflict with `OWNER_REQUEST_LOCK_EXPIRED` or `OWNER_REQUEST_LOCK_REQUIRED`
   - **When** calling `POST /api/v1/admin/owner-requests/:id/release`:
     - Clears `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` if held by the caller
   - **When** a Super Admin with `Tasks.ForceUnlock` calls `POST /api/v1/admin/owner-requests/:id/force-unlock` with mandatory `reason`:
     - Forcefully clears the lock regardless of holder, writes an immutable `AuditLog` entry (`action: 'TASK_LOCK_FORCED_RELEASE'`), and returns HTTP 200.

4. **Owner Request Review Detail & Presigned Document Preview (`/admin/owner-requests/:id`) (`FR-69`, `BR-06`):**
   - **Given** an administrator accessing `GET /api/v1/admin/owner-requests/:id`
   - **When** the page renders
   - **Then** it provides:
     - Real-time claim lock status banner with a 15-minute countdown timer and automatic 5-minute heartbeat renewal
     - Read-only inspection mode if locked by another administrator
     - Complete property specifications (type, area, price, coordinates, description, photos)
     - Title deed document with secure 300-second presigned download URL (`StorageService.resolveDownloadUrl`)
     - Owner verification details and payout IBAN verification status
     - Rejection, modification request, and contract dispatch action bars (active only when caller holds the claim lock).

5. **Contract Template Management & Seeded Standard Template (`FR-61`, `UC-69`):**
   - **Given** the system database initialization and seed process
   - **When** seeding the database
   - **Then** an active standardized legal contract template (`ContractTemplate`) is seeded with:
     - Unique identifier: `SEED_OWNER_CONTRACT_TEMPLATE_ID` (`77777777-0001-4000-8000-000000000001`)
     - Title: `عقد تسويق ووساطة عقارية إلكتروني قياسي (مالك مباشر)`
     - Content containing formal Saudi REGA mediation clauses and dynamic placeholders:
       - `{{ownerName}}`, `{{nationalId}}`, `{{propertyTitle}}`, `{{propertyType}}`, `{{cityName}}`, `{{districtName}}`, `{{askPrice}}`, `{{contractFee}}`, `{{platformIBAN}}`, `{{dispatchDate}}`
     - `isActive: true`, `version: 1`
   - **And** endpoint `GET /api/v1/admin/contract-templates` returns active contract templates for admin selection.

6. **Administrative Contract Dispatch (`FR-69`, `FR-61`, `FR-9`, `UC-67`, `UJ-3`):**
   - **Given** an administrator holding the active claim lock on an owner listing request in `PENDING` status
   - **When** submitting `POST /api/v1/admin/owner-requests/:id/dispatch-contract` with:
     - `templateId`: ID of the selected active contract template
     - `contractFee`: Numeric SAR value (default `1000.00`)
     - `feeOverrideReason`: Mandatory string if `contractFee !== 1000.00` (requires permission `Contracts.FeeOverride` or `AdminRole.SUPER_ADMIN`)
     - `customTerms`: Optional additional clauses appended to the contract terms
   - **Then** the backend atomically executes in a database transaction:
     - Verifies caller holds active claim lease (`assertClaimLockHeld`)
     - Fetches selected `ContractTemplate` and compiles `contractTerms` by interpolating owner legal name, property specs, ask price, and fee amount
     - Creates an `OwnerContract` record:
       - `listingId`: associated listing ID
       - `ownerProfileId`: owner profile ID
       - `templateId`: selected template ID
       - `contractFee`: configured contract fee (`Decimal(12,2)`)
       - `feeOverrideReason`: justification if fee was modified
       - `contractTerms`: compiled legal text
       - `status`: `PENDING_SIGNATURE`
       - `expiresAt`: `ClockService.now() + 7 days` (168 hours)
     - Updates `OwnerListingRequest.status` to `APPROVED_PENDING_SIGNATURE`
     - Clears the claim lock on `OwnerListingRequest`
     - Writes `AuditLog` entry (`action: 'OWNER_CONTRACT_DISPATCHED'`)
     - Creates an in-app notification event `contract.ready_for_signature` notifying the owner that their contract is ready for electronic review and signature.

7. **Owner Request Rejection & Modification Request Workflows (`FR-69`, `UC-68`):**
   - **Rejection Workflow:**
     - **When** calling `POST /api/v1/admin/owner-requests/:id/reject` with `{ reason: string }`
     - **Then** verifies claim lock, sets `OwnerListingRequest.status = 'REJECTED'`, stores `rejectionReason`, updates `Listing.status = 'REJECTED'`, releases the claim lock, writes `AuditLog` (`action: 'OWNER_LISTING_REQUEST_REJECTED'`), and dispatches notification to the owner.
   - **Modification Request Workflow:**
     - **When** calling `POST /api/v1/admin/owner-requests/:id/request-modification` with `{ notes: string }`
     - **Then** verifies claim lock, sets `OwnerListingRequest.status = 'MODIFICATION_REQUESTED'`, stores `modificationNotes`, releases the claim lock, writes `AuditLog` (`action: 'OWNER_LISTING_REQUEST_MODIFICATION_REQUESTED'`), and dispatches notification to the owner with specific requested adjustments.

8. **Owner Workspace Contract & Request Overview (`/app/owner` & `/app/owner/contracts`) (`FR-59`, `FR-9`, `UJ-3`):**
   - **Given** the property owner accessing `/app/owner` or `/app/owner/contracts`
   - **When** viewing their submitted requests and contracts
   - **Then** renders:
     - Distinct request status card with real-time badge:
       - `قيد المراجعة الإدارية` (Pending Review)
       - `بانتظار التوقيع الإلكتروني` (Approved Pending Signature) with prominent CTA button `مراجعة وتوقيع العقد` navigating to `/app/owner/contracts/:id`
       - `مطلوب تعديلات` (Modification Requested) with admin notes and edit link
       - `طلب مرفوض` (Rejected) with admin rejection reason
     - Overview summary of active and pending contracts.

9. **Sovereign Design System & RTL Accessibility (`UX-DR9`, `UX-DR15`):**
   - Strict adherence to the Sovereign Design System:
     - Pure RTL layout (`dir="rtl"`) with IBM Plex Sans Arabic typography
     - Admin queue styling matching existing admin panels (emerald header banner `#1B4332`, warning accents, clear typography)
     - Interactive countdown timer displaying remaining lock lease time
     - Full responsiveness across desktop, tablet, and mobile viewport widths.

## Tasks / Subtasks

- [x] Task 1: Prisma Schema & Seed Enhancement for Contracts & Templates (AC: 1, 5, 6)
  - [x] Add `ContractTemplate` model to `apps/api/prisma/schema.prisma` with title, content, version, isActive, createdByAdminId.
  - [x] Update `OwnerListingRequest` model in `apps/api/prisma/schema.prisma` with `listingId` optional 1-to-1 relation to `Listing`, `rejectionReason`, and `modificationNotes`.
  - [x] Update `OwnerContract` model with optional `templateId` foreign key to `ContractTemplate` and `feeOverrideReason`.
  - [x] Seed standard default contract template in Arabic with REGA legal clauses and parameter placeholders in `apps/api/prisma/seed.ts`.
  - [x] Execute `npx prisma generate` to refresh Prisma client types.

- [x] Task 2: Shared Types, Constants & Zod Schemas (`packages/shared`) (AC: 1, 2, 3, 5, 6, 7)
  - [x] Export `OwnerListingRequestStatus` constants/enum (`PENDING`, `APPROVED_PENDING_SIGNATURE`, `REJECTED`, `MODIFICATION_REQUESTED`).
  - [x] Define error codes in `packages/shared/src/constants/errors.ts`:
    - `OWNER_REQUEST_NOT_FOUND`
    - `OWNER_REQUEST_LOCK_REQUIRED`
    - `OWNER_REQUEST_LOCK_CONFLICT`
    - `OWNER_REQUEST_LOCK_EXPIRED`
    - `OWNER_REQUEST_INVALID_STATE`
    - `CONTRACT_TEMPLATE_NOT_FOUND`
    - `CONTRACT_TEMPLATE_INACTIVE`
    - `CONTRACT_FEE_OVERRIDE_UNAUTHORIZED`
    - `CONTRACT_FEE_OVERRIDE_REASON_REQUIRED`
    - `OWNER_REQUEST_REJECTION_REASON_REQUIRED`
    - `OWNER_REQUEST_MODIFICATION_NOTES_REQUIRED`
  - [x] Create Zod schemas in `packages/shared/src/validators/contracts.ts`:
    - `createOwnerListingRequestSchema`
    - `dispatchOwnerContractSchema`
    - `rejectOwnerListingRequestSchema`
    - `requestModificationSchema`
    - `forceUnlockOwnerRequestSchema`
    - `ownerRequestsQueueQuerySchema`
  - [x] Create TypeScript interfaces for DTOs (`OwnerListingRequestQueueItem`, `OwnerListingRequestDetailResponse`, `ContractTemplateItem`, etc.).

- [x] Task 3: Backend Contracts Module Implementation (`apps/api/src/modules/contracts`) (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Create `contracts.module.ts` registering services, controllers, and imports (`PrismaModule`, `ClockModule`, `StorageModule`).
  - [x] Create `owner-requests.service.ts`:
    - Implement `createListingRequest(userId, dto)`: atomic creation of `Listing` + `OwnerListingRequest` + documents + `AuditLog`.
    - Implement `getMyListingRequests(userId)` and `getListingRequestDetail(userId, id)`.
  - [x] Create `admin-owner-requests.service.ts`:
    - Implement `getQueue(query, adminId)` with `buildClaimLockInfo` and batch admin name resolution.
    - Implement `getDetail(id, adminId)` with presigned title deed URL.
    - Implement `claimLock`, `heartbeatLock`, `releaseLock`, and `forceUnlock` using `apps/api/src/common/locks/claim-lock.ts`.
    - Implement `dispatchContract(id, admin, dto)`: compiles contract terms, creates `OwnerContract` (`PENDING_SIGNATURE`), updates request to `APPROVED_PENDING_SIGNATURE`, writes audit log, emits notification event.
    - Implement `rejectRequest(id, admin, dto)`: updates request and listing to `REJECTED`, stores reason, writes audit log.
    - Implement `requestModification(id, admin, dto)`: updates request to `MODIFICATION_REQUESTED`, stores notes, writes audit log.
  - [x] Create `contract-templates.service.ts`:
    - Implement `getActiveTemplates()` and `getTemplateById(id)`.
  - [x] Create `owner-requests.controller.ts` for authenticated owner endpoints.
  - [x] Create `admin-owner-requests.controller.ts` and `admin-contract-templates.controller.ts` with `AdminSessionAuthGuard`, `AdminPermissionGuard`, and `@RequireAdminPermission`.
  - [x] Register `ContractsModule` in `apps/api/src/app.module.ts`.

- [x] Task 4: Admin Back-Office Owner Requests Queue & Dispatch UI (`apps/web`) (AC: 2, 3, 4, 6, 7, 9)
  - [x] Create `/admin/owner-requests/page.tsx`:
    - Tabbed queue view with filter badges, search input, and pagination.
    - Claim lock indicator badge and direct claim action button.
  - [x] Create `/admin/owner-requests/[id]/page.tsx`:
    - 15-minute claim banner with heartbeat interval timer and release button.
    - Read-only banner when locked by another administrator.
    - Super Admin force-unlock modal with justification input.
    - Property details overview, photo gallery, and title deed document viewer.
    - Contract dispatch card with template selector, default SAR 1,000 fee input, override reason field (if fee modified), live legal terms preview, and Dispatch Contract CTA.
    - Rejection and modification request action modals with mandatory textareas.
  - [x] Add "طلبات الملاك والعقود" link to admin navigation and dashboard (`apps/web/src/app/admin/page.tsx`).

- [x] Task 5: Owner Workspace Integration (`apps/web`) (AC: 1, 8, 9)
  - [x] Update `/app/owner/page.tsx` to query and display submitted listing requests with status badges.
  - [x] Add action banner for requests in `APPROVED_PENDING_SIGNATURE` navigating to `/app/owner/contracts/:id` for signing.
  - [x] Create `/app/owner/contracts/page.tsx` displaying all owner contracts with status and review links.
  - [x] Verify `/app/owner/listings/new` properly wires submission into `OwnerListingRequest` creation.

- [x] Task 6: Comprehensive Automated Tests (AC: 1, 2, 3, 5, 6, 7)
  - [x] Unit tests for `AdminOwnerRequestsService`: claim lease, heartbeat, release, force-unlock, template compilation, fee override validation, contract dispatch, rejection, modification.
  - [x] Controller tests for `AdminOwnerRequestsController` verifying dynamic RBAC permissions (`Contracts.Review`, `Contracts.Manage`, `Contracts.FeeOverride`, `Tasks.ForceUnlock`).
  - [x] Unit tests for `OwnerRequestsService` verifying owner ownership isolation and valid creation.
  - [x] Frontend tests for admin queue and dispatch components.

## Dev Notes

- **Claim Locking Standard (AD-10 / `common/locks/claim-lock.ts`):**
  - Reuse `buildClaimLockInfo`, `assertClaimLockHeld`, and `resolveClaimLockHolderNames` directly from `apps/api/src/common/locks/claim-lock.ts`.
  - Entity `OwnerListingRequest` is one of the 8 canonical claim-locked entities with columns: `lockedByAdminId`, `lockedAt`, `lockExpiresAt`.
  - Lock duration is 15 minutes (`15 * 60 * 1000` ms), renewed every 5 minutes by the frontend heartbeat hook.
- **Contract Fee & Overrides:**
  - Default contract fee is SAR 1,000.00 (`DEFAULT_OWNER_CONTRACT_FEE_SAR = 1000`).
  - Overriding the fee requires permission `Contracts.FeeOverride` or role `SUPER_ADMIN`, and must supply a non-empty `feeOverrideReason`.
- **Contract Terms Compilation:**
  - Contract terms are created by substituting template variables in `ContractTemplate.content`:
    - `{{ownerName}}`: Owner full name
    - `{{propertyTitle}}`: Property title
    - `{{propertyType}}`: Localized Arabic property type
    - `{{cityName}}`: City Arabic name
    - `{{districtName}}`: District Arabic name
    - `{{askPrice}}`: Asking price formatted in SAR
    - `{{contractFee}}`: Formatted fee in SAR
    - `{{dispatchDate}}`: Localized date of dispatch
- **State Machine Alignment:**
  - `OwnerListingRequest`: `PENDING` -> `APPROVED_PENDING_SIGNATURE` (on dispatch) | `REJECTED` | `MODIFICATION_REQUESTED`.
  - `OwnerContract`: Created in `PENDING_SIGNATURE` with `expiresAt = now + 7 days`.
  - `Listing`: Created in `PENDING_REVIEW`, remains in pending status until signed and fee paid in Story 7.3.
- **Audit Logging Requirement:**
  - Actions to record:
    - `OWNER_LISTING_REQUEST_CREATED`
    - `OWNER_CONTRACT_DISPATCHED`
    - `OWNER_LISTING_REQUEST_REJECTED`
    - `OWNER_LISTING_REQUEST_MODIFICATION_REQUESTED`
    - `TASK_LOCK_FORCED_RELEASE`

### Project Structure Notes

- API module location: `apps/api/src/modules/contracts/`
- Shared contracts: `packages/shared/src/validators/contracts.ts` and `packages/shared/src/types/contracts.ts`
- Web admin pages: `apps/web/src/app/admin/owner-requests/`
- Web owner pages: `apps/web/src/app/app/owner/contracts/` and enhancements to `apps/web/src/app/app/owner/`

### References

- [Source: epics.md#Epic 7: Owner Contracts & Electronic Signature]
- [Source: prd.md#FR-61: Standard Owner Contract Template Manager]
- [Source: prd.md#FR-69: Owner Listing Request Review & Contract Dispatch]
- [Source: prd.md#FR-51: Admin Task Claim and Operational Queue Locking]
- [Source: ARCHITECTURE-SPINE.md#Operational Queues & Task Locking]
- [Source: EXPERIENCE.md#Owner Listing Contract State Transitions]
- [Source: apps/api/src/common/locks/claim-lock.ts]

## Dev Agent Record

### Agent Model Used

Antigravity (Advanced Agentic Coding)

### Debug Log References

- Stopped conflicting node dev process locking prisma query engine dll on Windows before regenerating client.
- Fixed button variant mappings in admin owner requests (`destructive` -> `danger`, `default` -> `primary`) to match design tokens.
- Resolved React SSR comment separator nuances in unit test assertions (`<!-- -->` between adjacent texts).

### Completion Notes List

- Implemented full Prisma schema enhancements: added `ContractTemplate` entity, updated `OwnerListingRequest` with 1-to-1 `Listing` relation, `rejectionReason`, `modificationNotes`, and `OwnerContract` with `templateId` and `feeOverrideReason`.
- Added seed script for standard REGA electronic brokerage contract template with placeholder substitution syntax.
- Created shared package additions: `OwnerListingRequestStatus` enum, contracts error codes, constants (`DEFAULT_OWNER_CONTRACT_FEE_SAR`, `OWNER_CONTRACT_SIGNATURE_WINDOW_DAYS`, lock durations), TypeScript DTOs, and Zod validators in `packages/shared`.
- Implemented backend contracts module in `apps/api/src/modules/contracts`:
  - `OwnerRequestsService`: atomic request creation, owner verification, payout verification, geographic validation, audit logging.
  - `AdminOwnerRequestsService`: queue filtering, 15-minute claim locking (AD-10 standard), heartbeat renewal, voluntary release, Super Admin force unlock, contract dispatch with dynamic template compilation and fee override rules, rejection, and modification requests.
  - `ContractTemplatesService`: active template retrieval and single template lookup.
  - NestJS controllers with strict RBAC guards (`Contracts.Review`, `Contracts.Manage`, `Contracts.FeeOverride`, `Tasks.ForceUnlock`).
- Built back-office administrative UI in `apps/web/src/app/admin/owner-requests`:
  - Queue view (`page.tsx`) with status filter tabs, search, pagination, claim status pills, and direct claim actions.
  - Detail view (`[id]/page.tsx`) with real-time countdown timer, 5-minute heartbeat renewal, read-only other-admin lock banner, Super Admin force-unlock modal, presigned deed download link, owner IBAN verification, contract dispatch with live terms preview, rejection, and modification modals.
- Enhanced owner portal:
  - Updated `/app/owner/page.tsx` with listing requests section and pending signature banner.
  - Created `/app/owner/contracts/page.tsx` displaying dispatched contracts with status badges and sign CTAs.
  - Wired `ListingWizard` to support title deed input and direct owner request routing.
- Verified all automated test suites:
  - Shared contracts Zod schemas: 16 tests passing (`packages/shared/src/schemas/__tests__/contracts.spec.ts`), all 46 shared test suites (587 tests) passing.
  - Backend contracts unit tests: 29 tests passing (`apps/api/src/modules/contracts/__tests__/`).
  - Frontend web unit tests: 8 tests passing (`apps/web/src/app/admin/owner-requests/__tests__/admin-owner-requests-page.spec.tsx` and `apps/web/src/app/app/owner/__tests__/owner-contracts-page.spec.tsx`).

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/contracts.ts`
- `packages/shared/src/constants/errors.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/types/contracts.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/schemas/contracts.schema.ts`
- `packages/shared/src/validators/contracts.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/schemas/__tests__/contracts.spec.ts`
- `apps/api/src/modules/contracts/owner-request-lock.ts`
- `apps/api/src/modules/contracts/contract-templates.service.ts`
- `apps/api/src/modules/contracts/owner-requests.service.ts`
- `apps/api/src/modules/contracts/admin-owner-requests.service.ts`
- `apps/api/src/modules/contracts/owner-requests.controller.ts`
- `apps/api/src/modules/contracts/admin-owner-requests.controller.ts`
- `apps/api/src/modules/contracts/admin-contract-templates.controller.ts`
- `apps/api/src/modules/contracts/contracts.module.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/contracts/__tests__/owner-requests.service.spec.ts`
- `apps/api/src/modules/contracts/__tests__/admin-owner-requests.service.spec.ts`
- `apps/api/src/modules/contracts/__tests__/admin-owner-requests.controller.spec.ts`
- `apps/web/src/app/admin/owner-requests/contracts-helpers.ts`
- `apps/web/src/app/admin/owner-requests/page.tsx`
- `apps/web/src/app/admin/owner-requests/[id]/page.tsx`
- `apps/web/src/app/admin/owner-requests/__tests__/admin-owner-requests-page.spec.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/app/app/owner/contracts/page.tsx`
- `apps/web/src/app/app/owner/__tests__/owner-contracts-page.spec.tsx`
- `apps/web/src/app/app/owner/page.tsx`
- `apps/web/src/components/listings/listing-wizard/listing-wizard.tsx`
- `apps/web/src/components/listings/listing-wizard/types.ts`
- `_bmad-output/implementation-artifacts/7-1-owner-direct-listing-request-admin-contract-dispatch.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

