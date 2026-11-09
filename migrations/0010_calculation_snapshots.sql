-- Immutable, tenant-scoped and reproducible calculation snapshots.
create table if not exists calculation_snapshots (
 tenant_id text not null,
 snapshot_id text not null,
 outcome_id text not null,
 fingerprint char(64) not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 calculated_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 primary key(tenant_id,snapshot_id)
);
create index if not exists calculation_snapshots_outcome_idx on calculation_snapshots(tenant_id,outcome_id,calculated_at,snapshot_id);
create or replace function reject_calculation_snapshot_mutation() returns trigger language plpgsql as $$
begin
 raise exception 'CALCULATION_SNAPSHOT_IMMUTABLE' using errcode='55000';
end;
$$;
drop trigger if exists calculation_snapshots_no_update_delete on calculation_snapshots;
create trigger calculation_snapshots_no_update_delete before update or delete on calculation_snapshots
 for each row execute function reject_calculation_snapshot_mutation();
drop trigger if exists calculation_snapshots_no_truncate on calculation_snapshots;
create trigger calculation_snapshots_no_truncate before truncate on calculation_snapshots
 for each statement execute function reject_calculation_snapshot_mutation();
