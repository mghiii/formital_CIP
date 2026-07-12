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

alter table public.profiles
  add column if not exists username text,
  add column if not exists rfid_badge_id text;

update public.profiles
set rfid_badge_id = badge_rfid
where rfid_badge_id is null
  and badge_rfid is not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_rfid_badge_id_unique_idx
  on public.profiles (rfid_badge_id)
  where rfid_badge_id is not null;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('engineer', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role;
begin
  begin
    requested_role = coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'operator'::public.app_role);
  exception
    when invalid_text_representation then
      requested_role = 'operator'::public.app_role;
  end;

  insert into public.profiles (id, email, full_name, username, role, rfid_badge_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(new.raw_user_meta_data->>'username', ''),
    requested_role,
    nullif(new.raw_user_meta_data->>'rfid_badge_id', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        username = coalesce(public.profiles.username, excluded.username),
        rfid_badge_id = coalesce(public.profiles.rfid_badge_id, excluded.rfid_badge_id),
        updated_at = now();

  return new;
end;
$$;

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());
