---
baseline_commit: 449e582fa421a58c9c0568ed447c9a0a6591474c
---

# Story 8.1: Isolated Admin Authentication Realm & Password Reset

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform administrator,
I want an isolated login portal with secure sessions and administrative password reset capabilities,
So that administrative operations are segregated from regular user traffic and protected against credential theft.

## Acceptance Criteria

1. **Isolated Admin Database Schema & Seed Data (`apps/api/prisma/schema.prisma` & `apps/api/prisma/seed.ts` per FR-39, FR-70, AD-5, AD-12):**
   - **Given** the PostgreSQL persistence layer managed via Prisma ORM
   - **When** modeling administrative staff and sessions in `apps/api/prisma/schema.prisma`
   - **Then** `AdminUser` (`@@map("admin_users")`) is completely segregated from `User` (`@@map("users")`) and includes:
     - `id`: UUID primary key
     - `username`: unique string
     - `email`: unique string
     - `fullName`: string
     - `passwordHash`: string (Argon2id hashed)
     - `role`: `AdminRole` (`SUPER_ADMIN`, `MODERATOR`, `FINANCIAL_AUDITOR`, `COMPLIANCE_OFFICER`)
     - `isActive`: boolean (`@default(true)`)
     - `lastLoginAt`: nullable `DateTime`
     - `failedLoginAttempts`: integer (`@default(0) @map("failed_login_attempts")`)
     - `lockedUntil`: nullable `DateTime` (`@map("locked_until")`)
     - `passwordResetTokenHash`: nullable string (`@map("password_reset_token_hash")`) for single-use reset enforcement
     - `passwordResetExpiresAt`: nullable `DateTime` (`@map("password_reset_expires_at")`)
   - **And** `AdminSession` (`@@map("admin_sessions")`) is completely segregated from `Session` (`@@map("sessions")`) and includes:
     - `id`: UUID primary key
     - `adminId`: foreign key referencing `AdminUser.id` (`onDelete: Cascade`)
     - `token`: unique 64-character hex session token
     - `ipAddress`: nullable string
     - `userAgent`: nullable string (`@map("user_agent")`)
     - `lastActivityAt`: `DateTime` (`@default(now()) @map("last_activity_at")`)
     - `expiresAt`: `DateTime`
     - `createdAt`: `DateTime` (`@default(now())`)
   - **And** `apps/api/prisma/seed.ts` seeds initial administrative accounts idempotently (`upsert` by `username`) with Argon2id password hashes (`AD-12`):
     - Default `SUPER_ADMIN` (`username: 'superadmin'`, `email: 'admin@elmasaif.sa'`, `fullName: 'المشرف العام - المصايف'`)
     - Default Support `MODERATOR` (`username: 'moderator'`, `email: 'moderator@elmasaif.sa'`, `fullName: 'مشرف العمليات'`)

2. **Isolated Admin Login, Brute-Force Lockout & Session Cookie Segregation (`apps/api` under `/api/v1/admin/auth` per FR-39, AD-5, NFR1, NFR4):**
   - **Given** a staff member authenticating via `POST /api/v1/admin/auth/login` with `{ identifier, password }`
   - **When** the credentials are submitted:
     - `identifier` is normalized (`trim().toLowerCase()`) and matched against `AdminUser.username` or `AdminUser.email`.
   - **Then** the endpoint enforces a strict **5-attempt, 15-minute brute-force lockout** (`FR-39`):
     - If `admin.lockedUntil` is in the future (`ClockService.now() < admin.lockedUntil`):
       - Rejects immediately with HTTP `423 Locked`, error code `ADMIN_ACCOUNT_LOCKED` ("تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة"), and `details: { lockedUntil, retryAfterSeconds }`.
       - Writes an immutable `AuditLog` record (`action: 'ADMIN_LOGIN_BLOCKED_LOCKOUT'`, `actorType: 'ADMIN'`, `entityType: 'AdminUser'`).
     - If `admin` does not exist:
       - Executes a constant-time dummy Argon2id verification to prevent timing-based account enumeration, and returns HTTP `401 Unauthorized` with `ADMIN_INVALID_CREDENTIALS` ("بيانات الدخول الإدارية غير صحيحة").
     - If `password` does not match `admin.passwordHash`:
       - Increments `failedLoginAttempts` by 1.
       - When `failedLoginAttempts >= 5`, sets `lockedUntil = ClockService.now() + 15 minutes`, records `AuditLog` (`action: 'ADMIN_ACCOUNT_LOCKED'`), and returns HTTP `423 Locked` (`ADMIN_ACCOUNT_LOCKED`).
       - When `failedLoginAttempts < 5`, records `AuditLog` (`action: 'ADMIN_LOGIN_FAILED'`) and returns HTTP `401 Unauthorized` (`ADMIN_INVALID_CREDENTIALS`).
     - If `!admin.isActive`:
       - Rejects with HTTP `403 Forbidden` and error code `ADMIN_ACCOUNT_DISABLED` ("حساب المشرف معطل من قبل الإدارة العليا") and records `AuditLog` (`action: 'ADMIN_LOGIN_BLOCKED_DISABLED'`).
   - **And** upon valid authentication of an active `AdminUser`:
     - Atomically resets `failedLoginAttempts = 0`, `lockedUntil = null`, sets `lastLoginAt = ClockService.now()`, creates an `AdminSession` record with `expiresAt = ClockService.now() + 8 hours` (`ADMIN_SESSION_INACTIVITY_MS = 28_800_000`), and writes an immutable `AuditLog` entry (`action: 'ADMIN_LOGIN_SUCCESS'`).
     - Issues the dedicated cookie `elmasaif_admin_session` (`ADMIN_SESSION_COOKIE_NAME`) with `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`, and `maxAge: 8 * 60 * 60 * 1000`.
     - **Realm Segregation Invariant:** A regular user session (`elmasaif_session`) is NEVER accepted by `AdminSessionAuthGuard`, and an admin session (`elmasaif_admin_session`) is NEVER accepted by user `SessionAuthGuard`.

3. **8-Hour Inactivity Session Timeout & Session Lifecycle Endpoints (`apps/api` per FR-39, AD-5):**
   - **Given** an authenticated administrator making requests guarded by `AdminSessionAuthGuard`
   - **When** `AdminSessionAuthGuard` validates the token from `req.cookies[ADMIN_SESSION_COOKIE_NAME]` or `Authorization: Bearer <token>`:
     - Queries `AdminSession` with `{ include: { admin: true } }`.
     - If the session does not exist, `!session.admin.isActive`, or `session.expiresAt <= ClockService.now()` (8 hours of inactivity elapsed):
       - Rejects with HTTP `401 Unauthorized` (`ADMIN_AUTH_REQUIRED`: "جلسة الإدارة غير صالحة أو منتهية الصلاحية").
     - If the session is valid and active:
       - Extends the sliding inactivity window by updating `lastActivityAt = ClockService.now()` and `expiresAt = ClockService.now() + 8 hours` (`ADMIN_SESSION_INACTIVITY_MS`).
       - Attaches `request.admin` containing `{ id, username, email, fullName, role, isActive, permissions }` and `request.adminSessionToken = token`.
   - **And** `GET /api/v1/admin/auth/me` (guarded by `AdminSessionAuthGuard`) returns HTTP `200 OK` with `{ code: 'ADMIN_SESSION_PROFILE', data: { admin } }` including the administrator's resolved permission array from the Admin Permission Matrix (`AD-12`).
   - **And** `POST /api/v1/admin/auth/logout` deletes the `AdminSession` record, clears the `elmasaif_admin_session` cookie, writes an `AuditLog` entry (`action: 'ADMIN_LOGOUT'`), and returns HTTP `200 OK` (`ADMIN_LOGOUT_SUCCESS`).

4. **Super Admin Password Reset Dispatch (`POST /api/v1/admin/auth/:adminId/reset-password/initiate` per FR-70, AD-5, AD-12):**
   - **Given** an authenticated Super Administrator with `Rbac.Manage` permission (`AdminRole.SUPER_ADMIN`)
   - **When** invoking `POST /api/v1/admin/auth/:adminId/reset-password/initiate` with `{ reason: string }` (validated via `adminInitiatePasswordResetSchema`, min 10 chars, max 500 chars):
   - **Then** the server enforces `Rbac.Manage` authorization:
     - Administrators without `Rbac.Manage` (e.g., `MODERATOR`, `FINANCIAL_AUDITOR`, `COMPLIANCE_OFFICER`) receive HTTP `403 Forbidden` (`AUTH_NOT_AUTHORIZED`).
   - **And** validates the target administrator account (`:adminId`):
     - If not found, returns HTTP `404 Not Found` (`ADMIN_NOT_FOUND`).
     - If `!targetAdmin.isActive`, returns HTTP `400 Bad Request` (`ADMIN_ACCOUNT_DISABLED`).
   - **And** generates a **single-use, time-limited reset token (15-minute expiry, `900` seconds)** (`FR-70`):
     - Direct temporary passwords are strictly prohibited (`AD-5`, `FR-70`).
     - Generates an HMAC-SHA256 signed token encoding `{ adminId: targetAdmin.id, email: targetAdmin.email, nonce: randomBytes(16).toString('hex'), exp: ClockService.now().getTime() + 900_000 }`.
     - Computes the SHA-256 digest of the token (`tokenHash`) and atomically inside `prisma.$transaction`:
       1. Stores `passwordResetTokenHash = tokenHash` and `passwordResetExpiresAt = ClockService.now() + 15 minutes` on `targetAdmin`.
       2. **Immediately revokes all existing active sessions** for `targetAdmin` (`tx.adminSession.deleteMany({ where: { adminId: targetAdmin.id } })`).
       3. Writes an immutable `AuditLog` record (`FR-70`):
          - `actorId: req.admin.id`
          - `actorType: 'ADMIN'`
          - `action: 'ADMIN_PASSWORD_RESET_INITIATED'`
          - `entityType: 'AdminUser'`
          - `entityId: targetAdmin.id`
          - `ipAddress: req.ip`
          - `payload: { targetAdminEmail: targetAdmin.email, targetAdminUsername: targetAdmin.username, reason: body.reason, expiresInSeconds: 900, activeSessionsRevoked: true }`
   - **And** dispatches the password reset email containing `/admin/reset-password?token=<token>` via `EmailTransportService` (delivering to SMTP / Mailpit in local/prod environments and structured log output).
   - **And** returns HTTP `200 OK` with code `ADMIN_RESET_DISPATCHED`.

5. **Single-Use Admin Password Reset Completion (`POST /api/v1/admin/auth/reset-password/confirm` per FR-70, AD-5):**
   - **Given** an administrator opening a password reset link and submitting `{ token, newPassword }` to `POST /api/v1/admin/auth/reset-password/confirm`
   - **When** the server validates the request via `adminCompletePasswordResetSchema`:
   - **Then** the server verifies cryptographic integrity, 15-minute expiration (`ClockService.now()`), and single-use state:
     - If token signature is invalid or malformed, rejects with HTTP `400 Bad Request` (`ADMIN_RESET_TOKEN_INVALID`).
     - If `ClockService.now() > payload.exp` or `ClockService.now() > admin.passwordResetExpiresAt`, rejects with HTTP `400 Bad Request` (`ADMIN_RESET_TOKEN_EXPIRED`: "انتهت صلاحية رابط إعادة تعيين كلمة المرور الإدارية (15 دقيقة)").
     - If `!admin.passwordResetTokenHash` or `sha256(token) !== admin.passwordResetTokenHash` (token was already used or superseded by a newer reset link), rejects with HTTP `400 Bad Request` (`ADMIN_RESET_TOKEN_INVALID`: "رابط إعادة تعيين كلمة المرور غير صالح أو تم استخدامه مسبقاً").
     - If `!admin.isActive`, rejects with HTTP `403 Forbidden` (`ADMIN_ACCOUNT_DISABLED`).
   - **And** verifies that `newPassword` is not identical to the administrator's current password (`argon2.verify(admin.passwordHash, newPassword)`):
     - If identical, rejects with HTTP `400 Bad Request` (`AUTH_PASSWORD_SAME_AS_CURRENT`: "كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية").
   - **And** executes the password update atomically inside `prisma.$transaction`:
     1. Hashes `newPassword` using Argon2id (`argon2.hash(newPassword, { type: argon2.argon2id })`).
     2. Updates `AdminUser`: sets `passwordHash = newHash`, clears `passwordResetTokenHash = null` and `passwordResetExpiresAt = null` (guaranteeing single-use), and resets `failedLoginAttempts = 0` and `lockedUntil = null`.
     3. Revokes any active sessions for `admin.id` (`tx.adminSession.deleteMany({ where: { adminId: admin.id } })`).
     4. Writes an immutable `AuditLog` record:
        - `actorId: admin.id`
        - `actorType: 'ADMIN'`
        - `action: 'ADMIN_PASSWORD_RESET_COMPLETED'`
        - `entityType: 'AdminUser'`
        - `entityId: admin.id`
        - `ipAddress: req.ip`
        - `payload: { sessionsRevoked: true }`
   - **And** returns HTTP `200 OK` with `ADMIN_PASSWORD_RESET_SUCCESS`.

6. **Isolated Admin Portal UI: Login, Reset Password & Super Admin Reset Modal (`apps/web` under `/admin/*` per FR-39, FR-70, DESIGN.md, EXPERIENCE.md):**
   - **Given** staff accessing `/admin/*` routes in `apps/web`
   - **When** rendering the administrative presentation layer:
     - **Admin Auth Context (`apps/web/src/components/providers/admin-auth-provider.tsx`):**
       - Provides `useAdminAuth()` hook managing isolated `admin: AdminSessionUser | null`, `isLoading`, `login`, `logout`, `refreshAdminSession`, and `setSessionAdmin` against `/api/v1/admin/auth/*`.
     - **Admin Login Page (`/admin/login`):**
       - Renders an executive RTL-first back-office login interface (`AdminLoginForm`) with Sovereign Emerald authority styling (`#1B4332`), institutional security notice, username/email input, password input with show/hide toggle, 15-minute lockout countdown banner on `423 Locked`, and notice that password recovery requires a Super Administrator (`Rbac.Manage`) dispatch.
     - **Admin Password Reset Page (`/admin/reset-password`):**
       - Reads `?token=` query parameter and renders `AdminResetPasswordForm` with live password complexity indicators (8+ chars, letter, number, confirmation match), error handling for expired/used tokens, and a completion milestone card linking to `/admin/login`.
     - **Super Admin Password Reset Dispatch Modal (`apps/web/src/components/admin/admin-password-reset-modal.tsx`) & `/admin` Operations Landing Page (`apps/web/src/app/admin/page.tsx`):**
       - Provides the Level 3 modal (`DESIGN.md#8`) allowing a Super Admin (`Rbac.Manage`) to enter a mandatory justification reason (10–500 chars) and dispatch a 15-minute single-use password reset link to an administrator account, with immediate feedback toast/banner.
       - Updates `WorkspaceShell` (`apps/web/src/components/layout/workspace-shell.tsx`) and `apps/web/src/app/admin/layout.tsx` so `/admin/login` and `/admin/reset-password` render cleanly as standalone auth screens while `/admin/*` workspace pages display the authenticated admin's name, role badge, and admin logout trigger.

7. **Automated Verification & Quality Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** executing `npm test`, `npm run lint`, and `npm run build`
   - **Then** 100% of unit and integration tests pass with zero regressions:
     - `packages/shared`: Vitest unit tests (`admin-auth.spec.ts`) covering `adminLoginSchema`, `adminInitiatePasswordResetSchema`, `adminCompletePasswordResetSchema`, and `adminSessionUserSchema`.
     - `apps/api`: Jest unit tests (`admin-auth.service.spec.ts`, `admin-auth.controller.spec.ts`, `admin-session-auth.guard.spec.ts`) covering:
       - Valid admin login, session creation (+8h expiry), and `AuditLog` creation.
       - 5 consecutive failed login attempts triggering 15-minute lockout (`423 Locked`, `ADMIN_ACCOUNT_LOCKED`).
       - Constant-time anti-enumeration on unknown admin identifier.
       - Disabled admin rejection (`403 Forbidden`, `ADMIN_ACCOUNT_DISABLED`).
       - 8-hour inactivity session expiration and sliding window renewal in `AdminSessionAuthGuard`.
       - Super Admin (`Rbac.Manage`) initiating password reset with mandatory reason, revoking target admin sessions, dispatching email via `EmailTransportService`, and logging `ADMIN_PASSWORD_RESET_INITIATED`.
       - Non-Super Admin (`MODERATOR`) blocked from initiating password reset (`403 Forbidden`, `AUTH_NOT_AUTHORIZED`).
       - Completing password reset within 15 minutes, rejecting reuse of the same single-use token, rejecting expired tokens, and rejecting `newPassword` identical to current password (`AUTH_PASSWORD_SAME_AS_CURRENT`).
     - `apps/web`: Vitest SSR component tests (`admin-login-form.spec.tsx`, `admin-reset-password-form.spec.tsx`, `admin-password-reset-modal.spec.tsx`) using `renderToString` from `react-dom/server`.
     - Full monorepo `npm run lint` and `npm run build` succeed with 0 errors.

## Tasks / Subtasks

- [x] Task 1: Shared Admin Auth Constants, Schemas & Types (`packages/shared`) (AC: 2, 3, 4, 5, 7)
  - [x] 1.1 In `packages/shared/src/constants/auth.ts`:
    - Add admin session and security constants:
      - `ADMIN_SESSION_INACTIVITY_HOURS = 8`
      - `ADMIN_SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000`
      - `ADMIN_LOGIN_MAX_FAILED_ATTEMPTS = 5`
      - `ADMIN_LOGIN_LOCKOUT_MINUTES = 15`
      - `ADMIN_PASSWORD_RESET_EXPIRY_SECONDS = 900`
    - Add admin auth error and status codes:
      - `ADMIN_INVALID_CREDENTIALS = 'ADMIN_INVALID_CREDENTIALS'`
      - `ADMIN_ACCOUNT_LOCKED = 'ADMIN_ACCOUNT_LOCKED'`
      - `ADMIN_ACCOUNT_DISABLED = 'ADMIN_ACCOUNT_DISABLED'`
      - `ADMIN_LOGIN_SUCCESS = 'ADMIN_LOGIN_SUCCESS'`
      - `ADMIN_LOGOUT_SUCCESS = 'ADMIN_LOGOUT_SUCCESS'`
      - `ADMIN_SESSION_PROFILE = 'ADMIN_SESSION_PROFILE'`
      - `ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND'`
      - `ADMIN_RESET_DISPATCHED = 'ADMIN_RESET_DISPATCHED'`
      - `ADMIN_RESET_TOKEN_INVALID = 'ADMIN_RESET_TOKEN_INVALID'`
      - `ADMIN_RESET_TOKEN_EXPIRED = 'ADMIN_RESET_TOKEN_EXPIRED'`
      - `ADMIN_PASSWORD_RESET_SUCCESS = 'ADMIN_PASSWORD_RESET_SUCCESS'`
    - Export `ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]>` mapping `AdminRole` values to the canonical permission keys from `ARCHITECTURE-SPINE.md#Admin Permission Matrix` (ensuring `SUPER_ADMIN` includes `'Rbac.Manage'`, `'Geo.Manage'`, `'Tasks.ForceUnlock'`, etc.).
  - [x] 1.2 In `packages/shared/src/schemas/auth.schema.ts`:
    - Define `adminLoginSchema`:
      - `identifier`: `z.string().trim().min(3, 'اسم المستخدم أو البريد الإلكتروني مطلوب').transform((val) => val.toLowerCase())`
      - `password`: `z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات')`
    - Define `adminInitiatePasswordResetSchema`:
      - `reason`: `z.string().trim().min(10, 'سبب إعادة تعيين كلمة المرور الإدارية مطلوب (10 أحرف على الأقل)').max(500, 'السبب يجب ألا يتجاوز 500 حرف')`
    - Define `adminCompletePasswordResetSchema`:
      - `token`: `z.string().trim().min(1, 'رمز إعادة تعيين كلمة المرور مطلوب')`
      - `newPassword`: `passwordComplexitySchema`
    - Define `adminSessionUserSchema`:
      - `id: z.string()`, `username: z.string()`, `email: z.string()`, `fullName: z.string()`, `role: z.nativeEnum(AdminRole)`, `isActive: z.boolean()`, `lastLoginAt: z.union([z.date(), z.string()]).nullable().optional()`, `permissions: z.array(z.string()).default([])`.
  - [x] 1.3 In `packages/shared/src/types/auth.ts`:
    - Export inferred types `AdminLoginInput`, `AdminInitiatePasswordResetInput`, `AdminCompletePasswordResetInput`, `AdminSessionUser` and response interfaces `AdminLoginResponse`, `AdminSessionResponse`, `AdminInitiatePasswordResetResponse`, `AdminCompletePasswordResetResponse`.
  - [x] 1.4 Create unit tests in `packages/shared/src/schemas/__tests__/admin-auth.spec.ts` and verify with `npm test -w packages/shared`.

- [x] Task 2: Prisma Schema Update & Default Admin Seed (`apps/api/prisma`) (AC: 1)
  - [x] 2.1 Update `model AdminUser` in `apps/api/prisma/schema.prisma`:
    - Add `failedLoginAttempts Int @default(0) @map("failed_login_attempts")`
    - Add `lockedUntil DateTime? @map("locked_until")`
    - Add `passwordResetTokenHash String? @map("password_reset_token_hash")`
    - Add `passwordResetExpiresAt DateTime? @map("password_reset_expires_at")`
  - [x] 2.2 Update `model AdminSession` in `apps/api/prisma/schema.prisma`:
    - Add `userAgent String? @map("user_agent")`
    - Add `lastActivityAt DateTime @default(now()) @map("last_activity_at")`
  - [x] 2.3 Run `npx --workspace=apps/api prisma generate` (and create SQL migration / sync schema) so `@prisma/client` types include the new fields.
  - [x] 2.4 Update `apps/api/prisma/seed.ts` to seed initial `SUPER_ADMIN` and `MODERATOR` accounts in `admin_users` using Argon2id hashing.

- [x] Task 3: Backend Email Transport, AdminSessionAuthGuard & AdminAuthService (`apps/api/src/modules/auth`) (AC: 2, 3, 4, 5)
  - [x] 3.1 Create `apps/api/src/modules/auth/email/email-transport.service.ts`:
    - Implement `sendEmail(options: { to: string; subject: string; text: string; html?: string })` and `sendAdminPasswordResetEmail(params: { to: string; fullName: string; resetUrl: string; expiresInMinutes: number })`.
    - Support SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`) with structured logger recording and graceful non-blocking fallback in test environments.
  - [x] 3.2 Update `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`:
    - Enforce 8-hour inactivity expiration (`session.expiresAt <= this.clockService.now()`).
    - On valid request, slide `expiresAt` to `new Date(now.getTime() + ADMIN_SESSION_INACTIVITY_MS)` and `lastActivityAt = now` via `await this.prisma.adminSession.update?.({ where: { id: session.id }, data: { lastActivityAt: now, expiresAt: newExpiresAt } })` (keep `?.` optional chaining so existing unit tests mocking only `findUnique` remain green).
    - Attach `permissions: ADMIN_ROLE_PERMISSIONS[session.admin.role as AdminRole] || []` and `request.adminSessionToken = token` onto `request.admin` / `request`.
  - [x] 3.3 Create `apps/api/src/modules/auth/admin-auth.service.ts`:
    - Implement `login(dto: AdminLoginInput, ip: string, userAgent: string)` with 5-attempt / 15-minute lockout (`423 Locked`), constant-time dummy Argon2id check on missing user, `isActive` check, 8-hour session creation, and `AuditLog` entries.
    - Implement `logout(token: string, adminId?: string, ip?: string)`.
    - Implement `getMe(adminId: string)`.
    - Implement `listAdminsForSuperAdmin(actorRole: AdminRole)` (returns safe list of `AdminUser` summaries `{ id, username, email, fullName, role, isActive, lastLoginAt }` for `SUPER_ADMIN` to select when dispatching password resets).
    - Implement `initiatePasswordReset(actorAdminId: string, actorRole: AdminRole, targetAdminId: string, dto: AdminInitiatePasswordResetInput, ip: string)`:
      - Verify `actorRole === AdminRole.SUPER_ADMIN` (`Rbac.Manage`).
      - Generate HMAC-SHA256 signed token with 15-minute expiry (`900s`) and unique `nonce`.
      - Store SHA-256 `passwordResetTokenHash` and `passwordResetExpiresAt` on `AdminUser`.
      - Delete all active `AdminSession` records for `targetAdminId`.
      - Create `AuditLog` (`action: 'ADMIN_PASSWORD_RESET_INITIATED'`, including `reason`).
      - Dispatch reset link `/admin/reset-password?token=${token}` via `EmailTransportService`.
    - Implement `completePasswordReset(dto: AdminCompletePasswordResetInput, ip: string, userAgent: string)`:
      - Verify HMAC signature, 15-minute expiration, and match against `admin.passwordResetTokenHash`.
      - Reject if `newPassword` matches current `admin.passwordHash` (`AUTH_PASSWORD_SAME_AS_CURRENT`).
      - Hash `newPassword` with Argon2id, clear `passwordResetTokenHash = null` and `passwordResetExpiresAt = null`, reset `failedLoginAttempts = 0` and `lockedUntil = null`, revoke all `AdminSession` rows for `admin.id`, and record `AuditLog` (`action: 'ADMIN_PASSWORD_RESET_COMPLETED'`).

- [x] Task 4: Backend AdminAuthController & Module Wiring (`apps/api/src/modules/auth`) (AC: 2, 3, 4, 5, 7)
  - [x] 4.1 Create `apps/api/src/modules/auth/admin-auth.controller.ts` under `@Controller('admin/auth')`:
    - `POST /admin/auth/login`: sets `elmasaif_admin_session` cookie (`httpOnly: true`, `sameSite: 'lax'`, `maxAge: ADMIN_SESSION_INACTIVITY_MS`).
    - `POST /admin/auth/logout`: clears `elmasaif_admin_session` cookie and revokes session.
    - `GET /admin/auth/me`: guarded by `AdminSessionAuthGuard`, refreshes cookie `maxAge` and returns `admin` profile with permissions.
    - `GET /admin/auth/staff`: guarded by `AdminSessionAuthGuard`, returns staff list for `SUPER_ADMIN` (`Rbac.Manage`).
    - `POST /admin/auth/:adminId/reset-password/initiate`: guarded by `AdminSessionAuthGuard`, validates `adminInitiatePasswordResetSchema`, triggers 15-minute single-use email reset link.
    - `POST /admin/auth/reset-password/confirm`: public token-authenticated endpoint, validates `adminCompletePasswordResetSchema`, completes password reset.
  - [x] 4.2 Register `AdminAuthController`, `AdminAuthService`, `AdminSessionAuthGuard`, and `EmailTransportService` in `apps/api/src/modules/auth/auth.module.ts` and export `AdminSessionAuthGuard`, `AdminAuthService`, and `EmailTransportService`.
  - [x] 4.3 Author unit tests in `apps/api/src/modules/auth/__tests__/admin-auth.service.spec.ts`, `apps/api/src/modules/auth/__tests__/admin-auth.controller.spec.ts`, and update `apps/api/src/modules/auth/__tests__/admin-session-auth.guard.spec.ts`.

- [x] Task 5: Frontend Isolated Admin Auth Provider, Login, Password Reset & Super Admin Dispatch UI (`apps/web`) (AC: 6, 7)
  - [x] 5.1 Create `apps/web/src/components/providers/admin-auth-provider.tsx`:
    - Provide `AdminAuthProvider` and `useAdminAuth()` hook communicating exclusively with `/admin/auth/me` and `/admin/auth/logout`.
  - [x] 5.2 Create `apps/web/src/components/admin/admin-login-form.tsx` and `apps/web/src/app/admin/login/page.tsx`:
    - Implement RTL executive login card with username/email and password inputs, password visibility toggle, 15-minute lockout countdown alert banner (`423 Locked`), 8-hour inactivity notice, and Super Admin password recovery instruction.
  - [x] 5.3 Create `apps/web/src/components/admin/admin-reset-password-form.tsx` and `apps/web/src/app/admin/reset-password/page.tsx`:
    - Read `token` query param, render new password + confirmation inputs with live 4-item complexity checklist, submit to `/admin/auth/reset-password/confirm`, and display success milestone or error state.
  - [x] 5.4 Create `apps/web/src/components/admin/admin-password-reset-modal.tsx` and `apps/web/src/app/admin/page.tsx`:
    - Build `AdminPasswordResetModal` for Super Admins (`Rbac.Manage`) with mandatory `reason` field (10–500 chars), session revocation warning banner, and submission to `/admin/auth/:adminId/reset-password/initiate`.
    - Create `/admin/page.tsx` back-office operations overview & security realm card showing active admin session details, 8-hour inactivity policy badge, quick link to `/admin/geo`, and staff password reset trigger for `SUPER_ADMIN`.
  - [x] 5.5 Update `apps/web/src/app/admin/layout.tsx` and `apps/web/src/components/layout/workspace-shell.tsx`:
    - Wrap `/admin` routes in `AdminAuthProvider`. Render `/admin/login` and `/admin/reset-password` without the workspace sidebar; render authenticated `/admin/*` pages inside `WorkspaceShell` with `/admin` ("لوحة تحكم المشرف") and `/admin/geo` ("إدارة المدن والأحياء") navigation items.
  - [x] 5.6 Author Vitest SSR unit tests in `apps/web/src/components/admin/__tests__/admin-login-form.spec.tsx`, `apps/web/src/components/admin/__tests__/admin-reset-password-form.spec.tsx`, and `apps/web/src/components/admin/__tests__/admin-password-reset-modal.spec.tsx`.

- [x] Task 6: Full Monorepo Verification & Quality Gates (AC: 7)
  - [x] 6.1 Run shared tests: `npm test -w packages/shared`
  - [x] 6.2 Run API tests: `npm test -w apps/api`
  - [x] 6.3 Run Web tests: `npm test -w apps/web`
  - [x] 6.4 Run linter across all workspaces: `npm run lint`
  - [x] 6.5 Run production build across all workspaces: `npm run build`

## Dev Notes

### Architecture Compliance & Security Guardrails

- **AD-5 Dual-Realm Authentication Architecture (`FR-39`):**
  - Regular users (`Buyer`, `Marketer`, `Owner`) and administrative staff (`AdminUser`) MUST remain strictly isolated across database tables (`users` vs `admin_users`), session tables (`sessions` vs `admin_sessions`), cookies (`elmasaif_session` vs `elmasaif_admin_session`), API route prefixes (`/api/v1/auth` vs `/api/v1/admin/auth`), and NestJS guards (`SessionAuthGuard` vs `AdminSessionAuthGuard`).
  - Passwords are hashed exclusively with **Argon2id** (`argon2.hash(password, { type: argon2.argon2id })`).
  - All time calculations (lockout windows, 8-hour session inactivity expiry, 15-minute reset token expiry) MUST use `this.clockService.now()` — never `new Date()` or `Date.now()` (`AD-11`, `NFR14`).
- **8-Hour Inactivity Session Timeout (`FR-39`):**
  - Unlike regular user sessions (30-day rolling expiry), administrative sessions expire after **8 hours of inactivity** (`ADMIN_SESSION_INACTIVITY_HOURS = 8`).
  - Every authenticated request passing through `AdminSessionAuthGuard` checks `session.expiresAt <= this.clockService.now()` and, if valid, slides `expiresAt` forward by 8 hours from `this.clockService.now()`.
- **Administrative Password Reset Guardrails (`FR-70`, `AD-5`, `AD-12`):**
  - **No Temporary Passwords:** Super Admins cannot set or view temporary passwords for staff accounts. They can only trigger a single-use, 15-minute reset link sent to the administrator's registered email address.
  - **Permission Requirement:** Only an authenticated administrator with `Rbac.Manage` (`AdminRole.SUPER_ADMIN`) can initiate an administrative password reset.
  - **Single-Use Enforcement:** Storing the SHA-256 hash of the active reset token in `AdminUser.passwordResetTokenHash` and clearing it to `null` inside the transaction when consumed guarantees the link can only be used once, and generating a new link immediately invalidates any prior link.
  - **Immediate Session Revocation:** All active `AdminSession` records for the target administrator are deleted both when the reset is initiated AND when the new password is confirmed.
  - **Mandatory Audit Trail:** Both initiation (`ADMIN_PASSWORD_RESET_INITIATED` with mandatory `reason`) and completion (`ADMIN_PASSWORD_RESET_COMPLETED`) write immutable entries to `AuditLog`.

### Existing Codebase Intelligence (Files Being Modified)

1. `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`:
   - **Current State:** Reads `request.cookies?.[ADMIN_SESSION_COOKIE_NAME]` or Bearer token, queries `prisma.adminSession.findUnique({ where: { token }, include: { admin: true } })`, checks `!session || session.expiresAt <= this.clockService.now() || !session.admin.isActive`, and populates `request.admin = { id, username, email, fullName, role, isActive }`.
   - **What this story changes:** Adds sliding 8-hour inactivity renewal (`await this.prisma.adminSession.update?.({ where: { id: session.id }, data: { lastActivityAt: now, expiresAt: newExpiresAt } })`), attaches `permissions` array to `request.admin`, and stores `request.adminSessionToken = token`.
   - **Critical Preservation:** Keep `?.` optional chaining on `this.prisma.adminSession.update?.(...)` and only invoke it if `session.id` is defined or `update` is a function on `this.prisma.adminSession`, so existing unit tests in `admin-session-auth.guard.spec.ts` (and `admin-geo.controller.spec.ts`, `admin-phone-change.controller.spec.ts`) that mock `prisma.adminSession = { findUnique: jest.fn() }` continue to pass without modification!

2. `apps/api/src/modules/auth/auth.module.ts`:
   - **Current State:** Imports `PrismaModule`, `ClockModule`; registers `AuthController`, `AuthService`, `OtpService`, `SessionAuthGuard`, `StaticOtpProvider`, `SmsOtpProvider`.
   - **What this story changes:** Registers and exports `AdminAuthController`, `AdminAuthService`, `AdminSessionAuthGuard`, and `EmailTransportService`.

3. `apps/web/src/app/admin/layout.tsx`:
   - **Current State:** Wraps children directly in `<WorkspaceShell>{children}</WorkspaceShell>`.
   - **What this story changes:** Wraps `/admin/*` in `<AdminAuthProvider>`, renders `/admin/login` and `/admin/reset-password` without `WorkspaceShell` chrome, and renders authenticated `/admin/*` pages inside `WorkspaceShell`.
   - **Critical Preservation:** Existing SSR unit tests in `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx` render `<AdminGeoPage />` directly and must continue passing 100%.

4. `apps/web/src/components/layout/workspace-shell.tsx`:
   - **Current State:** `roleNavItems[UserRole.ADMIN]` has `/admin/dashboard` and `/admin/geo`.
   - **What this story changes:** Updates `/admin/dashboard` href to `/admin` (or supports both `/admin` and `/admin/geo`) and displays admin identity in the sidebar when on `/admin/*` routes.

### Testing Standards & Framework Notes

- **`packages/shared`:** Uses **Vitest** (`npm test -w packages/shared`).
- **`apps/api`:** Uses **Jest** (`npm test -w apps/api`). Always mock `PrismaService` and `ClockService`.
- **`apps/web`:** Uses **Vitest** (`npm test -w apps/web`) with `renderToString` from `react-dom/server`. **IMPORTANT:** `@testing-library/react` is NOT installed in `apps/web/package.json`. Always write component tests using `renderToString(React.createElement(...))` following the exact pattern in `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx` and `apps/web/src/components/auth/__tests__/forgot-password-form.spec.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1: Isolated Admin Authentication Realm & Password Reset]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-39: Isolated Admin Realm & Authentication]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-70: Administrative Password Reset]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-12 — Granular Dynamic RBAC, Administrative Permission Matrix & Separation of Duties]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Admin Back-Office (`/admin/*`)]
- [Source: _bmad-output/implementation-artifacts/1-2-returning-user-login-session-handling-lockout.md]
- [Source: _bmad-output/implementation-artifacts/1-6-password-recovery-authenticated-password-change.md]
- [Source: _bmad-output/implementation-artifacts/2-1-geographic-master-data-administration-cascading-dropdown.md]

## Dev Agent Record

### Agent Model Used

Gemini 4 Argon (Medium)

### Debug Log References

- Analyzed `epics.md` (Epic 8 & Story 8.1), `prd.md` (FR-39, FR-45, FR-70), `ARCHITECTURE-SPINE.md` (AD-5, AD-11, AD-12, Admin Permission Matrix), `DESIGN.md`, and `EXPERIENCE.md`.
- Inspected existing `AdminUser` and `AdminSession` models in `apps/api/prisma/schema.prisma`, `AdminSessionAuthGuard` in `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`, `AuthService` lockout/reset patterns from Stories 1.2, 1.6, and 1.8, and `/admin/geo` layout/testing patterns from Story 2.1.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created for Story 8.1 (`8-1-isolated-admin-authentication-realm-password-reset`).
- Implemented shared admin authentication constants (`ADMIN_SESSION_INACTIVITY_HOURS = 8`, `ADMIN_LOGIN_MAX_FAILED_ATTEMPTS = 5`, `ADMIN_LOGIN_LOCKOUT_MINUTES = 15`, `ADMIN_PASSWORD_RESET_EXPIRY_SECONDS = 900`, `ADMIN_ROLE_PERMISSIONS`), Zod schemas (`adminLoginSchema`, `adminInitiatePasswordResetSchema`, `adminCompletePasswordResetSchema`, `adminSessionUserSchema`), and TypeScript types in `packages/shared`.
- Updated Prisma `AdminUser` and `AdminSession` models with brute-force lockout counters (`failedLoginAttempts`, `lockedUntil`), single-use reset token fields (`passwordResetTokenHash`, `passwordResetExpiresAt`), and session activity tracking (`userAgent`, `lastActivityAt`), plus idempotent Argon2id seed accounts in `apps/api/prisma/seed.ts`.
- Implemented `EmailTransportService`, updated `AdminSessionAuthGuard` with 8-hour sliding inactivity renewal and resolved RBAC permissions, and created `AdminAuthService` & `AdminAuthController` under `/api/v1/admin/auth` enforcing 5-attempt/15-minute lockout (`423 Locked`), constant-time anti-enumeration, Super Admin (`Rbac.Manage`) 15-minute single-use password reset initiation with immediate session revocation, single-use reset completion, and immutable `AuditLog` entries.
- Implemented isolated frontend admin auth realm (`AdminAuthProvider`, `AdminLoginForm`, `AdminResetPasswordForm`, `AdminPasswordResetModal`, `/admin`, `/admin/login`, `/admin/reset-password`, and `WorkspaceShell` integration).
- Added and verified unit tests across `packages/shared` (17 suites / 192 tests passing), `apps/api` (38 suites / 352 tests passing), and `apps/web` (29 suites / 108 tests passing) with 0 ESLint errors.

### Change Log

- 2026-11-03: Implemented Story 8.1 — Isolated Admin Authentication Realm & Password Reset across `packages/shared`, `apps/api`, and `apps/web`.

### File List

- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/auth.schema.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/schemas/__tests__/admin-auth.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/modules/auth/email/email-transport.service.ts`
- `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`
- `apps/api/src/modules/auth/admin-auth.service.ts`
- `apps/api/src/modules/auth/admin-auth.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/__tests__/admin-session-auth.guard.spec.ts`
- `apps/api/src/modules/auth/__tests__/admin-auth.service.spec.ts`
- `apps/api/src/modules/auth/__tests__/admin-auth.controller.spec.ts`
- `apps/web/src/components/providers/admin-auth-provider.tsx`
- `apps/web/src/components/admin/admin-login-form.tsx`
- `apps/web/src/components/admin/admin-reset-password-form.tsx`
- `apps/web/src/components/admin/admin-password-reset-modal.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/admin/reset-password/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/components/admin/__tests__/admin-login-form.spec.tsx`
- `apps/web/src/components/admin/__tests__/admin-reset-password-form.spec.tsx`
- `apps/web/src/components/admin/__tests__/admin-password-reset-modal.spec.tsx`
- `_bmad-output/implementation-artifacts/8-1-isolated-admin-authentication-realm-password-reset.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

