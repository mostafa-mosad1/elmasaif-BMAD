---
name: elmasaif
status: final
sources:
  - _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/briefs/brief-elmasaif-2026-10-26/brief.md
  - _bmad-output/ideal.md
updated: 2026-10-27
---

# El Masaif (المصايف) — Experience Spine (EXPERIENCE.md)

## Foundation

**El Masaif** is a single-surface responsive web application engineered for desktop, tablet, and mobile browsers, built with **Next.js (App Router), React, TypeScript, and Tailwind CSS**. It pairs with an administrative back-office interface served by the same presentation layer and backed by a separate **NestJS REST API** and PostgreSQL.

- **Visual Reference:** [`DESIGN.md`](file:///c:/Users/mostafa/swoftwear/BMAD/elmasaif/_bmad-output/planning-artifacts/ux-designs/ux-elmasaif-2026-10-27/DESIGN.md) is the binding visual identity reference. This document specifies the behavioral, architectural, interaction, and state contracts.
- **RTL-Native Environment:** The entire application renders with `dir="rtl"` and `lang="ar"` as the primary layout root. LTR is isolated to raw code inputs (IBANs, Reference codes, English numerals when required).
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

### Authenticated User Workspaces (`/app/*`)

| Surface | Path / Route | User Roles | Purpose & Key Features |
|---|---|---|---|
| **Buyer Dashboard** | `/app/buyer` | Buyer | Active offers in negotiation, saved favorite properties, deal pipeline shortcuts, active buying demands. |
| **Offer Negotiation** | `/app/buyer/offers/:id` | Offers list / Notification | Real-time negotiation timeline, current ask vs offer vs counter-offer, admin mediation status pill, accept/counter/withdraw actions. |
| **Deal & Dual Payment** | `/app/buyer/deals/:id` | Deal notification | 48-hour deal countdown timer, dual payment cards (Platform commission to Platform IBAN with reference code `ELM-xxx-C`; Property price to Seller verified IBAN), dual receipt upload zones, bank transfer status tracking. |
| **Buyer Demands Manager** | `/app/buyer/demands` | Buyer | Create and monitor structured property requests (30-day lifecycle) with budget and location tolerances. |
| **Marketer Workspace** | `/app/marketer` | Marketer | Fal license onboarding & status tracker, listing management, active inventory, incoming buyer inquiries, deal commissions pipeline. |
| **Marketer New Listing** | `/app/marketer/listings/new` | Marketer workspace | Multi-step property wizard: basic info, specs, media uploads (up to 10 MB per photo), deed upload (`AdminOnly`), owner authorization certificate (`AdminOnly`), payout IBAN selection. |
| **Owner Workspace** | `/app/owner` | Owner | Direct property listing requests, electronic contract status, payout account settings. |
| **Owner Contract Sign** | `/app/owner/contracts/:id` | Owner workspace / SMS | Electronic listing contract review, smooth canvas signature pad, 6-digit OTP verification stamp, listing fee transfer proof upload (SAR 1,000). |
| **User Profile & Payout** | `/app/settings` | All users | Personal details, Saudi national ID verification, verified Saudi IBAN payout management (mod-97 validated). |

### Admin Back-Office (`/admin/*`)

| Surface | Path / Route | Permissions | Operational Purpose |
|---|---|---|---|
| **Operations Dashboard** | `/admin` | `Admin:Read` | Platform throughput KPIs, pending mediation count, active 48h deals, pending payment proofs tally, daily transaction volume. |
| **Listing Moderation Queue** | `/admin/listings` | `Listings:Moderate` | Audit submitted listings, inspect title deeds and owner authorizations, approve to `Active` or reject with structured reason. |
| **Fal Licensing Queue** | `/admin/licenses` | `Licensing:Verify` | Audit Marketer Fal license certificates against REGA registry, approve broker profiles. |
| **Mediation Queue** | `/admin/negotiations` | `Deals:Mediate` | Review buyer offers and seller counter-offers, approve or reject terms before relaying, prevent bypass attempts. |
| **Dual Payment Audit** | `/admin/deals/:id/payments` | `Payments:Audit` | Audit uploaded bank transfer receipts against verified bank references and IBANs, trigger atomic deal completion. |
| **Owner Contracts Queue** | `/admin/contracts` | `Contracts:Manage` | Generate electronic listing contracts, set contract fees, verify fee transfer proofs. |
| **Audit Log & Jobs** | `/admin/system` | `System:Audit` | Immutable append-only event log, background cron execution status, retry failed webhook/queue jobs. |

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
| **48-Hour Deadline Warning** | "متبقي 12 ساعة: رفع إيصالات التحويل يمنحك مهلة تدقيق إدارية إضافية تلقائياً" | "الحق هيلغى حجزك!" |
| **Deal Completion Climax** | "تمت الصفقة بنجاح: تم فك حجب بيانات البائع المباشرة لبدء إجراءات الإفراغ العقاري" | "مبروك! اشتريت العقار 🎉" |

---

## Component Patterns (Behavioral)

### 1. Dual Wire Transfer Card
- **Behavior:** Renders two segregated action cards on `/app/buyer/deals/:id`.
  - **Platform Commission Card:** Always positioned first (rightmost in RTL). Contains platform IBAN, generated Reference Code (`ELM-408-C`), and a dedicated file upload zone for the platform fee receipt.
  - **Seller Purchase Price Card:** Contains the seller's verified name and verified personal Saudi IBAN, alongside the property price receipt upload zone.
- **Copy Mechanism:** Clicking the copy icon beside any IBAN or Reference code copies the raw unspaced string into the clipboard and flashes a green "تم النسخ" tooltip for 2 seconds.
- **Upload Validation:** Client checks MIME type (PDF, PNG, JPG, WebP) and restricts file size to <= 10 MB. Once uploaded, a thumbnail preview with file name and size is displayed with a "Replace" or "Remove" option.
- **Grace Period Guarantee:** If the user uploads both receipts within the 48-hour window, the countdown pauses and displays "قيد التدقيق المالي من قبل إدارة المنصة".

### 2. Offer & Counter-Offer Negotiation Timeline
- **Behavior:** Chronological vertical thread showing offer history.
  - Buyer offer SAR 2,950,000 -> Admin approved and dispatched -> Seller counter-offer SAR 3,000,000 -> Buyer pending acceptance.
- **Action Tray:** Fixed sticky bottom bar on mobile with two primary options: "قبول العرض (SAR 3,000,000)" (Emerald button) or "تقديم عرض مقابل جديد" (Outlined button) or "سحب العرض" (Muted text link).
- **Mediation Transparency:** A security badge reminds users: "كافة المفاوضات تتم تحت إشراف المنصة لحماية حقوق الطرفين وعدم كشف بيانات التواصل إلا بعد إتمام الصفقة".

### 3. Owner Electronic Signature & Mobile OTP Stamping
- **Canvas Behavior:** Provides touch and mouse drawing surface with clear stroke smoothing. User can click "مسح التوقيع" to reset or "اعتماد التوقيع" to progress.
- **OTP Stamping:** Displays a 6-digit numeric input with automatic focus hopping. Upon typing the 6th digit, the system submits the verification payload to the API. In development mode with static provider, entering `123456` immediately validates.

### 4. Interactive Split Map & Listing Grid
- **Behavior:** On desktop (`lg+`), the screen splits 50/50: sticky map on left, scrollable listing cards on right. On mobile, a floating pill button toggles between "عرض الخريطة 🗺️" and "عرض القائمة 📋".
- **Map Interaction:** Panning or zooming the map recalculates the bounding box and fetches matching properties with a 300ms debounce. Hovering over a listing card highlights its corresponding map pin with a pulse animation and opens the mini-card popup.

---

## State Patterns

### Listing States
- **Draft (`مسودة`):** Editable by creator (Marketer/Owner). Missing required documents are flagged with red helper indicators.
- **Pending Review (`قيد التدقيق`):** Submitted to admin queue. Read-only for creator; admin can approve or reject with comments.
- **Pending Fee (`بانتظار سداد رسوم العقد`):** Owner listings whose electronic contract is signed, awaiting the SAR 1,000 platform fee verification.
- **Active (`نشط ومتاح`):** Publicly searchable on marketplace and map.
- **Reserved (`محجوز لصفقة قائمة`):** An offer has reached final approval; Deal is in progress. Property is locked against other offers.
- **Sold (`تم البيع بنجاح`):** Deal completed. Remains visible in search with "تم البيع" banner for market price indexing.
- **Compliance Restricted (`مقيد نظامياً`):** Automatically triggered if the marketer's Fal license expires.

### Deal & Dual Payment States
- **Awaiting Payment Proof (`بانتظار إيداع الحوالات`):** Active 48-hour countdown. Both payment uploads are empty or partial.
- **Under Admin Audit (`قيد المراجعة المالية`):** Both payment proofs uploaded. Countdown timer frozen; admin reviewing bank reference.
- **Payment Rejected (`إيصال مرفوض - يتطلب تعديل`):** Admin notes why receipt was rejected (e.g. wrong IBAN or illegible slip); buyer must re-upload within remaining deadline.
- **Completed (`صفقة مكتملة وموثقة`):** Both payments approved. Atomic transaction completes deal, marks listing sold, and releases seller direct phone number.
- **Cancelled (`ملغاة لانتهاء المهلة`):** 48-hour deadline lapsed without proofs. Listing reverts to `Active`.

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
- **Climax Beat:** Tariq holds the Deal #408 screen with a 48-hour ticking clock. He splits his transfer into two: SAR 75,000 platform commission to the platform bank with code `ELM-408-C`, and SAR 3,000,000 directly to the verified seller's IBAN. He uploads both PDF receipts. The countdown stops and displays "تم استلام الإيصالات بنجاح". Two hours later, Admin confirms both proofs: the screen bursts with executive gold status, releasing the verified seller's direct phone number with a direct button to schedule the notary title deed deed transfer (الإفراغ العقاري).

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
