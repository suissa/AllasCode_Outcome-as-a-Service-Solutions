-- Tenant-scoped contract snapshots with optimistic revisions, idempotent commands and append-only events.
create table if not exists contract_records (
 tenant_id text not null,
 contract_id text not null,
 revision bigint not null check (revision > 0),
 state text not null check (state in ('draft','in_review','approved','active','cancelled')),
 payload jsonb not null,
 created_at timestamptz not null,
 updated_at timestamptz not null,
 primary key (tenant_id,contract_id)
);
create index if not exists contract_records_state_idx on contract_records(tenant_id,state,updated_at);
create table if not exists contract_events (
 tenant_id text not null,
 contract_id text not null,
 event_id text not null,
 revision bigint not null check (revision > 0),
 action text not null check (action in ('created','submitted_for_review','approved_for_signature','signature_recorded','activated')),
 from_state text,
 to_state text not null,
 actor_id text not null,
 correlation_id text not null,
 metadata jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null,
 primary key (tenant_id,event_id),
 unique (tenant_id,contract_id,revision),
 foreign key (tenant_id,contract_id) references contract_records(tenant_id,contract_id)
);
create index if not exists contract_events_history_idx on contract_events(tenant_id,contract_id,revision);
create table if not exists contract_idempotency (
 tenant_id text not null,
 idempotency_key text not null,
 fingerprint char(64) not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key (tenant_id,idempotency_key)
);
create or replace function reject_contract_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'CONTRACT_EVENT_IMMUTABLE' using errcode='55000'; end;
$$;
drop trigger if exists contract_events_no_update_delete on contract_events;
create trigger contract_events_no_update_delete before update or delete on contract_events for each row execute function reject_contract_event_mutation();
drop trigger if exists contract_events_no_truncate on contract_events;
create trigger contract_events_no_truncate before truncate on contract_events for each statement execute function reject_contract_event_mutation();
