---
baseline_commit: 1fbb88d867c4df6ce72d427d2c3df4405908aa39
---

# Story 8.5: Violation Reporting & Support Ticketing System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user or administrator**,
I want **a violation reporting endpoint and support ticketing system with SLA monitoring**,
so that **complaints, fraud reports, and support requests are resolved methodically with clear accountability and an immutable audit trail**.

## Acceptance Criteria

1. **AC1 — Shared Violation Reporting & Support Ticketing Schemas, Constants & DTO Contracts (`@elmasaif/shared`):**
   - **Given** the business requirements in `FR-37`, `FR-38`, `AD-2`, `AD-6`, `AD-8`, `AD-10`, `AD-11`, and `AD-12`,
   - **When** shared contracts are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - Canonical SLA constants:
       - `TICKET_SLA_FIRST_RESPONSE_HOURS = 4` (default 4 hours for first response per FR-38).
       - `TICKET_SLA_RESOLUTION_HOURS = 48` (default 2 business days / 48 hours for resolution per FR-38).
       - `TICKET_SLA_WARNING_THRESHOLD_MINUTES = 60` (1 hour remaining triggers amber warning state).
     - Attachment constraints:
       - `VIOLATION_REPORT_MAX_ATTACHMENTS = 5` (max 5 attachments per FR-37).
       - `SUPPORT_TICKET_MAX_ATTACHMENTS = 5` (max 5 attachments per FR-38).
       - `SUPPORT_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024` (10 MB per attachment).
     - Core Enums and Unions:
       - `VIOLATION_TARGET_TYPES = ['LISTING', 'BROKER', 'USER', 'OTHER'] as const`
       - `VIOLATION_CATEGORIES = ['FRAUDULENT_LISTING', 'UNAUTHORIZED_BROKER', 'ABUSIVE_BEHAVIOR', 'MISLEADING_INFORMATION', 'OFF_PLATFORM_PAYMENT_BYPASS', 'PRICE_MANIPULATION', 'OTHER'] as const`
       - `VIOLATION_REPORT_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const`
       - `VIOLATION_ACTIONS = ['NO_ACTION', 'LISTING_REMOVED', 'BROKER_WARNED', 'ACCOUNT_SUSPENDED', 'FLAGGED_FOR_COMPLIANCE', 'OTHER'] as const`
       - `TICKET_CATEGORIES = ['TECHNICAL_ISSUE', 'ACCOUNT_ACCESS', 'PAYMENT_ISSUE', 'LISTING_ASSISTANCE', 'GENERAL_INQUIRY', 'OTHER'] as const`
       - `TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const`
       - `TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const`
       - `TICKET_SLA_STATES = ['ON_TRACK', 'NEARING_BREACH', 'BREACHED'] as const`
     - Status & Error codes:
       - `VIOLATION_REPORT_CREATED`, `VIOLATION_REPORT_NOT_FOUND`, `VIOLATION_REPORT_STATUS_UPDATED`, `VIOLATION_REPORT_ADJUDICATED`, `VIOLATION_REPORT_DISMISSED`.
       - `SUPPORT_TICKET_CREATED`, `SUPPORT_TICKET_NOT_FOUND`, `SUPPORT_TICKET_STATUS_UPDATED`, `SUPPORT_TICKET_MESSAGE_ADDED`, `SUPPORT_TICKET_RESOLVED`, `SUPPORT_TICKET_CLOSED`.
     - Zod Validation Schemas (`packages/shared/src/schemas/support.schema.ts`):
       - `createViolationReportSchema`: validates `targetType`, optional `targetListingId`, optional `targetUserId`, `category`, `description` (min 10, max 2000), `attachments` (array of valid URL/storage keys, max 5), optional `reporterName`, optional `reporterEmail`, optional `reporterPhone` (Saudi mobile regex `^(05|\+9665)[0-9]{8}$`).
       - `adjudicateViolationReportSchema`: validates `action` (`ViolationAction`), `notes` (trimmed, min 5, max 1000), optional `status` (`'RESOLVED' | 'DISMISSED'`).
       - `adminViolationQueueQuerySchema`: validates `status` (default `'ALL'`), `category`, `targetType`, `search` (max 100 chars), `page` (default 1), `limit` (default 20, max 100).
       - `createSupportTicketSchema`: validates `category`, `subject` (min 3, max 150), `description` (min 10, max 3000), optional `priority` (default `'MEDIUM'`), `contactName` (min 2, max 100), `contactEmail` (email format), optional `contactPhone`, `attachments` (max 5).
       - `updateSupportTicketStatusSchema`: validates `status` (`TicketStatus`), `resolutionSummary` (min 5, max 1000, mandatory if status is `RESOLVED` or `CLOSED`).
       - `createTicketMessageSchema`: validates `message` (min 1, max 3000), `isInternal` (optional boolean, default `false`), `attachments` (optional array, max 5).
       - `adminTicketQueueQuerySchema`: validates `status` (default `'ALL'`), `category`, `priority`, `slaState` (default `'ALL'`), `assignedAdminId`, `search` (max 100 chars), `page` (default 1), `limit` (default 20, max 100).
     - TypeScript DTO Interfaces (`packages/shared/src/types/support.ts`):
       - `ViolationReportItemDto`, `ViolationReportDetailDto`, `ViolationReportsQueueResponseDto`, `ViolationReportCountsDto`.
       - `SupportTicketItemDto`, `SupportTicketDetailDto`, `SupportTicketsQueueResponseDto`, `SupportTicketCountsDto`, `TicketMessageDto`, `TicketSlaStatusDto`.

2. **AC2 — Database Schema Models & Relations (`apps/api/prisma/schema.prisma`):**
   - **Given** the persistence requirements for violation reports, support tickets, and staff notes/messages,
   - **When** `prisma generate` and migrations are applied,
   - **Then** `apps/api/prisma/schema.prisma` defines:
     - Enums:
       - `enum ViolationTargetType { LISTING, BROKER, USER, OTHER }`
       - `enum ViolationCategory { FRAUDULENT_LISTING, UNAUTHORIZED_BROKER, ABUSIVE_BEHAVIOR, MISLEADING_INFORMATION, OFF_PLATFORM_PAYMENT_BYPASS, PRICE_MANIPULATION, OTHER }`
       - `enum ViolationReportStatus { PENDING, UNDER_REVIEW, RESOLVED, DISMISSED }`
       - `enum ViolationAction { NO_ACTION, LISTING_REMOVED, BROKER_WARNED, ACCOUNT_SUSPENDED, FLAGGED_FOR_COMPLIANCE, OTHER }`
       - `enum TicketCategory { TECHNICAL_ISSUE, ACCOUNT_ACCESS, PAYMENT_ISSUE, LISTING_ASSISTANCE, GENERAL_INQUIRY, OTHER }`
       - `enum TicketPriority { LOW, MEDIUM, HIGH, URGENT }`
       - `enum TicketStatus { OPEN, IN_PROGRESS, RESOLVED, CLOSED }`
     - Models:
       - `ViolationReport`: with `id`, `reportNumber` (unique string, e.g., `VR-2026-XXXX`), `reporterUserId`, `reporterName`, `reporterEmail`, `reporterPhone`, `targetType`, `targetListingId`, `targetUserId`, `category`, `description`, `attachments` (string[]), `status` (default `PENDING`), `resolutionAction`, `resolutionNotes`, `assignedAdminId`, `assignedAt`, `resolvedByAdminId`, `resolvedAt`, `createdAt`, `updatedAt`, with indexes on `[status, createdAt]` and `[targetType, targetListingId]`.
       - `SupportTicket`: with `id`, `ticketNumber` (unique string, e.g., `TIK-2026-XXXX`), `userId`, `contactName`, `contactEmail`, `contactPhone`, `category`, `priority` (default `MEDIUM`), `subject`, `description`, `attachments` (string[]), `status` (default `OPEN`), `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, `closedAt`, `assignedAdminId`, `assignedAt`, `resolutionSummary`, `createdAt`, `updatedAt`, with indexes on `[status, priority, createdAt]` and `[firstResponseDueAt, status]`.
       - `TicketMessage`: with `id`, `ticketId`, `authorAdminId`, `authorUserId`, `authorType` (`'ADMIN' | 'USER'`), `authorName`, `message`, `attachments` (string[]), `isInternal` (boolean default `false`), `createdAt`, cascading delete on ticket deletion.
     - Reverse relations:
       - `User` model updated with `violationReportsSubmitted` and `supportTicketsCreated`.
       - `AdminUser` model updated with `assignedViolationReports`, `resolvedViolationReports`, and `assignedSupportTickets`.

3. **AC3 — Public/User Violation Report Submission & Admin Reports Queue API (`Reports.Handle`):**
   - **Given** any platform user (authenticated or unauthenticated) reporting a violation on a listing or broker per `FR-37`,
   - **When** calling `POST /api/v1/reports`:
   - **Then**:
     - System validates the payload via `ZodValidationPipe(createViolationReportSchema)`.
     - Automatically generates a unique, human-readable `reportNumber` (`VR-{year}-{sequentialId}`).
     - Populates `reporterUserId` if a user session is active.
     - Persists the record with initial status `PENDING`.
     - Returns HTTP 201 Created with `{ reportNumber, status: 'PENDING', message: 'Report submitted successfully' }`. Reporter does not track progress in MVP (submit-only).
   - **Given** an authenticated administrator with `Reports.Handle` permission,
   - **When** calling `GET /api/v1/admin/reports` or `GET /api/v1/admin/reports/:id`:
   - **Then**:
     - `GET /api/v1/admin/reports` returns KPI summary counts (`total`, `pending`, `underReview`, `resolved`, `dismissed`) and a filtered, paginated list of violation reports with target previews (listing title, ask price, broker name, license number).
     - `GET /api/v1/admin/reports/:id` returns full report details, attached evidence (signed URLs), reporter contact details, target entity snapshot, and audit history from `AuditLog`.
   - **Given** an administrator adjudicating or dismissing a report,
   - **When** calling `POST /api/v1/admin/reports/:id/adjudicate` or `POST /api/v1/admin/reports/:id/dismiss`:
   - **Then**:
     - Validation requires mandatory `notes` (min 5 chars).
     - Adjudication sets `resolutionAction`, updates status to `RESOLVED`, sets `resolvedByAdminId = admin.id`, `resolvedAt = ClockService.now()`.
     - Dismissal sets status to `DISMISSED` with explanatory notes.
     - Physical database rows are **NEVER deleted** (`AD-6`).
     - An append-only `AuditLog` record is written (`VIOLATION_REPORT_ADJUDICATED` or `VIOLATION_REPORT_DISMISSED`) with admin ID, timestamp, and full resolution snapshot.

4. **AC4 — Support Ticketing Engine with Deterministic SLA Monitoring & Staff Notes (`Tickets.Handle`):**
   - **Given** a user opening a support ticket per `FR-38`,
   - **When** calling `POST /api/v1/support/tickets`:
   - **Then**:
     - System validates payload via `ZodValidationPipe(createSupportTicketSchema)`.
     - Uses `ClockService.now()` to establish:
       - `firstResponseDueAt = now + 4 hours` (`TICKET_SLA_FIRST_RESPONSE_HOURS`).
       - `resolutionDueAt = now + 48 hours` (`TICKET_SLA_RESOLUTION_HOURS`).
     - Generates unique sequential `ticketNumber` (`TIK-{year}-{seq}`).
     - Persists ticket with status `OPEN`.
     - Returns HTTP 201 Created with `{ ticketNumber, status: 'OPEN', message: 'Ticket opened successfully' }`.
   - **Given** an authenticated administrator holding `Tickets.Handle` permission,
   - **When** calling `GET /api/v1/admin/tickets` or `GET /api/v1/admin/tickets/:id`:
   - **Then**:
     - `GET /api/v1/admin/tickets` returns KPI summary counts (`total`, `open`, `inProgress`, `resolved`, `closed`, `slaNearingBreach`, `slaBreached`) and paginated tickets.
     - Live SLA status is dynamically calculated for each ticket using `ClockService.now()`:
       - `firstResponseSla`: `ON_TRACK`, `NEARING_BREACH` ($\le 60$ minutes remaining and `firstRespondedAt === null`), or `BREACHED` (`now > firstResponseDueAt` and `firstRespondedAt === null`).
       - `resolutionSla`: `ON_TRACK`, `NEARING_BREACH` ($\le 12$ hours remaining and `resolvedAt === null`), or `BREACHED` (`now > resolutionDueAt` and `resolvedAt === null`).
     - `GET /api/v1/admin/tickets/:id` returns ticket detail, chronological `messages` (including internal notes if user holds `Notes.Manage`), and audit trail.
   - **When** calling support ticket lifecycle endpoints:
     - `PATCH /api/v1/admin/tickets/:id/status` (updates status `OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`; requires `resolutionSummary` on `RESOLVED` or `CLOSED`).
     - `POST /api/v1/admin/tickets/:id/assign` (assigns to admin, sets `assignedAt = ClockService.now()`).
     - `POST /api/v1/admin/tickets/:id/messages` (appends message; if first admin response, sets `firstRespondedAt = ClockService.now()`; supports `isInternal: true` requiring `Notes.Manage`).
     - All lifecycle transitions record immutable entries in `AuditLog` (`SUPPORT_TICKET_STATUS_UPDATED`, `SUPPORT_TICKET_ASSIGNED`, `SUPPORT_TICKET_MESSAGE_ADDED`).

5. **AC5 — Frontend User Submit-Only Modals (`apps/web`):**
   - **Given** a user on a listing page, broker profile, or platform settings,
   - **When** the user clicks "إبلاغ عن مخالفة" (Report Violation) or "طلب دعم فني" (Request Support),
   - **Then** client modals render with institutional styling (`DESIGN.md`, RTL `dir="rtl"`, `IBM Plex Sans Arabic`):
     - `ViolationReportModal`:
       - Target preselection (e.g. current listing ID and title, or broker profile ID).
       - Category selection dropdown with Saudi real estate compliance options (إعلان وهمي / احتيالي، وسيط غير مرخص، طلب تحويل خارج المنصة، معلومات مضللة، أخرى).
       - Description textarea with character counter (`10..2000`).
       - Drag-and-drop attachment zone supporting up to 5 files (PDF, PNG, JPG, WebP $\le 10$ MB).
       - Submitting calls `POST /api/v1/reports`, displays a green success confirmation banner with the generated report number, and closes cleanly without navigating to an external tracking screen (submit-only per FR-37).
     - `SupportTicketModal`:
       - Category select (مشكلة تقنية، تسجيل الدخول والحساب، استفسار عن المدفوعات، مساعدة في الإعلانات، استفسار عام).
       - Priority selector (`منخفض`, `متوسط`, `مرتفع`, `عاجل`).
       - Subject and detailed description inputs.
       - Contact email and phone inputs (auto-filled for authenticated users).
       - Attachment uploader up to 5 files.
       - Submitting calls `POST /api/v1/support/tickets`, displays an authoritative confirmation modal containing the `ticketNumber` and expected response time (within 4 business hours per FR-38).

6. **AC6 — Frontend Admin Workspaces (`/admin/reports` & `/admin/tickets`):**
   - **Given** an authorized administrator with `Reports.Handle` or `Tickets.Handle`,
   - **When** navigating to `/admin/reports` or `/admin/tickets`,
   - **Then** the workspaces adhere to Sovereign Design standards (`DESIGN.md` Component #10):
     - **Violation Reports Workspace (`/admin/reports`):**
       - KPI Summary Cards: Total Reports (`إجمالي البلاغات`), Pending Review (`قيد الانتظار`), Under Review (`قيد المعالجة`), Adjudicated / Resolved (`تم اتخاذ إجراء`), Dismissed (`بلاغات مستبعدة`).
       - Filter tabs for status and category dropdown.
       - Reports Data Cards: displays report number, submission date, reporter name/masked phone, target listing/broker summary, category pill, description, and attached files preview.
       - Action buttons: "اتخاذ إجراء نظامي" (Adjudicate) opening a modal with action options (`حذف الإعلان`, `إنذار الوسيط`, `تجميد الحساب`, `إحالة للامتثال`, `لا يتطلب إجراء`) and mandatory justification notes; and "استبعاد البلاغ" (Dismiss) with reason.
       - Audit history panel.
     - **Support Ticketing Workspace (`/admin/tickets`):**
       - KPI Summary Cards: Open Tickets (`تذاكر مفتوحة`), In Progress (`قيد المعالجة`), SLA Warning (`أوشكت مهلة الاستجابة`), SLA Breached (`تجاوزت مهلة SLA`), Resolved (`تم الحل`).
       - Dynamic SLA Badges: Emerald for `On Track`, Amber countdown for `Nearing Breach` (`متبقي أقل من ساعة`), Red warning for `Breached` (`تجاوزت مهلة الرد الأول / الحل`).
       - Ticket Detail & Messaging View:
         - Thread view displaying customer messages, staff responses, and internal notes (highlighted with amber background and lock icon).
         - Reply box with toggle for "ملاحظة داخلية للمشرفين (غير مرئية للعميل)" requiring `Notes.Manage`.
         - Quick action buttons: "بدء المعالجة" (`In Progress`), "تعيين لمشرف", "حل التذكرة" (`Resolved` requiring resolution summary), "إغلاق التذكرة" (`Closed`).
     - **Navigation Integration:**
       - Links added to `WorkspaceShell` (`apps/web/src/components/layout/workspace-shell.tsx`) for `بلاغات المخالفات` (`/admin/reports`) gated by `Reports.Handle` and `تذاكر الدعم الفني` (`/admin/tickets`) gated by `Tickets.Handle`.
       - Quick action cards added to `AdminDashboardPage` (`apps/web/src/app/admin/page.tsx`).

7. **AC7 — Comprehensive Automated Tests & Verification:**
   - **Given** shared contracts, backend controllers/services, and frontend workspaces/modals,
   - **When** automated test suites run across all workspace packages,
   - **Then**:
     - `packages/shared`: unit tests validate `createViolationReportSchema`, `adjudicateViolationReportSchema`, `createSupportTicketSchema`, `updateSupportTicketStatusSchema`, and `createTicketMessageSchema`.
     - `apps/api`: unit/integration tests validate:
       - `POST /api/v1/reports` (validation, unique sequential report number, submit-only behavior).
       - `GET /api/v1/admin/reports` (filtering by status/category, KPI counts).
       - `POST /api/v1/admin/reports/:id/adjudicate` and `/dismiss` (status changes, `ClockService.now()`, `AuditLog` emission, permanent row preservation).
       - `POST /api/v1/support/tickets` (4h first response SLA and 48h resolution SLA calculation using `ClockService.now()`).
       - `GET /api/v1/admin/tickets` (SLA breach detection, status filters, search).
       - `POST /api/v1/admin/tickets/:id/messages` (first response timestamp capture, internal staff note separation with `Notes.Manage`, `AuditLog` emission).
       - `PATCH /api/v1/admin/tickets/:id/status` (resolution summary requirement, `AuditLog` emission).
     - `apps/web`: SSR component tests (`react-dom/server`) verify:
       - `ViolationReportModal` rendering, form validation, and submission confirmation.
       - `SupportTicketModal` rendering, priority and category selection, and ticket confirmation dialog.
       - `ViolationReportsWorkspace` KPI cards, status filters, report cards, and adjudication modal.
       - `SupportTicketsWorkspace` KPI cards, color-coded SLA countdown badges, internal note styling, and action triggers.
     - All existing suites pass with zero regressions.

## Tasks / Subtasks

- [x] **Task 1: Shared Violation Reporting & Support Ticketing Schemas, Constants & DTO Types in `@elmasaif/shared` (AC: #1)**
  - [x] 1.1 Create `packages/shared/src/constants/support.ts` defining SLA constants (`TICKET_SLA_FIRST_RESPONSE_HOURS = 4`, `TICKET_SLA_RESOLUTION_HOURS = 48`, `TICKET_SLA_WARNING_THRESHOLD_MINUTES = 60`), attachment limits (`5` files, `10MB`), enums (`VIOLATION_TARGET_TYPES`, `VIOLATION_CATEGORIES`, `VIOLATION_REPORT_STATUSES`, `VIOLATION_ACTIONS`, `TICKET_CATEGORIES`, `TICKET_PRIORITIES`, `TICKET_STATUSES`, `TICKET_SLA_STATES`), Arabic metadata records, and status/error codes.
  - [x] 1.2 Create `packages/shared/src/schemas/support.schema.ts` defining Zod schemas (`createViolationReportSchema`, `adjudicateViolationReportSchema`, `adminViolationQueueQuerySchema`, `createSupportTicketSchema`, `updateSupportTicketStatusSchema`, `createTicketMessageSchema`, `adminTicketQueueQuerySchema`).
  - [x] 1.3 Create `packages/shared/src/types/support.ts` defining DTO interfaces (`ViolationReportItemDto`, `ViolationReportDetailDto`, `ViolationReportsQueueResponseDto`, `ViolationReportCountsDto`, `SupportTicketItemDto`, `SupportTicketDetailDto`, `SupportTicketsQueueResponseDto`, `SupportTicketCountsDto`, `TicketMessageDto`, `TicketSlaStatusDto`).
  - [x] 1.4 Export all new constants, schemas, and types in `packages/shared/src/index.ts`.
  - [x] 1.5 Create unit test suite `packages/shared/src/schemas/__tests__/support.spec.ts` testing all schemas and SLA bounds.
  - [x] 1.6 Run `npm test --workspace=packages/shared` and verify all tests pass.

- [x] **Task 2: Database Schema Models & Relations in `apps/api/prisma/schema.prisma` (AC: #2)**
  - [x] 2.1 Add enums to `apps/api/prisma/schema.prisma`: `ViolationTargetType`, `ViolationCategory`, `ViolationReportStatus`, `ViolationAction`, `TicketCategory`, `TicketPriority`, `TicketStatus`.
  - [x] 2.2 Add models to `apps/api/prisma/schema.prisma`: `ViolationReport`, `SupportTicket`, `TicketMessage` with proper fields, indexes, and relations to `User`, `Listing`, and `AdminUser`.
  - [x] 2.3 Update `User` and `AdminUser` models with the reverse relation definitions.
  - [x] 2.4 Run `npm run prisma:generate --workspace=apps/api` to update the Prisma client.

- [x] **Task 3: Backend Violation Reporting & Admin Reports Queue API in `apps/api` (AC: #3)**
  - [x] 3.1 Create `apps/api/src/modules/support/violation-reports.service.ts` implementing report creation, sequential `reportNumber` generation, paginated queue querying, detail retrieval with signed download URLs, adjudication, and dismissal.
  - [x] 3.2 Create `apps/api/src/modules/support/violation-reports.controller.ts` providing public/authenticated `POST /api/v1/reports`.
  - [x] 3.3 Create `apps/api/src/modules/support/admin-violation-reports.controller.ts` providing `GET /api/v1/admin/reports`, `GET /api/v1/admin/reports/:id`, `POST /api/v1/admin/reports/:id/adjudicate`, and `POST /api/v1/admin/reports/:id/dismiss` protected by `@RequireAdminPermission('Reports.Handle')`.
  - [x] 3.4 Wire `AuditLog` records for all violation adjudication and dismissal actions (`VIOLATION_REPORT_ADJUDICATED`, `VIOLATION_REPORT_DISMISSED`).

- [x] **Task 4: Backend Support Ticketing Engine with Deterministic SLA Tracking in `apps/api` (AC: #4)**
  - [x] 4.1 Create `apps/api/src/modules/support/support-tickets.service.ts` implementing ticket creation with 4h first response and 48h resolution SLA deadlines using `ClockService.now()`, dynamic SLA breach evaluation, paginated queue querying, status transitions, assignment, and messaging.
  - [x] 4.2 Create `apps/api/src/modules/support/support-tickets.controller.ts` providing user `POST /api/v1/support/tickets`.
  - [x] 4.3 Create `apps/api/src/modules/support/admin-support-tickets.controller.ts` providing `GET /api/v1/admin/tickets`, `GET /api/v1/admin/tickets/:id`, `PATCH /api/v1/admin/tickets/:id/status`, `POST /api/v1/admin/tickets/:id/assign`, and `POST /api/v1/admin/tickets/:id/messages` protected by `@RequireAdminPermission('Tickets.Handle')` (with `Notes.Manage` enforced on internal staff notes).
  - [x] 4.4 Create `apps/api/src/modules/support/support.module.ts` bundling controllers, services, `ClockModule`, `StorageModule`, and `PrismaModule`, and register in `apps/api/src/app.module.ts`.
  - [x] 4.5 Create unit test suites `apps/api/src/modules/support/__tests__/violation-reports.spec.ts` and `apps/api/src/modules/support/__tests__/support-tickets.spec.ts` verifying endpoints, SLA calculations, and audit log emissions.

- [x] **Task 5: Frontend User Submit-Only Modals in `apps/web` (AC: #5)**
  - [x] 5.1 Build `apps/web/src/components/support/violation-report-modal.tsx` supporting listing/broker target context, category select, description, up to 5 attachments, and submit-only confirmation dialog.
  - [x] 5.2 Build `apps/web/src/components/support/support-ticket-modal.tsx` supporting category select, priority, subject, description, contact details, up to 5 attachments, and ticket confirmation dialog.
  - [x] 5.3 Integrate `ViolationReportModal` trigger button on listing views and broker profiles.
  - [x] 5.4 Write SSR component test `apps/web/src/components/support/__tests__/violation-report-modal.spec.tsx`.

- [x] **Task 6: Frontend Admin Workspaces (`/admin/reports` & `/admin/tickets`) in `apps/web` (AC: #6)**
  - [x] 6.1 Build `apps/web/src/components/admin/violation-reports-workspace.tsx` with KPI summary cards, filter tabs, violation report cards, adjudication modal with action select & notes, and audit history drawer.
  - [x] 6.2 Create `apps/web/src/app/admin/reports/page.tsx` hosting `ViolationReportsWorkspace`.
  - [x] 6.3 Build `apps/web/src/components/admin/support-tickets-workspace.tsx` with KPI summary cards, SLA countdown badges (emerald / amber / red), filter bar, ticket cards, and detailed messaging view with internal staff note toggle (`Notes.Manage`).
  - [x] 6.4 Create `apps/web/src/app/admin/tickets/page.tsx` hosting `SupportTicketsWorkspace`.
  - [x] 6.5 Update `apps/web/src/components/layout/workspace-shell.tsx` adding navigation links for `/admin/reports` (`Reports.Handle`) and `/admin/tickets` (`Tickets.Handle`).
  - [x] 6.6 Update `apps/web/src/app/admin/page.tsx` adding quick operational cards for Reports and Support Tickets.
  - [x] 6.7 Write SSR component tests `apps/web/src/components/admin/__tests__/violation-reports-workspace.spec.tsx` and `apps/web/src/components/admin/__tests__/support-tickets-workspace.spec.tsx`.

- [x] **Task 7: Comprehensive Regression Verification & Test Suite Execution (AC: #7)**
  - [x] 7.1 Run test suites across `packages/shared`, `apps/api`, and `apps/web`.
  - [x] 7.2 Verify zero regressions in existing tests and that all new tests pass.

## Dev Notes

### Executive Context & Why Story 8.5 Matters

In the El Masaif platform ecosystem, safeguarding marketplace integrity, combating unauthorized brokerage, and methodically addressing technical or financial friction are paramount to regulatory compliance and user trust:
1. **Violation Reporting (`FR-37`, `Reports.Handle`):** Users must be empowered to flag fraudulent listings, deceptive pricing, off-platform payment bypass attempts, or unauthorized brokers. To prevent abusive back-and-forth harassment and avoid exposing reporters, reports are submit-only for users and route directly to the Admin Reports Queue (`Reports.Handle`), where compliance and moderation staff adjudicate complaints, enforce platform penalties, and preserve permanent forensic audit records.
2. **Support Ticketing System (`FR-38`, `Tickets.Handle`):** Technical glitches, account recovery hurdles, and payment inquiries must not fall through the cracks. Staff manage tickets through strict state machine transitions (`OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`) governed by institutional Service Level Agreements (4-hour first response SLA, 48-hour resolution SLA).
3. **Internal Staff Notes & Separation of Concerns (`Notes.Manage`):** When support staff investigate a ticket or collaborate on complex issues, they require internal notes that are strictly hidden from users. This maintains professional discretion while fostering seamless handoffs across operational shifts.

### Architecture Guardrails & Non-Negotiable Rules

1. **Deterministic Time (`AD-11`):**
   - NEVER call `new Date()` (with zero arguments) or `Date.now()` in domain logic, controllers, or services. Always use `this.clockService.now()` from `ClockService` (`apps/api/src/common/clock/clock.service.ts`).
2. **Isolated Admin Realm & Dynamic RBAC (`AD-5`, `AD-12`):**
   - `AdminViolationReportsController` MUST require `@RequireAdminPermission('Reports.Handle')`.
   - `AdminSupportTicketsController` MUST require `@RequireAdminPermission('Tickets.Handle')`.
   - Internal staff notes MUST be gated by `@RequireAdminPermission('Notes.Manage')` (or checked conditionally in service).
   - `SUPER_ADMIN` automatically passes `AdminPermissionGuard`. In `ADMIN_ROLE_PERMISSIONS`:
     - `MODERATOR` holds both `Reports.Handle` and `Tickets.Handle`.
     - `COMPLIANCE_OFFICER` holds `Reports.Handle`.
3. **Permanent Record Preservation & Append-Only Audit (`FR-37`, `FR-52`, `AD-6`):**
   - Violation reports and support tickets are **NEVER physically deleted**.
   - Every administrative action (`VIOLATION_REPORT_ADJUDICATED`, `VIOLATION_REPORT_DISMISSED`, `SUPPORT_TICKET_STATUS_UPDATED`, `SUPPORT_TICKET_ASSIGNED`, `SUPPORT_TICKET_MESSAGE_ADDED`) writes an append-only row to `AuditLog`.
4. **SLA Monitoring Engine (`FR-38`):**
   - First Response SLA: `firstResponseDueAt = createdAt + 4 hours`. If `firstRespondedAt === null` and `ClockService.now() > firstResponseDueAt`, SLA is `BREACHED`. If within 60 minutes of deadline, SLA is `NEARING_BREACH`.
   - Resolution SLA: `resolutionDueAt = createdAt + 48 hours`. If `resolvedAt === null` and `ClockService.now() > resolutionDueAt`, SLA is `BREACHED`.
5. **Submit-Only User Experience in MVP (`FR-37`, `FR-38`):**
   - User report and ticket creation modal displays clear confirmation with reference numbers (`VR-...` and `TIK-...`).
   - Per PRD specifications: "Reporter does not track ticket progress in MVP (submit-only)" and "Ticket creation by users only; no tracking screen in MVP". Tracking screens are deferred to Phase 2.

### Source Tree Components to Touch

- **Shared Package (`packages/shared`):**
  - `packages/shared/src/constants/support.ts` (NEW)
  - `packages/shared/src/schemas/support.schema.ts` (NEW)
  - `packages/shared/src/types/support.ts` (NEW)
  - `packages/shared/src/index.ts` (UPDATE)
  - `packages/shared/src/schemas/__tests__/support.spec.ts` (NEW)
- **API Backend (`apps/api`):**
  - `apps/api/prisma/schema.prisma` (UPDATE — add `ViolationReport`, `SupportTicket`, `TicketMessage` and related enums)
  - `apps/api/src/modules/support/support.module.ts` (NEW)
  - `apps/api/src/modules/support/violation-reports.service.ts` (NEW)
  - `apps/api/src/modules/support/violation-reports.controller.ts` (NEW)
  - `apps/api/src/modules/support/admin-violation-reports.controller.ts` (NEW)
  - `apps/api/src/modules/support/support-tickets.service.ts` (NEW)
  - `apps/api/src/modules/support/support-tickets.controller.ts` (NEW)
  - `apps/api/src/modules/support/admin-support-tickets.controller.ts` (NEW)
  - `apps/api/src/modules/support/__tests__/violation-reports.spec.ts` (NEW)
  - `apps/api/src/modules/support/__tests__/support-tickets.spec.ts` (NEW)
  - `apps/api/src/app.module.ts` (UPDATE — import `SupportModule`)
- **Frontend Web (`apps/web`):**
  - `apps/web/src/components/support/violation-report-modal.tsx` (NEW)
  - `apps/web/src/components/support/support-ticket-modal.tsx` (NEW)
  - `apps/web/src/components/admin/violation-reports-workspace.tsx` (NEW)
  - `apps/web/src/components/admin/support-tickets-workspace.tsx` (NEW)
  - `apps/web/src/app/admin/reports/page.tsx` (NEW)
  - `apps/web/src/app/admin/tickets/page.tsx` (NEW)
  - `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE — add navigation links)
  - `apps/web/src/app/admin/page.tsx` (UPDATE — add quick action cards)
  - `apps/web/src/components/support/__tests__/violation-report-modal.spec.tsx` (NEW)
  - `apps/web/src/components/admin/__tests__/violation-reports-workspace.spec.tsx` (NEW)
  - `apps/web/src/components/admin/__tests__/support-tickets-workspace.spec.tsx` (NEW)

### Testing Standards Summary

- **Unit Tests (`vitest` / `jest`):**
  - Test all Zod schemas in `packages/shared` with boundary cases (empty reasons, invalid emails, phone formats, attachment count $> 5$).
  - Test SLA timer calculation edge cases in `support-tickets.service.ts` (on track, nearing breach at 59 mins, breached at 4h1m, resolution at 49h).
  - Test first response capture: ensure `firstRespondedAt` is set only on the *first* admin message and never overwritten on subsequent messages.
  - Test internal note filtering: regular responses visible, internal notes visible only with `Notes.Manage`.
  - Test `AuditLog` creation for every state change.
- **Frontend SSR Component Tests:**
  - Test modal opening, form fields, and submit confirmation with `react-dom/server` `renderToString`.
  - Test KPI cards rendering, SLA badges (emerald/amber/red), and action modals in `/admin/reports` and `/admin/tickets`.

### References

- [PRD FR-37: Violation Reporting](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#L555-L560)
- [PRD FR-38: Support Ticketing System](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#L561-L568)
- [Architecture Spine: RBAC Permissions & Audit Log](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#L435-L457)
- [UX Design Specifications: Admin Queues & Tables](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#L376-L385)
- [Story 8.4: Review Moderation Workspace](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/implementation-artifacts/8-4-review-moderation-workspace.md)
- [Story 8.3: Unified Operational Queue Task Claim & Heartbeat Locking Service](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/implementation-artifacts/8-3-unified-operational-queue-task-claim-heartbeat-locking-servi.md)

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Evaluated Story 8.4 (`8-4-review-moderation-workspace.md`) and Story 8.3 (`8-3-unified-operational-queue-task-claim-heartbeat-locking-servi.md`) patterns for admin controllers, shared DTOs, and sovereign UI workspaces.
- Checked `packages/shared/src/constants/auth.ts` verifying that `Tickets.Handle` and `Reports.Handle` are pre-defined in `AdminRole.MODERATOR`, `AdminRole.COMPLIANCE_OFFICER`, and `AdminRole.SUPER_ADMIN`.
- Analyzed `schema.prisma` and added `ViolationReport`, `SupportTicket`, and `TicketMessage` models with enums, indexes, and relations.
- Verified ClockService requirement (`AD-11`) for deterministic SLA calculation (`firstResponseDueAt = now + 4h`, `resolutionDueAt = now + 48h`).
- Handled Jest test execution in `apps/api` and Vitest in `packages/shared` and `apps/web`.
- Recompiled `packages/shared` via `npm run build --workspace=packages/shared` to produce up-to-date typings for the Jest backend test runner.
- Handled React 18/19 SSR comment node boundary handling in Vitest frontend assertions.

### Completion Notes List

- Implemented full vertical slice for Story 8.5 satisfying all 7 Acceptance Criteria (AC1 to AC7).
- Shared domain contracts (`@elmasaif/shared`): Added SLA constants, error codes, Zod validation schemas (`createViolationReportSchema`, `adjudicateViolationReportSchema`, `dismissViolationReportSchema`, `createSupportTicketSchema`, `updateSupportTicketStatusSchema`, `addTicketMessageSchema`, `supportTicketQuerySchema`), and TypeScript DTOs.
- Database Schema (`schema.prisma`): Added enums (`ViolationTargetType`, `ViolationCategory`, `ViolationReportStatus`, `ViolationAction`, `TicketCategory`, `TicketPriority`, `TicketStatus`) and models (`ViolationReport`, `SupportTicket`, `TicketMessage`) with proper indexes, deterministic sequential identifiers (`VR-{year}-{seq}` and `TIK-{year}-{seq}`), and soft deletion/permanent record guarantees (`AD-6`). Ran `prisma generate`.
- Backend Core (`apps/api`): Implemented `ViolationReportsService`, `ViolationReportsController`, `AdminViolationReportsController`, `SupportTicketsService`, `SupportTicketsController`, and `AdminSupportTicketsController` bundled into `SupportModule` and registered in `AppModule`.
- Security & Compliance: Dynamic RBAC permission guards with `@RequireAdminPermission('Reports.Handle')`, `@RequireAdminPermission('Tickets.Handle')`, and internal note access restricted by `Notes.Manage`. Preserved permanent audit trails using immutable `AuditLog` writes for all state changes.
- SLA Monitoring: Deterministic countdown computation with `ClockService.now()`, categorizing tickets into `ON_TRACK`, `NEARING_BREACH`, and `BREACHED` with emerald, amber, and red visual states.
- Customer Frontend (`apps/web`): Created `ViolationReportModal` and `SupportTicketModal` adhering to submit-only MVP paradigm, complete with confirmation view displaying reference numbers, integrated into listing details and broker profiles.
- Admin Workspaces (`apps/web`): Built sovereign operational interfaces for `/admin/reports` and `/admin/tickets` with KPI cards, multi-state filtering, message thread viewer, internal note composer, adjudication modals, and audit history drawers. Integrated navigation links into `WorkspaceShell` and operational dashboard quick cards in `/admin`.
- Comprehensive Verification: 18 Vitest unit tests in `packages/shared`, 15 Jest unit tests in `apps/api`, 11 Vitest SSR tests in `apps/web`, and regression suite passes on existing property and broker tests (39/39 passing) with zero regressions.

### File List

- `packages/shared/src/constants/support.ts` (NEW)
- `packages/shared/src/constants/errors.ts` (UPDATE)
- `packages/shared/src/constants/index.ts` (UPDATE)
- `packages/shared/src/schemas/support.schema.ts` (NEW)
- `packages/shared/src/schemas/index.ts` (UPDATE)
- `packages/shared/src/schemas/__tests__/support.spec.ts` (NEW)
- `packages/shared/src/types/support.ts` (NEW)
- `packages/shared/src/types/index.ts` (UPDATE)
- `apps/api/prisma/schema.prisma` (UPDATE)
- `apps/api/src/modules/support/violation-reports.service.ts` (NEW)
- `apps/api/src/modules/support/violation-reports.controller.ts` (NEW)
- `apps/api/src/modules/support/admin-violation-reports.controller.ts` (NEW)
- `apps/api/src/modules/support/support-tickets.service.ts` (NEW)
- `apps/api/src/modules/support/support-tickets.controller.ts` (NEW)
- `apps/api/src/modules/support/admin-support-tickets.controller.ts` (NEW)
- `apps/api/src/modules/support/support.module.ts` (NEW)
- `apps/api/src/modules/support/__tests__/violation-reports.spec.ts` (NEW)
- `apps/api/src/modules/support/__tests__/support-tickets.spec.ts` (NEW)
- `apps/api/src/app.module.ts` (UPDATE)
- `apps/web/src/components/support/violation-report-modal.tsx` (NEW)
- `apps/web/src/components/support/support-ticket-modal.tsx` (NEW)
- `apps/web/src/components/support/__tests__/violation-report-modal.spec.tsx` (NEW)
- `apps/web/src/components/admin/violation-reports-workspace.tsx` (NEW)
- `apps/web/src/components/admin/support-tickets-workspace.tsx` (NEW)
- `apps/web/src/components/admin/__tests__/violation-reports-workspace.spec.tsx` (NEW)
- `apps/web/src/components/admin/__tests__/support-tickets-workspace.spec.tsx` (NEW)
- `apps/web/src/app/admin/reports/page.tsx` (NEW)
- `apps/web/src/app/admin/tickets/page.tsx` (NEW)
- `apps/web/src/components/layout/workspace-shell.tsx` (UPDATE)
- `apps/web/src/app/admin/page.tsx` (UPDATE)
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` (UPDATE)
- `apps/web/src/app/brokers/[id]/page.tsx` (UPDATE)
- `_bmad-output/implementation-artifacts/8-5-violation-reporting-support-ticketing-system.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-11-12: Implemented Story 8.5 end-to-end (Violation Reporting & Support Ticketing System with SLA monitoring). All 7 Acceptance Criteria fulfilled and verified with 44 unit & SSR tests plus regression runs. Status transitioned to `review`.

