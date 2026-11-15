---
baseline_commit: 5c04a3a3c5748f10bcadbe7f8adb7b52c3c4fa1d
---

# Story 8.9: Fraud Management Log, Financial Reports & CMS

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Executive or Operational Manager (Super Admin, Financial Auditor, or Compliance Officer)**,
I want access to the **centralized fraud management log with marketer suspension capabilities, real-time financial indicators with CSV/Excel accounting exports, dynamic CMS content and announcement banner managers, entity-scoped internal staff notes, and an executive administrative operations dashboard**,
so that **platform operations, regulatory compliance, revenue throughput, and public informational content can be monitored, adjudicated, and governed comprehensively from within the isolated administrative realm**.

---

## Acceptance Criteria

1. **AC1 — Shared Domain Contracts, Enums, Types & Zod Schemas (`@elmasaif/shared`):**
   - **Given** the operational governance requirements in `FR-62`, `FR-63`, `FR-64`, `FR-65`, `FR-66`, and `ARCHITECTURE-SPINE.md §5`,
   - **When** domain contracts are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - **Fraud Enums & Constants (`packages/shared/src/enums/fraud.ts` & `constants/fraud.ts`):**
       - `FraudEventType`: `'REPEATED_REJECTED_PROOFS' | 'REPEATED_IBAN_CHANGES' | 'REPEATED_CANCELLATIONS' | 'SUSPICIOUS_MESSAGING' | 'UNAUTHORIZED_BROKER_ACTIVITY' | 'MANUAL_SUSPICIOUS_REPORT'`.
       - `FraudSeverity`: `'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`.
       - `FraudStatus`: `'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED'`.
       - `AUDIT_ACTION_FRAUD_LOGGED = 'FRAUD_LOGGED'`, `AUDIT_ACTION_FRAUD_RESOLVED = 'FRAUD_RESOLVED'`, `AUDIT_ACTION_PENALTY_RECORDED = 'COMPLIANCE_PENALTY_RECORDED'`, `AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED = 'MARKETER_FRAUD_SUSPENDED'`.
     - **CMS Enums & Constants (`packages/shared/src/enums/cms.ts` & `constants/cms.ts`):**
       - `CmsPageCategory`: `'LEGAL_TERMS' | 'PRIVACY_POLICY' | 'FAQ' | 'GUIDE' | 'ANNOUNCEMENT'`.
       - `AnnouncementBannerType`: `'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS'`.
       - `FaqCategory`: `'GENERAL' | 'BUYER' | 'MARKETER' | 'OWNER' | 'DEALS'`.
       - `AUDIT_ACTION_CMS_PAGE_UPDATED = 'CMS_PAGE_UPDATED'`, `AUDIT_ACTION_BANNER_SAVED = 'ANNOUNCEMENT_BANNER_SAVED'`.
     - **Internal Notes Enums & Constants (`packages/shared/src/enums/notes.ts` & `constants/notes.ts`):**
       - `NoteEntityType`: `'LISTING' | 'DEAL' | 'USER' | 'DISPUTE' | 'CONTRACT'`.
       - `AUDIT_ACTION_INTERNAL_NOTE_CREATED = 'INTERNAL_NOTE_CREATED'`.
     - **Financial Enums & Constants (`packages/shared/src/constants/finance.ts`):**
       - `AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED = 'FINANCIAL_REPORT_EXPORTED'`.
       - Standard Saudi VAT Rate Constant: `SAUDI_VAT_RATE = 0.15` (15%).
     - **Zod Validation Schemas (`packages/shared/src/schemas/`):**
       - `createFraudLogSchema`: validates targetUserId (optional UUID), targetListingId (optional UUID), targetDealId (optional UUID), eventType (`FraudEventType`), severity (`FraudSeverity`), detectedReasons (array of strings), description (min 10 chars), penaltySar (optional positive decimal), suspendMarketer (optional boolean).
       - `resolveFraudLogSchema`: validates status (`RESOLVED` or `DISMISSED`), resolutionNotes (min 5 chars), penaltySar (optional positive decimal), suspendMarketer (optional boolean).
       - `financialReportQuerySchema`: validates `startDate` (ISO string optional), `endDate` (ISO string optional), `propertyType` (optional PropertyType enum), `cityId` (optional UUID), `marketerId` (optional UUID), `page` (optional integer >= 1), `limit` (optional integer 1..100).
       - `upsertCmsPageSchema`: validates `slug` (kebab-case string min 3 chars), `title` (string min 3 chars), `category` (`CmsPageCategory`), `content` (markdown string min 10 chars), `summary` (optional string), `isPublished` (boolean), `displayOrder` (optional integer).
       - `upsertBannerSchema`: validates `title` (string min 3 chars), `content` (string min 5 chars), `bannerType` (`AnnouncementBannerType`), `isActive` (boolean), `startAt` (optional ISO date), `endAt` (optional ISO date), `actionUrl` (optional string URL or path), `actionText` (optional string).
       - `upsertFaqItemSchema`: validates `questionAr` (min 5 chars), `answerAr` (min 10 chars), `questionEn` (optional string), `answerEn` (optional string), `category` (`FaqCategory`), `displayOrder` (integer), `isPublished` (boolean).
       - `createInternalNoteSchema`: validates `entityType` (`NoteEntityType`), `entityId` (UUID string), `content` (string 1..1000 characters).
     - **TypeScript DTO Interfaces (`packages/shared/src/types/`):**
       - `FraudLogDto`, `PaginatedFraudLogsDto`, `RecordPenaltyInputDto`, `SuspendMarketerInputDto`.
       - `FinancialIndicatorsDto`: `{ grossTransactionVolumeSar: number; confirmedCommissionsSar: number; collectedContractFeesSar: number; totalVatSar: number; totalNetRevenueSar: number; completedDealsCount: number; signedContractsCount: number; periodStart: string; periodEnd: string; }`.
       - `FinancialTransactionRowDto`: `{ id: string; type: 'DEAL_COMMISSION' | 'OWNER_CONTRACT_FEE'; referenceCode: string; date: string; propertyTitle: string; city: string; propertyType: string; grossValueSar: number; feeSar: number; vatSar: number; totalSar: number; counterpartyName: string; status: string; }`.
       - `CmsPageDto`, `AnnouncementBannerDto`, `FaqItemDto`.
       - `OperationalInternalNoteDto`: `{ id: string; entityType: NoteEntityType; entityId: string; content: string; authorAdminId: string; authorAdminName: string; authorAdminRole: string; createdAt: string; updatedAt: string; }`.
       - `ExecutiveDashboardMetricsDto`: `{ dealCounts48h: { activeInPaymentWindow: number; completedLast48h: number; pendingReviewLast48h: number; totalVolumeLast48hSar: number; }; pendingQueues: { listingsModeration: number; falVerifications: number; paymentProofReviews: number; contractFeeReviews: number; unassignedDisputes: number; openTickets: number; pendingViolationReports: number; activeTaskClaims: number; }; slaWarnings: { dealsExpiringSoon12h: number; ticketsSlaBreached: number; listingsPendingOver24h: number; }; financialThroughput30d: { grossVolumeSar: number; commissionsSar: number; contractFeesSar: number; }; }`.

2. **AC2 — Database Schema & Prisma Migrations (`apps/api/prisma`):**
   - **Given** data storage models required for fraud auditing, operational internal notes, and content management,
   - **When** migrations are applied to the PostgreSQL database,
   - **Then** `apps/api/prisma/schema.prisma` defines:
     - Enums: `FraudEventType`, `FraudSeverity`, `FraudStatus`, `NoteEntityType`, `CmsPageCategory`.
     - Model `FraudLog`:
       - `id` (UUID), `caseNumber` (unique string, e.g. `FRD-2026-XXXX`), `eventType` (`FraudEventType`), `severity` (`FraudSeverity`), `status` (`FraudStatus`), `targetUserId` (optional nullable relation to `User`), `targetListingId` (optional string), `targetDealId` (optional string), `detectedReasons` (`String[]`), `description` (`String`), `penaltySar` (`Decimal(12, 2)` optional), `penaltyReason` (`String?`), `marketerSuspended` (`Boolean` default false), `loggedByAdminId` (optional relation to `AdminUser`), `resolvedByAdminId` (optional relation to `AdminUser`), `resolutionNotes` (`String?`), `metadata` (`Json?`), `createdAt`, `updatedAt`.
       - Indexes: `[eventType, status]`, `[targetUserId]`, `[createdAt]`.
     - Model `OperationalInternalNote`:
       - `id` (UUID), `entityType` (`NoteEntityType`), `entityId` (`String`), `content` (`String` max 1000 chars), `authorAdminId` (relation to `AdminUser`), `createdAt`, `updatedAt`.
       - Indexes: `[entityType, entityId, createdAt]`.
     - Model `CmsPage`:
       - `id` (UUID), `slug` (unique string), `title` (`String`), `category` (`CmsPageCategory`), `content` (`Text`), `summary` (`String?`), `isPublished` (`Boolean` default true), `displayOrder` (`Int` default 0), `publishedAt` (`DateTime?`), `authorAdminId` (optional relation to `AdminUser`), `createdAt`, `updatedAt`.
       - Indexes: `[category, isPublished, displayOrder]`.
     - Model `AnnouncementBanner`:
       - `id` (UUID), `title` (`String`), `content` (`String`), `bannerType` (`String` default "INFO"), `isActive` (`Boolean` default true), `startAt` (`DateTime?`), `endAt` (`DateTime?`), `actionUrl` (`String?`), `actionText` (`String?`), `createdByAdminId` (optional relation to `AdminUser`), `createdAt`, `updatedAt`.
       - Indexes: `[isActive, startAt, endAt]`.
     - Model `FaqItem`:
       - `id` (UUID), `questionAr` (`String`), `answerAr` (`Text`), `questionEn` (`String?`), `answerEn` (`Text?`), `category` (`String` default "GENERAL"), `displayOrder` (`Int` default 0), `isPublished` (`Boolean` default true), `createdAt`, `updatedAt`.
       - Indexes: `[category, isPublished, displayOrder]`.
     - Relations on `AdminUser` and `User` models updated cleanly without breaking existing schema references.

3. **AC3 — Fraud Management Log & Suspicious Activity Service (`apps/api/src/modules/fraud`):**
   - **Given** an administrative user accessing `/api/v1/admin/fraud`,
   - **When** creating, listing, or resolving fraud log entries,
   - **Then**:
     - All routes require `AdminSessionAuthGuard` and permissions `Fraud.View`, `Compliance.Manage`, or `Security.Manage`.
     - `GET /api/v1/admin/fraud`:
       - Supports filtering by `status`, `severity`, `eventType`, `targetUserId`, `search`, with pagination.
       - Returns `PaginatedFraudLogsDto`.
     - `POST /api/v1/admin/fraud`:
       - Requires `Security.Manage` or `Compliance.Manage`.
       - Generates unique sequential `caseNumber` (`FRD-YYYY-XXXX`).
       - If `suspendMarketer` is true:
         - Updates target user profile status to `COMPLIANCE_RESTRICTED` / suspended.
         - Automatically transitions target user's active listings to `UNDER_COMPLIANCE_REVIEW` with reason `COMPLIANCE_REASON_FAL_EXPIRED` or `"موقوف إدارياً لمخالفات امتثال واحتيال"`.
         - Writes `AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED` to `AuditLog`.
       - If `penaltySar` is provided:
         - Records numeric penalty amount and reason in the fraud log.
         - Writes `AUDIT_ACTION_PENALTY_RECORDED` to `AuditLog`.
       - Writes `AUDIT_ACTION_FRAUD_LOGGED` to `AuditLog` capturing admin ID, target ID, and reasons.
     - `PATCH /api/v1/admin/fraud/:id/resolve`:
       - Requires `Compliance.Manage` or `Security.Manage`.
       - Updates status to `RESOLVED` or `DISMISSED` with resolution notes.
       - Records resolving admin ID and writes `AUDIT_ACTION_FRAUD_RESOLVED` to `AuditLog`.
     - Automated fraud detection hooks:
       - Service method `recordAutomatedFraudEventIfThresholdReached(userId, triggerType)`:
         - Inspects repeated rejected payment proofs within `PlatformSetting.fraudWindowHours` (72h). If count >= `PlatformSetting.fraudRejectedProofThreshold` (3), automatically creates a `REPEATED_REJECTED_PROOFS` case.
         - Inspects repeated payout account edits (> 2 edits within 72h). If exceeded, automatically creates a `REPEATED_IBAN_CHANGES` case.

4. **AC4 — Financial Indicators & Accounting Reports with Export Service (`apps/api/src/modules/finance`):**
   - **Given** an administrative user accessing `/api/v1/admin/finance`,
   - **When** requesting financial indicators or exporting transaction data,
   - **Then**:
     - Endpoints require `AdminSessionAuthGuard` and permissions `Finance.View`, `Finance.Audit`, or `Finance.Export`.
     - `GET /api/v1/admin/finance/indicators`:
       - Requires `Finance.View` or `Finance.Audit`.
       - Aggregates:
         - Gross Transaction Volume: total sum of deal price for deals in status `COMPLETED`.
         - Confirmed Platform Commissions: total sum of confirmed `COMMISSION` payments.
         - Confirmed Owner Contract Fees: total sum of confirmed `ContractFeePayment` records (1,000 SAR each).
         - Calculated VAT: 15% VAT on confirmed commissions and contract fees.
         - Total Net Revenue: Platform fees minus VAT.
         - Completed deals count & signed contracts count.
       - Supports date range query (`startDate`, `endDate`), `propertyType`, and `cityId`.
     - `GET /api/v1/admin/finance/transactions`:
       - Returns paginated list of financial transaction rows (deals and contract fees) with detailed breakdown (gross value, commission, fee, VAT, counterparty).
     - `GET /api/v1/admin/finance/export`:
       - Requires permission `Finance.Export`.
       - Formats data as UTF-8 CSV with BOM (`\uFEFF`) to ensure seamless Arabic character rendering in Microsoft Excel.
       - Columns: معرف المعاملة (ID), نوع المعاملة (Type), رقم المرجع (Reference), التاريخ (Date), اسم العقار (Property Title), المدينة (City), نوع العقار (Property Type), القيمة الإجمالية (Gross SAR), عمولة المنصة (Commission SAR), رسوم العقد (Contract Fee SAR), ضريبة القيمة المضافة (VAT 15% SAR), الإجمالي بالريال (Total SAR), اسم الطرف المعني (Counterparty), حالة المعاملة (Status).
       - Automatically records immutable entry in `AuditLog` (`AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED`) containing admin ID, query parameters, timestamp, and row count.
       - Sets HTTP headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="financial-report-<date>.csv"`.

5. **AC5 — CMS Content, FAQ & Announcement Banners Service (`apps/api/src/modules/cms`):**
   - **Given** public visitors or administrative CMS managers,
   - **When** retrieving or managing CMS content,
   - **Then**:
     - **Public Endpoints (No Auth Required):**
       - `GET /api/v1/cms/pages/:slug`: returns published `CmsPageDto` (Terms of Service, Privacy Policy, Guides). Returns 404 if not found or unpublished.
       - `GET /api/v1/cms/banners/active`: returns active announcement banners where `isActive = true`, `startAt <= now()`, and `endAt >= now()` (or null).
       - `GET /api/v1/cms/faq`: returns published FAQ entries grouped by category and sorted by `displayOrder`.
     - **Administrative Endpoints (`AdminSessionAuthGuard` + `CMS.Manage` or `Content.Manage`):**
       - `GET /api/v1/admin/cms/pages`: lists all CMS pages (published and drafts).
       - `POST /api/v1/admin/cms/pages`: creates/updates CMS page; writes `AUDIT_ACTION_CMS_PAGE_UPDATED` to `AuditLog`.
       - `GET /api/v1/admin/cms/banners`: lists all announcement banners.
       - `POST /api/v1/admin/cms/banners`: creates/updates announcement banner; writes `AUDIT_ACTION_BANNER_SAVED` to `AuditLog`.
       - `DELETE /api/v1/admin/cms/banners/:id`: deletes banner; writes audit log.
       - `GET /api/v1/admin/cms/faq`: lists all FAQ entries with reordering capabilities.
       - `POST /api/v1/admin/cms/faq`: creates/updates FAQ items.
       - `DELETE /api/v1/admin/cms/faq/:id`: deletes FAQ item.

6. **AC6 — Operational Internal Staff Notes Service (`apps/api/src/modules/notes`):**
   - **Given** administrative staff reviewing listings, deals, user accounts, or disputes,
   - **When** creating or retrieving internal staff notes,
   - **Then**:
     - All routes require `AdminSessionAuthGuard` and permission `Notes.Manage`.
     - **Security & Privacy Isolation (`AdminOnly`):**
       - Internal notes are NEVER returned in public, buyer, marketer, or owner API responses.
       - Only accessible via `/api/v1/admin/notes`.
     - `GET /api/v1/admin/notes`:
       - Query parameters: `entityType` (`LISTING`, `DEAL`, `USER`, `DISPUTE`, `CONTRACT`) and `entityId` (UUID).
       - Returns array of `OperationalInternalNoteDto` ordered by `createdAt` descending.
       - Populates author admin's name and role.
     - `POST /api/v1/admin/notes`:
       - Validates input using `createInternalNoteSchema` (content 1..1000 characters).
       - Persists note with `authorAdminId` bound to the authenticated admin session.
       - Writes `AUDIT_ACTION_INTERNAL_NOTE_CREATED` to `AuditLog` capturing entity type and ID.
       - Returns created `OperationalInternalNoteDto`.

7. **AC7 — Executive Administrative Operations Dashboard Service (`apps/api/src/modules/executive`):**
   - **Given** an executive administrator (Super Admin or Operational Director),
   - **When** calling `GET /api/v1/admin/executive/dashboard`,
   - **Then**:
     - Requires `AdminSessionAuthGuard` and admin access.
     - Computes real-time operational metrics across all platform modules:
       - **48-Hour Deal Activity:** Count of deals created within last 48 hours, active deals within payment window, payment proofs submitted within last 48 hours, total deal SAR volume in window.
       - **Pending Operational Queue Volumes:** Count of listings awaiting moderation (`PENDING_REVIEW`, `UNDER_COMPLIANCE_REVIEW`), Fal licenses awaiting review (`PENDING`), deal payment proofs awaiting review (`UNDER_REVIEW`), contract fee proofs awaiting review (`UNDER_REVIEW`), unassigned disputes, open support tickets, pending violation reports, and active task claim locks currently leased.
       - **SLA Breach Warnings:** Deals with payment deadline < 12 hours remaining, support tickets exceeding first response SLA (4 hours) or resolution SLA (48 hours), listings pending review > 24 hours.
       - **Financial Throughput (30 Days):** 30-day gross transaction volume, confirmed platform commissions, collected owner contract fees.
     - Returns `ExecutiveDashboardMetricsDto` with millisecond performance (using optimized Prisma count queries with indexed fields).

8. **AC8 — Frontend Admin Workspaces & Executive Operations UI (`apps/web`):**
   - **Given** an administrative user navigating the back-office workspace,
   - **When** viewing administrative dashboards and tools,
   - **Then**:
     - **Enhanced Admin Home & Executive Operations Dashboard (`/admin`):**
       - Displays 4 Executive Metric Overview Cards: 48-Hour Deal Volume, Pending Queue Backlog, Active SLA Warnings, 30-Day Platform Revenue.
       - Displays SLA Warning Alert Banners in amber/red when deals or tickets approach breach thresholds.
       - Displays Quick Links to all operational queues (`/admin/queues`, `/admin/listings/moderation`, `/admin/licenses`, `/admin/payments`, `/admin/fraud`, `/admin/finance`).
     - **Fraud Management Log Workspace (`/admin/fraud`):**
       - Displays tabular log of all fraud cases with case numbers, severity badges (Low/Medium/High/Critical), status pills, target entities, and detected reasons.
       - "تسجيل حالة اشتباه (Log Suspicious Activity)" action modal: allows entering target user/deal/listing, severity, explanation, and option to immediately apply marketer suspension or record monetary penalty SAR.
       - Case detail drawer/modal: shows investigation history, resolution actions, and button to resolve or dismiss case with resolution notes.
       - Guarded by `Fraud.View` / `Compliance.Manage` / `Security.Manage`.
     - **Financial Indicators & Reports Workspace (`/admin/finance`):**
       - Displays KPI summary cards: Gross Sales Volume, Confirmed Commissions, Collected Contract Fees, Total VAT 15%, Net Revenue.
       - Filter bar: date range picker (From/To), property type dropdown, city dropdown.
       - Detailed transaction records table with pagination.
       - "تصدير تقرير إكسل/CSV (Export Financial Report)" button triggering download of Excel-ready CSV with audit log recording.
       - Guarded by `Finance.View` / `Finance.Export` / `Finance.Audit`.
     - **CMS Management Workspace (`/admin/cms`):**
       - Tabbed interface:
         - "الصفحات الثابتة (Static Pages)": manage Terms of Service, Privacy Policy, Guides with markdown preview.
         - "شريط الإعلانات والتنبيهات (Announcement Banners)": create, toggle active status, set start/end schedules, and preview announcement banners.
         - "الأسئلة الشائعة (FAQ)": manage questions and answers in Arabic and English with category tagging and drag-or-order ranking.
       - Guarded by `CMS.Manage` or `Content.Manage`.
     - **Reusable Internal Staff Notes Component (`OperationalInternalNotesCard`):**
       - Embeddable widget rendering private administrative notes with author badge, relative timestamp, and character counter (up to 1,000 chars).
       - Add note form with immediate optimistic refresh.
       - Integrated into Listing moderation review, Deal payment inspection, and Marketer profile review.
     - **Public CMS Reader Pages (`/pages/[slug]` & `/pages/faq`) & Top Announcement Banner Bar:**
       - `/pages/[slug]`: renders formatted Arabic legal and informational content.
       - `/pages/faq`: accessible accordion of categorized frequently asked questions.
       - `AnnouncementBannerBar`: top-of-page alert banner rendering active announcements with semantic styling (INFO/WARNING/ALERT).

---

## Tasks / Subtasks

- [x] Task 1: Shared Domain Contracts, Enums, Constants & Zod Schemas (`@elmasaif/shared`) (AC: 1)
  - [x] 1.1 Create `packages/shared/src/enums/fraud.ts` exporting `FraudEventType`, `FraudSeverity`, `FraudStatus`.
  - [x] 1.2 Create `packages/shared/src/enums/cms.ts` exporting `CmsPageCategory`, `AnnouncementBannerType`, `FaqCategory`.
  - [x] 1.3 Create `packages/shared/src/enums/notes.ts` exporting `NoteEntityType`.
  - [x] 1.4 Create `packages/shared/src/constants/fraud.ts`, `constants/finance.ts`, `constants/cms.ts`, `constants/notes.ts` exporting audit actions and Saudi VAT rate (0.15).
  - [x] 1.5 Create Zod schemas in `packages/shared/src/schemas/`: `createFraudLogSchema`, `resolveFraudLogSchema`, `financialReportQuerySchema`, `upsertCmsPageSchema`, `upsertBannerSchema`, `upsertFaqItemSchema`, `createInternalNoteSchema`.
  - [x] 1.6 Create TypeScript DTO interfaces in `packages/shared/src/types/`: `FraudLogDto`, `FinancialIndicatorsDto`, `FinancialTransactionRowDto`, `CmsPageDto`, `AnnouncementBannerDto`, `FaqItemDto`, `OperationalInternalNoteDto`, `ExecutiveDashboardMetricsDto`.
  - [x] 1.7 Export all contracts in `packages/shared/src/index.ts` and write comprehensive unit tests in `packages/shared/src/__tests__/fraud-finance-cms.spec.ts`.

- [x] Task 2: Database Schema & Prisma Migrations (`apps/api/prisma`) (AC: 2)
  - [x] 2.1 Add enums to `apps/api/prisma/schema.prisma`: `FraudEventType`, `FraudSeverity`, `FraudStatus`, `NoteEntityType`, `CmsPageCategory`.
  - [x] 2.2 Add models to `apps/api/prisma/schema.prisma`: `FraudLog`, `OperationalInternalNote`, `CmsPage`, `AnnouncementBanner`, `FaqItem`.
  - [x] 2.3 Add relations for `AdminUser` (logged fraud cases, resolved fraud cases, authored notes, authored CMS pages, created banners) and `User` (target of fraud cases).
  - [x] 2.4 Generate and apply Prisma migration (`20261115_add_fraud_finance_cms_notes_models`).

- [x] Task 3: Fraud Management Log & Marketer Suspensions Module (`apps/api/src/modules/fraud`) (AC: 3)
  - [x] 3.1 Implement `FraudService` with `getFraudLogs`, `createFraudLog`, `resolveFraudLog`, and `recordAutomatedFraudEventIfThresholdReached`.
  - [x] 3.2 Implement marketer suspension logic in `FraudService`: transition profile to `COMPLIANCE_RESTRICTED`, transition active listings to `UNDER_COMPLIANCE_REVIEW`, and emit audit logs.
  - [x] 3.3 Create `FraudController` with `@Get('/')`, `@Post('/')`, `@Patch('/:id/resolve')` guarded by `AdminSessionAuthGuard` and `RequirePermissions`.
  - [x] 3.4 Wire automated fraud check hook in payment review service when payment proofs are rejected.
  - [x] 3.5 Write unit tests in `apps/api/src/modules/fraud/__tests__/fraud.service.spec.ts`.

- [x] Task 4: Financial Indicators & Transaction Accounting Reports Module (`apps/api/src/modules/finance`) (AC: 4)
  - [x] 4.1 Implement `FinanceService` with `getIndicators`, `getTransactions`, and `exportReportCsv`.
  - [x] 4.2 Calculate gross volumes, confirmed commissions, contract fees, 15% VAT, and net revenues from Prisma `Deal`, `Payment`, and `ContractFeePayment` tables.
  - [x] 4.3 Format CSV with UTF-8 BOM (`\uFEFF`) and proper Arabic header columns.
  - [x] 4.4 Wire audit log recording on report export (`AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED`).
  - [x] 4.5 Create `FinanceController` with `@Get('/indicators')`, `@Get('/transactions')`, `@Get('/export')` guarded by `Finance.View`, `Finance.Audit`, `Finance.Export`.
  - [x] 4.6 Write unit tests in `apps/api/src/modules/finance/__tests__/finance.service.spec.ts`.

- [x] Task 5: Content Management System (CMS) & Announcements Module (`apps/api/src/modules/cms`) (AC: 5)
  - [x] 5.1 Implement `CmsService` for managing pages, announcement banners, and FAQ items.
  - [x] 5.2 Implement public routes: `GET /api/v1/cms/pages/:slug`, `GET /api/v1/cms/banners/active`, `GET /api/v1/cms/faq`.
  - [x] 5.3 Implement administrative CRUD routes in `CmsController` guarded by `AdminSessionAuthGuard` and `CMS.Manage` / `Content.Manage`.
  - [x] 5.4 Seed initial core CMS legal pages (Terms of Service, Privacy Policy, Marketer Guide, Buyer Guide) and FAQ entries.
  - [x] 5.5 Write unit tests in `apps/api/src/modules/cms/__tests__/cms.service.spec.ts`.

- [x] Task 6: Operational Internal Staff Notes Module (`apps/api/src/modules/notes`) (AC: 6)
  - [x] 6.1 Implement `NotesService` with `getNotesByEntity` and `createNote`.
  - [x] 6.2 Enforce strict `AdminOnly` visibility isolation: reject non-admin access and never expose notes in public API DTOs.
  - [x] 6.3 Create `NotesController` with `@Get('/')` and `@Post('/')` guarded by `AdminSessionAuthGuard` and `Notes.Manage`.
  - [x] 6.4 Write unit tests in `apps/api/src/modules/notes/__tests__/notes.service.spec.ts`.

- [x] Task 7: Executive Administrative Operations Dashboard Module (`apps/api/src/modules/executive`) (AC: 7)
  - [x] 7.1 Implement `ExecutiveService` computing real-time 48-hour deal counts, pending queue volumes, SLA warnings, and financial throughput.
  - [x] 7.2 Create `ExecutiveController` with `@Get('/dashboard')` guarded by `AdminSessionAuthGuard`.
  - [x] 7.3 Register all new modules (`FraudModule`, `FinanceModule`, `CmsModule`, `NotesModule`, `ExecutiveModule`) in `apps/api/src/app.module.ts`.
  - [x] 7.4 Write unit tests in `apps/api/src/modules/executive/__tests__/executive.service.spec.ts`.

- [x] Task 8: Frontend Admin Navigation, Dashboard & Workspaces (`apps/web`) (AC: 8)
  - [x] 8.1 Update `apps/web/src/components/layout/workspace-shell.tsx` with sidebar navigation links for `/admin/fraud`, `/admin/finance`, and `/admin/cms`.
  - [x] 8.2 Update `apps/web/src/app/admin/page.tsx` with Executive Operations Dashboard metrics, SLA warnings, and queue cards.
  - [x] 8.3 Implement Fraud Management Log Workspace at `apps/web/src/app/admin/fraud/page.tsx` with case logging modal and resolution drawer.
  - [x] 8.4 Implement Financial Reports & Export Workspace at `apps/web/src/app/admin/finance/page.tsx` with KPI cards, transaction table, date filter, and CSV download.
  - [x] 8.5 Implement CMS & Announcements Workspace at `apps/web/src/app/admin/cms/page.tsx` with pages editor, banner manager, and FAQ editor tabs.
  - [x] 8.6 Implement reusable `OperationalInternalNotesCard` component in `apps/web/src/components/admin/operational-internal-notes-card.tsx` and integrate into listing review and payments pages.
  - [x] 8.7 Implement public CMS reader pages (`apps/web/src/app/pages/[slug]/page.tsx`, `apps/web/src/app/pages/faq/page.tsx`) and `AnnouncementBannerBar` in `apps/web/src/components/layout/announcement-banner-bar.tsx`.
  - [x] 8.8 Write component and page unit tests in `apps/web/src/components/admin/__tests__/` and `apps/web/src/app/admin/__tests__/`.

---

## Dev Notes & Architecture Guardrails

### 1. Architectural Guardrails & Principles
- **Dual-Realm Administrative Isolation (`AD-5`):** Administrative endpoints MUST remain strictly separated from user endpoints. Admin routes use `/api/v1/admin/*` and authenticate via `elmasaif_admin_session` cookie handled by `AdminSessionAuthGuard`.
- **Granular RBAC (`FR-39`, `FR-70`):**
  - Fraud Log & Suspensions: `Fraud.View` (read), `Compliance.Manage` / `Security.Manage` (write/suspend), `Penalties.Apply` (penalty).
  - Financial Indicators & Reports: `Finance.View` (read), `Finance.Audit` (full audit), `Finance.Export` (CSV export).
  - CMS & Announcements: `CMS.Manage` or `Content.Manage`.
  - Internal Staff Notes: `Notes.Manage`.
  - Executive Dashboard: `SUPER_ADMIN` or any admin with administrative permissions.
- **Strict Data Isolation for Internal Notes (`FR-65`):** Internal notes MUST NEVER be serialized or returned in user-facing endpoints (`/api/v1/listings/*`, `/api/v1/deals/*`, `/api/v1/users/*`).
- **Immutable Audit Logging (`FR-41`, `FR-62`, `FR-63`):** Every administrative write action (logging fraud, resolving fraud, recording penalties, suspending marketers, exporting financial reports, modifying CMS content, adding internal notes) MUST write an append-only entry to `AuditLog`.
- **Saudi Sovereign Standards & Currency:** All financial amounts are in Saudi Riyals (`SAR`), formatted using Arabic locale (`ar-SA`). Standard VAT is 15%. CSV exports must prepend the UTF-8 Byte Order Mark (`\uFEFF`) to open cleanly in Excel with Arabic text.

### 2. File Structure & Target Locations
```
packages/shared/src/
├── constants/
│   ├── cms.ts                    # (NEW)
│   ├── finance.ts                # (NEW)
│   ├── fraud.ts                  # (NEW)
│   └── notes.ts                  # (NEW)
├── enums/
│   ├── cms.ts                    # (NEW)
│   ├── fraud.ts                  # (NEW)
│   └── notes.ts                  # (NEW)
├── schemas/
│   ├── cms.schema.ts             # (NEW)
│   ├── finance.schema.ts         # (NEW)
│   ├── fraud.schema.ts           # (NEW)
│   └── notes.schema.ts           # (NEW)
├── types/
│   ├── cms.ts                    # (NEW)
│   ├── executive.ts              # (NEW)
│   ├── finance.ts                # (NEW)
│   ├── fraud.ts                  # (NEW)
│   └── notes.ts                  # (NEW)
└── __tests__/
    └── fraud-finance-cms.spec.ts # (NEW)

apps/api/
├── prisma/
│   └── schema.prisma             # (MODIFIED: Add FraudLog, OperationalInternalNote, CmsPage, AnnouncementBanner, FaqItem)
└── src/
    ├── app.module.ts             # (MODIFIED: Import new modules)
    └── modules/
        ├── cms/                  # (NEW: CMS public and admin services/controllers)
        ├── executive/            # (NEW: Executive operations dashboard metrics)
        ├── finance/              # (NEW: Financial indicators and CSV export)
        ├── fraud/                # (NEW: Fraud log, penalties, and suspensions)
        └── notes/                # (NEW: Staff-only internal operational notes)

apps/web/src/
├── app/
│   ├── admin/
│   │   ├── cms/page.tsx          # (NEW: CMS, Banners & FAQ management)
│   │   ├── finance/page.tsx      # (NEW: Financial KPIs & CSV export)
│   │   ├── fraud/page.tsx        # (NEW: Fraud log & suspicious activity)
│   │   └── page.tsx              # (MODIFIED: Executive Operations Dashboard)
│   └── pages/
│       ├── [slug]/page.tsx       # (NEW: Public CMS viewer)
│       └── faq/page.tsx          # (NEW: Public FAQ accordion)
└── components/
    ├── admin/
    │   └── operational-internal-notes-card.tsx # (NEW: Embeddable staff notes)
    └── layout/
        ├── announcement-banner-bar.tsx         # (NEW: Top banner alerts)
        └── workspace-shell.tsx                 # (MODIFIED: Admin sidebar items)
```

---

## Testing Strategy & Acceptance Scenarios

1. **Unit Tests (`@elmasaif/shared`):**
   - Validate Zod schema enforcement for fraud log creation (severity, event type, detected reasons).
   - Validate financial query date ranges and parameters.
   - Validate CMS page slug format (kebab-case) and banner date intervals.
   - Validate internal note length restriction (1..1000 characters).

2. **Backend API Unit & Integration Tests (`apps/api`):**
   - `FraudService`:
     - Test manual fraud log creation with sequential case number generation (`FRD-YYYY-XXXX`).
     - Test marketer suspension: verify user status updates to `COMPLIANCE_RESTRICTED` and active listings update to `UNDER_COMPLIANCE_REVIEW`.
     - Test automated trigger evaluation for repeated rejected proofs (`>= 3` within 72h).
     - Test penalty recording without monetary collection.
     - Test resolution workflow with audit logging.
   - `FinanceService`:
     - Test calculation of gross volume, commissions, contract fees, 15% VAT, and net revenue.
     - Test date range filtering and property type filtering.
     - Test CSV export output: verify UTF-8 BOM (`\uFEFF`), header row, correct column mappings, and `AuditLog` creation.
   - `CmsService`:
     - Test public page retrieval: verify published pages return 200, unpublished return 404.
     - Test active announcement banners filtering by current timestamp.
     - Test admin CRUD for pages, banners, and FAQs.
   - `NotesService`:
     - Test note creation bound to authenticated admin ID.
     - Test note retrieval scoped to specific entity type and ID.
     - Verify notes cannot be queried without administrative permissions.
   - `ExecutiveService`:
     - Test aggregation of 48h deals, queue counts, and SLA breach warnings.

3. **Frontend Component & Page Tests (`apps/web`):**
   - `AdminDashboardPage`: renders executive metric cards, SLA warnings, and queue navigation buttons.
   - `FraudPage`: renders fraud log table, filters, and opens the suspicious activity modal.
   - `FinancePage`: renders KPI cards, transaction table, and triggers CSV export.
   - `CmsPage`: switches between tabs (Pages, Banners, FAQ) and handles content updates.
   - `OperationalInternalNotesCard`: renders existing notes, enforces character counter, and submits new notes.
   - `AnnouncementBannerBar`: renders active banner when present and respects dismissal.

---

## Git Intelligence & Previous Story Intelligence

### Recent Commit History
- `5c04a3a`: 8-8-unified-in-app-notification-feed-transactional-emails
- `13e22e0`: docs(story): mark 8-7 immutable domain audit logging inspection as review
- `6c3d672`: 8-7-immutable-domain-audit-logging-inspection
- `ebb0975`: 8-6-dynamic-platform-settings-commission-configuration
- `2fb019d`: 8-5-violation-reporting-support-ticketing-system

### Established Patterns & Learnings
- **Audit Logging:** Story 8.7 established `AuditService` with structured metadata. Story 8.9 must use `AuditService` for every fraud, penalty, suspension, export, and CMS modification event.
- **Platform Settings:** Story 8.6 added `fraudRejectedProofThreshold` (default 3) and `fraudWindowHours` (default 72) in `PlatformSetting`. Story 8.9 reads these settings for automated fraud triggers.
- **Administrative Navigation:** `workspace-shell.tsx` dynamically displays admin links based on permissions from `useAdminAuth()`. Story 8.9 adds `/admin/fraud`, `/admin/finance`, and `/admin/cms` with appropriate permission checks.
- **RTL Arabic First:** All components must use `dir="rtl"`, appropriate Arabic labels, and executive sovereign styling (`#1B4332`, `#2D6A4F`, `#D8F3DC`).

---

## Project Context Reference

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.9: Fraud Management Log, Financial Reports & CMS]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-62: Penalties & Compliance Fraud Log]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-63: Financial Indicators & Transaction Reports with Export]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-64: Content Management System (CMS) & Communications Templates]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-65: Operational Internal Notes]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-66: Executive Administrative Operations Dashboard]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Admin RBAC Permissions Matrix]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Administrative Operations Workspaces]

---

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

- Evaluated existing database models in `apps/api/prisma/schema.prisma`.
- Checked permissions matrix in `packages/shared/src/constants/auth.ts` (`Finance.View`, `Finance.Export`, `Finance.Audit`, `Compliance.Manage`, `Security.Manage`, `Fraud.View`, `CMS.Manage`, `Notes.Manage`).
- Verified existing admin navigation in `apps/web/src/components/layout/workspace-shell.tsx` and admin dashboard in `apps/web/src/app/admin/page.tsx`.
- Confirmed threshold settings in `PlatformSetting` (`fraudRejectedProofThreshold = 3`, `fraudWindowHours = 72`).

### Completion Notes List

- Task 1 completed: shared domain contracts, enums, constants, zod schemas, and types in `@elmasaif/shared` with 9 passing unit tests (`fraud-finance-cms.spec.ts`).
- Task 2 completed: Prisma schema updated with `FraudLog`, `OperationalInternalNote`, `CmsPage`, `AnnouncementBanner`, `FaqItem`, and migration applied via `prisma db push` and `prisma generate`.
- Task 3 completed: `FraudModule` implemented with case numbering (`FRD-YYYY-XXXX`), marketer suspension (transitions user to `COMPLIANCE_RESTRICTED` and active listings to `UNDER_COMPLIANCE_REVIEW`), audit logs, and automated fraud checks hooked into payment rejection.
- Task 4 completed: `FinanceModule` implemented with KPI aggregations, paginated transactions, and Excel-compatible Arabic CSV exports with UTF-8 BOM (`\uFEFF`) and audit logging.
- Task 5 completed: `CmsModule` implemented with administrative and public endpoints for pages, announcement banners, and FAQ items.
- Task 6 completed: `NotesModule` implemented with private operational internal notes (`AdminOnly` visibility) and immutable audit logging.
- Task 7 completed: `ExecutiveModule` implemented with real-time 48-hour deal metrics, SLA warning alerts, operational queue counters, and registered into `app.module.ts`.
- Task 8 completed:
  - Admin sidebar updated with `/admin/fraud`, `/admin/finance`, `/admin/cms`.
  - Executive Operations Dashboard in `/admin` updated with KPIs, queue cards, SLA alerts, and quick actions.
  - Fraud Management Workspace implemented in `apps/web/src/components/admin/fraud-management-workspace.tsx` and `apps/web/src/app/admin/fraud/page.tsx`.
  - Financial Reports & CSV Export Workspace implemented in `apps/web/src/components/admin/financial-reports-workspace.tsx` and `apps/web/src/app/admin/finance/page.tsx`.
  - CMS & Announcements Workspace implemented in `apps/web/src/components/admin/cms-announcements-workspace.tsx` and `apps/web/src/app/admin/cms/page.tsx`.
  - Reusable `OperationalInternalNotesCard` component implemented and embedded into payment review and fraud workspaces.
  - Public reader pages (`/pages/[slug]`, `/pages/faq`) and `AnnouncementBannerBar` implemented and mounted in `LayoutShell`.
  - Comprehensive unit and component test suites written and passing across `@elmasaif/shared` (679 tests), `@elmasaif/api` (18 tests), and `@elmasaif/web` (24 tests).

### File List

- `packages/shared/src/enums/fraud.ts` (NEW)
- `packages/shared/src/enums/cms.ts` (NEW)
- `packages/shared/src/enums/notes.ts` (NEW)
- `packages/shared/src/enums/index.ts` (MODIFIED)
- `packages/shared/src/constants/fraud.ts` (NEW)
- `packages/shared/src/constants/finance.ts` (NEW)
- `packages/shared/src/constants/cms.ts` (NEW)
- `packages/shared/src/constants/notes.ts` (NEW)
- `packages/shared/src/constants/index.ts` (MODIFIED)
- `packages/shared/src/schemas/fraud.schema.ts` (NEW)
- `packages/shared/src/schemas/finance.schema.ts` (NEW)
- `packages/shared/src/schemas/cms.schema.ts` (NEW)
- `packages/shared/src/schemas/notes.schema.ts` (NEW)
- `packages/shared/src/schemas/index.ts` (MODIFIED)
- `packages/shared/src/types/fraud.ts` (NEW)
- `packages/shared/src/types/finance.ts` (NEW)
- `packages/shared/src/types/cms.ts` (NEW)
- `packages/shared/src/types/notes.ts` (NEW)
- `packages/shared/src/types/executive.ts` (NEW)
- `packages/shared/src/types/index.ts` (MODIFIED)
- `packages/shared/src/__tests__/fraud-finance-cms.spec.ts` (NEW)
- `apps/api/prisma/schema.prisma` (MODIFIED)
- `apps/api/prisma/migrations/20261115_add_fraud_finance_cms_notes_models/migration.sql` (NEW)
- `apps/api/src/modules/fraud/fraud.service.ts` (NEW)
- `apps/api/src/modules/fraud/fraud.controller.ts` (NEW)
- `apps/api/src/modules/fraud/fraud.module.ts` (NEW)
- `apps/api/src/modules/fraud/__tests__/fraud.service.spec.ts` (NEW)
- `apps/api/src/modules/finance/finance.service.ts` (NEW)
- `apps/api/src/modules/finance/finance.controller.ts` (NEW)
- `apps/api/src/modules/finance/finance.module.ts` (NEW)
- `apps/api/src/modules/finance/__tests__/finance.service.spec.ts` (NEW)
- `apps/api/src/modules/cms/cms.service.ts` (NEW)
- `apps/api/src/modules/cms/cms.controller.ts` (NEW)
- `apps/api/src/modules/cms/admin-cms.controller.ts` (NEW)
- `apps/api/src/modules/cms/cms.module.ts` (NEW)
- `apps/api/src/modules/cms/__tests__/cms.service.spec.ts` (NEW)
- `apps/api/src/modules/notes/notes.service.ts` (NEW)
- `apps/api/src/modules/notes/notes.controller.ts` (NEW)
- `apps/api/src/modules/notes/notes.module.ts` (NEW)
- `apps/api/src/modules/notes/__tests__/notes.service.spec.ts` (NEW)
- `apps/api/src/modules/executive/executive.service.ts` (NEW)
- `apps/api/src/modules/executive/executive.controller.ts` (NEW)
- `apps/api/src/modules/executive/executive.module.ts` (NEW)
- `apps/api/src/modules/executive/__tests__/executive.service.spec.ts` (NEW)
- `apps/api/src/modules/deals/admin-payments.service.ts` (MODIFIED)
- `apps/api/src/modules/deals/deals.module.ts` (MODIFIED)
- `apps/api/src/app.module.ts` (MODIFIED)
- `apps/web/src/components/layout/workspace-shell.tsx` (MODIFIED)
- `apps/web/src/components/layout/layout-shell.tsx` (MODIFIED)
- `apps/web/src/components/layout/announcement-banner-bar.tsx` (NEW)
- `apps/web/src/components/layout/__tests__/workspace-shell.spec.ts` (MODIFIED)
- `apps/web/src/components/layout/__tests__/announcement-banner-bar.spec.tsx` (NEW)
- `apps/web/src/app/admin/page.tsx` (MODIFIED)
- `apps/web/src/app/admin/fraud/page.tsx` (NEW)
- `apps/web/src/app/admin/finance/page.tsx` (NEW)
- `apps/web/src/app/admin/cms/page.tsx` (NEW)
- `apps/web/src/app/admin/__tests__/pages.spec.tsx` (NEW)
- `apps/web/src/app/pages/[slug]/page.tsx` (NEW)
- `apps/web/src/app/pages/faq/page.tsx` (NEW)
- `apps/web/src/components/admin/fraud-management-workspace.tsx` (NEW)
- `apps/web/src/components/admin/financial-reports-workspace.tsx` (NEW)
- `apps/web/src/components/admin/cms-announcements-workspace.tsx` (NEW)
- `apps/web/src/components/admin/operational-internal-notes-card.tsx` (NEW)
- `apps/web/src/components/admin/payment-review-workspace.tsx` (MODIFIED)
- `apps/web/src/components/admin/__tests__/fraud-finance-cms-workspaces.spec.tsx` (NEW)

