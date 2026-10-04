-- Reference data: species, breeds and vaccines.
-- This is application data (needed in every environment, production included),
-- so it lives in a migration and not in seed.sql (which is for dev test data).
-- Clients can only read these tables.

-- ─── Species ─────────────────────────────────────────────────
-- Fixed ids: the app may refer to them, and they must be identical everywhere.
create table public.species (
  id    smallint primary key,
  code  text not null unique,
  name  text not null
);

insert into public.species (id, code, name) values
  (1, 'dog', 'Chien'),
  (2, 'cat', 'Chat');

-- ─── Breeds ──────────────────────────────────────────────────
-- A pet whose breed is missing from this list uses pets.breed_other (step 3).
create table public.breeds (
  id          int primary key generated always as identity,
  species_id  smallint not null references public.species (id),
  name        text not null,
  unique (species_id, name)
);

create index breeds_species_idx on public.breeds (species_id);

insert into public.breeds (species_id, name)
select 1, unnest(array[
  'Affenpinscher', 'Airedale Terrier', 'Akita américain', 'Akita Inu', 'Alaskan Malamute',
  'American Bully', 'American Staffordshire Terrier', 'Ariégeois', 'Barbet', 'Basenji',
  'Basset artésien normand', 'Basset bleu de Gascogne', 'Basset fauve de Bretagne', 'Basset Hound',
  'Beagle', 'Beagle-Harrier', 'Bearded Collie', 'Beauceron', 'Bedlington Terrier',
  'Berger allemand', 'Berger américain miniature', 'Berger d''Anatolie (Kangal)', 'Berger australien',
  'Berger belge Groenendael', 'Berger belge Laekenois', 'Berger belge Malinois', 'Berger belge Tervueren',
  'Berger blanc suisse', 'Berger de Brie (Briard)', 'Berger de Maremme et des Abruzzes',
  'Berger des Pyrénées', 'Berger du Caucase', 'Berger hollandais', 'Berger islandais', 'Berger picard',
  'Berger polonais de plaine', 'Berger des Shetland', 'Bichon bolonais', 'Bichon frisé',
  'Bichon havanais', 'Bichon maltais', 'Billy', 'Bobtail', 'Boerboel', 'Border Collie',
  'Border Terrier', 'Boston Terrier', 'Bouledogue américain', 'Bouledogue anglais',
  'Bouledogue français', 'Bouvier australien', 'Bouvier bernois', 'Bouvier d''Appenzell',
  'Bouvier de l''Entlebuch', 'Bouvier des Flandres', 'Boxer', 'Braque allemand à poil court',
  'Braque allemand à poil dur (Drahthaar)', 'Braque d''Auvergne', 'Braque de l''Ariège',
  'Braque de Weimar', 'Braque du Bourbonnais', 'Braque français', 'Braque hongrois (Vizsla)',
  'Braque italien', 'Braque Saint-Germain', 'Briquet griffon vendéen', 'Bull Terrier', 'Bullmastiff',
  'Cairn Terrier', 'Cane Corso', 'Caniche nain', 'Caniche moyen', 'Caniche royal', 'Caniche toy',
  'Carlin', 'Cavalier King Charles', 'Chien chinois à crête', 'Chien d''eau espagnol',
  'Chien d''eau portugais', 'Chien de Saint-Hubert', 'Chien du pharaon', 'Chien loup de Saarloos',
  'Chien loup tchécoslovaque', 'Chien nu du Mexique (Xoloitzcuintle)', 'Chien nu du Pérou',
  'Chihuahua', 'Chow-Chow', 'Cocker américain', 'Cocker anglais', 'Colley à poil court',
  'Colley à poil long', 'Coton de Tuléar', 'Dalmatien', 'Dandie Dinmont Terrier', 'Dobermann',
  'Dogue allemand', 'Dogue argentin', 'Dogue de Bordeaux', 'Dogue du Tibet', 'Épagneul breton',
  'Épagneul de Pont-Audemer', 'Épagneul français', 'Épagneul japonais', 'Épagneul nain continental (Papillon)',
  'Épagneul nain continental (Phalène)', 'Épagneul picard', 'Épagneul tibétain', 'Eurasier',
  'Fox Terrier à poil dur', 'Fox Terrier à poil lisse', 'Golden Retriever', 'Grand Anglo-Français',
  'Grand Bleu de Gascogne', 'Grand Bouvier suisse', 'Grand Griffon vendéen', 'Greyhound',
  'Griffon belge', 'Griffon bruxellois', 'Griffon fauve de Bretagne', 'Griffon Korthals', 'Hovawart',
  'Husky sibérien', 'Jack Russell Terrier', 'Kerry Blue Terrier', 'Komondor', 'Kooikerhondje',
  'Kuvasz', 'Labrador Retriever', 'Lagotto Romagnolo', 'Lakeland Terrier', 'Leonberg',
  'Lévrier afghan', 'Lévrier barzoï', 'Lévrier whippet', 'Lhassa Apso', 'Mastiff',
  'Mâtin de Naples', 'Mâtin des Pyrénées', 'Mâtin espagnol', 'Montagne des Pyrénées',
  'Norfolk Terrier', 'Norwich Terrier', 'Parson Russell Terrier', 'Pékinois',
  'Petit Basset Griffon vendéen', 'Petit Brabançon', 'Petit chien lion', 'Pinscher allemand',
  'Pinscher nain', 'Podenco', 'Pointer anglais', 'Poitevin', 'Porcelaine', 'Puli',
  'Retriever à poil bouclé', 'Retriever à poil plat (Flat-Coated)', 'Retriever de la baie de Chesapeake',
  'Retriever de la Nouvelle-Écosse', 'Rhodesian Ridgeback', 'Rottweiler', 'Saint-Bernard', 'Saluki',
  'Samoyède', 'Schipperke', 'Schnauzer géant', 'Schnauzer moyen', 'Schnauzer nain', 'Scottish Terrier',
  'Setter anglais', 'Setter Gordon', 'Setter irlandais', 'Shar-Peï', 'Shiba Inu', 'Shih Tzu',
  'Silky Terrier', 'Sloughi', 'Spinone italiano', 'Spitz allemand (Loulou de Poméranie)',
  'Spitz allemand moyen', 'Spitz japonais', 'Springer anglais', 'Staffordshire Bull Terrier',
  'Teckel à poil dur', 'Teckel à poil long', 'Teckel à poil ras', 'Terre-Neuve', 'Terrier du Tibet',
  'Terrier irlandais', 'Terrier noir russe', 'Welsh Corgi Cardigan', 'Welsh Corgi Pembroke',
  'Welsh Terrier', 'West Highland White Terrier', 'Yorkshire Terrier'
]);

insert into public.breeds (species_id, name)
select 2, unnest(array[
  'Abyssin', 'American Curl', 'American Shorthair', 'Angora turc', 'Balinais', 'Bengal',
  'Bleu russe', 'Bobtail japonais', 'Bombay', 'British Longhair', 'British Shorthair', 'Burmese',
  'Burmilla', 'Chartreux', 'Chausie', 'Cornish Rex', 'Devon Rex', 'Européen', 'Exotic Shorthair',
  'Havana Brown', 'Highland Fold', 'Korat', 'Kurilian Bobtail', 'LaPerm', 'Lykoi', 'Maine Coon',
  'Mau égyptien', 'Munchkin', 'Nebelung', 'Norvégien', 'Ocicat', 'Oriental', 'Persan',
  'Persan Colourpoint (Himalayen)', 'Peterbald', 'Ragamuffin', 'Ragdoll', 'Sacré de Birmanie',
  'Savannah', 'Scottish Fold', 'Scottish Straight', 'Selkirk Rex', 'Siamois', 'Sibérien',
  'Singapura', 'Snowshoe', 'Sokoké', 'Somali', 'Sphynx', 'Thaï', 'Tonkinois', 'Toyger', 'Turc de Van'
]);

-- ─── Vaccines (predefined list per species) ──────────────────
create table public.vaccines (
  id          int primary key generated always as identity,
  species_id  smallint not null references public.species (id),
  code        text not null,
  name        text not null,
  unique (species_id, code)
);

create index vaccines_species_idx on public.vaccines (species_id);

insert into public.vaccines (species_id, code, name) values
  -- Dogs (the classic "CHPPiL" + rabies and optional ones)
  (1, 'distemper',      'Maladie de Carré (C)'),
  (1, 'hepatitis',      'Hépatite de Rubarth (H)'),
  (1, 'parvovirus',     'Parvovirose (P)'),
  (1, 'parainfluenza',  'Parainfluenza (Pi)'),
  (1, 'leptospirosis',  'Leptospirose (L)'),
  (1, 'rabies',         'Rage (R)'),
  (1, 'kennel_cough',   'Toux du chenil'),
  (1, 'piroplasmosis',  'Piroplasmose'),
  (1, 'leishmaniasis',  'Leishmaniose'),
  (1, 'lyme',           'Maladie de Lyme'),
  -- Cats ("TCL" + rabies and optional ones)
  (2, 'panleukopenia',  'Typhus (T)'),
  (2, 'cat_flu',        'Coryza (C)'),
  (2, 'felv',           'Leucose féline (L)'),
  (2, 'chlamydia',      'Chlamydiose'),
  (2, 'rabies',         'Rage (R)');

-- ─── Row Level Security: read-only for signed-in users ───────
alter table public.species  enable row level security;
alter table public.breeds   enable row level security;
alter table public.vaccines enable row level security;

create policy "species: signed-in users can read"  on public.species  for select to authenticated using (true);
create policy "breeds: signed-in users can read"   on public.breeds   for select to authenticated using (true);
create policy "vaccines: signed-in users can read" on public.vaccines for select to authenticated using (true);

-- No write policy, and no write privilege either (defense in depth).
revoke insert, update, delete, truncate on public.species, public.breeds, public.vaccines from anon, authenticated;
revoke select on public.species, public.breeds, public.vaccines from anon;
