-- Trust and safety: blocking and reporting owners.
-- Account deletion is an Edge Function (supabase/functions/delete-account): it
-- needs the service_role key to delete the auth user and the Storage files.

-- ─── Blocks ──────────────────────────────────────────────────
create table public.blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.blocks is 'Owner A blocked owner B: they no longer see each other anywhere (both directions).';

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- I see (and can lift) my own blocks; nobody can tell who blocked them.
create policy "blocks: blocker can read"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks: blocker can unblock"
  on public.blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- Blocking goes through block_owner() (it also deletes the matches).
revoke insert, update, delete, truncate on public.blocks from anon, authenticated;
revoke select on public.blocks from anon;
grant delete on public.blocks to authenticated;

-- Either owner blocked the other. SECURITY DEFINER: reads the other side's
-- blocks, which the caller is not allowed to see.
create function public.is_blocked_between(p_owner_a uuid, p_owner_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_owner_a and blocked_id = p_owner_b)
       or (blocker_id = p_owner_b and blocked_id = p_owner_a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Compatibility now excludes blocked owners: no new swipe, like or match, and
-- received_likes (which uses it) hides their likes.
create or replace function public.are_compatible(p_pet_a uuid, p_pet_b uuid)
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
      and not public.is_blocked_between(a.owner_id, b.owner_id)
  );
$$;

-- ─── RPC: block an owner ─────────────────────────────────────
-- SECURITY DEFINER: also deletes the matches between the two owners (and so
-- their conversations), which no client may write.
create function public.block_owner(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null or p_owner_id = v_me then
    raise exception 'invalid owner' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_owner_id)
  on conflict do nothing;

  delete from public.matches m
  using public.pets a, public.pets b
  where a.id = m.pet_a_id and b.id = m.pet_b_id
    and ((a.owner_id = v_me and b.owner_id = p_owner_id) or (a.owner_id = p_owner_id and b.owner_id = v_me));
end;
$$;

revoke execute on function public.block_owner(uuid) from public, anon;
grant execute on function public.block_owner(uuid) to authenticated;

-- ─── Discovery: hide blocked owners (both directions) ────────
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
    and not public.is_blocked_between(t.owner_id, (select auth.uid()))
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

-- ─── Reports ─────────────────────────────────────────────────
create type public.report_reason as enum (
  'fake_profile', 'inappropriate_content', 'harassment', 'scam', 'animal_welfare', 'other'
);

create table public.reports (
  id                  uuid primary key default gen_random_uuid(),
  -- set null: a report outlives the accounts involved (moderation history).
  reporter_id         uuid default auth.uid() references public.profiles (id) on delete set null,
  reported_owner_id   uuid references public.profiles (id) on delete set null,
  pet_id              uuid references public.pets (id) on delete set null,
  match_id            uuid references public.matches (id) on delete set null,
  reason              public.report_reason not null,
  details             text check (char_length(details) <= 1000),
  created_at          timestamptz not null default now()
);

comment on table public.reports is 'Report of an owner (and optionally a pet or a conversation). Read by moderators only (no back-office in V1).';

alter table public.reports enable row level security;

-- Write-only for users: no select policy, reports are for moderators.
create policy "reports: users report others as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and reported_owner_id <> (select auth.uid()));

revoke insert, update, delete, truncate on public.reports from anon, authenticated;
revoke select on public.reports from anon, authenticated;
grant insert (reported_owner_id, pet_id, match_id, reason, details) on public.reports to authenticated;

-- ─── my_conversations: expose the other owner's id (block/report from the chat) ───
drop function public.my_conversations();

create function public.my_conversations()
returns table (
  match_id            uuid,
  matched_at          timestamptz,
  my_pet_id           uuid,
  my_pet_name         text,
  my_pet_photo        text,
  other_pet_id        uuid,
  other_pet_name      text,
  other_species_id    smallint,
  other_city          text,
  other_pet_photo     text,
  other_owner_id      uuid,
  other_owner_name    text,
  last_message        text,
  last_message_at     timestamptz,
  last_message_mine   boolean,
  unread_count        int
)
language sql
stable
set search_path = ''
as $$
  select
    m.id, m.created_at,
    mine.id, mine.name,
    (select ph.path from public.pet_photos ph where ph.pet_id = mine.id order by ph.position limit 1),
    other.id, other.name, other.species_id, other.city,
    (select ph.path from public.pet_photos ph where ph.pet_id = other.id order by ph.position limit 1),
    owner.id, owner.display_name,
    last.body, last.created_at, last.sender_id = (select auth.uid()),
    (select count(*) from public.messages u
      where u.match_id = m.id and u.read_at is null and u.sender_id <> (select auth.uid()))::int
  from public.matches m
  join public.pets mine on mine.id in (m.pet_a_id, m.pet_b_id) and mine.owner_id = (select auth.uid())
  join public.pets other on other.id in (m.pet_a_id, m.pet_b_id) and other.id <> mine.id
  join public.profiles owner on owner.id = other.owner_id
  left join lateral (
    select msg.body, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) last on true
  order by coalesce(last.created_at, m.created_at) desc;
$$;

revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
