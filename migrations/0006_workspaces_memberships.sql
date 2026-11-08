create table if not exists workspaces (
  tenant_id text not null,
  workspace_id text not null,
  slug text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, workspace_id),
  unique (tenant_id, slug)
);
create table if not exists workspace_memberships (
  tenant_id text not null,
  workspace_id text not null,
  actor_id text not null,
  status text not null check (status in ('invited','active','revoked')),
  expires_at timestamptz,
  invitation_token_hash text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, workspace_id, actor_id),
  foreign key (tenant_id, workspace_id) references workspaces (tenant_id, workspace_id),
  check (status <> 'invited' or (expires_at is not null and invitation_token_hash is not null))
);
create index if not exists workspace_memberships_actor_idx on workspace_memberships (tenant_id, actor_id, status);
