import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../../core/auth/auth.store';
import type { ReceivedLike } from '../../../core/models/match.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { SwipesRepository } from '../../../core/swipes/swipes.repository';
import { MatchesRepository } from '../data/matches.repository';
import { MatchesStore } from './matches.store';

const pet = (id: string, ownerId: string, photos: { path: string; position: number }[] = []) => ({
  id,
  name: id.toUpperCase(),
  owner_id: ownerId,
  species_id: 1,
  sex: 'male',
  birth_date: '2022-01-01',
  breed_id: null,
  breed_other: 'Croisé',
  city: 'Paris',
  pet_photos: photos,
  owner: { display_name: `owner of ${id}` },
});

describe('MatchesStore', () => {
  let likes: ReceivedLike[];
  let swipeResult: string | null;

  beforeEach(() => {
    likes = [{ id: 'liker', my_pet_id: 'rex', my_pet_name: 'Rex', name: 'Nala' } as ReceivedLike];
    swipeResult = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
        { provide: PhotosRepository, useValue: {} },
        { provide: SwipesRepository, useValue: { swipe: async () => swipeResult } },
        {
          provide: MatchesRepository,
          useValue: {
            // My pet is pet_b here: the store must still put it on the "mine" side.
            list: async () => [
              {
                id: 'm1',
                created_at: '2026-10-04T10:00:00Z',
                pet_a: pet('nala', 'other', [
                  { path: 'second.jpg', position: 1 },
                  { path: 'main.jpg', position: 0 },
                ]),
                pet_b: pet('rex', 'me'),
              },
            ],
            receivedLikes: async () => likes,
          },
        },
      ],
    });
  });

  it('puts my pet on the "mine" side and picks the main photo of the other one', async () => {
    const store = TestBed.inject(MatchesStore);
    await store.load();
    const [match] = store.matches();
    expect(match.mine.id).toBe('rex');
    expect(match.other.id).toBe('nala');
    expect(match.other.photoPath).toBe('main.jpg');
    expect(match.other.ownerName).toBe('owner of nala');
  });

  it('removes an answered like and reports the match', async () => {
    const store = TestBed.inject(MatchesStore);
    await store.load();
    const like = store.likes()[0];
    likes = [];
    swipeResult = 'm2';
    expect(await store.answerLike(like, 'like')).toBe('m2');
    expect(store.likesCount()).toBe(0);
  });
});
