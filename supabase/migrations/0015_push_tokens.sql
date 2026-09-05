-- The Expo push token for whichever device this person last opened the app
-- on. Written by `usePushBookingRequests` on every launch, because a token
-- can be reassigned after a reinstall or a device restore.
--
-- Read by the `notify-booking-request` Edge Function under the service role.
-- It is deliberately NOT readable by other signed-in users: a push token is
-- a send-anything-to-this-device capability, and the profiles select policy
-- (0002, tightened in 0012) already exposes name/avatar/email to any
-- signed-in user. Column-level revocation is the only way to keep this out
-- of that, since Postgres RLS filters rows, not columns.
alter table public.profiles
  add column if not exists push_token text;

revoke select (push_token) on public.profiles from authenticated;
revoke select (push_token) on public.profiles from anon;

-- The owner still needs to write their own, which the profiles update
-- policy already scopes to `auth.uid() = id`.
grant update (push_token) on public.profiles to authenticated;