-- Additive migration: separate tables; never alters the legacy application.
create table if not exists public.ks_adt_scenes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null check (scene_id = 'ADB'),
  revision integer not null check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id, scene_id),
  check (payload->>'schema' = 'KS_DIGITAL_TWIN_V1' and payload->>'airport' = 'ADB'),
  check (octet_length(payload::text) <= 12000000)
);
create table if not exists public.ks_adt_scene_versions (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null,
  revision integer not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key(user_id, scene_id, revision)
);
alter table public.ks_adt_scenes enable row level security;
alter table public.ks_adt_scene_versions enable row level security;
revoke all on public.ks_adt_scenes,public.ks_adt_scene_versions from anon,authenticated;
grant select on public.ks_adt_scenes,public.ks_adt_scene_versions to authenticated;
drop policy if exists own_scenes on public.ks_adt_scenes;
create policy own_scenes on public.ks_adt_scenes for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists own_scene_versions on public.ks_adt_scene_versions;
create policy own_scene_versions on public.ks_adt_scene_versions for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.ks_adt_save_scene(p_scene_id text,p_expected_revision integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); saved public.ks_adt_scenes;
begin
  if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_scene_id <> 'ADB' or p_expected_revision < 0 or p_payload->>'schema' is distinct from 'KS_DIGITAL_TWIN_V1'
    or p_payload->>'airport' is distinct from 'ADB' or jsonb_typeof(p_payload->'entities') is distinct from 'array'
    or jsonb_array_length(p_payload->'entities')>2000 then raise exception 'Invalid scene' using errcode='22023'; end if;
  if p_expected_revision=0 then
    begin
      insert into public.ks_adt_scenes(user_id,scene_id,revision,payload) values(uid,p_scene_id,1,p_payload) returning * into saved;
    exception when unique_violation then raise exception 'Cloud scene changed' using errcode='40001'; end;
  else
    update public.ks_adt_scenes set payload=p_payload,revision=revision+1,updated_at=now()
      where user_id=uid and scene_id=p_scene_id and revision=p_expected_revision returning * into saved;
    if not found then raise exception 'Cloud scene changed' using errcode='40001'; end if;
  end if;
  insert into public.ks_adt_scene_versions(user_id,scene_id,revision,payload) values(uid,p_scene_id,saved.revision,p_payload);
  -- Keep the last 30 explicit saves per account; the current scene is never removed.
  delete from public.ks_adt_scene_versions where user_id=uid and scene_id=p_scene_id and revision<=saved.revision-30;
  return jsonb_build_object('revision',saved.revision,'updated_at',saved.updated_at);
end $$;
revoke all on function public.ks_adt_save_scene(text,integer,jsonb) from public,anon;
grant execute on function public.ks_adt_save_scene(text,integer,jsonb) to authenticated;
