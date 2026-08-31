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
-- name/rating on a booking request. This started out as a blanket "any
-- signed-in user can read any profile row" policy (the pragmatic V1
-- trade-off, since Postgres RLS filters rows, not columns) — **tightened in
-- migration 0012** to only grant that visibility when a real booking
-- actually connects the two people, closing the gap where email/phone were
-- technically readable by any authenticated stranger. See 0012 for the
-- current policy and the reasoning; this comment is kept for history.

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