// Imports Metro Manila fuel stations from OpenStreetMap into a new Supabase migration.
//
//   node scripts/import-osm-stations.ts
//
// Then review the generated file and apply it with `npx supabase db push`.
// Overpass servers are shared and often busy, so requests retry with exponential backoff.

import { readdirSync, writeFileSync } from 'node:fs';

import { toSql, toStation, type OsmElement, type StationRow } from './osm-stations.ts';

// Metro Manila plus its immediate edges (south, west, north, east).
const BBOX = '14.35,120.90,14.78,121.14';
const QUERY = `[out:json][timeout:120];nwr["amenity"="fuel"](${BBOX});out center tags;`;
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'FuelWards/0.1 (capstone project; https://github.com/Vince-gapasin/FuelWards)';
const MAX_ROUNDS = 6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchElements(): Promise<OsmElement[]> {
  let wait = 15_000;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (const server of SERVERS) {
      try {
        const res = await fetch(server, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(QUERY)}`,
        });
        if (res.ok) {
          const json = (await res.json()) as { elements: OsmElement[] };
          console.log(`Fetched ${json.elements.length} elements from ${server}`);
          return json.elements;
        }
        console.log(`${server} → HTTP ${res.status}`);
      } catch (e) {
        console.log(`${server} → ${(e as Error).message}`);
      }
    }
    if (round < MAX_ROUNDS) {
      console.log(`All servers busy (round ${round}/${MAX_ROUNDS}); retrying in ${wait / 1000}s`);
      await sleep(wait);
      wait = Math.min(wait * 2, 240_000);
    }
  }
  throw new Error('Overpass servers are unavailable. Try again later.');
}

const elements = await fetchElements();
const stations = elements.map(toStation).filter((s): s is StationRow => s !== null);
// Keep one row per osm id (Overpass can repeat elements) and a stable order for clean diffs.
const unique = [...new Map(stations.map((s) => [s.osmId, s])).values()].sort(
  (a, b) => a.osmId - b.osmId,
);

// Migrations apply in filename order, so the new one must sort after every existing migration.
const now = Number(new Date().toISOString().replace(/\D/g, '').slice(0, 14));
const latest = Math.max(
  0,
  ...readdirSync('supabase/migrations').map((f) => Number(f.slice(0, 14)) || 0),
);
const file = `supabase/migrations/${Math.max(now, latest + 1)}_import_ncr_stations.sql`;
writeFileSync(
  file,
  toSql(unique, `Overpass API, bbox ${BBOX}, ${new Date().toISOString().slice(0, 10)}`),
);

const byBrand = unique.reduce<Record<string, number>>((acc, s) => {
  const key = s.brandSlug ?? 'independent';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
console.log(`Wrote ${unique.length} stations to ${file}`);
console.log(byBrand);
