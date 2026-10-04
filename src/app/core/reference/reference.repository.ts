import { Injectable, inject } from '@angular/core';

import type { Breed, Species, Vaccine } from '../models/reference.models';
import { SUPABASE } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class ReferenceRepository {
  private readonly supabase = inject(SUPABASE);

  async listSpecies(): Promise<Species[]> {
    const { data, error } = await this.supabase.from('species').select('*').order('id');
    if (error) throw error;
    return data;
  }

  async listBreeds(): Promise<Breed[]> {
    const { data, error } = await this.supabase.from('breeds').select('*');
    if (error) throw error;
    return data;
  }

  async listVaccines(): Promise<Vaccine[]> {
    const { data, error } = await this.supabase.from('vaccines').select('*').order('id');
    if (error) throw error;
    return data;
  }
}
