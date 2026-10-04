import { TestBed } from '@angular/core/testing';

import { ReferenceRepository } from './reference.repository';
import { ReferenceStore } from './reference.store';

describe('ReferenceStore', () => {
  let calls: number;
  let failNext: boolean;

  beforeEach(() => {
    calls = 0;
    failNext = false;
    const repository: Partial<ReferenceRepository> = {
      listSpecies: async () => {
        calls++;
        if (failNext) {
          failNext = false;
          throw new Error('offline');
        }
        return [
          { id: 1, code: 'dog', name: 'Chien' },
          { id: 2, code: 'cat', name: 'Chat' },
        ];
      },
      listBreeds: async () => [
        { id: 1, species_id: 1, name: 'Teckel à poil ras' },
        { id: 2, species_id: 1, name: 'Épagneul breton' },
        { id: 3, species_id: 1, name: 'Beagle' },
        { id: 4, species_id: 2, name: 'Persan' },
      ],
      listVaccines: async () => [{ id: 1, species_id: 2, code: 'rabies', name: 'Rage (R)' }],
    };
    TestBed.configureTestingModule({ providers: [{ provide: ReferenceRepository, useValue: repository }] });
  });

  it('groups breeds by species and sorts them in French order', async () => {
    const store = TestBed.inject(ReferenceStore);
    await store.ensureLoaded();
    expect(store.breedsOf(1).map((b) => b.name)).toEqual(['Beagle', 'Épagneul breton', 'Teckel à poil ras']);
    expect(store.breedsOf(2).map((b) => b.name)).toEqual(['Persan']);
    expect(store.vaccinesOf(1)).toEqual([]);
    expect(store.vaccinesOf(2).length).toBe(1);
  });

  it('labels a listed or free-text breed', async () => {
    const store = TestBed.inject(ReferenceStore);
    await store.ensureLoaded();
    expect(store.breedLabel({ breed_id: 4, breed_other: null })).toBe('Persan');
    expect(store.breedLabel({ breed_id: null, breed_other: 'Croisé' })).toBe('Croisé');
  });

  it('loads only once', async () => {
    const store = TestBed.inject(ReferenceStore);
    await Promise.all([store.ensureLoaded(), store.ensureLoaded()]);
    await store.ensureLoaded();
    expect(calls).toBe(1);
  });

  it('can retry after a failure', async () => {
    const store = TestBed.inject(ReferenceStore);
    failNext = true;
    await expect(store.ensureLoaded()).rejects.toThrow('offline');
    await store.ensureLoaded();
    expect(store.loaded()).toBe(true);
    expect(calls).toBe(2);
  });
});
