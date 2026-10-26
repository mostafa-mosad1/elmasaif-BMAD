---
title: "Product Brief: Real Estate Marketplace Platform (KSA)"
status: approved
created: "2026-10-26"
updated: "2026-10-26"
---

# Product Brief: Real Estate Marketplace Platform (KSA)

## Executive Summary

The Real Estate Marketplace Platform is a mediated, trust-first digital marketplace engineered exclusively for property sales across the Kingdom of Saudi Arabia (KSA). It bridges property buyers, licensed brokers (Marketers holding valid Fal licenses), and direct property Owners into a transparent, secure environment. By mandating full platform mediation for all inquiries, offers, negotiations, and payments, the platform eliminates informal off-market broker poaching, opaque pricing, and transaction fraud that plague conventional classifieds.

The platform operates on a non-custodial financial model tailored to Saudi banking realities: buyers transfer the property purchase price directly to the verified seller via external bank transfer, while platform commissions and owner contract fees are transferred directly to the platform account. Platform administrators verify both payment proofs before releasing contact details and completing the deal. Built as a high-performance responsive web application (Arabic RTL-first in Next.js) backed by a hardened NestJS REST API and PostgreSQL, the platform establishes institutional governance and regulatory compliance across every residential and commercial sale.

## The Problem

The Saudi real estate sales market suffers from acute friction and distrust across existing digital channels:
1. **Unregulated Broker Scrambling & Poaching:** Traditional listing sites expose seller contacts publicly, leading to unlicensed intermediaries copying listings, posting fake prices, or harassing owners without authorization.
2. **Opaque Negotiations & Asymmetric Information:** Buyers and sellers lack verified audit trails during price negotiations, resulting in retracted verbal offers, inflated middleman markups, and wasted cycles.
3. **Custodial & Payment Friction:** Holding multi-million SAR property sales in digital escrow creates severe regulatory and banking hurdles. Conversely, unverified direct transfers leave buyers vulnerable to counterfeit title deeds and phantom accounts.
4. **Regulatory Non-Compliance:** Unlicensed brokers advertise without Fal license verification (General Authority for Real Estate - REGA), exposing participants to legal penalties.

## The Solution

A strictly mediated, two-sided transaction platform where every interaction is governed, structured, and auditable:
- **Mandatory Mediation Engine:** Inquiries, offers, and counter-offers are routed through administrator queues. Direct buyer-seller communication channels are completely blocked until both funds transfers are confirmed.
- **Dual External Payment Proof Verification:** A 48-hour payment window requires the buyer to upload two distinct bank transfer proofs: one for the platform commission (to the platform bank account) and one for the property price (to the seller's verified Saudi IBAN). Administrators approve both proofs before completing the deal.
- **Automated Buyer Demand Matching:** Buyers submit structured property requests (budget, city, property type, area), and qualified sellers with active matching inventory receive automated dispatch to submit binding proposals.
- **Rigorous Seller Governance:** Marketers must hold an active, verified Fal license, with automated daily compliance tracking and listing suspension on license expiration. Owners must electronically sign standardized listing contracts and submit verified contract fee proofs before property publication.

## What Makes This Different

- **Mediation Over Open Classifieds:** Unlike Haraj or open portals that function as unmoderated classified boards, our platform functions as an institutional deal pipeline where no buyer and seller ever interact unsupervised before closing.
- **Zero Custody, Dual-Proof Assurance:** We avoid the regulatory drag of digital escrow while achieving transaction safety through admin verification of IBAN matching, bank reference codes, and transfer proofs within an enforced 48-hour SLA.
- **Single Identity, Multi-Role Architecture:** A single Saudi phone number and OTP-backed account seamlessly toggles between Buyer, Marketer, and Owner roles with dedicated workspaces and unified notification feeds.
- **Clean Architecture & Scalability:** Zero-compromise decoupling: a Next.js presentation frontend (SEO-optimized, mobile-first Arabic RTL) communicating via a typed client with an independent NestJS API modular monolith, PostgreSQL, and Postgres-backed background queues.

## Who This Serves

- **Property Buyers:** Individuals and investors seeking vetted residential or commercial properties in KSA. They need transparent pricing, guaranteed seller authenticity, direct bank transfer safety, and structured negotiation.
- **Licensed Marketers (Brokers):** Certified brokers with valid Fal licenses seeking high-intent buyer leads, automated demand matching, and protection against stolen listings and bypassed commissions.
- **Property Owners:** Direct title deed holders looking to sell properties without enduring dozens of unsolicited calls, backed by an electronic listing agreement and platform oversight.
- **Platform Operators & Support Admins:** Operations personnel executing content review, dispute resolution, price suggestions, and dual payment proof validation under granular Dynamic RBAC.

## Success Criteria

1. **Transaction Velocity & Integrity:**
   - 100% of published marketer listings backed by verified Fal licenses and registered Saudi IBANs.
   - 100% of owner listings backed by digitally signed listing contracts and verified contract fees.
   - Dual payment proof review turnaround within < 4 hours of upload during business hours.
2. **Platform Adoption & Performance:**
   - Demand matching latency < 5 minutes from buyer submission to provider dispatch.
   - System response time p95 < 500 ms for mutations and < 300 ms for reads under 50,000 active listings.
   - Zero production leaks of direct contact information prior to deal completion.

## Scope

### In Scope (MVP)
- Mobile-first responsive web application (Next.js) and administrative back-office.
- Saudi mobile number OTP verification (static provider in dev, pluggable SMS provider in prod).
- Multi-role user accounts (Buyer, Marketer, Owner) and dynamic RBAC for administrative teams.
- Fal license lifecycle (submission, admin review, automated daily expiration enforcement).
- Owner listing contracts (template assignment, electronic signature with OTP stamp, fee proof review).
- Full listing lifecycle (creation, multi-photo upload, price validation, admin moderation, archiving).
- Search, multi-criteria filtering, and interactive colored map markers with clustering.
- Demand creation, automated provider matching, and proposal submission.
- Admin-mediated offer/counter-offer negotiation with configured round and time limits.
- Deal state machine with 48-hour payment window, dual bank transfer proof upload, timeout handling, dispute opening, and atomic deal completion.
- Dynamic system settings for commission rates, fees, and operational timeouts.

### Out of Scope (MVP)
- Native mobile applications (iOS/Android) — replaced by mobile-optimized web app.
- Rental properties, leasing, installment financing, or real estate auctions (sales only).
- In-app payment gateways, digital wallets, credit card acquiring, or automated escrow custody.
- Saved searches and web push notifications (in-app notifications and email only in MVP).
- Automated government registry API integrations (Wathq/REGA/Absher) — manual document verification in MVP.

## Vision

Within 2–3 years, the platform will evolve into the definitive enterprise transaction gateway for KSA real estate:
- Direct API integration with the General Authority for Real Estate (REGA) and Absher for real-time instant Fal license validation and Nafath identity verification.
- Integration with Saudi Open Banking and SAMA-regulated escrow services for instant real-time bank transfer validation and programmatic settlement.
- Expanded institutional offerings for real estate funds, commercial developers, and high-volume corporate property portfolios.
