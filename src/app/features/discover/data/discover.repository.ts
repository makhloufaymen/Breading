import { Injectable, inject } from '@angular/core';

import type { DiscoverFilters, DiscoverPet, DiscoverPetDetail } from '../../../core/models/discover.models';
import { PET_COLUMNS } from '../../../core/models/pet.models';
import { SUPABASE } from '../../../core/supabase/supabase.client';

export interface SearchParams {
  readonly seekerPetId: string;
  readonly filters: DiscoverFilters;
  readonly excludeIds: readonly string[];
  readonly limit: number;
}

@Injectable({ providedIn: 'root' })
export class DiscoverRepository {
  private readonly supabase = inject(SUPABASE);

  /** Compatibility and filters are applied in Postgres (RPC search_pets). */
  async search({ seekerPetId, filters, excludeIds, limit }: SearchParams): Promise<DiscoverPet[]> {
    const { data, error } = await this.supabase.rpc('search_pets', {
      p_seeker_pet_id: seekerPetId,
      p_breed_ids: filters.breedId !== null ? [filters.breedId] : undefined,
      p_min_age_years: filters.minAgeYears || undefined,
      p_max_age_years: filters.maxAgeYears ?? undefined,
      p_max_distance_km: filters.maxDistanceKm ?? undefined,
      p_exclude_ids: excludeIds.length ? [...excludeIds] : undefined,
      p_limit: limit,
    });
    if (error) throw error;
    return data;
  }

  /** "owner:profiles(...)" embeds the owner's profile through pets.owner_id and renames it. */
  async getDetail(petId: string): Promise<DiscoverPetDetail> {
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
