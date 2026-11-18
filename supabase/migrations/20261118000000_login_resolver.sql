-- Username sign-in and username changes.
--
-- Accounts sign in with a username, but Supabase Auth still needs an address.
-- Each account therefore owns a hidden, non-deliverable address, and the site
-- resolves the username a member types to that stored address. Renaming only
-- rewrites the username, so without this resolver a renamed member can no
-- longer sign in.
--
-- Run this once in Supabase Dashboard -> SQL Editor (or `supabase db push`).
-- It only creates/replaces these two functions, so re-running is safe.

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

-- Self-service rename. Stands on its own: it enforces uniqueness and the
-- weekly cooldown itself, so it works whether or not the username triggers
-- from schema.sql are present. Owners skip the cooldown.
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
  last_changed timestamptz;
  taken boolean;
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

  select exists (
    select 1 from auth.users u
    where u.id <> uid
      and lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(clean)
  ) or exists (
    select 1 from public.profiles p
    where p.id <> uid
      and lower(btrim(coalesce(p.username, ''))) = lower(clean)
  ) into taken;
  if taken then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  if not public.is_site_admin() then
    begin
      select nullif(raw_user_meta_data->>'username_changed_at', '')::timestamptz
        into last_changed
        from auth.users where id = uid;
    exception when others then
      last_changed := null;
    end;
    if last_changed is not null and last_changed > now() - interval '7 days' then
      raise exception 'username_change_rate_limited' using errcode = 'P0001';
    end if;
  end if;

  -- Let the username trigger through; this function already checked both rules.
  perform set_config('app.username_admin', '1', true);
  update auth.users
     set raw_user_meta_data = jsonb_set(
       jsonb_set(
         coalesce(raw_user_meta_data, '{}'::jsonb),
         '{username}', to_jsonb(clean), true
       ),
       '{username_changed_at}', to_jsonb(now()), true
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

notify pgrst, 'reload schema';
