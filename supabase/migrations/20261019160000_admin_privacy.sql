-- Phase 6: moderation, the admin console and privacy.
--
--   Bans        banned users can't report, vote, redeem or set alerts. Triggers enforce this, so
--               every write path is covered.
--   admin_*     functions behind the admin console. Each checks is_admin() and is logged in
--               admin_actions. Admin edits to stations, rewards, bulletins and settings are logged too.
--   Privacy     report locations are erased after 12 months (the Privacy Notice promise). Users can
--               export their data and delete their account. Their confirmed prices stay on the map
--               without their name.

-- ---------------------------------------------------------------------------
-- Bans
-- ---------------------------------------------------------------------------
-- Not added to the column grants, so other users can't see who is banned.
alter table public.profiles
  add column banned_at timestamptz,
  add column ban_reason text check (char_length(ban_reason) <= 200);

create or replace function public.reject_banned_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and banned_at is not null) then
    raise exception 'banned' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger price_reports_not_banned before insert on public.price_reports
  for each row execute function public.reject_banned_user();
create trigger report_votes_not_banned before insert on public.report_votes
  for each row execute function public.reject_banned_user();
create trigger redemptions_not_banned before insert on public.redemptions
  for each row execute function public.reject_banned_user();
create trigger price_alerts_not_banned before insert on public.price_alerts
  for each row execute function public.reject_banned_user();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
create policy "admins read the audit log" on public.admin_actions
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.admin_actions from anon, authenticated;

create or replace function public.log_admin_action(
  p_action text,
  p_table text,
  p_target text,
  p_detail jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_actions (admin_id, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_table, p_target, p_detail);
$$;

-- Edits made from the console (direct table writes allowed by the admin policies). Migrations and
-- scheduled jobs run without a signed-in admin and aren't logged.
create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if public.is_admin() then
    perform public.log_admin_action(
      lower(tg_op),
      tg_table_name,
      coalesce(v_row ->> 'id', v_row ->> 'key'),
      case when tg_op = 'UPDATE'
           then jsonb_build_object('before', to_jsonb(old) - 'location', 'after', to_jsonb(new) - 'location')
           else v_row - 'location' end
    );
  end if;
  return null;
end;
$$;

create trigger stations_admin_log after insert or update or delete on public.stations
  for each row execute function public.log_admin_change();
create trigger rewards_admin_log after insert or update or delete on public.rewards
  for each row execute function public.log_admin_change();
create trigger doe_bulletins_admin_log after insert or update or delete on public.doe_bulletins
  for each row execute function public.log_admin_change();
create trigger app_config_admin_log after insert or update or delete on public.app_config
  for each row execute function public.log_admin_change();

-- ---------------------------------------------------------------------------
-- Admin console
-- ---------------------------------------------------------------------------
create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'flagged', (select count(*) from public.price_reports where status = 'pending' and flagged),
    'pending', (select count(*) from public.price_reports where status = 'pending'),
    'reports_today', (select count(*) from public.price_reports where reported_at > now() - interval '24 hours'),
    'users', (select count(*) from public.profiles),
    'new_users_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'banned', (select count(*) from public.profiles where banned_at is not null),
    'redemptions_week', (select count(*) from public.redemptions where created_at > now() - interval '7 days'),
    'stations', (select count(*) from public.stations where is_active),
    'hidden_stations', (select count(*) from public.stations where not is_active)
  );
end;
$$;

-- p_filter: 'flagged' (pending and unusual), 'pending' (all waiting) or 'decided' (last 7 days).
create or replace function public.admin_report_queue(p_filter text default 'flagged')
returns table (
  id uuid,
  station_id uuid,
  station_name text,
  fuel_type text,
  price numeric,
  reported_at timestamptz,
  status public.report_status,
  flagged boolean,
  flag_reason text,
  distance_m real,
  confirms integer,
  disputes integer,
  reporter_id uuid,
  reporter_username text,
  reporter_verified integer,
  reporter_rejected integer,
  reporter_banned boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select
    r.id, r.station_id, s.name, r.fuel_type, r.price, r.reported_at, r.status, r.flagged,
    r.flag_reason, r.distance_m,
    (select count(*)::int from public.report_votes v where v.report_id = r.id and v.vote = 'confirm'),
    (select count(*)::int from public.report_votes v where v.report_id = r.id and v.vote = 'dispute'),
    r.user_id, p.username,
    (select count(*)::int from public.price_reports x where x.user_id = r.user_id and x.status = 'verified'),
    (select count(*)::int from public.price_reports x where x.user_id = r.user_id and x.status = 'rejected'),
    p.banned_at is not null
  from public.price_reports r
  join public.stations s on s.id = r.station_id
  left join public.profiles p on p.id = r.user_id
  where case p_filter
          when 'flagged' then r.status = 'pending' and r.flagged
          when 'pending' then r.status = 'pending'
          when 'decided' then r.status <> 'pending' and r.verified_at > now() - interval '7 days'
          else false
        end
  order by
    case when p_filter = 'decided' then r.verified_at end desc,
    r.flagged desc,
    r.reported_at
  limit 100;
end;
$$;

create or replace function public.admin_decide_report(p_report_id uuid, p_outcome public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_outcome = 'pending' then
    raise exception 'bad_outcome' using errcode = '22023';
  end if;
  if not exists (select 1 from public.price_reports where id = p_report_id and status = 'pending') then
    raise exception 'already_decided' using errcode = '22023';
  end if;
  perform public.decide_report(p_report_id, p_outcome);
  perform public.log_admin_action('decide_report', 'price_reports', p_report_id::text,
                                  jsonb_build_object('outcome', p_outcome));
end;
$$;

create or replace function public.admin_users(p_search text default '')
returns table (
  id uuid,
  username text,
  display_name text,
  role text,
  created_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  balance integer,
  verified_reports integer,
  rejected_reports integer,
  pending_reports integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select
    p.id, p.username, p.display_name, p.role, p.created_at, p.banned_at, p.ban_reason,
    coalesce((select sum(l.delta)::int from public.points_ledger l where l.user_id = p.id), 0),
    (select count(*)::int from public.price_reports r where r.user_id = p.id and r.status = 'verified'),
    (select count(*)::int from public.price_reports r where r.user_id = p.id and r.status = 'rejected'),
    (select count(*)::int from public.price_reports r where r.user_id = p.id and r.status = 'pending')
  from public.profiles p
  where coalesce(p_search, '') = ''
     or p.username ilike '%' || p_search || '%'
     or p.display_name ilike '%' || p_search || '%'
  order by p.banned_at is null, p.created_at desc
  limit 50;
end;
$$;

-- Banning rejects the user's waiting prices and withdraws their votes on prices still waiting.
create or replace function public.admin_set_ban(p_user_id uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'cannot_ban_self' using errcode = '22023';
  end if;
  select role into v_role from public.profiles where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = '22023';
  end if;
  if v_role = 'admin' then
    raise exception 'cannot_ban_admin' using errcode = '22023';
  end if;

  update public.profiles
     set banned_at = case when p_banned then coalesce(banned_at, now()) end,
         ban_reason = case when p_banned then nullif(trim(p_reason), '') end
   where id = p_user_id;

  if p_banned then
    perform public.decide_report(r.id, 'rejected')
       from public.price_reports r
      where r.user_id = p_user_id and r.status = 'pending';
    delete from public.report_votes v
     using public.price_reports r
     where v.report_id = r.id and r.status = 'pending' and v.user_id = p_user_id;
  end if;

  perform public.log_admin_action(case when p_banned then 'ban' else 'unban' end, 'profiles',
                                  p_user_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_recent_actions()
returns table (
  id bigint,
  admin_username text,
  action text,
  target_table text,
  target_id text,
  detail jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select a.id, p.username, a.action, a.target_table, a.target_id, a.detail, a.created_at
  from public.admin_actions a
  left join public.profiles p on p.id = a.admin_id
  order by a.created_at desc
  limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privacy: location retention
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, description) values
  ('location_retention_months', '12', 'Report locations are erased after this many months')
on conflict (key) do nothing;

create or replace function public.purge_old_report_locations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.price_reports
     set reporter_location = null
   where reporter_location is not null
     and reported_at < now() - make_interval(months => public.config_number('location_retention_months')::int);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('fuelwards-purge-locations', '17 19 * * *', 'select public.purge_old_report_locations()');

-- ---------------------------------------------------------------------------
-- Privacy: export and delete my data (RA 10173 rights of access and erasure)
-- ---------------------------------------------------------------------------
create or replace function public.my_data_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'username', p.username,
        'display_name', p.display_name,
        'email', u.email,
        'created_at', p.created_at,
        'privacy_accepted_at', p.privacy_accepted_at
      )
      from public.profiles p join auth.users u on u.id = p.id
      where p.id = v_user
    ),
    'price_reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'station', s.name,
        'fuel_type', r.fuel_type,
        'price', r.price,
        'reported_at', r.reported_at,
        'status', r.status,
        'distance_m', round(r.distance_m),
        'latitude', extensions.st_y(r.reporter_location::extensions.geometry),
        'longitude', extensions.st_x(r.reporter_location::extensions.geometry)
      ) order by r.reported_at)
      from public.price_reports r join public.stations s on s.id = r.station_id
      where r.user_id = v_user
    ), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('report_id', v.report_id, 'vote', v.vote, 'created_at', v.created_at)
                       order by v.created_at)
      from public.report_votes v where v.user_id = v_user
    ), '[]'::jsonb),
    'points', coalesce((
      select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'created_at', l.created_at)
                       order by l.created_at)
      from public.points_ledger l where l.user_id = v_user
    ), '[]'::jsonb),
    'vouchers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reward', w.title, 'code', d.code, 'points', d.points_spent, 'status', d.status,
        'created_at', d.created_at, 'expires_at', d.expires_at
      ) order by d.created_at)
      from public.redemptions d join public.rewards w on w.id = d.reward_id
      where d.user_id = v_user
    ), '[]'::jsonb),
    'saved_stations', coalesce((
      select jsonb_agg(jsonb_build_object('station', s.name, 'saved_at', f.created_at) order by f.created_at)
      from public.favorites f join public.stations s on s.id = f.station_id
      where f.user_id = v_user
    ), '[]'::jsonb),
    'price_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fuel_type', a.fuel_type, 'max_price', a.max_price, 'radius_m', a.radius_m,
        'latitude', extensions.st_y(a.center::extensions.geometry),
        'longitude', extensions.st_x(a.center::extensions.geometry),
        'active', a.is_active, 'created_at', a.created_at
      ) order by a.created_at)
      from public.price_alerts a where a.user_id = v_user
    ), '[]'::jsonb)
  );
end;
$$;

-- Confirmed and rejected prices stay (they're part of each station's history) but lose their
-- reporter and location. Everything else tied to the account is deleted with it.
alter table public.price_reports alter column user_id drop not null;
alter table public.price_reports drop constraint price_reports_user_id_fkey;
alter table public.price_reports add constraint price_reports_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_user and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;

  -- A waiting price can't be decided fairly without its reporter.
  delete from public.price_reports where user_id = v_user and status = 'pending';
  update public.price_reports set reporter_location = null, distance_m = null where user_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.reject_banned_user() from public, anon, authenticated;
revoke execute on function public.log_admin_change() from public, anon, authenticated;
revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.purge_old_report_locations() from public, anon, authenticated;
revoke execute on function public.require_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_report_queue(text) from public, anon;
revoke execute on function public.admin_decide_report(uuid, public.report_status) from public, anon;
revoke execute on function public.admin_users(text) from public, anon;
revoke execute on function public.admin_set_ban(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_recent_actions() from public, anon;
revoke execute on function public.my_data_export() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.require_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_report_queue(text) to authenticated;
grant execute on function public.admin_decide_report(uuid, public.report_status) to authenticated;
grant execute on function public.admin_users(text) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;
grant execute on function public.admin_recent_actions() to authenticated;
grant execute on function public.my_data_export() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
