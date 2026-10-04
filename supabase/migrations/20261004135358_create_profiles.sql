-- Owner profiles: one row per auth user, created automatically at sign-up.
-- auth.users is managed by Supabase Auth and not exposed through the API,
-- so public data about an owner lives here.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 50),
  created_at    timestamptz not null default now()
);

comment on table public.profiles is 'Public profile of a pet owner (1:1 with auth.users).';

-- ─── Row Level Security ──────────────────────────────────────
-- The app talks to Postgres directly through the REST API, so RLS is the only
-- thing standing between a user and other users' rows.
alter table public.profiles enable row level security;

-- Any signed-in owner can see display names (needed for matches and chat).
create policy "profiles: signed-in users can read"
  on public.profiles for select
  to authenticated
  using (true);

-- An owner can only edit their own profile.
create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policy: rows are created by the trigger below and deleted
-- by the cascade from auth.users (account deletion, step 8).

-- Column-level privileges: even on their own row, a user may only change
-- display_name (not id or created_at). RLS filters rows, GRANTs filter columns.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke select on public.profiles from anon;

-- ─── Auto-create the profile at sign-up ──────────────────────
-- SECURITY DEFINER: runs with the privileges of the function owner, because the
-- trigger fires inside the auth schema where the signing-up user has no rights.
-- search_path is pinned to '' so the function can't be hijacked by objects in
-- another schema; every name is therefore fully qualified.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Never fall back to the email prefix: display names are visible to everyone.
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Propriétaire')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
