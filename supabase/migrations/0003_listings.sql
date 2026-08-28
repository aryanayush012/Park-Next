-- ParkNext — 0003: listings
-- A provider's parking spot: location, price, amenities, availability window.

create type public.pricing_model as enum ('flat', 'metered');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  -- Real geospatial point (lng/lat) — see nearby_listings() in 0006.
  location geography(Point, 4326) not null,
  address text not null,
  vehicle_types text[] not null default '{}',
  amenities text[] not null default '{}',
  pricing_model public.pricing_model not null default 'flat',
  price_per_hour numeric(10, 2) not null check (price_per_hour >= 0),
  -- 0 = Sunday ... 6 = Saturday, matching the app's own convention.
  available_days int[] not null default '{0,1,2,3,4,5,6}'
    check (available_days <@ array[0,1,2,3,4,5,6]),
  available_from time not null default '00:00',
  available_until time not null default '23:59',
  -- Photo URLs only — no video field. Product spec explicitly drops video
  -- from V1 to stay inside the free storage tier.
  photos text[] not null default '{}',
  is_active boolean not null default true,
  -- The self-declared "I confirm I have the right to rent this space out"
  -- checkbox from the Review & Publish screen. Space verification is
  -- self-declared for V1 — see the product spec's Section 5 for the real,
  -- non-technical risk that's worth reading before a real launch.
  ownership_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index listings_location_gix on public.listings using gist (location);
create index listings_owner_id_idx on public.listings (owner_id);

alter table public.listings enable row level security;

-- Renter-facing browse: anyone can see active listings.
create policy "listings_select_active"
  on public.listings for select
  using (is_active = true);

-- Owners can always see their own listings, active or not (My Listings screen).
create policy "listings_select_own"
  on public.listings for select
  using (auth.uid() = owner_id);

create policy "listings_insert_own"
  on public.listings for insert
  with check (auth.uid() = owner_id);

create policy "listings_update_own"
  on public.listings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "listings_delete_own"
  on public.listings for delete
  using (auth.uid() = owner_id);
