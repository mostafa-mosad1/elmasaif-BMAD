-- Story 8.7: Immutable Domain Audit Logging & Inspection (BR-19)
-- Migration: 20261112_audit_logs_immutable

-- Index on [actorId, createdAt]
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- Immutability trigger function
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_audit_log_modification'
  ) THEN
    CREATE TRIGGER trg_prevent_audit_log_modification
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
  END IF;
END $$;

