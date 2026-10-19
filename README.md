# FuelWards

A crowdsourced fuel-price map for the Philippines. Drivers see current pump prices at nearby stations and earn points for verified price reports. The points can be redeemed for fuel vouchers.

- Design: [FUELWARDS Figma prototype](https://www.figma.com/design/mODm20NVwxDhimytGSUtUR/FUELWARDS)
- Why it matters and what the prototype lacks: [docs/analysis.md](docs/analysis.md)

## Stack

- Expo SDK 58 (React Native 0.88, New Architecture) with Expo Router. One codebase for Android, iOS and web.
- NativeWind (Tailwind) for styling. The brand colours come from Figma and live in `src/theme/colors.js`.
- Supabase: Postgres with PostGIS, Auth, Row-Level Security, Edge Functions and Storage.
- TanStack Query, Zustand, react-hook-form and zod.

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

### Email codes on the hosted project

The app confirms sign-ups and resets passwords with 6-digit codes, not links. In the Supabase dashboard, under Authentication → Emails:

- **Confirm signup:** use the contents of `supabase/templates/confirmation.html`.
- **Reset password:** use the contents of `supabase/templates/recovery.html`.
- Keep **Confirm email** turned on (Authentication → Sign In / Providers).

Supabase's built-in email sender allows only a few emails per hour. That's enough for a demo. For testing with many accounts, connect a free SMTP provider under Authentication → Emails → SMTP.

## Checks

```bash
npm run check
```

This runs the type-check, ESLint, Prettier and the Jest unit tests. CI (`.github/workflows/ci.yml`) also builds the web app and tests the database.
