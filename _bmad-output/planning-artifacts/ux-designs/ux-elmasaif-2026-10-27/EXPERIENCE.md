---
name: elmasaif
status: final
sources:
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-elmasaif-2026-10-26/brief.md
  - _bmad-output/ideal.md
updated: 2026-10-27
---

# El Masaif (المصايف) — Experience Spine (EXPERIENCE.md)

## Foundation

**El Masaif** is a high-performance single-surface responsive web application engineered for desktop, tablet, and mobile browsers, built with **Next.js (App Router), React, TypeScript, and Tailwind CSS**. It pairs with an administrative back-office interface served by the same presentation layer and backed by an independent **NestJS REST API (`/api/v1`)**, a standalone background **Worker process (`apps/worker`)** powered by `pg-boss`, and a relational **PostgreSQL** database.

- **Strict Presentation Separation:** Next.js operates presentation-only with zero direct database access, no Prisma client, and no server mutations. All business logic, authorization guards, and state transitions execute within the NestJS API.
- **Visual Reference:** [`DESIGN.md`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md) is the binding visual identity reference. This document specifies the behavioral, architectural, interaction, and state contracts. Tokens are referenced via `{path.to.token}` syntax.
- **RTL-Native Sovereign Environment:** The entire application renders with `dir="rtl"` and `lang="ar"` as the primary layout root. Complete LTR layout rules apply when language is set to English (`dir="ltr"`).
- **Multi-Role Single Identity:** A single registered Saudi user can hold multiple operational profiles (`Buyer`, `Marketer`, `Owner`) linked to a single verified mobile number and national identifier, switching effortlessly through a unified role-switcher without re-authenticating. Admin users operate under a distinct authentication realm, independent database table, separate session cookies, and guards (`/admin`).

---

## Information Architecture

### Public Marketplace & Portals

| Surface | Path / Route | Reached From | Purpose & Key Features |
|---|---|---|---|
| **Marketplace Home** | `/` | Direct / Logo click | Search hero, property categories (Villa, Land, Apartment, Building, Office), featured verified properties, interactive map preview. |
| **Search & Discovery** | `/properties` | Search bar / Nav link | Dual view: split interactive map + listing cards with instant filtering (City, District, Price bounds, Bedrooms, Area, Fal-licensed only). |
| **Property Detail** | `/properties/:id` | Card click / Map pin | 16:9 photo carousel, single ask price, dynamic commission calculator (2.5% + fixed fee), verified specs, amenities, seller broker badge (shielded phone), "Submit Offer" / "Inquire" actions. |
| **Buyer Demands Portal** | `/demands` | Navigation bar | Public directory of active buyer demands. Providers browse and submit matching proposals. |
| **Static Content & CMS** | `/pages/:slug` | Footer / Banners | Informational pages, FAQ, regulatory guides, terms, privacy policy (`FR-64`). |
| **User Authentication** | `/auth/login`, `/auth/register` | Header CTA | Saudi mobile OTP onboarding (`+9665XXXXXXXX`), password login, step-up OTP, legal consent logging (`FR-1`, `FR-2`). |
| **Forgot Password** | `/auth/forgot-password` | Login modal | Anti-enumeration phone input, 6-digit OTP verification, new password configuration (`FR-46`). |
| **Terms & Privacy Consent** | `/auth/consent` | Login post-check | Blocking modal triggered on `termsVersion` or `privacyVersion` increment (`FR-1`). |

### Authenticated User Workspaces (`/app/*`)

| Surface | Path / Route | User Roles | Purpose & Key Features |
|---|---|---|---|
| **Buyer Dashboard** | `/app/buyer` | Buyer | Active offers in negotiation, saved favorite properties, deal pipeline shortcuts, active buying demands (`FR-59`). |
| **Offer Negotiation** | `/app/buyer/offers/:id` | Offers list / Notification | Real-time negotiation timeline, current ask vs offer vs counter-offer, admin mediation status pill, accept/counter actions (`FR-55`). |
| **Deal & Dual Payment** | `/app/buyer/deals/:id` | Deal notification | 48-hour deal countdown timer, dual payment cards (Platform commission to Platform IBAN with reference code `ELM-xxx-C`; Property price to Seller verified IBAN), dual receipt upload zones, bank transfer status tracking. |
| **Buyer Demands Manager** | `/app/buyer/demands` | Buyer | Create, monitor, and cancel structured property requests (30-day lifecycle) with budget and location tolerances (`FR-21`, `FR-58`). |
| **Marketer Workspace** | `/app/marketer` | Marketer | Fal license onboarding & status tracker, listing management, active inventory, incoming buyer inquiries, deal commissions pipeline (`FR-59`). |
| **Marketer New Listing** | `/app/marketer/listings/new` | Marketer | Multi-step property wizard: basic info, specs, media uploads (3 to 20 photos, up to 10 MB each), title deed upload (`AdminOnly`), owner authorization certificate (`AdminOnly`), payout IBAN selection (`FR-11`). |
| **Owner Workspace** | `/app/owner` | Owner | Direct property listing requests, electronic contract status, payout account settings (`FR-59`). |
| **Owner Contract Sign** | `/app/owner/contracts/:id` | Owner workspace / SMS | Electronic listing contract review, smooth canvas signature pad, 6-digit OTP verification stamp, listing fee transfer proof upload (SAR 1,000) (`FR-9`, `FR-10`). |
| **User Profile & Verification** | `/app/settings/profile` | All users | Name and email editing (mandatory verification link for email changes per `FR-49`), commercial name mismatch warning (`FR-5`), Saudi IBAN payout management. |
| **Security & Password** | `/app/settings/password` | All users | Change password requiring current password (failed attempts count toward lockout), revokes other sessions (`FR-47`). |
| **Mobile Number Update** | `/app/settings/mobile` | All users | Dual-OTP phone change wizard (both verified within 15 min per `FR-48`) and support-assisted request path (`Users.PhoneChange`). |
| **Preferences & Theme** | `/app/settings/preferences` | All users | Language selection (Arabic RTL / English LTR), dark mode toggle, and notification channel preferences (`FR-60`). |
| **Account Deletion** | `/app/settings/delete-account` | All users | Password + OTP confirmed account deletion request, 14-day cooling-off period (`DeletionPending`), statutory retention warning (`FR-50`). |

### Admin Back-Office (`/admin/*`)

| Surface | Path / Route | Permissions | Operational Purpose |
|---|---|---|---|
| **Operations Dashboard** | `/admin` | `Admin:Read` / `FR-66` | Centralized overview: queue backlogs, pending SLA deadlines, active deals, task lease counters (`FR-66`). |
| **Claimable Queues** | `/admin/queues` | `Tasks:Claim` / `FR-51` | Unified queue for claimable items with explicit POST claim (`FR-51`), 15-min lease, 5-min heartbeat, and read-only inspection banner for other admins. |
| **Listing Moderation** | `/admin/listings/:id` | `Listings.Review` | Audit submitted listings with 15-min exclusive lock, inspect title deeds and owner authorizations, approve to `Active`, reject with structured reason, or propose price revision (`FR-13`, `FR-57`). |
| **Fal Licensing Queue** | `/admin/licenses/:id` | `Licenses.Review` | Audit Marketer Fal license certificates with 15-min exclusive lock against REGA registry, approve or reject broker profiles (`FR-6`, `FR-8`). |
| **Mediation Queue** | `/admin/negotiations/:id` | `Offers.Review` | Review buyer offers and seller counter-offers with 15-min exclusive lock, approve or reject terms before relaying, prevent bypass attempts (`FR-26`, `FR-55`). |
| **Payment Verification** | `/admin/payments/:id` | `Payments.Review` | Audit uploaded bank transfer receipts (each payment claimed separately, `FR-51`) against bank references and IBANs, trigger atomic deal completion. Separation of duties strictly enforced (`FR-31`). |
| **Owner Contracts Queue** | `/admin/contracts/:id` | `Contracts.Review` | Review owner listing requests, select contract template (`FR-61`), set fee or override (`Contracts.FeeOverride`), verify fee transfer proofs with 15-min exclusive lock (`FR-69`). |
| **Review Moderation Queue** | `/admin/reviews` | `Reviews.Moderate` | Audit submitted ratings; hide abusive reviews with mandatory justification logged to `AuditLog`, or restore hidden reviews (`FR-52`). |
| **Geographic Master Data** | `/admin/geo` | `Geo.Manage` | Manage Cities and Districts with `isActive` toggles, preventing free-text additions (`FR-53`). |
| **Financial Reports & Invoices**| `/admin/finance` | `Finance.View` | View platform financial indicators, export PDF/Excel transaction reports (`FR-63`), and review gapless invoice records (`FR-68`). |
| **Penalties & Fraud Log** | `/admin/fraud` | `Compliance.Manage` | Monitor system-generated fraud events (repeated rejected proofs, IBAN changes) and record compliance penalties (`FR-62`). |
| **CMS & Templates** | `/admin/cms` | `CMS.Manage` | Manage static legal pages, banners, FAQ, and notification email templates (`FR-64`). |
| **Audit Log & System Jobs** | `/admin/system` | `Audit.View` | Immutable append-only event log, worker process scheduler status (`pg-boss`), force-unlock audit history (`Tasks.ForceUnlock`). |

---

## Voice and Tone (Microcopy)

El Masaif communicates with the legal precision of a certified notary and the clarity of an institutional wealth manager. Microcopy is concise, encouraging, authoritative, and strictly free of casual internet slang or emojis.

| Situation / Action | Recommended Microcopy (Do) | Discouraged Microcopy (Don't) |
|---|---|---|
| **Buyer submitting an offer** | "تقديم عرض شراء ملزم خاضع لتدقيق المنصة" | "أرسل سومك للبائع مباشرة 🚀" |
| **Offer in Admin Mediation** | "العرض قيد المراجعة والتدقيق الإداري لضمان جدية الطرفين" | "ننتظر موافقة الأدمن قريباً" |
| **Dual Wire Transfer Screen** | "يرجى تحويل سعي المنصة إلى حساب المنصة المعتمد، وقيمة العقار مباشرة إلى حساب البائع الموثق" | "سدد الرسوم والفلوس هنا" |
| **Reference Code Copy** | "تم نسخ رمز مرجع التحويل بنجاح: استخدم هذا الرمز في وصف الحوالة البنكية" | "تم النسخ!" |
| **Fal License Upload** | "التحقق من رخصة فال العقارية لضمان موثوقية المعلن ونظامية الوساطة" | "ارفع رخصتك عشان تتفعل" |
| **48-Hour Deadline Warning** | "رفع إيصال التحويل يوقف الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة في حال الرفض دون إلغاء فوري." | "الحق هيلغى حجزك!" |
| **Deal Completion Climax** | "تمت الصفقة بنجاح: تم فك حجب بيانات البائع المباشرة لبدء إجراءات الإفراغ العقاري" | "مبروك! اشتريت العقار 🎉" |
| **Admin Queue Locked** | "قيد التدقيق بواسطة زميل آخر (متبقي [دقائق : ثواني]). العرض متاح للقراءة فقط." | "ممنوع الدخول" |
| **Account Deletion Cooling-Off** | "تم تسجيل طلب حذف الحساب: لديك مهلة 14 يوماً لإلغاء الطلب بمجرد تسجيل الدخول." | "وداعاً، تم مسح بياناتك!" |
| **Commercial Name Mismatch** | "تنبيه نظامي: الاسم التجاري المعدل لا يتطابق مع الاسم المسجل في رخصة فال أو الحساب البنكي." | "اسمك غير مطابق!" |

---

## Component Patterns (Behavioral)

### 1. Dual Wire Transfer Card
- **Behavior:** Renders two segregated action cards on `/app/buyer/deals/:id`.
  - **Platform Commission Card:** Positioned first (rightmost in RTL). Contains platform IBAN, generated Reference Code (`ELM-408-C`), and a dedicated file upload zone for the platform fee receipt.
  - **Seller Purchase Price Card:** Contains the seller's verified name and verified personal Saudi IBAN, alongside the property price receipt upload zone.
- **Copy Mechanism:** Clicking the copy icon beside any IBAN or Reference code copies the raw unspaced string into clipboard and flashes a green "تم النسخ" tooltip for 2 seconds.
- **Upload Validation:** Client checks MIME type (PDF, PNG, JPG, WebP) and restricts file size to <= 10 MB. Pre-persistence quarantine malware scanning hook (`NFR13`) validates payload; only files marked `Clean` are served. Once uploaded, a thumbnail preview with file name and size is displayed with a "Replace" or "Remove" option.

### 2. Deal Payment Timing, Grace Period & Review SLA Tiers (FR-30, FR-31, FR-33, BR-08, OQ-07)
- **Upload Deadline:** `PaymentDeadline = Deal.createdAt + PaymentWindowHours` (system setting, default 48h). This is the deadline for *uploading* proofs, not for confirmation.
- **On-Time Upload Protection:** Uploading proof before the deadline pauses cancellation while status is `ProofUploaded` or `UnderReview`. The timeout cron never cancels a deal while any payment is under review.
- **Correction Window on Rejection:**
  - A proof rejected before the deadline can be re-uploaded until the deadline.
  - A proof rejected at or after the deadline receives one correction window of `PaymentCorrectionHours` (setting, default 12h) from rejection time. If no replacement arrives, that payment becomes `Expired`.
- **Administrative Review SLA Tiers (24/7 calendar unless business hours configured):**
  - **Tier 1 (4 hours):** Alert dispatched to support admins if proof remains unreviewed.
  - **Tier 2 (12 hours):** High-priority escalation dispatched to Super Admin.
  - **Tier 3 (24 hours):** Mandatory Super Admin decision required, limited to Confirm or Reject with reason (does not cancel the deal).
- **Post-Deadline Evaluation Matrix (evaluated when no proof is pending review or in correction window):**
  - Both Confirmed → Deal `Completed`.
  - Price Confirmed, Commission Expired → Deal transitions to `Disputed` (Super Admin adjudication).
  - Commission Confirmed, Price Expired → `Deal = CancelledByTimeout` (flagged for commission refund review).
  - Both Expired → `Deal = CancelledByTimeout`, listing reverts to `Active`.
- **Fraud Log Trigger:** Repeated rejected proofs trigger fraud events when threshold reaches `FraudRejectedProofThreshold` (default 3) within `FraudWindowHours` (default 72).

### 3. Offer & Counter-Offer Negotiation Timeline
- **Behavior:** Chronological vertical thread showing offer history.
  - Buyer offer SAR 2,950,000 -> Admin approved and dispatched -> Seller counter-offer SAR 3,000,000 -> Buyer pending acceptance.
- **Action Tray (UX-DR10):** Fixed sticky bottom bar on mobile with two primary options: "قبول العرض" (Emerald button) or "تقديم عرض مقابل جديد" (Outlined button).
- **Round Limits:** Enforces `MaxCounterRounds` (default 5 rounds) and `OfferExpiryDays` (default 7 days).
- **Mediation Transparency:** A security badge reminds users: "كافة المفاوضات تتم تحت إشراف المنصة لحماية حقوق الطرفين وعدم كشف بيانات التواصل إلا بعد إتمام الصفقة".

### 4. Owner Electronic Signature & OTP Stamping (FR-9, FR-10)
- **Canvas Behavior:** Provides touch and mouse drawing surface with stroke smoothing. Controls: "مسح التوقيع" to reset, "اعتماد التوقيع" to progress.
- **OTP Stamping:** Displays a 6-digit numeric input with automatic focus hopping. Upon typing the 6th digit, the system submits the verification payload with timestamp, IP, user agent, and signature raster. In development mode with static provider, entering `123456` immediately validates.
- **Fee Payment Window:** Transitions to `SignedPendingFee` with a 7-day payment window (`ContractFeeDeadline`). If fee proof is not uploaded within 7 days, the contract transitions to `Expired`.

### 5. Interactive Split Map & Listing Grid
- **Behavior:** On desktop (`lg+`), the screen splits 50/50: sticky map on left, scrollable listing cards on right. On mobile, a floating pill button toggles between "عرض الخريطة 🗺️" and "عرض القائمة 📋".
- **Map Interaction:** Panning or zooming recalculates bounding box and fetches matching properties with a 300ms debounce. Hovering over a card pulses its map pin; clicking a marker opens a preview card.

### 6. Admin Task-Claim Locking in Operational Queues (FR-51, UX-DR15, AR12)
- **Claim Mechanism:** Task claim is strictly an explicit `POST /api/v1/admin/<queue>/<id>/claim`, never triggered by a `GET` request or page navigation.
- **Atomic Lease:** An atomic conditional `UPDATE` assigns `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` (+15 minutes) only if currently unlocked or expired.
- **Heartbeat & Release:** A client-side heartbeat renews the lock every 5 minutes while active. The lock is released upon submitting a decision or navigating away.
- **Concurrent Inspection:** Other admins viewing a locked item see an informative read-only banner ("قيد المعالجة حالياً بواسطة [اسم المسؤول]"), with all decision and mutation buttons disabled.
- **Super Admin Override:** Users with `Tasks.ForceUnlock` permission can force-release any lock, requiring a mandatory justification reason logged directly to `AuditLog`.
- **Optimistic Concurrency Preserved:** A task lock never replaces the optimistic concurrency version check (`If-Match`); stale concurrent decisions return HTTP 409 Conflict.
- **Covered Entities:** Applies to 8 domain queues: `Listing`, `FalProfile`, `OwnerListingRequest`, `Payment` (each payment separately, NOT PaymentProof), `ContractFeePayment`, `Conversation`, `Dispute`, and `Offer`.
- **Separation of Duties:** An admin who approves a payment proof cannot execute final deal approval on that same transaction.

### 7. Cascading City & District Master Selector (FR-53)
- **Behavior:** Selection is strictly constrained to master Saudi geographic records (`City` and `District`). Selecting a City loads its corresponding active Districts dynamically. Unstructured free text input is rejected. Deactivated entities remain on historical listings but cannot be selected for new listings.

### 8. User Security & Account Lifecycle Flows (FR-46 to FR-50)
- **Forgot Password Flow (`/auth/forgot-password`, FR-46):**
  - Mobile number input with identical response timing and generic success feedback regardless of account existence (prevents phone enumeration).
  - 6-digit OTP verification screen; locks reset attempts for 15 minutes upon 3 failed attempts.
  - New password input validating difference from current password; revokes all active sessions upon completion.
- **Change Password Dialog (`/app/settings/password`, FR-47):**
  - Requires current password (failed attempts count toward account lockout and trigger `AUTH_INVALID_CREDENTIALS`).
  - Confirms new password, invalidates all other active user sessions, and sends security alert notifications.
- **Change Mobile Number Wizard (`/app/settings/mobile`, FR-48):**
  - Step 1: OTP sent to existing registered number.
  - Step 2: OTP sent to new number (validated as unique, returning `AUTH_PHONE_IN_USE` if registered).
  - Both steps must complete within 15 minutes. Operation blocked if any deal is in non-terminal payment stages.
  - Support-assisted path for lost numbers requiring identity document upload and admin verification (`Users.PhoneChange`).
- **Edit Profile & Email Verification (`/app/settings/profile`, FR-49):**
  - Edit name and email address. Updating email displays a pending verification banner until the user opens the mandatory link. Commercial name mismatch triggers compliance warning per FR-5.
- **Account Deletion Flow (`/app/settings/delete-account`, FR-50):**
  - Requires password and OTP re-authentication. Blocked if any deal, dispute, or contract is non-terminal.
  - Zero transaction history: transitions to `DeletionPending` with 14-day cooling-off period. Logging in cancels the request. Upon expiry, personal data is erased.
  - Historical transactions: placed in `Deactivated` status (login disabled, public profile hidden, active listings archived) while transaction records are retained under statutory Saudi retention schedules.

### 9. Buyer Rating Submission & Seller Reputation (FR-54, FR-19, FR-52)
- **Submission Trigger:** Unlocked exclusively upon atomic deal completion (`Deal = Completed`).
- **Input Parameters:** 1 to 5 integer stars and an optional written comment up to 500 characters. Strictly permitted once per completed deal.
- **Public Profile Display:** Displays average star rating, total deal count, active listings, and qualitative reviews.
- **Admin Moderation:** Admins with `Reviews.Moderate` can hide reviews with a mandatory reason. Hidden reviews are excluded from seller averages, but preserved in `AuditLog`.

### 10. Buyer Demands & Provider Proposals (FR-21 to FR-24, FR-58)
- **Demand Creation:** Free submission specifying budget, structured `cityId`, optional `districtId`, property type, and area. Immediately transitions to `Active` with a 30-day lifecycle.
- **Matching Engine:** Automatically matches against active Provider inventory with identical property type, city, `askPrice <= budget`, and area within ±20% tolerance.
- **Proposal Submission:** Provider attaches active listing; requires admin review (`PendingAdminReview` -> `ApprovedForBuyer`).
- **Buyer Selection:** Buyer selects approved proposal, advancing to `SelectedPendingFinalAdminApproval` for admin deal creation.

---

## State Patterns

### 1. Deal State Transitions

| Initial State | Target State | Triggering Action / Event | Actor |
|---|---|---|---|
| *(none)* | `AwaitingPaymentProof` | Final deal approval granted (`UC-70B`) | Admin (`Deals.FinalApprove`) |
| `AwaitingPaymentProof` | `PaymentUnderReview` | First payment proof uploaded (`UC-28`) | Buyer |
| `PaymentUnderReview` | `AwaitingPaymentProof` | Proof rejected and no other proof currently pending | System / Admin |
| `AwaitingPaymentProof` | `CancelledByBuyer` | Buyer cancels deal prior to uploading any proof (`UC-29B`) | Buyer |
| `AwaitingPaymentProof` | `CancelledBySeller` | Seller cancellation approved prior to proof upload (`UC-46`) | Admin |
| `AwaitingPaymentProof` / `PaymentUnderReview` | `CancelledByTimeout` | 48-hour deadline passed without on-time pending review (`UC-29A`) | System Scheduler |
| `PaymentUnderReview` | `Completed` | Both payments (Commission & Price) Confirmed (`UC-29`) | System (via Admin UC-71) |
| `PaymentUnderReview` | `Disputed` | Dispute filed after proof upload (`UC-29C`) | Buyer / Seller |
| `Disputed` | `PaymentUnderReview` | Admin returns dispute to review queue (`UC-70C`) | Admin (`Deals.DisputeResolve`) |
| `Disputed` | `Completed` | Admin settles dispute by confirming completion (`UC-70C`) | Admin (`Deals.DisputeResolve`) |
| `Disputed` | `CancelledByAdmin` | Admin settles dispute by cancelling deal (`UC-70C`) | Admin (`Deals.DisputeResolve`) |

*Note: Terminal states are `Completed`, `CancelledByBuyer`, `CancelledBySeller`, `CancelledByTimeout`, and `CancelledByAdmin`.*

### 2. Dual Payment State Transitions (Commission & Price)

| Initial State | Target State | Triggering Action / Event | Actor |
|---|---|---|---|
| `Pending` | `ProofUploaded` | Buyer uploads wire transfer receipt (`UC-28`) | Buyer |
| `ProofUploaded` | `UnderReview` | Admin opens proof in review queue | Admin (`Payments.Review`) |
| `ProofUploaded` / `UnderReview` | `Confirmed` | Admin verifies and approves proof (`UC-71`) | Admin (`Payments.Review`) |
| `ProofUploaded` / `UnderReview` | `Rejected` | Admin rejects proof with mandatory reason (`UC-71`) | Admin (`Payments.Review`) |
| `Rejected` | `ProofUploaded` | Buyer re-uploads replacement proof before deadline or during 12h correction window | Buyer |
| `Pending` / `ProofUploaded` / `Rejected` | `Expired` | Deal cancels or times out (`UC-29A`) | System Scheduler |

### 3. Property Listing State Transitions

| Initial State | Target State | Triggering Action / Event | Actor |
|---|---|---|---|
| `Draft` | `Submitted` | Creator submits listing for review (`UC-34`) | Marketer / Owner |
| `Submitted` | `UnderReview` | Listing enters admin moderation queue | System |
| `UnderReview` | `Active` | Admin approves listing (`UC-63`) | Admin (`Listings.Review`) |
| `UnderReview` | `Rejected` | Admin rejects listing with notes | Admin (`Listings.Review`) |
| `Active` | `Reserved` | Deal created via Final Approval (`UC-70B`) | Admin (`Deals.FinalApprove`) |
| `Reserved` | `Sold` | Deal atomically completes (`UC-29`) | System |
| `Reserved` | `Active` | Deal cancelled or times out (`UC-29A`, `UC-29B`) | System |
| `Active` | `UnderReview` | Major edit made (ask price, location, type) | Marketer / Owner |
| `Active` | `Archived` | Creator archives listing (no active deal) (`UC-39`) | Marketer / Owner |
| `Active` / `Reserved` | `Hidden` | Admin hides listing for non-compliance (`UC-66`) | Admin (`Listings.Compliance`) |
| `Active` / `Reserved` | `Blocked` | Admin blocks listing permanently (`UC-66`) | Admin (`Listings.Compliance`) |
| `Active` | `UnderComplianceReview` | Marketer Fal license expires (`UC-43`) | System Scheduler |
| `UnderComplianceReview` | `Active` | Marketer Fal renewal approved (`UC-43`) | Admin (`Licenses.Review`) |

### 4. Owner Listing Contract State Transitions

| Initial State | Target State | Triggering Action / Event | Actor |
|---|---|---|---|
| *(none)* | `Draft` | Owner submits listing request (`UC-50`) | Owner |
| `Draft` | `Submitted` | Request routed to admin | Owner |
| `Submitted` | `ApprovedPendingSignature` | Admin selects template and sets fee (`UC-67`) | Admin (`Contracts.Review`) |
| `ApprovedPendingSignature` | `SignedPendingFee` | Owner signs electronically via OTP (`UC-53`) | Owner |
| `SignedPendingFee` | `FeeUnderReview` | Owner uploads contract fee bank proof (`UC-55`) | Owner |
| `FeeUnderReview` | `Active` | Admin confirms fee proof; listing published (`UC-68A`) | Admin (`ContractFees.Review`) |
| `FeeUnderReview` | `FeeRejected` | Admin rejects proof with reason; re-upload allowed | Admin (`ContractFees.Review`) |
| `SignedPendingFee` | `Expired` | 7-day payment window expires without proof | System Scheduler |
| `Active` | `Completed` | Underlying listing deal completes (`UC-29`) | System |

### 5. Fal License Profile State Transitions

| Initial State | Target State | Triggering Action / Event | Actor |
|---|---|---|---|
| *(none)* | `Draft` | Marketer begins onboarding | Marketer |
| `Draft` | `Submitted` / `UnderReview`| Marketer submits certificate and CR (`UC-04`) | Marketer |
| `UnderReview` | `Approved` | Admin validates certificate (`UC-62`) | Admin (`Licenses.Review`) |
| `UnderReview` | `Rejected` | Admin rejects with documented reason | Admin (`Licenses.Review`) |
| `Rejected` | `Resubmitted` / `UnderReview`| Marketer corrects details and re-submits (`UC-05A`)| Marketer |
| `Approved` | `ComplianceRestricted` | License expiry date reached without renewal | System Scheduler |
| `ComplianceRestricted` | `RenewalUnderReview` | Marketer submits renewed certificate (`UC-43`) | Marketer |
| `RenewalUnderReview` | `Approved` | Admin approves renewal (`UC-62`) | Admin (`Licenses.Review`) |

### 6. Account Lifecycle States

- **Active:** Normal operating account. Full access to linked role profiles.
- **DeletionPending:** 14-day cooling-off window in effect. Logging in cancels deletion and restores to `Active`.
- **Deactivated:** Account deactivated with historical financial/transactional records retained under statutory Saudi retention schedules. Login refused.
- **Disabled:** Administratively suspended due to compliance or fraud violations.
- **SoftDeleted:** Erased account with zero transaction history after 14-day cooling-off period.

### 7. UI States per IA Surface

- **Empty State:** Sunken surface (`{colors.surface-sunken}`), minimalist institutional emblem, no cartoonish illustrations, action button to create or search.
- **Skeleton / Loading State:** Animated pulse over neutral grey surfaces matching final typography and card dimensions.
- **Focus State:** 3px emerald halo (`{colors.primary}`) with clear offset on all interactive inputs and buttons.
- **Error / Validation State:** Inline red alert (`{colors.status-danger}`) with descriptive Arabic helper text connected via `aria-describedby`.
- **Read-Only / Leased State:** Amber lock banner (`{colors.status-pending-bg}`) displayed when another administrator holds an active lease, disabling all mutation buttons.

---

## Interaction Primitives

- **Keyboard Navigation:**
  - `Esc`: Closes any open modal, preview sheet, or full-screen image gallery.
  - `Enter`: Submits active form or confirms dialog choice.
  - `Tab` / `Shift+Tab`: Logical RTL focus traversal throughout form fields and action buttons.
- **Touch & Mobile Gestures:**
  - Swipe horizontally on property photo carousels.
  - Pull-to-refresh on dashboard negotiation feeds.
  - Bottom sheet dialogs for filters on mobile screens with drag-down-to-dismiss handle.
- **Debounced Inputs:**
  - Search inputs and map panning trigger queries with a 300ms debounce.
- **Clipboard Confirmation:**
  - Clicking copy on Saudi IBANs or Deal reference codes triggers instant toast feedback ("تم نسخ رمز مرجع التحويل بنجاح").

---

## Accessibility Floor (WCAG 2.1 AA)

- **Contrast:** All text meets or exceeds 4.5:1 contrast against its background (`#0F172A` on `#F8FAF9` = 14.8:1; `#1B4332` on white = 8.6:1).
- **RTL Assistive Technology:** Screen readers announce headings, landmarks (`main`, `nav`, `aside`), and dynamic alert regions (`aria-live="polite"` for deal timer updates and message arrival).
- **Form Association:** Every input possesses an explicit `<label>` connected via `htmlFor`/`id`. Error states provide descriptive `aria-describedby` announcements in Arabic.
- **Focus Indicators:** High-visibility 3px emerald outline (`{colors.primary}`) with clear offset on all interactive elements during keyboard navigation.

---

## Key Flows (Named-Protagonist Journeys)

### Journey 1: Tariq Executes a Villa Purchase via Dual Wire Transfer (UJ-1)
- **Protagonist:** Tariq (38, Financial Analyst in Riyadh, buying a family home).
- **Entry State:** Authenticated via Saudi mobile OTP on the responsive web application (`/app/buyer`), profile status `Active`, national ID document uploaded.
- **Steps:**
  1. Tariq browses Riyadh villas using the interactive map with green markers and filters for 4+ bedrooms and budget cap SAR 3,200,000.
  2. He inspects Listing #1042 (ask price: SAR 3,100,000). The dynamic fee calculator shows estimated commission SAR 77,500 (2.5%) and estimated total SAR 3,177,500.
  3. Tariq submits a formal offer of SAR 2,950,000. The offer enters the Admin Review Queue.
  4. Platform Admin approves and relays the offer to the seller. The seller counter-offers SAR 3,000,000. Tariq receives an in-app notification and accepts.
  5. Admin reviews the accepted negotiation and triggers Final Approval. Deal #408 is created with `status: AwaitingPaymentProof` and a 48-hour payment countdown timer begins. Listing #1042 becomes `Reserved`.
  6. The Deal screen displays frozen financial snapshots: Deal Price SAR 3,000,000, Platform Commission SAR 75,000 (2.5%), Total SAR 3,075,000. It displays:
     - Payment 1 (Commission): Platform IBAN + generated Deal Reference Code (`ELM-408-C`).
     - Payment 2 (Price): Seller's verified Saudi IBAN and account holder name.
  7. Tariq executes two external wire transfers via his bank mobile app, uploads PDF receipts for both, and submits before the deadline.
- **Climax Beat:** Admin confirms both proofs. System atomically transitions Deal to `Completed`, sets Listing to `Sold`, releases the seller's direct phone number to Tariq, and unlocks the seller rating form.
- **Failure Path / Edge Case:** If Tariq's commission receipt is rejected by admin after the 48-hour mark, he receives a 12-hour correction window alert. Uploading the correct receipt pauses cancellation; once confirmed, the deal completes normally.

### Journey 2: Sara Onboards as a Fal-Certified Marketer and Publishes a Commercial Office (UJ-2)
- **Protagonist:** Sara (Licensed Broker in Jeddah).
- **Entry State:** Registered account holder on desktop browser, toggles account role to `Marketer`.
- **Steps:**
  1. Sara submits her business credentials: Fal license number, certificate PDF, license expiry date, commercial name, and 10-digit Commercial Registration (CR) number.
  2. Her profile enters `UnderReview`. While awaiting approval, she navigates to Payout Settings and adds her verified Saudi IBAN (mod-97 validated).
  3. Support Team verifies her Fal certificate in the Admin Licensing Queue and approves the profile. Sara receives notification and unlocks the Marketer Workspace (`/app/marketer`).
  4. Sara creates a listing for a commercial office in Al-Rawdah, Jeddah: ask price SAR 1,850,000, property specs, 8 high-resolution photos, title deed document (`AdminOnly`), owner authorization certificate (`AdminOnly`), and selects her registered payout IBAN.
  5. Admin compliance reviews the authorization and listing parameters, approving it to `Active`.
- **Climax Beat:** Sara's listing appears on the public marketplace with her public broker rating and active listing tally; her personal phone and email remain completely shielded from cold callers.
- **Failure Path / Edge Case:** When Sara's Fal license reaches 30 days, 7 days, and 1 day before expiration, the system issues compliance warnings. If unrenewed upon expiration date, a daily cron job automatically flags her profile `ComplianceRestricted` and transitions her active listings to `UnderComplianceReview`.

### Journey 3: Abu Fahad Signs an Electronic Listing Contract as a Direct Owner (UJ-3)
- **Protagonist:** Abu Fahad (60, Owner in Dammam selling a commercial building).
- **Entry State:** Authenticated user, selects `Owner` role profile.
- **Steps:**
  1. Abu Fahad enters `/app/owner` and submits a Listing Request for his building: property details, title deed copy (`AdminOnly`), ask price SAR 4,500,000, and his verified personal Saudi IBAN.
  2. Admin evaluates the request and selects the Standard Owner Listing Contract Template, assigning a default contract fee of SAR 1,000.
  3. Abu Fahad receives an in-app alert: "Listing Contract Ready for Signature."
  4. He reviews the contract terms on the web interface, draws his signature on the signature pad, and enters a 6-digit OTP code received on his phone.
  5. Abu Fahad initiates a bank transfer of SAR 1,000 to the platform bank account and uploads the wire receipt.
- **Climax Beat:** Admin confirms the contract fee proof. The listing transitions automatically from pending fee to `Active` on the marketplace.
- **Failure Path / Edge Case:** If the contract fee proof is rejected due to an incorrect reference number, Abu Fahad is notified with the exact admin reason and can re-upload a corrected bank receipt before the 7-day contract deadline expires.

### Journey 4: Mansour Broadcasts a Buyer Demand and Closes via Automated Inventory Matching (UJ-4)
- **Protagonist:** Mansour (Investment Manager in Al-Khobar looking for residential land plots).
- **Entry State:** Authenticated Buyer on mobile web.
- **Steps:**
  1. Mansour opens `/app/buyer/demands` and clicks "Submit Demand."
  2. He specifies: City = Al-Khobar, Property Type = Land, Budget = SAR 2,000,000, Required Area = 600 m² (with implicit ±20% tolerance: 480–720 m²), and notes on soil condition.
  3. Submitting the Demand is free; the Demand transitions immediately to `Active` with an expiry window of 30 days.
  4. The platform Matching Engine scans active inventory and identifies qualifying Providers with active matching listings.
  5. Marketer Hisham receives an instant Demand notification and attaches his active Land Listing #882 as a formal Proposal with an offered price of SAR 1,950,000.
  6. Admin performs content review and approves the proposal for buyer visibility.
- **Climax Beat:** Mansour receives the approved proposal on his Demand dashboard, compares the land specs, and clicks "Select Offer," advancing the proposal to `SelectedPendingFinalAdminApproval` for Admin to generate the Deal.
- **Failure Path / Edge Case:** If the seller rejects or Admin denies final approval, Mansour's Demand returns to `Active` status, enabling him to choose alternative proposals or await new matches.

### Journey 5: Khalid (Support Admin) Mediates an Offer and Validates Dual Bank Proofs (UJ-5)
- **Protagonist:** Khalid (Platform Operations Specialist in Riyadh managing the Admin Back-Office).
- **Entry State:** Authenticated in the dedicated Admin Realm with role `Support Team` (permissions `Offers.Review`, `Deals.View`, `Payments.Review`, `Conversations.Handle`).
- **Steps:**
  1. Khalid monitors the Admin Dashboard. An alert highlights an incoming buyer inquiry on Listing #1042 containing a masked phone number attempt ("050-XXXXXXX").
  2. Khalid reviews the conversation queue, strips the off-platform communication attempt, and relays the legitimate property specification query to the seller.
  3. Next, Khalid inspects the Payment Review Queue for Deal #408 (total deal value SAR 3,075,000). He claims the task with an exclusive 15-minute lease (`POST /api/v1/admin/payments/claim`).
  4. He opens Payment 1 (Commission SAR 75,000): inspects the uploaded PDF receipt, verifies the transaction reference code matches `ELM-408-C`, checks amount, and clicks `Confirm Payment`.
  5. He opens Payment 2 (Property Price SAR 3,000,000): cross-references the uploaded bank transfer slip against the Deal's frozen Seller Payout IBAN and account holder name. Everything matches. He clicks `Confirm Payment`.
- **Climax Beat:** The system validates that both payment records are `Confirmed`, atomically commits `Deal = Completed`, transitions `Listing = Sold`, sends transactional notifications, and archives active negotiation threads.
- **Failure Path / Edge Case:** If Payment 2 shows an IBAN mismatch or suspected altered receipt, Khalid flags the payment as `Rejected` with a mandatory reason ("IBAN does not match registered seller payout account SA..."), which immediately notifies the buyer to upload the authentic receipt before the payment window expires.

---

## Responsive & Platform Adaptations

- **Desktop (1024px+):** Side-by-side split map and listing grid, multi-column negotiation panels, full-width data tables for admin queues.
- **Tablet (768px - 1023px):** Collapsible sidebar menu into icon drawer, 2-column property card grid, modal overlays for filters.
- **Mobile (360px - 767px):** Single-column vertical stream, bottom sticky navigation bar with unread notification badges, bottom sheet drawers for complex filters, map-to-list toggle pill.
- **English LTR Adaptation:** Complete geometric mirroring with `dir="ltr"` root, typography shifting to `Inter`, and reversal of pagination and chevron directions.
- **Dark Mode Support:** Automatic system detection or explicit toggle in user preferences (`FR-60`), applying sovereign dark tokens without altering contrast compliance.
- **Empty States:** Structured empty-state cards for search zero-results, empty queues, and initial dashboards with institutional iconography and clear calls to action.
