create table if not exists authorization_roles (
  tenant_id text not null, role_id text not null, name text not null, permissions text[] not null,
  created_by text not null, created_at timestamptz not null default now(),
  primary key (tenant_id, role_id), unique (tenant_id, name), check (cardinality(permissions) > 0)
);
create table if not exists authorization_grants (
  tenant_id text not null, grant_id text not null, actor_id text not null, role_id text not null,
  effect text not null check (effect in ('allow','deny')), workspace_id text, resource_type text, resource_id text,
  conditions jsonb not null default '{}'::jsonb, granted_by text not null, granted_at timestamptz not null default now(),
  expires_at timestamptz, revoked_at timestamptz, primary key (tenant_id, grant_id),
  foreign key (tenant_id, role_id) references authorization_roles (tenant_id, role_id),
  check (resource_id is null or resource_type is not null)
);
create index if not exists authorization_grants_actor_idx on authorization_grants (tenant_id, actor_id, revoked_at, expires_at);
create table if not exists authorization_decisions (
  tenant_id text not null, decision_id text not null, actor_id text not null, action text not null,
  resource_type text not null, resource_id text not null, allowed boolean not null, reason text not null,
  matched_grant_ids text[] not null default '{}', evaluated_at timestamptz not null default now(),
  primary key (tenant_id, decision_id)
);
create index if not exists authorization_decisions_resource_idx on authorization_decisions (tenant_id, resource_type, resource_id, evaluated_at);
