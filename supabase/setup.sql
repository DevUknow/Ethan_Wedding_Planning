-- Run in Supabase SQL Editor. This schema keeps administrator emails private.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.wedding_admins (
  email text primary key check (email = lower(email)),
  name text not null unique check (name in ('송윤오','박예은'))
);

create or replace function private.is_wedding_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join private.wedding_admins a on lower(u.email)=a.email
    where u.id=auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.is_wedding_admin() from public, anon, authenticated;

create table if not exists public.wedding_state (
  id text primary key check (id='main'),
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.wedding_state enable row level security;
revoke all on public.wedding_state from anon, authenticated;
grant select on public.wedding_state to anon, authenticated;
drop policy if exists wedding_read on public.wedding_state;
create policy wedding_read on public.wedding_state for select to anon, authenticated using (id='main');

create or replace function public.get_wedding_role() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role','admin','name',a.name)
  from auth.users u join private.wedding_admins a on lower(u.email)=a.email
  where u.id=auth.uid() and u.email_confirmed_at is not null;
$$;
revoke all on function public.get_wedding_role() from public, anon;
grant execute on function public.get_wedding_role() to authenticated;

create or replace function public.save_wedding_state(_expected_revision bigint,_new_data jsonb)
returns setof public.wedding_state language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_wedding_admin() then raise exception 'Administrator email verification required' using errcode='42501'; end if;
  if jsonb_typeof(_new_data) is distinct from 'object'
    or jsonb_typeof(_new_data->'couple') is distinct from 'string'
    or jsonb_typeof(_new_data->'date') is distinct from 'string'
    or jsonb_typeof(_new_data->'budget') is distinct from 'number'
    or (_new_data->>'budget')::numeric <= 0
    or jsonb_typeof(_new_data->'tasks') is distinct from 'array'
    or jsonb_typeof(_new_data->'expenses') is distinct from 'array'
    or jsonb_typeof(_new_data->'guests') is distinct from 'array'
    or jsonb_typeof(_new_data->'saved') is distinct from 'array'
  then raise exception 'Invalid wedding data' using errcode='22023'; end if;
  return query update public.wedding_state
    set data=_new_data,revision=revision+1,updated_at=now()
    where id='main' and revision=_expected_revision returning *;
end;
$$;
revoke all on function public.save_wedding_state(bigint,jsonb) from public, anon;
grant execute on function public.save_wedding_state(bigint,jsonb) to authenticated;

insert into public.wedding_state(id,data) values ('main',
'{"couple":"송윤오 ♥ 박예은","date":"","budget":30000000,"tasks":[],"expenses":[],"guests":[],"saved":[]}'::jsonb)
on conflict (id) do nothing;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wedding_state'
  ) then alter publication supabase_realtime add table public.wedding_state; end if;
end $$;

-- Register the two real administrator emails separately in the SQL Editor:
-- insert into private.wedding_admins(email,name) values
--   ('real-yoono-email@example.com','송윤오'),
--   ('real-yeeun-email@example.com','박예은');
-- Replace these placeholders with the addresses supplied by the administrators.
