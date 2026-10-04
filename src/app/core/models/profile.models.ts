import type { Tables } from '../supabase/database.types';

export type Profile = Tables<'profiles'>;

/** Same bounds as the CHECK constraint on profiles.display_name. */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;
