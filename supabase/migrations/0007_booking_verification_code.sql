-- ParkNext — 0007: booking verification code
-- A 4-digit code the renter shows and the owner enters to confirm arrival,
-- replacing renter self-service check-in. Generated once per row via a
-- default expression, so no app code needs to set it on insert — this
-- migration also backfills a code onto any rows that already exist.

alter table public.bookings
  add column verification_code text not null default lpad(floor(random() * 10000)::text, 4, '0');