---
baseline_commit: 7ba8e9f
---

# Story 4.3: Backup Offer Queue Pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **buyer submitting a backup offer on a reserved property**,
I want **my backup offer held in an active pipeline**,
so that **if the primary transaction cancels or fails, my offer is prioritized for activation.**

This story realizes **FR-27 (Backup Offer Pipeline)**, **OQ-04** (activation order: *oldest approved backup first, admin-confirmed — never automatic*), the `Offer` half of **AD-10** (claim-locked queues), **AD-7** (idempotent background sweeps) and **AD-11** (`ClockService`). It is the **third** story of Epic 4 and the last one before the offers pipeline hands off to Deals:

- **Story 4.1 (done)** writes `Offer.isBackup = true` whenever the target listing is `RESERVED` (`offers.service.ts` L148–L173) and leaves the offer in `PENDING_ADMIN_REVIEW`.
- **Story 4.2 (done)** relays, negotiates and reaches `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` — the hand-off state for a mutually agreed price. It also keeps that state **out of `EXPIRABLE_OFFER_STATUSES`**, which is exactly what makes a backup offer survivable in a queue.
- **Story 4.3 (this)** owns: the read surface that ranks approved backup offers per listing (oldest first), the derived "surfaced / ready for activation" signal, the admin activation action, and the automatic closure of the remaining backups when the primary deal wins.
- **Story 5.1** owns turning `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` into a `Deal`; **Story 8.8** owns notification delivery.

**The central design constraint:** the `Deals` module does not exist yet (`apps/api/src/modules/` has no `deals/`) and there is **no `Notification` model**. This story therefore must be implementable *and correct* today without Epic 5 code. It achieves that by keying **exclusively off `Listing.status`** — the state the PRD already mandates Epic 5 to maintain (`Reserved` → `Active` on cancellation/timeout, `Reserved` → `Sold` on completion) — and by exposing the closure primitive as a transactional service method that Story 5.1 calls in its own transaction.

## Acceptance Criteria

1. **Backup queue surface (FR-27, UX admin queue):** a new claim-gated read `GET /api/v1/admin/backup-offers` (permission `Offers.Review`) returns **groups** — one object per listing that currently holds a queue — each carrying a compact listing projection, the listing's `queueState`, and the full ordered array of that listing's queued offers. Only offers with `isBackup = true` **and** `status = SELECTED_PENDING_FINAL_ADMIN_APPROVAL` **and** `activatedAt IS NULL` belong to the queue. Within a listing, items are ordered by `createdAt ASC, id ASC` and carry a 1-based `queuePosition` (`1` = next in line, exactly OQ-04's "oldest approved backup offer first"). Each item carries the active 15-minute lock projection (`buildLockInfo` shape) and the holder's display name resolved in **one** `adminUser.findMany` (no N+1). Page/limit follow `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`; `meta.total` counts **listings**, not offers. Groups are ordered `SURFACED` first, then `QUEUED`, then `FROZEN`, then `CLOSABLE`, and within a state by the earliest queued `createdAt`.
2. **Queue state is derived from `Listing.status`, never from `Deal`** (FR-27, OQ-04): `queueState` is a pure function — `Active ⇒ SURFACED`, `Reserved ⇒ QUEUED`, `Sold ⇒ CLOSABLE`, every other `ListingStatus` (`Archived`, `Suspended`, `Blocked`, `UnderComplianceReview`, `Draft`, `PendingReview`, `PendingFee`, `Rejected`) `⇒ FROZEN`. This makes the "primary deal was cancelled by buyer / by timeout / rejected" trigger work **the moment Epic 5 reverts `Reserved` → `Active`** (PRD FR-33, FR-34, FR-56 all mandate that revert) with zero Epic 5 code, and it deliberately reads **no** `Deal` row, so Story 5.1's reconciliation of `DealStatus` cannot break this story.
3. **Activation action (FR-27, AD-10):** `POST /api/v1/admin/backup-offers/:id/activate` (`Offers.Review`) promotes a surfaced backup offer. It runs in one `prisma.$transaction`, takes a `FOR UPDATE` row lock on the offer **and** on the listing (`::text` casts — see the traps), re-validates the caller's claim lease inside the transaction, then atomically sets `activatedAt = ClockService.now()`, increments `version`, writes an `OfferHistory` row (`OFFER_BACKUP_ACTIVATED`, `actorAdminId`), writes an `AuditLog` row (`actorType: 'ADMIN'`, action `OFFER_BACKUP_ACTIVATED`), and **clears the lock on commit**. The offer keeps `status = SELECTED_PENDING_FINAL_ADMIN_APPROVAL`; **no `Deal` is created**.
4. **Activation refusals are explicit 409s (NFR1 — server-side only):**
   - offer not `isBackup` or status ≠ `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` → `OFFER_BACKUP_NOT_QUEUED`
   - `activatedAt` already set → `OFFER_BACKUP_ALREADY_ACTIVATED`
   - listing `Reserved` (primary deal still in flight) → `OFFER_BACKUP_PRIMARY_DEAL_ACTIVE`
   - listing `Sold` (primary deal already completed) → `OFFER_BACKUP_LISTING_UNAVAILABLE`
   - listing `FROZEN`-class (`Archived`/`Blocked`/`Suspended`/`UnderComplianceReview`/…) → `OFFER_BACKUP_LISTING_UNAVAILABLE`
   - another offer **on the same listing** already has `activatedAt != null` → `OFFER_BACKUP_ALREADY_ACTIVATED` (at most one activated candidate per listing)
   - no/foreign/expired claim lease → the existing `OFFER_LOCK_REQUIRED` / `OFFER_LOCK_CONFLICT` / `OFFER_LOCK_EXPIRED`
   - unknown id → `OFFER_NOT_FOUND` (404).
5. **Claiming a queued backup is legal (AD-10, regression of 4.2's claim guard):** `POST /api/v1/admin/offers/:id/claim` currently refuses anything that is not `PENDING_ADMIN_REVIEW`/`COUNTER_OFFERED`. That set is split: `AWAITING_MEDIATION_STATUSES` stays the **mediation queue filter** untouched, and a new `CLAIMABLE_OFFER_STATUSES = [...AWAITING_MEDIATION_STATUSES, SELECTED_PENDING_FINAL_ADMIN_APPROVAL]` becomes the **claim legality** set. `heartbeat` / `release` / `force-unlock` are unchanged. Every new endpoint reuses the canonical `/admin/offers/:id/{claim,heartbeat,release,force-unlock}` routes — there is exactly one lease implementation for `Offer`.
6. **Hand-off contract for Story 5.1:** an activated backup offer is indistinguishable from an ordinary mutually-agreed offer at the `Deals.FinalApprove` boundary — same status, plus `activatedAt` for traceability — so Story 5.1 needs **no** backup special-casing. Mark the boundary with `// TODO(5.1): Deals.FinalApprove binds this activated offer into a Deal (no Deals module yet).` and do **not** create a `Deal`, a `DealsModule`, or a payment record.
7. **Automatic closure when the primary deal wins (FR-27, PRD FR-32 "all competing/backup offers = Closed"):** a new exported, transaction-aware primitive `BackupOffersService.closeRemainingBackupOffersForListing(listingId, meta, tx?)` moves **every** approved, never-activated backup offer on that listing to a new terminal status `CLOSED_BACKUP`, writing one `OfferHistory` row (`OFFER_BACKUP_CLOSED`, actor `SYSTEM` or the acting admin) plus one `AuditLog` row per offer, and incrementing `version`. It **skips offers with `activatedAt != null`** (the winning candidate is Story 5.1's to terminate) and is **idempotent** (re-running over an already-closed queue changes nothing). `OffersModule` exports the service so `DealsModule` can inject it inside the completion transaction.
8. **Reconciliation sweep (AD-7, AD-11):** `apps/worker` gains `backup-offer-reconciliation` (every 10 minutes) following the established DB-less factory shape — `createBackupOfferReconciliationLogic(db?: BackupOfferReconciliationDbClient)` selecting `isBackup = true`, `status = SELECTED_PENDING_FINAL_ADMIN_APPROVAL`, `activatedAt = null`, `listing.status = SOLD`, then closing each one with history + `SYSTEM` audit. Registered in `BACKGROUND_JOB_DEFINITIONS` and `jobHandlersMap`; idempotent by construction; fully unit-tested through an injected client. This is the only "automatic" closure path that exists before Story 5.1 wires the synchronous call.
9. **A queued backup never expires (FR-27 boundary):** `EXPIRABLE_OFFER_STATUSES` is **not** extended — a backup offer is held *in reserve* until the primary deal resolves, exactly like the mutually-agreed offer it is. It leaves the queue only through activation (AC 3) or closure (AC 7/8). Document this in the constant's comment so a future story does not "helpfully" add it to the sweep.
10. **Buyer-visible outcome in lieu of notifications (AC of the epic: "with notification to buyers"):** no `Notification` model exists, so the closure and activation must be **legible in the offers UI**: `BuyerOffersList` / `SellerOffersList` render a «عرض احتياطي» chip for `isBackup`, «عرض احتياطي مُفعَّل» once `activatedAt` is set, and the `OfferStatusBadge` renders the new terminal state («مغلق — اكتملت الصفقة الأساسية»). The negotiation timeline renders the two new history actions. Notification dispatch stays a `// TODO(8.8)` marker — **do not** invent a `Notification` model, a mailer, or a queue.
11. **State-set integrity (the recorded pitfall):** `CLOSED_BACKUP` is appended to the Prisma `OfferStatus` enum **and** `packages/shared/src/enums/index.ts` in the same change, added to `TERMINAL_OFFER_STATUSES`, and kept **out of** `ACTIVE_OFFER_STATUSES` and `EXPIRABLE_OFFER_STATUSES`. The 4.1 invariant test ("`ACTIVE_OFFER_STATUSES` and `TERMINAL_OFFER_STATUSES` are disjoint and together cover every enum member") is extended — not deleted — and must pass with **14** members (9 active + 5 terminal). `OFFER_STATUS_LABELS_AR` (14 keys), `OFFER_STATUS_VARIANTS` in `offer-status-badge.tsx` (14 keys) and `OFFER_HISTORY_ACTION_LABELS_AR` must be extended; all three are exhaustive `Record<…>` types and are hard `tsc` failures until they are.
12. **Deterministic, auditable, additive-only, no regressions:** every instant from `ClockService.now()` (no arg-less `new Date()`, no `Date.now()`); every state change inside one `prisma.$transaction` behind `$queryRaw … FOR UPDATE` with `::text` casts; schema applied with `prisma db push` + `prisma generate` (no migration folder — the repo has none) and the diff must be exactly **1 enum value + 1 nullable column + at most 1 index**. 4.1's and 4.2's endpoints, `ACTIVE_OFFER_STATUSES`-driven listings archive/suspend/block guards, the admin mediation queue, the `offer-expiry-checker` sweep, the worker handler map, and all existing api/web/worker/shared specs keep passing.

## Tasks / Subtasks

- [x] **Data model — additive only** (`apps/api/prisma/schema.prisma`) — AC: 3, 7, 11, 12
  - [x] `enum OfferStatus`: append `CLOSED_BACKUP` **after** `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`. Never remove or reorder an existing member.
  - [x] `model Offer`: add `activatedAt DateTime? @map("activated_at")` immediately after `rejectionNote`. Nothing else changes — the queue's access path is already covered by the existing `@@index([listingId, isBackup, status])`.
  - [x] Apply with `npm run prisma:push` then `npm run prisma:generate` in `apps/api`. Inspect the diff and reject anything destructive against the seeded dev DB: expect `ALTER TYPE … ADD VALUE 'CLOSED_BACKUP'` + `ALTER TABLE "offers" ADD COLUMN "activated_at" TIMESTAMP(3)` and **zero** drops/renames.
  - [x] Mirror the enum member in `packages/shared` in the same commit (Prisma and shared must never drift).
  - [x] No seed change: `apps/api/prisma/seed.ts` seeds geo + admins + 1 `ACTIVE` and 1 `RESERVED` listing only; backup offers are created through the API.

- [x] **Shared contracts** (`packages/shared`) — AC: 1, 4, 6, 10, 11
  - [x] `src/enums/index.ts` (~L57–L71): append `CLOSED_BACKUP = 'CLOSED_BACKUP'` to `OfferStatus` in the same position as Prisma.
  - [x] `src/constants/offer.ts`:
    - add `CLOSED_BACKUP` to `TERMINAL_OFFER_STATUSES` only (now 5 members);
    - leave `ACTIVE_OFFER_STATUSES` (9) and `EXPIRABLE_OFFER_STATUSES` (8) untouched, and extend the `EXPIRABLE_OFFER_STATUSES` doc comment with one line: a backup offer in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` is held in reserve, not awaiting a reply (AC 9);
    - extend `OFFER_STATUS_LABELS_AR` with `[OfferStatus.CLOSED_BACKUP]: 'مغلق — اكتملت الصفقة الأساسية'`;
    - add `BACKUP_ACTIVATED: 'OFFER_BACKUP_ACTIVATED'` and `BACKUP_CLOSED: 'OFFER_BACKUP_CLOSED'` to `OFFER_HISTORY_ACTIONS`, and the matching `OFFER_HISTORY_ACTION_LABELS_AR` entries (`'تفعيل عرض احتياطي'`, `'إغلاق عرض احتياطي بعد اكتمال الصفقة الأساسية'`) — the `Record<OfferHistoryAction, string>` type makes this compile-enforced;
    - add the error codes `OFFER_BACKUP_NOT_QUEUED`, `OFFER_BACKUP_ALREADY_ACTIVATED`, `OFFER_BACKUP_PRIMARY_DEAL_ACTIVE`, `OFFER_BACKUP_LISTING_UNAVAILABLE`;
    - add `BACKUP_QUEUE_STATES` as a frozen `as const` tuple `['SURFACED', 'QUEUED', 'FROZEN', 'CLOSABLE']` (display order for the queue) + `BACKUP_QUEUE_STATE_LABELS_AR` (`'جاهز للتفعيل'`, `'في الانتظار'`, `'مجمّد — العقار غير متاح'`, `'جاهز للإغلاق'`) + `BACKUP_QUEUE_STATE_ORDER` as `Record<BackupOfferQueueState, number>` (`SURFACED: 0, QUEUED: 1, FROZEN: 2, CLOSABLE: 3`) so the API and the UI cannot disagree about the sort.
  - [x] `src/schemas/offer.schema.ts`: add `backupOfferQueueQuerySchema` mirroring `offerQueueQuerySchema` **exactly** (`coerce`d `page`/`limit` with `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`, no `status` filter). No body schema is needed for activation: it takes no input beyond the path id (an optional `note` would widen the ACs — do not add one).
  - [x] `src/types/offer.ts`:
    - `OfferItem`: add the **optional** `activatedAt?: string | null` (4.1's contract and SSR specs must keep compiling);
    - `OfferThreadSummary`: add the **optional** `activatedAt?: string | null`;
    - new `export type BackupOfferQueueState = 'SURFACED' | 'QUEUED' | 'FROZEN' | 'CLOSABLE';`
    - new `export interface BackupOfferQueueItem extends OfferThreadSummary { queuePosition: number; queueState: BackupOfferQueueState; }` — the listing projection is **inherited**, not re-declared: `OfferThreadSummary.listing: OfferListingSummary` already carries `propertyType`, `areaSquareMeters`, `cityName`, `districtName`, `askPrice` and `status`, which is exactly what the queue card renders. **Do not declare a `BackupOfferQueueListing` type** (that is the wheel this story must not reinvent) and **do not** add a `listingStatus` field — `item.listing.status` is the single source of the listing's state.
    - new `export interface BackupOfferQueueGroup { listing: OfferListingSummary; queueState: BackupOfferQueueState; items: BackupOfferQueueItem[]; }`
  - [x] `src/types/index.ts`: add `export type BackupOfferQueueQuery = z.infer<typeof backupOfferQueueQuerySchema>;` and re-export the new queue types alongside the existing offer types.
  - [x] **🔴 Rebuild shared dist before ANY api/web/worker test run:** `cd packages/shared && npx tsc`. Jest/vitest resolve `@elmasaif/shared` from `dist/`; a stale dist produces phantom "missing export" failures (bit Stories 3.4–4.2).

- [x] **API — backup queue service** (`apps/api/src/modules/offers/backup-offers.service.ts`, NEW) — AC: 1, 2, 3, 4, 6, 7, 9
  - [x] Declare the queue predicate in one place and reuse it everywhere:
    `const QUEUED_BACKUP_WHERE = { isBackup: true, status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, activatedAt: null }`.
  - [x] `export function resolveBackupQueueState(listingStatus: ListingStatus): BackupOfferQueueState` — the pure AC-2 derivation (`Active ⇒ SURFACED`, `Reserved ⇒ QUEUED`, `Sold ⇒ CLOSABLE`, default `FROZEN`). Export it for unit tests; never inline it.
  - [x] `getBackupQueue(query, currentAdminId): Promise<BackupOfferQueueResponse>`:
    1. resolve the page/limit the way `AdminOffersService.getQueue` does (clamped, `DEFAULT_PAGE_SIZE` fallback);
    2. collect the **distinct listing ids** holding a queue: `offer.findMany({ where: QUEUED_BACKUP_WHERE, distinct: ['listingId'], select: { listingId: true, createdAt: true }, orderBy: { createdAt: 'asc' } })`;
    3. load those listings (`prisma.listing.findMany({ where: { id: { in } }, include: { city: true, district: true } })`), map each to `resolveBackupQueueState`, and sort by `BACKUP_QUEUE_STATE_ORDER` then earliest queued `createdAt` then listing id — that ordering is what makes `meta.total` == number of **listings** and the page deterministic;
    4. slice the page, then load that page's offers with `include: OFFER_SUMMARY_INCLUDE` and `orderBy: [{ listingId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]`;
    5. assign `queuePosition` 1..n per listing, attach `lockInfo` via the shared lock projection, and return `{ items: BackupOfferQueueGroup[], meta }`.
  - [x] **Reuse 4.2's lock helpers instead of re-implementing them:** promote `buildLockInfo`, `assertLockHeld` and `resolveLockHolderNames` out of `AdminOffersService` into a shared, exported helper module (e.g. `apps/api/src/modules/offers/offer-lock.ts`) and have **both** services import it. Do not copy-paste a second copy — a drifting duplicate of the lease semantics is exactly the bug AD-10 exists to prevent. `AdminOffersService`'s public behaviour must not change (its spec asserts the 409 codes and the lock shape).
  - [x] `activateBackupOffer(offerId, admin): Promise<BackupOfferQueueItem>`:
    `const now = this.clockService.now()` → `this.prisma.$transaction(async (tx) => …)`:
    1. `await tx.$queryRaw\`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE\`` (**`::text`, never `::uuid`**), then `tx.offer.findUnique({ where: { id }, include: OFFER_SUMMARY_INCLUDE })` → null ⇒ 404 `OFFER_NOT_FOUND`;
    2. AC 4 checks **in this order**, each mapping to its own code: status/isBackup → `OFFER_BACKUP_NOT_QUEUED`; `activatedAt` → `OFFER_BACKUP_ALREADY_ACTIVATED`; then lock the listing `SELECT "id" FROM "listings" WHERE "id" = ${offer.listingId}::text FOR UPDATE`, derive `queueState`: `QUEUED` ⇒ `OFFER_BACKUP_PRIMARY_DEAL_ACTIVE`, `CLOSABLE`/`FROZEN` ⇒ `OFFER_BACKUP_LISTING_UNAVAILABLE`;
    3. at most one activated candidate per listing: `tx.offer.findFirst({ where: { listingId: offer.listingId, isBackup: true, activatedAt: { not: null } } })` ⇒ non-null and not this id ⇒ `OFFER_BACKUP_ALREADY_ACTIVATED` (defence in depth — the row lock on the listing already serialises concurrent activations);
    4. `assertLockHeld(offer, admin.id, now)` **after** the state checks so the operator reads the most actionable error;
    5. `tx.offer.update({ where: { id }, data: { activatedAt: now, version: { increment: 1 }, lockedByAdminId: null, lockedAt: null, lockExpiresAt: null } })` — lock released on decision commit (AD-10); **do not** touch `status`, `expiresAt`, `offerPrice`, or `Listing.status`;
    6. `tx.offerHistory.create({ data: { offerId, actorAdminId: admin.id, action: OFFER_HISTORY_ACTIONS.BACKUP_ACTIVATED, priceSnapshot: Number(offer.offerPrice), notes: null, roundNumber: Number(offer.negotiationRound ?? 0) } })`;
    7. `tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'OFFER_BACKUP_ACTIVATED', entityType: 'Offer', entityId: offerId, payload: { listingId, queuePosition, price: Number(offer.offerPrice), previousListingStatus, adminName: admin.fullName, at: now.toISOString() } } })`;
    8. `// TODO(5.1): Deals.FinalApprove binds this activated offer into a Deal (no Deals module yet).` and `// TODO(8.8): notify the buyer that their backup offer was activated (no Notification model).`;
    9. return the refreshed item (`toOfferThreadSummary` + `queuePosition` + `queueState` + `lockInfo`); the listing's state is read from `item.listing.status`, never duplicated into a sibling field.
  - [x] `closeRemainingBackupOffersForListing(listingId, meta, tx?)` — AC 7. Signature:
    `async closeRemainingBackupOffersForListing(listingId: string, meta: { reason: 'PRIMARY_DEAL_COMPLETED' | string; actorAdminId?: string | null; closedAt?: Date }, tx?: any): Promise<{ closedCount: number; offerIds: string[] }>`.
    Implementation: use `tx ?? this.prisma`; `findMany({ where: { ...QUEUED_BACKUP_WHERE, listingId } })` (that predicate already excludes `activatedAt != null`); for each, `update({ data: { status: OfferStatus.CLOSED_BACKUP, version: { increment: 1 } } })` + `offerHistory.create({ data: { offerId, actorAdminId: meta.actorAdminId ?? null, action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED, priceSnapshot, notes: meta.reason, roundNumber } })` + `auditLog.create({ data: { actorId: meta.actorAdminId ?? 'SYSTEM', actorType: meta.actorAdminId ? 'ADMIN' : 'SYSTEM', action: 'OFFER_BACKUP_CLOSED', entityType: 'Offer', entityId, payload: { listingId, reason, price, closedAt } } })`. Never take a client-level transaction when `tx` is supplied — Story 5.1 calls this inside its completion transaction and a nested `$transaction` would deadlock the row locks it already holds. Emit `// TODO(8.8)` for the buyer notification.
  - [x] Every Arabic user-facing message must read as institutional notary copy, matching 4.2's tone (e.g. `'تم تفعيل العرض الاحتياطي؛ سيُحال إلى الموافقة النهائية'`, `'لا يمكن تفعيل العرض الاحتياطي قبل إقفال الصفقة الأساسية'`).

- [x] **API — admin controller** (`apps/api/src/modules/offers/admin-backup-offers.controller.ts`, NEW) — AC: 1, 3, 4
  - [x] `@Controller('admin/backup-offers')` + `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` + `@ApiBearerAuth()`, mirroring `admin-offers.controller.ts` (`req.admin.id` / `req.admin.fullName`, `{ statusCode, message, data }` envelope). A dedicated prefix (not `admin/offers`) is deliberate: it cannot collide with the existing `@Get(':id')`, so there is no NestJS declaration-order trap and no chance of `backup-queue` ever being parsed as an offer id.
  - [x] `@Get()` `@RequireAdminPermission('Offers.Review')` + `@Query(new ZodValidationPipe(backupOfferQueueQuerySchema))` → `{ statusCode: 200, data: await backupOffersService.getBackupQueue(query, req.admin.id) }`.
  - [x] `@Post(':id/activate')` `@RequireAdminPermission('Offers.Review')` `@HttpCode(HttpStatus.OK)` + `@ApiResponse` docs for 200/404/409 listing every code from AC 4 → `{ statusCode, message: 'تم تفعيل العرض الاحتياطي', data }`.
  - [x] No `PATCH` / `PUT`, no generic status body (AD-2 / AD-8): activation is a semantic `POST` action with no payload.
  - [x] **Claiming, heartbeating and releasing stay on the canonical routes** `POST /api/v1/admin/offers/:id/{claim,heartbeat,release}`. Do not add duplicates under `backup-offers`.
  - [x] `offers.module.ts`: register `AdminBackupOffersController` in `controllers`, `BackupOffersService` in `providers`, and add `exports: [BackupOffersService]` (Story 5.1 injects it). Add `AdminSessionAuthGuard` + `AdminPermissionGuard` to `providers` only if the module does not already list them. `app.module.ts` needs no change — `OffersModule` is already registered.

- [x] **API — claim legality split** (`apps/api/src/modules/offers/admin-offers.service.ts`) — AC: 5
  - [x] Keep `AWAITING_MEDIATION_STATUSES` exactly as-is (it is the `GET /admin/offers` filter — widening it would leak backup offers into the mediation queue).
  - [x] Add `const CLAIMABLE_OFFER_STATUSES: readonly OfferStatus[] = [...AWAITING_MEDIATION_STATUSES, OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL];` and use it **only** in `claimOffer`'s legality check. Update that method's Arabic error message so it covers both queues («… إلا للعروض التي بانتظار قرار الإدارة أو العروض الاحتياطية المعتمدة»).
  - [x] `heartbeatOffer`, `releaseOffer`, `forceUnlockOffer` need no change (they never inspect status).

- [x] **Worker — reconciliation sweep** (`apps/worker/src/jobs/backup-offer-reconciliation.job.ts`, NEW) — AC: 8
  - [x] Copy the `offer-expiry-checker.job.ts` shape exactly: `export interface BackupOfferReconciliationDbClient { offer: { findMany; update }; offerHistory?: { create }; auditLog?: { create } }` + `export function createBackupOfferReconciliationLogic(db?: BackupOfferReconciliationDbClient)` + `export const backupOfferReconciliationHandler = createJobHandler(JOB_BACKUP_OFFER_RECONCILIATION, createBackupOfferReconciliationLogic())`.
  - [x] Sweep: `db.offer.findMany({ where: { isBackup: true, status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, activatedAt: null, listing: { status: ListingStatus.SOLD } } })` → per offer `update({ data: { status: CLOSED_BACKUP, version: { increment: 1 } } })` + `offerHistory.create({ action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED, … })` + `auditLog.create({ actorId: 'SYSTEM', actorType: 'SYSTEM', action: 'OFFER_BACKUP_CLOSED', payload: { reason: 'PRIMARY_DEAL_COMPLETED', listingId, closedAt } })`. Return `{ processedCount, outcome, details: { evaluationTime, processedCount } }` like `demand-expiry-checker`.
  - [x] `packages/shared/src/types/jobs.ts` (L1–L9): append `| 'backup-offer-reconciliation'` to the hand-maintained `JobName` literal union — it is **not** derived from the constants, so both must be edited or `BACKGROUND_JOB_DEFINITIONS` will not type-check.
  - [x] `packages/shared/src/constants/jobs.ts`: add `export const JOB_BACKUP_OFFER_RECONCILIATION = 'backup-offer-reconciliation' as const;` beside the existing names, plus its `BACKGROUND_JOB_DEFINITIONS` entry with the same field shape as its siblings: `cadence: '*/10 * * * *'`, `singletonKey: JOB_BACKUP_OFFER_RECONCILIATION`, `retryLimit: 3`, `retryDelay: 30`, `retryBackoff: true`, `expireInMinutes: 5`, and a description naming the FR-27 purpose (closes approved backup offers on `SOLD` listings every 10 minutes).
  - [x] `apps/worker/src/jobs/index.ts`: import + `export *` the new job and register it in `jobHandlersMap`. **Do not** add a Prisma dependency to `apps/worker` (see Decision log).

- [x] **Web — admin backup queue** (`apps/web/src/components/admin/`) — AC: 1, 2, 3, 10
  - [x] NEW `backup-offer-queue.tsx` (`'use client'`, exported for SSR tests): fetch `/admin/backup-offers`; render one `Card` per group with the listing summary (title, `PROPERTY_TYPE_LABELS_AR`, area, city/district via `formatSar` for prices), a `Badge` for `BACKUP_QUEUE_STATE_LABELS_AR[queueState]`, and a row per queued offer: `queuePosition`, `buyerName`, `formatSar(offerPrice)` vs `formatSar(askPrice)`, «جولة X من 5», `formatOfferExpiry` (reuse from `buyer-offers-list.tsx`), and the lock holder. Actions per row: «استلام المهمة» (`POST /admin/offers/:id/claim`) while unlocked, «تفعيل العرض الاحتياطي» (`POST /admin/backup-offers/:id/activate`) once the caller holds the lease **and** `queueState === 'SURFACED'`; a link to `/admin/negotiations/:id` for the full timeline. A `409` must render `describeApiError(err).code` mapped to Arabic copy and, for lock conflicts, the holder name via `readLockHolderName(err.details)` — never a generic error. Surface the position-1 row with a «التالي في الانتظار» marker (OQ-04 priority) without disabling the other rows (see Decision log).
  - [x] Sticky/refresh behaviour: re-fetch on every action success; no polling (this queue has no countdown).
  - [x] NEW route `apps/web/src/app/admin/backup-offers/page.tsx` → default export renders `<BackupOfferQueue />`. Route `page.tsx` files export **only** the default component; specs live under `components/admin/__tests__/`.
  - [x] `apps/web/src/components/layout/workspace-shell.tsx` (~L112–L116): add `{ href: '/admin/backup-offers', label: 'طابور العروض الاحتياطية', icon: HandCoins }` inside the **same** `Offers.Review` guard as the `/admin/negotiations` entry, and keep the three labels distinguishable (`العروض الاحتياطية` vs `وساطة عروض الشراء` vs `مراجعة عروض المزودين`).
  - [x] There is **no** `components/admin/index.ts` barrel — import the new component by path in the route page, exactly like `app/admin/negotiations/page.tsx` imports `offer-mediation-queue.tsx`. Do not add a barrel for this story.

- [x] **Web — buyer & seller surfaces** (`apps/web/src/components/offers/`) — AC: 10
  - [x] `offer-status-badge.tsx`: add `[OfferStatus.CLOSED_BACKUP]: 'neutral'` to `OFFER_STATUS_VARIANTS` (`Record<OfferStatus, StatusBadgeVariant>` — a missing key is a hard `tsc` failure, not a runtime fallback).
  - [x] `buyer-offers-list.tsx`: add a «عرض احتياطي» chip when `isBackup` and «عرض احتياطي مُفعَّل» when `activatedAt != null`, next to the existing «بانتظار ردك» / «جولة X من 5» chips. Keep the existing SSR assertions passing and do not wrap the row in an anchor.
  - [x] `seller-offers-list.tsx`: same backup chip so the seller can tell a reserve bid from the live one. Optional, additive props only.
  - [x] `offer-negotiation-timeline.tsx`: no code change is needed beyond the constant additions (it renders `OFFER_HISTORY_ACTION_LABELS_AR[action]`); verify a backup-offer thread renders `OFFER_BACKUP_ACTIVATED` / `OFFER_BACKUP_CLOSED` instead of a blank row — add the assertion.

- [x] **Tests** — AC: all (jest for api, vitest for shared/web/worker)
  - [x] Shared (`src/constants/__tests__/offer.spec.ts`, `src/schemas/__tests__/offer.spec.ts`): **`it('labels every OfferStatus in Arabic with no gaps')` hardcodes `expect(statuses).toHaveLength(13)` at L70 — it must become `14`** and gain a `CLOSED_BACKUP` label assertion; `ACTIVE_OFFER_STATUSES` ∪ `TERMINAL_OFFER_STATUSES` covers all **14** members and stays disjoint; `CLOSED_BACKUP` is terminal and in neither `ACTIVE_OFFER_STATUSES` nor `EXPIRABLE_OFFER_STATUSES`; `OFFER_STATUS_LABELS_AR` has an entry for every member; `OFFER_HISTORY_ACTION_LABELS_AR` covers `BACKUP_ACTIVATED` / `BACKUP_CLOSED`; the four new error codes are exported; `BACKUP_QUEUE_STATE_ORDER` orders `SURFACED < QUEUED < FROZEN < CLOSABLE`; `backupOfferQueueQuerySchema` defaults `page = 1`, `limit = DEFAULT_PAGE_SIZE`, clamps `limit > MAX_PAGE_SIZE`.
  - [x] API (jest, NEW `apps/api/src/modules/offers/__tests__/backup-offers.spec.ts`): `resolveBackupQueueState` matrix over every `ListingStatus`; queue grouping/positions/`SURFACED`-first ordering; excluded offers (`activatedAt != null`, non-backup, non-selected); `meta.total` counts listings; activation happy path (`activatedAt` set, `status` unchanged, lock cleared, `version` incremented, history + audit called, `expiresAt` **not** touched); every refusal code from AC 4 including two offers on the same listing; `OFFER_LOCK_*` precedence; `OFFER_NOT_FOUND`; the row-lock SQL contains `::text` and never `::uuid` for **both** the offer and the listing lock (keep 4.1's regression assertion alive); `closeRemainingBackupOffersForListing` closes only never-activated approved backups, writes history + audit per offer, accepts an injected `tx` and never opens its own `$transaction`, and is a no-op on a second run.
  - [x] API (jest, extend `__tests__/admin-offers.spec.ts`): `claimOffer` accepts `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`; `getQueue` still returns **only** `PENDING_ADMIN_REVIEW` / `COUNTER_OFFERED` (the regression the split exists to prevent); the existing lock-code assertions stay green.
  - [x] Worker (vitest, NEW `apps/worker/src/jobs/__tests__/backup-offer-reconciliation.spec.ts`, mirror `offer-expiry.spec.ts`): no db ⇒ `processedCount === 0`; with a fake client only `SOLD`-listing, approved, non-activated backups are selected and closed with history + `SYSTEM` audit; an activated offer and a `RESERVED`-listing offer are **not** selected; a second run selects nothing (idempotency); the handler is registered under `JOB_BACKUP_OFFER_RECONCILIATION` in `jobHandlersMap`.
  - [x] Web (vitest, extend `components/admin/__tests__` + `components/offers/__tests__/offers.spec.tsx`): `BackupOfferQueue` `renderToString` renders groups, the surfaced badge, positions, and the empty state; the «تفعيل» action is present only for `SURFACED` + held-lock rows (assert through a pure exported helper such as `resolveBackupQueueActions(group, item, lockInfo)` rather than DOM interaction — the suite has no jsdom); `OfferStatusBadge` renders `CLOSED_BACKUP`; `BuyerOffersList` / `SellerOffersList` render the backup and activated chips.
  - [x] Frameworks: **no new dependencies** — no form, table, timeline or UI-kit library.

- [x] **Verification** — AC: 12
  - [x] `cd packages/shared && npx tsc` before any test run; then `npm test --workspace=packages/shared`, `--workspace=apps/api`, `--workspace=apps/worker`, `--workspace=apps/web`.
  - [x] `npm run prisma:generate` verified in `node_modules/.prisma/client/index.d.ts`: `CLOSED_BACKUP` and `activated_at` / `activatedAt` present (do not assume).
  - [x] `npx prisma validate`; `tsc --noEmit` in `apps/api` and `apps/worker` clean; `apps/web` shows only the seven pre-existing baseline files recorded in 4.2's Debug Log.
  - [x] `npm run lint --workspace=apps/api` — new files must be clean (`no-explicit-any` is enforced; use `describeApiError` / `readLockHolderName` from `lib/api-client.ts` in components).

## Dev Notes

### Scope boundaries (build ONLY this)

- **IN:** one terminal `OfferStatus` member (`CLOSED_BACKUP`); `Offer.activatedAt`; the shared queue-state constants, error codes, history actions, query schema and queue types; `BackupOffersService` (queue read + activation + closure primitive); the `admin/backup-offers` controller; the `claimOffer` legality split; the `backup-offer-reconciliation` worker job + its catalog entry; the admin backup-queue screen and route; backup chips on the buyer/seller offer lists; the badge variant.
- **OUT (explicitly deferred, do NOT build):**
  - **`Deal` creation, `Deals.FinalApprove`, payment records, deal state machine** = **Story 5.1**. Activation ends at `activatedAt`; no `DealsModule`, no `Deal` row.
  - **Notification delivery / email / in-app feed** = **Story 8.8**. No `Notification` model — `// TODO(8.8)` only.
  - **Buyer withdrawal of a backup offer** — not in FR-27/FR-25 and AD-2/AD-8 forbid generic `PATCH`; silence is handled by activation or closure.
  - **Admin decline/expel a backup offer** — not in FR-27; the existing `POST /admin/offers/:id/reject` only covers `PENDING_ADMIN_REVIEW` / `COUNTER_OFFERED`. Do not widen it.
  - **Buyer-facing queue position** — deliberately not exposed (it would need a per-listing rank query in `GET /offers/my`). The buyer sees queued vs activated.
  - **Enforcing `If-Match` / `Idempotency-Key`** — repo-wide gap, documented in 4.1/4.2; `version` is incremented so a later story can enforce it.
  - **Worker → Prisma runtime wiring** — the worker has no Prisma dependency in `package.json`; see Decision log.
  - **`DealStatus` reconciliation** — Story 5.1 owns it; this story must not read `Deal` at all.

### Critical implementation traps (read before coding)

- **🔴 `Listing.status` is the single source of truth for this story.** Do **not** query `prisma.deal` to decide whether a primary deal is in flight. `DealStatus` in `schema.prisma` (`AWAITING_PAYMENT_PROOF | UNDER_ADMIN_AUDIT | PAYMENT_REJECTED | COMPLETED | CANCELLED | TERMINATED`) has already drifted from `ARCHITECTURE-SPINE.md`'s deal state machine (`AwaitingPaymentProof | PaymentUnderReview | CancelledByBuyer | CancelledByTimeout | CancelledByAdmin | Disputed | …`); Story 5.1 will reconcile it. Keying off `Listing.status` (which the PRD mandates to be `Reserved` during a deal, `Active` after a cancellation and `Sold` after completion) is the only derivation that survives that reconciliation untouched.
- **🔴 `claimOffer` must not be widened by editing `AWAITING_MEDIATION_STATUSES`.** That constant doubles as the `GET /admin/offers` filter. Adding `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` to it would flood the mediation queue with backup offers and break 4.2's queue spec. Introduce `CLAIMABLE_OFFER_STATUSES` for the claim check only.
- **🔴 Activation must NOT go through `applyDecision`.** That helper forces a `status` change and a fresh `expiresAt` for non-terminal targets. Activation changes **neither** — it only stamps `activatedAt`. Write a dedicated transaction path.
- **🔴 `offers.id` and `listings.id` are `text` columns, not `uuid`.** Every `$queryRaw … FOR UPDATE` must cast `::text`. 4.1 shipped a runtime 500 (`P2010` / `42883: operator does not exist: text = uuid`) because a Dev Note said `::uuid`. The activation path locks **two** rows (offer, then listing) in that order — keep the order stable so concurrent activations cannot deadlock against each other.
- **🔴 `closeRemainingBackupOffersForListing` must accept a caller-supplied `tx` and must never open its own `$transaction` when one is passed.** Story 5.1 calls it inside the deal-completion transaction which already holds `FOR UPDATE` locks on the listing and payments; a nested client-level transaction is a different connection and will deadlock or time out.
- **🔴 The closure primitive must skip `activatedAt != null`.** The activated candidate is the one that becomes the winning deal; Story 5.1 marks its terminal state. Closing it here would erase the winning offer from the audit trail of a completed sale.
- **🔴 `OFFER_STATUS_LABELS_AR` and `OFFER_STATUS_VARIANTS` are exhaustive `Record<OfferStatus, …>` maps.** A missing `CLOSED_BACKUP` key is a hard `tsc` failure in `packages/shared` and `apps/web` (the `?? 'neutral'` / `?? String(status)` fallbacks only protect the *string*-typed prop). Same for `OFFER_HISTORY_ACTION_LABELS_AR`, which is keyed by the union of `OFFER_HISTORY_ACTIONS` **values**.
- **🔴 Do not add `CLOSED_BACKUP` to `ACTIVE_OFFER_STATUSES`.** Four listings guards (archive, archive-withdraw, compliance-suspend, compliance-block) and 4.1's per-buyer active-offer rule derive from it; a terminal status in that list would let a closed backup offer keep a listing un-archivable forever. The invariant test asserts exact coverage — extend it, do not delete it.
- **🔴 Do not add the queue state to `EXPIRABLE_OFFER_STATUSES`.** A backup in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` is held in reserve (FR-27), not awaiting a reply; the 7-day sweep would silently kill reserve bids on long-running deals.
- **🔴 `packages/shared/dist` is what jest/vitest resolve.** Run `cd packages/shared && npx tsc` **before** any api/web/worker test run.
- **🔴 No committed migrations.** `npm run prisma:push` + `npm run prisma:generate` in `apps/api`; inspect the diff and reject anything destructive against the seeded dev DB. The repo's `.env`-driven Postgres on `5432` is the seeded dev DB — an accidental `--force-reset` costs the whole dataset.
- **🔴 Arabic can be corrupted at write time, not just in terminal output.** 4.2 shipped two real defects this way («فتح التفاع» for «فتح التفاوض»). Verify Arabic literals with a Node script asserting `\uXXXX` escapes and printing ASCII `true`/`false`; never trust `grep` output as proof.
- **🔴 Reuse, do not fork, the lock projection.** `buildLockInfo` / `assertLockHeld` / `resolveLockHolderNames` live in `AdminOffersService` today. Extract them into a shared helper and import from both services; duplicating them guarantees the two queues drift apart on lazy expiry.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)

- **AD-1 / AD-2:** the web app never touches Prisma; all reads/writes go through `apiClient` over the same-origin `/api` proxy. Activation is a semantic `POST` (`/admin/backup-offers/:id/activate`) — **no generic `PATCH`, no Server Actions**.
- **AD-4:** activation runs in one `prisma.$transaction` with `FOR UPDATE` row locks on the offer **and** the listing before any state check, so two admins cannot both activate a candidate for the same listing.
- **AD-7:** `OfferHistory` + `AuditLog` are written in the same transaction as every state change; the reconciliation job is strictly idempotent and takes its instant from the worker clock.
- **AD-10:** `Offer` is one of the 8 claim-locked queues. Claim is an explicit `POST`, 15-minute lease, 5-minute heartbeat, lazy expiry, read-only banner for other admins, `Tasks.ForceUnlock` with a mandatory reason, lock released on decision commit. A claim never replaces a version check — this repo has no `If-Match`, documented rather than invented.
- **AD-11:** every instant from `ClockService.now()`; `new Date(now.getTime() + …)` arithmetic is fine, arg-less `new Date()` as a *time source* is not.
- **AD-12:** `Offers.Review` gates both new endpoints; no new permission key is introduced (it already exists for SUPER_ADMIN and MODERATOR in `packages/shared/src/constants/auth.ts` — no seeding change).
- **Consistency conventions:** `{ data, meta: { total, page, limit, totalPages } }` pagination envelope; error envelope `{ code, message, details?, requestId }` produced by the global filter; money as `number` in the projection and `Decimal(12,2)` in the DB; ISO-8601 UTC strings for instants.
- **NFR1:** every guardrail (queue state, single-activation, lease, listing availability) is enforced **server-side**; the UI badges are affordances only.
- **Stack (pinned):** NestJS 10.x + Prisma 5.x, Next.js App Router + React 19 + Tailwind 3.4, Zod 3.23, TypeScript strict. **No new dependencies.**

### Reuse map (all already exist — do not rebuild)

- **Offer read projections:** `apps/api/src/modules/offers/offer-thread.mapper.ts` — `OFFER_SUMMARY_INCLUDE`, `OFFER_THREAD_INCLUDE`, `toOfferThreadSummary`, `toHistoryEntry`, `toIso`, `resolveAwaitingParty`. Extend `toOfferThreadSummary` with `activatedAt` only.
- **Claim-lock idiom (extract, don't copy):** `apps/api/src/modules/offers/admin-offers.service.ts` — `claimOffer` (L162–L239, atomic conditional `updateMany`), `buildLockInfo` (L533–L572, lazy expiry), `assertLockHeld` (L578–L597), `resolveLockHolderNames` (L599–L625, single `adminUser.findMany`), `notFound()` (L640–L645).
- **Admin controller idiom:** `apps/api/src/modules/offers/admin-offers.controller.ts` (`AdminSessionAuthGuard` + `AdminPermissionGuard` + `@RequireAdminPermission('Offers.Review')`, `req.admin.id`, `{ statusCode, message, data }`); `apps/api/src/modules/proposals/admin-proposals.controller.ts` for a second sample.
- **Row-lock + transaction idiom:** `admin-offers.service.ts#applyDecision` (L413–L527) and `offers.service.ts#applyPartyResponse`.
- **Worker factory idiom:** `apps/worker/src/jobs/offer-expiry-checker.job.ts` (whole file) and `apps/worker/src/jobs/__tests__/offer-expiry.spec.ts`; `job-wrapper.ts#createJobHandler`.
- **Web client/presentational split:** `apps/web/src/components/admin/{offer-mediation-queue.tsx,offer-mediation-workspace.tsx,proposal-review-queue.tsx}`; `apps/web/src/components/offers/{buyer-offers-list.tsx,seller-offers-list.tsx,offer-status-badge.tsx,offer-negotiation-timeline.tsx}`.
- **API-error helpers (avoid `no-explicit-any` lint errors):** `apps/web/src/lib/api-client.ts` — `describeApiError` (L147), `readLockHolderName` (L162).
- **Money / labels:** `formatSar` (from `components/listings/commission-calculator`, re-exported by `components/listings`), `formatOfferExpiry` (exported by `buyer-offers-list.tsx`), `PROPERTY_TYPE_LABELS_AR`, `OFFER_STATUS_LABELS_AR`.
- **UI primitives:** `Badge`, `Button`, `Card`/`CardHeader`/`CardTitle`/`CardContent`, `EmptyState` from `components/ui` (exports only these four — build the queue layout from Tailwind).
- **Shared primitives:** `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `MIN_LISTING_PRICE_SAR`, `MAX_LISTING_PRICE_SAR`, `ACTIVE_OFFER_STATUSES`, `TERMINAL_OFFER_STATUSES`, `EXPIRABLE_OFFER_STATUSES`, `OFFER_HISTORY_ACTIONS`, `OfferStatus`, `ListingStatus`, `UserRole`, `PaginatedResponse`.
- **Listing projection:** `packages/shared/src/types/offer.ts#L8–L17` — `OfferListingSummary` (`id`, `title`, `propertyType`, `cityName`, `districtName`, `askPrice`, `areaSquareMeters`, `status`). Reuse it for the queue group and inherit it through `OfferThreadSummary.listing` for every queue item; do not declare a second projection.

### Current-state notes (files being touched)

- **`apps/api/prisma/schema.prisma` (UPDATE):** `enum OfferStatus` (append `CLOSED_BACKUP`) and `model Offer` (add `activatedAt DateTime? @map("activated_at")`). `Offer` already has `isBackup`, `activatedAt`'s sibling `rejectionReason`/`rejectionNote`, and `@@index([listingId, isBackup, status])`. `Deal` exists but is **not** touched or read.
- **`packages/shared/src/{enums/index.ts, constants/offer.ts, constants/jobs.ts, schemas/offer.schema.ts, types/offer.ts, types/index.ts}` (UPDATE).**
- **`apps/api/src/modules/offers/{admin-offers.service.ts, offers.module.ts}` (UPDATE)** + NEW `backup-offers.service.ts`, `admin-backup-offers.controller.ts`, and the extracted `offer-lock.ts` helper.
- **`apps/worker/src/jobs/{index.ts}` (UPDATE)** + NEW `backup-offer-reconciliation.job.ts`.
- **`apps/web/src/components/{offers/offer-status-badge.tsx, offers/buyer-offers-list.tsx, offers/seller-offers-list.tsx, offers/__tests__/offers.spec.tsx, layout/workspace-shell.tsx}` (UPDATE)** + NEW `components/admin/backup-offer-queue.tsx`, `app/admin/backup-offers/page.tsx`.
- **`_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)** at completion.
- `apps/web/tsconfig.tsbuildinfo` may change as a generated build artifact — record it separately if it does.

### Decision log (make these calls, do not re-litigate in code)

- **`CLOSED_BACKUP` is a new terminal status, not a reuse of `WITHDRAWN` / `EXPIRED` / `REJECTED_BY_ADMIN`.** PRD FR-32 says backup offers become `Closed`; `Withdrawn` implies buyer withdrawal, `Expired` implies time, `RejectedByAdmin` implies judgement against the buyer. Analytics, the buyer's list and the audit trail must be able to tell "the primary deal won" apart from all three.
- **Queue membership = `isBackup && status = SELECTED_PENDING_FINAL_ADMIN_APPROVAL && activatedAt IS NULL`.** No new intermediate status ("queued", "surfaced") is introduced: the queue is a *view* over the hand-off state, `queueState` is derived, and `activatedAt` is the only new persisted fact. Adding statuses would force Story 5.1 to translate four more members at the `Deals.FinalApprove` boundary for no behavioural gain.
- **Surfacing is derived from `Listing.status`, not event-driven.** The only other option (a `Deal`-driven trigger) does not exist yet and would couple this story to `DealStatus` churn. Derivation is also self-healing: it is correct after a manual admin intervention, a data repair, or a replayed job, where an event listener would have missed the cue.
- **"Oldest approved backup" is implemented as `createdAt ASC` (submission order) with `id` as the deterministic tiebreak.** No `approvedAt` column: the queue's fairness intent (first come, first served for a reserve bid) is submission order, and approval order can only diverge when an admin relays a newer offer first — a case where the newer buyer would otherwise jump the queue.
- **Activation is allowed for any position, not only position 1.** OQ-04 gives the admin the confirmation step ("admin reviews and confirms activation; backup offer does not convert automatically"), so surfacing is advisory priority, not a hard constraint. The UI marks position 1 as «التالي في الانتظار» so a departure from queue order is always a visible, auditable choice.
- **At most one activated candidate per listing**, enforced inside the activation transaction. Two simultaneously "activated" backups would both reach `Deals.FinalApprove`, and the second would collide with the partial unique index on active deals.
- **Activation keeps `status = SELECTED_PENDING_FINAL_ADMIN_APPROVAL`.** A separate `BACKUP_ACTIVATED` status would require Story 5.1 to accept two input states for the same operation; `activatedAt` carries the traceability instead. Mark this in the `Deals.FinalApprove` contract.
- **Closure ships twice: a synchronous primitive (for Story 5.1) and a reconciliation sweep (for today).** The AC demands automatic closure, but the `Deals` module does not exist. The primitive is the correctness path (same transaction as completion, exactly-once by construction); the sweep is the safety net that makes the AC demonstrable now and repairs anything a future code path misses. Both are idempotent.
- **The sweep adds an 8th job to the canonical catalog — a deliberate, documented deviation.** `AD-7` lists 7 jobs, none of which can close backups. The alternative (no job at all) leaves AC "automatically closed" unfulfilled until Epic 5 lands. The new entry mirrors the existing shape exactly (`singletonKey`, schedule, handler map) and is 10-minute cadence, not per-minute, to keep it cheap.
- **The sweep is registered without a live DB client, exactly like its 7 siblings.** The worker has no Prisma dependency and no job in this repo is runtime-DB-wired; inventing a second data-access path inside the worker is a larger, riskier change than this story's scope. The logic is fully unit-tested through the injected client and is the only piece a later infra story must wire.
- **No buyer-facing queue position.** It would require a per-listing rank query inside `GET /offers/my`; the buyer only needs to know "held in reserve" vs "activated" vs "closed by the winning deal".
- **A dedicated `admin/backup-offers` prefix instead of routes under `admin/offers`.** `admin/offers/:id` already exists; a literal sibling (`backup-queue`) would depend on NestJS declaration order — a silent, easy-to-regress trap. The claim lease deliberately stays on the canonical `admin/offers/:id/{claim,heartbeat,release}` routes so `Offer` keeps exactly one lease implementation.
- **Notification stays `// TODO(8.8)`.** No `Notification` model, no transport, no queue is invented; the closure is made legible to the buyer through the status badge, the backup chips and the timeline instead.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 4.3`] acceptance criteria (approved backup offer on a `Reserved` listing; primary deal cancelled by buyer / by timeout / rejected ⇒ oldest approved backup surfaced to the administrator for immediate activation; primary deal completed ⇒ all remaining backup offers closed with buyer notification); `#Epic 4` scope; `#Story 4.1` (`IsBackup = true` on `Reserved`), `#Story 4.2` (`SelectedPendingFinalAdminApproval`, 7-day expiry), `#Story 5.1` (`SelectedPendingFinalAdminApproval` → `Deal`, "all competing/backup offers = `Closed`"), `#Story 8.8` (notification feed)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-27`] backup offers held in reserve, oldest approved surfaced on cancellation/timeout (see `OQ-04`), all active backup offers closed on completion; `#OQ-04` "**Oldest Approved Backup Offer first.** Admin reviews and confirms activation; backup offer does not convert automatically without review"; `#§3 Glossary#Backup Offer`; `#FR-25` (`IsBackup` flag, 1 active offer per buyer per listing); `#FR-32` completion sets `Listing = Sold` and closes competing/backup offers; `#FR-33` timeout ⇒ `Listing` reverts `Reserved` → `Active`; `#FR-34` buyer cancellation ⇒ same revert; `#FR-56` seller cancellation ⇒ same revert; `#BR-13` `Reserved` listings restrict actions to Backup Offers only; `#FR-18` Reserved badge
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2, AD-4, AD-7, AD-8, AD-10, AD-11, AD-12`] explicit action endpoints, `$queryRaw … FOR UPDATE` inside interactive transactions, audit-in-transaction + idempotent jobs, `ClockService`, `Offer` as one of the 8 claim-locked queues (claim = `POST`, 15-minute lease, 5-minute heartbeat, `Tasks.ForceUnlock`), `Offers.Review`; `#State Machine Transition Tables#3 Property Listing` (`Reserved → Sold` on completion, `Reserved → Active` on cancel/timeout) and `#1 Deal State Machine`; `#Consistency Conventions`; `#Canonical Background Job Catalog`; `#Data Architecture#3 Distributed Admin Task Claim & Locking`
- [Source: `_bmad-output/implementation-artifacts/4-2-mediated-counter-offer-rounds-seller-responses.md`] previous-story intelligence: `AWAITING_MEDIATION_STATUSES` as the mediation-queue filter, `applyDecision`/`buildLockInfo`/`assertLockHeld` shapes, `::text` row-lock regression, additive-`db push` discipline, stale-`dist` pitfall, exhaustive `Record` maps (`OFFER_STATUS_LABELS_AR`, `OFFER_STATUS_VARIANTS`, `OFFER_HISTORY_ACTION_LABELS_AR`), the `// TODO(5.1)` / `// TODO(8.8)` marker convention, the worker DB-less factory precedent, and the Arabic-corruption-at-write-time lesson
- [Source: `_bmad-output/implementation-artifacts/4-1-offer-submission-price-guardrail-validation.md`] `isBackup` intake semantics, `ACTIVE_OFFER_STATUSES`/`TERMINAL_OFFER_STATUSES` invariant test, `OFFER_EXPIRY_HOURS = 168`, additive schema discipline
- Code: `apps/api/prisma/schema.prisma#L57–L71,L357–L412,L521–L566,L569–L595,L883–L897`; `apps/api/src/modules/offers/{offers.service.ts#L140–L220,L653–L680, admin-offers.service.ts, admin-offers.controller.ts, offer-thread.mapper.ts, offers.module.ts}`; `apps/api/src/modules/listings/{listings.service.ts#L1420–L1475, admin-listings.service.ts#L1120–L1135,L1245–L1265}`; `apps/api/src/modules/proposals/admin-proposals.controller.ts`; `apps/api/src/modules/auth/guards/{admin-session-auth.guard.ts, admin-permission.guard.ts}`; `apps/api/src/common/{clock/clock.service.ts, pipes/zod-validation.pipe.ts, filters/http-exception.filter.ts}`; `apps/worker/src/jobs/{offer-expiry-checker.job.ts, demand-expiry-checker.job.ts, index.ts, job-wrapper.ts}`; `apps/worker/src/jobs/__tests__/offer-expiry.spec.ts`; `packages/shared/src/{enums/index.ts#L57–L71, constants/offer.ts#L40–L163, constants/jobs.ts, constants/auth.ts, schemas/offer.schema.ts#L100–L140, types/offer.ts, types/index.ts}`; `apps/web/src/components/{offers/*, admin/offer-mediation-queue.tsx, admin/offer-mediation-workspace.tsx, layout/workspace-shell.tsx#L112–L116, ui/index.ts}`; `apps/web/src/lib/api-client.ts#L147,L162`; `packages/shared/src/types/jobs.ts#L1–L9`

## Dev Agent Record

### Agent Model Used

Qoder (agentic IDE), implementing via the `bmad-dev-story` workflow with red-green-refactor per task.

### Debug Log References

1. **`packages/shared` — `constants/__tests__/jobs.spec.ts` red after the 8th job was cataloged.** `BACKGROUND_JOB_DEFINITIONS` grew to 9 entries, so the assertions pinned at 8 failed (348 passed / 1 failed). Fixed by adding `JOB_BACKUP_OFFER_RECONCILIATION` to the imports, the expected list, the string-constant test and both titles, plus a cadence assertion (`'*/10 * * * *'`). 349 passing.
2. **`apps/worker` — 2 red specs after the new handler registration.** `jobs.spec.ts` hardcoded 8 handlers and `scheduler.spec.ts` hardcoded 8 `boss.schedule` / `boss.work` calls; both raised to 9 with the new job name added to their expected arrays. 71 passing across 9 files.
3. **`apps/api` — suite failed to *run* with TS2322 at `backup-offers.service.ts:225`.** The `$transaction` callback's inferred return type widened the `'SURFACED'` / `'QUEUED'` literal to `string`, so `queueState: string` was not assignable to `BackupOfferQueueState`. Fixed by annotating the callback: `async (tx: any): Promise<BackupOfferQueueItem> =>`. This was a genuine service-level bug the new spec surfaced, not a test-side workaround; `tsc --noEmit` in `apps/api` is now clean.
4. **`apps/web` — no SSR harness for a data-fetching queue component.** `BackupOfferQueue` fetched in `useEffect`, so `renderToString` only ever produced the loading card. Adopted the existing `ListingModerationQueue` seam (`initialItems` / `initialTotal`) as `initialGroups` / `initialTotal` with an early `return` in the fetch effect, rather than inventing a second testing approach.
5. **Prisma client path.** `apps/api/node_modules/.prisma/client/index.d.ts` does not exist in this workspace — the generated client is hoisted to the repo root (`node_modules/.prisma/client/index.d.ts`). Verified there: 1 × `CLOSED_BACKUP`, 46 × `activatedAt`.
6. **Pre-existing lint/`tsc` baselines confirmed unchanged.** `npm run lint --workspace=apps/api` reports 30 errors across 13 files (listings / users / geo modules) — all pre-existing; a scoped `npx eslint` on the 9 changed offers files produces zero output. `apps/web` `tsc --noEmit` emits exactly the 7 baseline files recorded in 4.2's Debug Log (including the pre-existing `setSessionUser` gap in the `AuthContextType` test stub); `npx eslint` on the 8 changed web files is clean.
7. **`prisma validate`** → “The schema at prisma\schema.prisma is valid 🚀”.

### Completion Notes List

- **Queue membership & ordering (AC 1, 2).** `QUEUED_BACKUP_WHERE = { isBackup: true, status: SELECTED_PENDING_FINAL_ADMIN_APPROVAL, activatedAt: null }`. `getBackupQueue` selects distinct listing roots, loads the listings, sorts groups by `SURFACED → QUEUED → FROZEN → CLOSABLE` (then earliest queued `createdAt`), assigns 1-based `queuePosition` per listing (`createdAt ASC, id ASC`), and resolves every holder’s display name in a single `adminUser.findMany`. `meta.total` counts listings; pagination uses `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`.
- **`queueState` is a pure function of `Listing.status` (AC 2).** `Active ⇒ SURFACED`, `Reserved ⇒ QUEUED`, `Sold ⇒ CLOSABLE`, every other `ListingStatus ⇒ FROZEN`. No `Deal` row is read anywhere in the module, so Story 5.1’s `DealStatus` work cannot break this story.
- **Activation (AC 3, 4).** One `$transaction`: `FOR UPDATE` on the offer, then on the listing (both `::text` casts — never `::uuid`), re-validate the caller’s lease, assert at most one activated candidate per listing, then `update { activatedAt, version: { increment: 1 }, lockedByAdminId/lockedAt/lockExpiresAt: null }` + `OfferHistory(OFFER_BACKUP_ACTIVATED)` + `AuditLog(actorType: 'ADMIN')`. `status`, `expiresAt` and `offerPrice` are deliberately **not** touched and **no** `Deal` is created. Every refusal is an explicit 409 (`OFFER_BACKUP_NOT_QUEUED`, `OFFER_BACKUP_ALREADY_ACTIVATED`, `OFFER_BACKUP_PRIMARY_DEAL_ACTIVE`, `OFFER_BACKUP_LISTING_UNAVAILABLE`) or the reused `OFFER_LOCK_*` / `OFFER_NOT_FOUND`.
- **Claim legality split (AC 5).** `AWAITING_MEDIATION_STATUSES` remains the mediation-queue filter untouched; `CLAIMABLE_OFFER_STATUSES = [...AWAITING_MEDIATION_STATUSES, SELECTED_PENDING_FINAL_ADMIN_APPROVAL]` is the new claim-legality set. Encoded as a regression test asserting `where.status.in` for `getQueue` is exactly `[PENDING_ADMIN_REVIEW, COUNTER_OFFERED]` and never contains the hand-off state, so the two sets cannot silently converge later. Heartbeat / release / force-unlock unchanged.
- **`offer-lock.ts` extraction.** `assertLockHeld`, `buildLockInfo` and the lease guards moved out of `admin-offers.service.ts` into a shared module so both the mediation service and the backup service use exactly one lease implementation (the `Offer` queue keeps one AD-10 code path).
- **Closure primitive (AC 7).** `closeRemainingBackupOffersForListing(listingId, meta, tx?)` uses `tx ?? this.prisma` and never opens its own `$transaction`, so Story 5.1 can call it inside the completion transaction. It skips `activatedAt != null`, writes one history row (`OFFER_BACKUP_CLOSED`, `SYSTEM` or acting admin) and one audit row per offer, increments `version`, and is idempotent — verified by a dedicated second-run test. `OffersModule` exports the service.
- **Sweep (AC 8).** `backup-offer-reconciliation` runs every 10 minutes via `BACKGROUND_JOB_DEFINITIONS`, `jobHandlersMap` and the `JobName` union; DB-less factory `createBackupOfferReconciliationLogic(db?)` selects `isBackup + SELECTED_PENDING_FINAL_ADMIN_APPROVAL + activatedAt: null + listing.status = SOLD`. Fully unit-tested through the injected client (9 tests, including idempotency and the wrapper/handler-map registration).
- **State-set integrity (AC 9, 11).** 14 members = 9 active + 5 terminal; the 4.1 disjointness/coverage invariant is extended rather than replaced and passes at 14. `CLOSED_BACKUP` is in `TERMINAL_OFFER_STATUSES` only — `ACTIVE_OFFER_STATUSES` and `EXPIRABLE_OFFER_STATUSES` are untouched, with the “held in reserve, not awaiting a reply” rationale added to the `EXPIRABLE_OFFER_STATUSES` doc comment. All three exhaustive `Record` maps extended (`OFFER_STATUS_LABELS_AR`, `OFFER_STATUS_VARIANTS`, `OFFER_HISTORY_ACTION_LABELS_AR`).
- **One structural deviation, documented in the Decision log:** `BackupOfferQueueState` is declared canonically in `packages/shared/src/constants/offer.ts`, derived from the frozen `BACKUP_QUEUE_STATES` tuple so the label/order `Record`s can key off it, and **type-imported** into `types/offer.ts` rather than re-declared. The public export surface is identical; the alternative would have been a duplicate declaration with a circular-import smell.
- **UI legibility in lieu of notifications (AC 10).** Buyer/seller lists render «عرض احتياطي» and «عرض احتياطي مُفعَّل»; `OfferStatusBadge` renders CLOSED_BACKUP; the timeline renders both new history actions. `// TODO(8.8)` markers left at the dispatch points. No `Notification` model, mailer or queue invented.
- **Test totals after implementation:** shared 349 (30 files), api 623 (54 suites), worker 71 (9 files), web 273 (47 files) — all green, no regressions.
- Arabic literals were re-verified against the rebuilt `packages/shared/dist` (14 status labels, 4 queue-state labels, 2 history labels, 4 error codes, job name, order map) to rule out write-time mojibake.

### File List

**New**
- `apps/api/src/modules/offers/offer-lock.ts`
- `apps/api/src/modules/offers/backup-offers.service.ts`
- `apps/api/src/modules/offers/admin-backup-offers.controller.ts`
- `apps/api/src/modules/offers/__tests__/backup-offers.spec.ts`
- `apps/worker/src/jobs/backup-offer-reconciliation.job.ts`
- `apps/worker/src/jobs/__tests__/backup-offer-reconciliation.spec.ts`
- `apps/web/src/components/admin/backup-offer-queue.tsx`
- `apps/web/src/components/admin/__tests__/backup-offer-queue.spec.tsx`
- `apps/web/src/app/admin/backup-offers/page.tsx`
- `_bmad-output/implementation-artifacts/4-3-backup-offer-queue-pipeline.md`

**Modified**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/offers/offers.service.ts`
- `apps/api/src/modules/offers/admin-offers.service.ts`
- `apps/api/src/modules/offers/offer-thread.mapper.ts`
- `apps/api/src/modules/offers/offers.module.ts`
- `apps/api/src/modules/offers/__tests__/admin-offers.spec.ts`
- `apps/worker/src/jobs/index.ts`
- `apps/worker/src/jobs/__tests__/jobs.spec.ts`
- `apps/worker/src/__tests__/scheduler.spec.ts`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/offer.ts`
- `packages/shared/src/constants/jobs.ts`
- `packages/shared/src/constants/__tests__/offer.spec.ts`
- `packages/shared/src/constants/__tests__/jobs.spec.ts`
- `packages/shared/src/schemas/offer.schema.ts`
- `packages/shared/src/schemas/__tests__/offer.spec.ts`
- `packages/shared/src/types/offer.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/types/jobs.ts`
- `apps/web/src/components/offers/offer-status-badge.tsx`
- `apps/web/src/components/offers/buyer-offers-list.tsx`
- `apps/web/src/components/offers/seller-offers-list.tsx`
- `apps/web/src/components/offers/__tests__/offers.spec.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Generated (not hand-edited)**
- `apps/web/tsconfig.tsbuildinfo` — build artifact rewritten by `tsc --noEmit`; safe to discard.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-11-06 | 1.0 | Story created: backup offer queue read surface with derived queue state, claim-locked admin activation, `CLOSED_BACKUP` terminal status, `closeRemainingBackupOffersForListing` hand-off primitive for Story 5.1, and the `backup-offer-reconciliation` sweep. | Story context engine |
| 2026-11-06 | 1.1 | Implemented: `Offer.activatedAt` + `CLOSED_BACKUP` (14-member enum), shared contracts (states/labels/errors/schema/types/job catalog), `offer-lock.ts` extraction + `backup-offers.service.ts`, `admin-backup-offers.controller.ts`, claim-legality split, `backup-offer-reconciliation` job, web admin backup queue + buyer/seller/status/timeline chips, and 4 new spec files (shared 349, api 623, worker 71, web 273 all green). | Qoder (bmad-dev-story) |
| 2026-11-06 | 1.2 | Story marked done in sprint tracking. | Mostafa |
