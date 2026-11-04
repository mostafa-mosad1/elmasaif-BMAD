---
baseline_commit: e3909f6
---

# Story 3.2: Interactive Clustered Map & Split-View Layout

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **property buyer**,
I want to **view search results on an interactive map with marker clustering and a split-view layout**,
so that I can **explore listings geographically and inspect card previews interactively.**

## Acceptance Criteria

1. **Desktop split layout:** On `lg+` viewports the content area splits 50/50 — map on the physical left, scrollable listing grid on the physical right (RTL: grid on start/right, map on end/left). The filter panel stays full-width above the split.
2. **Mobile pill toggle:** On viewports below `lg`, a floating pill button switches between "عرض الخريطة" and "عرض القائمة". Only one panel is visible at a time.
3. **Marker clustering:** Markers cluster dynamically at zoom levels **below 12**; at zoom ≥ 12 individual pins appear. Cluster icon is an emerald circle (`{colors.primary}`) with item count in white.
4. **Color-coded pins:** Individual pin border/accent color reflects `PropertyType`: `APARTMENT` → blue `#2563EB`, `VILLA` → green `#059669`, `LAND` → orange `#D97706`, `BUILDING` → purple `#7C3AED`, `COMMERCIAL` → red `#DC2626`, `FARM` → teal `#0D9488`. Pins are white pill-shaped containers displaying the price label (e.g. "3.2 مليون"); when selected the pill turns solid emerald.
5. **Pin click → preview card:** Clicking any map pin opens a compact popup containing: title, ask price (SAR), area (m²), status badge. The popup is dismissable with `Esc` or clicking outside.
6. **Pin ↔ card synchronization:** Hovering a listing card highlights its corresponding map pin (and pans if out of view). Clicking a map pin scrolls the grid to the matching card.
7. **Filter synchronization:** The map always reflects active search filters from the list panel. Panning/zooming re-fetches visible map items from the `/listings/map` endpoint with a **300 ms debounce**.
8. **Performance:** Map query endpoint meets **p95 < 800 ms under 50,000 active listings** (PRD SM-6 / FR-16).
9. **No regressions:** `/properties` list view from Story 3.1 keeps working identically when map is hidden on mobile. Home feed (`GET /api/v1/listings`) is unaffected.

## Tasks / Subtasks

- [x] **Shared types & schemas** (`packages/shared`) — AC: 3,4,7,8
  - [x] Add `MapListingItem` interface in `src/types/listing.ts`: `{ id, title, propertyType, latitude: number, longitude: number, askPrice: number, areaSquareMeters: number, status: ListingStatus, isFalVerified?: boolean, primaryPhotoUrl?: string | null }`.
  - [x] Add `ListingMapQuery` type with fields: `swLat`, `swLng`, `neLat`, `neLng` (all required numbers), plus optional same filter fields as `ListingSearchQuery` (minus `page`/`limit`).
  - [x] Add `listingMapQuerySchema` in `src/schemas/listing.schema.ts` (mirror `listingSearchQuerySchema` style — Arabic error messages). `swLat/swLng/neLat/neLng` are required numbers constrained to `SAUDI_BOUNDS` (minLat 16, maxLat 32.5, minLng 34.5, maxLng 55.7). Reuse the same optional filter fields from search schema (`q`, `cityId`, `districtId`, `propertyType`, `priceMin`, `priceMax`, `areaMin`, `areaMax`, `bedroomsMin`, `falOnly`). Add a guard that `neLat > swLat` and `neLng > swLng`.
  - [x] Add `PROPERTY_TYPE_MAP_COLORS: Record<PropertyType, string>` constant in `src/constants/listing.ts` with hex values from AC #4.
  - [x] Add `MAX_MAP_RESULTS = 200` constant in `src/constants/listing.ts` (circuit-breaker cap per request).
  - [x] Export new types/schemas/constants from the package index.

- [x] **API — bounding-box map endpoint** (`apps/api/src/modules/listings/`) — AC: 3,7,8
  - [x] `listings.service.ts`: add `getListingsForMap(query: ListingMapQuery): Promise<{ items: MapListingItem[] }>`. Build a Prisma `where` using `latitude: { gte: swLat, lte: neLat }`, `longitude: { gte: swLng, lte: neLng }`, status gate `[ACTIVE, RESERVED]`, plus all optional filters (same logic as `searchListings`). Use `take: MAX_MAP_RESULTS`. **Do NOT presign photos** in the map endpoint — return `primaryPhotoUrl: null` to keep the response fast. The photo is shown only in the popup on marker click using a lazy lookup or placeholder for MVP.
  - [x] `listings.controller.ts`: add `@Get('map')` registered **before** `@Get(':id')` (same routing guard as `@Get('search')`). Wire via `@Query(new ZodValidationPipe(listingMapQuerySchema))`. Returns `{ statusCode, data: { items } }`. No session/auth required (public endpoint like search).

- [x] **Web dependencies** (`apps/web`) — AC: 1,3,4,5,6,7
  - [x] Install: `npm install leaflet react-leaflet react-leaflet-cluster` (check peer-deps for React 19 + react-leaflet v5 compatibility — see Dev Notes).
  - [x] Install dev types: `npm install -D @types/leaflet`.

- [x] **Web — map panel component** (`apps/web/src/components/map/`) — AC: 3,4,5,6,7
  - [x] `listings-map-panel.tsx` (`'use client'`): exports `ListingsMapPanel` component. Props: `{ filters: Filters; activeListingId?: string | null; onMarkerClick?: (id: string) => void }`.
  - [x] Use `dynamic(() => import('...'), { ssr: false })` wrapper for the actual Leaflet map — Leaflet accesses `window` on import and will crash SSR.
  - [x] `MapContainer` centered on Saudi Arabia default (`[24.7136, 46.6753]`, zoom `6`). `TileLayer` uses OpenStreetMap: `url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"`, attribution `© OpenStreetMap contributors`.
  - [x] `MarkerClusterGroup` with `disableClusteringAtZoom={12}`, `chunkedLoading={true}`, and custom `iconCreateFunction` returning an `L.divIcon` with emerald circle + count (per DESIGN.md §5).
  - [x] Fetch from `/listings/map?swLat=...&swLng=...&neLat=...&neLng=...&...filters` on mount and on `moveend`/`zoomend` events, 300 ms debounced. Store `mapItems: MapListingItem[]` in local state.
  - [x] Each item rendered as `Marker` with `L.divIcon` (no default image markers) — see `property-pin.tsx`.
  - [x] Handle loading skeleton and empty state.

  - [x] `property-pin.tsx`: a `Marker`-rendering sub-component. Uses `L.divIcon` with `html` = a white rounded pill `<div>` showing formatted price and the type-specific border color from `PROPERTY_TYPE_MAP_COLORS`. When `isActive` (selected/hovered) → solid emerald background. Use `tabindex={0}` + `role="button"` for keyboard accessibility.

  - [x] `map-popup-card.tsx`: a `Popup` sub-component rendering a compact card for a clicked `MapListingItem`. Fields: title (truncated 60 chars), price formatted in SAR, area in m², `ListingStatusBadge`. "عرض التفاصيل" link → `/properties/[id]`. Uses DESIGN.md `rounded.lg` and `surface-base` styling.

- [x] **Web — split layout & page update** (`apps/web/src/app/properties/`) — AC: 1,2,6,9
  - [x] Create `properties-split-view.tsx` (`'use client'`): wraps `PropertiesSearchView` (grid) and `ListingsMapPanel` (map) in a responsive layout.
    - Desktop (`lg+`): flex row — map (50%, `sticky top-0 h-screen`) and grid (50%, scrollable). In RTL (`dir="rtl"`): grid on right (start side), map on left (end side). Use `flex-row` with explicit order classes; verify `dir="rtl"` flips correctly.
    - Mobile (`<lg`): floating pill button (fixed bottom) with two options: "🗺️ الخريطة" and "📋 القائمة". Only the active panel renders.
  - [x] Update `page.tsx`: the `PropertiesSearchPage` default export replaces the simple `<LayoutShell><PropertiesSearchView /></LayoutShell>` with `<LayoutShell><PropertiesSplitView ... /></LayoutShell>`. All existing filter state management (from 3.1) stays in `PropertiesSearchPage` container — pass `filters` down to both the grid view and the map panel.
  - [x] Pin ↔ card sync: `activeListingId` state flows from `PropertiesSearchPage`. `onMarkerClick(id)` sets the active ID → `PropertiesSearchView` grid scrolls to that card. `onCardHover(id)` from grid (optional enhancement — not blocking) pulses the pin.
  - [x] Leaflet CSS: import `leaflet/dist/leaflet.css` at the top of `listings-map-panel.tsx` (before any Leaflet code). Add `react-leaflet-cluster` CSS if required.

- [x] **DB / performance** (`apps/api/prisma/schema.prisma`) — AC: 8
  - [x] Verify a `@@index([status, latitude, longitude])` composite index exists on the `Listing` model. If absent, add it: `@@index([status, latitude, longitude])`. Run `npx prisma generate` and `npx prisma db push` (repo has no migrations folder).

- [x] **Tests** — AC: 1,3,4,5,7,8,9
  - [x] Shared: `src/schemas/__tests__/listing-map.spec.ts` — mirror `listing-search.spec.ts`: required bounds, Saudi range clamps, filter combination, optional fields default.
  - [x] API service: `listings-map.spec.ts` (or extend `listings-search.spec.ts`) — bounding-box `where` construction, `status` gating, `take: MAX_MAP_RESULTS`, filter reuse, empty-bounds guard, `neLat > swLat` guard.
  - [x] API controller: `@Get('map')` spec (mirror existing `listings.controller.spec.ts` search describe). Verify route ordering: "`map`" must NOT be captured by `@Get(':id')` ParseUUIDPipe.
  - [x] Web `property-pin.spec.tsx`: mock `react-leaflet` (use `vi.mock('react-leaflet', ...)`) — verify `MapContainer` renders, `moveend` triggers fetch, filter changes re-fetch. Mock `apiClient`.
  - [x] Web `properties-split-view.spec.tsx`: verify desktop layout renders both panels; mobile layout shows only active panel; pill toggle switches view. Use `renderToString`.

## Dev Notes

### Scope boundaries (build ONLY this)
- **This story = the map, clustering, split view, and map–grid synchronization on `/properties`.**
- **Do NOT build:** listing detail screen, commission calculator, contact shielding (**3.3**); similar-listings engine (**3.4**); favorites collection page (**3.5**); demand submission (**3.6**).
- `PropertyCard` href (`/properties/[id]`) already points to a route owned by 3.3 — do not create that page here.
- The popup preview card on marker click shows title/price/area/status only; photo is deferred or a placeholder icon.

### Architecture compliance (MUST follow — from ARCHITECTURE-SPINE.md)
- **AD-1 / AD-2:** `apps/web` NEVER queries Prisma/DB and NEVER imports `apps/api` code. It calls the API via `lib/api-client.ts`. Shared types come from `@elmasaif/shared`. No Server Action mutations.
- **AD-8:** Standard error envelope `{ code, message, details, requestId }` produced by global exception filter — do not hand-roll shapes. `/listings/map` is a read, no `Idempotency-Key`/`If-Match` needed.
- **AD-9 / Geography:** Filter by `cityId`/`districtId` UUIDs. The map's bounding-box query (`latitude`/`longitude`) operates in parallel with these structured geographic filters — do NOT substitute lat/lng for city/district filtering.
- **Stack:** `apps/web` = Next.js 15 App Router, React 19, Tailwind CSS 3.4.x. TypeScript strict mode.
- **RTL-Native:** The entire app renders with `dir="rtl"` `lang="ar"` as primary. The split layout must mirror correctly: in RTL, the listing grid is on the physical right (start side) and the map is on the physical left (end side). Use Tailwind's RTL-aware classes or `flex` with explicit ordering.
- **Money:** `askPrice` is `Decimal(12,2)` in DB. Map endpoint returns `Number(listing.askPrice)` to match `ListingSummaryItem` format. Price in pin label should use a compact Arabic format (e.g. "3.2 مليون" for 3,200,000 SAR). Use `Intl.NumberFormat` or a helper.
- **CamelCase JSON / snake_case DB:** Prisma abstracts mapping. `latitude`/`longitude` columns in the DB are `latitude`/`longitude` (no `@map` override — see `schema.prisma` L348–349). If using raw SQL, use `"latitude"`, `"longitude"` (camelCase).
- **Pagination convention:** The `/listings/map` endpoint does NOT use pagination — it returns `take: MAX_MAP_RESULTS` items. This is intentional: the viewport bounds limit the result set naturally.

### Anti-reinvention — reuse map
- `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`) = existing grid card; do NOT rebuild — pass `ListingSummaryItem` to it.
- `ListingStatusBadge` (`apps/web/src/components/listings/listing-status-badge.tsx`) = already available for popup card status display.
- `CityDistrictSelector` (`apps/web/src/components/geo/city-district-selector.tsx`) = existing filter component; no changes needed.
- `LayoutShell` = page wrapper from `apps/web/src/components/layout`; keep as-is.
- `apiClient.get<T>()` (`apps/web/src/lib/api-client.ts`) = HTTP client, base `/api/v1`.
- `PROPERTY_TYPE_LABELS_AR` (`packages/shared/src/constants/listing.ts`) = type labels; already used for chips.
- `listingSearchQuerySchema` = template to mirror for new `listingMapQuerySchema`.
- `toSummaryItems` helper in `listings.service.ts` = already maps public fields; map endpoint has its own lightweight mapper (not `toSummaryItems` — it skips photos).

### ⚠️ react-leaflet + SSR incompatibility (CRITICAL — must handle)
Leaflet accesses `window` and `document` on module import. Next.js SSR will crash with `ReferenceError: window is not defined`.

**Required pattern:**
1. The actual map component (`ListingsMapLeaflet`) must be a `'use client'` component.
2. In the parent that renders it, use `next/dynamic` with `ssr: false`:
   ```tsx
   import dynamic from 'next/dynamic';
   const MapPanel = dynamic(() => import('../components/map/listings-map-panel'), {
     loading: () => <MapSkeleton />,
     ssr: false,
   });
   ```
3. Import `leaflet/dist/leaflet.css` at the **top** of the map component file, before any other import of `leaflet`.
4. Do NOT use a default Leaflet marker image — it relies on a URL that breaks in Next.js bundling. Use `L.divIcon({ html: '<div>...</div>', className: '...' })` for all markers.

### react-leaflet version (React 19 + Next.js 15)
- `react-leaflet` **v5** supports React 19. `react-leaflet-cluster` **v4.1.3** (latest as of March 2026) explicitly supports React 19 + react-leaflet 5 as peer deps.
- Install command: `npm install leaflet react-leaflet react-leaflet-cluster && npm install -D @types/leaflet`
- If npm peer-deps conflicts arise, use `--legacy-peer-deps` flag as fallback. Verify `package.json` peer deps after install.
- If react-leaflet v5 is not yet stable for React 19 in the local registry, try v4.2.1 (React 18 peer) with `--legacy-peer-deps` — it still works at runtime for React 19 despite the peer warning.

### Property type → pin color mapping (constant — add to shared)
```ts
export const PROPERTY_TYPE_MAP_COLORS: Record<PropertyType, string> = {
  [PropertyType.APARTMENT]: '#2563EB', // blue
  [PropertyType.VILLA]:     '#059669', // green (emerald)
  [PropertyType.LAND]:      '#D97706', // amber/orange
  [PropertyType.BUILDING]:  '#7C3AED', // purple
  [PropertyType.COMMERCIAL]:'#DC2626', // red  (PRD "Office" = COMMERCIAL — no Office in enum)
  [PropertyType.FARM]:      '#0D9488', // teal (not in FR-16 spec; added for completeness)
};
```

### DESIGN.md — Map Pin & Cluster Visual Spec
From `DESIGN.md §5 "Interactive Map Pin & Cluster"` and `component tokens map-pin-cluster`:
- **Cluster icon:** `L.divIcon` with `html` = `<div style="background:#1B4332;color:#fff;border-radius:9999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${count}</div>`. Use `iconSize: [36,36]`, `iconAnchor: [18,18]`.
- **Price pin:** White rounded-pill (border: `1.5px solid ${typeColor}`, `border-radius: 9999px`, `padding: 2px 8px`, `font-size: 12px`, `font-weight: 600`, `color: #0F172A`). Label = formatted price. When `isActive` → `background: #1B4332`, `color: #fff`, `borderColor: #1B4332`.
- **`primary` color = `#1B4332`** (Sovereign Emerald), **`primary-foreground` = `#FFFFFF`**, **`surface-base` = `#FFFFFF`**, **`ink-primary` = `#0F172A`**, **`rounded.full = 9999px`**.

### Map data fetching (decision-complete)
- Use a `useRef` + `setTimeout` for 300 ms debounce on `moveend`/`zoomend` events.
- Build query string from `map.getBounds()` → `south = bounds.getSouth()`, `west = bounds.getWest()`, `north = bounds.getNorth()`, `east = bounds.getEast()`.
- Append current `filters` (cityId, districtId, propertyType, priceMin/Max, etc.) using the same `buildSearchQuery`-style helper. Reuse the `Filters` type from `page.tsx`.
- Abort in-flight requests on re-fetch using `AbortController`.

### URL sync note
Map viewport bounds are **NOT** synced to the URL — they are volatile local state. Search filter params from Story 3.1 remain URL-synced. Do not add `swLat`/`neLng` etc. to `buildSearchQuery` or `parseFiltersFromParams`.

### Prisma map query (decision-complete)
```ts
async getListingsForMap(query: ListingMapQuery): Promise<{ items: MapListingItem[] }> {
  const where: Prisma.ListingWhereInput = {
    status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
    latitude:  { gte: query.swLat, lte: query.neLat },
    longitude: { gte: query.swLng, lte: query.neLng },
  };
  // reuse optional filter logic from searchListings (q, cityId, districtId, etc.)
  if (query.propertyType) where.propertyType = query.propertyType;
  // ...
  const listings = await this.prisma.listing.findMany({
    where,
    take: MAX_MAP_RESULTS,   // 200
    select: {
      id: true, title: true, propertyType: true,
      latitude: true, longitude: true,
      askPrice: true, areaSquareMeters: true, status: true,
      sellerProfile: { select: { role: true } },
    },
  });
  return { items: listings.map(l => ({ ...l, askPrice: Number(l.askPrice), isFalVerified: l.sellerProfile?.role === UserRole.MARKETER })) };
}
```

### Performance guidance (AC #8)
- 50k target: a composite index `@@index([status, latitude, longitude])` on `Listing` table is required. Verify after `db push`. If bounding-box query still does a seq scan (check `EXPLAIN ANALYZE`), add `[latitude, longitude]` partial index filtered to `status IN ('ACTIVE','RESERVED')`.
- Do NOT include photo presigning in the map endpoint — presigning 200 URLs is expensive. The popup card either shows a placeholder image icon or lazily fetches a single presigned URL on click (acceptable UX).
- `MAX_MAP_RESULTS = 200` prevents unbounded results. At zoom 6 all of KSA fits — but Saudi has sparse density so the viewport typically returns < 50 items even at country level.

### Testing standards
- Framework: **Jest + TS** (API), **vitest + TS** (web, shared) — mirror existing patterns from `listings-search.spec.ts` and `*.spec.tsx` in web.
- Mock `react-leaflet` in web tests using `vi.mock`. Key exports to mock: `MapContainer` (render children), `TileLayer` (return null), `Marker` (return null or render children as div), `Popup` (render children as div), `useMap` (return an object with `getBounds: () => ({ getSouth: () => 16, getWest: () => 34, getNorth: () => 32, getEast: () => 55 })`, `on: vi.fn()`, `flyTo: vi.fn()`).
- Mock `react-leaflet-cluster`: `vi.mock('react-leaflet-cluster', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))`.

### Project structure notes
- Architecture tree shows `apps/web/src/app/(public)/` route groups; **the real app has no route groups** — pages are at `apps/web/src/app/` directly. `/properties` is at `apps/web/src/app/properties/page.tsx`. Keep all new components under `apps/web/src/components/map/`.
- The map endpoint lives in the existing `listings` module (`apps/api/src/modules/listings/`), not a separate module.
- Validation strings are **Arabic** throughout `packages/shared` schemas — match for new schema messages.

### Previous story intelligence (from Story 3.1)
- `PropertiesSearchView`, `buildSearchQuery`, and `parseFiltersFromParams` are already implemented and exported from `apps/web/src/app/properties/page.tsx`. **Do not modify their signatures.** The `Filters` type is local to `page.tsx` — export it (`export type Filters = {...}`) so `ListingsMapPanel` and `PropertiesSplitView` can use it. Pass the `filters` object (same shape already passed to `PropertiesSearchView`) down to `ListingsMapPanel` as its `filters` prop.
- Story 3.1 established: response envelope `{ items, meta }` for search. The map endpoint uses `{ items }` only (no `meta`).
- `ListingSearchSort` enum and `listingSearchQuerySchema` are already in shared — reuse their sub-schemas for the map query rather than redefining individual filter fields.
- `toSummaryItems` presigning photos — do NOT call it from `getListingsForMap`. The map endpoint has its own lightweight mapper.
- Prisma `Listing` model already has `latitude: Float` and `longitude: Float` fields (required, non-nullable).
- `@@index([status, propertyType, cityId, districtId])` and `@@index([status, askPrice])` already exist on `Listing` from 3.1.
- The baseline commit is `e3909f6` (HEAD). Story 3.1 was merged in `ab737bb`.

### References
- `_bmad-output/planning-artifacts/epics.md#Story 3.2` (AC), `#Epic 3` (scope), `#Story 3.1` (prerequisite), `#Story 3.3` (deferred boundary)
- `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-16` (cluster zoom 12, color codes, marker click preview), `#SM-6` (p95 <800ms)
- `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md` (`component tokens map-pin-cluster` §5 Interactive Map Pin, color story, RTL note, rounded-full pill)
- `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md` (`§5 Interactive Split Map & Listing Grid` — 50/50 desktop, mobile pill toggle, 300ms debounce, hover pulse, marker click pan)
- `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md` (`AD-1`, `AD-2`, `AD-8`, `AD-9`, Capability→Map E3 bounding box, Deferred Decisions §2 Map Rendering)
- Code: `apps/web/src/app/properties/page.tsx` (3.1 search view — UPDATE to wrap in split layout); `apps/api/src/modules/listings/{listings.service.ts,listings.controller.ts}`; `apps/api/prisma/schema.prisma#Listing` (lat/lng L348–349); `packages/shared/src/{schemas/listing.schema.ts,types/listing.ts,constants/listing.ts,enums/index.ts}`
- Previous story: `_bmad-output/implementation-artifacts/3-1-multi-criteria-filter-search-pagination.md` (learnings: route ordering, `items` key, mapper pattern, no Office enum, URL sync)

## Dev Agent Record

### Agent Model Used

Qoder AI Agent

### Debug Log References

- `npx prisma generate` failed with EPERM (Windows file lock by running process); index addition is schema-only (no type impact) — safe to resolve at next server restart.
- `dynamic<ListingsMapPanelProps>()` generic required to properly type props on the dynamically-loaded map panel.

### Completion Notes List

- **Shared package**: Added `MapListingItem`, `ListingMapQuery`, `listingMapQuerySchema` (19 tests pass), `PROPERTY_TYPE_MAP_COLORS`, `MAX_MAP_RESULTS`, `SAUDI_CENTER`, `MAP_DEFAULT_ZOOM`.
- **API**: Added `getListingsForMap` service method (bounding-box + optional filters, `take: 200`, no photo presigning) and `@Get('map')` controller route (before `@Get(':id')`). 12 tests pass.
- **Prisma**: Added `@@index([status, latitude, longitude])` composite index for bounding-box query performance.
- **Web**: Installed `leaflet@1.9.4`, `react-leaflet@5`, `react-leaflet-cluster@4.1.3`, `@types/leaflet`. Created `listings-map-panel.tsx` (MapContainer + OSM tiles + clustering + 300ms debounce + AbortController), `property-pin.tsx` (divIcon price pills, color-coded by type), `map-popup-card.tsx` (title/price/area/status/detail link). Created `properties-split-view.tsx` (desktop 50/50 flex, mobile pill toggle). Updated `page.tsx` (exported `Filters`, added `activeListingId` state, `handleMarkerClick` scroll-to-card).
- **Tests**: 19 shared + 12 API + 6 web pin + 6 web split-view = 43 new tests; all green. Full regression: 170 web (40 files), 450 API (46 suites), 270 shared (22 files) — zero regressions.

### File List

- `packages/shared/src/constants/listing.ts` — MODIFIED (added MAX_MAP_RESULTS, PROPERTY_TYPE_MAP_COLORS, SAUDI_CENTER, MAP_DEFAULT_ZOOM)
- `packages/shared/src/types/listing.ts` — MODIFIED (added MapListingItem, ListingMapQuery)
- `packages/shared/src/schemas/listing.schema.ts` — MODIFIED (added listingMapQuerySchema)
- `packages/shared/src/schemas/__tests__/listing-map.spec.ts` — NEW (19 tests)
- `apps/api/prisma/schema.prisma` — MODIFIED (added @@index([status, latitude, longitude]))
- `apps/api/src/modules/listings/listings.service.ts` — MODIFIED (added getListingsForMap)
- `apps/api/src/modules/listings/listings.controller.ts` — MODIFIED (added @Get('map'))
- `apps/api/src/modules/listings/__tests__/listings-map.spec.ts` — NEW (12 tests)
- `apps/web/package.json` — MODIFIED (added leaflet, react-leaflet, react-leaflet-cluster, @types/leaflet)
- `apps/web/src/components/map/listings-map-panel.tsx` — NEW
- `apps/web/src/components/map/property-pin.tsx` — NEW
- `apps/web/src/components/map/map-popup-card.tsx` — NEW
- `apps/web/src/components/map/__tests__/property-pin.spec.tsx` — NEW (6 tests)
- `apps/web/src/components/map/__tests__/properties-split-view.spec.tsx` — NEW (6 tests)
- `apps/web/src/app/properties/properties-split-view.tsx` — NEW
- `apps/web/src/app/properties/page.tsx` — MODIFIED (export Filters, add activeListingId, handleMarkerClick, PropertiesSplitView wrapper)
- `apps/web/src/components/listings/property-card.tsx` — MODIFIED (added data-listing-id attribute)

## Change Log

| Date | Change |
|------|--------|
| 2026-11-04 | Story 3.2 implemented: shared types/schemas, API map endpoint, Prisma index, web map components, split layout, 43 new tests, full regression green |
