-- Development data only (run by `supabase db reset`, never in production).
-- 15 test owners (password "password123"), about 100 dogs and cats across France
-- (many around Toulouse), vaccinations, likes and matches between them.
-- Generated deterministically: the same data after every reset.
-- Idempotent: can also be run on an existing local database.
-- Photos: run `node supabase/scripts/seed-photos.mjs` afterwards (Storage files
-- can't be created from SQL).

create extension if not exists pgcrypto with schema extensions;

-- ─── Owners ──────────────────────────────────────────────────
-- Same shape as a GoTrue sign-up: users row + email identity. Token columns
-- must be '' (not null) or GoTrue fails to sign these users in.
with owners(id, email, display_name) as (values
  ('5eed0000-0000-0000-0000-000000000001'::uuid, 'camille@test.fr', 'Camille'),
  ('5eed0000-0000-0000-0000-000000000002'::uuid, 'julien@test.fr',  'Julien'),
  ('5eed0000-0000-0000-0000-000000000003'::uuid, 'sophie@test.fr',  'Sophie'),
  ('5eed0000-0000-0000-0000-000000000004'::uuid, 'lucas@test.fr',   'Lucas'),
  ('5eed0000-0000-0000-0000-000000000005'::uuid, 'emma@test.fr',    'Emma'),
  ('5eed0000-0000-0000-0000-000000000006'::uuid, 'hugo@test.fr',    'Hugo'),
  ('5eed0000-0000-0000-0000-000000000007'::uuid, 'lea@test.fr',     'Léa'),
  ('5eed0000-0000-0000-0000-000000000008'::uuid, 'thomas@test.fr',  'Thomas'),
  ('5eed0000-0000-0000-0000-000000000009'::uuid, 'chloe@test.fr',   'Chloé'),
  ('5eed0000-0000-0000-0000-000000000010'::uuid, 'nathan@test.fr',  'Nathan'),
  ('5eed0000-0000-0000-0000-000000000011'::uuid, 'manon@test.fr',   'Manon'),
  ('5eed0000-0000-0000-0000-000000000012'::uuid, 'louis@test.fr',   'Louis'),
  ('5eed0000-0000-0000-0000-000000000013'::uuid, 'ines@test.fr',    'Inès'),
  ('5eed0000-0000-0000-0000-000000000014'::uuid, 'jules@test.fr',   'Jules'),
  ('5eed0000-0000-0000-0000-000000000015'::uuid, 'sarah@test.fr',   'Sarah')
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
select s.id, ('5eed0000-0000-0000-0000-' || lpad(s.owner::text, 12, '0'))::uuid, s.species, s.name, s.sex::public.pet_sex,
       b.id, s.breed_other, s.birth::date,
       s.pedigree is not null, s.pedigree, s.cp, s.city,
       extensions.st_setsrid(extensions.st_makepoint(s.lon, s.lat), 4326)::extensions.geography, s.description
from pets_seed s
left join public.breeds b on b.species_id = s.species and b.name = s.breed
on conflict (id) do nothing;

-- ─── Generated pets ──────────────────────────────────────────
-- 90 more pets, ids 5eed0002-…-<n>. Every choice derives from n, so the data is
-- the same after each reset. 2 dogs for 1 cat, sexes alternate, 1 in 3 near Toulouse.
with
cities(k, cp, city, lon, lat) as (values
  (0,  '31000', 'Toulouse',         1.444, 43.604), (1,  '31700', 'Blagnac',          1.390, 43.633),
  (2,  '31770', 'Colomiers',        1.335, 43.611), (3,  '82000', 'Montauban',        1.355, 44.018),
  (4,  '81000', 'Albi',             2.148, 43.929), (5,  '75011', 'Paris',            2.380, 48.859),
  (6,  '69003', 'Lyon',             4.850, 45.760), (7,  '13001', 'Marseille',        5.380, 43.300),
  (8,  '33000', 'Bordeaux',        -0.580, 44.840), (9,  '44000', 'Nantes',          -1.550, 47.220),
  (10, '59000', 'Lille',            3.060, 50.630), (11, '67000', 'Strasbourg',       7.750, 48.580),
  (12, '06000', 'Nice',             7.260, 43.700), (13, '34000', 'Montpellier',      3.880, 43.610),
  (14, '35000', 'Rennes',          -1.680, 48.110), (15, '38000', 'Grenoble',         5.720, 45.190),
  (16, '21000', 'Dijon',            5.040, 47.320), (17, '37000', 'Tours',            0.690, 47.390),
  (18, '64000', 'Pau',             -0.370, 43.300), (19, '11000', 'Carcassonne',      2.350, 43.210)
),
names(species, sex, list) as (values
  (1, 'male',   array['Rocky','Milo','Oscar','Simba','Filou','Gaston','Hercule','Pilou','Tango','Ulysse','Vasco','Zeus','Balto','Chico','Diego']),
  (1, 'female', array['Luna','Nala','Maya','Praline','Câline','Olga','Perle','Réglisse','Vanille','Isis','Jazz','Kira','Lilou','Mila','Noisette']),
  (2, 'male',   array['Félix','Gribouille','Minou','Pacha','Tigrou','Caramel','Oreo','Pépito','Ronron','Sushi']),
  (2, 'female', array['Minette','Cannelle','Mimi','Plume','Grisette','Moka','Nougat','Pistache','Fripouille','Paprika'])
),
descriptions(k, text) as (values
  (0, 'Très câlin, adore les longues siestes au soleil.'),
  (1, 'Plein d''énergie, toujours partant pour une balade.'),
  (2, 'Sociable avec les autres animaux et les enfants.'),
  (3, 'Un peu timide au début, puis très affectueux.'),
  (4, 'Gourmand et joueur, connaît plein de tours.'),
  (5, 'Calme et posé, idéal pour une première portée.'),
  (6, 'Champion de frisbee du quartier.'),
  (7, 'Adore l''eau et les promenades en forêt.'),
  (8, null), (9, null)
),
gen as (
  select n,
         case when n % 3 = 0 then 2 else 1 end as species,
         case when n % 2 = 0 then 'female' else 'male' end as sex,
         case when n % 3 = 1 then n % 5 else 5 + (n * 7) % 15 end as city_k,
         1 + (n * 4) % 15 as owner
  from generate_series(1, 90) as n
)
insert into public.pets (id, owner_id, species_id, name, sex, breed_id, breed_other, birth_date, description,
                         has_pedigree, pedigree_registry, pedigree_number, postal_code, city, location, is_active)
select
  ('5eed0002-0000-0000-0000-' || lpad(g.n::text, 12, '0'))::uuid,
  ('5eed0000-0000-0000-0000-' || lpad(g.owner::text, 12, '0'))::uuid,
  g.species,
  nm.list[1 + (g.n / 2) % cardinality(nm.list)],
  g.sex::public.pet_sex,
  case when g.n % 7 = 0 then null
       else (select b.id from public.breeds b where b.species_id = g.species order by b.name
             offset (g.n * 13) % (select count(*) from public.breeds b2 where b2.species_id = g.species) limit 1)
  end,
  case when g.n % 7 = 0 then (case when g.species = 1 then 'Croisé' else 'Européen' end) end,
  current_date - (120 + (g.n * 97) % 4000),            -- 4 months to ~11 years
  d.text,
  g.n % 4 = 0,
  case when g.n % 4 = 0 then (case when g.species = 1 then 'LOF' else 'LOOF' end) end,
  case when g.n % 8 = 0 then lpad(((g.n * 7919) % 999999)::text, 6, '0') end,
  c.cp, c.city,
  -- A few hundred metres around the city centre, so pets don't all overlap.
  extensions.st_setsrid(extensions.st_makepoint(c.lon + ((g.n % 9) - 4) * 0.01, c.lat + ((g.n % 7) - 3) * 0.01), 4326)::extensions.geography,
  g.n % 17 <> 0                                          -- a few hidden pets
from gen g
join cities c on c.k = g.city_k
join names nm on nm.species = g.species and nm.sex = g.sex
join descriptions d on d.k = g.n % 10
on conflict (id) do nothing;

-- ─── Vaccinations of test pets ───────────────────────────────
-- About two thirds of the vaccines of the species; some already expired.
insert into public.pet_vaccinations (pet_id, vaccine_id, administered_on, expires_on)
select p.id, v.id,
       current_date - (30 + (abs(hashtext(p.id::text)) + v.id * 37) % 500),
       case when v.id % 2 = 0 then current_date - (30 + (abs(hashtext(p.id::text)) + v.id * 37) % 500) + 365 end
from public.pets p
join public.vaccines v on v.species_id = p.species_id
where p.id::text like '5eed%'
  and (abs(hashtext(p.id::text)) + v.id) % 3 <> 0
on conflict (pet_id, vaccine_id) do nothing;

-- ─── Likes and passes between test pets ──────────────────────
-- About 1 compatible pair in 4 gets a like (so ~1 in 16 a mutual like → match
-- through the trigger), 1 in 8 a pass.
insert into public.swipes (swiper_pet_id, target_pet_id, kind)
select a.id, b.id,
       case when abs(hashtext(a.id::text || b.id::text)) % 8 < 2 then 'like' else 'pass' end::public.swipe_kind
from public.pets a
join public.pets b on public.are_compatible(a.id, b.id)
where a.id::text like '5eed%' and b.id::text like '5eed%'
  and abs(hashtext(a.id::text || b.id::text)) % 8 < 3
on conflict (swiper_pet_id, target_pet_id) do nothing;

-- ─── Likes between test accounts ─────────────────────────────
-- Camille sees them in "Ils vous aiment" (Oscar, Mochi) and can like back to match.
insert into public.swipes (swiper_pet_id, target_pet_id, kind) values
  ('5eed0001-0000-0000-0000-000000000003', '5eed0001-0000-0000-0000-000000000002', 'like'),  -- Lola → Oscar
  ('5eed0001-0000-0000-0000-000000000005', '5eed0001-0000-0000-0000-000000000002', 'like'),  -- Bella → Oscar
  ('5eed0001-0000-0000-0000-000000000012', '5eed0001-0000-0000-0000-000000000011', 'like')   -- Simba → Mochi
on conflict (swiper_pet_id, target_pet_id) do nothing;
