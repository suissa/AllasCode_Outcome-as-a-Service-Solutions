create table if not exists outcome_cases (
  tenant_id text not null, case_id text not null, payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (tenant_id, case_id)
);
create table if not exists outcome_audit_events (
  tenant_id text not null, case_id text not null, event_id text not null, payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  foreign key (tenant_id, case_id) references outcome_cases (tenant_id, case_id)
);
create index if not exists outcome_audit_case_idx on outcome_audit_events (tenant_id, case_id, created_at);
create table if not exists outcome_idempotency (
  tenant_id text not null, idempotency_key text not null, fingerprint text not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key (tenant_id, idempotency_key)
);
create index if not exists outcome_idempotency_created_idx on outcome_idempotency (created_at);
