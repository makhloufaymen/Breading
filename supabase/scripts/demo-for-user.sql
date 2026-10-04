-- Development only: gives a real account something to see in Matches.
-- For each active pet of the account, among the nearest compatible test pets:
--   5 mutual likes  → matches (created by the swipes trigger, as in the app)
--   8 likes received → "Ils vous aiment"
-- The other test pets stay available in Discover. Safe to run again.
--
-- Usage (PowerShell or Git Bash, Supabase running):
--   docker exec -i supabase_db_Breading psql -U postgres -v email=you@example.com < supabase/scripts/demo-for-user.sql

\set ON_ERROR_STOP 1

create temp table demo_pairs as
select mine.id as my_pet, seed.id as seed_pet,
       row_number() over (partition by mine.id order by extensions.st_distance(mine.location, seed.location), seed.id) as rank
from public.pets mine
join auth.users u on u.id = mine.owner_id and u.email = :'email'
join public.pets seed on seed.id::text like '5eed%' and public.are_compatible(mine.id, seed.id)
-- Leave alone the pairs this pet already decided on in the app.
where not exists (select 1 from public.swipes s where s.swiper_pet_id = mine.id and s.target_pet_id = seed.id);

-- The test pet likes first…
insert into public.swipes (swiper_pet_id, target_pet_id, kind)
select seed_pet, my_pet, 'like' from demo_pairs where rank <= 13
on conflict (swiper_pet_id, target_pet_id) do nothing;

-- …then my pet likes back the 5 nearest: the trigger creates the matches.
insert into public.swipes (swiper_pet_id, target_pet_id, kind)
select my_pet, seed_pet, 'like' from demo_pairs where rank <= 5
on conflict (swiper_pet_id, target_pet_id) do nothing;

select p.name as "mon animal",
       (select count(*) from public.matches m where p.id in (m.pet_a_id, m.pet_b_id)) as matchs,
       (select count(*) from public.swipes s
         where s.target_pet_id = p.id and s.kind = 'like'
           and not exists (select 1 from public.swipes b where b.swiper_pet_id = p.id and b.target_pet_id = s.swiper_pet_id)) as "likes reçus"
from public.pets p
join auth.users u on u.id = p.owner_id and u.email = :'email'
order by p.name;
