-- ParkNext — 0012: tighten profiles RLS (Play Store launch checklist, item 2)
--
-- Closes a real gap flagged in 0002's own comments: the previous
-- `profiles_select_authenticated` policy let ANY signed-in user read ANY
-- other profile row in full — including email and phone — regardless of
-- whether they'd ever actually interacted with that person. Postgres RLS
-- filters rows, not columns, so this replaces that blanket policy with a
-- row-level rule that only grants full-row visibility (name, phone, email,
-- avatar) when a real booking actually connects the two people, in either
-- direction — exactly the same condition the app's own UI already uses to
-- decide when to show a "Contact Host"/"Contact Renter" card. Every
-- existing call site of `getPublicProfile()` (Booking Confirmation, Active
-- Booking, Booking Detail on both sides, Booking Requests, and a user's own
-- Profile screen) already only ever looks up either the signed-in user's
-- own id (still covered by the existing `profiles_select_own` policy,
-- untouched here) or a specific counterpart from a real booking they're
-- party to — so this tightens the database to match what the app already
-- only does, rather than changing any app behavior.
--
-- Deliberately NOT introducing a separate public `id, name, avatar_url`
-- view here (the other option 0002's comment flagged) — nothing in the app
-- today shows a stranger's name/avatar before any booking connects them
-- (Listing Detail shows the listing's own aggregate rating, not the
-- owner's name/identity). If a future screen needs that (e.g. a "Hosted
-- by ___" line before booking), add a dedicated view or function exposing
-- just those two columns then — don't reintroduce a blanket `using (true)`
-- policy on the base table to get there.

drop policy "profiles_select_authenticated" on public.profiles;

-- `security definer` + its own internal query, same pattern as
-- `owns_listing()` in 0004 — deliberately bypasses `bookings`/`listings`'
-- own RLS while evaluating the join, rather than relying on those tables'
-- policies to already grant visibility to whichever side is asking. That
-- matters concretely: if a listing is ever deactivated (`is_active =
-- false`) after a booking on it completes, a renter with no owner-only
-- access to that listing row would otherwise silently lose the ability to
-- see who they'd booked with, even though the booking itself still
-- connects them. A `security definer` function sidesteps that instead of
-- depending on it.
create function public.profiles_are_connected(other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.listings l on l.id = b.listing_id
    where
      (b.renter_id = auth.uid() and l.owner_id = other_id)
      or (l.owner_id = auth.uid() and b.renter_id = other_id)
  );
$$;

create policy "profiles_select_connected"
  on public.profiles for select
  to authenticated
  using (public.profiles_are_connected(id));