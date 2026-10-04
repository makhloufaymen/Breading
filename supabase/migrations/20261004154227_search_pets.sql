-- Discovery: compatible pets for one of my pets, nearest first.
-- Compatibility = same species, opposite sex, another owner, both pets active.
-- Step 6 will also exclude already swiped pets, step 8 blocked owners
-- (both with "create or replace" of this function).

create function public.search_pets(
  p_seeker_pet_id     uuid,
  p_breed_ids         int[] default null,   -- null/empty = any breed
  p_min_age_years     int default null,
  p_max_age_years     int default null,     -- inclusive: 3 keeps pets up to 3 years and 11 months
  p_max_distance_km   int default null,     -- null = no limit
  p_exclude_ids       uuid[] default null,  -- pets already shown in this session
  p_limit             int default 20
)
returns table (
  id              uuid,
  name            text,
  sex             public.pet_sex,
  species_id      smallint,
  breed_id        int,
  breed_other     text,
  birth_date      date,
  has_pedigree    boolean,
  city            text,
  distance_km     double precision,
  photo_paths     text[]
)
language sql
stable
-- SECURITY INVOKER (the default): runs as the caller, so the pets policies
-- still apply (only active pets of others are visible anyway).
set search_path = ''
as $$
  with seeker as (
    -- Only my own, active pet can search: otherwise no row, so no result.
    select p.species_id, p.sex, p.location
    from public.pets p
    where p.id = p_seeker_pet_id and p.owner_id = (select auth.uid()) and p.is_active
  )
  select
    t.id, t.name, t.sex, t.species_id, t.breed_id, t.breed_other, t.birth_date, t.has_pedigree, t.city,
    round((extensions.st_distance(t.location, s.location) / 1000)::numeric, 1)::double precision,
    coalesce((select array_agg(ph.path order by ph.position) from public.pet_photos ph where ph.pet_id = t.id), '{}')
  from public.pets t
  cross join seeker s
  where t.species_id = s.species_id
    and t.sex <> s.sex
    and t.owner_id <> (select auth.uid())
    and t.is_active
    and (coalesce(cardinality(p_breed_ids), 0) = 0 or t.breed_id = any (p_breed_ids))
    and (p_min_age_years is null or t.birth_date <= (current_date - make_interval(years => p_min_age_years))::date)
    and (p_max_age_years is null or t.birth_date > (current_date - make_interval(years => p_max_age_years + 1))::date)
    -- ST_DWithin uses the GiST index on pets.location.
    and (p_max_distance_km is null or extensions.st_dwithin(t.location, s.location, p_max_distance_km * 1000))
    and (p_exclude_ids is null or t.id <> all (p_exclude_ids))
  order by extensions.st_distance(t.location, s.location), t.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.search_pets(uuid, int[], int, int, int, uuid[], int) from public, anon;
grant execute on function public.search_pets(uuid, int[], int, int, int, uuid[], int) to authenticated;
