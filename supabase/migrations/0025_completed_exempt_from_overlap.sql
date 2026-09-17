-- ParkNext — 0025: a completed booking can never block anything
--
-- Root cause of a real, reproduced failure: `checkOut` shrinks `end_at` down
-- to the real (possibly very late, with overtime) checkout moment in the
-- same update that sets `status = 'completed'` — but `completed` was never
-- exempt from `bookings_no_overlap`, because before overtime/grace existed
-- that never mattered: a normal checkout's `end_at` was always a past
-- timestamp, and a past range can't overlap a booking for now-or-later by
-- construction. Overtime breaks that invariant — while a renter's checkout
-- is unpredictably delayed, `occupied_until` can only ever promise
-- protection up to `grace_until`, renewed periodically; if that window ever
-- lapses (a slow renewal cycle, the app backgrounded), a second renter can
-- book what looks like the moment it frees up. If that second booking's
-- window turns out to fall *before* the first renter actually finishes
-- checking out, the shrunk `end_at` genuinely overlaps it — and the
-- constraint correctly rejects the update. Which then means the checkout
-- can NEVER succeed against that same conflict: not a one-off failure, a
-- permanent deadlock on that booking, confirmed by the repeated identical
-- 23P01 error against retries.
--
-- The fix isn't a workaround, it's a genuine gap: a `completed` row is a
-- historical record, not an active hold on the slot — it should never be
-- able to block anything, same as declined/cancelled/expired/no_show
-- already can't. `occupied_until` (0020/0022) doesn't need the equivalent
-- change — it already self-limits via `end_at > now()`, which a completed
-- booking's real (past-by-the-time-anyone-reads-it) checkout moment always
-- fails on its own.
alter table public.bookings
  drop constraint bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(start_at, greatest(end_at, coalesce(grace_until, end_at))) with &&
  )
  where (status not in ('declined', 'cancelled', 'expired', 'no_show', 'completed'));
