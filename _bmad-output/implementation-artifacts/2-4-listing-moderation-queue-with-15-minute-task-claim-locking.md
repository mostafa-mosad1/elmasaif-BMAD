---
baseline_commit: 1b488948184d5d582bb8dcc04ddbe39e614c9859
---
# Story 2.4: Listing Moderation Queue with 15-Minute Task Claim Locking

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrator reviewing submitted listings (`Listings.Review` permission),
I want an exclusive 15-minute task claim lock on listing moderation reviews with a 5-minute heartbeat extension, read-only inspection banners for other operators, and Super Admin force-unlock support,
so that multiple operators do not perform conflicting review decisions on the same listing simultaneously.

## Acceptance Criteria

1. **Moderation Queue Listing & Filtering (`FR-13`, `Listings.Review`):**
   - **Given** an authenticated administrator with `Listings.Review` permission (such as `MODERATOR` or `SUPER_ADMIN`) navigating to the Listing Moderation Queue (`/admin/listings/moderation` or `/admin/listings`)
   - **When** the queue screen loads (`GET /api/v1/admin/listings/moderation-queue`)
   - **Then** it returns paginated listings filtered by moderation status (defaulting to `PENDING_REVIEW`, with optional filter for `REJECTED` or `ACTIVE`), ordered by oldest submission first (`createdAt ASC`) so the longest-waiting listings are reviewed first
   - **And** each queue row displays the listing title, property type, location (`cityName`, `districtName`), ask price in SAR (`JetBrains Mono`), seller role (`MARKETER` / `OWNER`) & name, document count, submission timestamp, and current lock status (`Available`, `Locked by You`, or `Locked by [Admin Full Name] until [Expiry]`).

2. **Exclusive 15-Minute Task Claim Lease Acquisition (`FR-51`, `AD-10`):**
   - **Given** an authenticated administrator with `Listings.Review` permission
   - **When** the admin clicks "Claim & Review" on a listing in `PENDING_REVIEW` status (`POST /api/v1/admin/listings/:id/claim`)
   - **Then** if the listing is currently unlocked (`lockedByAdminId == null` or `lockExpiresAt <= ClockService.now()`) OR already locked by the same admin (`lockedByAdminId === req.admin.id`), the backend atomically acquires/extends a 15-minute lease (`15 * 60 * 1000` ms) using `ClockService.now()`, setting `lockedByAdminId = req.admin.id`, `lockedAt = now`, and `lockExpiresAt = now + 15 minutes`, and records an `AuditLog` entry (`LISTING_MODERATION_CLAIMED`)
   - **And** if the listing is currently locked by a *different* administrator whose lease has not expired (`lockExpiresAt > ClockService.now()`), the endpoint rejects the claim with HTTP `409 Conflict` (`LISTING_LOCK_CONFLICT`) returning the active lock holder's `lockedByAdminId`, `lockedByAdminName`, `lockedAt`, and `lockExpiresAt`.

3. **5-Minute Client Heartbeat Renewal & Explicit Release (`FR-51`, `AD-10`):**
   - **Given** an administrator actively holding the claim lock on a listing review screen (`/admin/listings/:id/review`)
   - **When** the review screen remains open and active
   - **Then** the client automatically dispatches a heartbeat request (`POST /api/v1/admin/listings/:id/heartbeat`) every 5 minutes (`300_000` ms) to extend `lockExpiresAt` by 15 minutes from `ClockService.now()`
   - **And** the admin can also explicitly release the lock (`POST /api/v1/admin/listings/:id/release`) when navigating away or clicking "Release Task", which clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null` and logs `LISTING_MODERATION_RELEASED`.

4. **Read-Only Banner & Disabled Controls for Concurrent Operators (`FR-51`, `EXPERIENCE.md`):**
   - **Given** Admin B opens the review screen for a listing currently leased by Admin A (`lockedByAdminId !== currentAdmin.id` and `lockExpiresAt > now`)
   - **When** the listing moderation detail view renders (`GET /api/v1/admin/listings/:id`)
   - **Then** a prominent amber read-only lock banner (`bg-amber-50 border-amber-300 text-amber-900`) is displayed showing the current lock holder's full name (`lockedByAdminName`) and a live countdown timer (`MM:SS` in `JetBrains Mono`) until `lockExpiresAt`
   - **And** all mutation action buttons (Approve, Reject, Release) are disabled for Admin B while the lease remains active.

5. **Super Admin Force-Unlock Override (`Tasks.ForceUnlock`, `AD-10`):**
   - **Given** an administrator with `Tasks.ForceUnlock` permission (`SUPER_ADMIN`) viewing a listing locked by another administrator
   - **When** the Super Admin clicks "Force Unlock", supplies a mandatory reason (`min 5 chars`), and submits (`POST /api/v1/admin/listings/:id/force-unlock`)
   - **Then** the backend verifies `Tasks.ForceUnlock` permission, clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null` (or optionally transfers the lock), and writes an immutable `AuditLog` entry (`LISTING_MODERATION_FORCE_UNLOCKED`) containing `previousLockHolderId`, `superAdminId`, and `reason`.

6. **Moderation Decision (Approve / Reject with Mandatory Notes) & Optimistic Concurrency (`FR-13`, `AD-10`):**
   - **Given** an administrator with `Listings.Review` who holds the active claim lock on a `PENDING_REVIEW` listing
   - **When** submitting an approval (`POST /api/v1/admin/listings/:id/approve`) or rejection with mandatory notes (`POST /api/v1/admin/listings/:id/reject` with `rejectionReason` min 10 chars) and the expected `version`
   - **Then** the backend verifies:
     1. The listing is in `PENDING_REVIEW` status (`LISTING_INVALID_STATE_TRANSITION` if not).
     2. The caller holds an active, non-expired claim lock on the listing (`lockedByAdminId === req.admin.id && lockExpiresAt > ClockService.now()`, otherwise `409 Conflict` `LISTING_LOCK_REQUIRED`).
     3. Optimistic concurrency `version` matches the current database record (`409 Conflict` `LISTING_VERSION_CONFLICT` if mismatched).
   - **And** within an atomic Prisma `$transaction`:
     - On **Approve**: transitions `status` to `ListingStatus.ACTIVE`, increments `version`, clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`, and records `AuditLog` (`LISTING_APPROVED`).
     - On **Reject**: transitions `status` to `ListingStatus.REJECTED`, stores `rejectionReason` (and/or records in `AuditLog` + listing moderation metadata), increments `version`, clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null`, and records `AuditLog` (`LISTING_REJECTED` with `rejectionReason`).

## Tasks / Subtasks

- [x] **Task 1: Shared Constants, Zod Schemas & TypeScript Types (`packages/shared`)** (AC: #1, #2, #3, #5, #6)
  - [x] 1.1 Update `packages/shared/src/constants/listing.ts` with moderation & locking constants:
    - `LISTING_LOCK_DURATION_MINUTES = 15`
    - `LISTING_LOCK_DURATION_MS = 15 * 60 * 1000`
    - `LISTING_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000`
    - Error codes: `LISTING_LOCK_CONFLICT`, `LISTING_LOCK_REQUIRED`, `LISTING_LOCK_EXPIRED`, `LISTING_VERSION_CONFLICT`, `LISTING_INVALID_STATE_TRANSITION`, `LISTING_REJECTION_REASON_REQUIRED`, `LISTING_FORCE_UNLOCK_REASON_REQUIRED`.
  - [x] 1.2 Update `packages/shared/src/schemas/listing.schema.ts` with Zod validation schemas:
    - `listingModerationQueueQuerySchema`: `{ status?: ListingStatus, page?: number, limit?: number, cityId?: string, propertyType?: PropertyType }`
    - `approveListingSchema`: `{ version: z.number().int().positive(), notes?: z.string().trim().max(1000).optional() }`
    - `rejectListingSchema`: `{ version: z.number().int().positive(), rejectionReason: z.string().trim().min(10, 'سبب الرفض يجب ألا يقل عن 10 أحرف').max(1000) }`
    - `forceUnlockListingSchema`: `{ reason: z.string().trim().min(5, 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف').max(500) }`
  - [x] 1.3 Update `packages/shared/src/types/listing.ts` with `ListingLockInfo`, `ModerationQueueItem`, `ModerationQueueResponse`, `ApproveListingInput`, `RejectListingInput`, and `ForceUnlockListingInput`.
  - [x] 1.4 Export all new constants, schemas, and types from `packages/shared/src/index.ts` and add unit tests in `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts`.

- [x] **Task 2: Prisma Schema Review & Optional Rejection Metadata (`apps/api/prisma`)** (AC: #2, #4, #6)
  - [x] 2.1 Inspect `model Listing` in `apps/api/prisma/schema.prisma` (lines 328–363). Note that `lockedByAdminId String?`, `lockedAt DateTime?`, `lockExpiresAt DateTime?`, `version Int @default(1)`, and `@@index([lockExpiresAt])` already exist!
  - [x] 2.2 Add optional `rejectionReason String? @map("rejection_reason")`, `reviewedByAdminId String? @map("reviewed_by_admin_id")`, and `reviewedAt DateTime? @map("reviewed_at")` (and optional relation to `AdminUser` for `lockedByAdmin` or lookup via `AdminUser`) if helpful, or resolve `lockedByAdmin` details in `AdminListingsService`. If modifying `schema.prisma`, run `npx --workspace=apps/api prisma generate` and `npx --workspace=apps/api prisma db push`.

- [x] **Task 3: Backend Admin Listing Moderation Service & Controller (`apps/api`)** (AC: #1, #2, #3, #4, #5, #6)
  - [x] 3.1 Create or verify an admin permission guard/decorator (e.g., `@RequireAdminPermission('Listings.Review')` / `AdminPermissionGuard` in `apps/api/src/modules/auth/guards/admin-permission.guard.ts`) that checks `request.admin.permissions.includes(requiredPermission)` after `AdminSessionAuthGuard`.
  - [x] 3.2 Create `apps/api/src/modules/listings/admin-listings.service.ts` implementing:
    - `getModerationQueue(query)`: Queries listings with `city`, `district`, `sellerProfile.user`, `documents` count, and resolves active `lockedByAdmin` (`id`, `fullName`, `username`) when `lockedByAdminId` is present and `lockExpiresAt > clockService.now()`. Treats expired locks (`lockExpiresAt <= now`) as unlocked.
    - `getAdminListingDetail(listingId, currentAdminId)`: Calls/extends `ListingsService.getListingById(listingId, undefined, true)` so all `PUBLIC` and `ADMIN_ONLY` documents (`TITLE_DEED`, `OWNER_AUTHORIZATION`) have short-lived signed URLs (`<= 300s`), plus full `lockInfo` (`isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminId`, `lockedByAdminName`, `lockedAt`, `lockExpiresAt`, `remainingSeconds`).
    - `claimListing(listingId, admin)`: Verifies listing exists and is in `PENDING_REVIEW`. Checks if `lockedByAdminId` is set and `lockExpiresAt > now` and `lockedByAdminId !== admin.id` -> throws `ConflictException` (`LISTING_LOCK_CONFLICT`). Otherwise sets `lockedByAdminId = admin.id`, `lockedAt = now`, `lockExpiresAt = now + 15m` and creates `AuditLog` (`LISTING_MODERATION_CLAIMED`).
    - `heartbeatListingLock(listingId, admin)`: Verifies `lockedByAdminId === admin.id` and `lockExpiresAt > now` (throws `ConflictException` `LISTING_LOCK_EXPIRED` or `LISTING_LOCK_CONFLICT` otherwise). Extends `lockExpiresAt = now + 15m`.
    - `releaseListingLock(listingId, admin)`: Verifies `lockedByAdminId === admin.id`. Clears lock fields and logs `LISTING_MODERATION_RELEASED`.
    - `forceUnlockListing(listingId, admin, dto)`: Verifies listing is currently locked, clears lock fields, and logs `LISTING_MODERATION_FORCE_UNLOCKED` with `reason` and `previousLockHolderId`.
    - `approveListing(listingId, admin, dto)`: Verifies status is `PENDING_REVIEW`, active lock held by `admin.id`, and `listing.version === dto.version`. Atomically updates `status = ListingStatus.ACTIVE`, increments `version`, clears lock fields, and creates `AuditLog` (`LISTING_APPROVED`).
    - `rejectListing(listingId, admin, dto)`: Verifies status is `PENDING_REVIEW`, active lock held by `admin.id`, and `listing.version === dto.version`. Atomically updates `status = ListingStatus.REJECTED`, stores `rejectionReason`, increments `version`, clears lock fields, and creates `AuditLog` (`LISTING_REJECTED`).
  - [x] 3.3 Create `apps/api/src/modules/listings/admin-listings.controller.ts` mounted at `@Controller('admin/listings')` guarded by `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)`:
    - `GET /api/v1/admin/listings/moderation-queue` (`@RequireAdminPermission('Listings.Review')`)
    - `GET /api/v1/admin/listings/:id` (`@RequireAdminPermission('Listings.Review')`)
    - `POST /api/v1/admin/listings/:id/claim` (`@RequireAdminPermission('Listings.Review')`)
    - `POST /api/v1/admin/listings/:id/heartbeat` (`@RequireAdminPermission('Listings.Review')`)
    - `POST /api/v1/admin/listings/:id/release` (`@RequireAdminPermission('Listings.Review')`)
    - `POST /api/v1/admin/listings/:id/force-unlock` (`@RequireAdminPermission('Tasks.ForceUnlock')`)
    - `POST /api/v1/admin/listings/:id/approve` (`@RequireAdminPermission('Listings.Review')`)
    - `POST /api/v1/admin/listings/:id/reject` (`@RequireAdminPermission('Listings.Review')`)
  - [x] 3.4 Register `AdminListingsController`, `AdminListingsService`, and `AdminPermissionGuard` in `ListingsModule` (`apps/api/src/modules/listings/listings.module.ts`).
  - [x] 3.5 Write comprehensive Jest unit tests in `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts` and `admin-listings.controller.spec.ts` covering all lock states, expiry via `ClockService`, heartbeat, conflict, force-unlock, approval, rejection, and optimistic concurrency `version` checks.

- [x] **Task 4: Frontend Admin Moderation Queue & Review Workspace (`apps/web`)** (AC: #1, #2, #3, #4, #5, #6)
  - [x] 4.1 Update `apps/web/src/components/layout/workspace-shell.tsx` and `apps/web/src/app/admin/page.tsx` to include a navigation link and dashboard card for **طابور مراجعة الإعلانات العقارية** (`/admin/listings/moderation`) visible to admins with `Listings.Review` permission (`SUPER_ADMIN` and `MODERATOR`).
  - [x] 4.2 Create `apps/web/src/components/admin/listing-moderation-queue.tsx` and route `apps/web/src/app/admin/listings/moderation/page.tsx`:
    - Displays status filter tabs (`بانتظار المراجعة PENDING_REVIEW`, `معتمدة ACTIVE`, `مرفوضة REJECTED`), queue count badge, and data table of listings.
    - Displays lock status badges (`متاح للمراجعة` emerald badge, `قيد المراجعة بواسطتك` primary badge, `مقفول بواسطة [Admin Name]` amber badge with expiry countdown).
    - Provides "استلام ومراجعة الإعلان (Claim & Review)" button that calls `POST /api/v1/admin/listings/:id/claim` and navigates to `/admin/listings/[id]/review`, plus "معاينة للقراءة فقط" when locked by another operator.
  - [x] 4.3 Create `apps/web/src/components/admin/listing-moderation-review.tsx` and route `apps/web/src/app/admin/listings/[id]/review/page.tsx`:
    - Displays lock status bar at the top:
      - When held by current admin: Sovereign Emerald active lease banner with live `MM:SS` countdown (`JetBrains Mono`), auto-heartbeat every 5 minutes (`LISTING_LOCK_HEARTBEAT_INTERVAL_MS`), manual "تمديد القفل" and "تحرير المهمة (Release)" buttons.
      - When held by another admin: Prominent Amber Read-Only Lock Banner (`هذا الإعلان قيد المراجعة حالياً بواسطة [Admin Name] — الوقت المتبقي: MM:SS`) with all Approve/Reject buttons disabled, plus a "فك القفل الإجباري (Force Unlock)" button and modal visible ONLY if `admin.permissions.includes('Tasks.ForceUnlock')`.
      - When unlocked: Prompt button "استلام المهمة لبدء المراجعة (Claim 15-Min Lock)".
    - Displays full property details: photos gallery (`PUBLIC`), classified legal documents (`TITLE_DEED`, `OWNER_AUTHORIZATION` marked `ADMIN_ONLY` with secure download/view links), seller profile & Fal status, coordinates, ask price in SAR (`JetBrains Mono`), and payout IBAN (`JetBrains Mono`).
    - Provides Moderation Decision Panel:
      - "اعتماد ونشر الإعلان (Approve)" button sending `{ version }`.
      - "رفض الإعلان مع الملاحظات (Reject)" form requiring mandatory `rejectionReason` (min 10 chars) and sending `{ version, rejectionReason }`.
  - [x] 4.4 Write Vitest SSR unit tests in `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx` using `renderToString` from `react-dom/server`.

## Dev Notes

### Architectural & Domain Guardrails
- **Deterministic Time (`AD-11`):** Every timestamp comparison and lease calculation (`lockedAt`, `lockExpiresAt`, checking if an existing lock is expired `lockExpiresAt <= this.clockService.now()`) MUST use `this.clockService.now()`. Never use `new Date()` directly in backend services or guards.
- **Lazy Lock Expiry + Immediate Release (`AD-10`):** A listing lock is considered active if and only if `listing.lockedByAdminId !== null && listing.lockExpiresAt !== null && listing.lockExpiresAt > clockService.now()`. If `lockExpiresAt <= clockService.now()`, the lock is expired and any admin with `Listings.Review` can immediately claim it without requiring a background worker sweep first.
- **Admin Realm Isolation (`AD-12`, Story 8.1):** All `/api/v1/admin/listings/*` endpoints MUST use `AdminSessionAuthGuard` (which authenticates via `elmasaif_admin_session` cookie and populates `req.admin` with `{ id, username, email, fullName, role, isActive, permissions }`). Never use consumer `SessionAuthGuard` on `/admin/*` endpoints.
- **RBAC Enforcement:**
  - `MODERATOR` has permissions `['Listings.Review', 'Licenses.Review', 'Reviews.Moderate']`.
  - `SUPER_ADMIN` has all permissions including `'Listings.Review'` and `'Tasks.ForceUnlock'`.
  - Ensure `AdminPermissionGuard` checks `req.admin?.permissions?.includes(permission)` and throws `ForbiddenException` (`AUTH_NOT_AUTHORIZED`) with a clear Arabic message when unauthorized.
- **Document Visibility & Signed URLs (`Story 2.2`):** When an admin fetches listing details via `GET /api/v1/admin/listings/:id`, both `PUBLIC` photos and `ADMIN_ONLY` legal documents (`TITLE_DEED`, `OWNER_AUTHORIZATION`, `COMMERCIAL_REGISTRATION`) must be returned with short-lived pre-signed URLs (`<= 300` seconds) via `ListingsService.getListingById(id, undefined, true)`.
- **Frontend Testing Standard (`apps/web`):** `apps/web` uses Vitest with `renderToString` from `react-dom/server` (`@testing-library/react` is NOT installed). Remember that React 19 `renderToString` inserts `<!-- -->` between adjacent JSX text expressions (`<strong>{count} دقيقة</strong>`), so use template literals (`<strong>{`${count} دقيقة`}</strong>`) when asserting text in SSR tests.

### Project Structure Notes

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/constants/listing.ts`
  - `packages/shared/src/schemas/listing.schema.ts`
  - `packages/shared/src/types/listing.ts`
  - `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts`
- **Backend API (`apps/api`):**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/auth/guards/admin-permission.guard.ts`
  - `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`
  - `apps/api/src/modules/listings/admin-listings.service.ts`
  - `apps/api/src/modules/listings/admin-listings.controller.ts`
  - `apps/api/src/modules/listings/listings.module.ts`
  - `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts`
  - `apps/api/src/modules/listings/__tests__/admin-listings.controller.spec.ts`
- **Frontend Web (`apps/web`):**
  - `apps/web/src/components/layout/workspace-shell.tsx`
  - `apps/web/src/app/admin/page.tsx`
  - `apps/web/src/app/admin/listings/moderation/page.tsx`
  - `apps/web/src/app/admin/listings/[id]/review/page.tsx`
  - `apps/web/src/components/admin/listing-moderation-queue.tsx`
  - `apps/web/src/components/admin/listing-moderation-review.tsx`
  - `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 2.4: Listing Moderation Queue with 15-Minute Task Claim Locking]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#AD-10: Distributed Admin Task Claim & Locking Protocol]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#3. Property Listing State Machine]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`#3. Property Listing State Transitions & #7. UI States per IA Surface]
- [Source: `_bmad-output/implementation-artifacts/8-1-isolated-admin-authentication-realm-password-reset.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-listing-creation-document-visibility-classification.md`]

## Dev Agent Record

### Agent Model Used

Gemini 4 Argon (Medium)

### Debug Log References

- Built `@elmasaif/shared` and verified 18 test suites (203 tests) pass including `listing-moderation.spec.ts`.
- Updated `apps/api/prisma/schema.prisma` with `rejectionReason`, `reviewedByAdminId`, and `reviewedAt` on `Listing` and regenerated Prisma Client.
- Verified `admin-listings.service.spec.ts` and `admin-listings.controller.spec.ts` (24 tests) pass with 100% deterministic `ClockService.now()` lock lease calculations, lazy lock expiry (`AD-10`), `Tasks.ForceUnlock` RBAC enforcement, and optimistic concurrency `version` checks.
- Verified `listing-moderation.spec.tsx` SSR unit tests pass in `@elmasaif/web`.

### Completion Notes List

- Implemented shared moderation constants (`LISTING_LOCK_DURATION_MINUTES = 15`, `LISTING_LOCK_DURATION_MS`, `LISTING_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000`, error codes), Zod schemas (`listingModerationQueueQuerySchema`, `approveListingSchema`, `rejectListingSchema`, `forceUnlockListingSchema`), and TypeScript types (`ListingLockInfo`, `ModerationQueueItem`, `ModerationQueueResponse`).
- Created `AdminPermissionGuard` and `@RequireAdminPermission` decorator in `apps/api/src/modules/auth` to enforce granular RBAC permissions (`Listings.Review` and `Tasks.ForceUnlock`) on top of `AdminSessionAuthGuard`.
- Implemented `AdminListingsService` and `AdminListingsController` (`GET /api/v1/admin/listings/moderation-queue`, `GET /api/v1/admin/listings/:id`, `POST /:id/claim`, `POST /:id/heartbeat`, `POST /:id/release`, `POST /:id/force-unlock`, `POST /:id/approve`, `POST /:id/reject`) with atomic `$transaction` updates, optimistic concurrency (`version`), and immutable `AuditLog` entries.
- Created `ListingModerationQueue` and `ListingModerationReview` frontend components and routes (`/admin/listings/moderation` and `/admin/listings/[id]/review`) with live `MM:SS` countdown timers (`JetBrains Mono`), automatic 5-minute heartbeat renewal, Amber Read-Only Lock Banner for concurrent operators, and Super Admin Force-Unlock modal.

### File List

- `packages/shared/src/constants/listing.ts`
- `packages/shared/src/schemas/listing.schema.ts`
- `packages/shared/src/types/listing.ts`
- `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`
- `apps/api/src/modules/auth/guards/admin-permission.guard.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/listings/admin-listings.service.ts`
- `apps/api/src/modules/listings/admin-listings.controller.ts`
- `apps/api/src/modules/listings/listings.service.ts`
- `apps/api/src/modules/listings/listings.controller.ts`
- `apps/api/src/modules/listings/listings.module.ts`
- `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts`
- `apps/api/src/modules/listings/__tests__/admin-listings.controller.spec.ts`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/app/owner/page.tsx`
- `apps/web/src/app/app/marketer/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/admin/listing-moderation-queue.tsx`
- `apps/web/src/components/admin/listing-moderation-review.tsx`
- `apps/web/src/app/admin/listings/moderation/page.tsx`
- `apps/web/src/app/admin/listings/[id]/review/page.tsx`
- `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx`

## Change Log

- **2026-11-03**: Implemented Story 2.4 Listing Moderation Queue with 15-Minute Task Claim Locking, 5-minute client heartbeat renewal, read-only concurrent operator banner, Super Admin force-unlock override, and optimistic concurrency moderation decisions.

