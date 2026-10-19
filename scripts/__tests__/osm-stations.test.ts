import { detectBrand, encodeOsmId, toSql, toStation } from '../osm-stations';

describe('detectBrand', () => {
  it.each([
    [{ brand: 'Petron' }, 'petron'],
    [{ name: 'Pilipinas Shell - EDSA' }, 'shell'],
    [{ brand: 'Chevron', name: 'Caltex Aurora' }, 'caltex'],
    [{ name: 'SEAOIL Santa Mesa' }, 'seaoil'],
    [{ name: 'Clean Fuel Pureza' }, 'cleanfuel'],
    [{ name: 'Total' }, 'total'],
    [{ name: 'Uno Fuel' }, 'unofuel'],
    [{ name: 'Metro' }, 'metrooil'],
    [{ name: 'Petro Gazz' }, 'petrogazz'],
  ])('%p → %s', (tags, slug) => {
    expect(detectBrand(tags)).toBe(slug);
  });

  it('prefers the brand tag over the name', () => {
    expect(detectBrand({ brand: 'Petron', name: 'Shell Station Road' })).toBe('petron');
  });

  it('does not match brand names inside other words', () => {
    expect(detectBrand({ name: 'Seashell Gas' })).toBeNull();
    expect(detectBrand({ name: 'Metro Manila Gasoline Station' })).toBeNull();
  });

  it('returns null for independents', () => {
    expect(detectBrand({ name: 'Galaxi Fuel' })).toBeNull();
    expect(detectBrand()).toBeNull();
  });
});

describe('toStation', () => {
  it('uses node coordinates or the way centre', () => {
    expect(
      toStation({ type: 'node', id: 5, lat: 14.6, lon: 121, tags: { brand: 'Petron' } }),
    ).toMatchObject({
      osmId: 51,
      brandSlug: 'petron',
      name: 'Petron',
      lat: 14.6,
      lng: 121,
    });
    expect(
      toStation({ type: 'way', id: 7, center: { lat: 14.5, lon: 121.1 }, tags: {} }),
    ).toMatchObject({
      osmId: 72,
      name: 'Fuel station',
    });
  });

  it('builds the address and skips disused stations or ones without coordinates', () => {
    expect(
      toStation({
        type: 'node',
        id: 1,
        lat: 14.6,
        lon: 121,
        tags: {
          name: 'Shell',
          'addr:housenumber': '123',
          'addr:street': 'Aurora Blvd',
          'addr:city': 'Quezon City',
        },
      }),
    ).toMatchObject({ address: '123 Aurora Blvd', city: 'Quezon City' });
    expect(
      toStation({ type: 'node', id: 2, lat: 14.6, lon: 121, tags: { disused: 'yes' } }),
    ).toBeNull();
    expect(toStation({ type: 'way', id: 3, tags: {} })).toBeNull();
  });

  it('keeps node, way and relation ids apart', () => {
    expect(
      new Set([encodeOsmId('node', 9), encodeOsmId('way', 9), encodeOsmId('relation', 9)]).size,
    ).toBe(3);
  });
});

describe('toSql', () => {
  it('escapes quotes and upserts by osm_id', () => {
    const sql = toSql(
      [
        {
          osmId: 11,
          brandSlug: null,
          name: "Aling Nena's Gas",
          address: null,
          city: null,
          lat: 14.6,
          lng: 121,
        },
      ],
      'test',
    );
    expect(sql).toContain("'Aling Nena''s Gas'");
    expect(sql).toContain('on conflict (osm_id) do update');
    expect(sql).toContain('OpenStreetMap contributors');
  });
});
