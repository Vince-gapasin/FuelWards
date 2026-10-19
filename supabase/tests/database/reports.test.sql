begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner): three drivers and a station at a known spot.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'reporter@test.local', '{"username":"t_reporter"}'),
  ('22222222-2222-2222-2222-222222222222', 'voter1@test.local', '{"username":"t_voter1"}'),
  ('33333333-3333-3333-3333-333333333333', 'voter2@test.local', '{"username":"t_voter2"}');

insert into public.stations (id, name, location) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Station',
   extensions.st_setsrid(extensions.st_makepoint(121.0000, 14.6000), 4326)::extensions.geography);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;

select throws_ok(
  $$ select public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"DIESEL": 57.10}', 14.6100, 121.0000) $$,
  '22023', 'too_far',
  'reporting from about 1 km away is refused'
);
select throws_ok(
  $$ select public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"DIESEL": 5}', 14.6000, 121.0000) $$,
  '22023', 'price_out_of_range',
  'impossible prices are refused'
);
select throws_ok(
  $$ select public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"ROCKET": 60}', 14.6000, 121.0000) $$,
  '22023', 'unknown_fuel',
  'unknown fuel codes are refused'
);
select is(
  (public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"DIESEL": 57.10, "GAS91": 60.80}', 14.6003, 121.0002) ->> 'pending_points')::int,
  20,
  'a nearby report of two fuels is accepted with 20 points pending'
);
select throws_ok(
  $$ select public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"DIESEL": 57.20}', 14.6000, 121.0000) $$,
  '22023', 'already_reported',
  'the same fuel cannot be reported again within the duplicate window'
);
select is(
  (select balance from public.my_points()), 0,
  'nothing is credited before verification'
);
select is(
  (select pending from public.my_points()), 20,
  'my_points shows the pending points'
);
select is(
  (select pending_count from public.nearby_stations(14.6, 121.0, 500) where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'map cards see two pending reports'
);
select throws_ok(
  $$ select reporter_location from public.price_reports $$,
  '42501', null,
  'nobody can read where a reporter was'
);
select throws_ok(
  $$ insert into public.points_ledger (user_id, delta, reason) values (auth.uid(), 999, 'cheat') $$,
  '42501', null,
  'points still cannot be written directly'
);

-- ---------------------------------------------------------------------------
-- Voting
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.vote_on_report(%L, 'confirm', 14.6, 121.0) $$,
         (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'DIESEL')),
  '22023', 'own_report',
  'reporters cannot confirm their own report'
);

do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true); end $$;
select is(
  (public.vote_on_report(
     (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'DIESEL'),
     'confirm', 14.6010, 121.0000) ->> 'status'),
  'pending',
  'one confirmation is not enough'
);
select throws_ok(
  format($$ select public.vote_on_report(%L, 'dispute', 14.6, 121.0) $$,
         (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'DIESEL')),
  '22023', 'already_voted',
  'each driver votes once'
);
select throws_ok(
  format($$ select public.vote_on_report(%L, 'confirm', 14.7, 121.0) $$,
         (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'GAS91')),
  '22023', 'too_far',
  'voting from far away is refused'
);

do $$ begin perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true); end $$;
select is(
  (public.vote_on_report(
     (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'DIESEL'),
     'confirm', 14.6000, 121.0010) ->> 'status'),
  'verified',
  'a second confirmation verifies the report'
);
select is(
  (select (prices -> 'DIESEL' ->> 'price')::numeric from public.nearby_stations(14.6, 121.0, 500)
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  57.10,
  'the verified price appears on the map'
);
select is((select balance from public.my_points()), 2, 'a confirming voter earns 2 points');

-- Dispute the GAS91 report twice (voter1 is near the station this time).
select is(
  (public.vote_on_report(
     (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'GAS91'),
     'dispute', 14.6, 121.0) ->> 'status'),
  'pending',
  'one dispute is not enough to reject'
);
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true); end $$;
select is(
  (public.vote_on_report(
     (select id from public.station_pending_reports('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where fuel_type = 'GAS91'),
     'dispute', 14.6, 121.0) ->> 'status'),
  'rejected',
  'two disputes reject the report'
);
select is((select balance from public.my_points()), 4, 'voter1 earned 2 for confirming and 2 for disputing');

do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
select is(
  (select balance from public.my_points()), 10,
  'the reporter earns 10 for the verified report and nothing for the rejected one'
);
select is((select pending from public.my_points()), 0, 'no points left pending');

-- ---------------------------------------------------------------------------
-- Auto-verify job and permissions
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.process_pending_reports() $$,
  '42501', null,
  'users cannot run the auto-verify job'
);

reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
select lives_ok(
  $q$ select public.submit_price_report('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"GAS95": 64.10}', 14.6, 121.0) $q$,
  'a third fuel can be reported'
);
update public.price_reports set reported_at = now() - interval '7 hours'
 where fuel_type = 'GAS95' and station_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(public.process_pending_reports(), 1, 'a quiet report older than 6 hours is auto-verified');

select * from finish();
rollback;
