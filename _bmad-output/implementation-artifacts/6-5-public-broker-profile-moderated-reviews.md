---
baseline_commit: fe8b3225d0d192ebaf69227d176e93de01276065
---

# Story 6.5: Public Broker Profile & Moderated Reviews

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a buyer or market participant,
I want to view a marketer's verified public profile with average ratings and moderated reviews,
so that I can assess their track record, completed transaction history, and professional reputation before submitting purchase offers.

## Acceptance Criteria

1. **Public Broker Profile View & Verification Header (`/brokers/:id`) (`FR-19`, `BR-06`, `UC-30`, `UJ-1`):**
   - **Given** any visitor (authenticated buyer or unauthenticated guest) navigating to `/brokers/:id`
   - **When** the page renders
   - **Then** it retrieves the public profile data by broker profile ID (or user ID associated with an active `MARKETER` profile)
   - **And** renders an institutional profile header displaying:
     - Commercial name (`FalLicense.commercialName` or fallback to `User.fullName`)
     - Verified Fal status badge (`مرخص وموثق من فال REGA`) with official license number (`FalLicense.licenseNumber`) when `FalLicense.status === ACTIVE`
     - Membership duration / join date in Arabic locale (`عضو منذ ...`)
     - Headline reputation score with gold star display (1-5 stars) and total reviews count
     - Summary counters: Completed deals count (`DealStatus.COMPLETED`) and active published listings count (`ListingStatus.ACTIVE`)
   - **And** strictly conceals personal contact information: direct phone number (`mobileNumber`) and email address (`email`) are NEVER exposed in the public API response or rendered on the page (`BR-06`).

2. **Reputation Metrics & Rating Distribution (`FR-19`, `FR-52`, `FR-54`):**
   - **Given** the public broker profile API query
   - **When** computing seller reputation metrics
   - **Then** the metrics are derived strictly from active, non-hidden ratings (`Rating.targetUserId === marketer.userId` AND `Rating.isHidden === false`):
     - **Average Rating (`averageRating`)**: Computed as `(sum of scores / total non-hidden reviews)`, rounded to 1 decimal place (e.g., `4.8`). If 0 reviews, returns `null` or `0.0`.
     - **Total Reviews (`totalReviews`)**: Count of all non-hidden ratings.
     - **Rating Distribution Breakdown (`ratingDistribution`)**: Distinct counts and percentages for each star bucket (`5`, `4`, `3`, `2`, `1`).
     - **Completed Deals Count (`completedDealsCount`)**: Count of deals where `sellerProfileId === brokerProfile.id` and `status === COMPLETED`.
     - **Active Listings Count (`activeListingsCount`)**: Count of listings where `sellerProfileId === brokerProfile.id` and `status === ACTIVE`.

3. **Active Listings Portfolio Section (`FR-17`, `FR-19`):**
   - **Given** the public broker profile page
   - **When** viewing the "العقارات المعروضة" (Active Listings) tab/section
   - **Then** renders a responsive grid of active properties marketed by this broker
   - **And** reuses the standardized `PropertyCard` component displaying 16:9 media carousel, single ask price (`SAR`), property type badge, city/district location pills, specifications (area, bedrooms), and favorite bookmark trigger
   - **And** clicking any card navigates to `/properties/:id`
   - **And** displays an institutional empty state when the broker has no active properties currently on the market ("لا توجد عقارات معروضة حالياً لهذا الوسيط").

4. **Public Deal Reviews & Counterparty Masking (`FR-19`, `FR-32`, `FR-52`):**
   - **Given** the public broker profile page
   - **When** viewing the "تقييمات وآراء المشترين" (Buyer Reviews) section
   - **Then** renders a chronological feed of approved reviews sorted by newest first (`createdAt DESC`)
   - **And** for each review, displays:
     - Star score (1-5 gold stars)
     - Timestamp formatted in Arabic (e.g., "منذ أسبوعين" or localized date string)
     - Qualitative feedback comment (optional, up to 500 characters)
     - Masked buyer identity (`rater.maskedName`, e.g., `ط*** ش***` or pseudonym) ensuring buyer privacy (`FR-32`) while proving authentic deal execution
   - **And** displays an empty state if no reviews have been submitted yet ("لا توجد تقييمات معتمدة لهذا الوسيط حتى الآن").

5. **Exclusion of Moderated / Hidden Reviews (`FR-19`, `FR-52`, `ARCHITECTURE-SPINE.md`):**
   - **Given** reviews that have been hidden by administrators with `Reviews.Moderate` permission (`Rating.isHidden === true`)
   - **When** any public visitor or API client requests the broker profile or reviews
   - **Then** hidden reviews are strictly excluded from:
     - The public reviews list
     - The average star rating calculation
     - The total review count and star distribution breakdown
   - **And** the underlying database rows remain permanently preserved for administrative audit and restoration purposes.

6. **Backend Public Broker Profile API (`apps/api`) (`FR-19`):**
   - **Given** a request to `GET /api/v1/brokers/:id`
   - **When** the endpoint executes
   - **Then** it is public (no auth token required) and accepts either a `UserProfile.id` (with `role === MARKETER`) or a `User.id`
   - **And** returns HTTP 200 with the structured payload:
     ```json
     {
       "statusCode": 200,
       "data": {
         "id": "profile-uuid",
         "userId": "user-uuid",
         "commercialName": "مؤسسة الأفق العقارية",
         "fullName": "محمد الشمري",
         "createdAt": "2026-01-15T10:00:00.000Z",
         "isFalVerified": true,
         "falLicense": {
           "licenseNumber": "1200012345",
           "status": "ACTIVE",
           "expiryDate": "2027-05-20T00:00:00.000Z"
         },
         "stats": {
           "averageRating": 4.8,
           "totalReviews": 15,
           "completedDealsCount": 24,
           "activeListingsCount": 6,
           "ratingDistribution": {
             "5": 12,
             "4": 2,
             "3": 1,
             "2": 0,
             "1": 0
           }
         },
         "reviews": [
           {
             "id": "rating-uuid",
             "score": 5,
             "comment": "وسيط متميز وملتزم بالأنظمة وسرعة إتمام الإفراغ.",
             "createdAt": "2026-10-02T12:00:00.000Z",
             "rater": {
               "maskedName": "أ*** ع***"
             }
           }
         ],
         "activeListings": []
       }
     }
     ```
   - **And** returns HTTP 404 with code `BROKER_NOT_FOUND` if the profile is missing or does not represent a marketer.

7. **Deal Rating Submission Endpoint (`FR-54`, `UC-30`):**
   - **Given** an authenticated buyer on a completed deal
   - **When** submitting `POST /api/v1/deals/:id/ratings` with payload `{ score: number, comment?: string }`:
   - **Then** endpoint verifies:
     - The deal status is `COMPLETED` (`DealStatus.COMPLETED`)
     - The caller is the authentic buyer (`deal.buyerProfile.userId === req.user.id`)
     - No rating already exists for this deal (`Rating.dealId` uniqueness constraint)
     - `score` is an integer between 1 and 5
     - `comment` is optional, max 500 characters
   - **And** persists the `Rating` with `raterUserId = req.user.id`, `targetUserId = deal.sellerProfile.userId`, `isHidden = false`
   - **And** returns HTTP 201 Created with the saved rating payload.

8. **Administrative Review Moderation Endpoint (`FR-52`, `UC-69`):**
   - **Given** an administrator authenticated with `AdminSessionAuthGuard` and `@RequireAdminPermission('Reviews.Moderate')`
   - **When** calling `PATCH /api/v1/admin/reviews/:id/moderation` with `{ isHidden: boolean, reason: string }`:
   - **Then** endpoint updates the `Rating` record:
     - `isHidden` is set to the submitted boolean value
     - `hiddenByAdminId = admin.id`
     - `hiddenAt = ClockService.now()`
     - `hiddenReason = reason`
   - **And** creates an immutable record in `AuditLog` capturing previous vs new visibility and administrative justification
   - **And** returns HTTP 200 with the updated rating record.

9. **Linkage from Property Details to Public Broker Profile (`FR-17`, `FR-19`):**
   - **Given** a buyer inspecting a property on `/properties/:id`
   - **When** viewing the seller/broker information card
   - **Then** renders the verified broker's commercial name, Fal badge, and star rating with a clear clickable link navigating to `/brokers/${sellerProfile.id}`.

10. **Sovereign Design System & RTL Accessibility (`NFR12`, `UX-DR15`):**
    - Adheres strictly to the Sovereign Design System: RTL flow (`dir="rtl"`), IBM Plex Sans Arabic font, gold accent stars (`#D97706`), emerald verification badge (`#059669`), and semantic contrast tokens.
    - Fully responsive across mobile, tablet, and desktop viewports.

## Tasks / Subtasks

- [x] Task 1: Shared Types & DTO Contracts (`packages/shared`) (AC: #2, #6, #7, #8)
  - [x] Subtask 1.1: Define `BrokerPublicProfileDto`, `BrokerStatsDto`, `BrokerReviewItemDto`, and `RatingDistribution` in `packages/shared/src/types/broker.ts` (or `user.ts`).
  - [x] Subtask 1.2: Define `SubmitDealRatingInput` and `submitDealRatingSchema` (score 1-5 integer, comment optional max 500 chars) in `packages/shared/src/schemas/deal.ts` (or `review.ts`).
  - [x] Subtask 1.3: Define `ModerateReviewInput` and `moderateReviewSchema` (isHidden boolean, reason string min 3 chars) in `packages/shared/src/schemas/admin.ts`.
  - [x] Subtask 1.4: Re-export all new contracts in `packages/shared/src/index.ts`.

- [x] Task 2: Backend Public Broker Profile & Moderation APIs (`apps/api`) (AC: #1, #2, #5, #6, #8)
  - [x] Subtask 2.1: Create `BrokersService` in `apps/api/src/modules/users/brokers.service.ts` (or `apps/api/src/modules/brokers/brokers.service.ts`).
  - [x] Subtask 2.2: Implement `getBrokerPublicProfile(id: string)`:
    - Resolve marketer `UserProfile` with attached `User`, `FalLicense`, completed `Deal` count, and active `Listing` array.
    - Query `Rating` records where `targetUserId === marketer.userId` and `isHidden === false`.
    - Compute average score, total reviews, and 5-tier star distribution.
    - Mask buyer names (`ط*** ش***`) and sanitize all private contact details (`mobileNumber`, `email`, `nationalId`, `payoutIban`).
  - [x] Subtask 2.3: Create `BrokersController` with public endpoint `GET /api/v1/brokers/:id`.
  - [x] Subtask 2.4: Implement administrative review moderation endpoint `PATCH /api/v1/admin/reviews/:id/moderation` in `AdminReviewsController` (or `AdminUsersController`) with `@RequireAdminPermission('Reviews.Moderate')` and `AuditLog` emission.

- [x] Task 3: Backend Deal Rating Submission API (`apps/api`) (AC: #7)
  - [x] Subtask 3.1: Add `submitDealRating(dealId, buyerUserId, input)` in `BuyerDealsService`.
  - [x] Subtask 3.2: Verify deal is `COMPLETED`, caller is buyer, and deal has no existing rating.
  - [x] Subtask 3.3: Expose `POST /api/v1/deals/:id/ratings` in `BuyerDealsController` protected by `SessionAuthGuard` and `@RequireRole(UserRole.BUYER)`.
  - [x] Subtask 3.4: Write comprehensive unit/integration test suite in `apps/api/src/modules/users/__tests__/brokers.spec.ts` and `apps/api/src/modules/deals/__tests__/deal-ratings.spec.ts`.

- [x] Task 4: Frontend Broker Public Profile UI Components (`apps/web`) (AC: #1, #2, #3, #4, #10)
  - [x] Subtask 4.1: Create `apps/web/src/components/brokers/broker-profile-header.tsx` with commercial name, verified Fal badge, join date, deals tally, and headline rating stars.
  - [x] Subtask 4.2: Create `apps/web/src/components/brokers/broker-ratings-breakdown.tsx` with average score card and distribution progress bars (5 to 1 stars).
  - [x] Subtask 4.3: Create `apps/web/src/components/brokers/broker-reviews-list.tsx` rendering customer feedback cards with gold stars, masked buyer identities, and empty state.
  - [x] Subtask 4.4: Create `apps/web/src/components/brokers/broker-listings-grid.tsx` reusing `PropertyCard` for the broker's active properties.
  - [x] Subtask 4.5: Export components from `apps/web/src/components/brokers/index.ts`.

- [x] Task 5: Public Broker Page & Cross-Surface Linkage (`apps/web`) (AC: #1, #9)
  - [x] Subtask 5.1: Create public page route `apps/web/src/app/brokers/[id]/page.tsx` rendering header, stats breakdown, listings grid, and reviews list inside `LayoutShell`.
  - [x] Subtask 5.2: Update `apps/web/src/app/properties/[id]/listing-detail-view.tsx` to link the seller section to `/brokers/${sellerProfile.id}`.

- [x] Task 6: Automated Verification & Testing (`apps/web` & `apps/api`) (AC: #1-#10)
  - [x] Subtask 6.1: API Tests: Verify public profile retrieval, hidden review exclusion from average/list, 404 for non-marketers, and deal rating creation.
  - [x] Subtask 6.2: Web Component Tests: Create `apps/web/src/app/brokers/[id]/__tests__/broker-public-profile.spec.tsx` verifying SSR rendering, Fal badge display, ratings breakdown, and phone/email concealment.
  - [x] Subtask 6.3: Run Vitest and Jest suites to ensure zero regressions across web and api workspaces.

## Dev Notes

### Architecture Compliance & Data Flow

- **Public Route**: `/brokers/:id` (No authentication required; accessible to any visitor).
- **Backend Endpoint**: `GET /api/v1/brokers/:id`
- **Data Model Mapping**:
  ```
  UserProfile (id, role = MARKETER)
    ├── User (id, fullName, username)
    │     └── receivedRatings (model Rating, where isHidden == false)
    ├── FalLicense (licenseNumber, commercialName, status = ACTIVE, expiryDate)
    ├── listings (where status == ACTIVE)
    └── sellerDeals (where status == COMPLETED)
  ```
- **Concealment Guardrail (`BR-06`)**:
  - `User.mobileNumber` and `User.email` MUST NEVER be exposed.
  - `User.nationalId` and `UserProfile.payoutIban` MUST NEVER be exposed.
  - The API response object MUST explicitly whitelist only sanitized public fields.

### Review Moderation Guardrails (`FR-19`, `FR-52`)

- The `Rating` table contains:
  ```prisma
  model Rating {
    id              String    @id @default(uuid())
    dealId          String    @unique
    raterUserId     String
    targetUserId    String
    score           Int
    comment         String?
    isHidden        Boolean   @default(false)
    hiddenByAdminId String?
    hiddenAt        DateTime?
    hiddenReason    String?
    createdAt       DateTime  @default(now())
    ...
  }
  ```
- Any public query for ratings or broker statistics MUST include `{ isHidden: false }`.
- When an admin with `Reviews.Moderate` calls `PATCH /api/v1/admin/reviews/:id/moderation`, the review's `isHidden` flag is updated, and an `AuditLog` row is created.

### Buyer Identity Masking (`FR-32`)

- Buyer identities in reviews MUST be masked to preserve privacy:
  - If buyer full name is "طارق الشمري", masked representation is `ط*** ش***`.
  - Helper utility `maskArabicName(name: string)` can be shared across backend and frontend.

### Reusable Components

- **Listing Cards**: Reuse `PropertyCard` from `apps/web/src/components/listings/property-card.tsx`.
- **Layout**: Reuse `LayoutShell` from `apps/web/src/components/layout`.
- **Badges & Cards**: Reuse `Badge`, `Card`, `EmptyState` from `apps/web/src/components/ui`.

### Files Being Modified & Created

| File | Nature | Purpose |
|------|--------|---------|
| `packages/shared/src/types/broker.ts` | **NEW** | DTO interfaces for public broker profile, stats, ratings, and reviews. |
| `packages/shared/src/schemas/review.ts` (or `deal.ts`) | **NEW / UPDATE** | Zod schemas for rating submission and admin review moderation. |
| `packages/shared/src/index.ts` | **UPDATE** | Export new broker types and review schemas. |
| `apps/api/src/modules/users/brokers.service.ts` | **NEW** | Service retrieving broker profile, computing stats, and masking reviewers. |
| `apps/api/src/modules/users/brokers.controller.ts` | **NEW** | Public endpoint `GET /brokers/:id`. |
| `apps/api/src/modules/deals/buyer-deals.service.ts` | **UPDATE** | Add `submitDealRating` for completed deals. |
| `apps/api/src/modules/deals/buyer-deals.controller.ts` | **UPDATE** | Add `POST /deals/:id/ratings` endpoint. |
| `apps/api/src/modules/users/admin-reviews.controller.ts` | **NEW** | Admin moderation endpoint `PATCH /admin/reviews/:id/moderation`. |
| `apps/api/src/modules/users/users.module.ts` | **UPDATE** | Register `BrokersService`, `BrokersController`, `AdminReviewsController`. |
| `apps/api/src/modules/users/__tests__/brokers.spec.ts` | **NEW** | Unit/integration tests for broker profile & rating calculations. |
| `apps/web/src/components/brokers/broker-profile-header.tsx` | **NEW** | Header component with commercial name, Fal badge, and summary KPIs. |
| `apps/web/src/components/brokers/broker-ratings-breakdown.tsx` | **NEW** | Rating breakdown card with 1-5 star distributions. |
| `apps/web/src/components/brokers/broker-reviews-list.tsx` | **NEW** | Reviews feed with masked buyer identities and empty states. |
| `apps/web/src/components/brokers/broker-listings-grid.tsx` | **NEW** | Grid displaying active properties using `PropertyCard`. |
| `apps/web/src/components/brokers/index.ts` | **NEW** | Barrel export for broker components. |
| `apps/web/src/app/brokers/[id]/page.tsx` | **NEW** | Public page route for marketer profile. |
| `apps/web/src/app/brokers/[id]/__tests__/broker-public-profile.spec.tsx` | **NEW** | Web component/page test suite for public broker profile. |
| `apps/web/src/app/properties/[id]/listing-detail-view.tsx` | **UPDATE** | Add broker profile link to seller details card. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | **UPDATE** | Update status tracking for story 6.5. |

### Previous Story Intelligence & Learnings

- From **Story 6.1**: `FalLicense` has `commercialName`, `licenseNumber`, `status`, `expiryDate`.
- From **Story 6.4**: Marketer operational dashboard queries listings and deals. The seller profile is `UserProfile` where `role === 'MARKETER'`.
- From **Story 5.4**: A deal reaches `DealStatus.COMPLETED` when both payments are verified. That is the exact moment buyer rating submission is unlocked (`FR-54`).
- From **Story 2.3**: `PropertyCard` requires `ListingSummaryItem`.
- From **Story 4.4 & 5.6**: Masking names with `ط*** ش***` follows established privacy conventions (`FR-32`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5: Public Broker Profile & Moderated Reviews]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-19: Seller Public Profile & Reputation (with Review Moderation)]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-52: Review Moderation & Audit Preservation]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-54: Buyer Rating Submission on Completed Deals]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#5. Review Moderation (Rating)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#9. Review Moderation Card & Rating Display]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Journey 2: Sara Onboards as a Fal-Certified Marketer]
- [Source: _bmad-output/implementation-artifacts/6-4-marketer-unified-operational-dashboard.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium) / Antigravity Agent

### Debug Log References

- Verified that `Rating` model exists in `apps/api/prisma/schema.prisma` with `raterUserId`, `targetUserId`, `dealId`, `score`, `comment`, `isHidden`, `hiddenByAdminId`, `hiddenAt`, `hiddenReason`.
- Added `maskArabicName` in `packages/shared/src/masking/name-mask.ts` supporting standard Arabic names and prefix stripping ("الشمري" -> "ش***").
- Added `moderateReviewSchema` and `ModerateReviewInput` in `packages/shared/src/schemas/review.schema.ts`.
- Added broker types in `packages/shared/src/types/broker.ts` (`BrokerPublicProfileDto`, `BrokerStatsDto`, `BrokerReviewItemDto`, `RatingDistribution`).
- Implemented `BrokersService` with public profile resolution (by profile ID or user ID), review aggregation, strict field sanitization (excluding mobile, email, nationalId, IBAN), and review moderation with `AuditLog` records.
- Implemented `BrokersController` (`GET /api/v1/brokers/:id`) and `AdminReviewsController` (`PATCH /api/v1/admin/reviews/:id/moderation` with `@RequireAdminPermission('Reviews.Moderate')`).
- Implemented `BuyerDealsController` support for `POST /api/v1/deals/:id/ratings` alongside `:id/rating`.
- Implemented frontend broker components: `BrokerProfileHeader`, `BrokerRatingsBreakdown`, `BrokerReviewsList`, `BrokerListingsGrid` under `apps/web/src/components/brokers/`.
- Created public page route `apps/web/src/app/brokers/[id]/page.tsx` and linked seller info card in `apps/web/src/app/properties/[id]/listing-detail-view.tsx` to `/brokers/${sellerProfile.id}`.

### Completion Notes List

- All Acceptance Criteria #1-#10 satisfied:
  - AC-1: Institutional broker header at `/brokers/:id` with commercial name, verified Fal badge (`مرخص وموثق من فال REGA`), join date, and completed deals / active listings counters. Contact concealment (`BR-06`) enforced: zero exposure of phone or email.
  - AC-2: Seller reputation metrics derived exclusively from non-hidden reviews (`isHidden: false`), with average rating rounded to 1 decimal place, total reviews, and 5-tier star distribution.
  - AC-3: Active listings portfolio rendered using `PropertyCard` with empty state when broker has 0 active listings.
  - AC-4: Public deal reviews rendered chronologically with masked buyer identity (`rater.maskedName`, e.g., `ط*** ش***`) and qualitative feedback.
  - AC-5: Hidden reviews (`Rating.isHidden === true`) strictly excluded from public profile, average rating calculation, and reviews feed, while database rows are preserved for audit.
  - AC-6: Backend `GET /api/v1/brokers/:id` endpoint accepts either UserProfile.id or User.id, returns structured JSON, and returns 404 with code `BROKER_NOT_FOUND` if invalid.
  - AC-7: Buyer rating submission on completed deals supported at `POST /api/v1/deals/:id/ratings`.
  - AC-8: Administrative review moderation supported at `PATCH /api/v1/admin/reviews/:id/moderation` with `AdminSessionAuthGuard`, `@RequireAdminPermission('Reviews.Moderate')`, and `AuditLog` row creation.
  - AC-9: Linkage from `/properties/:id` seller details card to `/brokers/${sellerProfile.id}` verified.
  - AC-10: Sovereign Design System, RTL flow (`dir="rtl"`), and responsive styling verified.
- Unit & integration tests: 571 tests passing in `@elmasaif/shared`, 436 tests passing in `@elmasaif/web`, and all broker/deal ratings tests passing in `@elmasaif/api`.
- Zero build regressions: `@elmasaif/shared`, `@elmasaif/api`, and `@elmasaif/web` builds completed successfully.

### File List

- `packages/shared/src/types/broker.ts` (NEW)
- `packages/shared/src/schemas/review.schema.ts` (NEW)
- `packages/shared/src/masking/name-mask.ts` (NEW)
- `packages/shared/src/masking/__tests__/name-mask.spec.ts` (NEW)
- `packages/shared/src/schemas/__tests__/review.spec.ts` (NEW)
- `packages/shared/src/masking/index.ts` (MODIFIED)
- `packages/shared/src/types/index.ts` (MODIFIED)
- `packages/shared/src/schemas/index.ts` (MODIFIED)
- `apps/api/src/modules/users/brokers.service.ts` (NEW)
- `apps/api/src/modules/users/brokers.controller.ts` (NEW)
- `apps/api/src/modules/users/admin-reviews.controller.ts` (NEW)
- `apps/api/src/modules/users/users.module.ts` (MODIFIED)
- `apps/api/src/modules/deals/buyer-deals.controller.ts` (MODIFIED)
- `apps/api/src/modules/users/__tests__/brokers.spec.ts` (NEW)
- `apps/api/src/modules/deals/__tests__/deal-ratings.spec.ts` (NEW)
- `apps/web/src/components/brokers/broker-profile-header.tsx` (NEW)
- `apps/web/src/components/brokers/broker-ratings-breakdown.tsx` (NEW)
- `apps/web/src/components/brokers/broker-reviews-list.tsx` (NEW)
- `apps/web/src/components/brokers/broker-listings-grid.tsx` (NEW)
- `apps/web/src/components/brokers/index.ts` (NEW)
- `apps/web/src/app/brokers/[id]/page.tsx` (NEW)
- `apps/web/src/app/brokers/[id]/__tests__/broker-public-profile.spec.tsx` (NEW)
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` (MODIFIED)
- `apps/web/src/app/properties/[id]/__tests__/listing-detail-page.spec.tsx` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)
- `_bmad-output/implementation-artifacts/6-5-public-broker-profile-moderated-reviews.md` (MODIFIED)

### Change Log

- 2026-11-11: Implemented Story 6.5 Public Broker Profile & Moderated Reviews (Tasks 1-6). Status transitioned to `review`.


