-- FuelWards initial schema.
-- Clients only READ prices and points. Every write that creates value (price reports, votes,
-- points, redemptions) goes through Edge Functions using the service role, so RLS below
-- deliberately has no insert/update policies for those tables.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.report_status as enum ('pending', 'verified', 'rejected');
create type public.vote_kind as enum ('confirm', 'dispute');
create type public.redemption_status as enum ('issued', 'used', 'expired', 'cancelled');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null
    check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- "Vince" and "vince" are the same username.
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- Lets the sign-up form check a username before creating the account (callable by anon).
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Create the profile from the sign-up metadata ({ username, display_name }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, privacy_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(replace(new.id::text, '-', ''), 1, 12)),
    new.raw_user_meta_data ->> 'display_name',
    (new.raw_user_meta_data ->> 'privacy_accepted_at')::timestamptz
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.brands (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  color text not null default '#011D39'
);

create table public.fuel_types (
  code text primary key,
  label text not null,
  short_label text not null,
  sort smallint not null default 0
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text
);

insert into public.app_config (key, value, description) values
  ('report_points', '10', 'Points credited when a price report is verified'),
  ('vote_points', '2', 'Points credited for a confirm/dispute vote that matches the final outcome'),
  ('max_report_distance_m', '150', 'Reporter must be this close to the station'),
  ('reports_per_hour', '10', 'Rate limit per user'),
  ('confirmations_to_verify', '2', 'Confirm votes needed to verify a report'),
  ('outlier_ratio', '0.15', 'Flag a report this far (as a fraction) from the nearby median');

-- ---------------------------------------------------------------------------
-- Stations
-- ---------------------------------------------------------------------------
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  brand_id smallint references public.brands (id),
  name text not null,
  address text,
  city text,
  location extensions.geography (point, 4326) not null,
  osm_id bigint unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index stations_location_idx on public.stations using gist (location);
create index stations_brand_idx on public.stations (brand_id);

-- ---------------------------------------------------------------------------
-- Price reports and verification votes
-- ---------------------------------------------------------------------------
create table public.price_reports (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fuel_type text not null references public.fuel_types (code),
  price numeric(6, 2) not null check (price > 20 and price < 300),
  reported_at timestamptz not null default now(),
  reporter_location extensions.geography (point, 4326),
  distance_m real,
  photo_path text,
  status public.report_status not null default 'pending',
  flagged boolean not null default false,
  flag_reason text,
  verified_at timestamptz
);

create index price_reports_station_fuel_idx
  on public.price_reports (station_id, fuel_type, reported_at desc);
create index price_reports_user_idx on public.price_reports (user_id, reported_at desc);
create index price_reports_pending_idx on public.price_reports (status) where status = 'pending';

create table public.report_votes (
  report_id uuid not null references public.price_reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote public.vote_kind not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Points (append-only ledger) and rewards
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index points_ledger_user_idx on public.points_ledger (user_id);

create view public.user_points
with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::integer as balance
  from public.points_ledger
  group by user_id;

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  partner text,
  cost_points integer not null check (cost_points > 0),
  stock integer check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id),
  points_spent integer not null check (points_spent > 0),
  code text not null unique,
  status public.redemption_status not null default 'issued',
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index redemptions_user_idx on public.redemptions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Personal lists and alerts
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fuel_type text not null references public.fuel_types (code),
  max_price numeric(6, 2) not null check (max_price > 0),
  center extensions.geography (point, 4326),
  radius_m integer not null default 3000 check (radius_m between 500 and 50000),
  station_id uuid references public.stations (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (center is not null or station_id is not null)
);

-- ---------------------------------------------------------------------------
-- DOE weekly price adjustment bulletins (entered by admins)
-- ---------------------------------------------------------------------------
create table public.doe_bulletins (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null,
  fuel_type text not null references public.fuel_types (code),
  region text not null default 'NCR',
  change_min numeric(6, 2) not null,
  change_max numeric(6, 2) not null,
  source_url text,
  created_at timestamptz not null default now(),
  unique (effective_date, fuel_type, region),
  check (change_min <= change_max)
);

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------
-- Latest verified price per station and fuel type.
create view public.station_latest_prices
with (security_invoker = true) as
  select distinct on (station_id, fuel_type)
    station_id, fuel_type, price, reported_at
  from public.price_reports
  where status = 'verified'
  order by station_id, fuel_type, reported_at desc;

-- Stations within radius_m of a point, nearest first, with their latest prices.
create or replace function public.nearby_stations(
  lat double precision,
  lng double precision,
  radius_m integer default 5000
)
returns table (
  id uuid,
  name text,
  brand text,
  brand_color text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  prices jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select
    s.id,
    s.name,
    b.name as brand,
    b.color as brand_color,
    s.address,
    extensions.st_y(s.location::extensions.geometry) as latitude,
    extensions.st_x(s.location::extensions.geometry) as longitude,
    extensions.st_distance(s.location, o.g) as distance_m,
    coalesce(
      (select jsonb_object_agg(p.fuel_type, jsonb_build_object('price', p.price, 'reported_at', p.reported_at))
       from public.station_latest_prices p
       where p.station_id = s.id),
      '{}'::jsonb
    ) as prices
  from public.stations s
  cross join origin o
  left join public.brands b on b.id = s.brand_id
  where s.is_active
    and extensions.st_dwithin(s.location, o.g, least(radius_m, 50000))
  order by distance_m
  limit 200;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.fuel_types enable row level security;
alter table public.app_config enable row level security;
alter table public.stations enable row level security;
alter table public.price_reports enable row level security;
alter table public.report_votes enable row level security;
alter table public.points_ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.favorites enable row level security;
alter table public.price_alerts enable row level security;
alter table public.doe_bulletins enable row level security;

-- Profiles: usernames are public (leaderboard); users may edit only safe columns of their own row.
create policy "profiles are readable" on public.profiles
  for select to anon, authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, privacy_accepted_at) on public.profiles to authenticated;

-- Public reference data.
create policy "brands are readable" on public.brands for select to anon, authenticated using (true);
create policy "fuel types are readable" on public.fuel_types for select to anon, authenticated using (true);
create policy "config is readable" on public.app_config for select to anon, authenticated using (true);
create policy "active stations are readable" on public.stations
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "active rewards are readable" on public.rewards
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "bulletins are readable" on public.doe_bulletins for select to anon, authenticated using (true);

-- Admin management.
create policy "admins manage brands" on public.brands
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage stations" on public.stations
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage rewards" on public.rewards
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage bulletins" on public.doe_bulletins
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage config" on public.app_config
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Price reports: verified ones are public; pending ones are visible to signed-in users so they
-- can confirm/dispute; rejected ones only to the reporter and admins. No client writes.
create policy "reports are readable" on public.price_reports
  for select to anon, authenticated
  using (
    status = 'verified'
    or (status = 'pending' and (select auth.uid()) is not null)
    or user_id = (select auth.uid())
    or (select public.is_admin())
  );
create policy "admins moderate reports" on public.price_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Votes, points and redemptions: owners read their own rows. No client writes.
create policy "users read own votes" on public.report_votes
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users read own points" on public.points_ledger
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users read own redemptions" on public.redemptions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Favorites and alerts: owners have full control.
create policy "users manage own favorites" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage own alerts" on public.price_alerts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
