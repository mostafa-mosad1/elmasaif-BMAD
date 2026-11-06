---
baseline_commit: 74a003c9860aea94c81a95040f33f3da92ee1163
---

# Story 4.4: Mediated Listing Inquiries & Automated Sensitive Contact Masking

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a buyer inquiring about a property,
I want to send questions to the seller through a mediated inquiry thread with automatic contact redaction,
so that my inquiries are answered while off-platform deal circumvention and personal contact leakage are prevented.

## Acceptance Criteria

**AC-1 — Buyer submits an inquiry; contact details are masked on client *and* server.**
Given an authenticated buyer with an `ACTIVE` BUYER profile viewing an `ACTIVE` or `RESERVED` listing
When the buyer submits an inquiry message (1–2000 chars) with up to 5 attachments
Then the message text is passed through the single shared masking engine `maskContactDetails()` inside the web form before submission (live preview + warning banner) **and** re-processed by the API service before persistence (never trust the client, NFR1)
And Saudi mobile numbers are detected in every common form — `05XXXXXXXX`, `+9665XXXXXXXX`, `009665XXXXXXXX`, `9665XXXXXXXX`, with optional spaces/dashes as separators, and with Arabic-Indic (`٥٠٥…)` / extended Arabic-Indic (`۵۰۵…`) digits
And email addresses and external usernames (`@handle`, `wa.me/…`, `t.me/…`, `instagram.com/…`, `snapchat.com/add/…`, `x.com|twitter.com/…`, `tiktok.com/@…`) are detected
And every matched span is replaced with asterisks (`***`) of the same length, the original characters are never returned to any client, and the masking operation is idempotent (masking an already-masked string is a no-op)
And each masked message persists `maskingApplied` + `maskedTypes` and writes one `AuditLog` row (`INQUIRY_CONTACT_MASKED`) whose payload contains detection **types and counts only** — never the detected values
And the thread is created with status `PENDING_ADMIN_REVIEW`.

**AC-2 — Attachments: max 5, PDF/image, 10 MB, quarantined + scanned.**
Given a buyer attaching files to an inquiry message
When more than 5 attachments are supplied, or a file exceeds 10 MB, or its MIME type is not one of `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
Then the request is rejected (`INQUIRY_ATTACHMENT_LIMIT_EXCEEDED`, or the existing quarantine `BadRequestException` messages)
And every accepted file is staged in the `quarantine/` partition and synchronously malware-scanned through `QuarantineService`; only `CLEAN` files are attached and downloadable, `INFECTED`/`SCAN_FAILED`/`PENDING` files are never served (fail-closed, NFR13)
And an attachment may only be linked by the buyer profile that uploaded it (`INQUIRY_ATTACHMENT_NOT_OWNED`).

**AC-3 — Inquiry routes to the Admin Conversation Queue under a 15-minute claim lock.**
Given a newly submitted inquiry or a seller reply awaiting relay
When the item enters the admin conversation queue at `/admin/conversations`
Then it is listed oldest-first with pagination (`DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`) and the active lock projection
And claiming is an explicit `POST /api/v1/admin/inquiries/:id/claim` that performs an atomic conditional `updateMany` setting `lockedByAdminId`, `lockedAt`, `lockExpiresAt = ClockService.now() + 15 min` (reading the queue never claims — AD-10)
And an active lease is renewed by `POST /:id/heartbeat` (5-minute client cadence), released by `POST /:id/release` or on decision commit, and forcibly broken only via `POST /:id/force-unlock` guarded by `Tasks.ForceUnlock` with a mandatory documented reason (≥ 5 chars) written to `AuditLog`
And a second administrator sees the record read-only with a banner naming the lock holder (`INQUIRY_LOCK_CONFLICT` carries `lockInfo.lockedByAdminName`).

**AC-4 — Direct unmediated buyer↔seller chat is strictly blocked.**
Given any authenticated buyer or seller
When they attempt to communicate
Then there is **no** endpoint that delivers a buyer message to the seller (or a seller message to the buyer) without an administrator relay in between
And a seller may only append a reply while the thread is `RELAYED_TO_SELLER`; that reply is stamped `relayedAt = null` and is filtered out of the buyer's projection until an administrator relays it
And a buyer's follow-up is likewise invisible to the seller until relayed
And every read is party-scoped (`INQUIRY_NOT_PARTY`), and no inquiry payload ever contains either party's `mobileNumber`, `email`, or IBAN — display names only.

**AC-5 — The relay loop completes end-to-end.**
Given a claimed inquiry
When the administrator relays the buyer's message to the seller (`PENDING_ADMIN_REVIEW → RELAYED_TO_SELLER`)
Then the seller sees the masked message and its attachments on `/app/{marketer|owner}/inquiries/:id`
And the seller replies, moving the thread to `SELLER_RESPONDED`
And the administrator relays the seller's reply to the buyer (`SELLER_RESPONDED → RELAYED_TO_BUYER`), after which the buyer sees the answer
And the buyer may then send a follow-up (allowed from `PENDING_ADMIN_REVIEW` or `RELAYED_TO_BUYER`, moving back to `PENDING_ADMIN_REVIEW`)
And the administrator may close the thread from any non-terminal status with a documented reason (`INQUIRY_CLOSE_REASON_REQUIRED`), which is terminal.

**AC-6 — Clock, audit and continuity invariants.**
Given any inquiry mutation
When it executes
Then all timestamps come from `ClockService.now()` (never `Date.now()` / argless `new Date()`), the whole transition runs inside one `prisma.$transaction` behind a `::text` `FOR UPDATE` row lock, `version` is incremented, and an `AuditLog` row is written in that same transaction
And the existing `apps/api`, `apps/web`, `apps/worker` and `packages/shared` suites stay green.

## Tasks / Subtasks

- [x] **Task 1 — Shared contracts: masking engine (AC: 1)**
  - [x] Create `packages/shared/src/masking/contact-mask.ts` exporting `maskContactDetails(input: string): ContactMaskResult`, `ContactMaskType`, `ContactMaskDetection`, `ContactMaskResult` (no originals in the result)
  - [x] Create `packages/shared/src/constants/masking.ts` with `MASKED_CONTACT_TYPES` + `MASKED_CONTACT_TYPE_LABELS_AR`
  - [x] Add `export * from './masking';` to `packages/shared/src/index.ts`; export the new constants from `packages/shared/src/constants/index.ts`
  - [x] Create `packages/shared/src/masking/__tests__/contact-mask.spec.ts` (phone variants, Arabic-Indic digits, emails, handles/links, multiple matches, overlap merge, idempotency, no originals leaked, Arabic text preserved)

- [x] **Task 2 — Shared contracts: enums, constants, schemas, types (AC: 1,2,3,5)**
  - [x] Mirror new Prisma enums in `packages/shared/src/enums/index.ts` (`InquiryStatus`, `InquiryAuthorRole`)
  - [x] Create `packages/shared/src/constants/inquiry.ts`: error codes, `MAX_INQUIRY_ATTACHMENTS`, `INQUIRY_MESSAGE_MAX_LENGTH`, `INQUIRY_SUBJECT_MAX_LENGTH`, `INQUIRY_LOCK_DURATION_MS`, `INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS`, `INQUIRY_QUEUE_STATUSES`, `CLAIMABLE_INQUIRY_STATUSES`, `INQUIRY_STATUS_LABELS_AR`, `INQUIRY_STATUS_BADGE_VARIANTS`, `INQUIRY_AUTHOR_LABELS_AR`
  - [x] Create `packages/shared/src/schemas/inquiry.schema.ts`: `createInquirySchema`, `appendInquiryMessageSchema`, `relayInquirySchema`, `closeInquirySchema`, `inquiryQueueQuerySchema`
  - [x] Create `packages/shared/src/types/inquiry.ts`: `InquiryMessageItem`, `InquiryThreadSummary`, `InquiryThreadItem`, `InquiryAttachmentItem`, `InquiryLockInfo` (alias of `ClaimLockInfo`)
  - [x] Add `ClaimLockInfo` in `packages/shared/src/types/locks.ts`; make `OfferLockInfo` an alias of it (structural no-op)
  - [x] Wire `schemas/index.ts`, `types/index.ts`, `constants/index.ts` exports
  - [x] Tests: `constants/__tests__/inquiry.spec.ts` (invariant: `INQUIRY_QUEUE_STATUSES ⊂ CLAIMABLE_INQUIRY_STATUSES`, queue set excludes `CLOSED`, label map covers every enum member), `schemas/__tests__/inquiry.spec.ts`

- [x] **Task 3 — Prisma schema (AC: 1,2,3,5)**
  - [x] Add `InquiryStatus` + `InquiryAuthorRole` enums, `ListingInquiry`, `InquiryMessage`, `InquiryAttachment` models (exact definitions in Dev Notes)
  - [x] Add back-relations only (no columns) on `Listing` and `UserProfile`
  - [x] `npx prisma validate`; inspect `prisma db push` diff and confirm it is **purely additive** (create tables + create enums only) before applying; then generate the client
  - [x] Verify generated client really contains the new models/enums (`grep -c` in the hoisted client `index.d.ts`) — do not assume

- [x] **Task 4 — One claim-lease implementation (AC: 3)**
  - [x] Extract `apps/api/src/common/locks/claim-lock.ts`: `ClaimLockInfo`-typed `buildClaimLockInfo`, `assertClaimLockHeld(record, adminId, now, codes)`, `resolveClaimLockHolderNames(client, records, now)`
  - [x] Rewrite `apps/api/src/modules/offers/offer-lock.ts` as a thin delegation with **unchanged exported names and signatures** (keys `buildLockInfo`, `assertLockHeld`, `resolveLockHolderNames`, `offerNotFound`) bound to the `OFFER_LOCK_*` codes — `AdminOffersService`, `BackupOffersService` and their specs must not need edits
  - [x] Create `apps/api/src/modules/inquiries/inquiry-lock.ts` binding the same functions to `INQUIRY_LOCK_*` codes + `inquiryNotFound()`

- [x] **Task 5 — API: inquiry module, buyer/seller surfaces (AC: 1,2,4,5,6)**
  - [x] Create `apps/api/src/modules/inquiries/inquiries.module.ts` (`imports: [PrismaModule, ClockModule, AuthModule, StorageModule]`, same guard providers as `OffersModule`)
  - [x] Create `inquiries.controller.ts` (`@Controller('inquiries')`) with literal routes before `:id` routes
  - [x] Create `inquiries.service.ts`: `createInquiry`, `listMyInquiries`, `listReceivedInquiries`, `getThread`, `appendMessage`, `uploadAttachment`, `getAttachmentDownloadUrl`, plus private `resolveBuyerProfile` / `resolveSellerProfile` mirroring `OffersService`
  - [x] Create `inquiry-thread.mapper.ts` (single projection, viewer-aware visibility filter)
  - [x] Create `dto/*.dto.ts` for Swagger `@ApiBody` documentation only (runtime validation is Zod, per house style)
  - [x] Register `InquiriesModule` in `apps/api/src/app.module.ts`
  - [x] Tests: `apps/api/src/modules/inquiries/__tests__/inquiries.spec.ts`

- [x] **Task 6 — API: admin conversation queue (AC: 3,5)**
  - [x] Create `admin-inquiries.controller.ts` (`@Controller('admin/inquiries')`, `AdminSessionAuthGuard` + `AdminPermissionGuard`)
  - [x] Create `admin-inquiries.service.ts`: `getQueue`, `getInquiry`, `claimInquiry`, `heartbeatInquiry`, `releaseInquiry`, `forceUnlockInquiry`, `relayToSeller`, `relayToBuyer`, `closeInquiry`
  - [x] Tests: `apps/api/src/modules/inquiries/__tests__/admin-inquiries.spec.ts`

- [x] **Task 7 — Storage partition for inquiry attachments (AC: 2)**
  - [x] Add `'inquiries'` to `StoragePartition` in `apps/api/src/modules/storage/storage.service.ts` and a `case 'inquiries'` in `createObjectKey` returning `inquiries/${context.userId}/${leafFilename}` (require `context.userId`, same guard style as `identity`)

- [x] **Task 8 — Web: buyer submit + buyer/seller surfaces (AC: 1,4,5)**
  - [x] `apps/web/src/components/inquiries/inquiry-submit-form.tsx`: live `maskContactDetails` preview + "تم حجب بيانات التواصل تلقائياً" notice, ≤5 attachment picker against `POST /inquiries/attachments`, RTL, inline errors
  - [x] `apps/web/src/components/inquiries/inquiry-thread-view.tsx`, `inquiry-status-badge.tsx`, `buyer-inquiries-list.tsx`, `seller-inquiries-list.tsx`, `inquiries-view.tsx`, `index.ts`
  - [x] Mount the inquiry form block on `apps/web/src/app/properties/[id]/page.tsx` (separate toggle below the offer block — do not modify `ListingDetailView`)
  - [x] Thin route pages: `/app/buyer/inquiries`, `/app/buyer/inquiries/[id]`, `/app/marketer/inquiries`, `/app/marketer/inquiries/[id]`, `/app/owner/inquiries`, `/app/owner/inquiries/[id]`
  - [x] `apps/web/src/components/inquiries/__tests__/inquiries.spec.tsx` (SSR `renderToString`, no jsdom interaction tests)

- [x] **Task 9 — Web: admin conversation queue + workspace (AC: 3,5)**
  - [x] `apps/web/src/components/admin/inquiry-queue.tsx` (claim → push to workspace, holder-name conflict banner via `readLockHolderName`)
  - [x] `apps/web/src/components/admin/inquiry-workspace.tsx` (task-lock banner + countdown, relay/close actions, read-only mode for inspecting admins)
  - [x] Thin route pages `/admin/conversations` and `/admin/conversations/[id]`
  - [x] `apps/web/src/components/admin/__tests__/inquiry-queue.spec.tsx`

- [x] **Task 10 — Navigation + verification (AC: 3,5,6)**
  - [x] Add sidebar entries in `apps/web/src/components/layout/workspace-shell.tsx`: buyer «استفساراتي», owner/marketer «استفسارات العقارات», admin «طابور المحادثات» gated on `admin.permissions?.includes('Conversations.Handle')`
  - [x] `npm run build:shared`, then run `packages/shared`, `apps/api`, `apps/web` (and `apps/worker`) suites; `tsc --noEmit` for `apps/api`; `npm run lint`
  - [x] Manual smoke of the full relay loop against the dev API (see Dev Notes → Manual Verification)
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to `review` when implementation is complete

## Dev Notes

### D1 — New entities, not the `Conversation` skeleton

`Conversation` (`apps/api/prisma/schema.prisma#L669-L683`) is a pre-existing placeholder with `dealId String?`, two profile ids and a `String status`. It is **not** extended here, deliberately:

- it has no `listingId`, and a pre-deal inquiry is listing-scoped;
- its `status` is a free `String`; retyping it to a new enum is **not** an additive `db push` change and violates the project's db-push-only rule;
- it belongs to the post-deal chat path that Epic 5 will own once FR-32 releases contact details.

Story 4.4 therefore introduces `ListingInquiry` / `InquiryMessage` / `InquiryAttachment`. Leave `Conversation` byte-identical.

### D2 — Exact Prisma additions (append-only)

```prisma
enum InquiryStatus {
  PENDING_ADMIN_REVIEW
  RELAYED_TO_SELLER
  SELLER_RESPONDED
  RELAYED_TO_BUYER
  CLOSED
}

enum InquiryAuthorRole {
  BUYER
  SELLER
  ADMIN
}

model ListingInquiry {
  id               String        @id @default(uuid())
  listingId        String        @map("listing_id")
  buyerProfileId   String        @map("buyer_profile_id")
  sellerProfileId  String        @map("seller_profile_id")
  status           InquiryStatus @default(PENDING_ADMIN_REVIEW)
  subject          String?
  version          Int           @default(1)
  lockedByAdminId  String?       @map("locked_by_admin_id")
  lockedAt         DateTime?     @map("locked_at")
  lockExpiresAt    DateTime?     @map("lock_expires_at")
  lastMessageAt    DateTime      @map("last_message_at")
  closedAt         DateTime?     @map("closed_at")
  closedByAdminId  String?       @map("closed_by_admin_id")
  closeReason      String?       @map("close_reason")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  listing       Listing          @relation("InquiryListing", fields: [listingId], references: [id], onDelete: Cascade)
  buyerProfile  UserProfile      @relation("BuyerInquiries", fields: [buyerProfileId], references: [id])
  sellerProfile UserProfile      @relation("SellerInquiries", fields: [sellerProfileId], references: [id])
  messages      InquiryMessage[]

  @@index([status, createdAt])
  @@index([listingId, buyerProfileId, status])
  @@index([lockExpiresAt])
  @@map("listing_inquiries")
}

model InquiryMessage {
  id               String             @id @default(uuid())
  inquiryId        String             @map("inquiry_id")
  authorRole       InquiryAuthorRole  @map("author_role")
  authorProfileId  String?            @map("author_profile_id")
  authorAdminId    String?            @map("author_admin_id")
  body             String
  maskingApplied   Boolean            @default(false) @map("masking_applied")
  maskedTypes      String?            @map("masked_types")
  relayedAt        DateTime?          @map("relayed_at")
  relayedByAdminId String?            @map("relayed_by_admin_id")
  createdAt        DateTime           @default(now()) @map("created_at")

  inquiry     ListingInquiry      @relation(fields: [inquiryId], references: [id], onDelete: Cascade)
  attachments InquiryAttachment[]

  @@index([inquiryId, createdAt])
  @@map("inquiry_messages")
}

model InquiryAttachment {
  id                  String   @id @default(uuid())
  fileObjectId        String   @unique @map("file_object_id")
  uploadedByProfileId String   @map("uploaded_by_profile_id")
  messageId           String?  @map("message_id")
  fileName            String   @map("file_name")
  mimeType            String   @map("mime_type")
  fileSize            Int      @map("file_size")
  createdAt           DateTime @default(now()) @map("created_at")

  message InquiryMessage? @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("inquiry_attachments")
}
```

Back-relations (no DB columns): `Listing` → `inquiries ListingInquiry[] @relation("InquiryListing")`; `UserProfile` → `buyerInquiries ListingInquiry[] @relation("BuyerInquiries")` and `sellerInquiries ListingInquiry[] @relation("SellerInquiries")`.

Notes: all ids stay `String @id @default(uuid())` → **`text`** columns in Postgres (see D8). `maskedTypes` is a comma-joined code list in one nullable `String` — no Postgres array, no JSON, so `db push` stays trivially additive. `lastMessageAt` is required so the queue can sort by activity without a join.

### D3 — Masking engine contract (`packages/shared/src/masking/contact-mask.ts`)

```ts
export type ContactMaskType = 'PHONE' | 'EMAIL' | 'HANDLE';
export interface ContactMaskDetection { type: ContactMaskType; start: number; length: number }
export interface ContactMaskResult { maskedText: string; detections: ContactMaskDetection[]; wasMasked: boolean }
export function maskContactDetails(input: string): ContactMaskResult;
```

Rules the implementation and its tests must satisfy:

1. **Digit normalization for detection only.** Build a normalized copy where `٠-٩` (U+0660–U+0669) and `۰-۹` (U+06F0–U+06F9) map 1:1 to `0-9`. The mapping is length-preserving, so offsets found in the normalized string are valid in the original.
2. **Phone** — exactly two alternatives, applied to the normalized text:
   - `05` followed by 8 digits, allowing a single optional space/dash between digit groups: `/\b05\d(?:[\s-]?\d){7}\b/g`
   - international: `/(?:\+|00)?966[\s-]?5\d(?:[\s-]?\d){7}/g` (covers `+9665…`, `009665…`, `966 5…`)
   - Do **not** add a bare `5XXXXXXXX` alternative: it would mask legitimate prices, areas and reference numbers.
3. **Email** — `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g`.
4. **Handles / links** — `/@[A-Za-z0-9_.\u0600-\u06FF]{2,}/g` **and** the URL form `/(?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|telegram\.me|snapchat\.com\/add|instagram\.com|twitter\.com|x\.com|tiktok\.com\/@)[^\s]*/gi`.
5. Collect every span from every pattern, **sort by `start` then merge overlaps** before rebuilding the string — otherwise nested matches corrupt offsets.
6. Replace each merged span with `'*'.repeat(length)` in the **original** string. Preserve all other characters exactly (Arabic text and RTL punctuation untouched).
7. **Never** return the matched substrings. The audit row records `{ types: string[], count: number }` only.
8. **Idempotency is a hard requirement**: `maskContactDetails(maskContactDetails(x).maskedText).wasMasked === false`.

Single source of truth: the web form (preview + submit) and the API service both import this one function. Do not re-implement any pattern in `apps/web` or `apps/api`.

### D4 — Where masking is enforced

- **Client gate (AC-1):** `inquiry-submit-form.tsx` runs `maskContactDetails` on every keystroke for the preview and submits the masked text; the notice «تم حجب بيانات التواصل تلقائياً لحماية الطرفين» is shown when `wasMasked`.
- **Server gate (authoritative):** `InquiriesService` / `AdminInquiriesService` run `maskContactDetails` on **every** inbound body it persists (buyer message, seller reply, admin relay note) and store `maskedText` with `maskingApplied` / `maskedTypes`.
- The Zod schemas validate structure only (length, uuid, array bounds). Masking is **not** a `.transform()` in the schema, because the service must still see the raw input in order to record detection counts.
- Admin-authored notes are masked too — an admin relaying a seller's text is the last line of defence, not an exemption.

### D5 — The state machine and the anti-circumvention matrix

`InquiryStatus`: `PENDING_ADMIN_REVIEW` → `RELAYED_TO_SELLER` → `SELLER_RESPONDED` → `RELAYED_TO_BUYER` → (buyer follow-up) `PENDING_ADMIN_REVIEW`; `CLOSED` is terminal from any non-terminal status.

| Actor | Endpoint | Allowed from | Result |
|---|---|---|---|
| BUYER | `POST /inquiries` | listing `ACTIVE`/`RESERVED`, not own listing | `PENDING_ADMIN_REVIEW` |
| BUYER | `POST /inquiries/:id/messages` | `PENDING_ADMIN_REVIEW`, `RELAYED_TO_BUYER` | `PENDING_ADMIN_REVIEW` |
| SELLER | `POST /inquiries/:id/messages` | `RELAYED_TO_SELLER` | `SELLER_RESPONDED` |
| ADMIN | `POST /admin/inquiries/:id/relay-to-seller` | `PENDING_ADMIN_REVIEW` | `RELAYED_TO_SELLER` |
| ADMIN | `POST /admin/inquiries/:id/relay-to-buyer` | `SELLER_RESPONDED` | `RELAYED_TO_BUYER` |
| ADMIN | `POST /admin/inquiries/:id/close` | any non-terminal | `CLOSED` |

Any other (actor, status) pair throws `409 INQUIRY_INVALID_STATE_TRANSITION`. `CLOSED` rejects every mutation with `INQUIRY_CLOSED`.

**Visibility (AC-4), computed in one place — `toInquiryMessageItem(message, viewer)`:**

| Viewer | Sees messages where |
|---|---|
| BUYER | `authorRole = 'BUYER'` **or** `authorRole = 'ADMIN'` **or** (`authorRole = 'SELLER'` **and** `relayedAt != null`) |
| SELLER | `authorRole = 'SELLER'` **or** `authorRole = 'ADMIN'` **or** (`authorRole = 'BUYER'` **and** `relayedAt != null`) |
| ADMIN | everything |

Relay stamps `relayedAt` + `relayedByAdminId` on every message of the counterparty role that still has `relayedAt = null`, **inside the same transaction** as the status change. This is what makes "strictly blocked" testable rather than aspirational.

### D6 — API surface

Buyer/seller — `apps/api/src/modules/inquiries/inquiries.controller.ts`, `@Controller('inquiries')`, `SessionAuthGuard` + `ActiveRoleGuard` + `@RequireRole`:

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/inquiries` | BUYER | 201; body `createInquirySchema` |
| GET | `/inquiries/my` | BUYER | **declare before `:id`** |
| GET | `/inquiries/received` | MARKETER, OWNER | **declare before `:id`** |
| GET | `/inquiries/:id` | BUYER, MARKETER, OWNER | party-scoped, viewer-aware messages |
| POST | `/inquiries/:id/messages` | BUYER, MARKETER, OWNER | `appendInquiryMessageSchema` |
| POST | `/inquiries/attachments` | BUYER | multipart `FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } })` |
| GET | `/inquiries/attachments/:id/download` | parties | 5-minute presigned URL via `StorageService.getVerifiedDownloadUrl` |

Admin — `admin-inquiries.controller.ts`, `@Controller('admin/inquiries')`, `AdminSessionAuthGuard` + `AdminPermissionGuard`, all `@RequireAdminPermission('Conversations.Handle')` except force-unlock (`Tasks.ForceUnlock`), same shape as `admin-offers.controller.ts`:

`GET /` (queue) · `GET /:id` · `POST /:id/claim` · `POST /:id/heartbeat` · `POST /:id/release` · `POST /:id/force-unlock` · `POST /:id/relay-to-seller` · `POST /:id/relay-to-buyer` · `POST /:id/close`

Response envelope: `{ statusCode, message?, data }` for mutations, `{ items, meta: { total, page, limit, totalPages } }` for the queue. Every mutation returns the fresh thread with `lockInfo`.

**Claim legality vs queue membership (the Story 4.3 split, reused):** `INQUIRY_QUEUE_STATUSES = [PENDING_ADMIN_REVIEW, SELLER_RESPONDED]` drives `GET /admin/inquiries`; `CLAIMABLE_INQUIRY_STATUSES = [PENDING_ADMIN_REVIEW, RELAYED_TO_SELLER, SELLER_RESPONDED, RELAYED_TO_BUYER]` drives claim legality, because closing or relaying a thread that is mid-relay still requires holding the lease.

### D7 — Attachment pipeline (reuse, do not rebuild)

`UploadAttachment` flow, per file:

1. `QuarantineService.stageFileForQuarantine({ filename, mimeType, fileSize, buffer, userId })` — already enforces 10 MB + `ALLOWED_UPLOAD_MIME_TYPES` and creates the `FileObject`.
2. `QuarantineService.scanAndProcess(fileObjectId, 'inquiries', { userId }, profile.userId)` — promotes `CLEAN` files to the new `inquiries/` partition; returns `isClean`. Reject with the existing fail-closed semantics.
3. Persist `InquiryAttachment { fileObjectId, uploadedByProfileId, messageId: null, fileName, mimeType, fileSize }` — a **draft** attachment.
4. On message creation, link `attachmentIds` (≤ 5) whose rows have `messageId = null` and `uploadedByProfileId = caller`. Anything else → `INQUIRY_ATTACHMENT_NOT_OWNED` / `INQUIRY_ATTACHMENT_NOT_FOUND`; more than 5 → `INQUIRY_ATTACHMENT_LIMIT_EXCEEDED`.
5. Downloads always go through `StorageService.getVerifiedDownloadUrl(fileObjectId)` — it already refuses non-`CLEAN` and `quarantine/` keys and caps the URL at 5 minutes (NFR2). Never hand out a raw S3 key.

Draft attachments are invisible everywhere (`messageId = null`) and are simply never linked if the user abandons the form — no cleanup job in this story.

### D8 — Locks, transactions, timestamps (hard rules)

- Row locks are raw SQL with `::text`, never `::uuid`: `SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE` and `SELECT "id" FROM "listing_inquiries" WHERE "id" = ${inquiryId}::text FOR UPDATE`. Without the cast Postgres raises 42883 (`operator does not exist: text = uuid`).
- Claim is a conditional `updateMany` with `OR: [{ lockedByAdminId: null }, { lockExpiresAt: { lt: now } }, { lockedByAdminId: admin.id }]`; `count === 0` ⇒ `409 INQUIRY_LOCK_CONFLICT` with `details.lockInfo` so the UI can name the holder.
- Every mutation: `ClockService.now()` → `$transaction` → row lock → party check → state check → `update` + `version: { increment: 1 }` → `AuditLog` in the same transaction.
- Annotate `$transaction` callbacks with an explicit return type when they return literals (Story 4.3 hit `TS2322` from widened literal inference).

### D9 — Audit actions to emit

`INQUIRY_SUBMITTED`, `INQUIRY_MESSAGE_ADDED`, `INQUIRY_CONTACT_MASKED` (payload: `{ messageId, types, count }` only), `INQUIRY_RELAYED_TO_SELLER`, `INQUIRY_RELAYED_TO_BUYER`, `INQUIRY_CLOSED`, `INQUIRY_MODERATION_CLAIMED`, `INQUIRY_MODERATION_RELEASED`, `INQUIRY_MODERATION_FORCE_UNLOCKED`. `entityType` is `ListingInquiry` (or `InquiryMessage` for masking), `actorType` ∈ `USER | ADMIN | SYSTEM`.

### D10 — Frontend conventions (non-negotiable)

- Hard-coded Arabic strings, `dir="rtl"`, no i18n library, no form library, no toast library — inline state and inline errors, exactly like `components/offers/*`.
- Every `catch` uses `describeApiError` / `readLockHolderName` from `lib/api-client.ts`; `catch (err: any)` fails ESLint (`no-explicit-any`).
- Fetch through `apiClient`; tolerate both bare and enveloped payloads (unwrap defensively, as `unwrapOffersPayload` does).
- Components are SSR-tested with `renderToString`; **no** jsdom/RTL interaction tests (established suite constraint). Specs live in `components/<area>/__tests__/`, never inside route directories. Route `page.tsx` files export only the default component.
- Reuse `formatSar`, `formatOfferExpiry`, `formatLockCountdown` where applicable rather than re-writing formatters.
- Timeline reads like `OfferNegotiationTimeline`; the masking notice and the mediation banner use the `status-pending` tokens (`D97706` / `FFFBEB` / `FDE68A`).

### D11 — What already exists (do not recreate it)

- `Conversations.Handle` is **already** granted to `SUPER_ADMIN` and `MODERATOR` in `packages/shared/src/constants/auth.ts#L161,L192`. Do not add or rename permissions; a missing role grant is Story 8.2's job.
- `ALLOWED_UPLOAD_MIME_TYPES`, `MAX_FILE_SIZE_BYTES` (10 MB), `ScanStatus`, `QuarantineService`, `StorageService.getVerifiedDownloadUrl`, `ZodValidationPipe`, `ClockService`, `AuditLog`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `StatusBadgeVariant`, `Badge`, `describeApiError`, `readLockHolderName`, `formatSar`, `formatOfferExpiry`, `formatLockCountdown` all exist — import them.
- The Docker/MinIO bucket, `.env` keys and `docker-compose.yml` need **no** changes; the `inquiries/` prefix lives inside the existing private bucket.
- No seed changes are required. Create inquiries through the API during verification, never in `seed.ts`.

### D12 — Explicit non-goals (do not creep)

- No background worker job and no `apps/worker` changes (no expiry sweep is required by the ACs; threads close only by admin decision).
- No notification dispatch — mark `// TODO(8.8)` like Stories 4.2/4.3.
- No optimistic concurrency `If-Match` / `expectedVersion` handling (the claim lease is the guard until Story 8.3's unified queue).
- No seller-side attachments, no admin-side attachments, no read receipts, no typing indicators, no unread counts.
- No changes to `Conversation`, `Offer`, `OfferStatus`, or the offers endpoints.

### Anti-patterns that will fail review

- ✗ Re-implementing a phone/email/handle regex inside `apps/web` or `apps/api` (only `packages/shared/src/masking/contact-mask.ts` may own patterns).
- ✗ Persisting or echoing the pre-masking text, or putting a detected phone/email into an `AuditLog` payload or an API error message.
- ✗ Selecting `user.mobileNumber` / `user.email` in `INQUIRY_*_INCLUDE` (the offers mapper is the model: display names only).
- ✗ Adding a seller→buyer or buyer→seller endpoint, or letting `relayedAt` be set by anything other than an admin relay.
- ✗ Declaring a second listing projection instead of importing `OfferListingSummary`.
- ✗ Retyping `Conversation.status`, writing a Prisma migration file, or ordering `:id` before `my` / `received` / `attachments`.
- ✗ Trusting the client's masked payload without re-running `maskContactDetails` server-side.

### Project Structure Notes

- New API module: `apps/api/src/modules/inquiries/` — matches the established `modules/<domain>/` layout; the module owns its controllers, services, mapper, lock adapter and `__tests__/`.
- New generic lock helper: `apps/api/src/common/locks/` (peer of `common/clock/`, `common/pipes/`).
- New shared domains: `packages/shared/src/masking/` (new folder) plus additions to `constants/`, `schemas/`, `types/`, `enums/` — all re-exported through the existing barrels so `@elmasaif/shared` stays the only import path.
- Web surfaces mirror the offers surfaces one-to-one: `components/inquiries/`, `components/admin/inquiry-*.tsx`, `/app/{buyer,marketer,owner}/inquiries`, `/admin/conversations`.
- Detected variance: the API's per-message "relay stamp" (`InquiryMessage.relayedAt`) has no precedent in the offers module; it is required here because inquiries have no price/state that a party can act on, so the *content itself* must be withheld until relay. Documented rather than silently invented.

### Previous Story Intelligence (Stories 4.1 → 4.3)

- **db push only, no migrations.** Diff must be additive; `packages/shared` must be rebuilt (`npx tsc`) before any test run, because Jest/Vitest resolve `@elmasaif/shared` from `dist/`.
- **Prisma generate EPERM on Windows** when a dev server holds `query_engine-windows.dll.node`. Workaround: point the generator at a scratch dir, generate, copy everything except `*.node` into the hoisted `node_modules/.prisma/client/`, restore the schema, delete the scratch dir. Also delete any leftover `.prisma-client-tmp/` (Story 4.1 left a 19 MB file behind).
- **Route ordering:** literal Nest routes must precede `:id` routes (`offers.controller.ts#L46-L48` documents the trap).
- **Exhaustive `Record<Enum, …>` maps break at compile time** when an enum grows — extend `INQUIRY_STATUS_LABELS_AR` / badge-variant maps in the same commit as the enum.
- **Hard-coded status arrays**: the listings module's four "open offer" arrays were replaced by `[...ACTIVE_OFFER_STATUSES]`. Do not introduce new literal status lists in inquiries; import `INQUIRY_QUEUE_STATUSES` / `CLAIMABLE_INQUIRY_STATUSES`.
- **Do not redeclare projections.** The listing projection already exists as `OfferListingSummary` (id, title, propertyType, cityName, districtName, askPrice, areaSquareMeters, status); import it into the inquiry types instead of declaring `InquiryListingSummary`.
- **Arabic corruption is real at write time, not only on screen.** After writing Arabic literals, verify with a Node script asserting `\uXXXX` escapes / no `U+FFFD`; never trust `grep` output.
- **Test baselines to protect:** shared 349, API 623, worker 71, web 273 — all green before this story.
- Worker jobs are DB-less no-op factories at runtime — another reason not to add one here.

### Git Intelligence

Recent commits: `74a003c backup-offer-queue-pipeline`, `7ba8e9f 4-2-mediated-counter-offer-rounds-seller-responses`, `ffe1464 4-1-offer-submission-price-guardrail-validation`. The pattern is one commit per story touching `schema.prisma` → `packages/shared` contracts → API module → web components/routes → tests, with `sprint-status.yaml` updated in the same commit. Working tree is otherwise clean (only `sprint-status.yaml` and the 4-3 story file are modified).

### Latest Tech Notes

- Zod 3.23 (`z.nativeEnum` for Prisma-mirrored enums, `z.coerce.number()` for query params) — the schemas in `packages/shared/src/schemas/offer.schema.ts` are the canonical idiom to copy.
- Nest 10 `FileInterceptor` with `limits.fileSize` is already used by `users/identity.controller.ts`; Multer's default is in-memory (`file.buffer`), which `QuarantineService` consumes directly — do not add `diskStorage`.
- Prisma 5 `updateMany` returns `{ count }`; conditional updates are the only race-free claim primitive here.
- S3/MinIO presigned download expiry is clamped to `MAX_EXPIRATION_SECONDS = 300` by `StorageService`.

### Manual Verification (end-to-end smoke)

1. `npm run build:shared` && `cd apps/api && npx prisma validate && npx prisma db push && npx prisma generate`.
2. Seed/log in a BUYER, a MARKETER (owner of an `ACTIVE` listing) and an ADMIN.
3. `POST /api/v1/inquiries` with body text `اتصل بي 0551234567 أو buyer@example.com أو @my_snap` → response body must contain `***` in place of all three, `maskingApplied: true`, and no original characters.
4. `GET /api/v1/admin/inquiries` → item present, `lockInfo.isLocked: false`; `POST /api/v1/admin/inquiries/:id/claim` → 200 with `remainingSeconds ≈ 900`; a second admin claim → `409 INQUIRY_LOCK_CONFLICT` naming the holder.
5. `POST /api/v1/admin/inquiries/:id/relay-to-seller` → seller `GET /api/v1/inquiries/received` now returns the thread; seller `POST /api/v1/inquiries/:id/messages` → `SELLER_RESPONDED`; buyer `GET /api/v1/inquiries/:id` must **not** yet contain the seller's reply.
6. `POST /api/v1/admin/inquiries/:id/relay-to-buyer` → buyer now sees the reply; `POST /api/v1/admin/inquiries/:id/close` with a reason → `CLOSED`; further messages → `409 INQUIRY_CLOSED`.
7. `GET /api/v1/inquiries/attachments/:id/download` → 200 presigned URL for a `CLEAN` file; uploading a 6th attachment → `INQUIRY_ATTACHMENT_LIMIT_EXCEEDED`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4 (L694-L704)] — AC source.
- [Source: _bmad-output/planning-artifacts/prds/prd-elmaisaif-2026-10-26/prd.md#4.8 FR-35] — mediated inquiries, 5 attachments, masking; `#4.11 FR-51` — claim semantics; `#10 R-04` — circumvention risk; `#8.1` — quarantine scanning; `#4.7 FR-32` — the only contact-release point.
- [Source: _bmad-output/planning-artifacts/prds/prd-elmaisaif-2026-10-26/addendum.md#AD-6] — `FileObject.scanStatus`, fail-closed; `#4` — `Conversations.Handle` permission.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmaisaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-10] — 15-minute claim leases; `#AD-11` — `ClockService`; `#AD-12` — permission matrix; `#Consistency Conventions` — error envelope, `/api/v1`.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-elmaisaif-2026-10-27/DESIGN.md#Components, #Colors] — task-lock banner, `status-pending` tokens; [EXPERIENCE.md#Component Patterns] — attachment picker, mediated-communication microcopy.
- Code reuse: `apps/api/src/modules/offers/admin-offers.service.ts` (claim/heartbeat/release/force-unlock/decision), `offer-lock.ts`, `offer-thread.mapper.ts`, `offers.service.ts#resolveBuyerProfile`, `apps/api/src/modules/storage/quarantine.service.ts`, `storage.service.ts#getVerifiedDownloadUrl`, `packages/shared/src/constants/offer.ts` (constant/error-code style), `packages/shared/src/schemas/offer.schema.ts` (Zod idioms), `apps/web/src/components/admin/offer-mediation-queue.tsx` + `offer-negotiation-*.tsx` (UI patterns).

## Dev Agent Record

### Agent Model Used

Qoder — BMAD Dev Story agent (Agent mode).

### Debug Log References

- `git rev-parse HEAD` baseline captured at story start: `74a003c9860aea94c81a95040f33f3da92ee1163`.
- Prisma: `npx prisma validate` clean; `prisma db push` diff was purely additive (3 tables + 2 enums); generated client verified to contain `ListingInquiry`, `InquiryMessage`, `InquiryAttachment`, `InquiryStatus`, `InquiryAuthorRole`.
- Shared: `npm run build:shared` OK → 33 files / 410 tests pass.
- API: `npx jest` → 56 suites / 675 tests pass; `npx tsc --noEmit` exit 0; `npm run build:api` OK.
- Web: `npx vitest run` → 49 files / 315 tests pass (incl. 27 inquiry + 15 admin-queue specs); `npx tsc --noEmit` shows only pre-existing errors in `.next/types`, `design-tokens.spec`, `property-spec`, `property-card`, `api-client.spec` (no `inquir*` hits).
- Worker: `npx vitest run` → 9 files / 71 tests pass.
- Lint: repo-wide `npm run lint` still fails on pre-existing, unrelated errors (worker `account-deletion-expiry.spec.ts`; shared `listing-map.spec.ts` + `types/listing.ts`; API `users/*` unused imports; web `map/__tests__` + `design-tokens`). Grep of both API and web lint output for `inquir|conversations` returned no matches → all new files are lint-clean.
- Live route check: `node dist/main.js` boot log shows every inquiry route registered with literal paths (`/inquiries/my`, `/inquiries/received`, `/inquiries/attachments`, `/inquiries/attachments/:id/download`, `POST /inquiries`, `:id`, `:id/messages`) before `:id`; `GET /inquiries/my|received`, `GET /admin/inquiries`, `GET /inquiries/:id` all answer `401` (guarded, not `404`).
- End-to-end relay smoke against the running dev API (temporary script, deleted afterwards): buyer register → OTP → submit inquiry → masking verified → admin login → queue → claim (900 s lease) → relay-to-seller → seller step-up login → switch to MARKETER → received list → seller reply (`SELLER_RESPONDED`) → buyer cannot see the unrelayed reply → re-claim → relay-to-buyer → buyer sees it → re-claim → close → `409 INQUIRY_CLOSED`. Temporary DB fixtures (normalised demo-seller mobile, temporary ACTIVE `FalLicense`) were reverted at the end of the run.

### Completion Notes List

- **Task 1** — `maskContactDetails` is the single masking implementation (phones incl. Arabic-Indic digits/`+966` variants, emails, social handles/links, overlap merge, idempotent, never returns originals). Consumed by shared schemas, the API writer and the web preview.
- **Task 2** — `InquiryStatus`/`InquiryAuthorRole` mirrored in shared enums, error codes + lock/queue constants + Arabic label maps, Zod schemas and types; `ClaimLockInfo` introduced in `types/locks.ts` with `OfferLockInfo` kept as a structural alias so no existing offer code changed.
- **Task 3** — Schema is purely additive: `ListingInquiry`, `InquiryMessage`, `InquiryAttachment` + 2 enums, back-relations only on `Listing`/`UserProfile`. `Conversation`/`Offer`/`OfferStatus` untouched (D12).
- **Task 4** — `apps/api/src/common/locks/claim-lock.ts` now owns lease maths (`buildClaimLockInfo`, `assertClaimLockHeld`, `resolveClaimLockHolderNames`); `offer-lock.ts` became a thin delegation with unchanged exports, and inquiry code binds the same functions to `INQUIRY_LOCK_*` codes — no offer/backup-offer spec edits were needed.
- **Task 5** — `InquiriesModule` exposes buyer (`POST /inquiries`, `/inquiries/my`, `/inquiries/attachments`, `/inquiries/attachments/:id/download`) and seller (`/inquiries/received`, `POST /inquiries/:id/messages`) surfaces; one viewer-aware mapper (`inquiry-thread.mapper.ts`) is the only projection, so no pre-mask text or contact columns can leak. Persisted bodies/masked types/relay stamps come from `inquiry-message-writer.ts`; masking is always re-applied server-side.
- **Task 6** — Admin queue + workspace endpoints (`getQueue`, `getInquiry`, `claim`, `heartbeat`, `release`, `force-unlock`, `relay-to-seller`, `relay-to-buyer`, `close`) under `Conversations.Handle`; every transition runs in one `$transaction` behind a `::text` `FOR UPDATE` lock, validates the lease in-transaction, releases it on commit and writes the `AuditLog` in the same transaction (AC-6/AD-10/AD-11).
- **Task 7** — `StoragePartition` gained `'inquiries'` → `inquiries/${context.userId}/${leafFilename}` with the same `userId` guard style as `identity`; quarantine/scan gating reused unchanged.
- **Task 8** — Buyer submit form (live masked preview, ≤5 attachment picker, inline errors, RTL), thread view, status badge, buyer and seller lists, `InquiriesView` fetch wrapper, plus the property-page entry point (top-of-page trigger → modal dialog, separate from the offer block) and 6 thin workspace routes. Covered by 27 SSR tests.
- **Task 9** — Admin queue (claim → workspace, holder-name conflict banner via `readLockHolderName`) and workspace (lock banner + countdown, heartbeat every 5 min, read-only mode, relay/close actions, force-unlock with reason). Covered by 15 SSR tests; `next/navigation` is mocked in the spec because `useRouter` is a client hook.
- **Task 10** — Sidebar entries added for buyer/owner/marketer/admin (admin gated on `Conversations.Handle`); all four suites + API typecheck green; the live relay loop (AC-1, AC-3, AC-4, AC-5) passed end-to-end against the dev API.
- Pre-existing issues found but deliberately **not** fixed (out of scope): the seeded demo seller stores a non-normalised mobile (`0500000099`) so phone-based login/step-up cannot match, and has no FAL licence so it cannot switch to the MARKETER workspace; `npm run lint` fails on unrelated files.

### File List

**packages/shared (new)**
- `packages/shared/src/masking/contact-mask.ts`
- `packages/shared/src/masking/index.ts`
- `packages/shared/src/masking/__tests__/contact-mask.spec.ts`
- `packages/shared/src/constants/masking.ts`
- `packages/shared/src/constants/inquiry.ts`
- `packages/shared/src/constants/__tests__/inquiry.spec.ts`
- `packages/shared/src/schemas/inquiry.schema.ts`
- `packages/shared/src/schemas/__tests__/inquiry.spec.ts`
- `packages/shared/src/types/inquiry.ts`
- `packages/shared/src/types/locks.ts`

**packages/shared (modified)**
- `packages/shared/src/index.ts`
- `packages/shared/src/enums/index.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/types/offer.ts`

**apps/api (new)**
- `apps/api/src/common/locks/claim-lock.ts`
- `apps/api/src/modules/inquiries/inquiries.module.ts`
- `apps/api/src/modules/inquiries/inquiries.controller.ts`
- `apps/api/src/modules/inquiries/inquiries.service.ts`
- `apps/api/src/modules/inquiries/admin-inquiries.controller.ts`
- `apps/api/src/modules/inquiries/admin-inquiries.service.ts`
- `apps/api/src/modules/inquiries/inquiry-lock.ts`
- `apps/api/src/modules/inquiries/inquiry-masking.ts`
- `apps/api/src/modules/inquiries/inquiry-message-writer.ts`
- `apps/api/src/modules/inquiries/inquiry-thread.mapper.ts`
- `apps/api/src/modules/inquiries/dto/inquiry.dto.ts`
- `apps/api/src/modules/inquiries/__tests__/inquiries.spec.ts`
- `apps/api/src/modules/inquiries/__tests__/admin-inquiries.spec.ts`

**apps/api (modified)**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/offers/offer-lock.ts`
- `apps/api/src/modules/storage/storage.service.ts`

**apps/web (new)**
- `apps/web/src/components/inquiries/inquiry-submit-form.tsx`
- `apps/web/src/components/inquiries/inquiry-thread-view.tsx`
- `apps/web/src/components/inquiries/inquiry-status-badge.tsx`
- `apps/web/src/components/inquiries/buyer-inquiries-list.tsx`
- `apps/web/src/components/inquiries/seller-inquiries-list.tsx`
- `apps/web/src/components/inquiries/inquiries-view.tsx`
- `apps/web/src/components/inquiries/index.ts`
- `apps/web/src/components/inquiries/__tests__/inquiries.spec.tsx`
- `apps/web/src/components/admin/inquiry-queue.tsx`
- `apps/web/src/components/admin/inquiry-workspace.tsx`
- `apps/web/src/components/admin/__tests__/inquiry-queue.spec.tsx`
- `apps/web/src/components/ui/modal.tsx`
- `apps/web/src/components/ui/__tests__/modal.spec.tsx`
- `apps/web/src/app/app/buyer/inquiries/page.tsx`
- `apps/web/src/app/app/buyer/inquiries/[id]/page.tsx`
- `apps/web/src/app/app/marketer/inquiries/page.tsx`
- `apps/web/src/app/app/marketer/inquiries/[id]/page.tsx`
- `apps/web/src/app/app/owner/inquiries/page.tsx`
- `apps/web/src/app/app/owner/inquiries/[id]/page.tsx`
- `apps/web/src/app/admin/conversations/page.tsx`
- `apps/web/src/app/admin/conversations/[id]/page.tsx`

**apps/web (modified)**
- `apps/web/src/app/properties/[id]/page.tsx`
- `apps/web/src/app/properties/[id]/listing-detail-view.tsx` (optional `headerAction` slot)
- `apps/web/src/components/ui/index.ts` (`Modal` export)
- `apps/web/src/components/offers/offer-submit-form.tsx` (inner padding + dividers)
- `apps/web/src/components/layout/workspace-shell.tsx`
- `apps/web/tsconfig.tsbuildinfo` (generated build artifact)

**docs / tracking**
- `_bmad-output/implementation-artifacts/4-4-mediated-listing-inquiries-automated-sensitive-contact-maski.md` (this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-backup-offer-queue-pipeline.md` (offer-lock delegation note)

## Change Log

| Date | Change |
| --- | --- |
| 2026-11-06 | Implemented Story 4.4 end-to-end: shared masking engine + inquiry contracts, additive Prisma models, shared claim-lock extraction, buyer/seller API surfaces, admin conversation queue, `inquiries` storage partition, web buyer/seller/admin UI, sidebar navigation. Added 69 new tests (410 shared / 675 API / 315 web / 71 worker all green) and verified the full relay loop against the dev API. Status → review. |
| 2026-11-06 | UX follow-up: the «إرسال استفسار عن العقار» button moved to the top of the property page beside the “back to results” link, and the inquiry form now opens in a modal dialog (backdrop/Escape close, body scroll lock) instead of rendering at the bottom of the page. `ListingDetailView` gained an optional `headerAction` slot. The submit form also gained real inner padding (`p-5 sm:p-6`), a header divider and a footer divider, because `Card`/`CardHeader`/`CardContent` carry no padding of their own. |
| 2026-11-06 | UX follow-up 2: the offer/backup-offer form also moved into a dialog, and the duplicated overlay markup was extracted into `apps/web/src/components/ui/modal.tsx` (Escape + backdrop close, body scroll lock, shadowed scrollable panel). The offer form gained the same inner padding and header/footer dividers. Added `modal.spec.tsx` (3 SSR tests) — web suite 50 files / 318 tests green. |
