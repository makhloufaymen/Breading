-- Pet photos: files in the public Storage bucket "pet-photos", one row per photo
-- in pet_photos (order, ownership). Paths: {owner_id}/{pet_id}/{uuid}.jpg

-- ─── Storage bucket ──────────────────────────────────────────
-- Public: photos are shown to every signed-in owner through plain URLs (no
-- signed URL to renew). Uploads are limited to resized JPEGs (the app resizes
-- them and strips EXIF before upload).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', true, 2 * 1024 * 1024, array['image/jpeg']);

-- storage.objects already has RLS enabled by Supabase. A public bucket serves
-- files without any policy; the policies below cover the API calls
-- (upload, list, delete), all restricted to the caller's own pets' folders.
create policy "pet-photos: owner can upload to own pet folders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_pet_owner(((storage.foldername(name))[2])::uuid)
  );

create policy "pet-photos: owner can list own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pet-photos: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─── pet_photos ──────────────────────────────────────────────
create table public.pet_photos (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id) on delete cascade,
  path        text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  -- 0 = main photo (shown on cards and lists).
  position    smallint not null default 0 check (position between 0 and 5),
  created_at  timestamptz not null default now()
);

comment on table public.pet_photos is 'Photos of a pet, ordered by position (0 = main). path points into the pet-photos bucket.';

create index pet_photos_pet_idx on public.pet_photos (pet_id, position);

-- Same limit as the app (PET_PHOTOS_MAX).
-- SECURITY DEFINER: the checks read pets regardless of the caller's policies.
create function public.pet_photos_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The file must sit in this pet's folder: {owner_id}/{pet_id}/…
  if not exists (
    select 1 from public.pets
    where id = new.pet_id and new.path like owner_id::text || '/' || id::text || '/%'
  ) then
    raise exception 'photo path does not match the pet folder' using errcode = 'check_violation';
  end if;
  -- Serializes concurrent uploads for the same pet so the count below is reliable.
  perform 1 from public.pets where id = new.pet_id for update;
  if (select count(*) from public.pet_photos where pet_id = new.pet_id) >= 6 then
    raise exception 'a pet can have at most 6 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger pet_photos_before_insert
  before insert on public.pet_photos
  for each row execute function public.pet_photos_before_insert();

alter table public.pet_photos enable row level security;

-- Readable whenever the pet itself is readable (the subquery goes through the pets policy).
create policy "pet_photos: read with the pet"
  on public.pet_photos for select
  to authenticated
  using (pet_id in (select id from public.pets));

create policy "pet_photos: owner can insert"
  on public.pet_photos for insert
  to authenticated
  with check ((select public.is_pet_owner(pet_id)));

create policy "pet_photos: owner can update"
  on public.pet_photos for update
  to authenticated
  using ((select public.is_pet_owner(pet_id)))
  with check ((select public.is_pet_owner(pet_id)));

create policy "pet_photos: owner can delete"
  on public.pet_photos for delete
  to authenticated
  using ((select public.is_pet_owner(pet_id)));

revoke insert, update, delete, truncate on public.pet_photos from anon, authenticated;
revoke select on public.pet_photos from anon;
grant insert (pet_id, path, position) on public.pet_photos to authenticated;
grant update (position) on public.pet_photos to authenticated;
grant delete on public.pet_photos to authenticated;

-- ─── RPC: reorder a pet's photos ─────────────────────────────
-- SECURITY INVOKER: RLS still applies. p_photo_ids lists the pet's photos in
-- their new order; the first one becomes the main photo.
create function public.reorder_pet_photos(p_pet_id uuid, p_photo_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'not the owner of this pet' using errcode = 'insufficient_privilege';
  end if;

  update public.pet_photos
  set position = array_position(p_photo_ids, id) - 1
  where pet_id = p_pet_id and id = any (p_photo_ids);
end;
$$;

revoke execute on function public.reorder_pet_photos(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_pet_photos(uuid, uuid[]) to authenticated;
