---
baseline_commit: d1d3731
---

# Story 5.6: Pre-Payment Cancellations & Dispute Adjudication

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a transaction participant (Buyer or Seller) or Platform Super Administrator,
I want options to cancel a deal prior to payment proof upload or file a formal dispute once payment proof has been submitted, with a dedicated Super Admin workspace to adjudicate disputed deals,
so that deal exceptions and disagreements are handled transparently, funds and listings are protected from deadlocks, and disputes receive binding administrative resolutions.

## Acceptance Criteria

1. **Pre-Payment Buyer Cancellation (FR-34, UJ-1, UC-29B, BR-07):**
   - Given an active deal in status `DealStatus.AWAITING_PAYMENT_PROOF`.
   - When the Buyer cancels the deal before any payment proof has been uploaded (`payments.every(p => p.status === 'PENDING')`):
   - Then via `POST /api/v1/deals/:id/cancel-by-buyer`:
     - Interactive transaction atomically:
       - Acquires row locks in canonical anti-deadlock order:
         1. Deal: `SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`
         2. Listing: `SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE`
         3. Payments: `SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`
       - Validates caller is the Buyer (`deal.buyerProfileId === profile.id`).
       - Validates deal status is `AWAITING_PAYMENT_PROOF` (throws `DEAL_CANCEL_INVALID_STATE` if already in audit, disputed, completed, or terminal).
       - Validates that NO payment proof has been uploaded (throws `DEAL_CANCEL_PROOF_EXISTS` if any payment is not `PENDING`).
       - Updates `Deal`: `status = DealStatus.CANCELLED`, `cancellationReason = 'CANCELLED_BY_BUYER'`, `version = { increment: 1 }`.
       - Reverts `Listing`: `status = ListingStatus.ACTIVE`, `version = { increment: 1 }`.
       - Updates all deal payments: `status = 'EXPIRED'`.
       - Inserts `AuditLog`: `actorId = buyerUserId`, `actorType = 'USER'`, `action = 'DEAL_CANCELLED_BY_BUYER'`, `entityType = 'Deal'`, `entityId = deal.id`, payload `{ dealId, dealNumber, listingId, cancelledAt }`.
       - Dispatches in-app and email event `deal.buyer_cancelled` to Buyer and Seller.
       - Returns `{ statusCode: 200, message: 'تم إلغاء الصفقة بنجاح', data: { dealId, status: 'CANCELLED' } }`.

2. **Pre-Payment Seller Cancellation Request (FR-34, UC-46, UJ-5):**
   - Given an active deal in `AWAITING_PAYMENT_PROOF` before any payment proof has been uploaded.
   - When the Seller requests deal cancellation (e.g. seller withdrawal, inability to proceed):
   - Then the deal DOES NOT cancel immediately; it registers an administrative cancellation review request:
     - Via `POST /api/v1/deals/:id/seller-cancel-request` with validated body `{ reason: string }` (10–500 characters).
     - Validates caller is the Seller (`deal.sellerProfileId === profile.id`).
     - Validates deal status is `AWAITING_PAYMENT_PROOF` and NO payment proofs are uploaded (`payments.every(p => p.status === 'PENDING')`).
     - Validates no active cancellation request already exists (`deal.sellerCancellationRequestedAt === null`).
     - Atomically updates `Deal`: `sellerCancellationRequestedAt = now`, `sellerCancellationReason = reason.trim()`, `version = { increment: 1 }`.
     - Inserts `AuditLog`: `actorId = sellerUserId`, `actorType = 'USER'`, `action = 'SELLER_CANCELLATION_REQUESTED'`, `entityType = 'Deal'`, `entityId = deal.id`.
     - Dispatches notification `deal.seller_cancellation_requested` to Platform Admins and Buyer.

3. **Administrative Review of Seller Cancellation Request (UC-46, AD-10):**
   - Administrators with permission `Deals.Review` or `Deals.DisputeResolve` review pending seller cancellation requests.
   - **Outcome A — Approve Seller Cancellation (`POST /api/v1/admin/deals/:id/seller-cancel/approve`):**
     - Interactive transaction atomically:
       - Locks Deal, Listing, and Payments rows in canonical order.
       - Sets `Deal`: `status = DealStatus.CANCELLED`, `cancellationReason = 'CANCELLED_BY_SELLER'`, `version = { increment: 1 }`.
       - Reverts `Listing`: `status = ListingStatus.ACTIVE`, `version = { increment: 1 }`.
       - Sets Payments to `EXPIRED`.
       - Inserts `AuditLog`: `action = 'DEAL_CANCELLED_BY_SELLER'`, `actorId = adminId`, `actorType = 'ADMIN'`, `entityType = 'Deal'`, `entityId = deal.id`.
       - Dispatches notification `deal.seller_cancelled` to Buyer and Seller.
   - **Outcome B — Reject Seller Cancellation (`POST /api/v1/admin/deals/:id/seller-cancel/reject` with `{ note: string }`):**
     - Interactive transaction atomically:
       - Clears `sellerCancellationRequestedAt = null`, `sellerCancellationReason = null`.
       - Deal remains in `AWAITING_PAYMENT_PROOF`.
       - Inserts `AuditLog`: `action = 'SELLER_CANCELLATION_REJECTED'`, `actorId = adminId`, `actorType = 'ADMIN'`, `entityType = 'Deal'`, `entityId = deal.id`, payload `{ note }`.
       - Dispatches notification to Seller detailing rejection rationale.

4. **Formal Deal Dispute Filing by Counterparties (FR-36, UJ-5, UC-29C):**
   - Given an active deal in non-terminal status (`AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`).
   - And at least one payment proof has been uploaded (`payments.some(p => p.status !== 'PENDING')`).
   - When Buyer or Seller files a formal dispute via `POST /api/v1/deals/:id/dispute` with body `{ reason: string }` (10–1000 characters):
     - Validates caller is Buyer or Seller on the deal (`deal.buyerProfileId === profile.id || deal.sellerProfileId === profile.id`).
     - Validates deal is not terminal (`COMPLETED`, `CANCELLED`, `TERMINATED`).
     - Validates proof existence: at least one payment must be non-`PENDING` (throws `DISPUTE_PROOF_REQUIRED` if 0 proofs uploaded).
     - Validates that no active dispute already exists (`Dispute.status === 'OPEN'`).
     - Interactive transaction atomically:
       - Locks `Deal` row: `SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`.
       - Updates `Deal`: `status = DealStatus.DISPUTED`, `version = { increment: 1 }`.
       - Creates `Dispute` row: `dealId = deal.id`, `initiatorId = userId`, `reason = reason.trim()`, `status = 'OPEN'`.
       - Inserts `AuditLog`: `actorId = userId`, `actorType = 'USER'`, `action = 'DEAL_DISPUTE_FILED'`, `entityType = 'Dispute'`, `entityId = dispute.id`, payload `{ dealId, dealNumber, initiatorRole, reason }`.
       - Dispatches notification `deal.disputed` to Buyer, Seller, and Super Admin.
       - Returns `{ statusCode: 201, message: 'تم تقديم النزاع بنجاح وجارٍ التدقيق الإداري', data: { disputeId, dealId, status: 'DISPUTED' } }`.

5. **Dispute Freeze Guard for Background Timeout Cron (FR-36, UC-30, AD-3, Story 5.5 Gate 1):**
   - When a deal is in status `DealStatus.DISPUTED` or has `disputes.some(d => d.status === 'OPEN')`:
     - The dedicated worker cron sweep (`payment-deadline-expiry` / `deal-timeout.service.ts`) strictly bypasses cancellation.
     - Timeout evaluation is frozen; no payment transitions to `EXPIRED` and the listing remains reserved until Super Admin issues a binding adjudication verdict.
     - Worker logs telemetry: `Deal {dealId} has active dispute; timeout frozen.`

6. **System Anomaly Auto-Dispute Escalation (FR-33, FR-36, AD-3, Story 5.5 Outcome C):**
   - When timeout evaluation encounters post-deadline outcome `PRICE_CONFIRMED_COMMISSION_EXPIRED`:
     - The deal MUST NOT complete and MUST NOT be auto-cancelled.
     - Instead, the system automatically creates a `Dispute` row with `initiatorId = 'SYSTEM'`, `reason = 'PRICE_CONFIRMED_COMMISSION_EXPIRED'`.
     - Atomically transitions `Deal.status = DealStatus.DISPUTED`, `version = { increment: 1 }`.
     - Inserts `AuditLog`: `action = 'DEAL_DISPUTE_SYSTEM_ESCALATION'`, `actorId = 'SYSTEM'`, `actorType = 'SYSTEM'`, `entityType = 'Dispute'`, with flag `SUPER_ADMIN_PAYMENT_ANOMALY_REVIEW`.
     - Routes the deal to the Super Admin Dispute Adjudication Queue.

7. **Super Admin Dispute Adjudication Queue & Task Claim Locking (AD-10, FR-40, FR-51):**
   - Dedicated admin back-office endpoints in the isolated admin realm:
     - `GET /api/v1/admin/disputes`: paginated, filtered by status (`OPEN`, `RESOLVED`), oldest-first ordering.
     - Strict RBAC: guarded by `@RequireAdminPermission('Deals.DisputeResolve')` (Super Admin privilege).
     - Returns dispute details, deal summary, buyer/seller profiles, payment cards snapshot, and live claim lock info.
   - Claim Lock Protocol (AD-10 / 15-minute lease, 5-minute heartbeat):
     - `POST /api/v1/admin/disputes/:id/claim`: acquires 15-minute exclusive lease (`lockedByAdminId = adminId`, `lockedAt = now`, `lockExpiresAt = now + 15m`).
     - `POST /api/v1/admin/disputes/:id/renew`: extends active lease by 15 minutes.
     - `POST /api/v1/admin/disputes/:id/release`: voluntarily returns dispute to queue for other administrators.
     - `POST /api/v1/admin/disputes/:id/force-unlock`: Super Admin override with mandatory reason note.

8. **Super Admin Binding Dispute Adjudication Verdicts (FR-36, UC-70C):**
   - Via `POST /api/v1/admin/disputes/:id/adjudicate` with validated body:
     - `{ action: 'COMPLETE' | 'CANCEL' | 'RETURN_TO_REVIEW', notes: string, newDeadlineHours?: number }`.
     - Validates that the active claim lock is held by current administrator.
     - Execution is strictly one of three binding verdicts:
     - **Verdict 1: COMPLETE (Deal Approval):**
       - Calls `DealCompletionService.completeDeal(dealId, adminId, 'DISPUTE_ADJUDICATION')`.
       - Atomically completes transaction: sets `Deal = COMPLETED`, `Listing = SOLD`, closes backup offers, generates ZATCA tax invoice, releases buyer/seller contact info, unlocks buyer rating.
       - Updates `Dispute`: `status = 'RESOLVED'`, `resolutionAction = 'COMPLETED'`, `resolutionNotes = notes`, `resolvedByAdminId = adminId`, `resolvedAt = now`.
       - Inserts `AuditLog`: `action = 'DEAL_DISPUTE_RESOLVED_COMPLETED'`.
       - Dispatches completion notifications to Buyer and Seller.
     - **Verdict 2: CANCEL (Deal Cancellation):**
       - Atomically: sets `Deal.status = DealStatus.CANCELLED`, `cancellationReason = 'CANCELLED_BY_ADMIN'`, `version = { increment: 1 }`.
       - Reverts `Listing.status = ListingStatus.ACTIVE`, `version = { increment: 1 }`.
       - Sets all non-confirmed payments to `EXPIRED`.
       - If platform commission was already confirmed, flags `SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED` (OQ-13).
       - Updates `Dispute`: `status = 'RESOLVED'`, `resolutionAction = 'CANCELLED'`, `resolutionNotes = notes`, `resolvedByAdminId = adminId`, `resolvedAt = now`.
       - Inserts `AuditLog`: `action = 'DEAL_DISPUTE_RESOLVED_CANCELLED'`.
       - Dispatches cancellation notifications to Buyer and Seller.
     - **Verdict 3: RETURN_TO_REVIEW (Review Extension):**
       - Requires `newDeadlineHours` (default 24 or 48) and `notes`.
       - Atomically updates `Deal`: `status = DealStatus.UNDER_ADMIN_AUDIT`, `paymentDeadline = now + newDeadlineHours * 3600 * 1000`, `version = { increment: 1 }`.
       - Updates `Dispute`: `status = 'RESOLVED'`, `resolutionAction = 'RETURNED_TO_REVIEW'`, `resolutionNotes = notes`, `resolvedByAdminId = adminId`, `resolvedAt = now`.
       - Inserts `AuditLog`: `action = 'DEAL_DISPUTE_RETURNED_TO_REVIEW'`, payload `{ newDeadlineHours, notes }`.
       - Dispatches notification to Buyer and Seller with new deadline and instructions.

9. **Buyer Deal UI Cancellation & Dispute Controls (UX-DR4, UX-DR5, UX-DR12):**
   - On `/app/buyer/deals/:id`:
     - When `deal.status === 'AWAITING_PAYMENT_PROOF'` and NO payment proof is uploaded:
       - Displays secondary red outline button `إلغاء الصفقة` (Cancel Deal).
       - Clicking opens accessible confirmation modal explaining that cancellation returns the property to active market circulation.
       - On confirm, calls `POST /api/v1/deals/:id/cancel-by-buyer` and transitions view to `DealCancelledBanner`.
     - When at least one payment proof has been uploaded and deal is not terminal:
       - Hides cancel button; renders `تقديم نزاع` (File Dispute) button.
       - Clicking opens accessible `DealDisputeModal` with disclaimer, dispute instructions, and mandatory reason textarea (min 10 chars).
       - On submit, calls `POST /api/v1/deals/:id/dispute` and transitions view to `DealDisputedBanner`.
     - When `deal.status === 'DISPUTED'`:
       - Countdown banner is hidden and replaced by dedicated yellow/amber `DealDisputedBanner`:
         «الصفقة قيد النزاع والتدقيق الإداري من قبل الإدارة العليا. تم تجميد المهل التلقائية لحين صدور القرار النهائي.»
       - All upload and replace receipt buttons/dropzones are strictly disabled.
       - `DealStatusBadge` displays `متنازع عليها` with warning styling.

10. **Seller Web UI Cancellation Request & Dispute Actions:**
    - On Seller Offer / Deal view (`/app/marketer/offers/:id`, `/app/owner/offers/:id`):
      - When offer is `CONVERTED_TO_DEAL`:
        - Displays deal summary card with `DealStatusBadge`.
        - Before proof is uploaded: renders `طلب إلغاء الصفقة` button opening seller cancellation request modal.
        - If cancellation request is pending: shows info banner «طلب إلغاء الصفقة قيد المراجعة الإدارية».
        - After proof is uploaded and while non-terminal: renders `تقديم نزاع` button.
        - When deal is `DISPUTED`: renders dispute banner.

11. **Super Admin Dispute Adjudication Workspace (`/admin/disputes` & `/admin/disputes/[id]`):**
    - Under `/admin/disputes`:
      - Queue table listing all open disputes with deal reference code, parties, initiator role, created time, and claim lock indicator.
    - Under `/admin/disputes/[id]`:
      - Dedicated claim-locked adjudication workspace with 15-minute lease and renewal heartbeat.
      - Full deal snapshot: property title, deal price, commission snapshot, buyer and seller information.
      - Proof inspection cards with presigned preview links.
      - Dispute statement & history view.
      - Adjudication decision form with radio tabs (`اعتماد الصفقة`, `إلغاء الصفقة`, `إعادة للتدقيق مع تمديد المهلة`), resolution notes, and high-stakes confirmation dialog.

12. **Zero Regressions & Comprehensive Verification:**
    - Unit tests in `@elmasaif/shared` cover cancellation refusal codes, dispute validation schemas, and dispute outcome mappings.
    - Integration tests in `@elmasaif/api` cover buyer pre-payment cancellation, seller cancellation request & admin review, dispute filing, dispute freeze in timeout cron, and all 3 Super Admin adjudication verdicts.
    - Component tests in `@elmasaif/web` cover cancel modal, dispute modal, disputed banner, and admin adjudication workspace.
    - Monorepo build passes without errors (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Schema & Shared Domain Contracts (AC: 1, 2, 4, 7, 8)
  - [x] 1.1 Update `apps/api/prisma/schema.prisma`:
    - Add `DISPUTED` to `enum DealStatus`.
    - Add `cancellationReason String?`, `sellerCancellationRequestedAt DateTime?`, `sellerCancellationReason String?` to `model Deal`.
    - Add `resolutionAction String?`, `resolutionNotes String?`, `resolvedByAdminId String?`, `resolvedAt DateTime?` to `model Dispute`.
  - [x] 1.2 Update `packages/shared/src/enums/index.ts`:
    - Add `DISPUTED = 'DISPUTED'` to `DealStatus`.
  - [x] 1.3 Update `packages/shared/src/constants/deal.ts`:
    - Add refusal codes: `DEAL_CANCEL_INVALID_STATE`, `DEAL_CANCEL_PROOF_EXISTS`, `DEAL_CANCEL_NOT_PARTY`, `SELLER_CANCEL_REQUEST_PENDING`, `DISPUTE_PROOF_REQUIRED`, `DISPUTE_ALREADY_OPEN`, `DISPUTE_NOT_FOUND`, `DISPUTE_LOCK_REQUIRED`, `DISPUTE_LOCK_CONFLICT`, `DISPUTE_LOCK_EXPIRED`, `DISPUTE_SELF_ADJUDICATION_FORBIDDEN`, `DISPUTE_ADJUDICATION_INVALID_ACTION`, `DISPUTE_DEADLINE_EXTENSION_REQUIRED`.
    - Add audit log action constants: `DEAL_CANCELLED_BY_BUYER`, `SELLER_CANCELLATION_REQUESTED`, `DEAL_CANCELLED_BY_SELLER`, `SELLER_CANCELLATION_REJECTED`, `DEAL_DISPUTED`, `DEAL_DISPUTE_CLAIMED`, `DEAL_DISPUTE_RESOLVED_COMPLETED`, `DEAL_DISPUTE_RESOLVED_CANCELLED`, `DEAL_DISPUTE_RETURNED_TO_REVIEW`.
    - Add Arabic strings to `DEAL_STATUS_LABELS_AR` (`[DealStatus.DISPUTED]: 'متنازع عليها'`) and `DEAL_ERROR_MESSAGES_AR`.
    - Include `DealStatus.DISPUTED` in `ACTIVE_DEAL_STATUSES`.
  - [x] 1.4 Create `packages/shared/src/schemas/dispute.ts`:
    - Zod schemas: `cancelDealByBuyerSchema`, `sellerCancelRequestSchema`, `fileDisputeSchema`, `adjudicateDisputeSchema`.
    - Export schemas and types from `packages/shared/src/index.ts`.
  - [x] 1.5 Write unit tests in `packages/shared/src/constants/__tests__/deal.spec.ts` and `packages/shared/src/deal/__tests__/dispute.spec.ts`.

- [x] Task 2: Backend Cancellation Service & Endpoints (AC: 1, 2, 3)
  - [x] 2.1 Create `apps/api/src/modules/deals/deals-cancellation.service.ts`:
    - Implement `cancelByBuyer(userId, activeRole, dealId)`: validates role, status, 0 proofs, locks Deal/Listing/Payments, executes atomic cancellation.
    - Implement `requestSellerCancellation(userId, activeRole, dealId, input)`: validates seller, status, 0 proofs, sets request timestamp & reason.
    - Implement `approveSellerCancellation(adminId, dealId)`: guarded by admin permission, executes atomic cancellation, reverts listing to `ACTIVE`.
    - Implement `rejectSellerCancellation(adminId, dealId, note)`: clears request, logs audit entry, retains deal in `AWAITING_PAYMENT_PROOF`.
  - [x] 2.2 Wire buyer cancellation in `apps/api/src/modules/deals/buyer-deals.controller.ts`:
    - Add `POST /deals/:id/cancel-by-buyer`.
  - [x] 2.3 Wire seller cancellation request in `apps/api/src/modules/deals/buyer-deals.controller.ts` or dedicated controller:
    - Add `POST /deals/:id/seller-cancel-request`.
  - [x] 2.4 Wire admin seller cancellation adjudication in `apps/api/src/modules/deals/admin-deals.controller.ts`:
    - Add `POST /admin/deals/:id/seller-cancel/approve`.
    - Add `POST /admin/deals/:id/seller-cancel/reject`.
  - [x] 2.5 Author unit tests in `apps/api/src/modules/deals/__tests__/deals-cancellation.service.spec.ts`.

- [x] Task 3: Backend Dispute Service, Queue & Claim Locking (AC: 4, 5, 6, 7, 8)
  - [x] 3.1 Create `apps/api/src/modules/deals/dispute-lock.ts`:
    - Claim lock helper for `Dispute` model: 15-minute lease, heartbeat renewal, force unlock.
  - [x] 3.2 Create `apps/api/src/modules/deals/disputes.service.ts`:
    - Implement `fileDispute(userId, activeRole, dealId, input)`: validates counterparty, proof existence, transitions deal to `DISPUTED`, creates `Dispute`.
    - Implement `getDisputesQueue(query, currentAdminId)`: paginated list with claim lock info.
    - Implement `claimDispute(disputeId, adminId)`.
    - Implement `renewDisputeLock(disputeId, adminId)`.
    - Implement `releaseDisputeLock(disputeId, adminId)`.
    - Implement `forceUnlockDispute(disputeId, adminId, reason)`.
    - Implement `adjudicateDispute(disputeId, adminId, input)`: executes Complete, Cancel, or Return to Review with new deadline.
  - [x] 3.3 Create `apps/api/src/modules/deals/admin-disputes.controller.ts`:
    - Route `admin/disputes` protected by `@RequireAdminPermission('Deals.DisputeResolve')`.
    - Expose `GET /`, `GET /:id`, `POST /:id/claim`, `POST /:id/renew`, `POST /:id/release`, `POST /:id/force-unlock`, `POST /:id/adjudicate`.
  - [x] 3.4 Update `apps/api/src/modules/deals/buyer-deals.controller.ts`:
    - Add `POST /deals/:id/dispute`.
  - [x] 3.5 Update `apps/api/src/modules/deals/deal-timeout.service.ts`:
    - On outcome `PRICE_CONFIRMED_COMMISSION_EXPIRED`, automatically create a `Dispute` row and transition deal to `DISPUTED` (AC-6).
  - [x] 3.6 Update `apps/api/src/modules/deals/deals.module.ts`:
    - Register `DealsCancellationService`, `DisputesService`, and `AdminDisputesController`.
  - [x] 3.7 Author unit tests in `apps/api/src/modules/deals/__tests__/disputes.service.spec.ts` and `apps/api/src/modules/deals/__tests__/admin-disputes.controller.spec.ts`.

- [x] Task 4: Buyer Web UI Pre-Payment Cancellation & Dispute Filing (AC: 9)
  - [x] 4.1 Update `apps/web/src/components/deals/deal-status-badge.tsx`:
    - Add `[DealStatus.DISPUTED]: 'warning'` to `DEAL_STATUS_VARIANTS`.
  - [x] 4.2 Create `apps/web/src/components/deals/deal-disputed-banner.tsx`:
    - Warning banner with amber alert icon, explaining active dispute status and freeze of automated deadlines.
  - [x] 4.3 Create `apps/web/src/components/deals/deal-cancel-modal.tsx`:
    - Accessible dialog for buyer deal cancellation before proof upload.
  - [x] 4.4 Create `apps/web/src/components/deals/deal-dispute-modal.tsx`:
    - Accessible dialog for filing a formal dispute after proof submission.
  - [x] 4.5 Update `apps/web/src/components/deals/deal-payment-view.tsx`:
    - Render Cancel button when `status === 'AWAITING_PAYMENT_PROOF'` and proofs are all `PENDING`.
    - Render File Dispute button when at least one proof exists and deal is not terminal.
    - Render `DealDisputedBanner` when `status === 'DISPUTED'`.
    - Disable upload controls while deal is in dispute.
  - [x] 4.6 Author Vitest tests in `apps/web/src/components/deals/__tests__/deal-cancel-modal.spec.tsx`, `deal-dispute-modal.spec.tsx`, and `deal-disputed-banner.spec.tsx`.

- [x] Task 5: Seller Web UI Actions (AC: 10)
  - [x] 5.1 Create `apps/web/src/components/deals/seller-cancel-request-modal.tsx`:
    - Modal for sellers to request deal cancellation before payment proof.
  - [x] 5.2 Update seller offer/deal view components (`apps/web/src/components/offers/offer-negotiation-view.tsx`):
    - When `status === CONVERTED_TO_DEAL`: render deal link, status badge, seller cancellation request button / pending indicator, and dispute button.
  - [x] 5.3 Author Vitest tests for seller deal interaction components (`apps/web/src/components/offers/__tests__/seller-deal-actions.spec.tsx`).

- [x] Task 6: Super Admin Dispute Adjudication Workspace (AC: 7, 8, 11)
  - [x] 6.1 Create `apps/web/src/components/admin/dispute-adjudication-queue.tsx`:
    - Table of active and resolved disputes with claim indicators and SLA details.
  - [x] 6.2 Create `apps/web/src/components/admin/dispute-adjudication-workspace.tsx`:
    - Full workspace with 15-minute claim lease banner, deal snapshot, dispute statement, proof inspection, and decision action card.
  - [x] 6.3 Create pages `apps/web/src/app/admin/disputes/page.tsx` and `apps/web/src/app/admin/disputes/[id]/page.tsx`.
  - [x] 6.4 Author Vitest tests in `apps/web/src/components/admin/__tests__/dispute-adjudication-workspace.spec.tsx`.

- [x] Task 7: Full Monorepo Verification & Quality Gates (AC: 12)
  - [x] 7.1 Run shared workspace tests: `npm test --workspace=@elmasaif/shared` (41 test files, 519 tests passing).
  - [x] 7.2 Run backend workspace tests: `npm test --workspace=@elmasaif/api` (15 test suites, 298 tests passing).
  - [x] 7.3 Run web workspace tests: `npm test --workspace=@elmasaif/web` (68 test files, 404 tests passing).
  - [x] 7.4 Run worker workspace tests: `npm test --workspace=@elmasaif/worker` (10 test files, 78 tests passing).
  - [x] 7.5 Run type checks and build across all packages: `npm run build` (Next.js production build succeeded for 46 routes).

## Dev Notes

- **Anti-Deadlock Row Locking Order:**
  Whenever an operation touches multiple tables (`Deal`, `Listing`, `Payment`, `Dispute`), the strict lock order must be maintained:
  1. `Deal`: `SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`
  2. `Listing`: `SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE`
  3. `Payment`: `SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`
  Always cast UUID parameters `${id}::text` to avoid PostgreSQL error 42883 (trap T-1).

- **Partial Index Compliance (`deal_single_active_listing`):**
  The partial index in `apps/api/prisma/sql/deal-invariants.sql` is defined as:
  `CREATE UNIQUE INDEX IF NOT EXISTS deal_single_active_listing ON "deals" ("listingId") WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED');`
  - When `DealStatus.DISPUTED` is set, it is automatically covered by this negative index and continues to reserve the listing.
  - When a deal is cancelled (`status = CANCELLED`), it exits the partial index and immediately allows subsequent offers or deals for that listing.

- **Non-Destructive Schema Evolution (Trap T-7):**
  Only non-destructive additions are made to `apps/api/prisma/schema.prisma`:
  - `ALTER TYPE "DealStatus" ADD VALUE 'DISPUTED'`
  - Adding optional nullable columns to `Deal` (`cancellationReason`, `sellerCancellationRequestedAt`, `sellerCancellationReason`) and `Dispute` (`resolutionAction`, `resolutionNotes`, `resolvedByAdminId`, `resolvedAt`).
  - Re-run `npx prisma db push` or `npm run prisma:push`.

- **Atomic Deal Completion Reuse:**
  Dispute adjudication verdict `COMPLETE` must delegate directly to `DealCompletionService.completeDeal` (implemented in Story 5.4), ensuring consistent ZATCA invoice generation, backup offer closure, listing status transition to `SOLD`, and counterparty contact release.

- **Existing Files to Update:**
  - `apps/api/prisma/schema.prisma`
  - `packages/shared/src/enums/index.ts`
  - `packages/shared/src/constants/deal.ts`
  - `apps/api/src/modules/deals/buyer-deals.controller.ts`
  - `apps/api/src/modules/deals/admin-deals.controller.ts`
  - `apps/api/src/modules/deals/deal-timeout.service.ts`
  - `apps/api/src/modules/deals/deals.module.ts`
  - `apps/web/src/components/deals/deal-status-badge.tsx`
  - `apps/web/src/components/deals/deal-payment-view.tsx`
  - `apps/web/src/components/offers/offer-negotiation-view.tsx`

### Project Structure Notes

- Alignment with unified project structure:
  - Backend controllers and services reside in `apps/api/src/modules/deals/`.
  - Queue claim locking follows `payment-lock.ts` / `offer-lock.ts` pattern with `dispute-lock.ts`.
  - Shared schemas live in `packages/shared/src/schemas/`.
  - Web UI components live in `apps/web/src/components/deals/` and `apps/web/src/components/admin/`.
  - Admin routes live under `apps/web/src/app/admin/disputes/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6: Pre-Payment Cancellations & Dispute Adjudication]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-34: Buyer Cancellation Before Payment]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-36: Deal Dispute Filing, System Escalation & Freeze]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Deal State Transitions Table]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-3, AD-10]
- [Source: _bmad-output/implementation-artifacts/5-5-automated-payment-timeout-worker-job.md]
- [Source: _bmad-output/implementation-artifacts/5-4-atomic-deal-completion-contact-release.md]

## Dev Agent Record

### Agent Model Used

Claude 3.7 Sonnet (BMad Method Context Engine)

### Debug Log References

- Evaluated database schema: verified `model Dispute` already has claim lock columns (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`).
- Evaluated enum `DealStatus` in schema and shared types: planned non-destructive addition of `DISPUTED`.
- Verified `apps/api/prisma/sql/deal-invariants.sql` partial index predicate `NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED')` guarantees seamless index coverage for `DISPUTED`.
- Confirmed `Deals.DisputeResolve` permission exists and is held by `SUPER_ADMIN`.

### Completion Notes List

- Task 1: Updated schema.prisma with `DISPUTED` deal status, cancellation columns on Deal, and resolution columns on Dispute. Updated shared enums, constants, and dispute validation schemas. Added 36 unit tests in `@elmasaif/shared`.
- Task 2: Implemented `DealsCancellationService` with atomic anti-deadlock row locking (`Deal` -> `Listing` -> `Payments`). Wired `POST /deals/:id/cancel-by-buyer`, `POST /deals/:id/seller-cancel-request`, and admin endpoints `POST /admin/deals/:id/seller-cancel/approve` and `reject`. Added comprehensive unit tests (11/11 passed).
- Task 3: Created `DisputesService` and `dispute-lock.ts` implementing AD-10 15-minute claim leases, renewal heartbeats, and force-unlock. Implemented counterparty dispute filing via `POST /deals/:id/dispute` and admin adjudication via `POST /admin/disputes/:id/adjudicate` supporting verdicts: COMPLETE (delegates to `DealCompletionService.completeDealInTransaction`), CANCEL (reverts listing to ACTIVE, expires payments, logs refund review), and RETURN_TO_REVIEW (reverts to UNDER_ADMIN_AUDIT with extended deadline). Wired auto-dispute escalation in `deal-timeout.service.ts` for `PRICE_CONFIRMED_COMMISSION_EXPIRED`. Added unit tests for dispute service and admin disputes controller (18/18 passed).
- Task 4: Created `DealDisputedBanner`, `DealCancelModal`, and `DealDisputeModal`. Updated `DealStatusBadge` with warning variant and `DealPaymentView` with cancellation and dispute filing controls, disabling dropzones when disputed. Added 8 unit tests in `apps/web/src/components/deals/__tests__`.
- Task 5: Updated `OfferNegotiationView` to display converted deal cards with `DealStatusBadge`, pending cancellation notices, seller pre-payment cancellation request modals, and counterparty dispute filing modals. Added component tests in `apps/web/src/components/offers/__tests__/seller-deal-actions.spec.tsx`.
- Task 6: Built Super Admin `DisputeAdjudicationQueue` and `DisputeAdjudicationWorkspace` with 15-minute lease timer, heartbeat renewals, deal/counterparty/payment snapshots, and binding verdict action forms. Created routes `/admin/disputes` and `/admin/disputes/[id]`. Added navigation item in `workspace-shell.tsx`. Added unit tests in `apps/web/src/components/admin/__tests__/dispute-adjudication-workspace.spec.tsx`.
- Task 7: Verified all quality gates across monorepo:
  - `@elmasaif/shared`: 41 test files, 519 passed.
  - `@elmasaif/api`: 15 test suites, 298 passed.
  - `@elmasaif/web`: 68 test files, 404 passed.
  - `@elmasaif/worker`: 10 test files, 78 passed.
  - Full Next.js production build succeeded for 46 routes.

### File List

- `apps/api/prisma/schema.prisma`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/schemas/dispute.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/offer.ts`
- `packages/shared/src/types/ui.ts`
- `packages/shared/src/constants/__tests__/deal.spec.ts`
- `packages/shared/src/deal/__tests__/dispute.spec.ts`
- `apps/api/src/modules/deals/dispute-lock.ts`
- `apps/api/src/modules/deals/deals-cancellation.service.ts`
- `apps/api/src/modules/deals/disputes.service.ts`
- `apps/api/src/modules/deals/admin-disputes.controller.ts`
- `apps/api/src/modules/deals/buyer-deals.controller.ts`
- `apps/api/src/modules/deals/admin-deals.controller.ts`
- `apps/api/src/modules/deals/deal-timeout.service.ts`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/api/src/modules/offers/offer-thread.mapper.ts`
- `apps/api/src/modules/deals/__tests__/deals-cancellation.service.spec.ts`
- `apps/api/src/modules/deals/__tests__/disputes.service.spec.ts`
- `apps/api/src/modules/deals/__tests__/admin-disputes.controller.spec.ts`
- `apps/api/src/modules/deals/__tests__/admin-deals.controller.spec.ts`
- `apps/api/src/modules/deals/__tests__/buyer-deals.controller.spec.ts`
- `apps/api/src/modules/deals/__tests__/deal-timeout.service.spec.ts`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/deals/deal-status-badge.tsx`
- `apps/web/src/components/deals/deal-disputed-banner.tsx`
- `apps/web/src/components/deals/deal-cancel-modal.tsx`
- `apps/web/src/components/deals/deal-dispute-modal.tsx`
- `apps/web/src/components/deals/seller-cancel-request-modal.tsx`
- `apps/web/src/components/deals/deal-payment-view.tsx`
- `apps/web/src/components/deals/index.ts`
- `apps/web/src/components/deals/__tests__/deal-cancel-modal.spec.tsx`
- `apps/web/src/components/deals/__tests__/deal-dispute-modal.spec.tsx`
- `apps/web/src/components/deals/__tests__/deal-disputed-banner.spec.tsx`
- `apps/web/src/components/deals/__tests__/seller-cancel-request-modal.spec.tsx`
- `apps/web/src/components/offers/offer-negotiation-view.tsx`
- `apps/web/src/components/offers/__tests__/seller-deal-actions.spec.tsx`
- `apps/web/src/components/admin/dispute-adjudication-queue.tsx`
- `apps/web/src/components/admin/dispute-adjudication-workspace.tsx`
- `apps/web/src/components/admin/__tests__/dispute-adjudication-workspace.spec.tsx`
- `apps/web/src/app/admin/disputes/page.tsx`
- `apps/web/src/app/admin/disputes/[id]/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/app/properties/page.tsx`
- `apps/web/next.config.ts`

