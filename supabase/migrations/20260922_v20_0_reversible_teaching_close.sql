-- DOC-FULL-NR V20.0 — Reversible sequential teaching close.
-- Closes only the latest opened unit and preserves assignments/submissions/grades/history.

create or replace function public.admin_lock_subject_unit_v20(p_subject_id uuid,p_unit_no integer,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_now timestamptz:=pg_catalog.clock_timestamp();v_count integer:=0;v_published integer:=0;v_response jsonb;v_key text:=p_subject_id::text||':'||p_unit_no::text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_unit_no is null or p_unit_no<1 or p_unit_no>17 then raise exception 'INVALID_UNIT'; end if;
  if not exists(select 1 from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject') then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('v20-lock-unit:'||v_key,0));
  select response into v_response from private.action_idempotency where actor_id=v_uid and action_kind='lock_subject_unit_v20' and entity_key=v_key and request_key=p_request_key;
  if v_response is not null then return v_response||jsonb_build_object('idempotent_replay',true); end if;
  if exists(select 1 from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings)>p_unit_no and w.status='published') then raise exception 'CLOSE_LATEST_UNIT_FIRST'; end if;
  select count(*),count(*) filter(where w.status='published') into v_count,v_published from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings)=p_unit_no;
  if v_count=0 then raise exception 'UNIT_NOT_FOUND'; end if;
  if v_published=0 then raise exception 'UNIT_ALREADY_CLOSED'; end if;
  update public.worksheets set status='draft',updated_at=v_now where subject_id=p_subject_id and reference_code is not null and coalesce((settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(settings)=p_unit_no;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'LOCK_SUBJECT_UNIT_V20','subject',p_subject_id::text,jsonb_build_object('unit_no',p_unit_no,'worksheet_count',v_count,'preserve_assignments',true,'preserve_submissions',true,'preserve_grades',true,'request_key',p_request_key));
  v_response:=jsonb_build_object('ok',true,'subject_id',p_subject_id,'unit_no',p_unit_no,'worksheet_count',v_count,'preserved',jsonb_build_array('assignments','submissions','grades','history'),'server_time',v_now,'request_key',p_request_key);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'lock_subject_unit_v20',v_key,p_request_key,v_response) on conflict do nothing;
  return v_response||jsonb_build_object('idempotent_replay',false);
end $$;
revoke all on function public.admin_lock_subject_unit_v20(uuid,integer,uuid) from public,anon;
grant execute on function public.admin_lock_subject_unit_v20(uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
