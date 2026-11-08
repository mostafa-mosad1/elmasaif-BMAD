---
baseline_commit: 55f73d0
---

# Story 5.5: Automated Payment Timeout Worker Job

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system background worker,
I want a recurring 60-second cron job evaluating deals past their payment deadline,
so that expired deals are cancelled automatically when buyers fail to provide transfer proofs on time, listings are reverted back to active market circulation, and parties are notified, while strictly protecting on-time uploads, active administrative reviews, and correction grace periods.

## Acceptance Criteria

1. **Automated 60-Second Background Worker Cron Sweep (FR-33, AD-7):**
   - Given the dedicated background worker process (`apps/worker`).
   - When the `payment-deadline-expiry` job triggers on its registered 60-second schedule (`* * * * *`).
   - Then it executes via `pg-boss` with singleton key `payment-deadline-expiry`, `retryLimit: 3`, `retryDelay: 10`, `retryBackoff: true`, `expireInMinutes: 2`.
   - And evaluates temporal deadlines using `workerClock.now()` (or injected `currentTime: Date`), never raw unmockable `new Date()`.
   - And logs telemetry: `[Job: payment-deadline-expiry] Started at {time}` and `[Job: payment-deadline-expiry] Completed in {ms}ms with outcome: {summary}`.

2. **Non-Terminal Candidate Query & Temporal Filtering (AD-4, AD-11, AR8):**
   - When the sweep runs, it queries all `Deal` records matching:
     - `status IN ('AWAITING_PAYMENT_PROOF', 'UNDER_ADMIN_AUDIT', 'PAYMENT_REJECTED')` (`ACTIVE_DEAL_STATUSES`).
     - `paymentDeadline <= currentTime`.
   - Completed (`COMPLETED`), already cancelled (`CANCELLED`), or terminated (`TERMINATED`) deals are strictly excluded from candidate selection.
   - If no candidate deals exist, the job completes immediately with `processedCount: 0`.

3. **Protection Gate 1: Formal Dispute Freeze (FR-36, UC-30):**
   - For each candidate deal, if `deal.disputes` contains any dispute with `status === 'OPEN'` (or non-terminal dispute):
     - The deal is completely immune to automated timeout cancellation.
     - Automated timeouts are frozen; the deal remains in its current state awaiting Super Admin dispute adjudication (`Deals.DisputeResolve`).
     - The worker logs: `Deal {dealId} has active dispute; timeout frozen.` and skips cancellation.

4. **Protection Gate 2: On-Time Proof Upload & Active Review (FR-31, FR-33, UX-DR5):**
   - If ANY payment record on the candidate deal has:
     - `status === 'PROOF_UPLOADED'` (proof uploaded on time, awaiting claim/audit), OR
     - `status === 'UNDER_REVIEW'` (currently claimed by admin under 15-minute lease):
   - Then the Deal MUST NOT be cancelled. On-time proof upload pauses automated cancellation.
   - The un-uploaded payment (if any) remains pending/awaiting review; the overall deal remains protected until administrative review completes.

5. **Protection Gate 3: 12-Hour Post-Deadline Correction Window / Grace Period (FR-31, AD-3, AC-5):**
   - If a payment on the candidate deal has `status === 'PAYMENT_REJECTED'`:
     - Evaluate `computeCorrectionWindowExpiresAt(payment, deal.paymentDeadline, 12)`.
     - If `verifiedAt` occurred strictly *before* `deal.paymentDeadline`: the correction window was the original deadline itself.
     - If `verifiedAt` occurred *at or after* `deal.paymentDeadline`: the buyer received a 12-hour grace period ending at `verifiedAt + 12 hours`.
     - If `currentTime < windowExpiresAt`: the payment is STILL inside its active 12-hour correction window.
     - While inside this window, the payment MUST NOT be set to `EXPIRED` and the deal MUST NOT be cancelled.

6. **Post-Deadline Outcome Evaluation & Atomic Transitions (FR-33, BR-07, AD-4, OQ-13):**
   - When all protection gates are cleared (deadline passed, no active dispute, no payment in `PROOF_UPLOADED` or `UNDER_REVIEW`, no payment in an active grace window):
   - An interactive transaction atomically executes:
     - **Individual Payment Expiry:**
       - Any payment with `status === 'PENDING'` (never uploaded) transitions to `status = 'EXPIRED'`.
       - Any payment with `status === 'PAYMENT_REJECTED'` whose 12-hour grace period elapsed (`currentTime >= windowExpiresAt`) transitions to `status = 'EXPIRED'`.
     - **Outcome A — Both Expired (Standard Timeout):**
       - If both payments reach `EXPIRED`:
         - `Deal`: transitions `status = DealStatus.CANCELLED`, sets `version = { increment: 1 }`.
         - `Listing`: reverts `status = ListingStatus.ACTIVE`, sets `version = { increment: 1 }`.
         - `AuditLog`: inserts `action = 'DEAL_CANCELLED_BY_TIMEOUT'`, `entityType = 'Deal'`, `entityId = deal.id`, recording `dealId`, `dealNumber`, `listingId`, `reason = 'PAYMENT_DEADLINE_EXPIRED'`, `cancelledAt = currentTime.toISOString()`.
     - **Outcome B — Commission Confirmed, Property Price Expired (OQ-13):**
       - If `PLATFORM_COMMISSION` is `CONFIRMED` but `SELLER_PURCHASE_PRICE` is `EXPIRED`:
         - `Deal`: transitions `status = DealStatus.CANCELLED`, sets `version = { increment: 1 }`.
         - `Listing`: reverts `status = ListingStatus.ACTIVE`, sets `version = { increment: 1 }`.
         - `Payment`: seller price payment transitions to `EXPIRED`.
         - `AuditLog`: inserts `action = 'DEAL_CANCELLED_BY_TIMEOUT'` with `flag: 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED'`, recording that platform commission was collected and requires manual refund review by Super Admin under OQ-13.
     - **Outcome C — Price Confirmed, Commission Expired:**
       - Requires Super Admin dispute resolution: `AuditLog` flags `SUPER_ADMIN_PAYMENT_ANOMALY_REVIEW`; does not auto-complete without platform fee.
     - If any sub-operation fails inside the interactive transaction, the entire transaction rolls back with zero partial state change.

7. **Concurrency, Row Locking & Anti-Deadlock Invariants (AD-4, BR-07, TRAP T-1, T-12):**
   - In API or worker database operations, row lock order across tables is strictly enforced:
     1. Lock `Deal` row: `SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`
     2. Lock `Listing` row: `SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE`
     3. Lock `Payment` rows: `SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`
   - All UUID queries explicitly cast `${id}::text` to avoid PostgreSQL error 42883 (trap T-1).
   - Complies with PostgreSQL partial index `deal_single_active_listing` (`WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED')`): transitioning `Deal` to `CANCELLED` instantly frees the listing for subsequent deals.

8. **Notification & Alert Dispatch (FR-33, Architecture Spine §Notifications):**
   - Dispatches `deal.timeout_cancelled` event/notification to Buyer and Seller.
   - Buyer alert: explains that the 48-hour payment window elapsed without valid proof submission and the deal has been cancelled.
   - Seller alert: explains that the buyer failed to complete payment within the deadline and the property listing has returned to Active status.

9. **Buyer Web UI Cancelled State & Disabled Actions (UX-DR4, UX-DR5, UX-DR12):**
   - On `/app/buyer/deals/:id`:
     - When `deal.status === 'CANCELLED'`:
       - Countdown banner is replaced by a dedicated red/neutral cancellation banner:
         «تم إلغاء الصفقة لانتهاء مهلة السداد دون استلام إثبات التحويل في الموعد المحدد».
       - Both payment cards display read-only `منتهي` (Expired) badge.
       - All upload / replace receipt buttons and dropzones are strictly disabled / hidden (`isPaymentUploadable` returns false for `EXPIRED`).
       - `DealStatusBadge` displays `ملغاة` with neutral badge styling.
   - On `/app/buyer/deals` (Deals List):
     - Displays `ملغاة` status badge and cancellation indication.

10. **Zero Regressions & Full Test Suite Health:**
    - Worker unit tests verify:
      - 0 eligible deals -> clean no-op, 0 processed.
      - Disputed deals -> skipped, 0 cancelled.
      - Deal with on-time proof uploaded (`PROOF_UPLOADED`) -> skipped, not cancelled.
      - Deal with proof under review (`UNDER_REVIEW`) -> skipped, not cancelled.
      - Deal with rejected proof inside 12-hour grace period -> skipped, not cancelled.
      - Deal with rejected proof past 12-hour grace period -> expired and cancelled.
      - Deal with pending proofs past deadline -> both payments expired, deal cancelled, listing reverted to active.
      - Commission confirmed, price expired -> deal cancelled, listing reverted, flagged for refund review.
    - All packages (`@elmasaif/shared`, `@elmasaif/api`, `@elmasaif/worker`, `@elmasaif/web`) pass `npm test` and `npm run build` with zero regressions.

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts, constants & pure timeout evaluation helpers** (AC: 1, 3, 4, 5, 6, 8)
  - [x] 1.1 `packages/shared/src/constants/deal.ts`:
        - Export audit log action: `DEAL_CANCELLED_BY_TIMEOUT = 'DEAL_CANCELLED_BY_TIMEOUT'`.
        - Export audit log action: `PAYMENT_EXPIRED = 'PAYMENT_EXPIRED'`.
        - Export notification action: `NOTIFICATION_DEAL_TIMEOUT_CANCELLED = 'deal.timeout_cancelled'`.
        - Export cancellation reasons: `DEAL_CANCEL_REASON_PAYMENT_TIMEOUT = 'PAYMENT_DEADLINE_EXPIRED'`.
        - Add Arabic hints for cancellation messages in `DEAL_ERROR_MESSAGES_AR` or helper table:
          `[DEAL_CANCEL_REASON_PAYMENT_TIMEOUT]: 'تم إلغاء الصفقة لانتهاء مهلة السداد'`.
  - [x] 1.2 `packages/shared/src/deal/timeout.ts`:
        - Implement pure evaluation functions:
          - `isDealEligibleForTimeout(deal: DealTimeoutEvaluationInput, currentTime: Date): boolean`:
            - Checks `deal.status` in `ACTIVE_DEAL_STATUSES`.
            - Checks `deal.paymentDeadline <= currentTime`.
            - Checks `!hasActiveDispute(deal)`.
            - Checks `!hasProtectedPaymentProof(deal.payments)`.
            - Checks `!hasPaymentInGracePeriod(deal.payments, deal.paymentDeadline, currentTime, graceHours)`.
          - `hasActiveDispute(deal: { disputes?: Array<{ status: string }> }): boolean`:
            - Returns true if any dispute is `OPEN`.
          - `hasProtectedPaymentProof(payments: Array<{ status: string }>): boolean`:
            - Returns true if any payment is `PROOF_UPLOADED` or `UNDER_REVIEW`.
          - `hasPaymentInGracePeriod(payments: Array<{ status: string; verifiedAt?: Date | string | null }>, deadline: Date | string, currentTime: Date, graceHours: number): boolean`:
            - Evaluates rejected payments using `computeCorrectionWindowExpiresAt(p, deadline, graceHours)`; returns true if `currentTime < new Date(windowExpiresAt)`.
          - `evaluatePostDeadlineOutcome(payments: Array<{ paymentType: string; status: string }>): 'BOTH_EXPIRED' | 'COMMISSION_CONFIRMED_PRICE_EXPIRED' | 'PRICE_CONFIRMED_COMMISSION_EXPIRED' | 'PENDING_REVIEW'`:
            - Maps post-deadline payment configuration to deal outcome.
  - [x] 1.3 `packages/shared/src/deal/index.ts`:
        - Re-export all functions and types from `timeout.ts`.
  - [x] 1.4 Unit tests:
        - `packages/shared/src/deal/__tests__/timeout.spec.ts`: test all branches of `isDealEligibleForTimeout`, `hasActiveDispute`, `hasProtectedPaymentProof`, `hasPaymentInGracePeriod`, and `evaluatePostDeadlineOutcome`.
        - `packages/shared/src/constants/__tests__/deal.spec.ts`: assert new constants exist.

- [x] **Task 2 — Worker Job Implementation (`apps/worker`)** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 10)
  - [x] 2.1 `apps/worker/src/jobs/payment-deadline-expiry.job.ts`:
        - Replace stub with complete implementation:
        - Define `PaymentDeadlineExpiryDbClient` interface:
          - `deal`: `findMany({ where, include })`, `update({ where, data })`.
          - `listing`: `update({ where, data })`.
          - `payment`: `updateMany({ where, data })`, `update({ where, data })`.
          - `auditLog`: `create({ data })`.
        - Implement `createPaymentDeadlineExpiryLogic(db?: PaymentDeadlineExpiryDbClient, options?: { graceHours?: number })`:
          - Accepts injected `db` and optional `graceHours` (defaults to 12).
          - Queries non-terminal deals with `status IN ('AWAITING_PAYMENT_PROOF', 'UNDER_ADMIN_AUDIT', 'PAYMENT_REJECTED')` and `paymentDeadline <= currentTime`, including `payments`, `disputes`, `listing`.
          - For each deal, runs `isDealEligibleForTimeout(deal, currentTime)`.
          - Skips if protected by dispute, pending review, or active grace period.
          - Updates payments past grace/deadline to `EXPIRED`.
          - Re-evaluates outcome:
            - `BOTH_EXPIRED`: `deal.update({ where: { id: deal.id }, data: { status: 'CANCELLED', version: { increment: 1 } } })`, `listing.update({ where: { id: deal.listingId }, data: { status: 'ACTIVE', version: { increment: 1 } } })`.
            - `COMMISSION_CONFIRMED_PRICE_EXPIRED`: `deal.update(status: 'CANCELLED')`, `listing.update(status: 'ACTIVE')`, `auditLog.create` with `flag: 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED'`.
          - Emits audit log entry for `DEAL_CANCELLED_BY_TIMEOUT` with snapshot details.
          - Tracks `processedCount`, `cancelledDealsCount`, `expiredPaymentsCount`.
          - Returns formatted `outcome` and structured `details`.
        - Export `paymentDeadlineExpiryHandler = createJobHandler(JOB_PAYMENT_DEADLINE_EXPIRY, createPaymentDeadlineExpiryLogic())`.
  - [x] 2.2 `apps/worker/src/jobs/__tests__/payment-deadline-expiry.spec.ts`:
        - Dedicated unit test suite covering:
          - No candidate deals -> returns 0 processed.
          - Deal before deadline -> not queried/processed.
          - Deal past deadline with open dispute -> skipped.
          - Deal past deadline with payment in `PROOF_UPLOADED` -> skipped.
          - Deal past deadline with payment in `UNDER_REVIEW` -> skipped.
          - Deal past deadline with rejected payment inside 12h grace window -> skipped.
          - Deal past deadline with rejected payment past 12h grace window -> cancelled, payments expired, listing active.
          - Deal past deadline with both payments `PENDING` -> both expired, deal cancelled, listing active.
          - Deal past deadline with commission confirmed and price un-uploaded -> deal cancelled, listing active, flagged for refund review.
          - Audit log rows verified for `DEAL_CANCELLED_BY_TIMEOUT`.
  - [x] 2.3 Verify `apps/worker/src/jobs/__tests__/jobs.spec.ts` passes with updated handler.

- [x] **Task 3 — API Deal Timeout Service (`apps/api`)** (AC: 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] 3.1 `apps/api/src/modules/deals/deal-timeout.service.ts`:
        - Create `DealTimeoutService` providing atomic transactional deal timeout evaluation:
        - `cancelDealByTimeout(dealId: string, options?: { force?: boolean })`:
          - Executes inside `prisma.$transaction(async (tx) => { ... })`.
          - Locks rows: `Deal` (`FOR UPDATE`) -> `Listing` (`FOR UPDATE`) -> `Payment` rows (`FOR UPDATE`), casting `${id}::text`.
          - Verifies deal is in `ACTIVE_DEAL_STATUSES`.
          - Verifies no active dispute unless `force: true`.
          - Verifies no payment in `PROOF_UPLOADED` or `UNDER_REVIEW`.
          - Verifies no payment in active grace period (`computeCorrectionWindowExpiresAt`).
          - Sets eligible payments to `EXPIRED`.
          - Updates `deal.status = DealStatus.CANCELLED`, increments `version`.
          - Updates `listing.status = ListingStatus.ACTIVE`, increments `version`.
          - Creates `AuditLog` row: `action: DEAL_CANCELLED_BY_TIMEOUT`, `entityType: 'Deal'`, `entityId: deal.id`.
        - `sweepExpiredDeals(currentTime?: Date)`:
          - Batch query findMany for expired deals.
          - Loops candidates and invokes `cancelDealByTimeout` for each eligible deal safely catching errors per deal.
  - [x] 3.2 Register `DealTimeoutService` in `apps/api/src/modules/deals/deals.module.ts` and export it.
  - [x] 3.3 `apps/api/src/modules/deals/__tests__/deal-timeout.service.spec.ts`:
        - Unit tests testing atomic transaction execution, row locking, rollback on error, and all protection gates.

- [x] **Task 4 — Buyer Web UI Cancelled State & Banner** (AC: 9)
  - [x] 4.1 `apps/web/src/components/deals/deal-cancelled-banner.tsx`:
        - Create `DealCancelledBanner` component:
          - Red/neutral bordered container with alert icon.
          - Title: «تم إلغاء الصفقة لانتهاء مهلة السداد»
          - Description: «تم إلغاء هذه الصفقة تلقائياً لانتهاء المهلة الزمنية المحددة (48 ساعة) دون استلام إثبات التحويل البنكي المطلوب. تمت إعادة إتاحة العقار في السوق.»
          - Data test ID: `deal-cancelled-banner`.
  - [x] 4.2 `apps/web/src/components/deals/deal-payment-view.tsx`:
        - Import `DealCancelledBanner`.
        - If `view.status === 'CANCELLED'`:
          - Replace countdown banner with `<DealCancelledBanner />`.
          - Ensure payment upload buttons/cards are in read-only / locked state.
  - [x] 4.3 `apps/web/src/components/deals/index.ts`:
        - Export `DealCancelledBanner`.
  - [x] 4.4 Unit tests:
        - `apps/web/src/components/deals/__tests__/deal-cancelled-banner.spec.tsx`: verify banner renders title, description, and test ID.
        - `apps/web/src/components/deals/__tests__/deal-payment-view-helpers.spec.ts`: verify cancelled deal state helpers.

- [x] **Task 5 — Verification, Build & Monorepo Test Run** (AC: 10)
  - [x] 5.1 Build packages:
        - `npm run build` in `packages/shared`.
        - `npm run build` in `apps/worker`.
        - `npm run build` in `apps/api`.
  - [x] 5.2 Test execution:
        - `npm run test` in `packages/shared`.
        - `npm run test` in `apps/worker`.
        - `npm run test` in `apps/api`.
        - `npm run test` in `apps/web`.
  - [x] 5.3 Verify all tests pass with zero regressions.

## Dev Notes

### Critical Architecture Patterns & Invariants

1. **Deterministic Clock Usage (AD-11):**
   - Temporal logic in `apps/worker` MUST read `currentTime` provided by `workerClock.now()` (or passed into the handler/logic).
   - Never call `new Date()` directly for deadline or grace comparisons.

2. **Row Locking & SQL Casting (TRAP T-1, T-12):**
   - Postgres error `42883` ("operator does not exist: text = uuid") is triggered if parameter types are not cast.
   - Any raw SQL query on `deals`, `listings`, or `payments` MUST cast `${id}::text`:
     `SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`
   - Lock hierarchy:
     1. `deals`
     2. `listings`
     3. `payments`
   - Locking in any other order risks deadlock with concurrent payment verification transactions.

3. **PostgreSQL Partial Index Invariant (`deal_single_active_listing`):**
   - The partial index defined in `apps/api/prisma/sql/deal-invariants.sql` is:
     `CREATE UNIQUE INDEX deal_single_active_listing ON "deals" ("listingId") WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED');`
   - Once a Deal transitions to `CANCELLED`, it immediately ceases to be an active deal under this index, permitting the Listing to be reserved by a new agreed offer or reactivated.

4. **Listing Status Reversion:**
   - At deal creation (Story 5.1), `Listing.status` was transitioned from `ACTIVE` to `RESERVED`.
   - On timeout cancellation (Story 5.5), `Listing.status` MUST revert from `RESERVED` to `ACTIVE`.
   - Both `Deal.version` and `Listing.version` must be incremented (`{ increment: 1 }`).

5. **State Transition Matrix for Post-Deadline Outcomes:**

   | Payment 1 (Commission) | Payment 2 (Purchase Price) | Deal Outcome | Listing Status | Action / Flag |
   |---|---|---|---|---|
   | `PENDING` | `PENDING` | `CANCELLED` | `ACTIVE` | Standard timeout cancellation |
   | `REJECTED` (grace expired) | `PENDING` | `CANCELLED` | `ACTIVE` | Standard timeout cancellation |
   | `PROOF_UPLOADED` | `PENDING` | **NO CHANGE** | `RESERVED` | **Protected**: review pending on payment 1 |
   | `UNDER_REVIEW` | `PENDING` | **NO CHANGE** | `RESERVED` | **Protected**: admin audit in progress |
   | `REJECTED` (in 12h grace) | `PENDING` | **NO CHANGE** | `RESERVED` | **Protected**: 12h correction window active |
   | `CONFIRMED` | `EXPIRED` | `CANCELLED` | `ACTIVE` | OQ-13: flag for Super Admin commission refund review |
   | `CONFIRMED` | `CONFIRMED` | `COMPLETED` | `SOLD` | Completed deal (Story 5.4 domain) |

6. **Traps & Anti-Patterns to Prevent:**
   - **T-1: Uncast UUID in Raw SQL:** Always cast `${id}::text`.
   - **T-2: Premature Cancellation During Admin Review:** If either payment has a proof uploaded on time, NEVER cancel. The admin SLA may take 4h, 12h, or 24h, but the buyer's deal is protected.
   - **T-3: Ignoring Post-Deadline 12-Hour Grace Period:** If a payment was rejected at or after the 48-hour deadline, the buyer has exactly 12 hours from `verifiedAt` to re-upload. Cancelling during this window is a severe business rule violation.
   - **T-4: Cancelling Disputed Deals:** A deal with an active `Dispute` record must never be auto-cancelled by a worker sweep. Automated timeouts are frozen.
   - **T-5: Missing Listing Reversion:** A cancelled deal must not leave the listing in `RESERVED`. It must be restored to `ACTIVE`.
   - **T-6: Stale Shared Dist:** Always run `npm run build` in `packages/shared` after modifying shared code, before testing worker, api, or web.

### Files Being Touched

- `packages/shared/src/constants/deal.ts` (UPDATE: export timeout audit and notification constants)
- `packages/shared/src/constants/__tests__/deal.spec.ts` (UPDATE: constants tests)
- `packages/shared/src/deal/timeout.ts` (NEW: pure timeout evaluation logic)
- `packages/shared/src/deal/__tests__/timeout.spec.ts` (NEW: unit tests for timeout helpers)
- `packages/shared/src/deal/index.ts` (UPDATE: re-export timeout helpers)
- `apps/worker/src/jobs/payment-deadline-expiry.job.ts` (UPDATE: complete worker job implementation)
- `apps/worker/src/jobs/__tests__/payment-deadline-expiry.spec.ts` (NEW: worker job unit tests)
- `apps/api/src/modules/deals/deal-timeout.service.ts` (NEW: atomic transaction timeout service)
- `apps/api/src/modules/deals/__tests__/deal-timeout.service.spec.ts` (NEW: api timeout service tests)
- `apps/api/src/modules/deals/deals.module.ts` (UPDATE: register DealTimeoutService)
- `apps/web/src/components/deals/deal-cancelled-banner.tsx` (NEW: cancellation alert banner)
- `apps/web/src/components/deals/__tests__/deal-cancelled-banner.spec.tsx` (NEW: banner unit tests)
- `apps/web/src/components/deals/deal-payment-view.tsx` (UPDATE: render cancellation banner when cancelled)
- `apps/web/src/components/deals/index.ts` (UPDATE: re-export cancellation banner)

### References

- `_bmad-output/planning-artifacts/epics.md#Story 5.5: Automated Payment Timeout Worker Job`
- `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Payment Timing, Deadline & Timeout Protection Engine`
- `_bmad-output/implementation-artifacts/5-1-deal-creation-state-machine-binding-financial-snapshot-freez.md`
- `_bmad-output/implementation-artifacts/5-3-administrative-proof-review-task-claim-locking-grace-period.md`
- `_bmad-output/implementation-artifacts/5-4-atomic-deal-completion-contact-release.md`
- `apps/api/prisma/sql/deal-invariants.sql`

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash

### Debug Log References

- Shared package dist rebuild required (`tsc -p packages/shared/tsconfig.json`) to emit `dist/deal/timeout.js` prior to consuming from `apps/worker` and `apps/api`.
- Verified Jest runtime environment in `apps/api` with `jest.fn()` mocks and `$transaction` integration.
- Monorepo package builds and test suites validated with zero regressions.

### Completion Notes List

- Task 1: Exported deal timeout audit action `DEAL_CANCELLED_BY_TIMEOUT`, payment action `PAYMENT_EXPIRED`, notification action `deal.timeout_cancelled`, cancel reason `PAYMENT_DEADLINE_EXPIRED`, and Arabic hint in `packages/shared/src/constants/deal.ts`. Implemented pure eligibility checks `isDealEligibleForTimeout`, `hasActiveDispute`, `hasProtectedPaymentProof`, `hasPaymentInGracePeriod`, and `evaluatePostDeadlineOutcome` in `packages/shared/src/deal/timeout.ts`. All 41 unit tests pass.
- Task 2: Replaced stub in `apps/worker/src/jobs/payment-deadline-expiry.job.ts` with complete sweep logic implementing all 3 protection gates (active dispute freeze, on-time upload / review protection, 12-hour grace window). Handled Outcomes A (standard timeout cancellation), B (OQ-13 commission refund review required), and C (payment anomaly review). All 35 worker tests pass.
- Task 3: Created `DealTimeoutService` in `apps/api/src/modules/deals/deal-timeout.service.ts` enforcing row locking hierarchy (Deal -> Listing -> Payments with `${id}::text` casts), rollback invariants, idempotent cancellation, and `sweepExpiredDeals`. Registered and exported in `deals.module.ts`. All unit tests pass.
- Task 4: Created `DealCancelledBanner` component and integrated into `DealPaymentView` (`apps/web/src/components/deals/deal-payment-view.tsx`). Replaces countdown timer with red/neutral cancellation banner when `deal.status === 'CANCELLED'`. Card actions locked via existing terminal state handlers. 43 web tests pass.
- Task 5: Verified monorepo package builds (`packages/shared`, `apps/worker`, `apps/api`) and test suites across all packages with zero regressions.

### File List

- `_bmad-output/implementation-artifacts/5-5-automated-payment-timeout-worker-job.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/constants/__tests__/deal.spec.ts`
- `packages/shared/src/deal/timeout.ts`
- `packages/shared/src/deal/__tests__/timeout.spec.ts`
- `packages/shared/src/deal/index.ts`
- `apps/worker/src/jobs/payment-deadline-expiry.job.ts`
- `apps/worker/src/jobs/__tests__/payment-deadline-expiry.spec.ts`
- `apps/api/src/modules/deals/deal-timeout.service.ts`
- `apps/api/src/modules/deals/__tests__/deal-timeout.service.spec.ts`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/web/src/components/deals/deal-cancelled-banner.tsx`
- `apps/web/src/components/deals/__tests__/deal-cancelled-banner.spec.tsx`
- `apps/web/src/components/deals/deal-payment-view.tsx`
- `apps/web/src/components/deals/index.ts`

