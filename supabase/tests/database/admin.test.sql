begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@test.local', '{"username":"t_admin"}'),
  ('b2222222-2222-2222-2222-222222222222', 'cheater@test.local', '{"username":"t_cheater"}'),
  ('c3333333-3333-3333-3333-333333333333', 'voter6@test.local', '{"username":"t_voter6"}');

-- Only the test admin is an admin inside this transaction (it always rolls back).
update public.profiles set role = 'user' where role = 'admin';
update public.profiles set role = 'admin' where id = 'a1111111-1111-1111-1111-111111111111';

insert into public.stations (id, name, location) values
  ('dddddddd-0000-0000-0000-000000000001', 'Moderation Station',
   extensions.st_setsrid(extensions.st_makepoint(121.0600, 14.5600), 4326)::extensions.geography);

insert into public.price_reports
  (id, station_id, user_id, fuel_type, price, reported_at, status, flagged, flag_reason, reporter_location)
values
  ('f0000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
   'b2222222-2222-2222-2222-222222222222', 'DIESEL', 40.00, now() - interval '1 hour', 'pending', true,
   '30% away from the nearby median of 57.00',
   extensions.st_setsrid(extensions.st_makepoint(121.0600, 14.5600), 4326)::extensions.geography),
  ('f0000000-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001',
   'b2222222-2222-2222-2222-222222222222', 'GAS91', 60.00, now() - interval '2 hours', 'pending', false, null,
   extensions.st_setsrid(extensions.st_makepoint(121.0600, 14.5600), 4326)::extensions.geography),
  ('f0000000-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001',
   'b2222222-2222-2222-2222-222222222222', 'GAS95', 65.00, now() - interval '13 months', 'verified', false, null,
   extensions.st_setsrid(extensions.st_makepoint(121.0600, 14.5600), 4326)::extensions.geography);

insert into public.report_votes (report_id, user_id, vote) values
  ('f0000000-0000-0000-0000-000000000002', 'c3333333-3333-3333-3333-333333333333', 'confirm');

-- ---------------------------------------------------------------------------
-- Only admins reach the console
-- ---------------------------------------------------------------------------
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.admin_overview() $$,
  '42501', 'not_admin',
  'regular users cannot open the admin overview'
);
select throws_ok(
  $$ select public.admin_set_ban('b2222222-2222-2222-2222-222222222222', true, 'spam') $$,
  '42501', 'not_admin',
  'regular users cannot ban anyone'
);
select throws_ok(
  $$ select banned_at from public.profiles $$,
  '42501', null,
  'users cannot see who is banned'
);

-- ---------------------------------------------------------------------------
-- Report moderation
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
select ok(
  (public.admin_overview() ->> 'flagged')::int >= 1,
  'the overview counts flagged prices'
);
select is(
  (select count(*)::int from public.admin_report_queue('flagged') where station_id = 'dddddddd-0000-0000-0000-000000000001'),
  1,
  'the flagged queue shows only unusual prices'
);
select is(
  (select count(*)::int from public.admin_report_queue('pending') where station_id = 'dddddddd-0000-0000-0000-000000000001'),
  2,
  'the pending queue shows every waiting price'
);
select is(
  (select confirms from public.admin_report_queue('pending') where id = 'f0000000-0000-0000-0000-000000000002'),
  1,
  'the queue shows vote counts'
);
select lives_ok(
  $$ select public.admin_decide_report('f0000000-0000-0000-0000-000000000001', 'verified') $$,
  'an admin can confirm a flagged price'
);
select throws_ok(
  $$ select public.admin_decide_report('f0000000-0000-0000-0000-000000000001', 'rejected') $$,
  '22023', 'already_decided',
  'a decided price cannot be decided again'
);
select is(
  (select count(*)::int from public.admin_recent_actions() where action = 'decide_report'
     and target_id = 'f0000000-0000-0000-0000-000000000001'),
  1,
  'moderation decisions are logged'
);

-- ---------------------------------------------------------------------------
-- Bans
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.admin_set_ban('a1111111-1111-1111-1111-111111111111', true, null) $$,
  '22023', 'cannot_ban_self',
  'admins cannot ban themselves'
);
select lives_ok(
  $$ select public.admin_set_ban('b2222222-2222-2222-2222-222222222222', true, 'fake prices') $$,
  'an admin can ban a user'
);
select is(
  (select banned_at is not null from public.admin_users('t_cheater')),
  true,
  'the user list shows the ban'
);

reset role;
select is(
  (select status::text from public.price_reports where id = 'f0000000-0000-0000-0000-000000000002'),
  'rejected',
  'banning rejects the user''s waiting prices'
);
select is(
  (select count(*)::int from public.points_ledger where user_id = 'b2222222-2222-2222-2222-222222222222'
     and reason = 'report_verified'),
  1,
  'the admin-confirmed price earned its points'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.submit_price_report('dddddddd-0000-0000-0000-000000000001', '{"GAS97": 70.00}', 14.5600, 121.0600) $$,
  '22023', 'banned',
  'banned users cannot report prices'
);
select throws_ok(
  $$ select public.create_price_alert('DIESEL', 55.00, 14.56, 121.06, 3000, null) $$,
  '22023', 'banned',
  'banned users cannot set alerts'
);

do $$ begin perform set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
select lives_ok(
  $$ select public.admin_set_ban('b2222222-2222-2222-2222-222222222222', false, null) $$,
  'an admin can lift a ban'
);

-- Direct edits from the console are logged.
update public.stations set name = 'Moderation Station (closed)' where id = 'dddddddd-0000-0000-0000-000000000001';
select is(
  (select detail -> 'after' ->> 'name' from public.admin_recent_actions()
    where target_table = 'stations' and target_id = 'dddddddd-0000-0000-0000-000000000001'),
  'Moderation Station (closed)',
  'station edits are logged with the new values'
);

-- ---------------------------------------------------------------------------
-- Privacy
-- ---------------------------------------------------------------------------
reset role;
select ok(
  public.purge_old_report_locations() >= 1,
  'the retention job erases old report locations'
);
select is(
  (select count(*)::int from public.price_reports
    where station_id = 'dddddddd-0000-0000-0000-000000000001' and reporter_location is not null),
  2,
  'recent report locations are kept'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true); end $$;
select is(
  (select jsonb_array_length(public.my_data_export() -> 'price_reports')),
  3,
  'users can export their own reports'
);
select is(
  public.my_data_export() -> 'account' ->> 'email',
  'cheater@test.local',
  'the export includes the account email'
);
select lives_ok(
  $$ select public.delete_my_account() $$,
  'users can delete their account'
);

reset role;
select is(
  (select count(*)::int from public.price_reports
    where station_id = 'dddddddd-0000-0000-0000-000000000001' and user_id is null and reporter_location is null),
  3,
  'decided prices stay on the map without their reporter or location'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
select throws_ok(
  $$ select public.delete_my_account() $$,
  '22023', 'last_admin',
  'the last admin cannot delete their account'
);

select * from finish();
rollback;
