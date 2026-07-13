do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'equipment_status'
      and e.enumlabel = 'in_cleaning'
  )
  and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'equipment_status'
      and e.enumlabel = 'cleaning'
  ) then
    alter type public.equipment_status rename value 'in_cleaning' to 'cleaning';
  end if;
end $$;

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

    if current_status in ('cleaning', 'out_of_service') then
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
  elsif new.status = 'cancelled' then
    update public.equipments
    set status = 'available', updated_at = now()
    where id = new.equipment_id and status = 'cleaning';
  end if;

  return new;
end;
$$;
