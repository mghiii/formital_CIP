create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regtype('public.app_role') is null then
    create type public.app_role as enum ('operator', 'engineer');
  end if;

  if to_regtype('public.equipment_status') is null then
    create type public.equipment_status as enum (
      'available',
      'in_cleaning',
      'cleaned',
      'not_cleaned',
      'out_of_service'
    );
  end if;

  if to_regtype('public.cip_cycle_status') is null then
    create type public.cip_cycle_status as enum ('draft', 'in_progress', 'completed', 'cancelled');
  end if;

  if to_regtype('public.compliance_result') is null then
    create type public.compliance_result as enum ('compliant', 'non_compliant');
  end if;

  if to_regtype('public.parameter_type') is null then
    create type public.parameter_type as enum (
      'temperature',
      'duration',
      'water_consumed',
      'conductivity',
      'concentration',
      'flow_rate',
      'pressure',
      'soda_quantity',
      'acid_quantity'
    );
  end if;

  if to_regtype('public.parameter_source') is null then
    create type public.parameter_source as enum ('manual', 'automatic', 'sensor', 'plc');
  end if;

  if to_regtype('public.alert_status') is null then
    create type public.alert_status as enum ('active', 'acknowledged', 'resolved');
  end if;

  if to_regtype('public.alert_severity') is null then
    create type public.alert_severity as enum ('info', 'warning', 'critical');
  end if;

  if to_regtype('public.anomaly_action') is null then
    create type public.anomaly_action as enum (
      'new_attempt',
      'inform_manager',
      'stop_process',
      'observation_only'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'operator',
  badge_rfid text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipments (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete restrict,
  name text not null,
  status public.equipment_status not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, process_id),
  unique (process_id, name)
);

create table if not exists public.cip_cycles (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete restrict,
  process_id uuid not null references public.processes(id) on delete restrict,
  equipment_id uuid not null references public.equipments(id) on delete restrict,
  status public.cip_cycle_status not null default 'draft',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  temperature_c numeric(8,2),
  water_consumed_l numeric(12,2),
  visual_aspect text,
  observation text,
  soda_quantity numeric(12,2),
  acid_quantity numeric(12,2),
  result public.compliance_result,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cip_cycles_equipment_process_fk
    foreign key (equipment_id, process_id) references public.equipments(id, process_id) on delete restrict,
  constraint cip_cycles_end_after_start_chk check (ended_at is null or ended_at >= started_at),
  constraint cip_cycles_result_when_completed_chk check (
    (status <> 'completed' and result is null)
    or (status = 'completed' and result is not null and ended_at is not null)
  )
);

create table if not exists public.cip_checklists (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.cip_cycles(id) on delete cascade,
  valves_open boolean not null default false,
  cleaning_product_available boolean not null default false,
  tank_empty boolean not null default false,
  circuit_selected boolean not null default false,
  safety_conditions_checked boolean not null default false,
  all_validated boolean generated always as (
    valves_open
    and cleaning_product_available
    and tank_empty
    and circuit_selected
    and safety_conditions_checked
  ) stored,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cip_parameters (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cip_cycles(id) on delete cascade,
  parameter public.parameter_type not null,
  value numeric(14,4) not null,
  unit text,
  source public.parameter_source not null default 'manual',
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cip_parameters_unit_not_blank_chk check (unit is null or length(btrim(unit)) > 0)
);

create table if not exists public.equipment_reference_limits (
  id uuid primary key default gen_random_uuid(),
  process_id uuid references public.processes(id) on delete cascade,
  equipment_id uuid references public.equipments(id) on delete cascade,
  parameter public.parameter_type not null,
  min_value numeric(14,4),
  max_value numeric(14,4),
  target_value numeric(14,4),
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_limits_scope_chk check (process_id is not null or equipment_id is not null),
  constraint reference_limits_min_max_chk check (min_value is null or max_value is null or min_value <= max_value)
);

create table if not exists public.cip_alerts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cip_cycles(id) on delete cascade,
  operator_id uuid references public.profiles(id) on delete set null,
  equipment_id uuid references public.equipments(id) on delete set null,
  severity public.alert_severity not null default 'warning',
  status public.alert_status not null default 'active',
  title text not null,
  message text,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint cip_alerts_title_not_blank_chk check (length(btrim(title)) > 0)
);

create table if not exists public.cip_anomalies (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cip_cycles(id) on delete cascade,
  alert_id uuid references public.cip_alerts(id) on delete set null,
  parameter public.parameter_type,
  measured_value numeric(14,4),
  min_limit numeric(14,4),
  max_limit numeric(14,4),
  action public.anomaly_action not null default 'observation_only',
  observation text,
  created_at timestamptz not null default now()
);

create table if not exists public.cip_instructions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid references public.processes(id) on delete cascade,
  equipment_id uuid references public.equipments(id) on delete cascade,
  title text not null,
  content text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cip_instructions_scope_chk check (process_id is not null or equipment_id is not null),
  constraint cip_instructions_title_not_blank_chk check (length(btrim(title)) > 0),
  constraint cip_instructions_content_not_blank_chk check (length(btrim(content)) > 0),
  constraint cip_instructions_version_positive_chk check (version > 0)
);

create unique index if not exists equipment_reference_limits_equipment_parameter_idx
  on public.equipment_reference_limits (equipment_id, parameter)
  where equipment_id is not null and is_active;

create unique index if not exists equipment_reference_limits_process_parameter_idx
  on public.equipment_reference_limits (process_id, parameter)
  where process_id is not null and equipment_id is null and is_active;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(is_active);
create index if not exists equipments_process_idx on public.equipments(process_id);
create index if not exists equipments_status_idx on public.equipments(status);
create index if not exists cip_cycles_operator_idx on public.cip_cycles(operator_id);
create index if not exists cip_cycles_process_idx on public.cip_cycles(process_id);
create index if not exists cip_cycles_equipment_idx on public.cip_cycles(equipment_id);
create index if not exists cip_cycles_started_at_idx on public.cip_cycles(started_at desc);
create index if not exists cip_cycles_status_idx on public.cip_cycles(status);
create index if not exists cip_cycles_result_idx on public.cip_cycles(result);
create index if not exists cip_parameters_cycle_idx on public.cip_parameters(cycle_id);
create index if not exists cip_parameters_parameter_recorded_idx on public.cip_parameters(parameter, recorded_at desc);
create index if not exists cip_alerts_status_idx on public.cip_alerts(status);
create index if not exists cip_alerts_cycle_idx on public.cip_alerts(cycle_id);
create index if not exists cip_anomalies_cycle_idx on public.cip_anomalies(cycle_id);
create index if not exists cip_instructions_process_idx on public.cip_instructions(process_id);
create index if not exists cip_instructions_equipment_idx on public.cip_instructions(equipment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
  select coalesce(public.current_profile_role() = 'engineer', false);
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'operator'::public.app_role)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
exception
  when invalid_text_representation then
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      'operator'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create or replace function public.validate_cycle_start()
returns trigger
language plpgsql
as $$
declare
  current_status public.equipment_status;
  checklist_ok boolean;
begin
  if new.status = 'in_progress' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if tg_op = 'INSERT' then
      raise exception 'Create CIP cycle as draft, validate checklist, then update status to in_progress.';
    end if;

    select status into current_status
    from public.equipments
    where id = new.equipment_id
    for update;

    if current_status in ('in_cleaning', 'out_of_service') then
      raise exception 'Equipment % is not available for CIP start. Current status: %', new.equipment_id, current_status;
    end if;

    select all_validated into checklist_ok
    from public.cip_checklists
    where cycle_id = new.id;

    if coalesce(checklist_ok, false) is false then
      raise exception 'Checklist must be fully validated before starting CIP cycle %', new.id;
    end if;
  end if;

  if new.ended_at is not null then
    new.duration_minutes = greatest(0, floor(extract(epoch from (new.ended_at - new.started_at)) / 60)::integer);
  else
    new.duration_minutes = null;
  end if;

  return new;
end;
$$;

create or replace function public.update_equipment_status_from_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'in_progress' then
    update public.equipments
    set status = 'in_cleaning', updated_at = now()
    where id = new.equipment_id;
  elsif new.status = 'completed' and new.result = 'compliant' then
    update public.equipments
    set status = 'cleaned', updated_at = now()
    where id = new.equipment_id;
  elsif new.status = 'completed' and new.result = 'non_compliant' then
    update public.equipments
    set status = 'not_cleaned', updated_at = now()
    where id = new.equipment_id;
  elsif new.status = 'cancelled' then
    update public.equipments
    set status = 'available', updated_at = now()
    where id = new.equipment_id and status = 'in_cleaning';
  end if;

  return new;
end;
$$;

create or replace function public.create_alert_for_out_of_range_parameter()
returns trigger
language plpgsql
as $$
declare
  cycle_record public.cip_cycles%rowtype;
  limit_record public.equipment_reference_limits%rowtype;
  new_alert_id uuid;
  is_out_of_range boolean;
begin
  select * into cycle_record
  from public.cip_cycles
  where id = new.cycle_id;

  if not found then
    return new;
  end if;

  select *
  into limit_record
  from public.equipment_reference_limits
  where is_active
    and parameter = new.parameter
    and (
      equipment_id = cycle_record.equipment_id
      or (equipment_id is null and process_id = cycle_record.process_id)
    )
  order by case when equipment_id = cycle_record.equipment_id then 0 else 1 end
  limit 1;

  if not found then
    return new;
  end if;

  is_out_of_range =
    (limit_record.min_value is not null and new.value < limit_record.min_value)
    or (limit_record.max_value is not null and new.value > limit_record.max_value);

  if is_out_of_range then
    insert into public.cip_alerts (
      cycle_id,
      operator_id,
      equipment_id,
      severity,
      title,
      message
    )
    values (
      new.cycle_id,
      cycle_record.operator_id,
      cycle_record.equipment_id,
      'warning',
      'Parametre CIP hors limite',
      format(
        'Le parametre %s vaut %s %s, hors limites configurees [%s, %s].',
        new.parameter,
        new.value,
        coalesce(new.unit, ''),
        coalesce(limit_record.min_value::text, '-inf'),
        coalesce(limit_record.max_value::text, '+inf')
      )
    )
    returning id into new_alert_id;

    insert into public.cip_anomalies (
      cycle_id,
      alert_id,
      parameter,
      measured_value,
      min_limit,
      max_limit,
      action,
      observation
    )
    values (
      new.cycle_id,
      new_alert_id,
      new.parameter,
      new.value,
      limit_record.min_value,
      limit_record.max_value,
      'observation_only',
      'Anomalie generee automatiquement par comparaison aux seuils de reference.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_processes_updated_at on public.processes;
create trigger set_processes_updated_at
before update on public.processes
for each row execute function public.set_updated_at();

drop trigger if exists set_equipments_updated_at on public.equipments;
create trigger set_equipments_updated_at
before update on public.equipments
for each row execute function public.set_updated_at();

drop trigger if exists set_cip_cycles_updated_at on public.cip_cycles;
create trigger set_cip_cycles_updated_at
before update on public.cip_cycles
for each row execute function public.set_updated_at();

drop trigger if exists set_cip_checklists_updated_at on public.cip_checklists;
create trigger set_cip_checklists_updated_at
before update on public.cip_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_reference_limits_updated_at on public.equipment_reference_limits;
create trigger set_reference_limits_updated_at
before update on public.equipment_reference_limits
for each row execute function public.set_updated_at();

drop trigger if exists set_cip_instructions_updated_at on public.cip_instructions;
create trigger set_cip_instructions_updated_at
before update on public.cip_instructions
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

drop trigger if exists validate_cycle_start_trigger on public.cip_cycles;
create trigger validate_cycle_start_trigger
before insert or update on public.cip_cycles
for each row execute function public.validate_cycle_start();

drop trigger if exists update_equipment_status_from_cycle_trigger on public.cip_cycles;
create trigger update_equipment_status_from_cycle_trigger
after insert or update of status, result on public.cip_cycles
for each row execute function public.update_equipment_status_from_cycle();

drop trigger if exists create_alert_for_out_of_range_parameter_trigger on public.cip_parameters;
create trigger create_alert_for_out_of_range_parameter_trigger
after insert or update of value, parameter on public.cip_parameters
for each row execute function public.create_alert_for_out_of_range_parameter();

alter table public.profiles enable row level security;
alter table public.processes enable row level security;
alter table public.equipments enable row level security;
alter table public.cip_cycles enable row level security;
alter table public.cip_checklists enable row level security;
alter table public.cip_parameters enable row level security;
alter table public.equipment_reference_limits enable row level security;
alter table public.cip_alerts enable row level security;
alter table public.cip_anomalies enable row level security;
alter table public.cip_instructions enable row level security;

drop policy if exists "Profiles are readable by owner or engineers" on public.profiles;
create policy "Profiles are readable by owner or engineers"
on public.profiles for select
using (id = auth.uid() or public.is_engineer());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid() or public.is_engineer())
with check (id = auth.uid() or public.is_engineer());

drop policy if exists "Engineers can manage profiles" on public.profiles;
create policy "Engineers can manage profiles"
on public.profiles for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Active processes are readable by authenticated users" on public.processes;
create policy "Active processes are readable by authenticated users"
on public.processes for select
to authenticated
using (is_active or public.is_engineer());

drop policy if exists "Engineers can manage processes" on public.processes;
create policy "Engineers can manage processes"
on public.processes for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Active equipments are readable by authenticated users" on public.equipments;
create policy "Active equipments are readable by authenticated users"
on public.equipments for select
to authenticated
using (is_active or public.is_engineer());

drop policy if exists "Engineers can manage equipments" on public.equipments;
create policy "Engineers can manage equipments"
on public.equipments for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Users can read own cycles and engineers read all" on public.cip_cycles;
create policy "Users can read own cycles and engineers read all"
on public.cip_cycles for select
using (operator_id = auth.uid() or public.is_engineer());

drop policy if exists "Users can create own cycles" on public.cip_cycles;
create policy "Users can create own cycles"
on public.cip_cycles for insert
with check (operator_id = auth.uid() or public.is_engineer());

drop policy if exists "Users can update own cycles and engineers update all" on public.cip_cycles;
create policy "Users can update own cycles and engineers update all"
on public.cip_cycles for update
using (operator_id = auth.uid() or public.is_engineer())
with check (operator_id = auth.uid() or public.is_engineer());

drop policy if exists "Engineers can delete cycles" on public.cip_cycles;
create policy "Engineers can delete cycles"
on public.cip_cycles for delete
using (public.is_engineer());

drop policy if exists "Cycle checklist follows cycle access" on public.cip_checklists;
create policy "Cycle checklist follows cycle access"
on public.cip_checklists for all
using (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
)
with check (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
);

drop policy if exists "Cycle parameters follow cycle access" on public.cip_parameters;
create policy "Cycle parameters follow cycle access"
on public.cip_parameters for all
using (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
)
with check (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
);

drop policy if exists "Reference limits readable by authenticated users" on public.equipment_reference_limits;
create policy "Reference limits readable by authenticated users"
on public.equipment_reference_limits for select
to authenticated
using (is_active or public.is_engineer());

drop policy if exists "Engineers can manage reference limits" on public.equipment_reference_limits;
create policy "Engineers can manage reference limits"
on public.equipment_reference_limits for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Alerts follow user cycles or engineers" on public.cip_alerts;
create policy "Alerts follow user cycles or engineers"
on public.cip_alerts for select
using (
  operator_id = auth.uid()
  or public.is_engineer()
  or exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id and c.operator_id = auth.uid()
  )
);

drop policy if exists "Engineers can manage alerts" on public.cip_alerts;
create policy "Engineers can manage alerts"
on public.cip_alerts for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Anomalies follow cycle access" on public.cip_anomalies;
create policy "Anomalies follow cycle access"
on public.cip_anomalies for select
using (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
);

drop policy if exists "Users can create anomalies for own cycles" on public.cip_anomalies;
create policy "Users can create anomalies for own cycles"
on public.cip_anomalies for insert
with check (
  exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and (c.operator_id = auth.uid() or public.is_engineer())
  )
);

drop policy if exists "Engineers can manage anomalies" on public.cip_anomalies;
create policy "Engineers can manage anomalies"
on public.cip_anomalies for all
using (public.is_engineer())
with check (public.is_engineer());

drop policy if exists "Active instructions are readable by authenticated users" on public.cip_instructions;
create policy "Active instructions are readable by authenticated users"
on public.cip_instructions for select
to authenticated
using (is_active or public.is_engineer());

drop policy if exists "Engineers can manage instructions" on public.cip_instructions;
create policy "Engineers can manage instructions"
on public.cip_instructions for all
using (public.is_engineer())
with check (public.is_engineer());
