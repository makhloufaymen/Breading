import { Injectable, inject } from '@angular/core';

import type { ReceivedLike } from '../../../core/models/match.models';
import { SUPABASE } from '../../../core/supabase/supabase.client';

/** Columns of each pet embedded in a match row. */
const MATCH_PET =
  'id, name, owner_id, species_id, sex, birth_date, breed_id, breed_other, city, pet_photos(path, position), owner:profiles(display_name)';

@Injectable({ providedIn: 'root' })
export class MatchesRepository {
  private readonly supabase = inject(SUPABASE);

  /**
   * Matches with both pets embedded. matches has two foreign keys to pets, so
   * each embed names its key (pets!matches_pet_a_id_fkey) and gets an alias.
   */
  async list() {
    const { data, error } = await this.supabase
      .from('matches')
      .select(`id, created_at, pet_a:pets!matches_pet_a_id_fkey(${MATCH_PET}), pet_b:pets!matches_pet_b_id_fkey(${MATCH_PET})`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async receivedLikes(): Promise<ReceivedLike[]> {
    const { data, error } = await this.supabase.rpc('received_likes');
    if (error) throw error;
    return data;
  }

  /** Deletes the match (and its conversation); swipes are kept. */
  async unmatch(matchId: string): Promise<void> {
    const { error } = await this.supabase.rpc('unmatch', { p_match_id: matchId });
    if (error) throw error;
  }
}

export type MatchRow = Awaited<ReturnType<MatchesRepository['list']>>[number];
