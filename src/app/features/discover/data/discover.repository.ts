import { Injectable, inject } from '@angular/core';

import type { DiscoverFilters, DiscoverPet } from '../../../core/models/discover.models';
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
}
