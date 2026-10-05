import { Injectable, inject } from '@angular/core';

import type { Enums } from '../supabase/database.types';
import { SUPABASE } from '../supabase/supabase.client';

export type ReportReason = Enums<'report_reason'>;

export interface ReportInput {
  readonly ownerId: string;
  readonly petId?: string | null;
  readonly matchId?: string | null;
  readonly reason: ReportReason;
  readonly details?: string | null;
}

export interface BlockedOwner {
  readonly id: string;
  readonly displayName: string;
  readonly blockedAt: string;
}

/** Reports and blocks. In core: offered from discovery, likes, matches, chat and the account. */
@Injectable({ providedIn: 'root' })
export class SafetyRepository {
  private readonly supabase = inject(SUPABASE);

  /** Write-only table: nothing is read back (reporter_id is filled by the database). */
  async report({ ownerId, petId, matchId, reason, details }: ReportInput): Promise<void> {
    const { error } = await this.supabase.from('reports').insert({
      reported_owner_id: ownerId,
      pet_id: petId ?? null,
      match_id: matchId ?? null,
      reason,
      details: details || null,
    });
    if (error) throw error;
  }

  /** Also deletes our matches and conversations (RPC block_owner). */
  async block(ownerId: string): Promise<void> {
    const { error } = await this.supabase.rpc('block_owner', { p_owner_id: ownerId });
    if (error) throw error;
  }

  async unblock(ownerId: string): Promise<void> {
    const { error } = await this.supabase.from('blocks').delete().eq('blocked_id', ownerId);
    if (error) throw error;
  }

  /** blocks has two foreign keys to profiles: the embed names the one to follow. */
  async listBlocked(): Promise<BlockedOwner[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('created_at, blocked:profiles!blocks_blocked_id_fkey(id, display_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.flatMap((row) =>
      row.blocked ? [{ id: row.blocked.id, displayName: row.blocked.display_name, blockedAt: row.created_at }] : [],
    );
  }
}
