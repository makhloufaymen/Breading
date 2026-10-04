import { Injectable, inject } from '@angular/core';

import type { Conversation } from '../../../core/models/chat.models';
import type { ReceivedLike } from '../../../core/models/match.models';
import { SUPABASE } from '../../../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class MatchesRepository {
  private readonly supabase = inject(SUPABASE);

  /** My matches as conversations: both pets, last message, unread count (RPC my_conversations). */
  async conversations(): Promise<Conversation[]> {
    const { data, error } = await this.supabase.rpc('my_conversations');
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
