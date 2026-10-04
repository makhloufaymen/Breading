import { type PetInput, toPetInsert, toPetUpdate } from './pet.models';

const input: PetInput = {
  speciesId: 1,
  name: 'Rex',
  sex: 'male',
  breedId: null,
  breedOther: 'Croisé',
  birthDate: '2022-01-01',
  description: null,
  pedigree: null,
  postalCode: '75001',
  city: 'Paris',
  location: { lon: 2.34, lat: 48.86 },
  isActive: true,
  vaccinations: [],
};

describe('pet row mapping', () => {
  it('writes the location as EWKT, longitude first', () => {
    expect(toPetInsert(input).location).toBe('SRID=4326;POINT(2.34 48.86)');
  });

  it('clears pedigree fields when there is no pedigree', () => {
    const row = toPetUpdate(input);
    expect(row).toMatchObject({ has_pedigree: false, pedigree_registry: null, pedigree_number: null });
  });

  it('never sends the species on update, and keeps the location when unchanged', () => {
    const row = toPetUpdate({ ...input, location: null, pedigree: { registry: 'LOF', number: null } });
    expect('species_id' in row).toBe(false);
    expect('location' in row).toBe(false);
    expect(row).toMatchObject({ has_pedigree: true, pedigree_registry: 'LOF' });
  });

  it('refuses to create a pet without a location', () => {
    expect(() => toPetInsert({ ...input, location: null })).toThrow();
  });
});
