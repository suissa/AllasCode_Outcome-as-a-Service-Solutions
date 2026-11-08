create table if not exists workflow_tasks (
 tenant_id text not null, workflow_id text not null, task_id text not null, state text not null,
 payload jsonb not null, version bigint not null default 1, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), primary key (tenant_id,task_id),
 unique (tenant_id,workflow_id,task_id)
);
create index if not exists workflow_tasks_ready_idx on workflow_tasks (tenant_id,workflow_id,state);
create table if not exists workflow_task_events (
 tenant_id text not null, task_id text not null, event_id text not null, payload jsonb not null,
 created_at timestamptz not null default now(), primary key (tenant_id,event_id),
 foreign key (tenant_id,task_id) references workflow_tasks (tenant_id,task_id)
);
create index if not exists workflow_task_events_task_idx on workflow_task_events (tenant_id,task_id,created_at);
