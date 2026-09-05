-- ParkNext — 0019: hand `phone` back to the client for V1
--
-- 0016/0017 took `update (phone)` away because the `verify-phone` Edge
-- Function set it after validating a Firebase ID token, and a
-- client-written number would have walked straight past the OTP.
--
-- V1 ships without SMS verification (Firebase gates real SMS behind a paid
-- plan), so the client is the only writer again. Leaving the column revoked
-- would break the Save button in `PhoneRequiredDialog` with a permission
-- error at the exact moment someone tries to book.
--
-- `phone_verified_at` stays revoked and unwritable. It is null for every
-- row now, which is honest: nothing has been verified. When verification
-- comes back, revoke `phone` again in the same migration that restores it.
grant update (phone) on public.profiles to authenticated;

-- Tear down 0018 if it was ever applied. That migration mirrored
-- `auth.users.phone` into `profiles` for the WhatsApp-delivery approach,
-- which was abandoned the same day. Nothing writes `auth.users.phone` now,
-- so the trigger would never fire — but leaving a trigger on an auth table
-- for a feature that does not exist is how confusing bugs get written.
--
-- Safe to re-run: every statement here is idempotent.
drop trigger if exists on_auth_user_phone_changed on auth.users;
drop function if exists public.sync_phone_from_auth();