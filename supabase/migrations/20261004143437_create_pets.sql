-- Pets and their vaccinations.
-- A pet belongs to one owner; its breed comes from the reference list or is typed
-- freely (never both); its location is the centre of its commune (no GPS).

create type public.pet_sex as enum ('male', 'female');

-- Lets the composite foreign key below check that a breed belongs to the pet's species.
alter table public.breeds add constraint breeds_id_species_key unique (id, species_id);

-- ─── Pets ────────────────────────────────────────────────────
create table public.pets (
  id                uuid primary key default gen_random_uuid(),
  -- Defaults to the caller, so the client never has to send it.
  owner_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  species_id        smallint not null references public.species (id),
  name              text not null check (char_length(name) between 1 and 40),
  sex               public.pet_sex not null,
  breed_id          int,
  breed_other       text check (char_length(breed_other) between 2 and 60),
  birth_date        date not null check (birth_date >= date '1990-01-01'),
  description       text check (char_length(description) <= 1000),
  has_pedigree      boolean not null default false,
  pedigree_registry text check (char_length(pedigree_registry) between 2 and 40),
  pedigree_number   text check (char_length(pedigree_number) between 1 and 40),
  postal_code       text not null check (postal_code ~ '^[0-9]{5}$'),
  city              text not null check (char_length(city) between 1 and 80),
  location          extensions.geography(Point, 4326) not null,
  -- Inactive pets stay visible to their owner but are hidden from discovery.
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A breed from the list OR a free-text breed, never both, never neither.
  constraint pets_breed_xor check ((breed_id is null) <> (breed_other is null)),
  -- The listed breed must belong to the pet's species (MATCH SIMPLE: skipped when breed_id is null).
  constraint pets_breed_species_fkey foreign key (breed_id, species_id) references public.breeds (id, species_id),
  -- Without a pedigree there is no registry nor number; with one, the registry is required.
  constraint pets_pedigree_check check (
    case when has_pedigree then pedigree_registry is not null
         else pedigree_registry is null and pedigree_number is null end
  )
);

comment on table public.pets is 'A dog or cat owned by a profile. location = centre of the commune (postal_code, city).';

create index pets_owner_idx on public.pets (owner_id);
create index pets_species_idx on public.pets (species_id);
-- Distance search (search_pets, step 5).
create index pets_location_idx on public.pets using gist (location);

-- CHECK constraints must be immutable, so "not in the future" is checked here.
create function public.pets_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date > current_date then
    raise exception 'birth_date cannot be in the future' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger pets_before_write
  before insert or update on public.pets
  for each row execute function public.pets_before_write();

-- ─── Pet ownership helper ────────────────────────────────────
-- SECURITY DEFINER so that policies of other tables (vaccinations, photos,
-- swipes…) can check ownership without re-applying the pets policies.
create function public.is_pet_owner(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pets where id = p_pet_id and owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_pet_owner(uuid) from public, anon;
grant execute on function public.is_pet_owner(uuid) to authenticated;

-- ─── Pets: Row Level Security ────────────────────────────────
alter table public.pets enable row level security;

-- Own pets (active or not) and other owners' active pets.
-- Step 8 will hide pets of blocked owners.
create policy "pets: read own and active pets"
  on public.pets for select
  to authenticated
  using (owner_id = (select auth.uid()) or is_active);

create policy "pets: owner can insert"
  on public.pets for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "pets: owner can update"
  on public.pets for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "pets: owner can delete"
  on public.pets for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Column privileges: id, owner_id, timestamps are server-side; species is fixed
-- after creation (swipes and matches rely on it).
revoke insert, update, delete, truncate on public.pets from anon, authenticated;
revoke select on public.pets from anon;
grant insert (species_id, name, sex, breed_id, breed_other, birth_date, description,
              has_pedigree, pedigree_registry, pedigree_number, postal_code, city, location, is_active)
  on public.pets to authenticated;
grant update (name, sex, breed_id, breed_other, birth_date, description,
              has_pedigree, pedigree_registry, pedigree_number, postal_code, city, location, is_active)
  on public.pets to authenticated;
grant delete on public.pets to authenticated;

-- ─── Vaccinations ────────────────────────────────────────────
-- One row per vaccine and pet: the last administration (boosters overwrite it).
create table public.pet_vaccinations (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id) on delete cascade,
  vaccine_id       int not null references public.vaccines (id),
  administered_on  date not null check (administered_on >= date '1990-01-01'),
  expires_on       date,
  unique (pet_id, vaccine_id),
  constraint pet_vaccinations_dates_check check (expires_on is null or expires_on > administered_on)
);

create index pet_vaccinations_vaccine_idx on public.pet_vaccinations (vaccine_id);

-- The vaccine must exist for the pet's species (a cat can't get a kennel cough shot).
create function public.pet_vaccinations_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.pets p
    join public.vaccines v on v.species_id = p.species_id
    where p.id = new.pet_id and v.id = new.vaccine_id
  ) then
    raise exception 'vaccine % does not apply to this pet''s species', new.vaccine_id
      using errcode = 'check_violation';
  end if;
  if new.administered_on > current_date then
    raise exception 'administered_on cannot be in the future' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger pet_vaccinations_before_write
  before insert or update on public.pet_vaccinations
  for each row execute function public.pet_vaccinations_before_write();

alter table public.pet_vaccinations enable row level security;

-- Readable whenever the pet itself is readable (the subquery goes through the pets policy).
create policy "pet_vaccinations: read with the pet"
  on public.pet_vaccinations for select
  to authenticated
  using (pet_id in (select id from public.pets));

create policy "pet_vaccinations: owner can insert"
  on public.pet_vaccinations for insert
  to authenticated
  with check ((select public.is_pet_owner(pet_id)));

create policy "pet_vaccinations: owner can delete"
  on public.pet_vaccinations for delete
  to authenticated
  using ((select public.is_pet_owner(pet_id)));

-- No update: the client replaces the whole list with set_pet_vaccinations().
revoke insert, update, delete, truncate on public.pet_vaccinations from anon, authenticated;
revoke select on public.pet_vaccinations from anon;
grant insert (pet_id, vaccine_id, administered_on, expires_on) on public.pet_vaccinations to authenticated;
grant delete on public.pet_vaccinations to authenticated;

-- ─── RPC: replace a pet's vaccinations atomically ────────────
-- SECURITY INVOKER (the default): runs as the caller, so the RLS policies above
-- still apply; the function only adds atomicity (one transaction).
-- p_items: [{"vaccine_id": 3, "administered_on": "2025-04-01", "expires_on": null}, …]
create function public.set_pet_vaccinations(p_pet_id uuid, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'not the owner of this pet' using errcode = 'insufficient_privilege';
  end if;

  delete from public.pet_vaccinations where pet_id = p_pet_id;

  insert into public.pet_vaccinations (pet_id, vaccine_id, administered_on, expires_on)
  select p_pet_id, item.vaccine_id, item.administered_on, item.expires_on
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as item (vaccine_id int, administered_on date, expires_on date);
end;
$$;

revoke execute on function public.set_pet_vaccinations(uuid, jsonb) from public, anon;
grant execute on function public.set_pet_vaccinations(uuid, jsonb) to authenticated;
