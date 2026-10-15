-- First deployment phase: prepare the public invitation and photo bucket without
-- changing the existing planner read policy. Deploy the invitation-aware frontend
-- after this file succeeds, then run invitation-upgrade.sql to lock planner reads.
-- Repeatable SQL Editor artifact; no migration-history entry or private data rewrite.

-- The planner is private. Only this explicit invitation projection is public.
create or replace function private.valid_invitation_date(_value text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if _value='' then return true; end if;
  if _value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return to_char(_value::date,'YYYY-MM-DD')=_value;
exception when others then return false;
end;
$$;
revoke all on function private.valid_invitation_date(text) from public, anon, authenticated;

create or replace function private.valid_invitation_photo(_photo jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(_photo)='object'
    and jsonb_typeof(_photo->'id')='string' and length(btrim(_photo->>'id')) between 1 and 100
    and btrim(_photo->>'id')=_photo->>'id'
    and jsonb_typeof(_photo->'url')='string' and length(_photo->>'url') between 1 and 2000
    and (_photo->>'url') ~* '^https?://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'
    and jsonb_typeof(_photo->'alt')='string' and length(_photo->>'alt')<=200,
    false
  );
$$;
revoke all on function private.valid_invitation_photo(jsonb) from public, anon, authenticated;

create or replace function private.valid_invitation_settings(_invitation jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare _photo jsonb;
begin
  if jsonb_typeof(_invitation) is distinct from 'object' then return false; end if;
  if jsonb_typeof(_invitation->'groom') is distinct from 'string'
    or length(btrim(_invitation->>'groom')) not between 1 and 40
    or btrim(_invitation->>'groom')<>_invitation->>'groom'
    or jsonb_typeof(_invitation->'bride') is distinct from 'string'
    or length(btrim(_invitation->>'bride')) not between 1 and 40
    or btrim(_invitation->>'bride')<>_invitation->>'bride'
    or jsonb_typeof(_invitation->'time') is distinct from 'string'
    or (_invitation->>'time') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(_invitation->'greeting') is distinct from 'string'
    or length(_invitation->>'greeting')>3000
    or jsonb_typeof(_invitation->'directionsNote') is distinct from 'string'
    or length(_invitation->>'directionsNote')>2000
    or jsonb_typeof(_invitation->'contactGroom') is distinct from 'string'
    or length(_invitation->>'contactGroom')>40
    or (_invitation->>'contactGroom') !~ '^$|^[+]?[0-9][0-9 -]*$'
    or jsonb_typeof(_invitation->'contactBride') is distinct from 'string'
    or length(_invitation->>'contactBride')>40
    or (_invitation->>'contactBride') !~ '^$|^[+]?[0-9][0-9 -]*$'
    or jsonb_typeof(_invitation->'gallery') is distinct from 'array'
    or not (_invitation ? 'heroPhoto')
  then return false; end if;
  if _invitation->'heroPhoto'<>'null'::jsonb and not private.valid_invitation_photo(_invitation->'heroPhoto') then return false; end if;
  if jsonb_array_length(_invitation->'gallery')>12 then return false; end if;
  for _photo in select value from jsonb_array_elements(_invitation->'gallery') loop
    if not private.valid_invitation_photo(_photo) then return false; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(_invitation->'gallery')) then return false; end if;
  return true;
end;
$$;
revoke all on function private.valid_invitation_settings(jsonb) from public, anon, authenticated;

create or replace function private.invitation_projection(_data jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  _invitation jsonb := _data->'invitation';
  _names text[] := regexp_split_to_array(coalesce(_data->>'couple',''), '[♥&]');
  _groom text := '송윤오';
  _bride text := '박예은';
  _hero jsonb := 'null'::jsonb;
  _gallery jsonb := '[]'::jsonb;
begin
  if cardinality(_names)=2 and length(btrim(_names[1])) between 1 and 40 and length(btrim(_names[2])) between 1 and 40 then
    _groom:=btrim(_names[1]); _bride:=btrim(_names[2]);
  end if;
  if not private.valid_invitation_settings(_invitation) then
    _invitation:=jsonb_build_object('groom',_groom,'bride',_bride,'time','','greeting',E'서로의 가장 가까운 친구가 되어\n함께 걸어갈 첫날에 초대합니다.\n소중한 걸음으로 자리를 빛내 주세요.','heroPhoto',null,'gallery','[]'::jsonb,'directionsNote','','contactGroom','','contactBride','');
  end if;
  if _invitation->'heroPhoto'<>'null'::jsonb then
    _hero:=jsonb_build_object('id',_invitation->'heroPhoto'->>'id','url',_invitation->'heroPhoto'->>'url','alt',_invitation->'heroPhoto'->>'alt');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','url',value->>'url','alt',value->>'alt') order by ordinality),'[]'::jsonb)
    into _gallery from jsonb_array_elements(_invitation->'gallery') with ordinality;
  return jsonb_build_object(
    'groom',_invitation->>'groom','bride',_invitation->>'bride',
    'date',case when private.valid_invitation_date(coalesce(_data->>'date','')) then coalesce(_data->>'date','') else '' end,
    'time',_invitation->>'time','greeting',_invitation->>'greeting',
    'heroPhoto',_hero,'gallery',_gallery,'directionsNote',_invitation->>'directionsNote',
    'contactGroom',_invitation->>'contactGroom','contactBride',_invitation->>'contactBride'
  );
end;
$$;
revoke all on function private.invitation_projection(jsonb) from public, anon, authenticated;

create table if not exists public.wedding_invitation (
  id text primary key check (id='main'),
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.wedding_invitation enable row level security;
revoke all on public.wedding_invitation from public, anon, authenticated;
grant select on public.wedding_invitation to anon, authenticated;
drop policy if exists invitation_read on public.wedding_invitation;
create policy invitation_read on public.wedding_invitation for select to anon, authenticated using (id='main');

-- The policy helper stays in the non-exposed private schema. Its caller can only
-- ask whether their verified account is approved; administrator emails stay private.
grant usage on schema private to authenticated;
grant execute on function private.is_wedding_admin() to authenticated;
alter table private.wedding_admins enable row level security;
revoke all on private.wedding_admins from public, anon, authenticated;
create or replace function public.save_wedding_state(_expected_revision bigint,_new_data jsonb)
returns setof public.wedding_state language plpgsql security definer set search_path = '' as $$
declare _saved public.wedding_state%rowtype;
begin
  if not private.is_wedding_admin() then raise exception 'Administrator email verification required' using errcode='42501'; end if;
  if jsonb_typeof(_new_data) is distinct from 'object'
    or jsonb_typeof(_new_data->'couple') is distinct from 'string'
    or jsonb_typeof(_new_data->'date') is distinct from 'string'
    or not private.valid_invitation_date(_new_data->>'date')
    or jsonb_typeof(_new_data->'budget') is distinct from 'number'
    or (_new_data->>'budget')::numeric <= 0
    or jsonb_typeof(_new_data->'tasks') is distinct from 'array'
    or jsonb_typeof(_new_data->'expenses') is distinct from 'array'
    or jsonb_typeof(_new_data->'guests') is distinct from 'array'
    or jsonb_typeof(_new_data->'saved') is distinct from 'array'
    or (_new_data ? 'invitation' and not private.valid_invitation_settings(_new_data->'invitation'))
  then raise exception 'Invalid wedding data' using errcode='22023'; end if;
  update public.wedding_state
    set data=_new_data,revision=revision+1,updated_at=now()
    where id='main' and revision=_expected_revision returning * into _saved;
  if found then
    insert into public.wedding_invitation(id,data,revision,updated_at)
      values (_saved.id,private.invitation_projection(_saved.data),_saved.revision,_saved.updated_at)
      on conflict (id) do update set data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at;
    return next _saved;
  end if;
end;
$$;
revoke all on function public.save_wedding_state(bigint,jsonb) from public, anon;
grant execute on function public.save_wedding_state(bigint,jsonb) to authenticated;

-- Seed the public invitation without copying any private planner fields.
insert into public.wedding_invitation(id,data,revision,updated_at)
  select id,private.invitation_projection(data),revision,updated_at from public.wedding_state where id='main'
  on conflict (id) do update set data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wedding_invitation'
  ) then alter publication supabase_realtime add table public.wedding_invitation; end if;
end $$;

-- Photos are intentionally public invitation assets, never private contracts.
-- Supabase owns storage tables. Skip this section in plain PostgreSQL test setups.
do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values ('wedding-invitation','wedding-invitation',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
      on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
    execute 'drop policy if exists wedding_invitation_photo_read on storage.objects';
    execute 'create policy wedding_invitation_photo_read on storage.objects for select to anon, authenticated using (bucket_id=''wedding-invitation'')';
    execute 'drop policy if exists wedding_invitation_photo_insert on storage.objects';
    execute 'create policy wedding_invitation_photo_insert on storage.objects for insert to authenticated with check (bucket_id=''wedding-invitation'' and (select private.is_wedding_admin()))';
    execute 'drop policy if exists wedding_invitation_photo_update on storage.objects';
    execute 'create policy wedding_invitation_photo_update on storage.objects for update to authenticated using (bucket_id=''wedding-invitation'' and (select private.is_wedding_admin())) with check (bucket_id=''wedding-invitation'' and (select private.is_wedding_admin()))';
    execute 'drop policy if exists wedding_invitation_photo_delete on storage.objects';
    execute 'create policy wedding_invitation_photo_delete on storage.objects for delete to authenticated using (bucket_id=''wedding-invitation'' and (select private.is_wedding_admin()))';
  end if;
end $$;
