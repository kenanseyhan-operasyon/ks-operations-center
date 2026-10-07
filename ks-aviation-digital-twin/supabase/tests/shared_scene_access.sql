-- Run against the configured project; all test writes are rolled back.
begin;
select set_config('ks_adt_test.owner',(select e.user_id::text from public.ks_adt_editors e join public.ks_adt_scenes s using(user_id) where s.scene_id='ADB' and e.enabled order by s.updated_at desc limit 1),true);
select set_config('ks_adt_test.other_owner',(select user_id::text from public.ks_adt_editors where enabled and user_id::text<>current_setting('ks_adt_test.owner') limit 1),true);
select set_config('ks_adt_test.stranger',gen_random_uuid()::text,true);
select set_config('ks_adt_test.revision',(select revision::text from public.ks_adt_published_scenes where scene_id='ADB'),true);
set local role anon;
do $$ begin
  if (select count(*) from public.ks_adt_published_scenes)<>1 then raise exception 'Anonymous read failed'; end if;
  begin update public.ks_adt_published_scenes set revision=999; raise exception 'Anonymous update allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.ks_adt_published_scenes; raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.ks_adt_scenes; raise exception 'Private records leaked'; exception when insufficient_privilege then null; end;
  begin perform public.ks_adt_save_published_scene('ADB',0,1,'{}'); raise exception 'Anonymous publish allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('ks_adt_test.stranger'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ks_adt_test.stranger'),'role','authenticated','user_metadata',jsonb_build_object('editor',true))::text,true);
do $$ begin
  if (select count(*) from public.ks_adt_editors)<>0 then raise exception 'Editor roles leaked'; end if;
  if (select count(*) from public.ks_adt_scenes)<>0 then raise exception 'Private scene leaked to stranger'; end if;
  if (select count(*) from public.ks_adt_scene_versions)<>0 then raise exception 'Private history leaked'; end if;
  begin insert into public.ks_adt_editors(user_id) values(auth.uid()); raise exception 'Self-promotion allowed'; exception when insufficient_privilege then null; end;
  begin update public.ks_adt_published_scenes set revision=999; raise exception 'Direct update allowed'; exception when insufficient_privilege then null; end;
  begin perform public.ks_adt_save_published_scene('ADB',0,1,'{}'); raise exception 'Non-owner publish allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('ks_adt_test.owner'),true);
do $$ declare s public.ks_adt_published_scenes; r jsonb; own_revision integer; begin
  if (select count(*) from public.ks_adt_editors)<>1 then raise exception 'Owner role not visible'; end if;
  select * into s from public.ks_adt_published_scenes where scene_id='ADB';
  select revision into own_revision from public.ks_adt_scenes where scene_id='ADB';
  r:=public.ks_adt_save_published_scene('ADB',own_revision,s.revision,s.payload||'{"unexpected_account_metadata":"must-not-publish"}'::jsonb);
  if (r->>'published_revision')::integer<>s.revision+1 or (r->>'revision')::integer<>own_revision+1 then raise exception 'Owner publication failed'; end if;
  if exists(select 1 from public.ks_adt_published_scenes where payload ? 'unexpected_account_metadata') then raise exception 'Metadata was published'; end if;
  begin perform public.ks_adt_save_published_scene('ADB',own_revision,s.revision,s.payload); raise exception 'Stale overwrite allowed'; exception when serialization_failure then null; end;
  begin update public.ks_adt_published_scenes set revision=999; raise exception 'Owner bypassed atomic RPC'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('ks_adt_test.other_owner'),true);
do $$ declare s public.ks_adt_published_scenes; r jsonb; own_revision integer; begin
  select * into s from public.ks_adt_published_scenes where scene_id='ADB';
  select coalesce((select revision from public.ks_adt_scenes where scene_id='ADB'),0) into own_revision;
  begin perform public.ks_adt_save_published_scene('ADB',own_revision,current_setting('ks_adt_test.revision')::integer,s.payload); raise exception 'Other account overwrote stale public scene'; exception when serialization_failure then null; end;
  if coalesce((select revision from public.ks_adt_scenes where scene_id='ADB'),0)<>own_revision then raise exception 'Conflict modified personal backup'; end if;
  r:=public.ks_adt_save_published_scene('ADB',own_revision,s.revision,s.payload);
  if (r->>'published_revision')::integer<>s.revision+1 then raise exception 'Second owner publication failed'; end if;
  if (select payload from public.ks_adt_scenes where scene_id='ADB') is distinct from (select payload from public.ks_adt_published_scenes where scene_id='ADB') then raise exception 'Private and public saves diverged'; end if;
end $$;
rollback;
select 'PASS: anonymous read; denied anonymous/non-owner writes and self-promotion; private data isolation; both owner accounts; atomic save; stale revision rejection; all writes rolled back.' as result;
