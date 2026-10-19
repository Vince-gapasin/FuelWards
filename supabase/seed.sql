-- Local development seed. Real stations are imported from OpenStreetMap in Phase 2
-- (scripts/import-osm-stations.ts); the five below mirror the Figma prototype around Santa Mesa.

insert into public.brands (slug, name, color) values
  ('petron', 'Petron', '#011D39'),
  ('shell', 'Shell', '#DD1D21'),
  ('caltex', 'Caltex', '#0A5DA6'),
  ('seaoil', 'Seaoil', '#00BF63'),
  ('unioil', 'Unioil', '#46D755'),
  ('cleanfuel', 'Cleanfuel', '#011D39'),
  ('phoenix', 'Phoenix', '#F28C00'),
  ('jetti', 'Jetti', '#E30613'),
  ('flyingv', 'Flying V', '#1B3F94'),
  ('ptt', 'PTT', '#1C4E9D');

insert into public.fuel_types (code, label, short_label, sort) values
  ('GAS91', 'Unleaded 91', 'Reg 91', 1),
  ('GAS95', 'Premium 95', 'Prem 95', 2),
  ('GAS97', 'Premium 97', 'Prem 97', 3),
  ('DIESEL', 'Diesel', 'Diesel', 4),
  ('DIESEL_PLUS', 'Premium Diesel', 'Diesel+', 5),
  ('KEROSENE', 'Kerosene', 'Kero', 6);

insert into public.stations (brand_id, name, address, city, location)
select b.id, s.name, s.address, 'Manila', extensions.st_setsrid(extensions.st_makepoint(s.lng, s.lat), 4326)::extensions.geography
from (values
  ('unioil', 'Unioil Magsaysay (demo)', 'Magsaysay Blvd', 14.6010, 121.0105),
  ('petron', 'Petron Nagtahan (demo)', 'Nagtahan Interchange', 14.6005, 120.9950),
  ('shell', 'Shell R. Magsaysay (demo)', 'R. Magsaysay Blvd', 14.6030, 121.0040),
  ('cleanfuel', 'Clean Fuel Pureza (demo)', 'Pureza St', 14.6015, 121.0058),
  ('seaoil', 'Seaoil Santa Mesa (demo)', 'V. Mapa St', 14.6045, 121.0165)
) as s (brand, name, address, lat, lng)
join public.brands b on b.slug = s.brand;

insert into public.rewards (title, description, partner, cost_points, stock) values
  ('₱50 Fuel Voucher', 'Valid at any partner station.', 'Partner network (demo)', 500, 100),
  ('₱100 Fuel Voucher', 'Valid at any partner station.', 'Partner network (demo)', 950, 50),
  ('Free Car Wash', 'One basic wash at a participating station.', 'Partner network (demo)', 700, 20);
