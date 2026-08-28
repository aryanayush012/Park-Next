-- ParkNext — 0004: bookings
-- A renter's reservation against a listing, plus the double-booking guard.

create type public.booking_type as enum ('instant', 'advance', 'recurring');

create type public.booking_status as enum (
  'pending',      -- awaiting the owner's Accept/Decline
  'accepted',     -- owner accepted a request that hasn't started yet (rarely used directly — most flows go straight to 'booked')
  'declined',     -- owner declined
  'booked',       -- confirmed, not yet arrived
  'in_progress',  -- renter has checked in
  'completed',    -- renter has checked out
  'cancelled'     -- cancelled by either party before it started
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  booking_type public.booking_type not null,
  status public.booking_status not null default 'pending',
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  -- Recurring bookings store their weekday/time-range rule here, e.g.
  -- {"days": [1,2,3,4,5], "startTime": "09:00", "endTime": "18:00"}.
  -- start_at/end_at above still hold the first occurrence, same convention
  -- the app's mock data already uses.
  recurring_rule jsonb,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  -- Computed from checked_in_at/checked_out_at for metered listings — the
  -- app never processes payment, this is purely a display of what's owed
  -- between renter and owner directly (see product spec Section 4).
  amount_owed numeric(10, 2),
  created_at timestamptz not null default now()
);

create index bookings_listing_id_idx on public.bookings (listing_id);
create index bookings_renter_id_idx on public.bookings (renter_id);

-- Guarantees, at the database level, that two renters can never hold
-- overlapping time slots on the same listing. `declined`/`cancelled` never
-- actually held the slot, so they're excluded — everything else
-- (pending/accepted/booked/in_progress/completed) does, matching the
-- product spec's "a booking is just a row with a time range, enforced by
-- an exclusion constraint" design.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(start_at, end_at) with &&
  )
  where (status not in ('declined', 'cancelled'));

alter table public.bookings enable row level security;

-- A small helper so the four policies below don't repeat this subquery.
create function public.owns_listing(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.listings l
    where l.id = target_listing_id and l.owner_id = auth.uid()
  );
$$;

-- Visible to the renter who made it, or the owner of the listing it's on.
create policy "bookings_select_participant"
  on public.bookings for select
  using (auth.uid() = renter_id or public.owns_listing(listing_id));

-- Only the renter can create their own booking/request.
create policy "bookings_insert_renter"
  on public.bookings for insert
  with check (auth.uid() = renter_id);

-- Both the owner (accept/decline, status changes) and the renter
-- (check-in/check-out) update this same row over its lifecycle. Postgres
-- RLS restricts which *rows* can be touched, not which *columns* — if you
-- need to stop a renter from e.g. rewriting `status` to 'booked' directly,
-- enforce that with a trigger or by moving that transition into an Edge
-- Function before going live. For V1, both participants share one policy.
create policy "bookings_update_participant"
  on public.bookings for update
  using (auth.uid() = renter_id or public.owns_listing(listing_id))
  with check (auth.uid() = renter_id or public.owns_listing(listing_id));
