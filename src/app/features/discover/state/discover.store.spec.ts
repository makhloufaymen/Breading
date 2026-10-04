import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../../core/auth/auth.store';
import type { DiscoverPet } from '../../../core/models/discover.models';
import type { PetListItem } from '../../../core/models/pet.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { PetsStore } from '../../pets/state/pets.store';
import { DiscoverRepository, type SearchParams } from '../data/discover.repository';
import { DiscoverStore } from './discover.store';

const myPet = (id: string, isActive = true) => ({ id, is_active: isActive, species_id: 1, pet_photos: [] }) as unknown as PetListItem;
const found = (id: string) => ({ id }) as DiscoverPet;

describe('DiscoverStore', () => {
  let calls: SearchParams[];
  let pages: DiscoverPet[][];
  let myPets: ReturnType<typeof signal<PetListItem[]>>;

  beforeEach(() => {
    calls = [];
    pages = [];
    myPets = signal([myPet('rex'), myPet('sleepy', false), myPet('max')]);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
        { provide: PetsStore, useValue: { pets: myPets } },
        { provide: PhotosRepository, useValue: {} },
        {
          provide: DiscoverRepository,
          useValue: {
            search: async (params: SearchParams) => {
              calls.push(params);
              return pages.shift() ?? [];
            },
          },
        },
      ],
    });
  });

  it('searches for the first active pet by default, and only active pets can search', () => {
    const store = TestBed.inject(DiscoverStore);
    expect(store.seeker()?.id).toBe('rex');
    expect(store.seekers().map((p) => p.id)).toEqual(['rex', 'max']);
  });

  it('marks the deck exhausted when a page is not full', async () => {
    const store = TestBed.inject(DiscoverStore);
    pages = [[found('a'), found('b')]];
    await store.ensureLoaded();
    expect(store.deck().map((p) => p.id)).toEqual(['a', 'b']);
    expect(store.exhausted()).toBe(true);
    // Nothing more to fetch: entering the tab again does not search again.
    await store.ensureLoaded();
    expect(calls.length).toBe(1);
  });

  it('refills a full page before the deck runs out, excluding swiped and queued pets', async () => {
    const store = TestBed.inject(DiscoverStore);
    pages = [Array.from({ length: 20 }, (_, i) => found(`p${i}`)), [found('next')]];
    await store.ensureLoaded();
    for (let i = 0; i < 17; i++) store.swipe(`p${i}`);
    await new Promise((resolve) => setTimeout(resolve));
    expect(calls.length).toBe(2);
    expect(calls[1].excludeIds).toHaveLength(20);
    expect(store.deck().map((p) => p.id)).toEqual(['p17', 'p18', 'p19', 'next']);
  });

  it('starts over when the seeker changes', async () => {
    const store = TestBed.inject(DiscoverStore);
    pages = [[found('a')], [found('b')]];
    await store.ensureLoaded();
    await store.selectSeeker('max');
    expect(calls[1].seekerPetId).toBe('max');
    expect(calls[1].excludeIds).toEqual([]);
    expect(store.deck().map((p) => p.id)).toEqual(['b']);
  });

  it('keeps filters per seeker', async () => {
    const store = TestBed.inject(DiscoverStore);
    await store.setFilters({ breedId: 3, minAgeYears: 1, maxAgeYears: null, maxDistanceKm: 50 });
    await store.selectSeeker('max');
    expect(store.filters().breedId).toBeNull();
    await store.selectSeeker('rex');
    expect(store.filters().maxDistanceKm).toBe(50);
  });
});
