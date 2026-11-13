-- Move the site owner allowlist to the account named "cool".
-- Safe to re-run: if that account does not exist, existing admins are left alone.
do $$
declare
  target uuid;
begin
  select u.id
    into target
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), p.username, ''))) = 'cool'
  order by u.created_at asc nulls last, u.id asc
  limit 1;

  if target is null then
    raise notice 'No account named cool; site_admins left unchanged.';
    return;
  end if;

  insert into public.site_admins (user_id)
  values (target)
  on conflict (user_id) do nothing;

  delete from public.site_admins where user_id <> target;
end
$$;

notify pgrst, 'reload schema';
