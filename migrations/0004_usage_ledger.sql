create table if not exists usage_meter_events (
 tenant_id text not null, idempotency_key text not null, event_id text not null, fingerprint text not null,
 payload jsonb not null, ledger_entry_id text not null, ledger_payload jsonb not null,
 created_at timestamptz not null default now(), primary key (tenant_id,idempotency_key),
 unique (tenant_id,event_id)
);
create table if not exists usage_ledger_entries (
 tenant_id text not null, entry_id text not null, source_event_id text not null, payload jsonb not null,
 created_at timestamptz not null default now(), primary key (tenant_id,entry_id),
 unique (tenant_id,source_event_id),
 foreign key (tenant_id,source_event_id) references usage_meter_events (tenant_id,event_id)
);
create index if not exists usage_ledger_tenant_created_idx on usage_ledger_entries (tenant_id,created_at);
