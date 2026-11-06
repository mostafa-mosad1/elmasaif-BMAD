---
baseline_commit: 10da2e8042659efb11141f8b07bdd267ba14959e
---

# Story 5.1: Deal Creation, State Machine Binding & Financial Snapshot Freezing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized administrator (`Deals.FinalApprove`),
I want to approve an agreed offer and bind it into an atomic Deal with frozen financial terms and a 48-hour deadline,
so that deal parameters remain immutable regardless of any future platform settings changes.

## Acceptance Criteria

1. **Endpoint & authorization.** `POST /api/v1/admin/deals/final-approve` accepts `{ offerId: uuid }`.
   It is guarded by `AdminSessionAuthGuard` + `AdminPermissionGuard` and requires exactly
   `@RequireAdminPermission('Deals.FinalApprove')`. An admin holding only `Offers.Review` (MODERATOR,
   FINANCIAL_AUDITOR, COMPLIANCE_OFFICER) is rejected by the existing guard with the standard 403
   envelope. Response `200 { statusCode, message, data: DealBinding }` — the standard envelope
   (`{ statusCode, message?, data }`) used by every other admin endpoint.
2. **Atomic binding.** One interactive `$transaction` performs *all* of the following, or none of it:
   creates `Deal` with `status = AWAITING_PAYMENT_PROOF`; flips `Listing.status` to `RESERVED`;
   sets the approved `Offer.status` to `CONVERTED_TO_DEAL`, bumps its `version`, releases its AD-10
   lease columns (`lockedByAdminId/lockedAt/lockExpiresAt → null`); writes one `OfferHistory` row;
   writes one `AuditLog` row. A failure at any step leaves no Deal, no reservation and no offer change.
3. **At most one active Deal per listing (BR-07 / AD-4).** A partial unique index
   `deal_single_active_listing` on `"deals" ("listingId")` whose predicate excludes terminal
   statuses makes a second non-terminal deal physically impossible. A concurrent second approval
   surfaces as `409 DEAL_ALREADY_ACTIVE_FOR_LISTING` (friendly pre-check *and* `P2002` mapping),
   never as a 500 and never as two deals.
4. **Frozen financial snapshot (FR-29 / AD-3).** The Deal stores `dealPrice` (FinalDealPrice),
   `platformCommission` (FinalCommission), `totalAmount` (FinalTotal), `commissionRateSnapshot`
   (`Decimal(5,4)`, the fraction `0.0250` = 2.5 %), `fixedCommissionSnapshot`
   (`Decimal(12,2)`, `0.00` SAR) and `paymentWindowHoursSnapshot` (`48`). All arithmetic is
   fixed-point decimal with round-half-up at 2 dp — no floating point anywhere in the money path
   (BR-02). `totalAmount = dealPrice + platformCommission` is also enforced by a DB `CHECK`.
5. **Frozen seller payout snapshot (FR-29).** The Deal stores `sellerPayoutAccountId`,
   `sellerPayoutHolderName`, `sellerPayoutBankName` (nullable), `sellerPayoutIbanEncrypted`
   (AES-256-GCM via the existing `CryptoService`) and `sellerPayoutIbanMasked`. After creation,
   changing or deleting the source `PayoutAccount` row cannot alter what the buyer is asked to pay.
6. **Deadline (FR-28 / AD-3 / AD-11).** `paymentDeadline = ClockService.now() + 48h` exactly
   (`paymentWindowHoursSnapshot * 3_600_000` ms), and `createdAt` is written from the same
   `ClockService` value so `paymentDeadline - createdAt` is exactly 48 h. Nothing calls `new Date()`
   for this computation.
7. **Identifiers.** `id` is a service-generated UUID v4, so both human-facing codes are set in the
   single `create`: `dealReferenceCode = "ELM-<SHORT>-C"` and `dealNumber = "DL-<yyyyMMdd>-<SHORT>"`,
   where `SHORT` is 10 upper-case hex characters derived from the UUID and `yyyyMMdd` comes from
   `ClockService`. Both columns keep their existing `@unique` guarantee.
8. **Claim-lease discipline (AD-10).** The caller must hold the live offer lease: the service calls
   the existing `assertLockHeld(offer, admin.id, now)` inside the transaction, so
   `OFFER_LOCK_REQUIRED` / `OFFER_LOCK_CONFLICT` / `OFFER_LOCK_EXPIRED` are raised before any write.
   `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` is already in `CLAIMABLE_OFFER_STATUSES`, so the existing
   `POST /admin/offers/:id/claim` needs no change.
9. **Preconditions & error codes.** In transaction order: offer exists (`404 OFFER_NOT_FOUND`);
   lease held; status is `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` else
   `409 OFFER_INVALID_STATE_TRANSITION`; `expiresAt > now` else `409 OFFER_ALREADY_EXPIRED`;
   listing is `ACTIVE` else `409 DEAL_LISTING_UNAVAILABLE`; no non-terminal deal on the listing else
   `409 DEAL_ALREADY_ACTIVE_FOR_LISTING`; the seller has at least one `PayoutAccount` else
   `409 DEAL_SELLER_PAYOUT_REQUIRED`. Every code carries an Arabic message.
10. **Offer lifecycle & reserve integrity.** `CONVERTED_TO_DEAL` is added to `OfferStatus` and to
    `TERMINAL_OFFER_STATUSES` (never to `ACTIVE_OFFER_STATUSES` or `EXPIRABLE_OFFER_STATUSES`), so
    the winning offer stops blocking `OFFER_ACTIVE_EXISTS` re-offers after a future cancellation and
    stops being claimable for mediation. **Backup reserve offers are NOT touched by this story** —
    they stay queued in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` and are closed only by Story 5.4.
11. **Admin UI.** The admin negotiation workspace (`/admin/negotiations/[id]`) shows a frozen
    financial preview (deal price, 2.5 % commission, total, 48 h deadline), exposes a
    confirmation-gated "final approval" action only when the caller holds the lease and the offer is
    in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`, posts to the new endpoint, then shows the returned
    `dealReferenceCode` and reloads the thread.
12. **Schema discipline & DB invariant maintenance.** Prisma changes are strictly additive (no
    renames, no drops — `prisma db push` is the only migration mechanism in this repo) and the partial
    index + `CHECK` live in an idempotent SQL file that is applied by the same npm script that pushes
    the schema, because `prisma db push` drops indexes it cannot express.
13. **Tests.** New unit coverage for the shared money/identity helpers, the shared status-set
    invariant, `DealsService` (happy path + every 409 + `P2002` mapping) and the controller; the web
    workspace test covers the gated action. No existing suite regresses.

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts** (AC: 4, 5, 7, 9, 10, 12)
  - [x] 1.1 `packages/shared/src/enums/index.ts`: append `CONVERTED_TO_DEAL` to `OfferStatus`.
  - [x] 1.2 `packages/shared/src/constants/offer.ts`: add `OfferStatus.CONVERTED_TO_DEAL` to
        `TERMINAL_OFFER_STATUSES`; add `OFFER_STATUS_LABELS_AR[CONVERTED_TO_DEAL] = 'محوَّل إلى صفقة'`;
        add `OFFER_HISTORY_ACTIONS.CONVERTED_TO_DEAL = 'OFFER_CONVERTED_TO_DEAL'` with
        `OFFER_HISTORY_ACTION_LABELS_AR['OFFER_CONVERTED_TO_DEAL'] = 'تحويل العرض المعتمد إلى صفقة'`.
        Do **not** touch `ACTIVE_OFFER_STATUSES` or `EXPIRABLE_OFFER_STATUSES`.
  - [x] 1.3 New `packages/shared/src/constants/deal.ts`: `DEAL_ALREADY_ACTIVE_FOR_LISTING`,
        `DEAL_SELLER_PAYOUT_REQUIRED`, `DEAL_LISTING_UNAVAILABLE`; `ACTIVE_DEAL_STATUSES`
        (`AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED` — its exact complement
        must mirror the SQL predicate); the three defaults `DEFAULT_COMMISSION_RATE`
        (= `PLATFORM_COMMISSION_PERCENTAGE`), `DEFAULT_FIXED_COMMISSION_SAR = '0.00'`,
        `DEFAULT_PAYMENT_WINDOW_HOURS` (= `DEAL_PAYMENT_DEADLINE_HOURS`); the code prefixes
        `DEAL_NUMBER_PREFIX = 'DL'`, `DEAL_REFERENCE_PREFIX = 'ELM'`, `DEAL_REFERENCE_SUFFIX = 'C'`,
        `DEAL_SHORT_CODE_LENGTH = 10`. Register `export * from './deal';` in `constants/index.ts`.
  - [x] 1.4 New `packages/shared/src/deal/money.ts` — fixed-point helpers (see Dev Notes §Money).
  - [x] 1.5 New `packages/shared/src/deal/identity.ts` — `buildDealShortCode`, `buildDealNumber`,
        `buildDealReferenceCode`; plus `packages/shared/src/deal/index.ts` re-exporting both files.
  - [x] 1.6 New `packages/shared/src/types/deal.ts` — `DealBinding` and `FinalApproveDealInput`;
        re-export from `types/index.ts`. **Leave the existing unused `DealSummary` untouched** — it is
        Story 5.2's buyer projection.
  - [x] 1.7 New `packages/shared/src/schemas/deal.schema.ts` — `finalApproveDealSchema`
        (`offerId: z.string().uuid(...)`); re-export from `schemas/index.ts`.
  - [x] 1.8 Register `export * from './deal';` in `packages/shared/src/index.ts`.
  - [x] 1.9 Tests: extend `constants/__tests__/offer.spec.ts` (partition test now covers the new
        terminal member); new `deal/__tests__/money.spec.ts` and `deal/__tests__/identity.spec.ts`.

- [x] **Task 2 — Prisma schema and DB invariants** (AC: 2, 3, 4, 5, 6, 7, 12)
  - [x] 2.1 `apps/api/prisma/schema.prisma`: add `CONVERTED_TO_DEAL` to `enum OfferStatus`.
  - [x] 2.2 Additively extend `model Deal` with `offerId String @unique`,
        `commissionRateSnapshot Decimal @db.Decimal(5, 4)`,
        `fixedCommissionSnapshot Decimal @db.Decimal(12, 2)`, `paymentWindowHoursSnapshot Int`,
        `sellerPayoutAccountId String`, `sellerPayoutHolderName String`,
        `sellerPayoutBankName String?`, `sellerPayoutIbanEncrypted String`,
        `sellerPayoutIbanMasked String`, `approvedByAdminId String`.
        Keep existing columns and their names — document the FR-29 mapping in a `///` comment.
        Add no other index: `@@index([listingId, status])` already covers the lookups this story makes.
  - [x] 2.3 New `apps/api/prisma/sql/deal-invariants.sql` — idempotent partial unique index plus the
        money `CHECK` (see Dev Notes §Database invariants).
  - [x] 2.4 `apps/api/package.json`: `"prisma:push": "prisma db push && prisma db execute --file prisma/sql/deal-invariants.sql --schema prisma/schema.prisma"`.
  - [x] 2.5 Run `npm run prisma:push` from `apps/api` (generates the client too) and verify with the
        `pg_indexes` / `pg_constraint` queries in Dev Notes §Verification.

- [x] **Task 3 — One source of truth for "active deal"** (AC: 3, 12)
  - [x] 3.1 Replace the four inline `DealStatus` arrays with `ACTIVE_DEAL_STATUSES`:
        `modules/users/payout.service.ts` (`isAccountBoundToActiveDeal`),
        `modules/listings/listings.service.ts` (archive guard),
        `modules/users/account-deletion.service.ts`,
        `modules/users/phone-change.service.ts`.
  - [x] 3.2 `phone-change.service.ts` currently omits `PAYMENT_REJECTED`; adopting the constant fixes
        that latent hole. Extend its spec with a `PAYMENT_REJECTED` case.

- [x] **Task 4 — `DealsModule` + `DealsService.finalApprove`** (AC: 2, 4, 5, 6, 7, 8, 9, 10)
  - [x] 4.1 New `apps/api/src/modules/deals/` with `deals.module.ts`, `deals.service.ts`,
        `deal-binding.mapper.ts`, `dto/final-approve-deal.dto.ts`, `__tests__/`.
        Register `DealsModule` in `apps/api/src/app.module.ts` (after `OffersModule`).
        Module imports: `PrismaModule`, `ClockModule`, `AuthModule`, `CryptoModule`; providers include
        `AdminSessionAuthGuard`, `AdminPermissionGuard`, `DealsService`; controllers:
        `AdminDealsController`.
  - [x] 4.2 Implement `finalApprove(offerId, admin)` with the exact step order in Dev Notes
        §The binding transaction. Money via the shared helpers only; `String(offer.offerPrice)` to get
        the decimal text out of Prisma — never `Number()`.
  - [x] 4.3 Map `Prisma.PrismaClientKnownRequestError` `P2002` on the deal insert to
        `DEAL_ALREADY_ACTIVE_FOR_LISTING` (the index is the real guarantee; the pre-check is a courtesy).
  - [x] 4.4 Remove the now-stale `// TODO(5.1)` markers at `offers.service.ts:527` and
        `backup-offers.service.ts:345`, replacing them with a one-line pointer to `DealsService`.
        Leave `proposals.service.ts:352` alone (see Dev Notes §Scope boundaries).
  - [x] 4.5 Tests `__tests__/deals.service.spec.ts` and `__tests__/admin-deals.controller.spec.ts`
        using the fake-`prisma` / fake-`tx` style already used by the offer specs.

- [x] **Task 5 — Admin controller** (AC: 1, 8)
  - [x] 5.1 `AdminDealsController`: `@Controller('admin/deals')`, class-level
        `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)`, `@Post('final-approve')`,
        `@HttpCode(HttpStatus.OK)`, `@RequireAdminPermission('Deals.FinalApprove')`, body validated by
        `new ZodValidationPipe(finalApproveDealSchema)`, Swagger decorators mirroring
        `AdminOffersController`, `@Req() req` → `req.admin` typed as `AuthenticatedAdminActor`.
  - [x] 5.2 Return `{ statusCode: HttpStatus.OK, message: 'تم إنشاء الصفقة وحجز الإعلان بنجاح', data }`.

- [x] **Task 6 — Admin workspace UI** (AC: 11)
  - [x] 6.1 `apps/web/src/components/admin/offer-mediation-workspace.tsx`: add the frozen financials
        panel using `computeDealAmounts` + `formatSar`; add the confirm-gated final-approve action
        (`data-testid="mediation-final-approve"`); on success show the returned `dealReferenceCode`
        in the existing success banner and `load()`.
  - [x] 6.2 `apps/web/src/components/offers/offer-negotiation-view.tsx`: add Arabic hints for
        `DEAL_ALREADY_ACTIVE_FOR_LISTING`, `DEAL_SELLER_PAYOUT_REQUIRED`, `DEAL_LISTING_UNAVAILABLE` to
        `OFFER_ERROR_HINTS_AR`.
  - [x] 6.3 `apps/web/src/components/offers/offer-status-badge.tsx`: add the `CONVERTED_TO_DEAL`
        variant (`'verified'`) — the `Record<OfferStatus, …>` map will not compile without it.
  - [x] 6.4 Test: `apps/web/src/components/admin/__tests__/offer-mediation-workspace.spec.tsx`
        (new file, mock `apiClient`): action hidden without the lease, hidden in other states, POSTs
        `{ offerId }` when enabled.

- [x] **Task 7 — Seed a demo payout account** (AC: 5, manual verification)
  - [x] 7.1 `apps/api/prisma/seed.ts` seeds `DEMO_SELLER` with a `payoutIban` string but **no**
        `PayoutAccount` row, so no seeded listing can ever be finalized. Add an idempotent
        `payoutAccount.upsert` for `DEMO_SELLER.profileId` (`accountHolderName` = seller full name,
        `bankName` from `getSaudiBankName(DEMO_SELLER.iban)`, `ibanEncrypted` = `new CryptoService(new ConfigService()).encrypt(DEMO_SELLER.iban)`,
        `ibanMasked` = `maskSaudiIban(...)`, `ibanLast4` = last 4, `isDefault: true`).

- [x] **Task 8 — Verify** (AC: 13)
  - [x] 8.1 `cd packages/shared && npx tsc` (the api/web suites resolve `packages/shared/dist`, not `src`).
  - [x] 8.2 `cd apps/api && npx tsc --noEmit`, `npx eslint "src/**/*.ts"`.
  - [x] 8.3 `cd packages/shared && npm test`; `cd apps/api && npm test`; `cd apps/worker && npm test`;
        `cd apps/web && npm test`. Report the four counts in the Dev Agent Record; no regressions.
  - [x] 8.4 Web build: `cd apps/web && npm run build`.
  - [x] 8.5 Manual: re-seed, claim the offer at `/admin/negotiations/<id>`, approve, then confirm the
        `deals` row, `listings.status = RESERVED`, `offers.status = CONVERTED_TO_DEAL`, the
        `offer_history` and `audit_logs` rows, and that a second approval attempt returns 409.

## Dev Notes

### Scope boundaries

- **In scope:** the approval endpoint, the binding transaction, frozen snapshots, the partial unique
  index, the `CONVERTED_TO_DEAL` terminal state, the admin UI action.
- **Out of scope, explicitly:**
  - `Payment` rows, proofs, and the deal screen (`/app/buyer/deals/:id`) → **Story 5.2**. The frozen
    `platformIban` in `DealSummary` has no source of truth in this codebase yet (Story 8.6 owns
    settings) — do not invent one.
  - Admin proof review / grace period → **5.3**. Completion, contact release, rating unlock → **5.4**.
    Timeout cancellation → **5.5**. Buyer/seller cancellation and disputes → **5.6**.
  - Closing the reserve queue. `BackupOffersService.closeRemainingBackupOffersForListing` is called by
    **5.4**, not here. `OffersModule` already exports it; `DealsModule` must **not** import
    `OffersModule` or inject `BackupOffersService` in this story.
  - `proposals.service.ts:352` (`TODO(5.1)` on the demand-proposal path). That path selects a proposal,
    it does not put an `Offer` in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`, and none of this story's ACs
    cover it. Leave the marker; it belongs to the future proposal→deal story.
  - Renaming Deal columns, migrating `prisma migrate`, or introducing a settings table.

### Previous story intelligence (4.1 → 4.4)

- **4.1** shipped a runtime `500` because a raw row lock cast a `text` id to `::uuid` (Postgres `42883`).
  Every `$queryRaw … FOR UPDATE` in this repo uses `::text` (trap T-1).
- **4.2** established the admin decision pattern this story copies: interactive `$transaction` → row
  lock → `assertLockHeld` → state check → expiry check → write → `offerHistory` → `auditLog`, with the
  lease cleared on commit.
- **4.2/4.3** proved that entity errors are **shared constants + Arabic messages**, never string
  literals at the throw site, and that the exhaustive `Record<Enum, …>` label maps are the mechanism
  that forces a new enum member to be handled everywhere (trap T-8).
- **4.3** left the exact hand-off this story must honour: reserves stay queued (trap T-6),
  `closeRemainingBackupOffersForListing(listingId, meta, tx)` only works inside the caller's
  transaction, and it skips `activatedAt != null` because the activated offer is the winner.
- **4.4** extracted the single AD-10 lease into `common/locks/claim-lock.ts` with per-module code
  bindings (`offer-lock.ts`). Reuse it; do not write a second lease implementation.
- **Repo habits that will bite:** `prisma db push` is the only migration path; `packages/shared/dist` is
  what api/web tests import, so rebuild it first; admin endpoints all return
  `{ statusCode, message?, data }` and the web `apiClient` rejects with `ApiError` carrying `.code`.
- **Recent commits:** 4.4 inquiries → 4.3 backup queue → 4.2 counter-offers → 4.1 offer intake, plus a
  web-only modal refactor. Nothing has ever written a `Deal`; this is the first write path into
  `deals`, so treat every column default in it as unproven.
- **Suite baselines after 4.3:** shared 349, api 623, worker 71, web 273. Report the four new totals;
  any drop is a regression.

### Current state (verified in this codebase)

- **No `Deals` module exists.** `apps/api/src/app.module.ts` imports Clock, Prisma, Health, Storage,
  Geo, Auth, Users, Listings, Demands, Proposals, Offers, Inquiries — and nothing else. Nothing in the
  repo ever calls `prisma.deal.create(...)`, so the `deals` table is **empty** and required columns can
  be added safely.
- **`Deal` already exists** (`schema.prisma` L661-687) with `dealPrice`, `platformCommission`,
  `totalAmount`, `dealReferenceCode @unique`, `dealNumber @unique`, `status`, `paymentDeadline`,
  `version`, `@@index([listingId, status])`. It has no `offerId`, no snapshot columns, no partial index.
- **`DealStatus`** = `AWAITING_PAYMENT_PROOF | UNDER_ADMIN_AUDIT | PAYMENT_REJECTED | COMPLETED |
  CANCELLED | TERMINATED`. Terminal = `COMPLETED`, `CANCELLED`, `TERMINATED` (no per-actor variants
  exist yet, unlike the illustrative SQL in the architecture spine).
- **`OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL`** is produced by `OffersService.acceptBySeller`
  / `acceptByBuyer` and is already claimable (`CLAIMABLE_OFFER_STATUSES` in `admin-offers.service.ts`).
  `OffersService` L527 and `BackupOffersService` L345 carry the hand-off `TODO(5.1)` markers.
- **`PayoutAccount`** (`schema.prisma` L306-323) stores `accountHolderName`, `bankName?`,
  `ibanEncrypted`, `ibanMasked`, `ibanLast4`, `isDefault`. `Listing.payoutIban` holds a **masked**
  IBAN (Story 1.5 writes `ibanMasked` into it), so it can never be the snapshot source.
- Table/column names in `deals`, `offers` and `listings` are **camelCase without `@map`** — raw SQL
  must quote them: `"deals"."listingId"`, `"offers"."id"`.
- `apps/api` has no SQL files; `prisma:push` is currently a bare `prisma db push`; Prisma is `^5.14.0`
  (so `prisma db execute --file` is available).

### The binding transaction

Follow this order exactly. It is the contract; the identifiers are the ones the tests assert.

```ts
// Display names only — an offer payload must never leak a mobile number, email or IBAN.
const BINDING_INCLUDE = {
  listing: { select: { id: true, status: true, sellerProfileId: true } },
} as const;
const SELLER_INCLUDE = {
  sellerProfile: { include: { user: { select: { fullName: true } } } },
} as const;

async finalApprove(offerId: string, admin: AuthenticatedAdminActor): Promise<DealBinding> {
  const now = this.clockService.now();

  return this.prisma.$transaction(async (tx: any) => {
    // 1. Offer row first. `offers.id` is a `text` column: cast `::text`, NEVER `::uuid`
    //    (Story 4.1 shipped a 42883 runtime 500 by casting to uuid).
    await tx.$queryRaw`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE`;

    const offer = await tx.offer.findUnique({ where: { id: offerId }, include: BINDING_INCLUDE });
    if (!offer) throw offerNotFound();

    // 2. AD-10: the lease is validated in-transaction so a stale approval cannot commit.
    assertLockHeld(offer, admin.id, now);

    // 3. State + expiry.
    if (offer.status !== OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL)
      throw new ConflictException({ code: OFFER_INVALID_STATE_TRANSITION, message: '<AR>' });
    if (new Date(offer.expiresAt).getTime() <= now.getTime())
      throw new ConflictException({ code: OFFER_ALREADY_EXPIRED, message: '<AR>' });

    // 4. Listing lock, then re-read it. Lock order is always offer -> listing (see trap T-12).
    await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${offer.listingId}::text FOR UPDATE`;
    const listing = await tx.listing.findUnique({ where: { id: offer.listingId }, include: SELLER_INCLUDE });
    if (!listing || listing.status !== ListingStatus.ACTIVE)
      throw new ConflictException({ code: DEAL_LISTING_UNAVAILABLE, message: '<AR>' });

    // 5. Friendly pre-check; the partial unique index is the real guarantee.
    const existing = await tx.deal.findFirst({
      where: { listingId: listing.id, status: { in: [...ACTIVE_DEAL_STATUSES] } },
      select: { id: true, dealNumber: true },
    });
    if (existing) throw new ConflictException({ code: DEAL_ALREADY_ACTIVE_FOR_LISTING, message: '<AR>', details: existing });

    // 6. Seller payout snapshot source (a seller may hold several accounts).
    const payout = await tx.payoutAccount.findFirst({
      where: { profileId: listing.sellerProfileId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    if (!payout) throw new ConflictException({ code: DEAL_SELLER_PAYOUT_REQUIRED, message: '<AR>' });

    // 7. Money — shared fixed-point helper only.
    const amounts = computeDealAmounts({
      dealPrice: String(offer.offerPrice),
      commissionRate: DEFAULT_COMMISSION_RATE,
      fixedCommission: DEFAULT_FIXED_COMMISSION_SAR,
    });

    // 8. Identifiers are pre-generated so both unique codes land in ONE insert
    //    (Prisma's @default(uuid()) would only hand the id back after the row exists).
    const dealId = randomUUID();
    const paymentWindowHours = DEFAULT_PAYMENT_WINDOW_HOURS; // TODO(8.6): settings row.
    const paymentDeadline = new Date(now.getTime() + paymentWindowHours * 3_600_000);

    const deal = await tx.deal.create({
      data: {
        id: dealId,
        dealNumber: buildDealNumber(dealId, now),
        dealReferenceCode: buildDealReferenceCode(dealId),
        offerId: offer.id,
        listingId: listing.id,
        buyerProfileId: offer.buyerProfileId,
        sellerProfileId: listing.sellerProfileId,
        dealPrice: amounts.finalDealPrice,
        platformCommission: amounts.finalCommission,
        totalAmount: amounts.finalTotal,
        commissionRateSnapshot: DEFAULT_COMMISSION_RATE.toFixed(4), // '0.0250'
        fixedCommissionSnapshot: amounts.fixedCommission,
        paymentWindowHoursSnapshot: paymentWindowHours,
        sellerPayoutAccountId: payout.id,
        sellerPayoutHolderName: payout.accountHolderName,
        sellerPayoutBankName: payout.bankName ?? getSaudiBankName(this.crypto.decrypt(payout.ibanEncrypted)),
        sellerPayoutIbanEncrypted: payout.ibanEncrypted, // already AES-256-GCM at rest; copy, do not re-encrypt plaintext
        sellerPayoutIbanMasked: payout.ibanMasked,
        approvedByAdminId: admin.id,
        status: DealStatus.AWAITING_PAYMENT_PROOF, // explicit, never rely on the column default
        paymentDeadline,
        createdAt: now, // AD-11: same clock as the deadline
      },
    });

    await tx.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.RESERVED, version: { increment: 1 } },
    });

    await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: OfferStatus.CONVERTED_TO_DEAL,
        version: { increment: 1 },
        lockedByAdminId: null, lockedAt: null, lockExpiresAt: null,
      },
    });

    await tx.offerHistory.create({ data: {
      offerId: offer.id, actorAdminId: admin.id,
      action: OFFER_HISTORY_ACTIONS.CONVERTED_TO_DEAL,
      priceSnapshot: amounts.finalDealPrice, // already a 2-dp string
      notes: `dealReferenceCode=${deal.dealReferenceCode}`,
      roundNumber: Number(offer.negotiationRound ?? 0),
    }});

    await tx.auditLog.create({ data: {
      actorId: admin.id, actorType: 'ADMIN', action: 'DEAL_CREATED',
      entityType: 'Deal', entityId: deal.id,
      payload: { offerId: offer.id, listingId: listing.id, dealNumber: deal.dealNumber,
                 dealReferenceCode: deal.dealReferenceCode, dealPrice: amounts.finalDealPrice,
                 commission: amounts.finalCommission, total: amounts.finalTotal,
                 paymentDeadline: paymentDeadline.toISOString(), adminName: admin.fullName },
    }});

    // 9. Deliberately NOT closing reserve backup offers — Story 5.4 owns that.
    return toDealBinding(deal, payout);
  });
}
```

Wrap the `deal.create` in `try/catch` for `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'`
(same 409 `DEAL_ALREADY_ACTIVE_FOR_LISTING`) — the pre-check in step 5 cannot see a competitor's
in-flight insert.

### Money

`packages/shared/src/deal/money.ts` (mirrors how `masking/` owns the one contact-masking
implementation). No new dependency — `decimal.js` is **not** added.

```ts
const HALALAS_PER_SAR = 100n;
const RATE_MICROS = 1_000_000n;            // 1.000000 == 100 %

export function parseSarToHalalas(value: string | number): bigint;  // '3000000.00' -> 300000000n
export function formatHalalas(halalas: bigint): string;             // 300000000n -> '3000000.00'
export function parseRateToMicros(rate: string | number): bigint;   // '0.025' -> 25000n

/** round-half-up at 2 dp: (price * rate + 0.5) floor, plus the fixed fee. */
export function computeCommissionHalalas(priceHalalas: bigint, rateMicros: bigint, fixedHalalas: bigint): bigint {
  return (priceHalalas * rateMicros + RATE_MICROS / 2n) / RATE_MICROS + fixedHalalas;
}

export function computeDealAmounts(input: {
  dealPrice: string | number; commissionRate: string | number; fixedCommission: string | number;
}): { finalDealPrice: string; finalCommission: string; fixedCommission: string; finalTotal: string };
```

- `parseSarToHalalas` must accept what Prisma `Decimal.toString()` actually returns
  (`'3000000'`, `'3000000.5'`, `'0.00'`) as well as `number`; reject anything else with a thrown error
  rather than silently truncating.
- Only bigint arithmetic inside the helpers. `Number()` is allowed **nowhere** in this path (BR-02).
- Pin these three cases in the spec: `3_000_000 × 0.025 = 75_000` → total `3_075_000` (the UX
  journey); `1_234.56 × 0.025 = 30.864 → 30.86` (half-up at 2 dp); `0 + 0.00 fixed` stays `0.00`.
- `parseRateToMicros` is what makes `Decimal(5,4)` snapshots lossless: store `'0.0250'`, read it back
  as `25000n` micros.

### Identifiers

```ts
buildDealShortCode(id)            // id.replace(/-/g, '').slice(0, 10).toUpperCase()
buildDealNumber(id, now)          // `DL-${yyyy}${MM}${dd}-${short}`  ← date from ClockService, not Date
buildDealReferenceCode(id)        // `ELM-${short}-C`
```

10 hex characters ≈ 1.1 × 10^12 space, so the `@unique` constraints are a safety net, not a birthday
problem. The UX example `ELM-408-C` implies a numeric sequence; this repo has no counter table and the
deal id is a UUID, so the short code is the honest equivalent — record it as a documented deviation
rather than adding a sequence.

### Database invariants

`prisma db push` cannot express a partial index and **drops indexes it does not know about**, so the
invariants live in `apps/api/prisma/sql/deal-invariants.sql` and are re-applied by `prisma:push`:

```sql
-- AD-4 / BR-07: at most one non-terminal Deal per listing.
-- Maintenance contract: every future TERMINAL DealStatus must be added to this list.
-- A new *non-terminal* status (e.g. DISPUTED in 5.6) needs no change — it stays covered.
CREATE UNIQUE INDEX IF NOT EXISTS deal_single_active_listing
  ON "deals" ("listingId")
  WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED');

-- BR-02: the stored money must be internally consistent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_amounts_consistent') THEN
    ALTER TABLE "deals" ADD CONSTRAINT deals_amounts_consistent
      CHECK ("dealPrice" > 0 AND "platformCommission" >= 0
             AND "totalAmount" = "dealPrice" + "platformCommission");
  END IF;
END $$;
```

`NOT IN (terminal…)` is intentional and must not be rewritten as `IN (active…)`: with the negative
form, a future non-terminal status is automatically covered; with the positive form it would silently
fall outside the index and two deals could exist for one listing.

### Verification queries

```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'deal_single_active_listing';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'deals_amounts_consistent';
```

### Critical implementation traps

- **T-1 `::text`, never `::uuid`.** `offers.id` / `listings.id` are `text` columns. Casting to `uuid`
  raises Postgres `42883` → an unhandled 500. Story 4.1 shipped exactly this bug.
- **T-2 Never nest a client-level `$transaction`.** `closeRemainingBackupOffersForListing` is built to
  accept an outer `tx` for this reason; a nested `this.prisma.$transaction` runs on another connection
  and deadlocks against the row locks. (Moot here — 5.1 does not call it — but the same rule applies to
  every helper you reach for.)
- **T-3 `prisma db push` silently drops `deal_single_active_listing`.** Always push through the npm
  script; never run bare `prisma db push --force-reset` against a shared database.
- **T-4 No floats in the money path.** `Number(offer.offerPrice)` appears all over the offers code for
  *display*. For storage use `String(...)` + the shared helpers. A `Math.round(price * 0.025)` here will
  pass review-by-eye and fail BR-02 in production for large prices.
- **T-5 Do not rely on column defaults.** Pass `status` and `createdAt` explicitly; the DB default for
  `createdAt` is the database clock, not `ClockService`, and would break the exact-48 h assertion.
- **T-6 Do not close reserve backups here.** The reserve queue is the fallback if this deal is later
  cancelled (5.5/5.6). Closing it at creation destroys the fallback. `activatedAt != null` offers are
  already skipped by the helper, but the helper itself is not called until 5.4.
- **T-7 No destructive schema changes.** `db push` is the only mechanism: renaming `dealPrice` →
  `finalDealPrice` would drop and recreate the column. Keep the existing names and document the FR-29
  mapping in `schema.prisma`.
- **T-8 An enum member is not enough.** `OFFER_STATUS_LABELS_AR`, `OFFER_HISTORY_ACTION_LABELS_AR`
  (shared) and `OFFER_STATUS_VARIANTS` (web) are `Record<Enum, …>`, so `tsc` fails until each is
  updated. That is the guard working as designed — fix the maps, do not loosen the types.
- **T-9 A seller may have several payout accounts.** Order by `isDefault desc, createdAt desc`; never
  `findFirst` unqualified.
- **T-10 Stale `packages/shared/dist`.** api/web jest+vitest resolve the built package, not `src`.
  Rebuild shared first or the new exports appear missing.
- **T-11 `P2002` must be caught**, otherwise the losing racer in a concurrent approval gets a 500.
- **T-12 Lock order is offer → listing.** This is the only transaction that locks both tables today;
  keep the order fixed so future stories cannot deadlock against it.

### Architecture compliance

- **AD-2 (explicit action endpoints):** `POST /admin/deals/final-approve` with a body — no generic
  `PATCH /deals/:id`. Deviation from the spine's illustrative `POST /admin/deals/:id/final-approve`:
  no deal id exists before approval, so the offer id is the subject and it moves in the body. Grouping
  under `admin/deals` keeps 5.3/5.6 in the same namespace.
- **AD-3:** non-custodial settlement with snapshotted terms; the deadline is computed at creation and
  never recomputed.
- **AD-4:** interactive transaction + `$queryRaw … FOR UPDATE` + partial unique index + `CHECK`.
- **AD-10:** claim lease validated in-transaction and released on commit.
- **AD-11:** `ClockService.now()` is the only time source (deadline, `createdAt`, `yyyyMMdd`, audit `at`).
- **AD-12:** `Deals.FinalApprove` is SUPER_ADMIN-only in `ADMIN_ROLE_PERMISSIONS`; no seeding change.
- **FR-51 separation of duties:** the mediator who relayed the offer may approve it — that is the
  documented flow (the role matrix only lets SUPER_ADMIN hold `Deals.FinalApprove`).

### Reuse map (do not reinvent)

| Need | Use | Where |
|---|---|---|
| Lease validation | `assertLockHeld`, `offerNotFound` | `modules/offers/offer-lock.ts` |
| Offer history action names | `OFFER_HISTORY_ACTIONS` | `packages/shared/src/constants/offer.ts` |
| IBAN masking / bank name | `maskSaudiIban`, `getSaudiBankName` | `packages/shared/src/schemas/payout.schema.ts` |
| IBAN encryption | `CryptoService.encrypt/decrypt` | `common/crypto/crypto.service.ts` (`CryptoModule` exports it) |
| Time | `ClockService.now()` | `common/clock` (global) |
| Commission / window defaults | `PLATFORM_COMMISSION_PERCENTAGE`, `DEAL_PAYMENT_DEADLINE_HOURS` | `packages/shared/src/constants/index.ts` |
| Admin actor type | `AuthenticatedAdminActor` | `modules/listings/admin-listings.service.ts` |
| ISO serialisation | `toIso` | `modules/offers/offer-thread.mapper.ts` |
| SAR display (web) | `formatSar` | `apps/web/src/components/listings/commission-calculator.tsx` |
| Controller/guard/Swagger shape | `AdminOffersController` | `modules/offers/admin-offers.controller.ts` |
| Spec style (fake prisma/tx) | offer specs | `modules/offers/__tests__/*.spec.ts` |

New shared modules must mirror the existing `masking/` folder shape (`index.ts` + implementation +
`__tests__/`) so the package layout does not gain a second convention.

### Decision log

- **D1 — keep `dealPrice` / `platformCommission` / `totalAmount`.** They are the storage for
  FinalDealPrice / FinalCommission / FinalTotal. Renaming under `db push` is destructive; the mapping is
  documented in `schema.prisma` and in `DealBinding`.
- **D2 — new terminal `OfferStatus.CONVERTED_TO_DEAL`.** Leaving the winner in
  `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` would (a) keep it in `ACTIVE_OFFER_STATUSES` until its
  +7-day `expiresAt` passes — `EXPIRABLE_OFFER_STATUSES` deliberately excludes it, so the sweep never
  clears it — which makes `OFFER_ACTIVE_EXISTS` reject the buyer's next offer on that listing if the
  deal is later cancelled (5.5/5.6), (b) keep it claimable in the mediation queue, and (c) render a
  state that is no longer true. Terminal is the only honest classification.
- **D3 — the seller must have a `PayoutAccount`.** `Listing.payoutIban` is a masked string (Story 1.5),
  so it cannot supply the snapshot. Blocking with `DEAL_SELLER_PAYOUT_REQUIRED` is preferable to
  freezing an unusable IBAN. Task 7 makes the seeded demo seller satisfy this.
- **D4 — copy `payout.ibanEncrypted` verbatim.** It is already AES-256-GCM ciphertext; decrypting and
  re-encrypting would add nothing and risks logging plaintext on the way through.
- **D5 — ids: service-generated UUID + 10-char short code.** No counter table; the reference code stays
  short enough to be typed into a bank transfer.
- **D6 — `ACTIVE_DEAL_STATUSES` extraction (Task 3).** The same predicate now exists in four services,
  one of which (`phone-change`) had already drifted. One constant + one SQL predicate, both documented
  against each other.
- **D7 — endpoint path `POST /admin/deals/final-approve`** (see AD-2 note above).

### Project Structure Notes

- New module: `apps/api/src/modules/deals/` — flat NestJS module like `offers/`: `*.module.ts`,
  `*.service.ts`, `admin-deals.controller.ts`, `deal-binding.mapper.ts`, `dto/`, `__tests__/`.
- New shared folders: `packages/shared/src/deal/` (behaviour, mirrors `masking/`) and single files
  `components/deal.ts`, `types/deal.ts`, `schemas/deal.schema.ts` beside their siblings.
- New SQL folder: `apps/api/prisma/sql/` (first SQL artifact in the repo — keep it that small).
- No `apps/worker` change: nothing in this story runs on a schedule.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Epic 5 — Story 5.1 (L712-722)] — the acceptance criteria.
- [Source: `_bmad-output/planning-artifacts/prds/*/prd.md`] — FR-28 (final approval, BR-07, deadline),
  FR-29 (frozen financial snapshot), BR-02 (no floating point), OQ-02 (2.5 % + 0 SAR, configurable via
  UC-76/Story 8.6).
- [Source: `_bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md`] — AD-2, AD-3, AD-4
  (L117-126 partial index), AD-7, AD-10, AD-11, AD-12; Deal state-machine table (L217-232); permission
  matrix (L430-433).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`#Journey 1 (L316-320)]
  — Deal #408: price 3,000,000 → commission 75,000 → total 3,075,000; reference code `ELM-408-C`.
- [Source: `apps/api/prisma/schema.prisma` L58-82 (enums), L306-323 (`PayoutAccount`), L376-432
  (`Listing`), L541-572 (`Offer`), L661-687 (`Deal`)].
- [Source: `apps/api/src/modules/offers/admin-offers.service.ts` L429-520] — the transaction +
  `assertLockHeld` + history + audit pattern this story mirrors.
- [Source: `apps/api/src/modules/offers/backup-offers.service.ts` L370-440] — reserve closure contract
  (Story 5.4), and why it must not be called here.
- [Source: `packages/shared/src/constants/offer.ts` L52-172] — the three status sets and the exhaustive
  label maps.
- [Source: `_bmad-output/implementation-artifacts/4-3-backup-offer-queue-pipeline.md`] — house style for
  this document and the trap discipline.

## Dev Agent Record

### Agent Model Used

Amelia (bmad-dev-story agent), executed as one continuous run.

### Debug Log References

1. **`String(Prisma.Decimal)` is not 2-dp.** The first DB probe asserted `dealPrice === '3000000.00'`
   and failed with `'3000000'`. Prisma's `Decimal.toString()` drops trailing zeros
   (`0.0250 → '0.025'`), which the story's Dev Notes already sanction. The *unit* test had passed
   only because the fake `deal.create` echoes back the 2-dp strings `computeDealAmounts` produced —
   a mock-fidelity gap, not a service bug. No code change; the misleading `DealBinding` doc comments
   (`('0.0250')`, `'0.00'` today) were corrected to state the stored vs. wire forms instead.
2. **`OfferHistory.action` is `OFFER_CONVERTED_TO_DEAL`, not `CONVERTED_TO_DEAL`.** The constant's
   *key* is `CONVERTED_TO_DEAL`; its value carries the `OFFER_` prefix like every sibling action.
   The probe expectation was wrong, not the service.
3. **A repeat approval returns `OFFER_LOCK_REQUIRED` before `OFFER_INVALID_STATE_TRANSITION`.**
   Correct by construction: AC-2 releases the lease in the same transaction, and AC-8 puts
   `assertLockHeld` ahead of the state check. Verified both orders — without a fresh claim the code
   is `OFFER_LOCK_REQUIRED`; after manually restoring the lease the code is
   `OFFER_INVALID_STATE_TRANSITION`. Both are 409.
4. **`docker exec elmasaif-postgres psql` sees an empty `elmasaif_db`.** Two processes listen on
   `0.0.0.0:5432` (the Compose container and a native Postgres); `localhost:5432` resolves to the
   native one, which is where the seed/probe actually ran. Cross-checked state through Prisma
   instead, and the container's copy was left alone.
5. **The full `eslint "src/**/*.ts"` run reports 30 errors, all pre-existing.** None are in the
   files this story touched (`npx eslint "src/modules/deals/**/*.ts" "src/modules/offers/**/*.ts"
   src/app.module.ts` → exit 0). `prisma/seed.ts` is outside `tsconfig.json`'s `include`, so it can
   never be type-aware-linted; `npm run lint` does not cover `prisma/` either.
6. **`npm run build` in `apps/web` compiles, then fails type-checking on
   `.next/types/app/admin/geo/page.ts`** (`Property 'initialCities' is incompatible`). Pre-existing:
   `src/app/admin/geo/page.tsx` is untouched by this story, it is a `'use client'` page declaring
   custom props, and Story 4.4 recorded the same `.next/types` failure. `npx tsc --noEmit` in
   `apps/web` likewise reports 13 errors, **zero** in the files changed here.

### Completion Notes List

- **All 13 acceptance criteria implemented.** `POST /api/v1/admin/deals/final-approve` binds an
  agreed offer into a `Deal` in one interactive transaction: offer row lock → `assertLockHeld` →
  status/expiry checks → listing row lock → `ACTIVE` check → active-deal check → payout snapshot →
  `deal.create` → `listing.RESERVED` → `offer.CONVERTED_TO_DEAL` + lease release → `OfferHistory` →
  `AuditLog`.
- **Money never becomes a float.** `computeDealAmounts` (bigint halalas/micros, round-half-up at
  2 dp) produced `3000000.00 / 75000.00 / 3075000.00` for the UX-journey price and
  `30.86 / 1265.42` for `1234.56`.
- **Frozen snapshots are copies, never relations.** `sellerPayoutIbanEncrypted` is the
  `PayoutAccount` ciphertext verbatim (D4) — the probe proved deleting/editing the source row cannot
  reach it.
- **Deadline is exactly 48 h.** `paymentDeadline − createdAt === 172800000 ms`, both derived from a
  single `ClockService.now()`; `createdAt` is written explicitly so the column default cannot drift.
- **DB invariants are real.** The probe's raw inserts proved `deal_single_active_listing` (P2002) and
  `deals_amounts_consistent` both reject bad rows — not just the service pre-check.
- **Task 8.5 was executed as a real-Postgres probe**, not a click-through: seed → create an offer in
  `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` with a live lease on the seeded `ACTIVE` listing →
  `DealsService.finalApprove` → 40 assertions (deal row, `RESERVED`, `CONVERTED_TO_DEAL`, lease
  released, one `OfferHistory`, one `DEAL_CREATED` audit, 48 h window, snapshot copy, both DB
  invariants, both 409 orders) → cleanup. **All checks passed.** The probe file was deleted
  afterwards; the DB was verified back to `deals: 0`, listing `ACTIVE`, no `DEAL_CREATED` audits, and
  the demo `PayoutAccount` present (Task 7).
- **Test counts (final run, after the last comment-only edit + `packages/shared` rebuild):**
  - `packages/shared` — 35 files, **429 tests passed**
  - `apps/api` — 58 suites, **711 tests passed**
  - `apps/worker` — 9 files, **71 tests passed**
  - `apps/web` — 51 files, **331 tests passed**
  - New coverage added by this story: 22 `DealsService` tests, 13 `AdminDealsController` tests,
    13 web workspace tests, plus the shared `money`/`identity`/status-set specs.
- **Deviations from the story text, all deliberate:**
  1. The binding selects only `{ id, status, sellerProfileId }` from the listing instead of
     `SELLER_INCLUDE` — the transaction never needs the seller's user row, and pulling it in would
     put a mobile number inside the offer read.
  2. `resolveBankName` falls back to `getSaudiBankName(decrypt(ibanEncrypted))` when
     `PayoutAccount.bankName` is null, and swallows a decrypt failure into `null` because
     `sellerPayoutBankName` is nullable. A corrupt ciphertext must not block a final approval the
     admin already decided.
  3. `DealsModule` does not import `OffersModule`; the backup-reserve closure that `OffersModule`
     would bring in belongs to Story 5.4 (AC-10).
  4. Web UI logic is exposed as exported pure helpers (`canFinalApprove`, `shouldShowDealPreview`,
     `buildDealPreview`, `buildFinalApprovePayload`, `postFinalApprove`) plus two presentational
     components, because the web suite renders SSR-only and `OfferMediationWorkspace` shows a
     skeleton on its first pass.
  5. `DEFAULT_PAYMENT_WINDOW_HOURS` is still read from a shared constant with a `TODO(8.6)`; nothing
     here reads platform settings, which do not exist yet.

### File List

**Created**
- `apps/api/prisma/sql/deal-invariants.sql`
- `apps/api/src/modules/deals/deals.module.ts`
- `apps/api/src/modules/deals/deals.service.ts`
- `apps/api/src/modules/deals/admin-deals.controller.ts`
- `apps/api/src/modules/deals/deal-binding.mapper.ts`
- `apps/api/src/modules/deals/dto/final-approve-deal.dto.ts`
- `apps/api/src/modules/deals/__tests__/deals.service.spec.ts`
- `apps/api/src/modules/deals/__tests__/admin-deals.controller.spec.ts`
- `apps/web/src/components/admin/__tests__/offer-mediation-workspace.spec.tsx`
- `packages/shared/src/constants/deal.ts`
- `packages/shared/src/deal/money.ts`
- `packages/shared/src/deal/identity.ts`
- `packages/shared/src/deal/index.ts`
- `packages/shared/src/deal/__tests__/money.spec.ts`
- `packages/shared/src/deal/__tests__/identity.spec.ts`
- `packages/shared/src/types/deal.ts`
- `packages/shared/src/schemas/deal.schema.ts`

**Modified**
- `apps/api/package.json` — `prisma:push` now also applies `prisma/sql/deal-invariants.sql`
- `apps/api/prisma/schema.prisma` — `OfferStatus.CONVERTED_TO_DEAL`; additive `Deal` columns
  (`offerId @unique`, `dealReferenceCode @unique`, frozen snapshots, payout snapshot, `approvedByAdminId`)
- `apps/api/prisma/seed.ts` — idempotent demo `PayoutAccount` (`DEMO_PAYOUT_ACCOUNT_ID`)
- `apps/api/src/app.module.ts` — registers `DealsModule`
- `apps/api/src/modules/listings/listings.service.ts` — `ACTIVE_DEAL_STATUSES`
- `apps/api/src/modules/offers/offers.service.ts` — `ACTIVE_DEAL_STATUSES`; stale `TODO(5.1)` replaced
- `apps/api/src/modules/offers/backup-offers.service.ts` — `ACTIVE_DEAL_STATUSES`; stale `TODO(5.1)` replaced
- `apps/api/src/modules/users/account-deletion.service.ts` — `ACTIVE_DEAL_STATUSES`
- `apps/api/src/modules/users/payout.service.ts` — `ACTIVE_DEAL_STATUSES`
- `apps/api/src/modules/users/phone-change.service.ts` — `ACTIVE_DEAL_STATUSES` (also restores the
  missing `PAYMENT_REJECTED` member)
- `apps/api/src/modules/users/__tests__/phone-change.service.spec.ts` — pinned to the constant
- `apps/web/src/components/admin/offer-mediation-workspace.tsx` — frozen financials preview + gated
  final-approval action
- `apps/web/src/components/offers/offer-negotiation-view.tsx` — three Arabic deal error hints
- `apps/web/src/components/offers/offer-status-badge.tsx` — `CONVERTED_TO_DEAL` → `'verified'`
- `packages/shared/src/enums/index.ts` — `OfferStatus.CONVERTED_TO_DEAL`
- `packages/shared/src/constants/offer.ts` — terminal status set, label, history action
- `packages/shared/src/constants/index.ts` — re-export `deal.ts`
- `packages/shared/src/constants/__tests__/offer.spec.ts` — status-set partition covers the new status
- `packages/shared/src/index.ts` — export `./deal`
- `packages/shared/src/schemas/index.ts` — export `deal.schema`
- `packages/shared/src/types/index.ts` — export `deal`

### Change Log

| Date | Change |
| --- | --- |
| 11-06-2026 | Story implemented end-to-end: shared deal contracts, `Deal` schema + SQL invariants, single-source `ACTIVE_DEAL_STATUSES`, `DealsService.finalApprove` + `AdminDealsController`, admin workspace UI, demo payout seed, full verification incl. a real-Postgres probe. Status → review. |
