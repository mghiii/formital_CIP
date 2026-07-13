alter table public.cip_cycles
  alter column operator_id drop not null,
  add column if not exists planned_start_time timestamptz,
  add column if not exists planned_duration_minutes integer,
  add column if not exists planned_by uuid references public.profiles(id) on delete set null,
  add column if not exists priority text not null default 'normal',
  add column if not exists instructions text;

update public.cip_cycles
set planned_start_time = coalesce(planned_start_time, started_at),
    planned_duration_minutes = coalesce(planned_duration_minutes, duration_minutes, 45),
    status = case when status = 'draft' then 'planned'::public.cip_cycle_status else status end
where status in ('draft', 'planned', 'ready');

alter table public.cip_cycles
  drop constraint if exists cip_cycles_planned_duration_positive_chk,
  add constraint cip_cycles_planned_duration_positive_chk
    check (planned_duration_minutes is null or planned_duration_minutes > 0) not valid;

drop index if exists cip_cycles_one_running_per_equipment_idx;
create unique index if not exists cip_cycles_one_running_per_equipment_idx
  on public.cip_cycles (equipment_id)
  where status in ('in_progress', 'running');

create index if not exists cip_cycles_planned_start_time_idx
  on public.cip_cycles(planned_start_time desc)
  where status in ('planned', 'ready');

comment on column public.cip_cycles.planned_start_time is
  'Date et heure planifiees du cycle CIP. Le cycle devient lancable 30 minutes avant cette heure, sauf force start engineer/admin.';

comment on column public.cip_cycles.planned_duration_minutes is
  'Duree cible du cycle planifiee par l ingenieur ou par le lancement direct.';

create or replace function public.ensure_cip_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cip_checklists (cycle_id)
  values (new.id)
  on conflict (cycle_id) do nothing;

  return new;
end;
$$;

insert into public.cip_checklists (cycle_id)
select c.id
from public.cip_cycles c
left join public.cip_checklists cl on cl.cycle_id = c.id
where cl.id is null
  and c.status in ('draft', 'planned', 'ready', 'in_progress', 'running');

drop trigger if exists ensure_cip_checklist_trigger on public.cip_cycles;
create trigger ensure_cip_checklist_trigger
after insert on public.cip_cycles
for each row execute function public.ensure_cip_checklist();

create or replace function public.validate_cycle_start()
returns trigger
language plpgsql
as $$
declare
  current_status public.equipment_status;
  checklist_ok boolean;
  old_status text;
  new_status text;
begin
  old_status = case when tg_op = 'INSERT' then null else old.status::text end;
  new_status = new.status::text;

  if tg_op = 'INSERT' and new_status not in ('draft', 'planned', 'ready') then
    raise exception 'Create CIP cycle as planned, validate checklist, then start it through start_planned_cip_cycle.';
  end if;

  if tg_op = 'UPDATE' and old_status is distinct from new_status then
    if old_status = 'draft' and new_status not in ('planned', 'ready', 'cancelled') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    elsif old_status = 'planned' and new_status not in ('ready', 'running', 'cancelled') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    elsif old_status = 'ready' and new_status not in ('running', 'cancelled') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    elsif old_status in ('in_progress', 'running') and new_status not in ('completed', 'failed', 'cancelled') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    elsif old_status = 'failed' and new_status not in ('planned', 'ready') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    elsif old_status in ('completed', 'cancelled') then
      raise exception 'Closed CIP cycles cannot change status from % to %.', old_status, new_status;
    elsif old_status not in ('draft', 'planned', 'ready', 'in_progress', 'running', 'failed', 'completed', 'cancelled') then
      raise exception 'Invalid CIP cycle status transition from % to %.', old_status, new_status;
    end if;
  end if;

  if new_status in ('in_progress', 'running') and (tg_op = 'INSERT' or old_status is distinct from new_status) then
    if exists (
      select 1
      from public.cip_cycles c
      where c.equipment_id = new.equipment_id
        and c.status in ('in_progress', 'running')
        and c.id <> new.id
    ) then
      raise exception 'Equipment % already has a running CIP cycle.', new.equipment_id;
    end if;

    select status into current_status
    from public.equipments
    where id = new.equipment_id
    for update;

    if current_status::text in ('cleaning', 'in_cleaning', 'out_of_service') then
      raise exception 'Equipment % is not available for CIP start. Current status: %', new.equipment_id, current_status;
    end if;

    select all_validated into checklist_ok
    from public.cip_checklists
    where cycle_id = new.id;

    if coalesce(checklist_ok, false) is false then
      raise exception 'Checklist must be fully validated before starting CIP cycle %', new.id;
    end if;

    new.started_at = coalesce(new.started_at, now());
  end if;

  if new_status = 'completed' then
    if old_status not in ('in_progress', 'running') and tg_op = 'UPDATE' then
      raise exception 'Only a running CIP cycle can be completed.';
    end if;
  elsif new_status = 'failed' then
    if old_status not in ('in_progress', 'running') and tg_op = 'UPDATE' then
      raise exception 'Only a running CIP cycle can fail.';
    end if;
  end if;

  if new.ended_at is not null then
    new.duration_minutes = greatest(0, floor(extract(epoch from (new.ended_at - new.started_at)) / 60)::integer);
  elsif new_status in ('completed', 'failed') and new.duration_minutes is null then
    new.duration_minutes = 0;
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
  if new.status::text in ('in_progress', 'running') then
    update public.equipments
    set status = 'cleaning', updated_at = now()
    where id = new.equipment_id;
  elsif new.status = 'completed' and new.result = 'compliant' then
    update public.equipments
    set status = 'cleaned', updated_at = now()
    where id = new.equipment_id;
  elsif new.status = 'completed' and new.result = 'non_compliant' then
    update public.equipments
    set status = 'not_cleaned', updated_at = now()
    where id = new.equipment_id;
  elsif new.status::text in ('failed', 'cancelled') then
    update public.equipments
    set status = case when new.status::text = 'failed' then 'not_cleaned'::public.equipment_status else 'available'::public.equipment_status end,
        updated_at = now()
    where id = new.equipment_id
      and status = 'cleaning';
  end if;

  return new;
end;
$$;

create or replace function public.start_planned_cip_cycle(p_cycle_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  cycle_row public.cip_cycles%rowtype;
  equipment_row public.equipments%rowtype;
  checklist_ok boolean;
  planned_at timestamptz;
  can_force boolean;
  launch_window interval := interval '30 minutes';
begin
  if actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Session introuvable.');
  end if;

  select role into actor_role
  from public.profiles
  where id = actor_id
    and is_active
  for update;

  if actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Profil utilisateur introuvable ou inactif.');
  end if;

  if actor_role not in ('operator', 'engineer', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Role non autorise pour demarrer un cycle CIP.');
  end if;

  select * into cycle_row
  from public.cip_cycles
  where id = p_cycle_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CYCLE_NOT_FOUND', 'message', 'Cycle CIP introuvable.');
  end if;

  if cycle_row.status::text in ('in_progress', 'running') then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'message', 'Ce cycle est deja en cours.');
  end if;

  if cycle_row.status::text not in ('draft', 'planned', 'ready') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CYCLE_STATUS', 'message', 'Ce cycle ne peut plus etre demarre.');
  end if;

  select * into equipment_row
  from public.equipments
  where id = cycle_row.equipment_id
  for update;

  if not found or equipment_row.is_active is false then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_NOT_FOUND', 'message', 'Machine introuvable ou inactive.');
  end if;

  if equipment_row.status::text = 'out_of_service' then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_OUT_OF_SERVICE', 'message', 'Cette machine est hors service.');
  end if;

  if equipment_row.status::text in ('cleaning', 'in_cleaning') then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Cette machine est deja en cours de nettoyage.');
  end if;

  if equipment_row.process_id <> cycle_row.process_id then
    return jsonb_build_object('ok', false, 'code', 'PROCESS_EQUIPMENT_MISMATCH', 'message', 'Le programme CIP ne correspond pas a la machine selectionnee.');
  end if;

  if exists (
    select 1
    from public.cip_cycles c
    where c.equipment_id = cycle_row.equipment_id
      and c.status in ('in_progress', 'running')
      and c.id <> cycle_row.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Un autre cycle est deja en cours sur cette machine.');
  end if;

  if actor_role = 'operator' and cycle_row.operator_id is not null and cycle_row.operator_id <> actor_id then
    return jsonb_build_object('ok', false, 'code', 'CYCLE_ASSIGNED_TO_ANOTHER_OPERATOR', 'message', 'Ce cycle est assigne a un autre operateur.');
  end if;

  select all_validated into checklist_ok
  from public.cip_checklists
  where cycle_id = cycle_row.id
  for update;

  if coalesce(checklist_ok, false) is false then
    return jsonb_build_object('ok', false, 'code', 'CHECKLIST_INCOMPLETE', 'message', 'La checklist doit etre entierement validee.');
  end if;

  planned_at = coalesce(cycle_row.planned_start_time, cycle_row.started_at, now());
  can_force = actor_role in ('engineer', 'admin') and p_force is true;

  if can_force is false and now() < planned_at - launch_window then
    return jsonb_build_object(
      'ok', false,
      'code', 'START_WINDOW_NOT_OPEN',
      'message', 'Le cycle n est pas encore disponible au demarrage.',
      'details', jsonb_build_object('planned_start_time', planned_at, 'launch_window_minutes', 30)
    );
  end if;

  update public.cip_cycles
  set operator_id = coalesce(cycle_row.operator_id, actor_id),
      status = 'running',
      started_at = now(),
      planned_start_time = planned_at,
      planned_duration_minutes = coalesce(cycle_row.planned_duration_minutes, 45),
      updated_at = now()
  where id = cycle_row.id
    and status in ('draft', 'planned', 'ready')
  returning * into cycle_row;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'message', 'Ce cycle a deja ete demarre.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'CYCLE_STARTED',
    'message', 'Cycle CIP demarre.',
    'cycle_id', cycle_row.id,
    'operator_id', cycle_row.operator_id,
    'status', cycle_row.status::text
  );
end;
$$;

grant execute on function public.start_planned_cip_cycle(uuid, boolean) to authenticated;

drop policy if exists "Operators can read planned cycles" on public.cip_cycles;
drop policy if exists "Operators can read planned claimable cycles" on public.cip_cycles;
create policy "Operators can read planned claimable cycles"
on public.cip_cycles for select
to authenticated
using (
  public.current_profile_role() = 'operator'
  and status in ('draft', 'planned', 'ready')
  and (operator_id is null or operator_id = auth.uid())
);

drop policy if exists "Operators can claim planned cycles" on public.cip_cycles;
create policy "Operators can claim planned cycles"
on public.cip_cycles for update
to authenticated
using (
  public.current_profile_role() = 'operator'
  and status in ('draft', 'planned', 'ready', 'in_progress', 'running')
  and (operator_id is null or operator_id = auth.uid())
)
with check (
  public.current_profile_role() = 'operator'
  and operator_id = auth.uid()
  and status in ('draft', 'planned', 'ready', 'in_progress', 'running', 'completed', 'failed')
);

drop policy if exists "Operators can validate planned cycle checklists" on public.cip_checklists;
create policy "Operators can validate planned cycle checklists"
on public.cip_checklists for all
to authenticated
using (
  public.current_profile_role() = 'operator'
  and exists (
    select 1
    from public.cip_cycles c
    where c.id = cycle_id
      and c.status in ('draft', 'planned', 'ready', 'in_progress', 'running')
      and (c.operator_id is null or c.operator_id = auth.uid())
  )
)
with check (
  public.current_profile_role() = 'operator'
  and exists (
    select 1
    from public.cip_cycles c
    where c.id = cycle_id
      and c.status in ('draft', 'planned', 'ready', 'in_progress', 'running')
      and (c.operator_id is null or c.operator_id = auth.uid())
  )
);
