alter table public.cip_cycles
  add column if not exists started_by uuid references public.profiles(id) on delete set null;

create index if not exists cip_cycles_started_by_idx
  on public.cip_cycles(started_by);

drop index if exists cip_cycles_one_running_per_equipment_idx;
create unique index if not exists cip_cycles_one_running_per_equipment_idx
  on public.cip_cycles (equipment_id)
  where status in ('in_progress', 'running');

create or replace function public.create_cip_cycle(
  p_equipment_id uuid,
  p_operator_id uuid default null,
  p_planned_start_time timestamptz default null,
  p_planned_duration_minutes integer default 45,
  p_priority text default 'normal',
  p_instructions text default null,
  p_observation text default null,
  p_status text default 'planned',
  p_valves_open boolean default false,
  p_cleaning_product_available boolean default false,
  p_tank_empty boolean default false,
  p_circuit_selected boolean default false,
  p_safety_conditions_checked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  assigned_operator_id uuid;
  operator_row public.profiles%rowtype;
  equipment_row public.equipments%rowtype;
  cycle_row public.cip_cycles%rowtype;
  planned_at timestamptz := coalesce(p_planned_start_time, now());
  duration_minutes integer := coalesce(p_planned_duration_minutes, 45);
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'planned');
begin
  if actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'message', 'Session utilisateur introuvable.');
  end if;

  select role into actor_role
  from public.profiles
  where id = actor_id
    and is_active
    and coalesce(status, 'active') = 'active'
  for update;

  if actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND', 'message', 'Profil utilisateur introuvable ou inactif.');
  end if;

  if actor_role not in ('operator', 'engineer', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN_ROLE', 'message', 'Ce role ne peut pas creer un cycle CIP.');
  end if;

  if normalized_status not in ('draft', 'planned', 'ready') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CYCLE_STATUS', 'message', 'Le cycle doit etre cree en brouillon, planifie ou pret.');
  end if;

  if duration_minutes <= 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DURATION', 'message', 'La duree cible du cycle doit etre superieure a zero minute.');
  end if;

  select * into equipment_row
  from public.equipments
  where id = p_equipment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_NOT_FOUND', 'message', 'Machine introuvable.');
  end if;

  if equipment_row.is_active is false then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_INACTIVE', 'message', 'Cette machine est inactive.');
  end if;

  if equipment_row.process_id is null then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_PROCESS_MISSING', 'message', 'Cette machine n est rattachee a aucun programme CIP.');
  end if;

  if equipment_row.status::text = 'out_of_service' then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_OUT_OF_SERVICE', 'message', 'Cette machine est hors service.');
  end if;

  if equipment_row.status::text in ('cleaning', 'in_cleaning') then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Cette machine est deja en nettoyage.');
  end if;

  if exists (
    select 1
    from public.cip_cycles c
    where c.equipment_id = equipment_row.id
      and c.status in ('in_progress', 'running')
  ) then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Un cycle CIP est deja en cours sur cette machine.');
  end if;

  assigned_operator_id = case when actor_role = 'operator' then actor_id else p_operator_id end;

  if actor_role = 'operator' and p_operator_id is not null and p_operator_id <> actor_id then
    return jsonb_build_object('ok', false, 'code', 'CYCLE_ASSIGNED_TO_ANOTHER_OPERATOR', 'message', 'Un operateur ne peut creer que ses propres cycles.');
  end if;

  if assigned_operator_id is not null then
    select * into operator_row
    from public.profiles
    where id = assigned_operator_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'OPERATOR_NOT_FOUND', 'message', 'Operateur introuvable.');
    end if;

    if operator_row.role <> 'operator' then
      return jsonb_build_object('ok', false, 'code', 'OPERATOR_ROLE_INVALID', 'message', 'Le profil affecte n est pas un operateur.');
    end if;

    if operator_row.is_active is false or coalesce(operator_row.status, 'active') <> 'active' then
      return jsonb_build_object('ok', false, 'code', 'OPERATOR_INACTIVE', 'message', 'L operateur affecte est inactif.');
    end if;
  end if;

  insert into public.cip_cycles (
    operator_id,
    equipment_id,
    process_id,
    status,
    started_at,
    planned_start_time,
    planned_duration_minutes,
    planned_by,
    priority,
    instructions,
    observation
  )
  values (
    assigned_operator_id,
    equipment_row.id,
    equipment_row.process_id,
    normalized_status::public.cip_cycle_status,
    planned_at,
    planned_at,
    duration_minutes,
    actor_id,
    coalesce(nullif(trim(p_priority), ''), 'normal'),
    nullif(trim(coalesce(p_instructions, '')), ''),
    nullif(trim(coalesce(p_observation, '')), '')
  )
  returning * into cycle_row;

  insert into public.cip_checklists (
    cycle_id,
    valves_open,
    cleaning_product_available,
    tank_empty,
    circuit_selected,
    safety_conditions_checked,
    validated_at
  )
  values (
    cycle_row.id,
    coalesce(p_valves_open, false),
    coalesce(p_cleaning_product_available, false),
    coalesce(p_tank_empty, false),
    coalesce(p_circuit_selected, false),
    coalesce(p_safety_conditions_checked, false),
    case
      when coalesce(p_valves_open, false)
        and coalesce(p_cleaning_product_available, false)
        and coalesce(p_tank_empty, false)
        and coalesce(p_circuit_selected, false)
        and coalesce(p_safety_conditions_checked, false)
      then now()
      else null
    end
  )
  on conflict (cycle_id) do update
  set valves_open = excluded.valves_open,
      cleaning_product_available = excluded.cleaning_product_available,
      tank_empty = excluded.tank_empty,
      circuit_selected = excluded.circuit_selected,
      safety_conditions_checked = excluded.safety_conditions_checked,
      validated_at = excluded.validated_at,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'code', 'CYCLE_CREATED',
    'message', 'Cycle CIP cree.',
    'cycle_id', cycle_row.id,
    'operator_id', cycle_row.operator_id,
    'status', cycle_row.status::text,
    'cycle', to_jsonb(cycle_row)
  );
end;
$$;

grant execute on function public.create_cip_cycle(
  uuid,
  uuid,
  timestamptz,
  integer,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

create or replace function public.start_cip_cycle(p_cycle_id uuid, p_force boolean default false)
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
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'message', 'Session utilisateur introuvable.');
  end if;

  select role into actor_role
  from public.profiles
  where id = actor_id
    and is_active
    and coalesce(status, 'active') = 'active'
  for update;

  if actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND', 'message', 'Profil utilisateur introuvable ou inactif.');
  end if;

  if actor_role not in ('operator', 'engineer', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN_ROLE', 'message', 'Ce role ne peut pas demarrer un cycle CIP.');
  end if;

  select * into cycle_row
  from public.cip_cycles
  where id = p_cycle_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CYCLE_NOT_FOUND', 'message', 'Cycle CIP introuvable.');
  end if;

  if cycle_row.status::text in ('in_progress', 'running') then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'message', 'Ce cycle CIP est deja en cours.');
  end if;

  if cycle_row.status::text not in ('draft', 'planned', 'ready', 'pending', 'scheduled') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CYCLE_STATUS', 'message', 'Ce cycle CIP n est pas dans un statut lancable.');
  end if;

  select * into equipment_row
  from public.equipments
  where id = cycle_row.equipment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_NOT_FOUND', 'message', 'Machine introuvable.');
  end if;

  if equipment_row.is_active is false then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_INACTIVE', 'message', 'Cette machine est inactive.');
  end if;

  if equipment_row.status::text = 'out_of_service' then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_OUT_OF_SERVICE', 'message', 'Cette machine est hors service.');
  end if;

  if equipment_row.status::text in ('cleaning', 'in_cleaning') then
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Cette machine est deja en nettoyage.');
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
    return jsonb_build_object('ok', false, 'code', 'EQUIPMENT_BUSY', 'message', 'Un autre cycle CIP est deja en cours sur cette machine.');
  end if;

  if actor_role = 'operator' and cycle_row.operator_id is not null and cycle_row.operator_id <> actor_id then
    return jsonb_build_object('ok', false, 'code', 'CYCLE_ASSIGNED_TO_ANOTHER_OPERATOR', 'message', 'Ce cycle CIP est assigne a un autre operateur.');
  end if;

  select all_validated into checklist_ok
  from public.cip_checklists
  where cycle_id = cycle_row.id
  for update;

  if checklist_ok is null then
    return jsonb_build_object('ok', false, 'code', 'CHECKLIST_NOT_FOUND', 'message', 'La checklist de ce cycle est introuvable.');
  end if;

  if checklist_ok is false then
    return jsonb_build_object('ok', false, 'code', 'CHECKLIST_INCOMPLETE', 'message', 'La checklist doit etre entierement validee.');
  end if;

  planned_at = coalesce(cycle_row.planned_start_time, cycle_row.started_at, now());
  can_force = actor_role in ('engineer', 'admin') and p_force is true;

  if can_force is false and now() < planned_at - launch_window then
    return jsonb_build_object(
      'ok', false,
      'code', 'START_WINDOW_NOT_OPEN',
      'message', 'Ce cycle CIP sera lancable 30 minutes avant son heure planifiee.',
      'details', jsonb_build_object('planned_start_time', planned_at, 'launch_window_minutes', 30)
    );
  end if;

  update public.cip_cycles
  set operator_id = case
        when actor_role = 'operator' then coalesce(cycle_row.operator_id, actor_id)
        else cycle_row.operator_id
      end,
      started_by = actor_id,
      status = 'running',
      started_at = now(),
      planned_start_time = planned_at,
      planned_duration_minutes = coalesce(cycle_row.planned_duration_minutes, 45),
      updated_at = now()
  where id = cycle_row.id
    and status::text in ('draft', 'planned', 'ready', 'pending', 'scheduled')
  returning * into cycle_row;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'message', 'Ce cycle CIP a deja ete demarre par un autre utilisateur.');
  end if;

  update public.equipments
  set status = 'cleaning',
      updated_at = now()
  where id = cycle_row.equipment_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'CYCLE_STARTED',
    'message', 'Cycle CIP demarre.',
    'cycle_id', cycle_row.id,
    'operator_id', cycle_row.operator_id,
    'started_by', cycle_row.started_by,
    'status', cycle_row.status::text,
    'cycle', to_jsonb(cycle_row)
  );
end;
$$;

grant execute on function public.start_cip_cycle(uuid, boolean) to authenticated;

create or replace function public.start_planned_cip_cycle(p_cycle_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.start_cip_cycle(p_cycle_id, p_force);
end;
$$;

grant execute on function public.start_planned_cip_cycle(uuid, boolean) to authenticated;

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
