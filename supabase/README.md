# ParkNext — Supabase setup

The app works today with **no backend at all** — it runs on built-in mock
data. Follow these steps only when you're ready to switch it over to a real
Supabase project. None of this costs money or needs a credit card.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub or email — no card required).
2. Click **New project**.
3. Give it a name (e.g. `parknext`), pick any region close to you, and set a
   database password (save it somewhere — you won't need it day-to-day, but
   keep it safe).
4. Click **Create new project** and wait a minute or two while it spins up.

## 2. Run the migrations

1. In your new project's left sidebar, click the **SQL Editor** icon.
2. Click **New query**.
3. Open each file in this folder's `migrations/` directory, **in this exact
   order**, and for each one: paste its entire contents into the SQL editor
   and click **Run**.
   1. `0001_extensions.sql`
   2. `0002_profiles.sql`
   3. `0003_listings.sql`
   4. `0004_bookings.sql`
   5. `0005_reviews_and_reports.sql`
   6. `0006_nearby_listings.sql`
4. Each one should finish with a green "Success" message. If one fails, stop
   and re-check you ran the previous ones first and in order — most errors
   are just "table/type already exists" from re-running a step twice, which
   is safe to ignore.

(If you're comfortable with the Supabase CLI, `supabase db push` against
this `migrations/` folder does the same thing in one command — the numbered
filenames are already in the CLI's expected format.)

## 3. Turn on email OTP sign-in

1. In the sidebar, go to **Authentication → Providers**.
2. Make sure **Email** is enabled. Under its settings, turn **OTP** on (and
   you can turn "Confirm email" / magic link off — the app only uses the
   6-digit code flow).
3. Optional but recommended once you're past just testing: Supabase's own
   built-in email sender is rate-limited to about 2 emails/hour, which is
   too slow for real signups. Under **Project Settings → Auth → SMTP
   Settings**, plug in a free [Resend](https://resend.com) account (3,000
   emails/month free, no card) so real OTP emails go out reliably. You can
   skip this while just testing with your own email address.

## 4. Copy your API keys into the app

1. In the sidebar, go to **Project Settings → API**.
2. You need two values from that page:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public** key (a long string starting with `eyJ...`) — **not**
     the `service_role` key, that one must never go in the app.
3. In the project root (same folder as `package.json`), copy `.env.example`
   to a new file named exactly `.env`.
4. Paste your two values in:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
   ```
5. Restart the app (`npx expo start`, restarting the dev server after
   editing `.env` — Expo only reads it at startup).

That's it — the app detects those two values automatically and switches
from mock data to your real Supabase project, including real email OTP
sign-in. If you ever remove or blank out `.env`, it falls back to mock mode
again with no other changes needed.

## What's already wired up on the app side

- `src/data/supabaseClient.ts` — the Supabase client, plus an
  `isSupabaseConfigured` flag the rest of the app checks.
- `src/data/SupabaseDataSource.ts` — a real-backend implementation of the
  exact same `DataSource` interface the mock data source implements, so no
  screen code needs to change either way.
- The Email OTP sign-up screens call real `supabase.auth.signInWithOtp` /
  `verifyOtp` when configured, and keep the existing mocked "accept any
  6-digit code" flow when they're not.

## One thing worth knowing before you rely on this for real users

Row Level Security here follows a pragmatic V1 trade-off: any *signed-in*
user can read any other user's `name`/`avatar_url`/`email` (not anonymous
visitors — you have to be logged in). Postgres RLS filters rows, not
columns, and doing this "properly" (public name/avatar, private email/phone)
needs either a dedicated view or an Edge Function. That's called out in
`migrations/0002_profiles.sql`'s comments — worth tightening before a real
public launch, not necessary for building/testing.
