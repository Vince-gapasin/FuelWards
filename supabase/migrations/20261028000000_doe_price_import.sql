-- DOE prevailing pump prices, imported automatically every week.
--
-- The DOE publishes no API. Each week its field offices post a PDF per area ("Price Monitoring of
-- Liquid Fuels") with, for every city and product, the overall price range and the common price.
-- A scheduled GitHub Actions job (scripts/doe/import_doe_prices.py) downloads new PDFs, reads the
-- tables and sends each region's rows to ingest_doe_prices(). That function only accepts a
-- dedicated import token, so the job never needs the database's secret key.
--
-- Stations get a region so the app can show the DOE prices that apply to them.

-- ---------------------------------------------------------------------------
-- Regions
-- ---------------------------------------------------------------------------
create table public.doe_regions (
  code text primary key,
  name text not null,
  sort smallint not null default 0
);

insert into public.doe_regions (code, name, sort) values
  ('NCR', 'Metro Manila', 1),
  ('III', 'Central Luzon', 2),
  ('IV-A', 'CALABARZON', 3),
  ('IV-B', 'MIMAROPA', 4),
  ('V', 'Bicol Region', 5);

alter table public.doe_regions enable row level security;
create policy "regions are readable" on public.doe_regions for select to anon, authenticated using (true);

alter table public.stations add column region text references public.doe_regions (code);
create index stations_region_idx on public.stations (region);
-- The first import covered Metro Manila only; the station import that follows sets real regions.
update public.stations set region = 'NCR' where region is null;

-- ---------------------------------------------------------------------------
-- Imported prices
-- ---------------------------------------------------------------------------
create table public.doe_price_imports (
  id bigint generated always as identity primary key,
  region text not null references public.doe_regions (code),
  week_start date not null,
  week_end date not null,
  source_url text not null,
  area_count integer not null,
  imported_at timestamptz not null default now(),
  unique (source_url, region),
  check (week_end >= week_start)
);
create index doe_price_imports_region_week_idx on public.doe_price_imports (region, week_start desc);

create table public.doe_area_prices (
  week_start date not null,
  region text not null references public.doe_regions (code),
  area text not null,
  fuel_type text not null references public.fuel_types (code),
  price_min numeric(6, 2) not null,
  price_max numeric(6, 2) not null,
  common_price numeric(6, 2),
  primary key (week_start, region, area, fuel_type),
  check (price_min <= price_max)
);

-- Public government data, so anyone may read it. Only ingest_doe_prices() writes.
alter table public.doe_price_imports enable row level security;
alter table public.doe_area_prices enable row level security;
create policy "doe imports are readable" on public.doe_price_imports
  for select to anon, authenticated using (true);
create policy "doe prices are readable" on public.doe_area_prices
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.doe_price_imports, public.doe_area_prices from anon, authenticated;

-- Tokens for scheduled jobs. Only a SHA-256 hash is stored; clients can't read this table.
create table public.ingest_tokens (
  name text primary key,
  token_hash bytea not null,
  created_at timestamptz not null default now()
);
alter table public.ingest_tokens enable row level security;
revoke all on public.ingest_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Import
-- ---------------------------------------------------------------------------
-- p_report: { region, week_start, week_end, source_url,
--             rows: [{ area, fuel_type, price_min, price_max, common_price }] }
-- Replaces that region's prices for the week, so re-running an import is harmless.
create or replace function public.ingest_doe_prices(p_token text, p_report jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_region text := p_report ->> 'region';
  v_start date := (p_report ->> 'week_start')::date;
  v_end date := (p_report ->> 'week_end')::date;
  v_source text := p_report ->> 'source_url';
  v_rows jsonb := p_report -> 'rows';
  v_count integer;
begin
  if p_token is null or not exists (
    select 1 from public.ingest_tokens
     where name = 'doe_prices'
       and token_hash = extensions.digest(p_token, 'sha256')
  ) then
    raise exception 'invalid_token' using errcode = '28000';
  end if;

  if not exists (select 1 from public.doe_regions where code = v_region) then
    raise exception 'unknown_region' using errcode = '22023';
  end if;
  if v_start is null or v_end is null or v_end < v_start or v_end - v_start > 13
     or v_end > (now() at time zone 'Asia/Manila')::date + 7 then
    raise exception 'bad_week' using errcode = '22023';
  end if;
  if v_source is null or v_source !~ '^https://' then
    raise exception 'bad_source' using errcode = '22023';
  end if;
  if jsonb_typeof(v_rows) is distinct from 'array' or jsonb_array_length(v_rows) = 0 then
    raise exception 'no_rows' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_rows) as i (area text, fuel_type text, price_min numeric, price_max numeric, common_price numeric)
     where trim(coalesce(i.area, '')) = ''
        or not exists (select 1 from public.fuel_types f where f.code = i.fuel_type)
        or i.price_min is null or i.price_max is null
        or i.price_min < 20 or i.price_max > 300 or i.price_min > i.price_max
        or (i.common_price is not null and (i.common_price < 20 or i.common_price > 300))
  ) then
    raise exception 'bad_rows' using errcode = '22023';
  end if;

  delete from public.doe_area_prices where week_start = v_start and region = v_region;
  insert into public.doe_area_prices (week_start, region, area, fuel_type, price_min, price_max, common_price)
  select distinct on (trim(i.area), i.fuel_type)
         v_start, v_region, trim(i.area), i.fuel_type, i.price_min, i.price_max, i.common_price
    from jsonb_to_recordset(v_rows) as i (area text, fuel_type text, price_min numeric, price_max numeric, common_price numeric)
   order by trim(i.area), i.fuel_type;
  get diagnostics v_count = row_count;

  insert into public.doe_price_imports (region, week_start, week_end, source_url, area_count)
  values (v_region, v_start, v_end, v_source,
          (select count(distinct trim(i.area))::int from jsonb_to_recordset(v_rows) as i (area text, fuel_type text, price_min numeric, price_max numeric, common_price numeric)))
  on conflict (source_url, region) do update
    set week_start = excluded.week_start,
        week_end = excluded.week_end,
        area_count = excluded.area_count,
        imported_at = now();

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
-- The latest week's DOE prices for a region, one row per fuel: the lowest and highest price seen
-- in any monitored city, and the typical price (median of the cities' common prices).
-- Weeks older than 4 weeks are not shown.
create or replace function public.doe_prices(p_region text)
returns table (
  region text,
  region_name text,
  week_start date,
  week_end date,
  fuel_type text,
  price_min numeric,
  price_max numeric,
  typical_price numeric,
  area_count integer,
  source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select i.week_start, max(i.week_end) as week_end, max(i.source_url) as source_url
      from public.doe_price_imports i
     where i.region = p_region
       and i.week_end >= (now() at time zone 'Asia/Manila')::date - 28
     group by i.week_start
     order by i.week_start desc
     limit 1
  )
  select r.code, r.name, l.week_start, l.week_end, p.fuel_type,
         min(p.price_min), max(p.price_max),
         round(percentile_cont(0.5) within group (
           order by coalesce(p.common_price, (p.price_min + p.price_max) / 2)
         )::numeric, 2),
         count(*)::int,
         l.source_url
    from latest l
    join public.doe_area_prices p on p.week_start = l.week_start and p.region = p_region
    join public.doe_regions r on r.code = p_region
    join public.fuel_types f on f.code = p.fuel_type
   group by r.code, r.name, l.week_start, l.week_end, l.source_url, p.fuel_type, f.sort
   order by f.sort;
$$;

-- The DOE prices for a station's region.
create or replace function public.doe_prices_for_station(p_station_id uuid)
returns table (
  region text,
  region_name text,
  week_start date,
  week_end date,
  fuel_type text,
  price_min numeric,
  price_max numeric,
  typical_price numeric,
  area_count integer,
  source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.*
    from public.stations s
    cross join lateral public.doe_prices(s.region) d
   where s.id = p_station_id;
$$;

-- The DOE prices for the region of the closest station within 30 km of a point (the map centre).
create or replace function public.doe_prices_near(p_lat double precision, p_lng double precision)
returns table (
  region text,
  region_name text,
  week_start date,
  week_end date,
  fuel_type text,
  price_min numeric,
  price_max numeric,
  typical_price numeric,
  area_count integer,
  source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with here as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  ),
  nearest as (
    select s.region
      from public.stations s, here
     where s.region is not null
       and s.is_active
       and extensions.st_dwithin(s.location, here.g, 30000)
     order by s.location operator(extensions.<->) here.g
     limit 1
  )
  select d.* from nearest n cross join lateral public.doe_prices(n.region) d;
$$;

revoke execute on function public.ingest_doe_prices(text, jsonb) from public;
-- The job calls this with the publishable key; the token is what authorises it.
grant execute on function public.ingest_doe_prices(text, jsonb) to anon;
grant execute on function public.doe_prices(text) to anon, authenticated;
grant execute on function public.doe_prices_for_station(uuid) to anon, authenticated;
grant execute on function public.doe_prices_near(double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The weekly summary from drivers' prices stays a Metro Manila figure (its push says so) now that
-- stations from other regions are added.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_weekly_price_summary(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := public.manila_week_start(p_now);
  v_start timestamptz := v_week::timestamp at time zone 'Asia/Manila';
  v_prev timestamptz := (v_week - 7)::timestamp at time zone 'Asia/Manila';
  v_count integer;
begin
  with latest as (
    -- Each station's latest confirmed price per fuel, separately for this week and last week.
    select distinct on (r.station_id, r.fuel_type, r.reported_at >= v_start)
           r.fuel_type, r.price, r.reported_at >= v_start as this_week
      from public.price_reports r
      join public.stations s on s.id = r.station_id and s.is_active
     where r.status = 'verified'
       and coalesce(s.region, 'NCR') = 'NCR'
       and r.reported_at >= v_prev
       and r.reported_at < p_now
     order by r.station_id, r.fuel_type, r.reported_at >= v_start, r.reported_at desc
  ),
  medians as (
    select fuel_type, this_week,
           percentile_cont(0.5) within group (order by price) as med,
           count(*)::int as n
      from latest
     group by fuel_type, this_week
  )
  insert into public.weekly_price_summaries
    (week_start, fuel_type, median_price, station_count, prev_median, prev_station_count, updated_at)
  select v_week, c.fuel_type, round(c.med::numeric, 2), c.n,
         round(p.med::numeric, 2), coalesce(p.n, 0), now()
    from medians c
    left join medians p on p.fuel_type = c.fuel_type and not p.this_week
   where c.this_week
  on conflict (week_start, fuel_type) do update
    set median_price = excluded.median_price,
        station_count = excluded.station_count,
        prev_median = excluded.prev_median,
        prev_station_count = excluded.prev_station_count,
        updated_at = excluded.updated_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.refresh_weekly_price_summary(timestamptz) from public, anon, authenticated;
