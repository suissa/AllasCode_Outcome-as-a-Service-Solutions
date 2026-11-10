create table if not exists outcome_proposals (
  tenant_id text not null,
  proposal_id text not null,
  version bigint not null check (version > 0),
  status text not null check (status in ('draft','ready_for_review','approved','rejected','superseded')),
  payload jsonb not null,
  source jsonb not null,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, proposal_id)
);
create index if not exists outcome_proposals_tenant_updated_idx
  on outcome_proposals (tenant_id, updated_at desc, proposal_id);

create table if not exists outcome_proposal_events (
  tenant_id text not null,
  proposal_id text not null,
  event_id text not null,
  version bigint not null check (version > 0),
  actor_id text not null,
  event_type text not null check (event_type in ('submitted','approved','rejected','superseded')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  foreign key (tenant_id, proposal_id) references outcome_proposals (tenant_id, proposal_id)
);
create index if not exists outcome_proposal_events_history_idx
  on outcome_proposal_events (tenant_id, proposal_id, created_at, event_id);

create table if not exists outcome_proposal_idempotency (
  tenant_id text not null,
  idempotency_key text not null,
  fingerprint text not null,
  proposal_id text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key),
  foreign key (tenant_id, proposal_id) references outcome_proposals (tenant_id, proposal_id)
);
