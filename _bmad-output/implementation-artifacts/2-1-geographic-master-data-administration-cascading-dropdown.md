---
baseline_commit: be46bd5bdbda9d8ee42e1a922b3e54a35c8557ab
---

# Story 2.1: Geographic Master Data Administration & Cascading Dropdown

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrator with `Geo.Manage` permission (and as a platform user interacting with property forms),
I want to manage Saudi cities and districts with active status toggles via a dedicated administrative back-office portal and REST API, and consume a reusable cascading `CityDistrictSelector` dropdown component across all platform forms,
So that property listings and buyer demands are strictly bound to pre-approved, validated geographic master data, unvalidated free-text location entries are rejected at the client and API boundary, and deactivated administrative divisions are gracefully retired without corrupting historical records.

## Acceptance Criteria

1. **Administrative Geographic REST API Endpoints (`apps/api` under `/api/v1/admin/geo` per FR-53, AD-9, AD-10):**
   - **Given** an authenticated administrator with a valid admin session cookie (`elmasaif_admin_session`) or Bearer token
   - **When** calling administrative geographic endpoints guarded by `AdminSessionAuthGuard` and verifying `Geo.Manage` permission (granted to `SUPER_ADMIN` per Admin Permission Matrix):
     - `GET /api/v1/admin/geo/cities`:
       - Returns HTTP 200 OK with all Saudi cities (both active and inactive) ordered by `nameAr` ascending.
       - Each city item includes `id`, `nameAr`, `nameEn`, `isActive`, `createdAt`, `_count: { districts: number }`, and counts of active vs inactive districts.
     - `POST /api/v1/admin/geo/cities`:
       - Request body validated via `ZodValidationPipe(createCitySchema)`:
         - `nameAr`: string (2-100 characters, required)
         - `nameEn`: string (2-100 characters, required)
         - `isActive`: boolean (optional, default: `true`)
       - Rejects duplicate city names within the system with HTTP 409 Conflict (`GEO_CITY_DUPLICATE_NAME`).
       - Creates the new `City` record in PostgreSQL.
       - Writes an immutable entry to `AuditLog`:
         - `action: 'GEO_CITY_CREATED'`
         - `actorId: req.admin.id`, `actorType: 'ADMIN'`
         - `entityType: 'City'`, `entityId: city.id`
         - `payload: { nameAr, nameEn, isActive }`
       - Returns HTTP 201 Created with the created City object.
     - `PATCH /api/v1/admin/geo/cities/:id`:
       - Request body validated via `ZodValidationPipe(updateCitySchema)`:
         - `nameAr`: string (2-100 characters, optional)
         - `nameEn`: string (2-100 characters, optional)
         - `isActive`: boolean (optional)
       - If `:id` does not exist or is invalid UUID, returns HTTP 404 with standard envelope (`CITY_NOT_FOUND`).
       - Persists updates to the database.
       - Writes an immutable entry to `AuditLog`:
         - `action: 'GEO_CITY_UPDATED'`
         - `actorId: req.admin.id`, `actorType: 'ADMIN'`
         - `entityType: 'City'`, `entityId: id`
         - `payload: { oldValues, newValues }`
       - Returns HTTP 200 OK with the updated City object.
     - `GET /api/v1/admin/geo/cities/:cityId/districts`:
       - Returns HTTP 200 OK with all districts belonging to `:cityId` (both active and inactive) ordered by `nameAr` ascending.
       - If `:cityId` is not found, returns HTTP 404 (`CITY_NOT_FOUND`).
     - `POST /api/v1/admin/geo/districts`:
       - Request body validated via `ZodValidationPipe(createDistrictSchema)`:
         - `cityId`: UUID (required, must reference an existing City)
         - `nameAr`: string (2-100 characters, required)
         - `nameEn`: string (2-100 characters, required)
         - `isActive`: boolean (optional, default: `true`)
       - Rejects duplicate district names within the same city with HTTP 409 Conflict (`GEO_DISTRICT_DUPLICATE_NAME`).
       - Creates the new `District` record bound to `cityId`.
       - Writes an immutable entry to `AuditLog`:
         - `action: 'GEO_DISTRICT_CREATED'`
         - `actorId: req.admin.id`, `actorType: 'ADMIN'`
         - `entityType: 'District'`, `entityId: district.id`
         - `payload: { cityId, nameAr, nameEn, isActive }`
       - Returns HTTP 201 Created with the created District object.
     - `PATCH /api/v1/admin/geo/districts/:id`:
       - Request body validated via `ZodValidationPipe(updateDistrictSchema)`:
         - `nameAr`: string (2-100 characters, optional)
         - `nameEn`: string (2-100 characters, optional)
         - `isActive`: boolean (optional)
       - If `:id` does not exist or is invalid UUID, returns HTTP 404 (`DISTRICT_NOT_FOUND`).
       - Persists updates to the database.
       - Writes an immutable entry to `AuditLog`:
         - `action: 'GEO_DISTRICT_UPDATED'`
         - `actorId: req.admin.id`, `actorType: 'ADMIN'`
         - `entityType: 'District'`, `entityId: id`
         - `payload: { oldValues, newValues }`
       - Returns HTTP 200 OK with the updated District object.
   - **And** requests without admin authentication return HTTP 401 Unauthorized (`ADMIN_AUTH_REQUIRED`).
   - **And** requests from administrators lacking `Geo.Manage` (roles other than `SUPER_ADMIN`) return HTTP 403 Forbidden (`AUTH_NOT_AUTHORIZED`).

2. **Deactivation Invariants & Historical Data Integrity (FR-53, AD-9):**
   - **Given** an administrator toggles `isActive: false` on a City or District
   - **When** the change is saved
   - **Then** the deactivation is immediate:
     - Public endpoints `GET /api/v1/geo/cities` and `GET /api/v1/geo/tree` immediately exclude the deactivated entity.
     - Public endpoint `GET /api/v1/geo/cities/:cityId/districts` returns 404 if the parent city is deactivated, or excludes deactivated districts.
     - Frontend cascading dropdowns exclude deactivated entities from selection options for all new listings and demands.
   - **And** historical referential integrity is strictly preserved:
     - Pre-existing property listings (`Listing`) and buyer demands (`Demand`) referencing deactivated cities or districts retain their foreign key associations without deletion, mutation, or breakage.
     - Public property cards and search filters preserve historical city/district display tags (e.g. `الرياض، حي النرجس`) for pre-existing listings.
   - **And** API boundary validation rejects new listing creations (`Story 2.2`) or demand submissions (`Story 3.6`) if the submitted `cityId` or `districtId` is marked `isActive: false`:
     - Returns HTTP 400 Bad Request with error code `GEO_CITY_INACTIVE` ("المدينة المحددة معطلة حالياً ولا يمكن إضافة عقارات أو طلبات جديدة بها") or `GEO_DISTRICT_INACTIVE` ("الحي المحدد معطل حالياً ولا يمكن إضافة عقارات أو طلبات جديدة به").

3. **Administrative Geographic Management Portal (`apps/web` at `/admin/geo` per FR-53, EXPERIENCE.md#70):**
   - **Given** an authenticated administrator navigating to `/admin/geo`
   - **When** the screen renders within the administrative back-office workspace:
     - Displays breadcrumbs: `لوحة التحكم الإدارية > البيانات الأساسية > إدارة المدن والأحياء`.
     - Page Title: **"إدارة البيانات الجغرافية الرئيسية (المناطق، المدن، والأحياء)"** with descriptive institutional lead text.
     - **Layout:** Master-Detail split or structured tabbed table layout conforming to `DESIGN.md#10` (Level 0 flat data table with sticky header, row hover effects, and crisp borders):
       - **Left/Master Section (المدن - Cities):**
         - Action button: `+ إضافة مدينة جديدة` opening the Add City modal.
         - Filter/Search input for real-time live filtering of cities by Arabic or English name.
         - Table listing: Arabic Name, English Name, Total Districts, Status Badge (Emerald `نشط` vs Muted/Amber `معطل`), and quick `isActive` toggle switch.
         - Clicking a City row selects that city and populates the District management pane.
       - **Right/Detail Section (أحياء المدينة - City Districts):**
         - Header showing selected city title (e.g. `أحياء مدينة الرياض`) with total and active count indicators.
         - Action button: `+ إضافة حي جديد` opening the Add District modal (pre-bound to selected city).
         - Table listing: District Arabic Name, District English Name, Status Badge, and quick `isActive` toggle switch.
         - Empty state when no city is selected or when a city has no districts.
     - **Modals:**
       - **Add City Modal:** Level 3 elevated modal with backdrop blur (`DESIGN.md#8`). Fields: `nameAr` (labeled "اسم المدينة بالعربية"), `nameEn` (labeled "اسم المدينة بالإنجليزية"), `isActive` toggle. Submit button with loading spinner.
       - **Add District Modal:** Level 3 elevated modal. Fields: Read-only parent city indicator, `nameAr` (labeled "اسم الحي بالعربية"), `nameEn` (labeled "اسم الحي بالإنجليزية"), `isActive` toggle. Submit button with loading spinner.
     - **Action Feedback:** All toggle and addition operations update UI state optimistically or via immediate refetch, displaying sovereign toast notifications (`تم تحديث حالة التفعيل بنجاح`, `تمت إضافة المدينة بنجاح`).

4. **Reusable Cascading `CityDistrictSelector` Component (`apps/web/src/components/geo/city-district-selector.tsx` per DESIGN.md#7, EXPERIENCE.md#7, UX-DR14):**
   - **Given** a frontend form requiring geographic selection (e.g., Listing Creation Wizard, Demand Submission Form, Search Filter Bar)
   - **When** the `CityDistrictSelector` component is rendered:
     - Renders dual search-enabled dropdown inputs:
       1. **City Dropdown (المدينة):** Searchable popover/combobox displaying active Saudi cities.
       2. **District Dropdown (الحي):** Searchable popover/combobox displaying active districts belonging to the selected city.
     - **Visual Specifications (`DESIGN.md#7`):**
       - Surface base background: `#FFFFFF` (dark mode: `dark:bg-dark-surface-base` `#132018`).
       - 1.5px border width (`border-surface-border` / `dark:border-dark-surface-border`).
       - Crisp primary emerald focus ring with 3px opacity halo (`box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.15)`).
       - RTL geometric alignment: chevron icon docked at start/end matching RTL layout, right-aligned typography.
     - **Cascading & Interactivity Lifecycle:**
       - On mount, fetches active cities from `/api/v1/geo/cities` (or consumes the hierarchical tree from `/api/v1/geo/tree`).
       - District input is **disabled** while `selectedCityId` is null/empty, displaying clear placeholder text: "يرجى اختيار المدينة أولاً" (Please select a city first).
       - When a City is selected:
         - District dropdown becomes enabled.
         - Loads/filters active districts for that city.
         - If previous `selectedCityId` differed, automatically resets selected district to null (`onDistrictChange(null)`).
       - Live search filtering: typing inside either dropdown filters the available options in real time by Arabic and English substring matching.
       - Clear button (X) allows resetting selection.
     - **Strict Value Output & Free-Text Prevention:**
       - Output values are strictly bounded to `cityId: string (UUID)` and `districtId: string (UUID) | null`.
       - Users cannot type or submit free-text strings as the selected location; selection is strictly selectable from the master records.
     - **Accessibility & ARIA Compliance:**
       - Complies with WAI-ARIA combobox patterns (`role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`).
       - Fully keyboard navigable via `ArrowDown`, `ArrowUp`, `Enter` to select, and `Escape` to close popover.

5. **Shared Schemas, Types & Boundary Validation (`packages/shared` per AD-9, UX-DR14):**
   - **Given** `@elmasaif/shared`
   - **When** exported and utilized across monorepo packages
   - **Then** provides Zod schemas in `packages/shared/src/schemas/geo.schema.ts`:
     - `createCitySchema`: validates `nameAr` (min 2, max 100), `nameEn` (min 2, max 100), `isActive` (boolean, default true).
     - `updateCitySchema`: validates optional `nameAr`, `nameEn`, `isActive`.
     - `createDistrictSchema`: validates `cityId` (UUID), `nameAr` (min 2, max 100), `nameEn` (min 2, max 100), `isActive` (boolean, default true).
     - `updateDistrictSchema`: validates optional `nameAr`, `nameEn`, `isActive`.
     - `toggleGeoActiveSchema`: validates `isActive: z.boolean()`.
     - `adminGeoQuerySchema`: validates optional query parameters `includeInactive: z.coerce.boolean().optional()`.
   - **And** exports TypeScript types in `packages/shared/src/types/geo.ts`:
     - `CreateCityInput`, `UpdateCityInput`, `CreateDistrictInput`, `UpdateDistrictInput`, `ToggleGeoActiveInput`, `AdminCityListItem`, `AdminDistrictListItem`.
   - **And** exports standardized geographic error codes:
     - `GEO_CITY_NOT_FOUND`, `GEO_DISTRICT_NOT_FOUND`, `GEO_CITY_INACTIVE`, `GEO_DISTRICT_INACTIVE`, `GEO_CITY_DUPLICATE_NAME`, `GEO_DISTRICT_DUPLICATE_NAME`.

6. **Automated Unit & Integration Verification:**
   - **Given** test suites in `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands (`npm test`, `npm run lint`, `npm run build`)
   - **Then** 100% of tests pass with 0 regressions:
     - `packages/shared`: Vitest unit tests in `geo.spec.ts` validating all new schemas, string length limits, duplicate constraints, and boolean defaults.
     - `apps/api`: Jest unit tests for `GeoService` testing admin city creation, admin district creation, update/toggle methods, inactive exclusion rules, and audit log generation.
     - `apps/api`: Jest unit tests for `AdminGeoController` verifying `AdminSessionAuthGuard` enforcement, `Geo.Manage` role authorization, request validation, and error response envelopes.
     - `apps/web`: Vitest / React Testing Library tests for `CityDistrictSelector` verifying:
       - Initial render with disabled district dropdown.
       - Selecting a city enables district dropdown and populates districts.
       - Changing city clears previous district selection.
       - Live text search filtering matches Arabic and English names.
       - Output events dispatch valid UUIDs only.
     - `apps/web`: Vitest tests for `/admin/geo` page verifying table rendering, status badges, toggle interaction, and modal submission.
     - Full monorepo pass: `npm run lint` and `npm run build` exit with 0 errors.

## Tasks / Subtasks

- [x] Task 1: Shared Geographic Schemas & Types (`packages/shared`) (AC: 1, AC: 5)
  - [x] 1.1 In `packages/shared/src/schemas/geo.schema.ts`:
    - Add `createCitySchema` (`nameAr`: min 2 max 100, `nameEn`: min 2 max 100, `isActive`: boolean default true).
    - Add `updateCitySchema` (`nameAr` optional, `nameEn` optional, `isActive` optional).
    - Add `createDistrictSchema` (`cityId`: UUID, `nameAr`: min 2 max 100, `nameEn`: min 2 max 100, `isActive`: boolean default true).
    - Add `updateDistrictSchema` (`nameAr` optional, `nameEn` optional, `isActive` optional).
    - Add `toggleGeoActiveSchema` (`isActive`: boolean).
    - Add `adminGeoQuerySchema` (`includeInactive`: boolean optional).
  - [x] 1.2 In `packages/shared/src/types/geo.ts`:
    - Export types inferred from new Zod schemas (`CreateCityInput`, `UpdateCityInput`, `CreateDistrictInput`, `UpdateDistrictInput`, `ToggleGeoActiveInput`).
    - Define and export `AdminCityListItem` and `AdminDistrictListItem` types.
  - [x] 1.3 In `packages/shared/src/constants/` (or `geo.ts`):
    - Export standardized error constants (`GEO_CITY_NOT_FOUND`, `GEO_DISTRICT_NOT_FOUND`, `GEO_CITY_INACTIVE`, `GEO_DISTRICT_INACTIVE`, `GEO_CITY_DUPLICATE_NAME`, `GEO_DISTRICT_DUPLICATE_NAME`).
  - [x] 1.4 Write unit tests in `packages/shared/src/schemas/__tests__/geo.spec.ts`:
    - Test valid inputs, string boundaries, UUID validation, and optional fields.
    - Verify with `npx --workspace=packages/shared vitest run`.

- [x] Task 2: Backend Administrative Master Data Methods & Audit Logging (`apps/api/src/modules/geo/geo.service.ts`) (AC: 1, AC: 2)
  - [x] 2.1 In `apps/api/src/modules/geo/geo.service.ts`:
    - Implement `adminGetCities()` returning all cities with district counts (`_count: { select: { districts: true } }`) and breakdown of active/inactive districts.
    - Implement `adminCreateCity(dto: CreateCityInput, adminId: string, ip: string)`:
      - Check uniqueness of `nameAr` and `nameEn`.
      - Create `City` record.
      - Create `AuditLog` entry (`action: 'GEO_CITY_CREATED'`).
    - Implement `adminUpdateCity(id: string, dto: UpdateCityInput, adminId: string, ip: string)`:
      - Verify city existence; throw `NotFoundException` if missing.
      - Update fields and save.
      - Create `AuditLog` entry (`action: 'GEO_CITY_UPDATED'`).
    - Implement `adminGetDistrictsByCity(cityId: string)`:
      - Verify city exists; return all districts under it (including inactive).
    - Implement `adminCreateDistrict(dto: CreateDistrictInput, adminId: string, ip: string)`:
      - Verify parent city exists.
      - Check uniqueness of `nameAr` within `cityId`.
      - Create `District` record.
      - Create `AuditLog` entry (`action: 'GEO_DISTRICT_CREATED'`).
    - Implement `adminUpdateDistrict(id: string, dto: UpdateDistrictInput, adminId: string, ip: string)`:
      - Verify district exists.
      - Update fields and save.
      - Create `AuditLog` entry (`action: 'GEO_DISTRICT_UPDATED'`).
    - Ensure public methods (`getCities`, `getDistrictsByCity`, `getGeoTree`) strictly exclude inactive items when `includeInactive=false`.
  - [x] 2.2 Author comprehensive unit tests in `apps/api/src/modules/geo/__tests__/geo.service.spec.ts`:
    - Verify city creation, duplicate rejection, update, active/inactive filtering, and AuditLog creation.
    - Verify district creation, duplicate rejection within city, and parent city check.

- [x] Task 3: Administrative REST Controller & RBAC Guard (`apps/api/src/modules/geo/admin-geo.controller.ts`) (AC: 1)
  - [x] 3.1 Create `apps/api/src/modules/geo/admin-geo.controller.ts`:
    - Annotate with `@ApiTags('Admin Geographic Management')`, `@ApiBearerAuth()`, `@Controller('admin/geo')`.
    - Apply `@UseGuards(AdminSessionAuthGuard)`.
    - Enforce `Geo.Manage` permission check: verify `req.admin.role === AdminRole.SUPER_ADMIN` (or check against permission mapping).
    - Implement endpoints:
      - `GET /admin/geo/cities`: list cities for admin.
      - `POST /admin/geo/cities`: create city with `ZodValidationPipe(createCitySchema)`.
      - `PATCH /admin/geo/cities/:id`: update city with `ZodValidationPipe(updateCitySchema)`.
      - `GET /admin/geo/cities/:cityId/districts`: list districts for city.
      - `POST /admin/geo/districts`: create district with `ZodValidationPipe(createDistrictSchema)`.
      - `PATCH /admin/geo/districts/:id`: update district with `ZodValidationPipe(updateDistrictSchema)`.
  - [x] 3.2 Update `apps/api/src/modules/geo/geo.module.ts`:
    - Register `AdminGeoController` in `controllers` array.
    - Ensure `PrismaModule` and `ClockModule` are accessible for `AdminSessionAuthGuard`.
  - [x] 3.3 Author controller tests in `apps/api/src/modules/geo/__tests__/admin-geo.controller.spec.ts`:
    - Verify authentication guard requirement.
    - Verify authorization rejection for unauthorized roles.
    - Verify response payloads and status codes (200, 201, 400, 404, 409).

- [x] Task 4: Reusable Frontend Cascading `CityDistrictSelector` Component (`apps/web/src/components/geo/`) (AC: 4, AC: 5)
  - [x] 4.1 Create `apps/web/src/components/geo/city-district-selector.tsx`:
    - Define interface `CityDistrictSelectorProps`:
      - `selectedCityId?: string | null`
      - `selectedDistrictId?: string | null`
      - `onCityChange: (cityId: string | null) => void`
      - `onDistrictChange: (districtId: string | null) => void`
      - `disabled?: boolean`
      - `required?: boolean`
      - `cityLabel?: string` (default: "المدينة")
      - `districtLabel?: string` (default: "الحي")
      - `cityError?: string`
      - `districtError?: string`
      - `includeInactive?: boolean` (default: false)
      - `className?: string`
    - Implement dual combobox dropdowns with RTL geometry:
      - Surface base `#FFFFFF`, 1.5px border, primary emerald focus ring (`box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.15)`).
      - Fetch active cities on mount via `apiClient.get('/geo/cities')`.
      - When `selectedCityId` is set, fetch districts via `apiClient.get('/geo/cities/' + cityId + '/districts')`.
      - When `selectedCityId` changes, trigger `onDistrictChange(null)`.
      - Disable district dropdown if no city is selected with message "يرجى اختيار المدينة أولاً".
      - Live search input within each dropdown to filter options by name (Arabic or English).
      - ARIA attributes (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`).
  - [x] 4.2 Create `apps/web/src/components/geo/index.ts` and export `CityDistrictSelector`.
  - [x] 4.3 Write component unit tests in `apps/web/src/components/geo/__tests__/city-district-selector.spec.tsx`:
    - Test initial render with disabled district input.
    - Test city selection triggers `onCityChange` and enables district input.
    - Test changing city resets district selection.
    - Test live search filtering.
    - Test accessibility attributes and keyboard interactions.

- [x] Task 5: Admin Back-Office Geographic Master Data Portal (`apps/web/src/app/admin/geo/page.tsx`) (AC: 1, AC: 3)
  - [x] 5.1 Create `apps/web/src/app/admin/geo/page.tsx`:
    - Wrap inside institutional layout / `WorkspaceShell` (with `UserRole.ADMIN`).
    - Breadcrumb navigation: `لوحة التحكم الإدارية > البيانات الأساسية > إدارة المدن والأحياء`.
    - Master-Detail split layout:
      - Master table of Cities with columns: Arabic Name, English Name, Total Districts, Active Status Badge, and Toggle Switch.
      - Detail table of Districts under the selected City with: Arabic Name, English Name, Active Status Badge, and Toggle Switch.
    - "+ إضافة مدينة جديدة" Modal with form fields `nameAr`, `nameEn`, `isActive` and Zod validation.
    - "+ إضافة حي جديد" Modal with parent city indicator, form fields `nameAr`, `nameEn`, `isActive` and Zod validation.
    - Quick toggle handlers calling `PATCH /api/v1/admin/geo/cities/:id` and `PATCH /api/v1/admin/geo/districts/:id`.
    - Toast feedback on mutation success and error handling.
  - [x] 5.2 Update `apps/web/src/components/layout/workspace-shell.tsx`:
    - Add `{ href: '/admin/geo', label: 'إدارة المدن والأحياء', icon: MapPin }` to `roleNavItems[UserRole.ADMIN]`.
  - [x] 5.3 Write component tests in `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx`:
    - Test rendering cities table.
    - Test selecting a city renders its districts.
    - Test toggle action sends PATCH request.
    - Test opening modals and submitting valid forms.

- [x] Task 6: Monorepo Verification & Quality Gates (AC: 6)
  - [x] 6.1 Execute all shared unit tests: `npm run test:shared`
  - [x] 6.2 Execute all API unit tests: `npm run test --workspace=apps/api`
  - [x] 6.3 Execute all Web unit tests: `npm run test --workspace=apps/web`
  - [x] 6.4 Run full monorepo build: `npm run build`
  - [x] 6.5 Run full monorepo linter: `npm run lint`

## Dev Notes

### Architecture Compliance

- **AD-9 Master Data Geography:**
  - City and District models exist in `apps/api/prisma/schema.prisma` with `isActive: Boolean` and `@@unique([id, cityId])` on `District`.
  - Referential integrity: `Listing` binds via composite key `[districtId, cityId] -> District[id, cityId]`.
  - `Demand` binds via `cityId` and optional `districtId`.
  - Unvalidated free-text submissions are strictly rejected at the API boundary; this story delivers the reusable component and admin management ensuring only valid UUIDs are ever submitted.
- **AD-10 & RBAC (`Geo.Manage`):**
  - Administrative endpoints require `AdminSessionAuthGuard` verifying the presence and validity of `AdminSession`.
  - Under the Admin Permission Matrix, `Geo.Manage` is restricted to `SUPER_ADMIN`.
- **Audit Logging (`AuditLog`):**
  - All mutating administrative actions (`GEO_CITY_CREATED`, `GEO_CITY_UPDATED`, `GEO_DISTRICT_CREATED`, `GEO_DISTRICT_UPDATED`) must insert an immutable row into `AuditLog` capturing actor ID, actor type (`ADMIN`), action, entity type, entity ID, and old/new payload diffs.

### Source Tree Components & Modifications

#### Files being UPDATED:

1. `apps/api/src/modules/geo/geo.service.ts`:
   - **Current State:** Contains `getCities()`, `getDistrictsByCity()`, and `getGeoTree()` supporting only read queries with optional `includeInactive` param.
   - **What this story changes:** Extends `GeoService` with administrative methods: `adminGetCities()`, `adminCreateCity()`, `adminUpdateCity()`, `adminGetDistrictsByCity()`, `adminCreateDistrict()`, `adminUpdateDistrict()`, including duplicate checks and `AuditLog` inserts.
   - **What must be preserved:** Existing public query signatures and response shapes (`getCities`, `getDistrictsByCity`, `getGeoTree`) must remain 100% backward-compatible.

2. `apps/api/src/modules/geo/geo.module.ts`:
   - **Current State:** Registers `GeoController` and `GeoService` importing `PrismaModule`.
   - **What this story changes:** Registers `AdminGeoController` in controllers array.

3. `packages/shared/src/schemas/geo.schema.ts`:
   - **Current State:** Contains `citySchema`, `districtSchema`, `geoTreeItemSchema`, `geoTreeResponseSchema`.
   - **What this story changes:** Adds `createCitySchema`, `updateCitySchema`, `createDistrictSchema`, `updateDistrictSchema`, `toggleGeoActiveSchema`, `adminGeoQuerySchema`.
   - **What must be preserved:** Existing schemas must remain intact.

4. `packages/shared/src/types/geo.ts`:
   - **Current State:** Exports `City`, `District`, `GeoTreeItem`, `CityWithDistricts`.
   - **What this story changes:** Exports input and output types for admin operations.

5. `apps/web/src/components/layout/workspace-shell.tsx`:
   - **Current State:** `[UserRole.ADMIN]` navigation items include only `/admin/dashboard`.
   - **What this story changes:** Adds navigation entry for `/admin/geo` ("إدارة المدن والأحياء") using the `MapPin` icon.

#### Files being CREATED (NEW):

1. `apps/api/src/modules/geo/admin-geo.controller.ts` (Admin REST API endpoints under `/api/v1/admin/geo`)
2. `apps/api/src/modules/geo/__tests__/admin-geo.controller.spec.ts` (Unit tests for admin controller)
3. `apps/web/src/components/geo/city-district-selector.tsx` (Reusable cascading selector component)
4. `apps/web/src/components/geo/index.ts` (Barrel export for geo components)
5. `apps/web/src/components/geo/__tests__/city-district-selector.spec.tsx` (Component unit tests)
6. `apps/web/src/app/admin/geo/page.tsx` (Admin geographic master data back-office screen)
7. `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx` (Admin screen unit tests)

### Testing Standards & Quality Gates

- **Unit Testing:**
  - `packages/shared`: Vitest (`npx --workspace=packages/shared vitest run`)
  - `apps/api`: Jest (`npm run test --workspace=apps/api`)
  - `apps/web`: Vitest with `@testing-library/react` (`npm run test --workspace=apps/web`)
- **Coverage & Edge Cases to Test:**
  - Attempting to create duplicate city or district name returns 409 Conflict.
  - Attempting to update non-existent city or district returns 404 NotFound.
  - Unauthenticated or non-admin requests to `/admin/geo/*` return 401 or 403.
  - Deactivating a city immediately excludes it from public `GET /geo/cities`.
  - Component tests: verify `CityDistrictSelector` disables district input when no city is selected, resets district selection when city changes, and filters options on user input.
- **Zero-Regression Verification:** Full monorepo `npm run build` and `npm run lint` must pass with zero errors.

### Project Structure Notes

- Aligns with monorepo convention: `apps/api` (NestJS 10), `apps/web` (Next.js 15 App Router), `packages/shared` (TypeScript + Zod).
- Follows sovereign design system: RTL-first, IBM Plex Sans Arabic typography, primary emerald focus rings (`box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.15)`), dark mode support via Tailwind CSS tokens.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-9 — Master Data Geography]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Admin Permission Matrix (`Geo.Manage`)]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-53: Geographic Master Data Administration]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#7. Cascading City & District Selector (FR-53)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#70: Geographic Master Data (`/admin/geo`)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#149: Cascading City & District Master Selector]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Geographic Master Data Administration & Cascading Dropdown]
- [Source: _bmad-output/implementation-artifacts/0-4-master-geographic-tables-initial-prisma-schema.md]
- [Source: _bmad-output/implementation-artifacts/1-10-user-preferences-appearance-settings.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

### Completion Notes List

- ✅ **Task 1: Shared Geographic Schemas & Types**: Added `createCitySchema`, `updateCitySchema`, `createDistrictSchema`, `updateDistrictSchema`, `toggleGeoActiveSchema`, `adminGeoQuerySchema` in `packages/shared/src/schemas/geo.schema.ts`. Exported input types (`CreateCityInput`, `UpdateCityInput`, `CreateDistrictInput`, `UpdateDistrictInput`, `ToggleGeoActiveInput`, `AdminGeoQueryInput`) and list response types (`AdminCityListItem`, `AdminDistrictListItem`) in `packages/shared/src/types/geo.ts`. Exported error constants (`GEO_CITY_NOT_FOUND`, `GEO_DISTRICT_NOT_FOUND`, `GEO_CITY_INACTIVE`, `GEO_DISTRICT_INACTIVE`, `GEO_CITY_DUPLICATE_NAME`, `GEO_DISTRICT_DUPLICATE_NAME`) in `packages/shared/src/constants/geo.ts` and barrel exported them. Implemented 14 new unit tests in `packages/shared/src/schemas/__tests__/geo.spec.ts` following red-green-refactor cycle (all 26 tests in the file and 172 tests in the shared package passing).
- ✅ **Task 2: Backend Administrative Master Data Methods & Audit Logging**: Extended `GeoService` in `apps/api/src/modules/geo/geo.service.ts` with `adminGetCities()`, `adminCreateCity()`, `adminUpdateCity()`, `adminGetDistrictsByCity()`, `adminCreateDistrict()`, and `adminUpdateDistrict()`. Enforced database duplicate validations, existence and UUID verification, transactional writes, and immutable `AuditLog` records for all creation and update operations. Implemented 14 new Jest unit tests in `apps/api/src/modules/geo/__tests__/geo.service.spec.ts` (all 23 tests passing with 0 regressions).
- ✅ **Task 3: Administrative REST Controller & RBAC Guard**: Created `AdminGeoController` and `AdminGeoGuard` in `apps/api/src/modules/geo/admin-geo.controller.ts` protected by `AdminSessionAuthGuard` and enforcing `Geo.Manage` (`AdminRole.SUPER_ADMIN`). Configured `createCity`, `updateCity`, `createDistrict`, and `updateDistrict` endpoints with `ZodValidationPipe` and registered controller & guards in `GeoModule`. Created 9 comprehensive Jest tests in `apps/api/src/modules/geo/__tests__/admin-geo.controller.spec.ts` (all passing; 38 total geo tests passing).
- ✅ **Task 4: Reusable Frontend Cascading `CityDistrictSelector` Component**: Created `CityDistrictSelector` in `apps/web/src/components/geo/city-district-selector.tsx` and barrel export in `apps/web/src/components/geo/index.ts`. Built dual search-enabled combobox dropdowns adhering to RTL geometry, sovereign design system (`border-[1.5px]`, `#FFFFFF` / `dark:bg-dark-surface-base`, emerald focus halo `focus:shadow-[0_0_0_3px_rgba(27,67,50,0.15)]`), disabled states, clear buttons, and strict UUID outputs. Implemented 5 Vitest unit tests in `apps/web/src/components/geo/__tests__/city-district-selector.spec.tsx` (all passing).
- ✅ **Task 5: Admin Back-Office Geographic Master Data Portal**: Implemented `/admin/geo` portal page in `apps/web/src/app/admin/geo/page.tsx` and admin layout in `apps/web/src/app/admin/layout.tsx`. Configured Master-Detail layout with cities table, real-time live search, interactive active/inactive toggles, district management pane, "+ إضافة مدينة جديدة" modal, and "+ إضافة حي جديد" modal. Added `/admin/geo` navigation link to `WorkspaceShell` under `UserRole.ADMIN`. Authored 5 Vitest component tests in `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx` (all passing).
- ✅ **Task 6: Monorepo Verification & Quality Gates**: Successfully ran all test suites (172 passing in shared, 317 passing in api, 95 passing in web), completed monorepo builds (`packages/shared`, `apps/api`, `apps/web`), and verified zero lint errors across the repository. All acceptance criteria fully met.

### File List

- `packages/shared/src/constants/geo.ts` (new)
- `packages/shared/src/constants/index.ts` (modified)
- `packages/shared/src/schemas/geo.schema.ts` (modified)
- `packages/shared/src/types/geo.ts` (modified)
- `packages/shared/src/schemas/__tests__/geo.spec.ts` (modified)
- `apps/api/src/modules/geo/geo.service.ts` (modified)
- `apps/api/src/modules/geo/__tests__/geo.service.spec.ts` (modified)
- `apps/api/src/modules/geo/admin-geo.controller.ts` (new)
- `apps/api/src/modules/geo/geo.module.ts` (modified)
- `apps/api/src/modules/geo/__tests__/admin-geo.controller.spec.ts` (new)
- `apps/web/src/components/geo/city-district-selector.tsx` (new)
- `apps/web/src/components/geo/index.ts` (new)
- `apps/web/src/components/geo/__tests__/city-district-selector.spec.tsx` (new)
- `apps/web/src/components/layout/workspace-shell.tsx` (modified)
- `apps/web/src/app/admin/layout.tsx` (new)
- `apps/web/src/app/admin/geo/page.tsx` (new)
- `apps/web/src/app/admin/geo/__tests__/admin-geo-page.spec.tsx` (new)

### Change Log

- 11-02-2026: Implemented Task 1 (Shared Geographic Schemas, Types, Error Constants, and Vitest Unit Tests).
- 11-02-2026: Implemented Task 2 (Backend Administrative Geographic Methods and Audit Logging in GeoService with Jest Tests).
- 11-02-2026: Implemented Task 3 (AdminGeoController with AdminSessionAuthGuard, AdminGeoGuard, and Jest Tests).
- 11-02-2026: Implemented Task 4 (Reusable Frontend Cascading CityDistrictSelector Component with Vitest Tests).
- 11-02-2026: Implemented Task 5 (Admin Back-Office Geographic Master Data Portal at /admin/geo, WorkspaceShell nav link, and Vitest Tests).
- 11-02-2026: Completed Task 6 (Monorepo Verification & Quality Gates). Ready for review.

