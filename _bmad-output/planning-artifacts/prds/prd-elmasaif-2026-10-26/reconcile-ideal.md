# Input Reconciliation: SRS v2.2 (ideal.md)

**Target Artifacts:** `prd.md` and `addendum.md`  
**Source Document:** `_bmad-output/ideal.md` (SRS v2.2)  
**Date:** 2026-10-26  

## Summary
The core requirements, business rules (BR-01 through BR-22), state transition tables, admin permission catalog, notifications catalog, risk register, and epic plan (E0 to E7) from SRS v2.2 have been completely captured across `prd.md` and `addendum.md`.

## Key Mappings & Coverage
1. **Business Rules:**
   - Single Ask Price (BR-01) -> Captured in PRD FR-11 & FR-17.
   - Commission snapshot (BR-02) -> Captured in PRD FR-29.
   - Mandatory mediation (BR-03) -> Captured in PRD Vision, Section 3 Glossary, FR-25, FR-35.
   - Dual payment money flow (BR-04) -> Captured in PRD FR-30, FR-31, FR-32.
   - Seller payout account & IBAN (BR-05) -> Captured in PRD FR-5.
   - Contact disclosure gating (BR-06) -> Captured in PRD FR-32.
   - Deal creation & single active deal (BR-07) -> Captured in PRD FR-28 & Section 8.5.
   - 48-hour payment deadline & 12h grace period (BR-08, OQ-07) -> Captured in PRD FR-31 & FR-33.
   - Deal completion atomic commit (BR-09) -> Captured in PRD FR-32.
   - Buyer identity document check (BR-10) -> Captured in PRD FR-4 & FR-30.
   - Offer price guardrails (BR-11) -> Captured in PRD FR-25.
   - Demand matching (BR-12) -> Captured in PRD FR-21, FR-22, FR-23.
   - Fal license governance (BR-14) -> Captured in PRD FR-6, FR-7, FR-8.
   - Owner contract gating (BR-15) -> Captured in PRD FR-9, FR-10.
   - Price authority & suggestions (BR-16) -> Captured in PRD FR-14 & Section 4.9.
   - Ratings (BR-17) -> Captured in PRD FR-32.
   - Deletion rules (BR-18) -> Captured in PRD FR-43.
   - Auditability (BR-19) -> Captured in PRD FR-42.
   - Dynamic settings (BR-20) -> Captured in PRD FR-41.
   - Document visibility (BR-21) -> Captured in PRD FR-12.
   - Saudi phone normalization (BR-22) -> Captured in PRD FR-1.

2. **Gaps & Nuances Surfaced:**
   - *Tone/Feel:* The SRS emphasizes strict fraud mitigation and administrative neutrality. Captured in PRD Vision and User Journeys.
   - *Technical Nuances:* Prisma transaction boundaries, pg-boss queue specifications, and partial unique indexes preserved in `addendum.md`.
