---
baseline_commit: a65f8e7dc6640a8ff1812421ba765fe2747a32dc
---

# Story 1.10: User Preferences & Appearance Settings

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to configure UI language, theme mode, and notification channels in my profile settings,
So that the platform interface conforms to my personal visual and communication preferences, while critical deal, payment, and security alerts remain permanently enabled and protected.

## Acceptance Criteria

1. **Language Selection & Immediate RTL/LTR Geometric Adaptation (`apps/web` per FR-60, DESIGN.md, EXPERIENCE.md):**
   - **Given** an authenticated user or guest navigating the application or workspace settings
   - **When** toggling or selecting the interface language between Arabic (`ar`) and English (`en`):
     - **Arabic (`ar` - Default):**
       - Root document element updates immediately: `document.documentElement.setAttribute('dir', 'rtl')` and `document.documentElement.setAttribute('lang', 'ar')`.
       - Body typography class applies `font-sans` (`IBM Plex Sans Arabic`) and removes `font-secondary` (`Inter`).
       - Layout direction mirrors geometrically: back buttons/chevrons point right (`ArrowRight`), progress steps flow right-to-left, sidebar docks on the right (`start-0` in RTL).
     - **English (`en`):**
       - Root document element updates immediately: `document.documentElement.setAttribute('dir', 'ltr')` and `document.documentElement.setAttribute('lang', 'en')`.
       - Body typography class applies `font-secondary` (`Inter`) and removes `font-sans`.
       - Layout direction mirrors geometrically: back buttons/chevrons point left (`ArrowLeft`), progress steps flow left-to-right, sidebar docks on the left (`start-0` in LTR).
     - **Numeric & Monospace Integrity:**
       - All monetary amounts (SAR / ر.س), dates, phone numbers (+966), and Saudi IBAN blocks (`SA03 8000 ...`) strictly preserve `JetBrains Mono` (`font-mono`) formatting regardless of active language.
   - **Then** client state persists immediately to browser `localStorage` (`key: 'elmasaif_locale'`) via the existing `DirectionProvider` (`useDirection`).
   - **And** for authenticated users, the selected language is synchronized with backend user preferences (`preferredLanguage: 'ar' | 'en'`) via `PATCH /api/v1/users/preferences`.

2. **Theme Mode Selection & Immediate CSS Token Update (`apps/web` per FR-60, DESIGN.md, EXPERIENCE.md):**
   - **Given** an authenticated user or guest interacting with the theme selection controls
   - **When** selecting between `LIGHT` (`'light'`), `DARK` (`'dark'`), or `SYSTEM` (`'system'`):
     - **Light Mode (`light`):**
       - Removes `'dark'` class from `document.documentElement`.
       - Activates sovereign light palette tokens:
         - Background: `bg-surface-background` (`#F8FAF9`)
         - Base Surface: `bg-surface` (`#FFFFFF`)
         - Sunken Surface: `bg-surface-sunken` (`#F0F4F2`)
         - Borders: `border-surface-border` (`#E2E8F0`)
         - Inks: `text-ink-primary` (`#0F172A`), `text-ink-secondary` (`#475569`), `text-ink-muted` (`#94A3B8`).
     - **Dark Mode (`dark`):**
       - Adds `'dark'` class to `document.documentElement`.
       - Activates sovereign dark palette tokens:
         - Deep obsidian background: `dark:bg-dark-background` (`#0B130E`)
         - Base Surface: `dark:bg-dark-surface-base` (`#132018`)
         - Raised Surface: `dark:bg-dark-surface-raised` (`#1C2E24`)
         - Sunken Surface: `dark:bg-dark-surface` (`#0E1712`)
         - Borders: `dark:border-dark-surface-border` (`#23382C`) and `dark:border-dark-surface-border-strong` (`#32503E`)
         - Inks: `dark:text-dark-ink-primary` (`#F1F5F9`), `dark:text-dark-ink-secondary` (`#CBD5E1`), `dark:text-dark-ink-muted` (`#64748B`).
     - **System Mode (`system`):**
       - Resolves theme dynamically based on `window.matchMedia('(prefers-color-scheme: dark)')` with active change listener.
       - Automatically applies `dark` or removes `dark` when OS color scheme shifts.
     - **Contrast Compliance:**
       - All component foreground/background combinations strictly satisfy WCAG 2.1 AAA/AA contrast standards (e.g. primary emerald buttons: 8.6:1 AAA pass; dark text: 13.8:1 AAA pass).
   - **Then** client state persists immediately to browser `localStorage` (`key: 'elmasaif_theme'`) via the existing `ThemeProvider` (`useTheme`).
   - **And** for authenticated users, the selected theme is synchronized with backend user preferences (`themeMode: 'light' | 'dark' | 'system'`) via `PATCH /api/v1/users/preferences`.

3. **Notification Channel & Topic Delivery Preferences (`apps/api`, `packages/shared`, `apps/web` per FR-60, FR-44, FR-45):**
   - **Given** an authenticated user in workspace preferences (`/app/settings/preferences`)
   - **When** reviewing and toggling optional notification channels and topics:
     - **Master Delivery Channels:**
       - `emailNotifications` (boolean, default: `true`): Enables or disables optional transactional and operational email delivery.
       - `smsNotifications` (boolean, default: `true`): Enables or disables optional operational SMS delivery.
     - **Notification Topics:**
       - `inquiryAlerts` (boolean, default: `true`): Toggles notifications when prospective buyers submit inquiries or when active demands match published listings.
       - `marketingAlerts` (boolean, default: `false`): Explicit opt-in toggle for platform property digests, newsletter insights, and promotional announcements.
   - **Then** toggling switches updates client form state, provides clear visual feedback, and allows explicit save with toast confirmation or debounced update.

4. **Permanent & Immutable Critical Alerts Guardrail (`apps/api`, `packages/shared`, `apps/web` per A-09, FR-44, FR-60, Notification Event Catalog):**
   - **Given** an authenticated user configuring notification preferences
   - **When** viewing the notification preferences interface
   - **Then** the platform renders a dedicated, visually prominent **Mandatory Regulatory & Security Alerts (التنبيهات الإلزامية النظامية والأمنية)** section:
     - Discloses the statutory requirement under Real Estate General Authority (REGA) and Saudi electronic transactions law:
       - *"تنبيهات الصفقات العقارية، ومواعيد التحويل المالي (48 ساعة)، ورموز التحقق، والإشعارات الأمنية والنظامية مفعلة دائماً بشكل غير قابل للتعطيل لحماية التعاملات المالية وحقوق المتعاقدين (A-09, FR-60)."*
     - Renders locked switch controls (disabled state with lock icon and amber/emerald badge: `إلزامي ونظامي`) across all 4 statutory event groups:
       1. **Deal Milestones & Settlement:** `deal.created`, `deal.payment_under_review`, `deal.proof_rejected`, `deal.completed`, `deal.timeout_cancelled`, `deal.disputed`.
       2. **Payment Deadline Warnings (Countdown Timers):** `deal.payment_deadline_warning` (12-hour and 2-hour urgency warnings before 48h expiration).
       3. **Account Security & Identity:** `auth.security_alert` (new device logins, failed step-up OTPs, password changes, mobile number updates, PDPL cooling-off actions).
       4. **Licensing & Contract Compliance:** `fal.expiry_warning`, `fal.expired_restricted`, `contract.ready_for_signature`, `contract.fee_expired`.
   - **And** server-side guard invariant (`apps/api`):
     - The backend notification dispatcher and preferences service strictly treat critical alerts as non-opt-outable.
     - Any request payload attempting to alter critical alert delivery is rejected with HTTP 400 `PREFERENCES_CRITICAL_ALERTS_IMMUTABLE` or automatically sanitized to preserve immutable true values.

5. **User Preferences REST API Endpoints (`apps/api` under `/api/v1/users/preferences`):**
   - **Given** an authenticated user with valid session cookie (`elmasaif_session`)
   - **When** calling `GET /api/v1/users/preferences`:
     - Returns HTTP 200 OK with the user's stored preferences (or automatically creates and returns default preferences if not yet existing):
       ```json
       {
         "code": "USER_PREFERENCES_RETRIEVED",
         "message": "تم استرجاع تفضيلات المستخدم بنجاح",
         "data": {
           "preferredLanguage": "ar",
           "themeMode": "light",
           "emailNotifications": true,
           "smsNotifications": true,
           "marketingAlerts": false,
           "inquiryAlerts": true,
           "criticalAlertsMandatory": true,
           "updatedAt": "2026-11-02T09:30:00.000Z"
         }
       }
       ```
   - **When** calling `PATCH /api/v1/users/preferences`:
     - Request body validated via `ZodValidationPipe(updateUserPreferencesSchema)`:
       ```json
       {
         "preferredLanguage": "en",
         "themeMode": "dark",
         "emailNotifications": true,
         "smsNotifications": false,
         "marketingAlerts": false,
         "inquiryAlerts": true
       }
       ```
     - Validates that `preferredLanguage` (if provided) is `'ar'` or `'en'`.
     - Validates that `themeMode` (if provided) is `'light'`, `'dark'`, or `'system'`.
     - Validates all boolean toggles.
     - Persists changes to `UserPreference` database record linked to `req.user.id`.
     - Inserts an immutable `AuditLog` entry:
       - `action: 'USER_PREFERENCES_UPDATED'`
       - `actorId: req.user.id`, `actorType: 'USER'`
       - `entityType: 'UserPreference'`, `entityId: user.id`
       - `payload: { oldPreferences, newPreferences }`
     - Returns HTTP 200 OK with updated preferences.

6. **Preferences Settings Web UI (`apps/web` at `/app/settings/preferences` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user navigating to `/app/settings/preferences`
   - **When** rendering within `WorkspaceShell`:
     - Displays breadcrumbs: `لوحة التحكم > إعدادات الحساب > التفضيلات والمظهر`.
     - Page Title: **"تفضيلات العرض والمظهر والإشعارات"** with descriptive lead text.
     - **Card 1: لغة الواجهة والاتجاه (Language & Direction):**
       - Two interactive selection tiles:
         1. **العربية (RTL - الافتراضي):** Crest icon, Arabic label, RTL indicator.
         2. **English (LTR):** Globe icon, English label, LTR indicator.
       - Selecting a tile immediately triggers `useDirection().setLocale()`, transitions the UI layout, and sends a background sync PATCH to the API.
     - **Card 2: المظهر والألوان (Theme & Display Mode):**
       - Three interactive selection tiles:
         1. **الوضع الفاتح (Light Mode):** Sun icon, bright surface palette preview.
         2. **الوضع الداكن (Dark Mode):** Moon icon, obsidian luxury surface preview.
         3. **حسب إعدادات النظام (System Preference):** Laptop/Monitor icon, dynamic auto preview.
       - Selecting a tile immediately triggers `useTheme().setTheme()`, updates DOM dark classes, and sends a background sync PATCH to the API.
     - **Card 3: قنوات الإشعارات الاختيارية (Optional Notification Channels):**
       - Toggle switch: **إشعارات البريد الإلكتروني (Email Notifications)** - "استلام ملخصات الحساب وتحديثات العروض على بريدك المسجل".
       - Toggle switch: **الرسائل النصية القصيرة (SMS Notifications)** - "استلام رسائل التنبيه على رقم جوالك السعودي المعتمد".
       - Toggle switch: **تنبيهات الاستفسارات والطلبات (Inquiry & Matching Alerts)** - "تنبيهك فور ورود استفسار جديد أو توفر عقار مطابق لطلبك".
       - Toggle switch: **النشرات الإعلانية والتسويقية (Marketing & Promotional Updates)** - "استلام تحليلات السوق العقاري وفرص المبيعات الاستثنائية".
       - Clear Save button with loading spinner and toast notification ("تم حفظ تفضيلاتك بنجاح").
     - **Card 4: التنبيهات النظامية والأمنية الإلزامية (Mandatory Alerts - Locked):**
       - Amber/Rose subtle background with ShieldCheck icon.
       - Informational notice explaining statutory mandate (A-09).
       - Visual list of deal, payment deadline countdown (48h), and security alerts marked with a lock icon and "مفعل دائماً" (Permanently Active).
   - **And** updates `apps/web/src/app/app/settings/profile/page.tsx`:
     - Adds a dedicated navigational card **"التفضيلات والمظهر والإشعارات"** linking directly to `/app/settings/preferences`.

7. **Automated Verification & Quality Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Vitest tests in `packages/shared/src/schemas/__tests__/preferences.spec.ts` validating all Zod schemas, enum values, and defaults.
     - Jest unit tests for `PreferencesService` in `apps/api/src/modules/users/__tests__/preferences.service.spec.ts` validating defaults creation, updating preferences, and audit logging.
     - Jest controller tests for `PreferencesController` in `apps/api/src/modules/users/__tests__/preferences.controller.spec.ts` validating authentication guards and response envelopes.
     - Frontend component tests in `apps/web/src/components/settings/__tests__/preferences-editor.spec.tsx` verifying language switching, theme toggling, notification switches, and locked critical alerts.
     - Zero TypeScript build errors (`npm run build`), zero lint warnings (`npm run lint`).

## Tasks / Subtasks

- [x] Task 1: Prisma Schema & Database Model for User Preferences (`apps/api/prisma/schema.prisma`) (AC: 5)
  - [x] 1.1 In `apps/api/prisma/schema.prisma`:
    - Define `model UserPreference`:
      - `id`: String @id @default(uuid())
      - `userId`: String @unique @map("user_id")
      - `preferredLanguage`: String @default("ar") @map("preferred_language")
      - `themeMode`: String @default("light") @map("theme_mode")
      - `emailNotifications`: Boolean @default(true) @map("email_notifications")
      - `smsNotifications`: Boolean @default(true) @map("sms_notifications")
      - `marketingAlerts`: Boolean @default(false) @map("marketing_alerts")
      - `inquiryAlerts`: Boolean @default(true) @map("inquiry_alerts")
      - `createdAt`: DateTime @default(now()) @map("created_at")
      - `updatedAt`: DateTime @updatedAt @map("updated_at")
      - `user`: User @relation(fields: [userId], references: [id], onDelete: Cascade)
      - `@@map("user_preferences")`
    - In `model User`:
      - Add relation field: `preferences UserPreference?`
  - [x] 1.2 Run `npx prisma generate --schema=apps/api/prisma/schema.prisma` to regenerate Prisma Client.

- [x] Task 2: Shared Constants, Enums, Schemas & Types (`packages/shared`) (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Update `packages/shared/src/constants/auth.ts`:
    - Add preferences domain codes:
      - `USER_PREFERENCES_RETRIEVED = 'USER_PREFERENCES_RETRIEVED'`
      - `USER_PREFERENCES_UPDATED = 'USER_PREFERENCES_UPDATED'`
      - `PREFERENCES_CRITICAL_ALERTS_IMMUTABLE = 'PREFERENCES_CRITICAL_ALERTS_IMMUTABLE'`
  - [x] 2.2 Create `packages/shared/src/schemas/preferences.schema.ts`:
    - Define `updateUserPreferencesSchema`:
      - `preferredLanguage`: `z.enum(['ar', 'en']).optional()`
      - `themeMode`: `z.enum(['light', 'dark', 'system']).optional()`
      - `emailNotifications`: `z.boolean().optional()`
      - `smsNotifications`: `z.boolean().optional()`
      - `marketingAlerts`: `z.boolean().optional()`
      - `inquiryAlerts`: `z.boolean().optional()`
  - [x] 2.3 Create `packages/shared/src/types/preferences.ts`:
    - Define `UserPreferences`: interface with preference fields, `criticalAlertsMandatory: boolean`, and `updatedAt`.
    - Define `UpdateUserPreferencesInput`: `z.infer<typeof updateUserPreferencesSchema>`.
    - Define `UserPreferencesResponse`: standard API response envelope containing `UserPreferences`.
  - [x] 2.4 Re-export new schema and types in `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/index.ts`, and `packages/shared/src/index.ts`.
  - [x] 2.5 Create unit test `packages/shared/src/schemas/__tests__/preferences.spec.ts`:
    - Test valid payloads with partial and full fields.
    - Test validation errors on invalid language (e.g. `'fr'`), invalid theme (e.g. `'neon'`), non-boolean notification toggles.
  - [x] 2.6 Run Vitest: `npx vitest run packages/shared/src/schemas/__tests__/preferences.spec.ts`.

- [x] Task 3: Backend Preferences Service in `apps/api/src/modules/users/preferences.service.ts` (AC: 3, 4, 5)
  - [x] 3.1 Implement `PreferencesService`:
    - Inject `PrismaService`.
    - Implement `getPreferences(userId: string)`:
      - Queries `prisma.userPreference.findUnique({ where: { userId } })`.
      - If found, returns mapped `UserPreferences`.
      - If not found, creates default record (`preferredLanguage: 'ar'`, `themeMode: 'light'`, `emailNotifications: true`, `smsNotifications: true`, `marketingAlerts: false`, `inquiryAlerts: true`) and returns mapped `UserPreferences`.
    - Implement `updatePreferences(userId: string, dto: UpdateUserPreferencesInput, ip: string, userAgent: string)`:
      - Upserts `prisma.userPreference` for `userId`.
      - Records immutable `AuditLog` entry:
        - `action: 'USER_PREFERENCES_UPDATED'`
        - `actorId: userId`, `actorType: 'USER'`
        - `entityType: 'UserPreference'`, `entityId: userId`
        - `ipAddress: ip`, `userAgent: userAgent`
        - `payload: { updatedFields: dto }`
      - Returns updated `UserPreferences` with `criticalAlertsMandatory: true`.
  - [x] 3.2 Create unit tests in `apps/api/src/modules/users/__tests__/preferences.service.spec.ts`:
    - Test getting preferences for existing user.
    - Test creating default preferences for new user.
    - Test updating preferences and verifying audit log creation.
    - Test that critical alerts invariant remains enforced.

- [x] Task 4: Backend REST Controller Endpoints in `apps/api/src/modules/users/preferences.controller.ts` (AC: 4, 5)
  - [x] 4.1 Create `apps/api/src/modules/users/preferences.controller.ts`:
    - Controller route: `@Controller('users/preferences')` with `@ApiTags('User Preferences')`.
    - Endpoint `GET /users/preferences`:
      - `@UseGuards(SessionAuthGuard)`, `@ApiBearerAuth()`
      - Calls `preferencesService.getPreferences(req.user.id)`.
      - Returns standard envelope `{ code: USER_PREFERENCES_RETRIEVED, message, data }`.
    - Endpoint `PATCH /users/preferences`:
      - `@UseGuards(SessionAuthGuard)`, `@ApiBearerAuth()`
      - Validates body with `new ZodValidationPipe(updateUserPreferencesSchema)`.
      - Calls `preferencesService.updatePreferences(req.user.id, body, req.ip, req.headers['user-agent'])`.
      - Returns standard envelope `{ code: USER_PREFERENCES_UPDATED, message, data }`.
  - [x] 4.2 Register `PreferencesService` and `PreferencesController` in `apps/api/src/modules/users/users.module.ts`.
  - [x] 4.3 Create controller unit tests in `apps/api/src/modules/users/__tests__/preferences.controller.spec.ts`:
    - Test GET endpoint returns 200 with preferences.
    - Test PATCH endpoint updates preferences and returns 200.
    - Test unauthenticated requests are blocked by `SessionAuthGuard`.

- [x] Task 5: Frontend Preferences Editor & Page in `apps/web` (AC: 1, 2, 3, 4, 6)
  - [x] 5.1 Create `apps/web/src/components/settings/preferences-editor.tsx`:
    - Integrates with `useDirection()` for language selection (`ar` vs `en`).
    - Integrates with `useTheme()` for theme selection (`light`, `dark`, `system`).
    - Fetches user preferences via `apiClient.get('/users/preferences')`.
    - Handles Language Card:
      - Two visual radio tiles: Arabic (RTL) and English (LTR).
      - Clicking immediately triggers `setLocale()` and dispatches `PATCH /users/preferences`.
    - Handles Theme Card:
      - Three visual radio tiles: Light, Dark, System.
      - Clicking immediately triggers `setTheme()` and dispatches `PATCH /users/preferences`.
    - Handles Notification Channels Card:
      - Switch controls for `emailNotifications`, `smsNotifications`, `inquiryAlerts`, `marketingAlerts`.
      - Save button with toast notification confirming saved settings.
    - Handles Mandatory Regulatory Alerts Card:
      - Non-interactive / locked visual display with lock icons, ShieldCheck emblem, and badge "إلزامي ونظامي".
      - Clearly lists Deal Milestone alerts, 48-hour Payment Deadline warnings, Security/Auth notices, and REGA regulatory notices.
  - [x] 5.2 Create `apps/web/src/app/app/settings/preferences/page.tsx`:
    - Renders breadcrumbs (`لوحة التحكم > إعدادات الحساب > التفضيلات والمظهر`).
    - Embeds `PreferencesEditor`.
  - [x] 5.3 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Add a card in the settings navigation grid for "التفضيلات والمظهر" linking to `/app/settings/preferences`.
  - [x] 5.4 Update `apps/web/src/components/layout/workspace-shell.tsx`:
    - Ensure quick toggles (language toggle and theme toggle in top bar) stay synchronized with active settings.
  - [x] 5.5 Create component tests in `apps/web/src/components/settings/__tests__/preferences-editor.spec.tsx`:
    - Verify initial state rendering.
    - Verify language change triggers direction change.
    - Verify theme change triggers theme toggle.
    - Verify notification switches update values and call API.
    - Verify mandatory alerts section displays with disabled/locked states.

- [x] Task 6: Verification, Test Suites & Quality Gates (AC: 7)
  - [x] 6.1 Run shared schema unit tests: `npx vitest run packages/shared/src/schemas/__tests__/preferences.spec.ts`.
  - [x] 6.2 Run backend unit and integration tests: `npx jest --config apps/api/package.json preferences`.
  - [x] 6.3 Run frontend component tests: `npm test -w apps/web`.
  - [x] 6.4 Execute full monorepo lint check: `npm run lint`.
  - [x] 6.5 Execute full monorepo build: `npm run build`.

## Dev Notes

### Architecture Compliance & Guardrails

- **Language & Direction Architecture (`apps/web`):**
  - The application uses `DirectionProvider` (`apps/web/src/components/providers/direction-provider.tsx`) to manage `dir` and `lang` attributes on the root HTML element.
  - In Arabic mode (`ar`), document direction is `rtl`, using font `IBM Plex Sans Arabic` (`font-sans`).
  - In English mode (`en`), document direction is `ltr`, using font `Inter` (`font-secondary`).
  - Numbers and monospace tokens (SAR currency, dates, IBAN blocks, phone numbers) must strictly preserve `font-mono` (`JetBrains Mono`).
  - Storage key: `STORAGE_KEY_LOCALE = 'elmasaif_locale'` in `localStorage`.
  - For authenticated users, selecting a language updates `localStorage` immediately for zero latency, and triggers `PATCH /api/v1/users/preferences` to persist across devices.

- **Theme Mode Architecture (`apps/web`):**
  - The application uses `ThemeProvider` (`apps/web/src/components/providers/theme-provider.tsx`) to manage the `'dark'` class on `document.documentElement`.
  - Supports three values of `ThemeMode`: `LIGHT = 'light'`, `DARK = 'dark'`, `SYSTEM = 'system'`.
  - In System mode, a `window.matchMedia('(prefers-color-scheme: dark)')` listener responds dynamically to OS appearance shifts.
  - Sovereign dark palette tokens from `DESIGN.md`:
    - `dark-background`: `#0B130E` (deep obsidian canvas)
    - `dark-surface-base`: `#132018` (primary surface container)
    - `dark-surface-raised`: `#1C2E24` (elevated cards and modals)
    - `dark-surface-border`: `#23382C` (muted emerald border)
    - `dark-ink-primary`: `#F1F5F9` (high-contrast text)
  - Storage key: `STORAGE_KEY_THEME = 'elmasaif_theme'` in `localStorage`.
  - For authenticated users, selecting a theme updates `localStorage` and DOM classes immediately, and triggers `PATCH /api/v1/users/preferences`.

- **Notification Preferences & Critical Alerts Invariant (A-09, FR-44, FR-60):**
  - **The Law of Critical Alerts:** Under Saudi real estate brokerage regulations (REGA) and financial platform governance, parties to property transactions must receive timely, non-repudiable legal and payment notices.
  - Per Assumption `A-09` and `FR-60`:
    > *"Critical transaction alerts (deal creation, payment deadline timer, dispute notifications, and security events) cannot be disabled by user notification preferences."*
  - The Notification Event Catalog (`addendum.md` Section 6) defines critical events:
    - `deal.created`: Deal generated; wire transfer instructions, frozen IBAN, and payment deadline dispatched.
    - `deal.payment_deadline_warning`: Critical 12-hour and 2-hour warnings before 48h payment window expires.
    - `deal.payment_under_review` & `deal.proof_rejected`: Payment review status and rejection notices.
    - `deal.completed`: Transaction completed; counterparty contact disclosure.
    - `deal.timeout_cancelled` & `deal.disputed`: Deal cancellation and dispute suspension notices.
    - `auth.security_alert`: Suspicious login, password reset, or OTP failure.
    - `fal.expiry_warning` & `fal.expired_restricted`: Broker license regulatory enforcement.
  - These events bypass all user opt-out filters and are permanently dispatched via In-App feed, SMS, and Email according to their statutory specifications.
  - The User Preferences schema and UI explicitly enforce this distinction: user-toggleable channels (`emailNotifications`, `smsNotifications`, `inquiryAlerts`, `marketingAlerts`) control only optional communications.

- **Monorepo Directory Layout & File Responsibilities:**
  - `apps/api/prisma/schema.prisma`: `model UserPreference` with 1-to-1 relation to `model User`.
  - `packages/shared/src/constants/auth.ts`: Domain status and error codes.
  - `packages/shared/src/schemas/preferences.schema.ts`: Zod validation schemas.
  - `packages/shared/src/types/preferences.ts`: TypeScript contracts and response envelopes.
  - `apps/api/src/modules/users/preferences.service.ts`: Business logic, upsert, audit logging.
  - `apps/api/src/modules/users/preferences.controller.ts`: NestJS REST endpoints under `/users/preferences`.
  - `apps/web/src/app/app/settings/preferences/page.tsx`: Preferences settings route.
  - `apps/web/src/components/settings/preferences-editor.tsx`: Interactive preference form component.
  - `apps/web/src/app/app/settings/profile/page.tsx`: Settings navigation hub.

### Testing Standards Summary

- **Shared Package Tests:**
  - Framework: Vitest (`npx vitest run packages/shared/src/schemas/__tests__/preferences.spec.ts`).
  - Coverage: Schema validation, optional fields, rejected invalid values.
- **Backend API Tests:**
  - Framework: Jest (`npx jest --config apps/api/package.json preferences`).
  - Unit tests for `PreferencesService` (mocking Prisma).
  - Controller tests for `PreferencesController` (mocking service and verifying guards).
- **Frontend Web Tests:**
  - Framework: Jest / React Testing Library (`npm test -w apps/web`).
  - Component tests for `PreferencesEditor` verifying immediate direction toggle, theme toggle, notification switches, and locked critical alerts card.
- **Monorepo Gates:**
  - Lint: `npm run lint` must pass across all workspaces.
  - Build: `npm run build` (`packages/shared`, `apps/api`, `apps/web`, `apps/worker`) must succeed with zero TypeScript errors.

### Project Structure Notes

- Uses existing `DirectionProvider` (`apps/web/src/components/providers/direction-provider.tsx`) and `ThemeProvider` (`apps/web/src/components/providers/theme-provider.tsx`). No duplicate state providers created.
- Reuses existing UI primitives in `apps/web/src/components/ui/` (`card.tsx`, `button.tsx`, `badge.tsx`).
- Follows existing NestJS modular structure in `apps/api/src/modules/users/` with `users.module.ts`.
- Uses `SessionAuthGuard` for endpoint authentication.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10: User Preferences & Appearance Settings]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-60: User Workspace Settings & Preferences]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#4.10 Notifications & Operational Alerts (FR-44)]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#A-09 Critical Operational Notifications Invariant]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md#6. Notification Event Catalog]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#Dark Mode Token Scale]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Preferences & Theme]
- [Source: _bmad-output/implementation-artifacts/1-9-account-deletion-pdpl-compliance-14-day-cooling-off-period.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Verified Red-Green-Refactor cycle for shared schema (`preferences.spec.ts`), backend service (`preferences.service.spec.ts`), controller (`preferences.controller.spec.ts`), and frontend editor (`preferences-editor.spec.tsx`).
- Prisma client generated and PostgreSQL schema pushed cleanly.
- Resolved type consistency across `apps/web` with `ApiError.status` getter and Next.js full static production build.
- Full regression suites verified: 158 shared tests passing, 294 API tests passing, 85 web tests passing.

### Completion Notes List

- Defined and migrated `model UserPreference` with 1-to-1 relationship to `model User` in `apps/api/prisma/schema.prisma`.
- Implemented and re-exported Zod schema, constants, and types in `@elmasaif/shared` (`updateUserPreferencesSchema`, `UserPreferencesResponse`, `USER_PREFERENCES_RETRIEVED`, `USER_PREFERENCES_UPDATED`, `PREFERENCES_CRITICAL_ALERTS_IMMUTABLE`).
- Implemented `PreferencesService` in `apps/api` with defaults generation, upsert synchronization, and immutable audit logging (`USER_PREFERENCES_UPDATED`). Enforced server-side statutory guard preventing modification to mandatory regulatory alerts (A-09).
- Implemented `PreferencesController` in `apps/api` with protected GET and PATCH endpoints guarded by `SessionAuthGuard`.
- Implemented `PreferencesEditor` component in `apps/web` with immediate UI reaction for language and theme tiles, background sync, optional notification toggles with toast alerts, and locked display of REGA regulatory alerts.
- Created `/app/settings/preferences` page with institutional breadcrumbs and added direct sub-navigation entry from `/app/settings/profile`.
- Enhanced `WorkspaceShell` quick top-bar toggles with background persistence to `/users/preferences`.

### File List

- `apps/api/prisma/schema.prisma`
- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/preferences.schema.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/preferences.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/schemas/__tests__/preferences.spec.ts`
- `apps/api/src/modules/users/preferences.service.ts`
- `apps/api/src/modules/users/preferences.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/__tests__/preferences.service.spec.ts`
- `apps/api/src/modules/users/__tests__/preferences.controller.spec.ts`
- `apps/web/src/components/settings/preferences-editor.tsx`
- `apps/web/src/components/settings/__tests__/preferences-editor.spec.tsx`
- `apps/web/src/app/app/settings/preferences/page.tsx`
- `apps/web/src/app/app/settings/profile/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/components/auth/account-deletion-wizard.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-10-user-preferences-appearance-settings.md`

### Change Log

- 2026-11-02: Completed Story 1.10 implementation (User Preferences & Appearance Settings) following Red-Green-Refactor cycle. All tasks and acceptance criteria satisfied with 100% test pass rate across monorepo. Status changed to "review".

