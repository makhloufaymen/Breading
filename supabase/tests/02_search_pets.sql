-- search_pets: compatibility, filters, distance, exclusions.
-- Plays several users in one transaction (rolled back at the end). Run: supabase/tests/run.sh
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'sa@test.fr', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'sb@test.fr', 'authenticated', 'authenticated');

-- As postgres (bypasses RLS) to set up fixtures with known ids.
insert into pets (id, owner_id, species_id, name, sex, breed_id, breed_other, birth_date, postal_code, city, location, is_active) values
  -- Alice
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'Rex',      'male',   null, 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', true),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 1, 'OwnFem',   'female', null, 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', true),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 1, 'Sleeping', 'male',   null, 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', false),
  -- Bob
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1, 'Lyonnaise','female', (select id from breeds where name = 'Beagle'), null, '2021-06-01', '69001', 'Lyon', 'SRID=4326;POINT(4.83 45.76)', true),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 1, 'Parisienne','female', null, 'Croisé', '2025-01-01', '75011', 'Paris', 'SRID=4326;POINT(2.38 48.86)', true),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 1, 'Hidden',   'female', null, 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', false),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 1, 'Male',     'male',   null, 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', true),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000b', 2, 'Cat',      'female', null, 'Gouttière', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)', true);

-- The seed data lives in the same database: checks only look at this file's
-- fixture pets (ids b0000000-…).
create temp table results (test text, ok boolean);
grant all on results to public;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into results select 'only compatible pets, nearest first',
  array_agg(name order by ord) = array['Parisienne','Lyonnaise']
  from (select name, row_number() over () as ord from search_pets('a0000000-0000-0000-0000-000000000001') where id::text like 'b0000000-%') r;
insert into results select 'distance Paris-Lyon ~392 km',
  distance_km between 380 and 400 from search_pets('a0000000-0000-0000-0000-000000000001') where name = 'Lyonnaise';
insert into results select 'photo_paths empty array, not null',
  bool_and(photo_paths = '{}') from search_pets('a0000000-0000-0000-0000-000000000001') where id::text like 'b0000000-%';
insert into results select 'max distance 50 km',
  array_agg(name) = array['Parisienne'] from search_pets('a0000000-0000-0000-0000-000000000001', p_max_distance_km => 50) where id::text like 'b0000000-%';
insert into results select 'breed filter (Beagle)',
  array_agg(name) = array['Lyonnaise'] from search_pets('a0000000-0000-0000-0000-000000000001', p_breed_ids => array[(select id from breeds where name = 'Beagle')]);
insert into results select 'empty breed array = any breed',
  count(*) = 2 from search_pets('a0000000-0000-0000-0000-000000000001', p_breed_ids => '{}') where id::text like 'b0000000-%';
insert into results select 'min age 2 years',
  array_agg(name) = array['Lyonnaise'] from search_pets('a0000000-0000-0000-0000-000000000001', p_min_age_years => 2) where id::text like 'b0000000-%';
insert into results select 'max age 1 year (inclusive)',
  array_agg(name) = array['Parisienne'] from search_pets('a0000000-0000-0000-0000-000000000001', p_max_age_years => 1) where id::text like 'b0000000-%';
insert into results select 'exclude ids',
  array_agg(name) = array['Lyonnaise'] from search_pets('a0000000-0000-0000-0000-000000000001', p_exclude_ids => array['b0000000-0000-0000-0000-000000000002'::uuid]) where id::text like 'b0000000-%';
insert into results select 'limit',
  count(*) = 1 from search_pets('a0000000-0000-0000-0000-000000000001', p_limit => 1);
insert into results select 'inactive seeker gets nothing',
  count(*) = 0 from search_pets('a0000000-0000-0000-0000-000000000003');
insert into results select 'someone else''s pet as seeker gets nothing',
  count(*) = 0 from search_pets('b0000000-0000-0000-0000-000000000004');

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
