alter table public.cip_anomalies
  add column if not exists unit text;

create unique index if not exists cip_cycles_one_running_per_equipment_idx
  on public.cip_cycles (equipment_id)
  where status = 'in_progress';

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

    if exists (
      select 1
      from public.cip_cycles c
      where c.equipment_id = new.equipment_id
        and c.status = 'in_progress'
        and c.id <> new.id
    ) then
      raise exception 'Equipment % already has a running CIP cycle.', new.equipment_id;
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
      unit,
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
      coalesce(new.unit, limit_record.unit),
      'observation_only',
      'Anomalie generee automatiquement par comparaison aux seuils de reference.'
    );
  end if;

  return new;
end;
$$;
