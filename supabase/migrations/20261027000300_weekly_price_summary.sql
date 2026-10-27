-- Weekly price summary from drivers' confirmed prices, made automatically.
--
-- The DOE publishes no machine-readable price feed, so FuelWards summarises its own data. Weeks
-- run Tuesday to Monday (Manila time), like the DOE's weekly adjustments. A daily job:
--   1. refresh_weekly_price_summary  per fuel, the median of each station's latest confirmed price
--                                    this week and last week (one vote per station, so a busy
--                                    station can't skew it)
--   2. announce_weekly_prices        from Wednesday to Friday, once per week, pushes the changes
--                                    to drivers who want weekly price notifications, as soon as
--                                    enough stations have prices in both weeks
-- No admin input is needed. The manual DOE bulletin stays as the "official" line.

insert into public.app_config (key, value, description) values
  ('weekly_summary_min_stations', '3',
   'Stations with a confirmed price needed (in each week) before a fuel''s weekly change is shown')
on conflict (key) do nothing;

create table public.weekly_price_summaries (
  week_start date not null,
  fuel_type text not null references public.fuel_types (code),
  median_price numeric(6, 2) not null,
  station_count integer not null,
  prev_median numeric(6, 2),
  prev_station_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (week_start, fuel_type)
);

-- Aggregates only (no reporters, no locations), so anyone may read them. Only the job writes.
alter table public.weekly_price_summaries enable row level security;
create policy "weekly summaries are readable" on public.weekly_price_summaries
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.weekly_price_summaries from anon, authenticated;

create table public.weekly_price_announcements (
  week_start date primary key,
  recipients integer not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.weekly_price_announcements enable row level security;
revoke all on public.weekly_price_announcements from anon, authenticated;

-- The Tuesday that starts the Manila week containing p_at.
create or replace function public.manila_week_start(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select d - ((extract(isodow from d)::int - 2 + 7) % 7)
  from (select (p_at at time zone 'Asia/Manila')::date as d) x;
$$;

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

-- This week's summary for the app. The change is only given when both weeks have enough stations.
create or replace function public.current_weekly_prices(p_now timestamptz default now())
returns table (
  week_start date,
  fuel_type text,
  median_price numeric,
  change numeric,
  station_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week_start, w.fuel_type, w.median_price,
         case when w.prev_station_count >= public.config_number('weekly_summary_min_stations')
              then w.median_price - w.prev_median end,
         w.station_count
    from public.weekly_price_summaries w
    join public.fuel_types f on f.code = w.fuel_type
   where w.week_start = public.manila_week_start(p_now)
     and w.station_count >= public.config_number('weekly_summary_min_stations')
   order by f.sort;
$$;

create or replace function public.announce_weekly_prices(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := public.manila_week_start(p_now);
  v_day integer := extract(isodow from (p_now at time zone 'Asia/Manila'))::int;
  v_body text;
  v_stations integer;
  v_count integer;
begin
  -- Wednesday to Friday only: Tuesday's new prices need a day to be reported and confirmed.
  if v_day not between 3 and 5 then
    return 0;
  end if;
  if exists (select 1 from public.weekly_price_announcements where week_start = v_week) then
    return 0;
  end if;

  select string_agg(f.short_label || ' ' || public.format_peso_change(c.change), ', ' order by f.sort),
         min(c.station_count)
    into v_body, v_stations
    from public.current_weekly_prices(p_now) c
    join public.fuel_types f on f.code = c.fuel_type
   where c.change is not null;
  if v_body is null then
    return 0; -- not enough confirmed prices yet; the job tries again tomorrow
  end if;
  v_body := v_body || format(' this week (median of confirmed prices at %s+ stations).', v_stations);

  insert into public.push_outbox (user_id, title, body, data)
  select p.id, 'This week''s pump prices in Metro Manila', v_body,
         jsonb_build_object('kind', 'weekly', 'week', v_week)
    from public.profiles p
   where p.notify_doe
     and p.banned_at is null
     and exists (select 1 from public.push_tokens t where t.user_id = p.id);
  get diagnostics v_count = row_count;

  insert into public.weekly_price_announcements (week_start, recipients, body)
  values (v_week, v_count, v_body);
  return v_count;
end;
$$;

-- The daily job: refresh, then announce if it's time. Runs at 20:00 Manila (12:00 UTC).
create or replace function public.run_weekly_price_summary()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_weekly_price_summary();
  perform public.announce_weekly_prices();
end;
$$;

select cron.schedule('fuelwards-weekly-prices', '0 12 * * *', 'select public.run_weekly_price_summary()');

revoke execute on function public.refresh_weekly_price_summary(timestamptz) from public, anon, authenticated;
revoke execute on function public.announce_weekly_prices(timestamptz) from public, anon, authenticated;
revoke execute on function public.run_weekly_price_summary() from public, anon, authenticated;
grant execute on function public.current_weekly_prices(timestamptz) to anon, authenticated;
