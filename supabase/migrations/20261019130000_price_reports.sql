-- Phase 3: price reports, confirm/dispute votes and points.
--
-- The app never writes reports, votes or points itself. It calls the security-definer functions
-- below, which check the rules and write in one transaction:
--   submit_price_report  reporter must be near the station; rate limit; duplicate and outlier checks
--   vote_on_report       other drivers near the station confirm or dispute a pending report
--   decide_report        verifies or rejects a report and credits points (internal)
--   process_pending_reports  pg_cron job: verifies quiet, unflagged reports after a delay
-- Rule values live in app_config so they can be tuned without a deploy.

-- ---------------------------------------------------------------------------
-- Privacy: other users may see a report's price and status, never who sent it or from where.
-- ---------------------------------------------------------------------------
revoke select on public.price_reports from anon, authenticated;
grant select (id, station_id, fuel_type, price, reported_at, status, flagged, verified_at)
  on public.price_reports to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rule settings
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, description) values
  ('disputes_to_reject', '2', 'Dispute votes needed to reject a report'),
  ('max_vote_distance_m', '1000', 'Voters must be this close to the station'),
  ('auto_verify_hours', '6', 'Unflagged reports with no disputes are verified after this many hours (0 = never)'),
  ('duplicate_window_hours', '3', 'A user can report a fuel at a station once in this window')
on conflict (key) do nothing;

create or replace function public.config_number(config_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::numeric from public.app_config where key = config_key;
$$;

-- ---------------------------------------------------------------------------
-- Decide a report: set its status and credit points. Internal only.
-- ---------------------------------------------------------------------------
create or replace function public.decide_report(p_report_id uuid, p_outcome public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.price_reports%rowtype;
begin
  update public.price_reports
     set status = p_outcome,
         verified_at = now()
   where id = p_report_id and status = 'pending'
  returning * into v_report;
  if not found then
    return; -- already decided
  end if;

  if p_outcome = 'verified' then
    insert into public.points_ledger (user_id, delta, reason, ref_id)
    values (v_report.user_id, public.config_number('report_points')::int, 'report_verified', p_report_id);
  end if;

  -- Voters who called it right earn a little too.
  insert into public.points_ledger (user_id, delta, reason, ref_id)
  select v.user_id, public.config_number('vote_points')::int, 'vote_matched', p_report_id
    from public.report_votes v
   where v.report_id = p_report_id
     and v.vote = case when p_outcome = 'verified' then 'confirm'::public.vote_kind
                       else 'dispute'::public.vote_kind end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit prices for one station: { "GAS91": 60.80, "DIESEL": 57.10 }
-- ---------------------------------------------------------------------------
create or replace function public.submit_price_report(
  p_station_id uuid,
  p_prices jsonb,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_station public.stations%rowtype;
  v_point extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_distance double precision;
  v_fuel text;
  v_price numeric;
  v_median numeric;
  v_flagged boolean;
  v_any_flagged boolean := false;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if p_prices is null or jsonb_typeof(p_prices) <> 'object' or p_prices = '{}'::jsonb then
    raise exception 'no_prices' using errcode = '22023';
  end if;

  select * into v_station from public.stations where id = p_station_id and is_active;
  if not found then
    raise exception 'station_not_found' using errcode = '22023';
  end if;

  v_distance := extensions.st_distance(v_station.location, v_point);
  if v_distance > public.config_number('max_report_distance_m') then
    raise exception 'too_far' using errcode = '22023', detail = round(v_distance)::text;
  end if;

  if (select count(*) from public.price_reports
       where user_id = v_user and reported_at > now() - interval '1 hour')
     + (select count(*) from jsonb_object_keys(p_prices))
     > public.config_number('reports_per_hour') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  for v_fuel, v_price in
    select key, (value #>> '{}')::numeric from jsonb_each(p_prices)
  loop
    if not exists (select 1 from public.fuel_types where code = v_fuel) then
      raise exception 'unknown_fuel' using errcode = '22023', detail = v_fuel;
    end if;
    if v_price is null or v_price <= 20 or v_price >= 300 then
      raise exception 'price_out_of_range' using errcode = '22023', detail = v_fuel;
    end if;
    if exists (
      select 1 from public.price_reports
       where user_id = v_user and station_id = p_station_id and fuel_type = v_fuel
         and status <> 'rejected'
         and reported_at > now() - make_interval(hours => public.config_number('duplicate_window_hours')::int)
    ) then
      raise exception 'already_reported' using errcode = '22023', detail = v_fuel;
    end if;

    -- Outlier check: compare with the median of current verified prices within 5 km (needs 3+).
    v_median := null;
    select percentile_cont(0.5) within group (order by p.price)::numeric
      into v_median
      from public.station_latest_prices p
      join public.stations s on s.id = p.station_id
     where p.fuel_type = v_fuel
       and p.reported_at > now() - interval '7 days'
       and extensions.st_dwithin(s.location, v_station.location, 5000)
    having count(*) >= 3;
    v_flagged := v_median is not null
      and abs(v_price - v_median) / v_median > public.config_number('outlier_ratio');
    v_any_flagged := v_any_flagged or v_flagged;

    insert into public.price_reports
      (station_id, user_id, fuel_type, price, reporter_location, distance_m, flagged, flag_reason)
    values
      (p_station_id, v_user, v_fuel, round(v_price, 2), v_point, v_distance, v_flagged,
       case when v_flagged then
         format('%s%% away from the nearby median of %s', round(abs(v_price - v_median) / v_median * 100), round(v_median, 2))
       end)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  return jsonb_build_object(
    'report_ids', to_jsonb(v_ids),
    'pending_points', public.config_number('report_points') * cardinality(v_ids),
    'flagged', v_any_flagged,
    'distance_m', round(v_distance)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm or dispute someone else's pending report.
-- ---------------------------------------------------------------------------
create or replace function public.vote_on_report(
  p_report_id uuid,
  p_vote public.vote_kind,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_report public.price_reports%rowtype;
  v_distance double precision;
  v_confirms int;
  v_disputes int;
  v_needed int;
  v_status public.report_status;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_report from public.price_reports where id = p_report_id for update;
  if not found then
    raise exception 'report_not_found' using errcode = '22023';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'already_decided' using errcode = '22023';
  end if;
  if v_report.user_id = v_user then
    raise exception 'own_report' using errcode = '22023';
  end if;

  select extensions.st_distance(
           s.location,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
    into v_distance
    from public.stations s where s.id = v_report.station_id;
  if v_distance > public.config_number('max_vote_distance_m') then
    raise exception 'too_far' using errcode = '22023', detail = round(v_distance)::text;
  end if;

  insert into public.report_votes (report_id, user_id, vote)
  values (p_report_id, v_user, p_vote)
  on conflict (report_id, user_id) do nothing;
  if not found then
    raise exception 'already_voted' using errcode = '22023';
  end if;

  select count(*) filter (where vote = 'confirm'), count(*) filter (where vote = 'dispute')
    into v_confirms, v_disputes
    from public.report_votes where report_id = p_report_id;

  -- Prices far from the nearby median need twice the confirmations.
  v_needed := public.config_number('confirmations_to_verify')::int * case when v_report.flagged then 2 else 1 end;

  if v_confirms >= v_needed then
    perform public.decide_report(p_report_id, 'verified');
  elsif v_disputes >= public.config_number('disputes_to_reject') then
    perform public.decide_report(p_report_id, 'rejected');
  end if;

  select status into v_status from public.price_reports where id = p_report_id;
  return jsonb_build_object('status', v_status, 'confirms', v_confirms, 'disputes', v_disputes, 'needed', v_needed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled job: verify unflagged reports nobody disputed within auto_verify_hours.
-- Keeps prices flowing while few drivers are around to vote. Flagged reports always wait for votes.
-- ---------------------------------------------------------------------------
create or replace function public.process_pending_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours numeric := public.config_number('auto_verify_hours');
  v_id uuid;
  v_count integer := 0;
begin
  if v_hours is null or v_hours <= 0 then
    return 0;
  end if;
  for v_id in
    select r.id from public.price_reports r
     where r.status = 'pending'
       and not r.flagged
       and r.reported_at < now() - make_interval(secs => v_hours * 3600)
       and not exists (select 1 from public.report_votes v where v.report_id = r.id and v.vote = 'dispute')
  loop
    perform public.decide_report(v_id, 'verified');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers for the app
-- ---------------------------------------------------------------------------
-- Pending reports at a station, with vote counts and the caller's own involvement.
create or replace function public.station_pending_reports(p_station_id uuid)
returns table (
  id uuid,
  fuel_type text,
  price numeric,
  reported_at timestamptz,
  flagged boolean,
  confirms integer,
  disputes integer,
  needed integer,
  is_mine boolean,
  my_vote public.vote_kind
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.fuel_type, r.price, r.reported_at, r.flagged,
    (select count(*)::int from public.report_votes v where v.report_id = r.id and v.vote = 'confirm'),
    (select count(*)::int from public.report_votes v where v.report_id = r.id and v.vote = 'dispute'),
    public.config_number('confirmations_to_verify')::int * case when r.flagged then 2 else 1 end,
    r.user_id = auth.uid(),
    (select v.vote from public.report_votes v where v.report_id = r.id and v.user_id = auth.uid())
  from public.price_reports r
  where r.station_id = p_station_id and r.status = 'pending' and auth.uid() is not null
  order by r.reported_at desc;
$$;

-- The caller's confirmed balance and the points waiting on their pending reports.
create or replace function public.my_points()
returns table (balance integer, pending integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select sum(delta)::int from public.points_ledger where user_id = auth.uid()), 0),
    coalesce((select count(*)::int from public.price_reports
               where user_id = auth.uid() and status = 'pending'), 0)
      * public.config_number('report_points')::int;
$$;

-- Pending reports per station, so map cards can say "2 prices to confirm".
drop function public.nearby_stations(double precision, double precision, integer);
create function public.nearby_stations(
  lat double precision,
  lng double precision,
  radius_m integer default 5000
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
    ) as prices,
    (select count(*)::int from public.price_reports r
      where r.station_id = s.id and r.status = 'pending') as pending_count
  from public.stations s
  cross join origin o
  left join public.brands b on b.id = s.brand_id
  where s.is_active
    and extensions.st_dwithin(s.location, o.g, least(radius_m, 50000))
  order by distance_m
  limit 200;
$$;

drop function public.search_stations(text, double precision, double precision);
create function public.search_stations(
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
    ) as prices,
    (select count(*)::int from public.price_reports r
      where r.station_id = s.id and r.status = 'pending') as pending_count
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

-- ---------------------------------------------------------------------------
-- Who may call what. Supabase grants EXECUTE to anon and authenticated by default.
-- ---------------------------------------------------------------------------
revoke execute on function public.decide_report(uuid, public.report_status) from public, anon, authenticated;
revoke execute on function public.process_pending_reports() from public, anon, authenticated;

revoke execute on function public.submit_price_report(uuid, jsonb, double precision, double precision) from public, anon;
revoke execute on function public.vote_on_report(uuid, public.vote_kind, double precision, double precision) from public, anon;
revoke execute on function public.station_pending_reports(uuid) from public, anon;
revoke execute on function public.my_points() from public, anon;
grant execute on function public.submit_price_report(uuid, jsonb, double precision, double precision) to authenticated;
grant execute on function public.vote_on_report(uuid, public.vote_kind, double precision, double precision) to authenticated;
grant execute on function public.station_pending_reports(uuid) to authenticated;
grant execute on function public.my_points() to authenticated;

grant execute on function public.nearby_stations(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.search_stations(text, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Run the auto-verify job every 15 minutes.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('fuelwards-auto-verify', '*/15 * * * *', 'select public.process_pending_reports()');
