import {
  estimateDistanceMeters,
  haversineMeters,
  stableJitter,
} from './distance.util';

describe('haversineMeters', () => {
  it('calcule ~200 m pour un décalage de 0.001797° de latitude', () => {
    const d = haversineMeters(
      { lat: 5.3364, lng: -4.0892 },
      { lat: 5.3364 + 200 / 111_320, lng: -4.0892 },
    );
    expect(d).toBeGreaterThanOrEqual(199);
    expect(d).toBeLessThanOrEqual(201);
  });

  it('retourne 0 pour le même point', () => {
    expect(haversineMeters({ lat: 5, lng: -4 }, { lat: 5, lng: -4 })).toBe(0);
  });
});

describe('stableJitter', () => {
  it('est déterministe et borné [0, 400)', () => {
    expect(stableJitter('p1')).toBe(stableJitter('p1'));
    for (const id of ['p1', 'p2', 'abc', 'cmq123']) {
      expect(stableJitter(id)).toBeGreaterThanOrEqual(0);
      expect(stableJitter(id)).toBeLessThan(400);
    }
  });
});

describe('estimateDistanceMeters', () => {
  it('utilise haversine quand les deux positions existent', () => {
    const d = estimateDistanceMeters({
      viewer: { lat: 5.3364, lng: -4.0892 },
      provider: { lat: 5.3364 + 350 / 111_320, lng: -4.0892, quarter: 'X' },
      providerId: 'p2',
    });
    expect(d).toBeGreaterThanOrEqual(349);
    expect(d).toBeLessThanOrEqual(351);
  });

  it('même quartier → base 250 m + jitter stable', () => {
    const d = estimateDistanceMeters({
      viewer: { quarter: 'Yopougon Selmer' },
      provider: { quarter: 'yopougon selmer' },
      providerId: 'p1',
    });
    expect(d).toBe(250 + stableJitter('p1'));
  });

  it('même commune → base 1200 m', () => {
    const d = estimateDistanceMeters({
      viewer: { quarter: 'Yopougon Selmer' },
      provider: { quarter: 'Yopougon Niangon' },
      providerId: 'p4',
    });
    expect(d).toBe(1200 + stableJitter('p4'));
  });

  it('communes différentes ou quartier inconnu → base 5000 m', () => {
    expect(
      estimateDistanceMeters({
        viewer: { quarter: 'Cocody Angré' },
        provider: { quarter: 'Yopougon' },
        providerId: 'p3',
      }),
    ).toBe(5000 + stableJitter('p3'));
    expect(
      estimateDistanceMeters({
        viewer: {},
        provider: { quarter: 'Yopougon' },
        providerId: 'p3',
      }),
    ).toBe(5000 + stableJitter('p3'));
  });
});
