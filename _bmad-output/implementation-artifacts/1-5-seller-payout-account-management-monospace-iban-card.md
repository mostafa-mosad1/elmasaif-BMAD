---
baseline_commit: 6c009ac3e3cdf1cfefddd1e479a626ca1252e78c
---

# Story 1.5: Seller Payout Account Management & Monospace IBAN Card

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a marketer or property owner,
I want to register and manage verified Saudi payout bank accounts with Mod-97 checksum validation,
So that I can securely receive property sales proceeds.

## Acceptance Criteria

1. **Saudi IBAN Format & ISO 7064 Mod-97 Checksum Validation (`packages/shared` & `apps/api` per FR-5, UJ-1, UJ-2, UJ-3):**
   - **Given** an authenticated seller (Marketer or Owner) adding or updating a payout bank account
   - **When** the client submits the account holder name and 24-character Saudi IBAN starting with `SA`
   - **Then** both client and server enforce strict format and ISO 7064 Mod-97 checksum validation via shared `saudiIbanSchema` and `validateSaudiIban`:
     - Must start with `SA` (case-insensitive on input, normalized to uppercase `SA`).
     - Exactly 24 characters: `SA` + 2 numeric check digits + 2 numeric bank identifier digits + 18 alphanumeric account digits (`/^SA\d{22}$/`).
     - Rearranged characters mod 97 remainder must equal 1 (`BigInt(numericString) % 97n === 1n`).
     - Extracts and maps the 2-digit bank identifier code to official Saudi banks (e.g., `80` $\to$ "مصرف الراجحي", `10` $\to$ "البنك الأهلي السعودي", `50` $\to$ "بنك الرياض", `05` $\to$ "مصرف الإنماء", `20` $\to$ "بنك الأول SABB", `15` $\to$ "بنك البلاد", `45` $\to$ "البنك السعودي الفرنسي", `30` $\to$ "البنك العربي الوطني", `65` $\to$ "بنك الجزيرة", `60` $\to$ "بنك مسقط", `76` $\to$ "بنك الخليج الدولي", `85` $\to$ "بنك الإمارات دبي الوطني", `90` $\to$ "بنك دي 360", `95` $\to$ "إس تي سي بنك").
   - **And** if the IBAN format is invalid or Mod-97 checksum validation fails, the system rejects the request immediately with HTTP 400 Bad Request and error code `PAYOUT_INVALID_IBAN` ("رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)").

2. **AES-256 Encryption at Rest & Database Model Persistence (`apps/api` & Prisma per FR-5, PRD Section 11):**
   - **Given** a valid Saudi IBAN being saved to PostgreSQL
   - **When** `PayoutService` persists the record:
     - The plaintext IBAN is encrypted at rest using AES-256-GCM via `CryptoService` (`iv:authTag:ciphertext`).
     - Plaintext IBAN is NEVER stored directly in raw database columns, plain text logs, or unmasked in general API listings.
     - Persists in `PayoutAccount` model:
       - `id`: UUID.
       - `profileId`: foreign key to `UserProfile` of the authenticated seller (`role IN ['MARKETER', 'OWNER']`).
       - `accountHolderName`: string (3–100 characters per FR-5).
       - `bankName`: string (mapped from Saudi bank code, e.g., "مصرف الراجحي").
       - `ibanEncrypted`: string containing AES-256-GCM ciphertext.
       - `ibanMasked`: masked string formatted for privacy (`SA03 **** **** **** **** 1234`).
       - `ibanLast4`: string containing the last 4 digits (`1234`) for indexing and identification.
       - `isDefault`: boolean (defaults to `true` if first payout account).
       - `hasCommercialNameMismatch`: boolean (flag indicating mismatch against registered username or Fal commercial name).
       - `createdAt`, `updatedAt`.
     - When the account is designated as default, `UserProfile.payoutIban` is synchronized with `ibanMasked` (or default reference).

3. **Monospace Grouped IBAN Display, Copy Button & Toast Confirmation (`apps/web` per DESIGN.md & EXPERIENCE.md):**
   - **Given** a registered payout account rendered on screen in `MonospaceIbanCard`
   - **When** displayed in the client UI:
     - The IBAN is rendered in institutional monospace typography (`JetBrains Mono`, `font-mono`) grouped into blocks of 4 characters: `SA03 8000 0000 0000 0000 0000`.
     - Renders bank name badge, default badge, and account holder name.
     - Provides a dedicated one-click copy button (`Copy` icon from `lucide-react`).
     - Clicking the copy button copies the raw, unspaced 24-character string (`SA0380000000000000000000`) into the user's system clipboard (`navigator.clipboard.writeText`).
     - Triggers instant toast / tooltip feedback confirming: "تم نسخ رقم الآيبان بنجاح" persisting for 2 seconds.
     - Provides a reveal/hide toggle (`Eye` / `EyeOff` icon) allowing the authenticated owner to inspect their unmasked IBAN.

4. **Step-Up OTP Verification on Account Modification (`apps/api` & `apps/web` per FR-5, BR-05, R-01):**
   - **Given** an authenticated seller attempting to add (`POST /api/v1/users/payout-accounts`), update (`PUT /api/v1/users/payout-accounts/:id`), or delete (`DELETE /api/v1/users/payout-accounts/:id`) a payout account
   - **When** the mutation is initiated:
     - Requires step-up OTP verification dispatched to the user's verified registered mobile number (`purpose: 'PAYOUT_ACCOUNT_UPDATE'`).
     - Client requests an OTP via `POST /api/v1/users/payout-accounts/request-otp`.
     - Server dispatches 6-digit OTP using `OtpService.generateAndSendOtp(user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE')`.
     - Enforces standard platform security parameters: 300s expiry, 60s throttle, 3 max hourly requests, lockout after 3 consecutive wrong attempts.
     - Mutation requests must supply `otpCode` in request body (or query for delete).
     - Server verifies `otpCode` via `OtpService.verifyOtp(user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE', body.otpCode)` before mutating database records.
     - An immutable `AuditLog` entry is inserted within the transaction (`action: 'PAYOUT_ACCOUNT_CREATED' | 'PAYOUT_ACCOUNT_UPDATED' | 'PAYOUT_ACCOUNT_DELETED'`, `actorId: user.id`, `entityType: 'PayoutAccount'`).
     - If OTP is missing, invalid, expired, or locked, request fails immediately with standard HTTP errors (`AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_LOCKED`).

5. **Active Non-Terminal Deal Restriction & Protection Guard (`apps/api` per FR-5, BR-02, BR-05, AD-3):**
   - **Given** an existing payout account registered by a seller
   - **When** the seller attempts to update (`PUT /api/v1/users/payout-accounts/:id`) or delete (`DELETE /api/v1/users/payout-accounts/:id`) the payout account
   - **Then** the system checks if the payout account or seller is currently bound to any `Deal` in an active, non-terminal state:
     - Non-terminal deal statuses: `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`.
     - (Terminal deal statuses: `COMPLETED`, `CANCELLED`, `TERMINATED`).
   - **And** if any active non-terminal deal is found:
     - The deletion or modification request is strictly REJECTED with HTTP 409 Conflict (or HTTP 400 Bad Request) and error code `PAYOUT_ACTIVE_DEAL_RESTRICTION` ("لا يمكن تعديل أو حذف الحساب البنكي لوجود صفقات نشطة قيد التنفيذ").
     - An audit warning is recorded (`action: 'PAYOUT_MODIFICATION_BLOCKED_ACTIVE_DEAL'`).
     - In the UI, accounts bound to active deals display an institutional lock badge: "مرتبط بصفقة نشطة - غير قابل للتعديل حالياً".

6. **Account Holder Commercial Name Mismatch Warning (`apps/api` per FR-5, Assumption A-10):**
   - **Given** a Marketer or Owner registering a payout account
   - **When** entering `accountHolderName` (3–100 chars):
   - **Then** the system compares `accountHolderName` against the seller's registered `user.fullName` and the Marketer's `FalLicense.commercialName` (if present):
     - If `accountHolderName` does not match `user.fullName` or `commercialName`:
       - The system does NOT hard block registration (to accommodate commercial variations per A-10).
       - Sets `hasCommercialNameMismatch: true` on the `PayoutAccount` record.
       - Records an audit log warning (`action: 'PAYOUT_NAME_MISMATCH_WARNING'`, `payload: { accountHolderName, userFullName, commercialName }`).
       - API returns a warning notification (`warning: 'ACCOUNT_HOLDER_NAME_MISMATCH'`, "تنبيه: اسم صاحب الحساب البنكي لا يتطابق تماماً مع الاسم المسجل بالمنصة. سيتم التحقق الإضافي عند تدقيق المدفوعات").

7. **Role Authorization & Workspace Integration (`apps/api` & `apps/web` per UJ-2, UJ-3):**
   - **Given** user authentication and role guards
   - **When** a user accesses payout management:
     - Only users with an active role of `MARKETER` or `OWNER` can create or manage payout accounts. If a user with active role `BUYER` attempts to create or manage payout accounts, the system responds with HTTP 403 Forbidden and code `PAYOUT_ROLE_NOT_AUTHORIZED` ("إدارة حسابات التحويل البنكي مقتصرة على المسوقين وملاك العقارات").
     - Renders dedicated RTL Arabic page at `/app/settings/payout` accessible from Marketer Workspace (`/app/marketer`) and Owner Workspace (`/app/owner`).
     - Adds navigation link under Account Settings in `/app/settings/profile`.
     - Displays registered payout accounts in responsive grid/list with `MonospaceIbanCard`.
     - Provides "إضافة حساب بنكي جديد" modal with real-time Mod-97 validation, bank name badge, and step-up OTP verification.

8. **Automated Verification & Testing Gates:**
   - **Given** test suites across `packages/shared`, `apps/api`, and `apps/web`
   - **When** running verification commands
   - **Then** 100% of tests pass:
     - Shared schema tests validating `saudiIbanSchema`, `validateSaudiIban`, bank code extraction, and payout input/response schemas.
     - Backend crypto tests for `CryptoService` validating AES-256-GCM encryption, decryption, authentication tag validation, and tampering rejection.
     - Backend unit tests for `PayoutService` verifying:
       - Mod-97 checksum validation and bank name detection.
       - Step-up OTP generation and verification requirement.
       - AES-256 encryption at rest and masked display formatting.
       - Active non-terminal deal protection blocking modification/deletion.
       - Account holder name vs. commercial name mismatch warning flag.
       - Role enforcement restricting access to Marketers and Owners.
       - Immutable audit log insertion.
     - Backend controller tests for `PayoutController`.
     - Frontend component tests for `MonospaceIbanCard` verifying grouped monospace format, copy button clipboard interaction, toast trigger, and deal lock indicators.
     - Zero TypeScript compilation errors, zero lint warnings (`npm run lint`), and clean builds (`npm run build`).

## Tasks / Subtasks

- [x] Task 1: Prisma Schema & Database Models in `apps/api` (AC: 2, 5)
  - [x] 1.1 Update `apps/api/prisma/schema.prisma`:
    - Define model `PayoutAccount`:
      - `id`: String @id @default(uuid())
      - `profileId`: String @map("profile_id")
      - `accountHolderName`: String @map("account_holder_name")
      - `bankName`: String? @map("bank_name")
      - `ibanEncrypted`: String @map("iban_encrypted")
      - `ibanMasked`: String @map("iban_masked")
      - `ibanLast4`: String @map("iban_last4")
      - `isDefault`: Boolean @default(true) @map("is_default")
      - `hasCommercialNameMismatch`: Boolean @default(false) @map("has_commercial_name_mismatch")
      - `createdAt`: DateTime @default(now()) @map("created_at")
      - `updatedAt`: DateTime @updatedAt @map("updated_at")
      - Relations: `profile UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)`
      - Indexes: `@@index([profileId])`, `@@map("payout_accounts")`
    - Update `model UserProfile`: add `payoutAccounts PayoutAccount[]`.
  - [x] 1.2 Run `npm run prisma:generate` in `apps/api` to update Prisma Client types.

- [x] Task 2: Shared Contracts, Schemas, Bank Codes & Constants in `packages/shared` (AC: 1, 6, 7)
  - [x] 2.1 Update `packages/shared/src/schemas/payout.schema.ts` (and export in `packages/shared/src/schemas/index.ts`):
    - Export `SAUDI_BANK_NAMES` dictionary mapping 2-digit bank codes (`80`, `10`, `50`, `05`, `20`, `15`, `45`, `30`, `65`, `60`, `76`, `85`, `90`, `95`) to Arabic bank names.
    - Export helper `getSaudiBankName(iban: string): string | null`.
    - Export helper `formatSaudiIban(iban: string): string` (groups into 4-char blocks: `SA03 8000 0000 0000 0000 0000`).
    - Export helper `maskSaudiIban(iban: string): string` (`SA03 **** **** **** **** 1234`).
    - Export `createPayoutAccountSchema`: `z.object({ accountHolderName: z.string().trim().min(3).max(100), iban: saudiIbanSchema, otpCode: z.string().length(6), isDefault: z.boolean().optional().default(true) })`.
    - Export `updatePayoutAccountSchema`: `z.object({ accountHolderName: z.string().trim().min(3).max(100).optional(), iban: saudiIbanSchema.optional(), otpCode: z.string().length(6), isDefault: z.boolean().optional() })`.
    - Export `payoutAccountResponseSchema`.
  - [x] 2.2 Create `packages/shared/src/types/payout.ts` (and export in `packages/shared/src/types/index.ts`):
    - Export TypeScript types: `CreatePayoutAccountInput`, `UpdatePayoutAccountInput`, `PayoutAccountResponse`.
  - [x] 2.3 Update `packages/shared/src/constants/auth.ts`:
    - Export error codes: `PAYOUT_INVALID_IBAN`, `PAYOUT_ACTIVE_DEAL_RESTRICTION`, `PAYOUT_ACCOUNT_NOT_FOUND`, `PAYOUT_ROLE_NOT_AUTHORIZED`, `PAYOUT_NAME_MISMATCH_WARNING`, `PAYOUT_ALREADY_EXISTS`.
  - [x] 2.4 Unit tests in `packages/shared/src/schemas/__tests__/payout.spec.ts` testing Mod-97 check, bank name resolution, formatters, and validation schemas.

- [x] Task 3: Backend AES-256 Crypto Service in `apps/api` (AC: 2)
  - [x] 3.1 Create `apps/api/src/common/crypto/crypto.service.ts`:
    - Inject `ConfigService`.
    - Implement `encrypt(text: string): string` using `crypto.createCipheriv('aes-256-gcm', key, iv)`:
      - Generates random 12-byte IV.
      - Returns `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedText}`.
    - Implement `decrypt(cipherString: string): string` using `crypto.createDecipheriv('aes-256-gcm', key, iv)`:
      - Validates format, extracts IV, authTag, and ciphertext.
      - Verifies authentication tag and decrypts to plaintext.
    - Key management: derives 32-byte key from `PAYOUT_ENCRYPTION_KEY` or `crypto.createHash('sha256').update(SESSION_SECRET).digest()`.
  - [x] 3.2 Create `apps/api/src/common/crypto/crypto.module.ts` and export `CryptoService`.
  - [x] 3.3 Unit tests in `apps/api/src/common/crypto/__tests__/crypto.service.spec.ts`.

- [x] Task 4: Backend Payout Service & Security Guardrails in `apps/api` (AC: 1, 2, 4, 5, 6, 7)
  - [x] 4.1 Create `apps/api/src/modules/users/payout.service.ts`:
    - Inject `PrismaService`, `ClockService`, `CryptoService`, and `OtpService`.
    - Method `getPayoutAccounts(userId: string, activeRole: UserRole)`:
      - Validates role is `MARKETER` or `OWNER`.
      - Finds seller profile for `(userId, activeRole)`.
      - Queries `PayoutAccount` records for profile.
      - Checks active deal bindings for each account.
      - Returns decrypted `ibanFormatted` and `ibanMasked`.
    - Method `requestPayoutOtp(userId: string)`:
      - Looks up user's verified `mobileNumber`.
      - Dispatches OTP via `otpService.generateAndSendOtp(user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE')`.
      - Returns `{ success: true, resendAvailableInSeconds: 60 }`.
    - Method `createPayoutAccount(userId: string, activeRole: UserRole, input: CreatePayoutAccountInput)`:
      - Validates role is `MARKETER` or `OWNER`.
      - Verifies OTP via `otpService.verifyOtp(user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE', input.otpCode)`.
      - Validates IBAN Mod-97 and extracts bank name.
      - Checks commercial name mismatch against `user.fullName` and `FalLicense.commercialName`.
      - Encrypts IBAN with AES-256-GCM.
      - Inserts `PayoutAccount`. If `isDefault` is true, unsets previous defaults and updates `UserProfile.payoutIban`.
      - Records immutable `AuditLog` (`action: 'PAYOUT_ACCOUNT_CREATED'`).
      - Returns created account summary and any warning flag.
    - Method `updatePayoutAccount(userId: string, activeRole: UserRole, accountId: string, input: UpdatePayoutAccountInput)`:
      - Verifies ownership and role.
      - Checks if account/profile has active non-terminal deals (`AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`). If yes, throws `PAYOUT_ACTIVE_DEAL_RESTRICTION`.
      - Verifies OTP.
      - Updates fields, encrypts new IBAN if changed, updates defaults.
      - Records immutable `AuditLog` (`action: 'PAYOUT_ACCOUNT_UPDATED'`).
      - Returns updated account summary.
    - Method `deletePayoutAccount(userId: string, activeRole: UserRole, accountId: string, otpCode: string)`:
      - Verifies ownership and role.
      - Checks active non-terminal deals; if found, throws `PAYOUT_ACTIVE_DEAL_RESTRICTION`.
      - Verifies OTP.
      - Deletes `PayoutAccount`.
      - Records immutable `AuditLog` (`action: 'PAYOUT_ACCOUNT_DELETED'`).
      - Returns success response.
    - Method `isAccountBoundToActiveDeal(profileId: string, ibanMasked?: string): Promise<boolean>`:
      - Queries `Deal` table for deals with `sellerProfileId === profileId` and `status IN [AWAITING_PAYMENT_PROOF, UNDER_ADMIN_AUDIT, PAYMENT_REJECTED]`.
  - [x] 4.2 Unit tests in `apps/api/src/modules/users/__tests__/payout.service.spec.ts`.

- [x] Task 5: Backend Payout Controller in `apps/api` (AC: 1, 4, 5, 7)
  - [x] 5.1 Create `apps/api/src/modules/users/payout.controller.ts`:
    - Decorate with `@ApiTags('Seller Payout Accounts')`, `@Controller('users/payout-accounts')`, `@UseGuards(SessionAuthGuard)`.
    - `GET /`: returns payout accounts for active profile.
    - `POST /request-otp`: requests step-up OTP.
    - `POST /`: creates payout account with OTP.
    - `PUT /:id`: updates payout account with OTP.
    - `DELETE /:id`: deletes payout account with OTP.
  - [x] 5.2 Update `apps/api/src/modules/users/users.module.ts`:
    - Import `CryptoModule`.
    - Register `PayoutService` and `PayoutController`.
    - Export `PayoutService`.
  - [x] 5.3 Unit tests in `apps/api/src/modules/users/__tests__/payout.controller.spec.ts`.

- [x] Task 6: Frontend Monospace IBAN Card & Clipboard Feedback in `apps/web` (AC: 3, 5)
  - [x] 6.1 Create `apps/web/src/components/payout/monospace-iban-card.tsx`:
    - Monospace font (`JetBrains Mono` / `font-mono`) grouped in 4-character blocks: `SA03 8000 0000 0000 0000 0000`.
    - Bank name badge with icon and default badge.
    - Account holder name display.
    - One-click copy button: copies raw unspaced string to clipboard (`navigator.clipboard.writeText`).
    - Tooltip / toast feedback confirming "تم نسخ رقم الآيبان بنجاح" for 2 seconds.
    - Reveal / hide toggle for unmasking IBAN.
    - Active deal lock badge when `isBoundToActiveDeal === true`.
    - Edit and Delete action triggers.
  - [x] 6.2 Component tests in `apps/web/src/components/payout/__tests__/monospace-iban-card.spec.tsx`.

- [x] Task 7: Frontend Payout Account Management Modal & Settings Page in `apps/web` (AC: 1, 3, 4, 6, 7)
  - [x] 7.1 Create `apps/web/src/components/payout/payout-account-modal.tsx`:
    - Form modal for adding or editing a payout account.
    - Inputs: Account Holder Name, Saudi IBAN.
    - Live client-side Mod-97 checksum validation and bank name detection.
    - Step-up OTP request button, countdown timer, and 6-digit OTP input.
    - Default account checkbox.
    - Error banners and validation error messages.
  - [x] 7.2 Create `apps/web/src/app/app/settings/payout/page.tsx`:
    - RTL layout wrapped in `WorkspaceShell`.
    - Header with El Masaif crest and regulatory compliance explanation ("وفقاً لمعايير الهيئة العامة للعقار والبنك المركزي السعودي (ساما)").
    - Non-seller prompt if accessed in Buyer role (button to switch to Owner or Marketer).
    - Grid of `MonospaceIbanCard` items.
    - Empty state when no payout accounts exist.
    - "إضافة حساب بنكي جديد" action button opening modal.
  - [x] 7.3 Update `apps/web/src/app/app/settings/profile/page.tsx`:
    - Add a card linking to `/app/settings/payout` ("حسابات التحويل البنكي (IBAN)").
  - [x] 7.4 Update `apps/web/src/components/layout/workspace-shell.tsx`:
    - Verify sidebar navigation routes to `/app/settings/payout` for Owner and Marketer workspaces.

- [x] Task 8: Verification, Test Suites & Quality Gates (AC: 8)
  - [x] 8.1 Execute all shared unit tests: `npm test -w packages/shared`.
  - [x] 8.2 Execute backend unit and integration tests: `npm test -w apps/api`.
  - [x] 8.3 Execute frontend unit and component tests: `npm test -w apps/web`.
  - [x] 8.4 Run lint checks: `npm run lint`.
  - [x] 8.5 Run workspace builds: `npm run build`.

## Dev Notes

### Architecture Compliance & Security Guardrails

- **ISO 7064 Mod-97 Checksum (FR-5, BR-05, AD-5):**
  - Saudi IBANs must start with `SA` and contain exactly 24 characters.
  - Client-side and server-side validation must use `validateSaudiIban` in `@elmasaif/shared`.
  - Invalid checksums return `PAYOUT_INVALID_IBAN`.
- **AES-256 Encryption at Rest (PRD Section 11, NFR2):**
  - Plaintext IBANs are high-risk financial data. Storing them in raw unencrypted text is strictly prohibited.
  - IBANs are encrypted using `aes-256-gcm` before persisting to `payout_accounts.iban_encrypted`.
  - The masked version `iban_masked` (`SA03 **** **** **** **** 1234`) is stored for fast display and logging.
- **Step-Up OTP Authentication (BR-05, R-01):**
  - Payout account creation and modification are prime attack targets (e.g. redirecting property sales proceeds).
  - Any creation, update, or deletion requires a valid 6-digit OTP sent to the user's verified phone number with purpose `PAYOUT_ACCOUNT_UPDATE`.
- **Active Non-Terminal Deal Restriction (BR-02, BR-05, AD-3):**
  - Property deals snapshot the seller's payout IBAN at deal creation/finalization (`UC-70B`).
  - If a seller has any deal in `AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, or `PAYMENT_REJECTED`, modifying or deleting the associated payout account is rejected with `PAYOUT_ACTIVE_DEAL_RESTRICTION`.
- **Commercial Name Mismatch Warning (FR-5, Assumption A-10):**
  - When `accountHolderName` does not match `user.fullName` or `FalLicense.commercialName`, a warning flag is stored and returned, but does not block registration.
- **Role Guard (UJ-2, UJ-3):**
  - Only `MARKETER` and `OWNER` profiles can manage payout accounts. Buyers receive `PAYOUT_ROLE_NOT_AUTHORIZED`.

### Files Being Modified / Created

| File | Status | Description / Changes |
|------|--------|-----------------------|
| `apps/api/prisma/schema.prisma` | UPDATE | Add `PayoutAccount` model, update `UserProfile` with `payoutAccounts` relation. |
| `packages/shared/src/schemas/payout.schema.ts` | NEW | Zod validation schemas for payout accounts, bank code mapping, formatting helpers. |
| `packages/shared/src/schemas/index.ts` | UPDATE | Re-export `payout.schema.ts`. |
| `packages/shared/src/types/payout.ts` | NEW | TypeScript types for payout accounts. |
| `packages/shared/src/types/index.ts` | UPDATE | Re-export `payout.ts`. |
| `packages/shared/src/constants/auth.ts` | UPDATE | Export payout error codes (`PAYOUT_INVALID_IBAN`, `PAYOUT_ACTIVE_DEAL_RESTRICTION`, etc.). |
| `packages/shared/src/schemas/__tests__/payout.spec.ts` | NEW | Unit tests for Mod-97 validation, bank resolution, schemas. |
| `apps/api/src/common/crypto/crypto.service.ts` | NEW | AES-256-GCM encryption and decryption service. |
| `apps/api/src/common/crypto/crypto.module.ts` | NEW | NestJS module exporting `CryptoService`. |
| `apps/api/src/common/crypto/__tests__/crypto.service.spec.ts` | NEW | Unit tests for AES-256-GCM encryption/decryption. |
| `apps/api/src/modules/users/payout.service.ts` | NEW | Service handling payout account CRUD, OTP verification, active deal checks, audit logging. |
| `apps/api/src/modules/users/payout.controller.ts` | NEW | REST endpoints for payout account operations under `users/payout-accounts`. |
| `apps/api/src/modules/users/users.module.ts` | UPDATE | Import `CryptoModule`, register `PayoutService` and `PayoutController`. |
| `apps/api/src/modules/users/__tests__/payout.service.spec.ts` | NEW | Unit tests for payout service logic and guards. |
| `apps/api/src/modules/users/__tests__/payout.controller.spec.ts` | NEW | Controller tests for payout endpoints. |
| `apps/web/src/components/payout/monospace-iban-card.tsx` | NEW | Monospace grouped IBAN card with copy button, toast, mask toggle. |
| `apps/web/src/components/payout/payout-account-modal.tsx` | NEW | Dialog modal for adding/editing payout account with live validation & OTP. |
| `apps/web/src/components/payout/__tests__/monospace-iban-card.spec.tsx` | NEW | Component tests for Monospace IBAN card. |
| `apps/web/src/app/app/settings/payout/page.tsx` | NEW | Dedicated RTL payout accounts management page. |
| `apps/web/src/app/app/settings/profile/page.tsx` | UPDATE | Add link card to payout settings. |

### Preserved Behaviors

- **Existing Auth & Session Guard:** The existing `SessionAuthGuard` must continue to guard all endpoints without disruption.
- **Identity Document Gate:** Story 1.4's `IdentityDocument` models and `verifyBuyerIdentityPrerequisite` remain active and unchanged.
- **Multi-Role Profile Switching:** Story 1.3's `switchRole` and `ActiveRoleGuard` remain active; active role determines seller profile.
- **OTP Verification Engine:** `OtpService` methods for rate limiting and lockouts remain central and reused.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5:-Seller-Payout-Account-Management-&-Monospace-IBAN-Card]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#FR-5:-Seller-Payout-Account-Management]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#BR-05]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#Assumption-A-10]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md#5.-Logical-Entity-Relationship-Summary]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-3]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md]
- [Source: _bmad-output/implementation-artifacts/1-4-identity-document-verification.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Task 1: Prisma schema update adding `PayoutAccount` model and `UserProfile.payoutAccounts` relation with `@map("payout_accounts")`. Successfully generated Prisma client with `npx prisma generate`.
- Task 2: Shared Zod validation schemas in `packages/shared/src/schemas/payout.schema.ts`, bank dictionary `SAUDI_BANK_NAMES` covering 14 Saudi banks, bank name resolution `getSaudiBankName`, 4-char grouped formatter `formatSaudiIban`, masking helper `maskSaudiIban`, and domain error codes. All 15 tests in `payout.spec.ts` passing.
- Task 3: Backend AES-256-GCM `CryptoService` in `apps/api/src/common/crypto/crypto.service.ts` with roundtrip integrity tests, random IV uniqueness, and authentication tag tampering prevention.
- Task 4: Backend `PayoutService` enforcing ISO 7064 Mod-97 checksum, step-up OTP with `OtpService`, commercial name mismatch warnings against registered names and Fal commercial names, active non-terminal deal restriction (`PAYOUT_ACTIVE_DEAL_RESTRICTION`), and immutable `AuditLog` generation. All 11 tests passing in `payout.service.spec.ts`.
- Task 5: Backend `PayoutController` under `/api/v1/users/payout-accounts` guarded by `SessionAuthGuard` with role enforcement (Marketer & Owner permitted, Buyer forbidden). All 6 controller tests passing in `payout.controller.spec.ts`.
- Task 6: Frontend `MonospaceIbanCard` with grouped 4-char typography, one-click copy with clipboard feedback toast, mask/unmask toggle, bank badge, and institutional active deal lock badge. All 4 component tests passing in `monospace-iban-card.spec.tsx`.
- Task 7: Frontend `PayoutAccountModal`, `DeletePayoutModal`, and dedicated RTL Arabic page at `/app/settings/payout` integrated into `WorkspaceShell` navigation and `ProfileSettingsPage`.
- Task 8: Verification gates satisfied across workspaces:
  - `packages/shared`: 10 passed test suites (107 tests)
  - `apps/api`: crypto, payout service, and controller tests passing (24 tests)
  - `apps/web`: 14 passed test suites (63 tests)
  - `npm run lint`: 0 errors, 0 warnings
  - `npm run build`: clean builds across `packages/shared`, `apps/api`, `apps/web`, and `apps/worker`

### Completion Notes List

- ✅ Implemented ISO 7064 Mod-97 validation and Saudi bank mapping across shared schemas and backend service (AC: 1).
- ✅ Implemented AES-256-GCM encryption at rest with random IVs and GCM authentication tag verification for all stored IBANs (AC: 2).
- ✅ Created institutional `MonospaceIbanCard` with 4-character grouping (`SA03 8000 0000 0000 0000 0000`), copy-to-clipboard button with toast feedback, and unmasking toggle (AC: 3).
- ✅ Enforced step-up OTP verification on creation, modification, and deletion of payout accounts with immutable audit log generation (AC: 4).
- ✅ Added active non-terminal deal restriction blocking payout account modification/deletion when deals are in progress (`AWAITING_PAYMENT_PROOF`, `UNDER_ADMIN_AUDIT`, `PAYMENT_REJECTED`) with HTTP 409 Conflict `PAYOUT_ACTIVE_DEAL_RESTRICTION` (AC: 5).
- ✅ Added commercial name mismatch detection comparing account holder names against user full names and Fal commercial licenses, surfacing warnings without blocking registration (AC: 6).
- ✅ Integrated payout management with role authorization (`MARKETER` and `OWNER` permitted, `BUYER` forbidden with `PAYOUT_ROLE_NOT_AUTHORIZED`), dedicated settings page at `/app/settings/payout`, and workspace shell navigation (AC: 7).
- ✅ Full verification suite passed with zero lint warnings and successful builds (AC: 8).

### File List

- `apps/api/prisma/schema.prisma` (Modified)
- `apps/api/src/common/crypto/crypto.service.ts` (New)
- `apps/api/src/common/crypto/crypto.module.ts` (New)
- `apps/api/src/common/crypto/__tests__/crypto.service.spec.ts` (New)
- `apps/api/src/modules/users/payout.service.ts` (New)
- `apps/api/src/modules/users/payout.controller.ts` (New)
- `apps/api/src/modules/users/__tests__/payout.service.spec.ts` (New)
- `apps/api/src/modules/users/__tests__/payout.controller.spec.ts` (New)
- `apps/api/src/modules/users/users.module.ts` (Modified)
- `packages/shared/src/constants/auth.ts` (Modified)
- `packages/shared/src/schemas/payout.schema.ts` (New)
- `packages/shared/src/schemas/index.ts` (Modified)
- `packages/shared/src/types/payout.ts` (New)
- `packages/shared/src/types/index.ts` (Modified)
- `packages/shared/src/schemas/__tests__/payout.spec.ts` (New)
- `apps/web/src/components/payout/monospace-iban-card.tsx` (New)
- `apps/web/src/components/payout/payout-account-modal.tsx` (New)
- `apps/web/src/components/payout/delete-payout-modal.tsx` (New)
- `apps/web/src/components/payout/__tests__/monospace-iban-card.spec.tsx` (New)
- `apps/web/src/app/app/settings/payout/page.tsx` (New)
- `apps/web/src/app/app/settings/profile/page.tsx` (Modified)
- `apps/web/src/components/layout/workspace-shell.tsx` (Modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Modified)
- `_bmad-output/implementation-artifacts/1-5-seller-payout-account-management-monospace-iban-card.md` (Modified)

### Change Log

- 2026-10-31: Implemented Story 1.5 - Seller Payout Account Management & Monospace IBAN Card. Added Prisma schema `PayoutAccount`, shared Zod contracts and bank code mappings, backend AES-256-GCM crypto service, payout service with step-up OTP and active deal guardrails, payout controller, frontend monospace IBAN card with clipboard feedback, and settings management page. All tests, linting, and production builds verified.

