# Product Brief Addendum: Technical & Operational Depth

This addendum preserves structural, architectural, and operational depth derived from SRS v2.2 to guide downstream BMAD artifacts (PRD, Architecture Spine, Epics & Stories, and Implementation).

---

## 1. Technical Architecture & Technology Baseline

### Monorepo Layout
```
/
├─ apps/
│  ├─ web/            Next.js App Router (React, TypeScript, Tailwind/Vanilla CSS, RTL Arabic primary)
│  └─ api/            NestJS (modular monolith, REST /api/v1, Swagger OpenAPI, pg-boss queue)
├─ packages/
│  └─ shared/         Zod validation schemas, domain enums, constants, typed generated API client
├─ docs/              SRS, PRD, architecture specifications, epics
└─ docker-compose.yml PostgreSQL, MinIO (S3-compatible object storage), Mail catcher
```

### Architectural Constraints
- **Separation of Concerns:** The Next.js web application acts strictly as a presentation layer. It possesses zero database access, no Prisma client, and no business logic secrets. All business rules, transactions, and state changes execute in the NestJS API.
- **State Changes via Explicit Action Endpoints:** Generic `PATCH /deals/{id}` status mutations are forbidden. Transitions map 1:1 to dedicated endpoints (e.g., `POST /deals/{id}/cancel`, `POST /payments/{id}/confirm`) backed by domain audit logging.
- **Database & Queue Strategy:** PostgreSQL serves as the relational store via Prisma ORM. Raw SQL migrations manage partial unique indexes (e.g., enforcing at most one non-terminal Deal per listing) and Arabic full-text/trigram indexes. Background asynchronous tasks run on `pg-boss` (Postgres-backed queue) avoiding Redis overhead in the MVP.
- **Object Storage & Security:** Private S3-compatible storage. Public URLs are disabled; all asset downloads occur via short-lived (<= 5 min) signed URLs. Identity documents, title deeds, Fal licenses, commercial registers, and payment proofs are strictly `AdminOnly`.
- **Sessions & CSRF:** HttpOnly, Secure, SameSite=Lax cookies sharing a registrable domain (`app.domain.sa` and `api.domain.sa`). Admin users authenticate against a completely isolated realm with independent tables, cookies, rate limits, and route prefixes (`/api/v1/admin`).

---

## 2. Financial Mechanics & Dual Payment Proof Engine

### Core Calculation & Snapshotting Rules
- **Decimal Precision:** All financial calculations operate on fixed-point decimals rounded half-up to two decimal places.
- **Commission Formulas:**
  - `EstimatedCommission = AskPrice × (CurrentCommissionRate / 100) + FixedCommission`
  - `FinalCommission = FinalDealPrice × (CommissionRateSnapshot / 100) + FixedCommissionSnapshot`
  - `FinalTotal = FinalDealPrice + FinalCommission`
- **Deal Snapshotting:** Upon final administrative approval (`UC-70B`), commission rates, fixed commission amounts, agreed deal price, total amounts, and seller payout IBAN are frozen onto the `Deal` record. Subsequent system settings modifications never alter in-flight or historic deals.

### Dual Proof Workflow
1. **Commission Payment:** Buyer transfers commission SAR to the platform bank account with a generated deal reference code.
2. **Price Payment:** Buyer transfers property purchase price SAR directly to the seller's verified Saudi IBAN (mod-97 validated).
3. **Admin Review Window:** The buyer has 48 hours (`PaymentDeadline`) to upload both proofs. Admins evaluate each proof independently. Once both are `Confirmed`, the system atomically executes completion: sets `Deal = Completed`, sets `Listing = Sold`, closes competing offers, and releases counterparty phone/email contact details.

---

## 3. Core State Transition Reference

- **Account & Role Profile:** `Active` ⇄ `Disabled` → `SoftDeleted` → `HardDeleted` (Hard delete permitted only with zero transactional history).
- **Fal License Profile:** `Draft` → `Submitted` → `UnderReview` → `Approved` / `Rejected` ⇄ `Resubmitted`. Expiration triggers daily background job → `ComplianceRestricted`.
- **Listing:** `Draft` → `Submitted` → `UnderReview` → `Active` → `Reserved` (Deal created) → `Sold` (Deal completed) or returns to `Active` on deal timeout/cancellation.
- **Owner Contract:** `Draft` → `Submitted` → `Approved` → `ApprovedPendingSignature` → `SignedPendingFee` (OTP + signature pad) → `FeeUnderReview` → `Active` (Listing published).
- **Deal:** `AwaitingPaymentProof` → `PaymentUnderReview` → `Completed` (both proofs confirmed) | `CancelledByBuyer` | `CancelledByTimeout` | `Disputed` → `CancelledByAdmin`.

---

## 4. Epic Roadmap & Delivery Sequence

The platform will be delivered across 8 focused epics:

| Epic | Name | Scope & Purpose | Priority |
|---|---|---|---|
| **E0** | **Platform Foundation** | Monorepo setup, CI/CD, NestJS skeleton, Prisma migrations, auth guards, OpenAPI generator, pg-boss worker, S3 file service, OTP provider abstraction, Next.js RTL shell. | **P0 (First)** |
| **E1** | **Identity, Access & RBAC** | Saudi mobile OTP registration, multi-role profile management, session handling, dynamic admin RBAC, audit logging. | **P0** |
| **E2** | **Seller Lifecycle & Governance** | Fal license validation, seller payout IBAN management, Owner contract generation and e-signing, listing creation and moderation. | **P0** |
| **E3** | **Property Discovery & Search** | Buyer home, multi-filter search, interactive map with colored clustered pins, favorites, seller public profiles. | **P0** |
| **E4** | **Negotiation, Deals & Payments** | Offer and counter-offer mediation, final deal approval, dual payment proof upload and review, 48h timeout worker, ratings. | **P0** |
| **E5** | **Buyer Demands & Auto-Matching**| Demand submission, automated provider inventory matching engine, provider proposal submission and review. | **P1** |
| **E6** | **Mediated Comms, Support & Disputes**| Admin-mediated chat threads, technical support tickets with SLA, violation reports, deal dispute resolution. | **P1** |
| **E7** | **Analytics, CMS & Operational Tools**| Financial indicators, KPI dashboards, CMS pages, banners, FAQ, bulk listing moderation, penalty tracking. | **P2/P3** |

---

## 5. Key Risk Mitigations & Open Questions

- **Marketer Fraud & Payout IBAN Security:** Payout account changes require OTP re-authentication and emit fraud alerts. IBANs are strictly validated against Saudi bank prefixes and mod-97 check digits.
- **Payment Deadline Edge Case (OQ-07):** If a buyer uploads valid proofs near the 48-hour boundary, the automated timeout job does not cancel the deal while payments remain in `ProofUploaded` or `UnderReview`. Admins receive SLA notifications with a configurable 12-hour review grace period.
- **Immediate Next Step:** Implementation of **Epic E0 (Platform Foundation)** to establish the shared packages, database models, API scaffolding, and web workspace before activating functional domain epics.
