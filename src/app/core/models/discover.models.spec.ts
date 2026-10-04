import { DEFAULT_FILTERS, activeFilterCount, distanceLabel } from './discover.models';

describe('discover helpers', () => {
  it('counts active filters (age range counts once)', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ breedId: 1, minAgeYears: 2, maxAgeYears: 5, maxDistanceKm: 50 })).toBe(3);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, maxAgeYears: 3 })).toBe(1);
  });

  it('formats distances', () => {
    expect(distanceLabel(0.4)).toBe("à moins d'1 km");
    expect(distanceLabel(12.6)).toBe('à 13 km');
  });
});
