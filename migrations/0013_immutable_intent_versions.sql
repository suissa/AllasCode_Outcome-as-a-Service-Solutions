create or replace function reject_intent_version_mutation() returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_intent_version_purge', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    if tg_op = 'UPDATE' then return new; end if;
    return null;
  end if;
  raise exception 'INTENT_VERSION_APPEND_ONLY';
end;
$$;

drop trigger if exists intent_versions_no_update_delete on intent_versions;
create trigger intent_versions_no_update_delete
before update or delete on intent_versions
for each row execute function reject_intent_version_mutation();

drop trigger if exists intent_versions_no_truncate on intent_versions;
create trigger intent_versions_no_truncate
before truncate on intent_versions
for each statement execute function reject_intent_version_mutation();
