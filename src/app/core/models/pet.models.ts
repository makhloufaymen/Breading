import type { Enums, Tables, TablesInsert, TablesUpdate } from '../supabase/database.types';

export type PetSex = Enums<'pet_sex'>;

/**
 * Every pets column except `location`: PostgREST would return the geography as
 * an opaque hex string, and the app only ever writes it.
 */
export const PET_COLUMNS =
  'id, owner_id, species_id, name, sex, breed_id, breed_other, birth_date, description, has_pedigree, pedigree_registry, pedigree_number, postal_code, city, is_active, created_at, updated_at';

export type Pet = Omit<Tables<'pets'>, 'location'>;
export type PetVaccination = Tables<'pet_vaccinations'>;
export type PetPhoto = Tables<'pet_photos'>;
export type PetDetail = Pet & {
  pet_vaccinations: PetVaccination[];
  pet_photos: Pick<PetPhoto, 'id' | 'path' | 'position'>[];
};
/** A pet in the owner's list, with its main photo (if any). */
export type PetListItem = Pet & { pet_photos: Pick<PetPhoto, 'path'>[] };

/** Another owner's pet as shown in the detail sheet (discovery, likes, matches). */
export type PetProfile = Pet & {
  pet_vaccinations: Pick<PetVaccination, 'vaccine_id' | 'administered_on' | 'expires_on'>[];
  pet_photos: Pick<PetPhoto, 'path'>[];
  owner: { display_name: string } | null;
};

/** Same limit as the pet_photos_before_insert trigger. */
export const PET_PHOTOS_MAX = 6;

/** Same bounds as the CHECK constraints on pets. */
export const PET_NAME_MAX = 40;
export const PET_BREED_OTHER_MIN = 2;
export const PET_BREED_OTHER_MAX = 60;
export const PET_DESCRIPTION_MAX = 1000;
export const PET_PEDIGREE_FIELD_MAX = 40;

/** Usual pedigree registry per species, suggested in the form. */
export const DEFAULT_PEDIGREE_REGISTRY: Readonly<Record<number, string>> = { 1: 'LOF', 2: 'LOOF' };

export interface GeoPoint {
  readonly lon: number;
  readonly lat: number;
}

/** A type alias (not an interface) so it stays assignable to the RPC's Json parameter. */
export type VaccinationInput = {
  readonly vaccine_id: number;
  readonly administered_on: string;
  readonly expires_on: string | null;
};

/** What the pet form produces. */
export interface PetInput {
  readonly speciesId: number;
  readonly name: string;
  readonly sex: PetSex;
  /** Exactly one of breedId / breedOther is set. */
  readonly breedId: number | null;
  readonly breedOther: string | null;
  readonly birthDate: string;
  readonly description: string | null;
  readonly pedigree: { readonly registry: string; readonly number: string | null } | null;
  readonly postalCode: string;
  readonly city: string;
  /** Centre of the commune; null on update keeps the stored location. */
  readonly location: GeoPoint | null;
  readonly isActive: boolean;
  readonly vaccinations: readonly VaccinationInput[];
}

/** PostGIS accepts EWKT text for geography columns. Longitude comes first. */
export function toEwkt({ lon, lat }: GeoPoint): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

/** Columns the client may update (species is fixed after creation). */
export function toPetUpdate(input: PetInput): TablesUpdate<'pets'> {
  return {
    name: input.name,
    sex: input.sex,
    breed_id: input.breedId,
    breed_other: input.breedOther,
    birth_date: input.birthDate,
    description: input.description,
    has_pedigree: input.pedigree !== null,
    pedigree_registry: input.pedigree?.registry ?? null,
    pedigree_number: input.pedigree?.number ?? null,
    postal_code: input.postalCode,
    city: input.city,
    is_active: input.isActive,
    ...(input.location ? { location: toEwkt(input.location) } : {}),
  };
}

export function toPetInsert(input: PetInput): TablesInsert<'pets'> {
  if (!input.location) throw new Error('A new pet needs a location');
  return {
    ...toPetUpdate(input),
    species_id: input.speciesId,
    name: input.name,
    sex: input.sex,
    birth_date: input.birthDate,
    postal_code: input.postalCode,
    city: input.city,
    location: toEwkt(input.location),
  };
}
