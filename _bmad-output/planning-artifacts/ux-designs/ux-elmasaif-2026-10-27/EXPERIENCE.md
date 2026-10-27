---
name: elmasaif
status: draft
sources:
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/briefs/brief-elmasaif-2026-10-26/brief.md
  - _bmad-output/ideal.md
updated: 2026-10-27
---

# El Masaif (المصايف) — Experience Spine (EXPERIENCE.md)

## Foundation

**El Masaif** is a single-surface responsive web application engineered for desktop, tablet, and mobile browsers, built with **Next.js (App Router), React, TypeScript, and Tailwind CSS**. It pairs with an administrative back-office interface served by the same presentation layer and backed by a separate **NestJS REST API**, standalone **Worker process (`apps/worker`)**, and PostgreSQL.

- **Visual Reference:** [`DESIGN.md`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md) is the binding visual identity reference. This document specifies the behavioral, architectural, interaction, and state contracts.
- **RTL-Native Environment:** The entire application renders with `dir="rtl"` and `lang="ar"` as the primary layout root. Complete LTR layout rules apply when language is set to English (`dir="ltr"`).
- **Multi-Role Single Identity:** A single registered Saudi user can hold multiple operational profiles (`Buyer`, `Marketer`, `Owner`) linked to a single verified mobile number and national identifier, switching effortlessly through a unified role-switcher without re-authenticating. Admin users operate under a distinct authentication realm, database table, and guard (`/admin`).

---

## Information Architecture

### Public Marketplace & Portals

| Surface | Path / Route | Reached From | Purpose & Key Features |
|---|---|---|---|
| **Marketplace Home** | `/` | Direct / Logo click | Search hero, property categories (Villa, Land, Apartment, Building), featured verified properties, interactive map preview. |
| **Search & Discovery** | `/properties` | Search bar / Nav link | Dual view: split interactive map + listing cards with instant filtering (City, District, Price bounds, Bedrooms, Area, Fal-licensed only). |
| **Property Detail** | `/properties/:id` | Card click / Map pin | 16:9 photo carousel, single ask price, dynamic commission calculator, verified specs, amenities, seller broker badge (shielded phone), "Submit Offer" / "Inquire" actions. |
| **Buyer Demands Portal** | `/demands` | Navigation bar | Public directory of active buyer demands matching properties. Marketers can browse and propose matched inventory. |
| **Static Content & CMS** | `/pages/:slug` | Footer / Banners | Informational pages, FAQ, platform rules, terms, privacy policy (`FR-64`). |

### Authenticated User Workspaces (`/app/*`)

| Surface | Path / Route | User Roles | Purpose & Key Features |
|---|---|---|---|
| **Buyer Dashboard** | `/app/buyer` | Buyer | Active offers in negotiation, saved favorite properties, deal pipeline shortcuts, active buying demands (`FR-59`). |
| **Offer Negotiation** | `/app/buyer/offers/:id` | Offers list / Notification | Real-time negotiation timeline, current ask vs offer vs counter-offer, admin mediation status pill, accept/counter actions (`FR-55`). |
| **Deal & Dual Payment** | `/app/buyer/deals/:id` | Deal notification | 48-hour deal countdown timer, dual payment cards (Platform commission to Platform IBAN with reference code `ELM-xxx-C`; Property price to Seller verified IBAN), dual receipt upload zones, bank transfer status tracking. |
| **Buyer Demands Manager** | `/app/buyer/demands` | Buyer | Create, monitor, and cancel structured property requests (30-day lifecycle) with budget and location tolerances (`FR-58`). |
| **Marketer Workspace** | `/app/marketer` | Marketer | Fal license onboarding & status tracker, listing management, active inventory, incoming buyer inquiries, deal commissions pipeline (`FR-59`). |
| **Marketer New Listing** | `/app/marketer/listings/new` | Marketer workspace | Multi-step property wizard: basic info, specs, media uploads (up to 10 MB per photo), deed upload (`AdminOnly`), owner authorization certificate (`AdminOnly`), payout IBAN selection. |
| **Owner Workspace** | `/app/owner` | Owner | Direct property listing requests, electronic contract status, payout account settings (`FR-59`). |
| **Owner Contract Sign** | `/app/owner/contracts/:id` | Owner workspace / SMS | Electronic listing contract review, smooth canvas signature pad, 6-digit OTP verification stamp, listing fee transfer proof upload (SAR 1,000). |
| **User Profile & Verification** | `/app/settings/profile` | All users | Name and email editing (mandatory verification link for email changes per `FR-49`), commercial name mismatch warning (`FR-5`), Saudi IBAN payout management. |
| **Security & Password** | `/app/settings/password` | All users | Change password requiring current password (failed attempts count toward lockout), revokes other sessions (`FR-47`). |
| **Mobile Number Update** | `/app/settings/mobile` | All users | Dual-OTP phone change wizard (both verified within 15 min per `FR-48`) and support-assisted request path (`Users.PhoneChange`). |
| **Preferences & Theme** | `/app/settings/preferences` | All users | Language selection (Arabic RTL / English LTR), dark mode toggle, and notification channel preferences (`FR-60`). |
| **Account Deletion** | `/app/settings/delete-account` | All users | Password + OTP confirmed account deletion request, 14-day cooling-off period (`DeletionPending`), statutory retention warning (`FR-50`). |

### Admin Back-Office (`/admin/*`)

| Surface | Path / Route | Permissions | Operational Purpose |
|---|---|---|---|
| **Operations Dashboard** | `/admin` | `Admin:Read` | Platform throughput KPIs, pending mediation count, active 48h deals, pending payment proofs tally, daily transaction volume (`FR-66`). |
| **Claimable Queues** | `/admin/queues` | `Tasks:Claim` | Unified queue for claimable items with explicit POST claim (`FR-51`), 15-min lease, 5-min heartbeat, and read-only inspection banner for other admins. |
| **Listing Moderation** | `/admin/listings/:id` | `Listings:Moderate` | Audit submitted listings with 15-min exclusive lock, inspect title deeds and owner authorizations, approve to `Active`, reject with structured reason, or propose price revision (`FR-57`). |
| **Fal Licensing Queue** | `/admin/licenses/:id` | `Licensing:Verify` | Audit Marketer Fal license certificates with 15-min exclusive lock against REGA registry, approve broker profiles. |
| **Mediation Queue** | `/admin/negotiations/:id` | `Deals:Mediate` | Review buyer offers and seller counter-offers with 15-min exclusive lock, approve or reject terms before relaying, prevent bypass attempts. |
| **Payment Verification** | `/admin/payments/:id` | `Payments:Audit` | Audit uploaded bank transfer receipts (each payment claimed separately, `FR-51`) against bank references and IBANs, trigger atomic deal completion. |
| **Owner Contracts Queue** | `/admin/contracts/:id` | `Contracts:Manage` | Generate electronic listing contracts, manage templates (`FR-61`), verify fee transfer proofs with 15-min exclusive lock. |
| **Review Moderation Queue** | `/admin/reviews` | `Reviews:Moderate` | Audit submitted ratings; hide abusive reviews with mandatory justification logged to `AuditLog`, or restore hidden reviews (`FR-52`). |
| **Geographic Master Data** | `/admin/geo` | `Geo.Manage` | Manage Cities and Districts with `isActive` toggles, preventing free-text additions (`FR-53`). |
| **Financial Reports & Invoices**| `/admin/finance` | `Finance:Audit` | View platform financial indicators, export transaction reports (`FR-63`), and review invoice records (`FR-68`). |
| **Penalties & Fraud Log** | `/admin/fraud` | `Security:Manage` | Track policy violations, license suspensions, and fraud indicators (`FR-62`). |
| **CMS & Templates** | `/admin/cms` | `CMS:Manage` | Manage static legal pages, banners, FAQ, and notification email templates (`FR-64`). |
| **Audit Log & System Jobs** | `/admin/system` | `System:Audit` | Immutable event log, worker process scheduler status (`pg-boss`), force-unlock audit history (`Tasks.ForceUnlock`). |

---

## Voice and Tone (Microcopy)

El Masaif communicates with the legal precision of a certified notary and the clarity of an institutional wealth manager. Microcopy is concise, encouraging, and authoritative.

| Situation / Action | Recommended Microcopy (Do) | Discouraged Microcopy (Don't) |
|---|---|---|
| **Buyer submitting an offer** | "تقديم عرض شراء ملزم خاضع لتدقيق المنصة" | "أرسل سومك للبائع مباشرة 🚀" |
| **Offer in Admin Mediation** | "العرض قيد المراجعة والتدقيق الإداري لضمان جدية الطرفين" | "ننتظر موافقة الأدمن قريباً" |
| **Dual Wire Transfer Screen** | "يرجى تحويل سعي المنصة إلى حساب المنصة المعتمد، وقيمة العقار مباشرة إلى حساب البائع الموثق" | "سدد الرسوم والفلوس هنا" |
| **Reference Code Copy** | "تم نسخ رمز مرجع التحويل بنجاح: استخدم هذا الرمز في وصف الحوالة البنكية" | "تم النسخ!" |
| **Fal License Upload** | "التحقق من رخصة فال العقارية لضمان موثوقية المعلن ونظامية الوساطة" | "ارفع رخصتك عشان تتفعل" |
| **48-Hour Deadline Warning** | "رفع إيصال التحويل يوقف الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة دون إلغاء تلقائي." | "الحق هيلغى حجزك!" |
| **Deal Completion Climax** | "تمت الصفقة بنجاح: تم فك حجب بيانات البائع المباشرة لبدء إجراءات الإفراغ العقاري" | "مبروك! اشتريت العقار 🎉" |
| **Admin Queue Locked** | "قيد التدقيق بواسطة زميل آخر (متبقي 11:42). العرض متاح للقراءة فقط." | "ممنوع الدخول" |

---

## Component Patterns (Behavioral)

### 1. Dual Wire Transfer Card
- **Behavior:** Renders two segregated action cards on `/app/buyer/deals/:id`.
  - **Platform Commission Card:** Always positioned first (rightmost in RTL). Contains platform IBAN, generated Reference Code (`ELM-408-C`), and a dedicated file upload zone for the platform fee receipt.
  - **Seller Purchase Price Card:** Contains the seller's verified name and verified personal Saudi IBAN, alongside the property price receipt upload zone.
- **Copy Mechanism:** Clicking the copy icon beside any IBAN or Reference code copies the raw unspaced string into the clipboard and flashes a green "تم النسخ" tooltip for 2 seconds.
- **Upload Validation:** Client checks MIME type (PDF, PNG, JPG, WebP) and restricts file size to <= 10 MB. Pre-persistence quarantine malware scanning hook (`NFR13`) validates payload; only files marked `Clean` are served. Once uploaded, a thumbnail preview with file name and size is displayed with a "Replace" or "Remove" option.
- **Payment Timing & Grace Rule (OQ-07, FR-31, FR-33, BR-08):**
  - Uploading bank transfer proof before `PaymentDeadline` pauses cancellation while status is `ProofUploaded` or `UnderReview`.
  - If `PaymentDeadline` expires while review is pending, an automatic 12-hour administrative grace period begins.
  - After 12 hours without an admin decision, the system dispatches a high-priority SLA alert to administrators; the deal is **NOT** auto-cancelled.
  - Rejection during grace allows the buyer to re-upload corrected proof until the 12-hour grace window elapses.

### 2. Offer & Counter-Offer Negotiation Timeline
- **Behavior:** Chronological vertical thread showing offer history.
  - Buyer offer SAR 2,950,000 -> Admin approved and dispatched -> Seller counter-offer SAR 3,000,000 -> Buyer pending acceptance.
- **Action Tray (UX-DR10):** Fixed sticky bottom bar on mobile with two primary options: "قبول العرض (SAR 3,000,000)" (Emerald button) or "تقديم عرض مقابل جديد" (Outlined button).
- **Mediation Transparency:** A security badge reminds users: "كافة المفاوضات تتم تحت إشراف المنصة لحماية حقوق الطرفين وعدم كشف بيانات التواصل إلا بعد إتمام الصفقة".

### 3. Owner Electronic Signature & Mobile OTP Stamping
- **Canvas Behavior:** Provides touch and mouse drawing surface with clear stroke smoothing. User can click "مسح التوقيع" to reset or "اعتماد التوقيع" to progress.
- **OTP Stamping:** Displays a 6-digit numeric input with automatic focus hopping. Upon typing the 6th digit, the system submits the verification payload to the API. In development mode with static provider, entering `123456` immediately validates.

### 4. Interactive Split Map & Listing Grid
- **Behavior:** On desktop (`lg+`), the screen splits 50/50: sticky map on left, scrollable listing cards on right. On mobile, a floating pill button toggles between "عرض الخريطة 🗺️" and "عرض القائمة 📋".
- **Map Interaction:** Panning or zooming the map recalculates the bounding box and fetches matching properties with a 300ms debounce. Hovering over a listing card highlights its corresponding map pin with a pulse animation and opens the mini-card popup.

### 5. Admin Task-Claim Locking in Operational Queues (FR-51, UX-DR15, AR12)
- **Claim Mechanism:** Task claim is strictly an explicit `POST /api/v1/admin/<queue>/<id>/claim`, never triggered by a `GET` request or page navigation.
- **Atomic Lease:** An atomic conditional `UPDATE` assigns `lockedByAdminId`, `lockedAt`, and `lockExpiresAt` (+15 minutes) only if currently unlocked or expired.
- **Heartbeat & Release:** A client-side heartbeat renews the lock every 5 minutes while active. The lock is released upon submitting a decision or navigating away.
- **Concurrent Inspection:** Other admins viewing a locked item see an informative read-only banner ("قيد المعالجة حالياً بواسطة [اسم المسؤول]"), with all decision and mutation buttons disabled.
- **Super Admin Override:** Users with `Tasks.ForceUnlock` permission can force-release any lock, requiring a mandatory justification reason logged directly to `AuditLog`.
- **Optimistic Concurrency Preserved:** A task lock never replaces the optimistic concurrency version check (`If-Match`); stale concurrent decisions return HTTP 409 Conflict.
- **Covered Entities:** Applies to 8 domain queues: `Listing`, `FalProfile`, `OwnerListingRequest`, `Payment` (each payment separately, NOT PaymentProof), `ContractFeePayment`, `Conversation`, `Dispute`, and `Offer`.

### 6. Cascading City & District Master Selector (FR-53)
- **Behavior:** Selection is strictly constrained to master Saudi geographic records (`City` and `District`). Selecting a City loads its corresponding active Districts dynamically. Unstructured free text input is rejected. Deactivated entities remain on historical listings but cannot be selected for new listings.

### 7. Dual-Step Mobile Number Update Flow (FR-48)
- **Step 1:** User initiates change on `/app/settings/mobile`. System sends 6-digit OTP to current registered phone.
- **Step 2:** User inputs new Saudi mobile number (`+9665XXXXXXXX`). System validates uniqueness (returns `AUTH_PHONE_IN_USE` if already taken) and dispatches a second 6-digit OTP.
- **Timeout & Restrictions:** Both OTPs must be successfully verified within 15 minutes, or the request expires. The old number receives an immediate security notification. The flow is strictly blocked if the user has an active Deal in `AwaitingPaymentProof`, `PaymentUnderReview`, or `Disputed`.
- **Support-Assisted Path:** Users who have lost access to their old SIM can request an administrative change requiring official identity document verification, handled exclusively by support agents with `Users.PhoneChange` permission and logged to `AuditLog`.

### 8. Self-Service Account Erasure / PDPL Deactivation Flow (FR-50)
- **Confirmation:** Requires password and 6-digit OTP re-authentication.
- **Integrity Validation:** Blocked while any Deal is non-terminal, any dispute is open, or any Owner contract is `SignedPendingFee` or `FeeUnderReview`.
- **Zero Transaction History:** Transition to `DeletionPending` state. An automated 14-day cooling-off period [ASSUMPTION] begins. If the user does not log in during these 14 days, personal data is permanently erased and anonymized. Logging in during the cooling-off period automatically cancels the deletion request.
- **Active / Historical Transactions:** If the user has transaction history, the account is deactivated and hidden (cannot log in, public profile removed, active listings closed), while legally required transaction, tax, and audit records are retained per retention schedules established by legal counsel.

---

## State Patterns

### Listing States
- **Draft (`مسودة`):** Editable by creator (Marketer/Owner). Missing required documents are flagged with red helper indicators.
- **Pending Review (`قيد التدقيق`):** Submitted to admin queue. Read-only for creator; admin can approve, reject with comments, or propose price revision (`FR-57`).
- **Pending Fee (`بانتظار سداد رسوم العقد`):** Owner listings whose electronic contract is signed, awaiting the SAR 1,000 platform fee verification.
- **Active (`نشط ومتاح`):** Publicly searchable on marketplace and map.
- **Reserved (`محجوز لصفقة قائمة`):** An offer has reached final approval; Deal is in progress. Property is locked against other offers.
- **Sold (`تم البيع بنجاح`):** Deal completed. Remains visible in search with "تم البيع" banner for market price indexing.
- **Compliance Restricted (`مقيد نظامياً`):** Automatically triggered if the marketer's Fal license expires.

### Deal & Dual Payment States
- **Awaiting Payment Proof (`بانتظار إيداع الحوالات`):** Active 48-hour countdown (`ClockService.now() + 48h`). Both payment uploads are empty or partial.
- **Proof Uploaded (`تم رفع الإيصال`):** Uploaded before deadline. Cancellation timer paused while under review.
- **Under Admin Audit (`قيد المراجعة المالية`):** Proofs uploaded and claimed by financial auditor. If deadline arrives, 12-hour grace period activates; after 12 hours without decision, an SLA alert is dispatched to admins without auto-cancellation.
- **Payment Rejected (`إيصال مرفوض - يتطلب تعديل`):** Admin notes why receipt was rejected; buyer can re-upload until deadline or grace period expires.
- **Completed (`صفقة مكتملة وموثقة`):** Both payments approved. Atomic transaction completes deal, marks listing sold, records invoice data (`FR-68`), and releases seller direct phone number.
- **Cancelled (`ملغاة لانتهاء المهلة`):** Deadline lapsed without proof uploaded. Listing reverts to `Active`.

### Account States
- **Active:** Normal operating account.
- **Suspended:** Account restricted due to policy or compliance violation.
- **DeletionPending:** 14-day cooling-off window in effect; logging in restores to `Active`.
- **Deactivated:** Account deactivated with transaction records retained under statutory legal requirements.

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

---

## Accessibility Floor (WCAG 2.1 AA)

- **Contrast:** All text meets or exceeds 4.5:1 contrast against its background (`#0F172A` on `#F8FAF9` = 14.8:1; `#1B4332` on white = 8.6:1).
- **RTL Assistive Technology:** Screen readers announce headings, landmarks (`main`, `nav`, `aside`), and dynamic alert regions (`aria-live="polite"` for deal timer updates and message arrival).
- **Form Association:** Every input possesses an explicit `<label>` connected via `htmlFor`/`id`. Error states provide descriptive `aria-describedby` announcements in Arabic.
- **Focus Indicators:** High-visibility 3px emerald outline (`{colors.primary}`) with clear offset on all interactive elements during keyboard navigation.

---

## Key Flows (Named-Protagonist Journeys)

### Journey 1: Tariq Executes a Villa Purchase via Dual Wire Transfer
- **Protagonist:** Tariq (38, Financial Analyst in Riyadh, buying a family home).
- **Climax Beat:** Tariq holds the Deal #408 screen with a 48-hour ticking clock. He splits his transfer into two: SAR 75,000 platform commission to the platform bank with code `ELM-408-C`, and SAR 3,000,000 directly to the verified seller's IBAN. He uploads both PDF receipts. The countdown stops and displays "تم استلام الإيصالات بنجاح". Two hours later, Admin confirms both proofs: the screen bursts with executive gold status, releasing the verified seller's direct phone number with a direct button to schedule the notary title deed transfer (الإفراغ العقاري).

### Journey 2: Sara Onboards as a Fal-Certified Marketer and Publishes a Commercial Office
- **Protagonist:** Sara (Licensed Broker in Jeddah).
- **Climax Beat:** Sara enters her 10-digit Fal license number and uploads the official PDF certificate. The system immediately validates format and places her profile in `UnderReview`. Once verified by Admin, her Marketer Workspace unlocks with a green "وسيط عقاري معتمد" badge. She uploads her listing with the mandatory owner authorization certificate. Within 4 hours, her listing goes live on the marketplace with her broker rating, while her personal phone number remains completely shielded from unlicensed cold callers.

### Journey 3: Abu Fahad Signs an Electronic Listing Contract as a Direct Owner
- **Protagonist:** Abu Fahad (60, Owner in Dammam selling a commercial building).
- **Climax Beat:** Abu Fahad receives an SMS alert that his listing contract is ready. He opens the web app on his iPad, reviews the standardized REGA terms, draws his signature with his finger on the signature pad, and enters the 6-digit OTP code received on his phone. He transfers the SAR 1,000 contract fee to the platform account and uploads the receipt. The listing automatically transitions to `Active`, with zero unsolicited broker calls.

---

## Responsive & Platform Adaptations

- **Desktop (1024px+):** Side-by-side split map and listing grid, multi-column negotiation panels, full-width data tables for admin queues.
- **Tablet (768px - 1023px):** Collapsible sidebar menu into icon drawer, 2-column property card grid, modal overlays for filters.
- **Mobile (360px - 767px):** Single-column vertical stream, bottom sticky navigation bar with unread notification badges, bottom sheet drawers for complex filters, map-to-list toggle pill.
- **English LTR Adaptation:** Complete geometric mirroring with `dir="ltr"` root, typography shifting to `Inter` / `Outfit`, and reversal of pagination and chevron directions.
- **Dark Mode Support:** Automatic system detection or explicit toggle in user preferences (`FR-60`), applying sovereign dark tokens without altering contrast compliance.
- **Empty States:** Structured empty-state cards for search zero-results, empty queues, and initial dashboards with institutional iconography and clear calls to action.
