import type { Tables } from '../supabase/database.types';

export type Species = Tables<'species'>;
export type Breed = Tables<'breeds'>;
export type Vaccine = Tables<'vaccines'>;

/** Ids fixed by the reference_data migration. */
export const SPECIES_ID = { dog: 1, cat: 2 } as const;
