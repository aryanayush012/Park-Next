-- ParkNext — 0005: reviews + reported listings
-- Ratings/reviews are the primary trust signal in a no-payment, self-declared
-- V1 (see product spec Section 2 & 5). Reporting is the lightweight
-- trust & safety net alongside it.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- One review per person per booking (a renter reviews the owner, the
  -- owner can separately review the renter, but neither can double-submit).
  unique (booking_id, reviewer_id)
);

alter table public.reviews enable row level security;

-- Ratings are the trust signal renters/owners rely on — public read.
create policy "reviews_select_public"
  on public.reviews for select
  using (true);

-- Only someone who was actually a participant on the booking (the renter,
-- or the listing's owner) can leave a review for it, and only as themself.
create policy "reviews_insert_participant"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.renter_id = auth.uid() or public.owns_listing(b.listing_id))
    )
  );

create type public.report_status as enum ('open', 'reviewed', 'dismissed');

create table public.reported_listings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.reported_listings enable row level security;

create policy "reported_listings_insert_own"
  on public.reported_listings for insert
  with check (auth.uid() = reporter_id);

-- Reporters can see their own reports' status; full moderation review
-- happens through the admin panel using the service role key, which
-- bypasses RLS entirely — no separate admin policy needed here.
create policy "reported_listings_select_own"
  on public.reported_listings for select
  using (auth.uid() = reporter_id);
