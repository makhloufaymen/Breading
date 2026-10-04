-- Likes and matches.
-- A swipe is a like or a pass from one of my pets on a compatible pet. A match
-- is created ONLY by the trigger below, when two compatible pets like each other.
-- The client never writes to matches; unmatching goes through unmatch().

create type public.swipe_kind as enum ('like', 'pass');

-- ─── Helpers (SECURITY DEFINER: read pets/matches regardless of policies) ───

-- Same species, opposite sexes, different owners, both active.
-- Step 8 will add "neither owner blocked the other".
create function public.are_compatible(p_pet_a uuid, p_pet_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pets a
    join public.pets b on b.id = p_pet_b
    where a.id = p_pet_a
      and a.species_id = b.species_id
      and a.sex <> b.sex
      and a.owner_id <> b.owner_id
      and a.is_active and b.is_active
  );
$$;

revoke execute on function public.are_compatible(uuid, uuid) from public, anon;
grant execute on function public.are_compatible(uuid, uuid) to authenticated;

-- ─── Swipes ──────────────────────────────────────────────────
create table public.swipes (
  id              uuid primary key default gen_random_uuid(),
  swiper_pet_id   uuid not null references public.pets (id) on delete cascade,
  target_pet_id   uuid not null references public.pets (id) on delete cascade,
  kind            public.swipe_kind not null,
  created_at      timestamptz not null default now(),
  -- One decision per pair and direction; kept after an unmatch so the pets
  -- are never proposed to each other again.
  unique (swiper_pet_id, target_pet_id),
  check (swiper_pet_id <> target_pet_id)
);

comment on table public.swipes is 'Like or pass of a pet (swiper) on another pet (target). Kept forever, also after an unmatch.';

-- "Who liked my pet" reads by target.
create index swipes_target_idx on public.swipes (target_pet_id, kind);

alter table public.swipes enable row level security;

-- My own decisions, and the likes my pets received (never the passes: they stay private).
create policy "swipes: read mine and likes received"
  on public.swipes for select
  to authenticated
  using (
    (select public.is_pet_owner(swiper_pet_id))
    or (kind = 'like' and (select public.is_pet_owner(target_pet_id)))
  );

create policy "swipes: owner swipes on compatible pets"
  on public.swipes for insert
  to authenticated
  with check (
    (select public.is_pet_owner(swiper_pet_id))
    and public.are_compatible(swiper_pet_id, target_pet_id)
  );

revoke insert, update, delete, truncate on public.swipes from anon, authenticated;
revoke select on public.swipes from anon;
grant insert (swiper_pet_id, target_pet_id, kind) on public.swipes to authenticated;

-- ─── Matches ─────────────────────────────────────────────────
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  -- Canonical pair: the smaller id first, so (A, B) and (B, A) are the same row.
  pet_a_id    uuid not null references public.pets (id) on delete cascade,
  pet_b_id    uuid not null references public.pets (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (pet_a_id, pet_b_id),
  check (pet_a_id < pet_b_id)
);

comment on table public.matches is 'Mutual like between two compatible pets. Created by the swipes trigger only. One match = one conversation.';

create index matches_pet_b_idx on public.matches (pet_b_id);

-- One of my pets is in this match.
create function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and (public.is_pet_owner(m.pet_a_id) or public.is_pet_owner(m.pet_b_id))
  );
$$;

revoke execute on function public.is_match_participant(uuid) from public, anon;
grant execute on function public.is_match_participant(uuid) to authenticated;

-- This pet is matched with one of my pets (keeps it visible even if it becomes inactive).
create function public.is_matched_with_my_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where (m.pet_a_id = p_pet_id and public.is_pet_owner(m.pet_b_id))
       or (m.pet_b_id = p_pet_id and public.is_pet_owner(m.pet_a_id))
  );
$$;

revoke execute on function public.is_matched_with_my_pet(uuid) from public, anon;
grant execute on function public.is_matched_with_my_pet(uuid) to authenticated;

alter table public.matches enable row level security;

create policy "matches: participants can read"
  on public.matches for select
  to authenticated
  using ((select public.is_pet_owner(pet_a_id)) or (select public.is_pet_owner(pet_b_id)));

-- No write policy and no write privilege: only the trigger (and unmatch) write here.
revoke insert, update, delete, truncate on public.matches from anon, authenticated;
revoke select on public.matches from anon;

-- Matched pets stay readable (name, photos…) even if their owner hides them later.
drop policy "pets: read own and active pets" on public.pets;
create policy "pets: read own, active and matched pets"
  on public.pets for select
  to authenticated
  using (owner_id = (select auth.uid()) or is_active or public.is_matched_with_my_pet(id));

-- ─── Match trigger ───────────────────────────────────────────
create function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid := least(new.swiper_pet_id, new.target_pet_id);
  v_b uuid := greatest(new.swiper_pet_id, new.target_pet_id);
begin
  -- Two simultaneous likes would not see each other's uncommitted row: serialize
  -- per pair. The lock is held until commit, so the second one sees the first.
  perform pg_advisory_xact_lock(hashtextextended(v_a::text || v_b::text, 0));

  if exists (
    select 1 from public.swipes
    where swiper_pet_id = new.target_pet_id and target_pet_id = new.swiper_pet_id and kind = 'like'
  ) and public.are_compatible(new.swiper_pet_id, new.target_pet_id) then
    insert into public.matches (pet_a_id, pet_b_id) values (v_a, v_b)
    on conflict (pet_a_id, pet_b_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger swipes_create_match
  after insert on public.swipes
  for each row
  when (new.kind = 'like')
  execute function public.create_match_on_mutual_like();

-- ─── RPC: swipe ──────────────────────────────────────────────
-- SECURITY INVOKER: the swipes policies apply. Returns the match id when this
-- like completed a match (so the app can celebrate), null otherwise.
create function public.swipe_pet(p_swiper_pet_id uuid, p_target_pet_id uuid, p_kind public.swipe_kind)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  insert into public.swipes (swiper_pet_id, target_pet_id, kind)
  values (p_swiper_pet_id, p_target_pet_id, p_kind)
  on conflict (swiper_pet_id, target_pet_id) do nothing;

  if p_kind = 'like' then
    select m.id into v_match_id
    from public.matches m
    where m.pet_a_id = least(p_swiper_pet_id, p_target_pet_id)
      and m.pet_b_id = greatest(p_swiper_pet_id, p_target_pet_id);
  end if;
  return v_match_id;
end;
$$;

revoke execute on function public.swipe_pet(uuid, uuid, public.swipe_kind) from public, anon;
grant execute on function public.swipe_pet(uuid, uuid, public.swipe_kind) to authenticated;

-- ─── RPC: unmatch ────────────────────────────────────────────
-- Deletes the match (and, from step 7, its conversation by cascade). Swipes are
-- kept so the two pets are not proposed to each other again.
create function public.unmatch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.matches m
  where m.id = p_match_id
    and (public.is_pet_owner(m.pet_a_id) or public.is_pet_owner(m.pet_b_id));
  if not found then
    raise exception 'match not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.unmatch(uuid) from public, anon;
grant execute on function public.unmatch(uuid) to authenticated;

-- ─── RPC: likes received ─────────────────────────────────────
-- Likes received by my pets that I have not answered yet (no swipe back),
-- from pets that are still compatible. Newest first.
create function public.received_likes()
returns table (
  liked_at        timestamptz,
  my_pet_id       uuid,
  my_pet_name     text,
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
set search_path = ''
as $$
  select
    s.created_at, mine.id, mine.name,
    liker.id, liker.name, liker.sex, liker.species_id, liker.breed_id, liker.breed_other,
    liker.birth_date, liker.has_pedigree, liker.city,
    round((extensions.st_distance(liker.location, mine.location) / 1000)::numeric, 1)::double precision,
    coalesce((select array_agg(ph.path order by ph.position) from public.pet_photos ph where ph.pet_id = liker.id), '{}')
  from public.swipes s
  join public.pets mine on mine.id = s.target_pet_id and mine.owner_id = (select auth.uid())
  join public.pets liker on liker.id = s.swiper_pet_id
  where s.kind = 'like'
    and public.are_compatible(mine.id, liker.id)
    and not exists (
      select 1 from public.swipes back
      where back.swiper_pet_id = mine.id and back.target_pet_id = liker.id
    )
  order by s.created_at desc;
$$;

revoke execute on function public.received_likes() from public, anon;
grant execute on function public.received_likes() to authenticated;

-- ─── Discovery: never propose a pet twice ────────────────────
create or replace function public.search_pets(
  p_seeker_pet_id     uuid,
  p_breed_ids         int[] default null,
  p_min_age_years     int default null,
  p_max_age_years     int default null,
  p_max_distance_km   int default null,
  p_exclude_ids       uuid[] default null,
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
set search_path = ''
as $$
  with seeker as (
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
    -- Already liked or passed by this seeker (also after an unmatch).
    and not exists (
      select 1 from public.swipes sw where sw.swiper_pet_id = p_seeker_pet_id and sw.target_pet_id = t.id
    )
    and (coalesce(cardinality(p_breed_ids), 0) = 0 or t.breed_id = any (p_breed_ids))
    and (p_min_age_years is null or t.birth_date <= (current_date - make_interval(years => p_min_age_years))::date)
    and (p_max_age_years is null or t.birth_date > (current_date - make_interval(years => p_max_age_years + 1))::date)
    and (p_max_distance_km is null or extensions.st_dwithin(t.location, s.location, p_max_distance_km * 1000))
    and (p_exclude_ids is null or t.id <> all (p_exclude_ids))
  order by extensions.st_distance(t.location, s.location), t.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
