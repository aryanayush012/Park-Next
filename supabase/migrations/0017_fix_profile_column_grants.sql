-- ParkNext — 0017: actually enforce the column restrictions 0015 and 0016 intended
--
-- Both of those used `revoke select (col) ...` / `revoke update (col) ...`,
-- which does nothing at all when the role already holds the privilege at
-- *table* level — and Supabase grants `anon` and `authenticated` table-wide
-- privileges on everything in `public` by default. The columns were left fully
-- readable and writable.
--
-- Verified against the live project: a signed-out request for
-- `profiles?select=push_token` returned 200, not a permission error.
--
-- Postgres only honours column-level privileges once the table-level one is
-- gone, so the fix is: revoke the whole privilege, then grant back exactly the
-- columns that should be reachable.

-- Why it matters: an Expo push token is enough on its own to send a
-- notification to that device through Expo's public API. The profiles select
-- policy (0002, tightened in 0012) lets any signed-in user read any profile
-- row, so a leaked column here means anyone with an account can spam every
-- user of the app.
revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  email,
  name,
  phone,
  avatar_url,
  created_at,
  about,
  phone_verified_at
) on public.profiles to anon, authenticated;

-- `push_token` is deliberately absent above. Only the service role — which
-- bypasses grants entirely — can read it, which is exactly the set of callers
-- that needs to: the `notify-booking-request` Edge Function.

-- Same correction for writes. `phone` and `phone_verified_at` are set by the
-- `verify-phone` Edge Function after it validates a Firebase ID token; letting
-- the client write them would make the whole verification round trip
-- pointless. `push_token` stays writable — each device must register its own,
-- and the update policy already scopes that to `auth.uid() = id`.
revoke update on public.profiles from anon, authenticated;

grant update (
  name,
  avatar_url,
  about,
  push_token
) on public.profiles to authenticated;

-- Insert is untouched: `handle_new_user()` creates the row under the trigger,
-- and the insert policy already restricts it to the new user themselves.