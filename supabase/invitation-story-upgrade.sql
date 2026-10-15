-- Deploy the invitation frontend that accepts legacy and themed envelopes first.
-- Then run this repeatable SQL Editor artifact to publish theme/story support.
-- It only replaces private projection/validation helpers and refreshes the public
-- invitation from the latest private row; planner data, revisions, access policies,
-- administrator accounts, signup configuration and photo storage stay unchanged.

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

create or replace function private.valid_invitation_story(_story jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(_story)='object'
    and jsonb_typeof(_story->'enabled')='boolean'
    and jsonb_typeof(_story->'firstMetDate')='string'
    and private.valid_invitation_date(_story->>'firstMetDate')
    and jsonb_typeof(_story->'firstMetText')='string' and length(_story->>'firstMetText')<=1000
    and jsonb_typeof(_story->'groomMessage')='string' and length(_story->>'groomMessage')<=1000
    and jsonb_typeof(_story->'brideMessage')='string' and length(_story->>'brideMessage')<=1000
    and jsonb_typeof(_story->'promise')='string' and length(_story->>'promise')<=1000,
    false
  );
$$;
revoke all on function private.valid_invitation_story(jsonb) from public, anon, authenticated;

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
  if _invitation ? 'theme' and (jsonb_typeof(_invitation->'theme') is distinct from 'string' or (_invitation->>'theme') not in ('ivory','briller-night')) then return false; end if;
  if _invitation ? 'story' and not private.valid_invitation_story(_invitation->'story') then return false; end if;
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
  _story jsonb := jsonb_build_object('enabled',false,'firstMetDate','','firstMetText','','groomMessage','','brideMessage','','promise','');
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
  -- Hidden story drafts stay in wedding_state. Even a guest who inspects the
  -- raw public API response must not receive the unpublished text or date.
  if _invitation->'story'->'enabled'='true'::jsonb then
    _story:=jsonb_build_object(
      'enabled',true,'firstMetDate',_invitation->'story'->>'firstMetDate',
      'firstMetText',_invitation->'story'->>'firstMetText',
      'groomMessage',_invitation->'story'->>'groomMessage',
      'brideMessage',_invitation->'story'->>'brideMessage',
      'promise',_invitation->'story'->>'promise'
    );
  end if;
  return jsonb_build_object(
    'groom',_invitation->>'groom','bride',_invitation->>'bride',
    'date',case when private.valid_invitation_date(coalesce(_data->>'date','')) then coalesce(_data->>'date','') else '' end,
    'time',_invitation->>'time','greeting',_invitation->>'greeting',
    'heroPhoto',_hero,'gallery',_gallery,'directionsNote',_invitation->>'directionsNote',
    'contactGroom',_invitation->>'contactGroom','contactBride',_invitation->>'contactBride',
    'theme',coalesce(_invitation->>'theme','ivory'),'story',_story
  );
end;
$$;
revoke all on function private.invitation_projection(jsonb) from public, anon, authenticated;

insert into public.wedding_invitation as published(id,data,revision,updated_at)
  select id,private.invitation_projection(data),revision,updated_at from public.wedding_state where id='main'
  on conflict (id) do update set data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at
    where published.revision<=excluded.revision;
