alter table public.cip_alerts
  add column if not exists resolution_comment text;

create index if not exists cip_alerts_resolved_at_idx
  on public.cip_alerts (resolved_at desc)
  where resolved_at is not null;
