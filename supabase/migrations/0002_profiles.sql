-- ParkNext — 0002: profiles
-- One row per signed-up user, keyed to Supabase Auth's own auth.users table.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  -- Plain text, unverified — this app only OTP-verifies email (see product
  -- spec). Phone is collected as a contact field, not authenticated.
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every signed-in user can see and edit their own profile row.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Renters need to see a listing owner's name; owners need to see a renter's
-- name/rating on a booking request — i.e. "public read of name/avatar" from
-- the brief. Postgres RLS filters *rows*, not *columns*, and PostgREST's
-- automatic relationship embedding (e.g. `bookings.select('*, renter:profiles(name)')`)
-- only works against a table/view that is itself directly selectable under
-- the caller's RLS — a column-limited public view can't be embedded via the
-- bookings->profiles foreign key the same way. Given this app has no
-- passwords or payment data, and every reader is already a signed-in user
-- (never anonymous), the pragmatic trade-off used here — same one Supabase's
-- own docs use for this exact "public profile" scenario — is: any
-- *authenticated* user (not anonymous/public internet) can read any profile
-- row. Email/phone become technically visible to other signed-in users this
-- way; tighten this to a dedicated `id, name, avatar_url` view (see comment
-- in 0003) before a real launch if that's not acceptable.
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Auto-create a profile row the moment someone finishes email OTP sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
