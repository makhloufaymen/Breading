import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../../../core/auth/auth.store';
import { type Pet, type PetDetail, type PetInput, toPetInsert, toPetUpdate } from '../../../core/models/pet.models';
import { PetsRepository } from '../data/pets.repository';

/** The signed-in owner's pets. Cleared on sign-out. */
@Injectable({ providedIn: 'root' })
export class PetsStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(PetsRepository);

  private readonly _pets = signal<Pet[]>([]);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);

  readonly pets = this._pets.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._loaded() && this._pets().length === 0);

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => {
        if (!userId) {
          this._pets.set([]);
          this._loaded.set(false);
        }
      });
    });
  }

  /** Called each time the pets tab is shown: cheap, and picks up changes from other devices. */
  async load(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this._error.set(false);
    try {
      this._pets.set(await this.repository.listByOwner(userId));
      this._loaded.set(true);
    } catch {
      this._error.set(true);
    }
  }

  getDetail(id: string): Promise<PetDetail> {
    return this.repository.getDetail(id);
  }

  /** Creates (id null) or updates a pet, then replaces its vaccinations. */
  async save(id: string | null, input: PetInput): Promise<Pet> {
    const pet = id
      ? await this.repository.update(id, toPetUpdate(input))
      : await this.repository.create(toPetInsert(input));
    await this.repository.setVaccinations(pet.id, input.vaccinations);
    this._pets.update((pets) => (id ? pets.map((p) => (p.id === id ? pet : p)) : [...pets, pet]));
    return pet;
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
    this._pets.update((pets) => pets.filter((p) => p.id !== id));
  }
}
