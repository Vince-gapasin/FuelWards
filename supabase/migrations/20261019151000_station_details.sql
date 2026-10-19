-- One station with its brand and coordinates, for the station detail and report screens.
create or replace function public.station_details(p_station_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  address text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.name,
    b.name,
    s.address,
    extensions.st_y(s.location::extensions.geometry),
    extensions.st_x(s.location::extensions.geometry)
  from public.stations s
  left join public.brands b on b.id = s.brand_id
  where s.id = p_station_id;
$$;

grant execute on function public.station_details(uuid) to anon, authenticated;
