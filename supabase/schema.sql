-- Run this once in Supabase Dashboard -> SQL Editor.
-- Sign-in works without it; this only enables syncing history, saved sites,
-- and preferences across devices.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

-- Usernames are global and case-insensitive. Existing duplicate usernames are
-- grandfathered so those real accounts keep working; new accounts and username
-- changes are rejected. The profile trigger covers direct profile writes and
-- the auth trigger reserves names while signup is waiting for its code.
create or replace function public.enforce_unique_profile_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  candidate := lower(btrim(coalesce(new.username, '')));
  if candidate = '' then return new; end if;
  if tg_op = 'UPDATE'
    and lower(btrim(coalesce(old.username, ''))) = candidate then
    return new;
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id <> new.id
      and lower(btrim(coalesce(p.username, ''))) = candidate
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_unique_profile_username on public.profiles;
create trigger enforce_unique_profile_username
  before insert or update of username on public.profiles
  for each row execute function public.enforce_unique_profile_username();

create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select not exists (
    select 1 from public.profiles p
    where p.username is not null
      and lower(btrim(p.username)) = lower(btrim(candidate))
  ) and not exists (
    select 1 from auth.users u
    where lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(btrim(candidate))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.enforce_unique_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate text;
begin
  candidate := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  if candidate = '' then return new; end if;
  if tg_op = 'UPDATE'
    and lower(btrim(coalesce(old.raw_user_meta_data->>'username', ''))) = candidate then
    return new;
  end if;
  if exists (
    select 1 from auth.users u
    where u.id <> new.id
      and lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = candidate
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_unique_username on auth.users;
create trigger enforce_unique_username
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.enforce_unique_username();
