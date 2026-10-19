# FuelWards

A crowdsourced fuel-price map for the Philippines. Drivers see current pump prices at nearby stations and earn points for verified price reports. The points can be redeemed for fuel vouchers.

- Design: [FUELWARDS Figma prototype](https://www.figma.com/design/mODm20NVwxDhimytGSUtUR/FUELWARDS)
- Why it matters and what the prototype lacks: [docs/analysis.md](docs/analysis.md)

## Stack

- Expo SDK 58 (React Native 0.88, New Architecture) with Expo Router. One codebase for Android, iOS and web.
- NativeWind (Tailwind) for styling. The brand colours come from Figma and live in `src/theme/colors.js`.
- Supabase: Postgres with PostGIS, Auth, Row-Level Security, Edge Functions and Storage.
- TanStack Query, Zustand, react-hook-form and zod.
- MapLibre with free [OpenFreeMap](https://openfreemap.org) tiles: `@maplibre/maplibre-react-native` on phones and `react-map-gl` on web. No map API key is needed.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key. You find these in Supabase under Project Settings → API.
3. Run the app:
   ```bash
   npm run web
   ```
   Use `npm run android` for the Android emulator or a phone.

Map and native modules need a development build (`npx expo run:android` or `npx eas-cli build --profile development`). Expo Go won't run them.

`npm install` also copies MapLibre's web worker into `public/` (`scripts/copy-maplibre-worker.mjs`), because Metro can't bundle it. If the web map shows "Worker failed to load", run `npm install` again and restart the dev server.

## Stations

Stations come from OpenStreetMap (all `amenity=fuel` in and around Metro Manila). To refresh them, run:

```bash
node scripts/import-osm-stations.ts
```

This writes a new migration in `supabase/migrations/` that updates stations by their OpenStreetMap id. Review it, then apply it with `npx supabase db push`. The public Overpass servers are often busy, so the script retries for several minutes.

Station data © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright). The map shows this credit in its attribution button.

## Price reports and points

The app never writes prices or points itself. It calls database functions (`supabase/migrations/20261019130000_price_reports.sql`) that check the rules and write everything in one transaction:

- **Reporting:**
  - The driver must be within 150 m of the station.
  - Each driver can send up to 10 prices an hour, and can't report the same fuel at the same station twice within 3 hours.
  - A price more than 15% away from the median of nearby stations is flagged and needs twice the confirmations.
- **Voting:**
  - Other drivers within 1 km mark a pending price "Correct" or "Wrong".
  - 2 confirmations verify a price, and 2 disputes reject it.
- **Points:**
  - The reporter gets +10 for each verified price.
  - Voters get +2 when their vote matches the result.
  - Pending points show on the account screen.
- **Quiet prices:** if a price isn't flagged and nobody disputes it within 6 hours, a scheduled job (pg_cron, every 15 minutes) verifies it. This keeps prices flowing while there are few drivers.

Every number above lives in the `app_config` table. For a demo away from a real station, raise `max_report_distance_m` and `max_vote_distance_m` there, and put them back afterwards.

## Price alerts and notifications

Drivers set alerts on the Price alerts screen, for example "Diesel at or below ₱58 within 3 km" or "at one saved station". Each driver can have up to 10. When a price becomes verified, a database trigger matches it against active alerts and adds a row to that driver's inbox. The same alert won't fire again for the same station within 12 hours. A pg_cron job (`fuelwards-alert-pushes`, every 5 minutes) then sends the new matches through the Expo push service.

The inbox works everywhere. Phone notifications need two things this repo can't do for you:

1. An Expo project id. Run `npx eas-cli init` once. It adds `extra.eas.projectId` to `app.json`. Until then, the alerts screen says notifications aren't set up.
2. A development build on a real phone. Push notifications don't work in Expo Go, on web or in emulators without Google Play.

## DOE weekly bulletin

The home screen shows the Department of Energy's weekly price adjustment when one is on file for the current week. It shows bulletins from up to 6 days ago through up to 7 days ahead. There's no admin screen yet (Phase 6), so add each week's bulletin in the Supabase SQL editor. Use one row per fuel, with peso-per-litre changes (negative for rollbacks):

```sql
insert into public.doe_bulletins (effective_date, fuel_type, change_min, change_max, source_url) values
  ('2026-10-20', 'GAS91',  0.90, 1.10, 'https://doe.gov.ph/...'),
  ('2026-10-20', 'DIESEL', -0.50, -0.30, 'https://doe.gov.ph/...');
```

Fuel codes are `GAS91`, `GAS95`, `GAS97`, `DIESEL`, `DIESEL_PLUS` and `KEROSENE`. `region` defaults to `NCR`.

## Offline, languages and dark mode

- **Offline:** stations, prices, favorites and your points are saved on the device for 24 hours. With no connection, the app shows the saved data under a banner. Reporting and voting still need a connection.
- **Languages:** English and Filipino. By default the app follows the phone's language, and Profile → Language overrides it. Strings live in `src/i18n/en.ts` and `src/i18n/fil.ts`. A unit test fails if the Filipino file is missing a key or a `{{placeholder}}`.
- **Dark mode:** by default the app follows the phone, and Profile → Appearance overrides it. Theme colours are CSS variables in `src/theme/palette.js`. Use the Tailwind names (`bg-surface`, `text-ink`, `border-line`…) rather than hex values, so screens switch automatically.

## Database

Schema, security rules and seed data live in `supabase/`. Running Supabase locally requires Docker Desktop.

```bash
npm run db:start
```

```bash
npm run db:reset
```

```bash
npm run db:test
```

```bash
npm run db:types
```

- `db:start` starts local Supabase and applies the migrations and `seed.sql`.
- `db:reset` re-applies everything from scratch.
- `db:test` runs the pgTAP tests in `supabase/tests`.
- `db:types` regenerates `src/lib/database.types.ts`.

To push the schema to your hosted project:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

To send the sign-in settings in `supabase/config.toml` (password rules, code length, redirect URLs):

```bash
npx supabase config push
```

### Email codes (needs your own email sender)

The app confirms sign-ups and resets passwords with 6-digit codes, using the templates in `supabase/templates/`. On the free plan, Supabase won't accept custom templates while its built-in email sender is in use. That sender also only delivers to members of your Supabase organisation.

Until a free SMTP provider (for example Brevo or a Gmail app password) is connected:

- Email confirmation is off, so sign-up logs the user straight in.
- Password reset by code doesn't work.

To turn the codes on:

1. Add the SMTP provider under Authentication → Emails → SMTP in the dashboard. Its password must stay out of the repo.
2. In `supabase/config.toml`, uncomment the two `[auth.email.template.*]` sections and set `enable_confirmations = true`.
3. Run `npx supabase config push`.

## Checks

```bash
npm run check
```

This runs the type-check, ESLint, Prettier and the Jest unit tests. CI (`.github/workflows/ci.yml`) also builds the web app and tests the database.
