import { Injectable, inject } from '@angular/core';

import { PET_COLUMNS, type PetProfile } from '../models/pet.models';
import { SUPABASE } from '../supabase/supabase.client';

/** Another owner's pet, full profile. Used by discovery, likes received and matches. */
@Injectable({ providedIn: 'root' })
export class PetProfileRepository {
  private readonly supabase = inject(SUPABASE);

  /** "owner:profiles(...)" embeds the owner's profile through pets.owner_id and renames it. */
  async getProfile(petId: string): Promise<PetProfile> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(
        `${PET_COLUMNS}, pet_vaccinations(vaccine_id, administered_on, expires_on), pet_photos(path), owner:profiles(display_name)`,
      )
      .eq('id', petId)
      .order('position', { referencedTable: 'pet_photos' })
      .single();
    if (error) throw error;
    return data;
  }
}
