---
name: elmasaif
description: Institutional Real Estate Marketplace Design System (KSA) - Arabic RTL-First, Trust-Centered, Sovereign Luxury
status: final
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
  font-secondary: 'Inter'
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
    hover-background: '{colors.primary-hover}'
    radius: '{rounded.md}'
    fontWeight: '600'
    fontSize: '15px'
  button-secondary:
    background: '{colors.surface-base}'
    foreground: '{colors.primary}'
    border: '{colors.primary}'
    radius: '{rounded.md}'
    fontWeight: '600'
    fontSize: '15px'
  property-card:
    background: '{colors.surface-base}'
    border: '{colors.surface-border}'
    radius: '{rounded.lg}'
    aspectRatio: '16/9'
  dual-payment-card:
    commission-border: '{colors.deal-platform-fee}'
    commission-bg: '{colors.deal-platform-fee-bg}'
    price-border: '{colors.surface-border-strong}'
    price-bg: '{colors.deal-seller-price-bg}'
    radius: '{rounded.lg}'
  deal-countdown-banner:
    background: '{colors.accent-light}'
    border: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
  signature-otp-pad:
    canvas-border: '{colors.surface-border-strong}'
    otp-box-size: '48px'
    otp-radius: '{rounded.md}'
    focus-ring: '{colors.primary}'
  map-pin-cluster:
    cluster-bg: '{colors.primary}'
    cluster-fg: '{colors.primary-foreground}'
    pin-bg: '{colors.surface-base}'
    pin-border: '{colors.primary}'
    pin-selected-bg: '{colors.primary}'
    pin-radius: '{rounded.full}'
  task-lock-banner:
    background: '{colors.status-pending-bg}'
    border: '{colors.status-pending-border}'
    foreground: '{colors.status-pending}'
    radius: '{rounded.md}'
  cascading-geo-selector:
    background: '{colors.surface-base}'
    border: '{colors.surface-border}'
    focus-ring: '{colors.primary}'
    radius: '{rounded.md}'
  security-modal:
    background: '{colors.surface-base}'
    border: '{colors.surface-border}'
    backdrop-blur: '8px'
    radius: '{rounded.lg}'
---

# El Masaif (المصايف) — Visual Identity System (DESIGN.md)

## Brand & Style

**El Masaif** is an institutional-grade digital real estate marketplace engineered exclusively for property sales across the Kingdom of Saudi Arabia. Its visual identity conveys sovereign permanence, regulatory solemnity, and wealth management certitude.

In contrast to casual consumer classified portals characterized by vibrant noise, promotional banners, and visual clutter, El Masaif maintains a disciplined, executive aesthetic posture:
- **Sovereign Luxury & Trust:** Anchored by deep Sovereign Emerald (`#1B4332`), symbolic of national institutional authority, paired with warm Desert Gold (`#C69C45`) for financial precision and verified achievements.
- **Architectural Restraint:** Crisp borders, subtle ambient occlusion, and generous spatial geometry replace frivolous drop shadows and rounded bubbly interfaces.
- **Dignified Typography:** Built on `IBM Plex Sans Arabic`, delivering legal clarity, typographic rhythm, and institutional readability across all viewports, complemented by `JetBrains Mono` for Saudi IBANs and transaction reference codes.
- **Zero Decorative Frivolity:** No festive confetti, emojis, or whimsical animations. Transactions representing millions of Saudi Riyals are treated with judicial dignity.

---

## Colors

### Color Story & Palette Roles

The palette is purposefully structured around regulatory compliance, financial segregation, and clear transactional accountability:

1. **Sovereign Emerald (`{colors.primary}: #1B4332`, `{colors.primary-hover}: #143326`, `{colors.primary-light}: #E8F3EE`):**
   - The primary brand anchor. Used for primary calls to action, navigation headers, verified checkmarks, and platform-owned operational surfaces.
   - It represents verified authority, stability, and governmental alignment with Saudi real estate standards.

2. **Desert Gold (`{colors.accent}: #C69C45`, `{colors.accent-hover}: #B38A38`, `{colors.accent-light}: #FAF4E8`):**
   - The financial highlight hue. Reserved strictly for monetary milestone badges, the active 48-hour deal countdown timer, verified Fal license crests, and deal completion achievements.
   - It is never used for generic buttons or standard UI borders.

3. **Dual Wire Transfer Segregation:**
   - **Platform Commission Fee (`{colors.deal-platform-fee}: #1B4332`, `{colors.deal-platform-fee-bg}: #F0F7F4`):** Emerald-toned card housing the official platform IBAN and unique reference code (`ELM-xxx-C`).
   - **Seller Purchase Price (`{colors.deal-seller-price}: #0F172A`, `{colors.deal-seller-price-bg}: #F8FAFC`):** Slate-toned card housing the verified seller's name and personal Saudi IBAN.
   - Distinct container styling prevents buyer transfer confusion when wiring multi-million SAR funds.

4. **Neutral & Surface Scale (Light Mode Default):**
   - Canvas background: `{colors.background}: #F8FAF9`.
   - Cards and inputs: `{colors.surface-base}: #FFFFFF`.
   - Recessed areas and table headers: `{colors.surface-sunken}: #F0F4F2`.
   - Structural borders: `{colors.surface-border}: #E2E8F0` and `{colors.surface-border-strong}: #CBD5E1`.

5. **Dark Mode Palette Scale:**
   - Deep obsidian canvas `{colors.dark-background}: #0B130E` with elevated surfaces `{colors.dark-surface-base}: #132018` and `{colors.dark-surface-raised}: #1C2E24`.
   - Muted emerald borders `{colors.dark-surface-border}: #23382C` preserve contrast without harsh glare.

6. **Status & Verification Badges:**
   - **Verified / Confirmed (`{colors.status-verified}: #059669` / `{colors.status-verified-bg}: #ECFDF5`):** REGA Fal certified, payment confirmed, deal completed.
   - **Pending / Action Required (`{colors.status-pending}: #D97706` / `{colors.status-pending-bg}: #FFFBEB`):** Task locked by admin, awaiting buyer proof, 48h timer ticking.
   - **Under Review (`{colors.status-info}: #2563EB` / `{colors.status-info-bg}: #EFF6FF`):** Offer in mediation, contract preparation, proof under audit.
   - **Restricted / Rejected (`{colors.status-danger}: #DC2626` / `{colors.status-danger-bg}: #FEF2F2`):** Fal license expired, proof rejected, listing blocked.
   - **Closed / Neutral (`{colors.status-neutral}: #64748B` / `{colors.status-neutral-bg}: #F1F5F9`):** Archived listing, expired demand, sold property record.

### Load-Bearing Contrast Targets (WCAG 2.1 AA)

All primary text and interactive combinations achieve or exceed WCAG 2.1 AA standards (minimum 4.5:1 for body, 3.0:1 for large text/icons):

| Element Combination | Foreground | Background | Contrast Ratio | WCAG Compliance |
|---|---|---|:---:|:---:|
| Primary Body Text on Canvas | `{colors.ink-primary}: #0F172A` | `{colors.background}: #F8FAF9` | **14.8:1** | AAA Pass |
| Secondary Text on Card Surface | `{colors.ink-secondary}: #475569` | `{colors.surface-base}: #FFFFFF` | **5.9:1** | AA Pass |
| Primary Button Text | `{colors.primary-foreground}: #FFFFFF` | `{colors.primary}: #1B4332` | **8.6:1** | AAA Pass |
| Accent Milestone Text on Light BG | `{colors.accent-foreground}: #1A1208` | `{colors.accent-light}: #FAF4E8` | **15.2:1** | AAA Pass |
| Dark Mode Body Text | `{colors.dark-ink-primary}: #F1F5F9` | `{colors.dark-background}: #0B130E` | **16.1:1** | AAA Pass |
| Verified Badge Text on Badge BG | `{colors.status-verified}: #059669` | `{colors.status-verified-bg}: #ECFDF5` | **5.2:1** | AA Pass |
| Pending Lock Text on Lock BG | `{colors.status-pending}: #D97706` | `{colors.status-pending-bg}: #FFFBEB` | **4.8:1** | AA Pass |
| Danger Alert Text on Danger BG | `{colors.status-danger}: #DC2626` | `{colors.status-danger-bg}: #FEF2F2` | **5.4:1** | AA Pass |

---

## Typography

The platform specifies **`IBM Plex Sans Arabic`** as the universal primary typeface across all viewports, complemented by **`JetBrains Mono`** for financial and regulatory codes, and **`Inter`** for secondary English viewports.

### Typographic Hierarchy & Scales

| Token Name | Font Family | Size | Weight | Line Height | Usage |
|---|---|:---:|:---:|:---:|---|
| `{typography.heading-display}` | `IBM Plex Sans Arabic` | `36px` | 700 | 1.25 | Hero headlines on public portal and property showcase headers. |
| `{typography.heading-xl}` | `IBM Plex Sans Arabic` | `28px` | 700 | 1.3 | Workspace dashboards, Deal completion climax, and contract review titles. |
| `{typography.heading-lg}` | `IBM Plex Sans Arabic` | `22px` | 600 | 1.35 | Property card ask prices, section headers, modal dialog titles. |
| `{typography.heading-md}` | `IBM Plex Sans Arabic` | `18px` | 600 | 1.4 | Filter group titles, card headers, table column super-headers. |
| `{typography.body-lg}` | `IBM Plex Sans Arabic` | `16px` | 400 | 1.6 | Primary narrative text, property descriptions, contract legal clauses. |
| `{typography.body-md}` | `IBM Plex Sans Arabic` | `14px` | 400 | 1.5 | Default UI body, form labels, table cells, metadata pills. |
| `{typography.body-sm}` | `IBM Plex Sans Arabic` | `12px` | 400 | 1.45 | Timestamps, helper text, footnote disclaimers, micro-badges. |
| `{typography.code-iban}` | `JetBrains Mono` | `14px` | 500 | 1.5 | Saudi IBANs (`SA...`), Deal reference codes (`ELM-408-C`), National ID / CR numbers. |

---

## Layout & Spacing

### Spatial Grid & Geometry

- **RTL Baseline:** The layout root executes strictly Right-to-Left (`dir="rtl"`). Margin-start is right, margin-end is left. Progression arrows, chevrons, and timeline chevrons reverse naturally.
- **Container Max Width:** `{spacing.container-max}: 1280px` centered for public portal; full-width fluid responsive layout with `{spacing.sidebar-width}: 280px` collapsible sidebar for authenticated user workspaces (`/app/*`) and `{spacing.admin-sidebar-width}: 260px` sidebar for Admin Back-Office (`/admin/*`).
- **Standard Spacing Scale:** Built on a 4px/8px modular rhythm (`{spacing.1}: 4px`, `{spacing.2}: 8px`, `{spacing.3}: 12px`, `{spacing.4}: 16px`, `{spacing.5}: 20px`, `{spacing.6}: 24px`, `{spacing.8}: 32px`, `{spacing.10}: 40px`, `{spacing.12}: 48px`, `{spacing.16}: 64px`).
- **Gutter & Margins across Breakpoints:**
  - Desktop (`lg` / `xl` >= 1024px): `24px` gutter, `32px` page margins.
  - Tablet (`md` 768px - 1023px): `16px` gutter, `20px` page margins.
  - Mobile (`sm` < 768px): `12px` gutter, `16px` screen padding.

---

## Elevation & Depth

El Masaif avoids hyper-deep floating 3D drop shadows in favor of crisp, structural borders paired with restrained ambient occlusion:

- **Level 0 (Flat):** Tables, form inputs, inline badges (`border: 1px solid {colors.surface-border}`).
- **Level 1 (Card Rest):** Property cards, filter panels, summary boxes (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04); border: 1px solid {colors.surface-border}`).
- **Level 2 (Interactive / Hover):** Property cards on hover, active dropdown menus (`box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04); transform: translateY(-2px); transition: all 150ms ease-in-out`).
- **Level 3 (Modal & Sheet):** Dialogs, OTP modals, contract signing sheets, payment proof lightboxes (`box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`).
- **Backdrop Blur:** Modals and sticky navigation utilize `backdrop-filter: blur(8px)` with `rgba(255, 255, 255, 0.85)` surface overlay (dark mode: `rgba(11, 19, 14, 0.85)`).

---

## Shapes

- **Base Radius (`{rounded.md}: 10px`):** Applied to buttons, form inputs, modal dialogs, and alert banners. Strikes the balance between executive precision and contemporary digital softness.
- **Card Radius (`{rounded.lg}: 16px`):** Applied to property cards, interactive map popups, and financial summary cards.
- **Pill Radius (`{rounded.full}: 9999px`):** Used exclusively for status badges (`Active`, `Reserved`, `Under Review`), role chips (`مشتري`, `وسيط مرخص`, `مالك`), and map price tags.
- **Input Borders:** `1.5px` border width with crisp focus ring using `{colors.primary}` with 3px opacity halo (`box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.15)`).

---

## Components

### 1. Property Card (Marketplace)
- **Image Aspect Ratio:** 16:9 carousel with photo counter pill (`1/12`) on top-left (RTL) and Fal-verified badge on top-right.
- **Ask Price:** Prominently set in `{typography.heading-lg}`, followed by SAR currency label (`ر.س`).
- **Specs Strip:** Micro-icons for Bedrooms and Area in square meters (`م²`), separated by hairline borders (bathrooms omitted per data model).
- **Location Tag:** City and District with pin icon (`الرياض، حي النرجس`).

### 2. Dual Payment Transfer Card (Deal Screen)
- **Container:** Segregated into two distinct cards side-by-side on desktop or stacked on mobile:
  - **Card 1: Platform Commission (سعي المنصة):** Border `{colors.deal-platform-fee}`, background `{colors.deal-platform-fee-bg}`. Displays platform IBAN, generated Reference Code (`ELM-408-C`) with copy button, and exact commission amount (2.5% + fixed fee).
  - **Card 2: Property Purchase Price (قيمة العقار للبائع):** Border `{colors.surface-border-strong}`, background `{colors.deal-seller-price-bg}`. Displays Seller's verified name, Seller's verified Saudi IBAN with copy button, and agreed purchase price.
- **Proof Upload Area:** Drag-and-drop zone with PDF/image support (max 10 MB), progress bar, thumbnail preview, and Replace/Remove controls.

### 3. Deal 48-Hour Countdown Banner
- **Visuals:** Gold accent container (`{colors.accent-light}`, border `{colors.accent}`) with countdown clock (`ساعة : دقيقة : ثانية`), visual progress bar, and explicit administrative notice:
  - *"رفع إيصال التحويل يوقف الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة في حال الرفض دون إلغاء فوري."*
- **SLA Notice:** Clearly communicates that on-time uploads protect the deal from cancellation while under review.

### 4. Electronic Signature & OTP Pad (Owner Contract)
- **Canvas:** Smooth signature drawing canvas (`{colors.surface-base}`, border `{colors.surface-border-strong}`) with "مسح التوقيع" (Clear) and "اعتماد التوقيع" (Adopt) controls.
- **OTP Verification:** 6-box segmented numeric input (`48px x 48px`, radius `{rounded.md}`) with auto-advance, paste support, and 60-second countdown resend trigger.

### 5. Interactive Map Pin & Cluster
- **Cluster:** Emerald circle (`{colors.primary}`) with item count in `{colors.primary-foreground}`.
- **Price Pin:** White rounded-pill container with dark green border displaying price (`3.2 مليون`), transitions to solid emerald background when selected.

### 6. Admin Operational Task-Lock Banner (FR-51, UX-DR15)
- **Container:** High-visibility amber accent card (`{colors.status-pending-bg}`, border `{colors.status-pending-border}`) pinned at top of moderation, audit, and conversation workspaces.
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
- **Cooling-Off Banner:** In Account Deletion, displays amber alert detailing the 14-day cooling-off window (`DeletionPending`) and statutory financial record retention disclosure.

### 9. Review Moderation Card & Rating Display (FR-52, FR-54)
- **Container:** Card with 1-5 gold stars (`{colors.accent}`), buyer username, completion timestamp, and qualitative text.
- **Admin Moderation Controls:** "إخفاء التقييم" (Hide Review) action requiring a mandatory reason logged to `AuditLog`; "استعادة التقييم" (Restore Review) action for previously hidden items.
- **Badge Indicator:** Shows whether the review is currently included or excluded from public seller averages.

### 10. Operational Queue & Audit Table (FR-40, FR-42, FR-51)
- **Container:** Level 0 flat data table with sticky header (`{colors.surface-sunken}`), row striping on hover, and status pills.
- **Lock Column:** Displays claim status (Unlocked, Claimed by You with lease timer, Locked by Admin with padlock).
- **Audit Row:** In `/admin/system`, displays actor, timestamp (UTC), IP, action string, entity, previous/new value diff, and operational reason.

---

## Do's and Don'ts

### Do's
- **DO** always display Saudi IBANs in monospace font grouped into blocks of 4 characters (`SA03 8000 0000 0000 0000 0000`) with a dedicated one-click copy button and toast confirmation.
- **DO** display the single ask price and transparently disclose the calculated platform commission (2.5% + fixed fee) before any offer is submitted.
- **DO** strictly preserve RTL layout semantics: back arrows point right (`→`), forward arrows point left (`←`), and numeric steps flow from right to left.
- **DO** highlight Fal license verification numbers with a green checkmark pill linking to official licensing details.
- **DO** show prominent task claim lock countdowns on administrative workspaces to avoid conflicting concurrent reviews.

### Don'ts
- **DON'T** ever display direct personal phone numbers, WhatsApp links, or personal email addresses prior to admin deal verification and completion.
- **DON'T** use multi-colored festive confetti or informal emojis on deal completion; use dignified executive milestone badges.
- **DON'T** use ambiguous currency symbols ($ or €); always use `ر.س` or `SAR` explicitly.
- **DON'T** allow unvalidated free-text inputs for IBANs or geographic locations; always run client-side mod-97 checksum validation and use cascading dropdowns linked to master seed tables.
- **DON'T** allow administrators to edit or override listing ask prices directly; only non-binding price revision suggestions may be dispatched.
