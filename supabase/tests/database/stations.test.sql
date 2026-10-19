begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Two known stations so the test doesn't depend on the OpenStreetMap import.
insert into public.stations (brand_id, name, address, city, location)
select b.id, 'Test Shell Aurora', 'Aurora Boulevard', 'Quezon City',
       extensions.st_setsrid(extensions.st_makepoint(121.0300, 14.6200), 4326)::extensions.geography
from public.brands b where b.slug = 'shell';
insert into public.stations (name, address, city, location)
values ('Test 50%_Off Gas', 'Sample St', 'Manila',
        extensions.st_setsrid(extensions.st_makepoint(121.0310, 14.6210), 4326)::extensions.geography);

set local role anon;

select ok(
  exists (select 1 from public.search_stations('shell aurora', 14.62, 121.03) where name = 'Test Shell Aurora'),
  'multi-word search matches brand and street in any order'
);
select ok(
  exists (select 1 from public.search_stations('Aurora Quezon', 14.62, 121.03) where name = 'Test Shell Aurora'),
  'each word may match a different field'
);
select ok(
  not exists (select 1 from public.search_stations('shell nowhere', 14.62, 121.03) where name = 'Test Shell Aurora'),
  'every word must match'
);
select ok(
  exists (select 1 from public.search_stations('50%_', 14.62, 121.03) where name = 'Test 50%_Off Gas')
  and not exists (select 1 from public.search_stations('50%_', 14.62, 121.03) where name = 'Test Shell Aurora'),
  '% and _ are matched literally, not as wildcards'
);
select is(
  (select count(*)::int from public.search_stations('a', 14.62, 121.03)),
  0,
  'one-letter searches return nothing'
);

select ok(
  (select distance_m from public.nearby_stations(14.62, 121.03, 1000) where name = 'Test Shell Aurora') < 50,
  'nearby_stations returns distance in metres'
);

select * from finish();
rollback;
