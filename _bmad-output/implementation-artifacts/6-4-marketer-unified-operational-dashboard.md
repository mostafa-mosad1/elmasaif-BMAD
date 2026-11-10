---
baseline_commit: 757ab6c
---

# Story 6.4: Marketer Unified Operational Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a verified real estate marketer / broker,
I want a unified operational workspace showing active listing inventory, pending moderation notices, incoming buyer inquiries, mediated offer negotiation threads, deal pipeline stages, and commission forecasts alongside my Fal compliance status,
so that I can manage my brokerage business efficiently, track transactions and commissions in real-time, and act rapidly on customer opportunities from one centralized dashboard.

## Acceptance Criteria

1. **Marketer Dashboard Overview & Dynamic KPI Metrics (`FR-59`, `UC-31`, `UJ-2`):**
   - **Given** an authenticated user with an active `MARKETER` profile accessing `/app/marketer`
   - **When** the page loads
   - **Then** the dashboard concurrently queries:
     - `GET /api/v1/listings/my` for the marketer's inventory
     - `GET /api/v1/users/fal-license` for REGA compliance standing
     - `GET /api/v1/inquiries/received` for inbound listing inquiries
     - `GET /api/v1/offers/received` for incoming mediated purchase offers
     - `GET /api/v1/deals/seller/summary` (or `GET /api/v1/deals/seller`) for active deal pipeline & financial metrics
   - **And** renders four primary metric cards in a responsive grid:
     1. **العقارات المعروضة (Active Inventory)**: Displays active count (`status === ACTIVE`), total registered listings, and status indicator.
     2. **المشاهدات والتفاعل (Engagement & Conversion)**: Displays total aggregated views (`totalViews`), impressions (`totalImpressions`), saved favorites (`totalFavorites`), and overall offer conversion percentage `(offersCount / totalViews * 100)%`.
     3. **استفسارات المشترين (Inbound Inquiries)**: Dynamically displays active inquiry thread count from `GET /api/v1/inquiries/received`, unhandled/relayed inquiry count, and quick-link to `/app/marketer/inquiries`.
     4. **الصفقات والعمولات (Deal Pipeline & Commissions)**: Dynamically displays count of active deals, total completed deal value (SAR), and projected/earned commission totals from `GET /api/v1/deals/seller/summary`, with quick-link to the deal pipeline section or `/app/settings/payout`.

2. **Fal Licensing Compliance Banner & Preventive Operational Guardrails (`FR-6`, `FR-8`, `BR-14`, `UC-43`):**
   - **Given** the marketer's Fal license status from `GET /api/v1/users/fal-license`
   - **When** the dashboard renders:
     - **If `status === ACTIVE` and `daysRemaining > 30`**: Renders verified golden badge (`مرخص وموثق من فال REGA`) with license number, commercial name, and expiration date, plus CTA "تفاصيل الرخصة والامتثال" linking to `/app/marketer/fal-license`. New listing button "إضافة عقار جديد" is fully enabled.
     - **If `status === ACTIVE` and `daysRemaining <= 30`**: Renders prominent amber warning card (`تنبيه: اقتراب انتهاء صلاحية رخصة فال - متبقي X يوم`) with early renewal CTA "تجديد مبكر لرخصة فال" (`/app/marketer/fal-license`).
     - **If `status === COMPLIANCE_RESTRICTED`**:
       - Renders high-urgency red restriction card: «تم تقييد حسابك لانتهاء صلاحية رخصة فال. تم تعليق ظهور إعلاناتك النشطة آلياً، بينما تستمر الصفقات الجارية دون انقطاع. يرجى تجديد الرخصة لاستعادة نشاط الحساب.»
       - Disables "إضافة عقار جديد" button (`disabled`, `opacity-50`, cursor `not-allowed`) with tooltip explaining compliance restriction.
       - Disables new offer submission or acceptance actions if applicable.
       - Provides direct renewal CTA button (`تجديد رخصة فال` -> `/app/marketer/fal-license`).
     - **If `status === RENEWAL_UNDER_REVIEW`**: Renders pulsing amber notice indicating submitted renewal is undergoing administrative review (24-hour SLA).

3. **Backend Seller Deals & Pipeline Summary Endpoint (`FR-29`, `FR-59`, `BR-07`, `UC-49`, `UC-57A`):**
   - **Given** an authenticated marketer or owner with an active seller profile
   - **When** calling `GET /api/v1/deals/seller/summary` (and `GET /api/v1/deals/seller`):
   - **Then** the endpoint is protected by `SessionAuthGuard`, `ActiveRoleGuard`, and `@RequireRole(UserRole.MARKETER, UserRole.OWNER)`
   - **And** queries `prisma.deal.findMany({ where: { sellerProfileId: callerProfile.id } })` including listing details (`id`, `title`, `cityName`, `districtName`, `propertyType`), payments, and buyer user snapshot
   - **And** returns a structured summary payload:
     ```json
     {
       "statusCode": 200,
       "data": {
         "metrics": {
           "totalDealsCount": 12,
           "activeDealsCount": 3,
           "completedDealsCount": 8,
           "disputedDealsCount": 0,
           "cancelledDealsCount": 1,
           "totalCompletedVolume": "24500000.00",
           "projectedActiveVolume": "5800000.00",
           "earnedCommissionTotal": "612500.00",
           "pendingCommissionForecast": "145000.00"
         },
         "stageBreakdown": {
           "AWAITING_PAYMENT_PROOF": 2,
           "UNDER_ADMIN_AUDIT": 1,
           "PAYMENT_REJECTED": 0,
           "DISPUTED": 0,
           "COMPLETED": 8,
           "CANCELLED": 1,
           "TERMINATED": 0
         },
         "activeDeals": [
           {
             "id": "deal-uuid",
             "dealNumber": "DL-2026-0042",
             "dealReferenceCode": "ELM-042",
             "listingId": "listing-uuid",
             "listingTitle": "فيلا مودرن في حي النرجس",
             "cityName": "الرياض",
             "districtName": "النرجس",
             "dealPrice": "3200000.00",
             "platformCommission": "80000.00",
             "status": "AWAITING_PAYMENT_PROOF",
             "paymentDeadline": "2026-11-12T14:30:00.000Z",
             "paymentWindowHours": 48,
             "buyer": {
               "fullName": "ط*** ش***" // Masked before completion per FR-32; unmasked only upon COMPLETED
             },
             "sellerCancellationRequestedAt": null,
             "createdAt": "2026-11-10T14:30:00.000Z"
           }
         ]
       }
     }
     ```
   - **And** if caller has no active seller profile in the current workspace, rejects with HTTP `403 Forbidden` and code `AUTH_ROLE_NOT_AUTHORIZED`

4. **Interactive Deal Pipeline Funnel & Stage Tracker Widget (`FR-59`, `BR-08`, `UC-49`):**
   - **Given** the Marketer Dashboard rendering at `/app/marketer`
   - **When** viewing the "مسار الصفقات والعمليات الجارية" (Active Deal Pipeline) section
   - **Then** displays a visual stage funnel categorized into 4 operational buckets:
     1. **بانتظار سداد المشتري (Awaiting Buyer Payment)** (`DealStatus.AWAITING_PAYMENT_PROOF`):
        - Displays deal number, property title, deal price, and countdown timer showing remaining time before payment timeout (`48-hour` deadline).
        - Highlights if payment deadline is under 12 hours with amber alert indicator.
     2. **قيد التدقيق الإداري (Payment Proofs Under Audit)** (`DealStatus.UNDER_ADMIN_AUDIT`):
        - Displays badge "الإيصالات مرفوعة - بانتظار اعتماد الإدارة" with administrative review SLA status.
     3. **مهلة تصحيح / نزاع (Correction Grace / Disputed)** (`DealStatus.PAYMENT_REJECTED`, `DealStatus.DISPUTED`):
        - Displays warning badge with countdown (12h correction window or dispute triage notice).
     4. **الصفقات المنجزة (Completed Deals)** (`DealStatus.COMPLETED`):
        - Displays completed timestamp, verified seller payout amount, and direct button to view unmasked buyer contact information for title deed deed-transfer (`إفراغ`).
   - **And** for deals in `AWAITING_PAYMENT_PROOF` without uploaded proof, provides action button "طلب إلغاء الصفقة" opening `SellerCancelRequestModal` (per Story 5.6 / UC-46).

5. **Quick-Action Shortcuts & Cross-Surface Negotiation Linkages (`FR-59`, `UX-DR4`, `UX-DR5`):**
   - **Given** the Marketer Dashboard
   - **When** reviewing active communication and transaction opportunities
   - **Then** renders quick-action cards / action-bar shortcuts:
     - **العروض الواردة (Incoming Offers)**: Displays count of offers awaiting seller response (`awaitingParty === 'SELLER'`), latest offer amount vs ask price, and CTA "مراجعة العروض والتفاوض" linking directly to `/app/marketer/offers`.
     - **استفسارات المشترين (Inquiries Inbox)**: Displays count of active mediated inquiries, and CTA "فتح المحادثات والاستفسارات" linking directly to `/app/marketer/inquiries`.
     - **طلبات الشراء المطابقة (Market Demands)**: Displays shortcut to `/app/marketer/demands` to browse active buyer demands matching the marketer's inventory.
     - **إضافة عقار جديد (New Listing)**: Primary button in header and empty-state (disabled if license restricted).
     - **إعدادات الحساب البنكي (Payout IBAN)**: Direct link to `/app/settings/payout` with verification badge.

6. **Listing Inventory Portfolio with Moderation & Performance Filters (`FR-13`, `FR-57`, `FR-59`, `FR-67`):**
   - **Given** the marketer's listing inventory
   - **When** interacting with the listing table on `/app/marketer`
   - **Then** preserves and integrates:
     - **Filter Tabs**: `الكل` (All), `معتمد ومنشور` (Active), `قيد المراجعة` (Pending Review), `ملاحظات وتنبيهات` (Alerts/Suspended/Blocked), and `المؤرشفة` (Archived).
     - **Live Instant Search**: Filter by property title, city name, district name, or property type in Arabic.
     - **4-Chip Engagement Bar per Listing**: Real-time display of total views, impressions, bookmarks/favorites, and conversion ratio (`SellerListingEngagement`).
     - **Administrative Price Suggestions**: Interactive `SellerPriceSuggestionCard` allowing marketer to accept, reject, or propose counter-price (`Story 2.5 / FR-57`).
     - **Compliance Suspension Alerts**: Explicit alerts on listings in `UNDER_COMPLIANCE_REVIEW` displaying `complianceCategory` and `complianceReason` (e.g. `FAL_LICENSE_EXPIRED`).
     - **Archive / Unarchive Actions**: Direct lifecycle status transition triggers (`SellerListingArchiveActions`).

7. **Error Resilience, Empty States & RTL Sovereign Design (`NFR12`, `UX-DR15`):**
   - **Given** network hiccups or partial API unavailability (e.g., offers or deals service temporary 500)
   - **When** dashboard components load
   - **Then** individual widget queries fail gracefully without blocking the entire page (metrics show default 0 or skeleton states without crashing).
   - **And** for a newly onboarded marketer with 0 listings, 0 inquiries, and 0 deals, renders structured institutional empty states with clear welcoming copy and prominent onboarding CTAs.
   - **And** adheres strictly to the sovereign design system: `dir="rtl"` layout, IBM Plex Sans Arabic typography, standardized Saudi Riyal currency format (`SAR`), and dark mode contrast tokens.

## Tasks / Subtasks

- [x] Task 1: Backend Seller Deals & Pipeline Summary API (`apps/api`) (AC: #3)
  - [x] Subtask 1.1: Add `listSellerDeals` and `getSellerDealsSummary` methods to `BuyerDealsService` (or create dedicated `SellerDealsService` in `apps/api/src/modules/deals/`).
  - [x] Subtask 1.2: Implement `GET /api/v1/deals/seller/summary` and `GET /api/v1/deals/seller` in `apps/api/src/modules/deals/buyer-deals.controller.ts` (or `seller-deals.controller.ts`) with `@RequireRole(UserRole.MARKETER, UserRole.OWNER)`.
  - [x] Subtask 1.3: Include deal metrics aggregation: total completed volume, projected active volume, earned commission, pending commission forecast, and stage count breakdown.
  - [x] Subtask 1.4: Ensure buyer identity masking before completion per `FR-32` (`ط*** ش***`), revealing unmasked full name, phone, and email only on `DealStatus.COMPLETED`.
  - [x] Subtask 1.5: Write comprehensive unit and integration tests in `apps/api/src/modules/deals/__tests__/seller-deals.spec.ts`.

- [x] Task 2: Shared Types & DTO Contracts (`packages/shared`) (AC: #1, #3)
  - [x] Subtask 2.1: Define `SellerDealSummaryDto`, `SellerDealsSummaryResponse`, `DealPipelineStageBreakdown`, and `SellerDealMetrics` interfaces in `packages/shared/src/types/deal.ts` (or `deals.types.ts`).
  - [x] Subtask 2.2: Export deal stage status labels in Arabic (`DEAL_STATUS_LABELS_AR`) with localized descriptions for each pipeline step.

- [x] Task 3: Deal Pipeline Funnel Component (`apps/web`) (AC: #4)
  - [x] Subtask 3.1: Create `apps/web/src/components/deals/seller-deals-pipeline.tsx` rendering the visual stage funnel cards (Awaiting Payment, Under Audit, Grace/Disputed, Completed).
  - [x] Subtask 3.2: Integrate real-time countdown timer for deals in `AWAITING_PAYMENT_PROOF` showing hours and minutes remaining against `paymentDeadline`.
  - [x] Subtask 3.3: Embed "طلب إلغاء الصفقة" button linking to `SellerCancelRequestModal` for pre-payment cancellation requests.
  - [x] Subtask 3.4: Export component in `apps/web/src/components/deals/index.ts`.

- [x] Task 4: Marketer Dashboard Integration & Live State Binding (`apps/web`) (AC: #1, #2, #5, #6, #7)
  - [x] Subtask 4.1: Update `apps/web/src/app/app/marketer/page.tsx` to fetch `GET /api/v1/inquiries/received`, `GET /api/v1/offers/received`, and `GET /api/v1/deals/seller/summary` in parallel using `apiClient`.
  - [x] Subtask 4.2: Replace hardcoded `0 محادثة` and `0 صفقة / 0.00 ر.س` in Quick Stats Grid with live dynamic metrics and active stage indicators.
  - [x] Subtask 4.3: Mount the `SellerDealsPipeline` component between the Quick Stats Grid and the Listings Portfolio section.
  - [x] Subtask 4.4: Add Quick-Action shortcuts card for incoming offers awaiting seller reply (`awaitingParty === 'SELLER'`) with direct link to `/app/marketer/offers`.
  - [x] Subtask 4.5: Ensure Fal compliance restriction card correctly guards the "إضافة عقار جديد" header button and empty-state actions.
  - [x] Subtask 4.6: Implement robust silent error handling so partial endpoint failures never crash the dashboard.

- [x] Task 5: Automated Verification & Unit/SSR Testing (`apps/web` & `apps/api`) (AC: #1-#7)
  - [x] Subtask 5.1: Create `apps/web/src/app/app/marketer/__tests__/marketer-operational-dashboard.spec.tsx` verifying:
    - Rendering of live inquiries counter, offers counter, and deal pipeline metrics.
    - Active countdown timer in deal pipeline cards.
    - Quick-action shortcuts linking to `/app/marketer/offers`, `/app/marketer/inquiries`, and `/app/marketer/demands`.
    - Disabled new listing button under `COMPLIANCE_RESTRICTED` state.
    - Responsive layout and Arabic microcopy verification.
  - [x] Subtask 5.2: Run Vitest suite across web and NestJS test suite across API to ensure zero regressions.

## Dev Notes

### Architecture Compliance & Data Flow

- **Workspace Path**: `/app/marketer`
- **Role Requirement**: The caller must have an active `MARKETER` profile (`user.activeRole === 'MARKETER'`).
- **Data Integration Pattern**:
  ```
  apps/web/src/app/app/marketer/page.tsx
    ├── apiClient.get('/listings/my')              -> Listings & Moderation Status
    ├── apiClient.get('/users/fal-license')         -> REGA Fal Compliance & Days Remaining
    ├── apiClient.get('/inquiries/received')        -> Inbound Mediated Inquiries Count
    ├── apiClient.get('/offers/received')           -> Inbound Offers & Awaiting Seller Count
    └── apiClient.get('/deals/seller/summary')      -> Deal Pipeline Funnel & Financial Forecasts
  ```

### Files Being Modified & Created

| File | Nature | Purpose |
|------|--------|---------|
| `apps/api/src/modules/deals/buyer-deals.controller.ts` | **UPDATE** | Add `GET /deals/seller` and `GET /deals/seller/summary` endpoints with `@RequireRole(UserRole.MARKETER, UserRole.OWNER)`. |
| `apps/api/src/modules/deals/buyer-deals.service.ts` | **UPDATE** | Implement `listSellerDeals` and `getSellerDealsSummary` aggregation logic querying `prisma.deal`. |
| `apps/api/src/modules/deals/__tests__/seller-deals.spec.ts` | **NEW** | Unit/integration test suite for seller deals and dashboard summary endpoints. |
| `packages/shared/src/types/deal.ts` (or `deals.types.ts`) | **UPDATE** | Add TypeScript types for `SellerDealsSummary`, `DealPipelineStageBreakdown`, and deal metrics. |
| `apps/web/src/components/deals/seller-deals-pipeline.tsx` | **NEW** | Visual funnel component rendering active deals, stages, payment countdowns, and quick actions. |
| `apps/web/src/components/deals/index.ts` | **UPDATE** | Export `SellerDealsPipeline`. |
| `apps/web/src/app/app/marketer/page.tsx` | **UPDATE** | Wire up live inquiries, offers, and deals metrics; embed pipeline funnel and quick actions. |
| `apps/web/src/app/app/marketer/__tests__/marketer-operational-dashboard.spec.tsx` | **NEW** | Component test suite validating dashboard KPIs, pipeline funnel, and compliance states. |

### Preserving Existing Functionality in `apps/web/src/app/app/marketer/page.tsx`

The existing `page.tsx` already implements critical features from Stories 2.5, 2.6, 2.7, 6.1, 6.2, and 6.3:
- Tab filtering (`all`, `active`, `pending`, `alerts`, `archived`) and client search.
- Price suggestion banner (`SellerPriceSuggestionCard`).
- Archive / unarchive actions (`SellerListingArchiveActions`).
- 4-metric engagement bar (`SellerListingEngagement`).
- Fal compliance status banner & restriction alert card (`isRestricted`, `showWarning`).
- These behaviors **MUST BE PRESERVED IN FULL**. Do not remove or regress any existing listing moderation badges, archive actions, or price suggestion cards!

### Deal Stage Mapping & Calculations

- **Platform Commission**: Default is 2.5% (`0.0250`) of the `dealPrice`.
- **Active Deal Stages**:
  - `AWAITING_PAYMENT_PROOF`: Buyer has 48 hours to upload payment slips for platform commission and property price. Countdown timer = `paymentDeadline - ClockService.now()`.
  - `UNDER_ADMIN_AUDIT`: At least one receipt uploaded, awaiting administrative confirmation.
  - `PAYMENT_REJECTED`: Admin rejected receipt, 12-hour correction window active.
  - `DISPUTED`: Formal dispute filed, automated timeouts paused.
- **Terminal Deal Stages**:
  - `COMPLETED`: Both payments confirmed, atomic contact release.
  - `CANCELLED`: Pre-payment cancellation approved or deadline expired.
  - `TERMINATED`: Disputed deal terminated by administrative adjudication.

### Security & Privacy Guardrails

- **Buyer Privacy Masking (`FR-32`)**: For deals in non-terminal or pre-completion stages, buyer name MUST be masked (`ط*** ش***`) and contact details (phone, email) MUST NOT be exposed to the marketer. Only when `status === COMPLETED` does atomic contact release occur.
- **Role Isolation**: Marketers cannot access other sellers' deals (`where: { sellerProfileId: profile.id }`).
- **Claim Lock Integrity**: Admin moderation actions continue to use the 15-minute exclusive task claim lock (`FR-51`).

### Previous Story Intelligence & Learnings

- From **Story 6.1 & 6.2**: `FalLicense` has fields `status`, `expiryDate`, `daysRemaining`, `isExpired`. When `COMPLIANCE_RESTRICTED`, the marketer cannot add listings.
- From **Story 6.3**: `FalLicense` can also have `status === RENEWAL_UNDER_REVIEW`. The dashboard must reflect this state gracefully.
- From **Story 5.2 & 5.4**: `Deal` records contain `dealPrice`, `platformCommission`, `paymentDeadline`, `status`, and related `payments`.
- From **Story 5.6**: Pre-payment seller cancellation requests use `POST /api/v1/deals/:id/seller-cancel-request` and can only be submitted while `status === AWAITING_PAYMENT_PROOF` and before payment proof is uploaded.
- From **Story 4.2 & 4.4**: `GET /api/v1/offers/received` returns `OfferThreadSummary[]` with `awaitingParty`. `GET /api/v1/inquiries/received` returns `InquiryThreadSummary[]`.

### Testing Standards Summary

- **Web Unit/SSR Tests**: Use Vitest + React testing library or `renderToString` with mock payloads. Run via `pnpm --filter @elmasaif/web test`.
- **API Unit/E2E Tests**: Use Jest with NestJS testing module. Run via `pnpm --filter @elmasaif/api test`.

### Project Structure Notes

- Alignment with monorepo paths:
  - Backend controllers: `apps/api/src/modules/deals/`
  - Frontend components: `apps/web/src/components/deals/`
  - Frontend dashboard page: `apps/web/src/app/app/marketer/page.tsx`
  - Shared definitions: `packages/shared/src/types/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4: Marketer Unified Operational Dashboard]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-59: Marketer & Owner Dashboards with Transaction Tracking]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Marketer Workspace]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md]
- [Source: _bmad-output/implementation-artifacts/6-3-fal-license-renewal-workflow.md]
- [Source: _bmad-output/implementation-artifacts/5-6-pre-payment-cancellations-dispute-adjudication.md]

## Dev Agent Record

### Agent Model Used

Claude 3.7 Sonnet / Antigravity Agent

### Debug Log References

- Task 1 & 2: Added seller deals APIs (`GET /deals/seller/summary`, `GET /deals/seller`), types, and Arabic stage descriptions.
- Route Ordering in `buyer-deals.controller.ts`: Ensured `seller/summary` and `seller` precede `:id` to prevent route shadow.
- Role Access Control: Applied `@RequireRole(UserRole.MARKETER, UserRole.OWNER)` with active profile validation.
- Buyer Privacy Masking (`FR-32`): Buyer names masked as `ط*** ش***` unless `status === COMPLETED`.
- Pipeline Funnel Component: Created `SellerDealsPipeline` with countdown badges, stage counts, and cancellation modal hooks.
- Dashboard Integration: Updated `/app/marketer` with parallel fetching, dynamic KPI cards, Fal status handling, and quick actions.
- Test fixes: Adjusted SSR text interpolation regexes and Tailwind `disabled=""` matching in Vitest.

### Completion Notes List

- Implemented backend seller deals API (`GET /api/v1/deals/seller/summary` and `GET /api/v1/deals/seller`) with `@RequireRole(UserRole.MARKETER, UserRole.OWNER)` and `resolveSellerProfile`.
- Aggregated financial metrics: total completed volume, projected active volume, earned commission, pending commission forecast, and stage breakdowns.
- Enforced buyer privacy masking (`FR-32`) before `COMPLETED` stage (`ط*** ش***`).
- Added shared TypeScript DTOs and Arabic stage mappings in `packages/shared`.
- Implemented `SellerDealsPipeline` interactive pipeline funnel component with real-time countdown timer for `AWAITING_PAYMENT_PROOF` and pre-payment cancellation trigger (`SellerCancelRequestModal`).
- Integrated marketer dashboard at `/app/marketer` with parallel API fetching, dynamic KPI metric cards (inquiries, conversion, deal volume, commissions), Fal compliance banner guardrails, and quick-action shortcuts.
- Created automated test suites: `apps/api/src/modules/deals/__tests__/seller-deals.spec.ts` (8 tests passing) and `apps/web/src/app/app/marketer/__tests__/marketer-operational-dashboard.spec.tsx` (6 tests passing), plus `seller-deals-pipeline.spec.tsx` (2 tests passing).

### File List

- `packages/shared/src/types/deal.ts` (Modified)
- `packages/shared/src/constants/deal.ts` (Modified)
- `apps/api/src/modules/deals/buyer-deals.service.ts` (Modified)
- `apps/api/src/modules/deals/buyer-deals.controller.ts` (Modified)
- `apps/api/src/modules/deals/__tests__/seller-deals.spec.ts` (New)
- `apps/web/src/components/deals/seller-deals-pipeline.tsx` (New)
- `apps/web/src/components/deals/__tests__/seller-deals-pipeline.spec.tsx` (New)
- `apps/web/src/components/deals/index.ts` (Modified)
- `apps/web/src/app/app/marketer/page.tsx` (Modified)
- `apps/web/src/app/app/marketer/__tests__/marketer-operational-dashboard.spec.tsx` (New)
- `_bmad-output/implementation-artifacts/6-4-marketer-unified-operational-dashboard.md` (Modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Modified)

### Change Log

- 2026-11-10: Implemented Story 6.4 backend endpoints, shared contracts, pipeline UI component, and dashboard integration with full test coverage. Status moved to review.

