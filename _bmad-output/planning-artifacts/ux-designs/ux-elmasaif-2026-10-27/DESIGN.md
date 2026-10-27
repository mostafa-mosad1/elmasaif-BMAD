---
name: elmasaif
description: Institutional Real Estate Marketplace Design System (KSA) - Arabic RTL-First, Trust-Centered, Sovereign Luxury
status: draft
updated: 2026-10-27
colors:
  # Sovereign Green Primary Ramp
  primary: '#1B4332'
  primary-hover: '#143326'
  primary-light: '#E8F3EE'
  primary-foreground: '#FFFFFF'
  primary-dark: '#2D6A4F'
  primary-dark-hover: '#3D8565'

  # Desert Gold Financial & Accents Ramp
  accent: '#C69C45'
  accent-hover: '#B38A38'
  accent-light: '#FAF4E8'
  accent-foreground: '#1A1208'
  accent-dark: '#D4AF37'

  # Neutral & Surface Scale (Light Mode Default)
  background: '#F8FAF9'
  surface-base: '#FFFFFF'
  surface-raised: '#FFFFFF'
  surface-sunken: '#F0F4F2'
  surface-border: '#E2E8F0'
  surface-border-strong: '#CBD5E1'

  # Text & Ink Scales
  ink-primary: '#0F172A'
  ink-secondary: '#475569'
  ink-muted: '#94A3B8'
  ink-disabled: '#CBD5E1'
  ink-inverse: '#FFFFFF'

  # Dark Mode Token Scale
  dark-background: '#0B130E'
  dark-surface-base: '#132018'
  dark-surface-raised: '#1C2E24'
  dark-surface-sunken: '#0E1712'
  dark-surface-border: '#23382C'
  dark-surface-border-strong: '#32503E'
  dark-ink-primary: '#F1F5F9'
  dark-ink-secondary: '#CBD5E1'
  dark-ink-muted: '#64748B'
  dark-ink-disabled: '#334155'
  dark-ink-inverse: '#0F172A'

  # Status & Verification Badges
  status-verified: '#059669'
  status-verified-bg: '#ECFDF5'
  status-verified-border: '#A7F3D0'
  status-pending: '#D97706'
  status-pending-bg: '#FFFBEB'
  status-pending-border: '#FDE68A'
  status-danger: '#DC2626'
  status-danger-bg: '#FEF2F2'
  status-danger-border: '#FECACA'
  status-info: '#2563EB'
  status-info-bg: '#EFF6FF'
  status-info-border: '#BFDBFE'
  status-neutral: '#64748B'
  status-neutral-bg: '#F1F5F9'
  status-neutral-border: '#E2E8F0'

  # Dual Wire Transfer Distinctions
  deal-platform-fee: '#1B4332'
  deal-platform-fee-bg: '#F0F7F4'
  deal-seller-price: '#0F172A'
  deal-seller-price-bg: '#F8FAFC'

typography:
  font-primary: 'IBM Plex Sans Arabic'
  font-mono: 'JetBrains Mono'
  heading-display:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '36px'
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: '-0.02em'
  heading-xl:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '28px'
    fontWeight: '700'
    lineHeight: '1.3'
  heading-lg:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '22px'
    fontWeight: '600'
    lineHeight: '1.35'
  heading-md:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '18px'
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '16px'
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '14px'
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: 'IBM Plex Sans Arabic'
    fontSize: '12px'
    fontWeight: '400'
    lineHeight: '1.45'
  code-iban:
    fontFamily: 'JetBrains Mono'
    fontSize: '14px'
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: '0.05em'

rounded:
  none: '0px'
  xs: '4px'
  sm: '6px'
  md: '10px'
  lg: '16px'
  xl: '24px'
  full: '9999px'

spacing:
  '0': '0px'
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
  '16': '64px'
  container-max: '1280px'
  sidebar-width: '280px'
  admin-sidebar-width: '260px'

components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    fontWeight: '600'
    fontSize: '15px'
    hover-bg: '{colors.primary-hover}'
  button-accent:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
    fontWeight: '600'
    fontSize: '15px'
    hover-bg: '{colors.accent-hover}'
  property-card:
    background: '{colors.surface-base}'
    border: '1px solid {colors.surface-border}'
    radius: '{rounded.lg}'
    shadow: '0 1px 3px rgba(0,0,0,0.05)'
  status-badge:
    radius: '{rounded.full}'
    fontSize: '12px'
    fontWeight: '600'
    padding: '4px 10px'
  deal-timer-banner:
    background: '{colors.accent-light}'
    border: '1px solid {colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
  iban-card:
    background: '{colors.surface-sunken}'
    border: '1px dashed {colors.surface-border-strong}'
    radius: '{rounded.md}'
    fontFamily: '{typography.font-mono}'
---

# El Masaif (المصايف) — Design Spine (DESIGN.md)

## Brand & Style

**El Masaif (المصايف)** is an institutional real estate marketplace platform engineered exclusively for high-value property sales across the Kingdom of Saudi Arabia (KSA). In an industry where conventional classified portals suffer from unlicensed middlemen, ghost listings, and opaque informal brokerage, El Masaif stands for **sovereign trust, regulatory integrity (REGA / Fal), and uncompromised financial clarity**.

The visual posture is **Institutional Luxury meets Saudi Digital Modernity**:
- **Dignified & Sober:** Deep emerald green anchors authority, security, and institutional endurance; warm desert gold accents elevate financial milestones, verified titles, and critical deal actions.
- **RTL Arabic-First Native:** All typography, reading order, iconography, and spatial hierarchies are natively designed for Arabic (RTL), using `IBM Plex Sans Arabic` for legal clarity and balanced weight distribution.
- **Information Density with Breathing Room:** High-value multi-million SAR transactions demand zero ambiguity. Financial numbers, commission breakdowns, IBANs, and Fal license numbers are rendered with strict monospace precision and generous tabular spacing.
- **Visual Confidence Over Casual Consumerism:** No playful illustrations, no gamification badges, no cartoonish banners. Every interface element reinforces legal and financial reliability.

---

## Colors

### Primary: Sovereign Emerald (`#1B4332`, `#143326`, `#E8F3EE`)
The sovereign emerald is the foundational color of the platform. It represents Saudi land wealth, governmental regulatory authority (REGA compliance), and institutional stability.
- **Primary (`#1B4332`):** Brand headers, primary action buttons, verified platform emblems, navigation active indicators.
- **Primary Hover (`#143326`):** Hover and pressed states for primary interactions.
- **Primary Light (`#E8F3EE`):** Subtle background highlights for active filters, selected tabs, and official platform notifications.

### Accent: Desert Gold (`#C69C45`, `#B38A38`, `#FAF4E8`)
Desert gold embodies financial value, binding contracts, and exclusive property status.
- **Accent (`#C69C45`):** Reserved deal countdown banners, highlight badges for exclusive direct-owner listings, rating stars, and callout metric indicators.
- **Accent Light (`#FAF4E8`):** Background for Deal Payment Timers (48-hour deadline) and escrow-free direct transfer notices.

### Background & Surfaces (`#F8FAF9`, `#FFFFFF`, `#F0F4F2`, `#E2E8F0`)
- **Background (`#F8FAF9`):** A soft, calming green-tinted off-white background that prevents glare on high-resolution screens during prolonged due-diligence sessions.
- **Surface Base (`#FFFFFF`):** Property cards, modal windows, table rows, and form containers.
- **Surface Sunken (`#F0F4F2`):** IBAN copy containers, audit log blocks, file upload drop zones.

### Status Palette (Regulatory & Deal Lifecycle)
- **Verified / Active (`#059669` / `#ECFDF5`):** Fal license verified, title deed authenticated, listing active, payment proof confirmed.
- **Pending / Action Required (`#D97706` / `#FFFBEB`):** Under compliance review, awaiting buyer payment proof, offer pending seller response.
- **Under Admin Review (`#2563EB` / `#EFF6FF`):** Offer in mediation queue, electronic contract under preparation.
- **Compliance Restricted / Rejected (`#DC2626` / `#FEF2F2`):** Fal license expired, payment proof invalid, listing rejected.
- **Sold / Closed (`#64748B` / `#F1F5F9`):** Completed transaction, archived listing.

---

## Typography

The platform utilizes **`IBM Plex Sans Arabic`** as the universal primary typeface across all viewports, complemented by **`JetBrains Mono`** for financial and regulatory codes.

### Hierarchy & Scales
- **Display (`36px` / 700 / line-height 1.25):** Hero headlines on public portal and property showcase headers.
- **Heading XL (`28px` / 700 / line-height 1.3):** Workspace dashboards, Deal completion climax, and contract review titles.
- **Heading LG (`22px` / 600 / line-height 1.35):** Property card ask prices, section headers, modal titles.
- **Heading MD (`18px` / 600 / line-height 1.4):** Filter group titles, card headers, table column super-headers.
- **Body LG (`16px` / 400 / line-height 1.6):** Primary narrative text, property descriptions, contract clauses.
- **Body MD (`14px` / 400 / line-height 1.5):** Default UI body, form labels, table cells, metadata pills.
- **Body SM (`12px` / 400 / line-height 1.45):** Timestamps, helper text, footnote disclaimers, micro-badges.
- **Monospace (`14px` / 500 / letter-spacing 0.05em):** Saudi IBANs (`SA...`), Deal reference codes (`ELM-408-C`), National ID / CR numbers, and exact SAR currency figures.

---

## Layout & Spacing

### Spatial Grid & Geometry
- **RTL Baseline:** All layouts execute strictly Right-to-Left. Margin-start is right, margin-end is left. Chevron arrows, breadcrumb dividers, and progress flows reverse direction naturally.
- **Container Max Width:** `1280px` centered for public portal; full-width fluid responsive layout with `280px` collapsible sidebar for authenticated user workspaces (`/app/*`) and `260px` sidebar for the Admin Back-Office (`/admin/*`).
- **Standard Spacing Scale:** Built on a 4px/8px modular scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Gutter & Margins:**
  - Desktop (`lg` / `xl`): `24px` gutter, `32px` page margins.
  - Tablet (`md`): `16px` gutter, `20px` page margins.
  - Mobile (`sm`): `12px` gutter, `16px` screen padding.

---

## Elevation & Depth

El Masaif avoids hyper-deep floating 3D drop shadows in favor of crisp, institutional structural borders combined with subtle ambient occlusion:
- **Level 0 (Flat):** Tables, form inputs, inline badges (`border: 1px solid {colors.surface-border}`).
- **Level 1 (Card Rest):** Property cards, filter panels, summary boxes (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04); border: 1px solid {colors.surface-border}`).
- **Level 2 (Interactive / Hover):** Property cards on hover, active dropdown menus (`box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04); transform: translateY(-2px); transition: all 150ms ease-in-out`).
- **Level 3 (Modal & Sheet):** Dialogs, OTP modals, contract signing sheets, payment proof previews (`box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`).
- **Backdrop Blur:** Modals and sticky navigation utilize `backdrop-filter: blur(8px)` with `rgba(255, 255, 255, 0.85)` surface overlay.

---

## Shapes

- **Base Radius (`md: 10px`):** Applied to buttons, form inputs, modal dialogs, and alert banners. Strikes the balance between executive precision and contemporary digital softness.
- **Card Radius (`lg: 16px`):** Applied to property cards, interactive map popups, and financial summary cards.
- **Pill Radius (`full: 9999px`):** Used exclusively for status badges (`Active`, `Reserved`, `Under Review`), role chips (`مشتري`, `وسيط مرخص`, `مالك`), and map price tags.
- **Input Borders:** `1.5px` border width with crisp focus ring using `{colors.primary}` with 3px opacity halo (`box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.15)`).

---

## Components

### 1. Property Card (Marketplace)
- **Image Aspect Ratio:** 16:9 carousel with photo counter pill (`1/12`) on top-left (RTL) and Fal-verified badge on top-right.
- **Ask Price:** Prominently set in `{typography.heading-lg}`, followed by SAR currency label (`ر.س`).
- **Specs Strip:** Micro-icons for Bedrooms and Area in square meters (`م²`), separated by hairline borders (bathrooms omitted per data model).
- **Location Tag:** City and District with pin icon (`الرياض، حي النرجس`).

### 2. Dual Payment Transfer Card (Deal Screen)
- **Container:** Split into two distinct cards side-by-side or stacked on mobile:
  - **Card 1: Platform Commission (سعي المنصة):** Green-accented container, displays platform IBAN, generated Reference Code (`ELM-408-C`) with one-click copy button, and exact commission amount (2.5%).
  - **Card 2: Property Purchase Price (قيمة العقار للبائع):** Slate-accented container, displays Seller's verified name, Seller's verified Saudi IBAN with copy button, and agreed purchase price.
- **Proof Upload Area:** Drag-and-drop zone with PDF/image support, file size progress bar, and instant confirmation preview.

### 3. Deal 48-Hour Countdown Banner
- **Visuals:** Gold accent banner (`{colors.accent-light}`) with countdown clock (`ساعة : دقيقة : ثانية`), visual progress bar, and explicit administrative notice:
  - Notice clearly states that uploading bank transfer proof before the deadline pauses cancellation while under administrative review (uploading pauses cancellation; it does not guarantee acceptance).
  - If review remains pending after the 12-hour grace period, an SLA alert is dispatched to admins without auto-cancellation.
  - In case of rejection during grace, the buyer may re-upload proof until the grace window expires.

### 4. Electronic Signature & OTP Pad (Owner Contract)
- **Canvas:** Smooth canvas signature box with "Clear" and "Adopt" controls.
- **OTP Verification:** 6-box segmented numeric input with auto-advance and countdown resend link (`إعادة إرسال الرمز خلال 58 ثانية`).

### 5. Interactive Map Pin & Cluster
- **Cluster:** Emerald green circle with item count in white.
- **Price Pin:** White rounded-pill container with dark green border displaying price (`3.2 مليون`), transitions to solid emerald background when selected.

### 6. Admin Operational Task-Lock Banner (FR-51, UX-DR15)
- **Container:** High-visibility amber accent card (`{colors.status-pending-bg}`, border `{colors.status-pending-border}`) pinned at the top of moderation, audit, and conversation workspaces.
- **Visuals:** Padlock icon + Arabic indicator ("قيد التدقيق بواسطة: [اسم المسؤول] - متبقي [دقائق : ثواني] لانتهاء الحجز").
- **State Behavior:**
  - Active Claimer: Editable controls, active decision buttons, and a heartbeat refresher every 5 minutes.
  - Inspecting Admins: Muted read-only view with mutation buttons disabled and an informative banner ("هذه المهمة قيد المعالجة حالياً بواسطة [اسم المسؤول]").
  - Super Admin Override: Shows a distinct "إلغاء القفل بالقوة" (Force Unlock) action triggering a modal requiring a mandatory audit reason.

### 7. Cascading City & District Selector (FR-53)
- **Container:** Dual search-enabled dropdown inputs with RTL chevron and live filtering.
- **Visuals:** Surface base background (`#FFFFFF`), 1.5px border with primary emerald focus ring. Selecting a City dynamically populates and filters the corresponding Districts list. Free-text inputs are strictly prohibited.

### 8. Security & Account Recovery Modals (FR-46 to FR-50)
- **Layout:** Level 3 elevated modal window (`box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12)`) with `backdrop-filter: blur(8px)`.
- **OTP Segmented Field:** 6 individual numeric boxes with automatic cursor advance and 60-second countdown resend trigger.
- **Dual-Verification Sequence:** In Mobile Number Updates, displays clear 2-step progress indicator: "الخطوة 1: التحقق من الرقم الحالي" -> "الخطوة 2: التحقق من الرقم الجديد".

---

## Dedicated UI Screens & Specifications

### 1. Admin Operations & Workspaces
- **Admin Claimable Queues (`/admin/queues`):**
  - Unified table view for Listing moderation, Fal profiles, Owner listing requests, Payments, Contract fee payments, Conversations, Disputes, and Offers.
  - Explicit action button: "استلام المهمة" (Claim Task) triggers `POST /api/v1/admin/<queue>/<id>/claim`, acquiring a 15-minute exclusive lock.
- **Payment Proof Review Workspace (`/admin/payments/:id`):**
  - Displays the active Task-Lock banner at top.
  - Dual side-by-side verification pane: left pane displays submitted bank transfer slip (scanned receipt / PDF via 5-minute presigned URL), right pane displays expected transfer parameters (amount, bank reference, buyer name, target IBAN).
  - Decision buttons: "اعتماد الحوالة" (Approve) and "رفض الحوالة" (Reject) with a mandatory rejection reason modal.
- **Super Admin Force Unlock Modal (`Tasks.ForceUnlock`):**
  - Emergency dialog accessible only to Super Admins on locked tasks.
  - Requires entry of a mandatory justification logged immediately to immutable audit records before releasing the lock.
- **Review Moderation Workspace (`/admin/reviews`, FR-52):**
  - Lists user-submitted deal ratings (1-5 stars, comments up to 500 characters).
  - Controls: "إخفاء التقييم" (Hide Review) requiring a moderation reason; "استعادة التقييم" (Restore Review).
  - Visual badge indicating whether the rating is currently included or excluded from calculated public averages.
- **Geographic Master Data Admin (`/admin/geo`, FR-53):**
  - Hierarchical tree manager for Cities and Districts.
  - Controls to add, edit, or toggle `isActive`. Deactivated cities/districts remain visible on historical listings but are disallowed for new listings and searches.

### 2. User Security & Settings Screens (FR-46 to FR-50)
- **Forgot Password Flow (`/auth/forgot-password`, FR-46):**
  - Mobile number input form with identical timing and generic success feedback regardless of account existence (prevents phone enumeration).
  - 6-digit OTP verification screen; locks reset attempts for 15 minutes upon 3 failed attempts.
  - New password input validating that the new password differs from the current password; revokes all active sessions upon completion.
- **Change Password Dialog (`/app/settings/password`, FR-47):**
  - Requires current password (failed attempts count toward account lockout and trigger `AUTH_INVALID_CREDENTIALS`).
  - Confirms new password, invalidates all other active user sessions, and sends security alert notifications.
- **Change Mobile Number Wizard (`/app/settings/mobile`, FR-48):**
  - Step 1: OTP sent to existing registered number.
  - Step 2: OTP sent to new number (validated as unique, returning `AUTH_PHONE_IN_USE` if registered).
  - Both steps must complete within 15 minutes. Operation blocked if any deal is in non-terminal payment stages.
  - Support-assisted path for lost numbers requiring identity document upload and admin verification (`Users.PhoneChange`).
- **Edit Profile & Email Verification (`/app/settings/profile`, FR-49):**
  - Edit name and email address.
  - Updating email displays a high-visibility pending verification banner until the user opens the mandatory verification link.
  - Automatic commercial name mismatch warning per FR-5 if the user is a licensed marketer.
- **Terms & Privacy Re-Consent Screen (`/auth/consent`):**
  - Displayed immediately upon login when `termsVersion` or `privacyVersion` increments.
  - Modal overlay with scrollable legal text viewer and explicit "أوافق على الشروط والسياسات المحدثة" acceptance action recording IP, user agent, and timestamp to `ConsentRecord`.
- **Account Deletion Flow (`/app/settings/delete-account`, FR-50):**
  - Password and OTP re-authentication required.
  - Pre-validation check: strictly blocked if any active deals, disputes, or owner contracts are non-terminal.
  - Confirmation dialogue detailing the 14-day cooling-off period (`DeletionPending` status) and explaining that logging in during this period cancels the deletion request.
  - Prominent legal disclosure explaining that users with historical financial transactions will have accounts deactivated and hidden, with transaction records retained per statutory Saudi retention schedules.

---

## English LTR Support & Mirroring Rules

While Arabic (RTL) is the sovereign default of El Masaif, complete English (LTR) layout rules ensure institutional readiness:
- **Direction Attribute:** Setting locale to `en` toggles `dir="ltr"` on the root document.
- **Typography:** English viewports utilize `Inter` / `Outfit` for display and body scales, preserving `JetBrains Mono` for monospace financial tables and Saudi IBAN strings.
- **Spatial Mirroring:**
  - Layout axes flip: margin-start becomes left, margin-end becomes right.
  - Navigation bars, sidebars, and property photo carousels mirror horizontally.
  - Progression arrows reverse: next step points right (`→`), back step points left (`←`).

---

## Empty States & Feedback Patterns

Every data container, table, search results list, and queue specifies an institutional empty state:
- **Visuals:** Level 1 sunken surface (`{colors.surface-sunken}`), centered minimalist emblem/icon, no cartoonish illustrations.
- **Typography:** Header in `{typography.heading-md}`, explanation in `{typography.body-md}`, color `{colors.ink-secondary}`.
- **Prescribed Empty Scenarios:**
  - Marketplace Search: "لا توجد عقارات مطابقة لمعايير البحث الحالية — يمكنك تعديل نطاق السعر أو الحي أو حفظ طلبك العقاري."
  - Offers Inbox: "لا توجد عروض واردة حالياً على هذا العقار."
  - Moderation Queue: "جميع المهام في قائمة التدقيق مكتملة — لا توجد عناصر بانتظار المراجعة."
  - My Demands: "لم تقم بإنشاء أي طلبات عقارية حتى الآن — يمكنك تحديد مواصفات عقارك المنشود ليقوم الوسطاء بمطابقته."

---

## Do's and Don'ts

### Do's
- **DO** always display Saudi IBANs in monospace font grouped into blocks of 4 characters (`SA03 8000 0000 0000 0000 0000`) with a dedicated one-click copy button and toast confirmation.
- **DO** display the single ask price and transparently disclose the calculated platform commission (2.5%) before any offer is submitted.
- **DO** strictly preserve RTL layout semantics: back arrows point right (`→`), forward arrows point left (`←`), and numeric steps flow from right to left.
- **DO** highlight Fal license verification numbers with a green checkmark pill linking to official licensing details.

### Don'ts
- **DON'T** ever display direct personal phone numbers, WhatsApp links, or personal email addresses prior to admin deal verification and completion.
- **DON'T** use multi-colored festive confetti or informal emojis on deal completion; use dignified executive milestone badges.
- **DON'T** use ambiguous currency symbols ($ or €); always use `ر.س` or `SAR` explicitly.
- **DON'T** allow unvalidated free-text inputs for IBANs; always run client-side mod-97 checksum validation before submission.
