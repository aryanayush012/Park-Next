import { File } from 'expo-file-system';
import { supabase } from '../data/supabaseClient';

/**
 * Uploads photos picked via `expo-image-picker`/the camera to real Supabase
 * Storage, so a listing or profile photo actually loads on someone else's
 * device — not just the phone it was taken on.
 *
 * The bug this fixes: `expo-image-picker` hands back a `file://...` URI
 * pointing into *this app's own sandboxed cache* on *this device*
 * (something like
 * `file:///data/user/0/host.exp.exponent/cache/ExperienceData/.../ImagePicker/xyz.jpeg`
 * in Expo Go, or the standalone app's own cache once built). Saving that
 * string straight into `listings.photos` / `profiles.avatar_url` "worked"
 * only by accident, on the one device that took the photo, only until its
 * cache is cleared — nothing else can ever resolve that path. Real, public
 * Storage buckets (`supabase/migrations/0013_storage_buckets.sql`) fix this
 * by giving every photo a real `https://` URL any device can load.
 */

const LISTING_PHOTOS_BUCKET = 'listing-photos';
const AVATARS_BUCKET = 'avatars';

/** True for a URI that lives on this device only (camera/library picker output) — as opposed to
 * an already-uploaded `https://...` Storage URL, which should just be left alone. */
function isLocalFileUri(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  );
}

function guessContentType(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === '') return 'image/jpeg';
  return `image/${ext}`;
}

/**
 * Uploads one photo if it's still a local device URI, returning the new
 * public Storage URL — or returns the URI unchanged if it's already a
 * public URL (e.g. re-saving a listing without touching an existing
 * photo). Safe to call on every photo on every save for this reason.
 *
 * Reads the file as raw bytes via `expo-file-system`'s SDK 57 `File` class
 * (`arrayBuffer()`) — the current API for this (the older
 * `readAsStringAsync(uri, {encoding: 'base64'})` path is deprecated in this
 * SDK), and skips an unnecessary base64 encode/decode round trip in the
 * process since Supabase's `upload()` accepts raw bytes directly.
 */
export async function uploadPhotoIfLocal(
  uri: string,
  bucket: 'listing-photos' | 'avatars',
  ownerFolder: string
): Promise<string> {
  if (!isLocalFileUri(uri)) return uri;

  const file = new File(uri);
  const bytes = await file.arrayBuffer();
  const extension = (file.extension || '.jpg').replace(/^\./, '').toLowerCase();
  const path = `${ownerFolder}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: guessContentType(extension),
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Uploads every local photo in `uris` (in parallel), preserving order and leaving any
 * already-public URLs untouched. */
export async function uploadListingPhotos(uris: string[], ownerId: string): Promise<string[]> {
  return Promise.all(uris.map((uri) => uploadPhotoIfLocal(uri, LISTING_PHOTOS_BUCKET, ownerId)));
}

/** Uploads a single avatar photo if it's still local, or returns `null` unchanged. */
export async function uploadAvatarPhoto(uri: string | null, userId: string): Promise<string | null> {
  if (!uri) return null;
  return uploadPhotoIfLocal(uri, AVATARS_BUCKET, userId);
}