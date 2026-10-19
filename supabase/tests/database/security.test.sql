begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select has_table('public', 'price_reports', 'price_reports exists');
select is((select count(*)::int from public.fuel_types), 6, 'six fuel types are seeded');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.points_ledger'::regclass),
  'RLS is enabled on points_ledger'
);

-- A signed-in user must not be able to write points or reports directly.
set local role authenticated;
select throws_ok(
  $$ insert into public.points_ledger (user_id, delta, reason) values (gen_random_uuid(), 1000, 'cheat') $$,
  '42501',
  null,
  'clients cannot credit themselves points'
);
select throws_ok(
  $$ insert into public.price_reports (station_id, user_id, fuel_type, price)
     select id, gen_random_uuid(), 'DIESEL', 50 from public.stations limit 1 $$,
  '42501',
  null,
  'clients cannot insert price reports directly'
);

-- The OpenStreetMap import includes stations around Santa Mesa.
select ok(
  (select count(*) from public.nearby_stations(14.6015, 121.0058, 3000)) >= 1,
  'nearby_stations finds stations near Santa Mesa'
);

select * from finish();
rollback;
