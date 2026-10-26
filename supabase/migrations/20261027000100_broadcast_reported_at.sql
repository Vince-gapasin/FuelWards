-- Live prices: include when the price was reported, so apps only replace a price with a newer one
-- (an older report confirmed late must not overwrite a fresher price).
create or replace function public.price_broadcast_payload(r public.price_reports)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'station_id', r.station_id,
    'fuel_type', r.fuel_type,
    'price', r.price,
    'reported_at', r.reported_at,
    'verified_at', r.verified_at
  );
$$;
