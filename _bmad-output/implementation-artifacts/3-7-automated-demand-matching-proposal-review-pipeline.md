---
baseline_commit: review-state-3-6
---

# Story 3.7: Automated Demand Matching & Proposal Review Pipeline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **marketer with matching inventory**,
I want to be **automatically notified of matching buyer demands and submit binding proposals**,
so that I can **connect my listings with verified buyers through administrative mediation.**

This story realizes **FR-22 (Automated Demand Matching Engine)**, **FR-23 (Provider Proposal Submission & Admin Review)** and **FR-24 (Buyer Proposal Selection)**, and the closing half of **FR-58** / **AD-7 job #3** ("close unaccepted proposals"). It is the downstream half of the demand pipeline started in Story 3.6.

## Acceptance Criteria

1. **Automated matching on demand publish (FR-22, UJ-4, AD-9):** Given a demand that just transitioned to `ACTIVE`, when the matching engine runs, then it evaluates `ACTIVE` (non-`RESERVED`) listings where `propertyType` = demand.propertyType AND `cityId` = demand.cityId AND `askPrice <= demand.maxBudget` AND `areaSquareMeters` within ±20% of the demand area range (`>= minArea*0.8` AND `<= maxArea*1.2`). Then it persists one `DemandMatch` row per qualifying listing (provider = `listing.sellerProfileId`) **without Top-N truncation**, and if ≥1 match exists the demand moves `ACTIVE → MATCHED`. Zero matches → demand stays `ACTIVE`.
2. **Provider alert surface (`demand.matched`, FR-22):** `GET /api/v1/proposals/matching-demands` (guarded provider) returns the demands that match the caller's own `ACTIVE` listings (via `DemandMatch`), newest-matched first, each with demand summary + which of the caller's listing(s) match. This is the MVP "instant alert" surface; durable in-app push/email is deferred to Story 8.8 (documented, see Dev Notes).
3. **Provider proposal submission (FR-23):** `POST /api/v1/proposals` with `demandId`, `listingId`, `proposedPrice` → a `Proposal` in `PENDING_ADMIN_REVIEW`. Server re-validates: the provider owns the listing, the listing is `ACTIVE`, the listing actually satisfies the demand's match criteria, and `MIN_LISTING_PRICE_SAR <= proposedPrice <= MAX_LISTING_PRICE_SAR` AND `proposedPrice <= demand.maxBudget`. A `(demandId, listingId)` pair may be proposed only once → duplicate is a `ConflictException`.
4. **Admin proposal review (FR-23, `Offers.Review`, AD-12):** `GET /api/v1/admin/proposals` returns a paginated queue (pending first). `POST /api/v1/admin/proposals/:id/approve` → `APPROVED_FOR_BUYER`; `POST /api/v1/admin/proposals/:id/reject` with a mandatory non-empty `reason` → `REJECTED`. **Approved proposals are visible to the buyer; `PENDING_ADMIN_REVIEW`/`REJECTED` are invisible to the buyer.** Every decision writes an `AuditLog` row in-transaction. **No task-claim lock** (Proposal is not one of the 8 locked queues, AD-10).
5. **Buyer proposal review & selection (FR-24, UJ-4):** `GET /api/v1/proposals/demand/:id` returns only `APPROVED_FOR_BUYER` proposals for the caller's **own** demand (each with listing summary + provider broker badge). `POST /api/v1/proposals/:id/select` (buyer, own demand, demand in `ACTIVE`/`MATCHED`) sets that proposal to `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` and moves **every other open proposal** (`PENDING_ADMIN_REVIEW`/`APPROVED_FOR_BUYER`) on that demand to `CLOSED`. Deal creation and demand `CLOSED`/revert-to-`ACTIVE` on the admin's *final* approve/reject belong to **Epic 5 (Story 5.1 / UC-70B)** and are explicitly OUT of this story.
6. **Cancel & expiry close unselected proposals (FR-58 / AD-7 job #3):** In Story 3.6's `cancelDemand` transaction, after setting the demand `CANCELLED`, close that demand's not-selected proposals (`PENDING_ADMIN_REVIEW`/`APPROVED_FOR_BUYER`) → `CLOSED`. In the `demand-expiry-checker` worker logic, when a demand is marked `EXPIRED`, also close its unaccepted proposals → `CLOSED` (factory + mock-db unit test; production db wiring stays the documented systemic gap).
7. **No regressions:** The **only** shared changes are new (non-breaking) Proposal enum/schema/types/constants. Story 3.6's `POST /demands`, `GET /demands/my`, `POST /demands/:id/cancel` behavior and its `demands.spec.ts` **must still pass** — the matcher is additive to `createDemand`, so the existing spec's prisma mock must be extended (see Dev Notes) rather than the matcher being skipped. Existing listings/search/map/detail/favorites, geo module, and worker job registry remain behaviorally untouched.

## Tasks / Subtasks

- [x] **Data model — Proposal + DemandMatch** (`apps/api/prisma/schema.prisma`) — AC: 1, 3, 4, 5, 6
  - [x] Add `enum ProposalStatus { PENDING_ADMIN_REVIEW APPROVED_FOR_BUYER REJECTED SELECTED_PENDING_FINAL_ADMIN_APPROVAL CLOSED }` (near `DemandStatus`, L91–97).
  - [x] Add `model DemandMatch`: `id String @id @default(uuid())`, `demandId String`, `listingId String`, `providerProfileId String`, `createdAt DateTime @default(now())`; relations `demand Demand @relation(fields:[demandId], references:[id], onDelete: Cascade)`, `listing Listing @relation("DemandMatchListing", fields:[listingId], references:[id], onDelete: Cascade)`, `providerProfile UserProfile @relation("ProviderDemandMatches", fields:[providerProfileId], references:[id])`; `@@unique([demandId, listingId])`, `@@index([providerProfileId, createdAt])`, `@@index([demandId])`, `@@map("demand_matches")`.
  - [x] Add `model Proposal`: `id`, `demandId`, `listingId`, `providerProfileId`, `proposedPrice Decimal @db.Decimal(12,2)`, `status ProposalStatus @default(PENDING_ADMIN_REVIEW)`, `note String?`, `rejectReason String? @map("reject_reason")`, `selectedAt DateTime? @map("selected_at")`, `createdAt @default(now())`, `updatedAt @updatedAt`; relations `demand Demand @relation(fields:[demandId], references:[id], onDelete: Cascade)`, `listing Listing @relation("ProposalListing", fields:[listingId], references:[id])`, `providerProfile UserProfile @relation("ProviderProposals", fields:[providerProfileId], references:[id])`; `@@unique([demandId, listingId])`, `@@index([status])`, `@@index([demandId, status])`, `@@index([providerProfileId])`, `@@map("proposals")`.
  - [x] Add reverse relations: `Demand.matches DemandMatch[]` + `Demand.proposals Proposal[]` (Demand block L695–724); `Listing.demandMatches DemandMatch[] @("DemandMatchListing")` + `Listing.proposals Proposal[] @("ProposalListing")` (Listing block L343–396); `UserProfile.demandMatches DemandMatch[] @("ProviderDemandMatches")` + `UserProfile.proposals Proposal[] @("ProviderProposals")` (UserProfile block L228+). Mirror the named-relation style `Listing` already uses for `sellerProfile @relation("ProfileListings")`.
  - [x] Apply with **`npm run prisma:push` then `npm run prisma:generate`** in `apps/api`. Repo has NO committed migrations (`prisma migrate` glob is empty) — do NOT create one. New tables are empty so push needs no backfill.

- [x] **Shared contracts** (`packages/shared`) — AC: 1, 3, 4, 5 (all additive, non-breaking)
  - [x] `src/enums/index.ts` — add `ProposalStatus` mirroring the Prisma enum EXACTLY (same member names/values as `DemandStatus` idiom, L90–96).
  - [x] NEW `src/schemas/proposal.schema.ts`: `createProposalSchema = z.object({ demandId: z.string().uuid('معرف طلب الشراء يجب أن يكون بصيغة UUID صالحة'), listingId: z.string().uuid('...'), proposedPrice: <reuse the exact listing `askPrice` union(string-regex).pipe(z.coerce.number()) idiom from schemas/listing.schema.ts L52–62> })` with a `.refine` asserting `proposedPrice <= MAX_LISTING_PRICE_SAR` (Arabic message). `rejectProposalSchema = z.object({ reason: z.string().trim().min(5,'...').max(500,'...') })` (mirror `cancelDemandSchema`). `proposalQueueQuerySchema` — mirror `listingModerationQueueQuerySchema` (schemas/listing.schema.ts L91–105) exactly: coerced `page`/`limit` with `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`, optional `status` filter `z.nativeEnum(ProposalStatus).optional()`.
  - [x] `src/schemas/index.ts` — `export * from './proposal.schema';` (append after the demand schemas, do not redefine).
  - [x] `src/types/index.ts` — add `export type CreateProposalInput = z.infer<typeof createProposalSchema>;`, `RejectProposalInput`, `ProposalQueueQuery` (derive like `ListingModerationQueueQuery`). Do NOT change existing exports.
  - [x] NEW `src/constants/proposal.ts`: error codes `PROPOSAL_NOT_FOUND`, `PROPOSAL_FORBIDDEN`, `PROPOSAL_DUPLICATE`, `PROPOSAL_NOT_APPROVABLE` (invalid-state approve/reject), `PROPOSAL_NOT_SELECTABLE`, `PROPOSAL_REJECT_REASON_REQUIRED`, `PROPOSAL_DEMAND_NOT_MINE`; `PROPOSAL_STATUS_LABELS_AR: Record<ProposalStatus,string>` (`PENDING_ADMIN_REVIEW`='قيد المراجعة', `APPROVED_FOR_BUYER`='متاح للمشترى', `REJECTED`='مرفوض', `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`='مختار بانتظار الاعتماد النهائي', `CLOSED`='مغلق'); `MATCH_AREA_TOLERANCE_PERCENT = 0.2`. Reuse existing `MIN_LISTING_PRICE_SAR`/`MAX_LISTING_PRICE_SAR` (constants/listing.ts L50–51) — do NOT redefine. Add `export * from './proposal';` to `src/constants/index.ts`.
  - [x] **🔴 After adding exports, rebuild shared dist before ANY apps/api or apps/web test:** `cd packages/shared && npx tsc` (Jest/vitest resolve `@elmasaif/shared` from compiled dist — stale dist = missing-export compile failure; this bit Stories 3.4/3.5/3.6).

- [x] **API — new proposals module + matcher** (`apps/api/src/modules/proposals/`, NEW) — AC: 1, 2, 3, 4, 5, 6
  - [x] `proposals.module.ts` mirrors `demands.module.ts`: imports `[PrismaModule, ClockModule, AuthModule]`, providers `[ProposalsService, ProposalMatcherService, AdminProposalsService, SessionAuthGuard, ActiveRoleGuard, AdminSessionAuthGuard, AdminPermissionGuard]`, `exports: [ProposalMatcherService, ProposalsService]`. Register `ProposalsModule` in `apps/api/src/app.module.ts` `imports` (after `DemandsModule`).
  - [x] `proposal-matcher.service.ts` — `async matchDemand(demandId: string): Promise<{ matchCount: number }>`: load the demand (`prisma.demand.findUnique`); `prisma.listing.findMany({ where: { status: ACTIVE, propertyType: demand.propertyType, cityId: demand.cityId, askPrice: { lte: demand.maxBudget }, areaSquareMeters: { gte: demand.minArea*(1-TOL), lte: demand.maxArea*(1+TOL) } } })`; for each qualifying listing `prisma.demandMatch.create({ data: { demandId, listingId, providerProfileId: listing.sellerProfileId } })` (idempotent: rely on `@@unique` + `skipDuplicates` on a `createMany` if the driver supports it, else per-row upsert); if ≥1, `prisma.demand.update({ where:{id:demandId}, data:{ status: MATCHED } })` inside a transaction with an `AuditLog` row (`action:'DEMAND_MATCHED'`, `actorType:'SYSTEM'`). This is where a `// TODO(8.8): persist 'demand.matched' in-app notification per provider` marker goes — do NOT invent a Notification model.
  - [x] **Wire matcher into creation without breaking 3.6:** `demands.module.ts` imports `ProposalsModule`; `DemandsService` constructor gains `ProposalMatcherService`; at the END of `createDemand` (AFTER the ACTIVE row is created and outside the create call) invoke `await this.matcher.matchDemand(demand.id)` inside a `try/catch` that logs-and-swallows (a matcher failure must never fail demand creation — 3.6 AC#1 "immediately ACTIVE"). Return the item mapped AFTER match (status may now be `MATCHED`).
  - [x] `proposals.controller.ts` `@Controller('proposals')` (provider + buyer realm, `SessionAuthGuard`):
    - `@Get('matching-demands')` `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` `@RequireRole(UserRole.MARKETER, UserRole.OWNER)` → `{ statusCode: OK, data: await proposalsService.getMatchingDemands(req.user.id, req.user.activeRole||req.user.role) }`.
    - `@Post()` `@HttpCode(CREATED)` `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` `@RequireRole(UserRole.MARKETER, UserRole.OWNER)` body `@Body(new ZodValidationPipe(createProposalSchema)) dto: CreateProposalInput` → `{ statusCode: CREATED, data: await proposalsService.createProposal(req.user.id, req.user.activeRole||req.user.role, dto) }`.
    - `@Get('demand/:id')` `@UseGuards(SessionAuthGuard)` → `{ statusCode: OK, data: await proposalsService.getApprovedProposalsForDemand(req.user.id, id) }`.
    - `@Post(':id/select')` `@HttpCode(OK)` `@UseGuards(SessionAuthGuard)` `@RequireRole(UserRole.BUYER)` `@Param('id', ParseUUIDPipe)` → `{ statusCode: OK, message:'تم اختيار العرض', data: await proposalsService.selectProposal(req.user.id, id) }`.
    - **🔴 Route order:** all literal statics (`matching-demands`, `demand/:id`) declared before any bare `@Post()`/`:id` action that could shadow them. `@Post()` (create) and `@Post(':id/select')` are distinct paths.
  - [x] `proposals.service.ts`:
    - `getMatchingDemands(userId, activeRole)`: resolve the provider profile (`userProfile.findUnique({ where:{ userId_role:{ userId, role: activeRole } } })`, activeRole ∈ {MARKETER, OWNER}); `prisma.demandMatch.findMany({ where:{ providerProfileId: profile.id }, orderBy:{ createdAt:'desc' }, include:{ demand:{ include:{ city:true, district:true } }, listing:{ select:{ id:true,title:true,askPrice:true,areaSquareMeters:true } } } })`; group by demand → each result item = demand summary + `matchedListings[]`. Return `{ items }` (envelope `{ statusCode, data:{ items } }`).
    - `createProposal(userId, activeRole, dto)`: resolve provider profile; `listing = prisma.listing.findFirst({ where:{ id:dto.listingId, sellerProfileId: profile.id } })` else `ForbiddenException({ code: PROPOSAL_FORBIDDEN })`; `if listing.status !== ACTIVE → BadRequest`; `demand = prisma.demand.findUnique({ where:{ id:dto.demandId } })`; `if !demand || (demand.status !== ACTIVE && demand.status !== MATCHED) → NotFound({ code: PROPOSAL_NOT_FOUND })`; re-verify match (type/city/`askPrice<=maxBudget`/area ±20% via a shared private `qualifies(demand, listing)`); verify `dto.proposedPrice <= Number(demand.maxBudget)` AND within [MIN,MAX] price; `try { prisma.proposal.create(...) } catch (unique P2002) → ConflictException({ code: PROPOSAL_DUPLICATE })`. Return `toProposalItem`.
    - `getApprovedProposalsForDemand(userId, demandId)`: resolve BUYER profile; `prisma.demand.findFirst({ where:{ id:demandId, buyerProfileId: profile.id } })` else `NotFound({ code: PROPOSAL_NOT_FOUND })`; `prisma.proposal.findMany({ where:{ demandId, status: APPROVED_FOR_BUYER }, orderBy:{ createdAt:'asc' }, include:{ listing:{ include:{ documents:true(PUBLIC photos)/sellerProfile:true } }, providerProfile:{ include:{ user:true } } } })`; map to a list including a `ListingSummaryItem` (pipe listing through the listings `toSummaryItems` idiom — see Reuse map) + provider name. Return `{ items }`.
    - `selectProposal(userId, proposalId)`: `$transaction(async tx => { const p = await tx.proposal.findFirst({ where:{ id:proposalId, demand:{ buyerProfileId: profileId } } }); if (!p) throw NotFound(PROPOSAL_NOT_FOUND); if (p.status !== APPROVED_FOR_BUYER) throw Conflict(PROPOSAL_NOT_SELECTABLE); const d = await tx.demand.findUnique(...); if (d.status !== ACTIVE && d.status !== MATCHED) throw Conflict(PROPOSAL_NOT_SELECTABLE); await tx.proposal.update({ where:{ id:proposalId }, data:{ status: SELECTED_PENDING_FINAL_ADMIN_APPROVAL, selectedAt: clockService.now() } }); await tx.proposal.updateMany({ where:{ demandId: p.demandId, id:{ not: proposalId }, status:{ in:[PENDING_ADMIN_REVIEW, APPROVED_FOR_BUYER] } }, data:{ status: CLOSED } }); await tx.auditLog.create({ action:'PROPOSAL_SELECTED', ... }); })`. Return `toProposalItem`. **Do NOT create a Deal, do NOT set Listing=Reserved, do NOT move demand CLOSED** — that is Story 5.1; add `// TODO(5.1): bind Deal + reserve listing on final admin approval`.
    - `toProposalItem(p)` mapper: `id, demandId, listingId, providerProfileId, status, proposedPrice: Number(...), note, rejectReason, selectedAt(ISO|null), createdAt(ISO)`.
  - [x] `admin-proposals.controller.ts` `@Controller('admin/proposals')` `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` — EXACT mirror of `admin-listings.controller.ts` header (L46–51) but WITHOUT claim routes: `@Get()` `@RequireAdminPermission('Offers.Review')` (queue, `@Query(ZodValidationPipe(proposalQueueQuerySchema))`), `@Get(':id')` (detail), `@Post(':id/approve')`, `@Post(':id/reject')` (body `rejectProposalSchema`). `req.admin.id` actor. `{ statusCode, data }` envelope.
  - [x] `admin-proposals.service.ts`: `getQueue(query, adminId)` paginated via `ModerationQueueResponse`/`PaginatedResponse` idiom (`meta:{total,page,limit,totalPages}`, inner key `items`), default filter `status=PENDING_ADMIN_REVIEW` if none; `approve(adminId, id)`: tx — load proposal, require `status===PENDING_ADMIN_REVIEW` else `Conflict(PROPOSAL_NOT_APPROVABLE)`, update `APPROVED_FOR_BUYER`, `AuditLog action:'PROPOSAL_APPROVED'`, add `// TODO(8.8): persist 'demand.proposal_received' notification to buyer`; `reject(adminId, id, reason)`: same guard, update `REJECTED` + `rejectReason`, `AuditLog action:'PROPOSAL_REJECTED'`. No `If-Match`/`version` (Proposal has none) and no claim lock.

- [x] **API — close proposals on 3.6 cancel** (`apps/api/src/modules/demands/demands.service.ts`) — AC: 6
  - [x] In `cancelDemand`'s `$transaction`, replace the `// TODO(3.7): close unselected proposals on cancel` line (L215) with `await tx.proposal.updateMany({ where:{ demandId: id, status:{ in:[PENDING_ADMIN_REVIEW, APPROVED_FOR_BUYER] } }, data:{ status: CLOSED } })`. (Selected proposals cannot exist on a still-cancellable ACTIVE/MATCHED demand under normal flow, so only open ones close.)

- [x] **Worker — close proposals on expiry** (`apps/worker/src/jobs/demand-expiry-checker.job.ts`) — AC: 6
  - [x] Extend `DemandExpiryDbClient` with `proposal?: { updateMany: (args:any)=>Promise<any> }`. After each `db.demand.update(... EXPIRED)`, if `db.proposal` then `await db.proposal.updateMany({ where:{ demandId: demand.id, status:{ notIn:[SELECTED_PENDING_FINAL_ADMIN_APPROVAL] } }, data:{ status: CLOSED } })` (per AC#6). Keep the factory/handler wiring exactly as-is (`createDemandExpiryCheckerLogic()` with no db arg); do NOT add a Prisma dependency to `apps/worker` (systemic gap, same boundary as 3.6).

- [x] **Web — provider matching surface** (`apps/web`) — AC: 1, 2, 3
  - [x] NEW `apps/web/src/components/proposals/matching-demands-view.tsx` (`'use client'`): `apiClient.get('/proposals/matching-demands')` → envelope-tolerant pure exported `unwrapMatchingDemandsPayload` (bare `{items}` and `{statusCode,data:{items}}`, same lesson as `unwrapDemandsPayload`). Loading / error+retry / empty states (`EmptyState`). Each row = demand summary (city/type/budget/area via `formatSar`, `PROPERTY_TYPE_LABELS_AR` reuse) + a "قدّم عرض" affordance hosting `ProposalSubmitForm` prefilled with one of the caller's matching `listingId`s.
  - [x] NEW `apps/web/src/components/proposals/proposal-submit-form.tsx` (`'use client'`): select the matching listing, `proposedPrice` number input, optional `note`; client `createProposalSchema.safeParse` → Arabic field errors; `apiClient.post('/proposals', { demandId, listingId, proposedPrice, note })`; on `ApiError` surface `err.code` inline (esp. `PROPOSAL_DUPLICATE`); on success mark the row proposed.
  - [x] NEW `apps/web/src/app/app/marketer/demands/page.tsx` — thin wrapper rendering `<MatchingDemandsView />`. **🔴 route `page.tsx` exposes ONLY the default export.** Add a MARKETER nav item in `apps/web/src/components/layout/workspace-shell.tsx` (after the marketer `listings` entries, ~L92) `{ href:'/app/marketer/demands', label:'مطابقات طلبات الشراء', icon: <Lucide e.g. Sparkles/Handshake> }`.
  - [x] NEW `apps/web/src/components/proposals/index.ts` barrel (`MatchingDemandsView`, `ProposalSubmitForm`, `unwrapMatchingDemandsPayload`, `proposal-status-badge`, `buyer-proposals-list`).

- [x] **Web — buyer proposal review** (`apps/web`) — AC: 4, 5
  - [x] NEW `apps/web/src/components/proposals/buyer-proposals-list.tsx` (pure presentational, exported for SSR tests): given `proposals[]` renders each with listing summary + provider broker name/badge + `proposedPrice` (`formatSar`) + a "اختر العرض" action (only for `APPROVED_FOR_BUYER` rows). On click → `apiClient.post('/proposals/{id}/select')` → on success refresh the demand's proposal list (selected + closed reflected).
  - [x] NEW `apps/web/src/components/proposals/proposal-status-badge.tsx` — maps `ProposalStatus`→Arabic via `PROPOSAL_STATUS_LABELS_AR`, reusing `Badge`.
  - [x] Wire a proposals section into the existing buyer demand screen: extend `apps/web/src/components/demands/demands-view.tsx` so each `MATCHED` (or `ACTIVE`) demand row can expand/fetch `GET /proposals/demand/{id}` and render `<BuyerProposalsList />`. Keep 3.6 submit/list/cancel intact; this is additive.
  - [x] Extend the buyer dashboard "عروضي النشطة" placeholder only if cheap — otherwise leave (offers = Epic 4). Do NOT repurpose the offers card for proposals.

- [x] **Web — admin proposal queue** (`apps/web`) — AC: 4
  - [x] NEW `apps/web/src/components/admin/proposal-review-queue.tsx` (`'use client'`, mirror `listing-moderation-queue.tsx` fetch idiom — `apiClient.get('/admin/proposals?page=1&limit=50')`, no claim call): approve button → `apiClient.post('/admin/proposals/{id}/approve')`; reject → inline reason → `apiClient.post('/admin/proposals/{id}/reject', { reason })`; on error revert + inline notice. Reuse `Card/Badge/Button/EmptyState`.
  - [x] NEW `apps/web/src/app/admin/proposals/page.tsx` — thin server wrapper rendering `<ProposalReviewQueue />` (default export ONLY). Add admin nav entry in `workspace-shell.tsx` admin list (~L101–105) `{ href:'/admin/proposals', label:'طابور مراجعة عروض المزودين', icon: HandCoins }` (gate on the same permission-flag pattern already used for the moderation link).

- [x] **Tests** — AC: all (jest for API, vitest for shared/worker/web)
  - [x] Shared (vitest, NEW `schemas/__tests__/proposal.spec.ts`, `constants/__tests__/proposal.spec.ts`): `createProposalSchema` accepts valid UUIDs + coerced price, rejects bad UUID / price > MAX / non-numeric; `rejectProposalSchema` reason ≥5 ≤500; `proposalQueueQuerySchema` defaults + MAX_PAGE_SIZE cap; `ProposalStatus.PENDING_ADMIN_REVIEW === 'PENDING_ADMIN_REVIEW'`; `MATCH_AREA_TOLERANCE_PERCENT === 0.2`; `PROPOSAL_STATUS_LABELS_AR` covers all five; reuses `MIN/MAX_LISTING_PRICE_SAR` (not redefined).
  - [x] API (jest, NEW `apps/api/src/modules/proposals/__tests__/proposals.spec.ts` + `admin-proposals.spec.ts`, story-scoped, mock prisma + clockService): matcher `matchDemand` — qualifying `findMany` predicate (type/city/askPrice<=maxBudget/area±20%), `ACTIVE-only` excluded RESERVED, `demandMatch.create` per row, ≥1 → demand `MATCHED` + auditLog, 0 → stays ACTIVE. `createProposal` — ownership check (`PROPOSAL_FORBIDDEN`), non-ACTIVE listing rejected, non-matching listing rejected, price>budget rejected, duplicate `(demandId,listingId)` → `PROPOSAL_DUPLICATE`, success → `PENDING_ADMIN_REVIEW`. `selectProposal` — APPROVED→SELECTED + `updateMany` closes siblings + auditLog, non-approved→`PROPOSAL_NOT_SELECTABLE`, other buyer's demand→`PROPOSAL_NOT_FOUND`. `getMatchingDemands` — provider profile scope, `demandMatch.findMany` shape. `getApprovedProposalsForDemand` — only `APPROVED_FOR_BUYER`, ownership. admin approve/reject — state guard (`PROPOSAL_NOT_APPROVABLE`), reject reason recorded, auditLog. **Extend the existing `apps/api/src/modules/demands/__tests__/demands.spec.ts` prisma mock** to add `listing.findMany` (return [] for the 3.6 create tests so status stays ACTIVE), `demandMatch.create`, `demand.update`, `proposal.updateMany` so `createDemand`'s new matcher call and `cancelDemand`'s new proposal-close both pass without crashing the 3.6 assertions (known pitfall: a new prisma call inside an existing tx/method breaks co-located spec mocks). Add one new 3.6 cancel test asserting proposals are closed to `CLOSED`.
  - [x] Worker (vitest, extend `apps/worker/src/jobs/__tests__/demand-expiry.spec.ts`): mock db now provides `proposal.updateMany`; assert that on expiry, non-selected proposals are closed; already-EXPIRED idempotent (no re-update).
  - [x] Web (vitest, NEW `apps/web/src/components/proposals/__tests__/proposals.spec.tsx` under `components/proposals/__tests__/`, NOT in a route dir — avoids the `[id]/__tests__` relative-import pitfall): `unwrapMatchingDemandsPayload` bare vs enveloped vs null; `BuyerProposalsList` via `renderToString` (rows render, `ProposalStatusBadge` label for APPROVED/CLOSED, select affordance present for `APPROVED_FOR_BUYER` and absent otherwise); `MatchingDemandsView` empty/error states. No jsdom/RTL interaction tests (established suite constraint).
  - [x] Frameworks: no new libraries, no form/wizard libs, no UI kits; reuse existing UI components.

## Dev Notes

### Scope boundaries (build ONLY this)
- **IN:** `DemandMatch` + `Proposal` models; the inline matcher triggered by demand creation; provider matching-demands query; provider proposal submission; admin proposal approve/reject queue; buyer approved-proposal review + selection (with sibling-close); close-open-proposals on cancel (API) and expiry (worker); the provider/buyer/admin web surfaces above.
- **OUT (explicitly deferred, do NOT build):** durable in-app/email **notification delivery** and the `Notification` model/feed = **Story 8.8** — represent `demand.matched`/`demand.proposal_received` only as `// TODO(8.8)` markers; **DO NOT invent a `Notification` model** (none exists in schema today). **Deal creation, listing→`RESERVED`, demand→`CLOSED`/revert-to-`ACTIVE`** on the admin's final approval/rejection = **Epic 5 / Story 5.1 (UC-70B)** — the selection endpoint stops at `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`. Offers/counter-offers = Epic 4. Listing-driven re-matching (a NEW listing created after a demand is already ACTIVE firing a fresh alert) is NOT required by FR-22 ("evaluates new Demands against active listings") — do NOT add it; document as a known limitation.

### Critical implementation traps (read before coding)
- **🔴 Matching must run API-side, inline, not as a worker job.** AD-7 has NO `demand-matching` job and FR-22 requires "instantly". More importantly `apps/worker` has **no `@prisma/client` dependency** and no job is runtime-db-wired (known systemic gap — registering a handler without a db client makes it a production no-op). A job-based matcher would silently do nothing. Therefore the matcher runs synchronously at the end of `DemandsService.createDemand`, using the API's Prisma client, so it actually works.
- **🔴 The matcher must not break Story 3.6.** `createDemand` currently returns immediately-ACTIVE and its co-located spec mocks prisma narrowly. Add the matcher call inside `try/catch` (log-and-continue) so demand creation never fails on matcher error, and **extend the existing `demands.spec.ts` prisma mock** with `listing.findMany` (→ `[]`), `demandMatch.create`, `demand.update`, `proposal.updateMany`. Returning `[]` from `listing.findMany` keeps the 3.6 status-ACTIVE assertions valid.
- **🔴 Area ±20% is relative to the demand's min/max range, not a single value.** Demands keep budget/area as RANGES (3.6 decision). Qualify a listing when `areaSquareMeters >= demand.minArea*(1-0.2)` AND `<= demand.maxArea*(1+0.2)`. Price uses `askPrice <= demand.maxBudget` (FR-22 literal "askPrice <= budget"); do NOT also require `>= minBudget` (min budget is a preference, not a match gate).
- **🔴 `MATCHED` and `CLOSED` already exist in `DemandStatus`.** 3.7 is the story that finally WRITES `MATCHED` (via matcher) and `CLOSED` (via selection/cancel/expiry). Never hand-edit the enum again; reuse L91–96.
- **🔴 Proposal has no `version`/claim lock.** AD-10 locks only 8 queues (Listing, FalProfile, OwnerListingRequest, Payment, ContractFeePayment, Conversation, Dispute, Offer) — Proposal is not among them. Mirror the admin-listings controller's guards/permission decorator but OMIT the claim/heartbeat/force-unlock routes. Non-financial → no `Idempotency-Key`/`If-Match`.
- **🔴 Money as Decimal → number.** `proposedPrice`/`askPrice`/budget are `Decimal(12,2)`; coerce input with the listing `askPrice` union idiom and emit `Number(...)` in projections (consistency convention).
- **🔴 Route order + envelope.** Static `@Get` routes before `:id` routes in every controller. Provider/buyer list endpoints return `{ statusCode, data:{ items } }`; the web unwrappers must tolerate BOTH bare and enveloped (known detail-vs-search envelope divergence).
- **🔴 Route `page.tsx` = default export ONLY** (architecture invariant). All views/helpers live in `components/proposals/`, `components/admin/`, or `components/demands/`.
- **🔴 Web specs go under `components/<area>/__tests__/`, never co-located in the route dir** (relative-import mis-resolution pitfall that bit 3.5/3.6).
- **🔴 No committed migrations** — `prisma db push` + `prisma:generate`; rebuild `packages/shared` (`npx tsc`) before any API/web test run.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** web never touches Prisma; all reads/mutations via `/api/v1` through `apiClient` (same-origin proxy keeps the HttpOnly session/admin cookie). Mutations only via explicit semantic endpoints (`POST /proposals`, `POST /proposals/:id/select`, `POST /admin/proposals/:id/approve|reject`) — **no generic `PATCH /proposals/:id`, no Server Actions.**
- **AD-5 / AD-12:** provider endpoints guarded by `SessionAuthGuard + ActiveRoleGuard + @RequireRole(MARKETER, OWNER)`; buyer selection `@RequireRole(BUYER)`; admin review via `AdminSessionAuthGuard + AdminPermissionGuard + @RequireAdminPermission('Offers.Review')` (matrix row `Offers.Review` = "Content moderation of buyer offers and proposals", default Yes for Support Team).
- **AD-7 / AD-11:** every async/admin transition writes `AuditLog` in the same tx; all timestamps via `ClockService.now()` (never `new Date()`/`Date.now()`), worker via `workerClock`. Matcher and cancel-close are idempotent (`@@unique` + state-guarded `updateMany`).
- **AD-8:** structured `{ code, message }` exceptions; codes in `packages/shared/constants/proposal.ts`, consumed by BOTH api and web.
- **AD-9:** matching keys off structured `cityId` + FK relations; geography stays structured (inherited from 3.6).
- **Stack (pinned):** NestJS 10.x + Prisma 5.x, Next.js App Router + React 19 + Tailwind 3.4, Zod 3.23, TypeScript strict, pg-boss 10.x. **No new dependencies.**

### Reuse map (all already exist — do not rebuild)
- Admin queue controller/service idiom — `apps/api/src/modules/listings/admin-listings.controller.ts` (header L46–51, guards, `@RequireAdminPermission`, `{ statusCode, data }`) + `admin-listings.service.ts` (`getModerationQueue` pagination + `AuditLog`) — copy shape, drop claim routes.
- Buyer-list module idiom — `apps/api/src/modules/demands/*` (controller guards, `ZodValidationPipe`, `ParseUUIDPipe`, envelope, `toDemandItem`) and `listings.controller.ts` `@Get('my')`/`@Get('favorites')` static-before-`:id` ordering.
- Listing summary projection — `apps/api/src/modules/listings/listings.service.ts` `private toSummaryItems(listing, storageService)` (presigned `primaryPhotoUrl`/photos/photoCount) — pipe approved-proposal listings through it rather than re-implementing photo presigning; reuse shared `ListingSummaryItem`.
- Provider profile resolution — `userProfile.findUnique({ where:{ userId_role:{ userId, role } } })` (demands.service L47–61, listings L110–127).
- Money coercion + structured-UUID Zod idiom — `createListingSchema` (schemas/listing.schema.ts L37–89) and `createDemandSchema` (schemas/index.ts L86–120); queue-query idiom — `listingModerationQueueQuerySchema` (listing.schema.ts L91–105).
- Envelope-tolerant unwrap + presentational split + status badge + dashboard silent-count — `apps/web/src/components/demands/{demands-view.tsx, demand-status-badge.tsx}` and `buyer-favorites-view.tsx` / `unwrapFavoritesPayload`.
- Admin web fetch idiom — `apps/web/src/components/admin/listing-moderation-queue.tsx` (same `apiClient` over `/api` proxy, `/admin/...` paths, `useState/useEffect/useCallback`, error banner).
- Worker job factory + mock-db test idiom — `apps/worker/src/jobs/demand-expiry-checker.job.ts` + `account-deletion-expiry.job.ts`.
- `CityDistrictSelector`, `Badge`, `Card`, `Button`, `EmptyState` (`components/ui`); `apiClient` + `ApiError` (`.code`); `formatSar`; `PROPERTY_TYPE_LABELS_AR` (`app/marketer/page.tsx` L33–41); `DEMAND_STATUS_LABELS_AR`.
- Shared scaffolding already present: `DemandStatus.{ACTIVE,MATCHED,EXPIRED,CANCELLED,CLOSED}`, `MIN/MAX_LISTING_PRICE_SAR`, `DEFAULT_PAGE_SIZE/MAX_PAGE_SIZE`, `UserRole.MARKETER/OWNER/BUYER`, `PaginatedResponse`/`ModerationQueueResponse` types.

### Current-state notes (files being touched)
- **`schema.prisma` (UPDATE):** + `enum ProposalStatus`, + `DemandMatch`, + `Proposal`, + reverse relations on `Demand`/`Listing`/`UserProfile`.
- **`packages/shared/src/{enums,types,constants/index}.ts` + NEW `schemas/proposal.schema.ts`, `constants/proposal.ts` (UPDATE/append):** Proposal enum/schema/types/constants; nothing existing changes (non-breaking).
- **`apps/api/src/app.module.ts` (UPDATE):** register `ProposalsModule`.
- **`apps/api/src/modules/demands/demands.service.ts` (UPDATE):** constructor gains matcher; `createDemand` calls matcher (try/catch); `cancelDemand` tx closes proposals (replace `// TODO(3.7)`).
- **`apps/api/src/modules/demands/demands.module.ts` (UPDATE):** import `ProposalsModule`.
- **`apps/worker/src/jobs/demand-expiry-checker.job.ts` (UPDATE):** add `proposal.updateMany` to client interface + close-open on expiry.
- **NEW:** `apps/api/src/modules/proposals/{proposals.module.ts, proposals.controller.ts, admin-proposals.controller.ts, proposals.service.ts, admin-proposals.service.ts, proposal-matcher.service.ts, dto/*}`, its `__tests__/*`; `apps/web/src/components/proposals/{matching-demands-view.tsx, proposal-submit-form.tsx, buyer-proposals-list.tsx, proposal-status-badge.tsx, index.ts}` + `__tests__/proposals.spec.tsx`; `apps/web/src/app/app/marketer/demands/page.tsx`, `apps/web/src/app/admin/proposals/page.tsx`, `apps/web/src/components/admin/proposal-review-queue.tsx`.
- **`workspace-shell.tsx` (UPDATE):** add marketer matching nav + admin proposal-queue nav entry (follow existing permission-gated array).
- **`demands-view.tsx` (UPDATE, additive):** proposals section per demand; 3.6 submit/list/cancel untouched.

### Decision log (make these calls, do not re-litigate in code)
- **Matcher is inline API-side**, triggered from `createDemand`, not a worker job (worker is Prisma-free / job would be a production no-op). Demand-driven only (no listing-driven re-match).
- **Two tables:** `DemandMatch` (immutable per-(demand,listing) snapshot of who was alerted; backs the provider surface) + `Proposal` (per-(demand,listing) provider submission with its own lifecycle). Both guarded by `@@unique([demandId, listingId])`.
- **Proposal lifecycle:** `PENDING_ADMIN_REVIEW → APPROVED_FOR_BUYER | REJECTED`; buyer select `APPROVED_FOR_BUYER → SELECTED_PENDING_FINAL_ADMIN_APPROVAL` + siblings → `CLOSED`; cancel/expiry close open ones → `CLOSED`. `SELECTED_*`/`REJECTED`/`CLOSED` are terminal for this story (final approve→Deal = Epic 5).
- **Notifications:** only `// TODO(8.8)` markers + the persisted `DemandMatch`/approved-proposal query as the alert surface. No `Notification` model.
- **proposedPrice ≤ demand.maxBudget** and within [1, 50,000,000] SAR (binding price inside the buyer's stated ceiling); ownership + ACTIVE + re-verified match required at submission.
- **Admin permission = `Offers.Review`**; no claim lock, no version/If-Match, no Idempotency-Key (non-financial).

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.7`] ACs; `#Epic 3` demands scope; `#Story 3.6` (upstream), `#Story 5.1`/`#Epic 4` (downstream boundaries)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-22`] matching criteria + no Top-N, `#FR-23` proposal `PendingAdminReview`→`ApprovedForBuyer`/reject, `#FR-24` `SelectedPendingFinalAdminApproval` + no Deal until admin, revert-to-Active on reject; `#UJ-4` Mansour broadcast → matcher → Hisham proposal → admin approve → buyer select → Deal #512 (Epic 5); `#addendum.md` ERD `DEMAND ||--o{ DEMAND_MATCH`, `DEMAND_MATCH ||--|| PROPOSAL`; `#BR-12` demand free/immediate Active
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-5, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12`] + `Admin Permission Matrix#Offers.Review` + `Notification Event Catalog#demand.matched, demand.proposal_received` + `Job Catalog#3 demand-expiry-checker`
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`] buyer workspace surfaces demands/proposals; marketer workspace matching
- [Source: `_bmad-output/implementation-artifacts/3-6-buyer-demand-submission-lifecycle-management.md`] Demand model/`MATCHED`/`CLOSED` pre-added; `// TODO(3.7)` cancel hook; envelope-tolerant unwrap + presentational split + stale-dist/route-order/co-located-spec pitfalls
- Code: `apps/api/prisma/schema.prisma#L91–96,L228+,L343–396,L505–540,L695–724`; `apps/api/src/modules/demands/*`; `apps/api/src/modules/listings/{admin-listings.controller.ts#L46–130, admin-listings.service.ts#L100–230, listings.service.ts#toSummaryItems, listings.controller.ts}`; `apps/api/src/app.module.ts#L1–30`; `apps/worker/src/jobs/{demand-expiry-checker.job.ts, account-deletion-expiry.job.ts}`; `packages/shared/src/{enums/index.ts#L90–96, schemas/index.ts#L86–133, schemas/listing.schema.ts#L37–105, constants/listing.ts#L50–51, constants/demand.ts, constants/jobs.ts, types/index.ts}`; `apps/web/src/components/demands/*`, `apps/web/src/components/admin/listing-moderation-queue.tsx`, `apps/web/src/app/admin/listings/moderation/page.tsx`, `apps/web/src/app/app/marketer/page.tsx#L33–41`, `apps/web/src/components/layout/workspace-shell.tsx#L74–105`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented the full downstream demand pipeline: `DemandMatch` + `Proposal` Prisma models (+ `ProposalStatus` enum and reverse relations on `Demand`/`Listing`/`UserProfile`), applied via `prisma db push` + `prisma generate` (no migration, empty new tables). Windows DLL-swap EPERM on generate was cosmetic — types emitted and `db push` reported the DB in sync.
- Matcher (`ProposalMatcherService.matchDemand`) runs **API-side inline** from `DemandsService.createDemand` inside a log-and-swallow try/catch so 3.6 "immediately ACTIVE" is never broken. Qualifying `ACTIVE` listings (type/city/`askPrice<=maxBudget`/area ±20%) persist one idempotent `DemandMatch` row each; ≥1 flips the demand to `MATCHED` with a SYSTEM `DEMAND_MATCHED` AuditLog. Worker stayed Prisma-free (documented systemic gap).
- Provider/buyer/admin services + controllers wired: `createProposal` re-validates ownership + ACTIVE + match + price envelope (P2002 → `PROPOSAL_DUPLICATE`); admin `approve`/`reject` are state-guarded and audited with **no claim lock / version / If-Match** (AD-10); `selectProposal` moves the chosen proposal to `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` and closes open siblings, leaving Deal/RESERVED/CLOSED for Story 5.1 (`// TODO(5.1)`). Cancel (API tx) and expiry (worker) close unaccepted proposals to `CLOSED`.
- Admin detail route (`GET /admin/proposals/:id`) intentionally omitted — not required by any AC and unused by the queue UI; the task-list `@Get(':id')` line was a suggestion. Decision logged here for reviewers.
- Fixed three compile issues found during the test run: Prisma-vs-shared `UserRole` enum mismatch (`PROVIDER_PROFILE_ROLES` typed as `readonly string[]`), wrong variable name in `cancelDemand` (`demandId: id` → `demandId`), and the invalid `as ModerationQueueResponse` cast (replaced with a dedicated API-local `ProposalQueueResponse` shape).
- Web surfaces (Arabic-first, envelope-tolerant unwrappers, `page.tsx` default-export-only): `MatchingDemandsView`/`MatchingDemandsGrid` + `ProposalSubmitForm`, `BuyerProposalsList`/`BuyerProposalsSection` + `ProposalStatusBadge`, and `ProposalReviewQueue`; marketer + admin nav entries added; buyer `demands-view.tsx` extended additively with a per-demand proposals section. 3.6 submit/list/cancel untouched.
- Test totals (all green, no regressions): API jest 515 (incl. new proposals/admin-proposals specs + extended 3.6 demands spec & cancel-close assertion); shared vitest 306 (incl. proposal schema/constants specs); worker vitest 53 (incl. proposal-close-on-expiry + unwired cases); web vitest 225 (incl. `components/proposals/__tests__/proposals.spec.tsx`). ESLint clean on all new/edited files.

### File List

Data model:
- `apps/api/prisma/schema.prisma` (UPDATE — `ProposalStatus`, `DemandMatch`, `Proposal`, reverse relations)

Shared (`packages/shared`):
- `src/enums/index.ts` (UPDATE — `ProposalStatus`)
- `src/schemas/proposal.schema.ts` (NEW)
- `src/schemas/index.ts` (UPDATE — export proposal.schema)
- `src/constants/proposal.ts` (NEW)
- `src/constants/index.ts` (UPDATE — export proposal)
- `src/types/index.ts` (UPDATE — `CreateProposalInput`, `RejectProposalInput`, `ProposalQueueQuery`)

API (`apps/api/src`):
- `app.module.ts` (UPDATE — register `ProposalsModule`)
- `modules/proposals/proposals.module.ts` (NEW)
- `modules/proposals/proposal-matcher.service.ts` (NEW)
- `modules/proposals/proposals.service.ts` (NEW)
- `modules/proposals/admin-proposals.service.ts` (NEW)
- `modules/proposals/proposals.controller.ts` (NEW)
- `modules/proposals/admin-proposals.controller.ts` (NEW)
- `modules/proposals/dto/proposal-item.dto.ts` (NEW)
- `modules/proposals/dto/create-proposal.dto.ts` (NEW)
- `modules/proposals/dto/index.ts` (NEW)
- `modules/proposals/__tests__/proposals.spec.ts` (NEW)
- `modules/proposals/__tests__/admin-proposals.spec.ts` (NEW)
- `modules/demands/demands.module.ts` (UPDATE — import `ProposalsModule`)
- `modules/demands/demands.service.ts` (UPDATE — matcher dep + call, cancel-close proposals)
- `modules/demands/__tests__/demands.spec.ts` (UPDATE — extend prisma mock, cancel-close assertion)

Worker (`apps/worker/src`):
- `jobs/demand-expiry-checker.job.ts` (UPDATE — close proposals on expiry)
- `jobs/__tests__/demand-expiry.spec.ts` (UPDATE — proposal-close + unwired cases)

Web (`apps/web/src`):
- `components/proposals/proposal-item.ts` (NEW)
- `components/proposals/proposal-status-badge.tsx` (NEW)
- `components/proposals/proposal-submit-form.tsx` (NEW)
- `components/proposals/matching-demands-view.tsx` (NEW)
- `components/proposals/buyer-proposals-list.tsx` (NEW)
- `components/proposals/index.ts` (NEW)
- `components/proposals/__tests__/proposals.spec.tsx` (NEW)
- `components/admin/proposal-review-queue.tsx` (NEW)
- `components/demands/demands-view.tsx` (UPDATE — additive proposals section)
- `components/layout/workspace-shell.tsx` (UPDATE — marketer + admin nav entries)
- `app/app/marketer/demands/page.tsx` (NEW)
- `app/admin/proposals/page.tsx` (NEW)

## Change Log

- 2026-11-04 — Story 3.7 implemented end to end: `DemandMatch`/`Proposal` data model; inline API matcher wired into `createDemand`; provider/buyer/admin proposal services + controllers; admin approve/reject queue (no claim lock); buyer selection with sibling-close; proposals closed on demand cancel (API) and expiry (worker); Arabic-first web surfaces + nav; shared enum/schema/constants/types contracts (additive, non-breaking). Comprehensive jest/vitest coverage across shared/API/worker/web with zero regressions to Story 3.6. Status → review.

