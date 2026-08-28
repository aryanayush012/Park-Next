-- ParkNext — 0006: nearby_listings() + plain lat/lng reads
-- The renter Home/Map Search screen's real geospatial query. Called from the
-- app as `supabase.rpc('nearby_listings', { lat, lng, radius_meters })`.

-- PostgREST/Supabase-js can't cleanly deserialize a raw `geography` column
-- out of a JSON response, so two things make `location` usable from the app
-- without a WKB parser on the client:
--
-- 1. `latitude`/`longitude` "computed columns" — ordinary functions that take
--    a `listings` row and return a plain float, which PostgREST lets you
--    select as if they were real columns: `.select('*, latitude, longitude')`.
--    This is what plain listings CRUD (get/create/update) uses.
-- 2. `nearby_listings()` below returns an explicit table shape with
--    `latitude`/`longitude` (and a bonus `distance_meters`) already
--    extracted server-side — nothing geography-typed ever reaches the client.

create function public.latitude(l public.listings)
returns double precision
language sql
stable
as $$
  select ST_Y(l.location::geometry);
$$;

create function public.longitude(l public.listings)
returns double precision
language sql
stable
as $$
  select ST_X(l.location::geometry);
$$;

create or replace function public.nearby_listings(
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
  distance_meters double precision
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
    ST_Distance(l.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance_meters
  from public.listings l
  where l.is_active = true
    and ST_DWithin(
      l.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  order by distance_meters asc;
$$;

-- Anyone (including anonymous, if you ever allow browsing before sign-in)
-- can call this — it already only ever returns `is_active = true` rows,
-- same as the listings_select_active RLS policy.
grant execute on function public.nearby_listings(double precision, double precision, int) to anon, authenticated;
