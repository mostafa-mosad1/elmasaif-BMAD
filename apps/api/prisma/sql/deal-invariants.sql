-- Story 5.1 — Deal table invariants that Prisma cannot express.
--
-- Applied by `npm run prisma:push` (apps/api), which runs `prisma db push` first and then executes
-- this file: `db push` DROPS any index it does not know about, so the partial index below has to be
-- re-created every time the schema is synced (trap T-3). Never run a bare `prisma db push`.
--
-- Both statements are idempotent, so re-running the script is safe.

-- AD-4 / BR-07: at most one non-terminal Deal per listing.
--
-- The predicate is written as `NOT IN (terminal…)` on purpose and must NOT be rewritten as
-- `IN (active…)`: with the negative form a future non-terminal status (e.g. DISPUTED in Story 5.6)
-- is automatically covered, whereas the positive form would silently let it fall outside the index
-- and allow two deals for one listing.
--
-- Maintenance contract: every future TERMINAL DealStatus must be added to this list, and to
-- `TERMINAL_DEAL_STATUSES` in `packages/shared/src/constants/deal.ts`.
CREATE UNIQUE INDEX IF NOT EXISTS deal_single_active_listing
  ON "deals" ("listingId")
  WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED');

-- BR-02: the stored money must be internally consistent, whatever wrote the row.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_amounts_consistent') THEN
    ALTER TABLE "deals" ADD CONSTRAINT deals_amounts_consistent
      CHECK ("dealPrice" > 0 AND "platformCommission" >= 0
             AND "totalAmount" = "dealPrice" + "platformCommission");
  END IF;
END $$;
