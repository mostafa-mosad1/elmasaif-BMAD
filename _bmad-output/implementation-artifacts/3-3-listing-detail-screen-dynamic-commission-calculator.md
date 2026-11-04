---
baseline_commit: review-state-3-2
---

# Story 3.3: Listing Detail Screen & Dynamic Commission Calculator

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **buyer inspecting a property**,
I want to **view the full property details, photo gallery, specifications, and a dynamic breakdown of the platform commission**,
so that I can **understand the complete financial commitment while the seller's direct contact remains shielded.**

## Acceptance Criteria

1. **Detail route renders:** Given a buyer navigates to the listing detail (real app path `/properties/[id]` — the epic's `/listings/:id` is illustrative), when the screen loads, it fetches `GET /api/v1/listings/:id` via `apiClient` and renders: high-resolution media gallery, title, description, full specifications, location (District, City), ask price, and Fal-verified seller badge.
2. **Photos actually load for buyers (end-to-end):** The gallery displays the listing's PUBLIC `PHOTO` documents with working images. Because `getListingById` currently returns raw stored keys for the public/buyer branch, the API MUST presign public photo URLs (≤ 300 s) for every requester (not only owner/admin) — mirror `toSummaryItems`. Without this the gallery is broken and the story is NOT complete.
3. **Dynamic commission calculator widget:** A dedicated widget displays three derived figures from the listing's `askPrice`: **Ask Price**, **Estimated Platform Commission** = `askPrice × PLATFORM_COMMISSION_RATE` (0.025 → 2.5%), and **Estimated Total** = ask price + commission. Values recompute from the fetched price (no hardcoded numbers) and format with `toLocaleString('en-US')` + `ر.س`/`SAR`, matching the existing `PropertyCard` formula.
4. **Contact-shielding callout:** A prominent institutional callout states that the seller's direct phone and email remain strictly shielded until deal completion. The UI MUST NOT render `mobileNumber`, `email`, or `nationalId` (the API already omits these for non-owner/admin requesters — do not reintroduce them).
5. **Reserved-state CTA:** A listing with status `RESERVED` shows a "عرض احتياطي (Backup Offer)" call-to-action instead of a primary "تقديم عرض (Submit Offer)" action. `ACTIVE` shows the primary offer CTA. The buttons route/queue the intent only — real offer submission and its backend belong to Epic 4 (Story 4.1). Do NOT build offer endpoints here.
6. **No regressions:** `GET /api/v1/listings/:id` keeps serving the existing owner (`/app/marketer`, `/app/owner`) and admin moderation consumers unchanged — the `canViewPrivate` branch (payout IBAN, price suggestions, AdminOnly docs, direct contact) must remain intact. `/properties` list and map (3.1/3.2) and the home feed are unaffected.
7. **Not-found / hidden state:** If the API returns `404` (`LISTING_NOT_FOUND` — non-existent, or `ARCHIVED`/`SUSPENDED`/`BLOCKED` for unauthorized viewers), render a structured empty/error state, not a crash.

## Tasks / Subtasks

- [x] **API — presign public photos for buyers** (`apps/api/src/modules/listings/listings.service.ts`, `getListingById`) — AC: 2, 6
  - [x] In the `!canViewPrivate` branch (currently ~L804–809, filters docs to `DocumentVisibility.PUBLIC` but returns raw `fileUrl`), map the returned PUBLIC `PHOTO` documents through `this.storageService.getPresignedDownloadUrl(doc.fileUrl, 300)` (try/catch falls back to raw `fileUrl`), exactly like `toSummaryItems` (~L560–573). Non-photo PUBLIC docs may stay as-is; AdminOnly docs remain excluded for this branch.
  - [x] Do NOT change the `canViewPrivate` branch behavior (already presigns all docs) — regression guard for seller/admin consumers.
  - [x] Keep the response shape (keys `photos`, `documents`, `askPrice: Number(...)`, `sellerProfile` sanitized) identical so existing callers still compile.

- [x] **Shared type for the detail response** (`packages/shared/src/types/listing.ts`) — AC: 1, 3
  - [x] Add and export a `ListingDetailItem` interface describing the `getListingById` public response consumed by the web screen: `id, title, description, propertyType, cityName, districtName, streetName?, latitude, longitude, askPrice: number, areaSquareMeters, bedrooms: number | null, yearBuilt: number | null, status: ListingStatus, sellerProfile: { id; role; user: { id; fullName; username } } | null, isFalVerified: boolean, photos: Array<{ id; fileUrl; mimeType }>, documents: Array<{ id; fileUrl; mimeType; documentType; visibility }>, totalViews, totalFavorites, isFavorited, offersCount, createdAt, updatedAt`. Mark seller private fields (`payoutIban`, `priceSuggestions`) as optional/absent for the buyer view.
  - [x] Reuse existing `ListingStatus`, `PropertyType` enums. Export from the package index. Do NOT add a commission field to the type — the calculator derives it client-side.
  - [x] Do NOT redefine `PLATFORM_COMMISSION_RATE` — import it from `packages/shared/src/constants/listing.ts` (already `0.025`).

- [x] **Web — detail page & components** (`apps/web/src/app/properties/[id]/`) — AC: 1, 3, 4, 5, 7
  - [x] Create `page.tsx` at `apps/web/src/app/properties/[id]/page.tsx`. Since data fetch is client-side via `apiClient`, make it a `'use client'` component wrapped in `LayoutShell` (match `/properties/page.tsx` pattern — no route groups exist in this app). Read the id from `useParams()`.
  - [x] Fetch `apiClient.get<{ statusCode: number; data: ListingDetailItem }>('/listings/' + id)`; render skeleton/loading while pending; render `EmptyState`-style not-found card when the request throws `ApiError` with `status === 404`.
  - [x] **Gallery:** reuse `PropertyMediaCarousel` (`apps/web/src/components/listings/property-media-carousel.tsx`) with `photos={detail.photos.map(p => p.fileUrl)}`, `alt={detail.title}`, `propertyType={detail.propertyType}`. Do NOT rebuild a carousel.
  - [x] **Specs:** display `PROPERTY_TYPE_LABELS_AR[propertyType]`, area `m²`, `bedrooms` (only when non-null), `yearBuilt` (only when non-null), location `District, City`, description. **Bathrooms and amenities do NOT exist in the data model — do not render or fabricate them.**
  - [x] **Broker badge:** reuse the Fal-verified badge treatment (check icon + label) driven by `detail.isFalVerified` / `sellerProfile.role === MARKETER`, consistent with `PropertyCard`. **Star rating does NOT exist yet (broker reviews are Epic 6) — do not fabricate a rating; omit it or show a neutral "التقييم قريباً".**
  - [x] **Commission widget:** create `commission-calculator.tsx` (`'use client'`) inside `apps/web/src/components/listings/`. Props `{ askPrice: number }`. Compute `commission = askPrice * PLATFORM_COMMISSION_RATE`, `total = askPrice + commission`. Render three rows (Ask Price / Estimated Platform Commission (2.5%) / Estimated Total) in a bordered card using `{colors.surface-*}`, `font-mono` on numbers, `rounded.lg`. Use `Math.round`/`toLocaleString('en-US')`. Reference the identical formula already at `property-card.tsx` ~L157–159.
  - [x] **Shielding callout:** create a small static `contact-shielding-callout.tsx` (or inline block) with an institutional shield/lock icon and Arabic microcopy, e.g. "تبقى بيانات التواصل المباشرة للبائع (الجوال والبريد) محجوبة تماماً عبر المنصة ولا تُكشف إلا بعد إتمام الصفقة." — tone per EXPERIENCE.md Voice & Tone (no emojis, authoritative).
  - [x] **CTA buttons:** render primary offer button for `ACTIVE`, backup-offer button for `RESERVED` (labels per AC#5). Wire them to `Link`/handler stubs only (e.g. route to `/auth/login?redirect=...` when unauthenticated, or a disabled/coming-soon state) — do NOT POST to any offer endpoint (Epic 4).
  - [x] Optionally reuse `ListingStatusBadge` for the RESERVED/ACTIVE badge.

- [x] **Tests** — AC: 1, 2, 3, 4, 5, 6, 7
  - [x] API: extend `apps/api/src/modules/listings/__tests__/` (e.g. `listings.service.spec.ts`) — assert a PUBLIC photo doc for a buyer/public requester comes back with a presigned `fileUrl` (mock `storageService.getPresignedDownloadUrl`); assert AdminOnly docs and seller `mobileNumber`/`email`/`payoutIban` stay absent for a buyer; assert the `canViewPrivate` (owner/admin) response is unchanged (regression).
  - [x] Web: `apps/web/src/app/properties/[id]/__tests__/listing-detail-page.spec.tsx` — mock `apiClient`; assert gallery, specs, and calculator render; assert commission math (e.g. askPrice 3,100,000 → commission 77,500 → total 3,177,500, per PRD Journey 1); assert shielding callout present and no phone/email in DOM; assert `RESERVED` shows backup-offer label vs `ACTIVE` shows submit-offer; assert 404 → not-found state (mirror existing `properties-search-page.spec.tsx` mocking style).
  - [x] Framework: **vitest + TS** (web/shared), **Jest + TS** (API) — match existing suites.

## Dev Notes

### Scope boundaries (build ONLY this)
- **This story = the buyer-facing listing detail screen + commission calculator + contact-shielding presentation on `/properties/[id]`.**
- **Do NOT build:** similar-listings carousel (**3.4**); favorites collection page (**3.5**); demand submission (**3.6/3.7**); the actual Offer/Backup-Offer submission, negotiation, and endpoints (**Epic 4 / Story 4.1**); broker star ratings & moderated reviews (**Epic 6**); dynamic admin-configurable commission (**Story 8.6**). CTAs and rating slots are presentation-only here.

### Critical implementation traps (read before coding)
- **🔴 Photos are NOT presigned for buyers today.** In `getListingById` the `!canViewPrivate` branch filters to PUBLIC docs but returns the raw `fileUrl` (storage key), while `toSummaryItems` (home feed/search) DOES presign. If you skip Task 1 the gallery shows broken images and the feature is not actually working — this is a required end-to-end fix, not optional polish. Presign with the same 300 s expiry and try/catch fallback.
- **No `amenities`, no `bathrooms`, no rating in the schema.** `Listing` (schema.prisma L340–393) has only `title, description, propertyType, areaSquareMeters, bedrooms (Int?), yearBuilt (Int?), askPrice, lat/lng, status`. EXPERIENCE.md mentions "amenities" and "rating" aspirationally; they are not backed by data. **Never invent fields or hardcode fake values** — omit unsupported sections or mark them "قريباً".
- **Contact is already sanitized server-side.** `getListingById` (L830–849) strips `mobileNumber`, `email`, `nationalId` for non-owner/admin. The frontend must simply not re-add them and must surface the shielding callout. Do not expose contact "for convenience".
- **Commission is a client-side derived estimate, 2.5% only.** AC#3 and PRD Journey 1 (SAR 3,100,000 → SAR 77,500 = exactly ×0.025) define a pure percentage estimate. EXPERIENCE.md's "2.5% + fixed fee" wording refers to the Deal dual-payment stage (Epic 5), not this calculator — do NOT add a fixed fee here. Reuse `PLATFORM_COMMISSION_RATE` (0.025); there is also `PLATFORM_COMMISSION_PERCENTAGE` (0.025) in `constants/index.ts` — prefer the one already imported by `PropertyCard` for consistency.
- **Route path reality.** The epic/AC says `/listings/:id`; the actual app already links cards and map popups to `/properties/[id]` (`page.tsx` L360, `map-popup-card.tsx`). Build the page at `apps/web/src/app/properties/[id]/page.tsx`. There are NO Next.js route groups in this repo — do not introduce `(public)`.

### Architecture compliance (MUST follow — ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** `apps/web` never touches Prisma/DB and never imports `apps/api`; it calls the API via `lib/api-client.ts` (`credentials: 'include'`, base `/api/v1`) and shares types from `@elmasaif/shared`. No Server Action mutations. The detail screen is a read.
- **AD-8:** Errors arrive as the global envelope `{ code, message, details, requestId }`; `apiClient` already throws `ApiError` with `.status`/`.code`. Handle 404 via that, don't hand-roll shapes.
- **Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 3.4.x.
- **RTL-Native:** root is `dir="rtl" lang="ar"`. Layout, callout, and calculator must mirror correctly; keep institutional elevation.
- **Money:** `askPrice` is `Decimal(12,2)`; the API returns `Number(listing.askPrice)`. Do the ×0.025 math in JS on that number; format with `toLocaleString('en-US')`.
- **Validation/copy language:** user-facing strings are Arabic. Match existing tone (notary-precise, no emojis).

### Anti-reinvention — reuse map (all already exist)
- `PropertyMediaCarousel` (`apps/web/src/components/listings/property-media-carousel.tsx`) — 16:9 photo carousel; use for the gallery.
- `ListingStatusBadge` (`apps/web/src/components/listings/listing-status-badge.tsx`) — status pill (ACTIVE/RESERVED).
- `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`) — reference for the Fal badge treatment and the exact commission formula (L157–159) and price formatting.
- `Card, Badge, Button, EmptyState` from `apps/web/src/components/ui`; `LayoutShell` from `apps/web/src/components/layout`.
- `apiClient.get<T>()` (`apps/web/src/lib/api-client.ts`) + `ApiError` for the fetch and 404 handling.
- `PROPERTY_TYPE_LABELS_AR`, `PLATFORM_COMMISSION_RATE` from `@elmasaif/shared`.
- API `getListingById` (`listings.service.ts` L727) + controller `@Get(':id')` (`listings.controller.ts` L202, already extracts optional user + admin session and passes `requesterIsAdmin`) — **extend the service mapper only; do not add a new endpoint.**

### Current-state notes (files being touched)
- **`listings.service.ts#getListingById` (UPDATE):** Today returns a rich detail object (city, district, photos, documents, sanitized seller, price suggestions for private viewers, counters). Its ONLY buyer-view gap is un-presigned public photos. Everything else (contact stripping, AdminOnly exclusion, hidden-state 404) already works — preserve it.
- **`apps/web/src/app/properties/[id]/page.tsx` (NEW):** does not exist yet (owned by this story; 3.1/3.2 deliberately left it unbuilt).
- **`packages/shared/src/types/listing.ts` (UPDATE):** add `ListingDetailItem`; keep existing `ListingSummaryItem`, `SearchListingsResponse`, `MapListingItem` untouched.

### Data shape returned by `GET /api/v1/listings/:id` (public/buyer view) — for the web type
`{ id, title, description, propertyType, cityId, districtId, cityName, districtName, streetName, latitude, longitude, askPrice:number, areaSquareMeters, bedrooms, yearBuilt, status, sellerProfileId, sellerProfile:{ id, userId, role, user:{ id, fullName, username } }, version, photos:[{id,fileUrl,mimeType,documentType,visibility}], documents:[…], totalViews, totalImpressions, totalFavorites, isFavorited, offersCount, createdAt, updatedAt }`. Private viewers additionally get `payoutIban`, `activePriceSuggestion`, `priceSuggestions` and full `user` contact — absent for buyers.

### Testing standards
- Mirror existing suites: `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` (Prisma + `storageService` mocked), and `apps/web/src/app/properties/__tests__/properties-search-page.spec.tsx` (mock `apiClient`, `renderToString`/RTL). Reuse the established `vi.mock`/Jest mock patterns — do not introduce new test tooling.
- Keep prior listing specs green (regression guard on `getListingById` consumers).

### References
- `_bmad-output/planning-artifacts/epics.md#Story 3.3` (AC), `#Epic 3` (scope), `#Story 3.4/3.5` (deferred), `#Story 4.1` (offers), `#Story 8.6` (dynamic commission), `#Story 6.5` (broker reviews/rating)
- `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-17`/`FR-18` (detail + 2.5% commission + contact shielding), Journey 1 (SAR 77,500 example)
- `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md` (Property Detail surface, §Voice & Tone shielding microcopy, Journey 1 calculator figures) and `DESIGN.md` (surface/rounded tokens, emerald primary, font-mono numbers)
- `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1/AD-2/AD-8/AD-9`, Consistency Conventions (Money, Error Format)
- Code: `apps/api/src/modules/listings/{listings.service.ts#L727,getListingById;L488–600;#toSummaryItems presign,listings.controller.ts#L202}`; `apps/api/prisma/schema.prisma#Listing L340–393`, `#PropertyDocument L447–463`; `apps/web/src/components/listings/{property-card.tsx#L157,property-media-carousel.tsx,listing-status-badge.tsx}`; `apps/web/src/app/properties/page.tsx#L360`; `apps/web/src/lib/api-client.ts`; `packages/shared/src/{types/listing.ts,constants/listing.ts#L62}`
- Previous stories: `_bmad-output/implementation-artifacts/3-1-*.md`, `3-2-*.md` (route ordering, `items` key, presign pattern, `/properties/[id]` deferred to this story, no route groups, Arabic validation strings)

## Dev Agent Record

### Agent Model Used

Qoder AI Agent

### Debug Log References

- `npx jest src/modules/listings` — RED first confirmed 2 failing assertions on the un-presigned buyer branch, GREEN after the fix; 124 listing tests pass, full API suite 456/456.
- Live `curl http://localhost:4000/api/v1/listings/<id>` as an anonymous requester returned raw storage keys before Task 1 and presigned `/storage/raw?key=…` URLs after — the AC#2 end-to-end proof.
- Browser verification of `/properties/<id>`: gallery images report `naturalWidth 1376` (all three photos fetch), calculator shows 7,500,000 / 187,500 / 7,687,500, and no phone/email/nationalId or `tel:`/`mailto:` nodes exist in the DOM although the API payload carries the seller phone. A non-existent id renders the not-found state; only benign `auth/me` 401 in console.
- Three cosmetic defects found by that browser pass and fixed: `yearBuilt` was rendered with a thousands separator (`1,995`), price/currency spacing, and duplicate accessibility labels in the specs strip (`sr-only` term plus a visible label) — the strip now uses plain `div`/`span` like `PropertyCard`.
- `npx tsc --noEmit` in `apps/web` still reports pre-existing failures in unrelated files (admin/geo `typedRoutes`, `properties/page.tsx`, `design-tokens.spec`, `api-client.spec`, `property-card.tsx` `ref`); none reference the Story 3.3 files.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **AC#2 (the required end-to-end fix):** `getListingById` now presigns PUBLIC `PHOTO` documents with the same 300 s expiry and the same try/catch → raw-key fallback as `toSummaryItems`. Non-photo PUBLIC docs keep their raw key, AdminOnly docs stay excluded, and the `canViewPrivate` branch is byte-for-byte untouched (regression test asserts its presigned shape).
- **Deviation — response envelope:** the story text prescribed `apiClient.get<{ statusCode: number; data: ListingDetailItem }>`. The detail endpoint actually answers with the **bare** object (unlike `/listings/search` and `/listings/map`). Rather than changing an endpoint that owner/admin consumers already use (AC#6 forbids that), the client reads `ListingDetailItem` and passes it through a new `unwrapDetailResponse()` helper that tolerates both shapes, with a unit test for each.
- **Deviation — `isFalVerified`:** the task list asked for a required `isFalVerified: boolean`, but `getListingById` does not return such a field and the Dev Notes data shape confirms it. Adding it to the type would have been a lie the API never fills, so it is optional in `ListingDetailItem` and the UI derives verification from `sellerProfile.role === UserRole.MARKETER` via `isSellerFalVerified()` (the same treatment `PropertyCard` uses).
- **No fixed fee in the calculator:** per the Dev Notes, EXPERIENCE.md's "2.5% + fixed fee" belongs to the Epic 5 deal stage. `calculateCommission` is a pure `PLATFORM_COMMISSION_RATE` (0.025) derivation imported from shared — single source of truth, no redefinition.
- **Structure:** the route keeps a default export only (Next typedRoutes requirement, mirroring Story 3.2's `properties-split-view.tsx`); view markup, presentation helpers (`formatDetailNumber`, `resolveCta`, `toDetailError`, `unwrapDetailResponse`) and prop types live in `listing-detail-view.tsx`, and the two new widgets are exported from `components/listings/index.ts`.
- **Failure states:** replaced a boolean `notFound` prop with a discriminated `error?: 'not-found' | 'failed'` plus an `ERROR_COPY` map, so a 500 does not render "not found" copy (AC#7).
- **Nothing fabricated:** no bathrooms, no amenities, no star rating. Bedroom/year blocks render only when non-null, and the seller rating slot shows a neutral "التقييم قريباً" (marked with `data-testid="seller-rating-placeholder"` for Epic 6 to replace).
- **CTA is intent-only:** unauthenticated buyers route to `/auth/login?redirect=…`; authenticated buyers get a queued-interest notice. No offer endpoint is called or created (Epic 4 boundary respected).
- **Test totals:** 6 new API tests + 20 new web tests. Full regression: 190 web (41 files), 456 API (46 suites), 270 shared (22 files) — zero regressions; ESLint clean on every new/changed web file.

### File List

- `apps/api/src/modules/listings/listings.service.ts` — MODIFIED (presign PUBLIC photos in the `!canViewPrivate` branch of `getListingById`)
- `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` — MODIFIED (+6 `getListingById` tests: presigning, fallback, privacy, admin regression)
- `packages/shared/src/types/listing.ts` — MODIFIED (added exported `ListingDetailItem`)
- `apps/web/src/components/listings/commission-calculator.tsx` — NEW (`formatSar`, `calculateCommission`, `CommissionCalculator`)
- `apps/web/src/components/listings/contact-shielding-callout.tsx` — NEW (`ContactShieldingCallout`)
- `apps/web/src/components/listings/index.ts` — MODIFIED (re-exports the two new widgets)
- `apps/web/src/app/properties/[id]/page.tsx` — NEW (default-export-only route: fetch, auth-aware CTA handler, `LayoutShell`)
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` — NEW (view, presentation helpers, structured error states)
- `apps/web/src/app/properties/[id]/__tests__/listing-detail-page.spec.tsx` — NEW (20 tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (3-3 status transitions)
- `_bmad-output/implementation-artifacts/3-3-listing-detail-screen-dynamic-commission-calculator.md` — MODIFIED (this record)
- `apps/web/tsconfig.tsbuildinfo` — MODIFIED (generated incremental-build artifact, checked in by the repo)

## Change Log

| Date | Change |
|------|--------|
| 2026-11-04 | Story 3.3 implemented: API presigns public photos for buyers (AC#2), shared `ListingDetailItem`, `/properties/[id]` detail screen with reusable carousel, dynamic 2.5% commission calculator, contact-shielding callout, RESERVED/ACTIVE intent-only CTAs, structured 404/failed states, 26 new tests, full regression green. |
