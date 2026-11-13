-- Owner tools call this to grant or remove admin access without direct table access.
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

notify pgrst, 'reload schema';
