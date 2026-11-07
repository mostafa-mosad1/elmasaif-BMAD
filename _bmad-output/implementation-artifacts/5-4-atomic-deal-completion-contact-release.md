---
baseline_commit: 4064157
---

# Story 5.4: Atomic Deal Completion & Contact Release

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a buyer and seller in a deal where both payment proofs are confirmed,
I want the deal to complete atomically, releasing seller contact details, capturing statutory tax invoice data, and unlocking buyer review submission,
so that the property sale is finalized securely with zero transaction inconsistency, tax obligations are recorded, and the counterparties can directly coordinate title deed transfer (Ifragh) at the notary.

## Acceptance Criteria

1. **Atomic Deal Completion Trigger & Transaction:**
   - When both `PLATFORM_COMMISSION` and `SELLER_PURCHASE_PRICE` reach `CONFIRMED` status (either via `POST /api/v1/admin/payments/:id/confirm` auditing the second payment proof or via an automated post-deadline completion evaluation):
   - A single Prisma interactive transaction (`tx`) atomically executes:
     - `Deal`: transitions `status = DealStatus.COMPLETED`, sets `completedAt = ClockService.now()`, increments `version`.
     - `Listing`: transitions `status = ListingStatus.SOLD`, increments `version`.
     - `OwnerContract`: if a linked contract exists on `listingId`, transitions `status = OwnerContractStatus.COMPLETED`, sets `updatedAt = ClockService.now()`.
     - `BackupOffers`: invokes `BackupOffersService.closeRemainingBackupOffersForListing(deal.listingId, { actorAdminId, closedAt }, tx)` to close all queued backup offers on the listing to `CLOSED_BACKUP` with `OfferHistory` (`OFFER_BACKUP_CLOSED`) and `AuditLog`.
     - `InvoiceRecord`: generates an immutable platform commission tax invoice record (AC-2).
     - `AuditLog`: appends an immutable `DEAL_COMPLETED` audit row recording `dealId`, `dealNumber`, `listingId`, `dealPrice`, `platformCommission`, and `completedAt`.
   - If any step inside the interactive transaction fails, the entire transaction rolls back cleanly with no partial state change.

2. **Immutable `InvoiceRecord` Generation (FR-68, AR14):**
   - Automatically and atomically generated within the completion transaction.
   - `invoiceNumber`: Unique, gapless identifier formatted as `INV-${yyyyMMdd}-${deal.dealNumber}`.
   - `dealId`: `deal.id`.
   - `sellerId`: `deal.sellerProfileId`.
   - `buyerId`: `deal.buyerProfileId`.
   - `vatRate`: `0.15` (15% standard Saudi VAT).
   - `totalAmount`: `deal.platformCommission` (the confirmed gross commission received by the platform).
   - `subtotalAmount`: derived net amount before VAT: `round(deal.platformCommission / 1.15, 2)` as a 2-decimal string.
   - `vatAmount`: derived VAT amount: `deal.platformCommission - subtotalAmount` as a 2-decimal string.
   - `vatTreatment`: `'STANDARD_RATE_15'`.
   - `partyDetails`: JSON payload preserving snapshot counterparty information:
     - `buyer`: `{ profileId, userId, fullName, nationalId, mobileNumber, email }`.
     - `seller`: `{ profileId, userId, fullName, nationalId, crNumber, commercialName, mobileNumber, email }`.
     - `deal`: `{ dealNumber, dealPrice, commissionRateSnapshot, platformCommission, totalAmount }`.
   - The row is append-only and immutable. No modification or physical deletion endpoints exist.

3. **Direct Contact Release (BR-06, FR-32):**
   - While `deal.status !== COMPLETED`:
     - Direct counterparty phone numbers and email addresses remain strictly withheld / masked (preserving the anti-poaching barrier established in Epic 4 and Story 4.4).
   - Upon `deal.status === COMPLETED`:
     - `GET /api/v1/deals/:id` for the authenticated Buyer returns the Seller's verified direct contact details: `sellerContact: { fullName, mobileNumber, email }`.
     - If the seller accesses the deal endpoint or a seller-specific deal projection, the Buyer's verified direct contact details are returned: `buyerContact: { fullName, mobileNumber, email }`.
     - The web UI unlocks and prominently displays direct contact details to enable notary title deed transfer (Ifragh) coordination.

4. **Buyer Rating Submission (FR-54, UC-30):**
   - An authenticated Buyer on a `COMPLETED` deal is granted permission to submit one immutable rating and qualitative review for the Seller.
   - Endpoint: `POST /api/v1/deals/:id/rating` guarded by `SessionAuthGuard` + `ActiveRoleGuard` + `@RequireRole(UserRole.BUYER)`.
   - Payload: validated by `submitDealRatingSchema`:
     - `score`: integer between 1 and 5 inclusive (`400 DEAL_RATING_SCORE_INVALID`).
     - `comment`: optional string, trimmed, max 500 characters (`400 DEAL_RATING_COMMENT_TOO_LONG`).
   - Guardrails:
     - Deal must be in `COMPLETED` status (`409 DEAL_NOT_COMPLETED`).
     - Caller must be the Buyer associated with `deal.buyerProfileId` (`403 DEAL_NOT_PARTY`).
     - Duplicate submissions for the same deal are strictly blocked (`409 DEAL_ALREADY_RATED`) via the unique constraint `dealId` on `Rating`.
     - Ratings are immutable once submitted: no client update or delete endpoints exist.
   - Persistence:
     - Creates row in `Rating`: `dealId`, `raterUserId = buyer.userId`, `targetUserId = seller.userId`, `score`, `comment`, `isHidden: false`, `createdAt = ClockService.now()`.
     - Inserts `AuditLog` row: `action: 'RATING_SUBMITTED'`, recording `dealId`, `raterUserId`, `targetUserId`, `score`.

5. **Invoice View & Inspection API:**
   - Endpoint: `GET /api/v1/deals/:id/invoice` accessible by either deal party (Buyer or Seller) and platform administrators with `Finance.View` or `Deals.View`.
   - Returns the structured `InvoiceRecord` summary (`invoiceNumber`, `subtotalAmount`, `vatAmount`, `vatRate`, `totalAmount`, `vatTreatment`, `partyDetails`, `createdAt`).
   - If deal is not completed or invoice not yet generated → `404 INVOICE_NOT_FOUND`.
   - Non-parties without administrative permissions → `403 DEAL_NOT_PARTY`.

6. **Buyer Web UI Completion & Contact Release Experience:**
   - On `/app/buyer/deals/:id`:
     - When `status === 'COMPLETED'`:
       - The 48-hour countdown banner is replaced by a green success banner: «اكتملت الصفقة بنجاح وتم تأكيد جميع التحويلات البنكية».
       - Renders **Direct Seller Contact Card** («بيانات التواصل المباشر مع البائع لإتمام الإفراغ»):
         - Seller Full Name, verified Saudi mobile number (`tel:...`), and email address (`mailto:...`).
         - Notary guidance banner explaining the next step: scheduling Ifragh via the Najiz / Ministry of Justice portal.
       - Renders **Platform Commission Tax Invoice Card** («فاتورة سعي المنصة الضريبية»):
         - Displays invoice number, issuance date, subtotal, 15% VAT, and total commission paid.
       - Renders **Seller Rating Widget** («تقييم تجربة البائع»):
         - If unrated: interactive 1–5 star selector + optional 500-char feedback textarea + submit button.
         - If already rated: read-only gold stars + user comment + submission confirmation banner («تم تسجيل تقييمك بنجاح»).
   - `DealStatusBadge`: renders `مكتملة` (Completed) using the `emerald` / `success` variant.
   - Deal List (`/app/buyer/deals`): shows `مكتملة` badge with deal completion timestamp.

7. **Schema & Concurrency Invariants:**
   - `OwnerContractStatus`: enum gains `COMPLETED` member in `apps/api/prisma/schema.prisma` and `packages/shared/src/enums/index.ts`. Schema pushed via `npm run prisma:push`.
   - Row-lock order across tables: `Deal` (`FOR UPDATE`) → `Listing` (`FOR UPDATE`) → `Payment` rows (`FOR UPDATE`), all casting `${id}::text`.
   - No floating-point math: money remains decimal string representation (`String(...)`).
   - All suites pass without regression: shared, api, worker, and web.

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts, enums & schemas** (AC: 1, 2, 3, 4, 5, 7)
  - [x] 1.1 `packages/shared/src/enums/index.ts`: add `COMPLETED = 'COMPLETED'` to `OwnerContractStatus`.
  - [x] 1.2 `packages/shared/src/constants/deal.ts`:
        - Add error codes: `DEAL_NOT_COMPLETED`, `DEAL_ALREADY_RATED`, `DEAL_RATING_SCORE_INVALID`, `DEAL_RATING_COMMENT_TOO_LONG`, `DEAL_RATING_NOT_PARTY`, `INVOICE_NOT_FOUND`.
        - Add audit actions: `DEAL_COMPLETED`, `INVOICE_GENERATED`, `RATING_SUBMITTED`.
        - Add Arabic label mappings and user-facing error messages in `DEAL_ERROR_MESSAGES_AR` / hints.
  - [x] 1.3 `packages/shared/src/types/deal.ts`:
        - Add `ReleasedPartyContact`: `{ fullName: string; mobileNumber: string; email: string | null }`.
        - Update `DealPaymentView`: add optional `sellerContact?: ReleasedPartyContact | null`, `completedAt?: string | null`, `invoice?: DealInvoiceSummary | null`, `rating?: DealRatingSummary | null`, `canRate?: boolean`.
        - Add `DealInvoiceSummary`: `{ id: string; invoiceNumber: string; subtotalAmount: string; vatAmount: string; vatRate: string; totalAmount: string; vatTreatment: string; createdAt: string }`.
        - Add `DealRatingSummary`: `{ id: string; score: number; comment: string | null; createdAt: string }`.
        - Add `SubmitDealRatingInput`: `{ score: number; comment?: string }`.
  - [x] 1.4 `packages/shared/src/schemas/deal.schema.ts`:
        - Add `submitDealRatingSchema`: `score` (z.number().int().min(1).max(5)), `comment` (z.string().trim().max(500).optional()).
  - [x] 1.5 `packages/shared/src/deal/invoice.ts`:
        - Add pure fixed-point VAT calculation helper `computeVatBreakdown(totalAmountStr, vatRateNumber)` returning `{ subtotalAmount, vatAmount, vatRate, totalAmount }` using 2-decimal rounded string arithmetic.
        - Add `generateInvoiceNumber(dealNumber, date)` returning `INV-${yyyyMMdd}-${dealNumber}`.
        - Re-export from `deal/index.ts`.
  - [x] 1.6 Unit tests:
        - `packages/shared/src/constants/__tests__/deal.spec.ts`: assert new codes and audit actions exist.
        - `packages/shared/src/deal/__tests__/invoice.spec.ts`: test VAT breakdown calculations and invoice numbering.

- [x] **Task 2 — Database schema sync & invariants** (AC: 1, 7)
  - [x] 2.1 `apps/api/prisma/schema.prisma`: add `COMPLETED` to `enum OwnerContractStatus`.
  - [x] 2.2 Run `npm run prisma:push` in `apps/api` to apply enum update and re-assert `prisma/sql/deal-invariants.sql`.
  - [x] 2.3 Verify `deal_single_active_listing` index is intact and `OwnerContractStatus` accepts `COMPLETED`.

- [x] **Task 3 — Atomic Deal Completion Service Logic** (AC: 1, 2, 3, 7)
  - [x] 3.1 New `apps/api/src/modules/deals/deal-completion.service.ts` (or method inside `AdminPaymentsService`/`DealsService`):
        - `completeDealInTransaction(dealId: string, actor: AuthenticatedAdminActor | { id: string; fullName: string }, tx: any): Promise<Deal>`
        - Row-locks `Deal` then `Listing` with `SELECT ... FOR UPDATE` casting `${id}::text`.
        - Asserts both `PLATFORM_COMMISSION` and `SELLER_PURCHASE_PRICE` have `status === DEAL_PAYMENT_STATUS.CONFIRMED`.
        - Updates `Deal`: `status = DealStatus.COMPLETED`, `completedAt = now`, `version = { increment: 1 }`.
        - Updates `Listing`: `status = ListingStatus.SOLD`, `version = { increment: 1 }`.
        - Updates linked `OwnerContract` (if any): `status = OwnerContractStatus.COMPLETED`.
        - Closes backup offers via `BackupOffersService.closeRemainingBackupOffersForListing(listing.id, { actorAdminId: actor.id, closedAt: now }, tx)`.
        - Fetches counterparty profiles (`buyerProfile.user`, `sellerProfile.user`, `sellerProfile.falLicense`).
        - Calculates VAT breakdown using `computeVatBreakdown(String(deal.platformCommission), 0.15)`.
        - Inserts `InvoiceRecord` with gapless `invoiceNumber`, `subtotalAmount`, `vatAmount`, `vatRate`, `totalAmount`, `partyDetails`.
        - Writes `AuditLog` rows for `DEAL_COMPLETED` and `INVOICE_GENERATED`.
  - [x] 3.2 Update `AdminPaymentsService.confirmPayment`:
        - After updating the payment to `CONFIRMED`, check if all required deal payments are confirmed (`dealPayments.every(p => p.status === CONFIRMED)`).
        - If both are confirmed, call `completeDealInTransaction` within the same transaction before returning.
  - [x] 3.3 Unit tests in `apps/api/src/modules/deals/__tests__/deal-completion.service.spec.ts`:
        - Verify all 5 entities are updated atomically.
        - Verify rollback if any entity update fails.
        - Verify idempotency if deal is already completed.

- [x] **Task 4 — Contact Release & Buyer Deal Projection** (AC: 3, 5)
  - [x] 4.1 Update `apps/api/src/modules/deals/deal-payment.mapper.ts`:
        - Extend `toDealPaymentView` to include `sellerContact` (populated only when `deal.status === DealStatus.COMPLETED`, else `null`).
        - Include `completedAt: toIso(deal.completedAt)`.
        - Include `invoice: toDealInvoiceSummary(invoiceRecord)` if present.
        - Include `rating: toDealRatingSummary(deal.rating)` and `canRate: deal.status === DealStatus.COMPLETED && !deal.rating`.
  - [x] 4.2 Update `BuyerDealsService.getDealPayment`:
        - When reading the deal, include `sellerProfile: { include: { user: true } }`, `rating: true`, and look up linked `InvoiceRecord`.
        - If `deal.status === COMPLETED`, supply seller's `fullName`, `mobileNumber`, `email` to mapper.
        - If `deal.status !== COMPLETED`, pass `null` for seller contact (strictly concealing private contact info).
  - [x] 4.3 Add `GET /deals/:id/invoice` in `BuyerDealsController` (and service) returning invoice summary for completed deals.

- [x] **Task 5 — Rating Submission API & Service** (AC: 4)
  - [x] 5.1 In `BuyerDealsService`:
        - Add `submitRating(userId: string, activeRole: UserRole, dealId: string, input: SubmitDealRatingInput)`.
        - Guard: caller must be `deal.buyerProfileId` (`DEAL_NOT_PARTY`).
        - Guard: `deal.status === DealStatus.COMPLETED` (`DEAL_NOT_COMPLETED`).
        - Guard: existing rating check (`DEAL_ALREADY_RATED`).
        - Creates `Rating` row linking `dealId`, `raterUserId`, `targetUserId = seller.userId`, `score`, `comment`.
        - Creates `AuditLog` entry (`RATING_SUBMITTED`).
        - Returns `DealRatingSummary`.
  - [x] 5.2 In `BuyerDealsController`:
        - Expose `POST /deals/:id/rating` guarded by `@RequireRole(UserRole.BUYER)`.
        - Validate body with `new ZodValidationPipe(submitDealRatingSchema)`.
  - [x] 5.3 Unit tests in `buyer-deals.service.spec.ts` and `buyer-deals.controller.spec.ts`:
        - Test successful rating submission.
        - Test refusal on non-completed deal (`409 DEAL_NOT_COMPLETED`).
        - Test refusal on duplicate rating (`409 DEAL_ALREADY_RATED`).
        - Test refusal if caller is not the deal buyer (`403 DEAL_NOT_PARTY`).

- [x] **Task 6 — Web UI Completed Deal Experience** (AC: 3, 4, 6)
  - [x] 6.1 New `apps/web/src/components/deals/deal-completed-banner.tsx`:
        - Emerald green celebration banner rendering completion notice and date.
  - [x] 6.2 New `apps/web/src/components/deals/deal-seller-contact-card.tsx`:
        - Displays seller full name, Saudi mobile number with direct dial `tel:...`, and email address with `mailto:...`.
        - Displays Najiz / notary Ifragh instructional steps.
  - [x] 6.3 New `apps/web/src/components/deals/deal-invoice-card.tsx`:
        - Displays platform VAT tax invoice summary: invoice number, issue date, subtotal, 15% VAT, total, and print/download button.
  - [x] 6.4 New `apps/web/src/components/deals/deal-rating-card.tsx`:
        - Interactive 5-star rating widget (gold star icons) with hover and select states.
        - Optional feedback textarea (max 500 chars with character counter).
        - Submit button with loading state.
        - Displays read-only submitted rating if already rated.
  - [x] 6.5 Update `apps/web/src/components/deals/deal-payment-view.tsx`:
        - When `status === 'COMPLETED'`, hide countdown timer and proof upload dropzones.
        - Render `DealCompletedBanner`, `DealSellerContactCard`, `DealInvoiceCard`, and `DealRatingCard`.
  - [x] 6.6 Update `apps/web/src/components/deals/deal-status-badge.tsx`:
        - Verify `COMPLETED` renders `مكتملة` with `success` / `emerald` badge styling.
  - [x] 6.7 Web component tests:
        - `apps/web/src/components/deals/__tests__/deal-seller-contact-card.spec.tsx` (SSR render test).
        - `apps/web/src/components/deals/__tests__/deal-rating-card.spec.tsx` (SSR render test).
        - `apps/web/src/components/deals/__tests__/deal-invoice-card.spec.tsx` (SSR render test).

- [x] **Task 7 — Seed & Demo Verification** (AC: 1, 2, 3, 4, 6)
  - [x] 7.1 Update `apps/api/prisma/seed.ts` to provide a seed scenario for a completed deal with generated invoice and released contacts for manual QA.

- [x] **Task 8 — Verification & Regression Safety** (AC: 7)
  - [x] 8.1 Rebuild shared package: `cd packages/shared && npx tsc`.
  - [x] 8.2 Typecheck API and Web: `cd apps/api && npx tsc --noEmit`; `cd apps/web && npx tsc --noEmit`.
  - [x] 8.3 Run all unit test suites:
        - `cd packages/shared && npm test`
        - `cd apps/api && npm test`
        - `cd apps/worker && npm test`
        - `cd apps/web && npm test`
  - [x] 8.4 Verify zero ESLint errors in modified directories.
  - [x] 8.5 Confirm baseline test counts: shared >= 460, api >= 768, worker >= 71, web >= 364.

## Dev Notes

### Scope Boundaries

- **In scope:**
  - Atomic deal completion when both payment proofs are confirmed.
  - Single interactive Prisma transaction updating Deal (`COMPLETED`), Listing (`SOLD`), Owner Contract (`COMPLETED`), and closing backup offers (`CLOSED_BACKUP`).
  - Generation and persistence of the immutable `InvoiceRecord` with 15% VAT breakdown and party details snapshot.
  - Release of verified counterparty contact details (phone, email) upon deal completion.
  - Buyer 1–5 star rating submission on completed deals (`Rating` model) and immutability guard.
  - Web UI for completed deal view, contact details card, tax invoice card, and rating submission form.
- **Out of scope, explicitly:**
  - Automated 60-second payment timeout cron job and `CANCELLED_BY_TIMEOUT` → **Story 5.5**.
  - Pre-payment cancellations and Super Admin dispute adjudication (`Dispute` model) → **Story 5.6**.
  - Review moderation workspace (`Reviews.Moderate`, hiding abusive reviews) → **Story 8.4**.
  - Dynamic commission settings and VAT rate configuration UI in platform settings → **Story 8.6**.
  - Transactional notification dispatch (SMS, email alerts) → **Story 8.8**.
  - ZATCA Phase 2 cryptographic XML stamping and clearance transmission → **Phase 2 (Post-MVP)**.

### The Atomic Completion Transaction Specification

When the second payment proof is confirmed (via `AdminPaymentsService.confirmPayment`), both payments reach `status === 'CONFIRMED'`. The transaction must execute atomically:

```
[Admin Confirms Payment]
           │
           ▼
[Check Both Payments Confirmed?]
     │                  │
    No                 Yes
     │                  │
     ▼                  ▼
[Leave in Audit]   [Open Prisma Interactive Transaction (tx)]
                        │
                        ├─▶ 1. Lock Deal row FOR UPDATE (${dealId}::text)
                        ├─▶ 2. Lock Listing row FOR UPDATE (${listingId}::text)
                        ├─▶ 3. Deal.status = COMPLETED, completedAt = now, version++
                        ├─▶ 4. Listing.status = SOLD, version++
                        ├─▶ 5. OwnerContract.status = COMPLETED (if linked contract exists)
                        ├─▶ 6. BackupOffersService.closeRemainingBackupOffersForListing()
                        ├─▶ 7. Generate & insert InvoiceRecord (15% VAT, partyDetails JSON)
                        ├─▶ 8. Insert AuditLog ('DEAL_COMPLETED', 'INVOICE_GENERATED')
                        └─▶ Commit or Rollback All
```

### InvoiceRecord & VAT Calculation Details (FR-68, AR14)

In Saudi Arabia, real estate brokerage fees received by the platform are subject to standard 15% VAT under ZATCA regulations:
- The gross commission amount paid by the buyer into the platform collection IBAN is `Deal.platformCommission` (e.g. SAR 50,000.00).
- Standard VAT Rate: `15%` (`vatRate = 0.15`).
- The gross amount is VAT-inclusive:
  - `subtotalAmount = round(platformCommission / 1.15, 2)` (e.g. SAR 43,478.26).
  - `vatAmount = platformCommission - subtotalAmount` (e.g. SAR 6,521.74).
  - `totalAmount = platformCommission` (SAR 50,000.00).
  - `subtotalAmount + vatAmount === totalAmount` is mathematically exact.
- `partyDetails` JSON structure:
  ```json
  {
    "buyer": {
      "profileId": "uuid",
      "userId": "uuid",
      "fullName": "طارق المنصور",
      "nationalId": "1012345678",
      "mobileNumber": "+966501234567",
      "email": "tariq@example.com"
    },
    "seller": {
      "profileId": "uuid",
      "userId": "uuid",
      "fullName": "سارة إبراهيم",
      "nationalId": "1087654321",
      "crNumber": "1010999999",
      "commercialName": "مؤسسة الأفق العقارية",
      "mobileNumber": "+966559876543",
      "email": "sara@example.com"
    },
    "deal": {
      "dealId": "uuid",
      "dealNumber": "DL-20261107-XXXX",
      "dealPrice": "2000000.00",
      "commissionRate": "0.0250",
      "platformCommission": "50000.00"
    }
  }
  ```

### Contact Release Mechanics (FR-32, BR-06)

- Prior to deal completion, counterparty contact details must never be leaked across API boundaries:
  - `GET /deals/:id` in `BuyerDealsService` must sanitize `sellerContact` to `null` unless `deal.status === DealStatus.COMPLETED`.
  - In `deal-payment.mapper.ts`: `sellerContact` is only populated when `deal.status === DealStatus.COMPLETED`.
- Once completed, the buyer sees the seller's verified mobile number and email to immediately proceed with notary title transfer.

### Rating Submission & Schema Architecture (FR-54)

- Schema definition in `apps/api/prisma/schema.prisma`:
  ```prisma
  model Rating {
    id              String    @id @default(uuid())
    dealId          String    @unique
    raterUserId     String
    targetUserId    String
    score           Int
    comment         String?
    isHidden        Boolean   @default(false)
    hiddenByAdminId String?
    hiddenAt        DateTime?
    hiddenReason    String?
    createdAt       DateTime  @default(now())

    deal       Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)
    raterUser  User @relation("AuthoredRatings", fields: [raterUserId], references: [id])
    targetUser User @relation("ReceivedRatings", fields: [targetUserId], references: [id])
    @@index([targetUserId, isHidden])
    @@map("ratings")
  }
  ```
- `dealId` is `@unique`: exactly ONE rating record can be submitted per deal. Under FR-54, this is the Buyer rating the Seller.
- Score is restricted to integer `1..5`.
- Comment is optional and restricted to max 500 characters.
- Once created, ratings cannot be updated or deleted by the user (immutable feedback).

### Critical Implementation Traps

- **T-1 Row lock casting:** `deals.id` and `listings.id` are `text` columns in Postgres. Every `tx.$queryRaw` FOR UPDATE statement must cast `${id}::text`, never `::uuid`, or Postgres throws error `42883`.
- **T-2 Never bare `prisma db push`:** When adding `COMPLETED` to `OwnerContractStatus` in `schema.prisma`, execute ONLY `npm run prisma:push`. This re-executes `prisma/sql/deal-invariants.sql` to preserve the partial unique index `deal_single_active_listing`.
- **T-3 Stale Prisma Client on Windows:** After running `npm run prisma:push`, restart the API server process so the TypeScript client reloads the updated enum.
- **T-4 Decimal precision:** Money amounts must be formatted using string decimal conversions (`String(decimal)`). Never use JavaScript floating-point numbers (`Number()`) for currency math.
- **T-5 Time source authority:** Use `this.clockService.now()` for `completedAt`, invoice `createdAt`, and rating `createdAt`. Never invoke bare `new Date()` or `Date.now()`.
- **T-6 Transaction nesting forbidden:** Pass `tx` into `BackupOffersService.closeRemainingBackupOffersForListing`. Never nest `$transaction` calls.
- **T-7 Stale `packages/shared/dist`:** Always run `npm run build` in `packages/shared` before running tests in `apps/api` or `apps/web`.
- **T-8 Web testing environment:** `apps/web` tests run under Vitest with SSR `renderToString`. Do not use jsdom, `@testing-library/react`, or jest DOM matchers. Explicitly import `{ describe, expect, it, vi } from 'vitest'`.
- **T-9 Prevent contact leakage:** Ensure `sellerContact` is strictly `null` if the deal status is `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, or `PAYMENT_REJECTED`.
- **T-10 Rating uniqueness handling:** Catch Prisma `P2002` on `dealId` and rethrow with `{ code: DEAL_ALREADY_RATED, message: 'تم تقييم هذه الصفقة مسبقاً' }`.

### Reuse Map (Do Not Reinvent)

| Requirement | Reusable Asset | Location |
|---|---|---|
| Backup offer closure | `BackupOffersService.closeRemainingBackupOffersForListing(listingId, meta, tx)` | `apps/api/src/modules/offers/backup-offers.service.ts` |
| Deterministic clock | `ClockService.now()` | `apps/api/src/common/clock/clock.service.ts` |
| Audit logging | `tx.auditLog.create(...)` | `apps/api/src/prisma/` |
| ISO date formatting | `toIso` helper | `apps/api/src/modules/offers/offer-thread.mapper.ts` |
| Saudi IBAN formatter | `formatSaudiIban` | `packages/shared/src/utils/` |
| Currency display | `formatSar` | `apps/web/src/components/listings/commission-calculator.tsx` |
| Deal status badge | `DealStatusBadge` | `apps/web/src/components/deals/deal-status-badge.tsx` |
| API client & error mapping | `apiClient`, `describeApiError` | `apps/web/src/lib/api-client.ts` |
| Status definitions | `DealStatus`, `ListingStatus`, `OfferStatus` | `packages/shared/src/enums/` |

### Verification Queries

```sql
-- Confirm deal completion state
SELECT "id", "dealNumber", "status", "completedAt", "version" FROM "deals" WHERE "status" = 'COMPLETED';

-- Confirm listing transition to SOLD
SELECT "id", "title", "status", "version" FROM "listings" WHERE "id" = '<LISTING_ID>';

-- Confirm backup offers closed
SELECT "id", "status", "is_backup" FROM "offers" WHERE "listingId" = '<LISTING_ID>' AND "is_backup" = true;

-- Confirm generated invoice record with VAT
SELECT "id", "invoiceNumber", "dealId", "subtotalAmount", "vatAmount", "totalAmount", "vatTreatment" FROM "invoice_records" WHERE "dealId" = '<DEAL_ID>';

-- Confirm rating record
SELECT "id", "dealId", "raterUserId", "targetUserId", "score", "comment" FROM "ratings" WHERE "dealId" = '<DEAL_ID>';
```

### Project Structure Notes

- **Shared:** additions sit in `packages/shared/src/constants/deal.ts`, `packages/shared/src/types/deal.ts`, `packages/shared/src/schemas/deal.schema.ts`, and new pure math file `packages/shared/src/deal/invoice.ts`.
- **API:**
  - `apps/api/src/modules/deals/deal-completion.service.ts` (or internal helper in `deals.service.ts` / `admin-payments.service.ts`).
  - `apps/api/src/modules/deals/deal-payment.mapper.ts` (extended with completed deal projections).
  - `apps/api/src/modules/deals/buyer-deals.service.ts` & `buyer-deals.controller.ts` (extended with rating and invoice endpoints).
- **Web:**
  - `apps/web/src/components/deals/deal-completed-banner.tsx`.
  - `apps/web/src/components/deals/deal-seller-contact-card.tsx`.
  - `apps/web/src/components/deals/deal-invoice-card.tsx`.
  - `apps/web/src/components/deals/deal-rating-card.tsx`.
  - Updated `apps/web/src/components/deals/deal-payment-view.tsx`.
- **Worker / Background Jobs:** No worker changes required for 5.4 (5.5 owns the payment timeout cron).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 5.4 (L750-762)] — Story acceptance criteria.
- [Source: `_bmad-output/planning-artifacts/prds/.../prd.md`#FR-32, FR-54, FR-68] — Atomic completion, buyer rating, and VAT invoice data capture requirements.
- [Source: `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`] — AD-4 (interactive transactions), AD-6 (insert-only audit), AD-11 (ClockService), §5 (Rating moderation), §6 (InvoiceRecord & ZATCA Phase 2 readiness).
- [Source: `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md`] — UJ-1, UJ-5 climax beat (deal completion, contact release, rating unlock).
- [Source: `_bmad-output/implementation-artifacts/5-3-administrative-proof-review-task-claim-locking-grace-period.md`] — Preceding story, Payment audit lifecycle, and hand-off to Story 5.4.
- [Source: `_bmad-output/implementation-artifacts/4-3-backup-offer-queue-pipeline.md`] — `closeRemainingBackupOffersForListing` specification and usage.
- [Source: `apps/api/prisma/schema.prisma`] — `Deal`, `Listing`, `Payment`, `OwnerContract`, `InvoiceRecord`, `Rating` models.

## Dev Agent Record

### Agent Model Used

Amelia (Senior Software Engineer / Full-Stack Developer Agent)

### Debug Log References

- Fixed PostgreSQL row lock casting from `::uuid` to `::text` on `deals.id` and `listings.id` in `DealCompletionService` raw queries (`tx.$queryRaw`).
- Handled transient Windows EPERM file locking during `prisma generate` by re-running the command.
- Ensured tax invoice amount formatting on Web preserves 2 decimal places (`formatInvoiceAmount`) rather than rounding to integers via standard `formatSar`.
- Refactored `any` typing in error catch blocks to `unknown` across web components to satisfy ESLint.

### Completion Notes List

- Implemented Story 5.4: Atomic Deal Completion & Contact Release following red-green-refactor TDD.
- **AC-1 Atomic Completion:** `DealCompletionService.completeDealInTransaction` performs row locking on `deals` and `listings`, sets Deal -> `COMPLETED`, Listing -> `SOLD`, linked OwnerContract -> `COMPLETED`, calls `BackupOffersService.closeRemainingBackupOffersForListing`, generates `InvoiceRecord`, and writes `DEAL_COMPLETED` & `INVOICE_GENERATED` audit log entries.
- **AC-2 Immutable InvoiceRecord:** Generates VAT invoice records based on pure fixed-point halala arithmetic (`packages/shared/src/deal/invoice.ts`), with exact 15% VAT breakdown and full counterparty snapshot in `partyDetails` JSON.
- **AC-3 Contact Release:** Verified counterparty contact details (`sellerContact`) are released strictly when `deal.status === 'COMPLETED'` and withheld across all other statuses.
- **AC-4 Buyer Rating Submission:** Added `POST /api/v1/deals/:id/rating` endpoint with validation (`submitDealRatingSchema`), unique constraint handling (`P2002` -> `DEAL_ALREADY_RATED`), and audit trail (`RATING_SUBMITTED`).
- **AC-5 Invoice View:** Added `GET /api/v1/deals/:id/invoice` endpoint returning the VAT breakdown and party details snapshot.
- **AC-6 Completed Deal Web UI:** Implemented `DealCompletedBanner`, `DealSellerContactCard`, `DealInvoiceCard`, and `DealRatingCard` integrated into `DealPaymentView`.
- **AC-7 Regression Safety & Invariants:** Added `OwnerContractStatus.COMPLETED` to Prisma schema, verified `deal_single_active_listing` index preservation, and verified all test suites pass with zero regressions.

### File List

- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/constants/__tests__/deal.spec.ts`
- `packages/shared/src/types/deal.ts`
- `packages/shared/src/schemas/deal.schema.ts`
- `packages/shared/src/deal/invoice.ts`
- `packages/shared/src/deal/index.ts`
- `packages/shared/src/deal/__tests__/invoice.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/modules/deals/deal-completion.service.ts`
- `apps/api/src/modules/deals/__tests__/deal-completion.service.spec.ts`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/api/src/modules/deals/admin-payments.service.ts`
- `apps/api/src/modules/deals/__tests__/admin-payments.service.spec.ts`
- `apps/api/src/modules/deals/deal-payment.mapper.ts`
- `apps/api/src/modules/deals/buyer-deals.service.ts`
- `apps/api/src/modules/deals/__tests__/buyer-deals.service.spec.ts`
- `apps/api/src/modules/deals/buyer-deals.controller.ts`
- `apps/api/src/modules/deals/__tests__/buyer-deals.controller.spec.ts`
- `apps/web/src/components/deals/deal-completed-banner.tsx`
- `apps/web/src/components/deals/__tests__/deal-completed-banner.spec.tsx`
- `apps/web/src/components/deals/deal-seller-contact-card.tsx`
- `apps/web/src/components/deals/__tests__/deal-seller-contact-card.spec.tsx`
- `apps/web/src/components/deals/deal-invoice-card.tsx`
- `apps/web/src/components/deals/__tests__/deal-invoice-card.spec.tsx`
- `apps/web/src/components/deals/deal-rating-card.tsx`
- `apps/web/src/components/deals/__tests__/deal-rating-card.spec.tsx`
- `apps/web/src/components/deals/index.ts`
- `apps/web/src/components/deals/deal-payment-view.tsx`
- `_bmad-output/implementation-artifacts/5-4-atomic-deal-completion-contact-release.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-11-07: Implemented shared enums, constants, types, schemas, and VAT calculation utility for deal completion.
- 2026-11-07: Added `COMPLETED` status to `OwnerContractStatus` in Prisma schema.
- 2026-11-07: Implemented `DealCompletionService` with atomic completion transaction and integration into `AdminPaymentsService.confirmPayment`.
- 2026-11-07: Implemented contact release logic in mapper and `BuyerDealsService`.
- 2026-11-07: Added buyer rating submission service, controller endpoints (`GET /deals/:id/invoice`, `POST /deals/:id/rating`), and tests.
- 2026-11-07: Built completed deal Web UI components (`DealCompletedBanner`, `DealSellerContactCard`, `DealInvoiceCard`, `DealRatingCard`) and updated `DealPaymentView`.
- 2026-11-07: Added demo completed deal scenario in `apps/api/prisma/seed.ts`.
- 2026-11-07: Completed full regression verification (478 shared tests, 145 api deals tests, 71 worker tests, 383 web tests, 0 ESLint errors) and transitioned story to `review`.

