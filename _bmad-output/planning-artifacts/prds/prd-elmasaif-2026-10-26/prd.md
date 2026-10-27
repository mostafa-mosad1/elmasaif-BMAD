---
title: "PRD: Real Estate Marketplace Platform (El Masaif)"
status: draft
created: "2026-10-26"
updated: "2026-10-27"
inputDocuments:
  - Software Requirements Specification (SRS v2.2)
  - Product Brief (2026-10-26)
---

# PRD: Real Estate Marketplace Platform (El Masaif)

## 0. Document Purpose

This Product Requirements Document (PRD) establishes the definitive business, functional, and non-functional specifications for **El Masaif (المصايف)**, an institutional real estate marketplace platform engineered exclusively for property sales across the Kingdom of Saudi Arabia (KSA). 

This document serves as the binding reference for Product Management, System Architecture (`bmad-architecture`), UX/UI Design (`bmad-ux`), Quality Engineering (`bmad-tea`), and vertical slice sprint execution (`bmad-create-epics-and-stories`). It formalizes requirements originally outlined in the Software Requirements Specification (SRS v2.2) and the Product Brief approved on 2026-10-26. BR-xx and UC-xx identifiers refer to the SRS. Technical implementation mechanics, physical database schemas, and state machine transition tables are preserved in the accompanying [`addendum.md`](./addendum.md).

---

## 1. Vision

**El Masaif** is a mediated, trust-first digital marketplace dedicated exclusively to real estate property sales in the Kingdom of Saudi Arabia. In contrast to conventional unmoderated classified portals where contact poaching, unlicensed intermediaries, and fraudulent listings are rampant, El Masaif introduces an institutional-grade transaction pipeline. Every inquiry, property offer, counter-offer round, and deal negotiation is systematically mediated through platform administration, ensuring that direct counterparty communication remains strictly locked until a transaction has been officially verified and completed.

The platform operationalizes a non-custodial financial architecture tailored to Saudi financial and regulatory realities: the platform never holds multi-million SAR property purchase funds in digital escrow. Instead, property buyers transfer the agreed purchase price directly to the verified seller (Owner or licensed Marketer) via external bank transfer, while platform commissions and owner contract fees are transferred directly to the designated platform bank account. Platform operators audit both payment proofs against verified Saudi IBANs and generated bank reference codes before approving deal completion. Built as a high-performance responsive web application (Arabic RTL-first in Next.js) backed by an independent NestJS REST API and PostgreSQL, El Masaif establishes transparency, regulatory compliance under the Real Estate General Authority (REGA), and transaction velocity for residential and commercial property sales.

---

## 2. Target User

### 2.1 Jobs To Be Done (JTBD)

- **The Property Buyer (Investor / Home Seeker):**
  - *Functional:* "When I want to purchase property in KSA, I want to search vetted listings with accurate single ask prices, submit structured property requests (Demands), and negotiate binding offers through a protected channel, so that I don't waste time on ghost listings or uncertified middlemen."
  - *Emotional / Social:* "I want confidence that the seller is legitimate, the title deed is authentic, and my high-value bank transfer is validated before contracts and contact details are finalized."
- **The Licensed Marketer (Real Estate Broker):**
  - *Functional:* "When I market properties under my Fal license, I want automated demand matching, buyers who have uploaded an identity document (existence check only, BR-10), and a structured offer negotiation pipeline, so that I can close transactions efficiently."
  - *Emotional:* "I want to be recognized as an authorized professional in full compliance with REGA regulations without regulatory liability."
- **The Direct Property Owner:**
  - *Functional:* "When I sell my residential or commercial asset, I want to publish my listing backed by a standardized electronic contract and receive qualified offers without receiving unsolicited broker phone calls."
  - *Financial:* "I want the agreed property sale price transferred directly to my verified Saudi bank account without middlemen taking unauthorized markups."
- **The Platform Operator / Administrator:**
  - *Functional:* "When managing daily platform operations, I want central queues to moderate listings, review Fal licenses, mediate negotiations, and verify dual bank transfer proofs against an immutable audit log under granular RBAC."

### 2.2 Non-Users (v1)

- **Tenants and Landlords:** Residential or commercial rental, leasing, and property management are strictly out of scope in v1.
- **Real Estate Auction Seekers:** Court-ordered, judicial, or public live auction operations are excluded.
- **Installment Financing / Mortgage Borrowers:** Mortgage brokerage, consumer credit scoring, and direct lender origination integrations are not served in v1.
- **Unlicensed Freelance Middlemen:** Individuals lacking a valid, verifiable REGA Fal license are legally barred from marketing properties.

### 2.3 Key User Journeys

#### UJ-1. Tariq Buys an Executive Villa in Riyadh via Dual External Bank Transfer
- **Persona & Context:** Tariq, a 38-year-old financial analyst buying a primary residence for his family in Riyadh, navigating high-value real estate.
- **Entry State:** Authenticated via Saudi mobile OTP on the responsive web application (`/app/buyer`), profile status `Active`, national ID document uploaded.
- **Path:**
  1. Tariq browses Riyadh villas using the interactive map with green markers and filters for 4+ bedrooms and a budget cap of SAR 3,200,000.
  2. He inspects Listing #1042 (ask price: SAR 3,100,000). The dynamic fee calculator shows an estimated platform commission of SAR 77,500 (2.5%) and estimated total of SAR 3,177,500.
  3. Tariq submits a formal offer of SAR 2,950,000. The offer enters the Admin Review Queue.
  4. Platform Admin approves and relays the offer to the seller. The seller counter-offers SAR 3,000,000. Tariq receives an in-app notification and accepts.
  5. Admin reviews the accepted negotiation and triggers Final Approval. Deal #408 is created with `status: AwaitingPaymentProof` and a payment deadline countdown timer begins. Listing #1042 becomes `Reserved`.
  6. The Deal screen displays frozen financial snapshots: Deal Price SAR 3,000,000, Platform Commission SAR 75,000 (2.5%), Total SAR 3,075,000. It displays:
     - Payment 1 (Commission): Platform IBAN + generated Deal Reference Code (`ELM-408-C`).
     - Payment 2 (Price): Seller's verified Saudi IBAN and account holder name.
  7. Tariq executes two external wire transfers via his bank mobile app, uploads PDF receipts for both, and submits.
- **Climax:** Admin confirms both proofs. System atomically transitions Deal to `Completed`, sets Listing to `Sold`, releases the seller's direct phone number to Tariq, and unlocks seller rating.
- **Resolution:** Tariq receives the seller's contact details to arrange title deed transfer (Ifragh) at the notary, and submits a 5-star review.
- **Edge Case:** If Tariq uploads payment proofs near or after the payment deadline, the transaction is governed by the payment timing and review SLA protection rules in FR-31.

#### UJ-2. Sara Onboards as a Licensed Marketer and Lists a Commercial Office
- **Persona & Context:** Sara, a licensed Saudi real estate broker operating in Jeddah under an individual Fal Brokerage and Marketing License.
- **Entry State:** Registered account holder on desktop browser, toggles account role to `Marketer`.
- **Path:**
  1. Sara submits her business credentials: Fal license number, certificate PDF, license expiry date, commercial name, and 10-digit Commercial Registration (CR) number.
  2. Her profile enters `UnderReview`. While awaiting approval, she navigates to Payout Settings and adds her verified Saudi IBAN (mod-97 validated).
  3. Support Team verifies her Fal certificate in the Admin Licensing Queue and approves the profile. Sara receives notification and unlocks the Marketer Workspace (`/app/marketer`).
  4. Sara creates a listing for a commercial office in Al-Rawdah, Jeddah: ask price SAR 1,850,000, property specs, 8 high-resolution photos, title deed document (`AdminOnly`), owner authorization certificate (`AdminOnly`), and selects her registered payout IBAN.
  5. Admin compliance reviews the authorization and listing parameters, approving it to `Active`.
- **Climax:** Sara's listing appears on the public marketplace with her public broker rating and active listing tally; her personal phone and email remain shielded.
- **Resolution:** When an offer arrives, Sara reviews mediated terms directly in her portal without dealing with unauthorized intermediary calls.
- **Edge Case:** When Sara's Fal license reaches 30 days, 7 days, and 1 day before expiration, the system issues compliance warnings. If unrenewed upon expiration date, a daily cron job automatically flags her profile `ComplianceRestricted` and transitions her active listings to `UnderComplianceReview`.

#### UJ-3. Abu Fahad Signs an Electronic Listing Contract as a Direct Owner
- **Persona & Context:** Abu Fahad, a 60-year-old property owner in Dammam wishing to sell his commercial building without hiring an outside broker.
- **Entry State:** Authenticated user, selects `Owner` role profile.
- **Path:**
  1. Abu Fahad enters `/app/owner` and submits a Listing Request for his building: property details, title deed copy (`AdminOnly`), ask price SAR 4,500,000, and his verified personal Saudi IBAN.
  2. Admin evaluates the request and selects the Standard Owner Listing Contract Template, assigning a default contract fee of SAR 1,000.
  3. Abu Fahad receives an in-app alert: "Listing Contract Ready for Signature."
  4. He reviews the contract terms on the web interface, draws his signature on the signature pad, and enters a 6-digit OTP dispatched to his registered mobile number to stamp the document.
  5. Abu Fahad initiates a bank transfer of SAR 1,000 to the platform bank account and uploads the wire receipt.
- **Climax:** Admin confirms the contract fee proof. The listing transitions automatically from pending fee to `Active` on the marketplace.
- **Resolution:** Abu Fahad monitors buyer inquiries and incoming mediated offers from his dedicated Owner Dashboard.
- **Edge Case:** If the contract fee proof is rejected due to an incorrect reference number, Abu Fahad is notified with the exact admin reason and can re-upload a corrected bank receipt before the 7-day contract deadline expires.

#### UJ-4. Mansour Broadcasts a Buyer Demand and Closes via Automated Inventory Matching
- **Persona & Context:** Mansour, an investment manager looking to acquire residential land plots in Al-Khobar within a specific budget.
- **Entry State:** Authenticated Buyer on mobile web.
- **Path:**
  1. Mansour opens `/app/buyer/requests` and clicks "Submit Demand."
  2. He specifies: City = Al-Khobar, Property Type = Land, Budget = SAR 2,000,000, Required Area = 600 m² (with implicit ±20% tolerance: 480–720 m²), and notes on soil condition.
  3. Submitting the Demand is free; the Demand transitions immediately to `Active` with an expiry window of 30 days.
  4. The platform Matching Engine scans active inventory and identifies 3 qualified Providers (marketers and owners with active listings matching criteria).
  5. Marketer Hisham receives an instant Demand notification and attaches his active Land Listing #882 as a formal Proposal with an offered price of SAR 1,950,000.
  6. Admin performs content review and approves the proposal for buyer visibility.
- **Climax:** Mansour receives the approved proposal on his Demand dashboard, compares the land specs, and clicks "Select Offer."
- **Resolution:** The proposal advances to `SelectedPendingFinalAdminApproval`, prompting Admin to generate Deal #512 and initiate the payment deadline dual payment pipeline.
- **Edge Case:** If the seller rejects or Admin denies final approval, Mansour's Demand returns to `Active` status, enabling him to choose alternative proposals or await new matches.

#### UJ-5. Khalid (Support Admin) Mediates an Offer and Validates Dual Bank Proofs
- **Persona & Context:** Khalid, a platform operations specialist in Riyadh managing the Admin Back-Office (`/admin`).
- **Entry State:** Authenticated in the dedicated Admin Realm with role `Support Team` (permissions `Offers.Review`, `Deals.View`, `Payments.Review`, `Conversations.Handle`).
- **Path:**
  1. Khalid monitors the Admin Dashboard. An alert highlights an incoming buyer inquiry on Listing #1042 containing a masked phone number attempt ("050-XXXXXXX").
  2. Khalid reviews the conversation queue, strips the off-platform communication attempt, and relays the legitimate property specification query to the seller.
  3. Next, Khalid inspects the Payment Review Queue for Deal #408 (total deal value SAR 3,075,000).
  4. He opens Payment 1 (Commission SAR 75,000): inspects the uploaded PDF receipt, verifies the transaction reference code matches `ELM-408-C`, checks amount, and clicks `Confirm Payment`.
  5. He opens Payment 2 (Property Price SAR 3,000,000): cross-references the uploaded bank transfer slip against the Deal's frozen Seller Payout IBAN and account holder name. Everything matches. He clicks `Confirm Payment`.
- **Climax:** The system validates that both payment records are `Confirmed`, atomically commits `Deal = Completed`, transitions `Listing = Sold`, sends transactional notifications, and archives active negotiation threads.
- **Resolution:** Khalid logs internal verification notes; the immutable audit log records his action with timestamp, admin ID, and checksum.
- **Edge Case:** If Payment 2 shows an IBAN mismatch or suspected altered receipt, Khalid flags the payment as `Rejected` with a mandatory reason ("IBAN does not match registered seller payout account SA..."), which immediately notifies the buyer to upload the authentic receipt before the payment window expires.

---

## 3. Glossary

The following domain terms are canonical. All functional requirements, user journeys, data models, and downstream technical artifacts must use these terms verbatim.

| Term | Definition & Domain Rules |
|---|---|
| **Account** | The singular identity record tied to one verified Saudi mobile number (`+9665XXXXXXXX`), holding credentials and linked role profiles. |
| **Role Profile** | A specialized capability attached to an Account: `Buyer`, `Marketer`, or `Owner`. An Account can hold multiple active role profiles. |
| **Provider** | A registered `Marketer` (holding an approved Fal license) or an `Owner` (holding an active listing contract) qualified to publish listings and respond to Demands. |
| **Seller** | The specific Provider who owns or represents an active Listing and receives the property purchase price. |
| **Fal License** | The official real estate brokerage authorization issued by the Real Estate General Authority (REGA), mandatory for all Marketer operations. |
| **Listing** | A residential or commercial real estate asset published for sale at a single ask price. Rentals are excluded. |
| **Ask Price** | The single monetary amount (in SAR) demanded by the seller on a listing (min 1, max 50,000,000 SAR). Price ranges are prohibited. |
| **Offer** | A formal price proposal submitted by a Buyer on a specific Listing or in response to a Demand. |
| **Counter-Offer** | A revised price proposal transmitted between Buyer and Seller through Admin mediation; increments `NegotiationRound`. |
| **Backup Offer** | An offer submitted on a listing whose status is currently `Reserved` due to an in-flight Deal. |
| **Demand** | A structured property request broadcast by a Buyer specifying property type, city, budget, and area requirements. |
| **Matching Engine** | The automated system service that pairs active Demands with qualifying Provider listings within defined criteria tolerances. |
| **Proposal** | A Provider's formal submission linking an active qualifying Listing to a Buyer's Demand. |
| **Deal** | The legal and transactional entity created exclusively by final administrative approval (`UC-70B`), governing the dual payment workflow. |
| **Platform Commission** | The platform service fee paid by the Buyer directly to the platform bank account (default 2.5% of deal price + fixed fee). |
| **Price Payment** | The agreed property purchase price transferred directly from the Buyer to the Seller's verified Saudi bank account. |
| **Payout Account** | The verified Saudi bank account (holder name and mod-97 validated IBAN) registered by a Seller to receive property price payments. |
| **Payment Proof** | A document (PDF/image) uploaded by a Buyer verifying execution of an external bank transfer. |
| **PaymentDeadline** | The exact timestamp (`Deal.createdAt + PaymentWindowHours`, default 48h) by which payment proofs must be uploaded (not confirmed). At the deadline, each payment still without an uploaded proof becomes Expired. |
| **Financial Snapshot** | Immutable financial data (`FinalDealPrice`, `CommissionRateSnapshot`, `FixedCommissionSnapshot`, `FinalCommission`, `FinalTotal`, `SellerPayoutAccount`) frozen on the Deal at creation. |
| **Mediation** | The mandatory platform process routing all inquiries, messages, offers, and counter-offers through Admin queues to prevent direct contact. |
| **Dispute** | A formal objection raised by Buyer or Seller after payment proof upload, or initiated automatically by the system when Price is Confirmed and Commission is Expired, suspending automated timeouts and completion until Super Admin adjudication. |
| **Owner Contract** | The binding listing agreement between the platform and a direct Property Owner, requiring electronic signature and contract fee payment. |
| **Contract Fee** | The administrative fee paid by an Owner to the platform before an Owner listing can be published. |
| **Dynamic RBAC** | Granular Role-Based Access Control governing administrator permissions (`Area.Action`) within the isolated admin back-office. |
| **Audit Event** | An immutable, insert-only log record documenting actor, timestamp, action, entity, previous value, new value, and operational reason, persisted in the `AuditLog` append-only storage table. |
| **OtpProvider** | The swappable system interface executing one-time password delivery (static dev code `123456` in development; SMS gateway in production). |
| **IBAN** | International Bank Account Number for Saudi Arabia (`SA` followed by 2 check digits and 22 alphanumeric characters, total 24 chars). |
| **SAR** | Saudi Riyal, the sole currency supported across all platform listings, offers, deals, and reports. |
| **PDPL** | Personal Data Protection Law of the Kingdom of Saudi Arabia, governing the handling and retention of user identity and financial records. |

---

## 4. Features & Functional Requirements

### 4.1 Identity, Multi-Role Access & Account Governance
**Description:** Provides secure authentication anchored to verified Saudi mobile phone numbers. Supports multi-role profiles allowing a single user account to toggle between Buyer, Marketer, and Owner workspaces without re-registering. Enforces secure session management, ID document storage, and payout account setup.

#### FR-1: Saudi Mobile Registration, OTP Verification & Legal Consent Tracking
- **Priority:** P0
- **Capability:** A visitor can register an account by submitting their full name (3–100 chars) and Saudi mobile number (`^(\+966|0)5[0-9]{8}$`, normalized to `+9665XXXXXXXX`), verifying possession via a 6-digit OTP, configuring a unique username and password, and providing explicit legal consent to platform Terms of Service and Saudi PDPL Privacy Policy. Realizes UJ-1, UJ-2, UJ-3.
- **Consequences (testable):**
  - System rejects non-Saudi phone formats with error `AUTH_INVALID_PHONE`.
  - Registration atomically records immutable legal consent metadata: `terms_version` (e.g. `1.0`), `privacy_version` (e.g. `1.0`), `consent_timestamp` (UTC), and user `ip_address` for Saudi PDPL audit compliance.
  - When a new terms or privacy version is published, the next login shows a blocking re-consent screen and writes a new immutable record.
  - OTP expires after 300 seconds; resend is throttled to 1 request per 60 seconds and max 3 requests per hour per phone.
  - 3 consecutive incorrect OTP entries lock verification for 15 minutes.
  - Password must be at least 8 characters containing at least one letter and one number `[ASSUMPTION: A-02]`.

#### FR-2: Returning User Login & Session Handling
- **Priority:** P0
- **Capability:** Registered users can authenticate using username/phone and password, issuing an HttpOnly, Secure session cookie with rolling 30-day expiry `[ASSUMPTION: A-03]`. Realizes UJ-1.
- **Consequences (testable):**
  - 5 consecutive failed login attempts lock account login for 15 minutes `[ASSUMPTION: A-04]`.
  - Logging in from a new device or expired session triggers step-up OTP verification.
  - Logging in while account is in status `DeletionPending` immediately cancels the deletion request and restores account to `Active`. Accounts in `Deactivated`, `Disabled`, or `SoftDeleted` status are strictly refused login with explicit error `AUTH_ACCOUNT_DEACTIVATED` or `AUTH_ACCOUNT_DISABLED`.

#### FR-3: Multi-Role Profile Switching
- **Priority:** P0
- **Capability:** An authenticated user can attach multiple role profiles (`Buyer`, `Marketer`, `Owner`) to their single account and switch workspaces via the account menu without re-authenticating. Realizes UJ-2, UJ-3.
- **Consequences (testable):**
  - Adding the `Owner` role is instantaneous.
  - Adding the `Marketer` role requires completing Fal license onboarding (FR-6) and remains disabled until admin approval.
  - Current active role scopes API authorization guards on subsequent requests.

#### FR-4: Identity Document Verification
- **Priority:** P0
- **Capability:** Users can upload a national identity document (National ID / Iqama) in PDF/JPEG/PNG format up to 10 MB, stored securely with `AdminOnly` visibility. Realizes UJ-1.
- **Consequences (testable):**
  - System verifies document existence before allowing a Buyer to upload Deal payment proofs (BR-10).
  - Identity files are accessible only by platform admins and the document owner via signed URLs expiring in <= 5 minutes.

#### FR-5: Seller Payout Account Management
- **Priority:** P0
- **Capability:** Marketers and Owners can register and manage at least one payout account consisting of account holder name (3–100 chars) and a 24-character Saudi IBAN. Realizes UJ-1, UJ-2, UJ-3.
- **Consequences (testable):**
  - System executes format validation and mod-97 checksum validation; invalid IBANs return `PAYOUT_INVALID_IBAN`.
  - Creating or updating a payout account requires step-up OTP confirmation and logs an immutable audit event (BR-05).
  - System prohibits modifying or deleting any payout account currently bound to an active, non-terminal Deal.
  - Name mismatch between account holder and user commercial name flags an administrative warning `[ASSUMPTION: A-10]`.

#### FR-46: Forgot Password & Password Reset via Step-Up OTP
- **Priority:** P0
- **Capability:** A user can initiate password recovery by submitting their Saudi mobile number, receiving an OTP, and configuring a new password. Realizes UJ-1.
- **Consequences (testable):**
  - System returns the identical response structure for registered and unregistered numbers to eliminate account enumeration (`AUTH_RESET_INITIATED`).
  - OTP dispatch conforms to FR-1 rate limits (300s expiry, 60s resend throttle, max 3 requests per hour per phone).
  - 3 incorrect OTP entries lock password reset attempts for 15 minutes.
  - New password must differ from the current password and meet complexity requirements (>= 8 chars, at least one letter and one number).
  - Completing reset revokes all active user sessions across all devices and issues an immutable audit event.
  - Security notification dispatched to the registered mobile number.
  - Disabled or soft-deleted accounts cannot execute password reset.

#### FR-47: Change Password
- **Priority:** P1
- **Capability:** An authenticated user can update their password from account settings. Realizes UJ-1.
- **Consequences (testable):**
  - Submitting an incorrect current password returns `AUTH_INVALID_CREDENTIALS` and increments the failed attempt counter toward temporary account lockout.
  - New password must differ from current password and comply with complexity rules.
  - Successful password change immediately revokes all other concurrent active sessions except the requesting session.
  - Dispatches security notification alert to the registered phone and writes an audit event.

#### FR-48: Secure Mobile Number Update
- **Priority:** P1
- **Capability:** An authenticated user can update their registered Saudi mobile number via dual OTP verification or support-assisted recovery. Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Dual-OTP Flow: System dispatches a 6-digit OTP to the current registered number AND a second 6-digit OTP to the proposed new number. Both OTPs must be verified within 15 minutes; otherwise, the phone change request expires.
  - New number must be a valid Saudi mobile number and must not belong to an existing active account (`AUTH_PHONE_IN_USE`).
  - Upon successful verification of both OTPs, the system updates the account mobile number, re-normalizes to `+9665XXXXXXXX`, and dispatches an informational notification to the old number.
  - Action is strictly blocked while the account has any active Deal in `AwaitingPaymentProof`, `PaymentUnderReview`, or `Disputed` status.
  - Support-Assisted Path: Users who have lost access to their old number may request an administrative phone change. Requires permission `Users.PhoneChange` (held only by Super Admin by default to mitigate R-09), verified inspection of official identity documentation, mandatory recorded reason, and an immutable audit event.

#### FR-49: User Profile Editing
- **Priority:** P1
- **Capability:** Authenticated users can update non-identifier profile data (display name and contact email). Realizes UJ-1.
- **Consequences (testable):**
  - Updates are restricted to full name and contact email only; username and primary mobile number cannot be altered via this endpoint.
  - A modified email address remains in pending state (`pendingEmail`) until the user opens a mandatory verification link dispatched to the new email address (`emailVerifiedAt`).
  - Changes to profile attributes write an audit event recording previous and new values.
  - If a Marketer or Owner alters their legal/commercial name such that it diverges from their registered payout account name or Fal license name, the system raises an administrative commercial-name mismatch warning per FR-5.

#### FR-50: Right to Erasure / Account Deletion Request
- **Priority:** P1
- **Capability:** Users can submit an account deletion request from settings in compliance with Saudi PDPL. Realizes UJ-1.
- **Consequences (testable):**
  - Submission requires re-authentication with current password and step-up OTP confirmation.
  - Request is strictly blocked while any associated Deal is non-terminal, any Dispute is open, or any linked Owner listing contract is in `SignedPendingFee` or `FeeUnderReview` status.
  - Accounts with zero transaction history (defined as no listings, offers, deals, payments, contracts, messages, ratings, reports, or tickets) transition to status `DeletionPending` with a 14-day cooling-off period `[ASSUMPTION: A-13]`. If the user logs in during the cooling-off window, the deletion request is cancelled and restored to `Active`. Upon cooling-off expiration, personal data is permanently erased or anonymized.
  - Accounts with historical records in any of these categories (listings, offers, deals, payments, contracts, messages, ratings, reports, or tickets) are placed in `Deactivated` status: login is disabled, direct public profile is hidden, and active listings are archived, while legally required financial, tax, and contractual records are retained under retention schedules set by legal counsel (BR-18).
  - Adds `DeletionPending` status to the Account lifecycle state machine.

---

### 4.2 Licensing & Owner Contract Governance
**Description:** Enforces strict regulatory compliance for property sellers. Marketers must maintain verified, unexpired Fal licenses under REGA regulations. Direct Owners must execute standardized electronic listing agreements and pay listing contract fees prior to property publication.

#### FR-6: Fal License Submission & Administrative Review
- **Priority:** P0
- **Capability:** A Marketer applicant can submit business credentials (license certificate file, license number, license expiration date, commercial name, 10-digit CR number, and up to 5 supporting documents) for admin verification. Realizes UJ-2.
- **Consequences (testable):**
  - Submitting sets `FalProfile = UnderReview` and routes the item to the Admin Licensing Queue.
  - Expiration date set in the past is rejected on client and server (`FAL_EXPIRED_DATE`).
  - Admin approval transitions profile to `Approved` and dispatches notification; rejection requires a documented reason and permits re-submission.

#### FR-7: Automated Fal Expiry Enforcement
- **Priority:** P0
- **Capability:** The platform executes a daily background job to track Fal license expiration dates and enforce immediate compliance restrictions upon expiry. Realizes UJ-2.
- **Consequences (testable):**
  - Automated warnings are dispatched to Marketers 30 days, 7 days, and 1 day prior to license expiration `[ASSUMPTION: A-05]`.
  - On the expiration date, the job automatically sets `FalProfile = ComplianceRestricted` and moves all linked `Active` listings to `UnderComplianceReview` (BR-14).
  - Existing in-flight Deals continue unaffected to completion.

#### FR-8: Fal License Renewal
- **Priority:** P0
- **Capability:** A restricted or expiring Marketer can submit an updated Fal certificate and extended expiration date for administrative re-review. Realizes UJ-2.
- **Consequences (testable):**
  - Profile transitions to `RenewalUnderReview`.
  - Upon admin approval, eligible listings held in `UnderComplianceReview` automatically return to `Active`.

#### FR-9: Owner Contract Generation & Electronic Signature
- **Priority:** P0
- **Capability:** A direct Owner can request property publication, review an admin-assigned contract template, and execute an electronic signature using an interactive signature canvas plus OTP confirmation. Realizes UJ-3.
- **Consequences (testable):**
  - Contract captures timestamp, user IP, device user agent, drawn signature raster, and verified OTP record.
  - Signed contract transitions to `SignedPendingFee` with a payment window of 7 days (`ContractFeeDeadline`) `[ASSUMPTION: A-06]`.
  - If the contract fee is not uploaded before `ContractFeeDeadline` (7 days), the contract transitions to `Expired` status.

#### FR-10: Owner Contract Fee Verification
- **Priority:** P0
- **Capability:** An Owner can upload bank transfer proof for the listing contract fee (default SAR 1,000, configurable per listing by admin) to the platform bank account. Realizes UJ-3.
- **Consequences (testable):**
  - Proof upload transitions payment to `ProofUploaded` / `FeeUnderReview`.
  - Admin confirmation transitions contract to `Active` and automatically publishes the owner's listing to `Active` marketplace status (BR-15).
  - If no fee proof is uploaded before `ContractFeeDeadline`, or a rejected proof is not corrected before the deadline, the contract payment transitions to `Expired`.
  - Contract fees are strictly non-refundable once confirmed `[ASSUMPTION: OQ-08]`.

---

### 4.3 Property Listing Lifecycle & Media Management
**Description:** Manages residential and commercial property inventory strictly dedicated to sales. Governs listing creation, multi-image upload, administrative moderation, compliance review, and lifecycle state changes.

#### FR-11: Listing Creation & Field Specifications (Structured Geography)
- **Priority:** P0
- **Capability:** Providers can create listings for sale with title, property type (Apartment, Villa, Land, Building, Office), location coordinates (lat/long), master `cityId` and cascading `districtId` (selected strictly from seeded Saudi `City` and `District` tables; unvalidated free text is rejected), single ask price (1 to 50,000,000 SAR), land area (m²), specifications, and bound payout IBAN. Realizes UJ-2, UJ-3.
- **Consequences (testable):**
  - System rejects rental listings or multi-tier price ranges (BR-01, BR-13).
  - Geographic inputs require valid foreign keys to master `City` and `District` models.
  - Marketers must upload an Owner Authorization Document (`AdminOnly`) proving authorization to sell the property `[ASSUMPTION: OQ-06]`.
  - Mandatory minimum 3 photos and maximum 20 photos (JPEG/PNG/WebP, max 10 MB per file).

#### FR-12: Document Visibility & Classification
- **Priority:** P0
- **Capability:** Listing creators can upload supporting documents and assign visibility flags (`Public` or `AdminOnly`). Realizes UJ-1, UJ-2.
- **Consequences (testable):**
  - Title deeds, commercial registers, Fal certificates, and authorization agreements are enforced as `AdminOnly` (BR-21).
  - Public documents (e.g., property floor plans) are visible to buyers on the listing details page; `AdminOnly` documents are never returned to non-admin API consumers.

#### FR-13: Listing Moderation & Task Claim Locking
- **Priority:** P0
- **Capability:** Administrators can review submitted listings, approve them to `Active`, reject with notes, or request modifications, protected by an administrative task claim locking mechanism (see FR-51). Realizes UJ-2, UJ-5.
- **Consequences (testable):**
  - Approved listings immediately appear in public search and map results.
  - Major edits to an `Active` listing (ask price, location, property type) reset status to `UnderReview`.
  - Minor edits (description, supplemental photos) apply immediately without resetting approval status (BR-13).

#### FR-14: Listing Archiving & Compliance Suspension
- **Priority:** P1
- **Capability:** Sellers can archive `Active` listings that have no active in-flight Deal; administrators can hide or block non-compliant listings immediately. Realizes UJ-2, UJ-5.
- **Consequences (testable):**
  - System blocks archiving or deleting any listing currently in `Reserved` status or linked to an active Deal.
  - Admin blocking immediately hides the listing from search and cancels non-deal pending offers (BR-16).

---

### 4.4 Discovery, Search & Spatial Visualization
**Description:** Enables buyers to discover properties through multi-faceted search filters, responsive paginated lists, and an interactive colored map interface.

#### FR-15: Multi-Criteria Filter Search
- **Priority:** P0
- **Capability:** Buyers can filter listings by free text, property type, city, district, price range, area range, and bedroom count. Realizes UJ-1.
- **Consequences (testable):**
  - Search results return only `Active` and `Reserved` listings; sold, archived, hidden, and blocked properties are excluded.
  - Results are paginated (default 20 per page, max 100) and sortable by newest, price ascending, and price descending.
  - Query execution meets p95 latency target < 800 ms under 50,000 active listings.

#### FR-16: Interactive Clustered Map View
- **Priority:** P0
- **Capability:** Buyers can view listing locations on an interactive map featuring marker clustering below zoom level 12 and color-coded pins by property type (Apartment = Blue, Villa = Green, Land = Orange, Building = Purple, Office = Red). Realizes UJ-1.
- **Consequences (testable):**
  - Clicking a marker opens a compact listing preview card with photo, ask price, area, and status badge.
  - Map dynamically synchronizes markers with active filter criteria from FR-15.

#### FR-17: Listing Detail & Dynamic Fee Breakdown
- **Priority:** P0
- **Capability:** Buyers can inspect complete listing details, media carousel, specifications, seller public profile, and live platform commission calculation. Realizes UJ-1.
- **Consequences (testable):**
  - Screen dynamically displays: Ask Price, Estimated Platform Commission (2.5%), and Estimated Total (BR-02).
  - Direct seller phone and email are completely concealed (BR-06).
  - Reserved listings display a prominent `Reserved` badge and restrict actions to Backup Offers only (BR-13).

#### FR-18: Similar Listings Engine
- **Priority:** P1
- **Capability:** The listing screen displays 4–6 similar properties matching property type, city/district, and price within |SimilarPrice − CurrentPrice| / CurrentPrice <= 0.20. Realizes UJ-1.
- **Consequences (testable):**
  - Excludes the current listing and all non-active listings.

#### FR-19: Seller Public Profile & Reputation (with Review Moderation)
- **Priority:** P1
- **Capability:** Buyers can review a seller's public profile displaying commercial name, verified badge, average star rating, completed deal count, active listings, and public reviews. Authorized administrators can moderate public reviews. Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Contact information is concealed; individual buyer review comments are displayed publicly.
  - Review Moderation: Administrators with `Reviews.Moderate` permission can soft-delete or hide abusive, defamatory, or non-compliant reviews. Hidden reviews are omitted from public display and excluded from seller rating calculations, but preserved in the immutable `AuditLog` alongside the administrative reason.

#### FR-20: Favorites List
- **Priority:** P1
- **Capability:** Authenticated buyers can bookmark up to 100 favorite listings and review them in a dedicated favorites screen. Realizes UJ-1.
- **Consequences (testable):**
  - Bookmarked listings that become `Sold`, `Archived`, or `Reserved` display updated status badges within the favorites view.

---

### 4.5 Buyer Demands & Automated Inventory Matching
**Description:** Allows buyers to post specific property purchase requirements (Demands) and automates matching against qualified Provider inventory, eliminating manual broker searching.

#### FR-21: Demand Submission (Structured Geography)
- **Priority:** P1
- **Capability:** Buyers can post a property demand specifying budget (SAR), structured `cityId` and optional `districtId` (selected from master tables), property type, required area (m²), and optional specifications (up to 1,000 chars) free of charge. Realizes UJ-4.
- **Consequences (testable):**
  - Demand transitions immediately to `Active` with `ExpiresAt = createdAt + 30 days` without requiring prior admin approval (BR-12).
  - System asserts `cityId` exists in master `City` table; free-text city names are prohibited.
  - Background hourly cron job marks expired Demands as `Expired`.

#### FR-22: Automated Demand Matching Engine
- **Priority:** P1
- **Capability:** The system matching engine evaluates new Demands against active listings and instantly dispatches notifications to qualifying Providers. Realizes UJ-4.
- **Consequences (testable):**
  - Matching criteria: Provider has >= 1 `Active` non-reserved listing with identical property type, city, `askPrice <= budget`, and area within ±20% tolerance `[ASSUMPTION: A-08]`.
  - Dispatches to all qualifying providers without Top-N truncation.

#### FR-23: Provider Proposal Submission & Admin Review
- **Priority:** P1
- **Capability:** A matched Provider can attach one of their active matching listings to the Demand and submit a binding proposed price and terms. Realizes UJ-4.
- **Consequences (testable):**
  - Proposal is submitted with status `PendingAdminReview`.
  - Admin content review approves proposal to `ApprovedForBuyer` or rejects it; unapproved proposals are invisible to the buyer.

#### FR-24: Buyer Proposal Selection
- **Priority:** P1
- **Capability:** A Buyer can review approved proposals for their Demand and select their preferred offer. Realizes UJ-4.
- **Consequences (testable):**
  - Selecting an offer sets proposal status to `SelectedPendingFinalAdminApproval` and routes to Admin Final Approval (UC-70B).
  - No Deal is created until administrative approval; if Admin rejects, Demand returns to `Active` status.

---

### 4.6 Offer Mediation & Structured Negotiation
**Description:** Enforces structured, auditable price negotiations on listings. Eliminates informal verbal agreements by routing all initial offers, counter-offers, and acceptances through administrator moderation queues.

#### FR-25: Offer Submission & Price Guardrails
- **Priority:** P0
- **Capability:** An authenticated Buyer can submit a formal purchase offer on an `Active` or `Reserved` listing with price (1 to 50,000,000 SAR) and notes (up to 500 chars). Realizes UJ-1.
- **Consequences (testable):**
  - If offer price < 50% of listing ask price, system requires explicit low-price confirmation before submission (BR-11).
  - Offer on a `Reserved` listing is flagged as `IsBackup = true`.
  - System enforces a limit of one active offer per Buyer per listing `[ASSUMPTION: A-07]`.
  - Offer transitions to `PendingAdminReview`.

#### FR-26: Mediated Counter-Offer Rounds
- **Priority:** P0
- **Capability:** Buyers and Sellers can exchange counter-offers mediated by Admin content reviews, subject to maximum round caps and expiration timeouts. Realizes UJ-1.
- **Consequences (testable):**
  - Each counter-offer increments `NegotiationRound`; system rejects counter-offers exceeding `MaxCounterRounds` (default 5 rounds, configurable).
  - Unanswered offers expire after `OfferExpiryDays` (default 7 days, configurable via background job).
  - When both parties agree on a price, the offer transitions to `SelectedPendingFinalAdminApproval`.

#### FR-27: Backup Offer Pipeline
- **Priority:** P1
- **Capability:** Backup offers on `Reserved` listings are reviewed and held in reserve until the primary Deal completes or cancels. Realizes UJ-1.
- **Consequences (testable):**
  - If the primary Deal is cancelled or times out, the oldest approved Backup Offer is surfaced to the Admin for potential activation (see OQ-04).
  - If the primary Deal is `Completed`, all active backup offers are closed automatically.

---

### 4.7 Deals, Dual Payment Proofs & Completion Engine
**Description:** The core transactional engine of El Masaif. Enforces non-custodial financial safety through a configurable payment window, dual bank wire proofs (Commission and Price), and atomic state completion.

#### FR-28: Final Deal Approval & State Machine Binding
- **Priority:** P0
- **Capability:** An authorized Administrator (`Deals.FinalApprove`) can grant final approval to an agreed offer, creating Deal record and locking the listing. Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Transaction atomically creates `Deal` with `status: AwaitingPaymentProof` and sets `Listing = Reserved`.
  - Enforces database constraint: at most one non-terminal Deal per listing (BR-07).
  - Sets `PaymentDeadline = ClockService.now() + PaymentWindowHours` (system setting, default 48 hours).

#### FR-29: Immutable Financial Snapshot Freezing
- **Priority:** P0
- **Capability:** Upon Deal creation, the system freezes all financial and payout parameters directly onto the Deal record. Realizes UJ-1.
- **Consequences (testable):**
  - Freezes `FinalDealPrice`, `CommissionRateSnapshot` (default 2.5%), `FixedCommissionSnapshot` (default 0 SAR), `FinalCommission`, `FinalTotal`, and `SellerPayoutAccount` (holder name and IBAN) (BR-02, BR-05).
  - Subsequent global settings modifications never alter existing Deal snapshot values.

#### FR-30: Dual Payment Proof Upload
- **Priority:** P0
- **Capability:** The Buyer must upload two distinct external bank transfer receipts (PDF/JPEG/PNG, max 10 MB): Payment 1 (Commission to platform IBAN with Deal Reference Code) and Payment 2 (Price to Seller Payout IBAN). Realizes UJ-1.
- **Consequences (testable):**
  - Buyer cannot upload any proof without an existing uploaded National ID document (FR-4, BR-10).
  - Proof upload sets corresponding payment record to `ProofUploaded` and transitions Deal to `PaymentUnderReview`.
  - `PaymentDeadline` (`Deal.createdAt + PaymentWindowHours`, setting, default 48h) is the deadline for uploading a proof, not for confirmation.
  - A proof rejected before the deadline can be re-uploaded until the deadline. A proof rejected at or after the deadline gets one correction window of `PaymentCorrectionHours` (setting, default 12) counted from the rejection time. If no new proof arrives by then, that payment becomes `Expired`.

#### FR-31: Administrative Proof Review, Task Claim Locking & Review SLA Tiers
- **Priority:** P0
- **Capability:** Administrators review uploaded proofs independently against bank accounts and checksums, approving or rejecting each payment under an administrative task claim locking mechanism (see FR-51). Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Admin approves proof → payment transitions to `Confirmed`.
  - Admin rejects proof → payment transitions to `Rejected` with mandatory reason; buyer is notified immediately.
  - A payment uploaded before the deadline is protected: it may be Confirmed or Rejected after the deadline. The timeout job never cancels a Deal while any payment is `ProofUploaded` or `UnderReview`.
  - Review SLA tiers (settings; calendar = 24/7 unless a business-hours setting is configured): alert to admins at 4h after upload, escalation to Super Admin at 12h, mandatory Super Admin decision at 24h limited to Confirm or Reject the proof with a reason (not cancel the Deal). These tiers never cancel a Deal.
  - A proof rejected before the deadline can be re-uploaded until the deadline; one rejected at or after it gets one correction window of `PaymentCorrectionHours` (default 12) from the rejection time, then that payment becomes `Expired`.
  - Outcome evaluation after deadline (evaluated whenever a payment changes state after the deadline, and only when no payment is `ProofUploaded`, `UnderReview` or inside a correction window):
    - both Confirmed → Deal `Completed` (FR-32 conditions: both payments Confirmed, each proof uploaded before the deadline or inside a correction window).
    - Price Confirmed, Commission Expired → Deal transitions to `Disputed` (Super Admin decision required, FR-36).
    - Commission Confirmed, Price Expired → `Deal = CancelledByTimeout` and the case is flagged for Super Admin (OQ-13 commission refund).
    - both Expired → `Deal = CancelledByTimeout`, listing returns to `Active`.
  - Repeated rejected proofs create fraud-log events (FR-62) using settings `FraudRejectedProofThreshold` (default 3) within `FraudWindowHours` (default 72).

#### FR-32: Atomic Deal Completion
- **Priority:** P0
- **Capability:** When both Payment 1 and Payment 2 reach `Confirmed` status, the system atomically completes the transaction. Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Completion conditions: both payments `Confirmed`, each proof uploaded before `PaymentDeadline` or inside a valid correction window (`PaymentCorrectionHours`). Evaluated whenever a payment changes state after the deadline, and only when no payment is `ProofUploaded`, `UnderReview` or inside a correction window.
  - Single database transaction executes: `Deal = Completed`, `Listing = Sold`, linked Owner Contract (if applicable) = `Completed`, all competing/backup offers on listing = `Closed`.
  - Discloses counterparty contact information (phone and email) to Buyer and Seller (BR-06).
  - Unlocks 1–5 star rating submission for the Buyer.

#### FR-33: Automated Payment Timeout Evaluation & Cancellation
- **Priority:** P0
- **Capability:** A background cron job running every 60 seconds evaluates deals past their `PaymentDeadline` and executes timeout rules. Realizes UJ-1.
- **Consequences (testable):**
  - At `PaymentDeadline` (`Deal.createdAt + PaymentWindowHours`, default 48h), each payment still without an uploaded proof becomes `Expired`.
  - A payment uploaded before the deadline is protected: it may be Confirmed or Rejected after the deadline. The timeout job never cancels a Deal while any payment is `ProofUploaded` or `UnderReview`.
  - A proof rejected before the deadline can be re-uploaded until the deadline; one rejected at or after it gets one correction window of `PaymentCorrectionHours` (default 12) from the rejection time, then that payment becomes `Expired`.
  - Outcome is evaluated whenever a payment changes state after the deadline, and only when no payment is `ProofUploaded`, `UnderReview` or inside a correction window:
    - both Confirmed → Deal `Completed` (FR-32).
    - Price Confirmed, Commission Expired → Deal becomes `Disputed` and requires a Super Admin decision (`Deals.DisputeResolve`; never auto-cancelled).
    - Commission Confirmed, Price Expired → `Deal = CancelledByTimeout`, unconfirmed price payment = `Expired`, and the case is flagged for Super Admin (OQ-13 commission refund review).
    - both Expired → `Deal = CancelledByTimeout`, both payments = `Expired`, and `Listing` reverts from `Reserved` to `Active`.
  - Dispatches cancellation alerts to Buyer, Seller, and Admin when a Deal is cancelled.

#### FR-34: Buyer Cancellation Before Payment
- **Priority:** P0
- **Capability:** A Buyer can cancel an active Deal while `status: AwaitingPaymentProof` provided no payment proofs have been uploaded. Realizes UJ-1.
- **Consequences (testable):**
  - Deal transitions to `CancelledByBuyer`; listing reverts from `Reserved` to `Active`.
  - Action is disabled once any proof file has been submitted.

---

### 4.8 Mediated Communication, Support & Dispute Resolution
**Description:** Protects transaction integrity by preventing off-platform communication bypasses, providing customer support ticketing, and resolving post-payment deal disputes.

#### FR-35: Mediated Listing Inquiries, Task Locking & Automatic Contact Masking
- **Priority:** P1
- **Capability:** Buyers can submit inquiries regarding an active listing, creating a mediated conversation thread routed to the Admin Conversation Queue with automated task claim locking (see FR-51). Realizes UJ-5.
- **Consequences (testable):**
  - Direct communication between Buyer and Seller is prohibited; Admin reviews and relays messages.
  - System automatically detects and masks Saudi phone numbers (`05XXXXXXXX`), emails, and social media handles in message text (see R-04).
  - Message attachments are limited to 5 files (PDF/image, 10 MB max).

#### FR-36: Deal Dispute Filing, System Escalation & Freeze
- **Priority:** P0
- **Capability:** Covers disputes opened by Buyer, Seller, or the system (when Price is Confirmed and Commission is Expired). Realizes UJ-5.
- **Consequences (testable):**
  - A Buyer or Seller can file a formal Dispute on an active Deal after at least one payment proof has been uploaded; or the system automatically transitions the Deal to `Disputed` if the Price payment is Confirmed and the Commission payment is Expired.
  - Deal status transitions to `Disputed`.
  - A Disputed Deal is never auto-cancelled and the timeout job ignores it.
  - Dispute routes to the Super Admin queue for adjudication (`Deals.DisputeResolve`).
  - Super Admin decision is strictly one of:
    1. Complete the deal (`Completed`),
    2. Cancel the deal (`CancelledByAdmin`), or
    3. Return to review (`PaymentUnderReview`) with a new explicit deadline and reason.

#### FR-37: Violation Reporting
- **Priority:** P2
- **Capability:** Any user can report a fraudulent listing, abusive seller, or unauthorized broker, submitting category, explanation, and up to 5 attachments. Realizes UJ-1.
- **Consequences (testable):**
  - Report lands in Admin Reports Queue (`Reports.Handle`). Reporter does not track ticket progress in MVP (submit-only).

#### FR-38: Support Ticketing System
- **Priority:** P2
- **Capability:** Users can open technical support tickets; support admins manage tickets with statuses `Open`, `InProgress`, `Resolved`, and `Closed` backed by SLA monitoring. Realizes UJ-5.
- **Consequences (testable):**
  - Status transitions: `Open` -> `InProgress` -> `Resolved` -> `Closed`.
  - Enforces SLA timers configured via system settings: First Response SLA (default 4 hours) and Ticket Resolution SLA (default 2 business days), backed by automated internal escalation alerts.
  - Ticket creation by users only; no tracking screen in MVP.

---

### 4.9 Administrative Back-Office, Dynamic RBAC & Operations
**Description:** Equips platform operations with granular role-based controls, dynamic fee settings, fraud monitoring, and immutable compliance audit logs.

#### FR-39: Isolated Admin Realm & Authentication
- **Priority:** P0
- **Capability:** Administrators authenticate through a dedicated route (`/admin`) and independent API prefix (`/api/v1/admin`) with separate tables, session cookies, and strict rate limits. Realizes UJ-5.
- **Consequences (testable):**
  - 5 failed login attempts lock admin account for 15 minutes.
  - Sessions expire after 8 hours of inactivity `[ASSUMPTION: A-03]`.

#### FR-40: Granular Dynamic RBAC & Operational Queue Task Claim Locking
- **Priority:** P0
- **Capability:** Super Admin can create custom administrative roles and assign specific permissions formatted as `Area.Action`. Operational queues enforce task claim locking (see FR-51). Realizes UJ-5.
- **Consequences (testable):**
  - Every admin API endpoint enforces permission decorators via NestJS guards.
  - Separation of duties: the admin approving a payment proof cannot execute final deal approval on the same deal (see FR-51).
  - Dynamic RBAC permissions catalog includes the full Admin Permission Matrix defined in addendum.md.

#### FR-41: Dynamic System Settings & Commission Configuration
- **Priority:** P0
- **Capability:** Authorized administrators (`Settings.Commission`, `Settings.Manage`) can modify global parameters including default commission rate (default 2.5%), fixed commission fee, default owner contract fee, payment window hours, and expiry durations. Realizes UJ-5.
- **Consequences (testable):**
  - All setting updates take effect immediately for future transactions without application restarts.
  - Configuration updates write immutable audit records.

#### FR-42: Immutable Domain Audit Logging
- **Priority:** P0
- **Capability:** The platform records an append-only audit event for every sensitive state transition, administrative approval, payout account update, and price override. Realizes UJ-5.
- **Consequences (testable):**
  - Captures: actor ID, role, timestamp (UTC), IP, action string, target entity type, entity ID, previous state snapshot, new state snapshot, and optional admin reason.
  - Audit database tables are strictly insert-only with zero update/delete permissions granted to application roles (BR-19).

#### FR-43: Account Soft & Hard Deletion Guardrails
- **Priority:** P0
- **Capability:** Administrators can disable, enable, or soft-delete user accounts and role profiles. Realizes UJ-5.
- **Consequences (testable):**
  - Hard deletion is blocked if the account has any associated transaction history (listings, offers, deals, payments, contracts, messages, ratings, reports, or tickets) (BR-18).

---

### 4.10 Notifications & Operational Alerts
**Description:** Dispatches transactional and operational notifications across the user lifecycle.

#### FR-44: Unified In-App Notification Feed
- **Priority:** P0
- **Capability:** Users receive real-time and stored in-app notifications with unread counts and direct deep links to relevant entities. Realizes UJ-1, UJ-2, UJ-3.
- **Consequences (testable):**
  - Notifications are retained for 90 days; deleted automatically by daily retention job.
  - Critical alerts (deal creation, payment deadlines, license suspensions, security events) cannot be disabled by user settings (governed by FR-64 templates and the Notification Event Catalog in addendum.md).

#### FR-45: Transactional Email Notifications
- **Priority:** P2
- **Capability:** Dispatches transactional email receipts for deal creations, payment deadline warnings (12h, 2h), and deal completion confirmations for users with verified email addresses. Realizes UJ-1.
- **Consequences (testable):**
  - Underlying email transport service is delivered as a Priority P1 dependency required by user email verification (FR-49) and administrative password resets (FR-70).
  - Outbound transactional notification delivery to user inboxes is enabled as a post-launch fast-follow (P2).

---

### 4.11 Operational Governance, Management & Administrative Modules
**Description:** Back-office administrative modules, task claim concurrency control, geographic administration, seller response pipelines, and reporting instrumentation fulfilling Epic E7 traceability.

#### FR-51: Admin Task Claim and Locking
- **Priority:** P0
- **Capability:** Administrators explicitly claim pending operational queue tasks to prevent conflicting decisions and concurrent dual-processing. Realizes UJ-5.
- **Consequences (testable):**
  - Claim requires an explicit `POST /api/v1/admin/<queue>/<id>/claim`; task claims are never triggered via GET requests or passive page navigation.
  - Executed via an atomic conditional database update setting the lock owner, lock timestamp, and a 15-minute expiration window only if the item is currently unlocked or its previous lock has expired (see addendum.md for SQL statement).
  - Client heartbeat mechanism renews active lock lease every 5 minutes.
  - Locks are automatically released upon formal decision submission or when explicitly leaving/unclaiming the queue workspace.
  - While leased, other inspecting administrators see the record in read-only mode with a banner: "being handled by {adminName}".
  - Super Administrators with permission `Tasks.ForceUnlock` can forcibly release any active task claim with a mandatory documented reason, recorded permanently in `AuditLog`.
  - A task claim never replaces optimistic concurrency control (`version` / `If-Match` header check); stale decision submissions return `409 Conflict`.
  - Applies to all operational domain entities: `Listing`, `FalProfile`, `OwnerListingRequest`, `Payment` (each payment audited separately), `ContractFeePayment`, `Conversation`, `Dispute`, and `Offer`.
  - Separation of duties remains strictly enforced: an admin verifying a payment proof cannot execute final deal approval on that same transaction.

#### FR-52: Review Moderation & Audit Preservation
- **Priority:** P2
- **Capability:** Administrators can moderate public seller ratings and reviews to mitigate defamatory, abusive, or non-compliant content. Realizes UJ-1, UJ-5.
- **Consequences (testable):**
  - Requires permission `Reviews.Moderate`.
  - Moderated review is flagged `isHidden = true`, capturing `hiddenByAdminId`, `hiddenAt`, and `hiddenReason`.
  - Hidden reviews are immediately excluded from public profile display, seller average star calculation, and total review count.
  - Administrators can restore previously hidden reviews (`isHidden = false`).
  - Underlying database row is never deleted; all moderation actions write immutable records to `AuditLog`.

#### FR-53: Geographic Master Data Administration
- **Priority:** P0 (seed data only) / P2 (admin UI)
- **Capability:** Administrators manage master Saudi geographic data (cities and cascading districts) through the back-office. Realizes UJ-1, UJ-2, UJ-3, UJ-4, UJ-5.
- **Consequences (testable):**
  - Requires permission `Geo.Manage`.
  - Enforces hierarchical cascading relationship: `District` records bind to a valid `cityId` with `@@unique([id, cityId])`.
  - Free-text geographic inputs on listings and demands are rejected at the API boundary.
  - Deactivating a city or district (`isActive = false`) prevents new listings or demands from selecting it, while existing listings retain their historical geographic reference without disruption.

#### FR-54: Buyer Rating Submission on Completed Deals
- **Priority:** P1
- **Capability:** A Buyer can submit a formal rating and qualitative review for the Seller following atomic deal completion (UC-30). Realizes UJ-1.
- **Consequences (testable):**
  - Rating input accepts 1 to 5 integer stars and an optional written comment up to 500 characters.
  - Submission is strictly permitted only once per `Completed` Deal; duplicate or unauthorized submissions are rejected.
  - Ratings are immutable by the user once submitted.

#### FR-55: Seller Response to Mediated Offers
- **Priority:** P0
- **Capability:** Sellers can review mediated purchase offers forwarded by platform administration and submit a formal response (accept, reject with reason, or counter-offer) (UC-47, UC-58A). Realizes UJ-1, UJ-2.
- **Consequences (testable):**
  - Seller can accept the proposed price, advancing the offer to `SelectedPendingFinalAdminApproval`.
  - Seller can reject the offer with a mandatory structured reason, terminating that negotiation branch.
  - Seller can propose a counter-offer price within round limits (increments `NegotiationRound`).

#### FR-56: Seller Cancellation Request Prior to Payment Proof
- **Priority:** P1
- **Capability:** A Seller can request cancellation of an active Deal while `status: AwaitingPaymentProof` provided no payment proofs have been uploaded by the Buyer. Realizes UJ-1, UJ-2, UJ-5.
- **Consequences (testable):**
  - Cancellation request requires administrator review and approval.
  - Upon administrative approval, Deal transitions to `CancelledBySeller` and listing reverts from `Reserved` to `Active`.
  - Action is disabled if any payment proof has been uploaded.

#### FR-57: Administrative Price Suggestions & Seller Response
- **Priority:** P2
- **Capability:** Administrators can evaluate listing ask prices and issue non-binding price revision suggestions to sellers (UC-64, UC-65, UC-41). Realizes UJ-2, UJ-5.
- **Consequences (testable):**
  - Platform administrators are strictly prohibited from directly altering or overriding a listing's ask price (BR-16).
  - Admin price suggestion dispatches an in-app and email alert to the seller.
  - Seller can review, accept the suggestion (which updates the listing ask price), or decline the recommendation without penalty. If the seller accepts, a price change follows BR-13 (major edit returns the listing to UnderReview).

#### FR-58: Buyer Demand Management & Cancellation
- **Priority:** P1
- **Capability:** Buyers can view a list of their active and historical property Demands, inspect matched provider proposals, and cancel active Demands with a documented reason (UC-23, UC-24). Realizes UJ-4.
- **Consequences (testable):**
  - Demand dashboard displays status (`Active`, `Cancelled`, `Expired`, `Closed`), proposal tallies, and remaining expiration window.
  - Buyer can cancel an active demand; requires selecting or entering a cancellation reason.
  - Cancelling closes outstanding unmatched proposals on that demand.

#### FR-59: Marketer & Owner Dashboards with Transaction Tracking
- **Priority:** P0 (deal tracking) / P1 (dashboards)
- **Capability:** Marketers and Owners access dedicated operational dashboards displaying active listings, performance metrics, inbound mediated offers, and deal settlement progress (UC-31, UC-46, UC-49, UC-57A). Realizes UJ-2, UJ-3, UJ-5.
- **Consequences (testable):**
  - Marketers view Fal compliance status, active listings, offer pipelines, and total value of completed Deals.
  - Owners track electronic listing contract status, listing fee verification, incoming offers, and price settlement milestones.

#### FR-60: User Workspace Settings & Preferences
- **Priority:** P1
- **Capability:** Authenticated users can configure system interface language, dark mode display theme, and transactional notification channel toggles (UC-10). Realizes UJ-1, UJ-2, UJ-3.
- **Consequences (testable):**
  - Supports toggling Arabic (RTL) / English (LTR) and Light / Dark display themes.
  - Users can configure preferences for optional marketing and inquiry alerts.
  - Critical transaction alerts (deal creation, payment deadline timer, dispute notifications, and security events) cannot be disabled.

#### FR-61: Standard Owner Contract Template Manager
- **Priority:** P0 (seeded default template) / P1 (template manager UI)
- **Capability:** Administrators manage standardized electronic contract templates for direct owner property listings (UC-69). Realizes UJ-3, UJ-5.
- **Consequences (testable):**
  - Requires permission `Contracts.Manage`.
  - Admins can author, update, and activate contract legal clause templates.
  - Active contract template is automatically bound when an owner listing request is approved for signature.

#### FR-62: Penalties & Compliance Fraud Log
- **Priority:** P1 (system event capture) / P3 (penalty UI)
- **Capability:** The platform captures system-generated fraud events and allows administrators to record compliance penalties as numeric SAR values (UC-73, UC-74). Realizes UJ-5.
- **Consequences (testable):**
  - System-generated events are logged automatically for repeated rejected proofs, repeated payout-account changes, and repeated buyer cancellations/timeouts.
  - Administrators can record penalties as numeric SAR values only (no collection).
  - Requires permission `Compliance.Manage`.
  - Fraud records and penalty logs write immutable entries to `AuditLog`.

#### FR-63: Financial Indicators & Transaction Reports with Export
- **Priority:** P2
- **Capability:** Administrators can inspect real-time financial KPIs (gross transaction volume, confirmed platform commissions, collected owner contract fees) and export PDF and Excel reports (UC-75, UC-88, UC-89). Realizes UJ-5.
- **Consequences (testable):**
  - Requires permission `Finance.View` / `Finance.Export`.
  - Generates aggregated metrics filtered by date range, property type, city, and provider, exportable in PDF and Excel.
  - Every financial report export action is logged to `AuditLog` with administrator ID and query filters.

#### FR-64: Content Management System (CMS) & Communications Templates
- **Priority:** P0 (Terms and Privacy pages only) / P3 (remaining CMS)
- **Capability:** Administrators manage public content pages, system announcements, FAQ entries, and transactional email/SMS notification templates (UC-84, UC-85, UC-86, UC-87). Realizes UJ-5.
- **Consequences (testable):**
  - Requires permission `CMS.Manage`.
  - Supports editing Terms of Service, Privacy Policy, regulatory guides, and FAQ articles.
  - Allows editing message templates with dynamic placeholders (e.g. `{dealId}`, `{deadlineHours}`).

#### FR-65: Operational Internal Notes
- **Priority:** P2
- **Capability:** Administrators can attach internal, staff-only notes to user profiles, listings, deals, and disputes (UC-91). Realizes UJ-5.
- **Consequences (testable):**
  - Internal notes are strictly invisible to public users, buyers, marketers, and owners.
  - Notes capture author admin ID, creation timestamp, and content (up to 1,000 characters).

#### FR-66: Executive Administrative Operations Dashboard
- **Priority:** P1
- **Capability:** Executive administrators access a centralized operations overview highlighting queue backlogs, pending SLA deadlines, and platform activity (UC-60). Realizes UJ-5.
- **Consequences (testable):**
  - Displays real-time counters: listings awaiting moderation, pending Fal verifications, deals nearing payment deadline, unassigned disputes, and active task lock leases.

#### FR-67: Listing Views & Engagement Statistics Capture
- **Priority:** P1
- **Capability:** The platform captures listing views in aggregate per day per listing to ensure historical baseline metrics exist from launch without storing a per-visitor identifier (UC-42, UC-57). Realizes UJ-1, UJ-2.
- **Consequences (testable):**
  - Count views in aggregate per day per listing without storing a per-visitor identifier; no cookie ID stored.
  - Increments view counters without degrading read query latency.
  - Marketers and owners can view aggregated view counts and offer conversion ratios (offers received / views) on their property dashboards.

#### FR-68: Invoice Data Capture for Confirmed Platform Fees
- **Priority:** P0
- **Capability:** The system systematically captures structured invoice data upon confirmation of platform commissions and owner contract fees. Realizes UJ-1, UJ-3, UJ-5.
- **Consequences (testable):**
  - Upon payment confirmation (`Deal` commission or `OwnerContract` fee), system generates an `InvoiceRecord` with gapless invoice numbers, issuance timestamp, transaction counterparty details (buyer/owner legal name and tax identifier if provided), gross amount, VAT rate is a system setting (default 15%), calculated VAT amount, net amount, and bank payment reference.
  - Invoice data capture ensures structural readiness for post-MVP Phase 2 e-invoicing; no claim of active ZATCA clearance or cryptographic stamping compliance is asserted in MVP.

#### FR-69: Owner Listing Request Review & Contract Dispatch
- **Priority:** P0
- **Capability:** Administrators review submitted direct owner listing requests and dispatch standardized electronic contracts for owner signature (UC-67, UC-68). Realizes UJ-3, UJ-5.
- **Consequences (testable):**
  - Requires permission `Contracts.Review` (or `Contracts.FeeOverride` for fee modifications).
  - Admin can approve request, reject with mandatory reason, or request modification from the owner.
  - On approval, admin selects an active contract template (FR-61), sets the listing contract fee (default SAR 1,000), or records a fee override with mandatory reason.
  - Approving transitions the request to `ApprovedPendingSignature` and dispatches an electronic contract to the owner (FR-9).

#### FR-70: Administrative Password Reset
- **Priority:** P1
- **Capability:** Authorized Super Administrators can initiate password recovery for platform administrator accounts (UC-59). Realizes UJ-5.
- **Consequences (testable):**
  - Requires permission `Rbac.Manage`.
  - Super Admin can trigger a secure, single-use, time-limited password reset email link (expiring in 15 minutes) via the email transport service. Direct temporary passwords are not permitted.
  - Revokes all existing active sessions for that admin account.
  - Every administrative password reset action is permanently recorded in `AuditLog` with actor ID, target admin ID, IP address, and mandatory administrative reason.

---

## 5. Non-Goals (Explicit)

The following capabilities are deliberately excluded from Version 1 (MVP) to maintain transaction velocity, reduce regulatory overhead, and focus engineering resources:

- **No Native Mobile Apps (iOS / Android):** The MVP will not release native mobile binaries. The platform is delivered exclusively as a responsive, mobile-first web application.
- **No In-App Payment Gateway, Escrow Custody, or Digital Wallets:** El Masaif will not handle payment card processing (Mada/Visa/Mastercard) or hold funds in escrow. All property purchase funds and platform fees are executed via external bank wires verified by uploaded proofs.
- **No Rental, Lease, or Auction Support:** The data model, state machines, and UX are strictly engineered for property sales. Rental management, lease contracts (Ejar), and public bidding auctions are out of scope.
- **No Direct Unmediated Buyer-Seller Chat:** Direct user-to-user messaging is forbidden. Direct contact details are shared exclusively upon deal completion.
- **No Automated Government Registry Integrations (MVP):** Direct API integrations with Wathq, REGA/Fal electronic registries, Nafath single sign-on, or Absher are deferred to v2. Verification in MVP is conducted manually by administrators inspecting uploaded certificates.
- **No Saved Search Alerts & Web Push:** Automated push notifications and saved search digests are deferred to post-MVP releases.

---

## 6. MVP Scope

### 6.1 In Scope (MVP)

MVP delivery scope is strictly defined as Priority P0 (Core MVP Launch Blockers) + Priority P1 (Essential Launch Features). Priority P2 capabilities are planned as fast-follow releases immediately post-launch, while Priority P3 items belong to the extended product backlog.

- **Core Infrastructure & Platform Foundation:**
  - Responsive Arabic (RTL-first) web application in Next.js with secondary English (LTR) localization.
  - Modular NestJS REST API with OpenAPI documentation, Prisma ORM, and PostgreSQL.
  - Saudi mobile number OTP onboarding with swappable OtpProvider (static code `123456` in dev; SMS gateway in prod).
  - Multi-role profile switching (`Buyer`, `Marketer`, `Owner`) under a single account.
  - Marketer Fal license onboarding, expiration tracking cron, and listing compliance freeze.
  - Owner contract generation, electronic signature (canvas + OTP), and contract fee proof verification.
  - Property listing creation (sales only), multi-photo upload, and admin moderation workflow.
  - Multi-criteria filter search and interactive clustered map with property-type colored markers.
  - Buyer Demand broadcasting and automated inventory matching engine with Provider proposals.
  - Mediated offer and counter-offer negotiation pipeline with configurable round limits.
  - Deal state machine with configurable payment deadline (`PaymentWindowHours`, default 48h), dual bank wire transfer proof upload, on-time proof timeout protection, review SLA tiers (4h alert, 12h escalation, 24h mandatory Super Admin decision), and post-deadline correction windows.
  - Non-custodial dual payment verification (Commission to platform, Price to seller IBAN) with mod-97 check.
  - Atomic deal completion, contact information disclosure, and 1–5 star seller rating engine.
  - Deal dispute mechanism suspending timeouts and routing to administrative resolution.
  - Admin Back-Office with dynamic RBAC (`Area.Action`), audit logging, and configurable settings.
  - Background jobs: 60s payment deadline monitor, offer expiry, demand expiry, license renewal alerts, notification retention.

- **Priority Tier Breakdown for Operational & Governance Capabilities (FR-46 through FR-70):**
  - **Priority P0 (Core MVP Launch Blockers):**
    - `FR-46`: Forgot Password & Password Reset via Step-Up OTP
    - `FR-51`: Admin Task Claim and Operational Queue Locking
    - `FR-53`: Geographic Master Data Administration (Seeded SQL tables only)
    - `FR-55`: Seller Response to Mediated Offers (Accept, Reject, Counter)
    - `FR-59`: Deal Settlement & Milestone Tracking across Marketer/Owner Dashboards
    - `FR-61`: Standard Owner Contract Template (Seeded default template)
    - `FR-64`: Core Legal CMS (Terms of Service and Privacy Policy pages only)
    - `FR-68`: Gapless Invoice Data Capture for Confirmed Platform Fees
    - `FR-69`: Owner Listing Request Review, Template Selection & Contract Dispatch
  - **Priority P1 (Essential Launch Features):**
    - `FR-45 (Transport)`: Email Transport Service (Infrastructure dependency for FR-49 and FR-70)
    - `FR-47`: Change Password from authenticated account settings
    - `FR-48`: Secure Mobile Number Update via dual OTP verification and support assist
    - `FR-49`: User Profile Editing (Name and contact email verification)
    - `FR-50`: Right to Erasure / Account Deletion Request with 14-day cooling-off
    - `FR-54`: Buyer Rating and Review Submission on Completed Deals
    - `FR-56`: Seller Cancellation Request prior to buyer payment proof
    - `FR-58`: Buyer Demand Management, proposals overview, and cancellation
    - `FR-59`: Marketer & Owner Operational Performance Dashboards
    - `FR-60`: User Workspace Settings (Language, Dark Mode, Notification toggles)
    - `FR-61`: Standard Owner Contract Template Manager UI
    - `FR-62`: System Compliance Fraud Log (System-generated fraud event capture)
    - `FR-66`: Executive Administrative Operations Dashboard
    - `FR-67`: Daily Aggregate Listing Views & Engagement Statistics Capture
    - `FR-70`: Administrative Password Reset via Super Admin and secure reset tokens

### 6.2 Out of Scope for MVP (Post-Launch & Backlog)

#### Post-Launch Fast-Follow Capabilities (Priority P2)
- `FR-37`: Violation Reporting (submit-only user reporting workflow).
- `FR-38`: Support Ticketing System with SLA timers (first response 4h, resolution 2 business days).
- `FR-45`: Transactional Email Notifications (direct user email alerts; underlying transport delivered in P1).
- `FR-52`: Administrative Seller Review Moderation & Audit Preservation.
- `FR-53 (Admin UI)`: Administrative web UI for Geographic Master Data management (database migrations and seeded SQL tables delivered in P0).
- `FR-57`: Administrative Price Revision Suggestions to sellers.
- `FR-63`: Financial Indicators & Transaction Reports with PDF and Excel export.
- `FR-65`: Administrative Staff-Only Internal Notes.

#### Extended Product Backlog Capabilities (Priority P3)
- `FR-62 (Penalty UI)`: Compliance penalty recording UI (system-generated fraud event capture delivered in P1; monetary penalty administrative recording deferred to P3).
- `FR-64 (Remaining CMS)`: Dynamic CMS management (FAQ management, announcement banners, guide authoring; core Terms and Privacy pages delivered in P0).

#### Deferred Architectural & Business Capabilities

| Feature / Capability | Deferral Phase | Rationale |
|---|---|---|
| Native iOS & Android Apps | Phase 2 | Responsive web delivers full mobile parity at lower maintenance cost. |
| Government API Integrations (REGA/Nafath/Wathq) | Phase 2 | Manual document audit validates operational flows prior to API licensing. |
| In-App SAMA-Regulated Escrow & Instant Open Banking | Phase 3 | Avoids custodial regulatory licensing requirements in initial launch. |
| Automated Video Tours & 3D Virtual Walkthroughs | Phase 2 | Bandwidth and storage optimization; photo carousels suffice for MVP. |
| Buyer Support Ticket Tracking UI | Phase 2 | Support issues created via submit-only modal; tracked internally by admins. |
| Geographic Master Data Admin UI (FR-53 Admin UI) | Phase 2 | Seeded database migrations suffice for MVP launch; web UI deferred. |
| Extended CMS Management & Authoring (FR-64 Remaining) | Phase 2 | Static markdown pages for TOS/Privacy suffice; dynamic CMS editor deferred. |
| Compliance Penalty Auto-Collection (FR-62) | Phase 2 | Platform records penalty amounts only; collection and legal enforcement deferred. |
| Public Dispute Arbitration Portal | Phase 2 | Disputes handled internally by Super Admin without public tribunal screens. |
| Saved Search Alerts & Automated Push Digests | Phase 2 | Focus engineering resources on primary transactional loop. |

---

## 7. Success Metrics

### 7.1 Primary Metrics

- **SM-1: Regulatory Compliance Completeness:** All published Marketer listings backed by active, verified Fal licenses and registered Saudi IBANs; all Owner listings backed by signed electronic contracts. *Validates FR-6, FR-7, FR-9, FR-10.*
- **SM-2: Dual Proof Review Turnaround (SLA):** 95% of uploaded payment proofs reviewed (confirmed or rejected) within < 4 hours of upload, aligning with the 4-hour admin SLA alert threshold. *Validates FR-31.*
- **SM-3: Deal Completion Velocity:** Report two numbers: "Deals Completed" and "Completed before the upload deadline" (> 75% of created Deals reach `Completed` status without timing out; velocity tracked against the upload payment deadline). *Validates FR-28, FR-32, FR-33.*
- **SM-4: Demand Matching Latency:** < 5 minutes from Buyer Demand submission to automated dispatch to all qualifying Providers. *Validates FR-22.*
- **SM-5: Platform Mediation Integrity:** 0 verified leaks of seller direct contact information prior to deal completion. *Validates FR-17, FR-32, FR-35.*

### 7.2 Secondary Metrics

- **SM-6: Search Performance:** p95 search and map query response time < 800 ms under 50,000 active listings. *Validates FR-15, FR-16.*
- **SM-7: Offer Conversion Rate:** > 15% of mediated initial offers progress through counter-rounds to reach final deal approval. *Validates FR-25, FR-26, FR-28.*
- **SM-8: Provider Demand Response Rate:** > 40% of matched providers submit listing proposals on active buyer demands within 48 hours. *Validates FR-23.*

### 7.3 Counter-Metrics (Do Not Optimize)

- **SM-C1: Proof Approval Rate:** Do *not* artificially maximize proof approval speed or pass rates by loosening IBAN verification or transfer reference matching; transaction security overrides velocity. *Counterbalances SM-2.*
- **SM-C2: Total Listing Count:** Do *not* optimize for vanity listing volume by relaxing Fal license verification, owner authorization requirements, or minimum 3-photo quality bars. *Counterbalances SM-1.*
- **SM-C3: Deal Volume via Price Inflation:** Do *not* optimize platform commission revenue by inflating ask prices or permitting unverified price hikes. *Counterbalances SM-3.*

---

## 8. Cross-Cutting Non-Functional Requirements (Adapt-In)

### 8.1 Security & Access Control
- **Server-Side Enforcement:** Every API endpoint must enforce authentication, active role profile, resource ownership, and required dynamic permissions (`@RequirePermissions('Deals.FinalApprove')`) strictly on the server. Client route protection and UI button hiding are presentation conveniences only.
- **Private S3 File Storage (Data Residency):** Storage and database must be hosted in a region inside the Kingdom of Saudi Arabia (the AWS Saudi region, announced for December 2026, or an in-Kingdom provider). me-south-1 (Bahrain) may be used only as an interim, only after written legal sign-off on cross-border processing under PDPL, with a documented migration plan. Region and endpoints are configuration only (STORAGE_REGION, STORAGE_ENDPOINT, DATABASE_URL). Production launch is blocked until OQ-12 is closed by legal counsel. Downloads occur strictly via short-lived signed URLs expiring in <= 5 minutes `[ASSUMPTION: A-12]`.
- **Pre-Persistence Malware Scanning Hook:** Uploaded binaries are written to an isolated quarantine location prior to automated scanning. File records track scan state via `FileObject.scanStatus` (`Pending`, `Clean`, `Infected`, `ScanFailed`). Only files with status `Clean` are moved to final storage; if the scanner service is unavailable, the system fails CLOSED and non-Clean files are never served.
- **Sensitive Field Encryption & Masking:** IBANs and identity numbers are encrypted at rest using AES-256. IBANs are masked in list views (`SA****************1234`) and displayed fully only to authorized parties on active deals.
- **Rate Limiting:** OTP endpoints (max 3/hr/phone), user login (max 5 consecutive failures), file uploads, and message dispatches are protected by IP and account throttlers (`@nestjs/throttler`).
- **Production Guard:** System refuses to boot if the static OTP provider (`123456`) is configured in production environments.

### 8.2 Privacy & Saudi PDPL Compliance
- **Consent & Policy Tracking:** Explicit user consent for personal data processing under the Saudi Personal Data Protection Law (PDPL) captured upon mobile registration, recording `terms_version`, `privacy_version`, `consent_timestamp` (UTC), and `ip_address` in an immutable consent log.
- **Self-Service Deletion & Retention Guards:** Users can request account erasure (`FR-50`). Accounts with zero transaction history enter status `DeletionPending` with a 14-day cooling-off period `[ASSUMPTION: A-13]` before permanent erasure; accounts with historical transactions are placed in `Deactivated` status while financial and transaction records are preserved per Saudi commercial and tax retention mandates.
- **Audit Logging:** Every access, disclosure, or export of counterparty contact details or identity records is logged permanently in the immutable audit store (BR-19).
- **Data Retention:** Administrative and financial records retained in accordance with Saudi commercial and tax regulations; notifications older than 90 days are purged automatically.

### 8.3 Performance Budgets & Time Simulation
- **Web Vitals (Mobile 4G):** Largest Contentful Paint (LCP) < 2.5s; First Input Delay (FID) < 100ms; Cumulative Layout Shift (CLS) < 0.1.
- **API Latency:** p95 latency < 500 ms for database mutations; p95 latency < 300 ms for cached/indexed read queries.
- **Payment Deadline Execution:** Automated timeout cron executes within 60 seconds of `PaymentDeadline` expiration.
- **Clock / Time Mocking Strategy (ClockService):** All temporal deadlines and business rules route through an injectable `ClockService`. In domain logic, time evaluations call `ClockService.now()`, and clock timestamps are passed directly into database queries. In production (`NODE_ENV=production`), endpoints for programmatic clock alteration are strictly rejected via startup lifecycle checks.

### 8.4 High Availability & Reliability
- **Uptime SLA:** 99.5% monthly availability for web presentation and core REST APIs.
- **Disaster Recovery:** Automated daily PostgreSQL database backups with Point-In-Time Recovery (PITR); recovery drills verified quarterly.
- **Asynchronous Resilience & Scheduler:** Scheduled jobs run from one pg-boss scheduler (singleton keys) in a separate worker process. Background jobs enforce idempotency, persistent state, retry backoff, and dead-letter queues.

### 8.5 Concurrency & Data Integrity
- **Optimistic Concurrency:** Version columns (`version: Int`) with `If-Match` headers on Listing, Offer, and Deal mutations to prevent race conditions between simultaneous admin actions.
- **Atomic Deal Transactions:** Final deal approval (`UC-70B`) and deal completion (`UC-29`) execute inside Prisma interactive database transactions.
- **Partial Unique Index:** Database enforces at most one non-terminal Deal per listing via a partial unique index (`CREATE UNIQUE INDEX deal_single_active ON deals (listing_id) WHERE status NOT IN ('Completed', 'CancelledByBuyer', 'CancelledBySeller', 'CancelledByTimeout', 'CancelledByAdmin')`).
- **Fixed-Point Financial Math:** All money calculations execute on fixed-point decimals rounded half-up to two decimal places; floating-point math is strictly forbidden (BR-02).

---

## 9. Constraints & Guardrails (Adapt-In)

- **Sales Only:** Property rentals, leasing, shared equity, and timeshares are prohibited across all modules.
- **Zero Custody of Deal Price:** Platform administrators never take custody or escrow hold of property purchase funds. Bank transfers flow directly from Buyer to Seller.
- **Saudi Banking Validation:** All payout bank accounts must be valid Saudi IBANs conforming to `SA` + 22 alphanumeric digits with valid mod-97 check digits.
- **Arabic-First UX:** Arabic RTL layout is the primary interface; all system forms, error messages, and currency notations (SAR) must conform to Saudi linguistic conventions.
- **Mediation Enforcement:** No direct communication channels between buyer and seller are permitted before deal completion; system automatically scans and redacts contact details.
- **ZATCA E-Invoicing Phase 2 Structural Readiness:** MVP stores invoice data so Phase 2 needs no data rework; clearance and stamping are added later in InvoicingModule.

---

## 10. Risk Register & Mitigations (Adapt-In)

| Risk ID | Description | Severity | Likelihood | Mitigation Strategy |
|---|---|---|---|---|
| **R-01** | Marketer Fraud: Uploading fake listings or redirecting property price to unauthorized IBAN. | High | Medium | Enforce Owner Authorization Document check on creation; require OTP re-authentication on payout IBAN edits; admin audits IBAN on Price proof. |
| **R-02** | Payment Timeout Bottleneck: Unfair deal cancellation while admin is reviewing on-time proof. | High | High | Enforce payment timing rules: PaymentDeadline is the deadline for uploading proofs (not confirmation); on-time proofs are protected from timeout while ProofUploaded or UnderReview; post-deadline rejection gets one correction window of PaymentCorrectionHours (default 12h); review SLA tiers (4h alert, 12h escalation, 24h mandatory Confirm/Reject decision) never cancel a deal; post-deadline outcome evaluated only when no payment is ProofUploaded, UnderReview, or in a correction window (see OQ-07, FR-31, FR-33). |
| **R-03** | Counterfeit Bank Wire Proof: Buyer uploads forged or modified PDF transfer receipt. | High | Medium | Seller is immediately notified upon Price proof upload and may open a Dispute; file SHA-256 checksums stored; deal reference codes required in transfer memo. |
| **R-04** | Communication Bypass: Parties share phone numbers in inquiry chats to evade platform commission. | Medium | High | Automated regex pattern masking of Saudi phone numbers, emails, and usernames; admin manual moderation before message relay. |
| **R-05** | Development OTP Leak: Static test OTP (`123456`) deployed to production environment. | Critical | Low | Environment startup guard asserts `NODE_ENV === 'production'` fails if static provider is configured; automated CI test checks. |
| **R-06** | Regulatory Non-Compliance: Marketer operates with revoked or expired Fal license. | High | Medium | Daily automated cron job checks license expiration, restricts profile, and freezes active listings immediately upon expiry date. |
| **R-07** | Operational Bottleneck: High mediation volume delays offer relay or payment verification. | High | Medium | Dedicated Admin queues sorted by urgency/deadline; SLA indicators; permission-based load distribution across Support Team; administrative task claim locking (FR-51) prevents duplicate work. |
| **R-08** | Concurrent Admin Collisions: Two admins approve conflicting offers on the same listing simultaneously. | Medium | Medium | Prisma interactive transactions, optimistic locking with version columns, operational queue task locking (FR-51), and database partial unique index on active deals. |
| **R-09** | Support-Assisted Phone Change Abuse: Bad actor attempts social engineering through support to hijack another user's mobile number. | High | Low | Permission `Users.PhoneChange` restricted to Super Admin; requires offline identity verification and step-up OTP confirmation; fully audited. |
| **R-10** | Launch Blocked by Data Residency: Legal counsel fails to provide written sign-off on interim Bahrain hosting (OQ-12). | Critical | Medium | Early engagement with legal counsel; design configuration-driven endpoints (`STORAGE_REGION`, `STORAGE_ENDPOINT`, `DATABASE_URL`) allowing immediate deployment to Saudi-hosted cloud provider upon availability. Launch remains blocked until closed. |
| **R-11** | Price Payment Confirmed but Commission Unpaid: Buyer wires property price to seller, but platform commission proof expires or is rejected. | High | Medium | Deal is not auto-cancelled when Price is Confirmed and Commission is Expired; post-deadline outcome evaluation transitions Deal to `Disputed`. Disputed deals are ignored by timeout cron and require a Super Admin decision (`Deals.DisputeResolve`: complete, CancelledByAdmin, or return to review with new explicit deadline and reason) to safeguard funds and platform revenue (see FR-31, FR-33, FR-36). |
| **R-12** | Admin Collusion: Corrupt administrator approves fraudulent proofs or facilitates unmediated deal closing. | High | Low | Enforce strict separation of duties: proof approver cannot execute final deal approval (FR-40, FR-51); all administrative actions recorded in append-only immutable `AuditLog`. |

---

## 11. Open Questions & Agreed Defaults

| ID | Open Question | Agreed Default / Resolution | Impact on v1 Execution |
|---|---|---|---|
| **OQ-01** | Must the Seller explicitly acknowledge receipt of the property price before deal completion? | **No in MVP.** Seller is notified when Price proof is uploaded; if payment is not received, seller opens a Dispute (UC-29C). Revisit post-launch based on dispute metrics. | Reduces closing friction; relies on dispute safety valve. |
| **OQ-02** | What are the platform default commission rate and fixed commission fee? | **2.5% default [ASSUMPTION, business decision]; confirm with client** + SAR 0 Fixed Fee. Dynamically configurable via Admin Settings (`UC-76`). | System seeds standard 2.5% rate; admins can alter dynamically. |
| **OQ-03** | Is there an automated REGA registry API for instant Fal license validation? | **Manual Admin Review in MVP.** Support admins inspect uploaded certificates against REGA public lookups. Direct Wathq/REGA API integration planned for v2. | Supported via Admin Licensing Queue (UC-62). |
| **OQ-04** | In what order are Backup Offers activated if a primary Deal times out or cancels? | **Oldest Approved Backup Offer first.** Admin reviews and confirms activation; backup offer does not convert automatically without review. | Maintains fair priority while preserving admin oversight. |
| **OQ-05** | What is the area tolerance for automated Demand matching? | **±20% of required area** `[ASSUMPTION: A-08]`. A demand for 500 m² matches listings between 400 m² and 600 m². | Matching engine uses bounding box on area field. |
| **OQ-06** | Is an owner authorization document required for Marketer listings? | **Yes.** Marketers must upload an authorization document (`AdminOnly`) proving authorization from the property owner before listing approval. | Enforced in listing creation form and admin review. |
| **OQ-07** | How does the system handle deals where proofs are uploaded right before the payment deadline? | **On-Time Proof Protection, Post-Deadline Evaluation & Review SLAs**. PaymentDeadline is the deadline for uploading proofs, not confirmation. Payments uploaded before deadline are protected: timeout job never cancels while in ProofUploaded or UnderReview. A proof rejected before deadline can be re-uploaded until deadline; one rejected at or after deadline gets one correction window of PaymentCorrectionHours (default 12h) from rejection time. Outcome is evaluated only when no payment is ProofUploaded, UnderReview, or in a correction window: both Confirmed -> Completed; Price Confirmed, Commission Expired -> Disputed (Super Admin decision); Commission Confirmed, Price Expired -> CancelledByTimeout and flagged for Super Admin (OQ-13); both Expired -> CancelledByTimeout. Review SLA tiers (4h alert, 12h escalation, 24h mandatory Confirm/Reject decision) never cancel a deal. | Protects buyers from unfair timeouts due to admin latency while safeguarding funds and platform revenue. |
| **OQ-08** | What is the refund policy for Owner listing contract fees if a property does not sell? | **Non-refundable once confirmed.** Contract fee covers platform listing administration and verification services; documented in contract terms. | Stated explicitly in Owner contract template. |
| **OQ-09** | Does the platform issue tax invoices for commissions and contract fees? | **Invoice data captured in MVP; format and ZATCA scope confirmed with an accountant.** | Captures structured invoice records (FR-68) for finance and accounting. |
| **OQ-10** | Is national single sign-on (Nafath) required for Buyer registration in v1? | **No.** Saudi mobile OTP plus national ID document existence check in MVP; Nafath integration planned for v2. | Streamlines initial buyer onboarding friction. |
| **OQ-11** | Is electronic signature via canvas plus OTP legally binding in KSA? | **To be confirmed by legal counsel; evidence set kept** (canvas raster, verified mobile OTP timestamp, user IP, device agent). | Kept in full audit evidence package. |
| **OQ-12** | Does S3 file storage require hosting within the Kingdom of Saudi Arabia / GCC sovereign zone? | Storage and database must be hosted in a region inside the Kingdom of Saudi Arabia (the AWS Saudi region, announced for December 2026, or an in-Kingdom provider). me-south-1 (Bahrain) may be used only as an interim, only after written legal sign-off on cross-border processing under PDPL, with a documented migration plan. Region and endpoints are configuration only (STORAGE_REGION, STORAGE_ENDPOINT, DATABASE_URL). Production launch is blocked until OQ-12 is closed by legal counsel. | **OPEN** (Owner: legal counsel). Governs cloud infrastructure provisioning. |
| **OQ-13** | Is the platform commission refunded when a Deal is cancelled after the commission payment was Confirmed? | **OPEN (owner: product owner and finance).** Until decided, the commission is not refunded automatically and the case goes to Super Admin. | Preserves platform revenue governance and avoids unauthorized automatic debit/refund flows in MVP. |

---

## 12. Assumptions Index

The following table indexes all working assumptions embedded across this PRD, formalizing defaults for immediate engineering execution:

| ID | Location | Summary of Working Assumption | Revisit Trigger |
|---|---|---|---|
| **A-01** | §4.3 (BR-01) | Maximum allowed ask price (`MaxPriceSar`) defaults to SAR 50,000,000. | Ultra-luxury commercial listings requiring higher bounds. |
| **A-02** | §4.1 (FR-1) | Password policy enforces minimum 8 characters with at least one letter and one number. | Security audit or SSO integration. |
| **A-03** | §4.1 (FR-2) | User sessions persist for rolling 30 days; admin sessions expire after 8 hours of inactivity. | Security compliance review. |
| **A-04** | §4.1 (FR-2) | 5 consecutive failed login attempts lock account login for 15 minutes. | High rate of accidental user lockouts. |
| **A-05** | §4.2 (FR-7) | Automated Fal license expiration warnings are dispatched at 30, 7, and 1 days before expiry. | Broker feedback on warning frequency. |
| **A-06** | §4.2 (FR-9) | Owner contract fee payment window defaults to 7 days (`ContractFeeDeadline`). | Operational review of owner conversion rates. |
| **A-07** | §4.6 (FR-25) | A Buyer may maintain at most one active non-final offer per listing at any time. | User requests for multi-tranche offers. |
| **A-08** | §4.5 (FR-22) | Demand matching engine applies an area tolerance window of ±20% of requested area. | Provider proposal relevance feedback. |
| **A-09** | §4.10 (FR-44)| Critical operational and security notifications cannot be disabled by user notification preferences. | User settings audit. |
| **A-10** | §4.1 (FR-5) | Payout account holder name mismatch against registered username generates an admin warning rather than hard blocking. | Marketer commercial name discrepancy analysis. |
| **A-11** | §7.2 (SM-7) | Listing conversion rate is defined as total offers received divided by listing views (per SRS v2.2). | Refinement of analytics conversion funnel. |
| **A-12** | §8.1 | Pre-signed S3 download URLs for private media and documents expire in exactly 5 minutes. | Slow mobile network download timeouts. |
| **A-13** | §4.1 (FR-50) | Account deletion cooling-off period is 14 days for accounts with zero transaction history before permanent erasure. | User feedback on accidental account deletion. |
| **A-14** | §4.7 (FR-31) | Post-deadline payment correction window (`PaymentCorrectionHours`) is 12 hours from rejection time. | Operational monitoring of buyer correction completion. |
| **A-15** | §4.7 (FR-31) | Review SLA tiers default to 4h (admin alert), 12h (Super Admin escalation), and 24h (mandatory Super Admin decision) running on 24/7 calendar. | Back-office staffing metrics and operational queue throughput. |
| **A-16** | §4.11 (FR-51) | Operational queue task claim locking lease duration is 15 minutes with a 5-minute client heartbeat renewal interval. | Admin concurrency collision telemetry. |
| **A-17** | §4.11 (FR-68) | VAT rate defaults to 15% as a configurable system setting. | Saudi ZATCA regulatory tax adjustments. |
| **A-18** | §4.11 (FR-62) | Fraud log triggering thresholds default to `FraudRejectedProofThreshold = 3` rejected proofs within `FraudWindowHours = 72` hours. | Fraud false-positive analysis. |

---

## 13. Implementation Roadmap & Handoff Sequence

The features specified herein are sequenced across 8 vertical delivery epics, led by foundational platform infrastructure. Epic E2 and Epic E3 run in parallel following Epic E1. Epic E0 incorporates foundational platform tasks (geographic master data seeding, TaskLockService, ClockService, malware quarantine scanner hook, and cloud region configuration gate):

```mermaid
graph TD
    E0["Epic E0: Platform Foundation<br/>(Monorepo, NestJS Skeleton, Prisma, S3, pg-boss, ClockService, TaskLockService)"] --> E1["Epic E1: Identity, Access & Admin Foundation<br/>(Saudi Mobile OTP, Multi-Role Profiles, RBAC, Audit)"]
    E1 --> E2["Epic E2: Seller Governance & Listings<br/>(Fal License, Payout Accounts, Owner Contracts, Listings)"]
    E1 --> E3["Epic E3: Discovery & Search (Runs in parallel with E2)<br/>(Multi-Filter Search, Clustered Map, Details, Favorites)"]
    E2 --> E4["Epic E4: Negotiation, Deals & Payments<br/>(Offer Mediation, Payment Window, Dual Proofs, Completion)"]
    E3 --> E4
    E4 --> E5["Epic E5: Buyer Demands & Auto-Matching<br/>(Demand Broadcast, Matching Engine, Proposals)"]
    E4 --> E6["Epic E6: Mediated Comms & Disputes<br/>(Masked Chat, SLA Tickets, Deal Disputes)"]
    E5 --> E7["Epic E7: Analytics, Content & Operations<br/>(Financial Reports, CMS, Banners, Penalties, Geo Admin)"]
    E6 --> E7
```

- **Downstream Artifact Links:**
  - System Architecture Spine: `bmad-architecture`
  - User Experience Design & UI Spec: `bmad-ux`
  - Epic and User Story Decomposition: `bmad-create-epics-and-stories`
  - Test Automation Strategy: `bmad-tea`
