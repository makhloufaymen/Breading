import { Injectable, inject } from '@angular/core';

import { SUPABASE } from '../../../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AccountRepository {
  private readonly supabase = inject(SUPABASE);

  /**
   * Edge Function delete-account: removes the photos and the auth user (which
   * cascades to all the data). supabase-js sends the user's JWT automatically.
   */
  async deleteAccount(): Promise<void> {
    const { error } = await this.supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
  }
}
