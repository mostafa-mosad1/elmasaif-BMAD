---
baseline_commit: f964421d93a68a7e8bb1ca7789885191878837a0
---

# Story 8.2: Granular Dynamic RBAC & Super Admin User Management

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Super Administrator,
I want to create staff accounts, assign granular permissions per operational area, and manage staff and user account lifecycles (enable, disable, soft-delete, and guarded hard-delete),
so that employees only have access to their designated operational areas and historical audit/transaction integrity is strictly preserved.

## Acceptance Criteria

1. **AC1 — Prisma Schema & Granular Permission Catalog (`FR-40`, `AD-12`):**
   - **Given** the `AdminUser` model in `apps/api/prisma/schema.prisma` and the shared auth constants in `packages/shared/src/constants/auth.ts`
   - **When** the schema and shared permission catalog are evaluated
   - **Then** `AdminUser` includes:
     - `permissions String[] @default([])` storing explicit granular `Area.Action` permissions assigned to the staff account
     - `deletedAt DateTime? @map("deleted_at")` recording when a staff account was soft-deleted
   - **And** `packages/shared/src/constants/auth.ts` exports `ALL_ADMIN_PERMISSIONS` (and `ADMIN_PERMISSION_GROUPS` metadata for UI grouping) containing all canonical `Area.Action` keys from the Architecture Permission Matrix (`AD-12`) and Story 8.2/8.9 specifications, specifically including:
     - `Users.View`, `Users.Verify`, `Users.Status`, `Users.HardDelete`, `Users.PhoneChange`
     - `Listings.View`, `Listings.Review`, `Listings.Edit`, `Listings.Lifecycle`, `Listings.PriceSuggest`, `Listings.Feature`
     - `Licenses.View`, `Licenses.Verify`, `Licenses.Compliance`
     - `Contracts.View`, `Contracts.Manage`, `Contracts.Assign`
     - `Offers.View`, `Offers.Manage`
     - `Deals.View`, `Deals.FinalApprove`, `Deals.ExtendTimer`, `Deals.DisputeResolve`
     - `Payments.View`, `Payments.Verify`, `Payments.Refund`
     - `Conversations.View`, `Conversations.Relay`, `Conversations.Redact`
     - `Reviews.View`, `Reviews.Moderate`
     - `Geo.Manage`
     - `Tasks.View`, `Tasks.Claim`, `Tasks.ForceUnlock`
     - `Finance.View`, `Finance.Export`, `Finance.Audit`
     - `Compliance.View`, `Compliance.Manage`, `Security.Manage`
     - `Settings.Manage`, `CMS.Manage`, `Audit.View`, `Rbac.Manage`
   - **And** `resolveAdminPermissions(role: AdminRole, customPermissions?: string[] | null): string[]` returns `ALL_ADMIN_PERMISSIONS` for `AdminRole.SUPER_ADMIN`, returns `customPermissions` when a non-empty array is stored on the `AdminUser`, and falls back to `ADMIN_ROLE_PERMISSIONS[role]` when `customPermissions` is empty or undefined (preserving 100% backward compatibility with existing unit tests and seeded accounts).

2. **AC2 — Server-Side `@RequirePermissions('Area.Action')` & Dynamic `AdminPermissionGuard` Enforcement (`FR-40`, `NFR1`, `AD-5`, `AD-12`):**
   - **Given** any back-office API endpoint decorated with `@RequirePermissions('Area.Action')` or `@RequireAdminPermission('Area.Action')`
   - **When** a request is evaluated by `AdminSessionAuthGuard` and `AdminPermissionGuard`
   - **Then** `@RequirePermissions` is exported from `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts` as an alias for `@RequireAdminPermission` (setting `ADMIN_PERMISSION_METADATA_KEY`), so both decorator names work identically across all controllers
   - **And** `AdminSessionAuthGuard` rejects any session whose `admin` has `isActive === false` or `deletedAt !== null` (revoking the session and throwing `401 Unauthorized` with `ADMIN_ACCOUNT_DISABLED`), and populates `request.admin.permissions` using `resolveAdminPermissions(session.admin.role, session.admin.permissions)`
   - **And** `AdminPermissionGuard` rejects any request where `!admin?.id || !admin.isActive || admin.deletedAt` with `403 Forbidden` (`AUTH_NOT_AUTHORIZED`), allows `AdminRole.SUPER_ADMIN`, and for all other roles checks whether `requiredPermission` is present in `resolveAdminPermissions(admin.role, admin.permissions)`
   - **And** legacy hardcoded role checks in `AdminGeoGuard` (`Geo.Manage`), `AdminPhoneChangeController` (`Users.PhoneChange`), and `AdminIdentityController` (`Users.Verify`) also honor dynamic `admin.permissions` via `resolveAdminPermissions` so a staff account granted `Geo.Manage`, `Users.PhoneChange`, or `Users.Verify` dynamically can access those endpoints without requiring a hardcoded role enum match.

3. **AC3 — Super Admin Staff Account Creation & Granular Permission Configuration (`FR-40`, `AD-12`, `BR-18`):**
   - **Given** an authenticated Super Admin (`@RequirePermissions('Rbac.Manage')`)
   - **When** managing staff accounts via `/api/v1/admin/staff` (and backward-compatible `/api/v1/admin/auth/staff`)
   - **Then** the following endpoints are enforced on the server:
     - `GET /api/v1/admin/staff`: Lists all staff accounts (`id`, `username`, `email`, `fullName`, `role`, `permissions`, `isActive`, `deletedAt`, `lastLoginAt`, `createdAt`, `hasOperationalHistory`) plus the `ADMIN_PERMISSION_GROUPS` catalog and role default presets
     - `POST /api/v1/admin/staff`: Creates a new staff account with validated `username` (lowercase normalized), `email`, `fullName`, `role`, `initialPassword` (policy-validated and hashed with Argon2id), and `permissions` (validated against `ALL_ADMIN_PERMISSIONS`; defaults to `ADMIN_ROLE_PERMISSIONS[role]` if omitted). Rejects duplicate username (`ADMIN_USERNAME_ALREADY_EXISTS`, `409`) or email (`ADMIN_EMAIL_ALREADY_EXISTS`, `409`), and logs `ADMIN_STAFF_CREATED` to `AuditLog`
     - `PATCH /api/v1/admin/staff/:adminId/permissions`: Updates a staff member's `role`, `fullName`, and granular `permissions` array with a mandatory `reason` (minimum 3 chars). Blocks self-permission demotion (`ADMIN_SELF_MODIFICATION_FORBIDDEN`, `400`), revokes all active `AdminSession` records for that staff member so new permissions take effect immediately, and writes an immutable `AuditLog` entry (`action: 'ADMIN_PERMISSIONS_UPDATED'`) with `beforeSnapshot`, `afterSnapshot`, and `reason`.

4. **AC4 — Staff Account Disable, Enable, Soft-Delete & Hard-Delete History Block (`FR-40`, `FR-43`, `BR-18`):**
   - **Given** a Super Admin managing a staff account (`@RequirePermissions('Rbac.Manage')`)
   - **When** changing staff account status or attempting deletion
   - **Then**:
     - `POST /api/v1/admin/staff/:adminId/status` accepts `action: 'ENABLE' | 'DISABLE' | 'SOFT_DELETE'` and mandatory `reason`. Blocks self-status modification (`ADMIN_SELF_MODIFICATION_FORBIDDEN`, `400`). On `DISABLE`, sets `isActive = false`; on `SOFT_DELETE`, sets `isActive = false` and `deletedAt = ClockService.now()`; on `ENABLE`, sets `isActive = true` and `deletedAt = null`. On `DISABLE` or `SOFT_DELETE`, immediately revokes all active `AdminSession` rows (`revokedAt = now`) and logs `ADMIN_STAFF_STATUS_CHANGED` / `ADMIN_STAFF_SOFT_DELETED` to `AuditLog`
     - `DELETE /api/v1/admin/staff/:adminId` accepts mandatory `reason` and checks whether the staff account has any audit or operational history across the platform (`AuditLog` where `actorId = adminId`, reviewed/locked `Listing`, reviewed `FalLicense`, created `ContractTemplate`, `OfferHistory`, approved `Deal`, verified `Payment` or `ContractFeePayment`, resolved `Dispute`, moderated `Rating`, `PriceSuggestion`, or relayed `InquiryMessage`)
     - If **any** operational/audit history exists (`historyCount > 0`), hard deletion is **strictly blocked** with HTTP `409 Conflict` and error code `ADMIN_HARD_DELETE_HISTORY_EXISTS` (`"لا يمكن الحذف النهائي لحساب الموظف لوجود سجل عمليات أو تدقيق مرتبط به؛ يرجى استخدام التعطيل أو الحذف الناعم"`), and `ADMIN_STAFF_HARD_DELETE_BLOCKED` is logged to `AuditLog`
     - If **zero** history exists (`historyCount === 0`), the `AdminUser` (and any sessions) is permanently deleted in a transaction and `ADMIN_STAFF_HARD_DELETED` is logged to `AuditLog`.

5. **AC5 — Platform User Account Status (Disable/Enable/Soft-Delete) & Hard-Delete Transaction History Block (`FR-43`, `AD-12`, `BR-18`):**
   - **Given** an authorized admin managing platform user accounts (`/api/v1/admin/users`)
   - **When** invoking user status or deletion endpoints guarded by `@RequirePermissions('Users.View')`, `@RequirePermissions('Users.Status')`, or `@RequirePermissions('Users.HardDelete')`
   - **Then**:
     - `GET /api/v1/admin/users` (`@RequirePermissions('Users.View')`): Lists platform users (`id`, `phone`, `fullName`, `role`, `verificationStatus`, `isActive`, `deletedAt`, `createdAt`, `transactionHistoryCount`)
     - `POST /api/v1/admin/users/:userId/status` (`@RequirePermissions('Users.Status')`): Accepts `action: 'ENABLE' | 'DISABLE' | 'SOFT_DELETE'` and mandatory `reason`. Updates `User.isActive` and `User.deletedAt` (using `ClockService.now()`), revokes active `UserSession` records when disabling/soft-deleting, and logs `ADMIN_USER_STATUS_CHANGED` to `AuditLog`
     - `DELETE /api/v1/admin/users/:userId` (`@RequirePermissions('Users.HardDelete')`): Checks transactional history (`Listing`, `Offer`, `Deal` as buyer/seller, `Payment`, `ContractFeePayment`, `Dispute`, `Rating`, `InquiryThread`). If any transaction history exists (`historyCount > 0`), strictly blocks hard deletion with HTTP `409 Conflict` (`USER_HARD_DELETE_HISTORY_EXISTS`: `"لا يمكن الحذف النهائي لحساب المستخدم لوجود سجل معاملات مرتبط به؛ يرجى استخدام التعطيل أو الحذف الناعم"`) and logs `ADMIN_USER_HARD_DELETE_BLOCKED`. If `historyCount === 0`, deletes the user record and logs `ADMIN_USER_HARD_DELETED`.

6. **AC6 — Back-Office Staff & Dynamic RBAC Management UI (`/admin/staff` & `/admin/page.tsx`):**
   - **Given** an authenticated admin in the Next.js back-office (`apps/web`)
   - **When** navigating to `/admin/staff` (or viewing `/admin`)
   - **Then**:
     - `WorkspaceShell` (`apps/web/src/components/layout/workspace-shell.tsx`) and `/admin/page.tsx` display a link to `/admin/staff` (`"إدارة الموظفين والصلاحيات (RBAC)"`) visible to admins with `Rbac.Manage`
     - `/admin/staff` renders `AdminStaffManagement` (`apps/web/src/components/admin/admin-staff-management.tsx`), which provides:
       1. **Staff Accounts Table:** Displays Full Name, Username & Email, Role badge (`SUPER_ADMIN`, `MODERATOR`, `FINANCIAL_AUDITOR`, `COMPLIANCE_OFFICER`), Account Status badge (`نشط`, `معطل`, `محذوف ناعماً`), Assigned Granular Permissions count & preview chips, History status badge (`سجل عمليات مرتبط` vs `بدون سجل`), and action buttons (`تعديل الصلاحيات`, `تعطيل/تفعيل`, `حذف ناعم`, `حذف نهائي`, `رابط استعادة كلمة المرور`)
       2. **Create Staff Modal (`AdminCreateStaffModal`):** Form to create a new staff account with Role preset selector and interactive granular `Area.Action` permission checkboxes grouped by operational domain (`Users`, `Listings`, `Licenses`, `Contracts`, `Offers`, `Deals`, `Payments`, `Conversations`, `Reviews`, `Geo`, `Tasks`, `Finance`, `Security & Compliance`, `System & RBAC`)
       3. **Edit Granular Permissions Modal (`AdminPermissionsModal`):** Interactive permission matrix editor allowing the Super Admin to toggle individual `Area.Action` permissions (e.g., `Reviews.Moderate`, `Geo.Manage`, `Tasks.ForceUnlock`, `Users.PhoneChange`, `Deals.FinalApprove`, `Deals.DisputeResolve`, `Contracts.Manage`, `Security.Manage`, `Finance.Audit`, `CMS.Manage`), apply role default presets, enter a mandatory justification reason, and save
       4. **Status & Guarded Deletion Controls:** Confirmation dialog with mandatory reason for Disable / Enable / Soft-Delete / Hard-Delete, plus a clear visual warning when `hasOperationalHistory` is true that hard deletion is blocked by `BR-18` / `FR-43`
       5. **Platform User Governance Tab/Section:** Allows admins with `Users.Status` / `Users.HardDelete` to enable, disable, soft-delete, or attempt guarded hard-delete on platform user accounts.

7. **AC7 — Automated Testing & Build Verification:**
   - **Given** the changes across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running workspace test suites, lint, and build
   - **Then** unit tests cover:
     - `packages/shared`: `ALL_ADMIN_PERMISSIONS`, `resolveAdminPermissions`, and Zod schemas for staff creation, permission updates, and status/deletion actions
     - `apps/api`: `@RequirePermissions` / `AdminPermissionGuard` dynamic permission enforcement (allowing custom permission overrides and blocking missing permissions or soft-deleted admins), `AdminRbacService` / `AdminAuthService` staff creation, permission matrix update + session revocation, disable/enable/soft-delete, and hard-delete block when history exists (`ADMIN_HARD_DELETE_HISTORY_EXISTS`), plus `AdminUsersService` user status & hard-delete block (`USER_HARD_DELETE_HISTORY_EXISTS`)
     - `apps/web`: SSR component tests (`renderToString`) for `AdminStaffManagement`, `AdminCreateStaffModal`, and `AdminPermissionsModal`
   - **And** `npm test`, `npm run lint`, and `npm run build` pass with zero errors and zero regressions across all existing suites.

## Tasks / Subtasks

- [x] **Task 1: Update Prisma Schema & Shared RBAC Contracts (AC: 1)**
  - [x] 1.1 Update `AdminUser` in `apps/api/prisma/schema.prisma` to add `permissions String[] @default([])` and `deletedAt DateTime? @map("deleted_at")`, and run `npx prisma generate --schema apps/api/prisma/schema.prisma`.
  - [x] 1.2 Update `packages/shared/src/constants/auth.ts`:
    - Expand `ADMIN_ROLE_PERMISSIONS` and export `ALL_ADMIN_PERMISSIONS` and `ADMIN_PERMISSION_GROUPS` so all 42 canonical `Area.Action` keys from `AD-12` and Story 8.2/8.9 (`Reviews.Moderate`, `Geo.Manage`, `Tasks.ForceUnlock`, `Users.PhoneChange`, `Deals.FinalApprove`, `Deals.DisputeResolve`, `Contracts.Manage`, `Security.Manage`, `Finance.Audit`, `CMS.Manage`, etc.) are defined with Arabic labels.
    - Export helper `resolveAdminPermissions(role: AdminRole, customPermissions?: string[] | null): string[]`.
    - Add error codes: `ADMIN_USERNAME_ALREADY_EXISTS`, `ADMIN_EMAIL_ALREADY_EXISTS`, `ADMIN_SELF_MODIFICATION_FORBIDDEN`, `ADMIN_LAST_SUPER_ADMIN_BLOCK`, `ADMIN_HARD_DELETE_HISTORY_EXISTS`, `USER_HARD_DELETE_HISTORY_EXISTS`.
  - [x] 1.3 Update `packages/shared/src/schemas/auth.schema.ts` and `packages/shared/src/types/auth.ts`:
    - Add Zod schemas & DTO types: `adminCreateStaffRequestSchema`, `adminUpdateStaffPermissionsRequestSchema`, `adminUpdateStaffStatusRequestSchema`, `adminHardDeleteStaffRequestSchema`, `adminUpdateUserStatusRequestSchema`, `adminHardDeleteUserRequestSchema`.
    - Update `AdminProfileDto` and `AdminStaffSummaryDto` to include `isActive: boolean`, `deletedAt?: string | null`, and `hasOperationalHistory?: boolean`.

- [x] **Task 2: Enhance `@RequirePermissions` Decorator, Guards & Legacy Role Checks (AC: 2)**
  - [x] 2.1 In `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`, export `RequirePermissions = RequireAdminPermission` so both `@RequirePermissions('Area.Action')` and `@RequireAdminPermission('Area.Action')` work identically.
  - [x] 2.2 Update `AdminSessionAuthGuard` (`apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`) to check `!session.admin.isActive || session.admin.deletedAt` (revoking session and throwing `ADMIN_ACCOUNT_DISABLED`) and compute `permissions: resolveAdminPermissions(session.admin.role as AdminRole, session.admin.permissions)`.
  - [x] 2.3 Update `AdminPermissionGuard` (`apps/api/src/modules/auth/guards/admin-permission.guard.ts`) to check `!admin?.id || !admin.isActive || admin.deletedAt`, and resolve effective permissions via `resolveAdminPermissions(admin.role as AdminRole, admin.permissions)`.
  - [x] 2.4 Update `AdminGeoGuard` (`apps/api/src/modules/geo/guards/admin-geo.guard.ts`), `AdminPhoneChangeController` (`apps/api/src/modules/auth/admin-phone-change.controller.ts`), and `AdminIdentityController` (`apps/api/src/modules/users/admin-identity.controller.ts`) to honor dynamic `admin.permissions` via `resolveAdminPermissions` in addition to role defaults.

- [x] **Task 3: Implement Staff RBAC Management & Guarded Deletion in `apps/api` (AC: 3, 4)**
  - [x] 3.1 Extend `AdminAuthService` (or create `AdminStaffService` wired into `AuthModule` and delegated from `AdminAuthService`) and add `AdminStaffController` at `/api/v1/admin/staff` (while keeping `GET /api/v1/admin/auth/staff` working):
    - `GET /api/v1/admin/staff` (`@RequirePermissions('Rbac.Manage')`): List all `AdminUser` records with resolved `permissions`, `isActive`, `deletedAt`, and computed `hasOperationalHistory`, plus `permissionGroups` and `rolePresets`.
    - `POST /api/v1/admin/staff` (`@RequirePermissions('Rbac.Manage')`): Create staff account with Argon2id password hash, normalized username/email uniqueness check, validated granular `permissions` array, and `AuditLog` (`ADMIN_STAFF_CREATED`).
    - `PATCH /api/v1/admin/staff/:adminId/permissions` (`@RequirePermissions('Rbac.Manage')`): Update `role`, `fullName`, and `permissions` with mandatory `reason`, block self-modification (`ADMIN_SELF_MODIFICATION_FORBIDDEN`), revoke active `AdminSession` rows, and log `ADMIN_PERMISSIONS_UPDATED` to `AuditLog`.
    - `POST /api/v1/admin/staff/:adminId/status` (`@RequirePermissions('Rbac.Manage')`): Enable, Disable, or Soft-Delete (`isActive = false`, `deletedAt = now`), block self-modification, revoke active `AdminSession` rows when disabling/soft-deleting, and log `ADMIN_STAFF_STATUS_CHANGED` / `ADMIN_STAFF_SOFT_DELETED` to `AuditLog`.
    - `DELETE /api/v1/admin/staff/:adminId` (`@RequirePermissions('Rbac.Manage')`): Count operational/audit history across `AuditLog` and domain tables; if `historyCount > 0`, throw `ConflictException` (`ADMIN_HARD_DELETE_HISTORY_EXISTS`) and log `ADMIN_STAFF_HARD_DELETE_BLOCKED`; otherwise delete `AdminUser` and log `ADMIN_STAFF_HARD_DELETED`.
  - [x] 3.2 Update `apps/api/prisma/seed.ts` so seeded staff accounts populate `permissions: ADMIN_ROLE_PERMISSIONS[role]` and `deletedAt: null`.

- [x] **Task 4: Implement Platform User Status & Guarded Hard-Delete Endpoints (AC: 5)**
  - [x] 4.1 Create `AdminUsersController` (`apps/api/src/modules/users/admin-users.controller.ts`) and `AdminUsersService` (`apps/api/src/modules/users/admin-users.service.ts`) registered in `UsersModule`:
    - `GET /api/v1/admin/users` (`@RequirePermissions('Users.View')`): Return platform users with `isActive`, `deletedAt`, and `transactionHistoryCount` (via `AccountDeletionService.countUserTransactionHistory` or direct counts).
    - `POST /api/v1/admin/users/:userId/status` (`@RequirePermissions('Users.Status')`): Enable, Disable, or Soft-Delete (`isActive`, `deletedAt`), revoke active `UserSession` records on disable/soft-delete, and write `AuditLog` (`ADMIN_USER_STATUS_CHANGED`).
    - `DELETE /api/v1/admin/users/:userId` (`@RequirePermissions('Users.HardDelete')`): Check `countUserTransactionHistory(userId)`; if `> 0`, block with `ConflictException` (`USER_HARD_DELETE_HISTORY_EXISTS`) and log `ADMIN_USER_HARD_DELETE_BLOCKED`; if `0`, hard-delete user and log `ADMIN_USER_HARD_DELETED`.

- [x] **Task 5: Build Back-Office Staff & Dynamic RBAC Management UI in `apps/web` (AC: 6)**
  - [x] 5.1 Create `apps/web/src/components/admin/admin-staff-management.tsx` (plus sub-modals or integrated modal views for Create Staff, Edit Granular Permissions Matrix, Status Toggle/Soft-Delete/Hard-Delete with mandatory reason, Password Reset link trigger, and Platform User Governance tab).
  - [x] 5.2 Create route page `apps/web/src/app/admin/staff/page.tsx` rendering `AdminStaffManagement`.
  - [x] 5.3 Update `apps/web/src/components/layout/workspace-shell.tsx` and `apps/web/src/app/admin/page.tsx` so Super Admins (`hasPermission('Rbac.Manage')`) have direct navigation to `/admin/staff` and can open the full RBAC workspace.

- [x] **Task 6: Write Unit & Component Tests and Verify Build (AC: 7)**
  - [x] 6.1 Update/add tests in `packages/shared/src/schemas/__tests__/auth.schema.spec.ts` for `ALL_ADMIN_PERMISSIONS`, `resolveAdminPermissions`, and the new RBAC/status Zod schemas.
  - [x] 6.2 Update/add tests in `apps/api/src/modules/auth/__tests__/admin-permission.guard.spec.ts`, `admin-auth.service.spec.ts`, and `apps/api/src/modules/users/__tests__/admin-users.service.spec.ts` covering dynamic permission overrides, `@RequirePermissions`, staff creation, permission updates, disable/soft-delete, and hard-delete history blocking (`ADMIN_HARD_DELETE_HISTORY_EXISTS` & `USER_HARD_DELETE_HISTORY_EXISTS`).
  - [x] 6.3 Add SSR component tests in `apps/web/src/components/admin/__tests__/admin-staff-management.spec.tsx` using `renderToString`.
  - [x] 6.4 Run `npm test`, `npm run lint`, and `npm run build` across the monorepo and verify 100% green execution.

## Dev Notes

### Architecture & Business Rule Guardrails
- **Granular Dynamic RBAC (`FR-40`, `AD-12`):**
  - While Story 8.1 introduced the 4 base `AdminRole` presets (`SUPER_ADMIN`, `MODERATOR`, `FINANCIAL_AUDITOR`, `COMPLIANCE_OFFICER`) and static role-to-permission lookup in `ADMIN_ROLE_PERMISSIONS`, Story 8.2 upgrades this to **dynamic per-account granular RBAC**.
  - Each `AdminUser` record now stores `permissions String[] @default([])`.
  - **Backward Compatibility Rule (CRITICAL):** Existing unit tests in `apps/api` construct mock `AdminUser` / `request.admin` objects without `permissions` or with `permissions: []`. Therefore, `resolveAdminPermissions(role, customPermissions)` **must** work as follows:
    - If `role === AdminRole.SUPER_ADMIN`: always return `ALL_ADMIN_PERMISSIONS` (unless explicitly testing non-super-admin).
    - If `Array.isArray(customPermissions) && customPermissions.length > 0`: return `customPermissions`.
    - Otherwise (when `customPermissions` is `undefined`, `null`, or `[]`): fall back to `ADMIN_ROLE_PERMISSIONS[role] ?? []`.
    - When a Super Admin explicitly saves custom permissions for a staff member via `PATCH /api/v1/admin/staff/:adminId/permissions`, at least one permission (or the selected list) is persisted to `AdminUser.permissions`.
- **Hard Deletion Prohibition When History Exists (`FR-43`, `BR-18`):**
  - Neither staff accounts (`AdminUser`) nor platform user accounts (`User`) may ever be hard-deleted (`DELETE`) if they have any audit or transactional history.
  - For `AdminUser`, check `prisma.auditLog.count({ where: { actorId: adminId } })` plus operational foreign keys (`Listing.reviewedByAdminId`, `Listing.complianceAdminId`, `Listing.lockedByAdminId`, `FalLicense.reviewedByAdminId`, `ContractTemplate.createdByAdminId`, `OfferHistory.actorAdminId`, `Deal.finalApprovedByAdminId`, `Payment.verifiedByAdminId`, `ContractFeePayment.verifiedByAdminId`, `Dispute.resolvedByAdminId`, `Rating.hiddenByAdminId`, `PriceSuggestion.suggestedByAdminId`, `InquiryMessage.relayedByAdminId`). If the sum is `> 0`, throw `ConflictException` (`409`) with `code: ADMIN_HARD_DELETE_HISTORY_EXISTS`.
  - For `User`, reuse `AccountDeletionService.countUserTransactionHistory(userId)` (`apps/api/src/modules/users/account-deletion.service.ts`) plus `AuditLog` / `InquiryThread` checks. If `> 0`, throw `ConflictException` (`409`) with `code: USER_HARD_DELETE_HISTORY_EXISTS`.
- **Time Authority (`ClockService`):**
  - Never use raw `new Date()` in application services for `deletedAt`, `revokedAt`, or audit timestamps — always use `this.clock.now()` via injected `ClockService`.
- **Response Envelope & RTL Arabic UI:**
  - All API responses wrap payloads in `{ data: ... }` and errors in standard `{ error: { code, message, details } }` with Arabic user-facing messages.
  - All frontend views in `apps/web` are RTL-first (`dir="rtl"`) and must use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`).
  - Frontend component tests in `apps/web` use `vitest` in `node` environment with `renderToString` from `react-dom/server` (do not use `@testing-library/react` DOM globals unless already configured).

### Key Existing Files to Inspect & Extend
- `apps/api/prisma/schema.prisma` (`AdminUser` model at line 336, `User` model at line 274)
- `packages/shared/src/constants/auth.ts` (`ADMIN_ROLE_PERMISSIONS`, error codes)
- `packages/shared/src/schemas/auth.schema.ts` & `packages/shared/src/types/auth.ts`
- `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`
- `apps/api/src/modules/auth/guards/admin-permission.guard.ts`
- `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`
- `apps/api/src/modules/auth/admin-auth.service.ts` & `apps/api/src/modules/auth/admin-auth.controller.ts`
- `apps/api/src/modules/users/account-deletion.service.ts` & `apps/api/src/modules/users/users.module.ts`
- `apps/web/src/components/providers/admin-auth-provider.tsx`
- `apps/web/src/app/admin/page.tsx` & `apps/web/src/components/layout/workspace-shell.tsx`

### Project Structure Notes
- Keep new staff RBAC endpoints under `apps/api/src/modules/auth/admin-staff.controller.ts` (or `admin-auth.controller.ts`) and platform user governance endpoints under `apps/api/src/modules/users/admin-users.controller.ts`.
- Keep new frontend components in `apps/web/src/components/admin/admin-staff-management.tsx` and route in `apps/web/src/app/admin/staff/page.tsx`.

### References
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 8.2: Granular Dynamic RBAC & Super Admin User Management`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-40`, `#FR-43`, `#BR-18`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5`, `#AD-12`, `#Admin Permission Matrix`]
- [Source: `_bmad-output/implementation-artifacts/8-1-isolated-admin-authentication-realm-password-reset.md`]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (BMAD Dev Agent)

### Debug Log References
- `npm test --workspace=@elmasaif/shared` (47 passed, 611 tests)
- `npm test --workspace=@elmasaif/api` (82 passed, 1003 tests)
- `npm test --workspace=@elmasaif/web` (81 passed, 463 tests)
- `npm run build:shared && npm run build:api && npm run build:web` (all succeeded, including `/admin/staff`)

### Completion Notes List
- Updated `AdminUser` (`permissions String[] @default([])`, `deletedAt DateTime?`) and `User` (`isActive Boolean @default(true)`, `deletedAt DateTime?`) in `apps/api/prisma/schema.prisma` and regenerated Prisma Client.
- Expanded `ADMIN_ROLE_PERMISSIONS` and added `ALL_ADMIN_PERMISSIONS`, `ADMIN_PERMISSION_GROUPS`, `resolveAdminPermissions(role, customPermissions)`, new RBAC/hard-delete error codes, and Zod schemas/DTOs in `@elmasaif/shared`.
- Exported `@RequirePermissions` alias alongside `@RequireAdminPermission`, enhanced `AdminSessionAuthGuard` and `AdminPermissionGuard` to enforce `isActive` and `deletedAt === null` and resolve dynamic `admin.permissions`, and updated `AdminGeoGuard`, `AdminPhoneChangeController`/`PhoneChangeService`, and `AdminIdentityController` to honor dynamic permissions.
- Implemented Super Admin staff lifecycle and RBAC management endpoints under `/api/v1/admin/staff` (`GET`, `POST`, `PATCH :adminId/permissions`, `POST :adminId/status`, `DELETE :adminId`) with Argon2id password hashing, immediate active session revocation on permission/status change, `AuditLog` snapshots, and `409 Conflict` (`ADMIN_HARD_DELETE_HISTORY_EXISTS`) when operational/audit history exists (`BR-18` / `FR-43`).
- Implemented platform user lifecycle and guarded deletion endpoints under `/api/v1/admin/users` (`GET`, `POST :userId/status`, `DELETE :userId`) blocking hard-delete with `409 Conflict` (`USER_HARD_DELETE_HISTORY_EXISTS`) when transaction history exists.
- Built RTL Arabic back-office UI `AdminStaffManagement`, `AdminCreateStaffModal`, and `AdminPermissionsModal` in `apps/web/src/components/admin/admin-staff-management.tsx`, route `/admin/staff`, and navigation links in `WorkspaceShell` and `/admin/page.tsx`.
- Added comprehensive unit and SSR component tests across `packages/shared`, `apps/api`, and `apps/web`.

### File List
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/schemas/__tests__/admin-auth.spec.ts`
- `packages/shared/src/schemas/__tests__/auth.schema.spec.ts`
- `apps/api/src/modules/auth/decorators/require-admin-permission.decorator.ts`
- `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`
- `apps/api/src/modules/auth/guards/admin-permission.guard.ts`
- `apps/api/src/modules/auth/admin-auth.service.ts`
- `apps/api/src/modules/auth/admin-staff.controller.ts`
- `apps/api/src/modules/auth/admin-phone-change.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/__tests__/admin-permission.guard.spec.ts`
- `apps/api/src/modules/auth/__tests__/admin-session-auth.guard.spec.ts`
- `apps/api/src/modules/auth/__tests__/admin-auth.service.spec.ts`
- `apps/api/src/modules/geo/admin-geo.controller.ts`
- `apps/api/src/modules/geo/guards/admin-geo.guard.ts`
- `apps/api/src/modules/users/admin-users.service.ts`
- `apps/api/src/modules/users/admin-users.controller.ts`
- `apps/api/src/modules/users/admin-phone-change.controller.ts`
- `apps/api/src/modules/users/phone-change.service.ts`
- `apps/api/src/modules/users/admin-identity.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/__tests__/admin-users.service.spec.ts`
- `apps/web/src/components/admin/admin-staff-management.tsx`
- `apps/web/src/app/admin/staff/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/components/admin/__tests__/admin-staff-management.spec.tsx`

## Change Log
- **2026-11-12**: Implemented Story 8.2 — Granular Dynamic RBAC & Super Admin User Management (`FR-40`, `FR-43`, `AD-5`, `AD-12`, `BR-18`).


