import type { Database } from '../supabase/database.types';

type LikeRow = Database['public']['Functions']['received_likes']['Returns'][number];

/** A like received by one of my pets, not answered yet (RPC received_likes). */
export type ReceivedLike = Omit<LikeRow, 'breed_id' | 'breed_other'> & {
  breed_id: number | null;
  breed_other: string | null;
};
