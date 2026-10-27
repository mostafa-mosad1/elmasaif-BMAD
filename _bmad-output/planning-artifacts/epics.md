---
status: draft
stepsCompleted: [step-01-requirements-inventory, step-02-epic-design, step-03-create-stories]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/EXPERIENCE.md
updated: 2026-10-27
---

# elmasaif - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for elmasaif, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories. Every requirement is inventoried and mapped to exactly one epic.

---

## Requirements Inventory

### Functional Requirements

- **FR1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking** — A visitor registers by submitting full name (3–100 chars) and Saudi mobile number (`^(\+966|0)5[0-9]{8}$`, normalized to `+9665XXXXXXXX`), verifying possession via 6-digit OTP (300s expiry, 60s throttle, 3 attempts lock for 15m), configuring password, and providing explicit legal consent (recording `termsVersion`, `privacyVersion`, `consentTimestamp`, `ipAddress`, `userAgent`, `source` in an insert-only `ConsentRecord` table for Saudi PDPL audit compliance).
- **FR2: Returning User Login & Session Handling** — Registered users authenticate using username/phone and password, issuing an HttpOnly, Secure session cookie with rolling 30-day expiry; 5 consecutive failed attempts lock login for 15m; new device/expired session triggers step-up OTP.
- **FR3: Multi-Role Profile Switching** — An authenticated user can attach multiple role profiles (`Buyer`, `Marketer`, `Owner`) to their single account and switch workspaces without re-authenticating; Owner role is instant; Marketer role requires approved Fal license (see FR6); active role scopes API authorization guards.
- **FR4: Identity Document Verification** — Users upload national identity document (National ID / Iqama in PDF/JPEG/PNG up to 10 MB) stored in private storage with signed URLs expiring in <= 5 minutes; mandatory prerequisite before Buyer can upload Deal payment proofs.
- **FR5: Seller Payout Account Management** — Marketers and Owners register at least one payout account with account holder name and 24-char Saudi IBAN (mod-97 validated); step-up OTP required for updates; locked while bound to active non-terminal deal; commercial name mismatch flags admin warning.
- **FR6: Fal License Submission & Administrative Review** — Marketer submits business credentials (Fal license certificate, number, expiration date, commercial name, 10-digit CR, up to 5 supporting docs) routing to Admin Licensing Queue as `UnderReview` with automated 15-minute task claim locking (see FR-51); expired dates rejected on client/server.
- **FR7: Automated Fal Expiry Enforcement** — Daily background job running in worker process checks Fal license expiration dates, sends warnings at 30, 7, and 1 days before expiry; on expiration date, sets `FalProfile = ComplianceRestricted` and moves active listings to `UnderComplianceReview` while in-flight deals continue.
- **FR8: Fal License Renewal** — Restricted or expiring Marketer submits updated Fal certificate and extended expiry date (`RenewalUnderReview`); admin approval reinstates eligible listings held in `UnderComplianceReview` to `Active`.
- **FR9: Owner Contract Generation & Electronic Signature** — Direct Owner requests property publication, reviews admin contract template, signs via canvas signature pad + 6-digit OTP stamping (capturing timestamp, IP, user agent); signed contract transitions to `SignedPendingFee` with 7-day payment deadline.
- **FR10: Owner Contract Fee Verification** — Owner uploads bank wire proof for listing contract fee (default SAR 1,000); admin confirmation transitions contract to `Active` and automatically publishes listing to `Active`; contract fees are strictly non-refundable.
- **FR11: Listing Creation & Field Specifications (Structured Geography)** — Providers create sale listings with title, property type (Apartment, Villa, Land, Building, Office), location coordinates (lat/long), master `cityId` and cascading `districtId` (selected from master tables; unvalidated text rejected; composite foreign key `[districtId, cityId]` enforced), single ask price (1 to 50,000,000 SAR), land area (m²), specs (bathrooms omitted per data model), and bound payout IBAN; Marketers must upload Owner Authorization Document (`AdminOnly`); min 3 max 20 photos (up to 10 MB); rentals and price ranges rejected.
- **FR12: Document Visibility & Classification** — Listing creators upload supporting documents with `Public` or `AdminOnly` visibility; title deeds, commercial registers, Fal certificates, and owner authorizations are strictly `AdminOnly` and never returned to non-admin API consumers.
- **FR13: Listing Moderation & Task Claim Locking** — Administrators review submitted listings, approve to `Active`, reject with notes, or request modifications, protected by an automated 15-minute task claim locking mechanism (see FR-51) preventing conflicting actions by multiple operators.
- **FR14: Listing Archiving & Compliance Suspension** — Sellers can archive `Active` listings that have no active deals; admins can hide or block non-compliant listings immediately; blocking hides listing from search and cancels non-deal pending offers; deletion/archiving blocked if linked to active deal.
- **FR15: Multi-Criteria Filter Search** — Buyers filter listings by text, property type, city, district, price range, area range, and bedroom count; results return only `Active` and `Reserved` listings; paginated (20-100) and sortable by newest/price; p95 latency < 800 ms under 50k listings.
- **FR16: Interactive Clustered Map View** — Buyers view listing locations on interactive map with marker clustering below zoom 12 and color-coded pins (Apartment=Blue, Villa=Green, Land=Orange, Building=Purple, Office=Red); clicking marker opens preview card; synchronizes with search filters.
- **FR17: Listing Detail & Dynamic Fee Breakdown** — Buyers inspect complete listing details, media carousel, specs, seller broker badge with rating; dynamic calculator displays Ask Price, Estimated Platform Commission (2.5%), and Estimated Total; direct seller contact concealed; Reserved listings accept Backup Offers only.
- **FR18: Similar Listings Engine** — Listing detail screen displays 4–6 similar active properties matching property type, city/district, and price within ±20%.
- **FR19: Seller Public Profile & Reputation (with Review Moderation)** — Buyers review seller public profile displaying commercial name, verified badge, average star rating, completed deal count, active listings, and public reviews; direct phone and email concealed; administrators with `Reviews.Moderate` permission can soft-delete or hide abusive/defamatory reviews while logging original content and reasons to `AuditLog`.
- **FR20: Favorites List** — Authenticated buyers bookmark up to 100 listings and review them in a dedicated favorites screen; updates status badges dynamically if Sold, Reserved, or Archived.
- **FR21: Demand Submission (Structured Geography)** — Buyers post free property demand specifying budget (SAR), structured `cityId` and optional `districtId` (selected from master tables), property type, required area (m²), and optional specifications; transitions immediately to `Active` with 30-day expiry; hourly worker job marks expired.
- **FR22: Automated Demand Matching Engine** — Matching engine evaluates new demands against active listings (matching property type, city, askPrice <= budget, and area within ±20%); dispatches instant notifications to all qualifying providers.
- **FR23: Provider Proposal Submission & Admin Review** — Matched provider attaches active matching listing and submits binding proposed price and terms (`PendingAdminReview`); admin approves to `ApprovedForBuyer` or rejects; unapproved proposals invisible to buyer.
- **FR24: Buyer Proposal Selection** — Buyer reviews approved proposals and selects preferred offer; transitions proposal to `SelectedPendingFinalAdminApproval` and routes to Admin Final Approval; if admin rejects, demand returns to `Active`.
- **FR25: Offer Submission & Price Guardrails** — Authenticated Buyer submits purchase offer on `Active` or `Reserved` listing (1 to 50M SAR); if < 50% ask price, requires low-price confirmation; offer on Reserved listing flagged `IsBackup = true`; max 1 active offer per buyer per listing; transitions to `PendingAdminReview`.
- **FR26: Mediated Counter-Offer Rounds** — Buyer and seller exchange counter-offers mediated by admin review; max 5 negotiation rounds; unanswered offers expire after 7 days; mutual agreement transitions offer to `SelectedPendingFinalAdminApproval`.
- **FR27: Backup Offer Pipeline** — Backup offers on `Reserved` listings reviewed and held in queue (see OQ-04); if primary deal cancels or times out, oldest approved backup offer is surfaced to admin for activation; automatically closed if primary deal completes.
- **FR28: Final Deal Approval & State Machine Binding** — Authorized admin (`Deals.FinalApprove`) approves agreed offer; atomically creates `Deal` with `status: AwaitingPaymentProof`, sets `Listing = Reserved`, enforces partial unique index (1 active deal per listing), and activates `PaymentDeadline = ClockService.now() + 48 hours`.
- **FR29: Immutable Financial Snapshot Freezing** — Deal creation freezes `FinalDealPrice`, `CommissionRateSnapshot` (2.5%), `FixedCommissionSnapshot` (0 SAR), `FinalCommission`, `FinalTotal`, and `SellerPayoutAccount` (holder name and IBAN) directly onto Deal record; subsequent settings changes never affect active deal.
- **FR30: Dual Payment Proof Upload** — Buyer uploads two distinct bank transfer receipts (PDF/JPEG/PNG, max 10 MB): Payment 1 (Commission to platform IBAN with code `ELM-{dealId}-C`) and Payment 2 (Price to Seller Payout IBAN); requires uploaded National ID; re-upload allowed before deadline; validated via quarantine malware ingestion hook (`NFR13`).
- **FR31: Administrative Proof Review, Task Claim Locking & Grace Period** — Admin audits proofs independently (see FR-51 for task locking), approving (`Confirmed`) or rejecting with mandatory reason under a 15-minute task claim lease (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`); uploading before deadline pauses cancellation; 12-hour grace period SLA without auto-cancel.
- **FR32: Atomic Deal Completion** — When both Payment 1 and Payment 2 are `Confirmed` before deadline, single database transaction executes: `Deal = Completed`, `Listing = Sold`, Owner Contract `Completed`, backup offers `Closed`, records invoice data per FR-68; releases direct seller phone and email; unlocks 1–5 star rating.
- **FR33: Automated Payment Timeout Cancellation** — Dedicated worker process running `pg-boss` job every 60s evaluates deals past `PaymentDeadline` using `ClockService.now()`; if uncompleted, not disputed, not in review, and not in grace period: sets `Deal = CancelledByTimeout`, payments `Expired`, reverts `Listing = Active`, and dispatches alerts.
- **FR34: Buyer Cancellation Before Payment** — Buyer can cancel active Deal while `AwaitingPaymentProof` provided no payment proofs have been uploaded; sets `Deal = CancelledByBuyer` and listing reverts to `Active`; disabled once proof is uploaded.
- **FR35: Mediated Listing Inquiries, Task Locking & Automatic Contact Masking** — Buyers submit inquiries creating mediated thread in Admin Conversation Queue with 15-minute task claim locking (see FR-51); direct chat prohibited; system automatically detects and masks Saudi phone numbers (`05XXXXXXXX`), emails, and usernames; max 5 attachments.
- **FR36: Deal Dispute Filing & Freeze** — Buyer or Seller can file formal Dispute after at least 1 proof uploaded; Deal transitions to `Disputed`, immediately suspending timeout cancellation and completion; routes to Super Admin (`Deals.DisputeResolve`) for adjudication under task claim locking (see FR-51).
- **FR37: Violation Reporting** — Any user can report fraudulent listing, abusive seller, or unauthorized broker with category, explanation, and up to 5 attachments; routes to Admin Reports Queue (`Reports.Handle`); submit-only in MVP.
- **FR38: Support Ticketing System** — Users open support tickets; support admins manage tickets with statuses `Open`, `InProgress`, `Resolved`, `Closed` backed by SLA monitoring.
- **FR39: Isolated Admin Realm & Authentication** — Dedicated route (`/admin`) and API prefix (`/api/v1/admin`) with separate tables, session cookies, rate limits, 5 failed attempts lock for 15m, and 8-hour inactivity session timeout.
- **FR40: Dynamic RBAC & Operational Queue Task Claim Locking** — Super Admin assigns granular permissions (including `Reviews.Moderate`, `Geo.Manage`, `Tasks.ForceUnlock`, `Users.PhoneChange`); all operational queues enforce an automated 15-minute task claim locking mechanism (see FR-51).
- **FR41: Dynamic System Settings & Commission Configuration** — Authorized admins modify global parameters (commission rate 2.5%, fixed fee, owner contract fee, payment window 48h, expiry windows); immediate effect on future transactions; writes immutable audit record.
- **FR42: Immutable Domain Audit Logging** — Append-only audit record for every sensitive state transition, administrative approval, payout account update, price override, and review moderation; captures actor, role, UTC timestamp, IP, action, entity, snapshots, admin reason; insert-only database table.
- **FR43: Account Soft & Hard Deletion Guardrails** — Admins can disable, enable, or soft-delete user accounts; hard deletion strictly blocked if any transaction history exists (listings, offers, deals, payments, messages, ratings).
- **FR44: Unified In-App Notification Feed** — Users receive real-time and stored notifications with unread counts and deep links per the notification catalog; retained for 90 days; critical deal, payment, and security alerts cannot be disabled by user preferences.
- **FR45: Transactional Email Notifications** — Dispatches transactional email receipts for deal creation, payment deadline warnings (12h, 2h), and deal completion confirmations per the notification catalog.
- **FR46: Forgot Password & Password Recovery** — Public recovery endpoint returns identical response and timing regardless of mobile number existence to eliminate account enumeration; OTP rate limiting matches FR-1; 3 consecutive incorrect OTP entries lock recovery for 15 minutes; new password must differ from current password; successful reset immediately revokes all active sessions, dispatches SMS and email notifications, logs an immutable audit event; disabled or soft-deleted accounts cannot reset. Realizes UJ-1.
- **FR47: Authenticated Change Password** — Authenticated users must supply their current password and new password; invalid current password returns `AUTH_INVALID_CREDENTIALS` and increments failed attempt counter toward temporary lockout; successful update revokes all other concurrent sessions, sends confirmation alerts, logs an immutable audit event. Realizes UJ-1.
- **FR48: Mobile Number Update with Dual-Verification** — User initiates phone number change requiring OTP verification on BOTH current and new numbers within a 15-minute request window; new number validated as unassigned to another account (`AUTH_PHONE_IN_USE`); notification dispatched to old number; operation blocked if user is party to a Deal in `AwaitingPaymentProof`, `PaymentUnderReview`, or `Disputed`; support-assisted path for lost SIM cards requires `Users.PhoneChange` permission, mandatory identity document check, mandatory justification reason, and immutable audit logging. Realizes UJ-1.
- **FR49: Profile Editing & Mandatory Email Verification** — Users edit display name and contact email only; modified email remains in pending status until the user opens the mandatory email verification link; each update logs previous and new values to audit trail; licensed Marketers receive commercial-name mismatch warning per FR-5 if name diverges. Realizes UJ-1.
- **FR50: Account Deletion, PDPL Compliance & Cooling-Off Period** — User submits deletion request requiring password and OTP re-authentication; blocked while any Deal is non-terminal, any dispute is open, or any Owner contract is `SignedPendingFee` or `FeeUnderReview`; accounts with zero transaction history enter `DeletionPending` state for a 14-day cooling-off period [ASSUMPTION], after which data is erased/anonymized; accounts with transaction history are deactivated, concealed from search, and records retained per statutory legal retention schedules; logging in during cooling-off cancels the deletion request. Realizes UJ-1.
- **FR51: Admin Task Claim and Locking** — Exclusive claim mechanism via explicit `POST /api/v1/admin/<queue>/<id>/claim` (never GET or page view); atomic conditional `UPDATE` sets `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` (+15 minutes) only if unlocked or expired; 5-minute heartbeat renewal; lock released on decision commit or explicit exit; other admins view read-only inspection banner with holder name; Super Admin with `Tasks.ForceUnlock` permission can force-release any lock with mandatory justification logged to `AuditLog`; lock never replaces optimistic concurrency `If-Match` version checks (stale submissions return HTTP 409 Conflict); applies to 8 entities: `Listing`, `FalProfile`, `OwnerListingRequest`, `Payment` (each payment separately, NOT PaymentProof), `ContractFeePayment`, `Conversation`, `Dispute`, and `Offer`. Realizes UJ-2, UJ-3.
- **FR52: Review Moderation Workspace** — Administrators with `Reviews.Moderate` permission review submitted ratings; can toggle `isHidden` with mandatory justification; hidden reviews are excluded from public average rating and count calculations; restoration is supported; physical rows are never deleted; every action writes to `AuditLog`. Realizes UJ-1, UJ-2.
- **FR53: Geographic Master Data Administration** — Administrators with `Geo.Manage` permission manage hierarchical `City` and `District` tables; add, edit, and toggle `isActive` flags; free-text city/district inputs are rejected; deactivated districts remain valid on existing historical listings but cannot be selected for new listings or demands. Realizes UJ-2.
- **FR54: Deal Rating Submission** — Buyer and Seller on a `Completed` Deal submit one immutable rating (1 to 5 stars, optional comment up to 500 characters); ratings are attached to the Deal and target user; subsequent edits are prohibited; triggers calculation of aggregate broker/seller score. Realizes UJ-1.
- **FR55: Seller Response to Offers** — Seller receives mediated purchase offer and can accept, reject with structured reason, or submit counter-offer; counter-offers advance negotiation round and route to admin mediation; rejecting with reason notifies buyer and closes offer thread. Realizes UJ-1.
- **FR56: Seller Cancellation Request Before Payment** — Seller can submit cancellation request for active deal while in `AwaitingPaymentProof` before any payment proof is uploaded; requires admin review and approval; sets `Deal = CancelledBySeller` and listing reverts to `Active`. Realizes UJ-1.
- **FR57: Admin Price Suggestion & Seller Response** — Admin inspecting listing during moderation can submit price revision suggestion with market reasoning; admin never edits the ask price directly (BR-16); seller receives notification and can accept (updating ask price) or decline (retaining submitted ask price). Realizes UJ-2.
- **FR58: Buyer Demand Lifecycle Management** — Buyers view active demands, inspect matching proposal counts, and can close/cancel active demands with a structured reason; closing demand cancels pending unselected proposals. Realizes UJ-1.
- **FR59: Marketer and Owner Unified Operational Dashboards** — Dedicated workspaces displaying active inventory, incoming inquiries, deal pipeline stages, commission forecasts, and Fal license status for Marketers; listing contract status and fee receipts for Owners. Realizes UJ-2, UJ-3.
- **FR60: User Preferences & Appearance Settings** — Authenticated users configure UI language (Arabic RTL / English LTR), display mode (light mode / dark mode), and toggle notification channel delivery preferences (SMS, Email, In-App). Realizes UJ-1.
- **FR61: Electronic Contract Template Management** — Authorized administrators (`Contracts:Manage`) manage legal contract templates for direct owner listings, editing standardized legal terms and updating version identifiers. Realizes UJ-3.
- **FR62: Penalties and Fraud Management Log** — Security administrators (`Security:Manage`) track platform policy violations, log suspicious IP/user activity, apply temporary marketer suspensions, and record disciplinary findings. Realizes UJ-2.
- **FR63: Financial Indicators & Transaction Reporting** — Financial auditors (`Finance:Audit`) view gross transaction volumes, platform commission totals, owner fee collections, and export filtered accounting reports in CSV/Excel formats. Realizes UJ-2.
- **FR64: Platform Content Management System (CMS)** — Administrators with `CMS:Manage` manage static informational pages, promotional banners, FAQ articles, and system notification/email templates. Realizes UJ-2.
- **FR65: Internal Administrative Notes** — Administrators attach internal private notes to listings, deals, marketer profiles, and disputes; notes are strictly `AdminOnly`, visible only to staff, and excluded from user-facing APIs. Realizes UJ-2.
- **FR66: Executive Back-Office Dashboard** — Real-time operational dashboard for administrators displaying platform throughput, active 48-hour deal counts, pending queue volumes, SLA breach warnings, and daily financial throughput. Realizes UJ-2.
- **FR67: View & Listing Engagement Analytics** — Platform asynchronously logs property listing impressions, page views, and favorite bookmarks from day one, providing historical conversion data for sellers and administrators. Realizes UJ-1, UJ-2.
- **FR68: Financial Invoice Data Capture** — Platform atomically generates an immutable `InvoiceRecord` upon confirmed platform commission or contract fee verification, capturing sequence number, counterparty legal names, national/CR identifiers, subtotal amount, 15% VAT amount, and tax treatment; preserves data foundation for Phase 2 ZATCA reporting without claiming MVP compliance. Realizes UJ-1, UJ-2.
- **FR69: Owner Listing Request Review & Contract Dispatch** — Administrators review submitted direct owner listing requests, select an active contract template (FR-61), configure or override the contract fee (default SAR 1,000), and dispatch standardized electronic contracts for owner signature (`ApprovedPendingSignature`); rejected requests capture mandatory reason; realizes UJ-3, UJ-5.
- **FR70: Administrative Password Reset** — Super Administrators with `Rbac.Manage` trigger secure, single-use, time-limited reset links (15-minute expiry) via email transport service for platform administrator accounts; revokes active sessions and permanently records audit entries to `AuditLog`; realizes UJ-5.

---

### NonFunctional Requirements

- **NFR1: Server-Side Security & Guard Enforcement** — Every API endpoint must enforce authentication, active role profile, resource ownership, and `@RequirePermissions('Area.Action')` strictly on the server; client route protection and button hiding are presentation conveniences only.
- **NFR2: Private Object Storage & Signed URLs (Data Residency)** — Storage and database must be hosted in a region inside the Kingdom of Saudi Arabia (the AWS Saudi region, announced for December 2026, or an in-Kingdom provider). me-south-1 (Bahrain) may be used only as an interim, only after written legal sign-off on cross-border processing under PDPL, with a documented migration plan. Region and endpoints are configuration only (`STORAGE_REGION`, `STORAGE_ENDPOINT`, `DATABASE_URL`). Production launch is blocked until OQ-12 is closed by legal counsel. Signed URLs expire in <= 5 minutes; max 10 MB per file.
- **NFR3: Sensitive Data Encryption & Masking** — IBANs and national IDs are encrypted at rest using AES-256; IBANs are masked in list views (`SA****************1234`) and unmasked only for active deal counterparties and authorized administrators.
- **NFR4: Rate Limiting & Throttling** — OTP endpoints (max 3/hr/phone), login (max 5 consecutive failures), file uploads, and message dispatches are protected by IP and account throttlers (`@nestjs/throttler`).
- **NFR5: Hard Production Startup Guard** — Application bootstrap lifecycle check throws fatal error and aborts startup (`process.exit(1)`) if `NODE_ENV === 'production'` and the static OTP provider (`123456`) or mock clock is configured.
- **NFR6: Privacy & Saudi PDPL Compliance** — Explicit legal consent captured in insert-only `ConsentRecord` table without default values, recording `termsVersion`, `privacyVersion`, `consentTimestamp`, `ipAddress`, `userAgent`, and `source`; immutable audit log for every contact disclosure; administrative and tax data retained per Saudi regulations; notifications older than 90 days purged.
- **NFR7: Web Vitals Performance Budgets** — Core Web Vitals on 4G mobile: Largest Contentful Paint (LCP) < 2.5s, First Input Delay (FID) < 100ms, Cumulative Layout Shift (CLS) < 0.1.
- **NFR8: API Latency SLA** — p95 latency < 500 ms for database mutations; p95 latency < 300 ms for cached/indexed read queries; p95 search latency < 800 ms under 50,000 active listings.
- **NFR9: Payment Deadline Background Execution** — Automated payment timeout cron runs every 60 seconds in dedicated worker process (`apps/worker`) via `pg-boss` and evaluates deals against `PaymentDeadline` using `ClockService.now()`.
- **NFR10: High Availability & Queue Resilience** — 99.5% monthly availability; automated daily PostgreSQL backups with Point-In-Time Recovery (PITR); background queues run via `pg-boss` with persistent state, retry backoff, and dead-letter queues in dedicated worker process.
- **NFR11: Optimistic Concurrency & Interactive Locking** — Entities subject to concurrent mutation (Deals, Offers, Listings) maintain integer `version` field with `If-Match` headers returning `409 Conflict`; deal approval, deal completion, and payment approval execute in Prisma interactive transactions with row-level locks; admin task locks enforce `lockExpiresAt` indexing.
- **NFR12: Database Exclusivity & Integrity Constraints** — Partial unique index (`deal_single_active_per_listing`) guarantees at most one non-terminal deal per listing; database `CHECK` constraints enforce non-negative financial values and positive prices; money calculations use fixed-point decimals (`Decimal(12,2)`).
- **NFR13: Pre-Persistence Quarantine Malware Scanning Hook** — File uploads land in an isolated quarantine storage location; `FileObject` / `PropertyDocument` track `scanStatus` (`Pending`, `Clean`, `Infected`, `ScanFailed`) and `scannedAt`; system fails closed if scanner is unavailable; only files marked `Clean` are moved to final storage and served.
- **NFR14: Deterministic Time Simulation (ClockService)** — The service layer abstracts all system time access behind an injectable `ClockService`. All business deadlines (`FR-28`, `FR-33`) utilize `ClockService.now()`. Fake clock endpoints are refused when `NODE_ENV === 'production'`.

---

### Additional Requirements

- **AR1: Monorepo Foundation & Workspace Scaffolding** — Establish an npm workspaces monorepo containing `apps/web` (Next.js App Router, React 19, TypeScript), `apps/api` (NestJS 10.x, TypeScript), `apps/worker` (standalone background job worker), and `packages/shared` (TypeScript interfaces, Zod schemas, constants). Code imports flow into `packages/shared`, never directly between apps.
- **AR2: Docker Compose Local Infrastructure & In-Kingdom Storage Target** — Provide `docker-compose.yml` orchestrating PostgreSQL 16, MinIO (private S3-compatible storage), and Mailpit (local SMTP email testing). Cloud targets use in-Kingdom storage; me-south-1 (Bahrain) is interim only with legal sign-off.
- **AR3: Same-Origin API Proxy & Cookie Isolation** — Configure Next.js rewrites (`next.config.ts`) in `apps/web` to proxy all `/api/*` traffic directly to `apps/api`, ensuring session authentication cookies remain strictly same-origin and immune to third-party cookie blocking.
- **AR4: Strict Presentation / Domain Boundary** — All state mutations and database reads must execute through NestJS REST endpoints (`/api/v1`). Next.js Server Actions and Route Handlers are strictly forbidden from executing database queries or Prisma calls.
- **AR5: Prisma ORM Schema & Relational Integrity** — Model domain entities in Prisma schema with camelCase properties mapped to snake_case database tables/columns (`@map`, `@@map`). Implement models for `City`, `District` (with `isActive` and `@@unique([id, cityId])`), `Listing` (with composite FK `[districtId, cityId]`), `ConsentRecord` (insert-only, no defaults), `InvoiceRecord`, `PhoneChangeRequest`, and admin task locking fields on the 8 target entities.
- **AR6: Dual-Realm Authentication Architecture** — Segregate regular users (`Buyer`, `Marketer`, `Owner`) and administrative staff into distinct database tables, session stores, and guards. Sessions stored server-side in PostgreSQL via `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Passwords hashed with Argon2id. Pluggable `OtpProvider` with static dev provider (`123456`) and hard production startup guard.
- **AR7: Private S3 Storage & Signed URL Service** — Storage module interfacing with MinIO/S3. Documents and proofs uploaded privately; downloads accessible strictly via short-lived signed URLs (<= 5 minutes) issued only after RBAC ownership verification.
- **AR8: Dedicated Background Worker & pg-boss Scheduler** — Background queues and recurring cron jobs run via ONE scheduler (`pg-boss` with singleton keys) inside a dedicated worker process (`apps/worker`), not in API instances. Remove `@nestjs/schedule` cron from API instances.
- **AR9: Semantic Action Endpoints, Idempotency & Optimistic Locking** — Generic PATCH mutations on status fields are prohibited; state transitions hit dedicated POST action endpoints (e.g. `/api/v1/deals/:id/approve`, `/api/v1/deals/:id/cancel`). Mutating financial requests require `Idempotency-Key` header tracked in PostgreSQL. Optimistic concurrency enforced via `version` column and `If-Match` header.
- **AR10: Direct Shared Contract Consumption** — Both `apps/web` and `apps/api` consume TypeScript interfaces, Zod validation schemas, business constants, and enums directly from `packages/shared` without generated OpenAPI client overhead in MVP.
- **AR11: Master Geographic Reference Tables** — Dedicated `City` and `District` database tables with cascading relationships and `isActive` toggles. Enforce composite foreign key relations on `Listing` (`[districtId, cityId] -> District[id, cityId]`); reject free text.
- **AR12: Operational Queue Task Claim Locking & Concurrency Control** — Explicit claim `POST /api/v1/admin/<queue>/<id>/claim` assigns 15-minute lease (`lockedByAdminId`, `lockedAt`, `lockExpiresAt`). 5-minute heartbeat renewal. Inspecting admins see read-only banner. Super Admin `Tasks.ForceUnlock` releases with audit log. Optimistic concurrency `If-Match` check preserved.
- **AR13: Deterministic Time Simulation (ClockService)** — Abstract time access behind `ClockService`. All business deadlines and queries pass `ClockService.now()`. Fake clock endpoint rejected when `NODE_ENV === 'production'`.
- **AR14: Invoicing & VAT Data Foundation** — MVP stores invoice data (`InvoiceRecord`) so Phase 2 needs no data rework; clearance and stamping are added later in `InvoicingModule`.

---

### UX Design Requirements

- **UX-DR1: RTL-Native Layout & Arabic Typography** — Complete application layout rendered natively in Right-to-Left (`dir="rtl"`, `lang="ar"`) using `IBM Plex Sans Arabic` as primary typeface and `JetBrains Mono` for monospace numbers/IBANs.
- **UX-DR2: Sovereign Luxury Color Tokens & Elevation System** — Design tokens in Tailwind CSS: Sovereign Emerald primary (`#1B4332`), Desert Gold accent (`#C69C45`), surfaces (`#F8FAF9`, `#FFFFFF`), and status badges. Includes complete dark mode tokens.
- **UX-DR3: Monospace Saudi IBAN Card with One-Click Copy & Mod-97 Validation** — Reusable `IbanCard` component displaying Saudi IBANs in monospace font grouped into blocks of 4 characters (`SA03 8000 0000 0000 0000 0000`) with a dedicated one-click copy button, 2-second toast confirmation (`تم النسخ`), and real-time client-side ISO 7064 mod-97 checksum validation.
- **UX-DR4: Dual Wire Transfer Interface (Deal Screen)** — Segregated dual action cards on `/app/buyer/deals/:id`: Card 1 (Platform Commission) displaying platform IBAN, generated Reference Code (`ELM-{dealId}-C`), and receipt upload dropzone; Card 2 (Property Purchase Price) displaying seller's verified name, verified Saudi IBAN, and property price receipt dropzone.
- **UX-DR5: 48-Hour Deal Countdown Banner & Grace Period Notice** — Prominent gold accent banner with countdown clock (`ساعة : دقيقة : ثانية`), progress bar, and administrative notice that uploading proof pauses cancellation while under review; 12-hour grace period SLA without auto-cancel; re-upload permitted during grace.
- **UX-DR6: Interactive Split-View Map & Clustered Listing Grid** — Desktop 50/50 split layout with interactive map on left and scrollable listing cards on right; mobile floating toggle pill between map and list; clustered markers below zoom 12; pins color-coded by property type.
- **UX-DR7: Property Card & 16:9 Media Carousel Component** — Reusable `PropertyCard` featuring 16:9 photo carousel, photo counter pill (`1/12`), Fal-verified badge, ask price, specs strip with bedrooms and area m² (bathrooms omitted per data model), and location tag.
- **UX-DR8: Dynamic Fee Calculator & Shielded Contact Callout** — Property detail widget displaying ask price, dynamic 2.5% platform commission calculation, estimated total, and prominent security callout disclosing that direct seller contact details remain strictly shielded until deal completion.
- **UX-DR9: Electronic Signature Canvas & 6-Digit Segmented OTP Component** — Owner contract review modal with touch/mouse canvas signature pad, clear/adopt controls, and 6-box segmented numeric OTP input with automatic focus advance.
- **UX-DR10: Mediated Negotiation Timeline & Mobile Action Tray** — Chronological vertical timeline displaying offer and counter-offer history with admin mediation status pill; fixed sticky bottom action tray on mobile with "قبول العرض" and "تقديم عرض مقابل" (withdraw action removed).
- **UX-DR11: Multi-Role Workspace Switcher & Shell Layouts** — Unified layout shell with 280px collapsible user sidebar and 260px admin sidebar; header dropdown role switcher seamlessly toggling between `/app/buyer`, `/app/marketer`, and `/app/owner` workspaces.
- **UX-DR12: WCAG 2.1 AA Accessibility & Keyboard Traversal** — Text meets >= 4.5:1 contrast; 3px emerald focus outline on interactive elements; logical RTL Tab traversal; `Esc` key closes modals; explicit form `<label>` associations; `aria-live="polite"` regions.
- **UX-DR13: Institutional Voice, Microcopy & Sensitive Data Redaction** — Standardized Arabic microcopy reflecting certified notary precision; automated client and server regex masking of Saudi phone numbers (`05XXXXXXXX`), emails, and usernames in inquiry forms.
- **UX-DR14: Cascading City & District Search Dropdown Component** — Searchable dual-dropdown inputs for master Saudi cities and districts with dynamic filtering, live Arabic keyword matching, and rejection of free text.
- **UX-DR15: Admin Operational Task-Lock Banner & Security Step-Up Modals** — Pinned amber banner in admin queues displaying active claim lock status with countdown timer ("قيد التدقيق بواسطة المسؤول - متبقي 14:20"); read-only view for inspecting admins; Super Admin force-unlock modal; modal dialogs for OTP step-up authentication.
- **UX-DR16: English LTR Support & Spatial Mirroring** — Complete geometric mirroring with `dir="ltr"` root, typography shifting to `Inter` / `Outfit`, and reversal of pagination and chevron directions.
- **UX-DR17: Structured Institutional Empty States** — Structured empty-state cards for search zero-results, empty queues, and initial dashboards with institutional iconography and clear calls to action.

---

### FR Coverage Map

Every functional, non-functional, architecture, and UX requirement is mapped to exactly one epic:

| Epic Identifier & Title | Functional Requirements (FR) | NonFunctional Requirements (NFR) | Architectural Requirements (AR) | UX Design Requirements (UX-DR) |
|---|---|---|---|---|
| **E0: Platform Foundation, Worker & Core Infrastructure** | *None (Infrastructure Spine)* | NFR2, NFR5, NFR9, NFR10, NFR13, NFR14 | AR1, AR2, AR7, AR8, AR10, AR11, AR13 | UX-DR1, UX-DR2, UX-DR16, UX-DR17 |
| **E1: Identity, Auth & Saudi User Governance** | FR1, FR2, FR3, FR4, FR5, FR46, FR47, FR48, FR49, FR50, FR60 | NFR1, NFR3, NFR4, NFR6 | AR3, AR4, AR6 | UX-DR3, UX-DR11, UX-DR12 |
| **E2: Property Listings, Moderation & Geography** | FR11, FR12, FR13, FR14, FR53, FR57, FR67 | NFR8, NFR11 | AR5, AR9 | UX-DR7, UX-DR14 |
| **E3: Buyer Search, Discovery & Demands** | FR15, FR16, FR17, FR18, FR20, FR21, FR22, FR23, FR24, FR58 | NFR7 | *None (Consumes E0/E2 APIs)* | UX-DR6, UX-DR8 |
| **E4: Mediated Offers & Price Negotiation** | FR25, FR26, FR27, FR35, FR55 | *None (Shared Guardrails)* | *None (Consumes E0/E2 APIs)* | UX-DR10, UX-DR13 |
| **E5: Deals, Dual Wire Transfers & Settlement** | FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR36, FR54, FR56, FR68 | NFR12 | AR14 | UX-DR4, UX-DR5 |
| **E6: Marketer Workspace & Fal Compliance** | FR6, FR7, FR8, FR19, FR59 | *None (Shared Infrastructure)* | *None (Consumes E0 Worker)* | *None (Shared Layouts)* |
| **E7: Owner Contracts & Electronic Signature** | FR9, FR10, FR61, FR69 | *None (Shared Infrastructure)* | *None (Consumes E0 S3/OTP)* | UX-DR9 |
| **E8: Admin Back-Office Operations & Operational Queues** | FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR51, FR52, FR62, FR63, FR64, FR65, FR66, FR70 | *None (Shared Guardrails)* | AR12 | UX-DR15 |

---

## Epic List

### Epic 0: Platform Foundation, Worker & Core Infrastructure
Establish the modular monorepo workspace (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`), Docker local infrastructure (PostgreSQL 16, MinIO private sovereign S3 target, Mailpit), Prisma relational schema with master geographic and audit tables, injectable `ClockService` for deterministic time testing, quarantine malware scanning hook, and the `pg-boss` singleton background worker process.
**FRs covered:** *None (Infrastructure Spine)*
**NFRs covered:** NFR2, NFR5, NFR9, NFR10, NFR13, NFR14
**ARs covered:** AR1, AR2, AR7, AR8, AR10, AR11, AR13
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR16, UX-DR17

### Epic 1: Identity, Auth & Saudi User Governance
Enable Saudi citizen and resident buyers, marketers, and owners to securely register via Saudi mobile OTP, record immutable PDPL legal consents, authenticate via secure HttpOnly session cookies, switch role profiles dynamically (`Buyer`, `Marketer`, `Owner`), verify identity documents, manage payout IBANs with mod-97 validation, change mobile numbers via dual OTP, update passwords, and manage account deletion with a 14-day cooling-off period.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR46, FR47, FR48, FR49, FR50, FR60
**NFRs covered:** NFR1, NFR3, NFR4, NFR6
**ARs covered:** AR3, AR4, AR6
**UX-DRs covered:** UX-DR3, UX-DR11, UX-DR12

### Epic 2: Property Listings, Moderation & Geography
Enable property marketers and owners to publish sale listings bound to validated geographic master data (`City`, `District` with composite foreign key validation), upload property media and private title/authorization documents, and enable administrators to review, moderate under 15-minute task claim locks, suggest price revisions, and track engagement impressions.
**FRs covered:** FR11, FR12, FR13, FR14, FR53, FR57, FR67
**NFRs covered:** NFR8, NFR11
**ARs covered:** AR5, AR9
**UX-DRs covered:** UX-DR7, UX-DR14

### Epic 3: Buyer Search, Discovery & Demands
Enable property buyers to search and filter active properties by geographic, physical, and financial criteria, browse listings on an interactive clustered map, inspect comprehensive property details with dynamic platform commission calculation (2.5%) while keeping seller contact shielded, bookmark favorite properties, and post/manage structured property demands with automated seller matching.
**FRs covered:** FR15, FR16, FR17, FR18, FR20, FR21, FR22, FR23, FR24, FR58
**NFRs covered:** NFR7
**UX-DRs covered:** UX-DR6, UX-DR8

### Epic 4: Mediated Offers & Price Negotiation
Enable buyers to submit legally binding purchase offers and backup offers with price guardrails, exchange mediated counter-offers with sellers across up to 5 negotiation rounds, and submit listing inquiries protected by automated contact detail redaction and admin mediation.
**FRs covered:** FR25, FR26, FR27, FR35, FR55
**UX-DRs covered:** UX-DR10, UX-DR13

### Epic 5: Deals, Dual Wire Transfers & Settlement
Enable approved offers to bind into an atomic Deal with frozen financial snapshots, enforce a strict 48-hour payment deadline via ClockService, guide buyers through dual wire transfer receipt uploads (Commission to platform, Price to seller), empower admins to audit proofs under 15-minute claim locks and a 12-hour grace period SLA, atomically complete deals (releasing seller contact details, recording VAT invoice records, unlocking 1-5 star ratings), and manage disputes and pre-payment cancellations.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR36, FR54, FR56, FR68
**NFRs covered:** NFR12
**ARs covered:** AR14
**UX-DRs covered:** UX-DR4, UX-DR5

### Epic 6: Marketer Workspace & Fal Compliance
Enable licensed real estate marketers to submit Fal license and Commercial Registration credentials for administrative review under task claim locking, track licensing status in a dedicated dashboard, undergo automated daily background expiry checks and license renewal workflows, and maintain a verified public broker profile with moderated reviews.
**FRs covered:** FR6, FR7, FR8, FR19, FR59

### Epic 7: Owner Contracts & Electronic Signature
Enable direct property owners to submit listing requests, review standardized electronic contracts dispatched by administrators (FR-69), execute legally binding signatures via an interactive canvas pad stamped with 6-digit OTP verification, submit wire transfer proof for the non-refundable SAR 1,000 listing fee, and have listings automatically published upon fee confirmation. Empower administrators to manage standardized legal contract templates (FR-61).
**FRs covered:** FR9, FR10, FR61, FR69
**UX-DRs covered:** UX-DR9

### Epic 8: Admin Back-Office Operations & Operational Queues
Provide administrative staff with an isolated back-office portal (`/admin`) enforcing granular dynamic RBAC, unified 15-minute task claim locking across all 8 operational entities with Super Admin force-unlock capabilities, public review moderation, dispute resolution, violation reporting and support tickets, dynamic commission/system configuration, immutable domain audit logging, multi-channel notification dispatches, fraud logging, financial reporting with CSV export, CMS content management, internal staff notes, an executive operations dashboard, and secure administrative password resets (FR-70).
**FRs covered:** FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR51, FR52, FR62, FR63, FR64, FR65, FR66, FR70
**ARs covered:** AR12
**UX-DRs covered:** UX-DR15

---

## Epic 0: Platform Foundation, Worker & Core Infrastructure

Establish the modular monorepo workspace, local Docker development environment (PostgreSQL 16, MinIO in-Kingdom sovereign target, Mailpit), Prisma relational schema with master geographic and audit tables, injectable ClockService, quarantine malware scanning hook, and pg-boss standalone worker process.

### Story 0.1: Monorepo Foundation & Workspace Tooling
As a software engineer,
I want a configured npm workspaces monorepo structure with apps/web, apps/api, apps/worker, and packages/shared,
So that development can proceed with shared TypeScript types, schemas, and consistent tooling across all tiers.

**Acceptance Criteria:**
**Given** an empty or initialized repository root
**When** the workspace configuration is inspected
**Then** `apps/web` (Next.js 15, React 19, TypeScript), `apps/api` (NestJS 10, TypeScript), `apps/worker` (standalone Node.js worker), and `packages/shared` are recognized as npm workspace packages
**And** `packages/shared` builds and exports TypeScript interfaces, Zod schemas, constants, and enums
**And** code imports flow strictly from apps into `packages/shared`, with direct app-to-app imports disallowed by lint rules.

### Story 0.2: Local Infrastructure, Docker Compose & Private Sovereign S3 Target
As a developer,
I want a local Docker Compose setup orchestrating PostgreSQL 16, MinIO private S3 storage, and Mailpit SMTP,
So that local development and testing mirror production sovereign storage and database constraints without external dependencies.

**Acceptance Criteria:**
**Given** Docker daemon is running
**When** `docker compose up -d` is executed
**Then** PostgreSQL 16 is accessible on port 5432, MinIO S3 API is accessible on port 9000 with console on 9001, and Mailpit is accessible on port 8025/1025
**And** a dedicated `StorageService` in `apps/api` interfaces with S3/MinIO using `STORAGE_ENDPOINT` and `STORAGE_REGION`
**And** downloads of private objects require signed URLs with an expiration duration of $\le 5$ minutes and a maximum file size of 10 MB.

### Story 0.3: Same-Origin API Proxy & HTTP Presentation Boundary
As a frontend developer,
I want Next.js rewrites configured in apps/web to proxy all /api/* requests directly to apps/api,
So that session cookies remain strictly same-origin and client components interact with backend services without cross-origin cookie blockers.

**Acceptance Criteria:**
**Given** `apps/web` and `apps/api` are running concurrently
**When** a client or browser fetches `/api/v1/health` through `apps/web`
**Then** Next.js transparently rewrites and proxies the request to the backend NestJS service at `http://localhost:3001/api/v1/health`
**And** `Set-Cookie` headers issued by the API are attached to the same origin without third-party cookie restrictions
**And** `apps/web` code contains zero direct database queries, zero Prisma client imports, and zero database mutations in Server Actions.

### Story 0.4: Master Geographic Tables & Initial Prisma Schema
As a system architect,
I want Prisma database models for Saudi administrative divisions (City and District) with relational constraints and seeds,
So that property listings and buyer demands can be strictly bound to validated geographical entities without free-text divergence.

**Acceptance Criteria:**
**Given** a connected PostgreSQL database
**When** `prisma migrate dev` is executed
**Then** `cities` and `districts` tables are created with `isActive` boolean flags and a composite unique index on `districts(id, city_id)`
**And** executing the geographic seed script populates major Saudi cities (Riyadh, Jeddah, Dammam, Mecca, Medina, Taif, Khobar) and their official districts
**And** querying the master data endpoint returns active districts grouped hierarchically by city.

### Story 0.5: Deterministic ClockService & Hard Startup Guard
As a backend engineer,
I want all system time access abstracted behind an injectable ClockService with a production startup guard,
So that business deadlines and time-dependent state machines can be deterministically tested without risking unauthorized clock manipulation in production.

**Acceptance Criteria:**
**Given** the application bootstrap process in `apps/api` and `apps/worker`
**When** `NODE_ENV === 'production'` and either the mock clock or static dev OTP provider (`123456`) is configured
**Then** the application startup lifecycle throws a fatal error and immediately aborts via `process.exit(1)`
**And** in non-production environments, `ClockService.now()` can be advanced or set via authenticated dev endpoints
**And** all domain services and timeout jobs query `ClockService.now()` instead of direct system `new Date()`.

### Story 0.6: Dedicated Background Worker & pg-boss Scheduler
As a DevOps engineer,
I want a standalone background worker process running ONE pg-boss scheduler with singleton keys,
So that recurring business sweeps and asynchronous jobs execute reliably without duplicate executions across horizontally scaled API instances.

**Acceptance Criteria:**
**Given** the `apps/worker` service is started
**When** `pg-boss` connects to PostgreSQL
**Then** worker queues for payment deadline sweeps, offer expiry, demand expiry, and Fal license checks are registered with singleton schedule keys
**And** recurring cron schedules run every 60 seconds for payment deadline evaluations
**And** jobs support automatic retry backoff, failure dead-letter logging, and persistent execution state.

### Story 0.7: Pre-Persistence Quarantine Malware Scanning Hook
As a security compliance officer,
I want all uploaded documents and images quarantined and scanned before persistence to public or operational buckets,
So that malicious payloads or corrupted files are intercepted before they reach users or administrative reviewers.

**Acceptance Criteria:**
**Given** a file upload request from a user
**When** the file is uploaded to the private storage service
**Then** the file initially lands in an isolated quarantine storage location with `scanStatus: Pending`
**And** a scan lifecycle hook inspects the file, transitioning `scanStatus` to `Clean`, `Infected`, or `ScanFailed`
**And** only files verified as `Clean` are moved to operational storage and accessible via signed URLs; infected files are quarantined and trigger security audit alerts.

### Story 0.8: Sovereign Design System Foundation & RTL Layout Shell
As a frontend engineer,
I want a centralized Tailwind CSS design token setup and RTL layout shell reflecting the Sovereign Luxury design palette,
So that all user and admin screens display authentic Arabic typography, sovereign colors, and institutional elevation.

**Acceptance Criteria:**
**Given** any visitor opening `apps/web`
**When** the root layout renders
**Then** the document is configured with `dir="rtl"`, `lang="ar"`, and `IBM Plex Sans Arabic` as the primary typography with `JetBrains Mono` for numbers and IBANs
**And** Sovereign Emerald (`#1B4332`) is configured as primary, Desert Gold (`#C69C45`) as accent, and neutral surface tokens support light and dark modes
**And** a layout direction toggle supports English LTR spatial mirroring with typography switching to `Inter`/`Outfit`
**And** empty state components render structured institutional icons and call-to-action cards for zero-result states.

---

## Epic 1: Identity, Auth & Saudi User Governance

Enable Saudi citizen and resident buyers, marketers, and owners to securely register via Saudi mobile OTP, record immutable PDPL legal consents, authenticate via secure HttpOnly session cookies, switch role profiles dynamically, verify identity documents, manage payout IBANs with mod-97 validation, change mobile numbers via dual OTP, update passwords, and manage account deletion with a 14-day cooling-off period.

### Story 1.1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking
As a Saudi citizen or resident visitor,
I want to register an account using my Saudi mobile number and verify it via a 6-digit OTP while signing the required legal consent,
So that I can establish a verified, PDPL-compliant account on the platform.

**Acceptance Criteria:**
**Given** a visitor submitting registration details
**When** the user provides full name (3–100 chars), Saudi mobile number matching `^(\+966|0)5[0-9]{8}$`, and password
**Then** the phone is normalized to `+9665XXXXXXXX` and a 6-digit OTP is generated with 300s expiry and 60s throttle
**And** 3 consecutive incorrect OTP entries lock verification for 15 minutes
**And** upon successful OTP entry, an insert-only `ConsentRecord` is created capturing `termsVersion`, `privacyVersion`, `consentTimestamp`, `ipAddress`, `userAgent`, and `source`
**And** user is authenticated with default `Buyer` profile.

### Story 1.2: Returning User Login, Session Handling & Lockout
As a registered user,
I want to log in using my mobile number and password,
So that I can securely access my account across sessions with automated brute-force protection.

**Acceptance Criteria:**
**Given** a registered user on the login screen
**When** submitting valid phone and password credentials
**Then** an HttpOnly, Secure, SameSite=Lax session cookie with a 30-day rolling expiration is issued
**And** 5 consecutive failed login attempts trigger an automated 15-minute account lock with a generic error message
**And** logging in from an unrecognized device or expired session triggers step-up OTP verification before granting session access.

### Story 1.3: Multi-Role Profile Switching & Workspace Shell
As an authenticated user,
I want to attach multiple role profiles (Buyer, Marketer, Owner) to my account and switch workspaces seamlessly,
So that I can perform different market activities without logging out and back in.

**Acceptance Criteria:**
**Given** an authenticated user with multiple profiles
**When** selecting a role from the workspace switcher dropdown in the navigation header
**Then** the active role profile updates in session context and the UI transitions to the selected workspace (`/app/buyer`, `/app/marketer`, or `/app/owner`)
**And** switching to `Owner` role is instantaneous for any registered user
**And** switching to `Marketer` role is permitted only if the user has an approved Fal license profile
**And** backend NestJS guards validate that API requests match the permissions of the actively selected role profile.

### Story 1.4: Identity Document Verification
As a buyer preparing to participate in property transactions,
I want to upload my Saudi National ID or Iqama document for private verification,
So that my identity is verified before I execute high-value real estate transactions.

**Acceptance Criteria:**
**Given** an authenticated user navigating to identity verification
**When** uploading a National ID or Iqama document (PDF, JPEG, PNG up to 10 MB)
**Then** the file is stored in private S3 storage under quarantined encryption
**And** access to the document is restricted to authorized administrative staff via signed URLs expiring in $\le 5$ minutes
**And** verified identity status is recorded on the user profile as a mandatory prerequisite before uploading Deal payment proofs.

### Story 1.5: Seller Payout Account Management & Monospace IBAN Card
As a marketer or property owner,
I want to register and manage verified Saudi payout bank accounts with Mod-97 checksum validation,
So that I can securely receive property sales proceeds.

**Acceptance Criteria:**
**Given** a seller adding a payout account
**When** entering the account holder name and 24-character Saudi IBAN starting with `SA`
**Then** the client and server validate the IBAN using ISO 7064 Mod-97 checksum algorithm
**And** the IBAN is stored encrypted at rest using AES-256 and displayed in monospace grouped format (`SA03 8000 0000 0000 0000 0000`) with a one-click copy button and toast confirmation
**And** modifying a payout account requires step-up OTP verification
**And** payout accounts currently bound to an active non-terminal deal cannot be deleted or modified.

### Story 1.6: Password Recovery & Authenticated Password Change
As a user who forgot my password,
I want to recover access via a secure step-up OTP flow,
So that I can regain access to my account without exposing account existence to attackers.

**Acceptance Criteria:**
**Given** a user on the public password reset screen
**When** submitting a mobile number
**Then** the response returns identical HTTP status, message, and timing regardless of whether the number exists in the database
**And** 3 consecutive incorrect OTP entries lock recovery for 15 minutes
**And** upon submitting a new password (which must differ from the current password), all existing active sessions are revoked immediately and an audit event is recorded
**And** authenticated users changing passwords in settings must supply their current password.

### Story 1.7: Secure Mobile Number Update with Dual-OTP
As an authenticated user,
I want to update my registered mobile number using verification on both my current and new numbers,
So that my account phone number can be safely updated without risking account takeover.

**Acceptance Criteria:**
**Given** an authenticated user requesting a mobile number change
**When** submitting the new Saudi mobile number
**Then** the new number is checked to ensure it is not assigned to any other account (`AUTH_PHONE_IN_USE`)
**And** OTP verification codes are dispatched to BOTH the old and new mobile numbers, requiring validation within 15 minutes
**And** the update is blocked if the user is currently party to an active Deal in `AwaitingPaymentProof`, `PaymentUnderReview`, or `Disputed`
**And** support-assisted phone updates require `Users.PhoneChange` permission, identity verification, and mandatory administrative reason logging.

### Story 1.8: Profile Editing & Mandatory Email Verification
As an authenticated user,
I want to edit my display name and email address with email confirmation,
So that my contact details remain accurate and verified for transactional notices.

**Acceptance Criteria:**
**Given** a user updating profile details in settings
**When** entering a new email address
**Then** the new email is held in pending status and a verification link is dispatched
**And** the account continues to use the previous email until the verification link is clicked
**And** licensed Marketers updating display names are warned if the name diverges from their commercial registration name
**And** all profile edits log old and new values to the immutable audit trail.

### Story 1.9: Account Deletion, PDPL Compliance & 14-Day Cooling-Off Period
As a user,
I want to request account deletion in compliance with Saudi PDPL regulations,
So that my personal data can be deleted or anonymized according to statutory retention rules.

**Acceptance Criteria:**
**Given** an authenticated user requesting account deletion
**When** confirming request with password and step-up OTP
**Then** deletion is blocked if the user is party to any active deal, open dispute, or active owner listing request
**And** accounts with zero transaction history enter `DeletionPending` status for a 14-day cooling-off period, during which logging in cancels deletion
**And** accounts with completed transaction history are deactivated, concealed from public search, and financial records retained per statutory Saudi commercial and tax retention mandates.

### Story 1.10: User Preferences & Appearance Settings
As an authenticated user,
I want to configure UI language, theme mode, and notification channels in my profile settings,
So that the platform interface conforms to my personal visual and communication preferences.

**Acceptance Criteria:**
**Given** a user in workspace preferences
**When** toggling language between Arabic (RTL) and English (LTR)
**Then** the interface updates layout direction and typography immediately
**And** toggling between Light and Dark mode updates theme CSS tokens across all components
**And** users can toggle channel delivery preferences for SMS and Email, while critical deal, payment, and security alerts remain permanently enabled.

---

## Epic 2: Property Listings, Moderation & Geography

Enable property marketers and owners to publish sale listings bound to validated geographic master data (City, District with composite foreign key validation), upload property media and private title/authorization documents, and enable administrators to review, moderate under 15-minute task claim locks, suggest price revisions, and track engagement impressions.

### Story 2.1: Geographic Master Data Administration & Cascading Dropdown
As an administrator with Geo.Manage permission,
I want to manage Saudi cities and districts with active status toggles, and provide a cascading dropdown for forms,
So that users select valid, pre-approved geographic locations and free-text geographic input is strictly rejected.

**Acceptance Criteria:**
**Given** an admin in the geographic management portal
**When** creating or toggling the `isActive` flag on a City or District
**Then** changes persist in the database and deactivated districts cannot be selected for new listings or demands
**And** in the frontend, a reusable cascading `CityDistrictSelector` component populates districts dynamically based on selected city
**And** entering arbitrary free-text city or district names is rejected on both client and backend API validation.

### Story 2.2: Listing Creation & Document Visibility Classification
As a marketer or property owner,
I want to create a real estate sale listing with validated location, pricing, media, and classified documents,
So that buyers can inspect verified property information while sensitive legal documents remain protected.

**Acceptance Criteria:**
**Given** an authorized marketer or owner on the listing creation wizard
**When** submitting property title, type (Apartment, Villa, Land, Building, Office), coordinates, valid `cityId` and `districtId`, single ask price (1 to 50M SAR), land area m², bedrooms (bathrooms omitted), min 3 max 20 photos (up to 10 MB each), and bound payout IBAN
**Then** marketers must upload an Owner Authorization Document marked strictly as `AdminOnly`
**And** documents are classified as `Public` or `AdminOnly`; title deeds and authorization documents are never exposed to public or buyer API endpoints
**And** listing is saved in `PendingAdminReview` status.

### Story 2.3: Reusable Property Card & 16:9 Media Carousel
As a visitor or buyer,
I want to browse properties displayed in consistent, visually rich property cards with a 16:9 media carousel,
So that I can evaluate key specs, pricing, and visual imagery at a glance.

**Acceptance Criteria:**
**Given** a list or grid of active properties
**When** the `PropertyCard` component renders
**Then** it features a 16:9 photo carousel with counter pill (`1/12`), touch/click swipe controls, and Fal-verified badge
**And** it clearly displays ask price in SAR, property type, location tag (District, City), and a specs strip showing bedrooms and area in m²
**And** bathrooms are strictly omitted from the card display per data model specifications.

### Story 2.4: Listing Moderation Queue with 15-Minute Task Claim Locking
As an administrator reviewing submitted listings,
I want an exclusive 15-minute task claim lock on listing moderation reviews with heartbeat extension,
So that multiple operators do not perform conflicting review decisions on the same listing simultaneously.

**Acceptance Criteria:**
**Given** an admin viewing the listing moderation queue
**When** clicking review on a pending listing
**Then** an explicit `POST /api/v1/admin/listings/:id/claim` acquires a 15-minute lease setting `lockedByAdminId`, `lockedAt`, and `lockExpiresAt`
**And** the lock automatically renews via a 5-minute client heartbeat while the review screen remains active
**And** other admins viewing the listing see a prominent read-only banner with the current lock holder's name and remaining countdown timer
**And** committing an approval (`Active`) or rejection with notes releases the claim lock immediately.

### Story 2.5: Admin Price Suggestion & Seller Response
As an administrative moderator inspecting an active or pending listing,
I want to submit a formal price adjustment suggestion with market rationale without modifying the price directly,
So that sellers receive expert valuation feedback while retaining ultimate pricing autonomy.

**Acceptance Criteria:**
**Given** an admin inspecting a listing with unrealistic pricing
**When** submitting a suggested ask price with explanatory reasoning
**Then** the admin cannot directly alter the listing ask price
**And** the seller receives a structured notification with the proposed price and rationale
**And** the seller can accept (which automatically updates the listing ask price) or decline (which preserves the original submitted price).

### Story 2.6: Listing Archiving, Suspension & Compliance Blocking
As a seller or administrator,
I want to archive or suspend property listings according to deal and compliance constraints,
So that inactive or non-compliant properties are removed from public search while active deals remain protected.

**Acceptance Criteria:**
**Given** an active listing
**When** the seller chooses to archive the listing
**Then** the archive action is permitted only if the listing has zero active deals or unexpired approved offers
**And** an administrator with appropriate permissions can immediately suspend or block a listing for compliance violations
**And** blocking a listing hides it from search results and cancels all non-deal pending offers.

### Story 2.7: Listing View & Engagement Analytics
As a seller or platform administrator,
I want to track property view impressions, detail page visits, and favorite bookmarks,
So that I can analyze buyer interest and engagement metrics over time.

**Acceptance Criteria:**
**Given** a visitor or buyer viewing listing cards or detail pages
**When** page impressions occur
**Then** engagement events (card impression, page view, favorite toggle) are logged asynchronously to the database
**And** sellers can view aggregate view counts and bookmark totals on their listing management dashboard
**And** administrators can view global listing engagement trends in the back-office dashboard.

---

## Epic 3: Buyer Search, Discovery & Demands

Enable property buyers to search and filter active properties by geographic, physical, and financial criteria, browse listings on an interactive clustered map, inspect comprehensive property details with dynamic platform commission calculation (2.5%) while keeping seller contact shielded, bookmark favorite properties, and post/manage structured property demands with automated seller matching.

### Story 3.1: Multi-Criteria Filter Search & Pagination
As a property buyer,
I want to search and filter sale listings by location, property type, price range, area, and bedrooms,
So that I can quickly discover properties that match my specific purchase criteria.

**Acceptance Criteria:**
**Given** a buyer on the search and discovery screen
**When** applying search filters (city, district, property type, price min/max, area min/max, bedrooms)
**Then** search results return only listings with status `Active` or `Reserved`
**And** results are paginated (20–100 items per page) and sortable by newest and price (ascending/descending)
**And** search endpoint p95 latency is $< 800$ ms under 50,000 active listings in the database.

### Story 3.2: Interactive Clustered Map & Split-View Layout
As a property buyer,
I want to view search results on an interactive map with marker clustering and split-view layout,
So that I can explore listings geographically and inspect card previews interactively.

**Acceptance Criteria:**
**Given** a desktop or mobile device viewing property search
**When** desktop mode renders
**Then** a 50/50 split layout displays the interactive map on the left and the scrollable listing grid on the right
**And** mobile mode provides a floating pill toggle between Map and List view
**And** markers cluster dynamically at zoom levels below 12 and are color-coded by property type (Apartment=Blue, Villa=Green, Land=Orange, Building=Purple, Office=Red)
**And** clicking a map pin pans to location and displays an interactive property preview card.

### Story 3.3: Listing Detail Screen & Dynamic Commission Calculator
As a buyer inspecting a property,
I want to view the full property details, photo gallery, specs, and a dynamic breakdown of platform commission,
So that I understand the complete financial commitment while seller direct contact remains shielded.

**Acceptance Criteria:**
**Given** a buyer navigating to `/listings/:id`
**When** the listing detail screen renders
**Then** it displays high-resolution media gallery, property specifications, seller broker badge and rating
**And** a dynamic fee calculator widget displays Ask Price, Estimated Platform Commission (2.5%), and Estimated Total
**And** a prominent institutional callout confirms direct seller phone and email remain strictly shielded until deal completion
**And** listings with status `Reserved` allow submission of Backup Offers only.

### Story 3.4: Similar Listings Engine
As a buyer viewing a listing,
I want to see a carousel of similar active properties matching the current property's attributes,
So that I can discover relevant alternative purchasing opportunities.

**Acceptance Criteria:**
**Given** an active listing detail page
**When** the similar properties section loads
**Then** it queries and displays 4 to 6 active properties matching the same property type, city/district, and price within $\pm 20\%$
**And** clicking any similar property card navigates directly to that listing detail view.

### Story 3.5: Buyer Favorites Collection
As an authenticated buyer,
I want to save favorite properties to a dedicated bookmarks collection,
So that I can track properties of interest and monitor status changes over time.

**Acceptance Criteria:**
**Given** an authenticated buyer
**When** clicking the favorite bookmark icon on any property card or detail page
**Then** the listing is added to the user's favorites list (up to a maximum of 100 listings)
**And** navigating to `/app/buyer/favorites` displays all saved properties
**And** status badges update dynamically if a saved property transitions to `Reserved`, `Sold`, or `Archived`.

### Story 3.6: Buyer Demand Submission & Lifecycle Management
As a buyer looking for specific real estate,
I want to submit a structured property demand with budget and location criteria and manage its lifecycle,
So that qualified sellers can pitch matching inventory to me directly.

**Acceptance Criteria:**
**Given** an authenticated buyer
**When** creating a demand with budget in SAR, structured `cityId` and optional `districtId`, property type, area, and specs
**Then** the demand transitions immediately to `Active` status with a 30-day expiration window
**And** an hourly worker job automatically marks demands older than 30 days as `Expired`
**And** buyers can view their active demands and cancel an open demand with a structured reason, which automatically cancels unselected proposals.

### Story 3.7: Automated Demand Matching & Proposal Review Pipeline
As a marketer with matching inventory,
I want to be automatically notified of matching buyer demands and submit binding proposals,
So that I can connect my listings with verified buyers through administrative mediation.

**Acceptance Criteria:**
**Given** a newly published or active buyer demand
**When** the automated matching engine evaluates active listings
**Then** providers with listings matching property type, city, ask price $\le$ demand budget, and area within $\pm 20\%$ receive instant alerts
**And** a matched provider can submit a binding proposed price and active listing (`PendingAdminReview`)
**And** upon administrative review and approval, the proposal becomes visible to the buyer as `ApprovedForBuyer`
**And** the buyer can select a proposal, transitioning it to `SelectedPendingFinalAdminApproval` for deal binding.

---

## Epic 4: Mediated Offers & Price Negotiation

Enable buyers to submit legally binding purchase offers and backup offers with price guardrails, exchange mediated counter-offers with sellers across up to 5 negotiation rounds, and submit listing inquiries protected by automated contact detail redaction and admin mediation.

### Story 4.1: Offer Submission & Price Guardrail Validation
As an authenticated buyer,
I want to submit a formal purchase offer or backup offer on a property with automated price validation,
So that my purchase proposal is recorded with binding legal parameters and structured safeguards.

**Acceptance Criteria:**
**Given** an authenticated buyer viewing an active or reserved listing
**When** submitting an offer price between 1 and 50,000,000 SAR
**Then** if the offered price is $< 50\%$ of the listing ask price, the UI requires explicit low-price confirmation before submission
**And** submitting an offer on a `Reserved` listing automatically flags the offer as `IsBackup = true`
**And** each buyer is limited to at most 1 active offer per listing at any time
**And** the submitted offer transitions to `PendingAdminReview`.

### Story 4.2: Mediated Counter-Offer Rounds & Seller Responses
As a seller receiving a purchase offer,
I want to accept, reject, or submit a counter-offer through administrative mediation,
So that negotiation proceeds constructively with administrative oversight up to a 5-round limit.

**Acceptance Criteria:**
**Given** an approved offer routed to the seller
**When** the seller responds
**Then** the seller can accept the offer, reject with a structured reason, or submit a counter-offer
**And** counter-offers advance the negotiation round counter (maximum 5 rounds allowed per offer thread)
**And** negotiation history renders as a vertical chronological timeline component with sticky mobile action buttons
**And** offers unanswered after 7 days expire automatically via background worker sweep
**And** mutual agreement transitions the offer to `SelectedPendingFinalAdminApproval`.

### Story 4.3: Backup Offer Queue Pipeline
As a buyer submitting a backup offer on a reserved property,
I want my backup offer held in an active pipeline,
So that if the primary transaction cancels or fails, my offer is prioritized for activation.

**Acceptance Criteria:**
**Given** an approved backup offer on a `Reserved` listing
**When** the primary deal is cancelled by buyer, cancelled by timeout, or rejected
**Then** the oldest approved backup offer in the queue is surfaced to the administrator for immediate activation
**And** when the primary deal completes successfully, all remaining backup offers are automatically closed with notification to buyers.

### Story 4.4: Mediated Listing Inquiries & Automated Sensitive Contact Masking
As a buyer inquiring about a property,
I want to send questions to the seller through a mediated inquiry thread with automatic contact redaction,
So that my inquiries are answered while off-platform deal circumvention and personal contact leakage are prevented.

**Acceptance Criteria:**
**Given** a buyer submitting an inquiry message with up to 5 attachments
**When** the message text contains Saudi phone numbers (`05XXXXXXXX`), email addresses, or external usernames
**Then** the system automatically detects and masks the contact details with asterisks on both client and server validation
**And** the inquiry routes to the Admin Conversation Queue under a 15-minute claim lock
**And** direct unmediated chat between buyer and seller is strictly blocked.

---

## Epic 5: Deals, Dual Wire Transfers & Settlement

Enable approved offers to bind into an atomic Deal with frozen financial snapshots, enforce a strict 48-hour payment deadline via ClockService, guide buyers through dual wire transfer receipt uploads (Commission to platform, Price to seller), empower admins to audit proofs under 15-minute claim locks and a 12-hour grace period SLA, atomically complete deals (releasing seller contact details, recording VAT invoice records, unlocking 1-5 star ratings), and manage disputes and pre-payment cancellations.

### Story 5.1: Deal Creation, State Machine Binding & Financial Snapshot Freezing
As an authorized administrator (Deals.FinalApprove),
I want to approve an agreed offer and bind it into an atomic Deal with frozen financial terms and a 48-hour deadline,
So that deal parameters remain immutable regardless of any future platform settings changes.

**Acceptance Criteria:**
**Given** an offer in `SelectedPendingFinalAdminApproval`
**When** an administrator with `Deals.FinalApprove` permission approves the deal
**Then** an atomic database transaction executes: creates `Deal` with `status: AwaitingPaymentProof`, sets `Listing = Reserved`, and enforces a partial unique index guaranteeing at most 1 active deal per listing
**And** the deal record freezes: `FinalDealPrice`, `CommissionRateSnapshot` (2.5%), `FixedCommissionSnapshot` (0 SAR), `FinalCommission`, `FinalTotal`, and seller payout account details
**And** `PaymentDeadline` is computed and stored using `ClockService.now() + 48 hours`.

### Story 5.2: Dual Wire Transfer Interface & 48-Hour Countdown Banner
As a buyer with an active deal,
I want a dedicated deal payment screen with a 48-hour countdown timer, grace period notice, and dual bank transfer instructions,
So that I can transfer funds to the platform and seller accurately and upload receipts before the deadline.

**Acceptance Criteria:**
**Given** a buyer on `/app/buyer/deals/:id`
**When** the deal screen renders
**Then** a prominent gold accent banner displays a live countdown timer (`HH:MM:SS`), progress bar, and administrative notice that uploading proofs pauses auto-cancellation
**And** Card 1 displays Platform IBAN, exact commission amount, generated reference code (`ELM-{dealId}-C`), and receipt upload dropzone
**And** Card 2 displays Seller verified name, verified Saudi IBAN, property price amount, and receipt upload dropzone
**And** buyers can upload PDF, JPEG, or PNG receipts up to 10 MB and re-upload prior to review completion.

### Story 5.3: Administrative Proof Review, Task Claim Locking & Grace Period Handling
As an administrator auditing submitted payment proofs,
I want to review commission and property price transfer receipts independently under a 15-minute task claim lease,
So that verification is audited thoroughly with a 12-hour SLA grace period.

**Acceptance Criteria:**
**Given** a deal with uploaded payment proofs in the Admin Payment Queue
**When** an admin clicks to review
**Then** a 15-minute claim lease is locked on each payment entity (`lockedByAdminId`, `lockExpiresAt`)
**And** the admin audits Payment 1 and Payment 2 independently, selecting `Confirmed` or `Rejected` with mandatory rejection notes
**And** on-time upload pauses timeout cancellation, providing a 12-hour review grace period SLA without auto-cancel
**And** inspecting admins see a read-only inspection banner with lock holder details.

### Story 5.4: Atomic Deal Completion & Contact Release
As a buyer and seller in a deal where both payment proofs are confirmed,
I want the deal to complete atomically, releasing seller contact details and capturing invoice data,
So that the property sale is finalized securely and statutory tax records are recorded.

**Acceptance Criteria:**
**Given** a Deal where both Payment 1 and Payment 2 are marked `Confirmed` before the deadline
**When** the completion transaction executes
**Then** a single Prisma interactive transaction updates: `Deal = Completed`, `Listing = Sold`, Owner Contract `Completed`, and backup offers `Closed`
**And** an immutable `InvoiceRecord` is atomically generated capturing counterparty names, national/CR IDs, subtotal, and 15% VAT
**And** the buyer interface unlocks and displays direct seller phone number and email address
**And** both buyer and seller are granted permission to submit one immutable 1–5 star rating (FR-54).

### Story 5.5: Automated Payment Timeout Worker Job
As the system background worker,
I want a recurring 60-second cron job evaluating deals past their payment deadline,
So that expired deals are cancelled automatically when buyers fail to provide transfer proofs on time.

**Acceptance Criteria:**
**Given** the dedicated `apps/worker` process
**When** the `pg-boss` payment timeout cron runs every 60 seconds
**Then** it queries non-terminal deals past `PaymentDeadline` using `ClockService.now()`
**And** if uncompleted, not disputed, not in review, and past any active grace period: it atomically transitions `Deal = CancelledByTimeout`, payments to `Expired`, reverts `Listing = Active`, and triggers notification alerts.

### Story 5.6: Pre-Payment Cancellations & Dispute Adjudication
As a transaction participant,
I want options to cancel before payment proof or file a formal dispute after proof submission,
So that deal exceptions are handled transparently with administrative resolution.

**Acceptance Criteria:**
**Given** an active deal in `AwaitingPaymentProof`
**When** a buyer cancels before any proof is uploaded
**Then** the deal transitions to `CancelledByBuyer` and the listing reverts to `Active`
**And** a seller requesting cancellation before payment proof requires administrative review before transitioning to `CancelledBySeller`
**And** after at least one payment proof is uploaded, either party can file a formal Dispute, transitioning `Deal = Disputed`, which immediately freezes automated timeouts and routes to Super Admin (`Deals.DisputeResolve`).

---

## Epic 6: Marketer Workspace & Fal Compliance

Enable licensed real estate marketers to submit Fal license and Commercial Registration credentials for administrative review under task claim locking, track licensing status in a dedicated dashboard, undergo automated daily background expiry checks and license renewal workflows, and maintain a verified public broker profile with moderated reviews.

### Story 6.1: Fal License Onboarding & Administrative Verification
As a licensed real estate broker or marketer,
I want to submit my Fal license certificate, number, expiry date, commercial name, and CR for admin review,
So that I can be authorized to publish and manage real estate listings on the platform.

**Acceptance Criteria:**
**Given** a registered user applying for the Marketer role
**When** submitting Fal license certificate, license number, future expiration date, commercial name, 10-digit CR, and supporting documents
**Then** dates in the past are rejected immediately by client and server validation
**And** the profile transitions to `UnderReview` and routes to the Admin Licensing Queue
**And** admins review the application under a 15-minute claim lock, approving or rejecting with mandatory feedback.

### Story 6.2: Automated Daily Fal Expiry Enforcement Worker Job
As a platform compliance officer,
I want an automated daily background worker job verifying Fal license expirations,
So that expired brokers are restricted and non-compliant listings are suspended automatically.

**Acceptance Criteria:**
**Given** the worker process running daily background jobs
**When** evaluating Fal profile expiration dates
**Then** warning notifications are dispatched to marketers at 30, 7, and 1 days prior to license expiration
**And** on the exact date of expiration, the profile transitions to `FalProfile = ComplianceRestricted`
**And** the marketer's active listings move to `UnderComplianceReview` while in-flight deals continue uninterrupted.

### Story 6.3: Fal License Renewal Workflow
As a marketer with an expiring or restricted Fal license,
I want to upload a renewed Fal certificate and extended expiration date for expedited review,
So that my compliance standing is restored and my listings are reactivated.

**Acceptance Criteria:**
**Given** a marketer with a restricted or expiring Fal license
**When** uploading a renewed Fal certificate and extended future expiration date
**Then** the application routes to the Admin Licensing Queue under status `RenewalUnderReview`
**And** upon administrative approval, the profile returns to active standing and eligible listings held in `UnderComplianceReview` are automatically reinstated to `Active`.

### Story 6.4: Marketer Unified Operational Dashboard
As a verified marketer,
I want a unified operational workspace showing active inventory, inquiries, deal stages, and commission forecasts,
So that I can manage my brokerage business efficiently in one centralized dashboard.

**Acceptance Criteria:**
**Given** an authenticated marketer at `/app/marketer`
**When** the dashboard renders
**Then** it displays active listing inventory counts, pending moderation notices, incoming buyer inquiries, deal pipeline stages, and Fal license status
**And** provides quick-action shortcuts for creating new listings and reviewing active negotiation threads.

### Story 6.5: Public Broker Profile & Moderated Reviews
As a buyer or market participant,
I want to view a marketer's verified public profile with average ratings and moderated reviews,
So that I can assess their track record and reputation before submitting purchase offers.

**Acceptance Criteria:**
**Given** any visitor opening a marketer public profile (`/brokers/:id`)
**When** the page renders
**Then** it displays commercial name, verified Fal badge, average star rating, completed deal count, active listings, and public deal reviews
**And** marketer phone and email remain concealed
**And** reviews hidden by administrators with `Reviews.Moderate` are excluded from the public display and average calculation.

---

## Epic 7: Owner Contracts & Electronic Signature

Enable direct property owners to submit listing requests, review standardized electronic contracts dispatched by administrators (FR-69), execute legally binding signatures via an interactive canvas pad stamped with 6-digit OTP verification, submit wire transfer proof for the non-refundable SAR 1,000 listing fee, and have listings automatically published upon fee confirmation. Empower administrators to manage standardized legal contract templates (FR-61).

### Story 7.1: Owner Direct Listing Request & Admin Contract Dispatch
As a direct property owner,
I want to submit a listing request and receive an official electronic contract from platform administration,
So that I can formalize terms to sell my property directly on the marketplace.

**Acceptance Criteria:**
**Given** an owner submitting property details in `/app/owner`
**When** the request enters the Admin Owner Requests Queue
**Then** an admin with `Contracts:Manage` claims the request under a 15-minute lock, selects an active contract template (FR-61), configures the listing contract fee (default SAR 1,000), and dispatches the contract
**And** the request status updates to `ApprovedPendingSignature` and notifies the owner.

### Story 7.2: Electronic Contract Review & Canvas Signature Pad with OTP Stamping
As a property owner who received an approved listing contract,
I want to review the legal agreement, sign using a canvas signature pad, and authenticate with a 6-digit OTP,
So that my electronic signature is legally binding and timestamped under Saudi electronic transaction regulations.

**Acceptance Criteria:**
**Given** an owner viewing a dispatched contract at `/app/owner/contracts/:id`
**When** the owner reviews the standardized terms and signs on the touch/mouse canvas signature pad
**Then** submitting the signature prompts for a 6-digit OTP dispatched to the owner's verified mobile number
**And** upon valid OTP entry, the contract record permanently captures the signature vector/image, OTP verification timestamp, IP address, and browser user agent
**And** the contract transitions to `SignedPendingFee` with a 7-day payment window.

### Story 7.3: Contract Fee Payment Proof Verification & Auto-Publishing
As a property owner who signed a listing contract,
I want to upload bank transfer proof for the listing contract fee and have my property automatically published upon approval,
So that my property goes live without further manual delays.

**Acceptance Criteria:**
**Given** a signed contract in `SignedPendingFee`
**When** the owner uploads a bank wire transfer receipt for the SAR 1,000 fee
**Then** the submission routes to the Admin Fee Queue under a 15-minute claim lock
**And** upon administrative confirmation of payment receipt, the contract transitions to `Active`
**And** the associated property listing is automatically published to `Active` status on the public marketplace
**And** the contract fee is permanently recorded as non-refundable.

---

## Epic 8: Admin Back-Office Operations & Operational Queues

Provide administrative staff with an isolated back-office portal (/admin) enforcing granular dynamic RBAC, unified 15-minute task claim locking across all 8 operational entities with Super Admin force-unlock capabilities, public review moderation, dispute resolution, violation reporting and support tickets, dynamic commission/system configuration, immutable domain audit logging, multi-channel notification dispatches, fraud logging, financial reporting with CSV export, CMS content management, internal staff notes, an executive operations dashboard, and secure administrative password resets (FR-70).

### Story 8.1: Isolated Admin Authentication Realm & Password Reset
As a platform administrator,
I want an isolated login portal with secure sessions and administrative password reset capabilities,
So that administrative operations are segregated from regular user traffic and protected against credential theft.

**Acceptance Criteria:**
**Given** staff accessing `/admin`
**When** authenticating with administrative credentials
**Then** sessions are managed via separate `admin_users` database tables and dedicated secure session cookies
**And** 5 failed attempts trigger an automatic 15-minute lockout, and sessions expire after 8 hours of inactivity
**And** Super Administrators with `Rbac.Manage` can dispatch single-use, time-limited reset links (15-minute expiry) via email transport for administrator accounts (FR-70).

### Story 8.2: Granular Dynamic RBAC & Super Admin User Management
As a Super Administrator,
I want to create staff accounts and assign granular permissions,
So that employees only have access to their designated operational areas.

**Acceptance Criteria:**
**Given** a Super Admin in staff management
**When** configuring staff permissions
**Then** permissions can be assigned granularly (e.g., `Reviews.Moderate`, `Geo.Manage`, `Tasks.ForceUnlock`, `Users.PhoneChange`, `Deals.FinalApprove`, `Deals.DisputeResolve`, `Contracts.Manage`, `Security.Manage`, `Finance.Audit`, `CMS.Manage`)
**And** API endpoints enforce `@RequirePermissions('Area.Action')` strictly on the server
**And** staff accounts can be disabled or soft-deleted, with hard deletion blocked if transaction history exists.

### Story 8.3: Unified Operational Queue Task Claim & Heartbeat Locking Service
As an administrator working in operational queues,
I want an exclusive 15-minute claim lease with 5-minute heartbeat renewal across all 8 operational queues,
So that conflicting decisions and race conditions between staff members are eliminated.

**Acceptance Criteria:**
**Given** an admin opening any entity in the 8 operational queues (`Listing`, `FalProfile`, `OwnerListingRequest`, `Payment`, `ContractFeePayment`, `Conversation`, `Dispute`, `Offer`)
**When** the admin claims the task via `POST /api/v1/admin/<queue>/<id>/claim`
**Then** an atomic conditional update sets `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` (+15 minutes)
**And** a 5-minute client heartbeat automatically extends the lease while the reviewer remains active on the screen
**And** inspecting staff see a prominent amber banner showing lock holder name and remaining countdown timer
**And** Super Admins with `Tasks.ForceUnlock` can force-release any claim with mandatory justification logged to the audit log
**And** optimistic concurrency version checks (`If-Match`) are maintained, returning HTTP 409 Conflict on stale submissions.

### Story 8.4: Review Moderation Workspace
As an administrator with Reviews.Moderate permission,
I want to review reported or submitted broker ratings and hide abusive or defamatory content,
So that platform reputation data remains professional and accurate.

**Acceptance Criteria:**
**Given** an admin in the review moderation queue
**When** inspecting submitted ratings and text comments
**Then** the admin can toggle `isHidden` with mandatory justification reason
**And** hidden reviews are excluded from public average ratings and count totals while physical records are preserved
**And** all moderation actions write immutable records to the audit trail.

### Story 8.5: Violation Reporting & Support Ticketing System
As a user or administrator,
I want a violation reporting endpoint and support ticketing system with SLA monitoring,
So that complaints, fraud reports, and support requests are resolved methodically.

**Acceptance Criteria:**
**Given** a user submitting a violation report on a listing or broker
**When** submitting category, description, and up to 5 attachments
**Then** the report routes to the Admin Reports Queue (`Reports.Handle`)
**And** support staff manage tickets through `Open`, `InProgress`, `Resolved`, and `Closed` statuses backed by SLA tracking.

### Story 8.6: Dynamic Platform Settings & Commission Configuration
As an authorized administrator,
I want to configure global platform parameters including commission rates, fees, and deadlines,
So that platform business rules can adapt without code deployments.

**Acceptance Criteria:**
**Given** an admin with system configuration permissions
**When** updating parameters (commission rate 2.5%, owner contract fee SAR 1,000, payment window 48h, review SLAs)
**Then** updated parameters take immediate effect on all new transactions
**And** active in-flight deals remain bound to their frozen snapshot values
**And** every parameter change records an immutable entry in the audit log.

### Story 8.7: Immutable Domain Audit Logging & Inspection
As a compliance and security officer,
I want an append-only audit log tracking every sensitive state transition and administrative action,
So that the platform maintains an unalterable forensic record for regulatory compliance.

**Acceptance Criteria:**
**Given** any sensitive operation (payout update, admin approval, price override, claim force-unlock, contact disclosure, status change)
**When** the operation executes
**Then** an insert-only `AuditLog` row is atomically recorded capturing actor ID, role, timestamp, IP address, action name, entity ID, before/after JSON snapshots, and admin reason
**And** compliance officers can filter and inspect audit entries in a dedicated view without edit or delete capabilities.

### Story 8.8: Unified In-App Notification Feed & Transactional Emails
As a platform user,
I want to receive real-time in-app notifications and transactional emails for critical deal milestones,
So that I stay informed of required actions and deadline warnings.

**Acceptance Criteria:**
**Given** transaction events occurring on the platform
**When** deal milestones, offer counter-proposals, or license alerts trigger
**Then** in-app notifications are stored in the database with unread counts and deep links, retained for 90 days
**And** transactional emails are dispatched for deal creation, payment deadline warnings (12h, 2h remaining), and deal completion confirmations
**And** critical security and payment notices cannot be disabled by user preferences.

### Story 8.9: Fraud Management Log, Financial Reports & CMS
As an executive or operational manager,
I want access to the fraud management log, financial indicators with export, CMS management, internal staff notes, and executive dashboard,
So that operations, compliance, and platform content can be overseen comprehensively.

**Acceptance Criteria:**
**Given** an authorized administrative user
**When** accessing back-office management sections
**Then** security staff can log suspicious activity and apply marketer suspensions in the fraud log (`Security:Manage`)
**And** financial auditors can view gross transaction volumes, commission totals, and export CSV/Excel accounting reports (`Finance:Audit`)
**And** CMS managers can update static policy pages, FAQ articles, and banner announcements (`CMS:Manage`)
**And** staff can attach internal private notes (`AdminOnly`) to listings, deals, and marketer profiles
**And** the executive dashboard displays real-time 48-hour deal counts, pending queue volumes, SLA warnings, and financial throughput.
