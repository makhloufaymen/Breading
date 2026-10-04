import { Injectable, inject } from '@angular/core';

import type { Enums } from '../supabase/database.types';
import { SUPABASE } from '../supabase/supabase.client';

export type SwipeKind = Enums<'swipe_kind'>;

/** Likes and passes: from discovery, and when answering a like received. */
@Injectable({ providedIn: 'root' })
export class SwipesRepository {
  private readonly supabase = inject(SUPABASE);

  /**
   * Records the decision (RPC swipe_pet). If it completes a mutual like, the
   * database trigger creates the match and its id is returned; null otherwise.
   */
  async swipe(swiperPetId: string, targetPetId: string, kind: SwipeKind): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('swipe_pet', {
      p_swiper_pet_id: swiperPetId,
      p_target_pet_id: targetPetId,
      p_kind: kind,
    });
    if (error) throw error;
    return data;
  }
}
