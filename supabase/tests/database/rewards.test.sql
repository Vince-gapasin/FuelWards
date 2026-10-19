begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner): two drivers with points and a test reward.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'saver@test.local', '{"username":"t_saver"}'),
  ('55555555-5555-5555-5555-555555555555', 'spender@test.local', '{"username":"t_spender"}');

insert into public.points_ledger (user_id, delta, reason) values
  ('44444444-4444-4444-4444-444444444444', 300, 'test'),
  ('55555555-5555-5555-5555-555555555555', 600, 'test');

insert into public.rewards (id, title, cost_points, stock) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Voucher', 500, 5),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sold Out Voucher', 100, 0);
insert into public.rewards (id, title, cost_points, is_active) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Retired Voucher', 100, false);

-- ---------------------------------------------------------------------------
-- Tiers
-- ---------------------------------------------------------------------------
select is((select tier from public.tier_for(0)), 'Bronze', '0 points is Bronze');
select results_eq(
  $$ select tier, next_tier, next_tier_at from public.tier_for(250) $$,
  $$ values ('Silver'::text, 'Gold'::text, 500) $$,
  '250 points is Silver, Gold at 500'
);
select results_eq(
  $$ select tier, next_tier, next_tier_at from public.tier_for(1200) $$,
  $$ values ('Platinum'::text, null::text, null::int) $$,
  '1200 points is Platinum, the top tier'
);

-- ---------------------------------------------------------------------------
-- Redeeming
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select public.redeem_reward('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501', null,
  'signed-out users cannot redeem'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.redeem_reward('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '22023', 'not_enough_points',
  '300 points cannot buy a 500-point reward'
);
select throws_ok(
  $$ select public.redeem_reward('cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '22023', 'out_of_stock',
  'sold-out rewards cannot be redeemed'
);
select throws_ok(
  $$ select public.redeem_reward('dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '22023', 'reward_unavailable',
  'retired rewards cannot be redeemed'
);

do $$ begin perform set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true); end $$;
select matches(
  public.redeem_reward('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') ->> 'code',
  '^FW-[0-9A-F]{4}-[0-9A-F]{4}$',
  'redeeming issues a voucher code'
);
select is((select balance from public.my_stats()), 100, 'the cost is deducted from the balance');
select is((select lifetime from public.my_stats()), 600, 'lifetime points are not reduced by redeeming');
select is((select tier from public.my_stats()), 'Gold', 'the tier follows lifetime points');
select is(
  (select count(*)::int from public.redemptions where reward_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'the voucher appears in the redeemer''s history'
);
select ok(
  (select expires_at > now() + interval '29 days' from public.redemptions
    where reward_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'vouchers are valid for 30 days'
);
select throws_ok(
  $$ select public.redeem_reward('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '22023', 'not_enough_points',
  'the same points cannot be spent twice'
);
select is(
  (select stock from public.rewards where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  4,
  'stock goes down by one'
);
select throws_ok(
  $$ insert into public.redemptions (user_id, reward_id, points_spent, code)
     values (auth.uid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'FREE') $$,
  '42501', null,
  'vouchers cannot be created directly'
);

-- ---------------------------------------------------------------------------
-- Privacy and leaderboard
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true); end $$;
select is(
  (select count(*)::int from public.redemptions where reward_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'drivers cannot see each other''s vouchers'
);
select ok(
  (select rank from public.leaderboard('week') where username = 't_spender')
    < (select rank from public.leaderboard('week') where username = 't_saver'),
  'the leaderboard ranks by points earned'
);
select is(
  (select username from public.leaderboard('all') where is_me),
  't_saver',
  'the caller''s own row is marked'
);

select * from finish();
rollback;
