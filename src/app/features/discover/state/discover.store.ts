import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  DEFAULT_FILTERS,
  type DiscoverFilters,
  type DiscoverPet,
} from '../../../core/models/discover.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { type SwipeKind, SwipesRepository } from '../../../core/swipes/swipes.repository';
import { PetsStore } from '../../pets/state/pets.store';
import { DiscoverRepository } from '../data/discover.repository';

const PAGE_SIZE = 20;
/** Fetch the next page when the deck gets this small, so the user never waits. */
const REFILL_THRESHOLD = 3;

/**
 * Discovery deck: always on behalf of one of my active pets (the "seeker").
 * Filters are kept per seeker for the session.
 */
@Injectable({ providedIn: 'root' })
export class DiscoverStore {
  private readonly auth = inject(AuthStore);
  private readonly pets = inject(PetsStore);
  private readonly repository = inject(DiscoverRepository);
  private readonly photos = inject(PhotosRepository);
  private readonly swipes = inject(SwipesRepository);

  private readonly _seekerId = signal<string | null>(null);
  private readonly _filters = signal<ReadonlyMap<string, DiscoverFilters>>(new Map());
  private readonly _deck = signal<DiscoverPet[]>([]);
  private readonly _status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private readonly _exhausted = signal(false);

  /** Pets swiped this session, excluded from refills even before their swipe is saved. */
  private readonly seen = new Set<string>();
  /** Seeker + filters the deck was loaded for. */
  private loadedFor: string | null = null;
  private requestId = 0;

  /** My pets that can search: inactive ones are hidden from discovery both ways. */
  readonly seekers = computed(() => this.pets.pets().filter((p) => p.is_active));
  readonly seeker = computed(() => {
    const seekers = this.seekers();
    return seekers.find((p) => p.id === this._seekerId()) ?? seekers[0] ?? null;
  });
  readonly filters = computed(() => {
    const seeker = this.seeker();
    return (seeker && this._filters().get(seeker.id)) || DEFAULT_FILTERS;
  });
  readonly deck = this._deck.asReadonly();
  readonly status = this._status.asReadonly();
  readonly exhausted = this._exhausted.asReadonly();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => {
        if (!signedIn) {
          this._seekerId.set(null);
          this._filters.set(new Map());
          this.reset();
        }
      });
    });
  }

  photoUrl(path: string): string {
    return this.photos.publicUrl(path);
  }

  /** Called when the tab is shown: reloads only if the seeker or the filters changed, or the deck ran out. */
  async ensureLoaded(): Promise<void> {
    const key = this.currentKey();
    if (key !== this.loadedFor) {
      this.reset();
      this.loadedFor = key;
    }
    if (key && !this._deck().length && !this._exhausted() && this._status() !== 'loading') {
      await this.fetchMore();
    }
  }

  selectSeeker(petId: string): Promise<void> {
    this._seekerId.set(petId);
    return this.ensureLoaded();
  }

  setFilters(filters: DiscoverFilters): Promise<void> {
    const seeker = this.seeker();
    if (!seeker) return Promise.resolve();
    this._filters.update((all) => new Map(all).set(seeker.id, filters));
    return this.ensureLoaded();
  }

  /**
   * Removes the card right away (no waiting on the network), then records the
   * decision. Returns the match id when this like completed a match.
   */
  async swipe(petId: string, kind: SwipeKind): Promise<string | null> {
    const seeker = this.seeker();
    if (!seeker) return null;
    this.seen.add(petId);
    this._deck.update((deck) => deck.filter((p) => p.id !== petId));
    if (this._deck().length <= REFILL_THRESHOLD && !this._exhausted() && this._status() !== 'loading') {
      void this.fetchMore();
    }
    return this.swipes.swipe(seeker.id, petId, kind);
  }

  /** Forces a new search (retry button, pull of new profiles). */
  reload(): Promise<void> {
    this.loadedFor = null;
    return this.ensureLoaded();
  }

  private async fetchMore(): Promise<void> {
    const seeker = this.seeker();
    if (!seeker) return;
    const id = ++this.requestId;
    this._status.set('loading');
    try {
      const results = await this.repository.search({
        seekerPetId: seeker.id,
        filters: this.filters(),
        excludeIds: [...this.seen, ...this._deck().map((p) => p.id)],
        limit: PAGE_SIZE,
      });
      if (id !== this.requestId) return; // seeker or filters changed meanwhile
      this._deck.update((deck) => [...deck, ...results]);
      this._exhausted.set(results.length < PAGE_SIZE);
      this._status.set('ready');
    } catch {
      if (id === this.requestId) this._status.set('error');
    }
  }

  private reset(): void {
    this.requestId++;
    this.seen.clear();
    this.loadedFor = null;
    this._deck.set([]);
    this._exhausted.set(false);
    this._status.set('idle');
  }

  private currentKey(): string | null {
    const seeker = this.seeker();
    return seeker ? `${seeker.id}|${JSON.stringify(this.filters())}` : null;
  }
}
