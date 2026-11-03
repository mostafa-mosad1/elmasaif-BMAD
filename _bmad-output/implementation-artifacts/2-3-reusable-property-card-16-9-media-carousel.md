---
baseline_commit: b78d6dedecbed94f2a617746cbd1b7d19f5a2eb5
---

# Story 2.3: Reusable Property Card & 16:9 Media Carousel

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor or buyer,
I want to browse properties displayed in consistent, visually rich property cards with an interactive 16:9 media carousel,
So that I can evaluate key specs, pricing, and visual imagery at a glance across all marketplace and dashboard surfaces.

## Acceptance Criteria

1. **16:9 Media Carousel, Photo Counter Pill & Navigation Controls (`UX-DR7`, `DESIGN.md#1`, `EXPERIENCE.md`):**
   - **Given** a property listing with 1 to 20 public photos (`photos: string[]`)
   - **When** the `PropertyCard` (and its underlying `PropertyMediaCarousel`) renders
   - **Then** the media viewport enforces a strict `16:9` aspect ratio (`aspect-video` / `aspect-[16/9]`) with rounded top corners matching the card radius (`rounded-t-card` / `16px`) and smooth image cover fit (`object-cover`)
   - **And** a photo counter pill is displayed at top-left in RTL (`top-3 start-3` / `left-3`) styled with `bg-black/65 backdrop-blur-sm text-white px-2.5 py-1 rounded-pill text-xs font-mono` (with `dir="ltr"`) showing `{currentIndex + 1}/{totalPhotos}` (e.g., `1/12`)
   - **And** when `photos.length > 1`, interactive previous/next navigation buttons (`aria-label="الصورة السابقة"` and `aria-label="الصورة التالية"`) and horizontal touch swipe handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd` with a $\ge 40\text{px}$ threshold) allow cycling through photos with wrap-around navigation (`0 <-> length - 1`), stopping event propagation (`e.stopPropagation()`, `e.preventDefault()`) so clicking carousel arrows does not trigger parent card navigation
   - **And** when `photos` is empty or an image fails to load, a dignified institutional placeholder surface (`bg-emerald-950 text-primary-light`) renders the property type icon and title without broken image icons.

2. **Fal-Verified Badge, Seller Role Badge & Listing Status Overlays (`UX-DR7`, `DESIGN.md#1`, `FR-11`):**
   - **Given** a property listing rendered in `PropertyCard`
   - **When** badge overlays render at top-right in RTL (`top-3 right-3`)
   - **Then** if the listing seller is a licensed Marketer (`sellerRole === UserRole.MARKETER` or `isFalVerified === true`), it displays the verified badge: `معلن مرخص (فال)` using `<Badge variant="verified" size="sm">` with `CheckCircle2` / `ShieldCheck` icon (`#059669` on `#ECFDF5`)
   - **And** if the seller is a direct Property Owner (`sellerRole === UserRole.OWNER` and not a marketer), it displays `عرض مالك مباشر` using `<Badge variant="pending" size="sm">` with `Building2` icon
   - **And** if the listing status is `ListingStatus.RESERVED`, a prominent status badge (`محجوز بصفقة نشطة`) is displayed; if `ListingStatus.SOLD`, `تم البيع` is displayed.

3. **Ask Price, Commission Preview, Property Type & Location Tag (`UX-DR7`, `DESIGN.md#1`, `FR-11`, `FR-17`):**
   - **Given** a property listing rendered in `PropertyCard`
   - **When** the card body and price overlay render
   - **Then** the single Ask Price is prominently displayed in `JetBrains Mono` (`font-mono-numbers`, `dir="ltr"`, `heading-lg` `22px`/`font-bold`) formatted with thousands separators followed by the explicit Saudi Riyal symbol `ر.س` (never `$` or ambiguous currency symbols)
   - **And** the card displays the Arabic property type label (`فيلا`, `أرض`, `شقة`, `عمارة`, `مكتب / تجاري`, `مزرعة / استراحة` mapped from `PropertyType`), the property title (`line-clamp-1`), and the structured location tag (`{cityName}، حي {districtName}`) with a `MapPin` icon
   - **And** the card footer displays the transparent 2.5% platform commission preview (`سعي المنصة (2.5%): {commission} ر.س` in `font-mono-numbers`) alongside a configurable primary action button/link (defaulting to `تقديم عرض` or `التفاصيل والعرض`).

4. **Strict Specs Strip & Bathroom Omission Guardrail (`UX-DR7`, `BR-13`, `FR-11`):**
   - **Given** the specifications strip inside `PropertyCard`
   - **When** physical property attributes render
   - **Then** the specs strip displays **Area in square meters** (`{areaSquareMeters} م²` in `font-mono-numbers` with `Maximize2` / `Ruler` icon) and **Bedrooms count** (`{bedrooms} غرف نوم` with `BedDouble` icon, or `غير محدد / أرض` when `bedrooms` is null/0 for land/commercial) separated by crisp hairline borders (`border-surface-border dark:border-dark-surface-border`)
   - **And** **bathrooms are strictly omitted** from the component props, data contract, DOM output, and visual display in compliance with `BR-13` and the platform data model.

5. **Backend Public & Seller Listings Media Array Enrichment (`apps/api` & `packages/shared`):**
   - **Given** `ListingsService.getPublicActiveListings()` and `ListingsService.getMyListings()` in `apps/api/src/modules/listings/listings.service.ts`
   - **When** returning listing summary items for cards
   - **Then** each item includes `photos: string[]` containing pre-signed download URLs (`<= 300s` TTL via `StorageService.getPresignedDownloadUrl`) for all `PUBLIC` `PHOTO` documents of that listing (preserving `primaryPhotoUrl` as `photos[0] ?? null` and `photoCount: photos.length`) and `isFalVerified: boolean` (true when `sellerProfile.role === UserRole.MARKETER`)
   - **And** `ListingSummaryItem` in `packages/shared/src/types/listing.ts` is updated to include `photos?: string[]`, `photoCount?: number`, `sellerRole?: UserRole`, `isFalVerified?: boolean`, and `yearBuilt?: number | null`.

6. **Marketplace Integration & Zero-Bathroom Regression Cleanup (`apps/web`):**
   - **Given** the Marketplace Home page (`apps/web/src/app/page.tsx`)
   - **When** rendering live and featured property listings in the `#listings` section
   - **Then** inline ad-hoc card markup (which previously used `aspect-[16/10]`, static `1/12` text, and a legacy `6 دورات المياه` bathroom column) is replaced with the reusable `<PropertyCard />` component
   - **And** zero occurrences of bathroom labels (`دورات المياه`, `حمام`) remain on property cards anywhere in `apps/web`.

## Tasks / Subtasks

- [x] **Task 1: Update Shared Listing Summary Contract & Property Type Labels (`packages/shared`)** (AC: #2, #3, #4, #5)
  - [x] 1.1 Update `ListingSummaryItem` in `packages/shared/src/types/listing.ts` to include:
    - `description?: string;`
    - `yearBuilt?: number | null;`
    - `sellerRole?: UserRole;`
    - `isFalVerified?: boolean;`
    - `photoCount?: number;`
    - `photos?: string[];`
    - Ensure `bathrooms` is never present on `ListingSummaryItem`.
  - [x] 1.2 Add canonical `PROPERTY_TYPE_LABELS_AR: Record<PropertyType, string>` and `PLATFORM_COMMISSION_RATE = 0.025` in `packages/shared/src/constants/listing.ts` so all frontend cards, wizards, and moderation views share one authoritative Arabic mapping (`VILLA: 'فيلا'`, `LAND: 'أرض'`, `APARTMENT: 'شقة'`, `BUILDING: 'عمارة'`, `COMMERCIAL: 'مكتب / تجاري'`, `FARM: 'مزرعة / استراحة'`).
  - [x] 1.3 Export new constants from `packages/shared/src/index.ts` and add unit tests in `packages/shared/src/schemas/__tests__/listing.spec.ts`.

- [x] **Task 2: Enrich Backend Listing Card Summaries with `photos[]` & `isFalVerified` (`apps/api`)** (AC: #1, #2, #5)
  - [x] 2.1 Update `ListingsService.getPublicActiveListings()` and `ListingsService.getMyListings()` in `apps/api/src/modules/listings/listings.service.ts`:
    - Resolve pre-signed URLs (`storageService.getPresignedDownloadUrl(doc.fileUrl, 300)`) for all `PHOTO` documents on each listing into `photos: string[]`.
    - Set `primaryPhotoUrl: photos[0] ?? null` and `photoCount: photos.length`.
    - Include `isFalVerified: listing.sellerProfile?.role === UserRole.MARKETER`.
  - [x] 2.2 Add/update unit tests in `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` verifying `getPublicActiveListings` returns the `photos` array of signed URLs, `photoCount`, `sellerRole`, and `isFalVerified`, and never exposes `ADMIN_ONLY` documents.

- [x] **Task 3: Build Reusable `PropertyMediaCarousel` & `PropertyCard` Components (`apps/web`)** (AC: #1, #2, #3, #4)
  - [x] 3.1 Create `apps/web/src/components/listings/property-media-carousel.tsx`:
    - Enforces `aspect-video` (`16:9`) container (`relative aspect-video w-full bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden select-none`).
    - Accepts `photos: string[]`, `photoCount?: number`, `alt: string`, `initialIndex?: number`, `onSlideChange?: (index: number) => void`, and overlay slots (`topRightSlot`, `bottomRightSlot`).
    - Renders counter pill at `top-3 left-3 z-20` with `dir="ltr"` and `font-mono` showing `{currentIndex + 1}/{effectiveTotal}` (where `effectiveTotal = Math.max(photos.length, photoCount || 1)`).
    - Renders previous/next chevron buttons (`ChevronRight` for previous in RTL, `ChevronLeft` for next in RTL) when `photos.length > 1`, with keyboard support (`ArrowRight` / `ArrowLeft`) and touch swipe handlers (`onTouchStart`, `onTouchEnd` delta $\ge 40\text{px}$).
    - Renders dignified fallback placeholder when `photos.length === 0`.
  - [x] 3.2 Create `apps/web/src/components/listings/property-card.tsx`:
    - Accepts `listing: ListingSummaryItem` (or structured props), optional `href?: string`, `actionLabel?: string`, `onActionClick?: (listing: ListingSummaryItem) => void`, `onFavoriteToggle?: (listingId: string) => void`, `isFavorited?: boolean`, `className?: string`.
    - Renders `<Card hoverEffect className="overflow-hidden flex flex-col p-0 group">`.
    - Embeds `<PropertyMediaCarousel />` with:
      - Top-right badge slot: `معلن مرخص (فال)` (`variant="verified"`) when `sellerRole === UserRole.MARKETER` or `isFalVerified`, else `عرض مالك مباشر` (`variant="pending"`), plus status badge if `RESERVED` or `SOLD`.
      - Bottom-right price overlay: formatted `askPrice` in `font-mono-numbers text-xl font-bold` (`22px` `heading-lg`) + `ر.س`.
    - Renders card body:
      - Location tag with `MapPin` icon (`{cityName}، حي {districtName}`) and property type pill (`PROPERTY_TYPE_LABELS_AR[propertyType]`).
      - Title (`h3` with `line-clamp-1`).
      - Specs strip (2 columns or 2 primary specs + optional yearBuilt, separated by hairline borders):
        1. **المساحة:** `{areaSquareMeters.toLocaleString('en-US')} م²` (`font-mono-numbers`)
        2. **غرف النوم:** `{bedrooms != null && bedrooms > 0 ? `${bedrooms} غرف` : '—'}`
        - **Strictly zero bathroom fields or labels.**
      - Footer with calculated platform commission (`سعي المنصة (2.5%): {commission} ر.س`) and action button/link.
  - [x] 3.3 Export `PropertyCard`, `PropertyCardProps`, `PropertyMediaCarousel`, and `PropertyMediaCarouselProps` from `apps/web/src/components/listings/index.ts`.

- [x] **Task 4: Integrate `PropertyCard` into Marketplace Home & Write Comprehensive Unit Tests (`apps/web`)** (AC: #1, #2, #3, #4, #6)
  - [x] 4.1 Refactor `apps/web/src/app/page.tsx` (`#listings` section) to render both `liveListings` and featured fallback listings using `<PropertyCard />`, eliminating the legacy `aspect-[16/10]` markup and removing the `6 دورات المياه` bathroom text.
  - [x] 4.2 Create Vitest SSR unit tests in `apps/web/src/components/listings/__tests__/property-card.spec.tsx` (using `renderToString` from `react-dom/server`):
    - Verifies `aspect-video` (16:9) class is applied.
    - Verifies photo counter pill (`1/12` or `1/3`) renders with `dir="ltr"` and `font-mono`.
    - Verifies navigation controls (`الصورة السابقة`, `الصورة التالية`) render when multiple photos are passed and hide when only 1 photo exists.
    - Verifies Fal-verified badge (`معلن مرخص (فال)`) renders for Marketer listings and `عرض مالك مباشر` renders for Owner listings.
    - Verifies ask price in SAR (`ر.س`), 2.5% platform commission, location tag (`الرياض، حي النرجس`), property type label, bedrooms, and area in `م²`.
    - Verifies **bathrooms are strictly omitted** (`expect(html).not.toContain('حمام')`, `expect(html).not.toContain('دورات')`).
  - [x] 4.3 Run full monorepo verification: `npm run test:shared`, `npm run test --workspace=apps/api`, `npm run test --workspace=apps/web`, `npm run build`, and `npm run lint`.

## Dev Notes

### Architectural & UX Guardrails
- **Strict 16:9 Media Aspect Ratio (`UX-DR7`, `DESIGN.md#1`):**
  - `DESIGN.md` (lines 160–164, 328–333) explicitly mandates `aspectRatio: '16/9'` (`aspect-video` in Tailwind CSS) for `property-card`. Note that `apps/web/src/app/page.tsx` previously used an ad-hoc `aspect-[16/10]` container—this story replaces it with the canonical `aspect-video` (`16:9`) `PropertyCard`.
- **Strict Omission of Bathrooms (`BR-13`, `FR-11`, `UX-DR7`):**
  - Per `epics.md` and `DESIGN.md#1`: *"Specs Strip: Micro-icons for Bedrooms and Area in square meters (`م²`), separated by hairline borders (bathrooms omitted per data model)."*
  - Notice that `apps/web/src/app/page.tsx` lines 390–393 had a hardcoded static card containing `6 دورات المياه`. Replacing those static cards with `<PropertyCard />` in Task 4.1 fixes this compliance violation!
- **RTL Geometry & Counter Pill Placement (`DESIGN.md#1`, `UX-DR1`, `UX-DR16`):**
  - In RTL (`dir="rtl"`), the Fal-verified badge sits at **top-right** (`top-3 right-3` / `top-3 start-3`), and the photo counter pill (`1/12`) sits at **top-left** (`top-3 left-3` / `top-3 end-3`).
  - Numeric strings such as the photo counter (`1/12`), ask price (`3,200,000`), and area (`450`) must use `font-mono` / `font-mono-numbers` with `dir="ltr"` so numbers never invert in RTL browsers.
- **React 19 SSR Testing Pattern in `apps/web`:**
  - `apps/web` uses Vitest with `renderToString` from `react-dom/server` (`@testing-library/react` is NOT installed in `apps/web/package.json`).
  - Remember that React 19 `renderToString` inserts `<!-- -->` comments between adjacent JSX interpolations (e.g. `<span>{count} غرف</span>` becomes `<span>5<!-- --> غرف</span>`). Always use template literals inside a single expression (`<span>{`${count} غرف`}</span>` and `<span>{`${currentIndex + 1}/${totalPhotos}`}</span>`) so SSR HTML assertions match cleanly!

### Files Being Modified (UPDATE) & Created (NEW)

#### Files to Update:
1. [`packages/shared/src/constants/listing.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/packages/shared/src/constants/listing.ts) — Add `PROPERTY_TYPE_LABELS_AR` and `PLATFORM_COMMISSION_RATE = 0.025`.
2. [`packages/shared/src/types/listing.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/packages/shared/src/types/listing.ts) — Extend `ListingSummaryItem` with `photos?: string[]`, `photoCount?: number`, `sellerRole?: UserRole`, `isFalVerified?: boolean`, `yearBuilt?: number | null`, `description?: string`.
3. [`packages/shared/src/schemas/__tests__/listing.spec.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/packages/shared/src/schemas/__tests__/listing.spec.ts) — Add unit tests for `PROPERTY_TYPE_LABELS_AR` and `PLATFORM_COMMISSION_RATE`.
4. [`apps/api/src/modules/listings/listings.service.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/apps/api/src/modules/listings/listings.service.ts) — Update `getPublicActiveListings()` and `getMyListings()` to return `photos: string[]` (signed URLs for all public photos) and `isFalVerified: boolean`.
5. [`apps/api/src/modules/listings/__tests__/listings.service.spec.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/apps/api/src/modules/listings/__tests__/listings.service.spec.ts) — Add unit tests for `getPublicActiveListings` photo array resolution and `isFalVerified`.
6. [`apps/web/src/components/listings/index.ts`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/apps/web/src/components/listings/index.ts) — Export `PropertyCard` and `PropertyMediaCarousel`.
7. [`apps/web/src/app/page.tsx`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/apps/web/src/app/page.tsx) — Refactor `#listings` grid to use `<PropertyCard />` and remove legacy inline card markup.

#### Files to Create:
1. `apps/web/src/components/listings/property-media-carousel.tsx`
2. `apps/web/src/components/listings/property-card.tsx`
3. `apps/web/src/components/listings/__tests__/property-card.spec.tsx`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 2.3: Reusable Property Card & 16:9 Media Carousel]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md`#1. Property Card (Marketplace)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`#Information Architecture & #Interaction Primitives]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md`#FR-11, #FR-17, #BR-13]
- [Source: `_bmad-output/implementation-artifacts/0-8-sovereign-design-system-foundation-rtl-layout-shell.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-listing-creation-document-visibility-classification.md`]

## Dev Agent Record

### Agent Model Used

Gemini 4 Argon (Medium)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Updated `ListingSummaryItem` in `packages/shared/src/types/listing.ts` to include `photos?: string[]`, `photoCount?: number`, `sellerRole?: UserRole`, `isFalVerified?: boolean`, `yearBuilt?: number | null`, and `description?: string` (with strict omission of `bathrooms`).
- Added canonical `PROPERTY_TYPE_LABELS_AR` and `PLATFORM_COMMISSION_RATE = 0.025` to `packages/shared/src/constants/listing.ts` and validated with unit tests in `packages/shared/src/schemas/__tests__/listing.spec.ts`.
- Enriched `ListingsService.getPublicActiveListings()` and `ListingsService.getMyListings()` in `apps/api/src/modules/listings/listings.service.ts` to return short-lived pre-signed download URLs (`<= 300s`) for all public `PHOTO` documents in `photos: string[]`, along with `primaryPhotoUrl`, `photoCount`, `sellerRole`, and `isFalVerified`.
- Created `PropertyMediaCarousel` (`apps/web/src/components/listings/property-media-carousel.tsx`) enforcing a `16:9` (`aspect-video`) container, RTL-aware `1/N` photo counter pill (`dir="ltr"`, `font-mono`), wrap-around keyboard/button/swipe navigation (`>= 40px` threshold), and an institutional fallback placeholder (`bg-emerald-950`).
- Created `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`) rendering Fal-verified / direct owner / status badges, formatted SAR ask price (`ر.س`), location tag, property type pill, 2.5% platform commission preview, and a strict 2-column specs strip (Area in `م²` and Bedrooms only, with zero bathroom references per `BR-13`).
- Refactored `apps/web/src/app/page.tsx` (`#listings` section) to use `<PropertyCard />` for both live and featured showcase listings, removing legacy `aspect-[16/10]` markup and eliminating the `6 دورات المياه` compliance violation.
- Added comprehensive SSR unit tests in `apps/web/src/components/listings/__tests__/property-card.spec.tsx` (9 tests passing) and `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` (15 tests passing).

### File List

- `packages/shared/src/constants/listing.ts` (MODIFIED)
- `packages/shared/src/types/listing.ts` (MODIFIED)
- `packages/shared/src/schemas/__tests__/listing.spec.ts` (MODIFIED)
- `apps/api/src/modules/listings/listings.service.ts` (MODIFIED)
- `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` (MODIFIED)
- `apps/api/src/modules/storage/storage.service.ts` (MODIFIED)
- `apps/api/src/modules/storage/storage.controller.ts` (MODIFIED)
- `apps/api/src/main.ts` (MODIFIED)
- `apps/web/src/components/listings/property-media-carousel.tsx` (NEW)
- `apps/web/src/components/listings/property-card.tsx` (NEW)
- `apps/web/src/components/listings/index.ts` (MODIFIED)
- `apps/web/src/components/listings/__tests__/property-card.spec.tsx` (NEW)
- `apps/web/src/app/page.tsx` (MODIFIED)
- `_bmad-output/implementation-artifacts/2-3-reusable-property-card-16-9-media-carousel.md` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)

## Change Log

- **2026-11-03**: Implemented Story 2.3 — Reusable Property Card & 16:9 Media Carousel across `packages/shared`, `apps/api`, and `apps/web` with full unit test coverage and zero-bathroom compliance cleanup.

