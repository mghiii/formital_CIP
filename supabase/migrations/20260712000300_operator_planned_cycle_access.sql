drop policy if exists "Operators can read planned cycles" on public.cip_cycles;
create policy "Operators can read planned cycles"
on public.cip_cycles for select
to authenticated
using (
  status = 'draft'
  and public.current_profile_role() = 'operator'
);

drop policy if exists "Operators can claim planned cycles" on public.cip_cycles;
create policy "Operators can claim planned cycles"
on public.cip_cycles for update
to authenticated
using (
  status = 'draft'
  and public.current_profile_role() = 'operator'
)
with check (
  operator_id = auth.uid()
  and status in ('draft', 'in_progress')
  and public.current_profile_role() = 'operator'
);

drop policy if exists "Operators can validate planned cycle checklists" on public.cip_checklists;
create policy "Operators can validate planned cycle checklists"
on public.cip_checklists for all
to authenticated
using (
  public.current_profile_role() = 'operator'
  and exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and c.status in ('draft', 'in_progress')
  )
)
with check (
  public.current_profile_role() = 'operator'
  and exists (
    select 1 from public.cip_cycles c
    where c.id = cycle_id
      and c.status in ('draft', 'in_progress')
  )
);
