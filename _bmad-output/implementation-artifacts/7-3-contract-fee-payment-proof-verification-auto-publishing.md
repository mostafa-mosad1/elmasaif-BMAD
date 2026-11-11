---
baseline_commit: db694792a47538fba7642352ed85c1156de8edfa
---

# Story 7.3: Contract Fee Payment Proof Verification & Auto-Publishing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a property owner who signed a listing contract,
I want to upload bank wire transfer proof for the listing contract fee and have my property automatically published upon administrative approval,
So that my property goes live on the public marketplace without further manual delays, and the transaction is legally recorded and auditable under Saudi electronic transaction regulations.

## Acceptance Criteria

1. **Owner Fee Payment Proof Upload (`/app/owner/contracts/:id`) (`FR-10`, `UJ-3`, `UX-DR9`):**
   - **Given** an authenticated user operating under an active `OWNER` profile
   - **When** calling `POST /api/v1/owner/contracts/:id/fee-proof` with `multipart/form-data`:
     - `file`: wire transfer receipt (PDF, JPEG, or PNG; maximum size 10MB)
     - `bankReferenceCode`: optional bank transaction reference string (max 64 characters)
     - `senderBankName`: optional sender bank name (max 100 characters)
   - **Then** the backend verifies:
     - Contract exists and belongs to the caller's active owner profile
     - Contract status is strictly `PENDING_FEE` (throws HTTP 409 Conflict with `OWNER_CONTRACT_INVALID_STATE` if in any other status)
     - Contract payment window has not expired (`expiresAt > ClockService.now()`, throws HTTP 400 with `OWNER_CONTRACT_EXPIRED` if expired)
   - **And** routes the uploaded file through `QuarantineService.stageFileForQuarantine` and `MalwareScannerService`:
     - If infected: returns HTTP 400 `MALWARE_DETECTED` and purges the file
     - If clean: saves to permanent sovereign S3/MinIO storage under `contracts/:contractId/fees/:filename`
   - **And** creates or updates the `ContractFeePayment` record:
     - `ownerContractId`: contract.id
     - `amount`: `contract.contractFee` (default SAR 1,000.00)
     - `status`: `'PROOF_UPLOADED'`
     - `proofFileUrl`: permanent storage file URL
     - `bankReferenceCode`: extracted reference code
     - `senderBankName`: extracted sender bank name
     - `uploadedAt`: `ClockService.now()`
     - `rejectionReason`: null (clears previous rejection if this is a re-upload)
   - **And** writes an immutable `AuditLog` entry:
     - `actorId`: user.id
     - `actorType`: 'USER'
     - `action`: 'CONTRACT_FEE_PROOF_UPLOADED'
     - `entityType`: 'ContractFeePayment'
     - `entityId`: payment.id
     - `payload`: `{ contractId, amount, bankReferenceCode, senderBankName, uploadedAt }`
   - **And** dispatches an in-app notification event to admin staff indicating a new contract fee proof is awaiting review
   - **And** returns HTTP 200 with `{ success: true, paymentId, status: 'PROOF_UPLOADED', uploadedAt }`.

2. **Owner Contract Fee Status Display & Review Progress (`FR-10`, `UX-DR9`, `EXPERIENCE.md § 4`):**
   - **Given** an owner viewing their contract at `/app/owner/contracts/:id`:
   - **When** the contract status is `PENDING_FEE` and no proof has been uploaded yet:
     - Displays the fee payment banner with bank details (Beneficiary: شركة المصايف العقارية, Bank: مصرف الراجحي, IBAN: `SA0380000000608010167519`)
     - Displays the active 7-day payment deadline countdown (`expiresAt`)
     - Activates the "سداد رسوم العقد ورفع الإشعار البنكي" CTA button, opening the interactive proof upload modal/dropzone
   - **When** the owner has uploaded a proof (`status === 'PROOF_UPLOADED'` or `'UNDER_REVIEW'`):
     - Displays an informative status banner:
       - Status badge: `تم رفع الإشعار - قيد المراجعة الإدارية` (Proof Uploaded - Under Review)
       - Upload timestamp in Arabic format
       - Uploaded file name and view link
       - Notice: "يتم تدقيق الإشعار البنكي من قبل الفريق الإداري خلال 4 ساعات عمل وفق اتفاقية مستوى الخدمة (SLA)"
       - Secondary action: "استبدال أو تعديل الإشعار" allowing re-upload prior to admin decision
   - **When** the proof has been rejected by an administrator (`status === 'REJECTED'`):
     - Displays an amber/red warning card:
       - Status badge: `إشعار التحويل مرفوض` (Payment Proof Rejected)
       - Administrator's rejection note clearly highlighted in Arabic
       - Remaining time before the 7-day deadline expires
       - Primary CTA: "رفع إشعار تحويل جديد" (Upload New Transfer Proof)
   - **When** the contract is `ACTIVE` (fee confirmed and property published):
     - Displays the Sovereign verified contract banner:
       - Green badge: `عقد سارٍ ومعتمد` (Active & Certified Contract)
       - Celebration callout: `تم تأكيد سداد الرسوم ونشر العقار في السوق العام بنجاح`
       - Action button: `عرض الإعلان في المنصة` (View Listing on Marketplace) linking to `/listings/:listingId`
       - Action button: `تحميل الفاتورة الضريبية` (Download Tax Invoice) referencing the generated `InvoiceRecord`.

3. **Admin Contract Fee Operational Queue (`/admin/contract-fees`) (`FR-10`, `FR-69`, `OQ-11`, `UC-50`):**
   - **Given** an administrator authenticated with `AdminSessionAuthGuard` + `AdminPermissionGuard`
   - **And** having permission `Contracts.Review`, `Contracts.Manage`, or `SuperAdmin`
   - **When** calling `GET /api/v1/admin/contract-fees`:
     - Query parameters: `page` (default 1), `limit` (default 20, max 100), `status` (optional filter: `ALL`, `PROOF_UPLOADED`, `UNDER_REVIEW`, `CONFIRMED`, `REJECTED`), `search` (owner name, mobile, property title, title deed number)
     - Orders results oldest-first for pending items to respect SLA turnaround
     - Projecting live 15-minute claim lease status (`ClaimLockInfo`: `isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminName`, `remainingSeconds`)
     - Reads NEVER acquire or alter the lease lock (AD-10)
     - Returns paginated list: `{ items, total, page, limit, totalPages }`
   - **When** calling `GET /api/v1/admin/contract-fees/:id`:
     - Returns complete review dossier:
       - `payment`: fee payment ID, amount, status, bank reference code, sender bank name, uploadedAt, verifiedAt, rejectionReason
       - `contract`: contract terms, signedAt, signature raster, owner IP, owner user-agent, contract fee, expiresAt
       - `listing`: title, property type, ask price, area, city, district, deed number, photos
       - `owner`: legal name, masked mobile number, national ID, payout IBAN
       - `lockInfo`: live claim lock status.

4. **15-Minute Task Claim Lease & Locking (`AD-10`, `Story 8.3` alignment):**
   - **Given** an admin reviewing the fee payment queue:
   - **When** calling `POST /api/v1/admin/contract-fees/:id/claim`:
     - Atomically acquires exclusive 15-minute lease via conditional `updateMany`:
       - Condition: `id = :id AND (lockedByAdminId IS NULL OR lockExpiresAt < :now OR lockedByAdminId = :adminId)`
     - Sets `lockedByAdminId = admin.id`, `lockedAt = now`, `lockExpiresAt = now + 15 minutes`
     - Advances payment status from `PROOF_UPLOADED` to `UNDER_REVIEW`
     - Returns HTTP 409 `CONTRACT_FEE_LOCK_CONFLICT` if held by another admin with holder details
     - Writes `AuditLog` entry: `CONTRACT_FEE_CLAIMED`
   - **When** calling `POST /api/v1/admin/contract-fees/:id/heartbeat`:
     - Renews caller's active lease by extending `lockExpiresAt` to `ClockService.now() + 15 minutes`
     - Returns HTTP 409 `CONTRACT_FEE_LOCK_REQUIRED` / `_EXPIRED` / `_CONFLICT` if not held by caller
   - **When** calling `POST /api/v1/admin/contract-fees/:id/release`:
     - Releases the lease without deciding: clears `lockedByAdminId`, `lockedAt`, `lockExpiresAt`
     - Returns status to `PROOF_UPLOADED` if still in `UNDER_REVIEW`
     - Writes `AuditLog` entry: `CONTRACT_FEE_RELEASED`
   - **When** calling `POST /api/v1/admin/contract-fees/:id/force-unlock`:
     - Guarded by `@RequireAdminPermission('Tasks.ForceUnlock')` (Super Admin or designated manager)
     - Requires documented reason (minimum 3 characters)
     - Unconditionally clears the lock and writes `AuditLog` entry: `CONTRACT_FEE_FORCE_UNLOCKED`.

5. **Administrative Payment Confirmation & Atomic Auto-Publishing (`FR-10`, `BR-15`, `OQ-08`):**
   - **Given** an administrator holding the active 15-minute lease on a `ContractFeePayment`
   - **When** calling `POST /api/v1/admin/contract-fees/:id/confirm`:
   - **Then** the backend asserts the lease is valid and held by caller (`assertClaimLockHeld`), and executes atomically in a database transaction:
     1. Updates `ContractFeePayment`:
        - `status`: `'CONFIRMED'`
        - `verifiedByAdminId`: `admin.id`
        - `verifiedAt`: `ClockService.now()`
        - `rejectionReason`: null
        - `lockedByAdminId`: null, `lockedAt`: null, `lockExpiresAt`: null (releases lease)
     2. Updates `OwnerContract`:
        - `status`: `OwnerContractStatus.ACTIVE`
     3. Updates associated `Listing` (`BR-15`):
        - `status`: `ListingStatus.ACTIVE` (automatically published to the public marketplace)
        - `publishedAt`: `ClockService.now()` (if field present, otherwise recorded in listing lifecycle)
     4. Updates associated `OwnerListingRequest` (if present):
        - `status`: `'COMPLETED'`
     5. Generates official non-refundable `InvoiceRecord` (`FR-68`, `OQ-08`):
        - `invoiceNumber`: sequential unique invoice string (e.g. `INV-FEES-YYYY-XXXXX`)
        - `contractFeePaymentId`: payment.id
        - `sellerId`: owner profile user ID
        - `subtotalAmount`: `contractFee / 1.15` (SAR 869.57 for SAR 1,000 fee)
        - `vatAmount`: `contractFee - subtotalAmount` (SAR 130.43 for SAR 1,000 fee)
        - `vatRate`: 0.15 (15%)
        - `totalAmount`: `contractFee` (SAR 1,000.00)
        - `vatTreatment`: `'STANDARD_15_PERCENT'`
        - `partyDetails`: JSON snapshot containing platform seller details and owner taxpayer/personal details
     6. Writes immutable `AuditLog`:
        - `actorId`: admin.id
        - `actorType`: 'ADMIN'
        - `action`: 'CONTRACT_FEE_CONFIRMED'
        - `entityType`: 'ContractFeePayment'
        - `entityId`: payment.id
        - `payload`: `{ contractId, listingId: contract.listingId, amount: payment.amount, publishedAt: now.toISOString(), invoiceId: invoice.id }`
     7. Dispatches in-app notification to the owner:
        - Type: `contract.fee_confirmed_listing_published`
        - Title: `تم تأكيد سداد الرسوم ونشر العقار`
        - Message: `تم تأكيد استلام إشعار التحويل البنكي وتفعيل عقد التسويق ونشر إعلان عقارك بنجاح في السوق العام.`
   - **And** returns HTTP 200 with `{ success: true, paymentId, contractId, listingId, invoiceNumber, status: 'CONFIRMED' }`.

6. **Administrative Payment Rejection (`FR-10`):**
   - **Given** an administrator holding the active 15-minute lease on a `ContractFeePayment`
   - **When** calling `POST /api/v1/admin/contract-fees/:id/reject` with:
     - `reason`: mandatory Arabic rejection justification (string, 5–500 characters)
   - **Then** the backend asserts the lease is valid and held by caller (`assertClaimLockHeld`), and executes atomically in a database transaction:
     1. Updates `ContractFeePayment`:
        - `status`: `'REJECTED'`
        - `verifiedByAdminId`: `admin.id`
        - `verifiedAt`: `ClockService.now()`
        - `rejectionReason`: reason.trim()
        - `lockedByAdminId`: null, `lockedAt`: null, `lockExpiresAt`: null (releases lease)
     2. Leaves `OwnerContract` in `PENDING_FEE` status (enabling owner to correct and re-upload before `expiresAt`)
     3. Leaves `Listing` in `PENDING_REVIEW` status (never published)
     4. Writes immutable `AuditLog`:
        - `actorId`: admin.id
        - `actorType`: 'ADMIN'
        - `action`: 'CONTRACT_FEE_REJECTED'
        - `entityType`: 'ContractFeePayment'
        - `entityId`: payment.id
        - `payload`: `{ contractId, reason, rejectedAt: now.toISOString() }`
     5. Dispatches in-app notification to the owner:
        - Type: `contract.fee_proof_rejected`
        - Title: `إشعار تحويل رسوم العقد مرفوض`
        - Message: `تم رفض إشعار التحويل البنكي للسبب التالي: ${reason}. يرجى إعادة رفع إشعار صالح قبل انتهاء المهلة المحددة.`
   - **And** returns HTTP 200 with `{ success: true, paymentId, status: 'REJECTED', rejectionReason: reason }`.

7. **Presigned Download URL for Payment Receipt (`AD-6`, `NFR-13`):**
   - **When** calling `GET /api/v1/admin/contract-fees/:id/proof-url`:
     - Verifies admin permission `Contracts.Review` or `Contracts.Manage`
     - Generates a short-lived presigned download URL (valid for 300 seconds) from S3/MinIO
     - Returns HTTP 200 with `{ downloadUrl, expiresInSeconds: 300 }`.

8. **Admin Back-Office UI Workspace (`apps/web/src/app/admin/contract-fees`) (`FR-10`, `UX-DR9`, `UX-DR15`):**
   - Queue Page (`/admin/contract-fees`):
     - Filter tabs: جميع الإشعارات (All), قيد الانتظار (Proof Uploaded), قيد التدقيق (Under Review), مؤكد (Confirmed), مرفوض (Rejected)
     - Table columns: معرف العقد/الطلب, عنوان العقار, اسم المالك ورقم الجوال, قيمة الرسوم (SAR), تاريخ الرفع, حالة القفل والمشرف الحائز, إجراء المعاينة
     - Real-time 15-minute lease lock countdown pill and quick-claim button
   - Review Workspace (`/admin/contract-fees/[id]`):
     - Lease header bar showing remaining lock seconds with `تمديد القفل` (Heartbeat) and `تحرير المهمة` (Release) buttons
     - Split screen / tabbed interface:
       - Right pane: Property specifications, contract terms summary, signed owner details, bank transfer metadata
       - Left pane: Inline interactive proof document viewer (embedded PDF / high-resolution image zoom)
     - Decision actions bar:
       - Confirm CTA: "تأكيد استلام الرسوم واعتماد نشر العقار" with verification dialog emphasizing auto-publishing to marketplace and non-refundable status
       - Reject CTA: "رفض إشعار التحويل" opening modal with mandatory rejection note (5–500 chars)
       - Super Admin force-unlock button with documented reason modal.

## Tasks / Subtasks

- [x] Task 1: Shared Types, Constants & Zod Schemas (`packages/shared`) (AC: 1, 3, 4, 5, 6)
  - [x] Add constants and error codes in `packages/shared/src/constants/contracts.ts`:
    - `CONTRACT_FEE_PAYMENT_NOT_FOUND`
    - `CONTRACT_FEE_NOT_CLAIMABLE`
    - `CONTRACT_FEE_LOCK_REQUIRED`
    - `CONTRACT_FEE_LOCK_CONFLICT`
    - `CONTRACT_FEE_LOCK_EXPIRED`
    - `CONTRACT_FEE_REJECTION_REASON_REQUIRED`
    - `CONTRACT_FEE_PROOF_REQUIRED`
    - `CONTRACT_FEE_PROOF_TOO_LARGE`
    - `CONTRACT_FEE_PROOF_UNSUPPORTED_TYPE`
    - `CONTRACT_FEE_PAYMENT_STATUS` (`PENDING`, `PROOF_UPLOADED`, `UNDER_REVIEW`, `CONFIRMED`, `REJECTED`, `EXPIRED`)
    - `CONTRACT_FEE_PAYMENT_STATUS_LABELS_AR`
  - [x] Define TypeScript interfaces in `packages/shared/src/types/contracts.ts`:
    - `ContractFeePaymentQueueItem`
    - `ContractFeePaymentDetailResponse`
    - `UploadContractFeeProofInput`
    - `ConfirmContractFeeResult`
    - `RejectContractFeeInput`
    - `RejectContractFeeResult`
    - `ForceUnlockContractFeeInput`
    - `ContractFeeQueueQuery`
  - [x] Add Zod validation schemas in `packages/shared/src/schemas/contracts.schema.ts`:
    - `contractFeeQueueQuerySchema`
    - `uploadContractFeeProofBodySchema`
    - `rejectContractFeeBodySchema`
    - `forceUnlockContractFeeSchema`
  - [x] Add unit tests in `packages/shared/src/schemas/__tests__/contracts.spec.ts` for fee proof and review schemas.

- [x] Task 2: Backend Owner Fee Proof Upload Endpoints (`apps/api/src/modules/contracts`) (AC: 1, 2)
  - [x] Extend `OwnerContractsService` in `apps/api/src/modules/contracts/owner-contracts.service.ts`:
    - `uploadFeeProof(userId: string, contractId: string, file: Express.Multer.File, body: UploadContractFeeProofInput)`:
      - Validates active owner profile and contract ownership
      - Validates contract is strictly in `PENDING_FEE` status
      - Validates contract has not expired (`expiresAt > ClockService.now()`)
      - Uses `QuarantineService` and `MalwareScannerService` to scan file
      - Saves file to S3/MinIO under `contracts/:contractId/fees/:filename`
      - Upserts `ContractFeePayment` record (`amount = contract.contractFee`, `status = 'PROOF_UPLOADED'`, `uploadedAt = now`)
      - Creates `AuditLog` entry `CONTRACT_FEE_PROOF_UPLOADED`
    - `getFeePayment(userId: string, contractId: string)`:
      - Returns active fee payment status, proof URL, rejection notes if rejected.
  - [x] Extend `OwnerContractsController` in `apps/api/src/modules/contracts/owner-contracts.controller.ts`:
    - `POST /api/v1/owner/contracts/:id/fee-proof` (multipart upload with `FileInterceptor('file')`, `UseFilters(DealProofTooLargeFilter)`)
    - `GET /api/v1/owner/contracts/:id/fee-status`
  - [x] Unit tests in `apps/api/src/modules/contracts/__tests__/owner-contracts.service.spec.ts`.

- [x] Task 3: Backend Admin Contract Fees Service & Controller (`apps/api/src/modules/contracts`) (AC: 3, 4, 5, 6, 7)
  - [x] Create `contract-fee-lock.ts` helper:
    - Atomically manages 15-minute lease locks on `ContractFeePayment` rows
    - Calculates `ClaimLockInfo` projection (`isLocked`, `isLockedByCurrentAdmin`, `lockedByAdminName`, `remainingSeconds`)
    - Provides `assertClaimLockHeld(payment, adminId, now)`.
  - [x] Create `AdminContractFeesService` in `apps/api/src/modules/contracts/admin-contract-fees.service.ts`:
    - `getQueue(query: ContractFeeQueueQuery, adminId: string)`: paginated queue of fee proofs
    - `getDetail(id: string, adminId: string)`: complete review details, contract, listing, owner, proof
    - `claimLock(id: string, admin: any)`: 15-minute lease, transitions to `UNDER_REVIEW`, writes `AuditLog`
    - `heartbeatLock(id: string, admin: any)`: extends lease by 15 mins
    - `releaseLock(id: string, admin: any)`: releases lease, returns to `PROOF_UPLOADED`
    - `forceUnlock(id: string, admin: any, dto: ForceUnlockContractFeeInput)`: Super Admin force unlock with reason
    - `confirmPayment(id: string, admin: any)`: atomic transaction updating `ContractFeePayment` (`CONFIRMED`), `OwnerContract` (`ACTIVE`), `Listing` (`ACTIVE`), generating `InvoiceRecord` (15% VAT calculation), writes `AuditLog`, dispatches notification
    - `rejectPayment(id: string, admin: any, dto: RejectContractFeeInput)`: updates `ContractFeePayment` (`REJECTED`, reason), writes `AuditLog`, dispatches notification
    - `getProofDownloadUrl(id: string, adminId: string)`: presigned S3 download URL (300 seconds).
  - [x] Create `AdminContractFeesController` in `apps/api/src/modules/contracts/admin-contract-fees.controller.ts`:
    - `@Controller('api/v1/admin/contract-fees')`
    - Gated by `AdminSessionAuthGuard` + `AdminPermissionGuard`
    - Endpoints: `GET /`, `GET /:id`, `GET /:id/proof-url`, `POST /:id/claim`, `POST /:id/heartbeat`, `POST /:id/release`, `POST /:id/confirm`, `POST /:id/reject`, `POST /:id/force-unlock`
  - [x] Register `AdminContractFeesService` and `AdminContractFeesController` in `contracts.module.ts`.
  - [x] Unit tests in `apps/api/src/modules/contracts/__tests__/admin-contract-fees.service.spec.ts` and `admin-contract-fees.controller.spec.ts`.

- [x] Task 4: Owner Contract UI - Fee Payment & Proof Upload (`apps/web`) (AC: 1, 2)
  - [x] Create `apps/web/src/components/contracts/contract-fee-proof-modal.tsx`:
    - File upload dropzone supporting drag-and-drop for PDF, JPEG, PNG (max 10MB)
    - Optional inputs for `bankReferenceCode` and `senderBankName`
    - Upload progress and security scanning indicators
    - Clear client-side validation errors in Arabic.
  - [x] Update `apps/web/src/app/app/owner/contracts/[id]/page.tsx`:
    - Replace the disabled fee payment button with active CTA opening `ContractFeeProofModal`
    - Render `PROOF_UPLOADED` / `UNDER_REVIEW` state banner with file name, upload date, and 4-hour SLA notice
    - Render `REJECTED` state alert with administrative note and "إعادة رفع الإشعار" action
    - Render `ACTIVE` state with certified green banner, link to live property `/listings/:listingId`, and tax invoice download summary.

- [x] Task 5: Admin Back-Office Contract Fee Verification Workspace (`apps/web`) (AC: 3, 4, 5, 6, 7, 8)
  - [x] Create `apps/web/src/app/admin/contract-fees/page.tsx`:
    - Paginated queue table with search, status filters, claim lock indicators, and "معاينة وتدقيق" action button.
  - [x] Create `apps/web/src/app/admin/contract-fees/[id]/page.tsx`:
    - 15-minute lease lock header bar with heartbeat countdown, claim, and release actions
    - Two-column review workspace:
      - Right pane: Property specifications, contract terms summary, signed owner details, bank transfer metadata
      - Left pane: Inline interactive proof document viewer (embedded PDF / high-resolution image zoom)
    - Decision actions:
      - Confirm CTA ("تأكيد استلام الرسوم واعتماد نشر العقار") with confirmation dialog confirming auto-publishing to marketplace and non-refundable status
      - Reject CTA ("رفض إشعار التحويل") with mandatory rejection reason textarea (min 5 chars)
      - Super Admin force-unlock modal.
  - [x] Add navigation shortcut in `apps/web/src/app/admin/page.tsx` under executive banner for staff with `Contracts.Review` or `Contracts.Manage` permissions.

- [x] Task 6: Comprehensive Automated Tests (AC: 1–8)
  - [x] Backend unit tests in `apps/api/src/modules/contracts/__tests__/admin-contract-fees.service.spec.ts`:
    - Queue pagination, filtering, and lock projection
    - Lease acquisition, heartbeat, release, and conflict handling
    - Confirmation atomic transaction: contract `ACTIVE`, listing `ACTIVE`, `InvoiceRecord` created, audit logged, notification emitted
    - Rejection atomic transaction: contract stays `PENDING_FEE`, listing stays `PENDING_REVIEW`, audit logged, notification emitted
  - [x] Backend controller tests in `apps/api/src/modules/contracts/__tests__/admin-contract-fees.controller.spec.ts`:
    - Permission checks (`Contracts.Review`, `Tasks.ForceUnlock`)
  - [x] Frontend tests in `apps/web/src/app/app/owner/__tests__/owner-contract-fee-proof.spec.tsx`:
    - Renders upload modal, handles file submission, renders review progress state, renders active published state.
  - [x] Frontend tests in `apps/web/src/app/admin/contract-fees/__tests__/admin-contract-fees-queue.spec.tsx` and `admin-contract-fees-workspace.spec.tsx`.

## Dev Notes

### Architecture & Existing Components to Leverage

- **Prisma Models (`apps/api/prisma/schema.prisma`):**
  - Model `ContractFeePayment` already defined:
    ```prisma
    model ContractFeePayment {
      id                String    @id @default(uuid())
      ownerContractId   String
      amount            Decimal   @db.Decimal(12, 2)
      status            String    @default("PENDING")
      proofFileUrl      String?
      bankReferenceCode String?
      senderBankName    String?
      uploadedAt        DateTime?
      verifiedByAdminId String?
      verifiedAt        DateTime?
      rejectionReason   String?
      lockedByAdminId   String?
      lockedAt          DateTime?
      lockExpiresAt     DateTime?
      createdAt         DateTime  @default(now())
      updatedAt         DateTime  @updatedAt

      ownerContract     OwnerContract @relation(fields: [ownerContractId], references: [id], onDelete: Cascade)

      @@index([lockExpiresAt])
      @@map("contract_fee_payments")
    }
    ```
  - Model `InvoiceRecord` already contains `contractFeePaymentId`:
    ```prisma
    model InvoiceRecord {
      id                   String   @id @default(uuid())
      invoiceNumber        String   @unique
      dealId               String?
      contractFeePaymentId String?
      sellerId             String
      buyerId              String?
      subtotalAmount       Decimal  @db.Decimal(12, 2)
      vatAmount            Decimal  @db.Decimal(12, 2)
      vatRate              Decimal  @default(0.15) @db.Decimal(4, 2)
      totalAmount          Decimal  @db.Decimal(12, 2)
      vatTreatment         String
      partyDetails         Json
      createdAt            DateTime @default(now())

      @@index([dealId])
      @@index([invoiceNumber])
      @@map("invoice_records")
    }
    ```
  - `ListingStatus`:
    `ListingStatus.PENDING_REVIEW` -> `ListingStatus.ACTIVE` upon contract fee confirmation (`BR-15`).
  - `OwnerContractStatus`:
    `OwnerContractStatus.PENDING_FEE` -> `OwnerContractStatus.ACTIVE` upon contract fee confirmation.

- **Quarantine & File Storage (`apps/api/src/modules/storage/`):**
  - Use `QuarantineService` and `MalwareScannerService` for virus and malware scanning of uploaded bank receipts before permanent persistence.
  - Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`. Max file size: 10MB.

- **Task Claim Locking Pattern:**
  - Mirror `apps/api/src/modules/deals/payment-lock.ts` and `apps/api/src/modules/contracts/owner-request-lock.ts`.
  - Canonical 15-minute lease duration (`15 * 60 * 1000` ms).
  - Explicit POST claim endpoint (reads NEVER claim).
  - Atomic conditional updates: `lockedByAdminId IS NULL OR lockExpiresAt < :now OR lockedByAdminId = :adminId`.

- **Platform Bank Details:**
  - Beneficiary: `شركة المصايف العقارية`
  - Bank: `مصرف الراجحي`
  - IBAN: `SA0380000000608010167519`
  - Default Fee: SAR 1,000.00 (non-refundable per `OQ-08` / `FR-10`).

- **Tax Invoice Calculation (15% VAT):**
  - Total Fee = SAR 1,000.00
  - Subtotal Amount = `1000 / 1.15` = SAR 869.57
  - VAT Amount = `1000 - 869.57` = SAR 130.43
  - VAT Rate = 0.15

### Testing Standards Summary

- Backend service and controller specs using Jest in `apps/api/src/modules/contracts/__tests__/`.
- Ensure mock coverage for `PrismaService`, `ClockService`, `QuarantineService`, and `StorageService`.
- Frontend component tests using `@testing-library/react` and Vitest in `apps/web/src/`.
- Ensure coverage for file upload validation, lease lock countdowns, and decision modals.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-10, BR-15, OQ-08]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Admin Operations & Claim Locking]
- [Source: _bmad-output/implementation-artifacts/7-2-electronic-contract-review-canvas-signature-pad-with-otp-sta.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (Medium)

### Debug Log References

### Completion Notes List

- Implemented Story 7.3: Contract Fee Payment Proof Verification & Auto-Publishing across `@elmasaif/shared`, `@elmasaif/api`, and `@elmasaif/web`.
- Added shared error constants, types, and Zod schemas (`packages/shared/src/constants/contracts.ts`, `types/contracts.ts`, `schemas/contracts.schema.ts`).
- Created AD-10 claim lease lock helper `apps/api/src/modules/contracts/contract-fee-lock.ts`.
- Implemented owner fee proof upload endpoint (`POST /api/v1/owner/contracts/:id/fee-proof`) and status endpoint (`GET /api/v1/owner/contracts/:id/fee-status`) in `OwnerContractsService` and `OwnerContractsController` with quarantine and malware scanning, conflict validation, audit logging, and payload sanitization.
- Implemented back-office admin service `AdminContractFeesService` and controller `AdminContractFeesController` with 15-minute lease locks, heartbeat renewal, release, Super Admin force-unlock, atomic confirmation (contract `ACTIVE`, listing auto-published to `ACTIVE` marketplace status per `BR-15`, and 15% VAT `InvoiceRecord` generation), rejection handling, and presigned proof download URLs.
- Built interactive owner contract fee UI (`apps/web/src/components/contracts/contract-fee-proof-modal.tsx`, `apps/web/src/app/app/owner/contracts/[id]/page.tsx`) with fee payment instructions, dropzone upload modal, review progress SLA banner, rejection alerts, and certified active contract marketplace banner.
- Built admin contract fee management back-office (`apps/web/src/app/admin/contract-fees/page.tsx`, `apps/web/src/app/admin/contract-fees/[id]/page.tsx`, `contract-fees-helpers.ts`) with paginated queue, search/status filters, lock pills, split-pane dossier and inline PDF/image preview viewer, confirmation modal, and rejection modal.
- Added admin dashboard shortcut in `apps/web/src/app/admin/page.tsx`.
- Wrote and passed all automated test suites:
  - `@elmasaif/shared`: `contracts.spec.ts` (33/33 tests passing)
  - `@elmasaif/api`: `owner-contracts.service.spec.ts`, `admin-contract-fees.service.spec.ts`, `admin-contract-fees.controller.spec.ts` (78/78 tests in contracts module passing)
  - `@elmasaif/web`: `owner-contract-fee-proof.spec.tsx`, `admin-contract-fees-queue.spec.tsx`, `admin-contract-fees-workspace.spec.tsx`, `owner-contract-signing-page.spec.tsx` (all tests passing)
- Verified build succeeds across shared, api, and web packages with 0 TypeScript/build errors.

### File List

- `packages/shared/src/constants/contracts.ts`
- `packages/shared/src/types/contracts.ts`
- `packages/shared/src/schemas/contracts.schema.ts`
- `packages/shared/src/schemas/__tests__/contracts.spec.ts`
- `apps/api/src/modules/contracts/contract-fee-lock.ts`
- `apps/api/src/modules/contracts/owner-contracts.service.ts`
- `apps/api/src/modules/contracts/owner-contracts.controller.ts`
- `apps/api/src/modules/contracts/admin-contract-fees.service.ts`
- `apps/api/src/modules/contracts/admin-contract-fees.controller.ts`
- `apps/api/src/modules/contracts/contracts.module.ts`
- `apps/api/src/modules/contracts/__tests__/owner-contracts.service.spec.ts`
- `apps/api/src/modules/contracts/__tests__/admin-contract-fees.service.spec.ts`
- `apps/api/src/modules/contracts/__tests__/admin-contract-fees.controller.spec.ts`
- `apps/web/src/components/contracts/contract-fee-proof-modal.tsx`
- `apps/web/src/app/app/owner/contracts/[id]/page.tsx`
- `apps/web/src/app/app/owner/__tests__/owner-contract-fee-proof.spec.tsx`
- `apps/web/src/app/admin/contract-fees/contract-fees-helpers.ts`
- `apps/web/src/app/admin/contract-fees/page.tsx`
- `apps/web/src/app/admin/contract-fees/[id]/page.tsx`
- `apps/web/src/app/admin/contract-fees/__tests__/admin-contract-fees-queue.spec.tsx`
- `apps/web/src/app/admin/contract-fees/__tests__/admin-contract-fees-workspace.spec.tsx`
- `apps/web/src/app/admin/page.tsx`

