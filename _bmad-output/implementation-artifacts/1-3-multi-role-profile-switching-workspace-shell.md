---
baseline_commit: 70b878fd961051eb40c213d39b53ab3d1cba6fb8
---

# Story 1.3: Multi-Role Profile Switching & Workspace Shell

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to attach multiple role profiles (Buyer, Marketer, Owner) to my account and switch workspaces seamlessly,
So that I can perform different real estate market activities without logging out and back in.

## Acceptance Criteria

1. **Multi-Role Profile Attachment & Eligibility Engine (`apps/api` & `packages/shared` per FR-3, UJ-2, UJ-3):**
   - **Given** an authenticated user
   - **When** managing role profiles:
     - **Buyer Role (`UserRole.BUYER`):** Automatically attached to every user upon registration and remains permanently available.
     - **Owner Role (`UserRole.OWNER`):** Adding the `Owner` profile is instantaneous for any registered user. Submitting `POST /api/v1/users/profiles/attach-owner` or attempting to switch to `OWNER` when unattached creates a `UserProfile` record (`userId: user.id`, `role: UserRole.OWNER`, `status: ProfileStatus.ACTIVE`) without requiring prior administrative approval or fees.
     - **Marketer Role (`UserRole.MARKETER`):** Adding/switching to the `Marketer` role strictly requires a verified Fal license (`FalLicense`). If no `UserProfile` with `role: UserRole.MARKETER` exists, or if its `status` is not `ProfileStatus.ACTIVE` (e.g. `UNDER_REVIEW`, `SUSPENDED`, or `COMPLIANCE_RESTRICTED`), switching to `MARKETER` is strictly prohibited. The system rejects the request with HTTP 403 Forbidden and error code `AUTH_MARKETER_NOT_APPROVED` ("يتطلب التبديل لحساب مسوق وجود رخصة فال معتمدة وفعالة").
   - **And** an endpoint `GET /api/v1/users/profiles` returns:
     - `activeRole`: currently selected role on the user's active session (`BUYER`, `OWNER`, or `MARKETER`)
     - `profiles`: array of all attached user profiles (`id`, `role`, `status`, `payoutIban`, `falLicenseNumber`, `falStatus`, `createdAt`)
     - `availableRoles`: array of roles the user can switch to or attach (`OWNER` marked as instant, `MARKETER` marked with Fal requirement).

2. **Active Role Profile Switching & Server-Side Session Tracking (`apps/api/src/modules/users` per AD-1, AD-5):**
   - **Given** an authenticated user with a valid session cookie
   - **When** the client submits a switch request via `POST /api/v1/users/profiles/switch` with `{ role: UserRole }`
   - **Then** the endpoint:
     - Validates the payload against `switchRoleSchema` (`role` must be one of `BUYER`, `MARKETER`, `OWNER`)
     - Verifies eligibility:
       - If `role === 'OWNER'` and user does not have an `OWNER` profile, automatically creates it (`status: ACTIVE`)
       - If `role === 'MARKETER'` and user does not have an `ACTIVE` marketer profile, throws HTTP 403 Forbidden with `AUTH_MARKETER_NOT_APPROVED`
       - If `role === 'BUYER'`, always permitted
     - Updates the active role in the PostgreSQL `Session` record (`session.activeRole = targetRole`)
     - Updates `request.user.activeRole` for subsequent execution in the same request cycle
     - Returns HTTP 200 OK with the updated `SessionUser` payload including `activeRole` and all attached `profiles`.

3. **Server-Side Role-Based Authorization Guard (`ActiveRoleGuard` / `@RequireRole` per AD-2, AD-12):**
   - **Given** protected NestJS controller routes across `apps/api`
   - **When** a route or controller is decorated with `@RequireRole(UserRole.OWNER)` or `@RequireRole(UserRole.MARKETER)`
   - **Then** the `ActiveRoleGuard`:
     - Extracts the metadata defined by `@RequireRole`
     - Inspects `request.user.activeRole` (populated by `SessionAuthGuard` from `session.activeRole`)
     - If `request.user.activeRole` is included in the allowed roles, allows the request to proceed
     - If `request.user.activeRole` is NOT among the allowed roles, rejects the request immediately with HTTP 403 Forbidden and standard error envelope:
       ```json
       {
         "code": "AUTH_ROLE_NOT_AUTHORIZED",
         "message": "ليس لديك صلاحية الوصول إلى هذه الخدمة بالدور النشط الحالي. يرجى التبديل إلى مساحة العمل المناسبة",
         "details": {
           "requiredRoles": ["OWNER"],
           "currentActiveRole": "BUYER"
         },
         "requestId": "uuid"
       }
       ```
   - **And** client route protection or UI element hiding never replaces server-side `ActiveRoleGuard` verification.

4. **Client-Side Auth Context & Workspace State Management (`apps/web`):**
   - **Given** `apps/web` client application
   - **When** wrapping with `AuthProvider` (`apps/web/src/components/providers/auth-provider.tsx`)
   - **Then** it exposes a `useAuth()` hook providing:
     - `user`: current authenticated `SessionUser` (or `null`)
     - `activeRole`: current active `UserRole` (`BUYER`, `OWNER`, `MARKETER`)
     - `profiles`: list of attached profiles with their status
     - `isLoading`: boolean session resolution state
     - `switchRole(role: UserRole)`: async function calling `apiClient.post('/users/profiles/switch', { role })`, updating local auth context, and redirecting via `router.push('/app/' + role.toLowerCase())`
     - `attachOwnerRole()`: async function calling `apiClient.post('/users/profiles/attach-owner')`, refreshing profiles, and switching role to `OWNER`
     - `logout()`: async function calling `apiClient.post('/auth/logout')`, clearing session state, and redirecting to `/`
     - `refreshSession()`: async function querying `GET /api/v1/auth/me` to synchronize session state.

5. **Institutional Workspace Shell & Role-Specific Navigation (`apps/web/src/components/layout/workspace-shell.tsx` per EXPERIENCE.md):**
   - **Given** an authenticated user accessing any route under `/app/*`
   - **When** the workspace renders
   - **Then** it presents the `WorkspaceShell` adhering strictly to `DESIGN.md`:
     - **RTL-Native Responsive Sidebar (`280px` desktop, collapsible drawer on mobile):**
       - Displays the El Masaif institutional crest and current workspace badge
       - Renders role-specific navigation menus with active route highlighting:
         - **Buyer Workspace (`/app/buyer`):**
           - "لوحة التحكم" (`/app/buyer`)
           - "تصفح العقارات" (`/`)
           - "عروضي النشطة" (`/app/buyer/offers`)
           - "العقارات المفضلة" (`/app/buyer/favorites`)
           - "طلبات الشراء" (`/app/buyer/demands`)
           - "إعدادات الحساب" (`/app/settings/profile`)
         - **Owner Workspace (`/app/owner`):**
           - "لوحة تحكم المالك" (`/app/owner`)
           - "طلب عرض عقار مباشر" (`/app/owner/direct-listing`)
           - "عقود الوساطة الإلكترونية" (`/app/owner/contracts`)
           - "حسابات التحويل (IBAN)" (`/app/settings/payout`)
           - "إعدادات الحساب" (`/app/settings/profile`)
         - **Marketer Workspace (`/app/marketer`):**
           - "لوحة تحكم الوسيط" (`/app/marketer`)
           - "إدارة العقارات" (`/app/marketer/listings`)
           - "إضافة عقار جديد" (`/app/marketer/listings/new`)
           - "رخصة فال العقارية" (`/app/marketer/fal-license`)
           - "السعي والعمولات" (`/app/settings/payout`)
           - "إعدادات الحساب" (`/app/settings/profile`)
     - **Workspace Top Bar:**
       - Mounts the `WorkspaceRoleSwitcher` component prominently
       - Displays current user name and avatar pill
       - Includes Dark Mode and Language (AR/EN) toggle controls
       - Renders logout action button.

6. **Interactive Workspace Role Switcher Dropdown (`WorkspaceRoleSwitcher` component):**
   - **Given** the navigation header or workspace top bar
   - **When** rendering the `WorkspaceRoleSwitcher`
   - **Then** it displays:
     - Current active role with sovereign badge styling (e.g. `مشتري` with Sovereign Emerald `#1B4332`, `مالك عقار` with Dark Surface `#132018`, `مسوق معتمد` with Desert Gold `#C69C45`)
     - Chevron icon indicating interactive menu
   - **And** clicking the switcher opens an elevated popover dialog:
     - **Section 1: "المساحات المفعلة" (Active Roles):**
       - Lists all currently attached profiles with an active indicator checkmark next to `activeRole`
       - Clicking any other attached active role executes `switchRole(role)` and smoothly transitions workspace
     - **Section 2: "المساحات المتاحة للتفعيل" (Available Roles):**
       - If `OWNER` is not yet attached: renders "تفعيل حساب المالك" button with a helper note ("تفعيل فوري لإدارة وعرض عقاراتك مباشرة")
       - If `MARKETER` is not yet attached or is not active: renders "ترقية لحساب مسوق معتمد" with a locked icon and explanatory badge ("يتطلب رخصة فال سارية من الهيئة العامة للعقار").

7. **Dedicated Workspace Landing Pages (`apps/web/src/app/app/*`):**
   - **Given** navigation to `/app/*` routes
   - **When** the page renders:
     - `/app`: Root landing route; automatically redirects authenticated users to their `activeRole` workspace (`/app/buyer`, `/app/owner`, or `/app/marketer`), or redirects unauthenticated visitors to `/auth/login?redirect=/app`
     - `/app/buyer`: Buyer workspace dashboard rendering quick stat summary cards (Active Offers count, Saved Favorites count, Active Demands count), quick search shortcut, and empty state CTA
     - `/app/owner`: Owner workspace dashboard displaying direct listing request CTA, contract overview status, and registered payout IBAN status
     - `/app/marketer`: Marketer workspace dashboard displaying Fal license verification badge, active inventory counters, and new listing creation shortcut button.

8. **Shared Contracts, Enums & Validation Schemas (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported across `apps/api` and `apps/web`
   - **Then** exports:
     - `switchRoleSchema`: `z.object({ role: z.nativeEnum(UserRole) })`
     - `userProfileSummarySchema`: `z.object({ id: z.string(), role: z.nativeEnum(UserRole), status: z.nativeEnum(ProfileStatus), payoutIban: z.string().nullable().optional(), falLicenseNumber: z.string().nullable().optional(), falStatus: z.nativeEnum(ProfileStatus).nullable().optional() })`
     - Updated `sessionUserSchema`: includes `activeRole: z.nativeEnum(UserRole)` and `profiles: z.array(userProfileSummarySchema)`
     - TypeScript types: `SwitchRoleInput`, `UserProfileSummary`, `SessionUser`, `WorkspaceNavigationItem`
     - Domain error codes: `AUTH_ROLE_NOT_AUTHORIZED`, `AUTH_MARKETER_NOT_APPROVED`, `AUTH_PROFILE_NOT_FOUND`.

9. **Automated Unit, Service & Component Verification:**
   - **Given** test suites in `packages/shared`, `apps/api`, and `apps/web`
   - **When** running `npm test` across all workspaces
   - **Then** 100% of tests pass:
     - Shared schema tests validating `switchRoleSchema` and role enums
     - Backend tests verifying:
       - Instantaneous `OWNER` profile creation and role switching
       - Rejection of `MARKETER` role switching when Fal license is missing or unapproved (HTTP 403)
       - Successful `MARKETER` role switching when Fal license is approved
       - `ActiveRoleGuard` enforcement rejecting unauthorized requests
     - Frontend component tests for `WorkspaceRoleSwitcher` and `WorkspaceShell`
     - Zero lint errors (`npm run lint`) and clean workspace builds (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Shared Role Contracts, Schemas & Constants in `packages/shared` (AC: 1, 8)
  - [x] 1.1 Update `packages/shared/src/schemas/auth.schema.ts`:
    - Define `userProfileSummarySchema` with `id`, `role`, `status`, `payoutIban`, `falLicenseNumber`, `falStatus`.
    - Define `switchRoleSchema = z.object({ role: z.nativeEnum(UserRole) })`.
    - Update `sessionUserSchema` to include `activeRole: z.nativeEnum(UserRole)` and `profiles: z.array(userProfileSummarySchema)`.
  - [x] 1.2 Update `packages/shared/src/types/auth.ts`:
    - Export `SwitchRoleInput = z.infer<typeof switchRoleSchema>`.
    - Export `UserProfileSummary = z.infer<typeof userProfileSummarySchema>`.
    - Update `SessionUser` type.
    - Export `WorkspaceNavigationItem` interface.
  - [x] 1.3 Update `packages/shared/src/constants/auth.ts`:
    - Export error codes: `AUTH_ROLE_NOT_AUTHORIZED = 'AUTH_ROLE_NOT_AUTHORIZED'`, `AUTH_MARKETER_NOT_APPROVED = 'AUTH_MARKETER_NOT_APPROVED'`, `AUTH_PROFILE_NOT_FOUND = 'AUTH_PROFILE_NOT_FOUND'`.
  - [x] 1.4 Unit tests in `packages/shared/src/schemas/__tests__/roles.spec.ts` (or `auth.spec.ts`).

- [x] Task 2: Database Model Updates & Prisma Client Generation in `apps/api` (AC: 2)
  - [x] 2.1 Update `apps/api/prisma/schema.prisma`:
    - Add `activeRole UserRole @default(BUYER)` to `model Session`.
    - Ensure relation between `UserProfile` and `FalLicense` is fully queryable in session lookups.
  - [x] 2.2 Run `npm run prisma:generate` in `apps/api` to update Prisma client types.

- [x] Task 3: Backend Users Module, Role Switching Service & Controller in `apps/api` (AC: 1, 2)
  - [x] 3.1 Create `apps/api/src/modules/users/users.module.ts`:
    - Declare `UsersController` and `UsersService`.
    - Export `UsersService`.
  - [x] 3.2 Create `apps/api/src/modules/users/users.service.ts`:
    - Inject `PrismaService` and `ClockService`.
    - Method `getUserProfiles(userId: string, sessionToken: string)`:
      - Query user with profiles and include `falLicense`.
      - Find active session to determine `activeRole`.
      - Return `{ activeRole, profiles, availableRoles }`.
    - Method `switchActiveRole(userId: string, sessionToken: string, targetRole: UserRole)`:
      - Validate target role:
        - If `targetRole === UserRole.BUYER`: ensure buyer profile exists (create if missing).
        - If `targetRole === UserRole.OWNER`: check if user has `OWNER` profile; if not, create `UserProfile` (`userId, role: OWNER, status: ACTIVE`) instantaneously.
        - If `targetRole === UserRole.MARKETER`: query user's `MARKETER` profile including `falLicense`. If profile does not exist or `profile.status !== ProfileStatus.ACTIVE` (or Fal license is not active), throw `ForbiddenException(AUTH_MARKETER_NOT_APPROVED)`.
      - Update `Session` where `token = sessionToken` setting `activeRole = targetRole`.
      - Return updated `SessionUser` object with `activeRole = targetRole` and all profiles.
    - Method `attachOwnerProfile(userId: string)`:
      - Check if `OWNER` profile already exists. If not, create it.
      - Return updated profile.
  - [x] 3.3 Create `apps/api/src/modules/users/users.controller.ts`:
    - Decorate controller with `@UseGuards(SessionAuthGuard)`.
    - `GET /api/v1/users/profiles`: calls `usersService.getUserProfiles(req.user.id, req.user.sessionToken)`.
    - `POST /api/v1/users/profiles/switch`: validates body with `ZodValidationPipe(switchRoleSchema)`, calls `usersService.switchActiveRole`.
    - `POST /api/v1/users/profiles/attach-owner`: calls `usersService.attachOwnerProfile(req.user.id)`.
  - [x] 3.4 Update `apps/api/src/modules/auth/guards/session-auth.guard.ts`:
    - Populate `request.user.activeRole = session.activeRole || session.user.profiles?.[0]?.role || UserRole.BUYER`.
    - Include full profiles list with Fal license details in `request.user.profiles`.
  - [x] 3.5 Create `apps/api/src/modules/users/guards/active-role.guard.ts` and decorator `apps/api/src/modules/users/decorators/require-role.decorator.ts`:
    - `@RequireRole(...roles: UserRole[])` stores roles array in `SetMetadata('roles', roles)`.
    - `ActiveRoleGuard` checks `request.user.activeRole`; if not allowed, throws `ForbiddenException` with code `AUTH_ROLE_NOT_AUTHORIZED`.
  - [x] 3.6 Register `UsersModule` in `apps/api/src/app.module.ts`.
  - [x] 3.7 Unit tests in `apps/api/src/modules/users/__tests__/users.service.spec.ts` and `users.controller.spec.ts`.

- [x] Task 4: Frontend Auth Provider & Role Switching Hooks in `apps/web` (AC: 4)
  - [x] 4.1 Create `apps/web/src/components/providers/auth-provider.tsx`:
    - Context managing `user: SessionUser | null`, `activeRole: UserRole`, `isLoading: boolean`.
    - On mount, fetches `GET /api/v1/auth/me` to populate authenticated session context.
    - Implements `switchRole(role: UserRole)`: calls `apiClient.post('/users/profiles/switch', { role })`, updates local user/activeRole state, and calls `router.push('/app/' + role.toLowerCase())`.
    - Implements `attachOwnerRole()`: calls `apiClient.post('/users/profiles/attach-owner')`, then switches role.
    - Implements `logout()`: calls `apiClient.post('/auth/logout')`, clears context, and redirects to `/`.
    - Export `useAuth()` hook.
  - [x] 4.2 Register `AuthProvider` inside `apps/web/src/components/providers/index.tsx`.

- [x] Task 5: Sovereign Workspace Shell & Role Switcher UI in `apps/web` (AC: 5, 6)
  - [x] 5.1 Create `apps/web/src/components/layout/workspace-role-switcher.tsx`:
    - Renders active role pill button with role badge and arrow icon.
    - Dropdown menu presenting:
      - Active attached profiles with checkmark and 1-click switch.
      - "تفعيل حساب المالك" option if Owner role unattached.
      - "ترقية لمسوق عقاري معتمد" disabled/info option with Fal license requirement badge.
  - [x] 5.2 Create `apps/web/src/components/layout/workspace-shell.tsx`:
    - Layout component wrapping workspace header, role-specific sidebar, and content container.
    - Sidebar navigation dynamically adapts to `activeRole` (`BUYER`, `OWNER`, `MARKETER`) with Arabic labels, icons, and active route state.
    - Top bar includes `WorkspaceRoleSwitcher`, user profile pill, theme toggle, and language toggle.
  - [x] 5.3 Update `apps/web/src/components/layout/header.tsx`:
    - If user is authenticated (via `useAuth`), show `WorkspaceRoleSwitcher` and user profile dropdown instead of static login/register buttons.
    - Preserve unauthenticated state display when user is logged out.

- [x] Task 6: Workspace Pages Implementation in `apps/web` (AC: 7)
  - [x] 6.1 Create `apps/web/src/app/app/layout.tsx`:
    - Checks authentication; if unauthenticated, redirects to `/auth/login?redirect=/app`.
    - Renders `WorkspaceShell` around page children.
  - [x] 6.2 Create `apps/web/src/app/app/page.tsx`:
    - Client redirector redirecting `/app` to `/app/${activeRole.toLowerCase()}`.
  - [x] 6.3 Create `apps/web/src/app/app/buyer/page.tsx`:
    - Buyer Dashboard with summary cards (Offers, Favorites, Demands), search banner, and quick actions.
  - [x] 6.4 Create `apps/web/src/app/app/owner/page.tsx`:
    - Owner Dashboard with direct listing request CTA, electronic contract review list, and payout account status.
  - [x] 6.5 Create `apps/web/src/app/app/marketer/page.tsx`:
    - Marketer Dashboard with Fal license verification badge, listing manager shortcut, and incoming inquiries summary.
  - [x] 6.6 Component tests in `apps/web/src/components/layout/__tests__/workspace-role-switcher.spec.ts` and `workspace-shell.spec.ts`.

- [x] Task 7: Verification, End-to-End Test & Build Gates (AC: 9)
  - [x] 7.1 Run shared workspace tests: `npm test --workspace=@elmasaif/shared`.
  - [x] 7.2 Run backend workspace tests: `npm test --workspace=@elmasaif/api`.
  - [x] 7.3 Run frontend workspace tests: `npm test --workspace=@elmasaif/web`.
  - [x] 7.4 Run full monorepo build: `npm run build`.
  - [x] 7.5 Run monorepo lint: `npm run lint`.

## Dev Notes

- **Multi-Role Profile Scoping Architecture (PRD FR-3, AD-5, AD-12):**
  - A single Saudi Account holds multiple role profiles (`UserProfile`) tied to its unique Saudi mobile number and national identifier.
  - The currently selected role (`activeRole`) is stored in the database on `Session.activeRole` and returned in session payloads.
  - Switching roles NEVER requires re-authenticating, issuing new credentials, or clearing cookies. It is an in-session state transition.

- **Instantaneous Owner Role Attachment (FR-3, UJ-3):**
  - Any registered user can become an Owner immediately.
  - If a user requests a switch to `UserRole.OWNER` and does not yet have an `OWNER` profile record, the system automatically creates `UserProfile` with `role: OWNER` and `status: ACTIVE` in the same transaction.

- **Marketer Fal License Barrier (FR-3, FR-6, UJ-2, R-06):**
  - Switching to `UserRole.MARKETER` is strictly prohibited unless the user has a `UserProfile` with `role: MARKETER` and `status: ACTIVE` (which in turn requires an approved `FalLicense`).
  - Attempting to switch without an approved profile MUST return HTTP 403 Forbidden with error code `AUTH_MARKETER_NOT_APPROVED`.
  - This server-side check is non-negotiable and prevents unauthorized brokers from accessing marketer endpoints.

- **Server-Side Enforcement via ActiveRoleGuard (AD-2, AD-12):**
  - Do NOT rely on frontend navigation hiding to protect role-specific actions.
  - Every API endpoint serving a specific role must enforce `@RequireRole(UserRole.OWNER)` or `@RequireRole(UserRole.MARKETER)` coupled with `ActiveRoleGuard` and `SessionAuthGuard`.

- **Workspace Navigation & RTL Mirroring (DESIGN.md, EXPERIENCE.md):**
  - Workspace sidebar is positioned at start (right side in RTL Arabic, left side in LTR English).
  - Use Tailwind logical classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) to ensure clean spatial mirroring.
  - Colors: Sovereign Emerald (`#1B4332`), Desert Gold (`#C69C45`), dark mode canvas (`#0B130E` -> `#132018`).

### Source Tree Components to Touch

#### Files Being Modified (UPDATE):
1. `apps/api/prisma/schema.prisma`:
   - *Current state:* `model Session` has `id, userId, token, userAgent, ipAddress, expiresAt, createdAt`.
   - *What changes:* Add `activeRole UserRole @default(BUYER)` to `model Session`.
   - *What must be preserved:* All existing models, relations, and enums.
2. `apps/api/src/app.module.ts`:
   - *Current state:* Imports `ConfigModule, ThrottlerModule, ClockModule, PrismaModule, HealthModule, StorageModule, GeoModule, AuthModule`.
   - *What changes:* Import and register `UsersModule`.
   - *What must be preserved:* All existing module imports, middlewares, and startup guards.
3. `apps/api/src/modules/auth/guards/session-auth.guard.ts`:
   - *Current state:* Hardcodes `primaryRole = session.user.profiles?.[0]?.role || 'BUYER'` and populates `request.user.role`.
   - *What changes:* Read `session.activeRole` and set `request.user.activeRole = session.activeRole || 'BUYER'`. Include Fal license in profiles query.
   - *What must be preserved:* Session token extraction, expiration checks, and error throwing.
4. `packages/shared/src/schemas/auth.schema.ts`:
   - *Current state:* Basic `sessionUserSchema` with `role: z.string()`.
   - *What changes:* Add `userProfileSummarySchema`, `switchRoleSchema`, and update `sessionUserSchema` to include `activeRole: z.nativeEnum(UserRole)` and `profiles: z.array(userProfileSummarySchema)`.
   - *What must be preserved:* Existing login, register, and OTP schemas.
5. `packages/shared/src/types/auth.ts`:
   - *Current state:* Basic auth input and response types.
   - *What changes:* Export `SwitchRoleInput`, `UserProfileSummary`, updated `SessionUser`, and `WorkspaceNavigationItem`.
   - *What must be preserved:* All existing types.
6. `packages/shared/src/constants/auth.ts`:
   - *Current state:* Auth rate limits, timings, and error codes.
   - *What changes:* Export error codes: `AUTH_ROLE_NOT_AUTHORIZED`, `AUTH_MARKETER_NOT_APPROVED`, `AUTH_PROFILE_NOT_FOUND`.
   - *What must be preserved:* All existing constants.
7. `apps/web/src/components/layout/header.tsx`:
   - *Current state:* Shows static login/register buttons.
   - *What changes:* Check authenticated user from `useAuth()`. If authenticated, show `WorkspaceRoleSwitcher` and profile dropdown; otherwise show login/register.
   - *What must be preserved:* Theme toggle, language toggle, and logo navigation.
8. `apps/web/src/components/providers/index.tsx`:
   - *Current state:* Combines `DirectionProvider` and `ThemeProvider`.
   - *What changes:* Wrap with `AuthProvider`.
   - *What must be preserved:* Existing provider hierarchy.

#### Files Being Created (NEW):
1. `apps/api/src/modules/users/users.module.ts`: NestJS module for user and profile operations.
2. `apps/api/src/modules/users/users.controller.ts`: Controller for profile querying and role switching.
3. `apps/api/src/modules/users/users.service.ts`: Service managing profile querying, instantaneous Owner attachment, and active role switching.
4. `apps/api/src/modules/users/guards/active-role.guard.ts`: Guard enforcing active role matching `@RequireRole`.
5. `apps/api/src/modules/users/decorators/require-role.decorator.ts`: Metadata decorator for route role requirements.
6. `apps/api/src/modules/users/__tests__/users.service.spec.ts`: Unit tests for role switching and profile attachment.
7. `apps/api/src/modules/users/__tests__/users.controller.spec.ts`: Unit tests for user profile endpoints.
8. `apps/web/src/components/providers/auth-provider.tsx`: Client context provider for authentication and role switching.
9. `apps/web/src/components/layout/workspace-role-switcher.tsx`: Interactive dropdown component for switching workspaces and activating roles.
10. `apps/web/src/components/layout/workspace-shell.tsx`: Institutional workspace layout shell with role-specific sidebar.
11. `apps/web/src/app/app/layout.tsx`: Next.js layout for authenticated `/app/*` routes.
12. `apps/web/src/app/app/page.tsx`: Workspace index redirecting to active role page.
13. `apps/web/src/app/app/buyer/page.tsx`: Buyer workspace dashboard.
14. `apps/web/src/app/app/owner/page.tsx`: Owner workspace dashboard.
15. `apps/web/src/app/app/marketer/page.tsx`: Marketer workspace dashboard.
16. `apps/web/src/components/layout/__tests__/workspace-role-switcher.spec.ts`: Component tests for role switcher.
17. `apps/web/src/components/layout/__tests__/workspace-shell.spec.ts`: Component tests for workspace shell and sidebar.

### Project Structure Notes

```
apps/api/src/modules/users/
├── __tests__/
│   ├── users.controller.spec.ts
│   └── users.service.spec.ts
├── decorators/
│   └── require-role.decorator.ts
├── guards/
│   └── active-role.guard.ts
├── users.controller.ts
├── users.module.ts
└── users.service.ts

apps/web/src/
├── app/
│   └── app/
│       ├── buyer/
│       │   └── page.tsx
│       ├── marketer/
│       │   └── page.tsx
│       ├── owner/
│       │   └── page.tsx
│       ├── layout.tsx
│       └── page.tsx
└── components/
    ├── layout/
    │   ├── __tests__/
    │   │   ├── workspace-role-switcher.spec.ts
    │   │   └── workspace-shell.spec.ts
    │   ├── workspace-role-switcher.tsx
    │   └── workspace-shell.tsx
    └── providers/
        └── auth-provider.tsx

packages/shared/src/
├── constants/
│   └── auth.ts
├── schemas/
│   └── auth.schema.ts
└── types/
    └── auth.ts
```

### Previous Story Intelligence & Learnings

- **From Story 1.2 (`1-2-returning-user-login-session-handling-lockout.md`):** Server-side sessions are stored in PostgreSQL with token in `elmasaif_session` cookie. `SessionAuthGuard` validates the session and populates `request.user`.
- **From Story 1.1 (`1-1-saudi-mobile-registration-otp-verification-legal-consent-tra.md`):** Every new registered user automatically receives a `UserProfile` with `UserRole.BUYER` and `ProfileStatus.ACTIVE`.
- **From Story 0.8 (`0-8-sovereign-design-system-foundation-rtl-layout-shell.md`):** Institutional design tokens and primitives (`Button`, `Card`, `Badge`, `EmptyState`, `LayoutShell`) are ready. Use Sovereign Emerald (`#1B4332`) and Desert Gold (`#C69C45`) for status badges and active indicators. Use `direction: rtl` baseline with logical spacing.
- **From Story 0.3 (`0-3-same-origin-api-proxy-http-presentation-boundary.md`):** Web client routes through `/api/v1/*` via Next.js rewrites; cookies are sent automatically with `credentials: 'include'`. Zero direct database queries in `apps/web`.

### Testing Standards Summary

- **Frameworks:** Jest for `apps/api`, Vitest for `apps/web` and `packages/shared`.
- **Execution:**
  - `npm test --workspace=@elmasaif/shared`
  - `npm test --workspace=@elmasaif/api`
  - `npm test --workspace=@elmasaif/web`
- **Coverage Expectation:** 100% test coverage for:
  - Instantaneous Owner profile creation
  - Fal license validation barrier for Marketer role
  - Active role session persistence in PostgreSQL
  - `ActiveRoleGuard` server-side authorization enforcement
  - Workspace switcher dropdown component interactions.
- **Verification Gates:**
  1. All unit and component tests pass with 0 failures (`npm test`).
  2. Workspace linting passes with 0 errors (`npm run lint`).
  3. Production build succeeds cleanly across all workspaces (`npm run build`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Multi-Role Profile Switching & Workspace Shell]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Identity, Auth & Saudi User Governance]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-3: Multi-Role Profile Switching]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#UJ-2: Sara Onboards as a Licensed Marketer]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#UJ-3: Abu Fahad Signs an Electronic Listing Contract as a Direct Owner]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1 — Monorepo Layout, Same-Origin API Proxy & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2 — Strict Presentation / Domain Separation & Explicit Action Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-12 — Granular Dynamic RBAC, Administrative Permission Matrix & Separation of Duties]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Information Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Authenticated User Workspaces]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High) via Antigravity Pair Programmer

### Debug Log References

None - Story context generation completed without errors.

### Completion Notes List

- Implemented Story 1.3: Multi-Role Profile Switching & Workspace Shell satisfying all Acceptance Criteria (AC 1 through 9).
- `packages/shared`:
  - Defined and exported `userProfileSummarySchema`, `switchRoleSchema`, and updated `sessionUserSchema` with `activeRole` and `profiles` array.
  - Exported TypeScript types `SwitchRoleInput`, `UserProfileSummary`, `SessionUser`, and `WorkspaceNavigationItem`.
  - Exported error codes `AUTH_ROLE_NOT_AUTHORIZED`, `AUTH_MARKETER_NOT_APPROVED`, and `AUTH_PROFILE_NOT_FOUND`.
  - Authored comprehensive unit tests in `roles.spec.ts` (8 tests passing).
- `apps/api`:
  - Added `activeRole UserRole @default(BUYER)` to `model Session` in Prisma schema and regenerated Prisma client.
  - Created `UsersModule`, `UsersService`, and `UsersController` under `users/profiles` with full support for `GET /api/v1/users/profiles`, `POST /api/v1/users/profiles/switch`, and `POST /api/v1/users/profiles/attach-owner`.
  - Implemented instantaneous `OWNER` role attachment with auto-creation on switch or attach endpoint.
  - Implemented strict Fal license validation barrier rejecting unauthorized `MARKETER` switches with HTTP 403 `AUTH_MARKETER_NOT_APPROVED`.
  - Implemented `@RequireRole` decorator and `ActiveRoleGuard` rejecting mismatched active role requests with HTTP 403 `AUTH_ROLE_NOT_AUTHORIZED`.
  - Updated `SessionAuthGuard` to populate `request.user.activeRole` and load full profiles with Fal license status.
  - Authored service and controller unit tests (`users.service.spec.ts`, `users.controller.spec.ts`, 14 tests passing).
- `apps/web`:
  - Created `AuthProvider` exposing `useAuth()` hook with session synchronization, active role state, and `switchRole`, `attachOwnerRole`, `logout`.
  - Created `WorkspaceRoleSwitcher` component displaying sovereign role badges, active attached profiles, and available role activation options (instant Owner, Fal-governed Marketer).
  - Created `WorkspaceShell` responsive RTL layout component with 280px sidebar rendering role-specific navigation for Buyer, Owner, and Marketer workspaces.
  - Created Next.js workspace routes: `/app/layout.tsx`, `/app/page.tsx` (redirector), `/app/buyer/page.tsx`, `/app/owner/page.tsx`, and `/app/marketer/page.tsx`.
  - Authored frontend component tests (`workspace-role-switcher.spec.ts`, `workspace-shell.spec.ts`, all passing).
- Monorepo Verification:
  - 100% test pass rate across `packages/shared` (87 tests), `apps/api` (174 tests), and `apps/web` (56 tests).
  - Clean linting (`npm run lint` -> 0 errors).
  - Clean production build (`npm run build` -> all workspaces built successfully).

### File List

- `_bmad-output/implementation-artifacts/1-3-multi-role-profile-switching-workspace-shell.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `packages/shared/src/schemas/auth.schema.ts` (modified)
- `packages/shared/src/types/auth.ts` (modified)
- `packages/shared/src/constants/auth.ts` (modified)
- `packages/shared/src/schemas/__tests__/roles.spec.ts` (new)
- `apps/api/prisma/schema.prisma` (modified)
- `apps/api/src/app.module.ts` (modified)
- `apps/api/src/modules/auth/guards/session-auth.guard.ts` (modified)
- `apps/api/src/modules/auth/auth.service.ts` (modified)
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (modified)
- `apps/api/src/modules/users/users.module.ts` (new)
- `apps/api/src/modules/users/users.service.ts` (new)
- `apps/api/src/modules/users/users.controller.ts` (new)
- `apps/api/src/modules/users/guards/active-role.guard.ts` (new)
- `apps/api/src/modules/users/decorators/require-role.decorator.ts` (new)
- `apps/api/src/modules/users/__tests__/users.service.spec.ts` (new)
- `apps/api/src/modules/users/__tests__/users.controller.spec.ts` (new)
- `apps/web/src/components/providers/auth-provider.tsx` (new)
- `apps/web/src/components/providers/index.tsx` (modified)
- `apps/web/src/components/layout/workspace-role-switcher.tsx` (new)
- `apps/web/src/components/layout/workspace-shell.tsx` (new)
- `apps/web/src/components/layout/header.tsx` (modified)
- `apps/web/src/components/layout/index.ts` (modified)
- `apps/web/src/components/layout/__tests__/workspace-role-switcher.spec.ts` (new)
- `apps/web/src/components/layout/__tests__/workspace-shell.spec.ts` (new)
- `apps/web/src/app/app/layout.tsx` (new)
- `apps/web/src/app/app/page.tsx` (new)
- `apps/web/src/app/app/buyer/page.tsx` (new)
- `apps/web/src/app/app/owner/page.tsx` (new)
- `apps/web/src/app/app/marketer/page.tsx` (new)
