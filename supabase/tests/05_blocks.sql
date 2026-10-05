-- blocks and reports.
-- Plays several users in one transaction (rolled back at the end). Run: supabase/tests/run.sh
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'ka@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'kb@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'kc@test.fr', 'authenticated', 'authenticated');
insert into pets (id, owner_id, species_id, name, sex, breed_other, birth_date, postal_code, city, location) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'A1', 'male',   'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1, 'B1', 'female', 'Croisé', '2022-01-01', '75002', 'Paris', 'SRID=4326;POINT(2.35 48.87)'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 1, 'B2', 'female', 'Croisé', '2022-01-01', '75002', 'Paris', 'SRID=4326;POINT(2.35 48.87)'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 1, 'C1', 'female', 'Croisé', '2022-01-01', '75003', 'Paris', 'SRID=4326;POINT(2.36 48.86)');
insert into swipes (swiper_pet_id, target_pet_id, kind) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'like'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'like'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'like');
insert into messages (match_id, sender_id, body) select id, '00000000-0000-0000-0000-00000000000b', 'Salut' from matches where pet_a_id = 'a0000000-0000-0000-0000-000000000001';

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
insert into results select 'before: A has the match and B2''s like', (select count(*) from matches) = 1 and (select count(*) from received_likes() where name = 'B2') = 1;
select block_owner('00000000-0000-0000-0000-00000000000b');
insert into results select 'block deletes the match', count(*) = 0 from matches;
insert into results select 'and the conversation', count(*) = 0 from messages;
insert into results select 'blocked owner''s likes hidden', count(*) = 0 from received_likes();
insert into results select 'A search hides B, keeps C', array_agg(name) = array['C1'] from search_pets('a0000000-0000-0000-0000-000000000001') where name in ('B1','B2','C1');
insert into results select 'A sees own block', count(*) = 1 from blocks;
select pg_temp.expect_error('A cannot block self', $q$select block_owner('00000000-0000-0000-0000-00000000000a')$q$);
select pg_temp.expect_error('A cannot insert blocks directly', $q$insert into blocks (blocked_id) values ('00000000-0000-0000-0000-00000000000c')$q$);

select pg_temp.as_user('b');
insert into results select 'B does not see who blocked them', count(*) = 0 from blocks;
insert into results select 'B search hides A too', count(*) = 0 from search_pets('b0000000-0000-0000-0000-000000000002') where name = 'A1';
select pg_temp.expect_error('B cannot like A anymore', $q$select swipe_pet('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'like')$q$);
with d as (delete from blocks returning 1) insert into results select 'B cannot lift A''s block', count(*) = 0 from d;

-- Reports
select pg_temp.as_user('c');
insert into reports (reported_owner_id, pet_id, reason, details) values ('00000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000001', 'fake_profile', 'Photos volées');
insert into results select 'C can report B', true;
select pg_temp.expect_error('C cannot read reports', $q$select count(*) from reports$q$);
select pg_temp.expect_error('C cannot report self', $q$insert into reports (reported_owner_id, reason) values ('00000000-0000-0000-0000-00000000000c', 'other')$q$);
select pg_temp.expect_error('C cannot report as B', $q$insert into reports (reporter_id, reported_owner_id, reason) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'other')$q$);

select pg_temp.as_user('a');
delete from blocks where blocked_id = '00000000-0000-0000-0000-00000000000b';
insert into results select 'A unblocks: B2 (not swiped yet by A) is back', array_agg(name order by name) = array['B2','C1'] from search_pets('a0000000-0000-0000-0000-000000000001') where name in ('B1','B2','C1');

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
