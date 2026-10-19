-- Phase 5: price history, favorites, price alerts (in-app inbox + Expo push) and DOE bulletins.

-- ---------------------------------------------------------------------------
-- Price history: the last verified price per fuel per day (Manila time).
-- ---------------------------------------------------------------------------
create or replace function public.station_price_history(p_station_id uuid, p_days integer default 30)
returns table (fuel_type text, day date, price numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (r.fuel_type, (r.reported_at at time zone 'Asia/Manila')::date)
    r.fuel_type,
    (r.reported_at at time zone 'Asia/Manila')::date,
    r.price
  from public.price_reports r
  where r.station_id = p_station_id
    and r.status = 'verified'
    and r.reported_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  order by r.fuel_type, (r.reported_at at time zone 'Asia/Manila')::date, r.reported_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Favorites: rows default to the caller, and come back with map data.
-- ---------------------------------------------------------------------------
alter table public.favorites alter column user_id set default auth.uid();

create or replace function public.favorite_stations(lat double precision, lng double precision)
returns table (
  id uuid,
  name text,
  brand text,
  brand_color text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  prices jsonb,
  pending_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select
    s.id,
    s.name,
    b.name,
    b.color,
    s.address,
    extensions.st_y(s.location::extensions.geometry),
    extensions.st_x(s.location::extensions.geometry),
    extensions.st_distance(s.location, o.g) as distance_m,
    coalesce(
      (select jsonb_object_agg(p.fuel_type, jsonb_build_object('price', p.price, 'reported_at', p.reported_at))
       from public.station_latest_prices p
       where p.station_id = s.id),
      '{}'::jsonb
    ),
    (select count(*)::int from public.price_reports r
      where r.station_id = s.id and r.status = 'pending')
  from public.favorites f
  join public.stations s on s.id = f.station_id
  cross join origin o
  left join public.brands b on b.id = s.brand_id
  where f.user_id = auth.uid() and s.is_active
  order by distance_m;
$$;

-- ---------------------------------------------------------------------------
-- Price alerts
-- ---------------------------------------------------------------------------
alter table public.price_alerts alter column user_id set default auth.uid();

-- Expo push tokens, one row per device.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "users manage own push tokens" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Matches waiting in each user's inbox (and to be pushed to their devices).
create table public.alert_deliveries (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.price_alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid not null references public.price_reports (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  fuel_type text not null references public.fuel_types (code),
  price numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  read_at timestamptz
);
create index alert_deliveries_user_idx on public.alert_deliveries (user_id, created_at desc);
create index alert_deliveries_unpushed_idx on public.alert_deliveries (created_at) where pushed_at is null;
alter table public.alert_deliveries enable row level security;
create policy "users read own alert matches" on public.alert_deliveries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users mark own alert matches read" on public.alert_deliveries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.alert_deliveries from authenticated;
grant update (read_at) on public.alert_deliveries to authenticated;

create or replace function public.create_price_alert(
  p_fuel_type text,
  p_max_price numeric,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 3000,
  p_station_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.price_alerts where user_id = auth.uid()) >= 10 then
    raise exception 'too_many_alerts' using errcode = '22023';
  end if;
  insert into public.price_alerts (fuel_type, max_price, center, radius_m, station_id)
  values (
    p_fuel_type,
    p_max_price,
    case when p_lat is not null and p_lng is not null then
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    end,
    p_radius_m,
    p_station_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.my_price_alerts()
returns table (
  id uuid,
  fuel_type text,
  max_price numeric,
  radius_m integer,
  latitude double precision,
  longitude double precision,
  station_id uuid,
  station_name text,
  is_active boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id, a.fuel_type, a.max_price, a.radius_m,
    extensions.st_y(a.center::extensions.geometry),
    extensions.st_x(a.center::extensions.geometry),
    a.station_id, s.name, a.is_active, a.created_at
  from public.price_alerts a
  left join public.stations s on s.id = a.station_id
  where a.user_id = auth.uid()
  order by a.created_at desc;
$$;

-- When a price is verified, queue a match for every alert it satisfies (at most one per alert and
-- station every 12 hours, so a busy station doesn't spam anyone).
create or replace function public.queue_price_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'verified' or old.status = 'verified' then
    return new;
  end if;

  insert into public.alert_deliveries (alert_id, user_id, report_id, station_id, fuel_type, price)
  select a.id, a.user_id, new.id, new.station_id, new.fuel_type, new.price
  from public.price_alerts a
  join public.stations s on s.id = new.station_id
  where a.is_active
    and a.fuel_type = new.fuel_type
    and new.price <= a.max_price
    and (a.station_id = new.station_id
         or (a.station_id is null and extensions.st_dwithin(a.center, s.location, a.radius_m)))
    and not exists (
      select 1 from public.alert_deliveries d
      where d.alert_id = a.id and d.station_id = new.station_id
        and d.created_at > now() - interval '12 hours'
    );
  return new;
end;
$$;

create trigger price_report_verified_alerts
  after update of status on public.price_reports
  for each row execute function public.queue_price_alerts();

-- Send queued matches to Expo's push service (batches of 100). Matches for users without a
-- device token stay in their in-app inbox only.
create extension if not exists pg_net;

create or replace function public.send_alert_pushes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
  v_sent integer := 0;
begin
  loop
    with batch as (
      select d.id, t.token, s.name as station, f.label as fuel, d.price, d.station_id
      from public.alert_deliveries d
      join public.push_tokens t on t.user_id = d.user_id
      join public.stations s on s.id = d.station_id
      join public.fuel_types f on f.code = d.fuel_type
      where d.pushed_at is null
      order by d.id
      limit 100
    ),
    marked as (
      update public.alert_deliveries d set pushed_at = now()
      from batch b where d.id = b.id
      returning d.id
    )
    select jsonb_agg(jsonb_build_object(
             'to', b.token,
             'title', format('%s ₱%s', b.fuel, b.price),
             'body', format('%s is at or below your alert price.', b.station),
             'sound', 'default',
             'data', jsonb_build_object('stationId', b.station_id)))
      into v_messages
      from batch b;

    exit when v_messages is null;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_sent := v_sent + jsonb_array_length(v_messages);
  end loop;

  -- Matches with no device to push to are done too; they live on in the inbox.
  update public.alert_deliveries set pushed_at = now() where pushed_at is null;
  return v_sent;
end;
$$;

revoke execute on function public.send_alert_pushes() from public, anon, authenticated;
revoke execute on function public.queue_price_alerts() from public, anon, authenticated;
revoke execute on function public.create_price_alert(text, numeric, double precision, double precision, integer, uuid) from public, anon;
revoke execute on function public.my_price_alerts() from public, anon;
revoke execute on function public.favorite_stations(double precision, double precision) from public, anon;
grant execute on function public.create_price_alert(text, numeric, double precision, double precision, integer, uuid) to authenticated;
grant execute on function public.my_price_alerts() to authenticated;
grant execute on function public.favorite_stations(double precision, double precision) to authenticated;
grant execute on function public.station_price_history(uuid, integer) to anon, authenticated;

select cron.schedule('fuelwards-alert-pushes', '*/5 * * * *', 'select public.send_alert_pushes()');

-- ---------------------------------------------------------------------------
-- DOE weekly bulletin: the newest one effective within the past week or the coming week.
-- Admins enter the official figures; nothing is shown when there is none.
-- ---------------------------------------------------------------------------
create or replace function public.current_doe_bulletin(p_region text default 'NCR')
returns table (
  effective_date date,
  fuel_type text,
  change_min numeric,
  change_max numeric,
  source_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.effective_date, b.fuel_type, b.change_min, b.change_max, b.source_url
  from public.doe_bulletins b
  where b.region = p_region
    and b.effective_date = (
      select max(x.effective_date) from public.doe_bulletins x
      where x.region = p_region
        and x.effective_date between (now() at time zone 'Asia/Manila')::date - 6
                                 and (now() at time zone 'Asia/Manila')::date + 7
    )
  order by b.fuel_type;
$$;
