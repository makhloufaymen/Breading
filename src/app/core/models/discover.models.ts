import type { Database } from '../supabase/database.types';

type SearchRow = Database['public']['Functions']['search_pets']['Returns'][number];

/** A search_pets result (the generator can't tell these columns are nullable). */
export type DiscoverPet = Omit<SearchRow, 'breed_id' | 'breed_other'> & {
  breed_id: number | null;
  breed_other: string | null;
};

export interface DiscoverFilters {
  readonly breedId: number | null;
  readonly minAgeYears: number;
  /** null = no maximum. */
  readonly maxAgeYears: number | null;
  /** null = anywhere in France. */
  readonly maxDistanceKm: number | null;
}

export const DEFAULT_FILTERS: DiscoverFilters = { breedId: null, minAgeYears: 0, maxAgeYears: null, maxDistanceKm: null };

/** Bounds of the filter sliders; the top value of each means "no limit". */
export const AGE_FILTER_MAX = 15;
export const DISTANCE_FILTER_MIN = 10;
export const DISTANCE_FILTER_MAX = 300;

export function activeFilterCount(f: DiscoverFilters): number {
  return [f.breedId !== null, f.minAgeYears > 0 || f.maxAgeYears !== null, f.maxDistanceKm !== null].filter(Boolean).length;
}

/** "à 12 km", "à moins d'1 km". */
export function distanceLabel(km: number): string {
  return km < 1 ? "à moins d'1 km" : `à ${Math.round(km)} km`;
}
