---
baseline_commit: 9b543ae
---

# Story 3.1: Multi-Criteria Filter Search & Pagination

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **property buyer**,
I want to **search and filter active sale listings by location, property type, price range, area, bedrooms, and free text — with pagination and sorting**,
so that I can **quickly discover properties that match my specific purchase criteria.**

## Acceptance Criteria

1. **Filter application:** Given a buyer on the Search & Discovery screen, when applying filters (free text, city, district, property type, price min/max, area min/max, bedrooms, Fal-licensed-only), results honor every supplied criterion simultaneously (AND across fields).
2. **Status gating:** Results return **only** listings with status `ACTIVE` or `RESERVED`. `SOLD`, `ARCHIVED`, `SUSPENDED`, `BLOCKED`, `DRAFT`, `PENDING_REVIEW`, `PENDING_FEE`, `REJECTED`, `UNDER_COMPLIANCE_REVIEW` are always excluded.
3. **Pagination:** Results are paginated — default 20 per page, max 100 — with a `meta` block `{ total, page, limit, totalPages }`. `limit` clamps to `[1, 100]`, `page >= 1`.
4. **Sorting:** Results are sortable by `newest` (default, `createdAt desc`), `price_asc`, `price_desc`.
5. **Free text:** `q` matches title **or** description, case-insensitive, safe against injection.
6. **Performance:** Search endpoint meets **p95 latency < 800 ms under 50,000 active listings** (PRD SM-6 / FR-15).
7. **No regressions:** The existing public home feed (`GET /api/v1/listings` → `getPublicActiveListings`, used by `apps/web/src/app/page.tsx`) keeps working unchanged.

## Tasks / Subtasks

- [x] **Shared contracts** (`packages/shared`) — AC: 1,3,4,5
  - [x] Add `listingSearchQuerySchema` in `src/schemas/listing.schema.ts` (mirror `listingModerationQueueQuerySchema` style: `z.coerce` numbers, `z.string().uuid()`, `z.nativeEnum`, Arabic error messages, defaults from constants). Fields: `q?`, `cityId?`, `districtId?`, `propertyType?`, `priceMin?`, `priceMax?`, `areaMin?`, `areaMax?`, `bedroomsMin?`, `falOnly?` (boolean, default false), `sort?` (enum `newest|price_asc|price_desc`, default `newest`), `page?` (default `DEFAULT_PAGE_SIZE`), `limit?` (default `DEFAULT_PAGE_SIZE`, max `MAX_PAGE_SIZE`).
  - [x] Export `ListingSearchQuery` type + a `SearchListingsResponse` interface `{ items: ListingSummaryItem[]; meta: { total, page, limit, totalPages } }` in `src/types/listing.ts`; re-export from schemas/types index.
  - [x] Add a sort enum or const map (reuse existing enum style in `src/enums/index.ts` if a named enum is preferred).
- [x] **API service** (`apps/api/src/modules/listings/listings.service.ts`) — AC: 1,2,3,4,5,6
  - [x] **Extract** the listing→`ListingSummaryItem` mapper out of `getPublicActiveListings` (photo presigning, `isFalVerified`, `isFavorited`, counters) into a private `mapToSummaryItem`/`toSummaryItems` helper and reuse it in both methods (DO NOT duplicate).
  - [x] Add `searchListings(query: ListingSearchQuery, requesterUserId?: string): Promise<SearchListingsResponse>` building the Prisma `where` (see Dev Notes), running `count` + `findMany` in parallel, and mapping results.
  - [x] Keep `getPublicActiveListings` behavior intact (refactor only to share the mapper).
- [x] **API controller** (`apps/api/src/modules/listings/listings.controller.ts`) — AC: 1,3,4,5
  - [x] Add `@Get('search')` (register **before** `@Get(':id')` so it is not captured by the `:id` route) using `@Query(new ZodValidationPipe(listingSearchQuerySchema))`, optional-session extraction for favorites (reuse the cookie/session block from `getPublicListings`), returning `{ statusCode, data: result }`.
- [x] **DB / performance** (`apps/api/prisma`) — AC: 6
  - [x] Verify the query uses `@@index([status, propertyType, cityId, districtId])`. If `EXPLAIN` shows a sequential scan on sort/filter, add migrations for `@@index([status, askPrice])` and `@@index([status, createdAt])`. Free-text: start with `contains`/`mode: 'insensitive'`; add a PostgreSQL FTS/`pg_trgm` index only if the 800 ms budget is missed.
- [x] **Web UI** (`apps/web/src/app/properties/page.tsx`) — AC: 1,3,4,5,7
  - [x] New client component (`'use client'`) inside `LayoutShell`; fetch via `apiClient.get<{ statusCode; data: SearchListingsResponse }>('/listings/search?...')`.
  - [x] Filter panel reusing `CityDistrictSelector`, property-type chips (`PROPERTY_TYPE_LABELS_AR`), price/area min-max inputs, bedrooms-min, Fal-only toggle, sort select; free-text input debounced **300 ms**.
  - [x] Results grid of `PropertyCard listing={item}`; `EmptyState` on zero results; skeleton/pulse on load; pagination control driven by `meta`.
  - [x] Sync filters to the URL via `useSearchParams`/`useRouter` (shareable, back/forward friendly).
- [x] **Tests** — AC: 1,2,3,4,5
  - [x] Shared: `src/schemas/__tests__/listing-search.spec.ts` (mirror `listing-moderation.spec.ts`): defaults, clamping, uuid/enum rejection, sort values.
  - [x] API: extend `__tests__/listings.service.spec.ts` (or add `listings-search.spec.ts`): status exclusion, each filter, AND-combination, pagination meta math, sort mapping, free-text case-insensitivity, `falOnly`, mapper reuse. Controller spec for `GET /listings/search` (mirror `listings.controller.spec.ts`).
  - [x] Web: component spec for `/properties` mocking `apiClient` (mirror existing `*.spec.tsx` page tests).
- [x] **Manual QA seed** — `apps/api/prisma/seed.ts` must contain ≥1 `ACTIVE` and ≥1 `RESERVED` listing to verify visible results.

## Dev Notes

### Scope boundaries (build ONLY this)
- This story = the **list/grid search, filters, sorting, pagination** on `/properties`.
- **Deferred to sibling stories — do NOT build:** map + split-view + clustering + bounding-box queries (**3.2**), listing detail screen + commission calculator + contact shielding (**3.3**), similar listings (**3.4**), favorites collection page (**3.5**). The favorite **toggle** already exists on `PropertyCard` and its endpoint is in `listings.controller.ts` — reuse, do not rebuild.
- Card click can point to `/properties/[id]`, but that route is owned by 3.3 — do not create it here (a dead link is acceptable for 3.1; the grid/feature rendering is the deliverable).

### Architecture compliance (MUST follow — from ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** All reads go through authenticated NestJS REST under `/api/v1`. `apps/web` NEVER queries Prisma/DB and NEVER imports `apps/api` code; it calls the API via `lib/api-client.ts` and shares types from `@elmasaif/shared`. No Server Action mutations.
- **AD-8:** Standard error envelope `{ code, message, details, requestId }` is produced globally by the exception filter — do not hand-roll error shapes. Reads need no `Idempotency-Key`/`If-Match`.
- **AD-9 / Geography:** City/District are master tables with `isActive`; free-text geography is rejected. Filter by `cityId`/`districtId` UUIDs only. `Listing` has a **composite FK** `[districtId, cityId] → District[id, cityId]`; filtering `Listing.districtId` directly is valid.
- **Pagination convention (Consistency Conventions):** `page` default 1, `limit` default 20 / max 100, envelope `{ data/[], meta:{ total, page, limit, totalPages } }`. Reuse `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` from `packages/shared/src/constants/index.ts`.
- **Money:** `askPrice` is `Decimal(12,2)`; price filters use numbers (`gte`/`lte`); keep the existing response mapping `Number(listing.askPrice)` so `ListingSummaryItem.askPrice` stays numeric like the home feed.
- **CamelCase JSON / snake_case DB:** Prisma abstracts mapping. If you ever use `$queryRaw`, columns are **mostly camelCase** (only a few `@map` to snake): quote `"askPrice"`, `"areaSquareMeters"`, `"bedrooms"`, `"propertyType"`, `"status"`, `"cityId"`, `"districtId"`, `"createdAt"`, table `"listings"`. Prefer the Prisma client over raw SQL here.

### Reuse map (anti-reinvention — these already exist)
- `ListingSummaryItem` (`packages/shared/src/types/listing.ts#L200`) = result row shape.
- `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`, prop `listing: ListingSummaryItem`) = result card; already renders price, specs, Fal badge, carousel, favorite toggle.
- `CityDistrictSelector` (`apps/web/src/components/geo/city-district-selector.tsx`) = location filter; props `selectedCityId`, `selectedDistrictId`, `onCityChange`, `onDistrictChange`, `cityLabel`, etc.
- UI kit `Card, Badge, Button, EmptyState` from `apps/web/src/components/ui`; `LayoutShell` from `apps/web/src/components/layout`.
- `apiClient.get<T>()` (`apps/web/src/lib/api-client.ts`), base `/api/v1`, `credentials: 'include'`.
- `listingModerationQueueQuerySchema` = the template to mirror for the new query schema.
- `getPublicActiveListings` (`apps/api/src/modules/listings/listings.service.ts#L306`) = the mapping/session/photo-presign logic to extract & share, NOT copy.
- Controller `{ statusCode, data }` wrapper and optional-session cookie block from `getPublicListings` (`listings.controller.ts#L111`).

### Query building (decision-complete)
Prisma `where` for `searchListings`:
```ts
const where: Prisma.ListingWhereInput = {
  status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
};
if (q) where.OR = [
  { title: { contains: q, mode: 'insensitive' } },
  { description: { contains: q, mode: 'insensitive' } },
];
if (cityId) where.cityId = cityId;
if (districtId) where.districtId = districtId;
if (propertyType) where.propertyType = propertyType;
if (priceMin != null || priceMax != null)
  where.askPrice = { ...(priceMin != null && { gte: priceMin }), ...(priceMax != null && { lte: priceMax }) };
if (areaMin != null || areaMax != null)
  where.areaSquareMeters = { ...(areaMin != null && { gte: areaMin }), ...(areaMax != null && { lte: areaMax }) };
if (bedroomsMin != null) where.bedrooms = { gte: bedroomsMin };
if (falOnly) where.sellerProfile = { is: { role: UserRole.MARKETER } }; // see caveat below
```
- `orderBy`: `newest → { createdAt: 'desc' }`, `price_asc → { askPrice: 'asc' }`, `price_desc → { askPrice: 'desc' }` (tie-break with `{ id: 'asc' }` for stable paging).
- Paging: `skip = (page - 1) * limit`, `take = limit`; `const [total, listings] = await prisma.$transaction([ prisma.listing.count({ where }), prisma.listing.findMany({ where, orderBy, skip, take, include }) ]);` → `totalPages = Math.ceil(total / limit)`.
- `include`: `city`, `district`, public PHOTO `documents` (as in `getPublicActiveListings`), `sellerProfile { select: { id, role } }`, `_count offers` — then reuse the shared mapper.

### ⚠️ Reconciliations & traps (read before coding)
- **`PropertyType` has NO `Office`.** Actual enum = `VILLA, LAND, APARTMENT, BUILDING, COMMERCIAL, FARM` (`enums/index.ts#L26`). PRD/UX wording "Office" → use `COMMERCIAL` (label `'مكتب / تجاري'`). **Do not add enum values** (needs Prisma enum migration + breaks data).
- **`bedrooms` is nullable** (`Int?`); "4+ bedrooms" ⇒ `bedroomsMin` with `{ gte }`. Only apply when provided. Bathrooms do not exist in the model (BR-13) — never filter/display them.
- **`status` enum names differ from the Architecture state-machine table.** The runtime enum is `ListingStatus` (`ACTIVE`/`RESERVED`/…); the AD-3 state-machine labels (`Submitted`, `Hidden`, etc.) are illustrative. Trust `enums/index.ts`.
- **Free text is in PRD FR-15 but not in the epic AC** — implement it (it is a real requirement), but keep it additive and index-safe.
- **`falOnly` caveat:** `isFalVerified` is currently derived as `sellerRole === MARKETER`. True Fal-license validity lives on the Marketer profile/license lifecycle (Epic 6). For 3.1, filter `sellerProfile.role = MARKETER` to match the badge behavior and note the limitation in the Dev Agent Record; do NOT fabricate a license check here.
- **Response inner key:** use `{ items, meta }` to match `ModerationQueueResponse` / `getPublicActiveListings` conventions (NOT `PaginatedResponse`'s `data`). `PaginatedResponse<T>` exists but listing endpoints already standardize on `items` — consistency wins; document the choice.
- **Route ordering:** `@Get('search')` must be declared before `@Get(':id')` in `listings.controller.ts` or `ParseUUIDPipe` will reject `"search"` as an invalid UUID.
- **Do not break the home page:** `apps/web/src/app/page.tsx` calls `GET /listings?limit=12`. Keep that endpoint + `{ items }` shape intact.

### Project structure notes
- Architecture describes an `apps/web/src/app/(public)/` route group; **the real app has no route groups** — public pages live directly under `apps/web/src/app/` (e.g. `page.tsx`). Create the new page at `apps/web/src/app/properties/page.tsx` (matches UX `/properties`). Do not introduce a route group just for this story.
- Backend search lives in the existing `listings` module (not `demands`); the Architecture "Capability → Map" lists E3 under `demands` for the demands subset, but search over `Listing` belongs in `listings` (`AD-9` binds `listings` for geography). Add to `listings`.
- Validation strings are **Arabic** throughout `packages/shared` schemas — match that convention for the new schema's messages.

### Testing standards
- Framework: **Jest + TS** (see `apps/api/src/modules/listings/__tests__/listings.service.spec.ts`, `listings.controller.spec.ts`; web `*.spec.tsx`). Mirror existing `describe/it` + Prisma-mock patterns already in those files.
- Cover the AC-mapped behaviors: status exclusion (non-`ACTIVE/RESERVED` never returned), every filter individually + combined, pagination clamp + `totalPages` math (incl. empty result ⇒ `total:0, totalPages:0`), all three sorts, free-text case-insensitivity, `falOnly`.
- Keep the existing `getPublicActiveListings` specs green after the mapper extraction (regression guard).

### Performance guidance (AC #6)
- 50k-row target: the leading `status`-first composite index already covers `status + cityId/districtId/propertyType`. Price/area/bedroom ranges and `createdAt/askPrice` sorts are the risk — validate with `EXPLAIN (ANALYZE, BUFFERS)`; add `[status, askPrice]` / `[status, createdAt]` indexes via a raw SQL migration only if a scan is observed. Avoid `SELECT` of unneeded columns; presign photos per-page (≤ limit rows), not across the full table.

### References
- `_bmad-output/planning-artifacts/epics.md#Story 3.1` (AC, epic context), `#Epic 3` (scope), `#Story 3.2/3.3/3.5` (deferred boundaries)
- `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-15` (free text + ranges), `#SM-6` (p95 <800ms), `#FR-11` (field specs)
- `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md` (`/properties` surface, filters, 300ms debounce, empty/skeleton states, responsive/RTL)
- `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1/AD-2/AD-8/AD-9`, Consistency Conventions (Pagination, Money, Error Format), Stack, Capability→Map
- Code: `packages/shared/src/{schemas/listing.schema.ts,types/listing.ts,enums/index.ts,constants/index.ts,constants/listing.ts}`; `apps/api/src/modules/listings/{listings.controller.ts,listings.service.ts}`; `apps/api/prisma/schema.prisma#Listing`; `apps/web/src/{app/page.tsx,lib/api-client.ts,components/listings/property-card.tsx,components/geo/city-district-selector.tsx,components/ui/*}`

## Dev Agent Record

### Agent Model Used

AI developer agent (model version withheld per policy)

### Debug Log References

- `npx vitest run` (packages/shared) → 251 passed / 21 files.
- `npx jest src/modules/listings` (apps/api) → 106 passed / 9 suites (incl. new `listings-search.spec.ts` + `listings.controller.spec.ts` search describe).
- `npx vitest run src/app/properties` (apps/web) → 10 passed.
- `npx tsc --noEmit` (apps/api) → clean; (apps/web) → only pre-existing errors in unrelated files, none in new files.
- `npx eslint` on touched API files → only 2 pre-existing unused-import errors (`LISTING_NOT_SUSPENDED`, `LISTING_ALREADY_BLOCKED` at `listings.service.ts:38-39`), introduced in commit `43946fcf`, NOT by this story — left untouched as out-of-scope.
- `Prisma.ListingOrderByInput` does not exist in Prisma v5.22 (TS2694) → used `Prisma.ListingOrderByWithRelationInput[]`; ran `npx prisma generate` after schema edit.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **AC#1/2/4/5:** `searchListings` builds an AND-combined Prisma `where` gated to `status in [ACTIVE, RESERVED]`, with free-text `OR` on title/description (`contains`, `mode: 'insensitive'` — injection-safe via Prisma params, no raw SQL), ranges (`gte`/`lte`) for price/area, `bedroomsMin` via `{ gte }` only when provided, and `falOnly`.
- **AC#3:** pagination `skip=(page-1)*limit`, `take=limit`; `limit` clamped to `[1,100]`, `page>=1`; returns `{ items, meta:{ total, page, limit, totalPages } }` (empty result → `total:0, totalPages:0`).
- **AC#6:** added `@@index([status, askPrice])` and `@@index([status, createdAt])` alongside the existing `[status, propertyType, cityId, districtId]`; applied via `prisma db push` (repo has no migrations dir). count+findMany run concurrently.
- **AC#7:** home feed `getPublicActiveListings` preserved (still returns `{ items }`, `status: ACTIVE`, `take`); mapper extracted into shared `toSummaryItems`/`getPublicListingInclude`/`resolveFavoritedListingIds` helpers reused by both methods — no duplication; regression test green.
- **Controller:** `@Get('search')` declared before `@Get(':id')` so `ParseUUIDPipe` does not reject `"search"`; reuses optional cookie/bearer session extraction to pass `requesterUserId` for favorite flags; returns `{ statusCode, data }`.
- **Web `/properties`:** `'use client'` page in `LayoutShell`; exports testable `PropertiesSearchView` + `buildSearchQuery`/`parseFiltersFromParams` helpers; URL-synced filters, 300 ms debounced free text (decoupled `queryValue`/`onQueryChange` so typing does not fire a request each keystroke), `CityDistrictSelector`, type chips, price/area/bedrooms inputs, Fal-only, sort select, `PropertyCard` grid, `EmptyState`, skeleton, `meta`-driven pagination.
- **Reconciliations (deviations from literal task text, per Dev Notes traps):**
  1. Task said `page` default `DEFAULT_PAGE_SIZE`; used default **1** to satisfy AC#3 (`page>=1`) and the `skip=(page-1)*limit` convention.
  2. Used `Promise.all([count, findMany])` instead of `$transaction([...])` — matches the sibling `admin-listings.service` tested pattern and the callback-form `$transaction` mock.
  3. Response inner key **`items`** (not `PaginatedResponse.data`) for consistency with `getPublicActiveListings`/`ModerationQueueResponse`.
  4. `falOnly` filters `sellerProfile.role = MARKETER` to mirror the `isFalVerified` badge; true license validity is deferred to Epic 6 — noted, not fabricated.
  5. `PropertyType` has no `Office` — used existing `COMMERCIAL`; no enum values added.

### File List

**Modified**
- `packages/shared/src/enums/index.ts` — added `ListingSearchSort` enum.
- `packages/shared/src/schemas/listing.schema.ts` — added `listingSearchQuerySchema`.
- `packages/shared/src/types/listing.ts` — added `ListingSearchQuery` type + `SearchListingsResponse` interface.
- `apps/api/src/modules/listings/listings.service.ts` — extracted shared mapper helpers; added `searchListings`.
- `apps/api/src/modules/listings/listings.controller.ts` — added `@Get('search')` before `@Get(':id')`.
- `apps/api/prisma/schema.prisma` — added `[status, askPrice]` and `[status, createdAt]` indexes.
- `apps/api/prisma/seed.ts` — added `seedDemoListings()` (≥1 ACTIVE + ≥1 RESERVED).
- `apps/api/src/modules/listings/__tests__/listings.controller.spec.ts` — added `GET /listings/search` describe + mocks.

**Created**
- `packages/shared/src/schemas/__tests__/listing-search.spec.ts` — 13 schema tests.
- `apps/api/src/modules/listings/__tests__/listings-search.spec.ts` — service tests (status gating, filters, ranges, free text, falOnly, sort, meta, clamp, mapper reuse, home-feed regression).
- `apps/web/src/app/properties/page.tsx` — `/properties` search page (view + container + helpers).
- `apps/web/src/app/properties/__tests__/properties-search-page.spec.tsx` — 10 helper/view tests.

## Change Log

- 2026-11-04: Implemented Story 3.1 — multi-criteria filter search, status gating (ACTIVE/RESERVED), pagination (default 20 / max 100 + `meta`), sorting (newest/price_asc/price_desc), injection-safe free text, `/properties` web UI, seed data, and shared/API/web test suites. Status → review.
