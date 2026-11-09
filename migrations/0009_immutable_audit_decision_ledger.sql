-- Tenant-scoped append-only audit and decision ledger with a verifiable SHA-256 hash chain.
create table if not exists audit_event_ledger (
  tenant_id text not null,
  sequence bigint not null check (sequence > 0),
  event_id text not null,
  event_type text not null check (event_type in ('audit','decision')),
  previous_hash char(64) not null check (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash char(64) not null check (event_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, sequence),
  unique (tenant_id, event_id),
  unique (tenant_id, event_hash)
);
create index if not exists audit_event_subject_idx on audit_event_ledger (tenant_id, event_type, recorded_at);
create or replace function reject_audit_ledger_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_LEDGER_APPEND_ONLY' using errcode = '55000';
end;
$$;
drop trigger if exists audit_ledger_no_update_delete on audit_event_ledger;
create trigger audit_ledger_no_update_delete before update or delete on audit_event_ledger
for each row execute function reject_audit_ledger_mutation();
drop trigger if exists audit_ledger_no_truncate on audit_event_ledger;
create trigger audit_ledger_no_truncate before truncate on audit_event_ledger
for each statement execute function reject_audit_ledger_mutation();
