-- ParkNext — 0020: surface "occupied right now" on a listing
--
-- The `bookings_no_overlap` exclusion constraint (0004, tightened in 0011)
-- already guarantees at the database level that a listing can never hold two
-- overlapping bookings — but nothing surfaced that to a renter BEFORE they
-- tried to book. A renter searching "now" could see a listing as plainly
-- "Available" even though someone else's instant booking already covers this
-- exact moment, only to have the booking attempt rejected by that constraint
-- with no warning. This adds a computed `occupied_until` — the end time of
-- whichever booking currently covers `now()` on that listing, or null if
-- none does — using the exact same status exclusion list as the constraint
-- itself, so "occupied" here means precisely "would conflict if you tried".
--
-- `security definer` (same pattern as `owns_listing` in 0004): a browsing
-- renter has no RLS access to another renter's booking rows, and shouldn't —
-- this only ever returns a bare timestamp, never who booked it or why.
create function public.occupied_until(l public.listings)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select b.end_at
  from public.bookings b
  where b.listing_id = l.id
    and b.status not in ('declined', 'cancelled', 'expired')
    and b.start_at <= now()
    and b.end_at > now()
  limit 1;
$$;

grant execute on function public.occupied_until(public.listings) to anon, authenticated;

-- `nearby_listings` returns an explicit table shape (see 0006's own header
-- for why), so the new column has to be added to its signature directly
-- rather than picked up automatically the way plain `.select('*, occupied_until')`
-- reads work for ordinary listings queries. Postgres won't let
-- `create or replace` change a function's return type (an added OUT column
-- counts as one) — has to be dropped and recreated instead.
drop function if exists public.nearby_listings(double precision, double precision, int);

create function public.nearby_listings(
  lat double precision,
  lng double precision,
  radius_meters int default 5000
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  address text,
  vehicle_types text[],
  amenities text[],
  pricing_model public.pricing_model,
  price_per_hour numeric,
  available_days int[],
  available_from time,
  available_until time,
  photos text[],
  is_active boolean,
  ownership_confirmed boolean,
  created_at timestamptz,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  occupied_until timestamptz
)
language sql
stable
as $$
  select
    l.id, l.owner_id, l.title, l.description, l.address, l.vehicle_types,
    l.amenities, l.pricing_model, l.price_per_hour, l.available_days,
    l.available_from, l.available_until, l.photos, l.is_active,
    l.ownership_confirmed, l.created_at,
    ST_Y(l.location::geometry) as latitude,
    ST_X(l.location::geometry) as longitude,
    ST_Distance(l.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance_meters,
    public.occupied_until(l) as occupied_until
  from public.listings l
  where l.is_active = true
    and ST_DWithin(
      l.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  order by distance_meters asc;
$$;

grant execute on function public.nearby_listings(double precision, double precision, int) to anon, authenticated;
