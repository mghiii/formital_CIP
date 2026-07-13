do $$
begin
  if to_regtype('public.app_role') is not null
     and not exists (
       select 1
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public'
         and t.typname = 'app_role'
         and e.enumlabel = 'admin'
     ) then
    alter type public.app_role add value 'admin';
  end if;
end $$;
