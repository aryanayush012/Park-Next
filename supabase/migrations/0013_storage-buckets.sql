-- Two public Storage buckets for real photo hosting: listing photos and
-- profile avatars. Both are public so the `getPublicUrl()` URL saved into
-- `listings.photos` / `profiles.avatar_url` (src/utils/photoUpload.ts)
-- loads on any device, not just the one that took the photo — fixing the
-- bug where a raw local `file://...` picker URI was being saved directly
-- and only ever rendered on the uploader's own phone.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('avatars', 'avatars', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Public read on both — restated explicitly even though the buckets above
-- are already marked `public = true`, since that flag only guarantees
-- unauthenticated access to a bare public URL; some access paths (the
-- Storage API rather than a direct URL fetch) still consult these
-- policies, so this is what actually makes "anyone can view a listing's
-- photos or another user's avatar" reliable everywhere in the app.
create policy "listing_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A signed-in user may only upload into a folder prefixed with their own
-- auth id — exactly the `${ownerId}/...` / `${userId}/...` path
-- `uploadPhotoIfLocal()` already uses, so this doesn't change anything
-- about how the app behaves; it just stops anything else (a leaked key, a
-- bug in some future screen) from being able to write into someone else's
-- folder. `storage.foldername(name)` splits an object's path into an
-- array of its folder segments — `[1]` is the first one.
create policy "listing_photos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );