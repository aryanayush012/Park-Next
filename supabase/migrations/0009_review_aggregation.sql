-- ParkNext — 0009: rating aggregation for listings and profiles
--
-- The `reviews` table (0005) has always supported writing reviews, but
-- nothing reads an aggregate back — `SupabaseDataSource` has shipped a
-- hardcoded `rating: 0`/`ratingCount: 0` on every listing and profile since
-- Round 8, with a comment flagging this as a known gap. This migration adds
-- the two read-side functions the app now calls to fix that.
--
-- Both `listings` and `bookings` are read under RLS that scopes rows to
-- what the *current* user can see (`listings_select_active`/`_own`,
-- `bookings_select_participant`) — but a rating aggregate is meant to be
-- public regardless of whether the viewer happens to be a participant on
-- the underlying bookings, so a plain view here would silently under-count
-- (it would run under the querying user's own RLS). Both functions below
-- are `security definer`, the same pattern `owns_listing()` already uses in
-- 0004: they bypass RLS internally, but only ever return an aggregate
-- (avg + count) computed server-side, never individual review or booking
-- rows — nothing private leaks through them.

-- A listing's rating = the average of ratings left by renters reviewing
-- that specific listing/host, keyed off which listing the underlying
-- booking was on. Deliberately excludes the flip side (an owner reviewing
-- a renter) — see `profile_ratings` below for that half.
create or replace function public.listing_ratings(listing_ids uuid[])
returns table (listing_id uuid, rating numeric, rating_count int)
language sql
stable
security definer
set search_path = public
as $$
  select b.listing_id, avg(r.rating)::numeric, count(*)::int
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  where r.reviewer_id = b.renter_id
    and b.listing_id = any(listing_ids)
  group by b.listing_id;
$$;

grant execute on function public.listing_ratings(uuid[]) to authenticated;

-- A person's own rating (shown on a renter's profile card when an owner is
-- deciding whether to accept a request, and vice versa on the renter's
-- "Contact Host" card) = the average of every review where they're the
-- reviewee, regardless of which side of a booking they were on.
create or replace function public.profile_ratings(profile_ids uuid[])
returns table (profile_id uuid, rating numeric, rating_count int)
language sql
stable
security definer
set search_path = public
as $$
  select r.reviewee_id, avg(r.rating)::numeric, count(*)::int
  from public.reviews r
  where r.reviewee_id = any(profile_ids)
  group by r.reviewee_id;
$$;

grant execute on function public.profile_ratings(uuid[]) to authenticated;