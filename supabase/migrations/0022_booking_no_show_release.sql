-- ParkNext — 0022: fold 'no_show' into the same exemptions as
-- declined/cancelled/expired everywhere those already appear.
--
-- Note what this migration does NOT need to change: `occupied_until()`
-- already stops counting ANY booking, `no_show` included, the instant its
-- own `end_at` passes (`b.end_at > now()`) — that check is purely
-- time-bound, not status-bound, so a listing search already shows a missed
-- booking's spot as free again the moment its window ends, with no
-- dependency on the status ever actually being flipped. What's below is
-- about correctness elsewhere: a stale `no_show` row still holding a *past*
-- time range should never be treated as "actively holding a slot" by
-- anything that reasons about bookings generally, matching how
-- declined/cancelled/expired already aren't.

alter table public.bookings
  drop constraint bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(start_at, end_at) with &&
  )
  where (status not in ('declined', 'cancelled', 'expired', 'no_show'));

create or replace function public.occupied_until(l public.listings)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select b.end_at
  from public.bookings b
  where b.listing_id = l.id
    and b.status not in ('declined', 'cancelled', 'expired', 'no_show')
    and b.start_at <= now()
    and b.end_at > now()
  limit 1;
$$;
