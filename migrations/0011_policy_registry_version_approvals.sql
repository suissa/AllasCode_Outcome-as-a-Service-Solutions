-- Versioned, tenant-scoped policy manifests and immutable approvals.
create table if not exists policy_versions (
  tenant_id text not null,
  policy_id text not null,
  version integer not null check (version > 0),
  name text not null check (length(trim(name)) > 0),
  effective_at timestamptz not null,
  rules jsonb not null,
  created_by text not null,
  policy_hash char(64) not null check (policy_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, policy_id, version)
);
create index if not exists policy_versions_effective_idx
  on policy_versions (tenant_id, policy_id, effective_at, version desc);
create table if not exists policy_approvals (
  tenant_id text not null,
  policy_id text not null,
  version integer not null,
  approved_by text not null,
  approved_at timestamptz not null,
  reason text not null check (length(trim(reason)) > 0),
  policy_hash char(64) not null check (policy_hash ~ '^[a-f0-9]{64}$'),
  primary key (tenant_id, policy_id, version),
  foreign key (tenant_id, policy_id, version)
    references policy_versions (tenant_id, policy_id, version)
);
create index if not exists policy_approvals_actor_idx
  on policy_approvals (tenant_id, approved_by, approved_at);
create or replace function reject_policy_history_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'POLICY_HISTORY_APPEND_ONLY' using errcode = '55000';
end;
$$;
drop trigger if exists policy_versions_no_update_delete on policy_versions;
create trigger policy_versions_no_update_delete before update or delete on policy_versions
  for each row execute function reject_policy_history_mutation();
drop trigger if exists policy_versions_no_truncate on policy_versions;
create trigger policy_versions_no_truncate before truncate on policy_versions
  for each statement execute function reject_policy_history_mutation();
drop trigger if exists policy_approvals_no_update_delete on policy_approvals;
create trigger policy_approvals_no_update_delete before update or delete on policy_approvals
  for each row execute function reject_policy_history_mutation();
drop trigger if exists policy_approvals_no_truncate on policy_approvals;
create trigger policy_approvals_no_truncate before truncate on policy_approvals
  for each statement execute function reject_policy_history_mutation();
