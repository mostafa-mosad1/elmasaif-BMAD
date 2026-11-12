---
baseline_commit: d02265d8951478a6a1e1d7e6b46251b7f5ae24d0
---

# Story 8.4: Review Moderation Workspace

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **administrator with `Reviews.Moderate` permission**,
I want **to review reported or submitted broker ratings and hide abusive or defamatory content (or restore previously hidden reviews)**,
so that **platform reputation data remains professional and accurate while preserving all underlying physical records and an immutable audit trail**.

## Acceptance Criteria

1. **AC1 — Shared Review Moderation Schemas, Constants & DTO Contracts (`@elmasaif/shared`):**
   - **Given** the administrative review moderation requirements in `FR-19`, `FR-52`, `AD-6`, `AD-8`, and `DESIGN.md` Component #9,
   - **When** shared contracts are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - Canonical review moderation constants: `REVIEW_MODERATION_MIN_REASON_LENGTH = 3`, `REVIEW_MODERATION_MAX_REASON_LENGTH = 500`, `REVIEW_VISIBILITY_FILTERS = ['ALL', 'VISIBLE', 'HIDDEN'] as const`, and status/error codes (`REVIEW_NOT_FOUND`, `REVIEW_HIDDEN`, `REVIEW_UNHIDDEN`, `REVIEWS_MODERATION_QUEUE_RETRIEVED`, `REVIEW_MODERATION_DETAIL_RETRIEVED`).
     - Zod validation schemas in `packages/shared/src/schemas/review.schema.ts`:
       - `moderateReviewSchema` (preserved from Story 6.5: `{ isHidden: boolean, reason: string (trimmed, min 3, max 500) }`).
       - `reviewModerationReasonSchema` (`{ reason: string (trimmed, min 3, max 500) }`) for explicit semantic `POST .../hide` and `POST .../restore` action endpoints (`AD-2`, `AD-8`).
       - `adminReviewQueueQuerySchema` supporting `visibility` (`'ALL' | 'VISIBLE' | 'HIDDEN'`, default `'ALL'`), `score` (optional integer `1..5`), `lowScoreOnly` (optional boolean for `1..2` star reviews), `targetUserId` (optional string), `search` (optional trimmed string max 120 chars), `page` (default `1`), and `limit` (default `20`, max `100`).
     - Shared TypeScript DTO interfaces in `packages/shared/src/types/broker.ts`:
       - `ReviewVisibilityFilter` (`'ALL' | 'VISIBLE' | 'HIDDEN'`)
       - `AdminReviewAuditEntryDto` (`id`, `action`: `'REVIEW_HIDDEN' | 'REVIEW_UNHIDDEN'`, `actorId`, `actorName`, `reason`, `previousIsHidden`, `isHidden`, `createdAt`, `ipAddress`)
       - `AdminReviewModerationItemDto` (`id`, `dealId`, `dealNumber`, `dealReferenceCode`, `listingId`, `listingTitle`, `score`, `comment`, `createdAt`, `isHidden`, `hiddenByAdminId`, `hiddenByAdminName`, `hiddenAt`, `hiddenReason`, `rater`: `{ id, fullName, maskedName }`, `targetBroker`: `{ userId, profileId, fullName, commercialName, licenseNumber, isFalVerified, publicAverageRating, publicVisibleReviewsCount }`)
       - `AdminReviewModerationDetailDto` (extends `AdminReviewModerationItemDto` with `auditTrail: AdminReviewAuditEntryDto[]`)
       - `AdminReviewModerationCountsDto` (`totalReviews`, `visibleReviews`, `hiddenReviews`, `lowScoreVisibleReviews`)
       - `AdminReviewModerationQueueResponseDto` (`serverTimestamp`, `counts: AdminReviewModerationCountsDto`, `items: AdminReviewModerationItemDto[]`, `meta: { total, page, limit, totalPages }`)
       - `AdminModerateReviewResponseDto` (`review: AdminReviewModerationItemDto`, `updatedBrokerStats: BrokerStatsDto`, `auditEntry: AdminReviewAuditEntryDto`)

2. **AC2 — Backend Review Moderation Queue, Detail & Audit History API (`GET /api/v1/admin/reviews` & `GET /api/v1/admin/reviews/:id`):**
   - **Given** an authenticated administrator holding `Reviews.Moderate` permission (`Support Team` or `Super Admin` per `AD-12`),
   - **When** the administrator calls `GET /api/v1/admin/reviews` or `GET /api/v1/admin/reviews/:id`,
   - **Then** `AdminReviewsController` and `BrokersService` enforce `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` and `@RequireAdminPermission('Reviews.Moderate')` and return:
     - For `GET /api/v1/admin/reviews`:
       - Summary KPI counts across all platform ratings (`totalReviews`, `visibleReviews` where `isHidden === false`, `hiddenReviews` where `isHidden === true`, and `lowScoreVisibleReviews` where `isHidden === false && score <= 2`).
       - Filtered, paginated list of ratings sorted by `createdAt DESC`, matching `visibility` (`ALL` / `VISIBLE` / `HIDDEN`), `score` (`1..5`), `lowScoreOnly` (`score <= 2`), `targetUserId`, and `search` (case-insensitive match across `comment`, `deal.dealNumber`, `deal.dealReferenceCode`, `raterUser.fullName`, `targetUser.fullName`, or `falLicense.commercialName`).
       - Resolved `hiddenByAdminName` from `AdminUser.fullName` for any moderated review.
       - Live recalculated `targetBroker.publicAverageRating` and `targetBroker.publicVisibleReviewsCount` computed strictly from non-hidden ratings (`isHidden === false`) so moderators see whether the review is included in or excluded from the broker's public score.
     - For `GET /api/v1/admin/reviews/:id`:
       - The full `AdminReviewModerationDetailDto` including `auditTrail` populated from `AuditLog` (`where: { entityType: 'Rating', entityId: id }`, ordered by `createdAt DESC`) with resolved `actorName` from `AdminUser.fullName`.
       - Returns HTTP `404 Not Found` with code `REVIEW_NOT_FOUND` if the rating ID does not exist.

3. **AC3 — Mandatory-Reason Hide/Restore Moderation, Public Average Recalculation & Immutable Audit Preservation (`FR-19`, `FR-52`, `AD-2`, `AD-6`, `AD-8`, `AD-11`):**
   - **Given** an administrator with `Reviews.Moderate` inspecting a rating,
   - **When** the administrator hides or restores a review via:
     - `PATCH /api/v1/admin/reviews/:id/moderation` with `{ isHidden: boolean, reason: string }` (Story 6.5 endpoint preserved for full backward compatibility), OR
     - `POST /api/v1/admin/reviews/:id/hide` with `{ reason: string }` (explicit semantic action endpoint per `AD-2` / `AD-8`), OR
     - `POST /api/v1/admin/reviews/:id/restore` with `{ reason: string }` (explicit semantic action endpoint per `AD-2` / `AD-8`),
   - **Then**:
     - Validation rejects missing or short reasons (`< 3` characters after trimming) with HTTP `400 Bad Request`.
     - Using `ClockService.now()` (never `new Date()` or `Date.now()` per `AD-11`), the `Rating` row is updated (`isHidden`, `hiddenByAdminId = admin.id`, `hiddenAt = now`, `hiddenReason = reason`) — physical `Rating` rows are **NEVER deleted** (`FR-52`, `AD-6`).
     - An append-only `AuditLog` record is written with `actorId: admin.id`, `actorType: 'ADMIN'`, `action: isHidden ? 'REVIEW_HIDDEN' : 'REVIEW_UNHIDDEN'`, `entityType: 'Rating'`, `entityId: ratingId`, `ipAddress`, `createdAt: now`, and `payload` containing `{ dealId, targetUserId, raterUserId, score, commentSnapshot, previousIsHidden, isHidden, reason, adminUsername }`.
     - Hidden reviews (`isHidden: true`) are immediately excluded from `GET /api/v1/brokers/:id` public reviews feed, `averageRating` calculation, `totalReviews` count, and 5-tier `ratingDistribution` breakdown, while restored reviews (`isHidden: false`) are immediately re-included.
     - The moderation endpoint response includes the updated review record alongside `updatedBrokerStats` (`averageRating`, `totalReviews`, `ratingDistribution`) reflecting the immediate recalculation.

4. **AC4 — Frontend Review Moderation Workspace (`/admin/reviews`, `DESIGN.md` Component #9, `EXPERIENCE.md`):**
   - **Given** an authorized administrator navigating to `/admin/reviews` in `apps/web`,
   - **When** the Review Moderation Workspace (`ReviewModerationWorkspace`) renders,
   - **Then** it adheres to the Sovereign Design System (`DESIGN.md` Component #9, RTL `dir="rtl"`, `IBM Plex Sans Arabic`, gold stars `#D97706` / `#C69C45`, emerald verified badges `#059669`) and provides:
     - **KPI Summary Cards:** Total Submitted Reviews (`إجمالي التقييمات المسجلة`), Publicly Included Reviews (`مُدرجة في العرض العام ومتوسط التقييم`), Hidden / Excluded Reviews (`محجوبة إدارياً ومستبعدة من المتوسط`), and Low-Score Visible Reviews (`تقييمات منخفضة (1-2 ★) معروضة`).
     - **Filter & Search Controls:**
       - Visibility filter tabs (`الكل`, `معروضة للعموم (نشطة)`, `محجوبة إدارياً`, `تقييمات منخفضة (1-2 نجوم)`).
       - Star rating filter pills (`الكل`, `5 ★`, `4 ★`, `3 ★`, `2 ★`, `1 ★`).
       - Search input filtering by comment text, deal number (`ELM-...`), broker commercial/full name, or buyer name.
     - **Review Moderation Cards (`DESIGN.md` #9):**
       - Displays 1–5 gold stars, score badge (`X / 5`), submission timestamp, qualitative review comment, buyer full name + masked public alias (`ط*** ش***`), deal reference pill (`dealNumber`), and target broker info (commercial name, Fal verification badge, link to `/brokers/:profileId`, and live public average rating & total visible reviews count).
       - **Inclusion / Exclusion Badge Indicator (`DESIGN.md` #9):**
         - Visible state (`isHidden === false`): Emerald pill `"مُدرج في التقييم العام ومتوسط الوسيط"`.
         - Hidden state (`isHidden === true`): Danger/Red pill `"محجوب إدارياً — مستبعد من العرض العام ومتوسط التقييم"` plus a moderation details box showing `hiddenByAdminName`, `hiddenAt`, and `hiddenReason`.
       - **Moderation Action Buttons & Mandatory Justification Modal (`DESIGN.md` #9):**
         - `"إخفاء التقييم"` (Hide Review) button on visible reviews and `"استعادة التقييم"` (Restore Review) button on hidden reviews.
         - Clicking opens a confirmation modal requiring a mandatory justification reason (`>= 3` characters, max 500 characters) with quick-select regulatory reason chips (e.g., `"ألفاظ مسيئة أو تشهير غير نظامي"`, `"محتوى كيدي أو غير مرتبط بالصفقة العقارية"`, `"تضمن بيانات تواصل شخصية مخالفة"`, or for restoration: `"تم التحقق من سلامة التقييم ومطابقته للضوابط"`), and disables submission until a valid reason is entered.
       - **Audit Trail Drawer / Panel:** Displays the immutable `AuditLog` history (`REVIEW_HIDDEN` / `REVIEW_UNHIDDEN`) for the selected review, showing actor name, timestamp, transition status, and recorded reason.
     - **Navigation Integration:** Links to `/admin/reviews` (`مراجعة وتدقيق التقييمات`) are added to `WorkspaceShell` (`apps/web/src/components/layout/workspace-shell.tsx`) and `AdminDashboardPage` (`apps/web/src/app/admin/page.tsx`) gated by `Reviews.Moderate` or `SUPER_ADMIN`.

5. **AC5 — Comprehensive Automated Tests & Zero-Regression Verification:**
   - **Given** the enhanced shared contracts, backend review moderation endpoints, and frontend `/admin/reviews` workspace,
   - **When** automated test suites run across `packages/shared`, `apps/api`, and `apps/web`,
   - **Then**:
     - `packages/shared` unit tests (`packages/shared/src/schemas/__tests__/review.spec.ts`) validate `moderateReviewSchema`, `reviewModerationReasonSchema`, and `adminReviewQueueQuerySchema`.
     - `apps/api` unit/integration tests (`apps/api/src/modules/users/__tests__/brokers.spec.ts`) validate `GET /api/v1/admin/reviews` (filtering by visibility, score, search, KPI counts, and live broker average calculation), `GET /api/v1/admin/reviews/:id` (including `auditTrail` from `AuditLog`), `PATCH /api/v1/admin/reviews/:id/moderation`, `POST /api/v1/admin/reviews/:id/hide`, and `POST /api/v1/admin/reviews/:id/restore` (verifying `ClockService.now()`, physical row preservation, `AuditLog` emission, and exclusion/re-inclusion in broker average ratings).
     - `apps/web` SSR component tests (`apps/web/src/components/admin/__tests__/review-moderation-workspace.spec.tsx`) using `renderToString` from `react-dom/server` verify the KPI summary cards, filter tabs, Review Moderation Cards (both visible/included and hidden/excluded badges, gold star ratings, masked + full buyer names, broker reputation stats), mandatory justification modal, and immutable audit trail panel.
     - All existing tests across `packages/shared`, `apps/api`, and `apps/web` pass with zero regressions.

## Tasks / Subtasks

- [ ] **Task 1: Shared Review Moderation Constants, Schemas & DTO Types in `@elmasaif/shared` (AC: #1)**
  - [ ] 1.1 Update `packages/shared/src/schemas/review.schema.ts` to add `REVIEW_MODERATION_MIN_REASON_LENGTH = 3`, `REVIEW_MODERATION_MAX_REASON_LENGTH = 500`, `REVIEW_VISIBILITY_FILTERS = ['ALL', 'VISIBLE', 'HIDDEN'] as const`, `reviewModerationReasonSchema`, and `adminReviewQueueQuerySchema` while keeping `moderateReviewSchema` and `ModerateReviewInput` intact.
  - [ ] 1.2 Update `packages/shared/src/types/broker.ts` to add `ReviewVisibilityFilter`, `AdminReviewAuditEntryDto`, `AdminReviewModerationItemDto`, `AdminReviewModerationDetailDto`, `AdminReviewModerationCountsDto`, `AdminReviewModerationQueueResponseDto`, and `AdminModerateReviewResponseDto`.
  - [ ] 1.3 Expand `packages/shared/src/schemas/__tests__/review.spec.ts` to test `reviewModerationReasonSchema` and `adminReviewQueueQuerySchema` (default pagination, visibility filter validation, score bounds `1..5`, invalid inputs).

- [ ] **Task 2: Backend Review Moderation Queue, Detail, Hide/Restore Actions & Audit Trail in `apps/api` (AC: #2, #3)**
  - [ ] 2.1 Enhance `BrokersService` (`apps/api/src/modules/users/brokers.service.ts`) with:
    - `listAdminReviews(query: AdminReviewQueueQueryInput)`: Queries `prisma.rating` with relations (`deal` + `listing`, `raterUser`, `targetUser` + `profiles` + `falLicense`), resolves `AdminUser` names for `hiddenByAdminId`, computes live public broker rating stats (`publicAverageRating`, `publicVisibleReviewsCount`) from non-hidden ratings (`isHidden: false`), and computes global queue KPI counts (`totalReviews`, `visibleReviews`, `hiddenReviews`, `lowScoreVisibleReviews`).
    - `getAdminReviewDetail(ratingId: string)`: Returns the full `AdminReviewModerationDetailDto` with `auditTrail` queried from `prisma.auditLog.findMany({ where: { entityType: 'Rating', entityId: ratingId }, orderBy: { createdAt: 'desc' } })` and resolved `actorName` from `AdminUser`.
    - Enhance `moderateReview(ratingId, input, admin, ipAddress)` so it preserves full compatibility with Story 6.5 tests (`mockPrismaService.rating.findUnique`, `mockPrismaService.rating.update`, `mockPrismaService.auditLog.create`), records comprehensive `AuditLog` payload (`dealId`, `targetUserId`, `raterUserId`, `score`, `commentSnapshot`, `previousIsHidden`, `isHidden`, `reason`, `adminUsername`), and returns the updated rating plus recalculated `updatedBrokerStats` (`averageRating`, `totalReviews`, `ratingDistribution`) when available.
  - [ ] 2.2 Enhance `AdminReviewsController` (`apps/api/src/modules/users/admin-reviews.controller.ts`) with:
    - `@Get()` (`GET /api/v1/admin/reviews`) gated by `@RequireAdminPermission('Reviews.Moderate')`.
    - `@Get(':id')` (`GET /api/v1/admin/reviews/:id`) gated by `@RequireAdminPermission('Reviews.Moderate')`.
    - `@Patch(':id/moderation')` (preserved from Story 6.5).
    - `@Post(':id/hide')` (`POST /api/v1/admin/reviews/:id/hide`) delegating to `moderateReview(id, { isHidden: true, reason: body.reason }, admin, ipAddress)`.
    - `@Post(':id/restore')` (`POST /api/v1/admin/reviews/:id/restore`) delegating to `moderateReview(id, { isHidden: false, reason: body.reason }, admin, ipAddress)`.

- [ ] **Task 3: Frontend Review Moderation Workspace (`/admin/reviews`) & Navigation Integration in `apps/web` (AC: #4)**
  - [ ] 3.1 Create `apps/web/src/components/admin/review-moderation-workspace.tsx` (`ReviewModerationWorkspace`):
    - Accepts optional SSR props (`initialQueueData`, `initialSelectedDetail`, `initialVisibilityFilter`, `initialScoreFilter`, `initialModalMode`) for deterministic SSR testing via `renderToString`.
    - Renders KPI summary cards (`totalReviews`, `visibleReviews`, `hiddenReviews`, `lowScoreVisibleReviews`).
    - Renders visibility filter tabs (`الكل`, `معروضة للعموم (نشطة)`, `محجوبة إدارياً`, `تقييمات منخفضة (1-2 ★)`), star score filter pills (`1 ★` to `5 ★`), and search input.
    - Renders `DESIGN.md` Component #9 Review Moderation Cards showing 1–5 gold stars, buyer full name + masked public name (`ط*** ش***`), deal reference code, target broker commercial name + Fal badge + link to `/brokers/:profileId`, live broker average rating & visible review count, inclusion/exclusion status badge (`مُدرج في التقييم العام ومتوسط الوسيط` vs `محجوب إدارياً — مستبعد من العرض العام ومتوسط التقييم`), and `"إخفاء التقييم"` / `"استعادة التقييم"` action buttons.
    - Renders the mandatory justification modal (`>= 3` characters) with preset reason pills and calls `POST /api/v1/admin/reviews/:id/hide` or `POST /api/v1/admin/reviews/:id/restore` (or `PATCH /api/v1/admin/reviews/:id/moderation`).
    - Renders the review inspection & immutable `AuditLog` side panel showing all historical `REVIEW_HIDDEN` and `REVIEW_UNHIDDEN` audit entries.
  - [ ] 3.2 Create `apps/web/src/app/admin/reviews/page.tsx` rendering `<ReviewModerationWorkspace />`.
  - [ ] 3.3 Update `apps/web/src/components/layout/workspace-shell.tsx` and `apps/web/src/app/admin/page.tsx` to add navigation links to `/admin/reviews` (`مراجعة وتدقيق التقييمات`) gated by `Reviews.Moderate` or `SUPER_ADMIN`.

- [ ] **Task 4: Automated Unit, Integration & SSR Tests Across Monorepo (AC: #5)**
  - [ ] 4.1 Run and verify `packages/shared/src/schemas/__tests__/review.spec.ts`.
  - [ ] 4.2 Expand `apps/api/src/modules/users/__tests__/brokers.spec.ts` to test `listAdminReviews`, `getAdminReviewDetail`, `hideReview`, `restoreReview`, `moderateReview` (both hiding and restoring), physical row preservation, `AuditLog` creation, and broker average recalculation.
  - [ ] 4.3 Create `apps/web/src/components/admin/__tests__/review-moderation-workspace.spec.tsx` using Vitest and `renderToString` from `react-dom/server` to verify KPI summary cards, visible vs hidden review cards, inclusion/exclusion badges, mandatory reason modal, and audit trail rendering.
  - [ ] 4.4 Run full test suites across `packages/shared`, `apps/api`, and `apps/web` to confirm zero regressions.

## Dev Notes

### Executive Context & Why Story 8.4 Matters

In Story 6.5 (`Public Broker Profile & Moderated Reviews`), the foundational database model (`Rating`), public broker profile endpoint (`GET /api/v1/brokers/:id`), buyer rating submission endpoint (`POST /api/v1/deals/:id/ratings`), and basic `PATCH /api/v1/admin/reviews/:id/moderation` endpoint were introduced.

However, administrators with `Reviews.Moderate` permission currently have **no back-office queue or workspace (`/admin/reviews`)** to browse, search, filter, inspect, hide, or restore broker reviews, nor any backend endpoints to list/filter reviews (`GET /api/v1/admin/reviews`) or inspect a review's moderation audit trail (`GET /api/v1/admin/reviews/:id`).

Story 8.4 completes the **Review Moderation Workspace** (`FR-19`, `FR-52`, `AD-6`, `AD-12`, `DESIGN.md` Component #9, `EXPERIENCE.md` `/admin/reviews`):
1. **Queue & Inspection API (`GET /api/v1/admin/reviews` & `GET /api/v1/admin/reviews/:id`):** Enables administrators with `Reviews.Moderate` to filter reviews by visibility (`ALL`, `VISIBLE`, `HIDDEN`), star score (`1..5` or low-score `1..2`), broker, or keyword search, and inspect the full deal context and immutable `AuditLog` history for any rating.
2. **Explicit Hide & Restore Semantic Action Endpoints (`POST /api/v1/admin/reviews/:id/hide` & `POST /api/v1/admin/reviews/:id/restore`, plus `PATCH /api/v1/admin/reviews/:id/moderation`):** Toggles `Rating.isHidden` with a mandatory justification reason (`3..500` characters), records `hiddenByAdminId`, `hiddenAt = ClockService.now()`, and `hiddenReason`, preserves the physical database row permanently, writes an append-only `AuditLog` record (`REVIEW_HIDDEN` / `REVIEW_UNHIDDEN`), and immediately recalculates the broker's public average rating and visible review count.
3. **Sovereign Review Moderation Workspace UI (`/admin/reviews`):** Implements `DESIGN.md` Component #9 (*Review Moderation Card & Rating Display*) with gold star ratings, buyer identity (both full name for admin audit and masked public alias `ط*** ش***`), inclusion/exclusion status badges, mandatory reason modal with preset regulatory reasons, and an immutable audit history drawer.

### Architecture Guardrails & Non-Negotiable Rules

1. **Deterministic Time (`AD-11`):**
   - NEVER call `new Date()` (with zero arguments) or `Date.now()` in backend services or controllers. Always use `this.clockService.now()` from `ClockService` (`apps/api/src/common/clock/clock.service.ts`).
2. **Isolated Admin Auth & Dynamic RBAC (`AD-5`, `AD-12`):**
   - `AdminReviewsController` (`apps/api/src/modules/users/admin-reviews.controller.ts`) MUST remain protected by `@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)` and `@RequireAdminPermission('Reviews.Moderate')`.
   - Remember that `SUPER_ADMIN` automatically passes `AdminPermissionGuard`, and `Support Team` (`MODERATOR`) holds `Reviews.Moderate` by default in the permission matrix (`AD-12`).
3. **Permanent Physical Record Preservation & Insert-Only Audit (`FR-52`, `AD-6`):**
   - NEVER call `prisma.rating.delete` or `prisma.rating.deleteMany`. Reviews are soft-moderated exclusively via `isHidden = true` / `isHidden = false`.
   - Every hide or restore action MUST create an immutable `AuditLog` entry (`entityType: 'Rating'`, `entityId: rating.id`, `action: 'REVIEW_HIDDEN' | 'REVIEW_UNHIDDEN'`, `actorId: admin.id`, `actorType: 'ADMIN'`, `createdAt: this.clockService.now()`).
4. **Backward Compatibility with Story 6.5 Tests (`apps/api/src/modules/users/__tests__/brokers.spec.ts`):**
   - Look closely at `apps/api/src/modules/users/__tests__/brokers.spec.ts` lines 112–134 and 258–329!
   - In `brokers.spec.ts`, `mockPrismaService` defines:
     ```ts
     rating: {
       findMany: jest.fn(),
       findUnique: jest.fn(),
       update: jest.fn(),
     }
     ```
   - Notice that in the existing test `AdminReviewsController.moderateReview (AC: #5, #8)`:
     - `mockPrismaService.rating.findUnique` is mocked once (`mockResolvedValue(existingRating)`),
     - `mockPrismaService.rating.update` is expected to be called with:
       ```ts
       expect(mockPrismaService.rating.update).toHaveBeenCalledWith({
         where: { id: 'rating-1' },
         data: {
           isHidden: true,
           hiddenByAdminId: 'admin-1',
           hiddenAt: mockNow,
           hiddenReason: 'محتوى مخالف لشروط الاستخدام',
         },
       });
       ```
     - `mockPrismaService.auditLog.create` is expected to be called with `actorId: 'admin-1'`, `actorType: 'ADMIN'`, `action: 'REVIEW_HIDDEN'`, `entityType: 'Rating'`, `entityId: 'rating-1'`, and `result.data.isHidden` is expected to be `true`!
   - **CRITICAL GUARDRAIL:** Keep `result.data` returning the updated rating object (with `isHidden`, `id`, etc., and optionally attaching `updatedBrokerStats` on the response envelope or on `result.data` without breaking `expect(result.data.isHidden).toBe(true)` or the exact `mockPrismaService.rating.update` arguments)! And if computing `updatedBrokerStats` inside `moderateReview`, guard `this.prisma.rating.findMany` so if it returns `undefined` (as in the existing unit test where `rating.findMany` was not mocked in the `moderateReview` test block), it gracefully falls back without throwing!

### Detailed Audit of Files Being Modified (UPDATE Files)

1. **`packages/shared/src/schemas/review.schema.ts` (UPDATE):**
   - **Current State:** Defines `moderateReviewSchema` (`{ isHidden: boolean, reason: string (min 3, max 500) }`) and `ModerateReviewInput`.
   - **Changes Required:**
     - Add `REVIEW_MODERATION_MIN_REASON_LENGTH = 3`, `REVIEW_MODERATION_MAX_REASON_LENGTH = 500`, `REVIEW_VISIBILITY_FILTERS = ['ALL', 'VISIBLE', 'HIDDEN'] as const`.
     - Add `reviewModerationReasonSchema = z.object({ reason: ... })` and `ReviewModerationReasonInput`.
     - Add `adminReviewQueueQuerySchema` and `AdminReviewQueueQueryInput` for `GET /api/v1/admin/reviews` query validation.
   - **Must Preserve:** `moderateReviewSchema` and `ModerateReviewInput`.

2. **`packages/shared/src/types/broker.ts` (UPDATE):**
   - **Current State:** Defines `RatingDistribution`, `BrokerStatsDto`, `BrokerReviewItemDto`, `BrokerFalLicenseDto`, and `BrokerPublicProfileDto`.
   - **Changes Required:**
     - Add `ReviewVisibilityFilter`, `AdminReviewAuditEntryDto`, `AdminReviewModerationItemDto`, `AdminReviewModerationDetailDto`, `AdminReviewModerationCountsDto`, `AdminReviewModerationQueueResponseDto`, and `AdminModerateReviewResponseDto`.
   - **Must Preserve:** All existing Story 6.5 exports (`RatingDistribution`, `BrokerStatsDto`, `BrokerReviewItemDto`, `BrokerFalLicenseDto`, `BrokerPublicProfileDto`).

3. **`apps/api/src/modules/users/brokers.service.ts` (UPDATE):**
   - **Current State:** Implements `getBrokerPublicProfile(id)` and `moderateReview(ratingId, input, admin, ipAddress)`.
   - **Changes Required:**
     - Add `listAdminReviews(query: AdminReviewQueueQueryInput)`:
       - Queries `prisma.rating.findMany` and `prisma.rating.count` (with graceful fallback if `count` is not mocked) including `deal` (with `listing: { select: { id: true, title: true } }`), `raterUser: { select: { id: true, fullName: true } }`, and `targetUser: { select: { id: true, fullName: true, profiles: { where: { role: 'MARKETER' }, include: { falLicense: true } } } }`.
       - Resolves `hiddenByAdminName` from `prisma.adminUser.findMany` for any ratings with `hiddenByAdminId`.
       - Computes each target broker's current public reputation stats (`publicAverageRating`, `publicVisibleReviewsCount`) from non-hidden ratings (`isHidden: false`).
       - Computes summary KPI counts (`totalReviews`, `visibleReviews`, `hiddenReviews`, `lowScoreVisibleReviews`).
     - Add `getAdminReviewDetail(ratingId: string)`:
       - Retrieves the review item with full deal, rater, and target broker details, plus queries `prisma.auditLog.findMany({ where: { entityType: 'Rating', entityId: ratingId }, orderBy: { createdAt: 'desc' } })`, resolving `actorName` from `prisma.adminUser`.
       - Throws `NotFoundException({ statusCode: 404, code: REVIEW_NOT_FOUND, message: 'التقييم المطلوب غير موجود' })` if not found.
     - Enhance `moderateReview`:
       - Preserve exact `prisma.rating.findUnique`, `prisma.rating.update`, and `prisma.auditLog.create` call signatures expected by existing Story 6.5 tests.
       - Include `commentSnapshot: existing.comment` and `score: existing.score` in `auditLog.create` payload alongside `dealId`, `targetUserId`, `previousIsHidden`, `isHidden`, `reason`, and `adminUsername`.
       - Compute `updatedBrokerStats` from non-hidden ratings when `rating.findMany` returns an array, and attach `updatedBrokerStats` to the returned object (or controller response).

4. **`apps/api/src/modules/users/admin-reviews.controller.ts` (UPDATE):**
   - **Current State:** Exposes `@Patch(':id/moderation')`.
   - **Changes Required:**
     - Add `@Get()` (`GET /api/v1/admin/reviews`) accepting `@Query(new ZodValidationPipe(adminReviewQueueQuerySchema)) query: AdminReviewQueueQueryInput`.
     - Add `@Get(':id')` (`GET /api/v1/admin/reviews/:id`).
     - Keep `@Patch(':id/moderation')` intact.
     - Add `@Post(':id/hide')` and `@Post(':id/restore')` accepting `@Body(new ZodValidationPipe(reviewModerationReasonSchema)) body: ReviewModerationReasonInput` and calling `this.brokersService.moderateReview(id, { isHidden: true/false, reason: body.reason }, admin, ipAddress)`.

5. **`apps/web/src/components/layout/workspace-shell.tsx` & `apps/web/src/app/admin/page.tsx` (UPDATE):**
   - **Current State:** Lists admin navigation links for queues, owner-requests, licenses, listings, geo, proposals, negotiations, conversations, backup-offers, payments, disputes, and staff.
   - **Changes Required:**
     - In `workspace-shell.tsx`: Add `{ href: '/admin/reviews', label: 'مراجعة وتدقيق التقييمات', icon: Star }` (importing `Star` from `lucide-react`) under `roleNavItems[UserRole.ADMIN]` when `!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Reviews.Moderate')`.
     - In `apps/web/src/app/admin/page.tsx`: Add a quick-action button linking to `/admin/reviews` (`مراجعة وتدقيق التقييمات`) when `canModerateReviews` (`hasPermission('Reviews.Moderate') || admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.MODERATOR`).

### Testing Standards & Constraints

- **`packages/shared`:** Run tests with `pnpm --filter @elmasaif/shared test` (Vitest).
- **`apps/api`:** Run tests with `pnpm --filter @elmasaif/api test -- brokers.spec.ts` (Jest). Always use `ClockService` mock timestamps (`mockNow`).
- **`apps/web`:** Run tests with `pnpm --filter @elmasaif/web test` (Vitest). **CRITICAL:** `apps/web` does NOT use `@testing-library/react`; all component tests in `apps/web` MUST use `renderToString` from `react-dom/server` (matching `apps/web/src/components/admin/__tests__/operational-queues-workspace.spec.tsx`).

### Project Structure Notes

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/schemas/review.schema.ts` (UPDATE)
  - `packages/shared/src/types/broker.ts` (UPDATE)
  - `packages/shared/src/schemas/__tests__/review.spec.ts` (UPDATE)
- **Backend API (`apps/api`):**
  - `apps/api/src/modules/users/brokers.service.ts` (UPDATE)
  - `apps/api/src/modules/users/admin-reviews.controller.ts` (UPDATE)
  - `apps/api/src/modules/users/__tests__/brokers.spec.ts` (UPDATE)
- **Frontend Web (`apps/web`):**
  - `apps/web/src/components/admin/review-moderation-workspace.tsx` (NEW)
  - `apps/web/src/app/admin/reviews/page.tsx` (NEW)
  - `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE)
  - `apps/web/src/app/admin/page.tsx` (UPDATE)
  - `apps/web/src/components/admin/__tests__/review-moderation-workspace.spec.tsx` (NEW)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.4: Review Moderation Workspace]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md` — FR-19 (Seller Public Profile & Reputation with Review Moderation), FR-52 (Review Moderation & Audit Preservation), FR-54 (Buyer Rating Submission on Completed Deals)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md` — AD-2 & AD-8 (Explicit Semantic Action Endpoints), AD-6 (Review Moderation & Insert-Only Audit Logging), AD-11 (Injectable ClockService), AD-12 (Admin Permission Matrix: `Reviews.Moderate`), Data Architecture Section 5 (`Rating`)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md` — Component #9: Review Moderation Card & Rating Display (FR-52, FR-54)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md` — Admin Back-Office `/admin/reviews` (`Reviews.Moderate`) & Section 9: Buyer Rating Submission & Seller Reputation]
- [Source: `_bmad-output/implementation-artifacts/6-5-public-broker-profile-moderated-reviews.md` — Story 6.5 baseline implementation]

## Dev Agent Record

### Agent Model Used

Gemini 4 Argon (Medium)

### Debug Log References

- Analyzed Story 6.5 implementation in `apps/api/src/modules/users/brokers.service.ts`, `apps/api/src/modules/users/admin-reviews.controller.ts`, `packages/shared/src/schemas/review.schema.ts`, and `packages/shared/src/types/broker.ts`.
- Verified Prisma `Rating` and `AuditLog` models in `apps/api/prisma/schema.prisma`.
- Checked existing admin workspace patterns in `apps/web/src/components/admin/operational-queues-workspace.tsx`, `apps/web/src/components/layout/workspace-shell.tsx`, and `apps/web/src/app/admin/page.tsx`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created for Story 8.4 (`Review Moderation Workspace`).

### File List

- `_bmad-output/implementation-artifacts/8-4-review-moderation-workspace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

