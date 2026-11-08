create table if not exists api_keys (
 key_id text primary key, tenant_id text not null, actor_id text not null,
 secret_hash char(64) not null, scopes text[] not null,
 expires_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
 check (secret_hash ~ '^[a-fA-F0-9]{64}$'), check (cardinality(scopes) > 0)
);
create index if not exists api_keys_tenant_actor_idx on api_keys (tenant_id,actor_id);
