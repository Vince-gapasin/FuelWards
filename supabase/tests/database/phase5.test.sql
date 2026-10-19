begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'watcher@test.local', '{"username":"t_watcher"}'),
  ('77777777-7777-7777-7777-777777777777', 'other@test.local', '{"username":"t_other"}'),
  ('88888888-8888-8888-8888-888888888888', 'reporter5@test.local', '{"username":"t_reporter5"}');

insert into public.stations (id, name, location) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Alert Station',
   extensions.st_setsrid(extensions.st_makepoint(121.0500, 14.5500), 4326)::extensions.geography);

-- Two verified diesel prices on different days, plus one pending.
insert into public.price_reports (id, station_id, user_id, fuel_type, price, reported_at, status) values
  ('a0000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'DIESEL', 61.00, now() - interval '3 days', 'verified'),
  ('a0000000-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'DIESEL', 59.50, now() - interval '1 day', 'verified'),
  ('a0000000-0000-0000-0000-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'DIESEL', 50.00, now(), 'pending');

-- ---------------------------------------------------------------------------
-- Price history (public)
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select count(*)::int from public.station_price_history('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') where fuel_type = 'DIESEL'),
  2,
  'history has one verified price per day'
);
select is(
  (select min(price) from public.station_price_history('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  59.50::numeric,
  'pending prices are not part of the history'
);
select throws_ok(
  $$ select * from public.favorite_stations(14.55, 121.05) $$,
  '42501', null,
  'signed-out users have no favorites'
);

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true); end $$;
select lives_ok(
  $$ insert into public.favorites (station_id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  'a driver can save a station'
);
select throws_ok(
  $$ insert into public.favorites (user_id, station_id)
     values ('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  '42501', null,
  'nobody can save stations for someone else'
);
select is(
  (select name from public.favorite_stations(14.55, 121.05)),
  'Alert Station',
  'saved stations come back with map data'
);

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.create_price_alert('DIESEL', 60.00, 14.5510, 121.0510, 3000, null) $$,
  'a driver can create an area alert'
);
select is(
  (select round(latitude::numeric, 3) from public.my_price_alerts()),
  14.551,
  'alerts come back with their location'
);
select throws_ok(
  $$ select public.create_price_alert('DIESEL', 60.00, null, null, 3000, null) $$,
  '23514', null,
  'an alert needs an area or a station'
);

reset role;
-- Verify the pending ₱50 report: it is under the ₱60 alert and within 3 km.
do $$ begin perform public.decide_report('a0000000-0000-0000-0000-000000000003', 'verified'); end $$;
-- A second cheap price at the same station within 12 hours is not sent again.
insert into public.price_reports (id, station_id, user_id, fuel_type, price, status) values
  ('a0000000-0000-0000-0000-000000000004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'DIESEL', 49.00, 'pending');
do $$ begin perform public.decide_report('a0000000-0000-0000-0000-000000000004', 'verified'); end $$;
-- A gasoline price doesn't match a diesel alert.
insert into public.price_reports (id, station_id, user_id, fuel_type, price, status) values
  ('a0000000-0000-0000-0000-000000000005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'GAS91', 40.00, 'pending');
do $$ begin perform public.decide_report('a0000000-0000-0000-0000-000000000005', 'verified'); end $$;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true); end $$;
select is(
  (select count(*)::int from public.alert_deliveries),
  1,
  'one match is queued: same station within 12 hours and other fuels are skipped'
);
select is(
  (select price from public.alert_deliveries),
  50.00::numeric,
  'the match carries the verified price'
);
select lives_ok(
  $$ update public.alert_deliveries set read_at = now() $$,
  'drivers can mark their matches as read'
);
select throws_ok(
  $$ update public.alert_deliveries set price = 1 $$,
  '42501', null,
  'drivers cannot change a match'
);

do $$ begin perform set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true); end $$;
select is(
  (select count(*)::int from public.alert_deliveries),
  0,
  'drivers cannot see each other''s matches'
);

-- ---------------------------------------------------------------------------
-- DOE bulletin
-- ---------------------------------------------------------------------------
reset role;
insert into public.doe_bulletins (effective_date, fuel_type, change_min, change_max) values
  ((now() at time zone 'Asia/Manila')::date + 1, 'DIESEL', 1.10, 1.30),
  ((now() at time zone 'Asia/Manila')::date + 1, 'GAS91', -0.40, -0.20),
  ((now() at time zone 'Asia/Manila')::date - 30, 'DIESEL', 2.00, 2.50);
set local role anon;
select is(
  (select count(*)::int from public.current_doe_bulletin()),
  2,
  'the current bulletin has this week''s fuels only'
);
select is(
  (select change_max from public.current_doe_bulletin() where fuel_type = 'GAS91'),
  -0.20::numeric,
  'rollbacks are negative changes'
);

select * from finish();
rollback;
