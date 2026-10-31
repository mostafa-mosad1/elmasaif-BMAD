---
baseline_commit: 46f0e044753ce181a50207a94988a6febcca8f32
---

# Story 1.4: Identity Document Verification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a buyer preparing to participate in property transactions,
I want to upload my Saudi National ID or Iqama document for private verification,
So that my identity is verified before I execute high-value real estate transactions.

## Acceptance Criteria

1. **National Identity Document Upload & Validation (`apps/api` & `packages/shared` per FR-4, BR-10, UJ-1):**
   - **Given** an authenticated user (with a valid session cookie)
   - **When** the client submits a document upload request via `POST /api/v1/users/identity/upload` (using `multipart/form-data` with file field `file` and form field `documentType`)
   - **Then** the endpoint:
     - Validates the uploaded binary:
       - MIME type strictly restricted to: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
       - File size strictly capped at $\le 10$ MB (10,485,760 bytes per NFR2/NFR13).
       - Document type validated via `uploadIdentityDocumentSchema` as `NATIONAL_ID` or `IQAMA`.
       - ID number validated against `saudiNationalIdSchema` (10-digit numeric string starting with `1` for Saudi Citizen National ID or `2` for Saudi Resident Iqama).
       - If user already has `user.nationalId` recorded from registration, the system validates consistency or automatically binds the document to `user.nationalId`.
     - If the file is missing, empty, exceeds 10 MB, or has an unapproved MIME type, the system rejects the request immediately with HTTP 400 Bad Request and standard error code (`IDENTITY_INVALID_DOCUMENT`, `IDENTITY_FILE_TOO_LARGE`, or `IDENTITY_UNSUPPORTED_TYPE`).

2. **Quarantine Isolation, Fail-Closed Malware Scanning & Domain Promotion (`StorageService`, `QuarantineService` per AD-6, NFR13):**
   - **Given** an incoming identity document file
   - **When** the upload is processed by `IdentityService`:
     - The binary payload is staged into the isolated quarantine S3 partition: `quarantine/{uuid}-{sanitizedFilename}` via `QuarantineService.stageFileForQuarantine`.
     - A `FileObject` record is created in PostgreSQL with `scanStatus: PENDING`, `scannedAt: null`, `mimeType`, `fileSize`, `key: quarantineKey`, `bucket: privateBucket`.
     - `QuarantineService.scanAndProcess(fileObjectId, 'identity', { userId: user.id }, user.id)` is executed:
       - Evaluates the binary using the active `IMalwareScannerEngine` (`ClamAvScannerEngine` or `MockMalwareScannerEngine`).
       - **If CLEAN:**
         - The file is promoted atomically to the operational identity storage partition: `identity/{userId}/{uuid}-{sanitizedFilename}`.
         - The temporary object in `quarantine/` is deleted.
         - `FileObject.key` is updated to the operational identity key.
         - `FileObject.scanStatus` transitions to `ScanStatus.CLEAN` and `scannedAt` is stamped using `clockService.now()`.
         - An `IdentityDocument` record is created or updated in PostgreSQL:
           - `userId: user.id`
           - `fileObjectId: fileObject.id`
           - `documentType: input.documentType`
           - `idNumber: user.nationalId`
           - `status: VerificationStatus.PENDING_REVIEW` (or `VerificationStatus.VERIFIED` in mock/automated test mode if auto-verify flag is active)
           - `rejectionReason: null`
         - Returns HTTP 201 Created with the document record and verification status.
       - **If INFECTED:**
         - The file is strictly contained in `quarantine/` and NEVER promoted to `identity/`.
         - `FileObject.scanStatus` transitions to `ScanStatus.INFECTED`.
         - An immutable `AuditLog` entry is inserted within the transaction (`action: 'SECURITY_MALWARE_DETECTED'`, `actorId: user.id`, `entityType: 'FileObject'`, `payload: { threatName, ... }`).
         - Throws HTTP 400 Bad Request with code `IDENTITY_MALWARE_DETECTED` ("تم اكتشاف تهديد أمني في الملف المرفوع. تم حظر الملف وإشعار الفريق الأمني").
       - **If SCAN_FAILED:**
         - The system fails closed: `FileObject.scanStatus` transitions to `ScanStatus.SCAN_FAILED`.
         - File is never served or promoted.
         - Throws HTTP 503 Service Unavailable with code `SCAN_FAILED`.

3. **Sensitive Document Privacy & Short-Lived Signed URLs ($\le 5$ minutes per AD-6, AR7, NFR2):**
   - **Given** an uploaded identity document in private S3 storage
   - **When** requesting a download/preview URL via `GET /api/v1/users/identity/document-url` (for the authenticated document owner) or `GET /api/v1/admin/identity/:id/download-url` (for authorized administrators)
   - **Then**:
     - The system enforces strict access control:
       - Regular users can ONLY request the document URL for their own account (`identityDocument.userId === request.user.id`). Attempting to access another user's document returns HTTP 403 Forbidden (`AUTH_NOT_AUTHORIZED`).
       - Administrators require permission `Users.View` or `Audit.View` to view user identity documents.
     - The system enforces fail-closed gatekeeping:
       - Verifies that `FileObject.scanStatus === ScanStatus.CLEAN`. If not clean, access is blocked with HTTP 403 Forbidden (`FILE_QUARANTINED`).
     - Generates an S3 presigned GET URL strictly clamped to $\le 300$ seconds (5 minutes).
     - Direct public URLs are completely disabled; the private S3 bucket `elmasaif-private-documents` prohibits public ACLs and anonymous access.

4. **Identity Verification Status Query & Buyer Deal Prerequisite Engine (FR-4, BR-10, UJ-1):**
   - **Given** an authenticated user querying their identity status via `GET /api/v1/users/identity`
   - **Then** the endpoint returns:
     - `isUploaded`: boolean indicating whether an identity document has been uploaded and clean-promoted.
     - `status`: `VerificationStatus` (`NOT_UPLOADED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`).
     - `documentType`: `NATIONAL_ID` | `IQAMA` | null.
     - `maskedIdNumber`: string with masked digits (e.g. `102****345`) for PDPL privacy.
     - `uploadedAt`: ISO datetime string or null.
     - `rejectionReason`: string or null (populated when `status === REJECTED`).
     - `canUploadDealPaymentProof`: boolean (`true` if a clean document exists and is not rejected; per BR-10 and FR-4, identity document existence is the mandatory prerequisite before a buyer can upload payment proofs in deals).
   - **And** `UsersService` exposes a helper method `verifyBuyerIdentityPrerequisite(userId: string): Promise<boolean>` to allow downstream Deal and Payment modules to enforce the BR-10 gatekeeper.

5. **Administrative Identity Review & Verification Workflow (`apps/api` per FR-4, Phase 1):**
   - **Given** an authenticated administrative user with `Users.Review` or `Compliance.Review` permissions
   - **When** managing identity verifications:
     - `GET /api/v1/admin/identity/pending`: returns a paginated list of identity documents awaiting review with user metadata (full name, mobile number, ID number, document type, submission date).
     - `POST /api/v1/admin/identity/:id/verify`:
       - Updates `IdentityDocument` status to `VerificationStatus.VERIFIED`.
       - Sets `verifiedAt: clockService.now()` and `verifiedByAdminId: admin.id`.
       - Creates an immutable `AuditLog` entry (`action: 'IDENTITY_DOCUMENT_VERIFIED'`, `actorId: admin.id`, `entityId: document.id`).
       - Returns HTTP 200 OK with the updated document record.
     - `POST /api/v1/admin/identity/:id/reject`:
       - Validates mandatory rejection reason (`reason: string`, 5–500 characters).
       - Updates `IdentityDocument` status to `VerificationStatus.REJECTED` and records `rejectionReason`.
       - Creates an immutable `AuditLog` entry (`action: 'IDENTITY_DOCUMENT_REJECTED'`, `actorId: admin.id`, `entityId: document.id`, `payload: { reason }`).
       - Returns HTTP 200 OK.
   - **And** when a document is rejected, the user is permitted to re-upload a replacement document, resetting status to `PENDING_REVIEW`.

6. **Client-Side Identity Verification UI & Sovereign Experience (`apps/web` per DESIGN.md & EXPERIENCE.md):**
   - **Given** an authenticated user accessing the Identity Verification surface at `/app/settings/identity` (and linked from `/app/settings/profile` and `/app/buyer`)
   - **When** the page renders in RTL Arabic (`dir="rtl"`, `lang="ar"`):
     - Displays the institutional El Masaif header and title: "توثيق الهوية الوطنية / الإقامة".
     - Displays a regulatory compliance notice: "وفقاً للأنظمة واللوائح العقارية في المملكة العربية السعودية، يلزم التحقق من الهوية الوطنية للمواطنين أو الإقامة النظامية للمقيمين قبل إتمام أي تعاملات مالية أو تقديم عروض شراء ملزمة".
     - Renders the current verification status badge:
       - **Not Uploaded (`NOT_UPLOADED`):** Amber badge (`bg-amber-500/10 text-amber-600 border-amber-500/20`) with text "الهوية غير موثقة".
       - **Pending Review (`PENDING_REVIEW`):** Desert Gold badge (`bg-[#C69C45]/10 text-[#C69C45] border-[#C69C45]/20`) with text "قيد المراجعة والتدقيق" and helper message "تم استلام وثيقة الهوية وهي قيد الفحص الأمني والمراجعة الإدارية".
       - **Verified (`VERIFIED`):** Sovereign Emerald badge (`bg-[#1B4332]/10 text-[#1B4332] dark:text-emerald-400 border-[#1B4332]/20`) with checkmark and text "الهوية موثقة ومعتمدة".
       - **Rejected (`REJECTED`):** Crimson danger banner with text "تم رفض وثيقة الهوية" showing the admin's rejection reason and an prominent "إعادة رفع الوثيقة" button.
     - **Upload Form Component (`IdentityUploadForm`):**
       - Document type selector: segmented pill radio button for "هوية وطنية" (`NATIONAL_ID`) or "إقامة نظامية" (`IQAMA`).
       - National ID / Iqama number field (pre-filled with user's registered ID number in monospace format).
       - Sovereign Drag & Drop zone:
         - Dashed border with hover accent (`border-border hover:border-primary`).
         - Institutional upload icon (`FileCheck` / `UploadCloud`).
         - Supported formats text: "PDF, JPEG, PNG, WEBP (حتى 10 ميجابايت)".
         - Client-side size and MIME validation before upload dispatch.
         - Progress bar and spinner feedback during upload and malware scan processing.
     - **Document Preview Link:**
       - For users with an uploaded document, renders a "عرض الوثيقة المرفوعة" button which fetches a 5-minute signed URL and opens the document securely.
   - **And** on the Buyer Workspace dashboard (`/app/buyer`), if identity is not yet uploaded, a dismissible institutional alert reminds the buyer to complete verification to unlock deal payments.

7. **Shared Contracts, Validation Schemas & Error Codes (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported across `apps/api` and `apps/web`
   - **Then** exports:
     - Enums:
       - `IdentityDocumentType`: `NATIONAL_ID = 'NATIONAL_ID'`, `IQAMA = 'IQAMA'`
       - `VerificationStatus`: `NOT_UPLOADED = 'NOT_UPLOADED'`, `PENDING_REVIEW = 'PENDING_REVIEW'`, `VERIFIED = 'VERIFIED'`, `REJECTED = 'REJECTED'`
     - Schemas:
       - `uploadIdentityDocumentSchema`: `z.object({ documentType: z.nativeEnum(IdentityDocumentType), idNumber: saudiNationalIdSchema.optional() })`
       - `identityStatusResponseSchema`: `z.object({ isUploaded: z.boolean(), status: z.nativeEnum(VerificationStatus), documentType: z.nativeEnum(IdentityDocumentType).nullable().optional(), maskedIdNumber: z.string().nullable().optional(), uploadedAt: z.string().or(z.date()).nullable().optional(), rejectionReason: z.string().nullable().optional(), canUploadDealPaymentProof: z.boolean() })`
       - `adminVerifyIdentitySchema`: `z.object({ documentId: z.string().uuid() })`
       - `adminRejectIdentitySchema`: `z.object({ documentId: z.string().uuid(), reason: z.string().min(5, 'سبب الرفض يجب ألا يقل عن 5 أحرف').max(500) })`
     - Error codes in `packages/shared/src/constants/auth.ts`:
       - `IDENTITY_ALREADY_VERIFIED = 'IDENTITY_ALREADY_VERIFIED'`
       - `IDENTITY_DOCUMENT_REQUIRED = 'IDENTITY_DOCUMENT_REQUIRED'`
       - `IDENTITY_INVALID_DOCUMENT = 'IDENTITY_INVALID_DOCUMENT'`
       - `IDENTITY_FILE_TOO_LARGE = 'IDENTITY_FILE_TOO_LARGE'`
       - `IDENTITY_UNSUPPORTED_TYPE = 'IDENTITY_UNSUPPORTED_TYPE'`
       - `IDENTITY_INVALID_ID_NUMBER = 'IDENTITY_INVALID_ID_NUMBER'`
       - `IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND'`
       - `IDENTITY_REJECTED = 'IDENTITY_REJECTED'`
       - `IDENTITY_MALWARE_DETECTED = 'IDENTITY_MALWARE_DETECTED'`

8. **Automated Verification & Testing Gates:**
   - **Given** test suites in `packages/shared`, `apps/api`, and `apps/web`
   - **When** running test commands across all workspaces
   - **Then** 100% of tests pass:
     - Shared schema tests validating `uploadIdentityDocumentSchema` and verification status enums.
     - Backend unit tests for `IdentityService` verifying:
       - File size and MIME type validation
       - Staging into quarantine partition
       - Malware scanner execution and clean promotion to `identity/{userId}/...`
       - Containment of infected files and security audit alert generation
       - Fail-closed download guard with $\le 300$s presigned URL
       - Ownership authorization check preventing unauthorized document access
       - Admin verification and rejection with reason
       - `verifyBuyerIdentityPrerequisite` validation for deal payment proof uploads.
     - Backend controller tests for `UsersIdentityController`.
     - Frontend component tests for `IdentityUploadForm` and status cards.
     - Zero TypeScript compilation errors, zero lint warnings (`npm run lint`), and clean builds (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Prisma Schema & Database Models in `apps/api` (AC: 1, 2, 4)
  - [x] 1.1 Update `apps/api/prisma/schema.prisma`:
    - Add enums `IdentityDocumentType` (`NATIONAL_ID`, `IQAMA`) and `VerificationStatus` (`NOT_UPLOADED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`).
    - Define model `IdentityDocument`:
      - `id`: String @id @default(uuid())
      - `userId`: String @map("user_id")
      - `fileObjectId`: String @unique @map("file_object_id")
      - `documentType`: IdentityDocumentType @map("document_type")
      - `idNumber`: String @map("id_number")
      - `status`: VerificationStatus @default(PENDING_REVIEW)
      - `verifiedAt`: DateTime? @map("verified_at")
      - `verifiedByAdminId`: String? @map("verified_by_admin_id")
      - `rejectionReason`: String? @map("rejection_reason")
      - `createdAt`: DateTime @default(now()) @map("created_at")
      - `updatedAt`: DateTime @updatedAt @map("updated_at")
      - Relations: `user User @relation(...)`, `fileObject FileObject @relation(...)`
      - Indexes: `@@index([userId, status])`, `@@index([status])`, `@@map("identity_documents")`
    - Update `model User`: add `identityDocuments IdentityDocument[]`.
    - Update `model FileObject`: add `identityDocument IdentityDocument?`.
  - [x] 1.2 Run `npm run prisma:generate` in `apps/api` to update Prisma client types.

- [x] Task 2: Shared Contracts, Enums, Schemas & Constants in `packages/shared` (AC: 1, 7)
  - [x] 2.1 Update `packages/shared/src/enums/index.ts`:
    - Export `IdentityDocumentType` (`NATIONAL_ID = 'NATIONAL_ID'`, `IQAMA = 'IQAMA'`).
    - Export `VerificationStatus` (`NOT_UPLOADED = 'NOT_UPLOADED'`, `PENDING_REVIEW = 'PENDING_REVIEW'`, `VERIFIED = 'VERIFIED'`, `REJECTED = 'REJECTED'`).
  - [x] 2.2 Create `packages/shared/src/schemas/identity.schema.ts` (and re-export in `packages/shared/src/schemas/index.ts`):
    - Export `uploadIdentityDocumentSchema = z.object({ documentType: z.nativeEnum(IdentityDocumentType), idNumber: saudiNationalIdSchema.optional() })`.
    - Export `identityStatusResponseSchema`.
    - Export `adminVerifyIdentitySchema` and `adminRejectIdentitySchema`.
  - [x] 2.3 Create `packages/shared/src/types/identity.ts` (and re-export in `packages/shared/src/types/index.ts`):
    - Export TypeScript types inferred from schemas (`UploadIdentityDocumentInput`, `IdentityStatusResponse`, `AdminVerifyIdentityInput`, `AdminRejectIdentityInput`).
  - [x] 2.4 Update `packages/shared/src/constants/auth.ts`:
    - Export error codes: `IDENTITY_ALREADY_VERIFIED`, `IDENTITY_DOCUMENT_REQUIRED`, `IDENTITY_INVALID_DOCUMENT`, `IDENTITY_FILE_TOO_LARGE`, `IDENTITY_UNSUPPORTED_TYPE`, `IDENTITY_INVALID_ID_NUMBER`, `IDENTITY_NOT_FOUND`, `IDENTITY_REJECTED`, `IDENTITY_MALWARE_DETECTED`.
  - [x] 2.5 Unit tests in `packages/shared/src/schemas/__tests__/identity.spec.ts`.

- [x] Task 3: Backend Identity Service & Quarantine Processing in `apps/api` (AC: 1, 2, 3, 4)
  - [x] 3.1 Create `apps/api/src/modules/users/identity.service.ts`:
    - Inject `PrismaService`, `ClockService`, `StorageService`, and `QuarantineService`.
    - Method `uploadIdentityDocument(userId: string, file: Express.Multer.File, documentType: IdentityDocumentType, idNumber?: string)`:
      - Validates file size ($\le 10$MB) and MIME type (`pdf`, `jpeg`, `png`, `webp`).
      - Validates user existence and matches `idNumber` with `user.nationalId`.
      - Calls `quarantineService.stageFileForQuarantine` with file buffer, filename, MIME type, and size.
      - Calls `quarantineService.scanAndProcess(fileObjectId, 'identity', { userId }, userId)`:
        - If clean: creates or updates `IdentityDocument` record in PostgreSQL with `status: PENDING_REVIEW` (or `VERIFIED` if auto-verification is active).
        - If infected or scan failed: handles errors gracefully and propagates domain exception.
      - Logs audit event `IDENTITY_DOCUMENT_UPLOADED`.
      - Returns document status summary.
    - Method `getIdentityStatus(userId: string)`:
      - Queries latest `IdentityDocument` for the user.
      - Returns `{ isUploaded, status, documentType, maskedIdNumber, uploadedAt, rejectionReason, canUploadDealPaymentProof }`.
    - Method `getIdentityDocumentDownloadUrl(userId: string, requestingUserId: string, isAdmin = false)`:
      - Validates ownership (`userId === requestingUserId` unless `isAdmin === true`).
      - Retrieves `IdentityDocument` and related `FileObject`.
      - Verifies `scanStatus === ScanStatus.CLEAN`.
      - Calls `storageService.getPresignedDownloadUrl(fileObject.key, 300)` (clamped to $\le 5$ min).
      - Returns `{ downloadUrl, expiresIn: 300 }`.
    - Method `verifyBuyerIdentityPrerequisite(userId: string): Promise<boolean>`:
      - Returns `true` if user has an uploaded, non-rejected identity document with `scanStatus: CLEAN`.
  - [x] 3.2 Unit tests in `apps/api/src/modules/users/__tests__/identity.service.spec.ts`.

- [x] Task 4: Backend Identity Controller & Administrative Actions in `apps/api` (AC: 1, 3, 4, 5)
  - [x] 4.1 Create `apps/api/src/modules/users/identity.controller.ts`:
    - Decorate with `@ApiTags('User Identity Verification')`, `@Controller('users/identity')`, `@UseGuards(SessionAuthGuard)`.
    - `POST /upload`: uses `FileInterceptor('file')` to accept multipart upload; parses body with `uploadIdentityDocumentSchema`; invokes `identityService.uploadIdentityDocument`.
    - `GET /`: returns current user's identity status via `identityService.getIdentityStatus(req.user.id)`.
    - `GET /document-url`: generates 5-minute signed URL for the authenticated user via `identityService.getIdentityDocumentDownloadUrl`.
  - [x] 4.2 Add Administrative Endpoints (in `apps/api/src/modules/users/admin-identity.controller.ts` or `IdentityController` with admin guards):
    - `GET /admin/identity/pending`: lists pending verifications.
    - `POST /admin/identity/:id/verify`: verifies document, sets status `VERIFIED`, logs audit event.
    - `POST /admin/identity/:id/reject`: requires reason, sets status `REJECTED`, logs audit event.
    - `GET /admin/identity/:id/download-url`: generates admin signed download URL.
  - [x] 4.3 Update `apps/api/src/modules/users/users.module.ts`:
    - Import `StorageModule`.
    - Register `IdentityService`, `IdentityController`, and admin controller.
    - Export `IdentityService`.
  - [x] 4.4 Unit tests in `apps/api/src/modules/users/__tests__/identity.controller.spec.ts`.

- [x] Task 5: Buyer Deal Payment Prerequisite Integration (AC: 4)
  - [x] 5.1 Export `verifyBuyerIdentityPrerequisite` from `UsersService` or `IdentityService`.
  - [x] 5.2 Verify that the check can be consumed by future deal payment upload endpoints (BR-10 compliance).
  - [x] 5.3 Unit test verifying that a user without an uploaded identity document is blocked, while a user with a clean uploaded document is permitted.

- [x] Task 6: Frontend Identity Verification UI & Client Components in `apps/web` (AC: 6)
  - [x] 6.1 Create `apps/web/src/components/identity/identity-status-badge.tsx`:
    - Renders status pills according to `DESIGN.md` tokens (Emerald for Verified, Gold for Pending Review, Amber for Not Uploaded, Crimson for Rejected).
  - [x] 6.2 Create `apps/web/src/components/identity/identity-upload-form.tsx`:
    - Document type toggle (`NATIONAL_ID` vs `IQAMA`).
    - National ID / Iqama number display with masking helper.
    - Drag & Drop zone with file selector, 10MB limit validation, and accepted format badges.
    - Real-time upload progress, scanning indicator, and success/error alert banners.
  - [x] 6.3 Create `apps/web/src/components/identity/identity-document-preview.tsx`:
    - "عرض الوثيقة المرفوعة" button requesting signed URL and opening secure preview modal or tab.
  - [x] 6.4 Component tests in `apps/web/src/components/identity/__tests__/identity-upload-form.spec.ts`.

- [x] Task 7: Frontend Identity Verification Page & Workspace Alerts in `apps/web` (AC: 6)
  - [x] 7.1 Create `apps/web/src/app/app/settings/identity/page.tsx`:
    - RTL page layout wrapped in `WorkspaceShell`.
    - Header with El Masaif institutional crest and regulatory explanation banner.
    - Mounts `IdentityStatusBadge`, `IdentityUploadForm`, and `IdentityDocumentPreview`.
  - [x] 7.2 Update `apps/web/src/app/app/buyer/page.tsx`:
    - Add an identity verification prompt/reminder card if buyer's identity is not yet verified.
  - [x] 7.3 Update `apps/web/src/components/layout/workspace-shell.tsx`:
    - Ensure sidebar settings menu links to "توثيق الهوية" (`/app/settings/identity`).
  - [x] 7.4 Update `apps/web/src/components/providers/auth-provider.tsx`:
    - Provide identity status helper or refresh method in `useAuth()` hook.

- [x] Task 8: Verification, Test Suites & Quality Gates (AC: 8)
  - [x] 8.1 Execute all shared unit tests: `npm test -w packages/shared`.
  - [x] 8.2 Execute backend unit and integration tests: `npm test -w apps/api`.
  - [x] 8.3 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 8.4 Run lint checks: `npm run lint`.
  - [x] 8.5 Run workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **AD-6 & NFR13 (Storage Partitioning & Malware Scanning):**
  - All incoming identity documents MUST enter the `quarantine/` S3 prefix first (`quarantine/{uuid}-{sanitizedFilename}`).
  - Files are NEVER directly written to the operational `identity/` prefix by client upload.
  - `QuarantineService.scanAndProcess` is the sole authorized mechanism to promote a file to `identity/{userId}/{uuid}-{sanitizedFilename}`.
  - Non-clean files (`PENDING`, `INFECTED`, `SCAN_FAILED`) must fail closed: they cannot be viewed, downloaded, or promoted.
- **NFR2 & AR7 (Signed URL Lifespan):**
  - All presigned download and preview URLs MUST have an expiration time $\le 300$ seconds (5 minutes). Direct S3 public URLs are strictly forbidden.
- **BR-10 & FR-4 (Buyer Deal Prerequisite):**
  - In Saudi real estate, unverified buyers cannot execute high-value transactions. Document existence check (`isUploaded: true` with `scanStatus: CLEAN`) is the mandatory gate before wire transfer payment proofs can be uploaded.
- **PDPL (Personal Data Protection Law):**
  - Identity document numbers and binaries are sensitive personal data. National ID numbers must be masked in API status responses (e.g. `102****345`), and document visibility is restricted to `AdminOnly` and the authenticated document owner.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `apps/api/prisma/schema.prisma` | UPDATE | Add `IdentityDocument` model, `IdentityDocumentType` and `VerificationStatus` enums, relations on `User` and `FileObject`. |
| `packages/shared/src/enums/index.ts` | UPDATE | Export `IdentityDocumentType` and `VerificationStatus`. |
| `packages/shared/src/schemas/identity.schema.ts` | NEW | Zod validation schemas for identity upload and admin review. |
| `packages/shared/src/schemas/index.ts` | UPDATE | Re-export `identity.schema.ts`. |
| `packages/shared/src/types/identity.ts` | NEW | TypeScript types for identity verification. |
| `packages/shared/src/types/index.ts` | UPDATE | Re-export `identity.ts`. |
| `packages/shared/src/constants/auth.ts` | UPDATE | Export identity-related error codes. |
| `apps/api/src/modules/users/users.module.ts` | UPDATE | Import `StorageModule`, register `IdentityService` and `IdentityController`. |
| `apps/api/src/modules/users/identity.service.ts` | NEW | Service managing identity staging, scanning, promotion, status, and signed URLs. |
| `apps/api/src/modules/users/identity.controller.ts` | NEW | Endpoints for uploading and inspecting identity documents. |
| `apps/api/src/modules/users/admin-identity.controller.ts` | NEW | Admin endpoints for reviewing, approving, and rejecting identity documents. |
| `apps/web/src/components/identity/identity-status-badge.tsx` | NEW | Visual status pill component following Sovereign tokens. |
| `apps/web/src/components/identity/identity-upload-form.tsx` | NEW | Drag & drop upload zone with client validation and progress indicator. |
| `apps/web/src/components/identity/identity-document-preview.tsx` | NEW | Secure signed URL document preview launcher. |
| `apps/web/src/app/app/settings/identity/page.tsx` | NEW | Dedicated RTL identity verification page under user settings. |
| `apps/web/src/app/app/buyer/page.tsx` | UPDATE | Mount verification reminder banner for unverified buyers. |
| `apps/web/src/components/layout/workspace-shell.tsx` | UPDATE | Add identity verification link in sidebar settings menu. |

### Preserved Behaviors

- **Existing Auth & Session Guard:** The existing `SessionAuthGuard` must continue to guard all endpoints without disruption.
- **Multi-Role Profile Switching:** Story 1.3's `switchRole` and `ActiveRoleGuard` remain active and unchanged.
- **Storage & Quarantine Integrity:** Existing `StorageService` and `QuarantineService` methods and tests must remain green.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4:-Identity-Document-Verification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-4:-Identity-Document-Verification]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#BR-10]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md#5.-Logical-Entity-Relationship-Summary]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-6]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md]
- [Source: _bmad-output/implementation-artifacts/0-7-pre-persistence-quarantine-malware-scanning-hook.md]
- [Source: _bmad-output/implementation-artifacts/1-3-multi-role-profile-switching-workspace-shell.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Lint fix in `apps/api/src/modules/users/__tests__/users.controller.spec.ts` (removed unused `RequireRole` and `reflector`).
- Lint fix in `apps/api/src/modules/users/__tests__/users.service.spec.ts` (removed unused `HttpException`, `ForbiddenException`, and `AUTH_ROLE_NOT_AUTHORIZED`).
- Added `verifyBuyerIdentityPrerequisite` method and tests to `UsersService` to satisfy AC 4 & BR-10.

### Completion Notes List

- Implemented database models `IdentityDocument` and enums `IdentityDocumentType`, `VerificationStatus` in Prisma schema with full cascade and relation wiring.
- Exported validation schemas, types, enums, and authentication/identity error codes in `packages/shared`.
- Built backend `IdentityService` implementing staging into quarantine partition (`quarantine/{uuid}-{sanitizedFilename}`), fail-closed malware scanning via `QuarantineService`, clean promotion to `identity/{userId}/{uuid}-{sanitizedFilename}`, short-lived signed URLs ($\le 300$ seconds), and buyer prerequisite checking (`verifyBuyerIdentityPrerequisite`).
- Built user endpoints in `IdentityController` (`POST /api/v1/users/identity/upload`, `GET /api/v1/users/identity`, `GET /api/v1/users/identity/document-url`).
- Built admin review and action endpoints in `AdminIdentityController` (`GET /api/v1/admin/identity/pending`, `POST /api/v1/admin/identity/:id/verify`, `POST /api/v1/admin/identity/:id/reject`, `GET /api/v1/admin/identity/:id/download-url`) protected by `AdminSessionAuthGuard` and `AdminIdentityGuard`.
- Built frontend sovereign Arabic RTL components in `apps/web`: `IdentityStatusBadge`, `IdentityUploadForm`, `IdentityDocumentPreview`, and settings page at `/app/settings/identity`.
- Added buyer dashboard verification reminder prompt in `/app/buyer` and linked settings menu in `WorkspaceShell`.
- Verified 100% test pass rate across `packages/shared` (92 vitest tests), `apps/web` (59 vitest tests), and `apps/api` (196 jest tests).
- Clean workspace builds (`build:shared`, `build:api`, `build:web`) and zero lint errors across all workspaces.

### File List

- `apps/api/prisma/schema.prisma`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/schemas/identity.schema.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/identity.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/constants/auth.ts`
- `packages/shared/src/schemas/__tests__/identity.spec.ts`
- `apps/api/src/modules/auth/guards/admin-session-auth.guard.ts`
- `apps/api/src/modules/auth/__tests__/admin-session-auth.guard.spec.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/__tests__/users.service.spec.ts`
- `apps/api/src/modules/users/__tests__/users.controller.spec.ts`
- `apps/api/src/modules/users/identity.service.ts`
- `apps/api/src/modules/users/identity.controller.ts`
- `apps/api/src/modules/users/admin-identity.controller.ts`
- `apps/api/src/modules/users/__tests__/identity.service.spec.ts`
- `apps/api/src/modules/users/__tests__/identity.controller.spec.ts`
- `apps/web/src/components/identity/identity-status-badge.tsx`
- `apps/web/src/components/identity/identity-upload-form.tsx`
- `apps/web/src/components/identity/identity-document-preview.tsx`
- `apps/web/src/components/identity/__tests__/identity-upload-form.spec.tsx`
- `apps/web/src/app/app/settings/identity/page.tsx`
- `apps/web/src/app/app/buyer/page.tsx`
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/src/components/layout/__tests__/workspace-shell.spec.ts`
- `apps/web/src/components/layout/__tests__/workspace-role-switcher.spec.ts`
- `apps/web/src/components/providers/auth-provider.tsx`

