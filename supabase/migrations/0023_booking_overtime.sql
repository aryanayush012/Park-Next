-- ParkNext — 0023: separate "slot occupancy grace" from "priced schedule"
--
-- `end_at` used to serve two different jobs at once: it's the boundary the
-- `bookings_no_overlap` exclusion constraint and `occupied_until` (0020)
-- both use to decide "is this listing taken right now", AND — via
-- `DataSource.checkOut`/`extendBooking` — the boundary billing uses to
-- decide "how much of this was within the price the renter agreed to".
-- `renewOverdueBooking` (added after 0022, to stop a late-running renter's
-- spot from looking free to someone else mid-overstay) pushed `end_at`
-- forward for the first job, which quietly broke the second: by checkout
-- time there was no way left to tell "the renter chose to extend, billed at
-- the normal rate" apart from "the app auto-extended the occupancy grace
-- window", so overtime could never be billed correctly.
--
-- `grace_until` takes over the first job on its own. `end_at` goes back to
-- meaning only the second: the scheduled/priced end, moved only by an
-- explicit extension the renter pays normal rate for (see
-- utils/overtimeBilling.ts) — checkout bills anything past it, at whatever
-- point it actually happened, at the 2x overtime rate.
alter table public.bookings
  add column grace_until timestamptz;

alter table public.bookings
  drop constraint bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(start_at, greatest(end_at, coalesce(grace_until, end_at))) with &&
  )
  where (status not in ('declined', 'cancelled', 'expired', 'no_show'));

create or replace function public.occupied_until(l public.listings)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(b.end_at, coalesce(b.grace_until, b.end_at))
  from public.bookings b
  where b.listing_id = l.id
    and b.status not in ('declined', 'cancelled', 'expired', 'no_show')
    and b.start_at <= now()
    and greatest(b.end_at, coalesce(b.grace_until, b.end_at)) > now()
  limit 1;
$$;
