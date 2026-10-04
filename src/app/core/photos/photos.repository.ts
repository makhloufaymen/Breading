import { Injectable, inject } from '@angular/core';

import type { PetPhoto } from '../models/pet.models';
import { SUPABASE } from '../supabase/supabase.client';

const BUCKET = 'pet-photos';

/**
 * Pet photos: files in Storage + rows in pet_photos. Lives in core because
 * discovery and matches display them too.
 */
@Injectable({ providedIn: 'root' })
export class PhotosRepository {
  private readonly supabase = inject(SUPABASE);

  /** Public bucket: a plain, permanent URL (no signed URL to renew). No network call. */
  publicUrl(path: string): string {
    return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Uploads to {ownerId}/{petId}/{uuid}.jpg (the only place the Storage policies allow). */
  async upload(ownerId: string, petId: string, jpeg: Blob): Promise<string> {
    const path = `${ownerId}/${petId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  }

  async insert(petId: string, path: string, position: number): Promise<PetPhoto> {
    const { data, error } = await this.supabase
      .from('pet_photos')
      .insert({ pet_id: petId, path, position })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Rows only; call removeFiles() for the files. */
  async deleteRows(ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.supabase.from('pet_photos').delete().in('id', [...ids]);
    if (error) throw error;
  }

  async removeFiles(paths: readonly string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.supabase.storage.from(BUCKET).remove([...paths]);
    if (error) throw error;
  }

  /** Every file in a pet's folder, rows or not (catches orphans of failed saves). */
  async listPetFiles(ownerId: string, petId: string): Promise<string[]> {
    const folder = `${ownerId}/${petId}`;
    const { data, error } = await this.supabase.storage.from(BUCKET).list(folder, { limit: 100 });
    if (error) throw error;
    return data.map((file) => `${folder}/${file.name}`);
  }

  /** ids in their new order; the first one becomes the main photo. */
  async reorder(petId: string, ids: readonly string[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_pet_photos', { p_pet_id: petId, p_photo_ids: [...ids] });
    if (error) throw error;
  }
}
