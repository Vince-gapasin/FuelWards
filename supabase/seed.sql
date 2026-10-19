-- Local development seed (runs after the migrations). Stations and the full brand list come from
-- the OpenStreetMap import migration; brands here are skipped if that migration already added them.

insert into public.brands (slug, name, color) values
  ('petron', 'Petron', '#011D39'),
  ('shell', 'Shell', '#DD1D21'),
  ('caltex', 'Caltex', '#0A5DA6'),
  ('seaoil', 'Seaoil', '#00BF63'),
  ('unioil', 'Unioil', '#46D755'),
  ('cleanfuel', 'Cleanfuel', '#034B93'),
  ('phoenix', 'Phoenix', '#F28C00'),
  ('jetti', 'Jetti', '#E30613'),
  ('flyingv', 'Flying V', '#1B3F94'),
  ('ptt', 'PTT', '#1C4E9D')
on conflict (slug) do nothing;

insert into public.fuel_types (code, label, short_label, sort) values
  ('GAS91', 'Unleaded 91', 'Reg 91', 1),
  ('GAS95', 'Premium 95', 'Prem 95', 2),
  ('GAS97', 'Premium 97', 'Prem 97', 3),
  ('DIESEL', 'Diesel', 'Diesel', 4),
  ('DIESEL_PLUS', 'Premium Diesel', 'Diesel+', 5),
  ('KEROSENE', 'Kerosene', 'Kero', 6)
on conflict (code) do nothing;

insert into public.rewards (title, description, partner, cost_points, stock) values
  ('₱50 Fuel Voucher', 'Valid at any partner station.', 'Partner network (demo)', 500, 100),
  ('₱100 Fuel Voucher', 'Valid at any partner station.', 'Partner network (demo)', 950, 50),
  ('Free Car Wash', 'One basic wash at a participating station.', 'Partner network (demo)', 700, 20);
