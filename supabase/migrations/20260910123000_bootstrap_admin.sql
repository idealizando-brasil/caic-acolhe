create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, platform_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.email = 'admin@idealizandoedu.com.br'
  )
  on conflict (id) do update set email = excluded.email;

  if new.email = 'admin@idealizandoedu.com.br' then
    insert into public.school_memberships (school_id, user_id, role)
    select id, new.id, 'matrix_admin'::public.app_role
    from public.schools where slug = 'caic'
    on conflict (school_id, user_id) do update set role = excluded.role, active = true;
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, full_name, email, platform_admin)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), email,
       email = 'admin@idealizandoedu.com.br'
from auth.users
on conflict (id) do update set email = excluded.email;

insert into public.school_memberships (school_id, user_id, role)
select s.id, u.id, 'matrix_admin'::public.app_role
from auth.users u cross join public.schools s
where u.email = 'admin@idealizandoedu.com.br' and s.slug = 'caic'
on conflict (school_id, user_id) do update set role = excluded.role, active = true;
