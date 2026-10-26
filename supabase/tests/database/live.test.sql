begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a7000000-0000-0000-0000-000000000001', 'live-admin@test.local', '{"username":"t_live_admin"}'),
  ('d7000000-0000-0000-0000-000000000001', 'live-d@test.local', '{"username":"t_live_d"}'),
  ('d7000000-0000-0000-0000-000000000002', 'live-e@test.local', '{"username":"t_live_e"}'),
  ('d7000000-0000-0000-0000-000000000003', 'live-f@test.local', '{"username":"t_live_f"}');

update public.profiles set role = 'admin' where id = 'a7000000-0000-0000-0000-000000000001';
-- E has turned the DOE notification off; F has no phone registered.
update public.profiles set notify_doe = false where id = 'd7000000-0000-0000-0000-000000000002';

insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[test-live-d]', 'd7000000-0000-0000-0000-000000000001', 'android'),
  ('ExponentPushToken[test-live-e]', 'd7000000-0000-0000-0000-000000000002', 'android');

insert into public.stations (id, name, location) values
  ('5a000000-0000-0000-0000-000000000001', 'Live Station',
   extensions.st_setsrid(extensions.st_makepoint(121.0700, 14.5700), 4326)::extensions.geography);

-- D: confirmed prices on the two previous Manila days (one before 7:00), and one waiting today.
insert into public.price_reports (id, station_id, user_id, fuel_type, price, reported_at, status, verified_at) values
  ('b7000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001',
   'd7000000-0000-0000-0000-000000000001', 'GAS91', 60.00,
   (((now() at time zone 'Asia/Manila')::date - 2) + time '06:30') at time zone 'Asia/Manila',
   'verified', now() - interval '2 days'),
  ('b7000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000001',
   'd7000000-0000-0000-0000-000000000001', 'GAS95', 65.00,
   (((now() at time zone 'Asia/Manila')::date - 1) + time '12:00') at time zone 'Asia/Manila',
   'verified', now() - interval '1 day'),
  ('b7000000-0000-0000-0000-000000000003', '5a000000-0000-0000-0000-000000000001',
   'd7000000-0000-0000-0000-000000000001', 'DIESEL', 58.00, now(), 'pending', null);

insert into public.doe_bulletins (effective_date, fuel_type, change_min, change_max) values
  ('2026-11-03', 'GAS91', 1.10, 1.30),
  ('2026-11-03', 'DIESEL', -0.50, -0.50);

-- ---------------------------------------------------------------------------
-- Live prices
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     public.price_broadcast_payload((select r from public.price_reports r
                                      where r.id = 'b7000000-0000-0000-0000-000000000001'))) k),
  array['fuel_type', 'price', 'reported_at', 'station_id', 'verified_at'],
  'the live broadcast carries only public fields'
);
select lives_ok(
  $$ select public.decide_report('b7000000-0000-0000-0000-000000000003', 'verified') $$,
  'verifying a price broadcasts without failing'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'realtime' and tablename = 'messages'
             and policyname = 'signed-in users receive live prices' and cmd = 'SELECT'),
  'signed-in users can receive live prices'
);
select ok(
  not exists (select 1 from pg_policies
               where schemaname = 'realtime' and tablename = 'messages'
                 and cmd in ('INSERT', 'ALL') and coalesce(with_check, qual) like '%prices%'),
  'nobody but the database can send live prices'
);

-- ---------------------------------------------------------------------------
-- Badges and streaks
-- ---------------------------------------------------------------------------
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"d7000000-0000-0000-0000-000000000001","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.admin_announce_bulletin('2026-11-03') $$,
  '42501', 'not_admin',
  'drivers cannot send the DOE announcement'
);
select is((public.my_badges() ->> 'current_streak')::int, 3, 'three days in a row is a current streak of 3');
select is((public.my_badges() ->> 'best_streak')::int, 3, 'the best streak is 3');
select ok(
  (select b ->> 'earned_at' is not null from jsonb_array_elements(public.my_badges() -> 'badges') b
    where b ->> 'code' = 'streak_3'),
  'a 3-day streak earns the streak badge'
);
select is(
  (select (b ->> 'progress')::int || '/' || (b ->> 'goal') || ' ' || coalesce(b ->> 'earned_at', 'locked')
     from jsonb_array_elements(public.my_badges() -> 'badges') b where b ->> 'code' = 'prices_10'),
  '3/10 locked',
  'locked badges show progress'
);
select ok(
  (select b ->> 'earned_at' is not null from jsonb_array_elements(public.my_badges() -> 'badges') b
    where b ->> 'code' = 'early_bird'),
  'a confirmed price sent before 7:00 earns early bird'
);

-- ---------------------------------------------------------------------------
-- DOE announcement
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated"}', true); end $$;
select ok(public.admin_announce_bulletin('2026-11-03') >= 1, 'an admin can announce a bulletin');

reset role;
select is(
  (select count(*)::int from public.push_outbox where user_id = 'd7000000-0000-0000-0000-000000000001'),
  1, 'drivers who opted in with a phone get the push'
);
select is(
  (select count(*)::int from public.push_outbox where user_id = 'd7000000-0000-0000-0000-000000000002'),
  0, 'drivers who turned it off do not'
);
select is(
  (select count(*)::int from public.push_outbox where user_id = 'd7000000-0000-0000-0000-000000000003'),
  0, 'drivers without a phone registered do not'
);
select is(
  (select body from public.push_outbox where user_id = 'd7000000-0000-0000-0000-000000000001'),
  'Reg 91 +₱1.10 to +₱1.30, Diesel −₱0.50',
  'the push lists each fuel''s change'
);
select is(
  (select title from public.push_outbox where user_id = 'd7000000-0000-0000-0000-000000000001'),
  'Fuel price adjustment on Tue, Nov 3',
  'the title says what kind of change and when'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.admin_announce_bulletin('2026-11-03') $$,
  '22023', 'already_announced',
  'a week is announced only once'
);
select throws_ok(
  $$ select public.admin_announce_bulletin('2026-11-10') $$,
  '22023', 'no_bulletin',
  'there must be a bulletin to announce'
);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"d7000000-0000-0000-0000-000000000002","role":"authenticated"}', true); end $$;
select is(public.my_settings() ->> 'notify_doe', 'false', 'drivers see their own setting');
select lives_ok($$ select public.set_notify_doe(true) $$, 'drivers can turn the DOE push on');
select is(public.my_settings() ->> 'notify_doe', 'true', 'the change is saved');

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------
reset role;
select ok(public.send_pushes() >= 1, 'the sender sends queued pushes');
select ok(
  (select pushed_at is not null from public.push_outbox
    where user_id = 'd7000000-0000-0000-0000-000000000001'),
  'sent pushes are marked'
);

set local role anon;
select throws_ok(
  $$ select public.my_badges() $$,
  '42501', null,
  'signed-out visitors have no badges'
);

select * from finish();
rollback;
