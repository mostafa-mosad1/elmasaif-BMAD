---
baseline_commit: review-state-3-4
---

# Story 3.5: Buyer Favorites Collection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **authenticated buyer**,
I want to **save favorite properties to a dedicated bookmarks collection**,
so that I can **track properties of interest and monitor status changes over time.**

## Acceptance Criteria

1. **Toggle from any card (exists — verify, don't rebuild):** The authenticated buyer clicks the heart on any `PropertyCard` → `POST /api/v1/listings/:id/favorite` (already implemented in Story 2.7 with `SessionAuthGuard`, optimistic UI + rollback in `property-card.tsx`). This story only ensures the 100-cap error path degrades correctly through that existing flow (revert to previous state; no crash).
2. **Toggle from the detail page:** The listing detail screen (`/properties/[id]`, Story 3.3) gains a prominent favorite button reflecting `detail.isFavorited` (the field is ALREADY returned by `getListingById` — L862–874 of `listings.service.ts`). Clicking toggles via the same `POST /listings/:id/favorite`; anonymous clickers get the same login-confirm + redirect flow `PropertyCard.handleFavoriteClick` uses (L117–129).
3. **Favorites collection page:** Navigating to `/app/buyer/favorites` (sidebar link already exists in `workspace-shell.tsx` L77 and buyer dashboard stat card already links there — both currently 404) displays ALL saved properties as `PropertyCard`s via a new `GET /api/v1/listings/favorites` (authenticated, `SessionAuthGuard`), newest-saved first, up to the 100 cap. Un-favoriting from this page removes the card in place.
4. **Maximum 100 favorites (server-enforced):** Adding a favorite when the user already has 100 is rejected: `ConflictException` (409) with code `FAVORITES_LIMIT_REACHED` and Arabic message. Enforced INSIDE the existing `toggleFavorite` transaction — count check before `listingFavorite.create`.
5. **Dynamic status badges:** Each favorites row joins to the LIVE listing row every load, so a saved property that transitioned to `RESERVED`, `SOLD`, `ARCHIVED` (or any non-`ACTIVE` status) renders its current status badge on the card. Badge must come from `ListingStatusBadge` (covers every status via `LISTING_STATUS_LABELS_AR`), NOT only `PropertyCard`'s built-in RESERVED/SOLD overlays.
6. **No regressions:** Search/map/similar/home/detail screens, `toggleFavorite` response shape (`{ isFavorited, totalFavorites }`), `Listing.totalFavorites` increment/decrement, and `ListingDailyMetric.favoriteAdds` upsert are all behaviorally untouched. The existing analytics-dashboard "bookmark totals" (Story 2.7) keeps working.

## Tasks / Subtasks

- [x] **Shared constants** (`packages/shared/src/constants/listing.ts`) — AC: 4
  - [x] Add to the error-code block at the top (next to `LISTING_NOT_FOUND`): `export const FAVORITES_LIMIT_REACHED = 'FAVORITES_LIMIT_REACHED';` and a favorites block near the bottom (same style as the Story 3.2 map / 3.4 similar blocks): `export const MAX_FAVORITES_PER_USER = 100;`. `constants/index.ts` already re-exports `./listing` — no barrel edit.
  - [x] **After adding exports, rebuild the shared dist before ANY apps/api test run:** `cd packages/shared && npx tsc` (Jest resolves `@elmasaif/shared` from compiled dist — stale dist = missing-export compile failure).

- [x] **API — cap check in toggle** (`apps/api/src/modules/listings/listings.service.ts`, `toggleFavorite` ~L1662–1745) — AC: 4, 6
  - [x] Inside the existing `this.prisma.$transaction` `else` (create) branch, BEFORE `tx.listingFavorite.create`: `const count = await tx.listingFavorite.count({ where: { userId } });` — if `count >= MAX_FAVORITES_PER_USER` throw `new ConflictException({ code: FAVORITES_LIMIT_REACHED, message: 'لقد بلغت الحد الأقصى للمفضلة (100 عقار). إزالة عقار آخر للإضافة.' })`. Same structured-exception shape as the `ConflictException` usages at L1069/L1203. Throwing inside the interactive tx rolls back — that is the desired atomicity.
  - [x] Un-favorite path, `totalFavorites` math, and `favoriteAdds` metric: DO NOT touch.
  - [x] **Expected collateral edit:** `apps/api/src/modules/listings/__tests__/listings-analytics.spec.ts` `describe('toggleFavorite')` mocks `tx` as the flat `prisma` mock — the create-path tests now hit `listingFavorite.count` (undefined fn → TypeError). Add `listingFavorite: { ..., count: jest.fn().mockResolvedValue(0) }` (or per-test `mockResolvedValueOnce`) to those fixtures. This is a mock-completion, NOT a behavior change.

- [x] **API — favorites list service** (`listings.service.ts`, new `getBuyerFavorites(userId: string)`) — AC: 3, 5
  - [x] `const favorites = await this.prisma.listingFavorite.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { listingId: 'asc' }], include: { listing: { include: this.getPublicListingInclude() } } });` — one query, NO status filter on the joined listing (AC#5 requires RESERVED/SOLD/ARCHIVED rows to come back with their live status).
  - [x] Map: `const listings = favorites.map((f: any) => f.listing).filter(Boolean);` (cascade delete makes nulls impossible in practice; defensive filter costs one line). Favorited ids set: `new Set(listings.map((l: any) => l.id))` so every item gets `isFavorited: true` — then `const items = await this.toSummaryItems(listings, favoritedIds)`. Return `{ items }`. Photos come presigned for free through `toSummaryItems` (Story 3.3/3.4 presign lesson — do not hand-roll a mapper).
  - [x] No pagination: the cap is 100 and the AC has no paging requirement.

- [x] **API — controller endpoint** (`apps/api/src/modules/listings/listings.controller.ts`) — AC: 3, 6
  - [x] `@Get('favorites')` + `@HttpCode(HttpStatus.OK)` + `@UseGuards(SessionAuthGuard)` + `@ApiBearerAuth()`, handler `const result = await this.listingsService.getBuyerFavorites(req.user.id); return { statusCode: HttpStatus.OK, data: result };` (envelope matches search/map/similar).
  - [x] **🔴 Route order:** declare it with the other static routes (`search` L144, `my` L173, `map` L186) BEFORE `@Get(':id')` (L202). `favorites` placed after `:id` would be swallowed by `ParseUUIDPipe` → 400 on a valid route.
  - [x] Anonymous → guard's 401 (standard envelope). No optional-session fallback needed: favorites are inherently per-user; the web surface is already login-gated.

- [x] **Web — detail favorite button** (`apps/web/src/components/listings/listing-favorite-button.tsx`, NEW) — AC: 2, 4
  - [x] `'use client'`. Props: `{ listingId: string; initialFavorited: boolean; initialTotalFavorites?: number }`. Owns local state (seed from props), `useState` + `useEffect` resync on `listingId`/props change (mirrors `property-card.tsx` L54–63 idiom).
  - [x] Click: try `useAuth()` in the same defensive shape PropertyCard uses (L46–52); anonymous → `window.confirm('يرجى تسجيل الدخول أو إنشاء حساب لإضافة العقار إلى قائمة المفضلة.')` then `/auth/login?redirect=<pathname>` — reuse the exact Arabic copy. Authenticated → optimistic flip, `apiClient.post<{ data: { isFavorited: boolean; totalFavorites: number } }>(`/listings/${listingId}/favorite`)`, settle from `response.data`, on `ApiError` revert + if `err.code === FAVORITES_LIMIT_REACHED` show a small inline notice under the button (Arabic message from the error; auto-hide via timeout like `preferences-editor.tsx` toast pattern) — generic failure just reverts silently as PropertyCard does.
  - [x] Visual: circular `Heart` button identical to PropertyCard's treatment (L246–259: `w-8 h-8 rounded-full`, filled red when favorited, same `aria-label` Arabic strings `إضافة إلى المفضلة` / `إزالة من المفضلة`), `data-testid="listing-favorite-button"`.
  - [x] Wire into `apps/web/src/app/properties/[id]/listing-detail-view.tsx`: render as the second flex child inside the identity `Card` header row (`flex flex-wrap items-start justify-between gap-3`, ~L191) so it sits opposite the title in RTL. Pass `detail.id`, `detail.isFavorited`, `detail.totalFavorites`. Additive only — do not restructure existing markup/helpers/test-ids; `page.tsx` untouched.
  - [x] Export from `apps/web/src/components/listings/index.ts` (barrel).

- [x] **Web — favorites page + view** — AC: 3, 4, 5
  - [x] `apps/web/src/components/listings/buyer-favorites-view.tsx` (NEW, `'use client'`): container fetches `apiClient.get('/listings/favorites')` in `useEffect`, tolerates BOTH bare `{ items }` and `{ statusCode, data: { items } }` via a pure exported `unwrapFavoritesPayload(payload)` helper (same lesson as `unwrapSimilarPayload`/`unwrapDetailResponse` — the endpoint wraps, but the helper keeps the view honest). State: `loading` (pulse skeleton row), `error` (`EmptyState` with retry action), `items`.
  - [x] Pure presentational subcomponent exported for SSR tests: `FavoritesGrid({ items, onRemove })` — grid `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` (verbatim from the `properties` results grid, `properties/page.tsx` L353). Each cell: `<PropertyCard listing={item} href={`/properties/${item.id}`} onFavoriteToggle={() => onRemove(item.id)} />` — passing `onFavoriteToggle` overrides the card's built-in POST so the page owns removal: handler POSTs `/listings/{id}/favorite`, and when the response says `isFavorited === false` removes the item from local state (guard: if a non-toggle result ever arrives, do not remove). On `FAVORITES_LIMIT_REACHED`/error from a remove attempt: revert is implicit (item stays); show the inline banner.
  - [x] Non-`ACTIVE` badge overlay inside the grid cell: wrap the card in `relative`; when `listing.status !== ListingStatus.ACTIVE` render `<div className="absolute top-3 left-3 z-10"><ListingStatusBadge status={listing.status} /></div>`. Physical `left-3` = the free side (heart sits `bottom-3 left-3`, status/fal badges occupy top-`end` via `topRightSlot`) in every direction. `data-testid="favorite-status-badge"`.
  - [x] Page shell `apps/web/src/app/app/buyer/favorites/page.tsx` (NEW): thin `'use client'` wrapper — `export default function BuyerFavoritesPage() { return <BuyerFavoritesView />; }`. Auth/redirect is ALREADY handled by `app/app/layout.tsx` (pushes `/auth/login?redirect=/app` when no user); sidebar link + heading live in `WorkspaceShell`. Header inside the view: `<h1>العقارات المفضلة</h1>` + saved count + cap hint (e.g. `{count} من أصل 100 الحد الأقصى`). Empty state: `EmptyState` (title `لا توجد عقارات مفضلة بعد`, icon `Heart`, actionLabel `تصفح العقارات`, actionHref `/properties`).
  - [x] **🔴 Architecture invariant:** route `page.tsx` files must expose ONLY the default export — keep every helper/test-visible piece in the component file, never re-exported from `page.tsx`.
  - [x] Export `BuyerFavoritesView`, `FavoritesGrid`, `unwrapFavoritesPayload` from `components/listings/index.ts`.

- [x] **Web — buyer dashboard live count** (`apps/web/src/app/app/buyer/page.tsx`) — AC: 3
  - [x] The `العقارات المفضلة` stat card (L33–39) hardcodes `count: 0`. Add a `favoritesCount` state: `useEffect` → `apiClient.get('/listings/favorites')`, unwrap, `setFavoritesCount(items.length)`; `.catch(() => {})` silently keeps 0 (dashboard must never break on favorites failure). Use it in the stats array. Offers/Demands cards stay hardcoded — Epic 4/3.6 own them.

- [x] **Tests** — AC: all
  - [x] Shared (vitest): constants assert `MAX_FAVORITES_PER_USER === 100`, `FAVORITES_LIMIT_REACHED === 'FAVORITES_LIMIT_REACHED'` (extend the existing constants spec style).
  - [x] API (jest, NEW `apps/api/src/modules/listings/__tests__/listings-favorites.spec.ts`, story-scoped like `listings-similar.spec.ts`): `getBuyerFavorites` — findMany shape (userId where, createdAt-desc + listingId-asc orderBy, listing include), NO status filter in the where, every item `isFavorited: true`, `items` mapped through `toSummaryItems` (mock `storageService.getPresignedDownloadUrl` → presigned photos), empty favorites → `{ items: [] }`. `toggleFavorite` — count 100 → `ConflictException` with `FAVORITES_LIMIT_REACHED` code AND `listingFavorite.create`/`listing.update`/`listingDailyMetric.upsert` never called; count 99 → creates normally. Fix the three pre-existing `listings-analytics.spec.ts` toggleFavorite mocks (add `count`).
  - [x] Web (vitest, NEW `apps/web/src/components/listings/__tests__/buyer-favorites.spec.tsx` — put specs under `components/listings/__tests__/`, NOT co-located in the route dir, to dodge the known `[id]/__tests__` relative-import mis-resolution pitfall): `unwrapFavoritesPayload` bare vs enveloped vs null; `FavoritesGrid` via `renderToString` — cards render from items, `favorite-status-badge` present for RESERVED/SOLD/ARCHIVED items and absent for ACTIVE, empty → no cards. `listing-favorite-button` — `renderToString` with `initialFavorited` true renders filled-heart `aria-label="إزالة من المفضلة"` and the testid. Interaction tests are out: the web suite has no jsdom/RTL (established constraint).
  - [x] Frameworks: jest for API, vitest for web/shared (`npx vitest run` in the package; `npx jest` in apps/api). No new test tooling, no carousel/interaction libraries.

## Dev Notes

### Scope boundaries (build ONLY this)
- **This story = 100-cap enforcement on the existing toggle, a favorites-list read endpoint, the `/app/buyer/favorites` page, a detail-page favorite button, and the dashboard count wire-in.**
- **Do NOT build:** notifications/price-drop alerts for favorited listings (not in PRD — FR-20 is bookmark-only); favorites sync, folders, tags, or notes; "similar to your favorites" anything (3.4 is listing-scoped); demands (3.6/3.7); offers on cards (Epic 4); pagination for favorites (capped at 100 by design); a `similarityScore`-style invented field on the response — `items` is exactly `ListingSummaryItem[]`; toasts infrastructure (none exists — inline notice pattern is `preferences-editor.tsx`).
- **Do NOT modify `getListingById`'s public 404 for ARCHIVED/SUSPENDED/BLOCKED** (L881–893). Consequence to ACCEPT: clicking a card for an archived favorite lands on the existing "لم نتمكن من العثور على هذا العقار" screen — correct, already-specified shielding behavior. The favorites page itself still lists it with its badge (AC#5).

### Critical implementation traps (read before coding)
- **🔴 Nest route shadowing:** `@Get('favorites')` MUST be declared before `@Get(':id')` in `listings.controller.ts`, or `ParseUUIDPipe` rejects `'favorites'` with 400. Place it right after `@Get('my')` (L173–184), keep guards identical to `my`.
- **🔴 Stale shared dist:** new exports in `packages/shared` are invisible to apps/api Jest until `npx tsc` rebuilds `packages/shared`. Rebuild BEFORE running any API test that imports `FAVORITES_LIMIT_REACHED`/`MAX_FAVORITES_PER_USER` (bit Story 3.4; symptom is a missing-export compile error, not an assertion failure).
- **Pre-existing toggle tests WILL break** the moment `count` is consulted: `listings-analytics.spec.ts` mocks `tx` as the flat prisma object and does not stub `listingFavorite.count`. Update those fixtures (count → under-limit) as part of the change; if they pass unchanged you have not wired the check into the tx.
- **The cap check belongs INSIDE the transaction, on the create branch only.** Un-favoriting must work when the user is at 100 (removal is never blocked). Do not count inside the delete branch.
- **Favorites rows never filter by listing status.** `resolveFavoritedListingIds` and search's `{ in: [ACTIVE, RESERVED] }` patterns are irrelevant here — a SOLD/ARCHIVED favorite must still appear (AC#5). Do NOT copy the ACTIVE-equality trap from 3.4 either; there is no status `where` at all.
- **`isFavorited` on every item is `true` by definition** — build the id Set from the joined listing ids rather than calling `resolveFavoritedListingIds` again (it would re-query what you just joined).
- **PropertyCard is shared by 6+ surfaces.** The favorites page may only use its EXISTING props (`href`, `onFavoriteToggle`, `isFavorited`); the status overlay lives OUTSIDE the card in the grid cell wrapper. Touching `property-card.tsx` is forbidden unless a genuine blocker surfaces — and then it must keep every existing prop behavior (search/map/home/similar specs are the tripwire).
- **ClockService, not `new Date()`** (AD-11): the favorite row `createdAt` already uses `this.clockService.now()` in `toggleFavorite` — keep it; the favorites read only orders by the stored column.
- **Response envelope:** `GET /listings/favorites` returns `{ statusCode, data: { items } }` (controller wrap) — same as similar/search/map; `POST :id/favorite` stays `{ statusCode, message, data: { isFavorited, totalFavorites } }` — PropertyCard's `response?.data` consumption (L145–147) depends on it. Do not "tidy" either shape.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** web never touches Prisma; fetches `/api/v1` via `apiClient` (same-origin proxy keeps the HttpOnly session cookie); types/constants from `@elmasaif/shared`. Mutations only via the existing explicit action endpoint `POST /listings/:id/favorite` (AD-8 semantic-action rule already satisfied); no Server Actions, no generic PATCH.
- **AD-8:** throw structured exceptions (`ConflictException({ code, message })`) — the global filter produces `{ code, message, details, requestId }`. Favorites toggles are non-financial: no `Idempotency-Key`, no `If-Match` version check (listing `version` is not bumped by favoriting today — keep it that way).
- **AD-5:** `SessionAuthGuard` (user realm) is the correct guard; admins have no favorites. The `/app` layout already client-gates; the 401 path covers cookie expiry mid-session.
- **AD-11:** all timestamps via `ClockService.now()`.
- **Consistency Conventions:** `askPrice` leaves as `Number(...)` inside `toSummaryItems`; Arabic UI copy RTL-native (`dir="rtl"` inherited), LTR numerals via existing card formatting — the new page adds zero bespoke formatting.
- **Stack:** NestJS 10.x + Prisma 5.x, Next.js 15 App Router + React 19 + Tailwind 3.4, Zod 3.23, TypeScript strict. **No new dependencies** (Step-4 web research: nothing version-sensitive beyond these pins; Lucide `Heart` already installed).

### Reuse map (all already exist — do not rebuild)
- `toggleFavorite` service + `POST :id/favorite` (`listings.service.ts` L1662+, `listings.controller.ts` L374+) — the ENTIRE write path; only the cap is added.
- `ListingFavorite` model (`apps/api/prisma/schema.prisma` L412–425): `@@unique([userId, listingId])`, cascade FKs, `@@index([userId])` — no schema change, no migration.
- `getPublicListingInclude()` (~L580) + `toSummaryItems()` (~L645) — include + presigned-photo mapper used by search/map/similar.
- `PropertyCard` (`components/listings/property-card.tsx`) — heart button, anonymous login-confirm, optimistic POST already live; `href` Link navigation.
- `ListingStatusBadge` (`components/listings/listing-status-badge.tsx`) — full status coverage via `LISTING_STATUS_LABELS_AR`.
- `EmptyState`, `Card`, `Badge`, `Button` (`components/ui`); `apiClient` + `ApiError` (`.code` carries `FAVORITES_LIMIT_REACHED`); `useAuth` (`components/providers/auth-provider.tsx`).
- `app/app/layout.tsx` auth gate + `workspace-shell.tsx` buyer nav (`/app/buyer/favorites` link, L77) — already wired; the story just makes the target exist.
- Session pattern reference for guard-free optional reads is NOT needed here — this endpoint is guarded (`SessionAuthGuard` like `@Get('my')`).

### Current-state notes (files being touched)
- **`listings.service.ts` (UPDATE):** `toggleFavorite` gains the in-tx count guard; `getBuyerFavorites` added near `getMyListings`/`getSimilarListings` region. Today: tx does findUnique → delete/create + totalFavorites + metric upsert. Must preserve: response shape, metric behavior, `ClockService` timestamps.
- **`listings.controller.ts` (UPDATE):** one new guarded `@Get('favorites')` before `:id`; everything else untouched.
- **`listings-analytics.spec.ts` (UPDATE):** add `listingFavorite.count` stub to the toggleFavorite fixtures (mock completion only).
- **`packages/shared/src/constants/listing.ts` (UPDATE):** append code + block; no redefinition of similar/map constants.
- **`listing-detail-view.tsx` (UPDATE):** additive render of `ListingFavoriteButton` in the identity card header row; helpers (`unwrapDetailResponse`, `toDetailError`, `resolveCta`) and existing test-ids untouched. `page.tsx` NOT touched.
- **`app/app/buyer/page.tsx` (UPDATE):** favorites stat count becomes state-backed via one guarded fetch, silent-failure.
- **NEW:** `listing-favorite-button.tsx`, `buyer-favorites-view.tsx`, `app/app/buyer/favorites/page.tsx`, `components/listings/__tests__/buyer-favorites.spec.tsx`, `__tests__/listings-favorites.spec.ts`.
- **`components/listings/index.ts` (UPDATE):** barrel exports for the three new components/helpers.

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.5`] ACs; `#Epic 3` (bookmark scope); `#Story 3.3` (detail host screen); `#Story 2.7` (toggle + totalFavorites/favoriteAdds already shipped)
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-20`] — "bookmark up to 100 favorite listings … dedicated favorites screen"; Consequence: Sold/Archived/Reserved show updated badges in the favorites view
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-5, AD-8, AD-11`, Consistency Conventions]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Authenticated User Workspaces`] — buyer dashboard surfaces "saved favorite properties"
- [Source: `_bmad-output/implementation-artifacts/3-4-similar-listings-engine.md`] — envelope-tolerant unwrap + pure-presentational split for renderToString tests; presign-via-mapper; story-scoped spec file pattern
- [Source: `_bmad-output/implementation-artifacts/3-3-listing-detail-screen-dynamic-commission-calculator.md`] — detail screen structure and additive-only rule
- Code: `apps/api/src/modules/listings/{listings.service.ts#L580–690,L819–1025,L1662–1745, listings.controller.ts#L173–201,L374–393}`; `apps/api/prisma/schema.prisma#L412–425`; `apps/web/src/components/listings/{property-card.tsx#L46–154,L246–259, listing-status-badge.tsx, index.ts}`; `apps/web/src/app/app/{layout.tsx, buyer/page.tsx#L25–47}`; `apps/web/src/components/layout/workspace-shell.tsx#L72–80`; `apps/web/src/lib/api-client.ts`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented Story 3.5 end-to-end: server-enforced 100-favorites cap, `GET /api/v1/listings/favorites`, `/app/buyer/favorites` collection page, detail-page favorite button, and live dashboard count — reusing the existing `toggleFavorite` write path untouched.
- Shared: added `FAVORITES_LIMIT_REACHED` + `MAX_FAVORITES_PER_USER = 100`; rebuilt `packages/shared` dist (`npx tsc`) before API test runs to avoid stale-dist missing-export failures.
- API: cap check placed INSIDE the `toggleFavorite` `$transaction` create branch only (count-before-create; removal path never blocked); throwing `ConflictException({ code, message })` rolls the tx back. `getBuyerFavorites` joins the LIVE listing with NO status filter so RESERVED/SOLD/ARCHIVED rows surface their current badge, maps through the shared `toSummaryItems` (presigned photos for free), and derives `isFavorited` from the joined id set. Controller `@Get('favorites')` declared before `@Get(':id')` with `SessionAuthGuard`, same `{ statusCode, data }` envelope as search/map/similar.
- Web: `ListingFavoriteButton` mirrors `PropertyCard.handleFavoriteClick` (optimistic + rollback, anonymous login-confirm/redirect, Arabic copy reused verbatim) and adds the 100-cap inline auto-hiding notice. `buyer-favorites-view` splits fetch container from pure `FavoritesGrid` (envelope-tolerant `unwrapFavoritesPayload` accepts `unknown`), status badge overlaid OUTSIDE the card so `property-card.tsx` stays untouched. Route `page.tsx` exposes ONLY the default export.
- Tests: NEW API `listings-favorites.spec.ts`, NEW shared `listing-favorites.spec.ts`, NEW web `buyer-favorites.spec.tsx` (renderToString); fixed the three pre-existing `listings-analytics.spec.ts` toggleFavorite fixtures by adding `listingFavorite.count`. Full suites green: API 48 suites, web 208 tests, shared 275 tests. API `tsc --noEmit` clean; no new errors in touched web files.

### File List

- `packages/shared/src/constants/listing.ts` (modified)
- `packages/shared/src/constants/__tests__/listing-favorites.spec.ts` (new)
- `apps/api/src/modules/listings/listings.service.ts` (modified)
- `apps/api/src/modules/listings/listings.controller.ts` (modified)
- `apps/api/src/modules/listings/__tests__/listings-favorites.spec.ts` (new)
- `apps/api/src/modules/listings/__tests__/listings-analytics.spec.ts` (modified — mock completion)
- `apps/web/src/components/listings/listing-favorite-button.tsx` (new)
- `apps/web/src/components/listings/buyer-favorites-view.tsx` (new)
- `apps/web/src/components/listings/index.ts` (modified)
- `apps/web/src/components/listings/__tests__/buyer-favorites.spec.tsx` (new)
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` (modified — additive)
- `apps/web/src/app/app/buyer/page.tsx` (modified)
- `apps/web/src/app/app/buyer/favorites/page.tsx` (new)

## Change Log

- 11-04-2026: Implemented Story 3.5 (Buyer Favorites Collection) — 100-cap enforcement, favorites list endpoint + service, `/app/buyer/favorites` page, detail favorite button, live dashboard count. All tasks/subtasks complete; regression suites pass. Status → review.
