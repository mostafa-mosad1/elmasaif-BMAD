-- Story 8.7: Immutable Domain Audit Logging & Inspection (BR-19)
--
-- Per BR-19: "Audit database tables are strictly insert-only with zero update/delete permissions granted to application roles."
-- This PostgreSQL trigger prevents any UPDATE or DELETE operation on the `audit_logs` table.

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

