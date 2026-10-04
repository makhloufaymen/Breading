import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthStore } from '../../../core/auth/auth.store';
import { type PetDetail, type PetInput, type PetListItem, toPetInsert, toPetUpdate } from '../../../core/models/pet.models';
import { PhotosRepository } from '../../../core/photos/photos.repository';
import { PetsRepository } from '../data/pets.repository';
import { type PhotoChanges, PhotoSyncError } from './photo-draft';

/** The signed-in owner's pets. Cleared on sign-out. */
@Injectable({ providedIn: 'root' })
export class PetsStore {
  private readonly auth = inject(AuthStore);
  private readonly repository = inject(PetsRepository);
  private readonly photos = inject(PhotosRepository);

  private readonly _pets = signal<PetListItem[]>([]);
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

  photoUrl(path: string): string {
    return this.photos.publicUrl(path);
  }

  /**
   * Creates (id null) or updates a pet, replaces its vaccinations, then applies
   * the photo changes. Throws PhotoSyncError if only the photos failed: the pet
   * exists by then, so the caller must not create it again.
   */
  async save(id: string | null, input: PetInput, photos: PhotoChanges): Promise<void> {
    const pet = id
      ? await this.repository.update(id, toPetUpdate(input))
      : await this.repository.create(toPetInsert(input));
    await this.repository.setVaccinations(pet.id, input.vaccinations);

    try {
      await this.syncPhotos(pet.owner_id, pet.id, photos);
    } catch (error) {
      throw new PhotoSyncError(pet.id, error);
    } finally {
      // Refreshes the list (main photo included) whatever happened to the photos.
      void this.load();
    }
  }

  async remove(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not signed in');
    // Storage files are not tied to the database rows: list them before the rows go away.
    const files = await this.photos.listPetFiles(userId, id).catch(() => []);
    await this.repository.delete(id);
    this._pets.update((pets) => pets.filter((p) => p.id !== id));
    // Best effort: a leftover file is only wasted space (account deletion removes the whole folder).
    await this.photos.removeFiles(files).catch(() => undefined);
  }

  private async syncPhotos(ownerId: string, petId: string, { items, removed }: PhotoChanges): Promise<void> {
    if (removed.length) {
      // Rows first, so a failure never leaves a row pointing to a missing file.
      await this.photos.deleteRows(removed.map((p) => p.id));
      await this.photos.removeFiles(removed.map((p) => p.path)).catch(() => undefined);
    }

    const ids: string[] = [];
    for (const [index, item] of items.entries()) {
      if (item.kind === 'stored') {
        ids.push(item.id);
        continue;
      }
      const path = await this.photos.upload(ownerId, petId, item.blob);
      try {
        ids.push((await this.photos.insert(petId, path, index)).id);
      } catch (error) {
        await this.photos.removeFiles([path]).catch(() => undefined);
        throw error;
      }
    }

    if (ids.length) await this.photos.reorder(petId, ids);
  }
}
