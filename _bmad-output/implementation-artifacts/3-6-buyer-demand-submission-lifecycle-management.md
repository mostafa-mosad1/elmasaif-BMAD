---
baseline_commit: review-state-3-5
---

# Story 3.6: Buyer Demand Submission & Lifecycle Management

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **buyer looking for specific real estate**,
I want to **submit a structured property demand with budget and location criteria and manage its lifecycle**,
so that I can **have qualified sellers pitch matching inventory to me directly.**

## Acceptance Criteria

1. **Structured demand submission (FR-21, AD-9):** Given an authenticated BUYER, when `POST /api/v1/demands` with `propertyType`, required `cityId` (UUID), optional `districtId` (UUID), budget range in SAR, area range (m²), and optional specifications (≤ 1000 chars) → the demand is persisted and **transitions immediately to `ACTIVE`** with `expiresAt = ClockService.now() + 30 days` (`DEMAND_EXPIRY_DAYS`). **No admin approval** (BR-12).
2. **Free-text geography rejected:** `cityId` MUST exist in the `City` master table and be `isActive`; when provided, `districtId` MUST exist, be `isActive`, AND belong to `cityId`. Any missing/inactive/mismatched geography → `BadRequestException` (`GEO_CITY_INACTIVE` / `GEO_DISTRICT_INACTIVE`). No `city`/`districts` free-text is accepted by the API.
3. **Demand lifecycle list (FR-58):** `GET /api/v1/demands/my` (guarded) returns the buyer's demands (active + history), newest-created first, each with status, budget/area, city/district names, and remaining expiry window. Empty → `{ items: [] }`.
4. **Buyer cancel with structured reason (FR-58):** `POST /api/v1/demands/:id/cancel` with a non-empty `reason` sets the demand to `CANCELLED`, records `cancelledAt` (ClockService) and `cancelReason`, and writes an `AuditLog` row in the same transaction. Only a demand in `ACTIVE` or `MATCHED` may be cancelled; any other status → `ConflictException` (`DEMAND_NOT_CANCELLABLE`). A buyer may only cancel their own demand (else 404).
5. **Hourly expiry sweep (FR-21):** The `demand-expiry-checker` job logic marks `ACTIVE` demands whose `expiresAt <= now` as `EXPIRED`, idempotently, writing an `AuditLog` row per transition. (Runtime pg-boss DB wiring is a systemic gap outside this story — see Dev Notes.)
6. **No regressions:** The `@elmasaif/shared` `createDemandSchema` rework (free-text → structured) is the ONLY contract change; `CreateDemandInput` consumers must still typecheck. Existing listings search/map/detail/favorites/similar screens, geo module, and worker job registry remain behaviorally untouched. The dashboard "طلبات الشراء النشطة" card and sidebar link (already pointing at `/app/buyer/demands`) now resolve to a real screen.

## Tasks / Subtasks

- [ ] **Schema rework — structured geography + lifecycle** (`apps/api/prisma/schema.prisma`) — AC: 1, 2, 4, 5
  - [ ] `Demand`: make `cityId String` **required** (drop `?`), keep `districtId String?` optional. **Remove the free-text `city String` requirement** → `city String?` and `districts Json` → `districts Json?` (keep columns nullable so no data loss / no hard column drop; they are simply no longer written by the API).
  - [ ] Add `cancelReason String?` and `cancelledAt DateTime?`.
  - [ ] Add relations mirroring `Listing` (L376–377): `city City @relation(fields: [cityId], references: [id])` and `district District? @relation(fields: [districtId, cityId], references: [id, cityId])`.
  - [ ] Add the reverse relations: `City.demands Demand[]` (L319–320 block) and `District.demands Demand[]` (L333–334 block).
  - [ ] Add `CANCELLED` to the `enum DemandStatus` (L91–96) → `ACTIVE`, `MATCHED`, `EXPIRED`, `CANCELLED`, `CLOSED`.
  - [ ] Keep `minBudget/maxBudget` `Decimal @db.Decimal(12,2)` and `minArea/maxArea` `Float` as-is (already modeled; ranges satisfy "budget"/"area" and feed 3.7 matching). Keep `status DemandStatus @default(ACTIVE)` and `expiresAt DateTime`. Keep `@@index([cityId, districtId])`; update `@@index([status, city, propertyType])` → `@@index([status, cityId, propertyType])` (the free-text `city` column is being retired).
  - [ ] Apply schema-first with **`npm run prisma:push` then `npm run prisma:generate`** in `apps/api` (repo has NO committed migration files — `prisma migrate` glob is empty; do NOT create one). Add the DB `enum` value and nullability via db push.

- [ ] **Shared contracts** (`packages/shared`) — AC: 1, 2, 3, 4
  - [ ] `src/enums/index.ts` — add `CANCELLED = 'CANCELLED'` to `DemandStatus` (mirror the Prisma enum exactly; keep existing `MATCHED`, `CLOSED`).
  - [ ] `src/schemas/index.ts` — REWRITE `createDemandSchema`: `propertyType: z.nativeEnum(PropertyType)`, `cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة')`, `districtId: z.string().uuid(...).optional().nullable()`, `minBudget`/`maxBudget` as the listing `askPrice` union(number|string-regex).pipe(z.coerce.number()) with `refine(max >= min)`, `minArea`/`maxArea` `z.number().positive()` with `refine(max >= min)`, `notes: z.string().trim().max(1000, '...').optional().nullable()`. **DELETE the `city`/`districts` free-text fields.** Match the exact idiom of `createListingSchema` (listing.schema.ts L37–89) for money coercion + Arabic messages.
  - [ ] Add `cancelDemandSchema = z.object({ reason: z.string().trim().min(5, 'سبب الإلغاء يجب ألا يقل عن 5 أحرف').max(500, '...') })` (mirror `archiveListingSchema`/`forceUnlockListingSchema` style).
  - [ ] `src/types/index.ts` — re-derive `CreateDemandInput` from the new schema (unchanged import line already does `z.infer<typeof createDemandSchema>`); add `export type CancelDemandInput = z.infer<typeof cancelDemandSchema>;`.
  - [ ] NEW `src/constants/demand.ts`: `export const DEMAND_NOT_FOUND = 'DEMAND_NOT_FOUND';`, `export const DEMAND_NOT_CANCELLABLE = 'DEMAND_NOT_CANCELLABLE';`, `export const DEMAND_FORBIDDEN = 'DEMAND_FORBIDDEN';`, and `DEMAND_STATUS_LABELS_AR: Record<DemandStatus,string>` (`ACTIVE`='نشط', `MATCHED`='تمت مطابقته', `EXPIRED`='منتهي الصلاحية', `CANCELLED`='ملغي', `CLOSED`='مغلق'). Add `export * from './demand';` to `src/constants/index.ts` (append after `./listing`). `DEMAND_EXPIRY_DAYS = 30` already exists (constants/index.ts L5) — reuse, do NOT redefine.
  - [ ] **🔴 After adding exports, rebuild shared dist before ANY apps/api test run:** `cd packages/shared && npx tsc` (Jest resolves `@elmasaif/shared` from compiled dist — stale dist = missing-export compile failure; bit Stories 3.4/3.5).

- [ ] **API — new demands module** (`apps/api/src/modules/demands/`, NEW) — AC: 1, 2, 3, 4
  - [ ] Mirror `listings.module.ts` structure: `demands.module.ts` imports `[PrismaModule, ClockModule, AuthModule]`, provides `DemandsService`, `SessionAuthGuard`, `ActiveRoleGuard`. Register `DemandsModule` in `apps/api/src/app.module.ts` `imports` (L15–32) — the module does not exist yet.
  - [ ] `demands.controller.ts` `@Controller('demands')`:
    - `@Post()` `@HttpCode(CREATED)` `@UseGuards(SessionAuthGuard, ActiveRoleGuard)` `@RequireRole(UserRole.BUYER)` `@ApiBearerAuth()`, body `@Body(new ZodValidationPipe(createDemandSchema)) dto: CreateDemandInput` → `this.demandsService.createDemand(req.user.id, req.user.activeRole || req.user.role, dto)` → return `{ statusCode: CREATED, data }`.
    - `@Get('my')` `@UseGuards(SessionAuthGuard)` `@ApiBearerAuth()` → `{ statusCode: OK, data: await this.demandsService.getBuyerDemands(req.user.id) }` (envelope `{ data: { items } }` matches search/map/favorites).
    - `@Post(':id/cancel')` `@UseGuards(SessionAuthGuard)` `@ApiBearerAuth()`, `@Param('id', ParseUUIDPipe)`, body `@Body(new ZodValidationPipe(cancelDemandSchema)) dto` → `{ statusCode: OK, data: await this.demandsService.cancelDemand(req.user.id, id, dto.reason) }`.
    - **🔴 Route order:** declare `@Get('my')` before any `@Get(':id')` (none added here, but keep the static-first rule). `POST :id/cancel` is a distinct path, fine.
  - [ ] `demands.service.ts`:
    - `createDemand(userId, activeRole, dto)`: resolve BUYER profile `this.prisma.userProfile.findUnique({ where: { userId_role: { userId, role: UserRole.BUYER } } })`; if missing/inactive → `ForbiddenException({ code: DEMAND_FORBIDDEN, ... })` (mirror listings L110–127). Validate geography EXACTLY like listings L169–193: `city.findUnique({ where: { id: dto.cityId } })` must exist + `isActive` else `BadRequestException({ code: GEO_CITY_INACTIVE })`; if `dto.districtId` present, `district.findUnique({ where: { id_cityId: { id: dto.districtId, cityId: dto.cityId } } })` must exist + `isActive` else `GEO_DISTRICT_INACTIVE`. Compute `expiresAt = this.clockService.addDays(DEMAND_EXPIRY_DAYS)` — **if `ClockService` has no `addDays`, use `new Date(this.clockService.now().getTime() + DEMAND_EXPIRY_DAYS*86400000)`; NEVER `new Date()` / `Date.now()` directly (AD-11)** — confirm the actual ClockService API before coding. Insert with `status: ACTIVE`, `buyerProfileId: profile.id`, budget as `dto.minBudget/maxBudget` (Decimal accepts numeric/string), `notes: dto.notes ?? null`. Do NOT write `city`/`districts` (leave null). Return a mapped item (below). Non-financial → no Idempotency-Key, no `If-Match` (Demand has no `version`).
    - `getBuyerDemands(userId)`: resolve the BUYER profile id (same lookup, no status gate needed for read); `this.prisma.demand.findMany({ where: { buyerProfileId: profile.id }, orderBy: { createdAt: 'desc' }, include: { city: true, district: true } })`; map each to `toDemandItem`. Return `{ items }`. **Do not filter by status** — history (EXPIRED/CANCELLED/CLOSED) must appear (FR-58 "active and historical").
    - `cancelDemand(userId, id, reason)`: `$transaction(async (tx) => { const demand = await tx.demand.findFirst({ where: { id, buyerProfileId: profileId } }); if (!demand) throw NotFoundException({ code: DEMAND_NOT_FOUND }); if (demand.status !== ACTIVE && demand.status !== MATCHED) throw ConflictException({ code: DEMAND_NOT_CANCELLABLE, ... }); await tx.demand.update({ where: { id }, data: { status: CANCELLED, cancelReason: reason, cancelledAt: this.clockService.now() } }); await tx.auditLog.create({ data: { actorId: userId, actorType: 'USER', action: 'DEMAND_CANCELLED', entityType: 'Demand', entityId: id, payload: { reason, cancelledAt } } }); })`. **3.7 hook (documented, NOT implemented here):** "closes unselected proposals" — no `Proposal` model exists yet; add a `// TODO(3.7): close unselected proposals on cancel` comment where the tx commits.
    - `toDemandItem(demand)` mapper: expose `id, propertyType, status, cityId, districtId, cityName: demand.city?.nameAr, districtName: demand.district?.nameAr, minBudget/maxBudget as Number(...)` (consistency convention: Decimal leaves as number in JSON), `minArea, maxArea, notes, expiresAt (ISO string), createdAt (ISO string), cancelledAt, cancelReason`. Add `proposalCount: 0` ONLY if the UI needs the slot — otherwise omit; proposals are 3.7.

- [ ] **Worker — real expiry logic** (`apps/worker/src/jobs/demand-expiry-checker.job.ts`) — AC: 5
  - [ ] Refactor to a testable factory mirroring `account-deletion-expiry.job.ts`: `export interface DemandExpiryDbClient { demand: { findMany; update }; auditLog?: { create } }` and `export function createDemandExpiryCheckerLogic(db?: DemandExpiryDbClient)`. Logic: `if (db) { const stale = await db.demand.findMany({ where: { status: ACTIVE, expiresAt: { lte: currentTime } } }); for each → db.demand.update({ where:{id}, data:{ status: EXPIRED } }) + db.auditLog.create({ ... action:'DEMAND_EXPIRED' ... }); processedCount++ }`. Return `{ processedCount, outcome, details }`. Keep `demandExpiryCheckerHandler = createJobHandler(JOB_DEMAND_EXPIRY_CHECKER, createDemandExpiryCheckerLogic())` (no db arg — matches how the account-deletion handler is registered and how `jobHandlersMap` wires it).
  - [ ] **Scope note (do NOT expand):** `apps/worker` has **no `@prisma/client` dependency**; no expiry job (offer/fal/…) is runtime-db-wired yet. Wiring a real Prisma client into the scheduler is a systemic, cross-story decision — this story delivers the **correct, idempotent, unit-tested logic** only. Do NOT add a Prisma dependency to the worker.

- [ ] **Web — buyer demands surface** (`apps/web`) — AC: 1, 2, 3, 4
  - [ ] NEW `apps/web/src/components/demands/demand-submit-form.tsx` (`'use client'`): uses `CityDistrictSelector` (`components/geo`) with `required` city + **optional** district (it already supports `onCityChange`/`onDistrictChange` null and `cityLabel`/`districtLabel`); property-type select from `PropertyType`; budget min/max + area min/max number inputs; `notes` textarea (maxLength 1000). On submit → `apiClient.post('/demands', payload)`; on success push the new demand into the list (or navigate to `/app/buyer/demands`); on `ApiError` surface the structured `err.code` message inline (Arabic). Mirror the client-side validation of `createDemandSchema` shape.
  - [ ] NEW `apps/web/src/components/demands/demands-view.tsx` (container, `'use client'`): `useEffect` → `apiClient.get('/demands/my')`, unwrap via a **pure exported** `unwrapDemandsPayload(payload)` tolerant of BOTH bare `{ items }` and `{ statusCode, data: { items } }` (same lesson as `unwrapFavoritesPayload`/`unwrapSimilarPayload`). States: loading skeleton, error `EmptyState` w/ retry, empty `EmptyState`. Renders `<DemandsGrid items on onCancel />` + a "submit demand" affordance hosting `DemandSubmitForm`.
  - [ ] Pure presentational `DemandsGrid({ items, onCancel })` exported for SSR tests. Each card shows city/district names, propertyType, budget/area (LTR numerals via existing card formatting helpers — reuse, add none bespoke), remaining expiry window, and `<DemandStatusBadge status />`. Cancel button only for `ACTIVE`/`MATCHED` rows → opens a reason prompt (inline field or small modal), then `apiClient.post('/demands/{id}/cancel', { reason })`; on success update the row to `CANCELLED` in local state; on `DEMAND_NOT_CANCELLABLE`/error revert (item unchanged) + inline notice.
  - [ ] NEW `apps/web/src/components/demands/demand-status-badge.tsx` — maps `DemandStatus` → Arabic via `DEMAND_STATUS_LABELS_AR` (covers every status like `ListingStatusBadge` does). Reuse `Badge` from `components/ui`.
  - [ ] NEW `apps/web/src/components/demands/index.ts` barrel; export `DemandSubmitForm`, `DemandsView`, `DemandsGrid`, `DemandStatusBadge`, `unwrapDemandsPayload`.
  - [ ] NEW page shell `apps/web/src/app/app/buyer/demands/page.tsx` (thin `'use client'` wrapper). **🔴 Architecture invariant: route `page.tsx` exposes ONLY the default export** — every helper/test-visible piece lives in the component files, never re-exported from `page.tsx`. Auth/redirect already handled by `app/app/layout.tsx`.
  - [ ] Wire `apps/web/src/app/app/buyer/page.tsx` "طلبات الشراء النشطة" stat card (L51–57, `count: 0` hardcoded): add `demandsCount` state via `apiClient.get('/demands/my')` → unwrap → count `status === ACTIVE` items; `.catch(() => {})` silent (dashboard must never break). Mirror the favorites count idiom (L20–26). Offers card stays hardcoded (Epic 4).

- [ ] **Tests** — AC: all
  - [ ] Shared (vitest, extend existing constants/schemas spec style): `createDemandSchema` accepts structured `{ cityId: uuid, districtId: uuid|undefined }`, REJECTS missing/invalid `cityId` and free-text-only payloads; `districtId` optional; rejects `maxBudget < minBudget` and `maxArea < minArea`; `cancelDemandSchema` requires reason ≥5 ≤500. Assert `DemandStatus.CANCELLED === 'CANCELLED'`, `DEMAND_EXPIRY_DAYS === 30`, `DEMAND_STATUS_LABELS_AR` covers all five statuses.
  - [ ] API (jest, NEW `apps/api/src/modules/demands/__tests__/demands.spec.ts`, story-scoped): `createDemand` — profile lookup BUYER, city-must-be-active (`GEO_CITY_INACTIVE`), district optional (null districtId skips district query; mismatched district → `GEO_DISTRICT_INACTIVE`), `expiresAt` = now+30d via ClockService mock, status `ACTIVE`; `cancelDemand` — ACTIVE→CANCELLED sets `cancelReason`+`cancelledAt`+`auditLog.create` called; `EXPIRED`/`CLOSED` → `ConflictException` `DEMAND_NOT_CANCELLABLE`; other buyer's id → `NotFoundException`; `getBuyerDemands` — findMany shape (buyerProfileId where, createdAt-desc, city+district include), NO status filter, `minBudget/maxBudget` returned as numbers. Mock `prisma` (city/district/demand/userProfile/auditLog) + `clockService.now()`.
  - [ ] Worker (vitest, NEW `apps/worker/src/jobs/__tests__/demand-expiry.spec.ts`, mirror `account-deletion-expiry.spec.ts`): `createDemandExpiryCheckerLogic(mockDb)` — finds `ACTIVE` where `expiresAt <= now`, updates each to `EXPIRED`, writes `auditLog`, `processedCount` correct; no db → 0; already-EXPIRED rows not re-fetched (idempotent).
  - [ ] Web (vitest, NEW `apps/web/src/components/demands/__tests__/demands.spec.tsx` — under `components/demands/__tests__/`, NOT co-located in the route dir, to dodge the `[id]/__tests__` relative-import mis-resolution pitfall): `unwrapDemandsPayload` bare vs enveloped vs null; `DemandsGrid` via `renderToString` — rows render from items, `DemandStatusBadge` label present for CANCELLED/EXPIRED, cancel affordance present for ACTIVE and absent for EXPIRED. No jsdom/RTL interaction tests (established suite constraint).
  - [ ] Frameworks: jest for API, vitest for web/shared/worker (`npx vitest run` per package; `npx jest` in apps/api). No new libraries, no form/wizard libs, no UI kits.

## Dev Notes

### Scope boundaries (build ONLY this)
- **This story = demand creation (structured geography) + buyer demand list + buyer cancel-with-reason + the real (testable) expiry-job logic + the `/app/buyer/demands` submit/list/cancel UI + dashboard count.**
- **Do NOT build:** the matching engine / notifications / `demand.matched` (FR-22 = Story 3.7); the `Proposal` model, proposal submission, admin proposal review, buyer proposal selection (FR-23/FR-24 = Story 3.7); `MATCHED` status SETTING logic (3.7 sets it — 3.6 only permits cancelling a demand that happens to be MATCHED); offers/backup offers (Epic 4); real-time/SSE; pagination (a buyer will not exceed reasonable demand counts; add none).
- **Front-loaded for 3.7 (intentional):** `MATCHED` and `CLOSED` enum values are added now because they already exist in the DB enum; `CLOSED` is a valid terminal state (system/admin), `MATCHED` is set by the 3.7 engine. 3.6 never writes them except reading for cancel eligibility.

### Critical implementation traps (read before coding)
- **🔴 The API contract is free-text TODAY and MUST become structured.** Current `createDemandSchema` = `{ city: string, districts: string[] }` and the `Demand` model has a REQUIRED `city String` + `districts Json` with `cityId String?`/`districtId String?` as **unlinked, unvalidated plain columns**. FR-21/AD-9 forbid free-text geography. The whole point of Tasks §Schema + §Shared is to flip this: `cityId` required UUID, `districtId` optional UUID, no free-text in the payload, real FKs + service existence checks. If you leave the free-text path wired, AC#2 fails.
- **🔴 `DemandStatus` has no `CANCELLED`.** FR-58 explicitly lists Cancelled distinct from Closed. Add it to BOTH the Prisma enum and the shared enum (single source of truth), then `prisma:push` + `prisma:generate`. Do NOT reuse `CLOSED` for buyer cancel — keep `CLOSED` for system/admin/matched-completion closure.
- **🔴 No committed migrations in this repo.** `apps/api/prisma/migrations/**` is empty; schema evolves via `prisma db push`. Run `prisma:push` + `prisma:generate` after editing the schema, and rebuild `packages/shared` (`npx tsc`) before running API tests (stale-dist missing-export failure bit prior stories).
- **🔴 ClockService only (AD-11).** `expiresAt` and `cancelledAt` MUST come from `this.clockService.now()` (+ 30 days derived from it), never `new Date()`/`Date.now()`. Verify the exact ClockService surface (`now()`, and whether an `addDays`/`advance` helper exists) before use.
- **🔴 Money as Decimal → number.** `minBudget`/`maxBudget` are `Decimal(12,2)`; coerce input with the listing `askPrice` idiom and emit `Number(...)` in `toDemandItem` (consistency convention). `districtId` null is legal (optional); do NOT force a district.
- **🔴 Route order / bare object vs envelope.** `@Get('my')` before any `:id`. `POST /demands` returns `{ statusCode, data }` and `GET /demands/my` returns `{ statusCode, data: { items } }` (controller wraps) — the web `unwrapDemandsPayload` must tolerate BOTH (the detail-vs-search envelope divergence is a known pitfall).
- **🔴 Route `page.tsx` = default export ONLY** (architecture invariant). Keep views/helpers in `components/demands/`.
- **🔴 Co-located tests in the route dir mis-resolve imports** to the parent page — put web specs under `components/demands/__tests__/`, not under `app/.../demands/__tests__/`.
- **Worker has no Prisma dependency and no expiry job is runtime-db-wired.** Delivering the logic factory + unit test is the correct, consistent scope; adding a Prisma client to the worker is out of scope and would be an unrequested architectural change.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** web never touches Prisma; all reads/mutations via `/api/v1` through `apiClient` (same-origin proxy keeps the HttpOnly session cookie); types/enums/constants/Zod from `@elmasaif/shared`. Mutations only via explicit semantic endpoints (`POST /demands`, `POST /demands/:id/cancel`) — **no generic `PATCH /demands/:id` status update, no Server Actions**.
- **AD-9:** geography strictly structured — `cityId` (+ optional `districtId`) FK to `City`/`District`; free-text rejected at the Zod boundary AND existence-checked server-side.
- **AD-8:** throw structured exceptions (`{ code, message }`); global filter yields `{ code, message, details, requestId }`. Demand create/cancel are non-financial → no `Idempotency-Key`, no `If-Match`/`version` (Demand has none). Error codes go in `packages/shared/constants/demand.ts` and are consumed by BOTH api and web.
- **AD-5:** `SessionAuthGuard` (user realm) + `ActiveRoleGuard` + `@RequireRole(UserRole.BUYER)` for create; guards on list/cancel. Admins have no demands. `/app` layout already client-gates; 401 covers cookie expiry.
- **AD-7 / AD-11:** the `demand-expiry-checker` job is idempotent and every async transition writes `AuditLog` within the tx; all temporal math via `ClockService`/`workerClock`.
- **Stack (pinned):** NestJS 10.x + Prisma 5.x, Next.js App Router + React 19 + Tailwind 3.4, Zod 3.23, TypeScript strict, pg-boss 10.x. **No new dependencies** (Lucide `FileQuestion` already used for the demands nav).

### Reuse map (all already exist — do not rebuild)
- `CityDistrictSelector` (`components/geo/city-district-selector.tsx`) — cascading city/optional-district picker, `required`/`cityLabel`/`districtLabel`/`cityError`/`districtError` props, fetches from `/geo`. Use verbatim in the submit form.
- Geo existence+active validation idiom — `listings.service.ts` L169–193 (city `findUnique` + district `findUnique({ where: { id_cityId } })`). Copy the shape and the `GEO_CITY_INACTIVE`/`GEO_DISTRICT_INACTIVE` codes (`constants/geo.ts`).
- BUYER profile resolution — `listings.service.ts` L110–127 `userProfile.findUnique({ where: { userId_role: { userId, role } } })` + `ForbiddenException` on inactive.
- Module/controller idiom — `listings.module.ts`, `listings.controller.ts` (`@Get('my')` guarded envelope, `ParseUUIDPipe`, `ZodValidationPipe`, `@ApiBearerAuth`, `{ statusCode, data }`).
- Money union/coercion + structured-geo Zod idiom — `createListingSchema` (schemas/listing.schema.ts L37–89).
- Envelope-tolerant unwrap + pure-presentational split + dashboard silent-count — `buyer-favorites-view.tsx` / `unwrapFavoritesPayload` / `buyer/page.tsx` (Story 3.5).
- Status badge full-coverage pattern — `ListingStatusBadge` + `LISTING_STATUS_LABELS_AR` (Story 3.5/2.x).
- Worker job factory + mock-db test idiom — `account-deletion-expiry.job.ts` and `account-deletion-expiry.spec.ts`.
- `Badge`, `Card`, `Button`, `EmptyState` (`components/ui`); `apiClient` + `ApiError` (`.code` carries `DEMAND_NOT_CANCELLABLE`); `useAuth`. `/app/buyer/demands` link already in `workspace-shell.tsx` L78 + dashboard card `buyer/page.tsx` L51–57 (both currently 404 — the story makes them resolve).
- Shared scaffolding already present: `DemandStatus` enum (enums L90–95), `createDemandSchema` (schemas L79–88, needs rework), `DEMAND_EXPIRY_DAYS=30` (constants L5), `JOB_DEMAND_EXPIRY_CHECKER` + `BACKGROUND_JOB_DEFINITIONS[...].cadence='0 * * * *'` (constants/jobs.ts), `JobName` union `demand-expiry-checker` (types/jobs.ts), stub `demand-expiry-checker.job.ts`, `jobHandlersMap` entry, `Demand` model (schema L692–715).

### Current-state notes (files being touched)
- **`schema.prisma` (UPDATE):** `Demand` — structured FKs, required `cityId`, nullable free-text, `cancelReason`/`cancelledAt`, enum `CANCELLED`; `City`/`District` reverse `demands[]`.
- **`createDemandSchema` (UPDATE):** free-text → structured; **`CreateDemandInput` consumers** must still compile (none in web/api yet since module is new).
- **`app.module.ts` (UPDATE):** register `DemandsModule`.
- **`demand-expiry-checker.job.ts` (UPDATE):** stub → `createDemandExpiryCheckerLogic(db?)` factory (real expiry).
- **`buyer/page.tsx` (UPDATE):** demands stat card count becomes state-backed via one guarded fetch, silent-failure (mirror favorites L20–26).
- **NEW:** `apps/api/src/modules/demands/{demands.module.ts, demands.controller.ts, demands.service.ts, dto/*}`, `apps/api/src/modules/demands/__tests__/demands.spec.ts`, `apps/worker/src/jobs/__tests__/demand-expiry.spec.ts`, `packages/shared/src/constants/demand.ts`, `apps/web/src/components/demands/{demand-submit-form.tsx, demands-view.tsx, demand-status-badge.tsx, index.ts}`, `apps/web/src/components/demands/__tests__/demands.spec.tsx`, `apps/web/src/app/app/buyer/demands/page.tsx`.
- **`constants/index.ts`, `schemas/index.ts`, `types/index.ts`, `enums/index.ts` (UPDATE):** append demand exports; no redefinition of existing symbols.

### Decision log (make these calls, do not re-litigate in code)
- **Cancel status = `CANCELLED`** (new enum value), `cancelReason`+`cancelledAt` recorded; `CLOSED` stays for system/admin/matched-completion; `EXPIRED` only from the worker sweep.
- **Budget/area remain RANGES** (`minBudget/maxBudget`, `minArea/maxArea`) — already modeled, required, and feed 3.7 (`askPrice <= maxBudget`, area within ±20%); "budget"/"area" in the AC is satisfied by the range.
- **District is optional** (`districtId` nullable); city is required + active.
- **`notes`** is the "specifications" field, max 1000 chars (FR-21); keep the column name `notes` (no rename churn).
- **`proposalCount` / "closes unselected proposals"** are 3.7 dependencies — represent as a `// TODO(3.7)` in the cancel tx and omit from the response until the `Proposal` model exists.

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.6`] ACs; `#Epic 3` (demands scope); `#Story 3.7` (matching + proposals, downstream)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-21`] structured geography, immediate `Active`, `expiresAt = createdAt + 30d`, hourly expiry cron; [#FR-58] dashboard statuses (`Active`/`Cancelled`/`Expired`/`Closed`), cancel requires reason, cancel closes outstanding proposals; [#UJ-4] Mansour broadcasts → closes via matching (3.7)
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-5, AD-7, AD-8, AD-9, AD-11`, Consistency Conventions, Job Catalog #3 `demand-expiry-checker`, Data Architecture §2 Geography]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`] buyer workspace surfaces demands
- [Source: `_bmad-output/implementation-artifacts/3-5-buyer-favorites-collection.md`] envelope-tolerant unwrap + presentational split + dashboard silent-count idiom; story-scoped spec pattern; stale-dist/route-order pitfalls
- Code: `apps/api/prisma/schema.prisma#L91–96,L312–338,L340–390,L692–715`; `packages/shared/src/{enums/index.ts#L26–33,L90–95, schemas/index.ts#L79–88, schemas/listing.schema.ts#L37–89, constants/index.ts#L5, constants/geo.ts, constants/jobs.ts, types/index.ts#L6–13}`; `apps/api/src/modules/listings/{listings.service.ts#L100–193, listings.controller.ts#L1–210, listings.module.ts}`; `apps/api/src/app.module.ts#L14–33`; `apps/worker/src/jobs/{demand-expiry-checker.job.ts, account-deletion-expiry.job.ts, job-wrapper.ts, index.ts}`; `apps/web/src/components/geo/city-district-selector.tsx#L1–80`; `apps/web/src/app/app/buyer/page.tsx#L20–57`; `apps/web/src/components/layout/workspace-shell.tsx#L78`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

## Change Log

- 11-04-2026: Story 3.6 context authored (ready-for-dev). Structured-geography rework of `Demand`/`createDemandSchema`, `CANCELLED` enum, buyer list + cancel-with-reason, real `demand-expiry-checker` logic, and `/app/buyer/demands` submit/list/cancel UI scoped. Proposals/matching explicitly deferred to Story 3.7.
