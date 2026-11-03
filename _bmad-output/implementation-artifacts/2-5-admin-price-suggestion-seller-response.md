---
baseline_commit: 0abc2cdde8637397716f4106d592970d822d9e93
---
# Story 2.5: Admin Price Suggestion & Seller Response

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrative moderator (`Price.Suggest` permission) inspecting an active or pending property listing,
I want to submit a formal price adjustment suggestion with market rationale without modifying the listing ask price directly (`BR-16`),
so that sellers (`MARKETER` or `OWNER`) receive structured valuation feedback and notifications while retaining ultimate pricing autonomy to accept or decline the proposed price.

## Acceptance Criteria

1. **Admin Price Suggestion Submission & Direct Price Edit Prohibition (`FR-57`, `BR-16`, `Price.Suggest`):**
   - **Given** an authenticated administrator with `Price.Suggest` permission (`MODERATOR` or `SUPER_ADMIN`) inspecting a listing in `PENDING_REVIEW` or `ACTIVE` status (`/admin/listings/:id/review`)
   - **When** the admin submits a suggested ask price (`suggestedPrice` between `1` and `50,000,000` SAR, different from the current `askPrice`) and explanatory market reasoning (`reason`, 10–1,000 chars) via `POST /api/v1/admin/listings/:id/suggest-price`
   - **Then** the backend verifies:
     1. The listing exists and is in `PENDING_REVIEW` or `ACTIVE` status (`409 Conflict` `LISTING_INVALID_STATE_TRANSITION` otherwise).
     2. The listing is not actively locked by a *different* administrator (`409 Conflict` `LISTING_LOCK_CONFLICT` if leased by another operator).
     3. The proposed `suggestedPrice` differs from the listing's current `askPrice` (`400 Bad Request` `PRICE_SUGGESTION_SAME_AS_CURRENT` if identical).
   - **And** within an atomic Prisma `$transaction`:
     - Any previous `PENDING` price suggestion on the same listing is marked `SUPERSEDED`.
     - A new `PriceSuggestion` record is created with `status = PriceSuggestionStatus.PENDING`, `currentAskPrice = listing.askPrice`, `suggestedPrice`, `reason`, `suggestedByAdminId = req.admin.id`, `suggestedByAdminName = req.admin.fullName`, and `createdAt = ClockService.now()`.
     - The listing's `askPrice` is **strictly untouched** (`BR-16` — admins can never directly alter `askPrice`).
     - An immutable `AuditLog` entry (`LISTING_PRICE_SUGGESTED`) is recorded capturing `currentAskPrice`, `suggestedPrice`, `reason`, and `suggestedByAdminId`.

2. **Seller Notification & Confidential Suggestion Visibility (`FR-44`, `FR-57`):**
   - **Given** a price suggestion has been submitted by an administrator on a listing
   - **When** the suggestion is saved
   - **Then** a structured notification is dispatched to the seller (via `EmailTransportService` if the seller has an email address, plus surfaced in-app on `GET /api/v1/listings/my` and `GET /api/v1/listings/:id` for the owning seller and admins) containing the listing title, `currentAskPrice`, `suggestedPrice`, and admin market `reason`
   - **And** public visitors and buyers calling `GET /api/v1/listings` or `GET /api/v1/listings/:id` **never** receive `activePriceSuggestion` or `priceSuggestions` history (strictly confidential to the listing's seller and authorized administrators).

3. **Seller Acceptance of Suggested Price (`FR-57`, `BR-13`):**
   - **Given** the authenticated seller (`listing.sellerProfile.userId === req.user.id`) viewing a `PENDING` price suggestion on their listing in the Marketer Dashboard (`/app/marketer`) or Owner Dashboard (`/app/owner`)
   - **When** the seller clicks "قبول السعر المقترح (Accept Suggested Price)" (`POST /api/v1/listings/:id/price-suggestions/:suggestionId/accept` with optional `sellerResponseNote`)
   - **Then** the backend verifies ownership (`403 Forbidden` `LISTING_ROLE_UNAUTHORIZED` if not the listing's seller), verifies the suggestion belongs to the listing and is in `PENDING` status (`409 Conflict` `PRICE_SUGGESTION_ALREADY_RESPONDED` otherwise), and verifies the listing is in `PENDING_REVIEW` or `ACTIVE` status
   - **And** within an atomic Prisma `$transaction`:
     - Updates `PriceSuggestion.status = PriceSuggestionStatus.ACCEPTED`, `respondedAt = ClockService.now()`, and `sellerResponseNote`.
     - Updates `Listing.askPrice = suggestion.suggestedPrice`, increments `Listing.version` by `1`, and sets `Listing.status = ListingStatus.PENDING_REVIEW` (following `BR-13` / `FR-57`: a major price edit on an `ACTIVE` listing returns it to `PENDING_REVIEW` for moderation confirmation, and a `PENDING_REVIEW` listing remains `PENDING_REVIEW` with the updated price).
     - Records an immutable `AuditLog` entry (`LISTING_PRICE_SUGGESTION_ACCEPTED`) with `previousAskPrice`, `newAskPrice`, `previousStatus`, `newStatus`, and `suggestionId`.

4. **Seller Decline of Suggested Price Without Penalty (`FR-57`):**
   - **Given** the authenticated seller (`listing.sellerProfile.userId === req.user.id`) viewing a `PENDING` price suggestion on their listing
   - **When** the seller clicks "رفض المقترح والاحتفاظ بالسعر الحالي (Decline Suggestion)" (`POST /api/v1/listings/:id/price-suggestions/:suggestionId/decline` with optional `sellerResponseNote`)
   - **Then** within an atomic Prisma `$transaction`:
     - Updates `PriceSuggestion.status = PriceSuggestionStatus.DECLINED`, `respondedAt = ClockService.now()`, and `sellerResponseNote`.
     - Preserves the listing's original `askPrice` and current `status` completely unchanged without penalty.
     - Records an immutable `AuditLog` entry (`LISTING_PRICE_SUGGESTION_DECLINED`) with `preservedAskPrice`, `suggestedPrice`, `sellerResponseNote`, and `suggestionId`.

5. **Admin & Seller UI Integration (`apps/web`):**
   - **Given** an administrator on `/admin/listings/[id]/review` or `/admin/listings/moderation`
   - **When** viewing a listing
   - **Then** the review screen displays a dedicated **اقتراح تعديل السعر الاسترشادي (`FR-57`)** panel showing any active/historical price suggestions (with status badge `بانتظار رد البائع PENDING`, `تم القبول ACCEPTED`, `تم الرفض DECLINED`, `تم استبداله SUPERSEDED`) and a form to submit a new `suggestedPrice` (in SAR, `JetBrains Mono`) and `reason` (disabled if locked by another admin or if admin lacks `Price.Suggest` permission)
   - **And** on `/app/marketer` and `/app/owner`, listings with a `PENDING` price suggestion display a prominent institutional notification card (**مقترح تعديل السعر من إدارة التقييم العقاري**) showing the current price, proposed price, percentage difference, market rationale, and interactive **قبول السعر المقترح** / **رفض المقترح** action controls.

## Tasks / Subtasks

- [x] **Task 1: Shared Enums, Constants, Zod Schemas & TypeScript Types (`packages/shared`)** (AC: #1, #2, #3, #4)
  - [x] 1.1 Add `PriceSuggestionStatus` enum (`PENDING`, `ACCEPTED`, `DECLINED`, `SUPERSEDED`) to `packages/shared/src/enums/index.ts`.
  - [x] 1.2 Update `packages/shared/src/constants/listing.ts` with price suggestion error codes:
    - `PRICE_SUGGESTION_NOT_FOUND = 'PRICE_SUGGESTION_NOT_FOUND'`
    - `PRICE_SUGGESTION_ALREADY_RESPONDED = 'PRICE_SUGGESTION_ALREADY_RESPONDED'`
    - `PRICE_SUGGESTION_SAME_AS_CURRENT = 'PRICE_SUGGESTION_SAME_AS_CURRENT'`
    - `PRICE_SUGGESTION_REASON_REQUIRED = 'PRICE_SUGGESTION_REASON_REQUIRED'`
  - [x] 1.3 Update `packages/shared/src/schemas/listing.schema.ts` with Zod schemas:
    - `createPriceSuggestionSchema`: `{ suggestedPrice: number (1..50,000,000 SAR), reason: string (trim, min 10, max 1000) }`
    - `respondPriceSuggestionSchema`: `{ sellerResponseNote?: string (trim, max 1000) }`
  - [x] 1.4 Update `packages/shared/src/types/listing.ts` with `PriceSuggestionItem`, `CreatePriceSuggestionInput`, and `RespondPriceSuggestionInput`, and add optional `activePriceSuggestion?: PriceSuggestionItem | null` and `priceSuggestions?: PriceSuggestionItem[]` to `ModerationQueueItem`, `ListingDetailResponse`, and `ListingSummaryItem`.
  - [x] 1.5 Add unit tests in `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts` validating `createPriceSuggestionSchema` and `respondPriceSuggestionSchema`.

- [x] **Task 2: Prisma Schema Model for `PriceSuggestion` (`apps/api/prisma`)** (AC: #1, #3, #4)
  - [x] 2.1 Add `enum PriceSuggestionStatus` (`PENDING`, `ACCEPTED`, `DECLINED`, `SUPERSEDED`) and `model PriceSuggestion` to `apps/api/prisma/schema.prisma`, linked to `Listing` (`priceSuggestions PriceSuggestion[]`).
  - [x] 2.2 Run `npx --workspace=apps/api prisma generate` (and `prisma db push` if local DB is running) so `@prisma/client` exports `PriceSuggestion` and `PriceSuggestionStatus`.

- [x] **Task 3: Backend Admin Price Suggestion & Seller Response Endpoints (`apps/api`)** (AC: #1, #2, #3, #4)
  - [x] 3.1 Update `AdminListingsService` (`apps/api/src/modules/listings/admin-listings.service.ts`):
    - Add `suggestListingPrice(listingId, admin, dto)`:
      - Verifies listing exists and status is `PENDING_REVIEW` or `ACTIVE`.
      - Verifies listing is not actively locked by another admin (`LISTING_LOCK_CONFLICT`).
      - Verifies `Number(dto.suggestedPrice) !== Number(listing.askPrice)` (`PRICE_SUGGESTION_SAME_AS_CURRENT`).
      - In `prisma.$transaction`: marks any existing `PENDING` suggestion on `listingId` as `SUPERSEDED`, creates new `PriceSuggestion` with `status: PENDING`, `currentAskPrice: listing.askPrice`, `suggestedPrice`, `reason`, `suggestedByAdminId: admin.id`, `suggestedByAdminName: admin.fullName`, `createdAt: clockService.now()`, and creates `AuditLog` (`LISTING_PRICE_SUGGESTED`). Never alters `listing.askPrice` (`BR-16`).
      - Dispatches notification email via `EmailTransportService.sendEmail` if seller has an email address.
    - Update `getModerationQueue` and `getAdminListingDetail` to include `activePriceSuggestion` and `priceSuggestions`.
  - [x] 3.2 Update `AdminListingsController` (`apps/api/src/modules/listings/admin-listings.controller.ts`):
    - Add `POST /api/v1/admin/listings/:id/suggest-price` guarded by `@RequireAdminPermission('Price.Suggest')`.
  - [x] 3.3 Update `ListingsService` (`apps/api/src/modules/listings/listings.service.ts`):
    - Update `getMyListings(userId)` and `getListingById(id, requesterUserId, requesterIsAdmin)` to include `activePriceSuggestion` and `priceSuggestions` **only** when `canViewPrivate` is true (seller or admin); strip/omit for public/buyer requests.
    - Add `acceptPriceSuggestion(listingId, suggestionId, userId, dto)`:
      - Verifies listing exists and `listing.sellerProfile.userId === userId` (`LISTING_ROLE_UNAUTHORIZED` otherwise).
      - Verifies listing status is `PENDING_REVIEW` or `ACTIVE` (`LISTING_INVALID_STATE_TRANSITION` otherwise).
      - Verifies suggestion exists for `listingId` and is `PENDING` (`PRICE_SUGGESTION_ALREADY_RESPONDED` otherwise).
      - In `prisma.$transaction`: updates suggestion to `ACCEPTED` (`respondedAt = clockService.now()`, `sellerResponseNote`), updates `Listing` (`askPrice = suggestion.suggestedPrice`, `status = ListingStatus.PENDING_REVIEW`, `version = { increment: 1 }`), and logs `LISTING_PRICE_SUGGESTION_ACCEPTED` to `AuditLog`.
    - Add `declinePriceSuggestion(listingId, suggestionId, userId, dto)`:
      - Verifies listing exists and `listing.sellerProfile.userId === userId`.
      - Verifies suggestion exists for `listingId` and is `PENDING`.
      - In `prisma.$transaction`: updates suggestion to `DECLINED` (`respondedAt = clockService.now()`, `sellerResponseNote`), leaves `Listing.askPrice` and `Listing.status` untouched, and logs `LISTING_PRICE_SUGGESTION_DECLINED` to `AuditLog`.
  - [x] 3.4 Update `ListingsController` (`apps/api/src/modules/listings/listings.controller.ts`):
    - Add `POST /api/v1/listings/:id/price-suggestions/:suggestionId/accept` guarded by `@UseGuards(SessionAuthGuard)`.
    - Add `POST /api/v1/listings/:id/price-suggestions/:suggestionId/decline` guarded by `@UseGuards(SessionAuthGuard)`.
  - [x] 3.5 Write comprehensive Jest unit tests in `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts`, `admin-listings.controller.spec.ts`, and `listings-price-suggestion.spec.ts` covering admin suggestion creation, `BR-16` price immutability, lock conflict checks, seller ownership validation, accept flow (`askPrice` update + `PENDING_REVIEW` transition), decline flow (`askPrice` preservation), and confidentiality from public buyers.

- [x] **Task 4: Frontend Admin Price Suggestion Panel & Seller Response Banner (`apps/web`)** (AC: #1, #2, #3, #4, #5)
  - [x] 4.1 Update `apps/web/src/components/admin/listing-moderation-review.tsx` and `apps/web/src/components/admin/listing-moderation-queue.tsx`:
    - Add **اقتراح تعديل السعر الاسترشادي (`FR-57`)** card in `ListingModerationReview` allowing admins with `Price.Suggest` permission to submit `suggestedPrice` and `reason` via `POST /api/v1/admin/listings/:id/suggest-price`, and displaying the history of price suggestions with status badges (`PENDING`, `ACCEPTED`, `DECLINED`, `SUPERSEDED`).
    - Display a badge in `ListingModerationQueue` when a listing has an active `PENDING` price suggestion.
  - [x] 4.2 Create reusable `apps/web/src/components/listings/seller-price-suggestion-card.tsx` and integrate into `/app/marketer/page.tsx` and `/app/owner/page.tsx`:
    - Renders a prominent structured notification card when a seller's listing has a `PENDING` (or recently answered) price suggestion.
    - Displays `currentAskPrice`, `suggestedPrice` in `JetBrains Mono`, percentage difference, admin market `reason`, optional `sellerResponseNote` input, and **قبول السعر المقترح وتحديث الإعلان** / **رفض المقترح والاحتفاظ بالسعر الحالي** buttons.
  - [x] 4.3 Add Vitest SSR unit tests in `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx` and `apps/web/src/components/listings/__tests__/seller-price-suggestion-card.spec.tsx`.

## Dev Notes

### Architectural & Domain Guardrails
- **Admin Never Edits Ask Price Directly (`BR-16`, `FR-57`):** Under no circumstances may an administrator endpoint (`AdminListingsController` / `AdminListingsService`) directly update `Listing.askPrice`. Only the seller's explicit acceptance action (`POST /api/v1/listings/:id/price-suggestions/:suggestionId/accept`) updates `Listing.askPrice = suggestion.suggestedPrice`.
- **Major Edit Re-Moderation Rule (`BR-13`, `FR-57`):** Per `prd.md` FR-57 ("If the seller accepts, a price change follows BR-13 (major edit returns the listing to UnderReview)"), when a seller accepts a price suggestion on an `ACTIVE` listing, `Listing.askPrice` is updated to `suggestion.suggestedPrice` and `Listing.status` transitions to `ListingStatus.PENDING_REVIEW` (with `version` incremented by `1`) so moderation can verify and re-approve it. If the listing was already in `ListingStatus.PENDING_REVIEW`, it stays in `ListingStatus.PENDING_REVIEW` with the new `askPrice` and incremented `version`.
- **Confidentiality of Valuation Rationale:** `activePriceSuggestion` and `priceSuggestions` must **only** be returned when `canViewPrivate === true` (`isSeller || requesterIsAdmin`). Public marketplace buyers inspecting `GET /api/v1/listings` or `GET /api/v1/listings/:id` must never see administrative price suggestions or internal market rationale.
- **Deterministic Time (`AD-11`):** Always use `this.clockService.now()` for `createdAt`, `respondedAt`, and lock expiration comparisons. Never call `new Date()` without arguments in domain services.
- **RBAC Enforcement (`AD-12`):**
  - Submitting a price suggestion (`POST /api/v1/admin/listings/:id/suggest-price`) requires `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` and `@RequireAdminPermission('Price.Suggest')`. Both `SUPER_ADMIN` and `MODERATOR` already include `'Price.Suggest'` in `ADMIN_ROLE_PERMISSIONS` (`packages/shared/src/constants/auth.ts`).
  - Accepting or declining a price suggestion requires `@UseGuards(SessionAuthGuard)` and strict verification that `listing.sellerProfile.userId === req.user.id`.
- **Frontend SSR Testing Standard (`apps/web`):** `apps/web` uses Vitest with `renderToString` from `react-dom/server`. Avoid adjacent JSX interpolation expressions without template literals so assertions on rendered HTML strings remain deterministic in React 19.

### Current State of Files Being Modified (From Codebase Inspection)

1. **`packages/shared/src/enums/index.ts`, `constants/listing.ts`, `schemas/listing.schema.ts`, `types/listing.ts`:**
   - *Current state:* Defines `ListingStatus`, moderation lock constants (`LISTING_LOCK_*`), `createListingSchema`, `approveListingSchema`, `rejectListingSchema`, `forceUnlockListingSchema`, `ModerationQueueItem`, `ListingDetailResponse`, and `ListingSummaryItem`.
   - *What this story changes:* Adds `PriceSuggestionStatus` enum, `PRICE_SUGGESTION_*` error constants, `createPriceSuggestionSchema`, `respondPriceSuggestionSchema`, `PriceSuggestionItem` interface, and attaches optional `activePriceSuggestion` and `priceSuggestions` fields to listing response types.
   - *What must be preserved:* All existing schemas, bathroom-stripping transform on `createListingSchema`, and moderation lock types.

2. **`apps/api/prisma/schema.prisma`:**
   - *Current state:* `model Listing` (lines 328–366) has `askPrice Decimal @db.Decimal(12, 2)`, `status ListingStatus`, `version Int`, lock fields (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`), and rejection metadata (`rejectionReason`, `reviewedByAdminId`, `reviewedAt`).
   - *What this story changes:* Adds `enum PriceSuggestionStatus` and `model PriceSuggestion` (`@@map("price_suggestions")`) with relation `priceSuggestions PriceSuggestion[]` on `Listing`.
   - *What must be preserved:* All existing `Listing` columns, composite foreign key `[districtId, cityId]`, and indexes.

3. **`apps/api/src/modules/listings/admin-listings.service.ts` & `admin-listings.controller.ts`:**
   - *Current state:* Implements moderation queue listing, detail view with signed URLs, 15-minute claim lock (`claimListing`, `heartbeatListingLock`, `releaseListingLock`, `forceUnlockListing`), and `approveListing` / `rejectListing`.
   - *What this story changes:* Adds `suggestListingPrice(listingId, admin, dto)` in `AdminListingsService`, exposes `POST /api/v1/admin/listings/:id/suggest-price` with `@RequireAdminPermission('Price.Suggest')` in `AdminListingsController`, and includes `activePriceSuggestion` / `priceSuggestions` in `getModerationQueue` and `getAdminListingDetail`.
   - *What must be preserved:* All 15-minute task claim lock rules, lazy lock expiry via `ClockService.now()`, `Tasks.ForceUnlock`, and optimistic concurrency `version` checks on approve/reject.

4. **`apps/api/src/modules/listings/listings.service.ts` & `listings.controller.ts`:**
   - *Current state:* Implements `createListing`, `getPublicActiveListings`, `getMyListings`, `getListingById`, and `uploadMediaOrDocument`.
   - *What this story changes:* Adds `acceptPriceSuggestion` and `declinePriceSuggestion` methods and `POST :id/price-suggestions/:suggestionId/accept` and `POST :id/price-suggestions/:suggestionId/decline` endpoints; includes `activePriceSuggestion` and `priceSuggestions` in `getMyListings` and in `getListingById` when `canViewPrivate` is true.
   - *What must be preserved:* Public/buyer document visibility filtering (`ADMIN_ONLY` documents and price suggestions concealed from public/buyers) and quarantine upload pipeline.

5. **`apps/web/src/components/admin/listing-moderation-review.tsx`, `apps/web/src/app/app/marketer/page.tsx`, `apps/web/src/app/app/owner/page.tsx`:**
   - *Current state:* `ListingModerationReview` renders lock banners, property specs, `ADMIN_ONLY` documents, and Approve/Reject forms. `MarketerDashboardPage` and `OwnerDashboardPage` list seller properties with status badges and rejection reasons.
   - *What this story changes:* Adds the Admin Price Suggestion form & history section to `ListingModerationReview`, and renders `SellerPriceSuggestionCard` on seller listings in `MarketerDashboardPage` and `OwnerDashboardPage`.
   - *What must be preserved:* Existing lock countdown timer, 5-minute heartbeat, force-unlock modal, approve/reject forms, and dashboard stats.

### Project Structure Notes

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/enums/index.ts`
  - `packages/shared/src/constants/listing.ts`
  - `packages/shared/src/schemas/listing.schema.ts`
  - `packages/shared/src/types/listing.ts`
  - `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts`
- **Backend API (`apps/api`):**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/listings/admin-listings.service.ts`
  - `apps/api/src/modules/listings/admin-listings.controller.ts`
  - `apps/api/src/modules/listings/listings.service.ts`
  - `apps/api/src/modules/listings/listings.controller.ts`
  - `apps/api/src/modules/listings/listings.module.ts`
  - `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts`
  - `apps/api/src/modules/listings/__tests__/admin-listings.controller.spec.ts`
  - `apps/api/src/modules/listings/__tests__/listings-price-suggestion.spec.ts`
- **Frontend Web (`apps/web`):**
  - `apps/web/src/components/admin/listing-moderation-review.tsx`
  - `apps/web/src/components/admin/listing-moderation-queue.tsx`
  - `apps/web/src/components/listings/seller-price-suggestion-card.tsx`
  - `apps/web/src/app/app/marketer/page.tsx`
  - `apps/web/src/app/app/owner/page.tsx`
  - `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx`
  - `apps/web/src/components/listings/__tests__/seller-price-suggestion-card.spec.tsx`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 2.5: Admin Price Suggestion & Seller Response]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md`#FR-57: Administrative Price Suggestions & Seller Response]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#AD-2, #AD-8, #AD-10, #AD-11, #AD-12]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md`#Admin Back-Office & #3. Property Listing State Transitions]
- [Source: `_bmad-output/implementation-artifacts/2-4-listing-moderation-queue-with-15-minute-task-claim-locking.md`]

## Dev Agent Record

### Agent Model Used

Gemini 4 Argon (Medium)

### Debug Log References

### Completion Notes List

- Implemented Story 2.5: Admin Price Suggestion & Seller Response end-to-end conforming strictly to FR-57, BR-16, and BR-13.
- Shared package (`packages/shared`): Added `PriceSuggestionStatus` enum, `PRICE_SUGGESTION_*` error codes, `createPriceSuggestionSchema`, `respondPriceSuggestionSchema`, `PriceSuggestionItem` interface, and extended listing moderation and detail response types. 100% tests passing in `listing-moderation.spec.ts`.
- Prisma database schema (`apps/api/prisma`): Added `enum PriceSuggestionStatus` and `model PriceSuggestion` linked to `Listing` with proper indexes.
- Backend API (`apps/api`):
  - In `AdminListingsService`: implemented `suggestListingPrice` enforcing `Price.Suggest` permission, state validation (`PENDING_REVIEW` or `ACTIVE`), lock conflict prevention, `PRICE_SUGGESTION_SAME_AS_CURRENT` guard, atomic `SUPERSEDED` transition for prior pending suggestions, `BR-16` immutability of `askPrice`, and transactional email dispatch.
  - In `ListingsService`: implemented `acceptPriceSuggestion` and `declinePriceSuggestion` validating seller ownership, atomic transaction updating `PriceSuggestion.status`, updating `Listing.askPrice = suggestedPrice` and returning `ACTIVE` listing to `PENDING_REVIEW` (per `BR-13`), leaving ask price untouched on decline without penalty, and maintaining strict confidentiality of internal price suggestions from public visitors/buyers.
  - In controllers: exposed endpoints `POST /admin/listings/:id/suggest-price`, `POST /listings/:id/price-suggestions/:suggestionId/accept`, and `POST /listings/:id/price-suggestions/:suggestionId/decline`.
  - Comprehensive unit test coverage in `admin-listings.service.spec.ts`, `admin-listings.controller.spec.ts`, and `listings-price-suggestion.spec.ts` passing 100%.
- Frontend UI (`apps/web`):
  - In `ListingModerationReview`: added **اقتراح تعديل السعر الاسترشادي (FR-57)** card with price input in SAR, reason textarea, and chronological history with status badges (`PENDING`, `ACCEPTED`, `DECLINED`, `SUPERSEDED`).
  - In `ListingModerationQueue`: added `مقترح سعر معلّق` badge for listings with active pending suggestions.
  - Created reusable `SellerPriceSuggestionCard` with percentage difference indicator, market rationale, optional response note, and interactive accept/decline action buttons. Integrated into `MarketerDashboardPage` and `OwnerDashboardPage`.
  - Comprehensive SSR unit tests in `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx` and `apps/web/src/components/listings/__tests__/seller-price-suggestion-card.spec.tsx` passing 100%.

### File List

- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/listing.ts`
- `packages/shared/src/schemas/listing.schema.ts`
- `packages/shared/src/types/listing.ts`
- `packages/shared/src/schemas/__tests__/listing-moderation.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/listings/admin-listings.service.ts`
- `apps/api/src/modules/listings/admin-listings.controller.ts`
- `apps/api/src/modules/listings/listings.service.ts`
- `apps/api/src/modules/listings/listings.controller.ts`
- `apps/api/src/modules/listings/__tests__/admin-listings.service.spec.ts`
- `apps/api/src/modules/listings/__tests__/admin-listings.controller.spec.ts`
- `apps/api/src/modules/listings/__tests__/listings-price-suggestion.spec.ts`
- `apps/web/src/components/admin/listing-moderation-review.tsx`
- `apps/web/src/components/admin/listing-moderation-queue.tsx`
- `apps/web/src/components/listings/seller-price-suggestion-card.tsx`
- `apps/web/src/app/app/marketer/page.tsx`
- `apps/web/src/app/app/owner/page.tsx`
- `apps/web/src/components/admin/__tests__/listing-moderation.spec.tsx`
- `apps/web/src/components/listings/__tests__/seller-price-suggestion-card.spec.tsx`

