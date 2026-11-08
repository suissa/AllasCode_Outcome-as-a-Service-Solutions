create table if not exists intent_versions (
 tenant_id text not null, intent_id text not null, version integer not null check(version>0),
 payload jsonb not null, created_at timestamptz not null default now(),
 primary key (tenant_id,intent_id,version)
);
