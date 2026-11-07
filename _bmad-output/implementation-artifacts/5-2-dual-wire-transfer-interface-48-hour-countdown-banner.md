---
baseline_commit: 17d56186dda0b0491b6160a5db155007e9a4dd2a
---

# Story 5.2: Dual Wire Transfer Interface & 48-Hour Countdown Banner

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a buyer with an active deal,
I want a dedicated deal payment screen with a 48-hour countdown timer, grace period notice, and dual bank transfer instructions,
so that I can transfer funds to the platform and seller accurately and upload receipts before the deadline.

## Acceptance Criteria

1. **Buyer-only, ownership-scoped detail endpoint.** `GET /api/v1/deals/:id` returns the buyer's deal
   payment view. It is guarded by `SessionAuthGuard` + `ActiveRoleGuard` with `@RequireRole(UserRole.BUYER)`.
   A deal whose `buyerProfileId` is not the caller's ACTIVE BUYER profile returns
   `403 DEAL_NOT_PARTY`; an unknown id returns `404 DEAL_NOT_FOUND`. Both carry an Arabic message.
   Response `200 { statusCode, message?, data: DealPaymentView }`, and the body carries **no** seller
   mobile number, email, or IBAN ciphertext.
2. **Reachable surface.** `GET /api/v1/deals/my` (literal route declared **before** `:id`) returns
   `DealSummary[]` — the caller's deals, newest first — and the buyer workspace exposes
   `/app/buyer/deals` (list) + `/app/buyer/deals/[id]` (payment screen) plus a sidebar entry. The deal
   id returned by Story 5.1's `POST /admin/deals/final-approve` is therefore clickable without a manual URL.
3. **48-hour countdown banner (UX-DR5).** The deal screen renders a prominent gold banner
   (`bg-accent-light`, `border-accent`) containing: a live `HH:MM:SS` countdown in `font-mono` with
   Arabic unit labels (`ساعة : دقيقة : ثانية`), a determinate progress bar measuring elapsed time from
   `createdAt` to `paymentDeadline`, and the verbatim administrative notice
   «رفع إيصال التحويل يوقف الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة في حال الرفض دون إلغاء فوري.»
   The countdown is anchored to the API's `serverNow`, never to the browser's `Date.now()` (trap T-4).
   At zero it stops at `00:00:00`, shows the expired state, and disables both upload zones — it never
   renders a negative value.
4. **Card 1 — Platform commission (UX-DR4).** First card in RTL order (`deal-platform-fee` border,
   `deal-platform-fee-bg` background): the platform Saudi IBAN in `font-mono` with a copy control,
   the frozen commission amount (`platformCommission`), the frozen reference code
   (`ELM-XXXXXXXXXX-C`, read from `Deal.dealReferenceCode` — **never regenerated**), and a receipt
   upload dropzone. A frozen financial summary (price, 2.5 % snapshot rate, total payable) is visible
   without leaving the screen.
5. **Card 2 — Seller purchase price (UX-DR4).** Second card (`surface-borderStrong` border,
   `deal-seller-price-bg` background): the seller's frozen verified name (`sellerPayoutHolderName`),
   the **full unmasked** seller Saudi IBAN (decrypted from `sellerPayoutIbanEncrypted` and returned
   formatted in groups of four via `formatSaudiIban`), the frozen price (`dealPrice`) and a receipt
   upload dropzone. The masked form is never the only form shown on this screen (the buyer is the
   paying party — NFR-3).
6. **Payment records are materialized, frozen and idempotent.** Two `Payment` rows exist per deal —
   one `PLATFORM_COMMISSION` with `amount = deal.platformCommission`, one `SELLER_PURCHASE_PRICE` with
   `amount = deal.dealPrice`, both `status = 'PENDING'`. They are created by an idempotent
   `ensureDealPayments` primitive backed by a new `@@unique([dealId, paymentType])` constraint, so
   concurrent reads cannot duplicate them and no amount is ever recomputed from settings (FR-29).
7. **Proof upload endpoint.** `POST /api/v1/deals/:id/payments/:paymentType/proof` accepts
   `multipart/form-data` (`file` + optional `bankReferenceCode`, `senderBankName`) and returns
   `200 { statusCode, message, data: DealPaymentSlot }`. `paymentType` must be `PLATFORM_COMMISSION` or
   `SELLER_PURCHASE_PRICE` (`400 DEAL_PAYMENT_TYPE_INVALID` otherwise — `OWNER_CONTRACT_FEE` is not a
   deal payment).
8. **Upload guardrails (FR-30).** In this order: ownership (`403 DEAL_NOT_PARTY`); deal not terminal
   (`409 DEAL_TERMINAL`); `now < paymentDeadline` (`409 DEAL_PAYMENT_DEADLINE_PASSED`, using
   `ClockService.now()`); payment status uploadable i.e. `PENDING | PROOF_UPLOADED | REJECTED`
   (`409 DEAL_PAYMENT_REVIEW_COMPLETE` for `UNDER_REVIEW`, `CONFIRMED`, `EXPIRED`); the buyer has an
   accepted National ID document (`409 DEAL_IDENTITY_REQUIRED`, reusing
   `IdentityService.getIdentityStatus(...).canUploadDealPaymentProof`); file present and non-empty
   (`400 DEAL_PAYMENT_PROOF_REQUIRED`); ≤ 10 MB (`400 DEAL_PAYMENT_PROOF_TOO_LARGE` — the
   `PayloadTooLargeException` filter maps multer's 413 down to this single code so the client has one
   branch); `application/pdf | image/jpeg | image/png` only
   (`400 DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE`).
   WebP is accepted by the generic storage hook but **rejected here** — FR-30 lists three types.
9. **Quarantine-first persistence (NFR-13 / AD-6).** The buffer goes through
   `QuarantineService.stageFileForQuarantine(...)` then `scanAndProcess(fileObjectId, 'payments',
   { dealId, paymentId }, userId)`, which requires the `Payment` row to exist **before** staging.
   Only `ScanStatus.CLEAN` commits: the transaction writes `proofFileUrl = <FileObject id>`,
   `uploadedAt = ClockService.now()`, `bankReferenceCode`, `senderBankName`, the new payment status and
   one `AuditLog` row. `INFECTED` → `400 DEAL_PAYMENT_PROOF_INFECTED`; scanner unavailability →
   `503 DEAL_PAYMENT_PROOF_SCAN_FAILED`; in both cases **no** payment row is updated.
10. **Re-upload replaces, never appends.** A second upload for the same payment while its status is
    still `PROOF_UPLOADED`/`REJECTED` overwrites the same row (new `FileObject`, new `uploadedAt`,
    `rejectionReason` cleared) so the buyer can correct a receipt "prior to review completion". The
    deal's `version` increments exactly once per accepted upload.
11. **Deal status follows the first proof.** The first accepted upload moves the deal
    `AWAITING_PAYMENT_PROOF → UNDER_ADMIN_AUDIT`; a re-upload from `PAYMENT_REJECTED` also lands on
    `UNDER_ADMIN_AUDIT`. Any other deal status is left untouched by the upload (5.3 owns the review
    transitions). Both statuses remain inside `ACTIVE_DEAL_STATUSES`, so the partial unique index
    `deal_single_active_listing` keeps guarding the listing (trap T-7).
12. **Proof download for the owner.** `GET /api/v1/deals/:id/payments/:paymentType/proof-url` returns
    `{ downloadUrl, expiresInSeconds: 300 }` for the caller's own proof only, delegated to
    `StorageService.getVerifiedDownloadUrl(fileObjectId, 300)`. That method throws *plain string*
    exceptions (`ForbiddenException('File is quarantined or has not passed malware scan verification')`),
    which `HttpExceptionFilter` collapses to the generic codes `FORBIDDEN` / `NOT_FOUND` (trap T-14) —
    so the buyer service must catch and rethrow them with `ERROR_FILE_QUARANTINED` and
    `DEAL_PAYMENT_PROOF_NOT_FOUND`. A presigned URL is **never** persisted (NFR-2: ≤ 5-minute expiry).
13. **Shared contracts + tests.** Every code, label, status set and pure helper lives in
    `packages/shared` (Arabic label maps are exhaustive `Record<Enum, string>` so `tsc` forces new enum
    members to be handled — trap T-8). New unit coverage: shared countdown/proof helpers, `DealsService`
    buyer methods (happy path + every 4xx), `BuyerDealsController`, and web pure helpers + SSR render
    assertions. No existing suite regresses.
14. **Additive schema only.** The only Prisma changes are the `Payment` `@@unique([dealId, paymentType])`
    index and `///` documentation comments. No rename, no drop, no `String → enum` conversion on
    `Payment.status`; `prisma:push` (which reapplies `prisma/sql/deal-invariants.sql`) remains the only
    sync mechanism (trap T-2).

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts** (AC: 3, 4, 5, 6, 7, 8, 13)
  - [x] 1.1 `packages/shared/src/constants/deal.ts`: add the payment-status vocabulary
        `DEAL_PAYMENT_STATUS` (`PENDING`, `PROOF_UPLOADED`, `UNDER_REVIEW`, `CONFIRMED`, `REJECTED`,
        `EXPIRED`) + `DealPaymentStatus` type + `UPLOADABLE_PAYMENT_STATUSES` (the first, second and
        fifth); `DEAL_PAYMENT_STATUS_LABELS_AR` and `DEAL_PAYMENT_TYPE_LABELS_AR` and
        `DEAL_STATUS_LABELS_AR` as exhaustive `Record<…, string>` maps; the proof MIME allow-list
        `DEAL_PAYMENT_PROOF_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const`; the
        buyer-facing error codes `DEAL_NOT_FOUND`, `DEAL_NOT_PARTY`, `DEAL_BUYER_PROFILE_REQUIRED`
        (mirrors the existing `OFFER_BUYER_PROFILE_REQUIRED` / `INQUIRY_BUYER_PROFILE_REQUIRED` naming),
        `DEAL_TERMINAL`, `DEAL_PAYMENT_DEADLINE_PASSED`, `DEAL_PAYMENT_REVIEW_COMPLETE`,
        `DEAL_PAYMENT_TYPE_INVALID`, `DEAL_IDENTITY_REQUIRED`, `DEAL_PLATFORM_ACCOUNT_UNAVAILABLE`,
        `DEAL_PAYMENT_PROOF_REQUIRED`, `DEAL_PAYMENT_PROOF_TOO_LARGE`,
        `DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE`, `DEAL_PAYMENT_PROOF_INFECTED`,
        `DEAL_PAYMENT_PROOF_NOT_FOUND`, `DEAL_PAYMENT_PROOF_SCAN_FAILED`; and
        `DEAL_PAYMENT_STATUS_VARIANTS` (`Record<DealPaymentStatus, StatusBadgeVariant>`, importing the
        type from `packages/shared/src/types/ui.ts` exactly like `INQUIRY_STATUS_BADGE_VARIANTS`).
        Reuse the existing `ERROR_FILE_QUARANTINED` from `constants/storage.ts` — do not duplicate it.
        Do **not** touch `ACTIVE_DEAL_STATUSES` / `TERMINAL_DEAL_STATUSES`.
  - [x] 1.2 New `packages/shared/src/deal/countdown.ts` — pure, clock-injected helpers (see Dev Notes
        §Countdown). No `Date.now()`, no `new Date()` without an explicit input.
  - [x] 1.3 New `packages/shared/src/deal/payment.ts` — `isPaymentUploadable(status)`,
        `validateDealPaymentProofFile({ size, mimeType })` returning a shared error code or `null`,
        `resolveDealPaymentAmount(paymentType, deal)` and `formatDealReferenceCode`-free helpers that
        keep the actor out of the payload. Re-export from `packages/shared/src/deal/index.ts`.
  - [x] 1.4 `packages/shared/src/types/deal.ts`: add `DealPaymentSlot`, `DealPaymentView`,
        `DealPaymentProofUploadResult`; **rewrite** the unused `DealSummary` in
        `packages/shared/src/types/index.ts` into the list projection (`id`, `dealNumber`, `listingId`,
        `propertyTitle`, `status`, `dealPrice`, `platformCommission`, `totalAmount`,
        `paymentDeadline`, `platformFeeProofUploaded`, `sellerPriceProofUploaded`) — it is unused today
        (verified: zero references outside its declaration) and its `hoursRemaining`/`platformIban`
        fields cannot be served from a single clock-safe payload.
  - [x] 1.5 `packages/shared/src/schemas/deal.schema.ts`: add `dealIdParamSchema` (uuid) and
        `uploadDealProofSchema` (`paymentType` enum of the two deal types, `bankReferenceCode` optional
        ≤ 64 chars, `senderBankName` optional ≤ 100 chars) with Arabic messages. Re-export nothing
        twice; the barrels already point at these files.
  - [x] 1.6 Tests: new `packages/shared/src/deal/__tests__/countdown.spec.ts` and
        `payment.spec.ts`; extend `constants/__tests__/deal.spec.ts` (or create it) to pin that every
        `DealStatus` / `DealPaymentStatus` member has an Arabic label and that
        `UPLOADABLE_PAYMENT_STATUSES` is disjoint from `{UNDER_REVIEW, CONFIRMED, EXPIRED}`.

- [x] **Task 2 — Prisma schema** (AC: 6, 14)
  - [x] 2.1 `apps/api/prisma/schema.prisma`: add `@@unique([dealId, paymentType])` to `model Payment`
        (the table is empty — verified: no service writes `payments` except a `count` in
        `account-deletion.service.ts`), and document with `///` comments that
        `proofFileUrl` holds a `FileObject.id` (not a URL) and that `status` is a `String` on purpose.
        Add no other column.
  - [x] 2.2 Run `npm run prisma:push` from `apps/api` and verify the index with the `pg_indexes` query
        in Dev Notes §Verification. **Never** run a bare `prisma db push` (trap T-2).

- [x] **Task 3 — Platform collection account** (AC: 4)
  - [x] 3.1 New `apps/api/src/modules/deals/platform-account.ts`: `PlatformAccountService`
        (`@Injectable()`) reading `PLATFORM_COLLECTION_IBAN` + `PLATFORM_ACCOUNT_HOLDER_NAME` from
        `ConfigService`, validating the IBAN with the shared `saudiIbanSchema` (mod-97) and deriving
        `bankName` from `getSaudiBankName`. A missing/invalid value throws
        `ServiceUnavailableException({ code: DEAL_PLATFORM_ACCOUNT_UNAVAILABLE })` — never a 500.
        Mark it `// TODO(8.6): the platform collection account becomes a platform setting.`
  - [x] 3.2 Add both keys to `.env.example` (and to the developer's `.env`) with a valid Turkish/Saudi
        demo IBAN from the existing fixtures; document them in the story's Dev Notes only — no new
        settings table.

- [x] **Task 4 — Buyer deals service** (AC: 1, 2, 6, 8, 9, 10, 11, 12)
  - [x] 4.1 New `apps/api/src/modules/deals/buyer-deals.service.ts` (`BuyerDealsService`) with
        `listMyDeals`, `getDealPayment`, `uploadProof`, `getProofDownloadUrl`, plus the private
        `resolveBuyerProfile`, `ensureDealPayments(tx, deal)` and `toPaymentSlot` helpers.
        Copy `OffersService.resolveBuyerProfile` verbatim in shape (userId + `userId_role` unique key +
        `ProfileStatus.ACTIVE`) so the 403 body stays consistent with the rest of the buyer surface — but
        throw `403 DEAL_BUYER_PROFILE_REQUIRED` (no ACTIVE buyer profile) and `403 DEAL_NOT_PARTY`
        (profile exists, deal belongs to someone else). Two distinct codes, same envelope.
  - [x] 4.2 `ensureDealPayments` uses `tx.payment.upsert` on the new `dealId_paymentType` unique key,
        `create` with the frozen amount + `status: DEAL_PAYMENT_STATUS.PENDING`, `update: {}` (an
        existing row must never be rewritten by a read). Call it inside the read transaction and
        inside the upload transaction.
  - [x] 4.3 `uploadProof` follows the exact order in Dev Notes §The upload transaction. Money,
        status and timestamps come from `ClockService`; the response is the updated
        `DealPaymentSlot`, not the whole deal.
  - [x] 4.4 New `apps/api/src/modules/deals/deal-payment.mapper.ts` — `toDealPaymentView(deal,
        payments, platformAccount, sellerIbanPlain, now)`, `toDealSummary(deal, listingTitle,
        payments)`, `toDealPaymentSlot(payment)`. Money is a decimal **string** (`String(decimal)`,
        trap T-4); timestamps go through the existing `toIso` helper in
        `modules/offers/offer-thread.mapper.ts`.
  - [x] 4.5 New `apps/api/src/modules/deals/dto/upload-payment-proof.dto.ts` — Swagger-facing DTO
        mirroring the shared `uploadDealProofSchema`, plus `UploadedFile` typing reused from
        `IdentityUploadFile`'s shape.
  - [x] 4.6 `DealsModule`: import `StorageModule` and `UsersModule`, register
        `BuyerDealsController`, add `BuyerDealsService` + `PlatformAccountService` + `SessionAuthGuard` +
        `ActiveRoleGuard` to providers. **Do not** import `OffersModule` (the reserve-closure contract
        belongs to 5.4) and do not create a `payments` module in this story.
  - [x] 4.7 `getProofDownloadUrl` — 404 `DEAL_PAYMENT_PROOF_NOT_FOUND` when the slot has no
        `proofFileUrl`; then wrap `getVerifiedDownloadUrl` in `try/catch` and rethrow with
        `ERROR_FILE_QUARANTINED` (403) / `DEAL_PAYMENT_PROOF_NOT_FOUND` (404) so `ApiError.code` survives
        the filter (trap T-14). Return `{ downloadUrl, expiresInSeconds: MAX_EXPIRATION_SECONDS }`.

- [x] **Task 5 — Buyer deals controller** (AC: 1, 2, 7, 12)
  - [x] 5.1 New `apps/api/src/modules/deals/buyer-deals.controller.ts` —
        `@Controller('deals')`, class-level `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` and
        `@RequireRole(UserRole.BUYER)`; routes in this declaration order: `GET my`,
        `GET :id/payments/:paymentType/proof-url`, `GET :id`, `POST :id/payments/:paymentType/proof`
        (literal `my` first — trap T-6).
  - [x] 5.2 The upload handler uses
        `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))`
        plus the `PayloadTooLargeException` filter pattern from `identity.controller.ts`
        (`IdentityFileTooLargeFilter` → a `DealProofTooLargeFilter` mapping to
        `DEAL_PAYMENT_PROOF_TOO_LARGE`, HTTP 400), Swagger `@ApiConsumes('multipart/form-data')`, and
        returns `{ statusCode, message: 'تم استلام إيصال التحويل وهو قيد المراجعة الإدارية', data }`.
  - [x] 5.3 Read the actor from `req.user` (`id`, `activeRole || role`) exactly like `OffersController`.
  - [x] 5.4 Tests `apps/api/src/modules/deals/__tests__/buyer-deals.service.spec.ts` and
        `__tests__/buyer-deals.controller.spec.ts` using the fake-`prisma` / fake-`tx` style of
        `deals.service.spec.ts`.

- [x] **Task 6 — Buyer deal payment UI** (AC: 3, 4, 5, 7, 10)
  - [x] 6.1 New `apps/web/src/components/deals/` with `index.ts`, `deal-countdown-banner.tsx`,
        `dual-wire-transfer-cards.tsx` (`DealPaymentCard` ×2), `payment-proof-dropzone.tsx`,
        `deal-payment-view.tsx`, `buyer-deals-list.tsx`, `deal-status-badge.tsx`,
        `deal-payment-status-badge.tsx`, `__tests__/`.
  - [x] 6.2 New `apps/web/src/components/ui/copy-button.tsx` (+ export in `components/ui/index.ts`):
        copies a raw unspaced string, shows the verbatim «تم نسخ رمز مرجع التحويل بنجاح: استخدم هذا
        الرمز في وصف الحوالة البنكية» status text for 2 s. **Do not** refactor
        `MonospaceIbanCard` — its props are payout-account-shaped and changing it would risk the
        Story 1.5 suite.
  - [x] 6.3 `apps/web/src/app/app/buyer/deals/page.tsx` → `<BuyerDealsList />`;
        `apps/web/src/app/app/buyer/deals/[id]/page.tsx` → `<DealPaymentView dealId={id} />`
        (`params` is a `Promise`, exactly like `buyer/offers/[id]/page.tsx`).
  - [x] 6.4 `apps/web/src/components/layout/workspace-shell.tsx`: add the buyer nav entry
        `{ href: '/app/buyer/deals', label: 'صفقاتي والدفع', icon: Wallet }` next to the offers entry.
  - [x] 6.5 `DealPaymentView` (`'use client'`): fetch `GET /deals/:id` through `apiClient`, render the
        countdown banner, the two cards, the frozen financial summary, the identity prerequisite notice
        (reuse the `useAuth().identityStatus.canUploadDealPaymentProof` flag already used by the buyer
        dashboard), a 20-second short-poll refresh (same cadence as the offer thread) and an Arabic
        error hint table for every new code.
  - [x] 6.6 Export the decision logic as pure helpers — `buildDealCountdownState`,
        `resolvePaymentSlotActions(slot, deal)`, `validateDealProofFile(file)`,
        `buildDealProofFormData(file, values)`, `buildDealPaymentSummaryRows(view)` — because the web
        suite renders SSR-only via `renderToString` (no jsdom): interactive behaviour is asserted
        through these helpers, presentational output through `renderToString`.
  - [x] 6.7 Tests: `__tests__/deal-countdown-banner.spec.tsx`,
        `__tests__/dual-wire-transfer-cards.spec.tsx`, `__tests__/payment-proof-dropzone.spec.tsx`,
        `__tests__/deal-payment-view-helpers.spec.ts` (mock `apiClient` with `vi.mock` as the other
        web specs do).

- [x] **Task 7 — Seed a demo deal** (manual verification; AC: 4, 5, 6, 8)
  - [x] 7.1 `apps/api/prisma/seed.ts`: add an idempotent demo buyer (`DEMO_BUYER` user + ACTIVE BUYER
        `UserProfile`), a CLEAN `FileObject` + `VERIFIED` `IdentityDocument` for that buyer (FR-30
        requires it before a proof upload), and a `DEMO_DEAL_ID` deal on the existing RESERVED listing
        `88888888-0000-4000-8000-000000000002` built from the same frozen fields Story 5.1 writes
        (`dealNumber` `DL-<date>-DEMO000001`, `dealReferenceCode` `ELM-DEMO000001-C`,
        `paymentDeadline = now + 48 h`, seller payout snapshot from `DEMO_PAYOUT_ACCOUNT_ID`), with no
        `Payment` rows — the API materializes them, which is exactly the behaviour under test.
  - [x] 7.2 Keep it fully idempotent (`upsert`, `update: {}`) and make sure the partial index
        `deal_single_active_listing` still holds (the RESERVED listing has no other deal).

- [x] **Task 8 — Verify** (AC: 13, 14)
  - [x] 8.1 `cd packages/shared && npx tsc` — the api/web suites resolve `packages/shared/dist`, not
        `src` (trap T-10).
  - [x] 8.2 `cd apps/api && npx tsc --noEmit` and `npx eslint "src/modules/deals/**/*.ts"`.
  - [x] 8.3 `cd packages/shared && npm test`; `cd apps/api && npm test`; `cd apps/worker && npm test`;
        `cd apps/web && npm test`. Report the four counts in the Dev Agent Record. Baselines after
        Story 5.1: shared **429**, api **711**, worker **71**, web **331** — any drop is a regression.
  - [x] 8.4 `cd apps/web && npm run build` (the pre-existing `.next/types/app/admin/geo/page.ts`
        failure recorded by Stories 4.4/5.1 is not a regression; report nothing new).
  - [x] 8.5 Manual, in this order: reseed → open `/app/buyer/deals` as the demo buyer → open the deal →
        confirm the banner counts down from `serverNow`, both cards show the frozen amounts and
        `ELM-DEMO000001-C`, the seller IBAN is unmasked → upload a PDF receipt on Card 1 → confirm
        `payments` gained exactly two rows with `PLATFORM_COMMISSION.status = 'PROOF_UPLOADED'` and
        `uploadedAt` set, `deals.status = 'UNDER_ADMIN_AUDIT'`, one
        `DEAL_PAYMENT_PROOF_UPLOADED` audit row, one promotion into `payments/<dealId>/<paymentId>/` →
        re-upload and confirm the same row is replaced (not duplicated) → point `paymentDeadline` into
        the past and confirm the upload is refused with `DEAL_PAYMENT_DEADLINE_PASSED`.

## Dev Notes

### Scope boundaries

- **In scope:** the buyer deal payment screen, the countdown banner, the two wire-transfer cards, the
  two `Payment` rows, the proof upload/replacement path, the platform collection account source, the
  buyer deals list, and the demo seed that makes all of it demonstrable.
- **Out of scope, explicitly:**
  - Admin proof review, claim leases on `Payment`, `Confirmed`/`Rejected` decisions, the 12-hour
    correction window and review SLA tiers → **Story 5.3**. This story only ever writes
    `PROOF_UPLOADED`; it never moves a payment to `UNDER_REVIEW`.
  - Deal completion, contact release, `InvoiceRecord`, rating unlock → **5.4**. Timeout cron and
    `Expired` transitions → **5.5**. Buyer/seller cancellation and disputes → **5.6**.
  - Platform settings storage (`commissionRate`, `paymentWindowHours`, collection IBAN) → **8.6**. Use
    the frozen snapshot columns and the env-backed `PlatformAccountService` with a `TODO(8.6)`.
  - In-app notifications / emails (`deal.created`, `payment.sla_*`) → **8.8**. Nothing here dispatches.
  - `apps/worker` changes (no schedule exists for this story), a `payments` NestJS module, an
    `Idempotency-Key` middleware (AR-9 is unimplemented repo-wide; do not introduce it here).
  - Converting `Payment.status` from `String` to a Prisma enum — `db push` cannot do that without a
    destructive type change, and `deal-invariants.sql` has no such migration.

### Previous story intelligence (5.1) and the traps it left behind

- Story 5.1 shipped `DealsService.finalApprove` + `POST /admin/deals/final-approve`, the frozen
  snapshot columns, `deal-invariants.sql`, `ACTIVE_DEAL_STATUSES`, and the `CONVERTED_TO_DEAL` terminal
  offer status. **No `Deals` read path exists for a buyer**, and **no `Payment` row is ever created** —
  `payments` is empty in every environment.
- Story 5.1's own explicit hand-off: «`Payment` rows, proofs, and the deal screen
  (`/app/buyer/deals/:id`) → Story 5.2. The frozen `platformIban` in `DealSummary` has no source of
  truth in this codebase yet (Story 8.6 owns settings) — do not invent one.» Task 3 resolves that by
  adding an explicit env-backed provider instead of a hidden constant.
- Reuse, do not re-derive: `computeDealAmounts` / `formatSar` exist, but this story **must not compute
  money at all**. `deal.dealPrice`, `deal.platformCommission` and `deal.totalAmount` were frozen at
  approval; reading them back is the whole point of FR-29.
- Habits that will bite:
  - `prisma db push` is the only migration mechanism and it drops indexes it cannot express — always
    push through `npm run prisma:push`.
  - `packages/shared/dist` is what api/web tests import: rebuild shared first.
  - Admin endpoints return `{ statusCode, message?, data }`; buyer endpoints in `OffersController` also
    return `{ statusCode, data }`, while `IdentityController` returns `{ code: 'SUCCESS', data,
    requestId }`. **Follow `OffersController`** for this story's buyer routes.
  - `apiClient` rejects with `ApiError` carrying `.code`; the web hint tables key off that code.
- Suite baselines after 5.1: shared 429, api 711, worker 71, web 331.

### Current state (verified in this codebase)

- `apps/api/src/modules/deals/` contains only `deals.module.ts`, `deals.service.ts`,
  `admin-deals.controller.ts`, `deal-binding.mapper.ts`, `dto/final-approve-deal.dto.ts`, `__tests__/`.
  No buyer controller, no buyer service, no platform-account source.
- `apps/web/src/app/app/buyer/` has `demands/`, `favorites/`, `inquiries/`, `offers/`, `page.tsx` —
  **no `deals/`**. `apps/web/src/components/` has no `deals/` folder.
- `workspace-shell.tsx` (L78-81) lists the buyer nav: offers, favorites, demands. There is no deals entry.
- `model Deal` (schema.prisma) already carries everything the screen needs: `dealNumber`,
  `dealReferenceCode @unique`, `dealPrice`, `platformCommission`, `totalAmount`,
  `commissionRateSnapshot`, `fixedCommissionSnapshot`, `paymentWindowHoursSnapshot`,
  `sellerPayoutHolderName/BankName/IbanEncrypted/IbanMasked`, `status`, `paymentDeadline`, `createdAt`,
  `version`.
- `model Payment` (schema.prisma): `dealId`, `paymentType` (`PaymentType`), `amount`
  `Decimal(12,2)`, `status String @default("PENDING")`, `proofFileUrl String?`,
  `bankReferenceCode String?`, `senderBankName String?`, `uploadedAt DateTime?`,
  `verifiedByAdminId/verifiedAt/rejectionReason`, `lockedByAdminId/lockedAt/lockExpiresAt`,
  `@@index([dealId, paymentType, status])`, `@@index([lockExpiresAt])`. **No unique key** on
  `(dealId, paymentType)` yet.
- `DealStatus` = `AWAITING_PAYMENT_PROOF | UNDER_ADMIN_AUDIT | PAYMENT_REJECTED | COMPLETED |
  CANCELLED | TERMINATED`. `ACTIVE_DEAL_STATUSES` = the first three. The PRD's `PaymentUnderReview`
  maps to **`UNDER_ADMIN_AUDIT`**; `CancelledByBuyer/Seller/Timeout` are all folded into `CANCELLED` in
  the current schema — do not add new members in this story.
- Table/column names in `deals`, `payments` are **camelCase without `@map`** — raw SQL must quote them
  (`"payments"."dealId"`). `deals.id` / `payments.id` are `text` columns: cast `::text`, never `::uuid`
  (trap T-1).
- `IdentityService.getIdentityStatus(userId)` already returns
  `canUploadDealPaymentProof: isClean && status !== REJECTED`, and the buyer dashboard already renders
  the prerequisite banner using `useAuth().identityStatus`. `UsersModule` **exports** `IdentityService`,
  so `DealsModule` can import `UsersModule` (no cycle: `UsersModule` does not import `DealsModule`).
- `StorageModule` exports `StorageService` + `QuarantineService` + `MalwareScannerService`.
  `QuarantineService.stageFileForQuarantine({ filename, mimeType, fileSize, buffer, userId })` returns
  `{ fileObjectId, key, bucket, scanStatus, ... }`; `scanAndProcess(fileObjectId, targetPartition,
  context, actorId)` promotes to `payments/<dealId>/<paymentId>/<uuid>-<name>` when the context carries
  **both** `dealId` and `paymentId`, and fails closed (`SCAN_FAILED`) on scanner downtime.
- `payment.userId` does not exist — staging takes `userId`, the payments partition takes
  `dealId`/`paymentId`. Pass all three.
- `MonospaceIbanCard` (`components/payout/`) is payout-account shaped (`account`, `onEdit`, `onDelete`);
  `formatSaudiIban` (shared) produces the 4-char grouping the design asks for, and
  `formatSar` (`components/listings/commission-calculator.tsx`) is the only money formatter.
- Design tokens already exist for this story: `deal-platform-fee`, `deal-platform-fee-bg`,
  `deal-seller-price`, `deal-seller-price-bg`, `accent`, `accent-light`, `surface-borderStrong`,
  `status-*` and `shadow-level*` (tailwind.config.ts L21-92). `Card`, `Button`, `Badge`
  (`variant: verified|pending|danger|info|neutral`), `EmptyState`, `Modal` are the only primitives —
  **there is no Progress or Alert primitive**; the countdown bar is a plain `div` (see
  `identity-upload-form.tsx` L224-233 for the exact pattern).
- Web tests run with **no jsdom**: `vitest run`, no config file, specs use
  `renderToString` from `react-dom/server` and assert on markup/pure helpers only.

### Runtime and library versions (verified from the workspace, not from the internet)

Nothing new is installed by this story. The dev agent must not add a dependency for any of the
following, because each is already present and already the house pattern:

- `apps/web`: `next` 15 (App Router, async `params` Promise), `react` 19, `vitest` ^1.6.0 with
  `vitest run` and **no jsdom** — no `@testing-library/*`, no `jest`, no `msw` was added anywhere in the
  repo, so do not introduce them. `react-dom/server`'s `renderToString` is the rendering surface.
  Icons come from `lucide-react` (already a dependency) — `Wallet`, `Copy`, `Check`, `UploadCloud` are
  the names used by the sibling components.
- `apps/api`: `@nestjs/common` 10, `@nestjs/platform-express` `FileInterceptor` (multer), `prisma` /
  `@prisma/client` 5.14, `jest` + `ts-jest`, `class-validator`/`class-transformer` for DTOs, and
  `@nestjs/swagger` decorators (`@ApiConsumes`, `@ApiOperation`).
- `packages/shared`: plain TypeScript compiled to `dist` — no bundler, no build tooling to reconfigure.
  Zod is the only validation library; use `saudiIbanSchema` rather than re-implementing mod-97.
- Money: `decimal.js` is **not** a dependency; `Decimal` values are stringified (`String(x)`) on the way
  out and never parsed into JS numbers except inside `formatSar` for display.

### API surface (this story)

| Method & path | Guard | Success | Refusals |
|---|---|---|---|
| `GET /api/v1/deals/my` | `SessionAuthGuard` + `ActiveRoleGuard` + `@RequireRole(BUYER)` | `200 { statusCode, data: DealSummary[] }` | `403 DEAL_BUYER_PROFILE_REQUIRED` |
| `GET /api/v1/deals/:id` | same | `200 { statusCode, data: DealPaymentView }` | `404 DEAL_NOT_FOUND`, `403 DEAL_NOT_PARTY`, `503 DEAL_PLATFORM_ACCOUNT_UNAVAILABLE` |
| `POST /api/v1/deals/:id/payments/:paymentType/proof` | same, multipart | `200 { statusCode, message, data: DealPaymentSlot }` | `404 DEAL_NOT_FOUND`, `403 DEAL_NOT_PARTY`, `400 DEAL_PAYMENT_TYPE_INVALID`, `409 DEAL_TERMINAL`, `409 DEAL_PAYMENT_DEADLINE_PASSED`, `409 DEAL_PAYMENT_REVIEW_COMPLETE`, `409 DEAL_IDENTITY_REQUIRED`, `400 DEAL_PAYMENT_PROOF_REQUIRED`, `400 DEAL_PAYMENT_PROOF_TOO_LARGE`, `400 DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE`, `400 DEAL_PAYMENT_PROOF_INFECTED`, `503 DEAL_PAYMENT_PROOF_SCAN_FAILED` |
| `GET /api/v1/deals/:id/payments/:paymentType/proof-url` | same | `200 { statusCode, data: { downloadUrl, expiresInSeconds: 300 } }` | `404 DEAL_NOT_FOUND`, `403 DEAL_NOT_PARTY`, `400 DEAL_PAYMENT_TYPE_INVALID`, `404 DEAL_PAYMENT_PROOF_NOT_FOUND` (also used when the file row has vanished), `403 FILE_QUARANTINED` (re-thrown from `ERROR_FILE_QUARANTINED`) |

Route declaration order inside `@Controller('deals')` is load-bearing: `Get('my')` **before**
`Get(':id')`, and the two `:id/payments/...` routes before the bare `Get(':id')` for readability (Nest
matches `my` as `:id` if the literal comes second — the same trap `OffersController` documents at L46-47).

### Countdown maths (the only correct way to render a 48-hour timer)

The server owns the clock (AD-11 / AD-13). A browser that uses `Date.now()` against a
`ClockService`-generated deadline shows garbage the moment the dev fake clock is used, and drifts on a
slow device even in production. So:

1. `DealPaymentView` carries `paymentDeadline`, `createdAt` and **`serverNow`** (all ISO strings from
   `ClockService.now()`).
2. The client computes `elapsed = Date.now() - receivedAtClientMs` (monotonic enough for a 48-hour
   timer, and testable) and passes it in explicitly:

```ts
// packages/shared/src/deal/countdown.ts — pure, no implicit clock
export interface CountdownInput {
  createdAt: string;        // ISO
  deadline: string;         // ISO
  serverNow: string;        // ISO — the clock the deadline was measured against
  elapsedMs?: number;       // ms since the payload arrived (default 0)
}

export interface CountdownState {
  remainingMs: number;          // clamped: never < 0
  totalMs: number;              // deadline - createdAt
  elapsedMs: number;            // clamped into [0, totalMs]
  progressPercent: number;      // 0..100, rounded, clamped
  clock: { hours: string; minutes: string; seconds: string };
  text: string;                 // 'HH:MM:SS'
  isExpired: boolean;           // remainingMs === 0
  isUrgent: boolean;            // 0 < remainingMs <= URGENT_THRESHOLD_MS (6 h)
}

export const DEAL_COUNTDOWN_URGENT_THRESHOLD_MS = 6 * 3_600_000;
export function buildDealCountdownState(input: CountdownInput): CountdownState;
```

Pin these in the spec: a fresh 48 h deal → `text === '48:00:00'`, `progressPercent === 0`; exactly
half-way → `'24:00:00'`, `50`; one second past the deadline → `'00:00:00'`, `isExpired === true`,
`progressPercent === 100`, **`remainingMs === 0` (never negative)**; `elapsedMs` advances the clock
without touching `serverNow`; a deadline before `createdAt` (corrupt row) must not divide by zero.

The banner re-renders on a 1 000 ms `window.setInterval` (the pattern at
`components/admin/offer-mediation-workspace.tsx` L260+ and `formatLockCountdown`); clear it in the
`useEffect` cleanup, and compute via `performance.now()` deltas rather than accumulating ticks so a
throttled background tab cannot lose time.

### The upload transaction

Follow this order exactly; every step has a test.

```ts
// BuyerDealsService.uploadProof(dealId, paymentType, file, body, user)
const now = this.clockService.now();
const profile = await this.resolveBuyerProfile(user.id, user.activeRole || user.role); // 403

return this.prisma.$transaction(async (tx: any) => {
  // 1. Row-lock the deal. `deals.id` is `text`: ::text, never ::uuid (trap T-1).
  await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;
  const deal = await tx.deal.findUnique({ where: { id: dealId }, include: LISTING_TITLE });
  if (!deal) throw new NotFoundException({ code: DEAL_NOT_FOUND, message: '<AR>' });
  if (deal.buyerProfileId !== profile.id) throw new ForbiddenException({ code: DEAL_NOT_PARTY, message: '<AR>' });

  // 2. Terminal / deadline / payment-state gates, in that order (FR-30, AD-3).
  if (TERMINAL_DEAL_STATUSES.includes(deal.status)) { /* 409 DEAL_TERMINAL */ }
  if (new Date(deal.paymentDeadline).getTime() <= now.getTime()) { /* 409 DEAL_PAYMENT_DEADLINE_PASSED */ }

  // 3. Materialize the pair, then read the target slot back (the partition needs its id).
  const payments = await this.ensureDealPayments(tx, deal);   // upserts BOTH slots
  const payment = payments.find((p) => p.paymentType === paymentType);
  if (!isPaymentUploadable(payment.status)) { /* 409 DEAL_PAYMENT_REVIEW_COMPLETE */ }

  // 4. FR-30 / BR-10: identity gate. Clean, non-rejected document or nothing.
  const identity = await this.identityService.getIdentityStatus(user.id);
  if (!identity.canUploadDealPaymentProof) { /* 409 DEAL_IDENTITY_REQUIRED */ }

  // 5. Quarantine first, decide after (NFR-13 / AD-6) — the payment row exists at this point,
  //    which is what the `payments` partition requires.
  const staged = await this.quarantineService.stageFileForQuarantine({
    filename: file.originalname, mimeType: file.mimetype, fileSize: file.size,
    buffer: file.buffer, userId: user.id,
  });
  const outcome = await this.quarantineService.scanAndProcess(
    staged.fileObjectId, 'payments', { dealId: deal.id, paymentId: payment.id }, user.id,
  );
  if (!outcome.isClean) { /* 400 INFECTED | 503 SCAN_FAILED — nothing is written */ }

  // 6. One write per accepted upload.
  const updated = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
      proofFileUrl: staged.fileObjectId,        // D5: the FileObject id, never a URL
      uploadedAt: now,
      bankReferenceCode: body.bankReferenceCode ?? null,
      senderBankName: body.senderBankName ?? null,
      rejectionReason: null,
    },
  });

  // 7. Deal status: first proof starts the audit; re-upload after rejection re-enters it.
  if (deal.status === DealStatus.AWAITING_PAYMENT_PROOF || deal.status === DealStatus.PAYMENT_REJECTED) {
    await tx.deal.update({ where: { id: deal.id }, data: { status: DealStatus.UNDER_ADMIN_AUDIT, version: { increment: 1 } } });
  }

  await tx.auditLog.create({ data: {
    actorId: user.id, actorType: 'USER', action: 'DEAL_PAYMENT_PROOF_UPLOADED',
    entityType: 'Payment', entityId: payment.id,
    payload: { dealId: deal.id, dealNumber: deal.dealNumber, paymentType,
               fileObjectId: staged.fileObjectId, amount: String(payment.amount),
               replaced: payment.proofFileUrl !== null },
  }});

  return toDealPaymentSlot(updated);
});
```

Notes that are easy to get wrong:

- Step 5 runs **inside** the transaction. That is deliberate: the row locks are held for the duration of
  the scan, but scanners are local/mock in this repo and the alternative (scan outside, write inside)
  leaves a promotion window where a `Payment` points at a file that failed scanning. The existing
  identity flow stages **before** opening its transaction; here the payment id is a precondition of the
  storage key, so the order has to be inverted. Document this deviation in the service comment.
- Do **not** call `prisma.$transaction` inside the transaction (trap T-3 of 5.1) — every helper takes `tx`.
- `ensureDealPayments` must be safe to call from a read path: `upsert` with `update: {}`.

### `ensureDealPayments` (why a unique key, not a find-then-create)

```ts
const DEAL_PAYMENT_AMOUNTS = [
  { type: PaymentType.PLATFORM_COMMISSION, amount: (d) => d.platformCommission },
  { type: PaymentType.SELLER_PURCHASE_PRICE, amount: (d) => d.dealPrice },
];
// tx.payment.upsert({ where: { dealId_paymentType: { dealId, paymentType } },
//                     create: { dealId, paymentType, amount: String(amount),
//                               status: DEAL_PAYMENT_STATUS.PENDING },
//                     update: {} })
```

Two concurrent `GET /deals/:id` calls in a cold environment would otherwise insert four rows, and the
`payments` partition key `payments/<dealId>/<paymentId>/…` would no longer be unique per slot. The
`@@unique([dealId, paymentType])` index (Task 2.1) makes the race impossible at the database level;
`upsert` is just the ergonomic wrapper. It also gives 5.3/5.5 a stable lookup key.

### Platform collection account

`PlatformAccountService.getAccount()` returns `{ iban, ibanFormatted, accountHolderName, bankName }`:

- `PLATFORM_COLLECTION_IBAN` validated by `saudiIbanSchema` (24 chars, ISO-7064 mod-97 — do not
  re-implement the checksum), `PLATFORM_ACCOUNT_HOLDER_NAME` (3-100 chars).
- Missing/invalid → `ServiceUnavailableException({ code: DEAL_PLATFORM_ACCOUNT_UNAVAILABLE, message:
  'تعذر تحميل حساب المنصة المعتمد للتحصيل. يرجى التواصل مع الدعم الفني.' })`. Never fall back to a
  hard-coded IBAN: a wrong IBAN on a 48-hour deadline is a real-money defect.
- `ibanFormatted` for display comes from `formatSaudiIban`; the raw value is returned only inside
  `DealPaymentView.platformIban` (the buyer is wiring money to it — masking it would be absurd), and
  it must never appear in a log line.
- `// TODO(8.6): platform settings table.` This provider is the seam that story will replace.

### Payment status vocabulary

`Payment.status` is a `String` column (pre-existing decision). The canonical values live in shared:

```
PENDING → PROOF_UPLOADED → (5.3) UNDER_REVIEW → CONFIRMED | REJECTED → REJECTED → PROOF_UPLOADED …
PENDING | PROOF_UPLOADED | REJECTED → EXPIRED (5.5)
```

- `UPLOADABLE_PAYMENT_STATUSES = [PENDING, PROOF_UPLOADED, REJECTED]` — exactly the three states in
  which the buyer may still replace a receipt. `UNDER_REVIEW`, `CONFIRMED`, `EXPIRED` are locked.
- The labels must be exhaustive `Record<DealPaymentStatus, string>` so a future status breaks `tsc`
  (trap T-8). Arabic: `PENDING` = «بانتظار التحويل», `PROOF_UPLOADED` = «تم رفع الإيصال - قيد
  المراجعة», `UNDER_REVIEW` = «قيد التدقيق الإداري», `CONFIRMED` = «مؤكد», `REJECTED` = «مرفوض -
  يلزم إعادة الرفع», `EXPIRED` = «منتهي».
- `Deal.status` labels (`DEAL_STATUS_LABELS_AR`): `AWAITING_PAYMENT_PROOF` = «بانتظار إثبات الدفع»,
  `UNDER_ADMIN_AUDIT` = «قيد التدقيق الإداري», `PAYMENT_REJECTED` = «إثبات مرفوض», `COMPLETED` =
  «مكتملة», `CANCELLED` = «ملغاة», `TERMINATED` = «منتهية».

### UI spec (verbatim from the UX artefacts — do not paraphrase)

- Card 1 title «سعي المنصة»، Card 2 title «قيمة العقار للبائع»؛ section intro «يرجى تحويل سعي المنصة إلى
  حساب المنصة المعتمد، وقيمة العقار مباشرة إلى حساب البائع الموثق».
- Copy confirmation «تم نسخ رمز مرجع التحويل بنجاح: استخدم هذا الرمز في وصف الحوالة البنكية» — not «تم
  النسخ!». `MonospaceIbanCard`'s short «تم النسخ» toast may stay as-is; the new `CopyButton` uses the
  longer institutional sentence.
- Deadline notice (goes **inside** the gold banner, `aria-live="polite"`): «رفع إيصال التحويل يوقف
  الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة في حال الرفض دون إلغاء فوري.»
- Identity prerequisite: reuse «أكمل توثيق هويتك لتفعيل إثباتات الدفع» with the link to
  `/app/settings/identity` (already in the buyer dashboard — extract or repeat, do not invent new copy).
- Upload zone text: «اسحب إيصال التحويل إلى هنا أو اختر ملفاً» + «PDF, JPEG, PNG (حتى 10 ميجابايت)».
- Rejected slot: show `rejectionReason` plus «أعد رفع إيصال التحويل قبل انتهاء المهلة».
- Layout: cards stack on mobile, two columns from `lg`; Card 1 comes first in RTL reading order
  (`order` classes, not `flex-row-reverse`), the banner sits above both, the frozen summary below.
- Accessibility (UX-DR12): `3px` emerald focus (`focus-visible:ring` / `shadow-focus`), explicit
  `<label>` for the file input, `aria-live="polite"` on the countdown and on upload status, keyboard
  reachable dropzone (`role="button"` + `tabIndex={0}` + Enter/Space, copying `identity-upload-form.tsx`
  L177-222), and the countdown must not be the only signal of expiry (pair it with the textual
  «انتهت مهلة رفع الإيصال» state).

### Critical implementation traps

- **T-1 `::text`, never `::uuid`.** `deals.id` / `payments.id` are `text` columns; `FOR UPDATE` with a
  `::uuid` cast raises Postgres `42883` → an unhandled 500 (Story 4.1 shipped exactly this).
- **T-2 `prisma db push` silently drops `deal_single_active_listing`.** Always `npm run prisma:push`,
  which reapplies `prisma/sql/deal-invariants.sql`.
- **T-3 Never nest `$transaction`.** Every helper takes the caller's `tx`.
- **T-4 No floats in the money path, and no money maths at all.** `String(payment.amount)` /
  `String(deal.dealPrice)` on the way out; `Number()` is allowed **only** for display inside
  `formatSar`'s existing signature. Never recompute commission from `commissionRateSnapshot`.
- **T-5 The countdown must not read the browser clock as its authority.** `serverNow` from the API, plus
  an explicit `elapsedMs`.
- **T-6 `Get('my')` before `Get(':id')`.** Otherwise `/deals/my` resolves as `:id = 'my'` and returns
  a 404 that looks like a routing bug for an hour.
- **T-7 `UNDER_ADMIN_AUDIT` must stay non-terminal.** It is already in `ACTIVE_DEAL_STATUSES` and in the
  SQL `NOT IN (…)` terminal list, so the one-deal-per-listing index keeps holding. Do not "tidy" the
  deal into `CANCELLED`/`COMPLETED` here.
- **T-8 An enum/string-set member is not enough.** The exhaustive label `Record`s and
  `DEAL_PAYMENT_STATUS_VARIANTS` will fail `tsc` until every map is updated. Fix the maps; never widen
  to `Record<string, …>`.
- **T-9 The sealed `payment.status` values are strings, so nothing type-checks the write.** Assert with
  the shared constants (`DEAL_PAYMENT_STATUS.PROOF_UPLOADED`), never a literal `'PROOF_UPLOADED'` at the
  call site.
- **T-10 Stale `packages/shared/dist`.** Rebuild shared before running api/web suites.
- **T-11 The upload must not leak the ciphertext or the seller's contacts.** No `sellerPayoutIbanEncrypted`
  in any payload; the plaintext IBAN is produced only for the buyer's own deal view, and the seller's
  phone/email are Story 5.4's release (FR-32).
- **T-12 `WebP` passes `ALLOWED_UPLOAD_MIME_TYPES` but not FR-30.** Validate against the shared
  `DEAL_PAYMENT_PROOF_MIME_TYPES` in the service *before* staging, and keep the client's `accept`
  attribute on the same three types.
- **T-13 `Payment.amount` is `Decimal`, `proofFileUrl` is `String?`.** Do not "fix" the column name to
  `proofFileObjectId` — `db push` cannot rename without dropping the column.
- **T-14 `StorageService` throws plain strings, so `ApiError.code` degrades.** `HttpExceptionFilter`
  falls back to `FORBIDDEN` / `NOT_FOUND` for string responses (`HTTP_STATUS_CODE_MAP`, L19-28). Any
  storage exception crossing this story's boundary must be caught and rethrown with an explicit
  `{ code }` — otherwise the web hint table silently misses and the user sees a generic message.

### Reuse map (do not reinvent)

| Need | Use | Where |
|---|---|---|
| Buyer profile resolution | `resolveBuyerProfile` shape | `modules/offers/offers.service.ts` L633-650 |
| Buyer controller guards / envelope | `OffersController` | `modules/offers/offers.controller.ts` L41-70 |
| Multipart + too-large filter | `FileInterceptor` + `IdentityFileTooLargeFilter` | `modules/users/identity.controller.ts` L30-56 |
| Quarantine + scan | `QuarantineService.stageFileForQuarantine` / `scanAndProcess` | `modules/storage/quarantine.service.ts` L54-260 |
| Identity gate | `IdentityService.getIdentityStatus().canUploadDealPaymentProof` | `modules/users/identity.service.ts` L232-260 |
| Verified download | `StorageService.getVerifiedDownloadUrl(id, 300)` | `modules/storage/storage.service.ts` L530-564 |
| IBAN formatting / masking | `formatSaudiIban`, `maskSaudiIban`, `getSaudiBankName`, `saudiIbanSchema` | `packages/shared/src/schemas/payout.schema.ts` |
| IBAN decryption | `CryptoService.decrypt` | `common/crypto/crypto.service.ts` |
| Time | `ClockService.now()` | `common/clock` (global) |
| ISO serialisation | `toIso` | `modules/offers/offer-thread.mapper.ts` |
| SAR display | `formatSar` | `components/listings/commission-calculator.tsx` |
| Upload progress + dropzone markup | `IdentityUploadForm` structure | `components/identity/identity-upload-form.tsx` |
| Interval countdown pattern | `formatLockCountdown` + `window.setInterval` | `components/admin/offer-mediation-workspace.tsx` |
| Copy-to-clipboard behaviour | `MonospaceIbanCard` copy handler (copy the *logic*, not the component) | `components/payout/monospace-iban-card.tsx` |
| Error-hint table | `OFFER_ERROR_HINTS_AR` + `resolveOfferErrorHint` | `components/offers/offer-negotiation-view.tsx` L98-125 |
| Spec style (fake prisma/tx) | `deals.service.spec.ts` | `modules/deals/__tests__/` |
| Spec style (SSR-only web) | `monospace-iban-card.spec.tsx` | `components/payout/__tests__/` |

### Decision log

- **D1 — `Payment` rows are materialized lazily by this story, not by 5.1.** Story 5.1 is closed and
  never created them; the natural creation point is the first read/upload of the payment plan, and a
  backfill is unnecessary (`payments` is empty). Idempotency comes from a DB unique key, not a
  pre-check.
- **D2 — `@@unique([dealId, paymentType])`.** Additive, safe on an empty table, and it makes the
  storage key unique per slot. Re-upload therefore *replaces* the row; 5.3/5.5 read one row per slot.
- **D3 — `proofFileUrl` stores a `FileObject.id`.** NFR-2 forbids persisting presigned URLs (≤ 5 min),
  and `getVerifiedDownloadUrl` already accepts a `FileObject` id. The column keeps its name (T-13) and
  gains a `///` comment; the wire field is named `proofFileObjectId` so readers are not misled.
- **D4 — One deal-level status transition here, none beyond it.** `AWAITING_PAYMENT_PROOF` and
  `PAYMENT_REJECTED` → `UNDER_ADMIN_AUDIT`. The PRD's richer per-actor statuses (`CancelledByBuyer` …)
  do not exist in `DealStatus` yet; inventing them would break the SQL index predicate and 5.6's scope.
- **D5 — The platform collection account is env-backed with a hard failure.** Story 5.1 explicitly
  refused to invent a source; a settings table is 8.6. An explicit, validated, loudly-failing provider
  is the only honest interim, and it is the seam 8.6 replaces.
- **D6 — A buyer deals list ships with this story.** Without `GET /deals/my` and `/app/buyer/deals`
  the screen is unreachable except by pasting a UUID; "works end-to-end" outranks "not in the AC
  list".
- **D7 — Buyer endpoints live in the `deals` module.** The architecture spine names a `payments`
  module; creating it now, for two endpoints, would split one transaction across two modules. Story
  5.3 can still extract it, and `DealsModule` already owns the deal state machine.
- **D8 — `DealSummary` is repurposed and rewritten.** It is unused (zero references), and its
  `hoursRemaining` / `platformIban` fields cannot be served clock-safely; the list projection keeps the
  fields the list actually renders.

### Verification queries

```sql
-- Task 2.2: the new unique key exists and is not dropped by db push.
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payments';

-- Story 5.1 invariant still present after the push.
SELECT indexdef FROM pg_indexes WHERE indexname = 'deal_single_active_listing';

-- Task 8.5: exactly two slots per deal after the first read/upload.
SELECT "paymentType", "status", "amount", "proofFileUrl", "uploadedAt"
FROM "payments" WHERE "dealId" = '<DEMO_DEAL_ID>' ORDER BY "paymentType";
```

### Project Structure Notes

- New module files live in the existing flat `apps/api/src/modules/deals/` (module, controller,
  service, mapper, `dto/`, `__tests__/`) — do **not** create `modules/payments/` (D7).
- New shared folder files sit beside their siblings: `deal/countdown.ts`, `deal/payment.ts`,
  `deal/index.ts` re-exports, `constants/deal.ts`, `types/deal.ts`, `schemas/deal.schema.ts`.
- New web folder `apps/web/src/components/deals/` mirrors `components/offers/` (`index.ts` barrel +
  one file per component + `__tests__/`). One new primitive (`ui/copy-button.tsx`) is added to `ui/`.
- Pages follow the existing thin-page convention: `app/app/buyer/deals/page.tsx` and
  `.../[id]/page.tsx` render a single component and read `params` as a `Promise`.
- No `apps/worker` change; no `docker-compose.yml` service change (only env keys in `.env.example`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 5.2 (L724-735)] — the acceptance criteria.
- [Source: `_bmad-output/planning-artifacts/epics.md`#E5 coverage (L169)] — FR-28…FR-36, NFR-12, AR-14,
  UX-DR4, UX-DR5.
- [Source: `_bmad-output/planning-artifacts/prds/*/prd.md`] — FR-30 (dual proof upload, national-ID
  prerequisite, `PaymentDeadline` semantics), FR-31 (review/gracce boundaries), FR-32/33/34 (what this
  story must not do), BR-02, BR-10, OQ-02, OQ-07, A-14/A-15.
- [Source: `_bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md`] — AD-3 (dual wire
  transfer, reference code `ELM-{dealId}-C`, deadline semantics), AD-4 (interactive transaction + row
  locks), AD-6/NFR-13 (quarantine), AD-10, AD-11 (ClockService), AD-13, payment state machine
  (L243-250), deal state machine (L217-232).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`] — L46
  (deal screen), L86-89 (microcopy), §1 Dual Wire Transfer Card (L99-105), §2 payment timing/grace SLA
  (L106-125).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md`] — L67-71 and
  L166-171 (tokens), L233-235 (dual wire segregation), L334-343 (card + countdown banner specs),
  L287 (`code-iban` typography).
- [Source: `apps/api/prisma/schema.prisma`] — `Deal` (L671-714), `Payment` (L716-740), `FileObject`
  (L506-520), `IdentityDocument` (L522-541), `DealStatus`/`PaymentType` (L77-96).
- [Source: `apps/api/src/modules/deals/deals.service.ts`] — the frozen snapshot write path this story
  reads back; `deal-binding.mapper.ts` for the mapping style.
- [Source: `apps/api/src/modules/storage/storage.service.ts`] — `payments` partition (L228-285),
  `getVerifiedDownloadUrl` (L530-564), `MAX_FILE_SIZE_BYTES`, `MAX_EXPIRATION_SECONDS`.
- [Source: `apps/api/src/modules/users/identity.service.ts`] — `canUploadDealPaymentProof` (L232-260)
  and the quarantine→scan→transaction pattern to mirror.
- [Source: `_bmad-output/implementation-artifacts/5-1-deal-creation-state-machine-binding-financial-snapshot-freez.md`]
  — house style, scope hand-off, traps T-1…T-12.
- [Source: `apps/web/tailwind.config.ts` L21-92] — the deal tokens and status scales already shipped.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (Qoder agent, BMAD v6 `bmad-dev-story` workflow).

### Debug Log References

- `apps/web` vitest has **no `globals: true`**: the first run of the four new deal specs failed with
  `ReferenceError: describe is not defined`. Every new spec now imports
  `{ describe, expect, it, vi } from 'vitest'` explicitly (matches `payout/__tests__/monospace-iban-card.spec.tsx`).
- `formatCommissionRatePercent(null)` returned `'0%'` because `Number(null) === 0`; the helper now
  rejects `null` / `undefined` / `''` before coercing.
- `apps/web` `npx tsc --noEmit` flagged four new errors in the specs
  (`'PLATFORM_COMMISSION'` is not assignable to `PaymentType`); fixed by importing the
  `PaymentType` enum instead of string literals. The remaining `tsc` errors
  (`.next/types/app/admin/geo/page.ts`, `.next/types/app/properties/page.ts`,
  `layout/__tests__/workspace-{shell,role-switcher}.spec.ts`, `listings/property-card.tsx`,
  `ui/__tests__/design-tokens.spec.ts`, `lib/__tests__/api-client.spec.ts`) predate this story.
- Card order class is a literal ternary (`order-1` / `order-2`), never an interpolated
  `order-${n}`: Tailwind's scanner only emits classes it can read.
- `prisma/seed.ts` is excluded from `apps/api/tsconfig.json`, so `npx tsc --noEmit` does not cover it;
  the seed was type-checked separately (`npx tsc --noEmit … prisma/seed.ts`) and compiles clean.
- Runtime 500 on `GET /api/v1/deals/:id` after implementation: the generated Prisma client was stale
  (dated before this story), so `tx.payment.upsert({ where: { dealId_paymentType } })` threw
  `PrismaClientValidationError` — the unique index existed in Postgres, but the client's
  `PaymentWhereUniqueInput` had no compound key. Root cause chain: `prisma db push` ran without a
  following `prisma generate`, and the `tx: any` parameter type in `ensureDealPayments` hid the
  missing key from `tsc`. Fixed by regenerating the client (the running dev server held
  `query_engine-windows.dll.node`, so the scratch-output workaround was used: generate to
  `.prisma-client-tmp`, copy every artifact except `*.node` into `node_modules/.prisma/client/`,
  restore `schema.prisma`). Verified: the same transaction now materializes both slots. **Any running
  API process must be restarted to load the regenerated client.**

### Completion Notes List

- Task 6 helpers live inside the required files, no extra modules: `buildDealCountdownState`
  (alias of the shared pure maths, re-exported from `deal-countdown-banner.tsx`),
  `resolvePaymentSlotActions(slot, deal)` (`dual-wire-transfer-cards.tsx`, takes `{ status, isExpired }`
  so a card never reads a clock), `validateDealProofFile` + `buildDealProofFormData`
  (`payment-proof-dropzone.tsx`), `buildDealPaymentSummaryRows` + `formatCommissionRatePercent`
  (`deal-payment-view.tsx`).
- Web specs are SSR-only (`renderToString`); `DealPaymentView` itself is never rendered (it needs
  `useAuth`), its helpers and the presentational subcomponents are.
- Proof download goes through `GET /deals/:id/payments/:paymentType/proof-url` → `window.open`, and
  tolerates both the enveloped and the bare body.
- Task 7 seeds the demo buyer with a CLEAN `FileObject` + `VERIFIED` `IdentityDocument` because
  `IdentityService.getIdentityStatus` only sets `canUploadDealPaymentProof` for a clean, non-rejected
  document — without it every upload is refused with `DEAL_IDENTITY_REQUIRED`. A terminal
  `CONVERTED_TO_DEAL` `Offer` is upserted first because `Deal.offerId` is required and unique.
  `dealNumber` / `dealReferenceCode` are the story's literal `DL-<date>-DEMO000001` /
  `ELM-DEMO000001-C` values (the shared builders derive a hex short code from the UUID, which a
  human-readable demo code cannot express) — documented deviation, both columns stay unique.
  Every row is `upsert` with `update: {}`, and no `Payment` row is written.
- An earlier seed run keeps the demo deal's original `paymentDeadline` (idempotent `update: {}` by
  design); delete the row to restart the 48-hour window.
- Verification (Task 8): `packages/shared npx tsc` clean, `apps/api npx tsc --noEmit` clean,
  `npx eslint "src/modules/deals/**/*.ts"` clean. Suites — shared **460** (was 429), api **768**
  (was 711), worker **71** (unchanged), web **364** (was 331). `apps/web npm run build` compiles
  (63 s) and then fails on the pre-existing `.next/types/app/admin/geo/page.ts` type error
  (Stories 4.4/5.1), as expected — no new build error. Manual AC walkthrough 8.5 (reseed, browser,
  upload against a live DB) was not executed in this session.

### File List

**Created**

- `apps/web/src/components/deals/index.ts`
- `apps/web/src/components/deals/deal-status-badge.tsx`
- `apps/web/src/components/deals/deal-payment-status-badge.tsx`
- `apps/web/src/components/deals/deal-countdown-banner.tsx`
- `apps/web/src/components/deals/dual-wire-transfer-cards.tsx`
- `apps/web/src/components/deals/payment-proof-dropzone.tsx`
- `apps/web/src/components/deals/deal-payment-view.tsx`
- `apps/web/src/components/deals/buyer-deals-list.tsx`
- `apps/web/src/components/deals/__tests__/deal-countdown-banner.spec.tsx`
- `apps/web/src/components/deals/__tests__/dual-wire-transfer-cards.spec.tsx`
- `apps/web/src/components/deals/__tests__/payment-proof-dropzone.spec.tsx`
- `apps/web/src/components/deals/__tests__/deal-payment-view-helpers.spec.ts`
- `apps/web/src/components/ui/copy-button.tsx`
- `apps/web/src/app/app/buyer/deals/page.tsx`
- `apps/web/src/app/app/buyer/deals/[id]/page.tsx`
- `apps/api/src/modules/deals/platform-account.ts`
- `apps/api/src/modules/deals/buyer-deals.service.ts`
- `apps/api/src/modules/deals/buyer-deals.controller.ts`
- `apps/api/src/modules/deals/deal-payment.mapper.ts`
- `apps/api/src/modules/deals/dto/upload-payment-proof.dto.ts`
- `apps/api/src/modules/deals/__tests__/buyer-deals.service.spec.ts`
- `apps/api/src/modules/deals/__tests__/buyer-deals.controller.spec.ts`
- `apps/api/src/modules/deals/__tests__/platform-account.service.spec.ts`
- `packages/shared/src/deal/countdown.ts`
- `packages/shared/src/deal/payment.ts`
- `packages/shared/src/deal/__tests__/countdown.spec.ts`
- `packages/shared/src/deal/__tests__/payment.spec.ts`
- `packages/shared/src/constants/__tests__/deal.spec.ts`

**Modified**

- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/types/deal.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/schemas/deal.schema.ts`
- `packages/shared/src/deal/index.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/web/src/components/ui/index.ts`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `.env.example`

## Change Log

| Date | Change |
| --- | --- |
| 11-07-2026 | Story created: dual wire transfer screen, 48-hour countdown banner, payment materialization, proof upload with quarantine + identity gate, buyer deals list, demo deal seed. Status → ready-for-dev. |
| 11-07-2026 | Implemented Tasks 1-8: shared payment/countdown contracts, `payments` unique slot key, `PlatformAccountService`, `BuyerDealsService`/`Controller`, the deal payment UI (`components/deals` + `copy-button` + two thin pages + buyer nav entry), the demo buyer/identity/deal seed, and the four verification steps (shared 460, api 768, worker 71, web 364). Status → review. |
