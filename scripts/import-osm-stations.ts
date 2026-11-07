// Imports fuel stations from OpenStreetMap into a new Supabase migration, one query per region
// the app covers (the same regions as the DOE price import), tagging each station with its region.
//
//   node scripts/import-osm-stations.ts
//
// Then review the generated file and apply it with `npx supabase db push`.
// Overpass servers are shared and often busy, so requests retry with exponential backoff.

import { readdirSync, writeFileSync } from 'node:fs';

import { toSql, toStation, type OsmElement, type StationRow } from './osm-stations.ts';

// OSM administrative boundaries (relation id + 3600000000 = Overpass area id), keyed by the
// DOE region code used in public.doe_regions. Metro Manila first: a station on a shared border
// keeps the first region it was found in.
const REGIONS: { code: string; name: string; area: number }[] = [
  { code: 'NCR', name: 'Metro Manila', area: 3600147488 },
  { code: 'III', name: 'Central Luzon', area: 3601552195 },
  { code: 'IV-A', name: 'CALABARZON', area: 3601552120 },
  { code: 'IV-B', name: 'MIMAROPA', area: 3601552261 },
  { code: 'V', name: 'Bicol Region', area: 3603561455 },
];
const query = (area: number) =>
  `[out:json][timeout:180];area(id:${area})->.r;nwr["amenity"="fuel"](area.r);out center tags;`;
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'FuelWards/0.2 (capstone project; https://github.com/Vince-gapasin/FuelWards)';
const MAX_ROUNDS = 6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchElements(q: string): Promise<OsmElement[]> {
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
          body: `data=${encodeURIComponent(q)}`,
        });
        if (res.ok) {
          const json = (await res.json()) as { elements: OsmElement[] };
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

// One row per osm id (Overpass can repeat elements; border stations can appear in two regions).
const byId = new Map<number, StationRow>();
for (const region of REGIONS) {
  const elements = await fetchElements(query(region.area));
  let added = 0;
  for (const el of elements) {
    const station = toStation(el);
    if (station && !byId.has(station.osmId)) {
      byId.set(station.osmId, { ...station, region: region.code });
      added++;
    }
  }
  console.log(`${region.name}: ${elements.length} elements, ${added} stations`);
}
// A stable order for clean diffs.
const unique = [...byId.values()].sort((a, b) => a.osmId - b.osmId);

// Migrations apply in filename order, so the new one must sort after every existing migration.
const now = Number(new Date().toISOString().replace(/\D/g, '').slice(0, 14));
const latest = Math.max(
  0,
  ...readdirSync('supabase/migrations').map((f) => Number(f.slice(0, 14)) || 0),
);
const file = `supabase/migrations/${Math.max(now, latest + 1)}_import_luzon_stations.sql`;
writeFileSync(
  file,
  toSql(
    unique,
    `Overpass API, regions ${REGIONS.map((r) => r.code).join(', ')}, ${new Date().toISOString().slice(0, 10)}`,
  ),
);

const byBrand = unique.reduce<Record<string, number>>((acc, s) => {
  const key = s.brandSlug ?? 'independent';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
console.log(`Wrote ${unique.length} stations to ${file}`);
console.log(byBrand);
