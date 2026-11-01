-- Dedicated Gemini project only: vawyfqunzzbbjhanoapa.
-- Rollback: disable VITE_KS_TEST_CLOUD, then remove these three new tables/functions.
begin;
create table public.ks_adt_editors (
  email text primary key check(email=lower(email)),
  user_id uuid unique references auth.users(id) on delete set null,
  enabled boolean not null default true
);
create table public.ks_adt_scenes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null check(scene_id='ADB'),
  revision integer not null check(revision>0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,scene_id)
);
create table public.ks_adt_published_scenes (
  scene_id text primary key check(scene_id='ADB'),
  revision integer not null check(revision>0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.ks_adt_editors enable row level security;
alter table public.ks_adt_scenes enable row level security;
alter table public.ks_adt_published_scenes enable row level security;
revoke all on public.ks_adt_editors,public.ks_adt_scenes,public.ks_adt_published_scenes from anon,authenticated;
grant select on public.ks_adt_editors,public.ks_adt_scenes to authenticated;
grant select on public.ks_adt_published_scenes to anon,authenticated;
create policy editor_self on public.ks_adt_editors for select to authenticated using(user_id=(select auth.uid()));
create policy scene_self on public.ks_adt_scenes for select to authenticated using(user_id=(select auth.uid()));
create policy scene_public on public.ks_adt_published_scenes for select to anon,authenticated using(scene_id='ADB');
insert into public.ks_adt_editors(email) values ('ks.aviation.gemini@gmail.com');

-- Bind only the signed-in, confirmed account to its pre-authorized email.
create function public.ks_adt_claim_editor() returns boolean language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
  if auth.uid() is null then return false; end if;
  select lower(u.email) into v_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  update public.ks_adt_editors set user_id=auth.uid()
    where email=v_email and enabled and (user_id is null or user_id=auth.uid());
  return found;
end $$;
create function public.ks_adt_is_editor() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.ks_adt_editors where user_id=auth.uid() and enabled);
$$;
create function public.ks_adt_save_published_scene(p_scene_id text,p_expected_revision integer,p_expected_published_revision integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare personal integer; published integer; stamp timestamptz:=now();
begin
  if not public.ks_adt_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
  if p_scene_id is distinct from 'ADB' or p_expected_revision is null or p_expected_published_revision is null
    or p_payload is null or p_payload->>'schema' is distinct from 'KS_DIGITAL_TWIN_V1'
    or p_payload->>'airport' is distinct from 'ADB'
    or jsonb_typeof(p_payload->'entities') is distinct from 'array'
    or jsonb_typeof(p_payload->'groups') is distinct from 'array'
    or octet_length(p_payload::text)>30000000 then raise exception 'Invalid ADB scene' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('ks_adt_publish:'||p_scene_id));
  select revision into personal from public.ks_adt_scenes where user_id=auth.uid() and scene_id=p_scene_id;
  select revision into published from public.ks_adt_published_scenes where scene_id=p_scene_id;
  personal:=coalesce(personal,0);published:=coalesce(published,0);
  if personal<>p_expected_revision or published<>p_expected_published_revision then raise exception 'Scene revision conflict' using errcode='40001'; end if;
  insert into public.ks_adt_scenes(user_id,scene_id,revision,payload,updated_at) values(auth.uid(),p_scene_id,personal+1,p_payload,stamp)
    on conflict(user_id,scene_id) do update set revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at;
  insert into public.ks_adt_published_scenes(scene_id,revision,payload,updated_at,updated_by) values(p_scene_id,published+1,p_payload,stamp,auth.uid())
    on conflict(scene_id) do update set revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  return jsonb_build_object('revision',personal+1,'published_revision',published+1,'updated_at',stamp);
end $$;
create function public.ks_adt_save_scene(p_scene_id text,p_expected_revision integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision integer; stamp timestamptz:=now();
begin
  if not public.ks_adt_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
  if p_scene_id is distinct from 'ADB' or p_expected_revision is null or p_payload is null
    or p_payload->>'schema' is distinct from 'KS_DIGITAL_TWIN_V1' or p_payload->>'airport' is distinct from 'ADB'
    or jsonb_typeof(p_payload->'entities') is distinct from 'array' or jsonb_typeof(p_payload->'groups') is distinct from 'array'
    or octet_length(p_payload::text)>30000000 then raise exception 'Invalid ADB scene' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('ks_adt_publish:'||p_scene_id));
  select revision into current_revision from public.ks_adt_scenes where user_id=auth.uid() and scene_id=p_scene_id;
  current_revision:=coalesce(current_revision,0);
  if current_revision<>p_expected_revision then raise exception 'Scene revision conflict' using errcode='40001'; end if;
  insert into public.ks_adt_scenes(user_id,scene_id,revision,payload,updated_at) values(auth.uid(),p_scene_id,current_revision+1,p_payload,stamp)
    on conflict(user_id,scene_id) do update set revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at;
  return jsonb_build_object('revision',current_revision+1,'updated_at',stamp);
end $$;
revoke all on function public.ks_adt_claim_editor(),public.ks_adt_is_editor(),public.ks_adt_save_published_scene(text,integer,integer,jsonb),public.ks_adt_save_scene(text,integer,jsonb) from public,anon;
grant execute on function public.ks_adt_claim_editor(),public.ks_adt_is_editor(),public.ks_adt_save_published_scene(text,integer,integer,jsonb),public.ks_adt_save_scene(text,integer,jsonb) to authenticated;
commit;
