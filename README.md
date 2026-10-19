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
