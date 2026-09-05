-- When this account last proved it owns its phone number.
--
-- Written only by the `verify-phone` Edge Function, under the service role,
-- after validating a Firebase ID token. Firebase's own SMS is what does the
-- proving; this column is where that proof lands.
--
-- Note `auth.users.phone_confirmed_at` is NOT used: Supabase sets that only
-- through its own OTP flow, and we deliberately don't route SMS through
-- Supabase (Indian numbers would need DLT registration). So verification
-- state lives here instead.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

-- Anyone signed in may see *that* a number is verified — it is a trust
-- signal, and the profiles select policy (0002, tightened in 0012) already
-- shows them the number itself once a booking connects the two people.
--
-- Nobody may write it. A self-attested verification timestamp would be
-- worthless, so the column is withheld from the client and left to the
-- service role, which is the only identity the Edge Function runs as.
revoke update (phone_verified_at) on public.profiles from authenticated;
revoke update (phone_verified_at) on public.profiles from anon;

-- Same reasoning for the number itself: it is now set as a side effect of
-- verification rather than typed into a form, so the client no longer needs
-- to write it. Leaving it writable would let someone swap in an unverified
-- number while keeping the verified timestamp.
revoke update (phone) on public.profiles from authenticated;
revoke update (phone) on public.profiles from anon;