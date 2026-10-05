-- pets and vaccinations: owner-only writes, breed/vaccine/species rules.
-- Plays several users in one transaction (rolled back at the end). Run: supabase/tests/run.sh
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.fr', '{"display_name":"Alice"}', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.fr', '{"display_name":"Bob"}', 'authenticated', 'authenticated');

create temp table results (test text, ok boolean);
grant all on results to public;

-- Runs a statement that must fail; records whether it did.
create function pg_temp.expect_error(label text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  insert into results values (label, false);
exception when others then
  insert into results values (label || ' [' || sqlstate || ']', true);
end $$;
grant execute on function pg_temp.expect_error(text, text) to public;

-- ── As Alice ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

with ins as (
  insert into public.pets (species_id, name, sex, breed_id, birth_date, postal_code, city, location)
  select 1, 'Rex', 'male', (select id from breeds where species_id = 1 limit 1),
         '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2.34 48.86)'
  returning id)
select set_config('test.rex', id::text, false) from ins;
insert into results select 'alice inserts own pet, owner defaulted', owner_id = '00000000-0000-0000-0000-00000000000a' from pets where id = current_setting('test.rex')::uuid;

insert into public.pets (species_id, name, sex, breed_other, birth_date, postal_code, city, location, is_active)
values (2, 'Hidden', 'female', 'Gouttière', '2023-01-01', '69001', 'Lyon', 'SRID=4326;POINT(4.83 45.76)', false);

select set_pet_vaccinations(current_setting('test.rex')::uuid,
  (select jsonb_agg(jsonb_build_object('vaccine_id', id, 'administered_on', '2025-01-01', 'expires_on', '2026-01-01')) from vaccines where species_id = 1 and code in ('rabies','distemper')));
insert into results select 'alice sets 2 vaccinations', count(*) = 2 from pet_vaccinations where pet_id = current_setting('test.rex')::uuid;
select set_pet_vaccinations(current_setting('test.rex')::uuid,
  (select jsonb_agg(jsonb_build_object('vaccine_id', id, 'administered_on', '2025-02-01')) from vaccines where species_id = 1 and code = 'rabies'));
insert into results select 'alice replaces vaccinations', count(*) = 1 from pet_vaccinations where pet_id = current_setting('test.rex')::uuid;

select pg_temp.expect_error('cat vaccine on a dog', $q$select set_pet_vaccinations(current_setting('test.rex')::uuid, jsonb_build_array(jsonb_build_object('vaccine_id', (select id from vaccines where species_id = 2 limit 1), 'administered_on', '2025-01-01')))$q$);
select pg_temp.expect_error('cat breed on a dog', $q$insert into pets (species_id, name, sex, breed_id, birth_date, postal_code, city, location) values (1, 'X', 'male', (select id from breeds where species_id = 2 limit 1), '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2 48)')$q$);
select pg_temp.expect_error('breed and breed_other together', $q$insert into pets (species_id, name, sex, breed_id, breed_other, birth_date, postal_code, city, location) values (1, 'X', 'male', (select id from breeds where species_id = 1 limit 1), 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2 48)')$q$);
select pg_temp.expect_error('no breed at all', $q$insert into pets (species_id, name, sex, birth_date, postal_code, city, location) values (1, 'X', 'male', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2 48)')$q$);
select pg_temp.expect_error('future birth date', $q$insert into pets (species_id, name, sex, breed_other, birth_date, postal_code, city, location) values (1, 'X', 'male', 'Croisé', current_date + 1, '75001', 'Paris', 'SRID=4326;POINT(2 48)')$q$);
select pg_temp.expect_error('registry without pedigree', $q$insert into pets (species_id, name, sex, breed_other, birth_date, postal_code, city, location, pedigree_registry) values (1, 'X', 'male', 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2 48)', 'LOF')$q$);
select pg_temp.expect_error('insert for someone else', $q$insert into pets (owner_id, species_id, name, sex, breed_other, birth_date, postal_code, city, location) values ('00000000-0000-0000-0000-00000000000b', 1, 'X', 'male', 'Croisé', '2022-01-01', '75001', 'Paris', 'SRID=4326;POINT(2 48)')$q$);
select pg_temp.expect_error('change species', $q$update pets set species_id = 2 where id = current_setting('test.rex')::uuid$q$);
select pg_temp.expect_error('change owner', $q$update pets set owner_id = '00000000-0000-0000-0000-00000000000b' where id = current_setting('test.rex')::uuid$q$);
select pg_temp.expect_error('direct vaccination update', $q$update pet_vaccinations set expires_on = '2030-01-01'$q$);

-- ── As Bob ──
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into results select 'bob sees alice active pet only', array_agg(name) = array['Rex'] from pets where owner_id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'bob sees vaccinations of active pet', count(*) = 1 from pet_vaccinations where pet_id = current_setting('test.rex')::uuid;

with u as (update pets set name = 'Hacked' where id = current_setting('test.rex')::uuid returning 1)
insert into results select 'bob cannot update alice pet', count(*) = 0 from u;
with d as (delete from pets where id = current_setting('test.rex')::uuid returning 1)
insert into results select 'bob cannot delete alice pet', count(*) = 0 from d;
with d as (delete from pet_vaccinations returning 1)
insert into results select 'bob cannot delete alice vaccinations', count(*) = 0 from d;
select pg_temp.expect_error('bob cannot set alice vaccinations', $q$select set_pet_vaccinations(current_setting('test.rex')::uuid, '[]')$q$);
select pg_temp.expect_error('bob cannot add vaccination to alice pet', $q$insert into pet_vaccinations (pet_id, vaccine_id, administered_on) values (current_setting('test.rex')::uuid, (select id from vaccines where species_id = 1 and code = 'lyme'), '2025-01-01')$q$);

-- ── As anon ──
set local role anon;
select pg_temp.expect_error('anon cannot read pets', $q$select count(*) from pets$q$);

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
