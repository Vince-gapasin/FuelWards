begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner). Weeks in 2030, so real data can't interfere:
-- Tue 1 Jan to Mon 7 Jan is "last week", from Tue 8 Jan is "this week"; "now" is Wed 9 Jan.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('e8000000-0000-0000-0000-000000000001', 'weekly-reporter@test.local', '{"username":"t_weekly_rep"}'),
  ('e8000000-0000-0000-0000-000000000002', 'weekly-on@test.local', '{"username":"t_weekly_on"}'),
  ('e8000000-0000-0000-0000-000000000003', 'weekly-off@test.local', '{"username":"t_weekly_off"}');

update public.profiles set notify_doe = false where id = 'e8000000-0000-0000-0000-000000000003';
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[test-weekly-on]', 'e8000000-0000-0000-0000-000000000002', 'android'),
  ('ExponentPushToken[test-weekly-off]', 'e8000000-0000-0000-0000-000000000003', 'android');

insert into public.stations (id, name, location, is_active) values
  ('5b000000-0000-0000-0000-000000000001', 'Weekly 1', extensions.st_setsrid(extensions.st_makepoint(121.01, 14.51), 4326)::extensions.geography, true),
  ('5b000000-0000-0000-0000-000000000002', 'Weekly 2', extensions.st_setsrid(extensions.st_makepoint(121.02, 14.52), 4326)::extensions.geography, true),
  ('5b000000-0000-0000-0000-000000000003', 'Weekly 3', extensions.st_setsrid(extensions.st_makepoint(121.03, 14.53), 4326)::extensions.geography, true),
  ('5b000000-0000-0000-0000-000000000005', 'Weekly closed', extensions.st_setsrid(extensions.st_makepoint(121.05, 14.55), 4326)::extensions.geography, false);

insert into public.price_reports (station_id, user_id, fuel_type, price, reported_at, status) values
  -- Last week: diesel at three stations (median 61), Reg 91 at only one.
  ('5b000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 60.00, '2030-01-03 10:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 61.00, '2030-01-04 10:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000003', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 62.00, '2030-01-05 10:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'GAS91', 69.00, '2030-01-05 10:00+08', 'verified'),
  -- This week: station 1 changed its diesel price twice (only the latest counts), median 63.
  ('5b000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 50.00, '2030-01-08 07:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 62.00, '2030-01-08 18:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 63.00, '2030-01-08 18:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000003', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 64.00, '2030-01-09 09:00+08', 'verified'),
  -- A closed station and an unconfirmed price are ignored.
  ('5b000000-0000-0000-0000-000000000005', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 99.00, '2030-01-09 09:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000001', 'DIESEL', 98.00, '2030-01-09 10:00+08', 'pending'),
  -- Reg 91 this week at three stations, but last week had only one.
  ('5b000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'GAS91', 70.00, '2030-01-08 12:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000001', 'GAS91', 71.00, '2030-01-08 12:00+08', 'verified'),
  ('5b000000-0000-0000-0000-000000000003', 'e8000000-0000-0000-0000-000000000001', 'GAS91', 72.00, '2030-01-08 12:00+08', 'verified');

-- ---------------------------------------------------------------------------
-- Weeks
-- ---------------------------------------------------------------------------
select is(public.manila_week_start('2030-01-09 20:00+08'), '2030-01-08'::date, 'a Wednesday belongs to the week that started Tuesday');
select is(public.manila_week_start('2030-01-08 00:30+08'), '2030-01-08'::date, 'the week starts at midnight on Tuesday, Manila time');
select is(public.manila_week_start('2030-01-07 23:30+08'), '2030-01-01'::date, 'Monday night still belongs to the previous week');

-- ---------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------
select is(public.refresh_weekly_price_summary('2030-01-09 20:00+08'), 2, 'the job summarises each fuel with prices this week');
select is(
  (select median_price from public.weekly_price_summaries where week_start = '2030-01-08' and fuel_type = 'DIESEL'),
  63.00::numeric,
  'the median uses each open station''s latest confirmed price'
);
select is(
  (select prev_median from public.weekly_price_summaries where week_start = '2030-01-08' and fuel_type = 'DIESEL'),
  61.00::numeric,
  'last week''s median is kept for comparison'
);
select is(
  (select change from public.current_weekly_prices('2030-01-09 20:00+08') where fuel_type = 'DIESEL'),
  2.00::numeric,
  'the weekly change is this week''s median minus last week''s'
);
select ok(
  (select change is null from public.current_weekly_prices('2030-01-09 20:00+08') where fuel_type = 'GAS91'),
  'no change is shown when last week had too few stations'
);

set local role anon;
select is(
  (select count(*)::int from public.current_weekly_prices('2030-01-09 20:00+08')),
  2,
  'anyone can read the weekly summary'
);
select throws_ok(
  $$ select public.refresh_weekly_price_summary() $$,
  '42501', null,
  'only the scheduled job can rebuild the summary'
);
reset role;

-- ---------------------------------------------------------------------------
-- Announcement
-- ---------------------------------------------------------------------------
select is(public.announce_weekly_prices('2030-01-08 20:00+08'), 0, 'nothing is sent on Tuesday, before prices are in');
select lives_ok($$ select public.announce_weekly_prices('2030-01-09 20:00+08') $$, 'the summary is announced on Wednesday');
select is(
  (select body from public.push_outbox where user_id = 'e8000000-0000-0000-0000-000000000002' and data ->> 'kind' = 'weekly'),
  'Diesel +₱2.00 this week (median of confirmed prices at 3+ stations).',
  'drivers who want weekly prices get the changes that have enough data'
);
select is(
  (select count(*)::int from public.push_outbox where user_id = 'e8000000-0000-0000-0000-000000000003'),
  0,
  'drivers who turned weekly notifications off get nothing'
);
select is(public.announce_weekly_prices('2030-01-10 20:00+08'), 0, 'each week is announced only once');

select * from finish();
rollback;
