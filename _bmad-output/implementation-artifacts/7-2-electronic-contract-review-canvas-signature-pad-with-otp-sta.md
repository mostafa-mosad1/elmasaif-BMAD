---
baseline_commit: 06f781f1b89b2b5b884b23bc3749cd079da73383
---

# Story 7.2: Electronic Contract Review & Canvas Signature Pad with OTP Stamping

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a property owner who received an approved listing contract,
I want to review the legal agreement, execute an electronic signature on an interactive touch/mouse canvas pad, and authenticate with a 6-digit OTP dispatched to my verified mobile number,
So that my electronic signature is legally binding, timestamped, and audited under Saudi electronic transaction regulations.

## Acceptance Criteria

1. **Owner Contract Detail & Review View (`/app/owner/contracts/:id`) (`FR-9`, `UC-50`, `UJ-3`, `UX-DR9`):**
   - **Given** an authenticated user operating under an active `OWNER` profile
   - **When** accessing `GET /api/v1/owner/contracts/:id`
   - **Then** the endpoint returns the full contract details:
     - `id`: contract unique identifier
     - `listingId`: associated property listing identifier
     - `propertyTitle`, `propertyType`, `cityName`, `districtName`, `askPrice`, `areaSquareMeters`
     - `contractTerms`: complete compiled legal text (including standard REGA clauses and customized terms)
     - `contractFee`: numeric SAR fee (`Decimal(12,2)`)
     - `feeOverrideReason`: admin override justification if applicable
     - `status`: current `OwnerContractStatus` (`PENDING_SIGNATURE`, `PENDING_FEE`, `ACTIVE`, `EXPIRED`, `TERMINATED`)
     - `expiresAt`: deadline ISO timestamp (7 days from dispatch)
     - `createdAt`: dispatch ISO timestamp
     - `signedAt`: ISO timestamp (if signed, null otherwise)
     - `signatureData`: raster signature image URL or data string (if signed, null otherwise)
     - `ownerName`: owner full legal name
     - `ownerMobile`: masked mobile number (`+966 5X XXX XXXX`)
   - **And** if the contract does not exist, returns HTTP 404 with `OWNER_CONTRACT_NOT_FOUND`
   - **And** if the contract belongs to another user, returns HTTP 403 with `AUTH_NOT_AUTHORIZED`
   - **And** if accessed via `OwnerListingRequest` ID (fallback resolution), correctly resolves the associated `OwnerContract`.

2. **Interactive Canvas Signature Pad (`FR-9`, `UX-DR9`, `EXPERIENCE.md § 4`):**
   - **Given** an owner viewing a contract in `PENDING_SIGNATURE` status
   - **When** scrolling to the signature execution block on the contract screen
   - **Then** an interactive HTML5 canvas signature pad is rendered:
     - Full touch, pen, and pointer/mouse event support with high-DPI retina display scaling (`window.devicePixelRatio`)
     - Real-time line smoothing and stroke tracking
     - "مسح التوقيع" (Clear Signature) button resetting canvas to an empty state
     - Client-side validation ensuring the canvas is not blank (minimum drawn stroke count or non-empty canvas pixel verification)
     - Legal consent checkbox and declaration text in Arabic:
       - "أقر أنا الموقع أدناه بصفتي المالك النظامي للعقار بصحة كافة البيانات المذكورة أعلاه، وموافقتي التامة والملزمة على كافة بنود وشروط هذا العقد وفق نظام الوساطة العقارية ولائحته التنفيذية بالمملكة العربية السعودية."
     - Prominent CTA button: "اعتماد التوقيع وإرسال رمز التحقق" (Confirm Signature & Send OTP) which is disabled until the canvas contains a valid drawn signature and the legal consent checkbox is checked.

3. **6-Digit OTP Dispatch for Signature Authentication (`FR-9`, `UC-53`, `EXPERIENCE.md § 4`):**
   - **Given** an owner who has drawn their signature, checked the consent box, and clicks "اعتماد التوقيع وإرسال رمز التحقق"
   - **When** calling `POST /api/v1/owner/contracts/:id/request-signature-otp`:
     - Backend verifies:
       - Contract exists and belongs to the caller's active owner profile
       - Contract status is strictly `PENDING_SIGNATURE` (throws HTTP 409 Conflict with `OWNER_CONTRACT_INVALID_STATE` if in any other status)
       - Contract has not expired (`expiresAt > ClockService.now()`, throws HTTP 400 with `OWNER_CONTRACT_EXPIRED` if expired)
     - Dispatches a 6-digit OTP to the owner's registered mobile number using `OtpService.generateAndSendOtp(user.mobileNumber, 'CONTRACT_SIGNATURE', { contractId: contract.id })`
     - Enforces standard OTP throttling (60-second resend cooldown) and hourly limits
     - In development mode with `ENABLE_STATIC_OTP=true` or `OTP_PROVIDER=static`, uses `STATIC_DEV_OTP` (`123456`)
     - Returns HTTP 200 with `{ success: true, resendAvailableInSeconds: number }`
   - **And** opens an OTP verification modal in the UI displaying:
     - Clear indicator showing the masked recipient mobile number (`05X XXX XXXX`)
     - 6 individual numeric input boxes with auto-focus hopping, backspace retreat, and paste support
     - Real-time 60-second cooldown timer before allowing "إعادة إرسال الرمز" (Resend Code)
     - Development environment hint badge showing static code `123456` when running in test/dev.

4. **Permanent Signature Execution & Legal Evidence Stamping (`FR-9`, `OQ-11`, `UC-53`, `UJ-3`):**
   - **Given** the owner submitting the 6-digit OTP code along with the signature raster
   - **When** calling `POST /api/v1/owner/contracts/:id/sign` with:
     - `signatureData`: Base64 PNG image data URL (`data:image/png;base64,...`)
     - `otpCode`: 6-digit numeric string
   - **Then** the backend atomically executes in a database transaction:
     - Verifies contract ownership, status (`PENDING_SIGNATURE`), and non-expired state (`expiresAt > ClockService.now()`)
     - Verifies the OTP via `OtpService.verifyOtp(user.mobileNumber, 'CONTRACT_SIGNATURE', dto.otpCode)`:
       - If invalid: increments attempt counter, returns HTTP 400 `AUTH_OTP_INVALID` with remaining attempts
       - If 3 failed attempts: temporarily locks verification for 15 minutes (HTTP 423 `AUTH_OTP_LOCKED`)
       - If expired: returns HTTP 400 `AUTH_OTP_EXPIRED`
     - Captures client network and device metadata from request:
       - `ipAddress`: extracted from client IP (`req.ip` or `x-forwarded-for`)
       - `userAgent`: extracted from `req.headers['user-agent']`
     - Updates the `OwnerContract` record:
       - `signatureData`: saved raster image data
       - `signedAt`: `ClockService.now()`
       - `otpCode`: verified masked reference
       - `ipAddress`: captured client IP
       - `userAgent`: captured client browser user-agent
       - `status`: `OwnerContractStatus.PENDING_FEE`
       - `expiresAt`: `ClockService.now() + 7 days` (initiating the 7-day payment window for listing fee proof upload per `FR-9` / `A-06`)
     - Cleans up OTP record via `OtpService.cleanupOtp`
     - Writes an immutable `AuditLog` entry:
       - `actorId`: user.id
       - `actorType`: 'USER'
       - `action`: 'OWNER_CONTRACT_SIGNED'
       - `entityType`: 'OwnerContract'
       - `entityId`: contract.id
       - `payload`: `{ listingId, ownerProfileId, signedAt, ipAddress, userAgent }`
     - Dispatches in-app notification event `contract.signed_pending_fee`
     - Returns HTTP 200 with `{ success: true, contractId, status: 'PENDING_FEE', signedAt, expiresAt }`.

5. **Signed Contract View & Fee Payment Transition State (`FR-9`, `FR-10`, `UJ-3`):**
   - **Given** an owner viewing a contract in `PENDING_FEE` status
   - **When** the page renders
   - **Then** the signature pad is replaced with an official electronic verification stamp:
     - Green verified badge: `عقد موثق وموقع إلكترونياً` (Electronically Signed & Stamped Contract)
     - Audit evidence block:
       - Signature timestamp (`signedAt`) in Arabic locale
       - Signer full name and masked mobile number
       - Device IP address and browser client stamp
       - High-fidelity visual reproduction of the owner's drawn signature
     - Active fee payment countdown banner:
       - Remaining time out of the 7-day fee deadline (`expiresAt`)
       - Required fee amount (SAR 1,000.00) and non-refundable legal disclosure
       - Platform bank transfer details (Beneficiary: شركة المصايف العقارية, Bank: مصرف الراجحي, IBAN: `SA0380000000608010167519`)
     - Prominent CTA button: "سداد رسوم العقد ورفع الإشعار البنكي" (Pay Fee & Upload Bank Receipt) leading to the fee upload workflow (preparing for Story 7.3).

6. **Contract Expiry & Guardrails (`FR-9`, `BR-15`):**
   - If an owner visits or attempts to sign a contract whose `expiresAt <= ClockService.now()`:
     - Endpoint rejects signing with HTTP 400 `OWNER_CONTRACT_EXPIRED`
     - UI displays an amber/red expiry alert: "انتهت مهلة التوقيع على هذا العقد (7 أيام). يرجى تقديم طلب إدراج جديد أو التواصل مع إدارة المنصة."
     - Signature pad and OTP submission are disabled.
   - If an owner attempts to sign an already signed contract:
     - Endpoint rejects with HTTP 409 `OWNER_CONTRACT_ALREADY_SIGNED`.

7. **Prisma Schema Enhancements for Legal Evidence Preservation (`OQ-11`, `AR14`):**
   - Add `ipAddress String? @map("ip_address")` and `userAgent String? @map("user_agent")` fields to `OwnerContract` in `apps/api/prisma/schema.prisma`.
   - Regenerate Prisma client (`npx prisma generate`).

8. **Sovereign Design System & RTL Accessibility (`UX-DR9`, `UX-DR15`):**
   - Strict adherence to the Sovereign Design System:
     - RTL layout (`dir="rtl"`) with IBM Plex Sans Arabic typography
     - Clean emerald header banner (`#1B4332`), white/tinted badge chips, and clear legal section typography
     - Responsive canvas signature pad with touch-action isolation (`touch-action: none`) preventing unintended page scrolling while signing
     - Accessible form controls with visible focus rings, ARIA labels, and high contrast.

## Tasks / Subtasks

- [x] Task 1: Prisma Schema & Evidence Fields Enhancement (AC: 4, 7)
  - [x] Add `ipAddress String? @map("ip_address")` and `userAgent String? @map("user_agent")` to `OwnerContract` in `apps/api/prisma/schema.prisma`.
  - [x] Run `npx prisma generate` to refresh Prisma client types.

- [x] Task 2: Shared Types, Constants & Zod Schemas (`packages/shared`) (AC: 1, 2, 3, 4, 6)
  - [x] Export error codes in `packages/shared/src/constants/contracts.ts`:
    - `OWNER_CONTRACT_INVALID_STATE`
    - `OWNER_CONTRACT_EXPIRED`
    - `OWNER_CONTRACT_ALREADY_SIGNED`
    - `CONTRACT_SIGNATURE_DATA_REQUIRED`
  - [x] Add Zod schemas in `packages/shared/src/schemas/contracts.schema.ts`:
    - `requestSignatureOtpSchema`
    - `signOwnerContractSchema` (validating `signatureData` non-empty data URL/SVG and `otpCode` 6-digit regex)
  - [x] Define TypeScript interfaces in `packages/shared/src/types/contracts.ts`:
    - `OwnerContractDetailResponse`
    - `SignOwnerContractInput`
    - `SignOwnerContractResult`
    - `RequestSignatureOtpResult`
  - [x] Add unit tests in `packages/shared/src/schemas/__tests__/contracts.spec.ts` for signing validation.

- [x] Task 3: Backend Owner Contracts Service & Controller (`apps/api/src/modules/contracts`) (AC: 1, 3, 4, 6)
  - [x] Create `owner-contracts.service.ts`:
    - `getContractDetail(userId: string, contractId: string)`: validates owner access, resolves via contract ID or request ID, returns full terms, property specs, fee, expiry, and signature evidence.
    - `requestSignatureOtp(userId: string, contractId: string)`: validates `PENDING_SIGNATURE` status and expiry, dispatches OTP via `OtpService.generateAndSendOtp(user.mobileNumber, 'CONTRACT_SIGNATURE', { contractId })`.
    - `signContract(userId: string, contractId: string, dto: SignOwnerContractInput, ipAddress?: string, userAgent?: string)`: verifies OTP, captures IP & User-Agent, updates `OwnerContract` to `PENDING_FEE` with new 7-day payment expiry, writes `AuditLog`, cleans up OTP, emits notification event.
  - [x] Create `owner-contracts.controller.ts`:
    - `GET /api/v1/owner/contracts/:id` (`SessionAuthGuard`, `ActiveRoleGuard`, `@RequireRole(UserRole.OWNER)`)
    - `POST /api/v1/owner/contracts/:id/request-signature-otp`
    - `POST /api/v1/owner/contracts/:id/sign` (extracting `req.ip` and `req.headers['user-agent']`)
  - [x] Register `OwnerContractsService` and `OwnerContractsController` in `contracts.module.ts`.

- [x] Task 4: Canvas Signature Pad & OTP Modal Components (`apps/web`) (AC: 2, 3, 8)
  - [x] Create `apps/web/src/components/contracts/signature-pad.tsx`:
    - Native HTML5 `<canvas>` with touch (`onTouchStart`, `onTouchMove`, `onTouchEnd`) and pointer event handling
    - HiDPI resolution handling using `devicePixelRatio`
    - Line width, rounded caps, smooth curve rendering
    - Clear signature button ("مسح التوقيع")
    - Non-blank detection via stroke count / pixel checking
    - Export signature as PNG data URL (`toDataURL('image/png')`)
  - [x] Create `apps/web/src/components/contracts/signature-otp-modal.tsx`:
    - 6-digit numeric input with auto-advance and backspace navigation
    - 60-second cooldown timer with resend action
    - Static OTP hint for development (`123456`)
    - Error handling and lockout banner.

- [x] Task 5: Owner Contract Review & Signing Page (`/app/owner/contracts/[id]`) (AC: 1, 2, 4, 5, 6, 8)
  - [x] Create `apps/web/src/app/app/owner/contracts/[id]/page.tsx`:
    - Header banner with REGA compliance badge and contract title
    - Terms viewer with legal text formatted in readable Arabic typography
    - Property specification summary card
    - Expiry deadline countdown card
    - If `PENDING_SIGNATURE`:
      - Signature pad component
      - Legal declaration and consent checkbox
      - "اعتماد التوقيع وإرسال رمز التحقق" CTA triggering OTP modal
    - If `PENDING_FEE` (already signed):
      - Green verified electronic signature stamp with timestamp, signer name, masked phone, IP, and rendered signature image
      - 7-day fee deadline banner (SAR 1,000.00)
      - Platform bank transfer instructions and IBAN
      - Disabled/placeholder CTA "رفع إشعار التحويل البنكي" (preparing for Story 7.3)
    - If `EXPIRED`:
      - Warning banner stating contract has expired and directing to new listing submission.

- [x] Task 6: Comprehensive Automated Tests (AC: 1, 2, 3, 4, 6)
  - [x] Backend unit tests in `apps/api/src/modules/contracts/__tests__/owner-contracts.service.spec.ts`:
    - Owner authorization validation
    - Detail retrieval for pending, signed, and expired contracts
    - OTP generation with proper purpose and mobile number
    - Signing with valid OTP: captures signature, IP, User-Agent, updates status to `PENDING_FEE`, resets 7-day expiry, writes audit log
    - Signing failures: wrong OTP, expired OTP, locked OTP, expired contract, already signed contract
  - [x] Backend controller tests in `apps/api/src/modules/contracts/__tests__/owner-contracts.controller.spec.ts`:
    - Guard enforcement (`SessionAuthGuard`, `ActiveRoleGuard`, `@RequireRole(UserRole.OWNER)`)
    - IP and user agent extraction from request
  - [x] Frontend unit tests in `apps/web/src/app/app/owner/__tests__/owner-contract-signing-page.spec.tsx`:
    - Renders contract terms, property summary, and fee
    - Canvas signature pad interaction (drawing, clear)
    - OTP modal open and code verification submission
    - Signed status stamp view rendering.

## Dev Notes

### Architecture & Existing Components to Leverage

- **Prisma Schema (`apps/api/prisma/schema.prisma`):**
  - Model `OwnerContract`:
    ```prisma
    model OwnerContract {
      id                String              @id @default(uuid())
      listingId         String              @unique
      ownerProfileId    String
      templateId        String?
      contractFee       Decimal             @default(1000.00) @db.Decimal(12, 2)
      feeOverrideReason String?             @map("fee_override_reason")
      contractTerms     String
      signatureData     String?
      signedAt          DateTime?
      otpCode           String?
      ipAddress         String?             @map("ip_address")
      userAgent         String?             @map("user_agent")
      status            OwnerContractStatus @default(DRAFT)
      expiresAt         DateTime
      createdAt         DateTime            @default(now())
      updatedAt         DateTime            @updatedAt
      ...
    }
    ```
- **OTP Service Reusability (`apps/api/src/modules/auth/otp/otp.service.ts`):**
  - Use `OtpService` directly from `AuthModule` (already imported in `ContractsModule`).
  - Methods:
    - `generateAndSendOtp(mobileNumber: string, purpose: string, metadata?: Record<string, any>)`
    - `verifyOtp(mobileNumber: string, purpose: string, code: string)`
    - `cleanupOtp(recordId: string)`
  - Purpose string: `'CONTRACT_SIGNATURE'`
  - Error codes handled: `AUTH_OTP_LOCKED` (HTTP 423), `AUTH_OTP_THROTTLED` (429), `AUTH_OTP_MAX_EXCEEDED` (429), `AUTH_OTP_EXPIRED` (400), `AUTH_OTP_INVALID` (400).
- **Audit Logging Standard (`apps/api/src/modules/audit`):**
  - Record audit log entry inside the transaction:
    ```typescript
    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'OWNER_CONTRACT_SIGNED',
        entityType: 'OwnerContract',
        entityId: contract.id,
        payload: {
          listingId: contract.listingId,
          ownerProfileId: contract.ownerProfileId,
          signedAt: now.toISOString(),
          ipAddress,
          userAgent,
        },
      },
    });
    ```
- **State Machine Alignment (`EXPERIENCE.md § 4`):**
  - Initial contract state on dispatch: `OwnerContractStatus.PENDING_SIGNATURE`.
  - State after successful signature & OTP stamping: `OwnerContractStatus.PENDING_FEE`.
  - Expiry on dispatch: `now + 7 days` (signature window).
  - Expiry on signature: updated to `now + 7 days` (fee payment window per `FR-9` / `A-06`).
  - Request status `OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE` remains until fee confirmed in Story 7.3.
- **Client IP & User-Agent Extraction:**
  - In NestJS controller:
    ```typescript
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    ```
- **Canvas Signature Implementation Standards:**
  - Avoid heavy external dependencies. Use a clean React component wrapping an HTML5 `<canvas>`.
  - Canvas size: responsive width (e.g. 100% of container, max 600px) and height (180px–220px).
  - Use `ctx.lineWidth = 2.5`, `ctx.lineCap = 'round'`, `ctx.lineJoin = 'round'`, `ctx.strokeStyle = '#0F172A'`.
  - Apply `style={{ touchAction: 'none' }}` to prevent mobile scroll interference while drawing.
  - Export raster via `canvas.toDataURL('image/png')`.

### Project Structure Notes

- API module location: `apps/api/src/modules/contracts/`
- Shared contracts:
  - `packages/shared/src/constants/contracts.ts`
  - `packages/shared/src/types/contracts.ts`
  - `packages/shared/src/schemas/contracts.schema.ts`
  - `packages/shared/src/validators/contracts.ts`
- Web components & pages:
  - Signature pad: `apps/web/src/components/contracts/signature-pad.tsx`
  - OTP modal: `apps/web/src/components/contracts/signature-otp-modal.tsx`
  - Contract signing page: `apps/web/src/app/app/owner/contracts/[id]/page.tsx`
  - Test specs: `apps/web/src/app/app/owner/__tests__/owner-contract-signing-page.spec.tsx`

### References

- [Source: epics.md#Story 7.2: Electronic Contract Review & Canvas Signature Pad with OTP Stamping]
- [Source: prd.md#FR-9: Owner Contract Generation & Electronic Signature]
- [Source: prd.md#FR-10: Owner Contract Fee Verification]
- [Source: prd.md#OQ-11: Electronic signature legal evidence package]
- [Source: EXPERIENCE.md#4. Owner Electronic Signature & OTP Stamping (FR-9, FR-10)]
- [Source: apps/api/src/modules/auth/otp/otp.service.ts]
- [Source: apps/api/src/modules/contracts/admin-owner-requests.service.ts]

## Dev Agent Record

### Agent Model Used

Antigravity (Advanced Agentic Coding)

### Debug Log References
- Verified Prisma schema update (`ipAddress`, `userAgent` in `OwnerContract`) and generated Prisma client.
- Exported error codes, Zod validation schemas (`signOwnerContractSchema`, `requestSignatureOtpSchema`), and TypeScript interfaces in `packages/shared`.
- Passed 21/21 shared schema tests (`packages/shared/src/schemas/__tests__/contracts.spec.ts`).
- Implemented `OwnerContractsService` and `OwnerContractsController` in `apps/api/src/modules/contracts/` with ownership validation, contract resolution fallback via listing request ID, OTP dispatch, transactional signing with client IP/User-Agent capture, audit logging, and OTP cleanup.
- Passed 17/17 API contract tests (`owner-contracts.service.spec.ts`, `owner-contracts.controller.spec.ts`).
- Created `SignaturePad` and `SignatureOtpModal` components in `apps/web/src/components/contracts/`.
- Created owner contract review and signing page at `apps/web/src/app/app/owner/contracts/[id]/page.tsx` adhering to Sovereign Design System with RTL support, legal declaration, signature canvas, OTP modal flow, green verified electronic stamp, and fee payment instructions.
- Passed 4/4 web unit tests (`owner-contract-signing-page.spec.tsx`) and full web suite (77 files, 448 tests passing).
- Verified full clean build of `@elmasaif/api` and `@elmasaif/web`.

### Completion Notes List
- All 8 Acceptance Criteria for Story 7.2 are fully implemented and verified.
- Task 1: Added `ipAddress` and `userAgent` to `OwnerContract` model in Prisma schema and regenerated client.
- Task 2: Added `OWNER_CONTRACT_INVALID_STATE`, `OWNER_CONTRACT_EXPIRED`, `OWNER_CONTRACT_ALREADY_SIGNED`, `CONTRACT_SIGNATURE_DATA_REQUIRED` error codes, signing Zod schemas, and TypeScript interfaces.
- Task 3: Created `OwnerContractsService` and `OwnerContractsController` with endpoints `GET /api/v1/owner/contracts/:id`, `POST /api/v1/owner/contracts/:id/request-signature-otp`, and `POST /api/v1/owner/contracts/:id/sign`. Registered in `contracts.module.ts`.
- Task 4: Created `SignaturePad` with touch/pointer/pen HiDPI rendering, smoothing, clear, and blank detection. Created `SignatureOtpModal` with 6-digit auto-advancing input, 60s cooldown, static OTP dev hint (`123456`), and error handling.
- Task 5: Created `apps/web/src/app/app/owner/contracts/[id]/page.tsx` with dynamic status handling (`PENDING_SIGNATURE`, `PENDING_FEE`, `ACTIVE`, `EXPIRED`), legal declaration consent, terms reader, verified electronic stamp, and fee payment banner.
- Task 6: Added comprehensive unit and integration tests across shared, API, and web tiers with 100% pass rate.

### File List
- `apps/api/prisma/schema.prisma` (modified)
- `packages/shared/src/constants/contracts.ts` (modified)
- `packages/shared/src/schemas/contracts.schema.ts` (modified)
- `packages/shared/src/types/contracts.ts` (modified)
- `packages/shared/src/schemas/__tests__/contracts.spec.ts` (modified)
- `apps/api/src/modules/contracts/owner-contracts.service.ts` (new)
- `apps/api/src/modules/contracts/owner-contracts.controller.ts` (new)
- `apps/api/src/modules/contracts/contracts.module.ts` (modified)
- `apps/api/src/modules/contracts/__tests__/owner-contracts.service.spec.ts` (new)
- `apps/api/src/modules/contracts/__tests__/owner-contracts.controller.spec.ts` (new)
- `apps/web/src/components/contracts/signature-pad.tsx` (new)
- `apps/web/src/components/contracts/signature-otp-modal.tsx` (new)
- `apps/web/src/app/app/owner/contracts/[id]/page.tsx` (new)
- `apps/web/src/app/app/owner/__tests__/owner-contract-signing-page.spec.tsx` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/7-2-electronic-contract-review-canvas-signature-pad-with-otp-sta.md` (modified)

### Change Log
- 2026-11-11: Implemented Story 7.2: Electronic Contract Review & Canvas Signature Pad with OTP Stamping. Added Prisma evidence fields, shared validation schemas, owner contracts service & controller, canvas signature pad, OTP verification modal, contract review & signing page, and comprehensive automated test suites. Status updated to review.


