import { petAge } from './pet-age.pipe';

describe('petAge', () => {
  const today = new Date(2026, 9, 4); // 4 October 2026

  it('counts whole years', () => {
    expect(petAge('2023-10-04', today)).toBe('3 ans');
    expect(petAge('2023-10-05', today)).toBe('2 ans');
    expect(petAge('2025-09-01', today)).toBe('1 an');
  });

  it('uses months under one year', () => {
    expect(petAge('2026-04-04', today)).toBe('6 mois');
    expect(petAge('2025-10-05', today)).toBe('11 mois');
    expect(petAge('2026-09-04', today)).toBe('1 mois');
  });

  it('handles newborns', () => {
    expect(petAge('2026-09-20', today)).toBe("Moins d'un mois");
    expect(petAge('2026-10-04', today)).toBe("Moins d'un mois");
  });
});
