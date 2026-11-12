---
baseline_commit: ebb0975a25012167e3682082722f8a32de20ed8d
---

# Story 8.7: Immutable Domain Audit Logging & Inspection

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **compliance and security officer (Compliance Officer, Financial Auditor, or Super Admin with `Audit.View`)**,
I want an **append-only, tamper-evident audit log tracking every sensitive state transition, administrative approval, payout alteration, price override, and access disclosure, accompanied by a dedicated, strictly read-only inspection workspace with multi-attribute filtering and state diff inspection**,
so that **the platform maintains an unalterable forensic record for Saudi regulatory compliance (REGA, PDPL, ZATCA) and internal security governance, with zero possibility of retrospective data tampering or unauthorized log purging**.

---

## Acceptance Criteria

1. **AC1 — Shared Audit Contracts, Enums, Types & Zod Schemas (`@elmasaif/shared`):**
   - **Given** the regulatory and security requirements in `FR-42`, `BR-19`, `AD-2`, `AD-5`, `AD-6`, `AD-8`, and Epics §8.7,
   - **When** audit contracts are imported from `@elmasaif/shared`,
   - **Then** `@elmasaif/shared` exports:
     - Actor type constants / enum:
       - `AUDIT_ACTOR_TYPE = { ADMIN: 'ADMIN', USER: 'USER', SYSTEM: 'SYSTEM' }` as `AuditActorType`.
     - Standardized audit domain action constants (`packages/shared/src/constants/audit.ts`):
       - Identity & Governance: `USER_SUSPENDED`, `USER_ACTIVATED`, `PHONE_CHANGE_INITIATED`, `PHONE_CHANGE_VERIFIED`, `ACCOUNT_DELETION_INITIATED`, `ACCOUNT_DELETION_CANCELLED`, `ACCOUNT_PERMANENTLY_ERASED`, `PAYOUT_ACCOUNT_CREATED`, `PAYOUT_ACCOUNT_UPDATED`, `PAYOUT_ACCOUNT_DEACTIVATED`, `FAL_LICENSE_APPROVED`, `FAL_LICENSE_REJECTED`, `FAL_LICENSE_RENEWED`.
       - Listings & Moderation: `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_SUSPENDED`, `LISTING_ARCHIVED`, `PRICE_SUGGESTION_CREATED`, `PRICE_SUGGESTION_ACCEPTED`, `PRICE_SUGGESTION_REJECTED`.
       - Negotiation & Deals: `OFFER_SUBMITTED`, `COUNTER_OFFER_SUBMITTED`, `DEAL_FINAL_APPROVED`, `DEAL_CANCELLED`, `DEAL_DISPUTED`, `DEAL_COMPLETED`, `DEAL_TIMEOUT`, `CONTACT_DETAILS_DISCLOSED`.
       - Financials & Proofs: `PAYMENT_CONFIRMED`, `PAYMENT_REJECTED`, `CONTRACT_FEE_CONFIRMED`, `CONTRACT_FEE_REJECTED`, `OWNER_REQUEST_APPROVED`, `OWNER_REQUEST_REJECTED`, `OWNER_CONTRACT_DISPATCHED`.
       - Back-Office & Claims: `TASK_CLAIM_FORCE_UNLOCKED`, `PLATFORM_SETTINGS_UPDATED`, `ADMIN_USER_CREATED`, `ADMIN_USER_UPDATED`, `ADMIN_PERMISSIONS_CHANGED`, `ADMIN_STATUS_CHANGED`, `REVIEW_APPROVED`, `REVIEW_REJECTED`, `TICKET_STATUS_UPDATED`, `REPORT_RESOLVED`.
     - Error codes:
       - `AUDIT_LOG_NOT_FOUND`, `AUDIT_LOG_IMMUTABLE`, `AUDIT_UNAUTHORIZED`, `AUDIT_QUERY_INVALID`.
     - Zod Query Schema (`packages/shared/src/schemas/audit.schema.ts`):
       - `auditLogQuerySchema`: validates search and filtering parameters:
         - `page`: optional integer >= 1 (default 1).
         - `limit`: optional integer between 1 and 100 (default 20).
         - `entityType`: optional string (trimmed, max 100 chars).
         - `entityId`: optional string (trimmed, max 100 chars).
         - `action`: optional string (trimmed, max 100 chars).
         - `actorType`: optional enum (`'ADMIN' | 'USER' | 'SYSTEM'`).
         - `actorId`: optional string (trimmed, max 100 chars).
         - `startDate`: optional ISO 8601 date string.
         - `endDate`: optional ISO 8601 date string.
         - `search`: optional string (trimmed, max 200 chars) for searching action names, actor names, and justification reasons.
     - TypeScript DTO Interfaces (`packages/shared/src/types/audit.ts`):
       - `AuditLogListItemDto`: projection for inspection table (`id`, `actorId`, `actorType`, `actorName`, `actorRole`, `action`, `entityType`, `entityId`, `ipAddress`, `createdAt`, `justificationReason`, `hasSnapshots`).
       - `AuditLogDetailDto`: complete forensic record including `beforeSnapshot`, `afterSnapshot`, `changedKeys`, `metadata`, `ipAddress`, and `userAgent`.
       - `PaginatedAuditLogsDto`: pagination envelope (`items: AuditLogListItemDto[]`, `total: number`, `page: number`, `limit: number`, `totalPages: number`).
       - `AuditLogQueryInput`: TypeScript input type inferred from `auditLogQuerySchema`.

2. **AC2 — Database Immutability & Append-Only Guarantees (`apps/api/prisma`):**
   - **Given** business rule `BR-19` ("Audit database tables are strictly insert-only with zero update/delete permissions granted to application roles"),
   - **When** any SQL or Prisma client command attempts an `UPDATE` or `DELETE` on the `audit_logs` table,
   - **Then**:
     - A PostgreSQL trigger function (`prevent_audit_log_modification()`) raises a fatal database exception: `"AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19"`.
     - A dedicated migration in `apps/api/prisma/migrations/` attaches `BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification()`.
     - Database verification tests assert that:
       - Direct `UPDATE audit_logs SET ...` throws PostgreSQL exception and rolls back.
       - Direct `DELETE FROM audit_logs WHERE ...` throws PostgreSQL exception and rolls back.
       - `INSERT INTO audit_logs ...` succeeds unconditionally.

3. **AC3 — Backend Centralized Audit Service & Recording Helper (`apps/api/src/modules/audit`):**
   - **Given** the requirement to systematically capture before/after snapshots and actor metadata across all domains,
   - **When** domain services record sensitive transactions,
   - **Then**:
     - `AuditService` in `apps/api/src/modules/audit/audit.service.ts`:
       - Provides `record(prismaClientOrTx, input: CreateAuditRecordInput): Promise<AuditLog>`:
         - Standardizes `payload` JSON structure:
           - `actorName`: string (or `'النظام (System)'` for automated jobs).
           - `actorRole`: string (e.g. `'SUPER_ADMIN'`, `'COMPLIANCE_OFFICER'`, `'BUYER'`, `'SYSTEM'`).
           - `justificationReason`: optional or mandatory reason string.
           - `beforeSnapshot`: optional JSON object capturing entity state before transition.
           - `afterSnapshot`: optional JSON object capturing entity state after transition.
           - `changedKeys`: array of changed field names.
           - `metadata`: additional context (e.g. queue slug, dispute ID, client IP).
         - Sets `actorId`, `actorType`, `action`, `entityType`, `entityId`, `ipAddress`.
       - Enforces that no update or delete methods exist in `AuditService` (compile-time and runtime guarantee).
       - Provides paginated query method `findAuditLogs(query: AuditLogQueryInput)`:
         - Parses filters dynamically (entityType, entityId, action, actorType, actorId, date ranges).
         - Implements free text search over action, actor name, and justification reason.
         - Orders results by `createdAt: 'desc'`.
       - Provides `getAuditLogById(id: string)`:
         - Returns `AuditLogDetailDto` or throws `NotFoundException(AUDIT_LOG_NOT_FOUND)`.
       - Provides `getEntityAuditHistory(entityType: string, entityId: string)`:
         - Returns chronological timeline of audit events for a specific domain entity.

4. **AC4 — Administrative Inspection API Endpoints (`/api/v1/admin/audit`):**
   - **Given** an administrator or compliance officer inspecting platform audit logs,
   - **When** calling endpoints under `/api/v1/admin/audit`,
   - **Then**:
     - All routes are guarded by `AdminSessionAuthGuard` and `@RequirePermissions('Audit.View')`.
     - Super Admins, Compliance Officers, and Financial Auditors have access out-of-the-box via role definitions (`packages/shared/src/constants/auth.ts`).
     - Staff lacking `Audit.View` receive `403 Forbidden` (`FORBIDDEN_RESOURCE`).
     - `GET /api/v1/admin/audit`:
       - Accepts query parameters validated via `auditLogQuerySchema`.
       - Returns `PaginatedAuditLogsDto`.
     - `GET /api/v1/admin/audit/:id`:
       - Returns `AuditLogDetailDto` with full JSON snapshots and metadata.
     - `GET /api/v1/admin/audit/entity/:entityType/:entityId`:
       - Returns array of audit entries for the specified entity ordered by timestamp desc.
     - **Strict Immutability Boundary**: There are NO `POST`, `PUT`, `PATCH`, or `DELETE` endpoints under `/api/v1/admin/audit`. Any HTTP request with these methods returns `405 Method Not Allowed` or `404 Not Found`.

5. **AC5 — Coverage Verification Across Sensitive Domain Operations:**
   - **Given** the business critical operations across Epics 1 through 8,
   - **When** verifying audit log creation,
   - **Then** the following sensitive operations are confirmed to generate complete `AuditLog` rows:
     - **Payout & IBAN Management (`Story 1.5`, `FR-5`):** IBAN updates, bank name updates, verification changes.
     - **Administrative Approvals (`Stories 2.4, 6.1, 5.3, 7.3, 8.4`):** Fal license approval/rejection, listing approval/rejection/suspension, payment proof approval/rejection, owner contract fee approval/rejection, review approval/rejection.
     - **Price Overrides & Suggestions (`Stories 2.5, 4.1`):** Admin price suggestions and seller acceptance/rejection.
     - **Claim Force-Unlocks (`Story 8.3`, `AD-10`):** Force-unlocking task claims records `TASK_CLAIM_FORCE_UNLOCKED` capturing the target task, previous lock owner, new lock state, and mandatory admin reason.
     - **Contact Disclosures (`Story 5.4`, `FR-33`, `BR-19`):** Completion of deal unlocks counterparty phone/national identity; records `CONTACT_DETAILS_DISCLOSED` logging which identities were revealed.
     - **Status Transitions & Lifecycle Events (`Stories 1.9, 3.6, 5.1, 5.5, 5.6, 8.5`):** Account cooling-off/deletion, demand cancellation/expiry, deal final approval, deal timeout cancellations, dispute adjudication, support ticket priority/status changes, violation report actions.
     - **Platform Settings & RBAC (`Stories 8.2, 8.6`):** Dynamic commission parameter updates (`PLATFORM_SETTINGS_UPDATED`) and staff permission modifications (`ADMIN_PERMISSIONS_CHANGED`).

6. **AC6 — Administrative Audit Inspection Workspace UI (`apps/web/src/app/admin/audit`):**
   - **Given** an authorized compliance officer or admin viewing `/admin/audit`,
   - **When** the page renders,
   - **Then**:
     - The page layout respects Arabic RTL alignment, sovereign palette (`#1B4332`, emerald accents, slate neutrals), and typography tokens:
       - Header displays title: `"سجل التدقيق والرقابة (Audit Log)"` and subtitle: `"سجل رقابي غير قابل للتعديل يوثق جميع العمليات الإدارية والتحولات الحساسة في النظام"`.
       - Immutability assurance badge: `"سجل غير قابل للتعديل (Append-Only)"` with lock icon.
     - **Filter & Search Toolbar:**
       - Search input: searches keywords across action, actor name, and justification.
       - Entity Type selector dropdown: All, Deal, Listing, User, PayoutAccount, PaymentProof, ContractFee, FalLicense, SupportTicket, ViolationReport, PlatformSetting, TaskClaimLock.
       - Actor Type selector: All, Admin (مشرف), User (مستخدم), System (النظام).
       - Date Range inputs: From Date (`من تاريخ`) and To Date (`إلى تاريخ`).
       - Action search / filter.
       - "إعادة تعيين الفلاتر (Reset Filters)" button.
     - **Audit Records Table:**
       - Columns:
         - **التاريخ والوقت:** Formatted timestamp with Saudi Arabia timezone (`Asia/Riyadh`), monospace digits.
         - **نوع الإجراء / الحدث:** Semantic colored badge per action category (e.g. emerald for approvals, amber for updates/overrides, rose for rejections/suspensions, blue for claims/system).
         - **الكيان:** Entity Type and monospace Entity ID.
         - **المنفذ (Actor):** Actor Name, Role chip, Actor Type badge.
         - **عنوان IP:** Monospace IP address.
         - **سبب الإجراء / المبرر:** Truncated preview of justification reason.
         - **الإجراءات:** "عرض التفاصيل (Inspect Details)" button with eye / search icon.
       - Pagination controls: Page indicator, previous/next buttons, and items per page selector.
       - Empty state with clear guidance when no logs match filters.
     - **Audit Detail Inspection Modal / Drawer:**
       - Opens on clicking "عرض التفاصيل".
       - Shows complete forensic details:
         - Full actor information (ID, Name, Role, Type, IP address, Timestamp).
         - Entity information (Type, ID, direct link to entity workspace if applicable).
         - Action name and category.
         - Full justification reason (`سبب الإجراء`).
         - **State Diff Viewer:**
           - Side-by-side or tabbed view of "الحالة السابقة (Before)" and "الحالة الجديدة (After)".
           - Highlighted changed keys (`الحقول المعدلة`).
           - Formatted JSON tree / viewer with syntax styling.
           - "نسخ السجل (Copy JSON)" button.
       - **Strict Inspect-Only Rule:** Zero edit, update, or delete buttons exist anywhere in the modal or workspace.
     - **Navigation & Workspace Shell Integration:**
       - Added to `roleNavItems[UserRole.ADMIN]` in `apps/web/src/components/layout/workspace-shell.tsx` under condition:
         `!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Audit.View')`.
       - Nav item: `{ href: '/admin/audit', label: 'سجل التدقيق والرقابة', icon: ScrollText }`.
       - Quick link tile added to `/admin` dashboard (`apps/web/src/app/admin/page.tsx`).

7. **AC7 — Comprehensive Test Coverage (`shared`, `api`, `web`):**
   - **Given** the implementation of Story 8.7,
   - **When** running monorepo test suites,
   - **Then**:
     - `packages/shared`:
       - Unit tests for `auditLogQuerySchema` testing validation bounds, valid ISO dates, limit constraints, and enum validations.
     - `apps/api`:
       - Database immutability integration tests: verifying PostgreSQL trigger blocks `UPDATE` and `DELETE` on `audit_logs` table while allowing `INSERT`.
       - `audit.service.spec.ts`: unit tests for `record`, `findAuditLogs`, `getAuditLogById`, `getEntityAuditHistory`, filtering logic, and snapshot formatting.
       - `admin-audit.controller.spec.ts`: unit tests for `Audit.View` permission enforcement, Super Admin access, unauthenticated rejection, and query parameter passing.
     - `apps/web`:
       - `audit-log-workspace.spec.tsx`: unit tests for rendering table, filter interactions, pagination, opening detail modal, JSON viewer inspection, and absence of mutation controls.
     - Monorepo regression test: All existing suites (`pnpm test`) pass with zero regressions.

---

## Tasks / Subtasks

- [ ] **Task 1: Shared Contracts, Action Constants, Enums, Types & Zod Schemas (`@elmasaif/shared`)** (AC: #1)
  - [ ] 1.1 Create `packages/shared/src/constants/audit.ts` defining `AUDIT_ACTOR_TYPE`, comprehensive domain action constants, category color mappings, and error codes.
  - [ ] 1.2 Export audit constants from `packages/shared/src/constants/index.ts`.
  - [ ] 1.3 Create `packages/shared/src/types/audit.ts` with `AuditLogListItemDto`, `AuditLogDetailDto`, `PaginatedAuditLogsDto`, and `CreateAuditRecordInput`.
  - [ ] 1.4 Export audit types from `packages/shared/src/types/index.ts`.
  - [ ] 1.5 Create `packages/shared/src/schemas/audit.schema.ts` defining `auditLogQuerySchema` with Zod.
  - [ ] 1.6 Export audit schemas from `packages/shared/src/schemas/index.ts`.
  - [ ] 1.7 Add unit tests in `packages/shared/src/schemas/__tests__/audit.spec.ts` testing query validation bounds, pagination limits, and date parsing.

- [ ] **Task 2: Database Immutability & PostgreSQL Migration (`apps/api/prisma`)** (AC: #2)
  - [ ] 2.1 Verify `AuditLog` model in `apps/api/prisma/schema.prisma` has necessary indexes (`[entityType, entityId]`, `[action, createdAt]`, `[actorId, createdAt]`).
  - [ ] 2.2 Create a database migration script adding the PostgreSQL trigger `prevent_audit_log_modification()` on `audit_logs` table enforcing insert-only behavior per `BR-19`.
  - [ ] 2.3 Add Prisma integration test verifying that `prisma.auditLog.update` and `prisma.auditLog.delete` throw database exceptions while `prisma.auditLog.create` succeeds.

- [ ] **Task 3: Backend Audit Module & Service Implementation (`apps/api`)** (AC: #3, #4)
  - [ ] 3.1 Create `apps/api/src/modules/audit/audit.service.ts` implementing `record`, `findAuditLogs`, `getAuditLogById`, and `getEntityAuditHistory`.
  - [ ] 3.2 Create `apps/api/src/modules/audit/admin-audit.controller.ts` providing `GET /api/v1/admin/audit`, `GET /api/v1/admin/audit/:id`, and `GET /api/v1/admin/audit/entity/:entityType/:entityId`.
  - [ ] 3.3 Apply `@UseGuards(AdminSessionAuthGuard, PermissionsGuard)` and `@RequirePermissions('Audit.View')` on `AdminAuditController`.
  - [ ] 3.4 Create `apps/api/src/modules/audit/audit.module.ts` bundling service and controller, exporting `AuditService`.
  - [ ] 3.5 Register `AuditModule` in `apps/api/src/app.module.ts` as a global or shared module so any domain module can inject `AuditService`.

- [ ] **Task 4: Domain Operations Audit Coverage Audit & Standardization (`apps/api`)** (AC: #5)
  - [ ] 4.1 Audit existing domain services (`users`, `listings`, `offers`, `deals`, `contracts`, `licenses`, `support`, `settings`, `locks`) to verify `AuditService.record` or standard `AuditLog` payloads are used consistently.
  - [ ] 4.2 Verify contact disclosure audit logging on deal completion (`CONTACT_DETAILS_DISCLOSED`).
  - [ ] 4.3 Verify task claim force-unlock audit logging (`TASK_CLAIM_FORCE_UNLOCKED`) includes previous lock holder, new lock holder, and justification reason.

- [ ] **Task 5: Frontend Administrative Inspection Workspace (`apps/web`)** (AC: #6)
  - [ ] 5.1 Create `apps/web/src/components/admin/audit-log-workspace.tsx` with filter toolbar, responsive Arabic table, action badges, and pagination.
  - [ ] 5.2 Create `apps/web/src/components/admin/audit-log-detail-modal.tsx` with full snapshot inspect viewer, before/after diff highlight, and JSON copy button.
  - [ ] 5.3 Create page `apps/web/src/app/admin/audit/page.tsx`.
  - [ ] 5.4 Update `apps/web/src/components/layout/workspace-shell.tsx` adding `سجل التدقيق والرقابة` to admin navigation for Super Admins and staff with `Audit.View`.
  - [ ] 5.5 Update `apps/web/src/app/admin/page.tsx` adding quick-access audit log card.

- [ ] **Task 6: Verification & Test Suite** (AC: #7)
  - [ ] 6.1 Create `packages/shared/src/schemas/__tests__/audit.spec.ts` for schema validation tests.
  - [ ] 6.2 Create `apps/api/src/modules/audit/__tests__/audit.service.spec.ts` testing queries, pagination, search, and recording.
  - [ ] 6.3 Create `apps/api/src/modules/audit/__tests__/admin-audit.controller.spec.ts` testing RBAC guards and endpoints.
  - [ ] 6.4 Create `apps/web/src/components/admin/__tests__/audit-log-workspace.spec.tsx` testing rendering, filter controls, detail modal inspection, and read-only assertions.
  - [ ] 6.5 Run full monorepo build and test suites (`pnpm test`) ensuring 100% pass rate.

---

## Dev Notes

### Architecture Patterns & Constraints

- **Strict Presentation / Domain Separation (`AD-2`):**
  - All audit queries execute through authenticated NestJS endpoints under `/api/v1/admin/audit`.
  - No Next.js Server Actions or direct DB queries from `apps/web`.
- **Absolute Immutability at Database Level (`BR-19`):**
  - PostgreSQL trigger `prevent_audit_log_modification()` intercepts `UPDATE` and `DELETE` on `audit_logs` and aborts with a fatal exception.
  - The API exposes **zero mutation endpoints** for audit logs.
- **Granular RBAC (`AD-5`):**
  - Controlled by the `Audit.View` permission key (`packages/shared/src/constants/auth.ts`).
  - Roles with default access: `SUPER_ADMIN`, `COMPLIANCE_OFFICER`, `FINANCIAL_AUDITOR`.
- **Standardized Payload Schema:**
  - Audit log `payload` JSON field must systematically structure data as:
    ```typescript
    {
      actorName?: string;
      actorRole?: string;
      justificationReason?: string;
      changedKeys?: string[];
      beforeSnapshot?: Record<string, any>;
      afterSnapshot?: Record<string, any>;
      metadata?: Record<string, any>;
    }
    ```
- **RTL & Design System Semantics:**
  - Use Saudi sovereign palette (`#1B4332`, emerald accents, slate neutrals), monospace font for dates, IDs, and IP addresses, and Arabic typography.

### Files to Touch & Modularity

- **Packages / Shared (`packages/shared`):**
  - `packages/shared/src/constants/audit.ts` — NEW
  - `packages/shared/src/types/audit.ts` — NEW
  - `packages/shared/src/schemas/audit.schema.ts` — NEW
  - `packages/shared/src/schemas/__tests__/audit.spec.ts` — NEW
  - `packages/shared/src/constants/index.ts` — UPDATE (re-export audit constants)
  - `packages/shared/src/types/index.ts` — UPDATE (re-export audit types)
  - `packages/shared/src/schemas/index.ts` — UPDATE (re-export audit schemas)
- **API (`apps/api`):**
  - `apps/api/prisma/schema.prisma` — UPDATE (add index `[actorId, createdAt]` if missing)
  - `apps/api/prisma/migrations/xxxx_audit_logs_immutable/migration.sql` — NEW (trigger function `prevent_audit_log_modification`)
  - `apps/api/src/modules/audit/audit.module.ts` — NEW
  - `apps/api/src/modules/audit/audit.service.ts` — NEW
  - `apps/api/src/modules/audit/admin-audit.controller.ts` — NEW
  - `apps/api/src/modules/audit/__tests__/audit.service.spec.ts` — NEW
  - `apps/api/src/modules/audit/__tests__/admin-audit.controller.spec.ts` — NEW
  - `apps/api/src/app.module.ts` — UPDATE (register `AuditModule`)
- **Web App (`apps/web`):**
  - `apps/web/src/app/admin/audit/page.tsx` — NEW
  - `apps/web/src/components/admin/audit-log-workspace.tsx` — NEW
  - `apps/web/src/components/admin/audit-log-detail-modal.tsx` — NEW
  - `apps/web/src/components/admin/__tests__/audit-log-workspace.spec.tsx` — NEW
  - `apps/web/src/components/layout/workspace-shell.tsx` — UPDATE (add audit log navigation link)
  - `apps/web/src/app/admin/page.tsx` — UPDATE (add audit log dashboard tile)

### Files Being Modified (UPDATE Files Detail)

1. `apps/web/src/components/layout/workspace-shell.tsx`:
   - **Current State:** Contains navigation for admin routes (`/admin`, `/admin/queues`, `/admin/owner-requests`, `/admin/licenses`, `/admin/listings/moderation`, `/admin/geo`, `/admin/offers`, `/admin/conversations`, `/admin/backup-offers`, `/admin/payments`, `/admin/disputes`, `/admin/reviews`, `/admin/reports`, `/admin/tickets`, `/admin/staff`, `/admin/settings`).
   - **What Changes:** Add `{ href: '/admin/audit', label: 'سجل التدقيق والرقابة', icon: ScrollText }` guarded by `!admin || admin.role === 'SUPER_ADMIN' || admin.permissions?.includes('Audit.View')`.
   - **What Must Be Preserved:** All existing navigation items, role switcher behavior, dark/light toggle, and mobile responsive menu.
2. `apps/web/src/app/admin/page.tsx`:
   - **Current State:** Admin dashboard with quick-access cards to various operational queues and workspaces.
   - **What Changes:** Add quick-access card to `/admin/audit` for users with `Audit.View`.
   - **What Must Be Preserved:** Existing KPI cards, queue links, and status summaries.
3. `apps/api/src/app.module.ts`:
   - **Current State:** Registers existing modules (`AuthModule`, `UsersModule`, `ListingsModule`, `OffersModule`, `DealsModule`, `DemandsModule`, `ContractsModule`, `LicensesModule`, `GeoModule`, `HealthModule`, `InquiriesModule`, `StorageModule`, `SupportModule`, `SettingsModule`).
   - **What Changes:** Import and register `AuditModule`.
   - **What Must Be Preserved:** All existing modules and middleware.

### Testing Standards Summary

- **Unit Tests:**
  - `packages/shared/src/schemas/__tests__/audit.spec.ts`: Verify `auditLogQuerySchema` with invalid pages, out-of-range limits, valid ISO strings, and enum constraints.
  - `apps/api/src/modules/audit/__tests__/audit.service.spec.ts`: Verify pagination calculation, entity filtering, keyword search, standard record payload normalization, and single-item retrieval.
  - `apps/api/src/modules/audit/__tests__/admin-audit.controller.spec.ts`: Verify RBAC `@RequirePermissions('Audit.View')`, Super Admin access, parameter passing, and 403 response on missing permission.
  - `apps/web/src/components/admin/__tests__/audit-log-workspace.spec.tsx`: Test rendering table, action badges, filtering, pagination, modal opening, JSON viewer rendering, and assert zero edit/delete controls exist.
- **Integration Tests:**
  - Database test verifying PostgreSQL trigger rejects `UPDATE` and `DELETE` on `audit_logs`.

---

### Project Structure Notes

- Module placed in `apps/api/src/modules/audit` matching standard NestJS modular layout.
- Inspection components placed in `apps/web/src/components/admin/` and mounted on `apps/web/src/app/admin/audit/page.tsx` adhering to the administrative workspace pattern.
- Contracts and schemas centralized in `packages/shared`.

---

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 8.7 (L971-981)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md`#FR-42 (L596-602), #BR-19 (L601, L937), #UJ-5 (L121)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md`#AD-2, #AD-5, #AD-6, #AD-8, #AD-10]
- [Source: `packages/shared/src/constants/auth.ts` (L320: `Audit.View`, L388, L410: `COMPLIANCE_OFFICER`, `FINANCIAL_AUDITOR`)]
- [Source: `apps/api/prisma/schema.prisma` (L1124-1138: `model AuditLog`)]
- [Source: `apps/web/src/components/layout/workspace-shell.tsx` (L118-166: admin navigation list)]

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

