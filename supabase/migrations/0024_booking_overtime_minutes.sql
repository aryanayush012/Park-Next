-- ParkNext — 0024: persist how much of a completed booking was overtime
--
-- `checkOut` computes the final `amount_owed` (base + 2x overtime, see
-- utils/overtimeBilling.ts) and then, same as before this feature existed,
-- shrinks/extends `end_at` to the real checkout moment — needed so the slot
-- correctly frees up for the next search from the moment it actually was.
-- But that overwrites the one piece of information ("what was the
-- *scheduled* end this was measured against") a screen would need to later
-- explain the total ("you stayed 22 min over, billed at 2x"). Persisting
-- just the minute count here is enough: the cost of those minutes is fully
-- derivable at display time from the listing's own price-per-hour, and
-- `amount_owed` already carries the authoritative total either way — this
-- is purely what makes the breakdown explainable after the fact, not part
-- of what's actually charged.
alter table public.bookings
  add column overtime_minutes int not null default 0;
