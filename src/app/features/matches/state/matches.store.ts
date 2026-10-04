import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../../../core/auth/auth.store';
import type { MatchItem, MatchedPet, ReceivedLike } from '../../../core/models/match.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { type SwipeKind, SwipesRepository } from '../../../core/swipes/swipes.repository';
import { MatchesRepository, type MatchRow } from '../data/matches.repository';

type MatchRowPet = NonNullable<MatchRow['pet_a']>;

/** My matches and the likes my pets received. Cleared on sign-out. */
@Injectable({ providedIn: 'root' })
export class MatchesStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(MatchesRepository);
  private readonly swipes = inject(SwipesRepository);
  private readonly photos = inject(PhotosRepository);

  private readonly _matches = signal<MatchItem[]>([]);
  private readonly _likes = signal<ReceivedLike[]>([]);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);

  readonly matches = this._matches.asReadonly();
  readonly likes = this._likes.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly likesCount = computed(() => this._likes().length);

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => {
        if (!signedIn) {
          this._matches.set([]);
          this._likes.set([]);
          this._loaded.set(false);
        }
      });
    });
  }

  photoUrl(path: string): string {
    return this.photos.publicUrl(path);
  }

  async load(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this._error.set(false);
    try {
      const [rows, likes] = await Promise.all([this.repository.list(), this.repository.receivedLikes()]);
      this._matches.set(rows.flatMap((row) => toMatchItem(row, userId)));
      this._likes.set(likes);
      this._loaded.set(true);
    } catch {
      this._error.set(true);
    }
  }

  async unmatch(matchId: string): Promise<void> {
    await this.repository.unmatch(matchId);
    this._matches.update((matches) => matches.filter((m) => m.id !== matchId));
  }

  /**
   * Answers a like received, on behalf of the liked pet. Returns the match id
   * when liking back (always a match, unless the other pet became incompatible).
   */
  async answerLike(like: ReceivedLike, kind: SwipeKind): Promise<string | null> {
    const matchId = await this.swipes.swipe(like.my_pet_id, like.id, kind);
    this._likes.update((likes) => likes.filter((l) => !(l.id === like.id && l.my_pet_id === like.my_pet_id)));
    if (matchId) await this.load();
    return matchId;
  }
}

/** Puts my pet on one side and the other pet on the other. */
function toMatchItem(row: MatchRow, userId: string): MatchItem[] {
  const [a, b] = [row.pet_a, row.pet_b];
  if (!a || !b) return []; // a pet no longer readable (should not happen: matched pets stay visible)
  const [mine, other] = a.owner_id === userId ? [a, b] : [b, a];
  return [
    {
      id: row.id,
      createdAt: row.created_at,
      mine: { id: mine.id, name: mine.name, photoPath: mainPhoto(mine) },
      other: toMatchedPet(other),
    },
  ];
}

function toMatchedPet(pet: MatchRowPet): MatchedPet {
  return {
    id: pet.id,
    name: pet.name,
    speciesId: pet.species_id,
    sex: pet.sex,
    birthDate: pet.birth_date,
    breedId: pet.breed_id,
    breedOther: pet.breed_other,
    city: pet.city,
    photoPath: mainPhoto(pet),
    ownerName: pet.owner?.display_name ?? '',
  };
}

function mainPhoto(pet: MatchRowPet): string | null {
  return [...pet.pet_photos].sort((x, y) => x.position - y.position)[0]?.path ?? null;
}
