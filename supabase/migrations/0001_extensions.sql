-- ParkNext — 0001: extensions
-- Run this first. Enables everything the later migrations depend on.

-- Geospatial types + functions (ST_DWithin, ST_Distance, geography columns) —
-- powers "find spots near me" (see 0006_nearby_listings.sql).
create extension if not exists postgis;

-- GiST support for plain equality/scalar types (uuid, etc). Needed so the
-- bookings table's double-booking exclusion constraint (0004_bookings.sql)
-- can mix a uuid equality check with a time-range overlap check in one
-- GiST index.
create extension if not exists btree_gist;

-- gen_random_uuid() for default primary key values.
create extension if not exists pgcrypto;
