import type { Database } from '../supabase/database.types';
import type { PetSex } from './pet.models';

type LikeRow = Database['public']['Functions']['received_likes']['Returns'][number];

/** A like received by one of my pets, not answered yet (RPC received_likes). */
export type ReceivedLike = Omit<LikeRow, 'breed_id' | 'breed_other'> & {
  breed_id: number | null;
  breed_other: string | null;
};

/** The other pet of a match, as shown in the list. */
export interface MatchedPet {
  readonly id: string;
  readonly name: string;
  readonly speciesId: number;
  readonly sex: PetSex;
  readonly birthDate: string;
  readonly breedId: number | null;
  readonly breedOther: string | null;
  readonly city: string;
  readonly photoPath: string | null;
  readonly ownerName: string;
}

export interface MatchItem {
  readonly id: string;
  readonly createdAt: string;
  /** My pet in this match. */
  readonly mine: { readonly id: string; readonly name: string; readonly photoPath: string | null };
  readonly other: MatchedPet;
}
