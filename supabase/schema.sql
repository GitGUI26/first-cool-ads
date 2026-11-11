-- Run this in Supabase Dashboard -> SQL Editor.
-- Sign-in works without it; this enables syncing history, saved sites, and
-- preferences across devices and enforces unique usernames.

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

-- Drop the old triggers while historical duplicates are repaired. Without
-- this, renaming the duplicate rows would fire the old checks mid-migration.
drop trigger if exists enforce_unique_username on auth.users;
drop trigger if exists enforce_unique_profile_username on public.profiles;

-- Repair duplicate auth metadata first. One row keeps the original name; each
-- later duplicate gets a deterministic numeric suffix. The same suffix is
-- written to its profile so chat and account pages stay consistent.
do $$
declare
  rec record;
  base text;
  suffix integer;
  candidate text;
begin
  for rec in
    select id, username
    from (
      select u.id,
             btrim(coalesce(u.raw_user_meta_data->>'username', '')) as username,
             row_number() over (
               partition by lower(btrim(coalesce(u.raw_user_meta_data->>'username', '')))
               order by u.created_at asc nulls last, u.id asc
             ) as duplicate_rank
      from auth.users u
      where btrim(coalesce(u.raw_user_meta_data->>'username', '')) <> ''
    ) ranked
    where duplicate_rank > 1
  loop
    base := left(rec.username, 18);
    suffix := 1;
    loop
      candidate := left(base, greatest(1, 24 - length(suffix::text) - 1)) || '-' || suffix::text;
      exit when not exists (
        select 1 from auth.users u
        where u.id <> rec.id
          and lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(candidate)
      ) and not exists (
        select 1 from public.profiles p
        where p.id <> rec.id
          and lower(btrim(coalesce(p.username, ''))) = lower(candidate)
      );
      suffix := suffix + 1;
    end loop;
    update auth.users
       set raw_user_meta_data = jsonb_set(
         coalesce(raw_user_meta_data, '{}'::jsonb),
         '{username}',
         to_jsonb(candidate),
         true
       )
     where id = rec.id;
    update public.profiles
       set username = candidate,
           updated_at = timezone('utc', now())
     where id = rec.id;
  end loop;
end $$;

-- Repair any remaining duplicate profile names (for example, a profile whose
-- auth metadata was already missing or different).
do $$
declare
  rec record;
  base text;
  suffix integer;
  candidate text;
begin
  for rec in
    select id, username
    from (
      select p.id,
             btrim(coalesce(p.username, '')) as username,
             row_number() over (
               partition by lower(btrim(coalesce(p.username, '')))
               order by p.updated_at asc nulls last, p.id asc
             ) as duplicate_rank
      from public.profiles p
      where btrim(coalesce(p.username, '')) <> ''
    ) ranked
    where duplicate_rank > 1
  loop
    base := left(rec.username, 18);
    suffix := 1;
    loop
      candidate := left(base, greatest(1, 24 - length(suffix::text) - 1)) || '-' || suffix::text;
      exit when not exists (
        select 1 from public.profiles p
        where p.id <> rec.id
          and lower(btrim(coalesce(p.username, ''))) = lower(candidate)
      ) and not exists (
        select 1 from auth.users u
        where u.id <> rec.id
          and lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(candidate)
      );
      suffix := suffix + 1;
    end loop;
    update public.profiles
       set username = candidate,
           updated_at = timezone('utc', now())
     where id = rec.id;
    update auth.users
       set raw_user_meta_data = jsonb_set(
         coalesce(raw_user_meta_data, '{}'::jsonb),
         '{username}',
         to_jsonb(candidate),
         true
       )
     where id = rec.id;
  end loop;
end $$;

-- The unique indexes are the final guard against races. Case and surrounding
-- spaces are ignored, so "Alice" and " alice " are the same username.
create unique index if not exists profiles_username_unique
  on public.profiles (lower(btrim(username)))
  where username is not null and btrim(username) <> '';

create unique index if not exists auth_users_username_unique
  on auth.users (lower(btrim(raw_user_meta_data->>'username')))
  where btrim(coalesce(raw_user_meta_data->>'username', '')) <> '';

-- Friendly trigger errors for normal writes; the unique indexes above remain
-- the hard guarantee if a write bypasses the trigger.
create or replace function public.enforce_unique_profile_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
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
  ) or exists (
    select 1 from auth.users u
    where u.id <> new.id
      and lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = candidate
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger enforce_unique_profile_username
  before insert or update of username on public.profiles
  for each row execute function public.enforce_unique_profile_username();

create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select btrim(coalesce(candidate, '')) <> '' and not exists (
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
  ) or exists (
    select 1 from public.profiles p
    where p.id <> new.id
      and lower(btrim(coalesce(p.username, ''))) = candidate
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger enforce_unique_username
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.enforce_unique_username();

-- Allow a signed-in user to permanently delete their own auth account. The
-- security-definer function runs with the owner's privileges, while auth.uid()
-- restricts the delete to the caller. Profile rows cascade from auth.users.
create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users
  where id = (select auth.uid());
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';
