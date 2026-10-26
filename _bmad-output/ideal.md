# Software Requirements Specification (SRS)

**Real Estate Marketplace Platform — Kingdom of Saudi Arabia**

| Item | Value |
|---|---|
| Version | 2.2 |
| Date | October 2026 |
| Status | Draft for implementation — primary input for BMAD (PRD, architecture, epics and stories) |
| Product | Responsive web application (Next.js) with an admin back-office, served by a NestJS REST API |
| Stack | Frontend: Next.js (App Router, React, TypeScript). Backend: NestJS (Node.js, TypeScript). ORM: Prisma. Database: PostgreSQL |
| Supersedes | v1.1 (Flutter + Laravel), v2.0 (web adaptation), v2.1 (Next.js full-stack) |

## Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | Aug 2026 | Initial release (mobile app + Laravel admin) |
| 1.1 | Aug 2026 | Review updates |
| 2.0 | Oct 2026 | Adapted to a full-stack web application |
| 2.1 | Oct 2026 | Payment model corrected, validation rules restored, technical requirements added, state machines, permission and notification catalogs, epic plan, assumptions and open questions |
| 2.2 | Oct 2026 | Architecture changed to Next.js frontend plus NestJS backend API with Prisma and PostgreSQL; API conventions, repository layout and BMAD handoff added; Epic E0 (platform foundation) added; sections 6 to 14 completed |

## Summary of changes in v2.2

1. **Architecture split.** Next.js is now the presentation layer only. All business logic, authorization, jobs and database access move to a NestJS API (sections 2.1, 3.1, 3.2).
2. **No Flutter, no Laravel.** Mobile apps remain out of scope; the responsive web app replaces them.
3. **Server Actions and Route Handlers removed.** Mutations go through documented REST endpoints (section 3.10).
4. **Background jobs** run in NestJS with a Postgres-backed queue (section 3.4).
5. **Sessions and CSRF** redesigned for a web client calling a separate API (section 3.7).
6. **New sections:** 3.10 API conventions, 3.11 repository and environments, 3.12 BMAD handoff notes.
7. **New Epic E0** for cross-cutting platform foundation (section 11).
8. Sections 6 to 14 (state machines, permissions, notifications, NFRs, data model, epics, risks, assumptions, glossary) completed.

## Summary of changes in v2.1
1. Money flow corrected. The property price is transferred directly from the Buyer to the Seller (Owner or Marketer). Only the commission goes to the platform. A Deal therefore has two payments, each with its own proof (BR-04, UC-28, UC-71).
2. Seller payout account is now a requirement, because the Buyer must know where to transfer the price (BR-05).
3. Validation rules and limits restored from v1.1 (field lengths, file limits, price bounds, rate limits).
4. State transition tables added for every stateful entity (section 6).
5. OTP provider abstraction. A static development code is used first; an external SMS provider is plugged in later (UC-01, section 3.6).
6. Technical requirements added for background jobs, file storage, sessions, search, maps and real-time updates (section 3).
7. Admin permission catalog and notification catalog added (sections 7 and 8).
8. Epic plan with priorities added (section 11). Owner contracts are moved into the seller-side epic because Owner listings cannot be published without them.
9. Risk register and open questions added (sections 12 and 13), including marketer fraud exposure and the payment-timeout edge case.
10. Mobile-only items removed (push notifications, bottom navigation, native app stores).

## Tags used in this document
- [DECIDED] confirmed by the product owner.
- [PROPOSED] follows logically from a decision; needs client confirmation.
- [ASSUMPTION] a working default so development can start; listed in section 13.
- [OPEN] unresolved; listed in section 13 with a recommended default.
- Requirement keywords MUST, SHOULD, MAY follow their usual meaning.

# 1. Introduction

## 1.1 Purpose
This document specifies the functional and non-functional requirements of a Saudi Arabian real estate marketplace dedicated exclusively to property sales (buy and sell only). It consists of one responsive web application (Next.js) for end users (Buyers, Marketers, Owners) and an administrative back-office for platform operations, both backed by one NestJS REST API.

## 1.2 Intended audience
Full-stack developers, QA engineers, project managers, UX/UI designers, system architects and the client (Product Owner).

## 1.3 Product vision
A mediated marketplace: every inquiry, offer, negotiation round, message and deal passes through platform administration. Buyers and Sellers never talk directly until a deal is completed. The platform earns a commission from the Buyer and a listing contract fee from the Owner. The platform never holds the property price; all payments are external bank transfers whose proofs are reviewed by administrators.

## 1.4 Scope

### In scope
- Multi-role user accounts (Buyer, Marketer, Owner) on a single account and single phone number.
- Saudi mobile OTP verification with Username and Password credentials.
- Fal license submission, review, resubmission and renewal for Marketers.
- Owner listing contracts: template selection, fee assignment, electronic signature, fee proof review.
- Listing creation, review, editing, archiving and compliance actions.
- Search, filters, interactive map, favorites, similar listings, seller public profiles.
- Buyer Demands with automatic matching and dispatch to qualified Providers.
- Admin-mediated offers, counter-offers, chat, tickets, reports and disputes.
- Deals with a 48-hour payment window, dual payment proofs, automatic timeouts and completion.
- Commission engine with snapshotting, ratings, notifications and audit trail.
- Dynamic RBAC for admin users, system settings, CMS content, reports and exports.

### Out of scope (MVP)
- Native mobile applications.
- Online payment gateways, escrow, wallets and withdrawals (marketer financial view is statistics only).
- Rental operations, auctions, real estate financing.
- Saved searches.
- Buyer-facing tracking screens for reports and support tickets (submit-only in MVP).
- Automated identity verification (existence check of the ID document only).
- Web Push notifications (in-app notifications only in MVP; may be added later).

## 1.5 Definitions
See the glossary in section 14.

# 2. Overall Description

## 2.1 Product perspective
Two deployable applications share one database through the API:

- **Web app (Next.js):** presentation only. It renders the user app and the admin back-office and calls the API. It has no database access and no business logic.
- **API (NestJS):** the single owner of business rules, authorization, background jobs, file access and the PostgreSQL database (through Prisma).

The web app serves two audiences:

- User app (route group for authenticated users): Buyer, Marketer and Owner workspaces, switchable by role.
- Admin back-office (separate route group and separate authentication realm): Support Team and Super Admin.
External systems: SMS/OTP provider (initially a static code), map/tile provider, object storage, transactional email provider, and the banking system (outside the platform, evidenced only by uploaded proofs).

## 2.2 User classes
| Class | Interface | Capabilities |
|---|---|---|
| Buyer | User app | Search and browse, favorites, submit Demands, send offers, negotiate through Admin, upload payment proofs, rate sellers |
| Marketer | User app | Requires an approved, unexpired Fal license. Publishes listings, answers matched Demands, responds to offers, tracks deals. Receives the property price directly from the Buyer |
| Owner | User app | Requests a listing contract, signs electronically, pays contract fee externally, publishes listings, answers Demands and offers. Receives the property price directly from the Buyer |
| Support Team | Admin | Mediates chats, handles tickets and reports, reviews listings and offers according to permissions |
| Super Admin | Admin | All permissions: RBAC, settings, commission, overrides, penalties, audit, financial reports |

A single Account can hold several Role Profiles at once (for example Buyer and Owner). Switching roles never requires a new phone number or registration.

## 2.3 Operating environment
- Evergreen browsers (last two major versions of Chrome, Safari, Edge and Firefox), including mobile Safari and Chrome for Android.
- Mobile-first responsive layout; Arabic (RTL) is the primary language, English (LTR) is secondary.
- All timestamps are stored in UTC and displayed in Asia/Riyadh time. Currency is Saudi Riyal (SAR) only.

## 2.4 Constraints
- Property sales only; no rental flows anywhere in the data model.
- No online payments; evidence of transfer is a file upload.
- Marketers must hold a valid Fal license at all times to publish or respond.
- Direct Buyer–Seller communication is prohibited before deal completion.
- Regulatory points to be confirmed with legal counsel are listed in section 13.

## 2.5 Assumptions and dependencies
See section 13 (assumptions A-xx and open questions OQ-xx).

# 3. System Architecture and Technical Requirements

## 3.1 Technology baseline [DECIDED]

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, React, TypeScript). Server components for public and SEO pages; client components for interactive screens. No Prisma and no secrets in the web app |
| Backend | NestJS (TypeScript, Node.js LTS), modular monolith, REST under `/api/v1`, OpenAPI documentation generated with `@nestjs/swagger` |
| Database | PostgreSQL |
| ORM and migrations | Prisma, owned by the API. Raw SQL migrations for what Prisma cannot express (partial unique indexes, trigram and full-text indexes) |
| Validation | One schema per form and per request, shared by web and API (Zod in a shared package, applied in NestJS through a global validation pipe) [PROPOSED] |
| Background jobs | `@nestjs/schedule` for cron triggers and a Postgres-backed queue (pg-boss) for durable work [PROPOSED; avoids Redis in the MVP] |
| API client | Typed client generated from the OpenAPI document and used by the web app [PROPOSED] |
| Internationalization | Arabic (default, RTL) and English in the web app (message catalogs, locale-aware numbers and dates). The API returns error codes, not translated text |
| Repository | Monorepo with pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` (see 3.11) |

## 3.2 Application structure

- Public area (web): landing page, CMS pages (About, Terms, Privacy), FAQ, login and registration.
- User app (web): `/app/...` with role-scoped workspaces (Buyer, Marketer, Owner) and a role switcher in the account menu.
- Admin app (web): `/admin/...` with its own login screen.
- API: `/api/v1/...` for users and `/api/v1/admin/...` for administrators, with separate authentication realms, cookies and guards.
- Every API endpoint MUST authorize on the server through NestJS guards and policies: authentication, active role profile, ownership of the resource and, for admins, the required permission (`@RequirePermissions('Deals.FinalApprove')`). Next.js middleware and hidden buttons are user-experience only and never a security control.
- Business logic lives in NestJS services. Controllers are thin: validate, authorize, call a service, map the result.

## 3.3 Functional modules

| # | Module | NestJS modules (suggested) | Main use cases |
|---|---|---|---|
| 1 | Identity and Access | AuthModule, AccountsModule, OtpModule, SessionsModule | UC-01 to 03, 07, 09, 10, 92 |
| 2 | Licensing and Contracts | LicensingModule, ContractsModule, TemplatesModule, PayoutModule | UC-04 to 06, 09A, 43, 50 to 55, 62, 67 to 69 |
| 3 | Listings | ListingsModule, MediaModule | UC-34 to 41, 63 to 66 |
| 4 | Discovery | SearchModule, FavoritesModule | UC-11 to 19 |
| 5 | Demands and Matching | DemandsModule, MatchingModule | UC-22 to 24, 44, 45, 58 |
| 6 | Offers and Negotiation | OffersModule | UC-20, 27, 47, 58A, 70A |
| 7 | Deals and Payments | DealsModule, PaymentsModule, CommissionModule | UC-17, 28 to 30, 46, 57A, 70 to 72, 76 |
| 8 | Mediated Communication | ConversationsModule, TicketsModule, ReportsModule, DisputesModule | UC-21, 25, 26, 29C, 48, 70C, 77 to 82 |
| 9 | Notifications | NotificationsModule | UC-08, 84 |
| 10 | Administration | AdminAuthModule, RbacModule, SettingsModule, CmsModule, AnalyticsModule, AuditModule | UC-59 to 61, 73 to 75, 83 to 91A |
| 11 | Platform | FilesModule, JobsModule, HealthModule | section 3.4, 3.5 |

Modules communicate through exported services and domain events (for example `DealCompleted`), never through each other's database tables.

## 3.4 Background jobs [required]
The platform depends on time-based behavior that cannot rely on user requests. Jobs run inside the NestJS codebase, preferably as a separate worker process (same image, different entry point) so that API restarts never skip a run. Cron triggers enqueue work in the Postgres-backed queue. A job runner MUST provide at least:

| Job | Trigger | Effect |
|---|---|---|
| Payment deadline expiry | Every minute | Cancels Deals past PaymentDeadline without both payments Confirmed (UC-29A) |
| Offer expiry | Every 5 minutes | Marks offers past OfferExpiry as Expired |
| Demand expiry | Hourly | Marks Demands past ExpiresAt as Expired and closes related offers |
| License expiry | Daily | Moves Marketer profile to ComplianceRestricted and Active listings to UnderComplianceReview (UC-43) |
| License expiry warnings | Daily | Notifies Marketers 30, 7 and 1 days before expiry [ASSUMPTION] |
| Notification retention | Daily | Deletes notifications older than 90 days |
| Contract/fee reminders | Daily | Reminds Owners with unsigned contracts or unpaid fees [ASSUMPTION] |

Jobs MUST be idempotent, safe to run concurrently, and write audit events when they change business state.

## 3.5 File storage
- S3-compatible private object storage; files are never served from a public path.
- Access through short-lived signed URLs issued only after an authorization check.
- Each file stores visibility (Public or AdminOnly), owner, entity reference, MIME type, size and checksum.
- Allowed types: JPEG, PNG, WebP for images; PDF for documents. Maximum 10 MB per file.
- Identity documents, title deeds, Fal licenses, commercial registers, payment proofs and signed contracts are always AdminOnly (plus the uploading user for their own files).
- Images SHOULD be resized and re-encoded server-side; malware scanning SHOULD be applied before a file becomes accessible.
- Uploads: the browser sends the file to the API (`multipart/form-data`, streamed to storage), or uploads to a pre-signed URL issued by the API and then confirms the upload. Either way the API validates MIME type, size and checksum before the file becomes usable [PROPOSED].
- Downloads: the API authorizes the request and returns a short-lived signed URL; the web app never receives storage credentials.

## 3.6 Integrations
| Integration | Requirement |
|---|---|
| OTP / SMS | Accessed through an OtpProvider interface with swappable implementations. Static provider [DECIDED]: accepts the fixed code 123456 for any phone number, enabled only by configuration. SMS provider: to be selected later. The static provider MUST be impossible to enable in production builds (environment guard plus startup check) |
| Maps | Provider to be selected (Mapbox, Google Maps or OpenStreetMap-based). Needs marker clustering, custom marker colors and Arabic labels |
| Email | Transactional email for admin notifications and optional user email; provider to be selected |
| Object storage | S3-compatible provider; Saudi data residency to be confirmed (OQ-12) |
| Banking | None. Bank transfers are outside the system; the platform stores only uploaded proofs |

## 3.7 Authentication and sessions
- Users: Username + Password. Registration verifies a Saudi mobile number by OTP. A new device or a session after logout or expiry requires OTP again (UC-01A).
- Passwords hashed with argon2id (bcrypt acceptable as fallback). Minimum 8 characters with at least one letter and one digit [ASSUMPTION].
- Sessions are stored in the database by the API and referenced by an HttpOnly, Secure, SameSite=Lax cookie. Sessions are revocable on logout and by admins. Inactive sessions expire after a configurable period (default 30 days sliding for users, 8 hours for admins) [ASSUMPTION].
- The web app and the API MUST share one registrable domain (for example `app.example.sa` and `api.example.sa`, or one domain with a reverse proxy sending `/api` to NestJS) so cookies work without third-party cookie issues [PROPOSED]. Server-rendered pages in Next.js forward the user's cookie to the API.
- Admin users authenticate in a separate realm: separate cookie name, table, guard and route prefix. Five failed attempts lock the account for 15 minutes (UC-59).
- CSRF protection for all state-changing requests (double-submit token or Origin and Fetch-Metadata checks); CORS restricted to an explicit allow-list of web origins.
- Security headers through Helmet; rate limiting with `@nestjs/throttler`, with stricter limits on OTP, login and upload endpoints.

## 3.8 Real-time behavior
MVP uses short polling (15–30 s) for notifications and conversation threads. Server-Sent Events (`@Sse` in NestJS) or WebSocket gateways MAY replace polling later without changing the data model.

## 3.9 Search
PostgreSQL queries with composite indexes on (status, propertyType, city, district, askPrice, area, bedrooms). Text search uses PostgreSQL full-text search with an Arabic-aware configuration or trigram matching. Geographic queries use latitude/longitude with bounding-box filtering (PostGIS MAY be adopted if clustering is done server-side).

## 3.10 API conventions [PROPOSED]

- **Style:** resource-oriented REST, JSON bodies, base path `/api/v1`. State changes are explicit action endpoints (for example `POST /deals/{id}/cancel`, `POST /payments/{id}/confirm`), never a free `PATCH status`, so each transition in section 6 maps to exactly one endpoint and one audit event.
- **Validation:** global validation pipe with whitelist; unknown fields rejected.
- **Errors:** one format `{ code, message, details, requestId }` with a catalog of stable error codes. The web app translates codes into Arabic or English.
- **Pagination and filtering:** page and page-size query parameters (default 20, maximum 100) with total count; filters and sort as query parameters.
- **Money and time:** money as decimal strings (never floating-point numbers); timestamps in ISO 8601 UTC.
- **Idempotency:** `Idempotency-Key` header on proof upload, final approval (UC-70B), payment decisions and completion triggers.
- **Concurrency:** version column with `If-Match` (or a version field in the body) on listings, offers and Deals; conflicting writes return 409.
- **Transactions:** Prisma interactive transactions for UC-70B and UC-29. At most one non-terminal Deal per listing is enforced by a partial unique index created in a raw SQL migration, plus a row lock on the listing during final approval.
- **Audit:** an audit service called inside the same transaction as the business change (BR-19). Audit tables are insert-only.
- **Documentation:** every endpoint appears in the generated OpenAPI document with its required permission or role.
- **Health and observability:** `/health` and `/ready` endpoints, structured logs with request IDs, job-run table visible to admins.

## 3.11 Repository and environments [PROPOSED]

```
/
├─ apps/
│  ├─ web/            Next.js (user app, admin app, public pages)
│  └─ api/            NestJS (modules, Prisma schema, migrations, jobs)
├─ packages/
│  └─ shared/         Zod schemas, enums, constants, generated API client
├─ docs/              SRS, PRD, architecture, epics (BMAD outputs)
└─ docker-compose.yml PostgreSQL, MinIO (S3-compatible), mail catcher for local work
```

Environments: local, staging, production. Configuration through environment variables validated at startup (the API refuses to start with missing or unsafe values, including the static OTP provider in production). CI runs lint, type-check, unit tests, API integration tests against a real PostgreSQL, Prisma migration check and web build.

## 3.12 Handoff notes for BMAD

- Treat Section 11 as the epic list. Epic E0 (platform foundation) comes first and is a prerequisite for every other epic.
- Write each user story as a vertical slice: API endpoint, Prisma change, web screen and tests. Do not create separate "backend" and "frontend" epics.
- Architecture decisions the architect should confirm or change: queue (pg-boss or BullMQ with Redis), shared schema library (Zod or class-validator), one domain versus two, map provider, SMS provider, object storage region (OQ-12), and whether PostGIS is needed.
- Open questions in section 13 that block specific stories: OQ-02 (commission values), OQ-07 (payment review latency), OQ-01 (seller acknowledgment), OQ-04 (backup offer order).
- Every state transition in section 6 and every permission in section 7 SHOULD become an acceptance criterion with at least one positive and one forbidden-case test.

# 4. Business Rules
**BR-01** Single ask price. A listing has exactly one askPrice (SAR, greater than 0, at most MaxPriceSar, default 50,000,000) [ASSUMPTION for the maximum]. Price ranges are not supported.
**BR-02** Commission calculation and snapshot. All money values use fixed-point decimals (two fractional digits), rounded half-up at each step.

- EstimatedCommission = AskPrice × (CurrentCommissionRate / 100) + FixedCommission
- FinalCommission = FinalDealPrice × (CommissionRateSnapshot / 100) + FixedCommissionSnapshot
- FinalTotal = FinalDealPrice + FinalCommission
CommissionRate (percent) and FixedCommission (SAR) are configured only in UC-76. At final admin approval (UC-70B) the system stores CommissionRateSnapshot, FixedCommissionSnapshot, FinalDealPrice, FinalCommission and FinalTotal on the Deal. Later settings changes never affect existing Deals. Before a Deal exists, screens show the estimate computed from current settings. Default values are not specified by the client (OQ-02).
**BR-03** Mandatory mediation. There is no direct Buyer–Seller channel. Inquiries, offers, counter-offers and replies are routed through Admin queues. Sellers see Buyers only as an anonymized public summary (display name, rating). Buyers see Sellers only as a public profile (name or commercial name, rating, active listing count).
**BR-04** Money flow [DECIDED].

- The property price is paid by the Buyer directly to the Seller (the Owner, or the Marketer when the Marketer published the listing).
- The commission is paid by the Buyer to the platform.
- Both are external bank transfers. The platform is never custodian of the price.
- Each Deal has exactly two payment records: Commission and Price. Each requires its own proof upload and its own admin decision.
- The Buyer must see, before paying: Final Deal Price, Final Commission, Final Total, the platform bank account for the commission, and the Seller payout account for the price (BR-05).
**BR-05** Seller payout account [PROPOSED]. Every Marketer and Owner MUST register at least one payout account (account holder name and Saudi IBAN) before submitting a listing for review. A Saudi IBAN has 24 characters: SA + 2 check digits + 22 digits; the system validates the format and the mod-97 check. The seller selects the payout account on each listing (defaulting to the profile account). The account is visible to Admins; it is disclosed to the Buyer of a Deal (account holder name and IBAN only) from the moment the Deal enters AwaitingPaymentProof. Changing a listing's payout account while a Deal is active is not allowed.
**BR-06** Contact disclosure. Phone number and email of the counterpart are disclosed only when Deal.status = Completed. The only earlier exception is the payout account data of BR-05, which is disclosed to the Buyer of the Deal only.
**BR-07** Deal creation. A Deal is created only by UC-70B (final admin approval). A listing has at most one non-terminal Deal. On creation: Listing becomes Reserved, the commission snapshot is taken and PaymentDeadline = createdAt + PaymentWindowHours (default 48) [DECIDED]. Backup Offers are allowed while the listing is Reserved.
**BR-08** Payment window. The Buyer may upload and re-upload proofs for each payment until PaymentDeadline. An admin rejection never extends the deadline. At the deadline, if the Deal is not Completed, the system cancels it with CancelledByTimeout and returns the listing to Active (see OQ-07 for the review-latency edge case).
**BR-09** Completion. A Deal becomes Completed only when both payments are Confirmed by an admin before the deadline. Completion is one atomic transaction that: sets Deal = Completed; sets Listing = Sold; closes all other offers and backup offers on the listing; enables contact disclosure; enables rating (UC-30); and sends notifications. There is no second confirmation step from the Buyer.
**BR-10** Identity document. A Buyer MUST have an identity document uploaded (existence check only) before uploading any payment proof. The document is AdminOnly.
**BR-11** Offers and negotiation.

- Offer price: at least 1 SAR and at most 50,000,000 SAR; if below 50% of the ask price, the Buyer must confirm a low-price warning.
- Notes: up to 500 characters.
- Every offer and counter-offer goes through Admin review and then to the counterpart.
- The number of counter rounds is limited by MaxCounterRounds; offers expire after OfferExpiryDays. Expired or closed offers cannot be acted upon.
- One active offer per Buyer per listing [ASSUMPTION].
- When a counter-offer is accepted by both sides, the agreed price goes to UC-70B. An accepted offer does not create a Deal by itself.
- Backup Offers follow the same flow; their activation order after a failed Deal is OQ-04.
**BR-12** Demands and matching. A Demand contains budget, region (city), property type, required area and optional requirements (up to 1,000 characters). Submitting a Demand is free and requires no admin approval. The Matching Engine sends the Demand immediately to every qualifying Provider (no Top-N). A Provider qualifies when they have at least one Active, non-reserved listing with the same property type and region, askPrice <= budget, and area within tolerance [ASSUMPTION; see OQ-05]. A Provider's proposal is PendingAdminReview; the Buyer sees only proposals approved by an admin (UC-70A). Selecting a proposal creates no Deal; it requests final admin approval (UC-23B, UC-70B).
**BR-13** Listings.

- Purpose is Sale only. Photos: minimum 3, maximum 20. Documents carry a visibility flag; official documents default to AdminOnly.
- Major edits (ask price, location, property type) send an Active listing back to UnderReview. Minor edits (description, extra photos) apply immediately.
- Archive is allowed only for Active listings with no active Deal and not Reserved.
- Delete is allowed only for Draft or Rejected listings.
- Reserved listings remain visible and accept only Backup Offers.
- Sold, Hidden, Blocked and Archived listings are never shown as available.
**BR-14** Marketer licensing. The Marketer role is usable only while the Fal profile is Approved and the license is unexpired. On expiry: new listings and offers are blocked, Active listings move to UnderComplianceReview, existing Deals continue unaffected. Renewal approval restores eligible listings to Active.
**BR-15** Owner contract gating. An Owner listing is published only after: admin approval of the request, contract signed by the Owner, and contract fee payment proof confirmed by an admin (UC-68A). Owner contract fee is an external transfer.
**BR-16** Admin price authority. Admins never change a seller's ask price directly. They may send a price suggestion (UC-64, UC-65); the seller accepts, rejects or counters. Admins may Hide or Block violating listings without seller consent (UC-66).
**BR-17** Ratings. One rating per Completed Deal from the Buyer to the Seller: 1–5 stars, optional comment up to 500 characters, immutable after submission, shown on the Seller public profile.
**BR-18** Account deletion. Admins can Disable or Enable accounts and role profiles. Soft Delete is the default. Hard Delete is allowed only for accounts with no transactional history (listings, offers, deals, contracts, payments, messages, ratings, reports, tickets).
**BR-19** Auditability. All sensitive admin and system actions write an immutable audit event (UC-91A): who, when, action, entity, old value, new value, reason when provided.
**BR-20** Configurability. Operational limits are stored in system settings (UC-83, UC-76) and never hard-coded: commission rate, fixed commission, default owner contract fee, demand expiry days, offer expiry days, max counter rounds, payment window hours, max attachment size, and similar values.
**BR-21** Document visibility. Public documents may be shown to Buyers on the listing page. Identity, title deed, Fal license, commercial register, payment proofs, signed contracts and internal notes are never visible to Buyers or the public.
**BR-22** Localization. Arabic is the default language. Phone numbers are normalized to +9665XXXXXXXX and validated with ^(\+966|0)5[0-9]{8}$.

# 5. Functional Requirements (Use Cases)
Each use case lists actor, epic (section 11), priority, pre-conditions, flow, rules and post-conditions. IDs are kept from v1.1 for traceability; [NEW] marks use cases added in v2.1. Unless stated, every use case requires an authenticated session and server-side authorization.

## Module A — Authentication and Onboarding

### UC-01 Registration and OTP verification — Visitor · E1 · P0
- Flow: (1) Enter full name (3–100 characters) and Saudi mobile number (^(\+966|0)5[0-9]{8}$, normalized to +9665XXXXXXXX). (2) If the number is already registered, redirect to UC-01A with the message that the number is already registered. (3) Request OTP: 6 digits, valid 5 minutes, resend available after 60 seconds, at most 3 OTP requests per hour per phone. (4) Enter OTP. (5) Choose Username (unique, 4–30 characters: letters, digits, underscore) and Password with confirmation. (6) System creates the Account, starts a session and redirects to UC-02.
- Rules: three wrong OTP entries lock verification for 15 minutes; an OTP is single-use; OTP delivery goes through OtpProvider (static code 123456 initially); SMS failure shows a retry message; rate limits apply per phone and per IP.
- Post: Account = Active, MobileVerified = true, session active.

### UC-01A Returning user login — Registered user · E1 · P0
- Flow: (1) Enter phone or Username and Password. (2) The system checks credentials and account status. (3) If there is no valid persistent session (login after logout, session expiry, or a new device), OTP verification is required. (4) The system issues a session, restores all role profiles and either opens the default role or shows the role selector.
- Alternatives: Disabled or SoftDeleted account → login refused with a status message. Five consecutive failures lock login for 15 minutes [ASSUMPTION].
- Post: session active; all role profiles and permissions restored.

### UC-02 Initial role selection — New user · E1 · P0
- Flow: choose Buyer → UC-03; Marketer → UC-04; Owner → UC-07.
- Rules: one account may hold several role profiles; the first choice never blocks adding roles later; the Marketer role becomes active only after Fal approval.

### UC-02A Add a role to an existing account — Registered user · E1 · P0
- Flow: Account → Roles → Add Owner or Marketer. Owner profile is created immediately. Marketer redirects to UC-04. Once requirements are met, the role appears in the role switcher.
- Rule: no new phone number or account is created.

### UC-03 Buyer entrance — Buyer · E1 · P0
- Pre: Buyer role profile Active. Flow: open Buyer home (UC-11). Responsive navigation shows Home, Search, Requests and Favorites (one screen with two tabs), Notifications, Account; it is persistent across Buyer pages. The role switcher is available from the account menu.

### UC-07 Owner entrance — Owner · E1 · P0
- Pre: Owner role profile Active. Flow: open Owner dashboard (UC-49). Navigation: Home, My Listings, Requests, Conversations, Account.

### UC-92 Logout — Any user · E1 · P0
- Flow: confirm; the server session is revoked; the cookie is cleared; users return to UC-01A, admins to UC-59.

## Module B — Fal License and Marketer Onboarding

### UC-04 Submit Fal license and business details — Marketer applicant · E2 · P0
- Inputs: Fal license file (PDF or image, 10 MB maximum, required), Fal license number (required), license expiry date (required), commercial name (required, up to 100 characters), commercial register number (10 digits, required), additional documents (optional, up to 5 files).
- Flow: submit for review → FalProfile = Submitted → UnderReview; the item enters the license queue (UC-62); the user sees UC-05.
- Alternative: expiry date in the past → error that the license is expired.

### UC-05 Pending review screen — Marketer applicant · E2 · P0
- Shows UnderReview status. Marketer functions are disabled; other role profiles remain usable. On approval the user is notified (UC-06). On rejection the reason is shown with an action to edit and resubmit (UC-05A).

### UC-05A Resubmit after rejection — Marketer applicant · E2 · P0
- Pre: FalProfile = Rejected and the rejection reason is visible. Flow: correct data or upload replacement documents → status Resubmitted → UnderReview; task returns to UC-62.
- Rule: no fixed limit on resubmissions unless admin defines one later.

### UC-06 Approved Marketer entrance — Marketer · E2 · P0
- Pre: FalProfile = Approved. Flow: notification of approval, then Marketer dashboard (UC-31).

### UC-43 Fal license renewal — Marketer · E2 · P1
- Warnings are sent 30, 7 and 1 days before expiry [ASSUMPTION]. On expiry: profile → ComplianceRestricted; new listings and offers are blocked; Active listings → UnderComplianceReview; existing Deals continue.
- Flow: upload the new license file and new expiry date → status RenewalUnderReview → admin review (UC-62). On approval, eligible listings return to Active.

## Module C — Shared User Features

### UC-08 Notifications — Any user · E6 · P1
- List of in-app notifications with unread badge; opening an item marks it read and navigates to the related entity. Notifications are retained 90 days. A global toggle (UC-10) controls non-critical notifications; critical ones (deal, payment, security, license) are always delivered in-app [ASSUMPTION]. OTP delivery is independent of this toggle.

### UC-09 Profile and identity document — Any user · E1 · P0
- Shows name and phone (read-only), optional email, role profiles. The user may upload an identity document (10 MB maximum, AdminOnly). The document is required before any payment proof (BR-10). There is no manual admin verification in MVP; the system only checks existence.

### UC-09A Manage seller payout accounts [NEW] — Marketer, Owner · E2 · P0
- Inputs: account holder name (3–100 characters), Saudi IBAN (24 characters, format and mod-97 validation); bank name derived from the IBAN bank code when known.
- Rules: at least one account is required before submitting a listing (BR-05); an account referenced by an active Deal cannot be deleted or edited; creating or changing an account requires OTP re-confirmation and writes an audit event; the account holder name should match the registered name or commercial name (warning only) [ASSUMPTION].

### UC-10 General settings — Any user · E1 · P1
- Language (Arabic or English), dark mode, global notifications toggle. Saved per account; the language applies to the whole app; default is Arabic.

## Module D — Buyer Journey

### UC-11 Buyer home — Buyer · E3 · P0
- Shows featured and latest listings, promotional banners (UC-86), quick search entry and shortcuts to requests, favorites and notifications.

### UC-12 Text search and filters — Buyer · E3 · P0
- Inputs: free text; property type (required); city; district (depends on the selected city); price range; area range; bedrooms.
- Results: Active and Reserved listings, paginated (20 per page), sortable by newest, price ascending, price descending. No saved searches in MVP.

### UC-13 Interactive map — Buyer · E3 · P0
- Shows result listings as markers colored by type: Apartment blue, Villa green, Land orange, Building purple, Office red. Clustering applies when zoom level is below 12. Tapping a marker opens a listing card. The map reuses the active UC-12 filters.

### UC-14 Listing details — Buyer · E3 · P0
- Shows: image carousel (3–20 images), ask price, estimated commission and total (UC-17), specifications, mini-map, public documents, status badge (Active or Reserved), seller summary (UC-16).
- Actions: Conversation (UC-25), Make an offer (UC-27; becomes Backup Offer when Reserved), Share (UC-19), Favorite (UC-18), Report (UC-21).
- Rules: sensitive documents and contact data are never shown; Reserved listings remain visible and accept Backup Offers only.

### UC-15 Similar listings — Buyer · E3 · P1
- Shows 4–6 listings of the same property type in the same district or zone where |SimilarPrice − CurrentPrice| / CurrentPrice ≤ 0.20. The current listing and unavailable listings are excluded.

### UC-16 Seller public profile — Buyer · E3 · P1
- Shows name or commercial name, average rating and rating count, number of active listings, the active listings and the reviews. Phone and email are never shown before Deal completion.

### UC-17 Commission estimate and final amounts — Buyer · E4 · P0
- Before a Deal: show ask price, commission rate, estimated commission and estimated total using live settings (BR-02). After UC-70B: show the frozen snapshot values; later settings changes do not affect them.

### UC-18 Favorites — Buyer · E3 · P1
- Add and remove from the listing page; list screen with remove action; maximum 100 favorites. Adding an existing favorite just shows the list. Unavailable listings are shown with their status.

### UC-19 Share listing — Buyer · E3 · P2
- Copy link or use the browser share sheet where supported. The link opens the listing for authenticated users and redirects others to login first, then back.

### UC-20 Receive and respond to a counter-offer — Buyer · E4 · P0
- Pre: an active offer exists and the counterpart sent a counter-offer through Admin; the offer has not expired.
- Flow: notification → open offer (price, terms, countdown, no contact data) → choose Accept, Reject or Counter with a new price and notes. Counter increments NegotiationRound and goes to Admin, then to the seller. Accept moves the offer to SelectedPendingFinalAdminApproval and sends it to UC-70B.
- Rules: no action after expiry or after MaxCounterRounds.

### UC-21 Report a listing or user — Any user · E6 · P2
- Inputs: target (listing or user), reason (dropdown), details, optional attachments (up to 5, 10 MB each). The report enters the admin queue (UC-81). There is no tracking screen for the reporter in MVP.

### UC-22 Submit a Demand (property request) — Buyer · E5 · P1
- Inputs: budget (required), city/region (required), property type (required), required area (required), additional requirements (up to 1,000 characters).
- Flow: submit → Demand = Active with ExpiresAt = now + DemandExpiryDays → the Matching Engine sends it immediately to every qualifying Provider (BR-12), with no admin approval and no Top-N limit.
- Rule: submitting a Demand is free.

### UC-23 Manage Demands — Buyer · E5 · P1
- Lists the Buyer's Demands with status, expiry date and number of approved offers; open details; cancel while not Closed or Expired. Empty state: no Demands yet.

### UC-23A View approved offers for a Demand — Buyer · E5 · P1
- Shows only offers with status ApprovedForBuyer: price, property description, seller public summary and rating, expiry. Offers pending review or rejected are never shown.

### UC-23B Select an offer from a Demand — Buyer · E5 · P1
- Flow: open an approved offer → Select → confirm → offer = SelectedPendingFinalAdminApproval → UC-70B. No Deal is created yet.
- Alternative: if Admin rejects, the Demand returns to Active and the Buyer may select another unexpired offer.

### UC-24 Cancel a Demand — Buyer · E5 · P1
- Cancel with a mandatory reason. Demand = Cancelled; non-final offers are closed. Cancelling a Demand never affects an existing Deal.

### UC-25 Conversation about a listing (mediated) — Buyer · E6 · P1
- A thread exists per (listing, Buyer). Messages up to 2,000 characters; up to 5 attachments, 10 MB each, PDF or image.
- Flow: Buyer writes → Admin Conversation Queue (UC-77) → Admin replies or forwards to the seller (UC-78) → seller replies to Admin → Admin relays to the Buyer.
- Rules: no direct thread between Buyer and Seller; phone numbers and email addresses in message text SHOULD be masked automatically [PROPOSED].

### UC-26 Conversation history — Buyer · E6 · P2
- List of active and ended mediated conversations with filters by status and date range and search by listing name, area or seller name. Read-only. Empty state message when none exist.

### UC-27 Submit an offer on a listing — Buyer · E4 · P0
- Pre: listing Active or Reserved.
- Inputs: offer price (1 to 50,000,000 SAR; a confirmation is required if below 50% of ask price), notes (up to 500 characters).
- Flow: submit → PendingAdminReview → Admin approves and forwards (UC-70A) → seller responds (UC-47 or UC-58A) → counter-offers return via UC-20 → on final agreement go to UC-70B.
- Rules: identity document is not required to send an offer (required later for payment); on a Reserved listing the offer is a Backup Offer; at most MaxCounterRounds counter rounds; offers expire per OfferExpiryDays; one active offer per Buyer per listing [ASSUMPTION].

### UC-28 Payment summary and proof upload — Buyer · E4 · P0
- Pre: Deal = AwaitingPaymentProof, identity document uploaded, current time before PaymentDeadline.
- Screen: countdown; Final Deal Price, Final Commission, Final Total; Payment 1 (Commission): amount, platform bank account details and a deal reference code to put in the transfer note; Payment 2 (Price): amount and the Seller payout account (holder name and IBAN, per BR-05).
- Flow per payment: upload proof (PDF or image, 10 MB maximum, required) with optional notes (up to 500 characters) → payment = ProofUploaded → UnderReview (UC-71). After an admin rejection the Buyer may re-upload any number of times until the original deadline. The two proofs may be uploaded at different times.
- Rules: external transfers only; a rejection never extends the deadline; the Buyer may cancel the Deal (UC-29B) only while no proof has been uploaded.

### UC-29 System completion after payment confirmation — System (triggered by UC-71) · E4 · P0
- Trigger: both payments Confirmed before the deadline. Effects per BR-09: Deal = Completed, Listing = Sold, other offers and backup offers closed, contact disclosure enabled, rating enabled (UC-30), notifications sent to Buyer, Seller and Admin, and Owner contract set to Completed if applicable.
- No further confirmation is requested from the Buyer.

### UC-29A Automatic payment timeout — System scheduler · E4 · P0
- Trigger: Deal in AwaitingPaymentProof or PaymentUnderReview, now >= PaymentDeadline, and not both payments Confirmed, and Deal not Disputed.
- Effects: pending payments = Expired; Deal = CancelledByTimeout; Listing Reserved → Active; unexpired Backup Offers remain available; Buyer, Seller and Admin notified. See OQ-07.

### UC-29B Buyer cancels a Deal before paying — Buyer · E4 · P0
- Pre: Deal = AwaitingPaymentProof and no proof uploaded for either payment. Flow: cancel and confirm → Deal = CancelledByBuyer → Listing Reserved → Active → Seller and Admin notified.

### UC-29C Open a dispute after payment proof — Buyer or Seller · E6 · P1
- Pre: at least one proof exists and the Deal is not Completed or cancelled. Inputs: reason, description, attachments. Effects: Deal = Disputed; automatic completion and timeout are suspended for this Deal; the case goes to UC-70C.

### UC-30 Rate the Deal and the Seller — Buyer · E4 · P1
- Pre: Deal = Completed and no rating yet for this Deal. Input: 1–5 stars (required) and a comment up to 500 characters (optional). The rating is immutable after submission and appears on the Seller public profile (BR-17).

## Module E — Marketer Journey

### UC-31 Marketer dashboard — Marketer · E2 · P1
- Pre: role Approved and license unexpired. Shows KPIs: listings by status, matched Demands, active and completed Deals, total value of completed Deals. Financial data is statistical only (BR-04).

### UC-32 Financial statistics — Marketer · E7 · P3
- Shows total value of completed Deals, number of Deals, average Deal value and the platform commission generated by the Marketer's Deals. There is no wallet, balance or withdrawal.

### UC-33 Public listings directory — Marketer · E2 · P2
- Read-only browsing of Active and Reserved listings with filters (type, region, text). Making an offer requires the Buyer role of the same account. A user can never send offers on a listing they published [PROPOSED].

### UC-34 Create a listing — Marketer · E2 · P0
- Inputs: title (required), property type (required), purpose (Sale only), city, district, map location (latitude and longitude), single ask price (required), area (required), bedrooms and other specifications, description, photos (min 3, max 20), documents with visibility (Public or AdminOnly), Fal license number (taken from the profile), payout account (BR-05), and owner authorization document (AdminOnly) proving the Marketer may sell the property [PROPOSED, see OQ-06].
- Flow: save as Draft or submit → Draft → Submitted → UnderReview (UC-63).
- Errors: fewer than 3 photos → message asking for at least 3; expired license → blocked.

### UC-35 My listings — Marketer · E2 · P0
- List with image, title, price and status; filter by status (Draft, Submitted, UnderReview, Active, Reserved, Rejected, Hidden, Archived, Sold). Empty state message when none.

### UC-36 Listing details (seller view) — Marketer · E2 · P0
- Shows full listing with actions: Edit (UC-37), Delete (Draft or Rejected only), Submit for review (Draft only), Archive (UC-38).

### UC-37 Edit a listing — Marketer · E2 · P0
- Same form as UC-34, prefilled. Major edit (ask price, location, property type) → listing returns to UnderReview. Minor edit (description, additional photos) → saved immediately. Edits that conflict with an active Deal or Reserved status are rejected.

### UC-38 Archive a listing — Marketer · E2 · P1
- Allowed only when Listing = Active and no active Deal exists; confirmation required; Listing = Archived.

### UC-39 Review status and rejection notes — Marketer · E2 · P0
- Shows review status, rejection reason, admin notes and review date for UnderReview or Rejected listings.

### UC-40 Upload additional documents on request — Marketer · E2 · P1
- Notification lists the requested documents; the Marketer uploads every requested file (10 MB each) and submits them back to Admin.

### UC-41 Respond to admin price suggestion — Marketer or Owner · E2 · P2
- Shows the suggested price and reason. Options: Accept, Reject, or Counter with a requested price. The answer returns to Admin. An Admin suggestion never changes the ask price unless the seller accepts (BR-16).

### UC-42 Listing statistics — Marketer · E7 · P3
- Views, inquiries and offers per listing with date-range filter and charts. “Conversion” means offers received divided by views [ASSUMPTION].

### UC-44 Receive matched Demands — Marketer · E5 · P1
- Feed of Demands matched automatically (BR-12) with filters by region; open details; the Provider may submit a proposal (UC-45) or ignore the Demand. Empty state: no Demands match your activity.

### UC-45 Submit a proposal for a Demand — Marketer · E5 · P1
- Inputs: one of the Marketer's own Active listings (required, because a Deal is always bound to a listing) [PROPOSED], proposed price (required), notes (optional, up to 1,000 characters).
- Flow: submit → offer = PendingAdminReview → UC-70A. The Buyer sees it only after approval. Expiry follows OfferExpiryDays.

### UC-46 Deal tracking — Marketer · E4 · P0
- Lists Deals (created only after final admin approval) with filters: active, disputed, cancelled, completed. Statuses shown: AwaitingPaymentProof, PaymentUnderReview, Disputed, Completed, Cancelled. Each Deal shows payment status per payment and the deadline.
- The seller may request cancellation while no proof exists; the request needs Admin approval and ends as CancelledBySeller. After proofs exist the seller opens a dispute (UC-29C).
- An offer alone never counts as a Deal.

### UC-47 Respond to a buyer offer — Marketer · E4 · P0
- Receives offers forwarded by Admin. Options: Accept, Reject (reason required), or request a change (new price and reason required). The response returns to Admin and, for counters, to the Buyer (UC-20). On final agreement the offer goes to UC-70B. Round and expiry limits apply (BR-11).

### UC-48 Mediated conversations — Marketer · E6 · P1
- Sees messages forwarded by Admin and replies to Admin only. Contact data is never exchanged before Deal completion.

## Module F — Owner Journey

### UC-49 Owner dashboard — Owner · E2 · P1
- KPIs: listings by status, matched Demands, active Deals. Navigation as in UC-07.

### UC-50 Request an owner listing contract — Owner · E2 · P0
- Inputs: basic property data, single ask price, payout account (BR-05). Creates OwnerListingRequest as Draft or Submitted, then continues to UC-51. Documents are not repeated here.
- Rule: the listing is not published before the signed contract and confirmed fee (BR-15).

### UC-51 Upload property and ownership documents — Owner · E2 · P0
- Title deed (required, PDF or image, AdminOnly), photos (min 3, max 20, public), utility documents (optional). Save keeps visibility flags; identity and title deed are AdminOnly by default.

### UC-52 Upload additional ownership proofs — Owner · E2 · P1
- On admin request the Owner uploads every requested document (10 MB each) and submits; visibility stays AdminOnly unless an admin changes it.

### UC-53 Electronic contract signature — Owner · E2 · P0
- Pre: Admin approved the request, selected a template and fee (UC-67, UC-68).
- Flow: review the generated contract text → sign using a signature pad plus OTP confirmation → OwnerContract = SignedPendingFee → UC-55.
- Evidence stored: signed PDF, SHA-256 hash, timestamp, IP address, user agent, OTP verification record.
- Alternative: refusing to sign ends the request and the listing is never published. Legal validity of this signature method is to be confirmed (OQ-11).

### UC-54 View the signed contract — Owner · E2 · P2
- PDF viewer and download; shows contract status (SignedPendingFee, Active, Completed).

### UC-55 Upload contract fee payment proof — Owner · E2 · P0
- Shows FeeAmount, platform bank details and the contract reference code. The Owner uploads a proof (10 MB maximum) with optional notes → FeeUnderReview → UC-68A. After rejection the Owner may re-upload until ContractFeeDeadline (default 7 days) [ASSUMPTION]. The listing is not published until an admin confirms the fee.

### UC-56 Owner listings — Owner · E2 · P0
- List with statuses Active, Reserved, Archived, Sold and others; filter by status; open details; archive when allowed (UC-56A).

### UC-56A Archive an Owner listing — Owner · E2 · P1
- Same conditions as UC-38: Active, not Reserved, no active Deal.

### UC-57 Listing performance — Owner · E7 · P3
- Views, inquiries, offers and Deals per listing with date filter.

### UC-57A Owner Deal tracking — Owner · E4 · P0
- Deals on the Owner's listings with status, payment statuses and deadline. Before any proof the Owner may request cancellation (Admin approval); after proofs the Owner may open a dispute (UC-29C).

### UC-58 Receive Demands and submit proposals — Owner · E5 · P1
- Same behavior as UC-44 and UC-45 for Owners. A Demand can only be ignored or answered with a proposal; there is no accept or reject on the Demand itself.

### UC-58A Respond to a direct offer — Owner · E4 · P0
- Same behavior as UC-47 for Owner listings, including counter rounds and expiry.

### UC-58B Mediated conversations — Owner · E6 · P1
- Same behavior as UC-48 for Owners.

## Module G — Admin Back-Office
Every admin action requires the permission named in section 7 and writes an audit event (UC-91A). Super Admin holds all permissions.

### UC-59 Admin login — Admin · E1 · P0
- Email or phone plus password (hashed). Five failed attempts lock the account for 15 minutes. Disabled accounts see a status message. Password reset by Super Admin or by email link.

### UC-60 Admin dashboard — Admin · E1 · P1
- Cards: Active listings, listings under review, active Deals, pending licenses, pending payment proofs, open tickets; urgent task list ordered by deadline.

### UC-61 User management — Admin (Users.View, Users.Status, Users.HardDelete) · E1 · P0
- Table of accounts with role profiles, filters by role and status, user detail page. Actions: Disable or Enable account or a single role profile, Soft Delete, Hard Delete (only without transactional history, BR-18). Disabling sends an email or notification.

### UC-62 Fal license review — Admin (Licenses.Review) · E2 · P0
- Queue of Submitted, Resubmitted and RenewalUnderReview items; detail with data and documents; Approve or Reject (reason required). First approval → Marketer Approved. Renewal approval → restores eligible listings. Rejection enables resubmission (UC-05A).

### UC-63 Listing review — Admin (Listings.Review, Listings.Compliance) · E2 · P0
- Review data and documents; Approve (→ Active), Reject (reason), Request modification (notes), Request additional documents (UC-40, UC-52), Hide or Block (compliance permission). Price changes only through UC-64 and UC-65.

### UC-64 Price valuation suggestion — Admin (Price.Suggest) · E2 · P2
- Admin enters a suggested ask price and reasoning and sends it to the seller; the seller answers via UC-41. The suggestion does not change the ask price until accepted.

### UC-65 Send price change request — Admin (Price.Suggest) · E2 · P2
- Sends a formal price-change request with reason; status PendingSellerResponse.

### UC-66 Compliance actions — Admin (Listings.Compliance) · E2 · P1
- Hide, Block or request correction of violating listings without seller consent. Blocking requires Super Admin or the explicit permission.

### UC-67 Review owner listing requests and contract fees — Admin (Contracts.Review) · E2 · P0
- Review request and documents; Approve, Reject (reason) or Request modification. On approval select a contract template and set the fee: default from settings (DefaultOwnerContractFee) or an override (Super Admin or explicit permission, reason required). Continue to UC-68.

### UC-68 Send contract to Owner — Admin (Contracts.Review) · E2 · P0
- Preview the generated PDF and fee, then send. Status → ApprovedPendingSignature; the Owner continues at UC-53.

### UC-68A Review contract fee proof — Admin (ContractFees.Review) · E2 · P0
- View contract, amount and proof. Approve → fee Confirmed, OwnerContract = Active, listing = Active (published). Reject → reason; Owner re-uploads at UC-55. Never publish before approval.

### UC-69 Contract template manager — Super Admin · E2 · P1
- Rich-text editor with variables (owner name, property data, ask price, fee, dates), create, edit, delete and version templates. Template selection is manual per request (UC-67).

### UC-70 Deal management — Admin (Deals.View, Deals.StatusOverride) · E4 · P0
- Table with filters; open detail (parties, listing, offers history, payments, timeline). An admin with the override permission may change Deal status manually with a mandatory reason [PROPOSED]; each change logs who, when, old and new status.

### UC-70A Review offers and proposals — Admin (Offers.Review) · E4 · P0
- Two queues. Buyer offers on listings: Approve → forwarded to the seller (PendingSellerResponse); Reject → notify Buyer. Provider proposals on Demands: Approve → ApprovedForBuyer and visible to the Buyer (UC-23A); Reject → RejectedByAdmin, never visible. This is a content review only, not final approval.

### UC-70B Final approval and Deal creation — Admin (Deals.FinalApprove) · E4 · P0
- Pre: offer = SelectedPendingFinalAdminApproval (from UC-23B) or final agreement reached (UC-20, UC-47, UC-58A); listing still available; Demand active when applicable; seller has a payout account.
- Flow: review final price, parties, listing state and commission preview → Approve or Reject.
- Approve creates, in one transaction: the Deal (AwaitingPaymentProof), two payment records (Commission = FinalCommission; Price = FinalDealPrice), the commission snapshot, PaymentDeadline, Listing = Reserved, notifications. Other open offers become Backup Offers where allowed, otherwise Closed.
- Reject: no Deal; the offer returns to an appropriate status with the reason; Demand returns to Active.
- This is the only point at which a Deal can be created.

### UC-70C Dispute resolution — Admin (Deals.DisputeResolve) · E6 · P1
- Review dispute, attachments, Deal timeline and payments; communicate with parties through internal mediation; decide: return to review (PaymentUnderReview), complete, or cancel (CancelledByAdmin). Reason is mandatory; parties are notified; the decision is audited.

### UC-71 Review payment proofs — Admin (Payments.Review) · E4 · P0
- Pre: payment = ProofUploaded or UnderReview and now <= PaymentDeadline. Each of the two payments is reviewed separately.
- Checks: Commission — amount equals FinalCommission, receiver is the platform account, reference code present. Price — amount equals FinalDealPrice and receiver IBAN equals the Seller payout account on the Deal.
- Approve → payment Confirmed. Reject (reason required) → payment Rejected; the Buyer re-uploads until the original deadline. When both payments are Confirmed the system runs UC-29.
- The platform cannot see bank movements; Confirmed means the proof is acceptable. The Seller is notified when the Price proof is uploaded and when it is confirmed and may open a dispute. A mandatory seller receipt acknowledgment is OQ-01.

### UC-72 Sold marking — System · E4 · P0
- Merged into UC-29 to avoid duplicate behavior. Listing = Sold is set only inside the atomic completion step (BR-09).

### UC-73 Penalties and freezes — Super Admin (Penalties.Apply) · E7 · P3
- Apply a penalty (amount in SAR and reason) to a Marketer or freeze a Deal (reason). Penalties are recorded only; collection happens outside the system in MVP. Audited.

### UC-74 Fraud monitoring logs — Super Admin (Fraud.View) · E7 · P3
- System-generated events: repeated rejected proofs, repeated buyer cancellations or timeouts, payout account changes, offers far below ask, license anomalies. Filter by type and date; open detail.

### UC-75 Financial indicators — Super Admin (Finance.View) · E7 · P2
- Total commissions (expected and confirmed), owner contract fees collected, payment proofs by status, invoices and summaries. No marketer withdrawals.

### UC-76 Commission settings — Super Admin (Settings.Commission) · E4 · P0
- Edit CommissionRate (%) and FixedCommission (SAR). Applies only to Deals approved afterwards (snapshot, BR-02). Single source of truth; audited.

### UC-77 Mediated conversations workspace — Support Team (Conversations.Handle) · E6 · P1
- Queue of Buyer messages; reply directly, or forward to the seller (UC-78); seller replies return here; Admin relays to the Buyer. Contact sharing is allowed only after Deal completion.

### UC-78 Forward a conversation to the seller — Support Team · E6 · P1
- Choose the listing's seller (Owner or Marketer) and forward. Not used for Demand dispatch, which is automatic (UC-22).

### UC-79 Reply to inquiries — Support Team · E6 · P2
- Direct admin replies to customer inquiries.

### UC-80 Ticket management with SLA — Support Team (Tickets.Handle) · E6 · P2
- Tickets: Open → InProgress → Resolved → Closed; priority and status filters; replies; SLA timers with internal escalation. Users only submit tickets in MVP (UC-82).

### UC-81 Reports queue — Support Team (Reports.Handle) · E6 · P2
- View reports from UC-21 with attachments and targets; status UnderReview; take action on the listing or user according to permission; resolve or close internally. The reporter sees no status in MVP.

### UC-82 Create a technical support ticket — Any user · E6 · P2
- Inputs: subject (required), description (required), attachments (optional). Ticket = Open and enters UC-80. No My Tickets screen in MVP.

### UC-83 System settings — Super Admin (Settings.Manage) · E1 · P0
- Edit DefaultOwnerContractFee, DemandExpiryDays, OfferExpiryDays, MaxCounterRounds, PaymentWindowHours, ContractFeeDeadlineDays, MaxAttachmentSizeMb, MaxPriceSar and other operational limits. Commission fields are edited only in UC-76. Nothing configurable is hard-coded.

### UC-83A Admin roles and permissions (Dynamic RBAC) — Super Admin · E1 · P0
- Create, edit and delete non-system admin roles; choose permissions from the catalog (section 7) in a matrix; assign roles to admin users; changes are audited and effective on the next request. The Super Admin system role always holds every permission and cannot lose them.

### UC-84 Notification and email templates — Super Admin · E7 · P3
- Edit message templates with variables for the events in section 8.

### UC-85 Static pages — Super Admin · E7 · P2
- Edit About, Terms and Privacy pages with a rich-text editor.

### UC-86 Promotional banners — Super Admin · E7 · P3
- Add, edit and delete banners with image, link and start and end dates.

### UC-87 FAQ — Super Admin · E7 · P3
- Add, edit and delete questions and answers.

### UC-88 Detailed financial reports — Super Admin · E7 · P3
- Monthly or yearly reports with date filters; export to PDF and Excel.

### UC-89 Performance reports — Super Admin · E7 · P3
- KPIs and charts: users, listings, Deals, revenue, conversion and growth.

### UC-90 Bulk actions — Admin · E7 · P3
- Select multiple listings and approve, reject or hide in one action. Each action requires the matching permission and creates one audit event with the affected count.

### UC-91 Internal notes — Admin · E7 · P2
- Private notes on users, listings and Deals; never visible to users; show author and date. Notes do not replace the audit trail.

### UC-91A Admin audit trail — Admin (Audit.View) · E1 · P0
- Immutable, read-only log: who, when, action, entity, old value, new value. Covers RBAC changes, user status and deletion, listing decisions, offer approvals, Deal status, payment decisions, contract decisions, settings, bulk actions and system-job state changes. Filter by admin, entity, action and date.

---

# 6. State Transition Tables

*Sections 6–14 were drafted to complete the SRS. Items not already referenced in sections 1–5 are tagged [PROPOSED] or [ASSUMPTION] and need client confirmation.*

Every transition is executed on the server, inside a transaction, and writes an audit event (BR-19). Any transition not listed is forbidden.

## 6.1 Account and Role Profile

| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | Active | OTP verified, account created (UC-01) | User |
| Active | Disabled | Disable account or role profile (UC-61) | Admin |
| Disabled | Active | Enable (UC-61) | Admin |
| Active / Disabled | SoftDeleted | Soft delete (BR-18) | Admin |
| SoftDeleted | HardDeleted | Only if no transactional history (BR-18) | Admin (Users.HardDelete) |

Role profiles: Buyer and Owner are Active on creation. Marketer is Pending until the Fal profile is Approved (UC-02, UC-06).

## 6.2 Fal Profile (Marketer)

| From | To | Trigger | Actor |
|---|---|---|---|
| Draft | Submitted | Submit (UC-04) | Marketer |
| Submitted | UnderReview | Enters queue | System |
| UnderReview | Approved | Approve (UC-62) | Admin |
| UnderReview | Rejected | Reject with reason (UC-62) | Admin |
| Rejected | Resubmitted | Correct and resubmit (UC-05A) | Marketer |
| Resubmitted | UnderReview | Enters queue | System |
| Approved | ComplianceRestricted | License expiry job (UC-43) | System |
| ComplianceRestricted | RenewalUnderReview | Upload renewal (UC-43) | Marketer |
| RenewalUnderReview | Approved | Approve renewal (UC-62) | Admin |
| RenewalUnderReview | Rejected | Reject renewal (UC-62) | Admin |

## 6.3 Listing

| From | To | Trigger | Actor |
|---|---|---|---|
| Draft | Submitted | Submit; requires 3–20 photos, payout account, valid license (UC-34) | Seller |
| Submitted | UnderReview | Enters queue | System |
| UnderReview | Active | Approve (UC-63) | Admin |
| UnderReview | Rejected | Reject with reason (UC-63) | Admin |
| UnderReview | Draft | Request modification, notes attached [PROPOSED] | Admin |
| Rejected | Draft | Seller edits for resubmission [PROPOSED] | Seller |
| Draft / Rejected | Deleted | Delete (BR-13) | Seller |
| Active | UnderReview | Major edit: price, location, type (UC-37) | Seller |
| Active | Reserved | Deal created (UC-70B) | System |
| Reserved | Active | Deal cancelled, any cancel reason (UC-29A, UC-29B, UC-70C) | System |
| Reserved | Sold | Deal completed (UC-29) | System |
| Active | Archived | No active Deal, not Reserved (UC-38) | Seller |
| Archived | Active | Unarchive [PROPOSED] | Seller |
| Active / Reserved | Hidden | Compliance (UC-66) | Admin |
| Hidden | Active | Unhide | Admin |
| Active / Hidden | Blocked | Compliance (UC-66) | Admin / Super Admin |
| Active | UnderComplianceReview | License expiry job (BR-14) | System |
| UnderComplianceReview | Active | Renewal approved (UC-62) | System |

Owner listings are created Draft and become Active only through UC-68A (BR-15).

## 6.4 Owner Listing Request and Contract

| From | To | Trigger | Actor |
|---|---|---|---|
| Draft | Submitted | Submit request (UC-50) | Owner |
| Submitted | Approved | Approve, template and fee chosen (UC-67) | Admin |
| Submitted | Rejected | Reject with reason (UC-67) | Admin |
| Submitted | ModificationRequested | Request modification (UC-67) | Admin |
| ModificationRequested | Submitted | Owner resubmits | Owner |
| Approved | ApprovedPendingSignature | Contract sent (UC-68) | Admin |
| ApprovedPendingSignature | SignedPendingFee | Signature plus OTP (UC-53) | Owner |
| ApprovedPendingSignature | Cancelled | Owner refuses to sign (UC-53) | Owner |
| SignedPendingFee | FeeUnderReview | Fee proof uploaded (UC-55) | Owner |
| FeeUnderReview | Active | Fee confirmed; listing published (UC-68A) | Admin |
| FeeUnderReview | SignedPendingFee | Fee proof rejected; re-upload until ContractFeeDeadline | Admin |
| SignedPendingFee | Expired | ContractFeeDeadline passed [ASSUMPTION] | System |
| Active | Completed | Linked listing sold (UC-29) | System |

## 6.5 Offer (including Backup Offers and Demand proposals)

| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | PendingAdminReview | Buyer submits offer (UC-27) or Provider submits proposal (UC-45) | Buyer / Provider |
| PendingAdminReview | PendingSellerResponse | Approve a Buyer offer (UC-70A) | Admin |
| PendingAdminReview | ApprovedForBuyer | Approve a Demand proposal (UC-70A) | Admin |
| PendingAdminReview | RejectedByAdmin | Reject (UC-70A) | Admin |
| PendingSellerResponse | SellerCountered | Seller requests change (UC-47, UC-58A) | Seller |
| SellerCountered | PendingBuyerResponse | Admin forwards [PROPOSED] | Admin |
| PendingSellerResponse | RejectedBySeller | Reject with reason | Seller |
| PendingBuyerResponse | PendingAdminReview | Buyer counters; NegotiationRound + 1 (UC-20) | Buyer |
| PendingBuyerResponse | RejectedByBuyer | Buyer rejects | Buyer |
| PendingSellerResponse | SelectedPendingFinalAdminApproval | Seller accepts | Seller |
| PendingBuyerResponse | SelectedPendingFinalAdminApproval | Buyer accepts (UC-20) | Buyer |
| ApprovedForBuyer | SelectedPendingFinalAdminApproval | Buyer selects (UC-23B) | Buyer |
| SelectedPendingFinalAdminApproval | ConvertedToDeal | Final approval (UC-70B) | Admin |
| SelectedPendingFinalAdminApproval | ReturnedAfterRejection | Final approval rejected (UC-70B) | Admin |
| Any open state | Expired | Offer expiry job | System |
| Any open state | Closed | Another Deal completed, Demand cancelled, listing unavailable (BR-09, UC-24) | System |

Backup Offers are the same states, flagged IsBackup. They are not converted until the first Deal fails (OQ-04). Counter rounds beyond MaxCounterRounds are rejected.

## 6.6 Demand

| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | Active | Submit (UC-22) | Buyer |
| Active | Cancelled | Cancel with reason (UC-24) | Buyer |
| Active | Expired | Demand expiry job | System |
| Active | Closed | A Deal created from one of its proposals is Completed | System |

While a proposal is awaiting final approval the Demand stays Active, so a rejection returns it cleanly (UC-70B).

## 6.7 Deal

| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | AwaitingPaymentProof | Final approval (UC-70B) | Admin |
| AwaitingPaymentProof | PaymentUnderReview | First proof uploaded | System |
| PaymentUnderReview | AwaitingPaymentProof | Proof rejected, no proof currently pending | System |
| AwaitingPaymentProof | CancelledByBuyer | Buyer cancels, no proof exists (UC-29B) | Buyer |
| AwaitingPaymentProof | CancelledBySeller | Seller request approved, no proof exists (UC-46) | Admin |
| AwaitingPaymentProof / PaymentUnderReview | CancelledByTimeout | Deadline passed (UC-29A) | System |
| PaymentUnderReview | Completed | Both payments Confirmed before deadline (UC-29) | System |
| PaymentUnderReview | Disputed | Dispute opened (UC-29C) | Buyer / Seller |
| Disputed | PaymentUnderReview | Admin returns to review (UC-70C) | Admin |
| Disputed | Completed | Admin decision (UC-70C) | Admin |
| Disputed | CancelledByAdmin | Admin decision (UC-70C) | Admin |
| Any non-terminal | Any | Manual override with reason (UC-70) | Admin (Deals.StatusOverride) |

Terminal states: Completed, CancelledByBuyer, CancelledBySeller, CancelledByTimeout, CancelledByAdmin. A listing has at most one non-terminal Deal (BR-07).

## 6.8 Payment (two per Deal: Commission and Price)

| From | To | Trigger | Actor |
|---|---|---|---|
| Pending | ProofUploaded | Buyer uploads proof (UC-28) | Buyer |
| ProofUploaded | UnderReview | Admin opens it | Admin |
| ProofUploaded / UnderReview | Confirmed | Approve (UC-71) | Admin |
| ProofUploaded / UnderReview | Rejected | Reject with reason (UC-71) | Admin |
| Rejected | ProofUploaded | Re-upload before the original deadline | Buyer |
| Pending / ProofUploaded / UnderReview / Rejected | Expired | Deal timeout (UC-29A) | System |

## 6.9 Contract Fee Payment

Same states as 6.8 (Pending, ProofUploaded, UnderReview, Confirmed, Rejected, Expired), with the deadline ContractFeeDeadline (UC-55, UC-68A).

## 6.10 Ticket, Report, Conversation

| Entity | Transitions |
|---|---|
| Ticket | Open → InProgress → Resolved → Closed. Resolved → InProgress when reopened by an admin (UC-80) |
| Report | New → UnderReview → ActionTaken or Dismissed → Closed (UC-81) |
| Conversation | Open → AwaitingAdmin ⇄ AwaitingSeller → Ended. Ended automatically when the listing is Sold or Archived, or manually by an admin |

## 6.11 Price Suggestion

PendingSellerResponse → Accepted (ask price updated; may trigger re-review) / Rejected / Countered (returns to admin). Only Accepted changes the ask price (BR-16).

# 7. Admin Permission Catalog

Permissions use the form Area.Action. The Super Admin system role always holds all of them (UC-83A). Support Team is a default seeded role that Super Admin may edit. "Yes" in the last column means included in the default Support Team role [PROPOSED].

| Permission | Grants | Support default |
|---|---|---|
| Users.View | See accounts, role profiles, details (UC-61) | Yes |
| Users.Status | Disable, enable, soft delete | |
| Users.HardDelete | Hard delete without history (BR-18) | |
| Licenses.Review | Fal license queue (UC-62) | Yes |
| Listings.Review | Approve, reject, request changes or documents (UC-63) | Yes |
| Listings.Compliance | Hide, block, request correction (UC-63, UC-66) | |
| Price.Suggest | Price suggestion and change request (UC-64, UC-65) | Yes |
| Contracts.Review | Review owner requests, send contracts (UC-67, UC-68) | Yes |
| Contracts.FeeOverride | Set a fee different from the default (UC-67) | |
| ContractFees.Review | Confirm or reject contract fee proofs (UC-68A) | Yes |
| Offers.Review | Content review of offers and proposals (UC-70A) | Yes |
| Deals.View | View Deals and timeline (UC-70) | Yes |
| Deals.FinalApprove | Final approval and Deal creation (UC-70B) | |
| Deals.StatusOverride | Manual Deal status change (UC-70) | |
| Deals.DisputeResolve | Resolve disputes (UC-70C) | |
| Payments.Review | Approve or reject payment proofs (UC-71) | Yes |
| Conversations.Handle | Mediated conversations workspace (UC-77, UC-78, UC-79) | Yes |
| Tickets.Handle | Tickets and SLA (UC-80) | Yes |
| Reports.Handle | Reports queue (UC-81) | Yes |
| Penalties.Apply | Penalties and Deal freezes (UC-73) | |
| Fraud.View | Fraud monitoring (UC-74) | |
| Finance.View | Financial indicators and reports (UC-75, UC-88) | |
| Settings.Commission | Commission settings (UC-76) | |
| Settings.Manage | System settings (UC-83) | |
| Rbac.Manage | Admin roles and permissions (UC-83A) | |
| Content.Manage | Static pages, banners, FAQ, templates (UC-84 to UC-87) | |
| Reports.Analytics | Performance reports (UC-89) | |
| Bulk.Execute | Bulk actions; also needs the underlying permission per item (UC-90) | |
| Notes.Manage | Internal notes (UC-91) | Yes |
| Audit.View | Audit trail (UC-91A) | |

Separation of duties [PROPOSED]: the admin who approves a payment proof SHOULD NOT be the admin who performs the final approval of the same Deal.

# 8. Notification Catalog

Channel in MVP: in-app (UC-08) plus email for admins and for users who provided an email. Critical = always delivered in-app regardless of the user's toggle (UC-08).

| Event | Recipient | Critical |
|---|---|---|
| Fal license submitted | Admin (license queue) | |
| Fal license approved / rejected | Marketer | Yes |
| License expiry warning (30, 7, 1 days) | Marketer | Yes |
| License expired, listings under compliance review | Marketer | Yes |
| Listing submitted | Admin | |
| Listing approved / rejected / modification requested | Seller | Yes |
| Additional documents requested | Seller | Yes |
| Listing hidden or blocked | Seller | Yes |
| Price suggestion or change request | Seller | |
| Owner request approved, contract ready to sign | Owner | Yes |
| Unsigned contract or unpaid fee reminder | Owner | |
| Contract fee proof uploaded | Admin | |
| Contract fee confirmed (listing published) / rejected | Owner | Yes |
| Offer submitted | Admin | |
| Offer forwarded to seller | Seller | Yes |
| Counter-offer received | Buyer or Seller | Yes |
| Offer rejected, expired or closed | Buyer, Seller | |
| Demand matched | Qualifying Providers | |
| Proposal submitted | Admin | |
| Proposal approved and visible | Buyer | |
| Offer selected, awaiting final approval | Admin | Yes |
| Final approval rejected | Buyer, Seller | Yes |
| Deal created, payment instructions and deadline | Buyer, Seller | Yes |
| Payment deadline reminders (12 h, 2 h) [ASSUMPTION] | Buyer | Yes |
| Proof uploaded | Admin; Seller (Price proof) | Yes |
| Proof confirmed / rejected | Buyer; Seller (Price proof confirmed) | Yes |
| Deal completed, contact details released, rating enabled | Buyer, Seller, Admin | Yes |
| Deal cancelled (buyer, seller, timeout, admin) | Buyer, Seller, Admin | Yes |
| Dispute opened / resolved | Parties, Admin | Yes |
| Mediated message received | Buyer, Seller, Admin | |
| Rating received | Seller | |
| Account or role disabled / enabled | User | Yes |
| Payout account changed | User; Admin (fraud log) | Yes |
| Ticket status change | Admin only in MVP | |

Templates are editable by Super Admin with variables (UC-84). Notifications older than 90 days are deleted by the retention job (section 3.4).

# 9. Non-Functional Requirements

## 9.1 Security

- Server-side authorization on every action (section 3.2); object-level checks (ownership) tested for every endpoint.
- Files never public; signed URLs expire in at most 5 minutes [ASSUMPTION].
- Sensitive fields (IBAN, identity documents) encrypted at rest; IBAN masked in lists, shown fully only where required (BR-05).
- Rate limiting: OTP (UC-01), login, uploads, offers, messages. Per phone, per IP and per account.
- Input validation on the server for all forms; output encoding; strict Content-Security-Policy.
- The static OTP provider cannot start in production (section 3.6).
- Admin actions require re-authentication for high-risk operations (commission change, hard delete, status override) [PROPOSED].

## 9.2 Privacy and compliance

- Personal data handling aligned with the Saudi Personal Data Protection Law (PDPL); privacy policy and consent captured at registration [OPEN, OQ-12].
- Contact data disclosure only as defined in BR-06; every disclosure is logged.
- Data retention periods for documents and proofs defined by legal counsel (OQ-12).

## 9.3 Performance targets [ASSUMPTION]

| Area | Target |
|---|---|
| Search and map results | p95 under 800 ms at 50,000 active listings |
| Page load on 4G mobile | Largest Contentful Paint under 2.5 s |
| API response time | p95 under 500 ms for mutations and 300 ms for reads, excluding file upload |
| Payment deadline job | Executes within 60 s of the deadline |

## 9.4 Availability and operations

- Target availability 99.5% monthly; daily database backups, point-in-time recovery, restore tested quarterly.
- Structured logging with request IDs; error monitoring; job-run dashboard with failure alerts.
- Zero-downtime migrations through Prisma migrate; staging environment mirrors production.

## 9.5 Usability and accessibility

- Arabic RTL first, mirrored layouts, Arabic-Indic or Western digits per user setting, Hijri date display optional [PROPOSED].
- WCAG 2.1 AA for contrast, keyboard navigation and labels.
- Empty states, loading states and error messages for every list and form.

## 9.6 Data integrity

- Money stored as fixed-point decimal; no floating point.
- Atomic transactions for Deal creation (UC-70B) and completion (UC-29).
- Unique partial index: at most one non-terminal Deal per listing (BR-07).
- Optimistic concurrency (version column) on listings, offers and Deals to prevent double actions by two admins.
- Immutable audit table: insert-only database role.

## 9.7 Testing

- Unit tests for commission math (BR-02), IBAN validation, state machines.
- Integration tests for every state transition in section 6, including forbidden ones.
- Job tests with a controllable clock: payment timeout at the exact boundary, concurrent runs, idempotency.
- End-to-end flows: Owner contract to published listing; offer to completed Deal; Demand to Deal; dispute.

# 10. Core Data Model (logical)

| Group | Entities |
|---|---|
| Identity | Account, RoleProfile, Session, OtpChallenge, DeviceTrust, IdentityDocument |
| Admin | AdminUser, AdminRole, AdminPermission, AdminSession, AuditEvent, InternalNote |
| Licensing | FalProfile, FalDocument |
| Payout | PayoutAccount |
| Listings | Listing, ListingMedia, ListingDocument, ListingStatusHistory, Favorite, ListingView |
| Owner contracts | OwnerListingRequest, ContractTemplate, ContractTemplateVersion, OwnerContract, ContractFeePayment |
| Demands | Demand, DemandMatch |
| Offers | Offer (with IsBackup, Round, Source = Listing or Demand), OfferEvent |
| Deals | Deal, Payment (Kind = Commission or Price), PaymentProof, Dispute, DisputeMessage |
| Communication | Conversation, Message, Attachment, Ticket, TicketMessage, Report |
| Reputation | Rating |
| Platform | Notification, NotificationTemplate, Setting, Banner, StaticPage, Faq, FileObject, JobRun, Penalty, FraudEvent |

Key constraints: Deal stores CommissionRateSnapshot, FixedCommissionSnapshot, FinalDealPrice, FinalCommission, FinalTotal and the SellerPayoutAccount snapshot (holder name and IBAN copied at creation, so later edits cannot change it). Rating is unique per Deal. Conversation is unique per (Listing, Buyer).

# 11. Epic Plan and Priorities

Priorities follow the P-tags in section 5: P0 launch-blocking, P1 launch, P2 soon after launch, P3 later.

| Epic | Name | Main use cases | Priority |
|---|---|---|---|
| E0 | Platform foundation (see below) | Technical stories, no UC | P0 |
| E1 | Identity, access and admin foundation | UC-01, 01A, 02, 02A, 03, 07, 09, 10, 59, 60, 61, 83, 83A, 91A, 92 | P0 |
| E2 | Seller side: licensing, listings, owner contracts | UC-04 to 06, 09A, 31, 33 to 41, 43, 49 to 57, 62 to 69 | P0 |
| E3 | Discovery | UC-11 to 16, 18, 19 | P0 |
| E4 | Offers, Deals and payments | UC-17, 20, 27 to 30, 46, 47, 57A, 58A, 70 to 72, 76 | P0 |
| E5 | Demands and matching | UC-22 to 24, 44, 45, 58 | P1 |
| E6 | Communication, support and disputes | UC-08, 21, 25, 26, 29C, 48, 58B, 70C, 77 to 82 | P1 |
| E7 | Analytics, content and extras | UC-32, 42, 57, 73 to 75, 84 to 91 | P2 to P3 |

Suggested delivery order [PROPOSED]: E0 → E1 → E2 → E3 → E4 → E6 (notifications first, disputes second) → E5 → E7.

**Epic E0 — Platform foundation (P0, first):** monorepo and CI (3.11), NestJS skeleton with config validation, Prisma setup and base migrations, authentication guards and permission decorators (3.2, 3.7), error format and OpenAPI (3.10), job runner and worker process (3.4), file storage service (3.5), OtpProvider abstraction (3.6), audit service, settings service, notification service, Next.js shell with i18n, RTL layout and generated API client.

MVP release gate: one Marketer listing and one Owner listing can each go through publish → offer → negotiation → final approval → two payment proofs → Completed, plus the timeout path.

# 12. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Marketer fraud: fake listing, or a payout account that is not the real owner's | Medium | High | Owner authorization document (UC-34), payout account change needs OTP and raises fraud event (UC-09A, UC-74), admin checks IBAN on every Price proof (UC-71), penalties (UC-73) |
| R-02 | Payment timeout while the admin has not yet reviewed an uploaded proof (OQ-07) | High | High | Reminder alerts to admins, queue ordered by deadline (UC-60), recommended default in OQ-07 |
| R-03 | Platform cannot see bank movements; a forged or edited proof is accepted | Medium | High | Seller notified on Price proof and may dispute (UC-71); decision on OQ-01; proof checksum stored; reference code in transfer note |
| R-04 | Buyer and Seller bypass the platform by sharing contacts in messages | High | Medium | Automatic masking (UC-25), admin review of all messages, fraud signals |
| R-05 | Static OTP code reaches production | Low | Critical | Environment guard, startup check, CI test (3.6) |
| R-06 | Legal validity of electronic signature and Fal verification not confirmed | Medium | High | Legal review before launch (OQ-03, OQ-11); keep full evidence set (UC-53) |
| R-07 | Admin bottleneck: every offer, message and proof is mediated | High | High | Queues with SLA and deadline sorting, dashboards, staffing plan, permission-based assignment |
| R-08 | Concurrent admin actions on the same offer or Deal | Medium | Medium | Optimistic concurrency, unique partial index on active Deal |
| R-09 | Job failure or duplicate execution (timeouts, expiry) | Medium | High | Idempotent jobs, run log, alerts on missed runs |
| R-10 | Data residency and PDPL non-compliance (OQ-12) | Medium | High | Choose Saudi-hosted storage and database if required; legal sign-off |
| R-11 | Commission rules unclear at launch (OQ-02) | Medium | Medium | Settings-driven values; block go-live until values are confirmed |
| R-12 | Arabic full-text search quality is poor | Medium | Medium | Trigram plus normalization (alef, taa marbuta, diacritics); evaluate external search later |
| R-13 | Large file uploads or malware | Medium | Medium | 10 MB limit, MIME sniffing, malware scan, private bucket |

# 13. Assumptions and Open Questions

## 13.1 Assumptions (working defaults)

| ID | Assumption |
|---|---|
| A-01 | MaxPriceSar default is 50,000,000 (BR-01) |
| A-02 | Password policy: at least 8 characters with a letter and a digit (3.7) |
| A-03 | Session lifetime: 30 days sliding for users, 8 hours for admins (3.7) |
| A-04 | Five failed logins lock the account for 15 minutes (UC-01A, UC-59) |
| A-05 | License warnings at 30, 7 and 1 days (UC-43) |
| A-06 | ContractFeeDeadline default is 7 days (UC-55) |
| A-07 | One active offer per Buyer per listing (BR-11) |
| A-08 | Area tolerance for matching is ±20% [pending OQ-05] |
| A-09 | Critical notifications are always delivered (UC-08) |
| A-10 | Payout account holder name mismatch is a warning only (UC-09A) |
| A-11 | Conversion = offers received ÷ views (UC-42) |
| A-12 | Signed URLs expire within 5 minutes (9.1) |

## 13.2 Open questions

Recommended defaults are used so development is not blocked. OQ-01, 02, 04, 05, 06, 07, 11 and 12 are referenced in sections 1–5. OQ-03, 08, 09 and 10 are [PROPOSED] here because their numbers were not defined in the earlier text.

| ID | Question | Recommended default |
|---|---|---|
| OQ-01 | Must the Seller acknowledge receipt of the price before completion? | No in MVP; the Seller is notified and may dispute. Revisit after the first fraud cases |
| OQ-02 | Default commission rate and fixed fee | Not set by the client; the system requires both values before the first Deal can be approved |
| OQ-03 | Is there an official Fal registry to verify license numbers? | Manual admin check in MVP; add registry lookup later |
| OQ-04 | Order of activating Backup Offers after a Deal fails | Oldest approved Backup Offer first; admin chooses to proceed |
| OQ-05 | Area tolerance for Demand matching | ±20% of the required area |
| OQ-06 | Is an owner authorization document required for Marketer listings? | Yes, AdminOnly, required before submission |
| OQ-07 | Deadline passes while a proof is still unreviewed | Do not cancel while any payment is UnderReview or ProofUploaded and uploaded on time; admin must decide within a configurable grace period (default 12 h), then the job applies the result. Needs client decision |
| OQ-08 | Refund policy for the Owner contract fee if the listing never sells or the request is cancelled | Non-refundable once confirmed; documented in the contract template |
| OQ-09 | VAT and invoicing on the commission and the contract fee | Platform issues a tax invoice for each confirmed commission; confirm with the accountant |
| OQ-10 | Does the Buyer need stronger identity verification (for example national single sign-on)? | Existence check only in MVP (BR-10); plan integration later |
| OQ-11 | Legal validity of signature pad plus OTP | Confirm with legal counsel before go-live; keep the evidence set in UC-53 |
| OQ-12 | Saudi data residency, PDPL obligations and retention periods | Host in a Saudi region if required; retention per counsel |

# 14. Glossary

| Term | Meaning |
|---|---|
| Account | The single login identity tied to one verified Saudi mobile number |
| Role Profile | A Buyer, Marketer or Owner capability attached to an Account |
| Provider | A Marketer or Owner who can receive Demands and publish listings |
| Seller | The Provider who owns the listing and receives the property price |
| Fal license | The Saudi real estate brokerage license required for Marketers |
| Listing | A property offered for sale at a single ask price |
| Ask price | The Seller's price on the listing (BR-01) |
| Offer | A price proposal on a listing from a Buyer |
| Counter-offer | A new price proposed by either side; counted in NegotiationRound |
| Backup Offer | An offer made while the listing is Reserved |
| Proposal | A Provider's answer to a Demand, bound to one of their listings |
| Demand | A Buyer's property request that is matched to Providers automatically |
| Matching Engine | Component that finds qualifying Providers for a Demand (BR-12) |
| Deal | The record created only at final admin approval, with two payments |
| Commission | The platform fee paid by the Buyer to the platform (BR-02) |
| Price payment | The property price paid by the Buyer directly to the Seller (BR-04) |
| Payout account | The Seller's bank account (holder name and IBAN) for receiving the price |
| Payment proof | An uploaded document showing a bank transfer |
| PaymentDeadline | Deal creation time plus PaymentWindowHours (default 48) |
| Snapshot | Commission values frozen on the Deal at final approval |
| Mediation | Routing of all Buyer–Seller communication through Admin (BR-03) |
| Dispute | A case opened after a proof exists, which suspends automatic completion and timeout |
| Owner contract | The signed listing agreement between the platform and an Owner |
| Contract fee | The fee the Owner pays the platform before the listing is published |
| RBAC | Role-based access control for admin users |
| Audit event | An immutable record of a sensitive action (BR-19) |
| OtpProvider | The interface that delivers and verifies one-time codes |
| IBAN | International Bank Account Number; Saudi format is SA plus 22 digits |
| SAR | Saudi Riyal |
| PDPL | Saudi Personal Data Protection Law |
