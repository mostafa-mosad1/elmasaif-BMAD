---
baseline_commit: 39007ba
---

# Story 4.1: Offer Submission & Price Guardrail Validation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **authenticated buyer**,
I want to **submit a formal purchase offer or backup offer on a property with automated price validation**,
so that **my purchase proposal is recorded with binding legal parameters and structured safeguards.**

This story realizes **FR-25 (Offer Submission & Price Guardrails)**, assumption **A-07** (one active offer per buyer per listing) and the intake half of **UX-DR-10 / UX-DR-13**. It is the **first** story of Epic 4 and the upstream half of the offer pipeline: it owns the `Offer` intake, the guardrails, and the buyer's own offer visibility. Seller responses, counter-offers, and admin mediation are **Story 4.2**; the backup-queue activation is **Story 4.3**.

The `Offer` Prisma model **already exists** (schema.prisma L517–538) with `version`, admin task-lock columns, `expiresAt`, and an `OfferHistory` child — but there is **no offers module, no controller, no service, no `isBackup` column, no `note` column, and the shared Zod contract is a 4-line stub**. Build the intake on top of the existing model; do not invent a parallel `PurchaseOffer` table.

## Acceptance Criteria

1. **Submit a binding offer on an `ACTIVE` listing (FR-25, UJ-1):** `POST /api/v1/offers` with `listingId`, `offerPrice`, optional `note` (≤ 500 chars) → **201**, an `Offer` row in status `PENDING_ADMIN_REVIEW` with `isBackup = false`, `expiresAt = ClockService.now() + OFFER_EXPIRY_HOURS`, and the caller's **BUYER** profile as `buyerProfileId`.
2. **Price envelope guardrail (FR-25):** `offerPrice` must be `1 ≤ price ≤ 50,000,000` SAR, enforced **server-side** (not only in the UI). Out-of-range or non-numeric → **400** `OFFER_PRICE_OUT_OF_RANGE`. Values are persisted as `Decimal(12,2)`; money leaves the API as a `number`.
3. **Low-price confirmation (< 50 % of ask) (FR-25 / BR-11):** when `offerPrice < listing.askPrice × 0.5`, the request MUST carry `lowPriceConfirmation: true`; without it the server returns **400** `OFFER_LOW_PRICE_CONFIRMATION_REQUIRED`. The acknowledgement is persisted as `isLowPrice = true` on the `Offer` and recorded in the `AuditLog` payload. In the UI the buyer must tick an explicit Arabic confirmation (stating the offer is below half the ask price) before the submit button becomes enabled.
4. **Backup offer on a `RESERVED` listing (FR-25 / FR-27):** a submission against a `RESERVED` listing is accepted and automatically stored with `isBackup = true`; the buyer is shown the "عرض احتياطي" framing, and the CTA on a reserved listing reads `عرض احتياطي (Backup Offer)`.
5. **At most one active offer per buyer per listing (A-07):** if the caller already holds a **non-terminal, unexpired** offer on that listing → **409** `OFFER_ACTIVE_EXISTS`. Enforced **under a row lock on the listing** inside a Prisma interactive transaction (`tx.$queryRaw ... FOR UPDATE`, AD-4) so two concurrent submissions cannot both pass the check.
6. **Only offerable listing states (FR-25 / FR-14):** offers are accepted **only** when `Listing.status ∈ {ACTIVE, RESERVED}`. `DRAFT`, `PENDING_REVIEW`, `PENDING_FEE`, `SOLD`, `REJECTED`, `UNDER_COMPLIANCE_REVIEW`, `ARCHIVED`, `SUSPENDED`, `BLOCKED` → **400** `OFFER_LISTING_NOT_OFFERABLE`. A missing listing → **404** `OFFER_LISTING_NOT_FOUND`; offering on a listing owned by the caller's own account → **400** `OFFER_SELF_SUBMISSION_FORBIDDEN`.
7. **Buyer offer visibility (FR-25, FR-59 buyer surface):** `GET /api/v1/offers/my` returns the caller's offers, newest first, each with a listing summary (title, property type, city/district names, ask price, area, listing status) so `/app/buyer/offers` and the dashboard "عروضي النشطة" counter are backed by real data. Optional `?listingId=<uuid>` filter narrows to one listing (used by the detail screen to detect an existing active offer).
8. **Auditable intake (FR-42, AD-7, AD-11):** the submission writes an `OfferHistory` row (`action: 'OFFER_SUBMITTED'`, `priceSnapshot`) **and** an `AuditLog` row (`action: 'OFFER_SUBMITTED'`, `entityType: 'Offer'`, actor = user) inside the same transaction. The **current instant** comes only from `ClockService.now()`; `Date.now()` and arg-less `new Date()` are forbidden. Deriving `expiresAt` from that instant via `new Date(now.getTime() + OFFER_EXPIRY_HOURS * 3_600_000)` is correct and expected — AD-11 bans `new Date()` as a *time source*, not as an arithmetic constructor.
9. **No orphaned offers in existing listings flows (FR-14 regression guard):** the four hard-coded "open offer" status lists in the listings module are extended with `OfferStatus.PENDING_ADMIN_REVIEW` so archive / compliance-suspend / compliance-block still (a) refuse to archive a listing with a live offer and (b) withdraw live offers. The co-located archive spec that asserts those arrays must be updated accordingly (see traps).
10. **Web intake is real, not a placeholder (UX-DR-10, UX-DR-13):** on `/properties/[id]` the price-rail CTA opens an inline Arabic RTL offer form (replacing the current `setCtaNotice` placeholder). Unauthenticated click still redirects to `/auth/login?redirect=…`. The form validates client-side with the shared schema, shows the low-price confirmation gate, surfaces `ApiError.code` inline (`OFFER_ACTIVE_EXISTS`, `OFFER_LOW_PRICE_CONFIRMATION_REQUIRED`, `OFFER_LISTING_NOT_OFFERABLE`, …), and on success shows a "offer recorded, pending administrative review" confirmation. A new `/app/buyer/offers` page lists the buyer's offers with an `OfferStatusBadge`.
11. **No regressions:** listings/search/map/detail/favorites, demands, proposals, geo, auth, and the worker job registry keep their behaviour. `packages/shared` changes are additive except for the `submitOfferSchema` body, which has **zero** existing consumers (verified) and keeps its exported name so `SubmitOfferInput` stays valid.

## Tasks / Subtasks

- [x] **Data model — `Offer` completion** (`apps/api/prisma/schema.prisma`) — AC: 1, 3, 4, 5, 9
  - [x] `enum OfferStatus` (L58–68): add `PENDING_ADMIN_REVIEW` as the **first** member (mirrors `ProposalStatus` ordering). Leave every existing member untouched.
  - [x] `model Offer` (L517–538): add `isBackup Boolean @default(false) @map("is_backup")`, `note String?`, `isLowPrice Boolean @default(false) @map("is_low_price")`; change `status` default from `SUBMITTED` → `PENDING_ADMIN_REVIEW`; add `@@index([listingId, buyerProfileId, status])` and `@@index([listingId, isBackup, status])`. The model **already** has `@@index([listingId, status])` and `@@index([lockExpiresAt])` (L535–536) — keep them, do not drop them.
  - [x] Apply with **`npm run prisma:push` then `npm run prisma:generate`** in `apps/api`. Repo has **no committed migrations** — do NOT create one. The diff is purely additive (new enum value, new defaulted/nullable columns, two indexes) so the seeded dev DB needs no backfill; verify the push diff before accepting it.
  - [x] Change the mirrored shared enum in the same commit (see next task) — Prisma and `packages/shared` must never drift.

- [x] **Shared contracts** (`packages/shared`) — AC: 1–5, 7
  - [x] `src/enums/index.ts`: add `PENDING_ADMIN_REVIEW = 'PENDING_ADMIN_REVIEW'` as the first member of `OfferStatus` (L57–67), exactly matching the Prisma enum.
  - [x] NEW `src/schemas/offer.schema.ts`: `submitOfferSchema` = `z.object({ listingId: z.string().uuid('معرف العقار غير صالح'), offerPrice: <reuse the `createProposalSchema.proposedPrice` union(string-regex).pipe(z.coerce.number()).refine([MIN_LISTING_PRICE_SAR, MAX_LISTING_PRICE_SAR], Arabic message) idiom>, note: z.string().trim().max(500, 'ملاحظات العرض يجب ألا تتجاوز 500 حرف').optional().nullable(), lowPriceConfirmation: z.boolean().optional().default(false) })`; plus `offerListQuerySchema = z.object({ listingId: z.string().uuid('معرف العقار غير صالح').optional() })`.
  - [x] `src/schemas/index.ts`: **delete** the stub `submitOfferSchema` at L62–65 (keep `counterOfferSchema` at L67–69 where it is — Story 4.2 owns it) and append `export * from './offer.schema';` next to the other sub-schema re-exports (L49–55). The public export name must remain `submitOfferSchema`.
  - [x] NEW `src/constants/offer.ts`: error codes `OFFER_LISTING_NOT_FOUND`, `OFFER_LISTING_NOT_OFFERABLE`, `OFFER_PRICE_OUT_OF_RANGE`, `OFFER_LOW_PRICE_CONFIRMATION_REQUIRED`, `OFFER_ACTIVE_EXISTS`, `OFFER_SELF_SUBMISSION_FORBIDDEN`, `OFFER_BUYER_PROFILE_REQUIRED`, `OFFER_NOT_FOUND`; `LOW_PRICE_THRESHOLD_PERCENT = 0.5`; `ACTIVE_OFFER_STATUSES: readonly OfferStatus[]` (every non-terminal member incl. `PENDING_ADMIN_REVIEW`) and `TERMINAL_OFFER_STATUSES: readonly OfferStatus[]` (`REJECTED_BY_SELLER`, `EXPIRED`, `WITHDRAWN`); `OFFER_STATUS_LABELS_AR: Record<OfferStatus, string>` covering **all ten** members. `OFFER_NOT_FOUND` is declared now for Story 4.2's admin/seller endpoints — it stays unused in 4.1 (that is fine; constants are not lint-failed for it). Add `export * from './offer';` to `src/constants/index.ts` (after `./proposal`).
  - [x] `src/constants/index.ts`: change `OFFER_EXPIRY_HOURS` from `72` → `168` (7 days) to match PRD FR-26 `OfferExpiryDays` and Story 4.2's "unanswered offers expire after 7 days". Nothing consumes the constant today and no test asserts `72` (verified) — this is a deliberate, documented alignment.
  - [x] NEW `src/types/offer.ts`: `OfferListingSummary` and `OfferItem` (`id`, `listingId`, `status: OfferStatus`, `offerPrice: number`, `askPrice: number`, `isBackup: boolean`, `isLowPrice: boolean`, `note: string | null`, `expiresAt: string`, `createdAt: string`, `listing: OfferListingSummary`). Re-export from `src/types/index.ts` (add `export * from './offer';`). Add `export type OfferListQuery = z.infer<typeof offerListQuerySchema>;` next to the existing schema-derived types (L14–21). **Do not** duplicate `OfferItem` in the API and web layers (the `ProposalItem` duplication in 3.7 is not a pattern to repeat — AR-10/AD-1 make `packages/shared` the single contract source).
  - [x] **🔴 Rebuild shared dist before ANY api/web test run:** `cd packages/shared && npx tsc` (jest/vitest resolve `@elmasaif/shared` from `dist/`; stale dist = phantom missing-export failures — this bit Stories 3.4–3.7).

- [x] **API — new offers module** (`apps/api/src/modules/offers/`, NEW) — AC: 1–8
  - [x] `offers.module.ts`: mirror `proposals.module.ts` — `imports: [PrismaModule, ClockModule, AuthModule]`, `providers: [OffersService, SessionAuthGuard, ActiveRoleGuard]`, `exports: [OffersService]`. Register `OffersModule` in `apps/api/src/app.module.ts` `imports` after `ProposalsModule`.
  - [x] `offers.controller.ts` — `@ApiTags('Buyer Offers')`, `@Controller('offers')`:
    - `@Get('my')` `@HttpCode(OK)` `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` `@RequireRole(UserRole.BUYER)` `@Query(new ZodValidationPipe(offerListQuerySchema))` → `{ statusCode: OK, data: await offersService.listMyOffers(req.user.id, req.user.activeRole || req.user.role, query) }`.
    - `@Post()` `@HttpCode(CREATED)` `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` `@RequireRole(UserRole.BUYER)` `@Body(new ZodValidationPipe(submitOfferSchema)) dto: SubmitOfferInput` → `{ statusCode: CREATED, message: 'تم تسجيل عرض الشراء وهو قيد المراجعة الإدارية', data: await offersService.submitOffer(req.user.id, req.user.activeRole || req.user.role, dto) }`.
    - **🔴 Route order:** literal `my` before any future `:id` route. No `PATCH`/`PUT` on `offers` — state transitions are semantic `POST` actions only (AD-2/AD-8).
  - [x] `dto/create-offer.dto.ts` + `dto/index.ts`: `class-validator` mirror of `CreateProposalDto` (`@Allow()` fields) used **only** for the Swagger `@ApiBody`; `ZodValidationPipe` remains the runtime validator (existing repo idiom).
  - [x] `offers.service.ts` — `submitOffer(userId, activeRole, dto)`:
    1. Resolve the buyer profile: `userProfile.findUnique({ where: { userId_role: { userId, role: UserRole.BUYER } } })`; missing or `status !== ProfileStatus.ACTIVE` → `ForbiddenException({ code: OFFER_BUYER_PROFILE_REQUIRED })`.
    2. `const now = this.clockService.now();` then `this.prisma.$transaction(async (tx) => { ... })`:
       a. `await tx.$queryRaw\`SELECT "id" FROM "listings" WHERE "id" = ${dto.listingId}::uuid FOR UPDATE\`` — serialises concurrent submissions on the same listing (AD-4).
       b. `tx.listing.findUnique({ where: { id: dto.listingId }, include: { sellerProfile: { select: { userId: true } }, city: true, district: true } })`; null → `NotFoundException({ code: OFFER_LISTING_NOT_FOUND })`.
       c. `listing.sellerProfile?.userId === userId` → `BadRequestException({ code: OFFER_SELF_SUBMISSION_FORBIDDEN })`.
       d. `![ACTIVE, RESERVED].includes(listing.status)` → `BadRequestException({ code: OFFER_LISTING_NOT_OFFERABLE })`.
       e. `const price = Number(dto.offerPrice);` non-finite or outside `[MIN_LISTING_PRICE_SAR, MAX_LISTING_PRICE_SAR]` → `BadRequestException({ code: OFFER_PRICE_OUT_OF_RANGE })`.
       f. `const isLowPrice = price < Number(listing.askPrice) * LOW_PRICE_THRESHOLD_PERCENT;` if `isLowPrice && dto.lowPriceConfirmation !== true` → `BadRequestException({ code: OFFER_LOW_PRICE_CONFIRMATION_REQUIRED })`.
       g. `const isBackup = listing.status === ListingStatus.RESERVED;`
       h. `tx.offer.count({ where: { listingId, buyerProfileId: profile.id, status: { in: ACTIVE_OFFER_STATUSES }, expiresAt: { gt: now } } })` > 0 → `ConflictException({ code: OFFER_ACTIVE_EXISTS })`. (The `expiresAt > now` clause is intentional: a lapsed offer must not block a new one even before 4.2 wires the expiry sweep.)
       i. `tx.offer.create({ data: { listingId, buyerProfileId: profile.id, offerPrice: price, status: OfferStatus.PENDING_ADMIN_REVIEW, isBackup, isLowPrice, note: dto.note ?? null, expiresAt: new Date(now.getTime() + OFFER_EXPIRY_HOURS * 3_600_000) } })`.
       j. `tx.offerHistory.create({ data: { offerId, actorProfileId: profile.id, action: 'OFFER_SUBMITTED', priceSnapshot: price, notes: dto.note ?? null } })`.
       k. `tx.auditLog.create({ data: { actorId: userId, actorType: 'USER', action: 'OFFER_SUBMITTED', entityType: 'Offer', entityId, payload: { listingId, offerPrice: price, askPrice: Number(listing.askPrice), isBackup, isLowPrice, expiresAt: <ISO> } } })`.
       l. `// TODO(4.2): relay to seller / admin mediation queue (`Offers.Review`).` and `// TODO(8.8): persist buyer/seller notification (no Notification model exists).` — **do not** invent either.
    3. Return `toOfferItem(offer, listing)`.
  - [x] `offers.service.ts` — `listMyOffers(userId, activeRole, query)`: resolve the BUYER profile (same guard), `prisma.offer.findMany({ where: { buyerProfileId: profile.id, ...(query.listingId ? { listingId: query.listingId } : {}) }, orderBy: { createdAt: 'desc' }, include: { listing: { include: { city: true, district: true } } } })`, map through `toOfferItem`. Return `{ items }`.
  - [x] `offers.service.ts` — private `toOfferItem` mapper: `Number()`-coerce `offerPrice`/`askPrice`, ISO-stringify `expiresAt`/`createdAt`, and emit the nested `listing` summary (`id, title, propertyType, cityName: city.nameAr, districtName: district.nameAr, askPrice, areaSquareMeters, status`). Mirror `ProposalsService.toIso` / `toListingSummary`.

- [x] **API — keep existing listing flows coherent** (`apps/api/src/modules/listings/`) — AC: 9
  - [x] `listings.service.ts` L1426–1431 (archive guard "active unexpired offers") and L1462–1467 (archive → withdraw open offers): add `OfferStatus.PENDING_ADMIN_REVIEW` to both arrays.
  - [x] `admin-listings.service.ts` L1126–1131 (compliance suspend → cancel offers) and L1253–1258 (compliance block → cancel offers): add `OfferStatus.PENDING_ADMIN_REVIEW` to both arrays.
  - [x] `__tests__/listings-compliance-archive.spec.ts` L261–276: extend the asserted `status.in` array with `OfferStatus.PENDING_ADMIN_REVIEW` — it asserts the **exact array**, so it fails otherwise.

- [x] **Web — real intake on the property detail screen** (`apps/web`) — AC: 3, 4, 10
  - [x] NEW `apps/web/src/components/offers/offer-submit-form.tsx` (`'use client'`): props `{ listingId, askPrice, listingStatus, onSubmitted?, onCancel? }`. Price text input (`inputMode="decimal"`), optional note textarea (500-char counter), live derived preview of the entered price vs ask (`اعلان السعر المدخل أقل من نصف سعر الطلب`) — when below 50 % render a mandatory checkbox `lowPriceConfirm` with the Arabic acknowledgement copy, and disable submit until ticked. Submit: `submitOfferSchema.safeParse` → Arabic field errors; `apiClient.post<{ statusCode: number; data: OfferItem }>('/offers', parsed.data)`; envelope-tolerant unwrap (bare vs `{statusCode,data}` — same lesson as `unwrapDemandsPayload`); on `ApiError` surface `err.message` inline plus a code-specific hint for `OFFER_ACTIVE_EXISTS` / `OFFER_LOW_PRICE_CONFIRMATION_REQUIRED` / `OFFER_LISTING_NOT_OFFERABLE`. Reuse `Button`/`Card` and the `inputClass`/`labelClass` styles from `components/proposals/proposal-submit-form.tsx`.
  - [x] NEW `apps/web/src/components/offers/offer-status-badge.tsx`: maps `OfferStatus` → Arabic via `OFFER_STATUS_LABELS_AR`, reusing `Badge`.
  - [x] NEW `apps/web/src/components/offers/buyer-offers-list.tsx` (pure presentational, exported for SSR tests): given `OfferItem[]` renders listing title + type/area + `formatSar(offerPrice)` vs `formatSar(askPrice)` + `OfferStatusBadge` + `isBackup` chip ("عرض احتياطي") + relative expiry copy; empty state via `EmptyState`.
  - [x] NEW `apps/web/src/components/offers/offers-view.tsx` (`'use client'`): `apiClient.get('/offers/my')` + `unwrapOffersPayload` (exported, envelope-tolerant, `null`/`undefined`-safe like `unwrapMatchingDemandsPayload`), loading skeleton / error+retry / list. Also export `countActiveOffers(items)` for the dashboard — it must count `status ∈ ACTIVE_OFFER_STATUSES` **AND** `new Date(item.expiresAt).getTime() > Date.now()`, so a lapsed offer is never reported as «نشط» (mirrors the server's active definition; the browser clock is acceptable for a display-only counter).
  - [x] NEW `apps/web/src/components/offers/index.ts` barrel: `offer-submit-form`, `offer-status-badge`, `buyer-offers-list`, `offers-view`, `unwrapOffersPayload`, `countActiveOffers`.
  - [x] NEW `apps/web/src/app/app/buyer/offers/page.tsx` — thin client wrapper inside `LayoutShell` rendering `<OffersView />`. **🔴 route `page.tsx` exposes ONLY the default export.**
  - [x] UPDATE `apps/web/src/app/properties/[id]/page.tsx`: replace the `setCtaNotice(...)` placeholder with an `offerOpen` boolean toggling `<OfferSubmitForm listingId={detail.id} askPrice={detail.askPrice} listingStatus={detail.status} />` rendered under the price rail. Keep the existing unauthenticated redirect to `/auth/login?redirect=…`. Keep `onCtaClick`/`ctaNotice` props on the view intact so the existing detail spec keeps passing.
  - [x] UPDATE `apps/web/src/app/app/buyer/page.tsx`: replace the hard-coded `count: 0` on the "عروضي النشطة" stat with a `offersCount` state fed by a silent-catch `apiClient.get('/offers/my')` + `countActiveOffers(...)` (exact same idiom as `favoritesCount` / `demandsCount`), and wire the existing "Empty State CTA for Offers" card to `/app/buyer/offers`.
  - [x] `workspace-shell.tsx` buyer nav already links `/app/buyer/offers` (L77) — no change needed; verify it now resolves.
  - [x] `formatSar` is already exported from `components/listings/commission-calculator` and re-exported by `components/listings` — import it, do **not** redeclare a local copy.

- [x] **Tests** — AC: all (jest for api, vitest for shared/web)
  - [x] Shared (vitest, NEW `src/schemas/__tests__/offer.spec.ts` + `src/constants/__tests__/offer.spec.ts`): `submitOfferSchema` accepts UUID + numeric/2-decimal string price, rejects bad UUID, price `0`, price `> 50,000,000`, note `> 500`; `lowPriceConfirmation` defaults to `false`; `offerListQuerySchema` optional `listingId`; `OFFER_EXPIRY_HOURS === 168`; `LOW_PRICE_THRESHOLD_PERCENT === 0.5`; `OFFER_STATUS_LABELS_AR` covers all 10 `OfferStatus` members; `ACTIVE_OFFER_STATUSES` and `TERMINAL_OFFER_STATUSES` are disjoint and together cover the enum.
  - [x] API (jest, NEW `apps/api/src/modules/offers/__tests__/offers.spec.ts`, mock prisma + clockService): happy path → created with `PENDING_ADMIN_REVIEW`, `isBackup=false`, `expiresAt = now + 168h`, `offerHistory.create` + `auditLog.create` called; `RESERVED` listing → `isBackup=true`; offerable-state matrix (each non-ACTIVE/RESERVED status → `OFFER_LISTING_NOT_OFFERABLE`); price `0` / `50000001` / non-numeric → `OFFER_PRICE_OUT_OF_RANGE`; `price = 0.49 * ask` without confirmation → `OFFER_LOW_PRICE_CONFIRMATION_REQUIRED`, with `lowPriceConfirmation: true` → created with `isLowPrice=true`; existing unexpired non-terminal offer → `OFFER_ACTIVE_EXISTS`; existing **expired** offer → allowed; missing listing → `OFFER_LISTING_NOT_FOUND`; own listing → `OFFER_SELF_SUBMISSION_FORBIDDEN`; `listMyOffers` scoping + `listingId` filter + mapping. Mock must provide `$transaction` (invoking the callback with the same mock as `tx`), `$queryRaw`, and `offer.count`.
  - [x] API (jest, UPDATE `listings-compliance-archive.spec.ts`): the archive/withdraw arrays now include `PENDING_ADMIN_REVIEW`; keep every other assertion intact.
  - [x] Web (vitest, NEW `apps/web/src/components/offers/__tests__/offers.spec.tsx` — under `components/offers/__tests__/`, **never** in a route dir): `unwrapOffersPayload` bare vs enveloped vs `null`; `countActiveOffers` mixed statuses; `BuyerOffersList` via `renderToString` (rows render price/labels/backup chip, `OfferStatusBadge` labels, empty state); `OfferSubmitForm` static render contains the price input and, at a low price, the confirmation checkbox. No jsdom / RTL interaction tests (established suite constraint — vitest runs with default config).
  - [x] Frameworks: **no new dependencies**, no form/wizard/UI-kit libraries.

## Dev Notes

### Scope boundaries (build ONLY this)
- **IN:** `Offer` model completion (`PENDING_ADMIN_REVIEW`, `isBackup`, `note`, `isLowPrice`, indexes); shared enum/schema/constants/types; the new `offers` API module with `POST /offers` + `GET /offers/my`; the four listings-module "open offer" status arrays; the buyer web intake (detail-screen form, `/app/buyer/offers`, dashboard counter).
- **OUT (explicitly deferred, do NOT build):**
  - **Admin offer queue, seller relay, counter-offer rounds, `NegotiationRound`/`MaxCounterRounds`, `RelayedToSeller`/seller accept/reject/counter, timeline UI, sticky mobile tray** = **Story 4.2** (`Offers.Review`, `POST /api/v1/admin/offers/:id/...`). 4.1 leaves the offer parked in `PENDING_ADMIN_REVIEW`; add `// TODO(4.2)` markers only. **Do NOT** add an `OfferController` admin side or a `MaxCounterRounds` column.
  - **Backup-queue activation surfacing to admins** = **Story 4.3**. 4.1 only sets the `isBackup` flag.
  - **`offer-expiry-checker` worker wiring** = **Story 4.2** (the job in `apps/worker/src/jobs/offer-expiry-checker.job.ts` is a documented no-op today because the worker has no Prisma dependency). 4.1 only writes `expiresAt`.
  - **Withdraw-offer endpoint / offer editing** — not in FR-25. AD-2/AD-8 forbid generic `PATCH`; do not add one.
  - **Notification delivery** = **Story 8.8**. No `Notification` model exists — do not invent one.
  - **DB-level partial unique index** for "one active offer per buyer per listing": impossible via `prisma db push` (no committed migrations in this repo) — enforced by the transactional row lock + count (see Decision log).

### Critical implementation traps (read before coding)
- **🔴 `Offer.status` default is `SUBMITTED` today and `OfferStatus` has no `PENDING_ADMIN_REVIEW`.** The AC demands `PendingAdminReview`. Add the enum member (Prisma + shared, same commit) and change the column default; **do not** reuse `IN_REVIEW` or `SUBMITTED` as a synonym — Story 4.2's seller-relay state machine keys off explicit states.
- **🔴 Adding `PENDING_ADMIN_REVIEW` silently breaks FR-14 if you stop at the enum.** Four hard-coded "open offer" arrays in `apps/api/src/modules/listings/*` gate archive + compliance actions:

  | Location | Meaning |
  |---|---|
  | `listings.service.ts` ~L1426–1431 | archive guard: refuse archive while a live offer exists |
  | `listings.service.ts` ~L1462–1467 | archive: withdraw open offers → `WITHDRAWN` |
  | `admin-listings.service.ts` ~L1126–1131 | compliance suspend: cancel pending offers |
  | `admin-listings.service.ts` ~L1253–1258 | compliance block: cancel pending offers |

  Miss them and a seller can archive a listing that carries a live in-review offer, and the offer survives the block. **`listings-compliance-archive.spec.ts` asserts those arrays literally** (L261–276) — update the spec with the code or the suite goes red.
- **🔴 Money in, `Decimal` in the DB, `number` out of the API.** Keep the `createProposalSchema.proposedPrice` union + `z.coerce.number()` idiom; coerce with `Number(...)` when reading `askPrice`/`offerPrice`. Never compare a Prisma `Decimal` with `<` directly against a raw number without coercion (`Number(listing.askPrice) * 0.5`).
- **🔴 The listing row lock uses the real table name `listings` and `::uuid` casting.** `@@map("listings")` means the physical table is `listings` (not `Listing` as the architecture prose writes), and the `Offer`/`Listing` textual id column is a `uuid`. Use `` tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${listingId}::uuid FOR UPDATE` ``. The lock is what makes the "one active offer" count safe under concurrency.
- **🔴 Active-offer definition includes the expiry window.** `status ∈ ACTIVE_OFFER_STATUSES AND expiresAt > now`. Terminal = `REJECTED_BY_SELLER`, `EXPIRED`, `WITHDRAWN`. Without the `expiresAt` clause, a lapsed offer blocks the buyer until Story 4.2 wires the sweep — a user-visible dead end.
- **🔴 Changing `OFFER_EXPIRY_HOURS` 72 → 168.** It has no consumer and no test today (verified), but PRD FR-26 and Story 4.2 both specify 7 days. If you leave it at 72, `expiresAt` will contradict the expiry sweep that 4.2 implements.
- **🔴 `packages/shared/dist` is what jest/vitest resolve.** After editing shared sources run `cd packages/shared && npx tsc` **before** any API/web test run, or you get phantom "is not exported" / missing-enum failures (bit Stories 3.4–3.7).
- **🔴 Web specs live under `components/<area>/__tests__/`, never inside a route directory** (relative-import mis-resolution that bit 3.5/3.6). Route `page.tsx` files export the default component **only**.
- **🔴 `req.user.activeRole` is the workspace the session is currently in.** Guard with `SessionAuthGuard + ActiveRoleGuard + @RequireRole(UserRole.BUYER)` and pass `req.user.activeRole || req.user.role` down, exactly as the proposals controller does; a user whose active workspace is MARKETER must switch to BUYER first (FR-3).
- **🔴 No committed migrations.** `npm run prisma:push` + `npm run prisma:generate` in `apps/api`. Inspect the generated diff: it must be additive (enum value, defaulted/nullable columns, indexes). Never accept a destructive statement against the seeded dev DB.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** the web app never touches Prisma; all reads/mutations go through `apiClient` over the same-origin `/api` proxy. Mutations are semantic POSTs (`POST /offers`) — **no generic PATCH, no Server Actions**.
- **AD-4:** `Offer` submission runs inside `prisma.$transaction` with a `$queryRaw ... FOR UPDATE` row lock on the target listing (the pattern AD-4 mandates for offers/deals).
- **AD-7 / AD-11:** `AuditLog` + `OfferHistory` written in the same transaction; every timestamp from `ClockService.now()` (no `new Date()`/`Date.now()` in the service).
- **AD-8:** structured `{ code, message }` exceptions surfaced through the global envelope `{code, message, details, requestId}`; all new codes live in `packages/shared/constants/offer.ts` and are consumed by **both** api and web.
- **AD-10:** `Offer` is one of the 8 claim-locked admin queues, but **claim lock, heartbeat, and force-unlock are Story 4.2's admin queue** — 4.1 creates no admin endpoints. The `lockedByAdminId`/`lockedAt`/`lockExpiresAt` columns already exist and stay `null`.
- **NFR1:** guardrails are enforced **server-side**; the low-price checkbox is a UX affordance, and the server independently rejects an unacknowledged sub-50 % offer.
- **Stack (pinned):** NestJS 10.x + Prisma 5.x, Next.js App Router + React 19 + Tailwind 3.4, Zod 3.23, TypeScript strict. **No new dependencies.**

### Reuse map (all already exist — do not rebuild)
- **Closest end-to-end template:** `apps/api/src/modules/proposals/*` + `apps/web/src/components/proposals/*` (Story 3.7). Copy the controller guard stack, `ZodValidationPipe`, `{ statusCode, data }` envelope, `ProfileStatus.ACTIVE` profile resolution, `toIso`/`toListingSummary` mappers, and the create-flow `try/catch` → structured `ConflictException` shape.
- **Form idiom:** `apps/web/src/components/proposals/proposal-submit-form.tsx` (`inputClass`/`labelClass`, `safeParse` → per-field Arabic errors, `apiClient.post`, inline `role="alert"` error block, `data-testid` hooks).
- **Envelope-tolerant unwrap + list/empty/error states:** `apps/web/src/components/proposals/matching-demands-view.tsx`, `apps/web/src/components/demands/{demands-view.tsx,demand-status-badge.tsx}`, `apps/web/src/components/listings/buyer-favorites-view.tsx`.
- **Dashboard silent-count idiom:** `apps/web/src/app/app/buyer/page.tsx` `favoritesCount` / `demandsCount` effects (`.catch(() => {})` keeps the card at 0).
- **Detail-screen CTA wiring point:** `apps/web/src/app/properties/[id]/page.tsx` `handleCtaClick` (auth redirect to `/auth/login?redirect=…`) and `listing-detail-view.tsx` `resolveCta` (already renders the ACTIVE vs RESERVED CTA labels).
- **Money formatting:** `formatSar` / `calculateCommission` in `apps/web/src/components/listings/commission-calculator.tsx` (re-exported by `components/listings`).
- **UI primitives:** `Badge`, `Button`, `Card`/`CardHeader`/`CardTitle`/`CardContent`, `EmptyState` from `apps/web/src/components/ui`.
- **Shared primitives:** `MIN_LISTING_PRICE_SAR` / `MAX_LISTING_PRICE_SAR` (constants/listing.ts L50–51), `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`, `UserRole`, `ProfileStatus`, `ListingStatus`, `PropertyType`, `PROPERTY_TYPE_LABELS_AR`, `ApiResponse`/`PaginatedResponse`.
- **Test idioms:** `apps/api/src/modules/proposals/__tests__/proposals.spec.ts` (mock prisma + clockService), `apps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts` (offer-array assertions), `apps/web/src/components/proposals/__tests__/proposals.spec.tsx` (`renderToString`, no jsdom).

### Current-state notes (files being touched)
- **`apps/api/prisma/schema.prisma` (UPDATE):** `OfferStatus` + `PENDING_ADMIN_REVIEW`; `Offer` + `isBackup`, `note`, `isLowPrice`, changed status default, two indexes. Note the `Offer` model's pre-existing fields are **unmapped camelCase columns** — only add `@map` to the **new** columns (`is_backup`, `is_low_price`); do not "fix" the existing ones in this story.
- **`packages/shared/src/enums/index.ts` (UPDATE):** `OfferStatus.PENDING_ADMIN_REVIEW`.
- **`packages/shared/src/schemas/index.ts` (UPDATE):** remove the stub `submitOfferSchema` (L62–65), re-export the new module. `counterOfferSchema` stays.
- **`packages/shared/src/constants/index.ts` (UPDATE):** `OFFER_EXPIRY_HOURS` 72 → 168; `export * from './offer'`.
- **`packages/shared/src/types/index.ts` (UPDATE):** `OfferListQuery` + `export * from './offer'`.
- **`apps/api/src/app.module.ts` (UPDATE):** register `OffersModule`.
- **`apps/api/src/modules/listings/listings.service.ts` / `admin-listings.service.ts` (UPDATE):** four status arrays.
- **`apps/web/src/app/properties/[id]/page.tsx` (UPDATE):** inline offer form replaces the placeholder notice; auth redirect preserved.
- **`apps/web/src/app/app/buyer/page.tsx` (UPDATE):** real offers count + CTA target.
- **NEW:** `apps/api/src/modules/offers/**`, `packages/shared/src/{schemas/offer.schema.ts, constants/offer.ts, types/offer.ts}`, `apps/web/src/components/offers/**`, `apps/web/src/app/app/buyer/offers/page.tsx`.

### Decision log (make these calls, do not re-litigate in code)
- **`OfferStatus.PENDING_ADMIN_REVIEW` is added as a real enum member** (Prisma + shared) rather than aliasing `IN_REVIEW`. AC language, Story 4.2's state machine and the `Offers.Review` queue all key off it; a synonym would need translating at every boundary.
- **Response shape lives once in `packages/shared/src/types/offer.ts`.** Story 3.7 duplicated `ProposalItem` between api and web; AR-10/AD-1 make `packages/shared` the single contract source, so do not repeat that duplication.
- **Low-price confirmation is a server-enforced flag** (`lowPriceConfirmation`) persisted as `isLowPrice`, not a UI-only checkbox. NFR1 requires server-side enforcement of every guardrail; the audit trail must prove the buyer acknowledged a sub-50 % bid.
- **One-active-offer is enforced by a listing row lock + count inside one transaction**, not by a DB partial unique index: the repo has no migration pipeline (`prisma db push` only, no `migrations/` directory), and a partial unique index cannot be expressed in the Prisma schema.
- **"Active" = non-terminal status AND `expiresAt > now`.** Prevents a lapsed offer from locking the buyer out until Story 4.2 wires the sweep.
- **`OFFER_EXPIRY_HOURS` becomes 168 (7 days)** to match PRD FR-26 `OfferExpiryDays` and Story 4.2's AC; the old `72` had no consumer.
- **No `Idempotency-Key` / `If-Match` on this endpoint.** Neither is implemented anywhere in the repo (AD-8 lists them as required for financial mutations — a documented systemic gap). A retried POST is naturally idempotent-enough because the second attempt hits `OFFER_ACTIVE_EXISTS`; `version` stays at its default `1` and is untouched by creation.
- **Buyer list endpoint `GET /offers/my` ships in 4.1**, not 4.2: without it the `/app/buyer/offers` nav target stays a dead link and the dashboard counter stays fake — the story would not be working end-to-end.
- **No admin endpoint in 4.1.** The offer parks in `PENDING_ADMIN_REVIEW` with `// TODO(4.2)`.

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 4.1`] acceptance criteria; `#Epic 4` scope (FR-25, FR-26, FR-27, FR-35, FR-55); `#Story 4.2` (seller responses/counter rounds/7-day expiry), `#Story 4.3` (backup activation), `#Story 5.1` (deal binding)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-25`] price envelope 1–50,000,000 SAR, notes ≤ 500 chars, `<50 %` low-price confirmation (BR-11), `IsBackup` on `Reserved`, one active offer per buyer per listing (A-07), `PendingAdminReview`; `#FR-26` `MaxCounterRounds`/7-day expiry/`SelectedPendingFinalAdminApproval`; `#FR-27`/`OQ-04` backup activation order; `#FR-14` archive/block cancels non-deal pending offers; `#A-07`; `#SM-7` offer conversion metric; `#UJ-1`, `#UJ-5`
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md#§2`] version/`If-Match` on Listing/Offer/Deal; `#§4` `Offers.Review` permission matrix; `#§5` ERD `ROLE_PROFILE ||--o{ OFFER : submits`, `LISTING ||--o{ OFFER : receives`
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-4, AD-7, AD-8, AD-10, AD-11`] boundaries, explicit action endpoints, `$queryRaw ... FOR UPDATE`, audit-in-transaction, `ClockService`, Offer as one of the 8 claim-locked queues; `#Admin Permission Matrix#Offers.Review`; `#Consistency Conventions#Financial Values / Error Format`
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`] `#Property Detail` CTAs, `#Offer Negotiation` timeline (Story 4.2), `#UX-DR10` mobile action tray (Story 4.2), `#UX-DR13` institutional microcopy ("تقديم عرض شراء ملزم خاضع لتدقيق المنصة")
- [Source: `_bmad-output/implementation-artifacts/3-7-automated-demand-matching-proposal-review-pipeline.md`] proposals module pattern, envelope-tolerant unwrap, stale-dist / route-order / co-located-spec pitfalls, `// TODO(5.1)` precedent for cross-story markers
- Code: `apps/api/prisma/schema.prisma#L58–68,L353–408,L517–552`; `apps/api/src/modules/proposals/{proposals.controller.ts,proposals.service.ts,proposals.module.ts,dto/*}`; `apps/api/src/modules/listings/{listings.service.ts#L1420–1475, admin-listings.service.ts#L1120–1140,L1250–1270}`; `apps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts#L255–280`; `packages/shared/src/{enums/index.ts#L57–67, schemas/index.ts#L62–69, schemas/proposal.schema.ts, constants/index.ts#L6, constants/listing.ts#L50–51, constants/proposal.ts, types/index.ts#L14–21}`; `apps/web/src/app/properties/[id]/{page.tsx, listing-detail-view.tsx}`; `apps/web/src/app/app/buyer/page.tsx`; `apps/web/src/components/proposals/*`; `apps/web/src/components/listings/commission-calculator.tsx#formatSar`; `apps/web/src/components/ui/*`; `apps/web/src/lib/api-client.ts`

## Dev Agent Record

### Agent Model Used

Qoder dev agent (BMAD v6 `bmad-dev-story` workflow)

### Debug Log References

- **`prisma generate` → `EPERM: rename query_engine-windows.dll.node`.** The running `npm run dev` API watcher (node `dist/main` + nest watch) holds the query-engine DLL, and the sandbox blocks `taskkill` / `Stop-Process` / `rm` (`CreateProcessAsUserW failed: 267`). Worked around without killing the user's server: temporarily set the `generator client` `output` to `../../../.prisma-client-tmp`, ran `npx prisma generate`, copied the generated files **except** the locked DLL (plus `runtime/`) into `node_modules/.prisma/client`, reverted the generator block, and removed the scratch dir with `node -e "fs.rmSync(...)"`. Verified `PENDING_ADMIN_REVIEW` and `isBackup` are present in the regenerated `index.d.ts`. **The dev server must be restarted once** to load the new `OffersModule` and the regenerated client.
- **API spec `accepts the envelope boundaries` red on first run:** `offerPrice: 1` is below 50 % of the ask price, so the low-price guardrail fired (`OFFER_LOW_PRICE_CONFIRMATION_REQUIRED`) before the envelope check could pass. Fixed the test to submit `lowPriceConfirmation: true` for the lower boundary — the guardrail ordering is intended (envelope → low-price → duplicate).
- **Shared spec `offerListQuerySchema` red on first run:** `safeParse(undefined)` is rejected because `z.object` requires an object; the contract is "optional `listingId`", not "optional object". Assertion rewritten to `safeParse({ listingId: undefined })`.
- **Pre-existing lint noise (not introduced here):** `eslint` reports four `@typescript-eslint/no-unused-vars` errors for unused price-suggestion codes in `listings.service.ts` L38–39 and `admin-listings.service.ts` L30–31; `git show HEAD:` confirms they are already unused at the baseline commit `39007ba`, so they were left untouched (out of scope). Every new/changed file in this story lints clean.
- **🔴 Runtime 500 on `POST /api/v1/offers` after the first manual attempt (`INTERNAL_SERVER_ERROR`, requestId `6d5e7bdc…`):** the Dev Notes trap told us to cast the row-lock parameter to `uuid`, but **`listings.id` is a `text` column** in this schema (`String @id @default(uuid())` has no `@db.Uuid`; verified with `information_schema.columns` → `data_type = text` for both `listings.id` and `offers.id`). The lock therefore raised `Raw query failed. Code: 42883. ERROR: operator does not exist: text = uuid` (Prisma `P2010`), which the global filter correctly surfaced as a 500. Fixed by casting to `::text` (with an explanatory comment in the service) and reproduced the full write path against the live dev database inside a rolled-back transaction — lock, `findUnique` with `sellerProfile`/`city`/`district`, `offer.count`, `offer.create` (`PENDING_ADMIN_REVIEW`), `offerHistory.create` and `auditLog.create` all succeed. A regression test now asserts the emitted SQL contains `::text` and never `::uuid`. **The Dev Notes' `::uuid` instruction below is superseded by this note.**

### Completion Notes List

- **Data model:** `OfferStatus.PENDING_ADMIN_REVIEW` added as the first enum member; `Offer` gained `isBackup`, `isLowPrice`, `note`, the `PENDING_ADMIN_REVIEW` default, and the two requested indexes (existing `@@index([listingId, status])` / `@@index([lockExpiresAt])` kept). `prisma migrate diff` was inspected before applying — purely additive (1 `ADD VALUE`, 2 `ADD COLUMN ... DEFAULT`, 1 `ADD COLUMN` nullable, 2 `CREATE INDEX`), no destructive statement. `prisma db push` applied; no migration folder created.
- **Shared contracts:** new `offer.schema.ts`, `constants/offer.ts`, `types/offer.ts`; stub `submitOfferSchema` removed and re-exported from the new module (public name unchanged); `OFFER_EXPIRY_HOURS` 72 → 168; `PENDING_ADMIN_REVIEW` mirrored into the shared enum. `dist/` rebuilt before any api/web test run.
- **API:** new `offers` module with `POST /offers` (201, `PENDING_ADMIN_REVIEW`, `isBackup` on RESERVED, `isLowPrice` + `lowPriceConfirmation`, `expiresAt = ClockService.now() + 168h`, `OfferHistory` + `AuditLog` in the same transaction) and `GET /offers/my` (newest first, optional `listingId`, listing summary). A-07 is enforced inside `prisma.$transaction` under `SELECT ... FROM "listings" ... FOR UPDATE`, counting only `status ∈ ACTIVE_OFFER_STATUSES AND expiresAt > now`. Guard order: buyer profile → row lock → listing exists → self-submission → offerable state → price envelope → low-price confirmation → duplicate → create. `// TODO(4.2)` / `// TODO(8.8)` markers only; no admin endpoints, no notification model, no worker wiring.
- **Listings coherence:** all four hard-coded "open offer" arrays now include `PENDING_ADMIN_REVIEW`, and the exact-array assertion in `listings-compliance-archive.spec.ts` was extended with it (19/19 pass).
- **Web:** `/properties/[id]` now opens a real inline Arabic RTL offer form (auth redirect preserved, `ctaNotice`/`onCtaClick` props untouched); the form validates with the shared schema, renders the mandatory sub-50 % acknowledgement (submit disabled until ticked), surfaces `ApiError.code` hints, and shows the "pending administrative review" confirmation. New `/app/buyer/offers` page + `OfferStatusBadge` + `BuyerOffersList` (backup chip «عرض احتياطي», relative expiry, `formatSar`). The dashboard «عروضي النشطة» counter is fed by `GET /offers/my` + `countActiveOffers` (active status **and** unexpired), and the empty-state CTA now targets `/app/buyer/offers`.
- **Tests:** shared 30 files / 323 tests, API 52 suites / 547 tests, web 46 files / 237 tests — all green. New coverage: 11 shared schema tests, 6 shared constants tests, 32 API offers tests, 12 web offers tests.
- **Type checks:** `apps/api` `tsc --noEmit` clean. `apps/web` `tsc --noEmit` reports only the pre-existing errors documented before this story (`.next/types` geo page, `properties/page` search query, workspace specs missing `setSessionUser`, `property-card` ref, `design-tokens` fontFamily, `api-client.spec` fetch mock) — zero diagnostics mention the offers code, the buyer dashboard or the detail page.

### File List

**Modified**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/listings/listings.service.ts`
- `apps/api/src/modules/listings/admin-listings.service.ts`
- `apps/api/src/modules/listings/__tests__/listings-compliance-archive.spec.ts`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/types/index.ts`
- `apps/web/src/app/properties/[id]/page.tsx`
- `apps/web/src/app/app/buyer/page.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Added**
- `packages/shared/src/schemas/offer.schema.ts`
- `packages/shared/src/constants/offer.ts`
- `packages/shared/src/types/offer.ts`
- `packages/shared/src/schemas/__tests__/offer.spec.ts`
- `packages/shared/src/constants/__tests__/offer.spec.ts`
- `apps/api/src/modules/offers/offers.module.ts`
- `apps/api/src/modules/offers/offers.controller.ts`
- `apps/api/src/modules/offers/offers.service.ts`
- `apps/api/src/modules/offers/dto/create-offer.dto.ts`
- `apps/api/src/modules/offers/dto/index.ts`
- `apps/api/src/modules/offers/__tests__/offers.spec.ts`
- `apps/web/src/components/offers/offer-submit-form.tsx`
- `apps/web/src/components/offers/offer-status-badge.tsx`
- `apps/web/src/components/offers/buyer-offers-list.tsx`
- `apps/web/src/components/offers/offers-view.tsx`
- `apps/web/src/components/offers/index.ts`
- `apps/web/src/components/offers/__tests__/offers.spec.tsx`
- `apps/web/src/app/app/buyer/offers/page.tsx`

**Generated (not committed)**
- `packages/shared/dist/**` (rebuilt with `npx tsc`)
- `apps/api/node_modules/.prisma/client/**` (regenerated after the enum/column change)
- dev database schema (`prisma db push`, additive only)

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-11-06 | 1.1 | Fixed the `POST /offers` runtime 500: the listing row lock cast an id to `::uuid` although `listings.id` is `text` (`P2010` / `42883`); now `::text`, verified against the live DB in a rolled-back transaction, plus a regression test on the emitted SQL. | Qoder dev agent |