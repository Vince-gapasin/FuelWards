begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- ---------------------------------------------------------------------------
-- Setup (as the database owner). Weeks are relative to today, because only recent weeks are shown.
-- ---------------------------------------------------------------------------
insert into public.ingest_tokens (name, token_hash)
values ('doe_prices', extensions.digest('test-doe-token', 'sha256'))
on conflict (name) do update set token_hash = excluded.token_hash;

insert into public.stations (id, name, location, region) values
  ('5d000000-0000-0000-0000-000000000001', 'DOE test no region',
   extensions.st_setsrid(extensions.st_makepoint(120.98, 14.60), 4326)::extensions.geography, null),
  ('5d000000-0000-0000-0000-000000000002', 'DOE test Naga',
   extensions.st_setsrid(extensions.st_makepoint(123.19, 13.62), 4326)::extensions.geography, 'V');

create temp table weeks as
select (now() at time zone 'Asia/Manila')::date - 15 as old_start,
       (now() at time zone 'Asia/Manila')::date - 9 as old_end,
       (now() at time zone 'Asia/Manila')::date - 8 as new_start,
       (now() at time zone 'Asia/Manila')::date - 2 as new_end;
grant select on weeks to public;

create temp table reports as
select jsonb_build_object(
         'region', 'V', 'week_start', w.new_start, 'week_end', w.new_end,
         'source_url', 'https://example.test/bicol-new.pdf',
         'rows', jsonb_build_array(
           jsonb_build_object('area', 'Naga', 'fuel_type', 'DIESEL', 'price_min', 86, 'price_max', 96.8, 'common_price', 93),
           jsonb_build_object('area', 'Iriga', 'fuel_type', 'DIESEL', 'price_min', 85.8, 'price_max', 93.95, 'common_price', null),
           jsonb_build_object('area', 'Legazpi', 'fuel_type', 'DIESEL', 'price_min', 90, 'price_max', 99, 'common_price', 91),
           jsonb_build_object('area', 'Naga', 'fuel_type', 'GAS91', 'price_min', 82, 'price_max', 89.2, 'common_price', 85)
         )) as new_week,
       jsonb_build_object(
         'region', 'V', 'week_start', w.old_start, 'week_end', w.old_end,
         'source_url', 'https://example.test/bicol-old.pdf',
         'rows', jsonb_build_array(
           jsonb_build_object('area', 'Naga', 'fuel_type', 'DIESEL', 'price_min', 70, 'price_max', 71, 'common_price', 70)
         )) as old_week
  from weeks w;
grant select on reports to public;

-- ---------------------------------------------------------------------------
-- Import
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$ select public.ingest_doe_prices('wrong-token', (select new_week from reports)) $$,
  '28000', 'invalid_token',
  'an import without the right token is refused'
);
select is(
  public.ingest_doe_prices('test-doe-token', (select old_week from reports)),
  1,
  'the job can import a week with the token'
);
select is(
  public.ingest_doe_prices('test-doe-token', (select new_week from reports)),
  4,
  'each city and fuel is stored'
);
select is(
  public.ingest_doe_prices('test-doe-token', (select new_week from reports)),
  4,
  'importing the same week again replaces it instead of adding rows'
);
select throws_ok(
  $$ select public.ingest_doe_prices('test-doe-token',
       jsonb_set((select new_week from reports), '{rows,0,price_min}', '120')) $$,
  '22023', 'bad_rows',
  'a lowest price above the highest price is refused'
);
select throws_ok(
  $$ select public.ingest_doe_prices('test-doe-token',
       jsonb_set((select new_week from reports), '{rows,0,price_max}', '9999')) $$,
  '22023', 'bad_rows',
  'impossible prices are refused'
);
select throws_ok(
  $$ select public.ingest_doe_prices('test-doe-token',
       jsonb_set((select new_week from reports), '{region}', '"XIII"')) $$,
  '22023', 'unknown_region',
  'regions the app does not cover are refused'
);
select throws_ok(
  $$ select public.ingest_doe_prices('test-doe-token',
       jsonb_set((select new_week from reports), '{rows}', '[]')) $$,
  '22023', 'no_rows',
  'an empty report is refused'
);
select throws_ok(
  $$ insert into public.doe_area_prices (week_start, region, area, fuel_type, price_min, price_max)
     values (current_date, 'V', 'Fake', 'DIESEL', 1, 2) $$,
  '42501', null,
  'clients cannot write DOE prices directly'
);
select throws_ok(
  $$ select * from public.ingest_tokens $$,
  '42501', null,
  'clients cannot read import tokens'
);

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
select is(
  (select week_start from public.doe_prices('V') limit 1),
  (select new_start from weeks),
  'the latest week is shown'
);
select is(
  (select price_min from public.doe_prices('V') where fuel_type = 'DIESEL'),
  85.80::numeric,
  'the lowest price is the lowest seen in any city'
);
select is(
  (select price_max from public.doe_prices('V') where fuel_type = 'DIESEL'),
  99.00::numeric,
  'the highest price is the highest seen in any city'
);
select is(
  (select typical_price from public.doe_prices('V') where fuel_type = 'DIESEL'),
  91.00::numeric,
  'the typical price is the median of the cities'' common prices (or range midpoints)'
);
select is(
  (select array_agg(fuel_type) from public.doe_prices('V')),
  array['GAS91', 'DIESEL'],
  'fuels come in the app''s usual order'
);
select is(
  (select count(*)::int from public.doe_prices_for_station('5d000000-0000-0000-0000-000000000001')),
  0,
  'a station without a region shows no DOE prices'
);
select is(
  (select count(*)::int from public.doe_prices_for_station('5d000000-0000-0000-0000-000000000002')),
  2,
  'a station shows its own region''s DOE prices'
);
select is(
  (select region_name from public.doe_prices_near(13.63, 123.18) limit 1),
  'Bicol Region',
  'the map shows the DOE prices of the region around its centre'
);

reset role;
select * from finish();
rollback;
