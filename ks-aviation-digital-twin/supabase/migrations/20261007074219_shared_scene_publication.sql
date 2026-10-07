-- Shared presentation is separate from private user scenes and their history.
-- Editors are provisioned by an administrator; users cannot assign this role.
create table public.ks_adt_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
alter table public.ks_adt_editors enable row level security;
revoke all on public.ks_adt_editors from public,anon,authenticated;
grant select on public.ks_adt_editors to authenticated;
create policy own_editor_access on public.ks_adt_editors for select to authenticated
  using (user_id=(select auth.uid()));

create table public.ks_adt_published_scenes (
  scene_id text primary key check (scene_id='ADB'),
  revision integer not null check (revision>0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  check (payload->>'schema'='KS_DIGITAL_TWIN_V1' and payload->>'airport'='ADB'),
  check (jsonb_typeof(payload->'entities')='array' and jsonb_array_length(payload->'entities')<=2000),
  check (octet_length(payload::text)<=12000000)
);
alter table public.ks_adt_published_scenes enable row level security;
revoke all on public.ks_adt_published_scenes from public,anon,authenticated;
grant select on public.ks_adt_published_scenes to anon,authenticated;
create policy published_scene_read on public.ks_adt_published_scenes for select to anon,authenticated using (true);

-- A private privileged operation is required to atomically update the private
-- backup and the public snapshot, with one shared revision across owner accounts.
-- Neither table accepts direct client writes. The public wrapper is invoker-only.
create or replace function ks_adt_private.save_published_scene(
  p_scene_id text,p_expected_revision integer,p_expected_published_revision integer,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_revision integer; saved jsonb; clean jsonb;
begin
  if uid is null or not exists(select 1 from public.ks_adt_editors where user_id=uid and enabled)
    then raise exception 'Designer access required' using errcode='42501'; end if;
  if p_scene_id is distinct from 'ADB' or p_expected_revision is null or p_expected_revision<0
    or p_expected_published_revision is null or p_expected_published_revision<1
    or jsonb_typeof(p_payload) is distinct from 'object'
    then raise exception 'Invalid scene request' using errcode='22023'; end if;
  select revision into current_revision from public.ks_adt_published_scenes where scene_id=p_scene_id for update;
  if not found then raise exception 'Published scene is not configured' using errcode='22023'; end if;
  if current_revision is distinct from p_expected_published_revision
    then raise exception 'Shared scene changed' using errcode='40001'; end if;
  -- Do not publish account fields or unknown top-level metadata from imports.
  select jsonb_object_agg(key,value) into clean from jsonb_each(p_payload)
    where key=any(array['schema','airport','entities','groups','source','updatedAt','routes','driving','fleetNumbers','groundPhoto','sharedGround','groundModes']);
  saved:=ks_adt_private.save_scene(p_scene_id,p_expected_revision,clean);
  update public.ks_adt_published_scenes set payload=clean,revision=current_revision+1,updated_at=now() where scene_id=p_scene_id;
  return saved||jsonb_build_object('published_revision',current_revision+1);
end $$;
revoke all on function ks_adt_private.save_published_scene(text,integer,integer,jsonb) from public,anon,authenticated;
grant usage on schema ks_adt_private to authenticated;
grant execute on function ks_adt_private.save_published_scene(text,integer,integer,jsonb) to authenticated;
create or replace function public.ks_adt_save_published_scene(
  p_scene_id text,p_expected_revision integer,p_expected_published_revision integer,p_payload jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select ks_adt_private.save_published_scene(p_scene_id,p_expected_revision,p_expected_published_revision,p_payload);
$$;
revoke all on function public.ks_adt_save_published_scene(text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.ks_adt_save_published_scene(text,integer,integer,jsonb) to authenticated;
