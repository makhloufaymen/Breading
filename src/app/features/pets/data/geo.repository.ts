import { Injectable } from '@angular/core';

import type { GeoPoint } from '../../../core/models/pet.models';

export interface Commune {
  readonly name: string;
  readonly centre: GeoPoint;
}

interface ApiCommune {
  nom: string;
  centre?: { type: 'Point'; coordinates: [number, number] };
}

const API_URL = 'https://geo.api.gouv.fr/communes';
const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * French postal code → communes, through the public geo.api.gouv.fr API
 * (no key, CORS enabled). One postal code can cover several communes.
 */
@Injectable({ providedIn: 'root' })
export class GeoRepository {
  async communesByPostalCode(postalCode: string): Promise<Commune[]> {
    const params = new URLSearchParams({ codePostal: postalCode, fields: 'nom,centre', format: 'json' });
    const response = await fetch(`${API_URL}?${params}`);
    if (!response.ok) throw new Error(`geo.api.gouv.fr responded ${response.status}`);
    const communes = (await response.json()) as ApiCommune[];
    return communes
      .filter((c) => c.centre)
      .map((c) => ({ name: c.nom, centre: { lon: c.centre!.coordinates[0], lat: c.centre!.coordinates[1] } }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }
}
