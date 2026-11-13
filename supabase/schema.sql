-- Run this in Supabase Dashboard -> SQL Editor.
-- Sign-in works without it; this enables syncing history, saved sites, and
-- preferences across devices, enforces unique usernames, and enables username
-- changes plus the owner tools.

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

-- A stable owner allowlist. Seeding only runs when the table is empty, so
-- changing the owner's display name later does not lose access and re-running
-- this file cannot add a second owner.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.site_admins enable row level security;
revoke all on public.site_admins from public, anon, authenticated;

insert into public.site_admins (user_id)
select candidate.id
from (
  select u.id, u.created_at,
         lower(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), p.username, ''))) as username,
         lower(btrim(coalesce(p.username, ''))) as profile_username
  from auth.users u
  left join public.profiles p on p.id = u.id
) candidate
where (candidate.username = 'cool' or candidate.profile_username = 'cool')
  and not exists (select 1 from public.site_admins)
order by candidate.created_at asc nulls last, candidate.id asc
limit 1
on conflict do nothing;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1 from public.site_admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create or replace function public.enforce_unique_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate text;
  last_changed timestamptz;
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

  -- Owner/admin renames bypass the cooldown through a transaction-local flag.
  if coalesce(current_setting('app.username_admin', true), '') = '1' then
    return new;
  end if;

  begin
    last_changed := nullif(new.raw_user_meta_data->>'username_changed_at', '')::timestamptz;
  exception when others then
    last_changed := null;
  end;
  if last_changed is not null and last_changed > now() - interval '7 days' then
    raise exception 'username_change_rate_limited' using errcode = 'P0001';
  end if;
  new.raw_user_meta_data := jsonb_set(
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    '{username_changed_at}',
    to_jsonb(now()),
    true
  );
  return new;
end;
$$;

drop trigger if exists enforce_unique_username on auth.users;
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

-- Username changes keep the account's hidden login address stable. Sign-in
-- resolves the current username to that address instead of deriving a new
-- address from the new name.
create or replace function public.login_email_for_username(candidate text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), p.username, ''))) =
        lower(btrim(coalesce(candidate, '')))
    and coalesce(u.email, '') <> ''
  order by u.created_at asc nulls last, u.id asc
  limit 1;
$$;

revoke all on function public.login_email_for_username(text) from public;
grant execute on function public.login_email_for_username(text) to anon, authenticated;

create or replace function public.change_username(candidate text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(candidate, ''));
  current_name text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if clean = '' or clean <> candidate or length(clean) > 24
     or clean !~ '^[A-Za-z0-9_.-]+$' then
    raise exception 'invalid_username' using errcode = '22023';
  end if;

  select coalesce(nullif(raw_user_meta_data->>'username', ''), '')
    into current_name
    from auth.users where id = uid;
  if lower(current_name) = lower(clean) then return current_name; end if;

  if public.is_site_admin() then
    perform set_config('app.username_admin', '1', true);
  end if;
  update auth.users
     set raw_user_meta_data = jsonb_set(
       coalesce(raw_user_meta_data, '{}'::jsonb),
       '{username}', to_jsonb(clean), true
     )
   where id = uid;
  perform set_config('app.username_admin', '0', true);

  update public.profiles
     set username = clean,
         updated_at = timezone('utc', now())
   where id = uid;
  return clean;
end;
$$;

revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

create or replace function public.site_admin_status()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_site_admin();
$$;

revoke all on function public.site_admin_status() from public, anon;
grant execute on function public.site_admin_status() to authenticated;

create or replace function public.site_admin_list_accounts()
returns table (id uuid, username text, created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id,
         coalesce(nullif(btrim(u.raw_user_meta_data->>'username'), ''), p.username, '') as username,
         u.created_at,
         u.last_sign_in_at,
         exists (select 1 from public.site_admins a where a.user_id = u.id) as is_admin
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_site_admin()
  order by lower(coalesce(nullif(btrim(u.raw_user_meta_data->>'username'), ''), p.username, '')),
           u.created_at asc nulls last, u.id asc
  limit 1000;
$$;

revoke all on function public.site_admin_list_accounts() from public, anon;
grant execute on function public.site_admin_list_accounts() to authenticated;

create or replace function public.site_admin_set(target uuid, make_admin boolean)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_site_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target is null or not exists (select 1 from auth.users where id = target) then
    raise exception 'account_not_found' using errcode = '22023';
  end if;
  if make_admin then
    insert into public.site_admins (user_id) values (target)
    on conflict (user_id) do nothing;
  else
    if target = auth.uid() then
      raise exception 'cannot_demote_self' using errcode = '22023';
    end if;
    delete from public.site_admins where user_id = target;
  end if;
  return make_admin;
end;
$$;

revoke all on function public.site_admin_set(uuid, boolean) from public, anon;
grant execute on function public.site_admin_set(uuid, boolean) to authenticated;

create or replace function public.site_admin_change_username(target uuid, candidate text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean text := btrim(coalesce(candidate, ''));
begin
  if not public.is_site_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target is null then
    raise exception 'account_not_found' using errcode = '22023';
  end if;
  if clean = '' or clean <> candidate or length(clean) > 24
     or clean !~ '^[A-Za-z0-9_.-]+$' then
    raise exception 'invalid_username' using errcode = '22023';
  end if;

  perform set_config('app.username_admin', '1', true);
  update auth.users
     set raw_user_meta_data = jsonb_set(
       coalesce(raw_user_meta_data, '{}'::jsonb),
       '{username}', to_jsonb(clean), true
     )
   where id = target;
  if not found then
    perform set_config('app.username_admin', '0', true);
    raise exception 'account_not_found' using errcode = '22023';
  end if;
  perform set_config('app.username_admin', '0', true);

  update public.profiles
     set username = clean,
         updated_at = timezone('utc', now())
   where id = target;
  return clean;
end;
$$;

revoke all on function public.site_admin_change_username(uuid, text) from public, anon;
grant execute on function public.site_admin_change_username(uuid, text) to authenticated;

create or replace function public.site_admin_delete_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_site_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target is null or target = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '22023';
  end if;
  delete from auth.users where id = target;
  if not found then
    raise exception 'account_not_found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.site_admin_delete_account(uuid) from public, anon;
grant execute on function public.site_admin_delete_account(uuid) to authenticated;

notify pgrst, 'reload schema';
