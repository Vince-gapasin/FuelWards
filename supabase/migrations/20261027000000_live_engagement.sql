-- Live prices, the DOE weekly push and contributor badges.
--
--   Live prices   when a price is verified, a Realtime Broadcast on the public "prices" topic tells
--                 open apps to update their map. Only public fields are sent.
--   DOE push      admins announce a weekly bulletin; drivers who opted in get a push notification.
--                 All pushes now go through send_pushes(), which drains alert matches and the outbox.
--   Badges        my_badges() works out badges and day streaks from existing reports and votes.
--                 Nothing is stored, and badges never award points.

-- ---------------------------------------------------------------------------
-- Live prices
-- ---------------------------------------------------------------------------
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
    'verified_at', r.verified_at
  );
$$;

create or replace function public.broadcast_verified_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    -- A failed broadcast must never undo the verification (and the points that come with it).
    begin
      perform realtime.send(public.price_broadcast_payload(new), 'price_verified', 'prices', false);
    exception when others then
      raise warning 'price broadcast failed: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;

create trigger price_reports_broadcast
  after update of status on public.price_reports
  for each row execute function public.broadcast_verified_price();

-- ---------------------------------------------------------------------------
-- Notification settings
-- ---------------------------------------------------------------------------
-- Not in the profile column grants: only the owner reads or changes it, through the functions below.
alter table public.profiles add column notify_doe boolean not null default true;

create or replace function public.my_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('notify_doe', p.notify_doe)
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.set_notify_doe(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  update public.profiles set notify_doe = p_on where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Push outbox (general-purpose pushes, e.g. the DOE announcement)
-- ---------------------------------------------------------------------------
create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  pushed_at timestamptz
);

create index push_outbox_unpushed_idx on public.push_outbox (id) where pushed_at is null;
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- "+₱1.10", "−₱0.40", "±₱0.00"
create or replace function public.format_peso_change(n numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when n > 0 then '+' when n < 0 then '−' else '±' end
         || '₱' || to_char(abs(n), 'FM990.00');
$$;

create or replace function public.admin_announce_bulletin(p_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes text;
  v_min numeric;
  v_max numeric;
  v_title text;
  v_count integer;
begin
  perform public.require_admin();

  select string_agg(
           f.short_label || ' ' ||
           case when b.change_min = b.change_max then public.format_peso_change(b.change_min)
                else public.format_peso_change(b.change_min) || ' to ' || public.format_peso_change(b.change_max)
           end,
           ', ' order by f.sort),
         min(b.change_min), max(b.change_max)
    into v_changes, v_min, v_max
    from public.doe_bulletins b
    join public.fuel_types f on f.code = b.fuel_type
   where b.effective_date = p_date and b.region = 'NCR';
  if v_changes is null then
    raise exception 'no_bulletin' using errcode = '22023';
  end if;

  -- One announcement per week, so drivers aren't notified twice.
  if exists (select 1 from public.admin_actions
              where action = 'announce_bulletin' and target_id = p_date::text) then
    raise exception 'already_announced' using errcode = '22023';
  end if;

  v_title := case when v_max <= 0 then 'Fuel rollback'
                  when v_min >= 0 then 'Fuel price hike'
                  else 'Fuel price adjustment' end
             || ' on ' || to_char(p_date, 'Dy, Mon FMDD');

  insert into public.push_outbox (user_id, title, body, data)
  select p.id, v_title, v_changes, jsonb_build_object('kind', 'doe', 'date', p_date)
    from public.profiles p
   where p.notify_doe
     and p.banned_at is null
     and exists (select 1 from public.push_tokens t where t.user_id = p.id);
  get diagnostics v_count = row_count;

  perform public.log_admin_action('announce_bulletin', 'doe_bulletins', p_date::text,
                                  jsonb_build_object('recipients', v_count, 'body', v_changes));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- One sender for every push: alert matches first, then the outbox. Batches of up to 100.
-- ---------------------------------------------------------------------------
create or replace function public.send_pushes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
  v_sent integer := 0;
begin
  -- Price alert matches (same messages as before).
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

  -- Outbox. Rows are picked first and then expanded to every device the user has, so a user with
  -- two phones gets both pushes.
  loop
    with picked as (
      select o.id from public.push_outbox o
      where o.pushed_at is null
      order by o.id
      limit 50
    ),
    marked as (
      update public.push_outbox o set pushed_at = now()
      from picked p where o.id = p.id
      returning o.id, o.user_id, o.title, o.body, o.data
    )
    select jsonb_agg(jsonb_build_object(
             'to', t.token, 'title', m.title, 'body', m.body, 'sound', 'default', 'data', m.data))
      into v_messages
      from marked m
      join public.push_tokens t on t.user_id = m.user_id;

    exit when v_messages is null and not exists (
      select 1 from public.push_outbox where pushed_at is null);
    continue when v_messages is null;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_sent := v_sent + jsonb_array_length(v_messages);
  end loop;

  return v_sent;
end;
$$;

select cron.schedule('fuelwards-alert-pushes', '*/5 * * * *', 'select public.send_pushes()');
drop function public.send_alert_pushes();

-- ---------------------------------------------------------------------------
-- Badges and streaks
-- ---------------------------------------------------------------------------
-- Returns { badges: [{ code, progress, goal, earned_at }], current_streak, best_streak }.
-- A streak counts Manila days with at least one price that was later confirmed.
create or replace function public.my_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_confirmed timestamptz[];
  v_votes timestamptz[];
  v_stations timestamptz[];
  v_early timestamptz;
  v_best integer := 0;
  v_current integer := 0;
  v_streak3 timestamptz;
  v_streak7 timestamptz;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select coalesce(array_agg(r.verified_at order by r.verified_at), '{}')
    into v_confirmed
    from public.price_reports r
   where r.user_id = v_user and r.status = 'verified';

  select coalesce(array_agg(l.created_at order by l.created_at), '{}')
    into v_votes
    from public.points_ledger l
   where l.user_id = v_user and l.reason = 'vote_matched';

  -- When each new station was first confirmed for this user.
  select coalesce(array_agg(first_at order by first_at), '{}')
    into v_stations
    from (select min(r.verified_at) as first_at
            from public.price_reports r
           where r.user_id = v_user and r.status = 'verified'
           group by r.station_id) s;

  select min(r.verified_at)
    into v_early
    from public.price_reports r
   where r.user_id = v_user and r.status = 'verified'
     and (r.reported_at at time zone 'Asia/Manila')::time < time '07:00';

  -- Day streaks as runs of consecutive days ("gaps and islands").
  with days as (
    select distinct (r.reported_at at time zone 'Asia/Manila')::date as d
    from public.price_reports r
    where r.user_id = v_user and r.status = 'verified'
  ),
  runs as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  islands as (
    select min(d) as start_d, max(d) as end_d, count(*)::int as len from runs group by grp
  )
  select coalesce(max(len), 0),
         coalesce(max(len) filter (where end_d >= v_today - 1), 0),
         min((start_d + 2)::timestamp at time zone 'Asia/Manila') filter (where len >= 3),
         min((start_d + 6)::timestamp at time zone 'Asia/Manila') filter (where len >= 7)
    into v_best, v_current, v_streak3, v_streak7
    from islands;

  return jsonb_build_object(
    'current_streak', v_current,
    'best_streak', v_best,
    'badges', jsonb_build_array(
      jsonb_build_object('code', 'first_price', 'goal', 1,
        'progress', least(cardinality(v_confirmed), 1), 'earned_at', v_confirmed[1]),
      jsonb_build_object('code', 'prices_10', 'goal', 10,
        'progress', least(cardinality(v_confirmed), 10), 'earned_at', v_confirmed[10]),
      jsonb_build_object('code', 'prices_50', 'goal', 50,
        'progress', least(cardinality(v_confirmed), 50), 'earned_at', v_confirmed[50]),
      jsonb_build_object('code', 'first_vote', 'goal', 1,
        'progress', least(cardinality(v_votes), 1), 'earned_at', v_votes[1]),
      jsonb_build_object('code', 'votes_10', 'goal', 10,
        'progress', least(cardinality(v_votes), 10), 'earned_at', v_votes[10]),
      jsonb_build_object('code', 'explorer', 'goal', 5,
        'progress', least(cardinality(v_stations), 5), 'earned_at', v_stations[5]),
      jsonb_build_object('code', 'early_bird', 'goal', 1,
        'progress', case when v_early is null then 0 else 1 end, 'earned_at', v_early),
      jsonb_build_object('code', 'streak_3', 'goal', 3,
        'progress', least(v_best, 3), 'earned_at', v_streak3),
      jsonb_build_object('code', 'streak_7', 'goal', 7,
        'progress', least(v_best, 7), 'earned_at', v_streak7)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.broadcast_verified_price() from public, anon, authenticated;
revoke execute on function public.send_pushes() from public, anon, authenticated;
revoke execute on function public.my_settings() from public, anon;
revoke execute on function public.set_notify_doe(boolean) from public, anon;
revoke execute on function public.admin_announce_bulletin(date) from public, anon;
revoke execute on function public.my_badges() from public, anon;
grant execute on function public.my_settings() to authenticated;
grant execute on function public.set_notify_doe(boolean) to authenticated;
grant execute on function public.admin_announce_bulletin(date) to authenticated;
grant execute on function public.my_badges() to authenticated;
