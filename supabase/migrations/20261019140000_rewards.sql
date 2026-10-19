-- Phase 4: rewards, voucher redemption, contributor tiers and the leaderboard.
--
--   redeem_reward  checks balance and stock, issues a voucher code and deducts the points in one
--                  transaction, one redemption at a time per user (no double spending)
--   tier_for       contributor tier for a lifetime points total (redeeming never demotes you)
--   my_stats       balance, pending, lifetime points, tier and contribution counts for the caller
--   leaderboard    top contributors this week or all time, plus the caller's own rank

alter table public.redemptions
  add column expires_at timestamptz not null default now() + interval '30 days';

insert into public.app_config (key, value, description) values
  ('tiers',
   '[{"name":"Bronze","min":0},{"name":"Silver","min":200},{"name":"Gold","min":500},{"name":"Platinum","min":1000}]',
   'Contributor tiers by lifetime points earned'),
  ('voucher_valid_days', '30', 'Days a redeemed voucher stays valid')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tiers
-- ---------------------------------------------------------------------------
create or replace function public.tier_for(p_points integer)
returns table (tier text, next_tier text, next_tier_at integer)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select e ->> 'name' as name, (e ->> 'min')::int as min
    from public.app_config c, jsonb_array_elements(c.value) e
    where c.key = 'tiers'
  )
  select
    (select name from t where min <= p_points order by min desc limit 1),
    (select name from t where min > p_points order by min limit 1),
    (select min from t where min > p_points order by min limit 1);
$$;

create or replace function public.my_stats()
returns table (
  balance integer,
  pending integer,
  lifetime integer,
  tier text,
  next_tier text,
  next_tier_at integer,
  verified_reports integer,
  votes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with lifetime as (
    select coalesce(sum(delta) filter (where delta > 0), 0)::int as points
    from public.points_ledger
    where user_id = auth.uid()
  )
  select
    p.balance, p.pending, l.points, t.tier, t.next_tier, t.next_tier_at,
    (select count(*)::int from public.price_reports where user_id = auth.uid() and status = 'verified'),
    (select count(*)::int from public.report_votes where user_id = auth.uid())
  from public.my_points() p
  cross join lifetime l
  cross join lateral public.tier_for(l.points) t
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Redeem a reward
-- ---------------------------------------------------------------------------
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_code text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  -- One redemption at a time per user, so the same points can't be spent twice.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select * into v_reward from public.rewards where id = p_reward_id and is_active for update;
  if not found then
    raise exception 'reward_unavailable' using errcode = '22023';
  end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'out_of_stock' using errcode = '22023';
  end if;

  select coalesce(sum(delta), 0)::int into v_balance from public.points_ledger where user_id = v_user;
  if v_balance < v_reward.cost_points then
    raise exception 'not_enough_points' using errcode = '22023',
      detail = (v_reward.cost_points - v_balance)::text;
  end if;

  -- Codes like FW-3FA2-9C1B from a cryptographically random UUID.
  loop
    v_code := 'FW-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;
  v_expires := now() + make_interval(days => public.config_number('voucher_valid_days')::int);

  insert into public.redemptions (user_id, reward_id, points_spent, code, expires_at)
  values (v_user, p_reward_id, v_reward.cost_points, v_code, v_expires)
  returning id into v_id;

  insert into public.points_ledger (user_id, delta, reason, ref_id)
  values (v_user, -v_reward.cost_points, 'reward_redeemed', v_id);

  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = p_reward_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'expires_at', v_expires,
    'balance', v_balance - v_reward.cost_points
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard: points earned (not spent) this week (Monday, Manila time) or all time.
-- Shows usernames only. The caller's row is included even when outside the top 50.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard(p_period text default 'week')
returns table (
  rank integer,
  username text,
  display_name text,
  points integer,
  tier text,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with earned as (
    select l.user_id, sum(l.delta)::int as points
    from public.points_ledger l
    where l.delta > 0
      and (p_period = 'all'
           or l.created_at >= (date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
    group by l.user_id
  ),
  ranked as (
    select e.user_id, e.points, rank() over (order by e.points desc)::int as rank
    from earned e
  ),
  lifetime as (
    select user_id, (sum(delta) filter (where delta > 0))::int as points
    from public.points_ledger
    group by user_id
  )
  select
    r.rank,
    p.username,
    p.display_name,
    r.points,
    (select t.tier from public.tier_for(coalesce(lt.points, 0)) t),
    r.user_id = auth.uid()
  from ranked r
  join public.profiles p on p.id = r.user_id
  left join lifetime lt on lt.user_id = r.user_id
  where auth.uid() is not null
    and (r.rank <= 50 or r.user_id = auth.uid())
  order by r.rank, p.username;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.redeem_reward(uuid) from public, anon;
revoke execute on function public.my_stats() from public, anon;
revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.my_stats() to authenticated;
grant execute on function public.leaderboard(text) to authenticated;
