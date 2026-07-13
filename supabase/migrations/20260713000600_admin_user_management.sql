alter table public.profiles
  add column if not exists phone text,
  add column if not exists matricule text,
  add column if not exists department text,
  add column if not exists workshop text,
  add column if not exists status text not null default 'active',
  add column if not exists avatar_url text,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists deactivated_at timestamptz;

update public.profiles
set status = case when is_active then 'active' else 'inactive' end
where status is null
   or status not in ('active', 'inactive', 'pending');

alter table public.profiles
  drop constraint if exists profiles_status_check,
  add constraint profiles_status_check check (status in ('active', 'inactive', 'pending'));

create unique index if not exists profiles_matricule_unique_idx
  on public.profiles (lower(matricule))
  where matricule is not null;

create table if not exists public.roles (
  key text primary key,
  label text not null,
  description text,
  can_manage_all boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_key_check check (key in ('operator', 'engineer', 'admin'))
);

insert into public.roles (key, label, description, can_manage_all)
values
  ('operator', 'Operateur', 'Execution des cycles CIP et saisie terrain.', false),
  ('engineer', 'Ingenieur', 'Pilotage qualite, cycles, equipements et gestion des operateurs.', false),
  ('admin', 'Administrateur', 'Administration complete des comptes et de l audit.', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  can_manage_all = excluded.can_manage_all;

alter table public.roles enable row level security;

drop policy if exists "Roles are readable by authenticated users" on public.roles;
create policy "Roles are readable by authenticated users"
on public.roles for select
using (auth.role() = 'authenticated');

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);
create index if not exists admin_audit_log_target_id_idx on public.admin_audit_log (target_id);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active and status = 'active';
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

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
     and coalesce(public.current_profile_role() = 'admin', false) = false
     and (
       new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.status is distinct from old.status
       or new.deactivated_at is distinct from old.deactivated_at
     ) then
    raise exception 'profile privilege fields cannot be changed by the profile owner';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation_trigger on public.profiles;
create trigger prevent_profile_privilege_escalation_trigger
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

drop policy if exists "Profiles are readable by owner or engineers" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Engineers can manage profiles" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Engineers can read operator profiles" on public.profiles;
drop policy if exists "Engineers can update operator profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile basics" on public.profiles;

create policy "Admins can manage all profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Engineers can read operator profiles"
on public.profiles for select
using (public.current_profile_role() = 'engineer' and (role = 'operator' or id = auth.uid()));

create policy "Engineers can update operator profiles"
on public.profiles for update
using (public.current_profile_role() = 'engineer' and role = 'operator')
with check (public.current_profile_role() = 'engineer' and role = 'operator');

create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update own profile basics"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can read audit log" on public.admin_audit_log;
drop policy if exists "Engineers can read operator audit log" on public.admin_audit_log;

create policy "Admins can read audit log"
on public.admin_audit_log for select
using (public.is_admin());

create policy "Engineers can read operator audit log"
on public.admin_audit_log for select
using (
  public.current_profile_role() = 'engineer'
  and exists (
    select 1
    from public.profiles p
    where p.id = admin_audit_log.target_id
      and p.role = 'operator'
  )
);
