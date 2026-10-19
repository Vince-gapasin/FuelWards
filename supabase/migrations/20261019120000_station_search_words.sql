-- Multi-word search: every word must match the name, brand, street or city, in any order.
-- "Shell Aurora" now finds Shell stations on Aurora Boulevard.
create or replace function public.search_stations(
  query text,
  lat double precision,
  lng double precision
)
returns table (
  id uuid,
  name text,
  brand text,
  brand_color text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  prices jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  ),
  -- Typed % and _ are literal characters, not wildcards.
  words as (
    select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
    from unnest(regexp_split_to_array(trim(query), '\s+')) as w
    where w <> ''
  )
  select
    s.id,
    s.name,
    b.name as brand,
    b.color as brand_color,
    s.address,
    extensions.st_y(s.location::extensions.geometry) as latitude,
    extensions.st_x(s.location::extensions.geometry) as longitude,
    extensions.st_distance(s.location, o.g) as distance_m,
    coalesce(
      (select jsonb_object_agg(p.fuel_type, jsonb_build_object('price', p.price, 'reported_at', p.reported_at))
       from public.station_latest_prices p
       where p.station_id = s.id),
      '{}'::jsonb
    ) as prices
  from public.stations s
  cross join origin o
  left join public.brands b on b.id = s.brand_id
  where s.is_active
    and char_length(trim(query)) >= 2
    and not exists (
      select 1 from words w
      where not (
        s.name ilike w.p
        or coalesce(s.address, '') ilike w.p
        or coalesce(s.city, '') ilike w.p
        or coalesce(b.name, '') ilike w.p
      )
    )
  order by distance_m
  limit 20;
$$;
