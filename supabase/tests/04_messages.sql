-- messages: participants only, read receipts, conversations.
-- Plays several users in one transaction (rolled back at the end). Run: supabase/tests/run.sh
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'xa@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'xb@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'xc@test.fr', 'authenticated', 'authenticated');
insert into pets (id, owner_id, species_id, name, sex, breed_other, birth_date, postal_code, city, location) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'A1', 'male',   'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1, 'B1', 'female', 'Croisé', '2022-01-01', '69001', 'Lyon',  'SRID=4326;POINT(4.83 45.76)');
insert into swipes (swiper_pet_id, target_pet_id, kind) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'like'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'like');
select set_config('test.match', (select id::text from matches where pet_a_id = 'a0000000-0000-0000-0000-000000000001'), false);

create temp table results (test text, ok boolean);
grant all on results to public;
create function pg_temp.expect_error(label text, stmt text) returns void language plpgsql as $$
begin execute stmt; insert into results values (label, false);
exception when others then insert into results values (label || ' [' || sqlstate || ']', true); end $$;
grant execute on function pg_temp.expect_error(text, text) to public;
create function pg_temp.as_user(c text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || c, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to public;

set local role authenticated;

select pg_temp.as_user('a');
insert into messages (match_id, body) values (current_setting('test.match')::uuid, 'Bonjour !'), (current_setting('test.match')::uuid, 'Rex a hâte');
insert into results select 'A sends, sender defaults to A', bool_and(sender_id = '00000000-0000-0000-0000-00000000000a') from messages;
select pg_temp.expect_error('A cannot send as B', $q$insert into messages (match_id, sender_id, body) values (current_setting('test.match')::uuid, '00000000-0000-0000-0000-00000000000b', 'x')$q$);
select pg_temp.expect_error('empty message refused', $q$insert into messages (match_id, body) values (current_setting('test.match')::uuid, '   ')$q$);
select pg_temp.expect_error('A cannot set read_at', $q$update messages set read_at = now()$q$);
select pg_temp.expect_error('A cannot delete', $q$delete from messages$q$);
insert into results select 'A: 0 unread (own messages)', unread_count = 0 and last_message_mine from my_conversations();

select pg_temp.as_user('c');
insert into results select 'C cannot read', count(*) = 0 from messages;
select pg_temp.expect_error('C cannot send in A/B match', $q$insert into messages (match_id, body) values (current_setting('test.match')::uuid, 'spam')$q$);
select pg_temp.expect_error('C cannot mark read', $q$select mark_messages_read(current_setting('test.match')::uuid)$q$);
insert into results select 'C has no conversation', count(*) = 0 from my_conversations();

select pg_temp.as_user('b');
insert into results select 'B sees conversation with 2 unread, last from A',
  unread_count = 2 and last_message = 'Rex a hâte' and not last_message_mine and other_pet_name = 'A1' and my_pet_name = 'B1'
  from my_conversations();
insert into messages (match_id, body) values (current_setting('test.match')::uuid, 'Avec plaisir');
select mark_messages_read(current_setting('test.match')::uuid);
insert into results select 'B marks read: A''s messages read, own untouched',
  count(*) filter (where read_at is not null) = 2 and count(*) filter (where read_at is null and body = 'Avec plaisir') = 1 from messages;
insert into results select 'B: 0 unread after reading', unread_count = 0 from my_conversations();

select pg_temp.as_user('a');
insert into results select 'A: 1 unread from B', unread_count = 1 from my_conversations();
select unmatch(current_setting('test.match')::uuid);
insert into results select 'unmatch deletes the conversation', count(*) = 0 from messages;

reset role;
select * from results;
select count(*) filter (where not ok) as failures from results;

-- Fails the script (and the CI job) if any check failed.
do $$ begin
  if exists (select 1 from results where not ok) then
    raise exception 'security test failures: %', (select string_agg(test, ', ') from results where not ok);
  end if;
end $$;
rollback;
