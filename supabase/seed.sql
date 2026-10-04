-- Development data only (run by `supabase db reset`, never in production).
-- Three test owners, password "password123", each with dogs/cats of both sexes
-- around France, so discovery has something to show.
-- Idempotent: can also be run on an existing local database.

create extension if not exists pgcrypto with schema extensions;

-- ─── Owners ──────────────────────────────────────────────────
-- Same shape as a GoTrue sign-up: users row + email identity. Token columns
-- must be '' (not null) or GoTrue fails to sign these users in.
with owners(id, email, display_name) as (values
  ('5eed0000-0000-0000-0000-000000000001'::uuid, 'camille@test.fr', 'Camille'),
  ('5eed0000-0000-0000-0000-000000000002'::uuid, 'julien@test.fr',  'Julien'),
  ('5eed0000-0000-0000-0000-000000000003'::uuid, 'sophie@test.fr',  'Sophie')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', display_name), now(), now(),
       '', '', '', ''
from owners
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.id::text like '5eed0000-%'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- ─── Pets ────────────────────────────────────────────────────
-- (profiles rows were created by the on_auth_user_created trigger)
with pets_seed(id, owner, species, name, sex, breed, breed_other, birth, pedigree, cp, city, lon, lat, description) as (values
  -- Dogs
  ('5eed0001-0000-0000-0000-000000000001'::uuid, 1, 1, 'Nala',    'female', 'Golden Retriever',   null, '2022-03-14', 'LOF', '75011', 'Paris',      2.380, 48.859, 'Douce et joueuse, adore les balades au parc.'),
  ('5eed0001-0000-0000-0000-000000000002'::uuid, 1, 1, 'Oscar',   'male',   'Labrador Retriever', null, '2021-07-02', null,  '92100', 'Boulogne-Billancourt', 2.240, 48.835, 'Très sociable avec les autres chiens.'),
  ('5eed0001-0000-0000-0000-000000000003'::uuid, 2, 1, 'Lola',    'female', 'Berger australien',  null, '2023-01-20', 'LOF', '69003', 'Lyon',       4.850, 45.760, 'Pleine d''énergie, championne de frisbee.'),
  ('5eed0001-0000-0000-0000-000000000004'::uuid, 2, 1, 'Rocky',   'male',   null, 'Croisé berger',          '2020-11-05', null,  '69100', 'Villeurbanne', 4.880, 45.770, null),
  ('5eed0001-0000-0000-0000-000000000005'::uuid, 3, 1, 'Bella',   'female', 'Bouledogue français', null, '2024-02-10', null,  '33000', 'Bordeaux',   -0.580, 44.840, 'Petit cœur câlin, ronfle un peu.'),
  ('5eed0001-0000-0000-0000-000000000006'::uuid, 3, 1, 'Max',     'male',   'Beagle',             null, '2019-05-30', 'LOF', '13001', 'Marseille',  5.380, 43.300, 'Gourmand et curieux.'),
  ('5eed0001-0000-0000-0000-000000000007'::uuid, 1, 1, 'Ruby',    'female', 'Cavalier King Charles', null, '2025-04-01', 'LOF', '78000', 'Versailles', 2.130, 48.800, 'Encore jeune, très affectueuse.'),
  -- Cats
  ('5eed0001-0000-0000-0000-000000000011'::uuid, 1, 2, 'Mochi',   'female', 'Maine Coon',         null, '2022-09-09', 'LOOF', '75015', 'Paris',     2.300, 48.840, 'Grande, calme et majestueuse.'),
  ('5eed0001-0000-0000-0000-000000000012'::uuid, 2, 2, 'Simba',   'male',   'Bengal',             null, '2021-12-12', 'LOOF', '69002', 'Lyon',      4.830, 45.750, 'Chasseur infatigable de plumeaux.'),
  ('5eed0001-0000-0000-0000-000000000013'::uuid, 3, 2, 'Pistache','female', null, 'Européen tigré',       '2023-06-18', null,   '31000', 'Toulouse',  1.440, 43.600, null),
  ('5eed0001-0000-0000-0000-000000000014'::uuid, 3, 2, 'Félix',   'male',   'Chartreux',          null, '2020-08-25', null,   '44000', 'Nantes',   -1.550, 47.220, 'Ronronne dès qu''on le regarde.')
)
insert into public.pets (id, owner_id, species_id, name, sex, breed_id, breed_other, birth_date,
                         has_pedigree, pedigree_registry, postal_code, city, location, description)
select s.id, ('5eed0000-0000-0000-0000-00000000000' || s.owner)::uuid, s.species, s.name, s.sex::public.pet_sex,
       b.id, s.breed_other, s.birth::date,
       s.pedigree is not null, s.pedigree, s.cp, s.city,
       extensions.st_setsrid(extensions.st_makepoint(s.lon, s.lat), 4326)::extensions.geography, s.description
from pets_seed s
left join public.breeds b on b.species_id = s.species and b.name = s.breed
on conflict (id) do nothing;
