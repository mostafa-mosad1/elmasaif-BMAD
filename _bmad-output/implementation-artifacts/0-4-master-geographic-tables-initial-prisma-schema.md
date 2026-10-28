---
baseline_commit: 217ea212f0fcb0b38dc9055832ecae5eb7c4789c
---

# Story 0.4: Master Geographic Tables & Initial Prisma Schema

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system architect,
I want Prisma database models for Saudi administrative divisions (City and District) with relational constraints, composite foreign keys, comprehensive geographic seeds, and a dedicated Master Data API service in `apps/api`,
So that property listings and buyer demands can be strictly bound to validated geographical entities without free-text divergence, and frontend components can consume hierarchical cascading location data.

## Acceptance Criteria

1. **Prisma Schema Master Geographic Models & Constraints:**
   - **Given** `apps/api/prisma/schema.prisma`
   - **When** the schema is validated with `npx prisma validate`
   - **Then** `City` model is defined with:
     - `id`: String (`@id @default(uuid())`)
     - `nameAr`: String (Arabic name, e.g. "الرياض")
     - `nameEn`: String (English name, e.g. "Riyadh")
     - `isActive`: Boolean (`@default(true)`)
     - `createdAt`: DateTime (`@default(now())`)
     - Relations: `districts District[]`, `listings Listing[]`
     - Database table mapped to `cities` (`@@map("cities")`)
   - **And** `District` model is defined with:
     - `id`: String (`@id @default(uuid())`)
     - `cityId`: String
     - `nameAr`: String (Arabic name, e.g. "الملقا")
     - `nameEn`: String (English name, e.g. "Al-Malqa")
     - `isActive`: Boolean (`@default(true)`)
     - `createdAt`: DateTime (`@default(now())`)
     - Relations: `city City @relation(fields: [cityId], references: [id])`, `listings Listing[]`
     - Database table mapped to `districts` (`@@map("districts")`)
     - Composite unique constraint: `@@unique([id, cityId])` (per AD-9, AR5, AR11)
   - **And** `Listing` model enforces referential integrity:
     - `city City @relation(fields: [cityId], references: [id])`
     - `district District @relation(fields: [districtId, cityId], references: [id, cityId])`
     - Index on `@@index([status, propertyType, cityId, districtId])`.

2. **Initial Database Migration Baseline:**
   - **Given** the Prisma schema in `apps/api/prisma/schema.prisma`
   - **When** migration generation script is executed (`npm run prisma:migrate` or `prisma migrate dev`)
   - **Then** migration SQL script establishes `cities` and `districts` tables, primary keys, foreign keys, unique constraint `districts_id_city_id_key`, and core domain tables.

3. **Bilingual Saudi Geographic Seed Data (`prisma/seed.ts`):**
   - **Given** an initialized database
   - **When** `npx prisma db seed` (or `npm run prisma:seed`) is executed
   - **Then** the seed script populates 7 major Saudi cities with bilingual names:
     1. الرياض (Riyadh)
     2. جدة (Jeddah)
     3. الدمام (Dammam)
     4. مكة المكرمة (Mecca)
     5. المدينة المنورة (Medina)
     6. الطائف (Taif)
     7. الخبر (Khobar)
   - **And** populates official residential/commercial districts for each city (at least 5 prominent districts per city, e.g. Al-Malqa, Al-Narjis, Al-Yasmin, Al-Olaya, Al-Nakheel, Al-Sahafa for Riyadh; Al-Rawdah, Al-Shati, Al-Zahra, Al-Hamra, Obhur Al-Shamaliyah for Jeddah; etc.)
   - **And** all seeded cities and districts have `isActive: true`
   - **And** the seed script is idempotent (can be executed multiple times without duplicating records via `upsert`).

4. **Master Geographic REST API Endpoints (`GeoModule`):**
   - **Given** HTTP requests dispatched to `apps/api`
   - **When** `GET /api/v1/geo/cities` is called
   - **Then** returns a list of active cities ordered by `nameAr`, with optional query param `includeInactive=true` (restricted to admin or defaulted false)
   - **When** `GET /api/v1/geo/cities/:cityId/districts` is called
   - **Then** returns active districts belonging to the specified city ordered by `nameAr`
   - **And** if `:cityId` does not exist or is invalid UUID, returns HTTP 404 with standard error envelope `{ code: 'CITY_NOT_FOUND', message: '...', requestId: '...' }`
   - **When** `GET /api/v1/geo/tree` is called
   - **Then** returns a complete hierarchical tree of active cities with their active nested districts, structured for direct consumption by frontend cascading selector dropdowns (`UX-DR14`).

5. **Shared Geographic Schemas & Types (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported by client or server packages
   - **Then** exposes Zod validation schemas:
     - `citySchema`: validates city shape (`id`, `nameAr`, `nameEn`, `isActive`)
     - `districtSchema`: validates district shape (`id`, `cityId`, `nameAr`, `nameEn`, `isActive`)
     - `geoTreeResponseSchema`: validates hierarchical city and district list
     - Updates `createListingSchema` to require `cityId` (UUID) and `districtId` (UUID) in addition to/replacing free-text `city` / `district`, rejecting unvalidated free text at the API boundary (per AD-9, UX-DR14).
   - **And** exposes TypeScript types: `City`, `District`, `CityWithDistricts`, `GeoTreeItem`.

6. **Automated Unit & Integration Verification:**
   - **Given** test suites in `apps/api` and `packages/shared`
   - **When** `npm test` is executed across the monorepo
   - **Then** 100% of tests pass:
     - `GeoService` unit tests verifying city retrieval, district filtering by city, non-existent city 404 handling, and hierarchical tree generation.
     - `GeoController` unit tests verifying HTTP endpoints, query parameter handling, and response payloads.
     - `packages/shared` tests verifying `geoSchema` validation rules and `createListingSchema` UUID validation.
     - `npm run lint` and `npm run build` pass without errors across all monorepo workspaces.

## Tasks / Subtasks

- [ ] Task 1: Verify & Refine Prisma Schema Models & Relations (AC: 1, AC: 2)
  - [ ] 1.1 Inspect `apps/api/prisma/schema.prisma` to verify `City` and `District` models:
    - Ensure fields: `id` (uuid), `nameAr`, `nameEn`, `isActive` (`Boolean @default(true)`), `createdAt`.
    - Ensure `District` declares `cityId String`, relation `city City @relation(fields: [cityId], references: [id])`, and composite unique constraint `@@unique([id, cityId])`.
    - Ensure table mappings `@@map("cities")` and `@@map("districts")`.
  - [ ] 1.2 Verify `Listing` model relation to `District`:
    - Confirm composite foreign key `district District @relation(fields: [districtId, cityId], references: [id, cityId])` and `city City @relation(fields: [cityId], references: [id])`.
    - Confirm index `@@index([status, propertyType, cityId, districtId])`.
  - [ ] 1.3 Verify `Demand` model geographic fields in `schema.prisma`:
    - Align `cityId` and optional `districtId` referencing master tables while preserving backward compatibility.
  - [ ] 1.4 Validate Prisma schema syntax via `npx prisma validate --schema=apps/api/prisma/schema.prisma`.

- [ ] Task 2: Implement Comprehensive Bilingual Saudi Geographic Seed Script (AC: 3)
  - [ ] 2.1 Create `apps/api/prisma/seed.ts`:
    - Initialize Prisma client instance.
    - Define geographic dataset with 7 major Saudi cities:
      - Riyadh (الرياض)
      - Jeddah (جدة)
      - Dammam (الدمام)
      - Mecca (مكة المكرمة)
      - Medina (المدينة المنورة)
      - Taif (الطائف)
      - Khobar (الخبر)
    - Define official districts for each city (minimum 5-8 prominent districts per city with authentic Arabic and English transliterated names).
  - [ ] 2.2 Implement idempotent seeding using `prisma.city.upsert` and `prisma.district.upsert` based on deterministic IDs or unique composite constraints.
  - [ ] 2.3 Update `apps/api/package.json`:
    - Add `"prisma": { "seed": "ts-node prisma/seed.ts" }`.
    - Add `"prisma:seed": "prisma db seed"`.
  - [ ] 2.4 Update root `package.json`:
    - Add `"prisma:seed": "npm run prisma:seed --workspace=apps/api"`.

- [ ] Task 3: Define Shared Geographic Schemas & Types in `packages/shared` (AC: 5)
  - [ ] 3.1 Create or update `packages/shared/src/schemas/geo.schema.ts` (or `packages/shared/src/schemas/index.ts`):
    - `citySchema`: `id` (uuid), `nameAr`, `nameEn`, `isActive`.
    - `districtSchema`: `id` (uuid), `cityId` (uuid), `nameAr`, `nameEn`, `isActive`.
    - `geoTreeItemSchema`: city with `districts: z.array(districtSchema)`.
    - Update `createListingSchema` to require `cityId: z.string().uuid()` and `districtId: z.string().uuid()`.
  - [ ] 3.2 Update `packages/shared/src/types/index.ts`:
    - Export `City`, `District`, `CityWithDistricts`, `GeoTreeItem`.
  - [ ] 3.3 Export all schemas and types from `packages/shared/src/index.ts`.
  - [ ] 3.4 Build `packages/shared` via `npm run build:shared` and verify type definitions are emitted.

- [ ] Task 4: Implement `GeoModule` in `apps/api` (AC: 4)
  - [ ] 4.1 Create `apps/api/src/modules/geo/geo.service.ts`:
    - Implement `getCities(includeInactive?: boolean)`: returns cities with `where: includeInactive ? undefined : { isActive: true }`, sorted by `nameAr ASC`.
    - Implement `getDistrictsByCity(cityId: string, includeInactive?: boolean)`: verifies city existence; if not found, throws `NotFoundException('المدينة المحددة غير موجودة')`; returns active districts sorted by `nameAr ASC`.
    - Implement `getGeoTree(includeInactive?: boolean)`: returns cities including their districts with nested `where: { isActive: true }`.
  - [ ] 4.2 Create `apps/api/src/modules/geo/geo.controller.ts`:
    - Route prefix: `geo` (mapped under `/api/v1/geo`).
    - Endpoint `GET /api/v1/geo/cities`: supports optional `@Query('includeInactive')`.
    - Endpoint `GET /api/v1/geo/cities/:cityId/districts`: validates `:cityId` parameter.
    - Endpoint `GET /api/v1/geo/tree`: returns complete hierarchical tree.
    - Add Swagger annotations (`@ApiTags('Geography')`, `@ApiOperation`, `@ApiResponse`).
  - [ ] 4.3 Create `apps/api/src/modules/geo/geo.module.ts`:
    - Import `PrismaModule`.
    - Provide `GeoService`.
    - Declare `GeoController`.
    - Export `GeoService`.
  - [ ] 4.4 Register `GeoModule` in `apps/api/src/app.module.ts`.

- [ ] Task 5: Testing, Linting & Verification (AC: 6)
  - [ ] 5.1 Create unit tests `apps/api/src/modules/geo/__tests__/geo.service.spec.ts`:
    - Mock `PrismaService`.
    - Test `getCities` filters active cities.
    - Test `getDistrictsByCity` returns districts for valid cityId.
    - Test `getDistrictsByCity` throws `NotFoundException` for invalid or unknown cityId.
    - Test `getGeoTree` returns hierarchical tree structure.
  - [ ] 5.2 Create unit tests `apps/api/src/modules/geo/__tests__/geo.controller.spec.ts`:
    - Test controller delegates calls to `GeoService` and returns proper payloads.
  - [ ] 5.3 Create unit tests `packages/shared/src/schemas/__tests__/geo.spec.ts`:
    - Test validation of valid and invalid city/district payloads.
    - Test `createListingSchema` with valid UUID `cityId` / `districtId`.
  - [ ] 5.4 Run monorepo test suites: `npm test` (verify 100% pass across `apps/api`, `apps/web`, `packages/shared`).
  - [ ] 5.5 Run monorepo lint: `npm run lint` across all workspaces.
  - [ ] 5.6 Run monorepo build: `npm run build` across all workspaces.

## Dev Notes

### Architecture Patterns & Technical Guardrails

- **Master Geographic Cascading Model (AD-9, AR5, AR11):**
  - Saudi administrative divisions are strictly governed by master reference tables `cities` and `districts`.
  - Free-text input for cities or districts is strictly forbidden on both client and server boundaries to prevent data fragmentation, misspelled search filters, and failed automated demand matching.
  - The `District` table maintains a composite unique constraint: `@@unique([id, cityId])`.
  - The `Listing` table references `District` via composite foreign key:
    ```prisma
    city     City     @relation(fields: [cityId], references: [id])
    district District @relation(fields: [districtId, cityId], references: [id, cityId])
    ```
    This ensures that a listing cannot reference a district belonging to a different city (referential consistency).

- **Soft Deactivation (`isActive: Boolean`) Guardrails (FR-53):**
  - Both `City` and `District` tables feature `isActive` flags (default `true`).
  - Deactivating a city or district must **never** break existing historical property listings, completed deals, or historical buyer demands.
  - Public discovery endpoints (`/api/v1/geo/cities`, `/api/v1/geo/cities/:cityId/districts`, `/api/v1/geo/tree`) return strictly `isActive: true` records by default.
  - Administrative management (via permission `Geo.Manage`) may pass `includeInactive=true` to inspect and manage disabled records.

- **Bilingual Support & RTL Optimization (UX-DR1, UX-DR14):**
  - Both `nameAr` (Arabic) and `nameEn` (English) are stored in the database.
  - Default ordering in API responses is sorted alphabetically by `nameAr` (Arabic collation) to optimize RTL presentation in Next.js cascading selector dropdowns.

- **Standard Error Envelope Compliance (AD-8):**
  - When a requested city is not found in `getDistrictsByCity`, the service throws a NestJS `NotFoundException`.
  - The global `HttpExceptionFilter` (implemented in Story 0.3) captures this exception and returns:
    ```json
    {
      "code": "CITY_NOT_FOUND",
      "message": "المدينة المحددة غير موجودة",
      "details": { "cityId": "..." },
      "requestId": "..."
    }
    ```

- **Idempotent Seeding Architecture:**
  - Seed records use fixed, deterministic UUIDs (or `upsert` matching on unique constraints `id` or composite `[id, cityId]`) to ensure repeated runs of `npm run prisma:seed` in CI/CD or local setup do not cause duplicate key errors or data drift.

### Source Tree Components to Touch / Create

- **Create:**
  - `apps/api/prisma/seed.ts`
  - `apps/api/src/modules/geo/geo.module.ts`
  - `apps/api/src/modules/geo/geo.controller.ts`
  - `apps/api/src/modules/geo/geo.service.ts`
  - `apps/api/src/modules/geo/__tests__/geo.service.spec.ts`
  - `apps/api/src/modules/geo/__tests__/geo.controller.spec.ts`
  - `packages/shared/src/schemas/geo.schema.ts` (or in `schemas/index.ts`)
  - `packages/shared/src/types/geo.ts` (or in `types/index.ts`)
  - `packages/shared/src/schemas/__tests__/geo.spec.ts`

- **Modify / Verify:**
  - `apps/api/prisma/schema.prisma` (verify models, relations, composite uniqueness)
  - `apps/api/package.json` (add `"prisma": { "seed": "ts-node prisma/seed.ts" }` and `"prisma:seed"`)
  - `apps/api/src/app.module.ts` (register `GeoModule`)
  - `packages/shared/src/schemas/index.ts` (export geo schemas and update `createListingSchema`)
  - `packages/shared/src/types/index.ts` (export geo types)
  - `packages/shared/src/index.ts` (re-export geo members)
  - `package.json` (root: expose `prisma:seed` workspace script)

### Existing Code Analysis (UPDATE Targets)

1. **`apps/api/prisma/schema.prisma`:**
   - *Current state:* Defines `City` and `District` models with `nameAr`, `nameEn`, `isActive`, `@@unique([id, cityId])`, and `Listing` composite foreign key. `Demand` currently has `city String` and `districts Json`.
   - *What this story changes:* Verifies schema validity, ensures `prisma validate` passes, and aligns `Demand` or related models to reference `cityId` / `districtId`.
   - *What must be preserved:* All existing enums (`UserRole`, `ProfileStatus`, `ListingStatus`, `DealStatus`, etc.) and models (`User`, `ConsentRecord`, `Listing`, `Deal`, `Payment`, etc.).

2. **`apps/api/package.json`:**
   - *Current state:* Contains NestJS and Prisma dependencies, scripts `prisma:generate`, `prisma:migrate`, `prisma:studio`. Missing `"prisma"` configuration block and `"prisma:seed"` script.
   - *What this story changes:* Adds `"prisma": { "seed": "ts-node prisma/seed.ts" }` and `"prisma:seed": "prisma db seed"`.
   - *What must be preserved:* All existing scripts (`build`, `start`, `dev`, `test`, `lint`) and dependencies.

3. **`apps/api/src/app.module.ts`:**
   - *Current state:* Imports `ConfigModule`, `ThrottlerModule`, `ScheduleModule`, `PrismaModule`, `HealthModule`, `StorageModule`, and applies `RequestIdMiddleware`.
   - *What this story changes:* Imports and registers `GeoModule`.
   - *What must be preserved:* All existing module imports, middleware configuration for `RequestIdMiddleware`.

4. **`packages/shared/src/schemas/index.ts`:**
   - *Current state:* Exports IBAN, mobile, national ID, and listing schemas. `createListingSchema` currently uses `city: z.string().min(2)` and `district: z.string().min(2)`.
   - *What this story changes:* Exports `citySchema`, `districtSchema`, `geoTreeResponseSchema`, and updates `createListingSchema` to accept `cityId: z.string().uuid()` and `districtId: z.string().uuid()` (while supporting optional legacy text during migration).
   - *What must be preserved:* `validateSaudiIban`, `saudiIbanSchema`, `saudiMobileSchema`, `saudiNationalIdSchema`, `falLicenseSchema`, and existing exports.

5. **`packages/shared/src/types/index.ts`:**
   - *Current state:* Exports DTO types and summaries.
   - *What this story changes:* Exports `City`, `District`, `CityWithDistricts`, `GeoTreeItem`.
   - *What must be preserved:* `ApiResponse`, `PaginatedResponse`, `PropertyListingSummary`, `DealSummary`.

### Seed Geographic Dataset Details (7 Major Saudi Cities & Key Districts)

1. **الرياض (Riyadh) - Capital & Central Province:**
   - Districts: الملقا (Al-Malqa), النرجس (Al-Narjis), الياسمين (Al-Yasmin), العليا (Al-Olaya), النخيل (Al-Nakheel), الصحافة (Al-Sahafa), الربيع (Al-Rabi), حطين (Hittin).
2. **جدة (Jeddah) - Western Province / Red Sea:**
   - Districts: الروضة (Al-Rawdah), الشاطئ (Al-Shati), الزهراء (Al-Zahra), الحمراء (Al-Hamra), السلامة (Al-Salamah), أبحر الشمالية (Obhur Al-Shamaliyah).
3. **الدمام (Dammam) - Eastern Province:**
   - Districts: الفيصلية (Al-Faisaliyah), الريان (Al-Rayan), الشاطئ الغربي (Al-Shati Al-Gharbi), المريكبات (Al-Muraikabat), الزهور (Al-Zuhour).
4. **مكة المكرمة (Mecca) - Western Province:**
   - Districts: العوالي (Al-Awali), الشوقية (Al-Shawqiyyah), الرصيفة (Al-Rusaifah), الكعكية (Al-Kakiyyah), بطحاء قريش (Batha Quraish).
5. **المدينة المنورة (Medina) - Western Province:**
   - Districts: القبلتين (Al-Qiblatayn), قباء (Quba), العزيزية (Al-Aziziyah), سيد الشهداء (Sayyid Al-Shuhada), الحرم (Al-Haram).
6. **الطائف (Taif) - Western Province:**
   - Districts: الحوية (Al-Hawiyah), الشهار (Al-Shahar), الهدا (Al-Hada), الردف (Al-Radaf), الفيصلية (Al-Faisaliyah).
7. **الخبر (Khobar) - Eastern Province:**
   - Districts: الحزام الذهبي (Al-Hizam Al-Thahabi), الحزام الأخضر (Al-Hizam Al-Akhdar), الراكة الجنوبية (Al-Rakah Al-Janubiyah), الخبر الشمالية (Al-Khobar Al-Shamaliyah), العليا (Al-Ulaya).

### Testing Standards Summary

- **Test Frameworks:**
  - `apps/api`: Jest (`npm run test --workspace=apps/api`)
  - `packages/shared`: Vitest (`npm run test --workspace=packages/shared`)
  - `apps/web`: Vitest (`npm run test --workspace=apps/web`)
- **Required Test Cases:**
  1. `GeoService.getCities`: returns active cities array ordered by `nameAr`.
  2. `GeoService.getDistrictsByCity`: returns districts matching `cityId`; throws `NotFoundException` if city does not exist.
  3. `GeoService.getGeoTree`: returns cities with nested districts.
  4. `GeoController`: verifies HTTP GET routes `/api/v1/geo/cities`, `/api/v1/geo/cities/:cityId/districts`, `/api/v1/geo/tree`.
  5. `packages/shared/src/schemas/__tests__/geo.spec.ts`: verifies Zod validation for valid/invalid city and district payloads.
  6. Idempotent seed validation: verifying `prisma/seed.ts` compiles and runs cleanly without runtime syntax errors.

### Project Structure Notes

- Alignment with unified project structure:
  - Database schema & seed scripts located under `apps/api/prisma/`.
  - Geo REST module located under `apps/api/src/modules/geo/`.
  - Shared validation contracts in `packages/shared/src/schemas/`.
  - Shared TypeScript interfaces in `packages/shared/src/types/`.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-9 — Master Data Geography]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#2. Geographic Master Data (District, City) & Composite Keys]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.4: Master Geographic Tables & Initial Prisma Schema]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR11 / FR53 / AR5 / AR11]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md#7. Cascading City & District Selector (FR-53)]
- [Source: _bmad-output/implementation-artifacts/0-3-same-origin-api-proxy-http-presentation-boundary.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

<!-- To be populated during development -->

### Completion Notes List

<!-- To be populated during development -->

### File List

<!-- To be populated during development -->

### Change Log

<!-- To be populated during development -->
