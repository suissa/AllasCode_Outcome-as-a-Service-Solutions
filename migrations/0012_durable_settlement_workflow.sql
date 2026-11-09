-- Durable idempotent settlement action queue and append-only execution history.
create table if not exists settlement_workflow_actions (
 tenant_id text not null,
 action_id text not null,
 idempotency_key text not null,
 fingerprint char(64) not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 state text not null check(state in ('pending','running','succeeded','failed')),
 attempt integer not null default 0 check(attempt>=0),
 max_attempts integer not null check(max_attempts>0),
 lease_until timestamptz,
 claimed_by text,
 external_reference text,
 error_code text,
 created_at timestamptz not null,
 updated_at timestamptz not null,
 primary key(tenant_id,action_id),
 unique(tenant_id,idempotency_key),
 check((state='running' and lease_until is not null and claimed_by is not null) or (state<>'running' and lease_until is null and claimed_by is null))
);
create index if not exists settlement_workflow_pending_idx on settlement_workflow_actions(tenant_id,state,updated_at);
create table if not exists settlement_workflow_events (
 tenant_id text not null,
 action_id text not null,
 event_id text not null,
 kind text not null check(kind in ('queued','started','retry_scheduled','completed','failed')),
 actor_id text not null,
 correlation_id text not null,
 payload jsonb not null,
 occurred_at timestamptz not null,
 primary key(tenant_id,event_id),
 foreign key(tenant_id,action_id) references settlement_workflow_actions(tenant_id,action_id)
);
create index if not exists settlement_workflow_events_action_idx on settlement_workflow_events(tenant_id,action_id,occurred_at,event_id);
create or replace function reject_settlement_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'SETTLEMENT_EVENT_IMMUTABLE' using errcode='55000'; end;
$$;
drop trigger if exists settlement_events_no_update_delete on settlement_workflow_events;
create trigger settlement_events_no_update_delete before update or delete on settlement_workflow_events for each row execute function reject_settlement_event_mutation();
drop trigger if exists settlement_events_no_truncate on settlement_workflow_events;
create trigger settlement_events_no_truncate before truncate on settlement_workflow_events for each statement execute function reject_settlement_event_mutation();
