---
baseline_commit: 2fb019d365d2351daa550550d0508745f64561b5
---

# Story 8.6: Dynamic Platform Settings & Commission Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **authorized administrator (Super Admin or staff with `Settings.Manage` / `Settings.Commission`)**,
I want to **dynamically configure global platform business parameters including commission rates, fixed fees, owner contract fees, VAT rates, payment windows, review SLA timers, and fraud detection thresholds**,
so that **platform business rules, revenue parameters, and operational timing adapt instantly without requiring backend code deployments or system downtime, while guaranteeing that all active in-flight deals remain strictly bound to their frozen financial snapshots and all changes are immutably audited**.

---

## Acceptance Criteria

1. **AC1 — Shared Platform Settings Contracts, Enums, Constants & Zod Schemas (`@elmasaif/shared`):**
   - **Given** the business requirements in `FR-68`, `FR-69`, `AD-2`, `AD-3`, `AD-6`, `AD-8`, `AD-11`, PRD Assumptions `A-06`, `A-14`, `A-15`, `A-16`, `A-17`, `A-18`, and Epics §8.6,
   - **When** shared contracts are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - Canonical default platform parameter constants:
       - `DEFAULT_PLATFORM_COMMISSION_RATE = 0.025` (2.5% platform commission fraction).
       - `DEFAULT_PLATFORM_COMMISSION_PERCENTAGE = 2.5` (2.5%).
       - `DEFAULT_FIXED_COMMISSION_SAR = '0.00'` (0 SAR fixed fee).
       - `DEFAULT_OWNER_CONTRACT_FEE_SAR = 1000` (1,000 SAR direct owner listing agreement fee).
       - `DEFAULT_VAT_RATE_PERCENTAGE = 15.0` (15% Saudi ZATCA VAT rate).
       - `DEFAULT_PAYMENT_WINDOW_HOURS = 48` (48 hours wire transfer deadline for buyers).
       - `DEFAULT_PAYMENT_CORRECTION_HOURS = 12` (12 hours post-rejection correction window).
       - `DEFAULT_CONTRACT_FEE_DEADLINE_DAYS = 7` (7 days for owner contract fee payment).
       - `DEFAULT_COOLING_OFF_PERIOD_DAYS = 14` (14 days PDPL cooling-off period before erasure).
       - `DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS = 4` (4 hours alert tier for payment proof review).
       - `DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS = 12` (12 hours Super Admin escalation tier).
       - `DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS = 24` (24 hours mandatory final decision tier).
       - `DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS = 4` (4 hours technical support first response SLA).
       - `DEFAULT_TICKET_SLA_RESOLUTION_HOURS = 48` (48 hours technical support resolution SLA).
       - `DEFAULT_TASK_CLAIM_LEASE_MINUTES = 15` (15 minutes operational queue claim lock).
       - `DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES = 5` (5 minutes client renewal heartbeat).
       - `DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD = 3` (3 rejected proofs triggers fraud event).
       - `DEFAULT_FRAUD_WINDOW_HOURS = 72` (72-hour sliding window for fraud alerts).
     - Status & Error codes:
       - `SETTINGS_NOT_FOUND`, `SETTINGS_UPDATE_INVALID`, `SETTINGS_COMMISSION_RATE_OUT_OF_BOUNDS`, `SETTINGS_FEE_NEGATIVE`, `SETTINGS_VAT_RATE_INVALID`, `SETTINGS_DEADLINE_OUT_OF_BOUNDS`, `SETTINGS_IBAN_INVALID`, `SETTINGS_UNAUTHORIZED`.
       - Action constant for audit: `PLATFORM_SETTINGS_UPDATED = 'PLATFORM_SETTINGS_UPDATED'`.
     - Zod Validation Schemas (`packages/shared/src/schemas/settings.schema.ts`):
       - `updatePlatformSettingsSchema`: validates partial or full updates:
         - `commissionRatePercentage`: number between `0.00` and `25.00` (step 0.01).
         - `fixedFeeAmountSar`: number `>= 0.00` and `<= 50000.00`.
         - `ownerContractFeeSar`: number `>= 0.00` and `<= 20000.00`.
         - `vatRatePercentage`: number between `0.00` and `50.00` (default 15.00).
         - `paymentWindowHours`: integer between `1` and `168` (1 hour to 7 days).
         - `paymentCorrectionHours`: integer between `1` and `72` (1 hour to 3 days).
         - `contractFeeDeadlineDays`: integer between `1` and `30` days.
         - `coolingOffPeriodDays`: integer between `1` and `90` days.
         - `dealReviewSlaAlertHours`: integer between `1` and `24` hours.
         - `dealReviewSlaEscalationHours`: integer between `2` and `48` hours (`> alertHours`).
         - `dealReviewSlaSuperAdminHours`: integer between `4` and `96` hours (`> escalationHours`).
         - `ticketSlaFirstResponseHours`: integer between `1` and `24` hours.
         - `ticketSlaResolutionHours`: integer between `4` and `168` hours.
         - `taskClaimLeaseMinutes`: integer between `5` and `60` minutes.
         - `taskClaimHeartbeatMinutes`: integer between `1` and `15` minutes (`< leaseMinutes`).
         - `fraudRejectedProofThreshold`: integer between `1` and `10`.
         - `fraudWindowHours`: integer between `12` and `336` hours.
         - `platformCollectionIban`: optional Saudi IBAN string (mod-97 validated if provided).
         - `platformAccountHolderName`: optional string (3–100 chars if provided).
         - `justificationReason`: mandatory trimmed string (min 5, max 1000 characters) explaining why settings are being altered for administrative audit.
       - `publicPlatformSettingsSchema`: projection schema for public-facing consumer parameters (`commissionRatePercentage`, `fixedFeeAmountSar`, `ownerContractFeeSar`, `vatRatePercentage`, `paymentWindowHours`).
     - TypeScript DTO Interfaces (`packages/shared/src/types/settings.ts`):
       - `PlatformSettingsDto`: complete system settings payload.
       - `PublicPlatformSettingsDto`: public-facing safe projection for buyers and property cards.
       - `UpdatePlatformSettingsInput`: payload sent by admin including `justificationReason`.
       - `PlatformSettingsAuditEntryDto`: historical setting revision snapshot for audit logs.

2. **AC2 — Database Persistence Schema (`apps/api/prisma/schema.prisma`):**
   - **Given** the persistence model requirements for global dynamic configuration,
   - **When** `prisma generate` and migrations are applied,
   - **Then** `apps/api/prisma/schema.prisma` defines:
     - `PlatformSetting` model:
       - `id`: string `@id @default("default")` (singleton row design ensures single authoritative configuration).
       - Financials:
         - `commissionRate`: `Decimal @db.Decimal(5, 4)` (e.g., `0.0250` for 2.50%).
         - `fixedFeeSar`: `Decimal @db.Decimal(12, 2) @default(0.00)`
         - `ownerContractFeeSar`: `Decimal @db.Decimal(12, 2) @default(1000.00)`
         - `vatRate`: `Decimal @db.Decimal(5, 2) @default(15.00)`
         - `platformCollectionIban`: `String? @map("platform_collection_iban")`
         - `platformAccountHolderName`: `String? @map("platform_account_holder_name")`
         - `platformBankName`: `String? @map("platform_bank_name")`
       - Deadlines & Windows:
         - `paymentWindowHours`: `Int @default(48) @map("payment_window_hours")`
         - `paymentCorrectionHours`: `Int @default(12) @map("payment_correction_hours")`
         - `contractFeeDeadlineDays`: `Int @default(7) @map("contract_fee_deadline_days")`
         - `coolingOffPeriodDays`: `Int @default(14) @map("cooling_off_period_days")`
       - Operational SLAs & Claims:
         - `dealReviewSlaAlertHours`: `Int @default(4) @map("deal_review_sla_alert_hours")`
         - `dealReviewSlaEscalationHours`: `Int @default(12) @map("deal_review_sla_escalation_hours")`
         - `dealReviewSlaSuperAdminHours`: `Int @default(24) @map("deal_review_sla_superadmin_hours")`
         - `ticketSlaFirstResponseHours`: `Int @default(4) @map("ticket_sla_first_response_hours")`
         - `ticketSlaResolutionHours`: `Int @default(48) @map("ticket_sla_resolution_hours")`
         - `taskClaimLeaseMinutes`: `Int @default(15) @map("task_claim_lease_minutes")`
         - `taskClaimHeartbeatMinutes`: `Int @default(5) @map("task_claim_heartbeat_minutes")`
       - Fraud & Compliance:
         - `fraudRejectedProofThreshold`: `Int @default(3) @map("fraud_rejected_proof_threshold")`
         - `fraudWindowHours`: `Int @default(72) @map("fraud_window_hours")`
       - Audit metadata:
         - `updatedByAdminId`: `String? @map("updated_by_admin_id")`
         - `createdAt`: `DateTime @default(now()) @map("created_at")`
         - `updatedAt`: `DateTime @updatedAt @map("updated_at")`
       - Relations:
         - `updatedByAdmin`: `AdminUser? @relation(fields: [updatedByAdminId], references: [id], onDelete: SetNull)`
       - Mapping: `@@map("platform_settings")`
     - Database seed script (`apps/api/prisma/seed.ts`):
       - Seeds the singleton `"default"` `PlatformSetting` row with canonical default values idempotently if it does not already exist.

3. **AC3 — Backend NestJS Platform Settings Module & Dynamic Caching (`apps/api`):**
   - **Given** the requirement for sub-millisecond retrieval without repetitive database overhead on high-frequency transaction reads,
   - **When** `SettingsModule` is registered in `apps/api/src/modules/settings/settings.module.ts`,
   - **Then**:
     - `PlatformSettingsService`:
       - Maintains an in-memory cached copy of active settings with a TTL or invalidation on mutation.
       - Implements `getSettings(): Promise<PlatformSettingsDto>` with automatic fallback to canonical constants if no DB row exists.
       - Implements `getPublicSettings(): Promise<PublicPlatformSettingsDto>` returning non-sensitive public parameters.
       - Implements `updateSettings(input: UpdatePlatformSettingsInput, admin: AdminUser, ipAddress?: string): Promise<PlatformSettingsDto>`:
         - Requires valid admin context with `Settings.Manage` or `Settings.Commission`.
         - Executes in a Prisma interactive transaction.
         - Upserts the singleton `"default"` record with the updated parameters.
         - Creates an immutable `AuditLog` row capturing `previousValues`, `newValues`, `changedKeys`, `justificationReason`, admin ID, admin name, and IP address.
         - Immediately invalidates and refreshes the in-memory cached settings copy.
     - Controllers:
       - `PublicSettingsController` (`GET /api/v1/settings/public`):
         - Open endpoint (no authentication required) returning `PublicPlatformSettingsDto`.
         - Allows client-side calculators and property cards to use fresh dynamic commission rates.
       - `AdminSettingsController` under `/api/v1/admin/settings`:
         - `GET /api/v1/admin/settings`: Protected with `AdminSessionAuthGuard` and `@RequirePermissions('Settings.Manage', 'Settings.Commission')`. Returns full `PlatformSettingsDto`.
         - `PATCH /api/v1/admin/settings`: Protected with `AdminSessionAuthGuard` and `@RequirePermissions('Settings.Manage', 'Settings.Commission')`. Validates payload with `updatePlatformSettingsSchema`, updates configuration, records audit log, and returns updated settings.
         - `GET /api/v1/admin/settings/audit`: Returns chronological history of settings changes from `AuditLog` where `entityType = 'PLATFORM_SETTING'`.

4. **AC4 — Integration with Deal Creation, Freezing & Contract Fee Workflows:**
   - **Given** the business rule that parameter updates must take immediate effect on all new transactions while preserving active in-flight deals,
   - **When** an admin updates commission rate (e.g. from 2.5% to 3.0%), owner contract fee (e.g. from 1,000 SAR to 1,500 SAR), or payment window (e.g. from 48h to 72h):
   - **Then**:
     - `DealsService.finalApprove`:
       - Replaces the hardcoded `DEFAULT_COMMISSION_RATE` and `DEFAULT_PAYMENT_WINDOW_HOURS` with dynamic values retrieved from `PlatformSettingsService`.
       - Computes `platformCommission` and `totalAmount` using the dynamic rate and fixed fee.
       - Stores the exact dynamic rate snapshot (`commissionRateSnapshot = settings.commissionRate`), `fixedCommissionSnapshot`, and `paymentWindowHoursSnapshot` onto the newly created `Deal` row.
       - Computes `paymentDeadline = ClockService.now() + (settings.paymentWindowHours * 3600000)`.
     - `AdminOwnerRequestsService`:
       - Replaces `DEFAULT_OWNER_CONTRACT_FEE_SAR` with `settings.ownerContractFeeSar` as the default fee dispatched for direct owner listings when no override is specified.
     - **In-flight deal immutability verification:**
       - All previously created deals retain their frozen `commissionRateSnapshot`, `fixedCommissionSnapshot`, `paymentWindowHoursSnapshot`, and `paymentDeadline` unmodified.
       - Tests assert that changing platform settings does not alter existing deal records or their payment calculations (`AD-3`).

5. **AC5 — Administrative Settings Workspace UI (`apps/web/src/app/admin/settings`):**
   - **Given** an authorized administrator inspecting or modifying settings,
   - **When** accessing `/admin/settings`:
   - **Then**:
     - UI enforces RTL layout, sovereign palette (`#1B4332`, emerald accents, slate neutrals), and tabbed navigation:
       - **Tab 1: الرسوم والعمولات (Fees & Commissions):**
         - Platform commission rate (%) input with live example calculator.
         - Fixed fee (SAR) input.
         - Direct owner contract fee (SAR) input.
         - VAT rate (%) input.
         - Platform collection bank account info (IBAN with mod-97 check and monospace grouping, Account Holder Name, Bank Name).
       - **Tab 2: المهل الزمنية وفترات السداد (Deadlines & Windows):**
         - Deal wire payment window (hours) input (default 48h).
         - Payment proof correction grace period (hours) input (default 12h).
         - Direct owner contract fee deadline (days) input (default 7 days).
         - PDPL account deletion cooling-off period (days) input (default 14 days).
       - **Tab 3: اتفاقيات مستوى الخدمة وحجز المهام (SLAs & Task Claims):**
         - Payment proof review SLA alert tier (hours).
         - SLA escalation tier (hours).
         - SLA Super Admin mandatory decision tier (hours).
         - Support ticket first response SLA (hours).
         - Support ticket resolution SLA (hours).
         - Operational queue task claim lease duration (minutes) (default 15m).
         - Client renewal heartbeat interval (minutes) (default 5m).
       - **Tab 4: ضوابط الامتثال ومكافحة الاحتيال (Fraud & Compliance Controls):**
         - Fraud rejected proof threshold count (default 3).
         - Fraud sliding window period (hours) (default 72h).
       - **Tab 5: سجل تدقيق التعديلات (Settings Audit Trail):**
         - Chronological list of historical setting changes showing timestamp, admin name, changed fields (before vs after), and the mandatory justification reason.
     - Save Action & Safety Confirmation Modal:
       - Displays a clear diff summary of what parameters were modified.
       - Enforces entering a **سبب التعديل (Justification Reason)** (minimum 5 characters) before allowing save.
       - Shows instant toast confirmation and updates UI state.
     - Permission guard:
       - Accessible only to Super Admins or staff with `Settings.Manage` or `Settings.Commission`.
       - Users lacking permission receive an unauthorized banner/redirect.
     - Workspace Shell Integration:
       - Added to `roleNavItems[UserRole.ADMIN]` in `apps/web/src/components/layout/workspace-shell.tsx`.
       - Added to quick-access links on `/admin` dashboard.

6. **AC6 — Dynamic Public Commission Calculator Integration (`apps/web`):**
   - **Given** buyers browsing properties on `/properties/[id]`,
   - **When** the page renders the dynamic commission calculator widget (`apps/web/src/components/listings/commission-calculator.tsx`),
   - **Then**:
     - The widget fetches or accepts the current platform commission rate from `GET /api/v1/settings/public` (with fallback to 2.5% if network error occurs).
     - Calculates and displays: Ask Price, Dynamic Commission Rate & Amount, and Estimated Total.
     - Ensures property cards and listing details always reflect the current active platform business rate.

7. **AC7 — Comprehensive Test Coverage (`shared`, `api`, `web`):**
   - **Given** the implementation of Story 8.6,
   - **When** running unit, integration, and E2E test suites,
   - **Then**:
     - `packages/shared`: unit tests for `settings.schema.ts` validating boundaries, valid ranges, mod-97 IBAN checks, and SLA order constraints (`alert < escalation < superadmin`).
     - `apps/api`:
       - `platform-settings.service.spec.ts`: verifies default seeding/fallback, cache invalidation, interactive transaction, and `AuditLog` generation.
       - `admin-settings.controller.spec.ts`: tests RBAC permission guards (`Settings.Manage`, `Settings.Commission`), validation pipe, and audit response.
       - `deals.service.spec.ts` integration test: verifies that a modified commission rate (e.g. 3.0%) and modified payment window (e.g. 72h) are immediately used for new deal creation while existing deals maintain their 2.5% / 48h snapshots without mutation.
     - `apps/web`:
       - `settings-workspace.spec.tsx`: tests tab switching, validation error states, justification requirement modal, diff display, and successful save toast.

---

## Tasks / Subtasks

- [x] **Task 1: Shared Constants, Enums, Types & Validation Schemas (`@elmasaif/shared`)** (AC: #1)
  - [x] 1.1 Create `packages/shared/src/constants/settings.ts` with all canonical default values, error codes, and audit action constants.
  - [x] 1.2 Export settings constants from `packages/shared/src/constants/index.ts`.
  - [x] 1.3 Create `packages/shared/src/types/settings.ts` with `PlatformSettingsDto`, `PublicPlatformSettingsDto`, `UpdatePlatformSettingsInput`, and `PlatformSettingsAuditEntryDto`.
  - [x] 1.4 Export settings types from `packages/shared/src/types/index.ts`.
  - [x] 1.5 Create `packages/shared/src/schemas/settings.schema.ts` implementing `updatePlatformSettingsSchema` and `publicPlatformSettingsSchema` with Zod.
  - [x] 1.6 Export settings schemas from `packages/shared/src/schemas/index.ts`.
  - [x] 1.7 Add unit tests in `packages/shared/src/schemas/__tests__/settings.spec.ts` verifying boundary conditions, positive numbers, integer ranges, and justification requirements.

- [x] **Task 2: Database Schema & Migration for Platform Settings (`apps/api/prisma`)** (AC: #2)
  - [x] 2.1 Add `PlatformSetting` model to `apps/api/prisma/schema.prisma` with singleton `"default"` ID and all financial, deadline, SLA, and fraud columns.
  - [x] 2.2 Add relation between `AdminUser` and `PlatformSetting` (`updatedByAdmin`).
  - [x] 2.3 Run `prisma generate` to update Prisma client types.
  - [x] 2.4 Update `apps/api/prisma/seed.ts` to idempotently seed the `"default"` `PlatformSetting` row.

- [x] **Task 3: Backend Settings Module & Service Implementation (`apps/api`)** (AC: #3, #4)
  - [x] 3.1 Create `apps/api/src/modules/settings/platform-settings.service.ts` with cached retrieval, database upsert, cache invalidation, and `AuditLog` atomic write.
  - [x] 3.2 Create `apps/api/src/modules/settings/public-settings.controller.ts` providing unauthenticated `GET /api/v1/settings/public`.
  - [x] 3.3 Create `apps/api/src/modules/settings/admin-settings.controller.ts` providing `GET /api/v1/admin/settings`, `PATCH /api/v1/admin/settings`, and `GET /api/v1/admin/settings/audit`.
  - [x] 3.4 Create `apps/api/src/modules/settings/settings.module.ts` bundling controllers and service; export `PlatformSettingsService`.
  - [x] 3.5 Import and register `SettingsModule` in `apps/api/src/app.module.ts`.

- [x] **Task 4: Dynamic Integration into Deals, Contracts & Platform Account (`apps/api`)** (AC: #4)
  - [x] 4.1 Update `apps/api/src/modules/deals/deals.module.ts` to import `SettingsModule`.
  - [x] 4.2 In `apps/api/src/modules/deals/deals.service.ts`, inject `PlatformSettingsService` and replace hardcoded `DEFAULT_COMMISSION_RATE` and `DEFAULT_PAYMENT_WINDOW_HOURS` with active dynamic settings during `finalApprove`.
  - [x] 4.3 Update `apps/api/src/modules/contracts/admin-owner-requests.service.ts` to use dynamic `ownerContractFeeSar` as default fee.
  - [x] 4.4 Update `apps/api/src/modules/deals/platform-account.ts` to optionally read dynamic platform IBAN/name if set in DB before falling back to env.

- [x] **Task 5: Frontend Administrative Settings Workspace (`apps/web`)** (AC: #5, #6)
  - [x] 5.1 Create `apps/web/src/components/admin/settings-workspace.tsx` with Arabic RTL tabs (Fees, Deadlines, SLAs, Compliance, Audit History).
  - [x] 5.2 Implement safe change confirmation modal with diff summary and mandatory justification textarea.
  - [x] 5.3 Create page `apps/web/src/app/admin/settings/page.tsx`.
  - [x] 5.4 Update `apps/web/src/components/layout/workspace-shell.tsx` to include `إعدادات المنصة والعمولات` in admin navigation for Super Admins and staff with `Settings.Manage` / `Settings.Commission`.
  - [x] 5.5 Update `apps/web/src/app/admin/page.tsx` with a quick link card to the settings workspace.
  - [x] 5.6 Update `apps/web/src/components/listings/commission-calculator.tsx` to dynamically query or accept current commission rate.

- [x] **Task 6: Verification & Test Suite** (AC: #7)
  - [x] 6.1 Create `apps/api/src/modules/settings/__tests__/platform-settings.service.spec.ts` testing retrieval, fallback, cache refresh, and transaction logging.
  - [x] 6.2 Create `apps/api/src/modules/settings/__tests__/admin-settings.controller.spec.ts` testing guards and endpoints.
  - [x] 6.3 Update `apps/api/src/modules/deals/__tests__/deals.service.spec.ts` testing dynamic setting adoption and in-flight deal snapshot immutability.
  - [x] 6.4 Create `apps/web/src/components/admin/__tests__/settings-workspace.spec.tsx` testing tab navigation, validation, and submission.
  - [x] 6.5 Run full monorepo build and test suite (`pnpm test`) to guarantee zero regressions.

---

## Dev Notes

### Architecture Patterns & Constraints

- **Strict Presentation / Domain Separation (`AD-2`):**
  - All settings queries and updates occur via authenticated NestJS endpoints (`/api/v1/admin/settings`).
  - Next.js Server Components and client hooks fetch via the unified API proxy; no direct DB queries in Next.js.
- **Fixed-Point Money Arithmetic & Precision (`BR-02` / `AD-3`):**
  - Financial columns (`commissionRate`, `fixedFeeSar`, `ownerContractFeeSar`, `vatRate`) use fixed-point `Decimal` in Prisma.
  - No JavaScript floating-point arithmetic anywhere in the money calculation path. Use `computeDealAmounts` with string representations.
- **Binding Snapshots Are Immutable Copies (`AD-3` / Story 5.1):**
  - `Deal` records store frozen scalar snapshots (`commissionRateSnapshot`, `fixedCommissionSnapshot`, `paymentWindowHoursSnapshot`).
  - Changing a platform parameter takes immediate effect on **subsequent** deal final approvals, but **MUST NOT** recalculate or mutate existing rows in `deals`.
- **RBAC Enforcement (`AD-5`):**
  - Permissions required: `Settings.Manage` (general platform parameters) and `Settings.Commission` (financial commission rates and fees).
  - Super Admin role inherently inherits all permissions.
- **Immutable Audit Trail (`AD-6` / `FR-7` / Story 8.7):**
  - All parameter modifications MUST create an insert-only row in `AuditLog` within the same transaction.
  - The audit payload captures actor ID, admin name, timestamp, client IP, before/after JSON delta, and the mandatory `justificationReason`.
- **RTL & Design System Semantics:**
  - Administrative components must use Saudi sovereign palette (`#1B4332`, emerald accents, slate neutrals), monospace fonts for numeric values and IBANs, and Arabic RTL alignment.

### Files to Touch & Modularity

- **Packages / Shared (`packages/shared`):**
  - `packages/shared/src/constants/settings.ts` — NEW
  - `packages/shared/src/types/settings.ts` — NEW
  - `packages/shared/src/schemas/settings.schema.ts` — NEW
  - `packages/shared/src/schemas/__tests__/settings.spec.ts` — NEW
  - `packages/shared/src/constants/index.ts` — UPDATE (re-export settings constants)
  - `packages/shared/src/types/index.ts` — UPDATE (re-export settings types)
  - `packages/shared/src/schemas/index.ts` — UPDATE (re-export settings schemas)
- **API (`apps/api`):**
  - `apps/api/prisma/schema.prisma` — UPDATE (add `PlatformSetting` model, `AdminUser` relation)
  - `apps/api/prisma/seed.ts` — UPDATE (seed default platform settings row)
  - `apps/api/src/modules/settings/settings.module.ts` — NEW
  - `apps/api/src/modules/settings/platform-settings.service.ts` — NEW
  - `apps/api/src/modules/settings/admin-settings.controller.ts` — NEW
  - `apps/api/src/modules/settings/public-settings.controller.ts` — NEW
  - `apps/api/src/modules/settings/__tests__/platform-settings.service.spec.ts` — NEW
  - `apps/api/src/modules/settings/__tests__/admin-settings.controller.spec.ts` — NEW
  - `apps/api/src/modules/deals/deals.service.ts` — UPDATE (read dynamic settings instead of hardcoded TODO 8.6)
  - `apps/api/src/modules/deals/deals.module.ts` — UPDATE (import `SettingsModule`)
  - `apps/api/src/modules/contracts/admin-owner-requests.service.ts` — UPDATE (use dynamic contract fee)
  - `apps/api/src/app.module.ts` — UPDATE (register `SettingsModule`)
- **Web App (`apps/web`):**
  - `apps/web/src/app/admin/settings/page.tsx` — NEW
  - `apps/web/src/components/admin/settings-workspace.tsx` — NEW
  - `apps/web/src/components/admin/__tests__/settings-workspace.spec.tsx` — NEW
  - `apps/web/src/components/layout/workspace-shell.tsx` — UPDATE (add settings navigation link)
  - `apps/web/src/app/admin/page.tsx` — UPDATE (add settings dashboard tile)
  - `apps/web/src/components/listings/commission-calculator.tsx` — UPDATE (support dynamic rate)

### Testing Standards Summary

- Unit test coverage across:
  - Zod schemas: boundary validation, negative numbers, SLA rank hierarchy (`alert < escalation < superadmin`), and IBAN validation.
  - Service tests: caching mechanism, database upsert, transaction safety, and audit log generation.
  - Controller tests: permission guard enforcement (`Settings.Manage`, `Settings.Commission`, Super Admin bypass, unauthenticated 401).
  - Integration tests: verify deal creation accurately binds new dynamic settings while verifying existing in-flight deals retain their frozen snapshots.
  - Web tests: tab rendering, validation error messaging, diff preview modal, mandatory justification constraint, and submission handling.

---

### Project Structure Notes

- Module placement conforms to `apps/api/src/modules/settings` following standard NestJS architecture.
- Frontend workspace placed in `apps/web/src/components/admin/settings-workspace.tsx` and mounted on `apps/web/src/app/admin/settings/page.tsx` matching existing administrative workspaces (`/admin/staff`, `/admin/reports`, `/admin/tickets`).
- Navigation links integrated seamlessly into `workspace-shell.tsx`.

---

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 8.6 (L959-970)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md`#FR-68 (L775-781), #FR-69 (L782-790), #Assumptions (L1010-1033)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#AD-2, #AD-3 (L91-97), #AD-5, #AD-6]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md`#RBAC Matrix (L163-164)]
- [Source: `apps/api/src/modules/deals/deals.service.ts` (L158-168: `TODO(8.6)`)]
- [Source: `apps/api/src/modules/deals/platform-account.ts` (L18-20: platform settings reference)]
- [Source: `packages/shared/src/constants/auth.ts` (L316-317: `Settings.Manage`, `Settings.Commission`)]

---

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

- Discovered `TODO(8.6)` placeholders in `apps/api/src/modules/deals/deals.service.ts` and `apps/api/src/modules/deals/platform-account.ts`.
- Verified permission keys `Settings.Manage` and `Settings.Commission` in `packages/shared/src/constants/auth.ts`.
- Inspected previous Story 8.5 commit (`2fb019d`) for patterns in shared schemas, controllers, services, UI workspace, and testing.

### Completion Notes List

- Implemented Story 8.6 end-to-end satisfying all 7 Acceptance Criteria (AC1 through AC7).
- Shared contracts, constants, Zod schemas, and TypeScript interfaces defined in `@elmasaif/shared` with canonical defaults and strict validation bounds (mod-97 IBAN, SLA hierarchy, positive fees, mandatory justification).
- Added `PlatformSetting` model to `schema.prisma` with singleton `"default"` ID and `updatedByAdmin` relation to `AdminUser`. Updated `seed.ts` for idempotent seeding.
- Created `SettingsModule`, `PlatformSettingsService`, `PublicSettingsController`, and `AdminSettingsController` in `apps/api/src/modules/settings/`.
- Implemented in-memory caching with TTL and explicit invalidation, interactive `$transaction` updates recording before/after JSON diffs in `AuditLog`.
- Integrated dynamic settings in `DealsService.finalApprove` (rate, fixed fee, payment window) while preserving immutable snapshot protection for active in-flight deals (AD-3).
- Integrated dynamic `ownerContractFeeSar` in `AdminOwnerRequestsService` and dynamic IBAN / holder name in `PlatformAccountService`.
- Built Arabic RTL administrative workspace in `apps/web/src/components/admin/settings-workspace.tsx` with 5 tabs (Fees, Deadlines, SLAs, Compliance, Audit History), live commission simulator, and diff confirmation modal with required justification.
- Mounted route at `apps/web/src/app/admin/settings/page.tsx`, linked in `workspace-shell.tsx` and `apps/web/src/app/admin/page.tsx`.
- Updated public `CommissionCalculator` widget to accept dynamic rates and query `/api/v1/settings/public`.
- Fixed pre-existing JSX button closing tag in `apps/web/src/app/brokers/[id]/page.tsx`.
- Verified test suite:
  - `@elmasaif/shared`: 50 test files, 657 tests passed (including 11 new schema unit tests).
  - `@elmasaif/api`: Settings tests (9 tests), Deals tests (31 tests), Platform Account (7 tests), Contracts (13 tests) all passed; `nest build` succeeded.
  - `@elmasaif/web`: 88 test files, 489 tests passed (including 5 new workspace tests); `next build` (58 static/dynamic routes) succeeded cleanly.

### File List

- `packages/shared/src/constants/settings.ts` (NEW)
- `packages/shared/src/constants/index.ts` (UPDATE)
- `packages/shared/src/types/settings.ts` (NEW)
- `packages/shared/src/types/index.ts` (UPDATE)
- `packages/shared/src/schemas/settings.schema.ts` (NEW)
- `packages/shared/src/schemas/index.ts` (UPDATE)
- `packages/shared/src/schemas/__tests__/settings.spec.ts` (NEW)
- `apps/api/prisma/schema.prisma` (UPDATE)
- `apps/api/prisma/seed.ts` (UPDATE)
- `apps/api/src/modules/settings/platform-settings.service.ts` (NEW)
- `apps/api/src/modules/settings/public-settings.controller.ts` (NEW)
- `apps/api/src/modules/settings/admin-settings.controller.ts` (NEW)
- `apps/api/src/modules/settings/settings.module.ts` (NEW)
- `apps/api/src/modules/settings/__tests__/platform-settings.service.spec.ts` (NEW)
- `apps/api/src/modules/settings/__tests__/admin-settings.controller.spec.ts` (NEW)
- `apps/api/src/modules/deals/deals.module.ts` (UPDATE)
- `apps/api/src/modules/deals/deals.service.ts` (UPDATE)
- `apps/api/src/modules/deals/platform-account.ts` (UPDATE)
- `apps/api/src/modules/deals/__tests__/deals.service.spec.ts` (UPDATE)
- `apps/api/src/modules/contracts/contracts.module.ts` (UPDATE)
- `apps/api/src/modules/contracts/admin-owner-requests.service.ts` (UPDATE)
- `apps/api/src/app.module.ts` (UPDATE)
- `apps/web/src/components/admin/settings-workspace.tsx` (NEW)
- `apps/web/src/app/admin/settings/page.tsx` (NEW)
- `apps/web/src/components/admin/__tests__/settings-workspace.spec.tsx` (NEW)
- `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE)
- `apps/web/src/app/admin/page.tsx` (UPDATE)
- `apps/web/src/components/listings/commission-calculator.tsx` (UPDATE)
- `apps/web/src/app/brokers/[id]/page.tsx` (UPDATE)
- `_bmad-output/implementation-artifacts/8-6-dynamic-platform-settings-commission-configuration.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

