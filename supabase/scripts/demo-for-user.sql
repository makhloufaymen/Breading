-- Development only: gives a real account something to see in Matches.
-- For each active pet of the account, among the nearest compatible test pets:
--   5 mutual likes  → matches (created by the swipes trigger, as in the app)
--   8 likes received → "Ils vous aiment"
--   conversations in the first 3 matches (the last one ends with unread messages)
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

-- Conversations: matches dated over the last days, then a few messages.
update public.matches m
set created_at = now() - make_interval(days => 1 + (abs(hashtext(m.id::text)) % 6))
from public.pets mine
join auth.users u on u.id = mine.owner_id and u.email = :'email'
where mine.id in (m.pet_a_id, m.pet_b_id)
  and not exists (select 1 from public.messages x where x.match_id = m.id);

with mine as (
  select m.id as match_id, m.created_at, u.id as me,
         case when m.pet_a_id = p.id then pb.owner_id else pa.owner_id end as other,
         row_number() over (order by m.created_at desc, m.id) as rank
  from public.matches m
  join public.pets p on p.id in (m.pet_a_id, m.pet_b_id)
  join auth.users u on u.id = p.owner_id and u.email = :'email'
  join public.pets pa on pa.id = m.pet_a_id
  join public.pets pb on pb.id = m.pet_b_id
  where not exists (select 1 from public.messages x where x.match_id = m.id)
),
script(n, from_me, body) as (values
  (1, false, 'Bonjour ! Votre chien a l''air adorable 😍'),
  (2, true,  'Merci ! La vôtre aussi, elle est magnifique.'),
  (3, false, 'Elle est à jour de ses vaccins, et vous ?'),
  (4, true,  'Oui, tout est en règle. On pourrait se rencontrer ?'),
  (5, false, 'Avec plaisir ! Samedi au parc, ça vous irait ?'),
  (6, false, 'Vers 15 h par exemple 🐾')
)
insert into public.messages (match_id, sender_id, body, created_at, read_at)
select c.match_id, case when s.from_me then c.me else c.other end, s.body,
       c.created_at + make_interval(hours => s.n),
       -- In the most recent conversation, the last two messages stay unread.
       case when c.rank = 1 and s.n >= 5 then null else c.created_at + make_interval(hours => s.n, mins => 10) end
from mine c
join script s on s.n <= case c.rank when 1 then 6 when 2 then 4 when 3 then 2 else 0 end;

select p.name as "mon animal",
       (select count(*) from public.matches m where p.id in (m.pet_a_id, m.pet_b_id)) as matchs,
       (select count(*) from public.messages x join public.matches m on m.id = x.match_id
         where p.id in (m.pet_a_id, m.pet_b_id) and x.sender_id <> p.owner_id and x.read_at is null) as "non lus",
       (select count(*) from public.swipes s
         where s.target_pet_id = p.id and s.kind = 'like'
           and not exists (select 1 from public.swipes b where b.swiper_pet_id = p.id and b.target_pet_id = s.swiper_pet_id)) as "likes reçus"
from public.pets p
join auth.users u on u.id = p.owner_id and u.email = :'email'
order by p.name;
