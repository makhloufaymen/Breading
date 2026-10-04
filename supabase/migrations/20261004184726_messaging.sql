-- Messaging: one conversation per match, between the two owners.
-- Deleting the match (unmatch, pet or account deletion) deletes its messages.

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  -- Defaults to the caller, so the client never sends it.
  sender_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  -- clock_timestamp(), not now(): now() is the transaction start, so messages
  -- inserted together would tie and the order (and "last message") be ambiguous.
  created_at  timestamptz not null default clock_timestamp(),
  -- Set by mark_messages_read() when the recipient opens the conversation.
  read_at     timestamptz
);

comment on table public.messages is 'Chat message of a match conversation. read_at = read by the recipient.';

-- Conversation screen (newest first, paged) and last message per conversation.
create index messages_match_created_idx on public.messages (match_id, created_at desc);
-- Unread counters.
create index messages_unread_idx on public.messages (match_id) where read_at is null;

alter table public.messages enable row level security;

-- Only the two owners of the match. Realtime uses this same policy to decide
-- who receives each change: the policies also protect the live stream.
create policy "messages: match participants can read"
  on public.messages for select
  to authenticated
  using ((select public.is_match_participant(match_id)));

create policy "messages: match participants can send as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = (select auth.uid()) and (select public.is_match_participant(match_id)));

-- No update/delete by the client: read_at goes through mark_messages_read().
revoke insert, update, delete, truncate on public.messages from anon, authenticated;
revoke select on public.messages from anon;
grant insert (match_id, body) on public.messages to authenticated;

-- Live updates: new messages and read receipts.
alter publication supabase_realtime add table public.messages;

-- ─── RPC: mark a conversation as read ────────────────────────
-- SECURITY DEFINER because the client has no UPDATE privilege on messages;
-- it can only stamp read_at on messages it received in its own matches.
create function public.mark_messages_read(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_match_participant(p_match_id) then
    raise exception 'not a participant of this match' using errcode = 'insufficient_privilege';
  end if;
  update public.messages
  set read_at = now()
  where match_id = p_match_id and sender_id <> (select auth.uid()) and read_at is null;
end;
$$;

revoke execute on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- ─── RPC: my conversations ───────────────────────────────────
-- One row per match of my pets: both pets, the other owner, the last message
-- and my unread count. Most recent activity first.
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
  other_owner_name    text,
  last_message        text,
  last_message_at     timestamptz,
  last_message_mine   boolean,
  unread_count        int
)
language sql
stable
-- SECURITY INVOKER: matches/pets/messages policies apply.
set search_path = ''
as $$
  select
    m.id, m.created_at,
    mine.id, mine.name,
    (select ph.path from public.pet_photos ph where ph.pet_id = mine.id order by ph.position limit 1),
    other.id, other.name, other.species_id, other.city,
    (select ph.path from public.pet_photos ph where ph.pet_id = other.id order by ph.position limit 1),
    owner.display_name,
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
