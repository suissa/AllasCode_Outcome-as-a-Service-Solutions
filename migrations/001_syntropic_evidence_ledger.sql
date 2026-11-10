-- PostgreSQL reference schema. App roles get INSERT/SELECT only; no UPDATE/DELETE/TRUNCATE.
CREATE TABLE IF NOT EXISTS syntropic_ledger_events (
 tenant_id text NOT NULL, sequence bigint GENERATED ALWAYS AS IDENTITY, event_id text NOT NULL,
 event_type text NOT NULL, occurred_at timestamptz NOT NULL, payload jsonb NOT NULL,
 previous_hash char(64) NOT NULL, event_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, sequence), UNIQUE (tenant_id, event_id),
 CHECK (length(event_hash)=64), CHECK (length(previous_hash)=64)
);
CREATE INDEX IF NOT EXISTS syntropic_ledger_tenant_event_type ON syntropic_ledger_events(tenant_id,event_type,sequence);
CREATE TABLE IF NOT EXISTS syntropic_proof_artifacts (
 tenant_id text NOT NULL, proof_id text NOT NULL, specification_id text NOT NULL,
 specification_version text NOT NULL, checker text NOT NULL, checker_version text NOT NULL,
 verdict text NOT NULL CHECK(verdict IN ('passed','failed')), artifact_digest text NOT NULL,
 checked_at timestamptz NOT NULL, obligations jsonb NOT NULL CHECK(jsonb_typeof(obligations)='array'),
 log_reference text, ledger_sequence bigint NOT NULL,
 PRIMARY KEY(tenant_id,proof_id), FOREIGN KEY(tenant_id,ledger_sequence) REFERENCES syntropic_ledger_events(tenant_id,sequence)
);
CREATE OR REPLACE FUNCTION syntropic_reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SYN-LEDGER-IMMUTABLE'; END; $$;
DROP TRIGGER IF EXISTS syntropic_ledger_immutable ON syntropic_ledger_events;
CREATE TRIGGER syntropic_ledger_immutable BEFORE UPDATE OR DELETE ON syntropic_ledger_events FOR EACH ROW EXECUTE FUNCTION syntropic_reject_ledger_mutation();
DROP TRIGGER IF EXISTS syntropic_proof_immutable ON syntropic_proof_artifacts;
CREATE TRIGGER syntropic_proof_immutable BEFORE UPDATE OR DELETE ON syntropic_proof_artifacts FOR EACH ROW EXECUTE FUNCTION syntropic_reject_ledger_mutation();
