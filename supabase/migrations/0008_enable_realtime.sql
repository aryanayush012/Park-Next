-- ParkNext — 0008: enable Realtime on listings and bookings
--
-- Supabase's Postgres Changes realtime feature only streams changes for
-- tables explicitly added to the `supabase_realtime` publication — a fresh
-- project's publication starts with no tables in it, so without this
-- migration a `postgres_changes` subscription (see
-- `src/hooks/useRealtimeTable.ts`) would silently receive nothing at all,
-- no error either. Realtime evaluates each table's own RLS `select` policy
-- per subscriber (same as a normal query), so this doesn't loosen access —
-- a renter's subscription still only ever receives events for bookings
-- they could already see; an owner's, only for bookings on listings they
-- own. Safe to re-run: a repeat "already a member of publication" error is
-- expected and can be ignored, same as any other already-applied migration.

alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.bookings;