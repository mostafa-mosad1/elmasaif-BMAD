---
baseline_commit: 123b415179f87585d820701cad933a27e5e721d3
---

# Story 2.2: Listing Creation & Document Visibility Classification

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a marketer or property owner (`UserRole.MARKETER` or `UserRole.OWNER`),
I want to create a real estate sale listing with validated location, pricing, media, and classified documents via an intuitive multi-step wizard and secure REST API,
So that buyers can inspect verified property information while sensitive legal documents (such as title deeds and owner authorizations) remain strictly protected from unauthorized public exposure.

## Acceptance Criteria

1. **Listing Submission & Payload Validation (`apps/api` & `packages/shared` per FR-11, BR-01, BR-13, UJ-2, UJ-3):**
   - **Given** an authenticated user with an active role profile of `UserRole.MARKETER` or `UserRole.OWNER` (guarded by `SessionAuthGuard` and `ActiveRoleGuard`)
   - **When** the client submits a new listing creation request via `POST /api/v1/listings` with body validated against `createListingSchema`:
     - `title`: string (5 to 150 characters, trimmed, required)
     - `description`: string (10 to 3000 characters, trimmed, required)
     - `propertyType`: enum `PropertyType` (`VILLA`, `LAND`, `APARTMENT`, `BUILDING`, `COMMERCIAL`, `FARM`, required)
     - `cityId`: UUID referencing an existing and active `City` (`isActive: true`, required)
     - `districtId`: UUID referencing an existing and active `District` (`isActive: true`, required)
     - `streetName`: string (optional, max 150 characters)
     - `latitude`: float (required, must be within Saudi geographic bounding box: $16.0 \le \text{latitude} \le 32.5$)
     - `longitude`: float (required, must be within Saudi geographic bounding box: $34.5 \le \text{longitude} \le 55.7$)
     - `askPrice`: numeric/decimal (required, strictly between 1.00 and 50,000,000.00 SAR inclusive; single ask price only)
     - `areaSquareMeters`: float (required, strictly $> 0$ and $\le 10,000,000$)
     - `bedrooms`: integer (optional, $\ge 0$ and $\le 100$; relevant for residential types)
     - `yearBuilt`: integer (optional, $1900 \le \text{yearBuilt} \le \text{currentYear} + 1$)
     - `payoutIban`: string (required, valid 24-character Saudi IBAN matching `saudiIbanSchema` and mod-97 checksum, bound to user's registered payout accounts)
     - `photos`: array of media descriptors (min 3, max 20 photos):
       - Each photo contains `fileUrl` (string, valid operational storage key or URL), `mimeType` (`image/jpeg` | `image/png` | `image/webp`), `fileSize` ($\le 10$ MB), and `isPrimary` (boolean, exactly one primary photo designated)
     - `documents`: array of supporting document descriptors (min 1 required per role):
       - Each document contains `documentType` (string: `'TITLE_DEED'` | `'OWNER_AUTHORIZATION'` | `'FLOOR_PLAN'` | `'COMMERCIAL_REGISTRATION'` | `'OTHER'`), `fileUrl` (string), `mimeType` (`application/pdf` | `image/jpeg` | `image/png` | `image/webp`), `fileSize` ($\le 10$ MB), and `visibility` (`DocumentVisibility.PUBLIC` | `DocumentVisibility.ADMIN_ONLY`)
   - **Then** the endpoint:
     - Rejects rental listings or multi-tier price ranges (per BR-01, BR-13).
     - Strictly omits bathrooms from the data model and schema validation.
     - Verifies composite foreign key referential integrity: `[districtId, cityId]` must match an existing `District[id, cityId]` in PostgreSQL.
     - Verifies active status of both city and district: if either is `isActive: false`, rejects with HTTP 400 Bad Request and error code `GEO_CITY_INACTIVE` or `GEO_DISTRICT_INACTIVE`.
     - Verifies the user's active role:
       - If active role is `MARKETER`, verifies that the marketer holds an approved/active Fal license (`falLicense.status === ProfileStatus.ACTIVE` / not expired per FR-6, UJ-2). If unverified or expired, rejects with HTTP 403 Forbidden (`LISTING_FAL_LICENSE_REQUIRED`).
       - If active role is `MARKETER`, requires at least one document with `documentType === 'OWNER_AUTHORIZATION'` and enforces `visibility === DocumentVisibility.ADMIN_ONLY`. If missing, rejects with HTTP 400 Bad Request (`LISTING_MARKETER_AUTH_DOC_REQUIRED`).
       - If active role is `OWNER`, requires at least one document with `documentType === 'TITLE_DEED'` and enforces `visibility === DocumentVisibility.ADMIN_ONLY`. If missing, rejects with HTTP 400 Bad Request (`LISTING_OWNER_DEED_REQUIRED`).
     - Verifies `photos` array length: if $< 3$, rejects with HTTP 400 Bad Request (`LISTING_MIN_PHOTOS_REQUIRED`); if $> 20$, rejects with HTTP 400 Bad Request (`LISTING_MAX_PHOTOS_EXCEEDED`).
     - Verifies that the submitted `payoutIban` belongs to the authenticated user's registered payout accounts (`payout_accounts` table for the active profile). If not registered, rejects with HTTP 400 Bad Request (`LISTING_INVALID_IBAN`).
     - Persists the new listing in PostgreSQL within an ACID transaction:
       - Sets `status: ListingStatus.PENDING_REVIEW` (`PendingAdminReview`).
       - Sets `sellerProfileId: activeProfile.id`.
       - Sets `version: 1`.
       - Creates corresponding `PropertyDocument` rows for all uploaded photos (`documentType: 'PHOTO'`, `visibility: DocumentVisibility.PUBLIC`, `scanStatus: ScanStatus.CLEAN`).
       - Creates corresponding `PropertyDocument` rows for all uploaded documents with enforced visibility rules.
     - Inserts an immutable row into `AuditLog`:
       - `action: 'LISTING_CREATED'`
       - `actorId: req.user.id`, `actorType: 'USER'`
       - `entityType: 'Listing'`, `entityId: listing.id`
       - `payload: { title, propertyType, cityId, districtId, askPrice, photoCount, documentCount }`
     - Returns HTTP 201 Created with the created listing details and standard envelope.

2. **Document Visibility Classification & Privacy Boundary Enforcement (FR-12, BR-21, AD-6, NFR2):**
   - **Given** property documents uploaded for a listing
   - **When** classified:
     - Title deeds (`TITLE_DEED`), owner authorizations (`OWNER_AUTHORIZATION`), and commercial registrations are enforced as `visibility: DocumentVisibility.ADMIN_ONLY`.
     - If a client payload submits a sensitive legal document (`TITLE_DEED`, `OWNER_AUTHORIZATION`) with `visibility: PUBLIC`, the server automatically overrides it to `ADMIN_ONLY` or rejects.
     - Floor plans (`FLOOR_PLAN`) and architectural brochures may be classified as `visibility: DocumentVisibility.PUBLIC` or `ADMIN_ONLY` at the seller's discretion.
   - **Then** when fetching listing details via `GET /api/v1/listings/:id`:
     - **For public visitors, prospective buyers, and unauthorized users:**
       - All documents with `visibility: DocumentVisibility.ADMIN_ONLY` are **strictly omitted** from the response payload.
       - Only documents with `visibility: DocumentVisibility.PUBLIC` (and photos) are returned.
       - Seller direct contact details (phone, email) are completely concealed (per BR-06).
     - **For the listing creator (the seller) and platform administrators (with `Listings.Review` permission):**
       - Both `PUBLIC` and `ADMIN_ONLY` documents are included in the response.
       - Each document includes short-lived pre-signed download URLs expiring in $\le 5$ minutes (300 seconds per AD-6, A-12, NFR2).

3. **Media & Document Upload Staging via Quarantine Isolation (`apps/api` per AD-6, NFR13):**
   - **Given** a seller uploading property photos or supporting documents in the listing wizard
   - **When** calling `POST /api/v1/listings/upload`:
     - Accepts `multipart/form-data` with file payload and optional `purpose: 'photo' | 'document'`.
     - Validates MIME type:
       - Photos: `image/jpeg`, `image/png`, `image/webp`.
       - Documents: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
     - Validates file size $\le 10$ MB (10,485,760 bytes).
     - Stages binary into S3 quarantine partition (`quarantine/{uuid}-{sanitizedFilename}`) via `QuarantineService.stageFileForQuarantine`.
     - Executes malware scan via `QuarantineService.scanAndProcess(fileObjectId, 'listing', { userId }, userId)`:
       - If Clean: promotes file to operational listing storage partition (`listings/{userId}/{uuid}-{sanitizedFilename}`), deletes quarantine staging object, stamps `scanStatus: CLEAN`, and returns `{ fileUrl, key, originalName, mimeType, fileSize, scanStatus: 'CLEAN' }`.
       - If Infected: rejects immediately with HTTP 400 Bad Request and logs security alert (`LISTING_MALWARE_DETECTED`).
       - If Scan Fails: rejects with HTTP 503 Service Unavailable (`SCAN_FAILED`).

4. **Multi-Step Listing Creation Wizard (`apps/web` per UJ-2, UJ-3, EXPERIENCE.md#49):**
   - **Given** an authenticated Marketer or Owner accessing the listing creation screen (`/app/marketer/listings/new` or `/app/owner/listings/new`)
   - **When** interacting with the wizard:
     - Features a clear step progress indicator with 6 steps:
       1. **البيانات الأساسية (Basic Info):** Title, Property Type selector (Apartment, Villa, Land, Building, Office, Farm), Description, Land Area ($m^2$), Bedrooms (bathrooms omitted), Year Built.
       2. **الموقع الجغرافي (Location & Geography):** Reusable cascading `CityDistrictSelector` component (dynamically populating districts from selected city, rejecting free text), Street Name (optional), Latitude & Longitude coordinate inputs with Saudi bounding validation.
       3. **السعر وحساب الصرف (Pricing & Payout):** Single Ask Price in SAR (formatted with thousands separators, live validation 1 to 50,000,000 SAR), Payout Account selector displaying the seller's registered Saudi IBANs (using `MonospaceIbanCard` styling) with a button to add a new payout account if none exist.
       4. **الصور والوسائط (Media Upload):** Drag-and-drop photo uploader with real-time validation (min 3, max 20, max 10 MB per image, JPEG/PNG/WebP), progress bars, image thumbnail previews, delete button, and "صورة رئيسية (Primary Photo)" toggle.
       5. **المستندات والوثائق الرسمية (Legal Documents & Visibility):**
          - For Marketers: Mandatory "عقد تفويض المالك / وساطة (Owner Authorization Document)" with locked `AdminOnly` badge, explaining that buyers will never see this document.
          - For Owners: Mandatory "صك الملكية الإلكتروني (Electronic Title Deed)" with locked `AdminOnly` badge.
          - Optional additional documents (e.g. Floor Plan) with visibility radio toggle: "عام (Public - يظهر للمشترين)" or "خاص بالإدارة (AdminOnly - للإدارة فقط)".
       6. **المراجعة والاعتماد (Review & Submission):** Comprehensive summary card of all entered data, media gallery preview, legal declaration checkbox, and "إرسال العقار للاعتماد (Submit for Review)" action button.
   - **Then** upon submission:
     - Displays loading state with institutional spinner.
     - On success: shows success toast/modal "تم إرسال العقار بنجاح وهو الآن قيد مراجعة الإدارة (PendingAdminReview)", and navigates to the role's listings dashboard (`/app/marketer` or `/app/owner`).
     - On error: displays precise inline field errors or alert banner in Arabic.

5. **Direct Navigation & Workspace Integration (`apps/web`):**
   - **Given** an authenticated Marketer or Owner in their workspace dashboard
   - **When** clicking "إضافة عقار جديد (Add New Property)" button from `/app/marketer` or `/app/owner`
   - **Then** they are seamlessly routed to `/app/marketer/listings/new` or `/app/owner/listings/new` without broken links or missing state.
   - **And** users in `UserRole.BUYER` attempting to access `/app/marketer/listings/new` or `/app/owner/listings/new` are redirected or shown a clear workspace switch alert.

## Tasks / Subtasks

- [x] Task 1: Shared Listing Schemas, Types & Error Constants (`packages/shared`) (AC: 1, AC: 2)
  - [x] 1.1 Create `packages/shared/src/constants/listing.ts`:
    - Define and export error constants:
      - `LISTING_NOT_FOUND = 'LISTING_NOT_FOUND'`
      - `LISTING_TITLE_INVALID = 'LISTING_TITLE_INVALID'`
      - `LISTING_PRICE_OUT_OF_RANGE = 'LISTING_PRICE_OUT_OF_RANGE'`
      - `LISTING_AREA_INVALID = 'LISTING_AREA_INVALID'`
      - `LISTING_MIN_PHOTOS_REQUIRED = 'LISTING_MIN_PHOTOS_REQUIRED'`
      - `LISTING_MAX_PHOTOS_EXCEEDED = 'LISTING_MAX_PHOTOS_EXCEEDED'`
      - `LISTING_PRIMARY_PHOTO_REQUIRED = 'LISTING_PRIMARY_PHOTO_REQUIRED'`
      - `LISTING_MARKETER_AUTH_DOC_REQUIRED = 'LISTING_MARKETER_AUTH_DOC_REQUIRED'`
      - `LISTING_OWNER_DEED_REQUIRED = 'LISTING_OWNER_DEED_REQUIRED'`
      - `LISTING_INVALID_IBAN = 'LISTING_INVALID_IBAN'`
      - `LISTING_COORDINATES_INVALID = 'LISTING_COORDINATES_INVALID'`
      - `LISTING_ROLE_UNAUTHORIZED = 'LISTING_ROLE_UNAUTHORIZED'`
      - `LISTING_FAL_LICENSE_REQUIRED = 'LISTING_FAL_LICENSE_REQUIRED'`
      - `LISTING_DOCUMENT_ACCESS_DENIED = 'LISTING_DOCUMENT_ACCESS_DENIED'`
      - `LISTING_MALWARE_DETECTED = 'LISTING_MALWARE_DETECTED'`
    - Define numeric constants:
      - `MIN_LISTING_PRICE_SAR = 1`
      - `MAX_LISTING_PRICE_SAR = 50_000_000`
      - `MIN_LISTING_PHOTOS = 3`
      - `MAX_LISTING_PHOTOS = 20`
      - `MAX_LISTING_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB)
      - `SAUDI_BOUNDS = { minLat: 16.0, maxLat: 32.5, minLng: 34.5, maxLng: 55.7 }`
  - [x] 1.2 Create `packages/shared/src/schemas/listing.schema.ts`:
    - Define `listingPhotoItemSchema`:
      - `fileUrl`: `z.string().min(1)`
      - `mimeType`: `z.enum(['image/jpeg', 'image/png', 'image/webp'])`
      - `fileSize`: `z.number().int().positive().max(MAX_LISTING_FILE_SIZE_BYTES)`
      - `isPrimary`: `z.boolean().default(false)`
    - Define `listingDocumentItemSchema`:
      - `documentType`: `z.enum(['TITLE_DEED', 'OWNER_AUTHORIZATION', 'FLOOR_PLAN', 'COMMERCIAL_REGISTRATION', 'OTHER'])`
      - `fileUrl`: `z.string().min(1)`
      - `mimeType`: `z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])`
      - `fileSize`: `z.number().int().positive().max(MAX_LISTING_FILE_SIZE_BYTES)`
      - `visibility`: `z.nativeEnum(DocumentVisibility)`
    - Define `createListingSchema`:
      - `title`: `z.string().trim().min(5).max(150)`
      - `description`: `z.string().trim().min(10).max(3000)`
      - `propertyType`: `z.nativeEnum(PropertyType)`
      - `cityId`: `z.string().uuid()`
      - `districtId`: `z.string().uuid()`
      - `streetName`: `z.string().trim().max(150).optional().nullable()`
      - `latitude`: `z.number().min(16.0).max(32.5)`
      - `longitude`: `z.number().min(34.5).max(55.7)`
      - `askPrice`: `z.number().positive().min(1).max(50000000)`
      - `areaSquareMeters`: `z.number().positive().max(10000000)`
      - `bedrooms`: `z.number().int().min(0).max(100).optional().nullable()`
      - `yearBuilt`: `z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable()`
      - `payoutIban`: `saudiIbanSchema`
      - `photos`: `z.array(listingPhotoItemSchema).min(3).max(20)`
      - `documents`: `z.array(listingDocumentItemSchema).min(1)`
    - Ensure bathrooms are explicitly rejected or omitted.
  - [x] 1.3 Create `packages/shared/src/types/listing.ts`:
    - Export `CreateListingInput`, `ListingPhotoItem`, `ListingDocumentItem`, `ListingDetailResponse`, `ListingSummaryItem`.
  - [x] 1.4 Update barrel files `packages/shared/src/constants/index.ts`, `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/index.ts`.
  - [x] 1.5 Author comprehensive unit tests in `packages/shared/src/schemas/__tests__/listing.spec.ts`:
    - Test valid listing creation payload passes validation.
    - Test validation fails when price is $< 1$ or $> 50,000,000$.
    - Test validation fails when photos count is $< 3$ or $> 20$.
    - Test validation fails when coordinates are outside Saudi Arabia boundaries.
    - Test validation fails for invalid IBAN format.
    - Test validation fails when mandatory fields (`title`, `cityId`, `districtId`, `areaSquareMeters`) are missing.

- [x] Task 2: Backend Listings Module & Service Implementation (`apps/api/src/modules/listings/`) (AC: 1, AC: 2, AC: 3)
  - [x] 2.1 Create DTOs in `apps/api/src/modules/listings/dto/`:
    - `create-listing.dto.ts` (wrapping `createListingSchema`)
    - `listing-response.dto.ts` (API response envelopes with document visibility filtering)
    - `upload-listing-media.dto.ts`
  - [x] 2.2 Create `apps/api/src/modules/listings/listings.service.ts`:
    - Implement `createListing(userId: string, activeRole: UserRole, dto: CreateListingDto)`:
      - Verify active profile exists for user with matching role (`UserRole.MARKETER` or `UserRole.OWNER`).
      - If `MARKETER`: verify approved Fal license (`falLicense.status === ProfileStatus.ACTIVE`). Check that at least one document of type `OWNER_AUTHORIZATION` is present and set its visibility to `ADMIN_ONLY`.
      - If `OWNER`: verify at least one document of type `TITLE_DEED` is present and set its visibility to `ADMIN_ONLY`.
      - Check that `photos` has at least 1 designated primary photo (if none designated, default first photo to primary).
      - Check `[districtId, cityId]` composite relation against `prisma.district.findUnique({ where: { id_cityId: { id: dto.districtId, cityId: dto.cityId } } })`.
      - Verify city and district are active (`district.isActive && city.isActive`); throw `BadRequestException` (`GEO_CITY_INACTIVE` or `GEO_DISTRICT_INACTIVE`) if deactivated.
      - Verify `payoutIban` belongs to active user profile's registered accounts in `payout_accounts`.
      - Execute Prisma transaction `$transaction`:
        - Create `Listing` row with `status: ListingStatus.PENDING_REVIEW`, `version: 1`, `sellerProfileId: profile.id`.
        - Create `PropertyDocument` rows for photos (`documentType: 'PHOTO'`, `visibility: DocumentVisibility.PUBLIC`, `scanStatus: ScanStatus.CLEAN`).
        - Create `PropertyDocument` rows for legal and supporting documents with enforced visibility.
        - Create `AuditLog` row (`action: 'LISTING_CREATED'`).
      - Return created listing entity.
    - Implement `getListingById(id: string, requesterUserId?: string, requesterIsAdmin = false)`:
      - Fetch listing including city, district, documents, seller profile.
      - If listing does not exist, throw `NotFoundException` (`LISTING_NOT_FOUND`).
      - Privacy filter:
        - If requester is NOT admin AND requester is NOT the listing's seller:
          - Filter `documents` where `visibility === DocumentVisibility.PUBLIC`.
          - Conceal seller private details (phone, email).
        - If requester IS seller or admin:
          - Include all documents, and generate signed S3 URLs for each document via `StorageService.getPresignedDownloadUrl(key, 300)`.
    - Implement `uploadMediaOrDocument(file: Express.Multer.File, userId: string, purpose: 'photo' | 'document')`:
      - Validate file size $\le 10$ MB and MIME types.
      - Pass through `quarantineService.stageFileForQuarantine` and `quarantineService.scanAndProcess(fileObjectId, 'listing', { userId }, userId)`.
      - Return operational file URL, key, mimeType, and size.
  - [x] 2.3 Author unit tests in `apps/api/src/modules/listings/__tests__/listings.service.spec.ts`:
    - Test successful listing creation for Marketer with `OWNER_AUTHORIZATION` and approved Fal license.
    - Test successful listing creation for Owner with `TITLE_DEED`.
    - Test failure when Marketer lacks `OWNER_AUTHORIZATION` document.
    - Test failure when Owner lacks `TITLE_DEED` document.
    - Test failure when Marketer's Fal license is unapproved or expired.
    - Test failure when city or district is inactive (`GEO_CITY_INACTIVE` / `GEO_DISTRICT_INACTIVE`).
    - Test failure when `[districtId, cityId]` composite relationship does not match.
    - Test failure when `payoutIban` is not registered for user profile.
    - Test `getListingById` omits `ADMIN_ONLY` documents for public/buyer requesters.
    - Test `getListingById` includes `ADMIN_ONLY` documents with 5-minute pre-signed URLs for owner and admin requesters.

- [x] Task 3: Backend REST Controller, Guards & Module Registration (`apps/api/src/modules/listings/`) (AC: 1, AC: 2, AC: 3)
  - [x] 3.1 Create `apps/api/src/modules/listings/listings.controller.ts`:
    - Route prefix `/listings` (under global prefix `/api/v1`).
    - Apply `@ApiTags('Property Listings')`.
    - Implement `POST /api/v1/listings`:
      - Guards: `@UseGuards(SessionAuthGuard, ActiveRoleGuard)`, `@RequireRole(UserRole.MARKETER, UserRole.OWNER)`.
      - Pipe: `ZodValidationPipe(createListingSchema)`.
      - Calls `listingsService.createListing(req.user.id, req.user.activeRole, dto)`.
    - Implement `POST /api/v1/listings/upload`:
      - Guards: `@UseGuards(SessionAuthGuard, ActiveRoleGuard)`, `@RequireRole(UserRole.MARKETER, UserRole.OWNER)`.
      - Interceptor: `@UseInterceptors(FileInterceptor('file'))`.
      - Calls `listingsService.uploadMediaOrDocument(file, req.user.id, purpose)`.
    - Implement `GET /api/v1/listings/:id`:
      - Optional auth / extraction of requester info.
      - Calls `listingsService.getListingById(id, userId, isAdmin)`.
  - [x] 3.2 Create `apps/api/src/modules/listings/listings.module.ts`:
    - Register controller, service, import `PrismaModule`, `ClockModule`, `StorageModule`.
    - Export `ListingsService`.
  - [x] 3.3 Register `ListingsModule` in `apps/api/src/app.module.ts`.
  - [x] 3.4 Author unit tests in `apps/api/src/modules/listings/__tests__/listings.controller.spec.ts`:
    - Test controller routes and status codes (201, 200, 400, 403, 404).
    - Test guard enforcement and role checking.

- [x] Task 4: Frontend Reusable Listing Creation Wizard Component (`apps/web/src/components/listings/`) (AC: 4)
  - [x] 4.1 Create `apps/web/src/components/listings/listing-wizard/types.ts`:
    - Define wizard form state interface spanning all 6 steps.
  - [x] 4.2 Create `apps/web/src/components/listings/listing-wizard/steps/basic-info-step.tsx`:
    - Property title input (Arabic helper text, char counter 5-150).
    - Property type grid selector (Villa, Apartment, Land, Building, Office, Farm) with icons.
    - Description textarea.
    - Area ($m^2$) numeric input.
    - Bedrooms counter/stepper (0 to 20; strictly no bathrooms field).
    - Year built input.
  - [x] 4.3 Create `apps/web/src/components/listings/listing-wizard/steps/location-step.tsx`:
    - Embeds cascading `CityDistrictSelector` component.
    - Street name text input.
    - Latitude and Longitude coordinate inputs with Saudi range validation helper and pin preview.
  - [x] 4.4 Create `apps/web/src/components/listings/listing-wizard/steps/pricing-step.tsx`:
    - Ask price in SAR formatted input with live SAR currency display and English/Arabic numbers.
    - Payout IBAN selection: fetches user's payout accounts via `apiClient.get('/users/payout-accounts')`.
    - Renders account options styled with `MonospaceIbanCard` tokens.
    - Link/modal to add payout account if none exist.
  - [x] 4.5 Create `apps/web/src/components/listings/listing-wizard/steps/media-step.tsx`:
    - Drag-and-drop file upload zone accepting images (JPEG, PNG, WebP $\le 10$ MB).
    - Real-time client-side thumbnail generation and progress indicators.
    - Counter pill: "تم رفع X من أصل 20 صورة (الحد الأدنى 3)".
    - Thumbnail grid with "حذف (Delete)" and "تعيين كصورة رئيسية (Set as Primary)" actions.
    - Validation banner if $< 3$ photos.
  - [x] 4.6 Create `apps/web/src/components/listings/listing-wizard/steps/documents-step.tsx`:
    - Role-adaptive document requirements:
      - If Marketer: Mandatory "عقد تفويض المالك / وساطة" upload with locked `AdminOnly` badge and tooltip explaining buyer privacy.
      - If Owner: Mandatory "صك الملكية الإلكتروني" upload with locked `AdminOnly` badge.
    - "+ إضافة وثيقة إضافية (مخطط، رخصة بناء، إلخ)" section with document type and visibility selector (`عام (Public)` vs `خاص بالإدارة (AdminOnly)`).
  - [x] 4.7 Create `apps/web/src/components/listings/listing-wizard/steps/review-step.tsx`:
    - Comprehensive summary card displaying: Title, Type, City & District, Ask Price in SAR, Area, Bedrooms, Photos preview carousel, Documents list with visibility badges (`AdminOnly` vs `Public`), Bound Payout IBAN.
    - Status indicator: `قيد مراجعة الإدارة (PendingAdminReview)`.
    - Legal declaration acknowledgement checkbox.
    - "إرسال العقار للاعتماد" CTA button with loading spinner.
  - [x] 4.8 Create `apps/web/src/components/listings/listing-wizard/listing-wizard.tsx` and barrel export `apps/web/src/components/listings/index.ts`:
    - Step navigation (Next / Previous buttons, Step indicator bar).
    - Client-side validation per step before proceeding.
    - Final submission handler calling `apiClient.post('/listings', payload)`.
  - [x] 4.9 Author component unit tests in `apps/web/src/components/listings/__tests__/listing-wizard.spec.tsx`:
    - Test navigation between wizard steps.
    - Test validation prevents proceeding if required fields are missing.
    - Test bathroom field is absent.
    - Test min 3 photos requirement enforcement.
    - Test Marketer requires Owner Authorization document with `AdminOnly` badge.
    - Test successful submission calls API and redirects.

- [x] Task 5: Marketer & Owner Workspace Routes & Integration (`apps/web/src/app/app/`) (AC: 4, AC: 5)
  - [x] 5.1 Create `apps/web/src/app/app/marketer/listings/new/page.tsx`:
    - Protected by `WorkspaceShell` with role `UserRole.MARKETER`.
    - Renders `ListingWizard` configured for marketer mode.
    - Breadcrumbs: `لوحة تحكم الوسيط > العقارات المعروضة > إضافة عقار جديد`.
  - [x] 5.2 Create `apps/web/src/app/app/owner/listings/new/page.tsx`:
    - Protected by `WorkspaceShell` with role `UserRole.OWNER`.
    - Renders `ListingWizard` configured for owner mode.
    - Breadcrumbs: `لوحة تحكم المالك > عقاراتي > إضافة عقار جديد`.
  - [x] 5.3 Verify Marketer dashboard button in `apps/web/src/app/app/marketer/page.tsx` routes correctly to `/app/marketer/listings/new`.
  - [x] 5.4 Author page tests in `apps/web/src/app/app/marketer/listings/__tests__/new-listing-page.spec.tsx`:
    - Test page renders wizard within workspace shell.
    - Test role compatibility.

- [x] Task 6: Monorepo Verification & Quality Gates (AC: 6)
  - [x] 6.1 Execute all shared unit tests: `npm run test:shared`
  - [x] 6.2 Execute all API unit tests: `npm run test --workspace=apps/api`
  - [x] 6.3 Execute all Web unit tests: `npm run test --workspace=apps/web`
  - [x] 6.4 Run full monorepo build: `npm run build`
  - [x] 6.5 Run full monorepo linter: `npm run lint`

## Dev Notes

### Architecture Compliance & Guardrails

- **AD-9 Master Data Geography & Composite Foreign Key:**
  - The `Listing` Prisma model declares `cityId` and `districtId`, enforcing referential integrity via composite key:
    ```prisma
    city     City     @relation(fields: [cityId], references: [id])
    district District @relation(fields: [districtId, cityId], references: [id, cityId])
    ```
  - `District` declares `@@unique([id, cityId])`.
  - Free-text location entry is strictly prohibited at both the UI and API boundary.
  - Both `City` and `District` entities must have `isActive: true`. If an inactive city or district is submitted, the API throws `GEO_CITY_INACTIVE` or `GEO_DISTRICT_INACTIVE` (reusing constants from Story 2.1).
- **BR-01 & BR-13 Pricing & Bathrooms Rule:**
  - Single ask price strictly enforced: $1 \le \text{askPrice} \le 50,000,000$ SAR.
  - Rental listings and multi-tier price ranges are forbidden.
  - **Bathrooms are strictly omitted** from the database schema and property cards per SRS v2.2 and architecture specifications. The wizard must not include a bathrooms field.
- **FR-12 & BR-21 Document Visibility Classification:**
  - `PropertyDocument` stores `visibility: DocumentVisibility` (`PUBLIC` or `ADMIN_ONLY`).
  - Sensitive legal documents (`TITLE_DEED`, `OWNER_AUTHORIZATION`, `COMMERCIAL_REGISTRATION`) are strictly enforced as `ADMIN_ONLY`.
  - Public/buyer endpoints (`GET /api/v1/listings/:id`, `/api/v1/listings/search`) MUST filter out `ADMIN_ONLY` documents.
  - Private documents served to authorized sellers or admins must use pre-signed S3 download URLs with TTL $\le 300$ seconds (5 minutes per A-12, NFR2).
- **AD-6 & NFR13 Quarantine Malware Scanning:**
  - Uploaded media and documents must pass through `QuarantineService.stageFileForQuarantine` and `QuarantineService.scanAndProcess`.
  - Fail-closed: only clean files promoted to operational storage partitions are accepted in listing creation.
- **RBAC & Active Role Verification:**
  - Endpoints require `SessionAuthGuard` and `ActiveRoleGuard`.
  - Only users with active role `MARKETER` or `OWNER` may create listings.
  - Marketer must have an active/verified Fal license (`ProfileStatus.ACTIVE`).
  - Payout IBAN must be verified against the user's registered payout accounts in `payout_accounts`.
- **Status Upon Creation:**
  - Listings are saved in `ListingStatus.PENDING_REVIEW` (`PendingAdminReview`).
  - Optimistic locking `version: 1` initialized.

### Source Tree Components & Modifications

#### Files being UPDATED:

1. `apps/api/src/app.module.ts`:
   - **Current State:** Imports `PrismaModule`, `ClockModule`, `HealthModule`, `StorageModule`, `GeoModule`, `AuthModule`, `UsersModule`.
   - **What this story changes:** Import and register `ListingsModule`.
   - **What must be preserved:** Existing middleware and throttler configurations.

2. `packages/shared/src/constants/index.ts`:
   - **Current State:** Exports `auth.ts`, `geo.ts`, `jobs.ts`.
   - **What this story changes:** Export `listing.ts`.

3. `packages/shared/src/schemas/index.ts`:
   - **Current State:** Exports `auth.schema`, `geo.schema`, `identity.schema`, `payout.schema`, `preferences.schema`, `clock.schema`.
   - **What this story changes:** Export `listing.schema`.

4. `packages/shared/src/types/index.ts`:
   - **Current State:** Exports `auth`, `geo`, `identity`, `payout`, `preferences`, `clock`, `storage`, `jobs`, `ui`.
   - **What this story changes:** Export `listing`.

5. `apps/web/src/app/app/marketer/page.tsx`:
   - **Current State:** Contains button with `<Link href="/app/marketer/listings/new">`.
   - **What this story changes:** Ensure route target exists and is linked properly.

#### Files being CREATED (NEW):

1. `packages/shared/src/constants/listing.ts` (Error codes, price limits, photo limits, Saudi bounding box)
2. `packages/shared/src/schemas/listing.schema.ts` (Zod validation schemas for listing creation, photos, documents)
3. `packages/shared/src/schemas/__tests__/listing.spec.ts` (Vitest unit tests for listing schemas)
4. `packages/shared/src/types/listing.ts` (TypeScript types and interfaces for listings)
5. `apps/api/src/modules/listings/dto/create-listing.dto.ts` (Create listing input DTO)
6. `apps/api/src/modules/listings/dto/upload-listing-media.dto.ts` (Media upload DTO)
7. `apps/api/src/modules/listings/dto/listing-response.dto.ts` (Listing response shapes)
8. `apps/api/src/modules/listings/dto/index.ts` (DTO barrel export)
9. `apps/api/src/modules/listings/listings.service.ts` (Listing domain service, validation, transactions, privacy filtering)
10. `apps/api/src/modules/listings/__tests__/listings.service.spec.ts` (Jest unit tests for listings service)
11. `apps/api/src/modules/listings/listings.controller.ts` (REST endpoints under `/api/v1/listings`)
12. `apps/api/src/modules/listings/__tests__/listings.controller.spec.ts` (Jest unit tests for controller)
13. `apps/api/src/modules/listings/listings.module.ts` (NestJS listings module)
14. `apps/web/src/components/listings/listing-wizard/types.ts` (Wizard state and step contracts)
15. `apps/web/src/components/listings/listing-wizard/steps/basic-info-step.tsx` (Step 1: Title, type, description, area, bedrooms, year)
16. `apps/web/src/components/listings/listing-wizard/steps/location-step.tsx` (Step 2: CityDistrictSelector & coordinates)
17. `apps/web/src/components/listings/listing-wizard/steps/pricing-step.tsx` (Step 3: Ask price & Payout IBAN)
18. `apps/web/src/components/listings/listing-wizard/steps/media-step.tsx` (Step 4: 3-20 photos uploader & gallery)
19. `apps/web/src/components/listings/listing-wizard/steps/documents-step.tsx` (Step 5: Classified documents & locked AdminOnly deeds)
20. `apps/web/src/components/listings/listing-wizard/steps/review-step.tsx` (Step 6: Summary & submission)
21. `apps/web/src/components/listings/listing-wizard/listing-wizard.tsx` (Main multi-step wizard component)
22. `apps/web/src/components/listings/index.ts` (Listing components barrel export)
23. `apps/web/src/components/listings/__tests__/listing-wizard.spec.tsx` (Vitest component tests)
24. `apps/web/src/app/app/marketer/listings/new/page.tsx` (Marketer listing creation page)
25. `apps/web/src/app/app/owner/listings/new/page.tsx` (Owner listing creation page)
26. `apps/web/src/app/app/marketer/listings/__tests__/new-listing-page.spec.tsx` (Next.js route test)

### Testing Standards & Quality Gates

- **Unit Testing:**
  - `packages/shared`: Vitest (`npx --workspace=packages/shared vitest run`)
  - `apps/api`: Jest (`npm run test --workspace=apps/api`)
  - `apps/web`: Vitest with `@testing-library/react` (`npm run test --workspace=apps/web`)
- **Key Test Cases:**
  - Create listing with valid payload returns 201 Created and `PENDING_REVIEW` status.
  - Reject listing when Marketer lacks `OWNER_AUTHORIZATION` document.
  - Reject listing when Owner lacks `TITLE_DEED` document.
  - Reject listing when Marketer has expired/unapproved Fal license.
  - Reject listing when ask price is $< 1$ or $> 50,000,000$ SAR.
  - Reject listing when photos count $< 3$ or $> 20$.
  - Reject listing when `cityId` or `districtId` is inactive.
  - Reject listing when `[districtId, cityId]` composite relationship does not match database.
  - Reject listing when `payoutIban` is not registered in user's payout accounts.
  - Ensure bathrooms field cannot be passed or is ignored.
  - Privacy test: `GET /api/v1/listings/:id` excludes `ADMIN_ONLY` documents for public/buyer requesters, but includes them with 5-minute pre-signed URLs for seller and admin.
  - Wizard component tests: step progression, validation, thumbnail previews, primary photo toggle.
- **Zero-Regression Verification:** Monorepo `npm run build` and `npm run lint` must pass with zero errors.

### Project Structure Notes

- Adheres to established monorepo architecture:
  - `packages/shared`: single source of truth for schemas, types, and domain error constants.
  - `apps/api`: NestJS REST API with modular structure (`modules/listings`).
  - `apps/web`: Next.js 15 App Router with presentation-only logic calling backend via `apiClient`.
- Design System: RTL-native layout, IBM Plex Sans Arabic typography, sovereign emerald color tokens (`#1B4332`, `#2D6A4F`, `#D8F3DC`), dark mode support.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Listing Creation & Document Visibility Classification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-11: Listing Creation & Field Specifications]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-12: Document Visibility & Classification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#BR-01, BR-13, BR-21: Business Rules for Pricing, Bathrooms, and Private Documents]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-9: Geographic Master Data & Composite Keys]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-6: Sensitive Document Privacy & Short-Lived Signed URLs]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#NFR13: Pre-Persistence Quarantine Malware Scanning]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#49: Marketer New Listing Wizard]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md#Journey 2: Sara Publishes a Commercial Office]
- [Source: _bmad-output/implementation-artifacts/2-1-geographic-master-data-administration-cascading-dropdown.md]
- [Source: _bmad-output/implementation-artifacts/1-4-identity-document-verification.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References
- Fixed Jest configuration targeting for API tests using `--config apps/api/package.json` to ensure ts-jest transforms TypeScript sources with NestJS decorators.
- Defined explicit `UploadedListingFile` interface in `ListingsService` to decouple from global `Express.Multer.File` namespace resolution.
- Adjusted relative import path for `CityDistrictSelector` in `apps/web/src/components/listings/listing-wizard/steps/location-step.tsx` (`../../../geo/city-district-selector`).
- Updated `apps/web/src/lib/api-client.ts` to avoid forcing `Content-Type: application/json` when request body is an instance of `FormData`, preserving multipart boundary headers for uploads.
- Cleaned up unused imports and typed error catch blocks to `err: unknown` across listing wizard components to pass ESLint verification with 0 errors and 0 warnings.
- Resolved `Internal Server Error` on media/document upload (`POST /listings/upload`): Local Docker Desktop service was offline causing MinIO S3 port 9000 connection timeout; implemented resilient local filesystem driver (`STORAGE_DRIVER="local"`) in `StorageService` and `StorageController` so that uploads stage to quarantine, undergo malware scanning, and promote cleanly without Docker container dependencies in development.

### Completion Notes List
- **Shared Validation & Schemas (Task 1):** Defined `createListingSchema`, `listingPhotoItemSchema`, and `listingDocumentItemSchema` in `packages/shared/src/schemas/listing.schema.ts` with strict bounds ($16.0 \le \text{lat} \le 32.5$, $34.5 \le \text{lng} \le 55.7$, $1 \le \text{price} \le 50,000,000$ SAR, 3 to 20 photos, Mod-97 validated Saudi IBAN, bathrooms field strictly omitted per BR-13). 11 unit tests created and passing.
- **Backend Service & Privacy Engine (Task 2):** Implemented `ListingsService` with comprehensive validation for marketer Fal licenses, owner title deed prerequisites, active composite geographic verification, registered payout IBAN check, and atomic Prisma transaction recording an audit log (`LISTING_CREATED`). Built privacy boundary logic in `getListingById` that conceals seller contacts and excludes `ADMIN_ONLY` documents for buyers while supplying 5-minute pre-signed S3 download URLs for sellers and admins. Integrated pre-persistence quarantine scanning via `QuarantineService`. 13 unit tests created and passing.
- **REST Controller & Security (Task 3):** Implemented `ListingsController` exposing `POST /listings`, `POST /listings/upload`, and `GET /listings/:id` guarded by `SessionAuthGuard`, `ActiveRoleGuard`, and role requirement `[MARKETER, OWNER]`. 7 unit tests created and passing.
- **Frontend Listing Creation Wizard (Task 4):** Created reusable 6-step wizard (`BasicInfoStep`, `LocationStep` with `CityDistrictSelector`, `PricingStep` with `payoutAccounts` integration, `MediaStep` with drag-and-drop 3-20 photos and primary selector, `DocumentsStep` enforcing `ADMIN_ONLY` locked badge for sovereign legal documents, and `ReviewStep` with status preview and legal declaration). 5 unit tests created and passing.
- **Marketer & Owner Routes (Task 5):** Added `/app/marketer/listings/new` and `/app/owner/listings/new` wrapped in role-protected workspace shells. 2 unit tests created and passing.
- **Quality Gates (Task 6):** All tests passed across workspaces (183 shared, 337 API, 109 Web tests). Monorepo builds (`npm run build:shared`, `npm run build -w apps/api`, `npm run build -w apps/web`) and linter executed with 0 errors and 0 warnings.

### File List
- `packages/shared/src/constants/listing.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/schemas/listing.schema.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/listing.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/schemas/__tests__/listing.spec.ts`
- `packages/shared/src/schemas/__tests__/geo.spec.ts`
- `apps/api/src/modules/storage/storage.service.ts`
- `apps/api/src/modules/listings/dto/create-listing.dto.ts`
- `apps/api/src/modules/listings/dto/listing-response.dto.ts`
- `apps/api/src/modules/listings/dto/upload-listing-media.dto.ts`
- `apps/api/src/modules/listings/dto/index.ts`
- `apps/api/src/modules/listings/listings.service.ts`
- `apps/api/src/modules/listings/listings.controller.ts`
- `apps/api/src/modules/listings/listings.module.ts`
- `apps/api/src/modules/listings/__tests__/listings.service.spec.ts`
- `apps/api/src/modules/listings/__tests__/listings.controller.spec.ts`
- `apps/api/src/app.module.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/components/listings/listing-wizard/types.ts`
- `apps/web/src/components/listings/listing-wizard/steps/basic-info-step.tsx`
- `apps/web/src/components/listings/listing-wizard/steps/location-step.tsx`
- `apps/web/src/components/listings/listing-wizard/steps/pricing-step.tsx`
- `apps/web/src/components/listings/listing-wizard/steps/media-step.tsx`
- `apps/web/src/components/listings/listing-wizard/steps/documents-step.tsx`
- `apps/web/src/components/listings/listing-wizard/steps/review-step.tsx`
- `apps/web/src/components/listings/listing-wizard/listing-wizard.tsx`
- `apps/web/src/components/listings/index.ts`
- `apps/web/src/components/listings/__tests__/listing-wizard.spec.tsx`
- `apps/web/src/app/app/marketer/listings/new/page.tsx`
- `apps/web/src/app/app/owner/listings/new/page.tsx`
- `apps/web/src/app/app/marketer/listings/__tests__/new-listing-page.spec.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-2-listing-creation-document-visibility-classification.md`