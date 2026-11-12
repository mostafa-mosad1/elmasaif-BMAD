---
baseline_commit: e7221760f16967b57532399f63b982c9bd101c61
---

# Story 8.3: Unified Operational Queue Task Claim & Heartbeat Locking Service

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **administrator working in operational queues**,
I want **an exclusive 15-minute claim lease with 5-minute heartbeat renewal across all 8 operational queues**,
so that **conflicting decisions and race conditions between staff members are eliminated**.

## Acceptance Criteria

1. **AC1 — Shared Operational Queue Registry, Constants, Types & Schemas (`@elmasaif/shared`):**
   - **Given** the 8 canonical claimable operational queues defined in `AD-10` and `FR-51` (`Listing`, `FalProfile` / `FalLicense`, `OwnerListingRequest`, `Payment`, `ContractFeePayment`, `Conversation` / `ListingInquiry`, `Dispute`, `Offer`),
   - **When** shared constants, types, and schemas are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - Canonical lock lease constants: `TASK_CLAIM_LEASE_DURATION_MS = 15 * 60 * 1000` (`900_000`), `TASK_CLAIM_LEASE_DURATION_SECONDS = 900`, `TASK_CLAIM_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000` (`300_000`), `TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS = 300`, `TASK_FORCE_UNLOCK_MIN_REASON_LENGTH = 5`.
     - Canonical `OperationalQueueType` enum/union covering all 8 queues (`LISTING`, `FAL_PROFILE`, `OWNER_REQUEST`, `PAYMENT`, `CONTRACT_FEE`, `CONVERSATION`, `DISPUTE`, `OFFER`) and their URL slug aliases (`listings`, `licenses`, `fal-profiles`, `owner-requests`, `payments`, `contract-fees`, `conversations`, `inquiries`, `disputes`, `offers`), along with Arabic display labels (`OPERATIONAL_QUEUE_METADATA`).
     - Standardized domain & status codes: `TASK_CLAIM_ACQUIRED`, `TASK_CLAIM_RENEWED`, `TASK_CLAIM_RELEASED`, `TASK_CLAIM_FORCE_UNLOCKED`, `TASK_CLAIM_LOCK_CONFLICT`, `TASK_CLAIM_LOCK_REQUIRED`, `TASK_CLAIM_LOCK_EXPIRED`, `TASK_CLAIM_NOT_CLAIMABLE`, `TASK_CLAIM_ENTITY_NOT_FOUND`, `TASK_FORCE_UNLOCK_REASON_REQUIRED`, `OPTIMISTIC_VERSION_CONFLICT`, and `OPERATIONAL_QUEUES_SUMMARY_RETRIEVED`.
     - Zod schemas: `forceUnlockTaskSchema` (`reason`: trimmed string, min 5 characters, max 500 characters), `operationalQueueFilterSchema` (`queueType`, `lockState`: `'ALL' | 'LOCKED' | 'UNLOCKED' | 'MY_CLAIMS'`, `page`, `limit`), and `ifMatchVersionSchema` (parses numeric version from `If-Match` HTTP header such as `"3"`, `W/"3"`, or `3`, or request body `version`).
     - Shared DTO interfaces: `ClaimLockInfo` (already in `types/locks.ts`, extended/re-exported cleanly), `OperationalQueueItemSummary`, `OperationalQueueCounts`, and `OperationalQueuesHubResponse`.

2. **AC2 — Unified Atomic Task Claim, 5-Minute Heartbeat Renewal, Release & Super Admin Force-Unlock Service (`TaskClaimLockService`):**
   - **Given** an authenticated Admin viewing or acting on a pending item in any of the 8 operational queues (`Listing`, `FalProfile` / `FalLicense`, `OwnerListingRequest`, `Payment`, `ContractFeePayment`, `Conversation` / `ListingInquiry`, `Dispute`, `Offer`),
   - **When** the Admin claims, renews (heartbeat), releases, or force-unlocks the item, or submits a queue decision,
   - **Then** the centralized `TaskClaimLockService` (and underlying queue services) enforces:
     - **Atomic Conditional Claim (`AD-10`, `PRD Addendum 1.3`):** Acquires a 15-minute exclusive lock (`lockedByAdminId = admin.id`, `lockedAt = ClockService.now()`, `lockExpiresAt = ClockService.now() + 15 minutes`) using an atomic conditional database update (`updateMany` where `id = :id` AND `(lockedByAdminId IS NULL OR lockExpiresAt <= now OR lockedByAdminId = :adminId)`) inside a transaction so two concurrent admins cannot both claim the same record.
     - **Lazy Expiry (`AD-10`):** Expired locks (`lockExpiresAt <= ClockService.now()`) are treated as unlocked everywhere (`isLocked: false`, `remainingSeconds: 0`) and can be claimed immediately without background cron cleanup.
     - **Conflict Payload (`HTTP 409 Conflict`):** If another admin holds an active lock (`lockedByAdminId !== admin.id` and `lockExpiresAt > ClockService.now()`), returns HTTP `409 Conflict` including `lockInfo` with `lockedByAdminId`, `lockedByAdminName` (resolved from `AdminUser.fullName`), `lockedAt`, `lockExpiresAt`, and `remainingSeconds`.
     - **Heartbeat Renewal (`POST .../heartbeat`):** Every 5 minutes while the item remains open, extends `lockExpiresAt` to `ClockService.now() + 15 minutes` if and only if the caller holds the active lock; returns HTTP `409 Conflict` if unheld, expired, or held by another admin.
     - **Voluntary Release (`POST .../release`):** Clears `lockedByAdminId = null`, `lockedAt = null`, `lockExpiresAt = null` when called by the active lock holder and writes an immutable `AuditLog` entry.
     - **Super Admin Force-Unlock (`POST .../force-unlock`):** Gated by `Tasks.ForceUnlock` permission (`Super Admin` by default per `AD-12`), requires a mandatory justification `reason` (minimum 5 characters), clears the lock regardless of current holder, and writes an immutable `AuditLog` entry recording `previousLockedByAdminId`, `previousLockedByAdminName`, `reason`, and `unlockedAt`.
     - **Strict Mutation Guard (`assertActiveClaimLock`):** Every state-mutating decision endpoint across all 8 queues verifies the submitting admin holds a non-expired claim lock (`lockedByAdminId === admin.id && lockExpiresAt > ClockService.now()`), rejecting unlocked or expired mutations with HTTP `409 Conflict`.

3. **AC3 — Standardized Queue Lock Endpoints Across All 8 Queues & Unified `/api/v1/admin/queues` Hub API:**
   - **Given** all 8 operational queues and the Admin Back-Office route table (`EXPERIENCE.md` `/admin/queues` & `AD-10`),
   - **When** the frontend or an admin client calls queue lock or hub endpoints,
   - **Then**:
     - Every individual queue controller exposes standardized `POST /api/v1/admin/<queue>/:id/claim`, `POST /api/v1/admin/<queue>/:id/heartbeat`, `POST /api/v1/admin/<queue>/:id/release`, and `POST /api/v1/admin/<queue>/:id/force-unlock` (gated by `@RequirePermissions('Tasks.ForceUnlock')`):
       1. `/api/v1/admin/listings/:id/{claim,heartbeat,release,force-unlock}`
       2. `/api/v1/admin/licenses/:id/{claim,heartbeat,release,force-unlock}` (and alias `/api/v1/admin/fal-profiles/:id/{claim,heartbeat,release,force-unlock}`)
       3. `/api/v1/admin/owner-requests/:id/{claim,heartbeat,release,force-unlock}`
       4. `/api/v1/admin/payments/:id/{claim,heartbeat,release,force-unlock}`
       5. `/api/v1/admin/contract-fees/:id/{claim,heartbeat,release,force-unlock}`
       6. `/api/v1/admin/inquiries/:id/{claim,heartbeat,release,force-unlock}` AND `/api/v1/admin/conversations/:id/{claim,heartbeat,release,force-unlock}`
       7. `/api/v1/admin/disputes/:id/{claim,heartbeat,release,force-unlock}` (adding `@Post(':id/heartbeat')` while keeping `@Post(':id/renew')` as a backward-compatible alias, and allowing `Tasks.ForceUnlock` on `force-unlock`)
       8. `/api/v1/admin/offers/:id/{claim,heartbeat,release,force-unlock}`
     - A unified `AdminQueuesController` (`/api/v1/admin/queues`) provides:
       - `GET /api/v1/admin/queues`: Returns per-queue counts (`totalPending`, `activelyLocked`, `lockedByCurrentAdmin`, `unlockedAvailable`) and a unified list of claimable/locked operational items across all 8 queues (filtered by the admin's permissions or query filters `queueType` and `lockState`).
       - `POST /api/v1/admin/queues/:queue/:id/claim`
       - `POST /api/v1/admin/queues/:queue/:id/heartbeat`
       - `POST /api/v1/admin/queues/:queue/:id/release`
       - `POST /api/v1/admin/queues/:queue/:id/force-unlock`

4. **AC4 — Optimistic Concurrency Version Checks (`If-Match` Header & `version` Validation) Returning HTTP `409 Conflict`:**
   - **Given** a state-changing decision submission on an operational queue item,
   - **When** the client supplies an `If-Match` header (e.g., `If-Match: "2"` or `If-Match: 2`) or a payload `version` field that does not match the database record's current `version` (or when a concurrent modification has already advanced the record's version/state),
   - **Then** the backend rejects the stale submission with HTTP `409 Conflict` (preserving entity-specific codes such as `LISTING_VERSION_CONFLICT`, `LICENSE_VERSION_CONFLICT`, `OFFER_VERSION_CONFLICT`, or `OPTIMISTIC_VERSION_CONFLICT` with current `version`), and holding an active claim lock NEVER bypasses optimistic concurrency version checks (`AD-8`, `AD-10`).

5. **AC5 — Frontend Reusable Claim/Heartbeat Hook (`useTaskClaimLock`), Prominent Amber Lock Banner (`TaskClaimLockBanner`), & Unified Queue Hub (`/admin/queues`):**
   - **Given** an administrator opening `/admin/queues` or inspecting a queue item in `apps/web`,
   - **When** the item is claimed by the current admin, locked by another admin, or unlocked,
   - **Then**:
     - `useTaskClaimLock` manages claiming (`POST .../claim`), automatic 5-minute heartbeat renewal (`300_000ms` interval while mounted and locked by current admin), 1-second local remaining time countdown (`MM:SS`), voluntary release (`POST .../release`), Super Admin force-unlock (`POST .../force-unlock` with reason), and `If-Match` header attachment helper.
     - `TaskClaimLockBanner` renders:
       - When locked by another admin: a prominent **amber warning banner** (`EXPERIENCE.md` Section 6) displaying the lock holder's full name (`lockedByAdminName`), live countdown timer (`MM:SS`), explicit read-only mode notice (*"وضع القراءة فقط — جميع أزرار القرار معطلة لمنع التعارض"*), and a `"فك القفل قسرياً (Super Admin)"` action button visible to admins with `Tasks.ForceUnlock` permission that opens a confirmation modal requiring a justification reason (>= 5 characters).
       - When locked by the current admin: an active emerald lock status bar showing the 15-minute lease countdown (`MM:SS`), automatic 5-minute heartbeat indicator, and `"تحرير المهمة"` (Release) button.
       - When unlocked: a clear call-to-action banner with `"استلام المهمة وبدء المراجعة (حجز 15 دقيقة)"` (`POST .../claim`) informing the admin that decision buttons remain disabled until the task is claimed.
     - `/admin/queues` (`apps/web/src/app/admin/queues/page.tsx`) provides the Unified Operational Queues Hub (`EXPERIENCE.md` line 63) showing summary cards across all 8 operational queues, filter tabs (`الكل`, `مهامي المحجوزة`, `متاحة للاستلام`, `محجوزة لمشرف آخر`), queue type selector, live lock status badges, direct claim/release/force-unlock controls, and deep-links to each specialized review workspace.
     - Navigation links to `/admin/queues` (`طوابير المهام والأقفال التشغيلية`) are added in `WorkspaceShell` (`apps/web/src/components/layout/workspace-shell.tsx`) and `AdminDashboardPage` (`apps/web/src/app/admin/page.tsx`).

6. **AC6 — Comprehensive Automated Tests & Zero-Regression Verification:**
   - **Given** the new unified locking service, shared schemas, `If-Match` concurrency helper, and frontend components,
   - **When** test suites run across `packages/shared`, `apps/api`, and `apps/web`,
   - **Then**:
     - `packages/shared` unit tests validate `forceUnlockTaskSchema`, `operationalQueueFilterSchema`, `ifMatchVersionSchema`, and queue metadata/constants.
     - `apps/api` unit/integration tests validate `TaskClaimLockService` and `AdminQueuesController` across all 8 queues: atomic claim acquisition, 5-minute heartbeat extension (+15m from `ClockService.now()`), lazy expiry takeover when `lockExpiresAt <= now`, `409 Conflict` with `lockInfo` (`lockedByAdminName`, `remainingSeconds`) when locked by another admin, voluntary release, `Tasks.ForceUnlock` with mandatory reason and `AuditLog` creation, mutation rejection when lock is missing/expired, and `If-Match` version mismatch returning `409 Conflict`.
     - `apps/web` SSR component tests (`renderToString` from `react-dom/server` in Vitest) verify `TaskClaimLockBanner` (amber read-only banner for other admin lock, active lease countdown for current admin, claim CTA for unlocked, force-unlock modal for Super Admin) and `/admin/queues` unified workspace rendering.
     - All existing test suites in `packages/shared`, `apps/api`, and `apps/web` pass with zero regressions.

## Tasks / Subtasks

- [x] **Task 1: Shared Queue Lock Constants, Types & Zod Schemas in `@elmasaif/shared` (AC: #1, #4)**
  - [x] 1.1 Update `packages/shared/src/types/locks.ts` to add `OperationalQueueType`, `OperationalQueueSlug`, `OperationalQueueMetadata`, `OperationalQueueItemSummary`, `OperationalQueueCounts`, and `OperationalQueuesHubResponse` interfaces while preserving `ClaimLockInfo`.
  - [x] 1.2 Update `packages/shared/src/constants/auth.ts` (or create `packages/shared/src/constants/queues.ts` and re-export from `constants/index.ts`) with `TASK_CLAIM_LEASE_DURATION_MS` (`900_000`), `TASK_CLAIM_LEASE_DURATION_SECONDS` (`900`), `TASK_CLAIM_HEARTBEAT_INTERVAL_MS` (`300_000`), `TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS` (`300`), `TASK_FORCE_UNLOCK_MIN_REASON_LENGTH` (`5`), error/status codes (`TASK_CLAIM_LOCK_CONFLICT`, `TASK_CLAIM_LOCK_REQUIRED`, `TASK_CLAIM_LOCK_EXPIRED`, `OPTIMISTIC_VERSION_CONFLICT`, etc.), and `OPERATIONAL_QUEUE_METADATA` for all 8 queues.
  - [x] 1.3 Create or update `packages/shared/src/schemas/queues.ts` (and export from `packages/shared/src/schemas/index.ts`) with `forceUnlockTaskSchema`, `operationalQueueFilterSchema`, and `parseIfMatchVersion` / `ifMatchVersionSchema`.
  - [x] 1.4 Add unit tests in `packages/shared/src/__tests__/queues-lock.spec.ts` covering all new schemas, constants, and `If-Match` parsing edge cases (`"1"`, `W/"1"`, `1`, invalid strings).

- [x] **Task 2: Unified `TaskClaimLockService` & Optimistic Concurrency Helper in `apps/api` (AC: #2, #3, #4)**
  - [x] 2.1 Enhance `apps/api/src/common/locks/claim-lock.ts` with:
    - `parseIfMatchHeader(ifMatchHeader?: string | string[], bodyVersion?: number): number | undefined` and `assertOptimisticVersion(expectedVersion: number | undefined, actualVersion: number, conflictCode?: string): void` throwing `ConflictException` (`HTTP 409`) on mismatch.
    - Standardized atomic claim helper and `ClaimLockInfo` builder with `AdminUser` name resolution.
  - [x] 2.2 Create `apps/api/src/common/locks/task-claim-lock.service.ts` (`TaskClaimLockService`) and `apps/api/src/common/locks/locks.module.ts` (`@Global() LocksModule`):
    - Supports all 8 operational queue models (`listing`, `falLicense`, `ownerListingRequest`, `payment`, `contractFeePayment`, `listingInquiry`, `dispute`, `offer`) via queue type or URL slug (`listings`, `licenses` / `fal-profiles`, `owner-requests`, `payments`, `contract-fees`, `conversations` / `inquiries`, `disputes`, `offers`).
    - Implements `claimTask(queue, entityId, admin)`, `heartbeatTask(queue, entityId, admin)`, `releaseTask(queue, entityId, admin)`, `forceUnlockTask(queue, entityId, admin, reason)`, and `getOperationalQueuesHub(admin, query)` using `ClockService.now()` (never `new Date()` or `Date.now()`) and atomic conditional `updateMany` (`OR: [{ lockedByAdminId: null }, { lockExpiresAt: { lte: now } }, { lockedByAdminId: admin.id }]`).
    - Resolves `lockedByAdminName` from `AdminUser` on every lock response and `409 Conflict` error payload (`lockInfo`).
    - Writes immutable `AuditLog` entries for claim, release, and force-unlock (including mandatory `reason` and `previousLockedByAdminId`).

- [x] **Task 3: Standardize All 8 Individual Queue Controllers/Services & Add `/api/v1/admin/queues` Hub (AC: #2, #3, #4)**
  - [x] 3.1 Update `AdminListingsService` & `AdminListingsController` (`apps/api/src/modules/listings/`):
    - Ensure `claimListing` uses atomic conditional `updateMany` so concurrent claims cannot overwrite each other.
    - Support optional `If-Match` header alongside `body.version` in `approveListing` and `rejectListing` (throwing `409 Conflict` with `LISTING_VERSION_CONFLICT` when mismatched).
  - [x] 3.2 Update `AdminLicensesService` & `AdminLicensesController` (`apps/api/src/modules/licenses/`):
    - Ensure `claimLicense` uses atomic conditional `updateMany`.
    - Support optional `If-Match` header alongside `body.version` in `approveLicense` and `rejectLicense` (throwing `409 Conflict` with `LICENSE_VERSION_CONFLICT` when mismatched).
  - [x] 3.3 Update `AdminOwnerRequestsService` & `AdminOwnerRequestsController` and `AdminContractFeesService` & `AdminContractFeesController` (`apps/api/src/modules/contracts/`):
    - Ensure `claimRequest` and `claimContractFee` use atomic conditional `updateMany` and include `lockInfo` (with resolved `lockedByAdminName` and `remainingSeconds`) in `ConflictException` (`409`) payloads.
    - Support optional `If-Match` header validation on decision endpoints.
  - [x] 3.4 Update `AdminPaymentsService` & `AdminPaymentsController` and `DisputesService` & `AdminDisputesController` (`apps/api/src/modules/deals/`):
    - In `AdminDisputesController`: add `@Post(':id/heartbeat')` (delegating to `renewDisputeLock` / `heartbeatDisputeLock`) while keeping `@Post(':id/renew')` as a backward-compatible alias; add `@RequireAdminPermission('Tasks.ForceUnlock')` on `@Post(':id/force-unlock')` and `@RequireAdminPermission('Deals.DisputeResolve', 'Tasks.Claim')` so permissions align with `AD-12`.
    - In `DisputesService`: resolve `adminNameMap` in `claimDispute`, `renewDisputeLock`, and `DISPUTE_LOCK_CONFLICT` (`409`) so `lockInfo.lockedByAdminName` and `lockInfo.remainingSeconds` are always populated; support optional `If-Match` version check on `adjudicateDispute` (checking `deal.version`).
    - In `AdminPaymentsService`: support optional `If-Match` version check on payment verification/rejection endpoints.
  - [x] 3.5 Update `AdminInquiriesService` & `AdminInquiriesController` (`apps/api/src/modules/inquiries/`) and `AdminOffersService` & `AdminOffersController` (`apps/api/src/modules/offers/`):
    - Register `@Controller(['admin/inquiries', 'admin/conversations'])` on `AdminInquiriesController` so both `/api/v1/admin/inquiries/:id/{claim,heartbeat,release,force-unlock}` and `/api/v1/admin/conversations/:id/{claim,heartbeat,release,force-unlock}` work seamlessly.
    - Support optional `If-Match` header validation on inquiry and offer decision endpoints (`relayBuyerInquiry`, `relaySellerReply`, `closeInquiry`, `approveOfferToSeller`, `rejectOfferByAdmin`, `forwardCounterToBuyer`, `promoteBackupOffer`), returning `409 Conflict` on stale `version`.
  - [x] 3.6 Create `AdminQueuesController` (`apps/api/src/modules/admin/admin-queues.controller.ts` or in `LocksModule`) and register `LocksModule` in `AppModule` (`apps/api/src/app.module.ts`):
    - Expose `GET /api/v1/admin/queues` and `POST /api/v1/admin/queues/:queue/:id/{claim,heartbeat,release,force-unlock}`.

- [x] **Task 4: Frontend Reusable Hook `useTaskClaimLock`, `TaskClaimLockBanner`, and `/admin/queues` Hub (AC: #5)**
  - [x] 4.1 Create `apps/web/src/hooks/use-task-claim-lock.ts`:
    - Manages lock state (`lockInfo`), `claim()`, `heartbeat()`, `release()`, `forceUnlock(reason)`, 5-minute (`TASK_CLAIM_HEARTBEAT_INTERVAL_MS = 300_000`) automatic heartbeat timer while held by current admin, 1-second local countdown timer (`remainingSeconds`, formatted `MM:SS`), and `buildIfMatchHeaders(version)` helper.
  - [x] 4.2 Create `apps/web/src/components/admin/task-claim-lock-banner.tsx`:
    - Renders the prominent **amber warning banner** when locked by another admin (showing `lockedByAdminName`, live `MM:SS` countdown, read-only state notice, and Super Admin `Tasks.ForceUnlock` button + modal with mandatory justification input >= 5 chars).
    - Renders the emerald active lease bar when locked by the current admin (showing live `MM:SS` countdown, 5-minute heartbeat badge, and `"تحرير المهمة"` button).
    - Renders the claim call-to-action banner when unlocked (`"استلام المهمة وبدء المراجعة — حجز 15 دقيقة"`).
  - [x] 4.3 Create `apps/web/src/app/admin/queues/page.tsx` and `apps/web/src/components/admin/operational-queues-workspace.tsx`:
    - Displays the Unified Operational Queues Hub (`/admin/queues`) with per-queue summary cards for all 8 queues, filter tabs (`الكل`, `مهامي المحجوزة`, `متاحة للاستلام`, `محجوزة لمشرف آخر`), queue filter pills, live lock countdown badges, inline claim / release / force-unlock actions, and direct links to each item's review workspace.
  - [x] 4.4 Update `apps/web/src/components/layout/workspace-shell.tsx` and `apps/web/src/app/admin/page.tsx` to add navigation links to `/admin/queues` (`طوابير المهام والأقفال التشغيلية`).

- [x] **Task 5: Automated Unit, Integration & SSR Tests Across Monorepo (AC: #6)**
  - [x] 5.1 Run and verify `packages/shared` tests (`packages/shared/src/__tests__/queues-lock.spec.ts`).
  - [x] 5.2 Add `apps/api/src/common/locks/__tests__/task-claim-lock.service.spec.ts` and `apps/api/src/common/locks/__tests__/admin-queues.controller.spec.ts` testing all 8 operational queues, atomic conditional claim, 5-minute heartbeat renewal, lazy expiry takeover, `409 Conflict` with `lockInfo` (`lockedByAdminName`, `remainingSeconds`), voluntary release, `Tasks.ForceUnlock` with mandatory reason and `AuditLog`, and `If-Match` version conflict (`409`).
  - [x] 5.3 Add `apps/web/src/components/admin/__tests__/task-claim-lock-banner.spec.tsx` and `apps/web/src/components/admin/__tests__/operational-queues-workspace.spec.tsx` using Vitest and `renderToString` from `react-dom/server`.
  - [x] 5.4 Run full test suites across `packages/shared`, `apps/api`, and `apps/web` to confirm zero regressions.

## Dev Notes

### Executive Context & Why Story 8.3 Matters

In `elmasaif`, every high-trust transaction step (listing moderation, Fal license verification, direct owner contract requests, contract fee proofs, deal escrow payment proofs, mediated buyer/seller conversations, deal disputes, and purchase offers) flows through an admin operational queue. To prevent two moderators or financial auditors from reviewing and making conflicting decisions on the same item simultaneously, `AD-10` and `FR-51` mandate a **Unified Distributed Task Claim & Heartbeat Locking Mechanism**:
1. **15-Minute Exclusive Claim Lease (`900 seconds`):** Acquired via `POST /api/v1/admin/<queue>/<id>/claim`.
2. **5-Minute Heartbeat Renewal (`300 seconds`):** Renewed via `POST /api/v1/admin/<queue>/<id>/heartbeat` while the workspace remains open, extending `lockExpiresAt` to `ClockService.now() + 15 minutes`.
3. **Lazy Expiry (`AD-10`):** Any lock where `lockExpiresAt <= ClockService.now()` is treated as unlocked on read and can be atomically claimed by any admin without requiring a background cleanup cron job.
4. **Read-Only Amber Banner for Other Admins (`EXPERIENCE.md` Section 6):** When Admin B views an item actively locked by Admin A, Admin B sees a prominent amber banner showing Admin A's name and remaining countdown timer (`MM:SS`), with all decision buttons disabled.
5. **Super Admin Force-Unlock (`Tasks.ForceUnlock`):** A Super Admin (or admin granted `Tasks.ForceUnlock`) can break an active lock via `POST .../force-unlock` with a mandatory justification reason (minimum 5 characters), which is permanently recorded in `AuditLog`.
6. **Optimistic Concurrency Control (`If-Match` / `version`, `AD-8` & `AD-10`):** Holding a claim lock is a UX coordination guard, **not** a substitute for database concurrency control. Stale submissions where the `If-Match` header (or payload `version`) does not match the database record's current `version` must be rejected with HTTP `409 Conflict`.

### Architecture Guardrails & Non-Negotiable Rules

1. **Deterministic Time (`AD-11`):**
   - NEVER call `new Date()` (with zero arguments) or `Date.now()` inside backend services or controllers. Always inject `ClockService` (`apps/api/src/common/clock/clock.service.ts`) and call `this.clockService.now()`.
2. **Isolated Admin Auth & Dynamic RBAC (`AD-5`, `AD-12`, Stories 8.1 & 8.2):**
   - All admin endpoints MUST use `@UseGuards(AdminSessionGuard, PermissionsGuard)` (or `@UseGuards(AdminSessionGuard, AdminPermissionsGuard)` where already used) and `@CurrentAdmin()`.
   - Remember that `AdminListingsController`, `AdminLicensesController`, `AdminOwnerRequestsController`, `AdminContractFeesController`, `AdminPaymentsController`, `AdminDisputesController`, `AdminInquiriesController`, and `AdminOffersController` use `@CurrentAdmin() admin: AuthenticatedAdminActor`.
   - For `force-unlock` endpoints, require `Tasks.ForceUnlock` permission (`@RequirePermissions('Tasks.ForceUnlock')` or `@RequireAdminPermission('Tasks.ForceUnlock')` — remember `SUPER_ADMIN` automatically has all permissions).
3. **Atomic Claim Acquisition (`AD-10` & `PRD Addendum 1.3`):**
   - Do NOT rely on a non-atomic `findUnique` followed by an unconditional `update({ where: { id } })`.
   - Inside `this.prisma.$transaction`, execute an atomic conditional `updateMany`:
     ```ts
     const claimed = await tx.<model>.updateMany({
       where: {
         id: entityId,
         OR: [
           { lockedByAdminId: null },
           { lockExpiresAt: { lte: now } },
           { lockedByAdminId: admin.id },
         ],
       },
       data: {
         lockedByAdminId: admin.id,
         lockedAt: now,
         lockExpiresAt,
       },
     });
     ```
   - If `claimed.count === 0`, re-read the record and throw `ConflictException` (`HTTP 409`) with the entity's lock conflict code and full `lockInfo` (`lockedByAdminId`, `lockedByAdminName`, `lockedAt`, `lockExpiresAt`, `remainingSeconds`).
4. **Prisma Schema Alignment (`apps/api/prisma/schema.prisma`):**
   - No Prisma schema migration is required because all 8 operational queue tables already have `lockedByAdminId String? @map("locked_by_admin_id")`, `lockedAt DateTime? @map("locked_at")`, and `lockExpiresAt DateTime? @map("lock_expires_at")`!
   - Specifically, verify the exact Prisma model names and version fields in `apps/api/prisma/schema.prisma`:
     1. `Listing` (`prisma.listing`) — has `version Int @default(1)`, `lockedByAdminId`, `lockedAt`, `lockExpiresAt`. Claimable status: `PENDING_REVIEW` (and `UNDER_COMPLIANCE_REVIEW` for compliance actions).
     2. `FalLicense` (`prisma.falLicense`) — has `version Int @default(1)`, `lockedByAdminId`, `lockedAt`, `lockExpiresAt`. Claimable statuses: `UNDER_REVIEW`, `RENEWAL_UNDER_REVIEW`.
     3. `OwnerListingRequest` (`prisma.ownerListingRequest`) — has `lockedByAdminId`, `lockedAt`, `lockExpiresAt` (no `version` column on `OwnerListingRequest` itself). Claimable statuses: `SUBMITTED`, `UNDER_ADMIN_REVIEW`, `AGREEMENT_SENT`, `AWAITING_SIGNATURE`.
     4. `Payment` (`prisma.payment`) — has `lockedByAdminId`, `lockedAt`, `lockExpiresAt` (parent `Deal` has `version Int @default(1)`). Claimable statuses: `PROOF_UPLOADED`, `UNDER_ADMIN_REVIEW`.
     5. `ContractFeePayment` (`prisma.contractFeePayment`) — has `lockedByAdminId`, `lockedAt`, `lockExpiresAt`. Claimable statuses: `PROOF_UPLOADED`, `UNDER_ADMIN_REVIEW`.
     6. `ListingInquiry` (`prisma.listingInquiry`) — has `version Int @default(1)`, `lockedByAdminId`, `lockedAt`, `lockExpiresAt`. Claimable statuses: `PENDING_ADMIN_REVIEW`, `SELLER_REPLIED` (any status !== `CLOSED`).
     7. `Dispute` (`prisma.dispute`) — has `lockedByAdminId`, `lockedAt`, `lockExpiresAt` (parent `Deal` has `version Int @default(1)`). Claimable status: `OPEN`.
     8. `Offer` (`prisma.offer`) — has `version Int @default(1)`, `lockedByAdminId`, `lockedAt`, `lockExpiresAt`. Claimable statuses: `SUBMITTED`, `UNDER_ADMIN_REVIEW`, `FORWARDED_TO_SELLER`, `COUNTERED`, `ACCEPTED_INITIAL`, `BACKUP_OFFER`.

### Detailed Audit of Current State vs. Required Changes (UPDATE Files)

1. **`apps/api/src/common/locks/claim-lock.ts` (UPDATE):**
   - **Current State:** Exports `DEFAULT_CLAIM_LOCK_DURATION_MS = 15 * 60 * 1000`, `ClaimLockableRecord`, `ClaimLockErrorCodes`, `buildClaimLockInfo`, `resolveLockHolderNameMap`, `assertActiveClaimLock`, and `assertCanAcquireClaimLock`.
   - **Changes Required:**
     - Add `parseIfMatchVersion(ifMatchHeader?: string | string[], bodyVersion?: number): number | undefined` (strips weak ETag prefix `W/` and quotes `"..."`, parses positive integer).
     - Add `assertOptimisticVersion(expectedVersion: number | undefined, actualVersion: number, conflictCode = OPTIMISTIC_VERSION_CONFLICT, message?: string): void` which throws `ConflictException({ code: conflictCode, message, expectedVersion, currentVersion: actualVersion })` when `expectedVersion !== undefined && expectedVersion !== actualVersion`.

2. **`apps/api/src/modules/deals/admin-disputes.controller.ts` & `disputes.service.ts` (UPDATE):**
   - **Current State:**
     - `AdminDisputesController` has `@Post(':id/claim')`, `@Post(':id/renew')` (missing `@Post(':id/heartbeat')`!), `@Post(':id/release')`, `@Post(':id/force-unlock')`, and `@Post(':id/adjudicate')`.
     - Class-level `@RequireAdminPermission('Deals.DisputeResolve')` blocks an admin with `Tasks.ForceUnlock` (if not holding `Deals.DisputeResolve`) or `Tasks.Claim`.
     - `DisputesService.claimDispute` throws `DISPUTE_LOCK_CONFLICT` without `lockInfo` or `lockedByAdminName`, and `claimDispute`/`renewDisputeLock` do not pass `adminNameMap` to `buildDisputeLockInfo`.
   - **Changes Required:**
     - Add `@Post(':id/heartbeat')` to `AdminDisputesController` calling `this.disputesService.renewDisputeLock(id, admin.id)` while keeping `@Post(':id/renew')` intact for backward compatibility.
     - Add `@RequireAdminPermission('Tasks.ForceUnlock')` on `@Post(':id/force-unlock')`.
     - In `DisputesService.claimDispute` and `renewDisputeLock`: resolve `adminNameMap` via `resolveDisputeLockHolderNames` so `lockInfo.lockedByAdminName` and `lockInfo.remainingSeconds` are returned on both success and `409 Conflict` (`DISPUTE_LOCK_CONFLICT`).
     - In `AdminDisputesController.adjudicateDispute` & `DisputesService.adjudicateDispute`: accept optional `@Headers('if-match') ifMatch?: string` and verify against `deal.version` (or `input.version`), throwing `409 Conflict` on mismatch.

3. **`apps/api/src/modules/inquiries/admin-inquiries.controller.ts` & `admin-inquiries.service.ts` (UPDATE):**
   - **Current State:**
     - `@Controller('admin/inquiries')` exposes `:id/claim`, `:id/heartbeat`, `:id/release`, `:id/force-unlock`, and decision endpoints (`:id/relay-buyer`, `:id/relay-seller-reply`, `:id/close`).
   - **Changes Required:**
     - Update decorator to `@Controller(['admin/inquiries', 'admin/conversations'])` so both `/api/v1/admin/inquiries/...` and `/api/v1/admin/conversations/...` work.
     - Accept optional `@Headers('if-match') ifMatch?: string` on decision endpoints (`relayBuyerInquiry`, `relaySellerReply`, `closeInquiry`) and validate against `inquiry.version` using `assertOptimisticVersion`.

4. **`apps/api/src/modules/listings/admin-listings.controller.ts` & `admin-listings.service.ts` (UPDATE):**
   - **Current State:**
     - `claimListing` checks `findUnique` and runs `tx.listing.update` without atomic `updateMany` condition.
     - `approveListing` and `rejectListing` check `input.version !== undefined && listing.version !== input.version`.
   - **Changes Required:**
     - Use atomic conditional `updateMany` inside `claimListing` transaction so concurrent requests cannot race.
     - Accept `@Headers('if-match') ifMatch?: string` in `AdminListingsController.approveListing` and `rejectListing`, merging `parseIfMatchVersion(ifMatch, body.version)` so `If-Match` header triggers `LISTING_VERSION_CONFLICT` (`HTTP 409`) on mismatch.

5. **`apps/api/src/modules/licenses/admin-licenses.controller.ts` & `admin-licenses.service.ts` (UPDATE):**
   - **Current State:**
     - `@Controller('admin/licenses')` has `:id/claim`, `:id/heartbeat`, `:id/release`, `:id/force-unlock`. `claimLicense` uses non-atomic `tx.falLicense.update`.
     - `approveLicense` and `rejectLicense` check `input.version`.
   - **Changes Required:**
     - Support `@Controller(['admin/licenses', 'admin/fal-profiles'])` so both canonical route names work.
     - Use atomic conditional `updateMany` in `claimLicense`.
     - Accept `@Headers('if-match') ifMatch?: string` in `approveLicense` and `rejectLicense`, merging `parseIfMatchVersion(ifMatch, body.version)` and throwing `LICENSE_VERSION_CONFLICT` (`HTTP 409`) on mismatch.

6. **`apps/api/src/modules/contracts/admin-owner-requests.controller.ts`, `admin-owner-requests.service.ts`, `admin-contract-fees.controller.ts`, `admin-contract-fees.service.ts` (UPDATE):**
   - **Current State:**
     - `claimRequest` in `AdminOwnerRequestsService` and `claimContractFee` in `AdminContractFeesService` call `assertCanClaimOwnerRequest` / `assertCanClaimContractFee` which throw `409 Conflict` without `lockInfo` (`lockedByAdminName`, `remainingSeconds`), and update via unconditional `tx.<model>.update`.
   - **Changes Required:**
     - Update `owner-request-lock.ts` and `contract-fee-lock.ts` (and `claimRequest` / `claimContractFee`) so `409 Conflict` includes `lockInfo` with resolved `lockedByAdminName` and `remainingSeconds`, and `claim` uses atomic conditional `updateMany`.
     - Support optional `If-Match` header check on decision endpoints.

7. **`apps/api/src/modules/deals/admin-payments.controller.ts` & `admin-payments.service.ts` (UPDATE):**
   - **Current State:**
     - `claimPayment` already uses `tx.payment.updateMany` with `OR` conditions and includes `lockInfo` on `409 Conflict`!
   - **Changes Required:**
     - Accept optional `@Headers('if-match') ifMatch?: string` on `verifyPayment` and `rejectPayment`, validating against `payment.deal.version` if provided.

8. **`apps/api/src/modules/offers/admin-offers.controller.ts` & `admin-offers.service.ts` (UPDATE):**
   - **Current State:**
     - `claimOffer` already uses `tx.offer.updateMany` with `OR` conditions and includes `lockInfo` on `409 Conflict`!
   - **Changes Required:**
     - Accept optional `@Headers('if-match') ifMatch?: string` on `approveToSeller`, `rejectOffer`, `forwardCounterToBuyer`, and `promoteBackupOffer`, validating against `offer.version` (`OFFER_VERSION_CONFLICT` / `OPTIMISTIC_VERSION_CONFLICT` on `409`).

9. **`apps/api/src/app.module.ts` (UPDATE):**
   - **Current State:** Imports `ClockModule`, `PrismaModule`, `AuthModule`, `ListingsModule`, `OffersModule`, `InquiriesModule`, `DealsModule`, `LicensesModule`, `ContractsModule`, etc.
   - **Changes Required:** Import `LocksModule` so `TaskClaimLockService` and `AdminQueuesController` (`/api/v1/admin/queues`) are registered in the NestJS application.

10. **`apps/web/src/components/layout/workspace-shell.tsx` & `apps/web/src/app/admin/page.tsx` (UPDATE):**
    - **Current State:** Lists individual queue links in the sidebar and dashboard header, but has no link to `/admin/queues`.
    - **Changes Required:** Add `/admin/queues` (`طوابير المهام والأقفال التشغيلية`) gated by `Tasks.View`, `Tasks.Claim`, `Tasks.ForceUnlock`, or `SUPER_ADMIN` role.

### Testing Standards & Constraints

- **`packages/shared`:** Run tests with `pnpm --filter @elmasaif/shared test` (Vitest).
- **`apps/api`:** Run tests with `pnpm --filter @elmasaif/api test -- <path>` (Jest). Always inject or mock `ClockService` with deterministic timestamps (e.g., `new Date('2026-11-12T10:00:00.000Z')`).
- **`apps/web`:** Run tests with `pnpm --filter @elmasaif/web test` (Vitest). **CRITICAL:** `apps/web` does NOT have `@testing-library/react` installed; all component tests in `apps/web` MUST use `renderToString` from `react-dom/server` (follow the pattern in `apps/web/src/components/admin/__tests__/staff-rbac-workspace.spec.tsx`).
- **Backward Compatibility:** Do NOT break any existing route paths, response shapes, or error codes (`LISTING_LOCK_CONFLICT`, `LICENSE_LOCK_CONFLICT`, `OWNER_REQUEST_LOCK_CONFLICT`, `CONTRACT_FEE_LOCK_CONFLICT`, `PAYMENT_LOCK_CONFLICT`, `INQUIRY_LOCK_CONFLICT`, `DISPUTE_LOCK_CONFLICT`, `OFFER_LOCK_CONFLICT`) expected by existing tests from Epics 2–8.

### Project Structure Notes

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/types/locks.ts` (UPDATE)
  - `packages/shared/src/constants/queues.ts` (NEW) & `packages/shared/src/constants/index.ts` (UPDATE)
  - `packages/shared/src/schemas/queues.ts` (NEW) & `packages/shared/src/schemas/index.ts` (UPDATE)
  - `packages/shared/src/__tests__/queues-lock.spec.ts` (NEW)
- **Backend API (`apps/api`):**
  - `apps/api/src/common/locks/claim-lock.ts` (UPDATE)
  - `apps/api/src/common/locks/task-claim-lock.service.ts` (NEW)
  - `apps/api/src/common/locks/admin-queues.controller.ts` (NEW)
  - `apps/api/src/common/locks/locks.module.ts` (NEW)
  - `apps/api/src/common/locks/__tests__/task-claim-lock.service.spec.ts` (NEW)
  - `apps/api/src/common/locks/__tests__/admin-queues.controller.spec.ts` (NEW)
  - `apps/api/src/app.module.ts` (UPDATE)
  - Queue controllers & services in `listings`, `licenses`, `contracts`, `deals`, `inquiries`, `offers` (UPDATE)
- **Frontend Web (`apps/web`):**
  - `apps/web/src/hooks/use-task-claim-lock.ts` (NEW)
  - `apps/web/src/components/admin/task-claim-lock-banner.tsx` (NEW)
  - `apps/web/src/components/admin/operational-queues-workspace.tsx` (NEW)
  - `apps/web/src/app/admin/queues/page.tsx` (NEW)
  - `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE)
  - `apps/web/src/app/admin/page.tsx` (UPDATE)
  - `apps/web/src/components/admin/__tests__/task-claim-lock-banner.spec.tsx` (NEW)
  - `apps/web/src/components/admin/__tests__/operational-queues-workspace.spec.tsx` (NEW)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.3: Unified Operational Queue Task Claim & Heartbeat Locking Service]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md` — AD-8 (Transactional Integrity & Optimistic Concurrency), AD-10 (Distributed Admin Task Claim & Locking), AD-11 (Injectable ClockService), AD-12 (Admin Permission Matrix: `Tasks.View`, `Tasks.Claim`, `Tasks.ForceUnlock`)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md` — FR-40, FR-51 (Admin Task Claim & Locking Mechanism), FR-66 (Immutable Audit Trail)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md` — Section 1.2 (REST API & Action Endpoint Conventions, `If-Match` version header), Section 1.3 (Task Claim Locking SQL Specification)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md` — Section 3 Admin Back-Office `/admin/queues` & Section 6 Admin Task-Claim Locking in Operational Queues]

## Dev Agent Record

### Agent Model Used

Gemini 3.1 Pro (High)

### Debug Log References

- Analyzed all 8 operational queue controllers, services, and lock helpers across `listings`, `licenses`, `contracts`, `deals`, `inquiries`, and `offers`.
- Verified Prisma schema models (`Listing`, `FalLicense`, `OwnerListingRequest`, `Payment`, `ContractFeePayment`, `ListingInquiry`, `Dispute`, `Offer`) and confirmed all 8 tables already contain `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` columns.

### Completion Notes List

- Created comprehensive implementation-ready specification for Story 8.3 (`Unified Operational Queue Task Claim & Heartbeat Locking Service`).
- Implemented `@elmasaif/shared` canonical queue constants (`TASK_CLAIM_LEASE_DURATION_MS = 900_000`, `TASK_CLAIM_HEARTBEAT_INTERVAL_MS = 300_000`, `OPERATIONAL_QUEUE_TYPES`, `OPERATIONAL_QUEUE_METADATA`, `resolveOperationalQueueType`), schemas (`forceUnlockTaskSchema`, `operationalQueueFilterSchema`, `ifMatchVersionSchema`, `parseIfMatchVersion`), and DTO interfaces (`OperationalQueueItemSummary`, `OperationalQueueCounts`, `OperationalQueuesHubResponse`).
- Implemented `TaskClaimLockService`, `AdminQueuesController` (`/api/v1/admin/queues`), and `@Global() LocksModule` in `apps/api/src/common/locks/`, enforcing deterministic time (`ClockService.now()`), atomic conditional `updateMany` claims, lazy expiry takeover, `409 Conflict` with resolved `lockedByAdminName` and `remainingSeconds`, 5-minute heartbeat renewal (+15m lease extension), voluntary release, and `Tasks.ForceUnlock` with mandatory reason (`>= 5` chars) and `AuditLog` entries across all 8 operational queues.
- Standardized all 8 queue controllers and services (`listings`, `licenses`/`fal-profiles`, `owner-requests`, `payments`, `contract-fees`, `inquiries`/`conversations`, `disputes`, `offers`) with route aliases, `@Post(':id/heartbeat')` on `AdminDisputesController`, atomic claim locking, and `If-Match` optimistic concurrency version checks returning HTTP `409 Conflict` on mismatch.
- Built `useTaskClaimLock` hook, `TaskClaimLockBanner` component (amber read-only warning banner with `Tasks.ForceUnlock` modal when locked by another admin, emerald active lease bar when locked by current admin, claim CTA when unlocked), and `/admin/queues` Unified Operational Queues Hub (`OperationalQueuesWorkspace`) with navigation links in `WorkspaceShell` and `AdminDashboardPage`.
- Added unit, integration, and SSR tests across `packages/shared`, `apps/api`, and `apps/web` and verified all suites pass with zero regressions.

### File List

- `_bmad-output/implementation-artifacts/8-3-unified-operational-queue-task-claim-heartbeat-locking-servi.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/shared/src/types/locks.ts`
- `packages/shared/src/constants/queues.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/constants/errors.ts`
- `packages/shared/src/schemas/queues.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/__tests__/queues-lock.spec.ts`
- `apps/api/src/common/locks/claim-lock.ts`
- `apps/api/src/common/locks/task-claim-lock.service.ts`
- `apps/api/src/common/locks/admin-queues.controller.ts`
- `apps/api/src/common/locks/locks.module.ts`
- `apps/api/src/common/locks/__tests__/task-claim-lock.service.spec.ts`
- `apps/api/src/common/locks/__tests__/admin-queues.controller.spec.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/listings/admin-listings.controller.ts`
- `apps/api/src/modules/listings/admin-listings.service.ts`
- `apps/api/src/modules/licenses/admin-licenses.controller.ts`
- `apps/api/src/modules/licenses/admin-licenses.service.ts`
- `apps/api/src/modules/contracts/admin-owner-requests.service.ts`
- `apps/api/src/modules/contracts/admin-contract-fees.service.ts`
- `apps/api/src/modules/deals/admin-disputes.controller.ts`
- `apps/api/src/modules/deals/disputes.service.ts`
- `apps/api/src/modules/deals/admin-payments.controller.ts`
- `apps/api/src/modules/deals/admin-payments.service.ts`
- `apps/api/src/modules/inquiries/admin-inquiries.controller.ts`
- `apps/api/src/modules/inquiries/admin-inquiries.service.ts`
- `apps/api/src/modules/offers/admin-offers.controller.ts`
- `apps/api/src/modules/offers/admin-offers.service.ts`
- `apps/web/src/hooks/use-task-claim-lock.ts`
- `apps/web/src/components/admin/task-claim-lock-banner.tsx`
- `apps/web/src/components/admin/operational-queues-workspace.tsx`
- `apps/web/src/app/admin/queues/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/components/admin/__tests__/task-claim-lock-banner.spec.tsx`
- `apps/web/src/components/admin/__tests__/operational-queues-workspace.spec.tsx`

## Change Log

- **2026-11-12:** Implemented Story 8.3 end-to-end across `@elmasaif/shared`, `apps/api`, and `apps/web`, delivering the Unified Operational Queue Task Claim & Heartbeat Locking Service (`AD-10`, `FR-51`, `FR-62`), `If-Match` optimistic concurrency checks (`AD-8`), and `/admin/queues` back-office hub.

