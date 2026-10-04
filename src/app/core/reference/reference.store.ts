import { Injectable, computed, inject, signal } from '@angular/core';

import type { Breed, Species, Vaccine } from '../models/reference.models';
import { ReferenceRepository } from './reference.repository';

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Species, breeds and vaccines: small, read-only lists that rarely change.
 * Loaded once per app session on first use, then served from memory.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceStore {
  private readonly repository = inject(ReferenceRepository);

  private readonly _species = signal<Species[]>([]);
  private readonly _breeds = signal<Breed[]>([]);
  private readonly _vaccines = signal<Vaccine[]>([]);
  private loading: Promise<void> | null = null;

  readonly species = this._species.asReadonly();
  readonly loaded = computed(() => this._species().length > 0);

  /** Breeds of one species, sorted the French way (É next to E). */
  readonly breedsBySpecies = computed(() => groupBySpecies(this._breeds(), (a, b) => collator.compare(a.name, b.name)));
  readonly vaccinesBySpecies = computed(() => groupBySpecies(this._vaccines()));

  /** Safe to call many times: only the first call hits the network (until a failure). */
  ensureLoaded(): Promise<void> {
    this.loading ??= this.load().catch((error: unknown) => {
      this.loading = null; // allow a retry later
      throw error;
    });
    return this.loading;
  }

  breedsOf(speciesId: number): readonly Breed[] {
    return this.breedsBySpecies().get(speciesId) ?? [];
  }

  vaccinesOf(speciesId: number): readonly Vaccine[] {
    return this.vaccinesBySpecies().get(speciesId) ?? [];
  }

  private async load(): Promise<void> {
    const [species, breeds, vaccines] = await Promise.all([
      this.repository.listSpecies(),
      this.repository.listBreeds(),
      this.repository.listVaccines(),
    ]);
    this._species.set(species);
    this._breeds.set(breeds);
    this._vaccines.set(vaccines);
  }
}

function groupBySpecies<T extends { species_id: number }>(items: T[], sort?: (a: T, b: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const group = groups.get(item.species_id) ?? [];
    group.push(item);
    groups.set(item.species_id, group);
  }
  if (sort) {
    for (const group of groups.values()) group.sort(sort);
  }
  return groups;
}
