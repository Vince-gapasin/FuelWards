# FuelWards

A crowdsourced fuel-price map for the Philippines. Drivers see current pump prices at nearby stations and earn points for verified price reports. The points can be redeemed for fuel vouchers.

- Design: [FUELWARDS Figma prototype](https://www.figma.com/design/mODm20NVwxDhimytGSUtUR/FUELWARDS)
- Why it matters and what the prototype lacks: [docs/analysis.md](docs/analysis.md)
- How it's built (diagrams, security model, testing): [docs/architecture.md](docs/architecture.md)
- Try it: [web app](https://fuelwards.vercel.app) · [Android APK](https://github.com/Vince-gapasin/FuelWards/releases/latest)

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

## Live prices and badges

- **Live prices:** when a price is verified, a database trigger broadcasts it on the public Realtime topic `prices` (station, fuel, price and times only, never who sent it). Open apps update the map pin, the station page and saved stations without a reload, and the pin gets a yellow ring for a few seconds. The home screen shows a "Live" badge while connected. An older report confirmed late never replaces a newer price.
- **Badges and streaks:** `my_badges()` works out nine badges (first price, 10 and 50 confirmed prices, first and 10 helpful votes, explorer, early bird, 3- and 7-day streaks) and the current and best day streak from existing reports and votes. They show on the profile, with progress for locked ones and a toast when one is earned. Badges never award points.

## Price alerts and notifications

Drivers set alerts on the Price alerts screen, for example "Diesel at or below ₱58 within 3 km" or "at one saved station". Each driver can have up to 10. When a price becomes verified, a database trigger matches it against active alerts and adds a row to that driver's inbox. The same alert won't fire again for the same station within 12 hours. A pg_cron job (`fuelwards-alert-pushes`, every 5 minutes) runs `send_pushes()`, which sends the new matches, and anything else in `push_outbox`, through the Expo push service.

**DOE weekly adjustment:** after saving a week's bulletin, an admin presses **Notify drivers** in the admin console. Every driver who has a phone registered and hasn't turned it off (Price alerts → Weekly DOE price adjustment) gets one push, e.g. "Fuel price adjustment on Tue, Nov 3: Reg 91 +₱1.10 to +₱1.30, Diesel −₱0.50". Each week can be announced once. Push text is English only, because the server doesn't know each phone's language.

The inbox works everywhere. Phone notifications need two things this repo can't do for you:

1. An Expo project id. This repo is linked to `@gapasin/fuelwards` (`extra.eas.projectId` in `app.json`). A fork runs `npx eas-cli init` once to link its own.
2. A build on a real phone. Push notifications don't work in Expo Go, on web or in emulators without Google Play.

## DOE weekly bulletin

The home screen shows the Department of Energy's weekly price adjustment when one is on file for the current week. It shows bulletins from up to 6 days ago through up to 7 days ahead. Admins enter each week's bulletin in the admin console (DOE bulletins). You can also add them in the Supabase SQL editor, with one row per fuel and peso-per-litre changes (negative for rollbacks):

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
- **Accessibility:** text colours meet WCAG AA contrast (4.5:1) in both themes. Use `text-link` for links, `text-positive` for gains and `text-critical` for errors, not the raw brand colours: the bright Figma green is only 2.3:1 on white. The action blue is a little darker than in Figma (`#0066D6`) so white text on it passes. Every button has a role and a label, and small chips get extra tap area (`hitSlop`).

## Admin console

Admins see **Admin console** in their profile (`/admin`). It is English only and works best in a laptop browser:

- **Price reports:** confirm or reject unusual prices, or any price still waiting. Confirming awards the reporter's points, as if drivers had confirmed it.
- **Users:** search users, and ban or unban them. A ban rejects the user's waiting prices and withdraws their votes, and blocks reporting, voting, alerts and redemptions until it is lifted. Admins can't be banned.
- **Stations:** fix names and addresses, or hide closed stations from the map.
- **Rewards:** add vouchers, change their cost and stock, or turn them off.
- **DOE bulletins:** enter the weekly adjustment.
- **Activity log:** every admin action, including direct edits, with before and after values. Nobody can edit the log.

The server checks `is_admin()` on every admin call. Hiding the console from other users is only a convenience. To make someone an admin, run this in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where username = 'their_username';
```

## Privacy

- New users accept the Privacy Notice when they sign up. An account created any other way is asked to accept it before the app opens.
- Report locations are erased after 12 months by a daily job (`fuelwards-purge-locations`, 03:17 Manila time). The period is `location_retention_months` in `app_config`.
- Profile → Your data lets users download everything FuelWards holds about them as JSON, and delete their account. Deleting removes points, vouchers, saved stations, alerts and waiting prices. Confirmed prices stay on the map, without the reporter's name or location.
- Crash reports (below) never include IP addresses, locations or account details.

## Crash reporting (optional)

The app reports crashes to [Sentry](https://sentry.io) (free Developer plan) when `EXPO_PUBLIC_SENTRY_DSN` is set. It stays off in development and when the DSN is blank.

1. Create a Sentry account and a React Native project. Copy its DSN into `.env.local`, and into the EAS environment for builds.
2. To get readable stack traces, add `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG` and `SENTRY_PROJECT` as EAS environment variables. Then remove `SENTRY_DISABLE_AUTO_UPLOAD` from `eas.json`.

## Release builds and hosting

`eas.json` has three build profiles:

- `development`: a dev client for testing native modules.
- `preview`: an installable APK to share for testing.
- `production`: an AAB for the Play Store, with the version code increased automatically.

They need a free Expo account:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

```bash
npx eas-cli@latest build --platform android --profile preview
```

Android release builds are shrunk with R8 and include only the `arm64-v8a` and `armeabi-v7a` CPU types (every phone sold in years), via `expo-build-properties` in `app.json`. `eas init` also sets the project ID that push notifications need. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and the Sentry values, if you use them) as EAS environment variables first.

The web app is a static site. `vercel.json` builds it with `npm run build:web` and serves `dist/`, sending every path to `index.html` so deep links work. Import the GitHub repo in Vercel (free Hobby plan) and set the two `EXPO_PUBLIC_SUPABASE_*` variables. Then add the Vercel URL to the Supabase redirect URLs in `supabase/config.toml` and run `npx supabase config push`.

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

## Shipping fixes (over-the-air updates)

Installed apps check EAS Update for new JavaScript when they start, so most fixes don't need a new APK:

```bash
npm run update:preview
```

This publishes the current code to the `preview` channel (the GitHub Release APKs), using the latest commit message as the update's description. Users get it on the next restart. Use `npm run update:production` for Play Store builds.

An update is enough for changes to screens, styles, translations and app logic. A new build (and a new GitHub Release) is needed after adding a package with native code, or changing `app.json` plugins, permissions or the icon. `runtimeVersion` uses the `fingerprint` policy, so a build only receives updates made for the same native code.

## Checks

```bash
npm run check
```

This runs the type-check, ESLint, Prettier and the Jest unit tests. CI (`.github/workflows/ci.yml`) also builds the web app, tests the database, and runs the end-to-end tests.

- **Database types:** `src/lib/database.types.ts` is generated from the schema and types the Supabase client. After a migration, run `npm run db:types` and commit the result. CI regenerates the types from the migrations and type-checks the app against them, so code that relies on a renamed or dropped column fails CI.
- **Web end-to-end (Playwright):** `e2e/web` signs up a new driver, searches a station, opens directions, sets an alert, checks badges and the language switch, and confirms `/admin` is closed to drivers. CI runs it against a local Supabase, never the hosted project. Locally, `npm run build:web` and then `npm run e2e:web` (only point it at a local Supabase, since it creates accounts).
- **Phone smoke tests (Maestro):** with a phone connected over USB (or an emulator) and the APK installed, run `maestro test -e EMAIL=you@example.com -e PASSWORD=yourpassword e2e/maestro`. Install Maestro from https://maestro.dev.
- **Architecture and security model:** see [docs/architecture.md](docs/architecture.md).
