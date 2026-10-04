import { Injectable, inject } from '@angular/core';

import {
  PET_COLUMNS,
  type Pet,
  type PetDetail,
  type VaccinationInput,
} from '../../../core/models/pet.models';
import type { TablesInsert, TablesUpdate } from '../../../core/supabase/database.types';
import { SUPABASE } from '../../../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class PetsRepository {
  private readonly supabase = inject(SUPABASE);

  async listByOwner(ownerId: string): Promise<Pet[]> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(PET_COLUMNS)
      .eq('owner_id', ownerId)
      .order('created_at');
    if (error) throw error;
    return data;
  }

  /** Pet with its vaccinations (PostgREST embeds them through the foreign key). */
  async getDetail(id: string): Promise<PetDetail> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(`${PET_COLUMNS}, pet_vaccinations(*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  /** owner_id is filled by the database (default auth.uid()). */
  async create(row: TablesInsert<'pets'>): Promise<Pet> {
    const { data, error } = await this.supabase.from('pets').insert(row).select(PET_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  /** RLS guarantees only the owner's pet can be updated. */
  async update(id: string, row: TablesUpdate<'pets'>): Promise<Pet> {
    const { data, error } = await this.supabase.from('pets').update(row).eq('id', id).select(PET_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  /** Vaccinations go with it (on delete cascade). */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('pets').delete().eq('id', id);
    if (error) throw error;
  }

  /** Replaces the whole list in one transaction (RPC set_pet_vaccinations). */
  async setVaccinations(petId: string, items: readonly VaccinationInput[]): Promise<void> {
    const { error } = await this.supabase.rpc('set_pet_vaccinations', { p_pet_id: petId, p_items: [...items] });
    if (error) throw error;
  }
}
