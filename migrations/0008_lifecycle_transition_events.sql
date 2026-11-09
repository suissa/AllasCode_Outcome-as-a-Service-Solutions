-- Append-only lifecycle transition ledger. State changes are CAS-guarded by entity revision.
create table if not exists lifecycle_transition_events (
 tenant_id text not null, entity_type text not null, entity_id text not null,
 revision bigint not null check (revision > 0), event_id text not null, machine text not null,
 actor_id text not null, correlation_id text not null, action text not null,
 from_state text not null, to_state text not null, occurred_at timestamptz not null,
 metadata jsonb not null default '{}'::jsonb,
 primary key (tenant_id, entity_type, entity_id, revision), unique (tenant_id, event_id)
);
create index if not exists lifecycle_transition_entity_idx on lifecycle_transition_events (tenant_id,entity_type,entity_id,occurred_at);
create index if not exists lifecycle_transition_actor_idx on lifecycle_transition_events (tenant_id,actor_id,occurred_at);
