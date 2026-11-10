-- PostgreSQL append-only evidence ledger.
-- Sequence is tenant-local and allocated while holding a transaction-scoped advisory lock.
CREATE TABLE IF NOT EXISTS syntropic_ledger_events (
  tenant_id text NOT NULL CHECK (length(trim(tenant_id)) > 0),
  sequence bigint NOT NULL CHECK (sequence > 0),
  event_id text NOT NULL CHECK (length(trim(event_id)) > 0),
  event_type text NOT NULL CHECK (length(trim(event_type)) > 0),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  previous_hash char(64) NOT NULL CHECK (previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash char(64) NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, sequence),
  UNIQUE (tenant_id, event_id)
);
CREATE INDEX IF NOT EXISTS syntropic_ledger_tenant_event_type
  ON syntropic_ledger_events (tenant_id, event_type, sequence);

CREATE TABLE IF NOT EXISTS syntropic_proof_artifacts (
  tenant_id text NOT NULL,
  proof_id text NOT NULL,
  specification_id text NOT NULL,
  specification_version text NOT NULL,
  checker text NOT NULL,
  checker_version text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('passed', 'failed')),
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^[0-9a-f]{64}$'),
  checked_at timestamptz NOT NULL,
  obligations jsonb NOT NULL CHECK (jsonb_typeof(obligations) = 'array'),
  log_reference text,
  ledger_sequence bigint NOT NULL,
  PRIMARY KEY (tenant_id, proof_id),
  FOREIGN KEY (tenant_id, ledger_sequence)
    REFERENCES syntropic_ledger_events (tenant_id, sequence)
);

CREATE OR REPLACE FUNCTION syntropic_reject_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SYN-LEDGER-IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS syntropic_ledger_immutable ON syntropic_ledger_events;
CREATE TRIGGER syntropic_ledger_immutable
  BEFORE UPDATE OR DELETE ON syntropic_ledger_events
  FOR EACH ROW EXECUTE FUNCTION syntropic_reject_ledger_mutation();

DROP TRIGGER IF EXISTS syntropic_ledger_no_truncate ON syntropic_ledger_events;
CREATE TRIGGER syntropic_ledger_no_truncate
  BEFORE TRUNCATE ON syntropic_ledger_events
  FOR EACH STATEMENT EXECUTE FUNCTION syntropic_reject_ledger_mutation();

DROP TRIGGER IF EXISTS syntropic_proof_immutable ON syntropic_proof_artifacts;
CREATE TRIGGER syntropic_proof_immutable
  BEFORE UPDATE OR DELETE ON syntropic_proof_artifacts
  FOR EACH ROW EXECUTE FUNCTION syntropic_reject_ledger_mutation();

DROP TRIGGER IF EXISTS syntropic_proof_no_truncate ON syntropic_proof_artifacts;
CREATE TRIGGER syntropic_proof_no_truncate
  BEFORE TRUNCATE ON syntropic_proof_artifacts
  FOR EACH STATEMENT EXECUTE FUNCTION syntropic_reject_ledger_mutation();

-- Restrict the application role separately during deployment:
-- GRANT SELECT, INSERT ON syntropic_ledger_events, syntropic_proof_artifacts TO oaas_app;
-- REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON syntropic_ledger_events, syntropic_proof_artifacts FROM oaas_app;
