-- swipes and matches: privacy of passes, mutual likes, unmatch.
-- Plays several users in one transaction (rolled back at the end). Run: supabase/tests/run.sh
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'ma@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'mb@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'mc@test.fr', 'authenticated', 'authenticated');

insert into pets (id, owner_id, species_id, name, sex, breed_other, birth_date, postal_code, city, location) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'A1', 'male',   'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 1, 'A2', 'female', 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1, 'B1', 'female', 'Croisé', '2022-01-01', '69001', 'Lyon',  'SRID=4326;POINT(4.83 45.76)'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 2, 'B2', 'female', 'Croisé', '2022-01-01', '69001', 'Lyon',  'SRID=4326;POINT(4.83 45.76)'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 1, 'C1', 'female', 'Croisé', '2022-01-01', '75002', 'Paris', 'SRID=4326;POINT(2.35 48.87)');

create temp table results (test text, ok boolean);
grant all on results to public;
create function pg_temp.expect_error(label text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  insert into results values (label, false);
exception when others then
  insert into results values (label || ' [' || sqlstate || ']', true);
end $$;
grant execute on function pg_temp.expect_error(text, text) to public;
create function pg_temp.as_user(c text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || c, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to public;

set local role authenticated;

-- ── A ──
select pg_temp.as_user('a');
insert into results select 'A likes B1: no match yet',
  swipe_pet('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'like') is null;
insert into results select 'A passes C1',
  swipe_pet('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pass') is null;
insert into results select 'search excludes swiped pets', count(*) filter (where name in ('B1','C1')) = 0 and count(*) > 0 from search_pets('a0000000-0000-0000-0000-000000000001');
select pg_temp.expect_error('swipe with someone else''s pet', $q$select swipe_pet('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'like')$q$);
select pg_temp.expect_error('swipe on incompatible species', $q$select swipe_pet('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'like')$q$);
select pg_temp.expect_error('swipe on own pet', $q$select swipe_pet('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'like')$q$);
select pg_temp.expect_error('insert a match directly', $q$insert into matches (pet_a_id, pet_b_id) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001')$q$);
select pg_temp.expect_error('delete own swipe', $q$delete from swipes$q$);

-- ── C: the pass stays private, C likes A1 ──
select pg_temp.as_user('c');
insert into results select 'C does not see the pass received', count(*) = 0 from swipes;
insert into results select 'C has no received likes', count(*) = 0 from received_likes();
select swipe_pet('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'like');

-- ── B: sees the like, likes back → match ──
select pg_temp.as_user('b');
insert into results select 'B sees A1 in likes received for B1',
  array_agg(name || '>' || my_pet_name) = array['A1>B1'] from received_likes();
insert into results select 'B likes back: match id returned',
  swipe_pet('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'like') is not null;
insert into results select 'canonical pair stored', count(*) = 1 from matches
  where pet_a_id = 'a0000000-0000-0000-0000-000000000001' and pet_b_id = 'b0000000-0000-0000-0000-000000000001';
insert into results select 'answered like leaves the list', count(*) = 0 from received_likes();

-- ── A ──
select pg_temp.as_user('a');
insert into results select 'A sees the match', count(*) = 1 from matches;
insert into results select 'A sees C1 like (A passed C1 before, so hidden)', count(*) = 0 from received_likes();

-- ── C cannot see nor delete the A/B match ──
select pg_temp.as_user('c');
insert into results select 'C cannot see the A/B match', count(*) = 0 from matches;
select pg_temp.expect_error('C cannot unmatch A/B', $q$select unmatch((select id from public.matches limit 1))$q$);

-- Matched pet stays visible when hidden
reset role;
update pets set is_active = false where id = 'b0000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('a');
insert into results select 'hidden matched pet still readable', count(*) = 1 from pets where id = 'b0000000-0000-0000-0000-000000000001';
select unmatch((select id from matches limit 1));
insert into results select 'unmatch removes the match', count(*) = 0 from matches;
insert into results select 'unmatch keeps swipes', count(*) = 2 from swipes where swiper_pet_id = 'a0000000-0000-0000-0000-000000000001';
insert into results select 'hidden pet not readable after unmatch', count(*) = 0 from pets where id = 'b0000000-0000-0000-0000-000000000001';

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
