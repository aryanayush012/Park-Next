-- A short free-text bio shown on the signed-in user's own Profile screen and
-- editable there. Nullable and never required: an account is fully usable
-- without one, same as the avatar. Deliberately not added to the trimmed
-- `RenterProfile` the app fetches for *other* people (see
-- `getPublicProfile`) — nothing shows a stranger's bio yet, so nothing reads
-- it across accounts.
--
-- No RLS change needed: the existing `profiles` policies (0002, tightened in
-- 0012) already govern this row, and this column rides along with them.
alter table public.profiles
  add column if not exists about text;
