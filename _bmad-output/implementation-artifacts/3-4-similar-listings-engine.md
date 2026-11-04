---
baseline_commit: review-state-3-3
---

# Story 3.4: Similar Listings Engine

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **buyer viewing a listing**,
I want to **see a carousel of similar active properties matching the current property's attributes**,
so that I can **discover relevant alternative purchasing opportunities.**

## Acceptance Criteria

1. **Similar section on detail page:** Given an active listing detail page (`/properties/[id]`, Story 3.3 screen), when the similar-properties section loads, it fetches `GET /api/v1/listings/:id/similar` via `apiClient` and renders a horizontal carousel of the returned cards.
2. **Matching rules (the engine):** The query returns **4 to 6** listings (`take: 6`, hard cap) where every item: status is `ACTIVE` ONLY, `propertyType` equals the current listing's, `cityId` equals the current listing's, `askPrice` within ±20% of the current `askPrice` (`0.8 × price ≤ askPrice ≤ 1.2 × price`), and `id ≠ current listing id` (FR-18 Consequence: excludes the current listing and ALL non-active listings — `RESERVED`/`SOLD`/`ARCHIVED`/etc. are never shown).
3. **District preference, city fallback:** Same-`districtId` items are preferred; when fewer than the cap exist in the district, the remainder fills from same-city candidates. The section must never be empty simply because district supply is thin while city supply exists.
4. **Direct navigation:** Clicking any similar property card navigates directly to that listing's detail view (`/properties/{id}`) — reuse `PropertyCard` with `href`, do not build a bespoke click handler.
5. **Graceful absence/failure:** When the current listing is not `ACTIVE` (e.g. a seller/admin views a draft), the API returns `404 LISTING_NOT_FOUND` (same semantics as `getListingById`). When the engine returns 0 items, or the similar fetch fails, the detail page renders EXACTLY as Story 3.3 did — no section, no error, no layout shift. The similar listing is strictly supplementary; it must never break the detail screen.
6. **No regressions:** `getListingById`, `/listings/search`, `/listings/map`, the `/properties` list, split view, and the home feed are untouched behaviorally. Photos in similar cards are presigned (they come free via `toSummaryItems`).

## Tasks / Subtasks

- [x] **Shared constants** (`packages/shared/src/constants/listing.ts`) — AC: 2
  - [x] Add, in a new `// Similar Listings Engine Constants (Story 3.4 / FR-18)` block (same placement style as the Story 3.2 map block near the bottom): `SIMILAR_LISTINGS_MAX = 6`, `SIMILAR_LISTINGS_MIN = 4`, `SIMILAR_LISTINGS_PRICE_TOLERANCE = 0.2`. No new exports needed — `constants/index.ts` already re-exports `./listing`.
  - [x] Do NOT create a "minimum 4 else hide" rule in the API — the AC's 4–6 range describes expected density; the endpoint returns 0–6 actual matches and the UI renders whatever it gets.

- [x] **API — service method** (`apps/api/src/modules/listings/listings.service.ts`) — AC: 2, 3, 5
  - [x] Add `async getSimilarListings(id: string, requesterUserId?: string): Promise<{ items: ListingSummaryItem[] }>`. 
  - [x] Step 1: `this.prisma.listing.findUnique({ where: { id }, select: { id: true, status: true, propertyType: true, cityId: true, districtId: true, askPrice: true } })`. If `!listing` OR `listing.status !== ListingStatus.ACTIVE`, throw `new NotFoundException({ code: LISTING_NOT_FOUND, message: ... })` — mirror the exact shape at L763–768 (Arabic message style).
  - [x] Step 2: build the base `where`: `{ status: ListingStatus.ACTIVE, propertyType, cityId, id: { not: id }, askPrice: { gte: Number(askPrice) * (1 - SIMILAR_LISTINGS_PRICE_TOLERANCE), lte: Number(askPrice) * (1 + SIMILAR_LISTINGS_PRICE_TOLERANCE) } }`. `askPrice` is `Decimal(12,2)` — convert with `Number()` before the ±20% math, pass plain numbers into the Prisma filter (same as `searchListings` priceMin/Max).
  - [x] Step 3: query with `take: SIMILAR_LISTINGS_MAX`, `include: this.getPublicListingInclude()`, `orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]` (stable, matches search newest-first). First pass adds `districtId: listing.districtId`; if the result length is below the cap, run a second pass WITHOUT `districtId` but with `id: { notIn: [id, ...alreadyCollectedIds] }`, `take: remaining`, and concatenate (district matches first). If the first pass already fills 6, skip the second query entirely.
  - [x] Step 4: reuse `resolveFavoritedListingIds(requesterUserId, ids)` then `toSummaryItems(listings, favoritedIds)` — do NOT hand-roll a mapper. Return `{ items }`.

- [x] **API — controller endpoint** (`apps/api/src/modules/listings/listings.controller.ts`) — AC: 1, 5
  - [x] Add `@Get(':id/similar')` with `@HttpCode(HttpStatus.OK)` and `@Param('id', new ParseUUIDPipe()) id`. Place it next to `@Get(':id')` (~L202). `:id/similar` is a distinct 2-segment path, so relative order vs `@Get(':id')` does not matter, but keep static routes (`search`, `map`, `my`) before parameterized ones as they already are.
  - [x] Optionally extract the requester session like `getListingById` does (cookie `SESSION_COOKIE_NAME` → `prisma.session.findUnique` → `requesterUserId`) so `isFavorited` is correct for logged-in buyers. Do NOT extract admin session (no private data involved). Anonymous → no favorites, still 200.
  - [x] Respond wrapped, matching search/map convention: `return { statusCode: HttpStatus.OK, data: result };`

- [x] **Web — similar listings section** (`apps/web/src/components/listings/similar-listings-section.tsx`, NEW) — AC: 1, 4, 5
  - [x] `'use client'` component, props `{ listingId: string }` only — the ±20% band is computed server-side from the base listing's own `askPrice`; do not pass prices the client would have to keep in sync. `useEffect` fetch `apiClient.get<...>('/listings/' + listingId + '/similar')`; tolerate both bare and `{ statusCode, data }` envelopes (detail endpoint returns bare, search/map wrap — the new endpoint wraps, but reuse the tolerant-unwrap approach from `unwrapDetailResponse` in `listing-detail-view.tsx` so either shape renders).
  - [x] Render NOTHING while loading and NOTHING on empty/error (return `null`) — never a spinner slot, never an error card (AC#5: no layout shift, detail screen unchanged on failure).
  - [x] When items exist: section heading in Arabic (e.g. "عقارات مشابهة", styled like the existing `h2` " وصف العقار" treatment), then a horizontal scroll strip: `flex gap-4 overflow-x-auto pb-2` with each card wrapped in a fixed-width shrink-0 container (~`w-72 sm:w-80`). `dir="rtl"` inherited from the page — horizontal scroll works naturally in RTL; do not fight it with custom scroll math.
  - [x] Each item: `<PropertyCard listing={item} href={`/properties/${item.id}`} />`. Do NOT pass `onActionClick` (the `href` Link path handles navigation). Do NOT rebuild a card, do NOT add swipe/drag libraries — native overflow scroll only.
  - [x] Guard re-fetch on `listingId` change (the page component can remount per route, but keep the effect keyed on `listingId` anyway).

- [x] **Web — wire into detail view** (`apps/web/src/app/properties/[id]/listing-detail-view.tsx`, `page.tsx`) — AC: 1, 5, 6
  - [x] Render `<SimilarListingsSection listingId={detail.id} />` at the bottom of the primary column (`lg:col-span-2` block, after the description `Card`), full width inside the grid. No changes to `page.tsx` fetch logic; no props plumbing beyond what exists.
  - [x] Export the new component from `apps/web/src/components/listings/index.ts`.

- [x] **Tests** — AC: 2, 3, 4, 5, 6
  - [x] API (`apps/api/src/modules/listings/__tests__/listings.service.spec.ts`, extend): ACTIVE-only filter in where (assert `RESERVED`/non-active never requested), `id: { not }` exclusion, ±20% price bounds exact values (e.g. 3,000,000 → 2,400,000–3,600,000), take 6 cap, district-first then city-fallback merge (second query `notIn` already-collected), 404 for missing/non-active base listing, photos presigned via reused `toSummaryItems` (mock `storageService`), `isFavorited` flag propagation.
  - [x] API controller (optional if a controller spec pattern exists; otherwise service-level coverage suffices — match how 3.1/3.2 tested search/map).
  - [x] Shared: constants exist with correct values (`SIMILAR_LISTINGS_MAX = 6`, tolerance `0.2`).
  - [x] Web (`apps/web/src/app/properties/[id]/__tests__/listing-detail-page.spec.tsx` extend, plus a section spec if cleaner): mock `apiClient` — cards render from `{ items }` payload; each card links to `/properties/{id}`; 0 items → section absent; fetch rejects → detail content still fully rendered (AC#5); current listing id never appears among cards.
  - [x] Framework: **Jest + TS** (API), **vitest + TS** (web/shared) — match existing suites; reuse the established `vi.mock`/jest mock patterns of `listing-detail-page.spec.tsx` and `listings.service.spec.ts`. Do not introduce new test tooling.

## Dev Notes

### Scope boundaries (build ONLY this)
- **This story = the similar-listings query endpoint + the carousel section on the buyer detail screen.**
- **Do NOT build:** favorites UI beyond what `PropertyCard` already does (**3.5**); demand matching (**3.7** — it reuses similar attribute logic but is a different engine over `Demand`s); offer CTAs on similar cards (Epic 4); "because you viewed" personalization, similarity scoring, or vector search — not in the PRD; a separate `/similar` page.
- Keep the response as `ListingSummaryItem[]` — do NOT invent a `similarityScore` field; nothing in the PRD/UX defines one and the API would be lying.

### Critical implementation traps (read before coding)
- **🔴 ACTIVE only — not ACTIVE+RESERVED.** Search (3.1) and map (3.2) include `RESERVED`, but FR-18's Consequence is explicit: "Excludes the current listing and all non-active listings." A reserved property is not an alternative purchasing opportunity. Use `status: ListingStatus.ACTIVE` equality, not the `{ in: [...] }` form copy-pasted from `searchListings`.
- **Self-exclusion is easy to forget.** Prisma `where` on the candidates MUST include `id: { not: id }` — otherwise the current listing matches its own price band and appears in its own carousel. The city-fallback pass MUST also exclude already-collected ids (`notIn`) or cards duplicate.
- **Decimal math.** `askPrice` is `Decimal(12,2)`; `Number(listing.askPrice)` before computing ±20%. `searchListings` already passes plain numbers into `askPrice: { gte, lte }` — Prisma accepts that; do not pass `Decimal` objects or string-multiplied garbage.
- **The ±20% is a hard band, not "closest first."** FR-18 defines `|SimilarPrice − CurrentPrice| / CurrentPrice <= 0.20`. Do NOT implement nearest-price sorting or graduated widening — out of scope and unverifiable by the ACs.
- **Never break the detail screen.** The section fetch is fire-and-forget: failures resolve to "render nothing" (AC#5). Story 3.3's screen is under review — a regression there (thrown error, empty-state hijack, layout shift) fails BOTH stories.
- **Base listing 404 semantics.** The AC text says "an active listing detail page" — for non-ACTIVE base listings the endpoint returns 404 `LISTING_NOT_FOUND` (matching `getListingById`), and the UI simply hides the section. Do not return 200-with-empty-items for a suspended/archived base listing; a seller previewing their draft must not look "found" to logs while the ACs speak only of active pages. Keep it simple and consistent.
- **No new dependencies.** No swiper/embla/carousel npm packages. Overflow-x flex strip + existing `PropertyCard` is the whole feature.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** web never touches Prisma; fetches `/api/v1` via `apiClient`; types from `@elmasaif/shared`. Read-only endpoint — no mutation, no Server Action.
- **AD-8:** standard error envelope via existing global filter — throwing `NotFoundException({ code, message })` is the established pattern; do not hand-roll responses.
- **AD-9:** matching uses structured `cityId`/`districtId` FKs — never compare city/district names.
- **Consistency Conventions — Financial Values:** payload `askPrice` leaves as `Number(...)` inside `toSummaryItems` output like every other summary endpoint; client formats with `toLocaleString('en-US')`.
- **RTL-Native:** the strip lives inside the `dir="rtl"` detail view; headings and card content mirror automatically.
- **Stack:** NestJS 10.x + Prisma 5.x (API), Next.js 15 App Router + React 19 + Tailwind 3.4 (web), Zod 3.23 (shared). TypeScript strict everywhere.

### Anti-reinvention — reuse map (all already exist)
- `getPublicListingInclude()` (`listings.service.ts` ~L488) — city/district/public PHOTO/sellerRole/_count include; use as-is.
- `toSummaryItems()` (~L553) — presigned photos, Fal badge, favorite flag, counters; the EXACT mapper search uses. Similar cards get working images for free (3.3's presign lesson).
- `resolveFavoritedListingIds()` (~L532) — favorites flags for logged-in buyers.
- `buildSearchOrderBy`-style stable ordering: reuse `[{ createdAt: 'desc' }, { id: 'asc' }]` inline (do not call `buildSearchOrderBy` — it takes a sort token this endpoint doesn't have).
- `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`) — renders title link + action Link when `href` is passed (see `properties/page.tsx` L360 usage). Exactly the AC#4 navigation.
- `apiClient` + `ApiError` (`apps/web/src/lib/api-client.ts`); `ListingSummaryItem` (`packages/shared/src/types/listing.ts`).
- Session-cookie → `requesterUserId` extraction: copy the shape from `getListingById`/`searchListings` in the controller (L214–226).

### Performance note
- PRD NFR7 targets search p95 < 800 ms at 50k listings. The similar query filters `status + propertyType + cityId + askPrice range` with `take: 6`. A Prisma-level index is NOT required by any AC and schema migrations belong to Epic 0 artifacts — do not add one in this story. If a reviewer raises perf, `@@index([status, propertyType, cityId, askPrice])` is the documented future candidate; note it in the File List/Completion Notes only if observed slow.

### Current-state notes (files being touched)
- **`listings.service.ts` (UPDATE):** add `getSimilarListings` near the other public reads (after `getListingsForMap` / before `getPublicListingInclude` region). Everything else untouched.
- **`listings.controller.ts` (UPDATE):** new `@Get(':id/similar')` handler; existing route order and envelopes unchanged.
- **`listing-detail-view.tsx` (UPDATE):** Story 3.3 file (under review). Additive change only — mount the section after the description Card; do not restructure existing markup, helpers (`unwrapDetailResponse`, `toDetailError`), or test-ids.
- **`packages/shared/src/constants/listing.ts` (UPDATE):** append the 3 constants block; no redefinition of `PLATFORM_COMMISSION_RATE`-adjacent values.

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.4`] (ACs), `#Epic 3` (scope), `#Story 3.3` (detail screen host), `#Story 3.7` (demand matching — separate engine, do not conflate)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-18`] — the ±20% formula and the exclusion Consequence; `#FR-17` (host screen)
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1/AD-2/AD-8/AD-9`, Consistency Conventions]
- [Source: `_bmad-output/implementation-artifacts/3-3-listing-detail-screen-dynamic-commission-calculator.md`] — detail screen structure, envelope tolerance lesson, presign requirement, "don't fabricate fields" rule
- [Source: `_bmad-output/implementation-artifacts/3-1-multi-criteria-filter-search-pagination.md`] — `items` key, where-builder patterns, orderBy stability
- Code: `apps/api/src/modules/listings/{listings.service.ts#L338–604,L727–768,listings.controller.ts#L144–245}`; `apps/web/src/app/properties/[id]/{page.tsx,listing-detail-view.tsx}`; `apps/web/src/components/listings/{property-card.tsx,index.ts}`; `packages/shared/src/{constants/listing.ts,types/listing.ts}`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Shared constants** added at `packages/shared/src/constants/listing.ts` (`SIMILAR_LISTINGS_MAX=6`, `SIMILAR_LISTINGS_MIN=4`, `SIMILAR_LISTINGS_PRICE_TOLERANCE=0.2`); already re-exported via `constants/index.ts`.
- **API service** `getSimilarListings(id, requesterUserId?)` in `listings.service.ts` (inserted between `getListingsForMap` and `getPublicListingInclude`): throws `NotFoundException({ code: LISTING_NOT_FOUND })` with the Arabic `"العقار المطلوب برقم '<id>' غير موجود"` message shape when the base row is missing OR non-ACTIVE. `Number(listing.askPrice)` converts the `Decimal(12,2)` before the ±20% math; the base `where` uses `status: ListingStatus.ACTIVE` **equality** (never the search/map `{ in: [ACTIVE, RESERVED] }` form) plus `id: { not: id }` for self-exclusion. District pass runs first (`take: 6`); city-fallback pass only fires when the district is thin, filtering `id: { notIn: [baseId, ...alreadyCollected] }` and `take: remaining` — no duplicates, base listing never appears. If the district pass already fills 6, the second query is skipped entirely. Reuses `getPublicListingInclude()` + `resolveFavoritedListingIds()` + `toSummaryItems()` — photos come presigned via the shared mapper, matching the Story 3.3 presign lesson.
- **API controller** adds `@Get(':id/similar')` next to `@Get(':id')` with `@HttpCode(HttpStatus.OK)` and `ParseUUIDPipe`; extracts the user session cookie (`SESSION_COOKIE_NAME`) exactly like `getListingById` for `isFavorited` correctness, but intentionally skips admin session (no private data). Response wraps in `{ statusCode, data }` matching search/map convention.
- **Web `SimilarListingsSection`** (`'use client'`, only prop = `listingId`). Renders `null` while loading, on 0 items, or on fetch failure — no spinner slot, no error card, no layout shift (AC#5). Extracted a pure `SimilarListingsCarousel` presentational subcomponent and `unwrapSimilarPayload` helper so the fetch wrapper and the visual can be tested independently under `renderToString` (project test setup has no jsdom / RTL). Arabic heading `عقارات مشابهة`, horizontal scroll strip `flex gap-4 overflow-x-auto pb-2`, fixed-width `w-72 sm:w-80 shrink-0` card slots; RTL inherited from the page. Cards rendered as `<PropertyCard listing={item} href={`/properties/${item.id}`} />` — plain Next `Link` navigation (AC#4), no bespoke handler, no swipe/drag library.
- **Wire-in**: mounted after the description `Card` inside the `lg:col-span-2` primary column of `listing-detail-view.tsx`; no changes to `page.tsx` fetch logic or existing helpers (`unwrapDetailResponse`, `toDetailError`) or test-ids (AC#6 — Story 3.3 detail screen unchanged).
- **Exports**: `SimilarListingsSection` and its helpers now barrel-exported from `apps/web/src/components/listings/index.ts`.
- **Tests**: `packages/shared/src/constants/__tests__/listing-similar.spec.ts` (3 tests); `apps/api/src/modules/listings/__tests__/listings-similar.spec.ts` (12 tests, following the story-scoped pattern of `listings-search.spec.ts` / `listings-map.spec.ts` — service-level coverage matches how 3.1/3.2 tested search/map without a separate controller spec); `apps/web/src/components/listings/__tests__/similar-listings-section.spec.tsx` (9 tests). Full regression: 136/136 API-listings tests, 199/199 web tests, 273/273 shared tests pass.
- **Perf note** (per Dev Notes): PRD NFR7 (search p95 < 800 ms) — no `@@index` added in this story; schema migrations belong to Epic 0 artifacts and no AC requires an index. `@@index([status, propertyType, cityId, askPrice])` is the documented future candidate if a reviewer flags slow reads.

### File List

- `packages/shared/src/constants/listing.ts` (modified — added 3 similar-listings constants)
- `packages/shared/src/constants/__tests__/listing-similar.spec.ts` (new)
- `apps/api/src/modules/listings/listings.service.ts` (modified — added `getSimilarListings`)
- `apps/api/src/modules/listings/listings.controller.ts` (modified — added `@Get(':id/similar')`)
- `apps/api/src/modules/listings/__tests__/listings-similar.spec.ts` (new)
- `apps/web/src/components/listings/similar-listings-section.tsx` (new)
- `apps/web/src/components/listings/index.ts` (modified — barrel export)
- `apps/web/src/components/listings/__tests__/similar-listings-section.spec.tsx` (new)
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` (modified — mount section after description Card)

## Change Log

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-04 | Amelia (dev-story) | Implemented Story 3.4 Similar Listings Engine — shared constants, API `getSimilarListings` + `@Get(':id/similar')` endpoint, Web `SimilarListingsSection` carousel wired into `listing-detail-view.tsx`, and 24 new tests across shared/api/web. Full listings regression: 136/136 API + 199/199 web + 273/273 shared pass. Status → review. |
