import { Injectable, inject } from '@angular/core';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

import type { Message, MessageChange } from '../models/chat.models';
import { SUPABASE } from '../supabase/supabase.client';

/**
 * Chat messages: history, sending, read receipts and the live stream.
 * In core because the Matches tab (unread counters) and the chat screen both use it.
 */
@Injectable({ providedIn: 'root' })
export class MessagesRepository {
  private readonly supabase = inject(SUPABASE);

  /** Newest first from the database, returned oldest first for display. */
  async list(matchId: string, limit: number, before?: string): Promise<Message[]> {
    let query = this.supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) throw error;
    return data.reverse();
  }

  /** sender_id is filled by the database (default auth.uid()). */
  async send(matchId: string, body: string): Promise<Message> {
    const { data, error } = await this.supabase.from('messages').insert({ match_id: matchId, body }).select().single();
    if (error) throw error;
    return data;
  }

  async markRead(matchId: string): Promise<void> {
    const { error } = await this.supabase.rpc('mark_messages_read', { p_match_id: matchId });
    if (error) throw error;
  }

  /**
   * Live inserts and updates (read receipts) on messages, for one match or for
   * all of mine (RLS decides what each user receives). The Supabase channel is
   * opened on subscribe and removed on unsubscribe: callers must unsubscribe.
   */
  changes(matchId?: string): Observable<MessageChange> {
    return new Observable<MessageChange>((subscriber) => {
      const channel = this.supabase
        // Channel names must be unique per open subscription.
        .channel(`messages:${matchId ?? 'inbox'}:${crypto.randomUUID()}`)
        .on<Message>(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) },
          (payload: RealtimePostgresChangesPayload<Message>) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              subscriber.next({ event: payload.eventType, message: payload.new });
            }
          },
        )
        .subscribe();
      return () => void this.supabase.removeChannel(channel);
    });
  }
}
