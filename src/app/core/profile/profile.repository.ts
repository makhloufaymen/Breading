import { Injectable, inject } from '@angular/core';

import type { Profile } from '../models/profile.models';
import { SUPABASE } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly supabase = inject(SUPABASE);

  async getById(id: string): Promise<Profile> {
    const { data, error } = await this.supabase.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  /** RLS guarantees only the owner's row can be updated, whatever id is passed. */
  async updateDisplayName(id: string, displayName: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
