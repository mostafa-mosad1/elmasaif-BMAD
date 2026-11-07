---
baseline_commit: a9e609f
---

# Story 5.3: Administrative Proof Review, Task Claim Locking & Grace Period Handling

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrator auditing submitted payment proofs,
I want to review the commission and the property-price transfer receipts independently under a
15-minute task claim lease,
so that each verification is audited thoroughly, no two admins collide on the same receipt, and the
buyer is protected by a 12-hour review grace period instead of an instant auto-cancellation.

## Acceptance Criteria

1. **Payment queue is claimable, read never claims.** `GET /api/v1/admin/payments` returns the
   proof-audit queue — every `Payment` whose `status` is `PROOF_UPLOADED` or `UNDER_REVIEW`,
   oldest-first, paginated `{ items, meta: { total, page, limit, totalPages } }` — each row carrying
   the live `ClaimLockInfo` projection (`isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminName`,
   `remainingSeconds`) and its parent deal summary. Guarded by `AdminSessionAuthGuard` +
   `AdminPermissionGuard` + `@RequireAdminPermission('Payments.Review')`. Reads NEVER take the lease
   (AD-10: claiming is an explicit POST). `GET /api/v1/admin/payments/:id` returns one payment slot
   with the same lock projection. An unknown id → `404 PAYMENT_NOT_FOUND`.
2. **Per-payment 15-minute claim lease.** `POST /api/v1/admin/payments/:id/claim` locks **one**
   `Payment` row (never the deal, never "PaymentProof") for 15 minutes by writing
   `lockedByAdminId`, `lockedAt`, `lockExpiresAt` via an atomic conditional `updateMany`
   (`lockedByAdminId IS NULL OR lockExpiresAt < now OR lockedByAdminId = me`), so two racing admins
   cannot both win. Claiming `PROOF_UPLOADED` also advances that payment to `UNDER_REVIEW`. Claiming
   a row already held by another admin returns `409 PAYMENT_LOCK_CONFLICT` with the holder in the
   body; claiming a terminal/undecidable payment (`PENDING`, `CONFIRMED`, `EXPIRED`) returns
   `409 PAYMENT_NOT_CLAIMABLE`. A successful claim writes one `AuditLog` row
   (`PAYMENT_PROOF_CLAIMED`).
3. **Independent Confirmed / Rejected decisions.** While holding the lease, the admin decides
   Payment 1 (`PLATFORM_COMMISSION`) and Payment 2 (`SELLER_PURCHASE_PRICE`) **separately**:
   - `POST /api/v1/admin/payments/:id/confirm` → `status = CONFIRMED`, sets `verifiedByAdminId`,
     `verifiedAt = ClockService.now()`, clears `rejectionReason`, releases the lease
     (`lockedByAdminId: null`), writes `AuditLog` (`PAYMENT_PROOF_CONFIRMED`).
   - `POST /api/v1/admin/payments/:id/reject` with a mandatory `reason` → `status = REJECTED`, sets
     `verifiedByAdminId`, `verifiedAt`, `rejectionReason`, releases the lease, writes `AuditLog`
     (`PAYMENT_PROOF_REJECTED`). An empty/whitespace `< 5`-char reason → `400
     PAYMENT_REJECTION_NOTE_REQUIRED` (mirrors `OFFER_REJECTION_NOTE_REQUIRED`).
   - Every decision re-asserts the lease **inside** the transaction (`assertClaimLockHeld`): a
     decision on a lock that expired mid-review → `409 PAYMENT_LOCK_EXPIRED`; a decision by a
     non-holder → `409 PAYMENT_LOCK_CONFLICT`; a decision with nothing claimed → `409
     PAYMENT_LOCK_REQUIRED`. A commit therefore releases the lease, so a client must issue a fresh
     claim before each successive mutating action on the same payment.
4. **Deal follows the payment states (5.3 never completes the deal).** On a `REJECT` the parent
   `Deal` moves to `PAYMENT_REJECTED` (buyer re-upload in 5.2 re-enters `UNDER_ADMIN_AUDIT`); on a
   `CONFIRM` the deal stays `UNDER_ADMIN_AUDIT` while any payment is still undecided. **Completion,
   contact release, `InvoiceRecord`, rating unlock are Story 5.4**; this story MUST NOT write
   `Deal.status = COMPLETED`, must not touch `Listing.status`, and must not read or mutate backup
   offers. `UNDER_ADMIN_AUDIT` and `PAYMENT_REJECTED` both remain inside `ACTIVE_DEAL_STATUSES`, so
   the `deal_single_active_listing` partial index keeps guarding the listing.
5. **12-hour review grace period pauses auto-cancel.** The grace semantics live in state, not in a
   cron here: an on-time proof sits in `PROOF_UPLOADED`/`UNDER_REVIEW`, and a rejection at or after
   `Deal.paymentDeadline` grants exactly one correction window of
   `DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS` (12 h, already in `packages/shared/src/constants/index.ts`)
   measured from `verifiedAt`. Expose `correctionWindowExpiresAt` (= rejection `verifiedAt` + 12 h,
   else `null`) on the admin view so the reviewer sees the SLA boundary. **The timeout cron and every
   `→ EXPIRED` transition belong to Story 5.5** — this story writes no expiry, no cancellation, and
   dispatches no `payment.sla_*` alert (notifications are 8.8).
6. **Separation of duties (FR-51).** The administrator who verifies a payment proof CANNOT be the one
   who executed final deal approval on that same transaction: a `confirm`/`reject` where
   `admin.id === deal.approvedByAdminId` → `403 PAYMENT_SELF_APPROVAL_FORBIDDEN`. The permission set
   already supports the split (`Payments.Review` is held by MODERATOR and FINANCIAL_AUDITOR;
   `Deals.FinalApprove` only by SUPER_ADMIN).
7. **Heartbeat, release, force-unlock reuse the canonical lease.** `POST /api/v1/admin/payments/:id/heartbeat`
   extends the caller's own lease by 15 minutes (renews the `lockExpiresAt` only);
   `POST /api/v1/admin/payments/:id/release` hands the lease back with no decision (keeps the payment
   status, clears the lock, writes `AuditLog` `PAYMENT_MODERATION_RELEASED`);
   `POST /api/v1/admin/payments/:id/force-unlock` — guarded by `@RequireAdminPermission('Tasks.ForceUnlock')`
   — breaks ANY holder's lease with a mandatory ≥ 5-char reason (`400
   PAYMENT_FORCE_UNLOCK_REASON_REQUIRED`) and an audited `PAYMENT_LOCK_FORCE_UNLOCKED` row. All four
   run through the shared `common/locks/claim-lock.ts` helpers, byte-identical in semantics to the
   offer/inquiry queues.
8. **Read-only inspection banner for other admins.** A payment actively locked by another admin
   renders read-only with the holder's name and remaining time; the decision controls are disabled.
   The projection comes from the same `buildClaimLockInfo` (expired leases read as unlocked, lazy
   expiry). The lease countdown and `readLockHolderName` reuse the offer-mediation-workspace pattern.
9. **Proof preview through the verified-download gate.** The admin view returns a
   `proofFileObjectId` (`Payment.proofFileUrl` is a `FileObject.id`, not a URL) and a
   `GET /api/v1/admin/payments/:id/proof-url` endpoint hands back
   `{ downloadUrl, expiresInSeconds: 300 }` via `StorageService.getVerifiedDownloadUrl`, gated on
   `ScanStatus.CLEAN`. Catch the storage layer's plain-string exceptions and rethrow with
   `{ code: ERROR_FILE_QUARANTINED }` / `PAYMENT_PROOF_NOT_FOUND` so `ApiError.code` survives the
   filter. A presigned URL is never persisted.
10. **Shared contracts + exhaustive maps.** Every admin-facing code, the lease/heartbeat durations,
    the queue-status set and the decision schemas live in `packages/shared`. Arabic labels already
    cover `UNDER_REVIEW`/`CONFIRMED`/`REJECTED` (`DEAL_PAYMENT_STATUS_LABELS_AR`); add only the new
    codes/helpers. No new `DealStatus`, no new `PaymentType`, no `Payment.status → enum` conversion.
11. **Additive schema only (ideally none).** `Payment` already carries `lockedByAdminId`, `lockedAt`,
    `lockExpiresAt`, `verifiedByAdminId`, `verifiedAt`, `rejectionReason` and
    `@@index([lockExpiresAt])`. Add NO column unless a hard requirement forces it; if the schema is
    touched, sync ONLY with `npm run prisma:push` (which re-applies `prisma/sql/deal-invariants.sql`)
    and restart the API so the regenerated client loads.
12. **No existing suite regresses.** New coverage in `packages/shared` (lock codes, grace helper,
    decision schema), `apps/api` (`AdminPaymentsService` happy path + every 4xx + separation-of-duties
    + lease-release-on-commit), the admin payments controller, and web pure helpers + SSR render
    assertions. Baselines after 5.2: shared **460**, api **768**, worker **71**, web **364** — any
    drop is a regression.

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts** (AC: 1, 2, 3, 5, 6, 10)
  - [x] 1.1 `packages/shared/src/constants/deal.ts`: add the admin-facing codes
        `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_CLAIMABLE`, `PAYMENT_LOCK_REQUIRED`,
        `PAYMENT_LOCK_CONFLICT`, `PAYMENT_LOCK_EXPIRED`, `PAYMENT_FORCE_UNLOCK_REASON_REQUIRED`,
        `PAYMENT_REJECTION_NOTE_REQUIRED`, `PAYMENT_SELF_APPROVAL_FORBIDDEN`,
        `PAYMENT_PROOF_NOT_FOUND` (reuse `ERROR_FILE_QUARANTINED` from `constants/storage.ts`),
        following the exact `OFFER_LOCK_*` / `OFFER_NOT_FOUND` naming; add
        `PAYMENT_LOCK_DURATION_MS = 15 * 60 * 1000`, `PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000`
        (parity with `OFFER_LOCK_DURATION_MS` / `LISTING_LOCK_*` / `INQUIRY_LOCK_*`), the
        claimable/decidable status sets `PAYMENT_CLAIMABLE_STATUSES = [PROOF_UPLOADED, UNDER_REVIEW]`
        and `PAYMENT_DECIDABLE_STATUSES = [UNDER_REVIEW]` (only a claimed row can be decided), and the
        audit action strings `PAYMENT_PROOF_CLAIMED` / `PAYMENT_PROOF_CONFIRMED` /
        `PAYMENT_PROOF_REJECTED` / `PAYMENT_MODERATION_RELEASED` / `PAYMENT_LOCK_FORCE_UNLOCKED`. Do
        **not** alter `DEAL_PAYMENT_STATUS`, `UPLOADABLE_PAYMENT_STATUSES`, `ACTIVE_DEAL_STATUSES`, or
        the Arabic label maps (they already cover the review states).
  - [x] 1.2 `packages/shared/src/deal/payment.ts`: add the pure
        `computeCorrectionWindowExpiresAt(payment, graceHours): string | null` — returns the ISO
        instant `verifiedAt + graceHours` **only** when `status === REJECTED` and the rejection landed
        at/after the deal deadline, else `null` (clock-injected, no `Date.now()`); re-export from
        `deal/index.ts`.
  - [x] 1.3 `packages/shared/src/types/deal.ts`: add `AdminPaymentQueueItem` (`id`, `dealId`,
        `dealNumber`, `propertyTitle`, `paymentType`, `amount`, `status`, `uploadedAt`,
        `bankReferenceCode`, `senderBankName`, `rejectionReason`, `proofFileObjectId`,
        `correctionWindowExpiresAt`, `lockInfo: ClaimLockInfo`), `AdminPaymentDetail` (queue item +
        deal `status`/`paymentDeadline`/`approvedByAdminId` + `verifiedBy*`/`verifiedAt` + `serverNow`)
        and reuse `ClaimLockInfo` (imported from `types/locks.ts`) — never redeclare it.
  - [x] 1.4 `packages/shared/src/schemas/deal.schema.ts`: add `adminRejectPaymentSchema`
        (`reason` trimmed, 5–500, Arabic message) and `paymentQueueQuerySchema` (`page`, `limit`,
        optional `status`). Add `paymentIdParamSchema` (uuid) if not already present via 5.2.
  - [x] 1.5 Tests: `constants/__tests__/deal.spec.ts` asserts the lock/heartbeat durations match the
        other queues, `PAYMENT_CLAIMABLE_STATUSES ∩ UPLOADABLE... ` intent, and every admin code is
        exported; `deal/__tests__/payment.spec.ts` pins `computeCorrectionWindowExpiresAt`
        (before-deadline rejection → null, at/after-deadline rejection → +12 h, non-rejected → null).

- [x] **Task 2 — `payment-lock.ts` adapter (reuse, do not reimplement)** (AC: 2, 3, 7, 8)
  - [x] 2.1 New `apps/api/src/modules/deals/payment-lock.ts`, an exact structural mirror of
        `apps/api/src/modules/offers/offer-lock.ts`: a `PAYMENT_LOCK_CODES: ClaimLockCodes` with the
        three `{ code, message }` entries pointing at `PAYMENT_LOCK_REQUIRED` / `_CONFLICT` /
        `_EXPIRED` and Arabic messages, plus `buildLockInfo`, `assertLockHeld`,
        `resolveLockHolderNames`, and `paymentNotFound()`. It calls ONLY
        `common/locks/claim-lock.ts` (`buildClaimLockInfo`, `assertClaimLockHeld`,
        `resolveClaimLockHolderNames`). Add NO new lock logic.

- [x] **Task 3 — `AdminPaymentsService`** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] 3.1 New `apps/api/src/modules/deals/admin-payments.service.ts` (`@Injectable()`, deps
        `PrismaService` + `ClockService` + `StorageService`) with `getQueue`, `getPayment`,
        `claimPayment`, `heartbeatPayment`, `releasePayment`, `forceUnlockPayment`, `confirmPayment`,
        `rejectPayment`, `getProofDownloadUrl`. Copy the atomic conditional-claim shape from
        `admin-offers.service.ts` `claimOffer` (`updateMany` with the `OR` unlocked/expired/mine
        guard, then re-read) and the `assertLockHeld` re-validation from `heartbeatOffer` /
        `releaseOffer`.
  - [x] 3.2 Row-lock discipline: `deals.id` / `payments.id` are **`text`** — every `FOR UPDATE`
        `tx.$queryRaw` casts `${id}::text`, never `::uuid`. The `confirm`/`reject` transaction locks
        the payment row, re-reads the deal, asserts the lease and the separation-of-duties check,
        writes the payment + deal status + `AuditLog` in ONE transaction. Never nest `$transaction`;
        every helper takes the caller's `tx`.
  - [x] 3.3 `confirmPayment`: guard `admin.id !== deal.approvedByAdminId`
        (`PAYMENT_SELF_APPROVAL_FORBIDDEN`), status must be `UNDER_REVIEW` and held, write
        `CONFIRMED`, release lease, keep `Deal.status = UNDER_ADMIN_AUDIT`.
  - [x] 3.4 `rejectPayment`: same guards, write `REJECTED` + `rejectionReason`, release lease, set
        `Deal.status = PAYMENT_REJECTED` (only if currently `UNDER_ADMIN_AUDIT`).
  - [x] 3.5 `getQueue` / `getPayment` map through a new `toAdminPayment*` in Task 3.7 and resolve
        holder names in ONE query via `resolveLockHolderNames` (never N+1), projecting
        `correctionWindowExpiresAt` from Task 1.2.

- [x] **Task 4 — Admin payments mapper** (AC: 1, 5, 8, 9, 10)
  - [x] 4.1 New `apps/api/src/modules/deals/payment-review.mapper.ts`:
        `toAdminPaymentQueueItem(payment, deal, lockInfo, now)`,
        `toAdminPaymentDetail(payment, deal, lockInfo, adminNameMap, now)`. Money is a decimal
        **string** (`String(payment.amount)`, trap T-4 of 5.2); timestamps go through `toIso` from
        `modules/offers/offer-thread.mapper.ts`; expose `proofFileObjectId` (never the raw URL) and
        `correctionWindowExpiresAt`.

- [x] **Task 5 — Admin payments controller** (AC: 1, 2, 3, 7, 8, 9)
  - [x] 5.1 New `apps/api/src/modules/deals/admin-payments.controller.ts` —
        `@Controller('admin/payments')`, class-level `@UseGuards(AdminSessionAuthGuard,
        AdminPermissionGuard)`; `@RequireAdminPermission('Payments.Review')` on every route except
        `force-unlock` (`Tasks.ForceUnlock`). Response envelope `{ statusCode, message?, data }`
        exactly like `AdminOffersController`.
  - [x] 5.2 **Declaration order is load-bearing** (literal before parameterised): `GET` (queue),
        then `GET ':id'`, `GET ':id/proof-url'`, `POST ':id/claim'`, `POST ':id/heartbeat'`,
        `POST ':id/release'`, `POST ':id/confirm'`, `POST ':id/reject'` (`ZodValidationPipe` on
        `adminRejectPaymentSchema`), `POST ':id/force-unlock`. Arabic success messages
        (`'تم استلام مهمة التدقيق لمدة 15 دقيقة'`, `'تم تأكيد إثبات الدفع'`,
        `'تم رفض إثبات الدفع وتسجيل السبب'`, …) mirroring the offers controller copy.
  - [x] 5.3 Read the actor from `req.admin` (`id`, `fullName`) exactly like `AdminOffersController`.
  - [x] 5.4 Tests `apps/api/src/modules/deals/__tests__/admin-payments.service.spec.ts` and
        `admin-payments.controller.spec.ts` using the fake-`prisma` / fake-`tx` style of
        `buyer-deals.service.spec.ts` and `deals.service.spec.ts`.

- [x] **Task 6 — Module wiring** (AC: 1, 9)
  - [x] 6.1 `DealsModule`: register `AdminPaymentsController` + `AdminPaymentsService` +
        `AdminSessionAuthGuard` + `AdminPermissionGuard`; `StorageModule` is already imported. Do
        **NOT** create a `modules/payments/` (D7 of 5.2 stands — the review is the same deal state
        machine). No new module import cycle.

- [x] **Task 7 — Admin payment review UI** (AC: 1, 2, 3, 5, 8)
  - [x] 7.1 New `apps/web/src/components/admin/payment-review-queue.tsx` (list, claimable rows,
        `formatLockCountdown`, holder name) and `payment-review-workspace.tsx` (one payment slot:
        proof preview, Confirmed / Rejected controls, mandatory rejection-notes textarea, 12-hour
        grace / SLA banner, read-only inspection banner + 4-minute heartbeat when `isMine`), reusing
        the workspace pattern in `offer-mediation-workspace.tsx` verbatim (`isMine` / `isOther`,
        `window.setInterval` heartbeat, `readLockHolderName`, `describeApiError`).
  - [x] 7.2 New thin pages `apps/web/src/app/admin/payments/page.tsx` (queue) and
        `.../payments/[id]/page.tsx` (`params` is a `Promise`, like `negotiations/[id]/page.tsx`).
  - [x] 7.3 Register the admin nav entry (`الدفع والتسويات` → `/admin/payments`) in the admin sidebar
        / `app/admin/layout.tsx`, and export both components from the admin barrel if one exists.
  - [x] 7.4 Export the decision logic as pure helpers (`resolvePaymentReviewActions(payment, lockInfo)`,
        `buildGracePeriodNotice(payment, serverNow)`, `validateRejectionNote(reason)`) — web specs are
        SSR-only (`renderToString`, no jsdom), so interactive behaviour is asserted through helpers and
        presentation through markup.
  - [x] 7.5 Tests `apps/web/src/components/admin/__tests__/payment-review-queue.spec.tsx` and
        `payment-review-workspace.spec.tsx` (mock `apiClient` with `vi.mock`; import
        `{ describe, expect, it, vi } from 'vitest'` explicitly — apps/web has no `globals: true`).

- [x] **Task 8 — Seed two reviewable payments** (manual verification; AC: 2, 3, 5, 6)
  - [x] 8.1 `apps/api/prisma/seed.ts`: extend the 5.2 demo deal so BOTH payment slots exist with
        `status: 'PROOF_UPLOADED'` and a CLEAN `FileObject`-backed `proofFileUrl`, so the queue is
        non-empty without a live buyer upload. Keep every row `upsert` / `update: {}` idempotent; do
        not break the `deal_single_active_listing` index. Record `approvedByAdminId` as a Super Admin
        distinct from the demo MODERATOR/AUDITOR reviewer so separation-of-duties passes on the happy
        path and can be shown failing when the same admin tries both.

- [x] **Task 9 — Verify** (AC: 10, 11, 12)
  - [x] 9.1 `cd packages/shared && npx tsc` then rebuild shared (api/web tests resolve
        `packages/shared/dist`, not `src` — trap T-10 of 5.2).
  - [x] 9.2 `cd apps/api && npx tsc --noEmit` and `npx eslint "src/modules/deals/**/*.ts"`.
  - [x] 9.3 `cd packages/shared && npm test`; `cd apps/api && npm test`; `cd apps/worker && npm test`;
        `cd apps/web && npm test`. Report the four counts; worker stays 71 (no cron change here).
  - [x] 9.4 `cd apps/web && npm run build` (the pre-existing `.next/types/app/admin/geo/page.ts`
        failure recorded by 4.4/5.1/5.2 is not a regression).
  - [x] 9.5 Manual, in order: reseed → open `/admin/payments` as a demo admin → claim Payment 1
        (→ `UNDER_REVIEW`, lock holder row shows your name) → confirm in a second browser as a
        different admin and see the read-only «قيد التدقيق بواسطة …» banner + `PAYMENT_LOCK_CONFLICT`
        → back to the holder: reject Payment 2 with an empty note (→ `400
        PAYMENT_REJECTION_NOTE_REQUIRED`) then with a real note (→ `REJECTED`, deal
        `PAYMENT_REJECTED`, lease released, correction window = `verifiedAt + 12 h` rendered) → try
        `confirm` as the admin whose `id === deal.approvedByAdminId` (→ `403
        PAYMENT_SELF_APPROVAL_FORBIDDEN`) → force-unlock a held row as Super Admin with a reason →
        verify `AuditLog` rows for claim/confirm/reject/release/force-unlock.

## Dev Notes

### Scope boundaries

- **In scope:** the admin payment queue, per-payment claim/heartbeat/release/force-unlock on the
  `Payment` row, independent Confirmed/Rejected decisions with mandatory rejection notes, the
  deal-level `PAYMENT_REJECTED` signal, the read-only inspection banner, the 12-hour correction-window
  projection, proof preview through the verified-download gate, and the seed that makes the queue
  demonstrable.
- **Out of scope, explicitly:**
  - Atomic completion, contact release, `InvoiceRecord`, 1–5 rating unlock → **5.4**. Never write
    `Deal.status = COMPLETED` or touch `Listing`/backup offers here.
  - The `payment-deadline-expiry` cron and every `→ EXPIRED` / auto-cancel evaluation → **5.5**. This
    story only sets the state (`UNDER_REVIEW`/`CONFIRMED`/`REJECTED` + timestamps) that 5.5 reads; it
    schedules nothing and never cancels a deal.
  - Buyer/seller cancellation and dispute adjudication → **5.6**.
  - `payment.sla_alert_4h` / `sla_escalation_12h` / `sla_mandatory_decision_24h` alert dispatch and
    in-app/email notifications → **8.8**. The 4/12/24 h tiers are described here for context only; no
    alert is emitted by this story.
  - A `payments` NestJS module (D7 of 5.2), a `PlatformSettings` table (`PaymentCorrectionHours` /
    grace hours) → **8.6** — use the existing `DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS` constant.
  - Converting `Payment.status` `String → enum`, renaming `proofFileUrl`, or any destructive schema
    change (trap T-13 of 5.2).

### The claim lease is already built — reuse it exactly

- AD-10's single implementation lives in `apps/api/src/common/locks/claim-lock.ts`
  (`buildClaimLockInfo`, `assertClaimLockHeld`, `resolveClaimLockHolderNames`, typed by
  `ClaimLockCodes`). Story 4.4 extracted it precisely so a new queue "adds no lock logic" (memory:
  *Shared claim-lock core with per-entity lock adapters*). `payment-lock.ts` (Task 2) is the third
  thin adapter after `offer-lock.ts` and `inquiry-lock.ts`; copy the offer one's shape.
- `ClaimLockInfo` is declared once in `packages/shared/src/types/locks.ts` (`OfferLockInfo` is only an
  alias). Import `ClaimLockInfo` — never redeclare a lock payload type (memory: *Reuse existing shared
  projections instead of redeclaring payload types*).
- Lease lifecycle: a decision commit auto-releases the lease (`lockedByAdminId: null`), and every
  mutating transition re-asserts the caller still holds it, so the client must claim before each
  successive action. This is the behaviour `offer-mediation-workspace.tsx` already relies on.
- The 15-minute / 5-minute numbers are uniform across `LISTING_LOCK_*`, `OFFER_LOCK_*`,
  `INQUIRY_LOCK_*`; mirror them as `PAYMENT_LOCK_*`. The web heartbeat fires every ~4 minutes to keep
  a slack cadence inside the 5-minute advisory.

### Payment state machine (this story owns the audit arc)

```
PROOF_UPLOADED ──claim──▶ UNDER_REVIEW ──confirm──▶ CONFIRMED   (lease released on commit)
      ▲                        │
      │                        └──reject──▶ REJECTED ──(buyer re-upload, 5.2)──▶ UNDER_ADMIN_AUDIT deal
      └── (EXPIRED is 5.5's cron, never written here)
```

- `DEAL_PAYMENT_STATUS` already defines `UNDER_REVIEW`, `CONFIRMED`, `REJECTED`, `EXPIRED`
  (`packages/shared/src/constants/deal.ts` L92-99) and the Arabic labels + badge variants already
  cover them (L133-159). **Do not add status values.** Assert writes against `DEAL_PAYMENT_STATUS.*`,
  never a string literal (trap T-9 of 5.2 — the column is a `String`, nothing type-checks it).
- Deal-level effects: `REJECT` → `Deal.status = PAYMENT_REJECTED` (guarded to only transition from
  `UNDER_ADMIN_AUDIT`); `CONFIRM` leaves the deal at `UNDER_ADMIN_AUDIT`. Both remain
  non-terminal, so `deal_single_active_listing` still holds (trap T-7 of 5.2).
- Separation of duties (FR-51 / AD-10): the verifying admin ≠ `Deal.approvedByAdminId`. That column
  is written by 5.1's final-approve; read it back to enforce the split.

### Grace period vs SLA tiers — do not conflate them (AD-3 / FR-31)

- **Correction window (this story computes, 5.5 acts on it):** a proof rejected *before*
  `paymentDeadline` is re-uploadable until the deadline; a proof rejected *at/after* the deadline gets
  ONE `DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS` (12 h) window from `verifiedAt`. `computeCorrectionWindowExpiresAt`
  (Task 1.2) returns that instant or `null`; the UI renders it as the grace boundary. The `→ EXPIRED`
  transition when the window lapses is 5.5's cron, not a write here.
- **Review SLA tiers (context only, no code here):** 4 h internal alert, 12 h Super Admin escalation,
  24 h mandatory Confirm/Reject decision — none cancel the deal, and none are dispatched by this story
  (8.8 owns dispatch). The "12-hour review grace period SLA" in the AC is the on-time-upload protection
  (a deal with a payment in `UNDER_REVIEW` / inside its correction window is never auto-cancelled by
  5.5), which is guaranteed by the state this story writes.
- On-time-upload protection is already true in 5.2's write path (`PROOF_UPLOADED` before the
  deadline). This story keeps it by moving the row to `UNDER_REVIEW`, which 5.5's cron treats as
  protected.

### Current state (verified in this codebase)

- `apps/api/src/modules/deals/` today: `deals.module.ts`, `deals.service.ts`,
  `admin-deals.controller.ts`, `buyer-deals.controller.ts`, `buyer-deals.service.ts`,
  `platform-account.ts`, `deal-binding.mapper.ts`, `deal-payment.mapper.ts`, `dto/`, `__tests__/`
  (`admin-deals`, `buyer-deals.controller/service`, `deals.service`, `platform-account`). There is NO
  admin payments controller/service and no `payment-lock.ts`.
- `model Payment` (schema.prisma L716-745+) already carries `status String @default("PENDING")`,
  `proofFileUrl String?` (a `FileObject.id`), `bankReferenceCode`, `senderBankName`, `uploadedAt`,
  `verifiedByAdminId`, `verifiedAt`, `rejectionReason`, `lockedByAdminId`, `lockedAt`,
  `lockExpiresAt`, `@@unique([dealId, paymentType])` (added by 5.2), `@@index([dealId, paymentType,
  status])`, `@@index([lockExpiresAt])`. No schema change is expected (AC-11).
- `AdminDealsController` uses `@Controller('admin/deals')` + `AdminSessionAuthGuard` +
  `AdminPermissionGuard` + `@RequireAdminPermission(...)` — mirror that class/guard/decorator stack on
  the new `admin/payments` controller (a distinct prefix so the two admin surfaces coexist; memory:
  *Nest literal routes must precede parameterised ones*).
- `Payments.Review` and `Tasks.ForceUnlock` already exist in `ADMIN_ROLE_PERMISSIONS`
  (`packages/shared/src/constants/auth.ts`): `Payments.Review` ∈ SUPER_ADMIN, MODERATOR,
  FINANCIAL_AUDITOR; `Deals.FinalApprove` ∈ SUPER_ADMIN only; `Tasks.ForceUnlock` ∈ SUPER_ADMIN only.
- `StorageService.getVerifiedDownloadUrl(fileObjectId, 300)` gates on `ScanStatus.CLEAN` and throws
  plain-string exceptions the `HttpExceptionFilter` collapses to `FORBIDDEN` / `NOT_FOUND` (trap T-14
  of 5.2) — the service must catch and rethrow with `{ code }`.
- Web admin queue precedent: `apps/web/src/components/admin/offer-mediation-workspace.tsx`
  (heartbeat interval, `isMine`/`isOther`, inspection banner), `offer-mediation-queue.tsx`
  (`formatLockCountdown`), `lib/api-client.ts` (`readLockHolderName`, `describeApiError`,
  `ApiError.code`). Admin pages live under `apps/web/src/app/admin/...` with `params` as a `Promise`.

### Runtime and library versions (verified from the workspace, not the internet)

Nothing is installed by this story. `apps/api`: `@nestjs/common` 10, `@nestjs/swagger`,
`prisma`/`@prisma/client` 5.14, `jest` + `ts-jest`, `class-validator`/`class-transformer`.
`packages/shared`: plain TS → `dist`, Zod is the only validation lib. `apps/web`: Next 15 / React 19,
`vitest` SSR-only via `react-dom/server` `renderToString`, `lucide-react` icons, **no jsdom /
testing-library / msw / jest**. Money stays a decimal **string** on the wire; `ClockService` is the
only clock.

### API surface (this story)

| Method & path | Guard / permission | Success | Key refusals |
|---|---|---|---|
| `GET /api/v1/admin/payments` | `Payments.Review` | `200 { statusCode, data: { items, meta } }` | — |
| `GET /api/v1/admin/payments/:id` | `Payments.Review` | `200 { statusCode, data: AdminPaymentDetail }` | `404 PAYMENT_NOT_FOUND` |
| `GET /api/v1/admin/payments/:id/proof-url` | `Payments.Review` | `200 { statusCode, data: { downloadUrl, expiresInSeconds: 300 } }` | `404 PAYMENT_NOT_FOUND`, `404 PAYMENT_PROOF_NOT_FOUND`, `403 FILE_QUARANTINED` |
| `POST /api/v1/admin/payments/:id/claim` | `Payments.Review` | `200` (+ `UNDER_REVIEW` from `PROOF_UPLOADED`) | `404 PAYMENT_NOT_FOUND`, `409 PAYMENT_LOCK_CONFLICT`, `409 PAYMENT_NOT_CLAIMABLE` |
| `POST /api/v1/admin/payments/:id/heartbeat` | `Payments.Review` | `200` | `409 PAYMENT_LOCK_REQUIRED` / `_CONFLICT` / `_EXPIRED` |
| `POST /api/v1/admin/payments/:id/release` | `Payments.Review` | `200` | `409 PAYMENT_LOCK_*` |
| `POST /api/v1/admin/payments/:id/confirm` | `Payments.Review` | `200` (releases lease) | `409 PAYMENT_LOCK_*`, `403 PAYMENT_SELF_APPROVAL_FORBIDDEN` |
| `POST /api/v1/admin/payments/:id/reject` | `Payments.Review` | `200` (releases lease, deal `PAYMENT_REJECTED`) | `400 PAYMENT_REJECTION_NOTE_REQUIRED`, `409 PAYMENT_LOCK_*`, `403 PAYMENT_SELF_APPROVAL_FORBIDDEN` |
| `POST /api/v1/admin/payments/:id/force-unlock` | `Tasks.ForceUnlock` | `200` | `400 PAYMENT_FORCE_UNLOCK_REASON_REQUIRED` |

### Decision on the claim → status coupling

- **D1 — `claim` advances `PROOF_UPLOADED → UNDER_REVIEW`; `heartbeat`/`release` never change the
  status.** AD-10 locks the row the admin is deciding; `UNDER_REVIEW` is precisely the "an admin owns
  this decision right now" state 5.5 protects from auto-cancel. `release` deliberately keeps
  `UNDER_REVIEW` and only drops the lock (so 5.5 still protects the in-review payment); the payment
  reverts to `PROOF_UPLOADED` only on a fresh buyer re-upload in 5.2.
- **D2 — decision commit releases the lease (no `lockedByAdminId` carried over).** Mirrors 4.2 offers;
  the next action needs a fresh claim.
- **D3 — no new column.** The correction window derives from `verifiedAt + 12 h`; `EXPIRED` and the
  outcome matrix are 5.5's, and it can compute the same instant. Keeping the schema untouched avoids
  the `db push` / stale-client dance (AC-11, memory: *Fix stale Prisma client after db push on
  Windows*).
- **D4 — payments admin surface lives in the `deals` module under `admin/payments`.** Consistent with
  5.2's D7; the review mutates the same deal state machine, so a separate `payments` module would
  split one transaction across two modules.

### Critical implementation traps

- **T-1 `::text`, never `::uuid`.** `deals.id` / `payments.id` are `text`; a `::uuid` `FOR UPDATE`
  raises Postgres `42883` → a 500.
- **T-2 Never run bare `prisma db push`.** If the schema is touched at all, use `npm run prisma:push`
  (re-applies `prisma/sql/deal-invariants.sql`) and restart the API for the regenerated client.
- **T-3 No nested `$transaction`.** Every helper takes the caller's `tx`.
- **T-4 Money is a string; no recomputation.** `String(payment.amount)`; never recompute commission or
  reprice from settings (FR-29 frozen snapshots).
- **T-5 `Payment.status` is a `String`.** Assert against `DEAL_PAYMENT_STATUS`, never a literal.
- **T-6 Claim is a POST, never a GET / page view** (AD-10). Reading the queue must not lock.
- **T-7 Route order.** Literal segments (`GET` queue) precede `:id`; keep the two `:id/…` reads before
  the mutating `:id/…` writes for readability; a literal declared after `:id` is shadowed.
- **T-8 Exhaustive `Record` maps.** Adding a `PaymentType`/`DealStatus` member (not planned here) would
  break `DEAL_PAYMENT_STATUS_LABELS_AR` / `DEAL_STATUS_LABELS_AR` / `DEAL_PAYMENT_STATUS_VARIANTS`. Do
  not widen to `Record<string, …>`; do not add members in this story.
- **T-9 Do not complete the deal or cancel it.** 5.4 completes; 5.5 expires. Writing
  `COMPLETED`/`EXPIRED`/`CANCELLED` here is out of scope and breaks their ownership.
- **T-10 Stale `packages/shared/dist`.** Rebuild shared before running api/web suites.
- **T-11 Separation of duties is a hard gate, not a UI nicety.** Enforce
  `admin.id !== deal.approvedByAdminId` server-side on both `confirm` and `reject`.
- **T-12 Storage exceptions degrade `ApiError.code`.** Catch the plain-string
  `getVerifiedDownloadUrl` throws and rethrow with `{ code: ERROR_FILE_QUARANTINED }` /
  `PAYMENT_PROOF_NOT_FOUND` (trap T-14 of 5.2).
- **T-13 One holder-name query per page.** Use `resolveLockHolderNames`; never N+1 per row.
- **T-14 Web suite has no `globals`.** Import `{ describe, expect, it, vi } from 'vitest'` explicitly in
  every new spec (learned in 5.2's Debug Log).

### Reuse map (do not reinvent)

| Need | Use | Where |
|---|---|---|
| Claim lease core | `buildClaimLockInfo` / `assertClaimLockHeld` / `resolveClaimLockHolderNames` | `apps/api/src/common/locks/claim-lock.ts` |
| Adapter shape | `offer-lock.ts` (mirror it) | `apps/api/src/modules/offers/offer-lock.ts` |
| Atomic conditional claim | `claimOffer` `updateMany` guard | `apps/api/src/modules/offers/admin-offers.service.ts` L177-256 |
| Heartbeat / release / force-unlock | `heartbeatOffer` / `releaseOffer` / `forceUnlockOffer` | `admin-offers.service.ts` L258-360+ |
| Admin guard stack + envelope | `AdminOffersController` | `apps/api/src/modules/offers/admin-offers.controller.ts` |
| Lock projection type | `ClaimLockInfo` | `packages/shared/src/types/locks.ts` |
| Verified download | `StorageService.getVerifiedDownloadUrl(id, 300)` | `apps/api/src/modules/storage/storage.service.ts` L530-564 |
| ISO serialisation | `toIso` | `apps/api/src/modules/offers/offer-thread.mapper.ts` |
| Payment status vocabulary | `DEAL_PAYMENT_STATUS` + labels + variants | `packages/shared/src/constants/deal.ts` |
| Grace hours | `DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS` (12) | `packages/shared/src/constants/index.ts` |
| Lease durations | `OFFER_LOCK_DURATION_MS` / `LISTING_LOCK_*` / `INQUIRY_LOCK_*` | `packages/shared/src/constants/{offer,listing,inquiry}.ts` |
| Spec style (fake prisma/tx) | `buyer-deals.service.spec.ts` | `apps/api/src/modules/deals/__tests__/` |
| Web workspace / countdown / holder | `offer-mediation-workspace.tsx`, `formatLockCountdown`, `readLockHolderName` | `apps/web/src/components/admin/`, `apps/web/src/lib/api-client.ts` |

### Verification queries

```sql
-- Lock columns + queue index already present; confirm no drift after any schema sync.
SELECT "id", "dealId", "paymentType", "status", "lockedByAdminId", "lockExpiresAt",
       "verifiedByAdminId", "verifiedAt", "rejectionReason"
FROM "payments" WHERE "status" IN ('PROOF_UPLOADED','UNDER_REVIEW') ORDER BY "createdAt";

-- Deal-level effect after a reject.
SELECT "id", "status", "approvedByAdminId" FROM "deals" WHERE "id" = '<DEMO_DEAL_ID>';

-- 5.1 invariant still present after any push.
SELECT indexdef FROM pg_indexes WHERE indexname = 'deal_single_active_listing';
```

### Project Structure Notes

- API files stay flat in `apps/api/src/modules/deals/`: `payment-lock.ts`,
  `admin-payments.service.ts`, `admin-payments.controller.ts`, `payment-review.mapper.ts`,
  `__tests__/admin-payments.{service,controller}.spec.ts`. Do **not** create `modules/payments/`
  (D4/D7).
- Shared additions sit beside siblings: `constants/deal.ts`, `deal/payment.ts`, `types/deal.ts`,
  `schemas/deal.schema.ts`, all already barrel-exported.
- Web: `apps/web/src/components/admin/payment-review-{queue,workspace}.tsx` + `__tests__/`; pages
  `apps/web/src/app/admin/payments/page.tsx` and `.../payments/[id]/page.tsx`; one admin nav entry.
- No `apps/worker` change; no `docker-compose.yml` change; no new env keys.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 5.3 (L737-748)] — the acceptance criteria.
- [Source: `_bmad-output/planning-artifacts/epics.md`#Epic 5 (L210-215)] — FR28-FR36, FR54/56/68,
  NFR12, AR14, UX-DR4/5 coverage; epic objective names the 15-min claim lock and 12-hour SLA.
- [Source: `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`] — AD-10 (L179-198,
  claim lease, atomic conditional UPDATE, 8 queues incl. `Payment` audited individually, FR-51
  separation of duties), AD-3 (L98-115, deadline / correction window / SLA tiers / outcome matrix), AD-4
  (L117-127, interactive transaction + row locks), AD-8 (L165-172, explicit action endpoints), AD-6/NFR-13
  (L141-149, quarantine + verified download).
- [Source: `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md`] — L67 (`/admin/payments/:id`,
  `Payments.Review`, each payment claimed separately), L91 (locked read-only microcopy
  «قيد التدقيق بواسطة زميل آخر … العرض متاح للقراءة فقط»), §2 L106-121 (grace + SLA tiers).
- [Source: `_bmad-output/implementation-artifacts/5-2-dual-wire-transfer-interface-48-hour-countdown-banner.md`]
  — the Payment surface this story audits, traps T-1…T-14, D7 (no payments module), suite baselines.
- [Source: `_bmad-output/implementation-artifacts/5-1-deal-creation-state-machine-binding-financial-snapshot-freez.md`]
  — `approvedByAdminId`, frozen snapshots, `deal_single_active_listing`.
- [Source: `apps/api/prisma/schema.prisma`] — `Payment` (L716-745+), `Deal` (L671-714).
- [Source: `apps/api/src/common/locks/claim-lock.ts`] + `offer-lock.ts` + `admin-offers.service.ts` —
  the lease to reuse verbatim.

## Dev Agent Record

### Agent Model Used

Amelia (Senior Software Engineer / Full-Stack Developer Agent)

### Debug Log References

- Handled duplicate type export in `packages/shared/src/schemas/deal.schema.ts` (`AdminRejectPaymentBodyInput` already exported in `types/index.ts`).
- Updated controller unit test metadata key assertion to match `ADMIN_PERMISSION_METADATA_KEY`.
- Refined test state tracking in fake Prisma mock for `admin-payments.service.spec.ts` so `updateMany` updates `lockExpiresAt` on the simulated payment object.
- Aligned `apps/web` SSR assertion in `payment-review-workspace.spec.tsx` to match initial loading indicator.
- Removed unused imports and variables in `apps/api` deals module to maintain 0 ESLint errors.

### Completion Notes List

- Implemented full administrative payment proof review workflow:
  - 15-minute AD-10 task claim locking (`Payment` row lease) via `apps/api/src/modules/deals/payment-lock.ts` and `apps/api/src/common/locks/claim-lock.ts`.
  - Independent `CONFIRMED` / `REJECTED` decisions with mandatory 5-500 char rejection reason.
  - Strict separation of duties enforcing `403 PAYMENT_SELF_APPROVAL_FORBIDDEN` if `admin.id === deal.approvedByAdminId`.
  - Pure 12-hour grace period computation (`computeCorrectionWindowExpiresAt`) calculated as `verifiedAt + 12h` when rejection occurs at or after the deal deadline.
  - Verified proof download endpoint `GET /api/v1/admin/payments/:id/proof-url` gated on `ScanStatus.CLEAN` (300 s presigned URL).
  - Admin UI queue and workspace components with auto-heartbeat (4 min), read-only inspection banner for other admins, and force-unlock.
  - Database seeding updated to create two reviewable payment proofs with clean `FileObject` records.
  - Unit tests added across shared, api, and web packages. All test suites pass.

### File List

- `_bmad-output/implementation-artifacts/5-3-administrative-proof-review-task-claim-locking-grace-period.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/constants/__tests__/deal.spec.ts`
- `packages/shared/src/deal/payment.ts`
- `packages/shared/src/deal/__tests__/payment.spec.ts`
- `packages/shared/src/types/deal.ts`
- `packages/shared/src/schemas/deal.schema.ts`
- `apps/api/src/modules/deals/payment-lock.ts`
- `apps/api/src/modules/deals/payment-review.mapper.ts`
- `apps/api/src/modules/deals/admin-payments.service.ts`
- `apps/api/src/modules/deals/admin-payments.controller.ts`
- `apps/api/src/modules/deals/dto/admin-payment-review.dto.ts`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/api/src/modules/deals/__tests__/admin-payments.service.spec.ts`
- `apps/api/src/modules/deals/__tests__/admin-payments.controller.spec.ts`
- `apps/api/prisma/seed.ts`
- `apps/web/src/components/admin/payment-review-queue.tsx`
- `apps/web/src/components/admin/payment-review-workspace.tsx`
- `apps/web/src/components/admin/__tests__/payment-review-queue.spec.tsx`
- `apps/web/src/components/admin/__tests__/payment-review-workspace.spec.tsx`
- `apps/web/src/app/admin/payments/page.tsx`
- `apps/web/src/app/admin/payments/[id]/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`

## Change Log

| Date | Change |
| --- | --- |
| 11-07-2026 | Story created: admin payment-proof audit queue with per-payment 15-min AD-10 claim lease (reusing `common/locks/claim-lock.ts` via a new `payment-lock.ts` adapter), independent Confirm/Reject with mandatory rejection notes, deal-level `PAYMENT_REJECTED` signal, 12-hour correction-window projection (expiry owned by 5.5), FR-51 separation of duties, read-only inspection banner, verified proof preview. Status → ready-for-dev. |
