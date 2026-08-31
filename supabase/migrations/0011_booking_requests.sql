-- ParkNext — 0011: real owner-approval workflow for booking requests
--
-- Every new booking now starts as a `pending` request the owner must
-- Accept/Decline within a response window instead of going straight to
-- `booked` — 10 minutes for an instant booking, up to 3 hours (capped so it
-- never lands after the booking would already have started) for an advance
-- one. See src/utils/responseDeadline.ts for the exact computation, which
-- the app supplies explicitly on every insert from here on.

alter table public.bookings
  add column response_deadline timestamptz not null default now() + interval '10 minutes';

-- The default above only exists to satisfy the not-null constraint for any
-- row that somehow predates this migration (there shouldn't be any in a
-- fresh project) — every real insert going forward supplies its own value,
-- so there's no reason to keep an app-invisible default lying around.
alter table public.bookings alter column response_deadline drop default;

-- `expired` (0010) never actually held the slot either — a request nobody
-- ever accepted was never a real reservation — so it needs to join
-- `declined`/`cancelled` in the exclusion constraint's exemption, otherwise
-- an expired request would keep blocking that time slot forever.
alter table public.bookings drop constraint bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(start_at, end_at) with &&
  )
  where (status not in ('declined', 'cancelled', 'expired'));