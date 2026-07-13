alter type public.cip_cycle_status add value if not exists 'planned';
alter type public.cip_cycle_status add value if not exists 'ready';
alter type public.cip_cycle_status add value if not exists 'running';
alter type public.cip_cycle_status add value if not exists 'failed';
