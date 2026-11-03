---
baseline_commit: 43946fcf971e8c9f7f427bb34751064da2643990
---
# Story 2.7: Listing View & Engagement Analytics

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a property seller (`MARKETER` or `OWNER`) or platform administrator (`Reports.Analytics` / `Listings.Review`),
I want to track property view impressions, detail page visits, and favorite bookmarks asynchronously and without storing per-visitor identifiers,
so that I can analyze buyer interest and engagement metrics over time, optimize listing performance, and preserve strict Saudi Personal Data Protection Law (PDPL) compliance.

## Acceptance Criteria

1. **Privacy-Preserving & Non-Blocking Asynchronous Engagement Event Ingestion (`FR-67`, `UC-42`, `PDPL Compliance`, `NFR11`):**
   - **Given** an unauthenticated visitor or authenticated buyer interacting with listing cards or detail screens
   - **When** engagement events occur (card impression in viewport, detail page view, or favorite toggle)
   - **Then** the platform accepts engagement batches via `POST /api/v1/listings/analytics/events` with payload schema:
     ```typescript
     {
       events: Array<{
         listingId: string; // UUID of the target listing
         eventType: 'IMPRESSION' | 'DETAIL_VIEW';
         count?: number; // Defaults to 1 if omitted
       }>
     }
     ```
   - **And** the endpoint executes asynchronously and responds with `202 Accepted` within `< 50 ms` p95 latency without degrading public read query throughput (`FR-67`).
   - **And** strict Saudi Personal Data Protection Law (PDPL) compliance is enforced:
     - The database stores strictly aggregated metrics (`ListingDailyMetric` and `Listing` lifetime counters).
     - Under NO circumstances are per-visitor tracking cookies, IP addresses, session fingerprints, or browser identifiers stored in analytics logs or tables (`FR-67`).
   - **And** the backend aggregates events per listing per day (truncated to midnight UTC):
     - Upserts rows in `ListingDailyMetric` (`listing_daily_metrics`) keyed by composite unique `(listingId, date)`:
       - Increments `impressions` for `IMPRESSION` events.
       - Increments `detailViews` for `DETAIL_VIEW` events.
     - Atomically increments lifetime counters on the `Listing` record:
       - Increments `totalImpressions` by the batch count.
       - Increments `totalViews` by the batch count.

2. **Authenticated Buyer Favorite Bookmark Toggle & State Synchronization (`FR-20`, `FR-67`, `UC-42`, `UC-57`):**
   - **Given** an authenticated user (`req.user.id`) browsing listing cards or detail views
   - **When** the user clicks the favorite bookmark button (`Heart` icon)
   - **Then** the request is sent to `POST /api/v1/listings/:id/favorite` protected by `SessionAuthGuard`
   - **And** within an atomic database transaction:
     - If a `ListingFavorite` row exists for `(userId, listingId)`: deletes the row (unfavorite) and decrements `Listing.totalFavorites` (floor at 0).
     - If no `ListingFavorite` row exists: creates `ListingFavorite { userId, listingId, createdAt: ClockService.now() }`, increments `Listing.totalFavorites`, and increments `favoriteAdds` in `ListingDailyMetric` for current date.
   - **And** returns `{ isFavorited: boolean, totalFavorites: number }`.
   - **And** when public or authenticated users fetch listings (`GET /api/v1/listings` or `GET /api/v1/listings/:id`):
     - If authenticated, the response includes `isFavorited: boolean` indicating whether current caller has bookmarked the listing.
     - If unauthenticated, `isFavorited` defaults to `false`.
   - **And** if an unauthenticated visitor clicks the favorite button on the UI, the frontend displays an institutional prompt to sign in or register before bookmarking.

3. **Seller Listing Management Dashboard Analytics Integration (`FR-67`, `UC-31`, `UC-46`, `UC-57`, `UC-57A`):**
   - **Given** an authenticated seller (`MARKETER` or `OWNER`) inspecting authored listings
   - **When** accessing the seller dashboard (`/app/marketer` or `/app/owner`) or requesting `GET /api/v1/listings/:id/analytics`
   - **Then** the backend validates that `listing.sellerProfile.userId === req.user.id` (or caller is authorized admin with `Reports.Analytics`)
   - **And** returns comprehensive engagement analytics:
     - Lifetime metrics: `totalViews`, `totalImpressions`, `totalFavorites`, and `offersCount` (total offers received).
     - Offer conversion ratio: `offersCount / totalViews` formatted as percentage (0% if totalViews = 0) (`FR-67`).
     - Daily engagement trend breakdown (last 7 days or 30 days): array of `{ date: string, impressions: number, detailViews: number, favoriteAdds: number }`.
   - **And** the seller dashboard UI updates:
     - Displays engagement chips on each listing item:
       - **المشاهدات (Views)** with `Eye` icon and counter.
       - **الظهور (Impressions)** with `BarChart2` icon and counter.
       - **المفضلة (Bookmarks)** with `Heart` icon and counter.
       - **نسبة التفاعل/العروض (Offer Conversion)** with `TrendingUp` icon and percentage.
     - Quick Stats grid includes an aggregated overview card: "إجمالي المشاهدات والتفاعل" (Total Views & Engagement across all seller listings).
     - Offers an expandable or modal breakdown showing the 7-day engagement trend chart/bars.

4. **Administrator Global Listing Engagement Analytics Back-Office Dashboard (`FR-66`, `FR-67`, `UC-60`, `Reports.Analytics`, `Listings.Review`):**
   - **Given** an authenticated administrator with `Reports.Analytics` or `Listings.Review` permission
   - **When** calling `GET /api/v1/admin/listings/analytics/overview` or visiting `/admin/listings/analytics`
   - **Then** the backend calculates and returns platform-level engagement aggregates:
     - Global summary counters: `totalActiveListings`, `totalLifetimeImpressions`, `totalLifetimeViews`, `totalLifetimeFavorites`, and global average conversion ratio.
     - Top performing listings: Top 10 listings ranked by detail views and bookmark volume, including listing ID, title, property type, city, ask price, views, and favorites.
     - Daily platform engagement trend (last 30 days): array of daily aggregate impressions, views, and favorites.
   - **And** the back-office dashboard UI (`/admin/listings/analytics` or tab in moderation queue):
     - Displays summary cards with total views, impressions, and bookmarks.
     - Displays an interactive trend chart/histogram of daily marketplace engagement.
     - Displays a "Top Engaged Properties" table with quick actions to inspect the listing or jump to compliance moderation review.

5. **Client-Side Viewport Observer & Batched Interaction Tracking (`apps/web`):**
   - **Given** visitors browsing marketplace listings (`PropertyCard` in grids, split map, or detail pages)
   - **When** listing cards scroll into view (50% visibility threshold for at least 1 second)
   - **Then** the client-side `useListingAnalytics` hook captures the impression event and enqueues it in a memory batch buffer.
   - **And** the buffer automatically flushes via `POST /api/v1/listings/analytics/events`:
     - Flushes every 2 seconds if events are queued, or when buffer reaches 10 items.
     - Uses `navigator.sendBeacon` or `fetch` with `keepalive: true` on window pagehide / unmount to guarantee zero lost metrics during navigation.
   - **And** navigating to a listing detail page (`/listings/[id]`) automatically dispatches a single `DETAIL_VIEW` event.
   - **And** clicking the favorite heart button on `PropertyCard` or detail screen:
     - Optimistically updates heart state and counter immediately.
     - Dispatches `POST /api/v1/listings/:id/favorite`.
     - Reverts state and displays an error toast if the network call fails.

## Tasks / Subtasks

- [x] **Task 1: Shared Schemas, Types & Constants (`packages/shared`)** (AC: #1, #2, #3, #4)
  - [x] 1.1 Add engagement event types and enums in `packages/shared/src/enums/index.ts`:
    - `ListingEngagementEventType`: `IMPRESSION`, `DETAIL_VIEW`.
  - [x] 1.2 Define Zod validation schemas in `packages/shared/src/schemas/listing.schema.ts`:
    - `listingEngagementEventSchema`: `{ listingId: z.string().uuid(), eventType: z.enum(['IMPRESSION', 'DETAIL_VIEW']), count: z.number().int().min(1).max(100).default(1) }`
    - `batchListingEngagementSchema`: `{ events: z.array(listingEngagementEventSchema).min(1).max(50) }`
    - `listingAnalyticsQuerySchema`: `{ days: z.coerce.number().int().min(1).max(90).default(30) }`
  - [x] 1.3 Define TypeScript types and interfaces in `packages/shared/src/types/listing.ts`:
    - `ListingEngagementEvent`, `BatchListingEngagementInput`.
    - `ListingAnalyticsSummary`: `{ listingId: string; totalViews: number; totalImpressions: number; totalFavorites: number; offersCount: number; conversionRatio: number; dailyMetrics: Array<{ date: string; impressions: number; detailViews: number; favoriteAdds: number }>; }`.
    - `AdminGlobalEngagementAnalytics`: `{ totalActiveListings: number; totalLifetimeImpressions: number; totalLifetimeViews: number; totalLifetimeFavorites: number; averageConversionRatio: number; topListings: Array<{ id: string; title: string; propertyType: string; cityName: string; askPrice: number; views: number; favorites: number; }>; dailyTrends: Array<{ date: string; impressions: number; detailViews: number; favorites: number }>; }`.
    - Extend `ListingSummaryItem` and `ListingDetailResponse` with `totalViews?: number; totalImpressions?: number; totalFavorites?: number; isFavorited?: boolean; offersCount?: number;`.
  - [x] 1.4 Add unit tests in `packages/shared/src/schemas/__tests__/listing-analytics.spec.ts` validating batch payload validation and constraints.

- [x] **Task 2: Prisma Schema Evolution & Client Generation (`apps/api/prisma`)** (AC: #1, #2)
  - [x] 2.1 Update `apps/api/prisma/schema.prisma`:
    - Add lifetime counters to `model Listing`:
      - `totalViews Int @default(0) @map("total_views")`
      - `totalImpressions Int @default(0) @map("total_impressions")`
      - `totalFavorites Int @default(0) @map("total_favorites")`
    - Add `model ListingDailyMetric`:
      ```prisma
      model ListingDailyMetric {
        id           String   @id @default(uuid())
        listingId    String   @map("listing_id")
        date         DateTime @db.Date
        impressions  Int      @default(0)
        detailViews  Int      @default(0) @map("detail_views")
        favoriteAdds Int      @default(0) @map("favorite_adds")
        createdAt    DateTime @default(now()) @map("created_at")
        updatedAt    DateTime @updatedAt @map("updated_at")

        listing      Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

        @@unique([listingId, date])
        @@index([date])
        @@map("listing_daily_metrics")
      }
      ```
    - Add `model ListingFavorite`:
      ```prisma
      model ListingFavorite {
        id        String   @id @default(uuid())
        userId    String   @map("user_id")
        listingId String   @map("listing_id")
        createdAt DateTime @default(now()) @map("created_at")

        user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
        listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

        @@unique([userId, listingId])
        @@index([userId])
        @@index([listingId])
        @@map("listing_favorites")
      }
      ```
    - Connect relations on `User` (`favorites ListingFavorite[]`) and `Listing` (`dailyMetrics ListingDailyMetric[]`, `favorites ListingFavorite[]`).
  - [x] 2.2 Run `npx --workspace=apps/api prisma generate` to refresh the Prisma Client.

- [x] **Task 3: Backend Listing Engagement & Favorite Endpoints (`apps/api/src/modules/listings`)** (AC: #1, #2, #3)
  - [x] 3.1 Implement asynchronous event batch ingestion in `ListingsService`:
    - `recordBatchEngagement(dto: BatchListingEngagementInput): Promise<{ processed: number }>`:
      - Uses raw SQL upsert / transaction to batch update `listing_daily_metrics` and atomically increment `total_views` / `total_impressions` on `Listing`.
      - Non-blocking and resilient: handles nonexistent listing IDs gracefully without crashing the batch.
  - [x] 3.2 Implement favorite bookmark toggling in `ListingsService`:
    - `toggleFavorite(listingId: string, userId: string): Promise<{ isFavorited: boolean; totalFavorites: number }>`:
      - Checks listing exists.
      - Within `$transaction`: inserts or deletes `ListingFavorite`, updates `Listing.totalFavorites`, and increments `favoriteAdds` in `ListingDailyMetric` if added.
  - [x] 3.3 Implement seller listing analytics endpoint in `ListingsService`:
    - `getListingAnalytics(listingId: string, userId: string, days?: number): Promise<ListingAnalyticsSummary>`:
      - Validates ownership (`listing.sellerProfile.userId === userId`).
      - Queries `totalViews`, `totalImpressions`, `totalFavorites`, counts related `offers`, and calculates conversion ratio.
      - Fetches daily metrics from `ListingDailyMetric` for the requested window (`days` default 30).
  - [x] 3.4 Wire controller routes in `ListingsController` (`apps/api/src/modules/listings/listings.controller.ts`):
    - `POST /listings/analytics/events` (`@HttpCode(HttpStatus.ACCEPTED)`): public endpoint accepting `BatchListingEngagementInput`.
    - `POST /listings/:id/favorite` (`@UseGuards(SessionAuthGuard)`): authenticated endpoint to toggle favorite.
    - `GET /listings/:id/analytics` (`@UseGuards(SessionAuthGuard)`): authenticated endpoint to fetch seller listing analytics.
    - Update `getPublicActiveListings` and `getListingById` to enrich response with `isFavorited` if caller has active session cookie.
  - [x] 3.5 Write unit tests in `apps/api/src/modules/listings/__tests__/listings-analytics.spec.ts` covering batch aggregation, non-blocking response, favorite toggling, and authorization rules.

- [x] **Task 4: Admin Global Engagement Analytics Endpoint (`apps/api/src/modules/listings`)** (AC: #4)
  - [x] 4.1 Update `AdminListingsService` (`apps/api/src/modules/listings/admin-listings.service.ts`):
    - Implement `getGlobalEngagementAnalytics(days: number = 30): Promise<AdminGlobalEngagementAnalytics>`:
      - Aggregates platform-level counts from `Listing` (`sum(totalViews)`, `sum(totalImpressions)`, `sum(totalFavorites)`).
      - Queries top 10 listings by views and favorites with title, property type, and city names.
      - Queries grouped daily totals from `ListingDailyMetric` for the last N days.
  - [x] 4.2 Update `AdminListingsController` (`apps/api/src/modules/listings/admin-listings.controller.ts`):
    - Add `GET /admin/listings/analytics/overview` protected by `@RequirePermissions('Reports.Analytics', 'Listings.Review')`.
  - [x] 4.3 Write unit tests in `apps/api/src/modules/listings/__tests__/admin-listings-analytics.spec.ts`.

- [x] **Task 5: Frontend Engagement Tracking Hook & PropertyCard Integration (`apps/web`)** (AC: #1, #2, #5)
  - [x] 5.1 Create `useListingAnalytics` hook in `apps/web/src/hooks/use-listing-analytics.ts`:
    - Maintains an in-memory queue for card impressions.
    - Flushes automatically every 2 seconds or on buffer threshold.
    - Provides `recordImpression(listingId: string)` and `recordDetailView(listingId: string)`.
    - Supports flush via `navigator.sendBeacon` or fetch `keepalive` on window unmount.
  - [x] 5.2 Update `PropertyCard` (`apps/web/src/components/listings/property-card.tsx`):
    - Integrate `IntersectionObserver` to trigger `recordImpression(listing.id)` once when the card becomes visible for >= 1s.
    - Wire `onFavoriteToggle` to call `/api/v1/listings/:id/favorite` with optimistic state toggle.
    - If user is not authenticated, display a friendly modal or toast redirecting to sign in.
  - [x] 5.3 Write unit tests in `apps/web/src/components/listings/__tests__/property-card-analytics.spec.tsx`.

- [x] **Task 6: Seller Dashboard Engagement UI (`apps/web/src/app/app/marketer` & `owner`)** (AC: #3)
  - [x] 6.1 Update Marketer Dashboard (`apps/web/src/app/app/marketer/page.tsx`):
    - Add aggregated views & engagement card to the top stats grid.
    - Add engagement chips on each listing row: views (`Eye`), impressions (`BarChart2`), favorites (`Heart`), and conversion ratio.
    - Add a modal or expandable panel displaying the 7-day view trend.
  - [x] 6.2 Update Owner Dashboard (`apps/web/src/app/app/owner/page.tsx`):
    - Mirror engagement chips and view metrics on direct owner listings.
  - [x] 6.3 Write unit tests in `apps/web/src/app/app/marketer/__tests__/marketer-analytics.spec.tsx`.

- [x] **Task 7: Admin Back-Office Engagement Dashboard (`apps/web/src/app/admin`)** (AC: #4)
  - [x] 7.1 Create Admin Engagement Overview page/component in `apps/web/src/app/admin/listings/analytics/page.tsx`:
    - Summary metric cards: Total Impressions, Total Detail Views, Total Bookmarks, Conversion Benchmark.
    - Daily engagement trend chart/histogram (pure Tailwind / SVG or lightweight bar visualization).
    - Top 10 engaged properties table with direct link to moderation/review.
  - [x] 7.2 Add navigation tab/button in Admin Listings Moderation queue (`apps/web/src/components/admin/listing-moderation-queue.tsx`) linking to Analytics Overview.
  - [x] 7.3 Write unit tests in `apps/web/src/app/admin/listings/__tests__/admin-analytics-page.spec.tsx`.

## Dev Notes

### Architecture Patterns & Constraints

- **Strict Saudi PDPL Privacy Guardrails (`FR-67`):**
  - Do NOT store any visitor identifier, cookie ID, IP address, or device fingerprint in database tables.
  - Track metrics purely in aggregate per day (`ListingDailyMetric`) and lifetime counters on the `Listing` record.
- **Asynchronous, High-Performance Read/Write Pipeline:**
  - View counters and impressions must NEVER block public listing search queries or detail screen loading.
  - Client batches impressions and sends them asynchronously to `POST /api/v1/listings/analytics/events` (`202 Accepted`).
  - Read queries for listing cards and summaries use `Listing.totalViews`, `totalImpressions`, and `totalFavorites` directly, ensuring $O(1)$ read complexity with zero joins on analytics history tables.
- **Optimistic Concurrency & Data Integrity:**
  - `ListingFavorite` uses composite unique `(userId, listingId)` ensuring a user can never bookmark the same listing multiple times.
  - Daily metric upserts use atomic `ON CONFLICT (listing_id, date) DO UPDATE SET ...` to guarantee exact counts even under concurrent traffic spikes.

### Source Tree Components to Touch

#### Updates to Existing Files
- `apps/api/prisma/schema.prisma` — Add `totalViews`, `totalImpressions`, `totalFavorites` to `Listing`, add models `ListingDailyMetric` and `ListingFavorite`.
- `packages/shared/src/enums/index.ts` — Add `ListingEngagementEventType`.
- `packages/shared/src/schemas/listing.schema.ts` — Add engagement batch and analytics Zod schemas.
- `packages/shared/src/types/listing.ts` — Add analytics interfaces and extend `ListingSummaryItem` / `ListingDetailResponse`.
- `apps/api/src/modules/listings/listings.controller.ts` — Add `/analytics/events`, `/:id/favorite`, and `/:id/analytics` routes.
- `apps/api/src/modules/listings/listings.service.ts` — Implement engagement batch processing, favorite toggle, and seller analytics methods.
- `apps/api/src/modules/listings/admin-listings.controller.ts` — Add `/admin/listings/analytics/overview` route.
- `apps/api/src/modules/listings/admin-listings.service.ts` — Implement platform-wide global engagement aggregations.
- `apps/web/src/components/listings/property-card.tsx` — Integrate viewport observer and favorite toggle action.
- `apps/web/src/app/app/marketer/page.tsx` — Add engagement stats and listing metrics chips.
- `apps/web/src/app/app/owner/page.tsx` — Add engagement stats and listing metrics chips.
- `apps/web/src/components/admin/listing-moderation-queue.tsx` — Add link/tab to analytics overview.

#### New Files to Create
- `apps/web/src/hooks/use-listing-analytics.ts` — Client-side batched engagement tracking hook.
- `apps/web/src/app/admin/listings/analytics/page.tsx` — Admin global engagement analytics dashboard.
- `packages/shared/src/schemas/__tests__/listing-analytics.spec.ts` — Shared schema unit tests.
- `apps/api/src/modules/listings/__tests__/listings-analytics.spec.ts` — API listing analytics unit tests.
- `apps/api/src/modules/listings/__tests__/admin-listings-analytics.spec.ts` — API admin analytics unit tests.
- `apps/web/src/components/listings/__tests__/property-card-analytics.spec.tsx` — PropertyCard analytics test.
- `apps/web/src/app/app/marketer/__tests__/marketer-analytics.spec.tsx` — Marketer analytics UI test.
- `apps/web/src/app/admin/listings/__tests__/admin-analytics-page.spec.tsx` — Admin analytics UI test.

### Testing Standards Summary

- **Unit & Integration Test Coverage:**
  - 100% test coverage on Zod validation schemas (`packages/shared`).
  - Comprehensive service tests for `recordBatchEngagement`, `toggleFavorite`, and `getListingAnalytics` verifying isolation, transaction rollback, and PDPL compliance.
  - Controller tests verifying permission decorators (`Reports.Analytics`, `Listings.Review`) and HTTP status codes (`202 Accepted` for events).
  - Frontend component tests verifying `IntersectionObserver` trigger, debounced batch dispatch, and favorite toggle optimistic rendering.

### Project Structure Notes

- Alignment with NestJS modular architecture under `apps/api/src/modules/listings/`.
- Strict typing shared across monorepo packages (`@elmasaif/shared`).
- Sovereign design system compliance in `apps/web` with RTL layout, Arabic typography, and dark mode support.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.7]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-67]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-7]
- [Source: _bmad-output/implementation-artifacts/2-6-listing-archiving-suspension-compliance-blocking.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

None.

### Completion Notes List

- Implemented full privacy-preserving analytics architecture strictly adhering to Saudi Personal Data Protection Law (PDPL): absolutely no visitor identifiers, IPs, or cookies stored.
- Added database models `ListingDailyMetric` and `ListingFavorite` in `apps/api/prisma/schema.prisma` with high-performance lifetime counters `totalViews`, `totalImpressions`, `totalFavorites` on `Listing`.
- Created shared validation schemas, enums, and TypeScript interfaces in `packages/shared`.
- Implemented asynchronous event ingestion batch pipeline `POST /api/v1/listings/analytics/events` (`202 Accepted`) with non-blocking resilience.
- Implemented atomic favorite bookmark toggling `POST /api/v1/listings/:id/favorite` with lifetime and daily counters sync.
- Implemented seller listing analytics endpoint `GET /api/v1/listings/:id/analytics` and admin global engagement analytics `GET /api/v1/admin/listings/analytics/overview`.
- Built client-side batched engagement tracking hook `useListingAnalytics` in `apps/web/src/hooks/use-listing-analytics.ts` with timer and `sendBeacon` / `pagehide` flushing.
- Integrated `IntersectionObserver` in `PropertyCard` for impression tracking (>=50% visible for 1s) and optimistic favorite bookmarking.
- Updated Marketer and Owner dashboards with 4 engagement chips (views, impressions, favorites, offer conversion ratio) and expandable 7-day trend breakdown.
- Built Admin back-office engagement analytics dashboard (`/admin/listings/analytics`) with platform overview cards, 30-day engagement histogram, and top 10 engaged properties table.
- Monorepo regression suites 100% passing: 20/20 test files in `@elmasaif/shared`, 44/44 test suites in `api`, and 37/37 test suites in `web`.

### File List

- `packages/shared/src/enums/index.ts`
- `packages/shared/src/schemas/listing.schema.ts`
- `packages/shared/src/types/listing.ts`
- `packages/shared/src/schemas/__tests__/listing-analytics.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`
- `apps/api/src/modules/auth/guards/admin-permission.guard.ts`
- `apps/api/src/modules/listings/listings.controller.ts`
- `apps/api/src/modules/listings/listings.service.ts`
- `apps/api/src/modules/listings/admin-listings.controller.ts`
- `apps/api/src/modules/listings/admin-listings.service.ts`
- `apps/api/src/modules/listings/__tests__/listings-analytics.spec.ts`
- `apps/api/src/modules/listings/__tests__/admin-listings-analytics.spec.ts`
- `apps/web/src/hooks/use-listing-analytics.ts`
- `apps/web/src/components/listings/property-card.tsx`
- `apps/web/src/components/listings/seller-listing-engagement.tsx`
- `apps/web/src/components/listings/index.ts`
- `apps/web/src/components/admin/listing-moderation-queue.tsx`
- `apps/web/src/app/app/marketer/page.tsx`
- `apps/web/src/app/app/owner/page.tsx`
- `apps/web/src/app/admin/listings/analytics/page.tsx`
- `apps/web/src/components/listings/__tests__/property-card-analytics.spec.tsx`
- `apps/web/src/app/app/marketer/__tests__/marketer-analytics.spec.tsx`
- `apps/web/src/app/admin/listings/__tests__/admin-analytics-page.spec.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-7-listing-view-engagement-analytics.md`

### Change Log

- 2026-11-03: Story 2.7 completed — listing view & engagement analytics fully implemented, tested, and marked ready for review.

