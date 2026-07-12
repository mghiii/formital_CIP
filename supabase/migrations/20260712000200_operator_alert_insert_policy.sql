drop policy if exists "Users can create alerts for own cycles" on public.cip_alerts;
create policy "Users can create alerts for own cycles"
on public.cip_alerts for insert
to authenticated
with check (
  exists (
    select 1
    from public.cip_cycles c
    where c.id = cycle_id
      and c.operator_id = auth.uid()
  )
);
