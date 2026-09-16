-- DOC-FULL-NR V18.1 runtime/source alignment
-- Mirrors V18 RPCs already used by the production frontend.

create or replace function public.finalize_digital_submission_v18(
  p_worksheet_id uuid,
  p_answers jsonb,
  p_attachments jsonb default '[]'::jsonb,
  p_request_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql security definer
set search_path='public','private','pg_temp'
as $$
declare v_uid uuid:=auth.uid();v_paths text[]:='{}'::text[];v_item jsonb;v_path text;v_sub public.submissions%rowtype;v_sha text;v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb))<>'array' then raise exception 'ATTACHMENTS_MUST_BE_ARRAY'; end if;
  if jsonb_array_length(coalesce(p_attachments,'[]'::jsonb))>30 then raise exception 'TOO_MANY_ATTACHMENTS'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) loop
    v_path:=nullif(trim(v_item->>'path'),'');
    if v_path is null or split_part(v_path,'/',1)<>v_uid::text or split_part(v_path,'/',2)<>p_worksheet_id::text then raise exception 'INVALID_ATTACHMENT_PATH'; end if;
    v_sha:=lower(nullif(trim(v_item->>'sha256'),''));
    if v_sha is not null and v_sha !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_SHA256'; end if;
    v_paths:=array_append(v_paths,v_path);
  end loop;
  v_sub:=private.finalize_digital_submission_core(p_worksheet_id,p_answers,v_paths,p_request_key);
  for v_item in select value from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) loop
    v_path:=v_item->>'path';v_sha:=lower(nullif(trim(v_item->>'sha256'),''));
    insert into public.submission_files(submission_id,user_id,storage_path,original_name,mime_type,size_bytes,sha256,immutable_at,metadata)
    values(v_sub.id,v_uid,v_path,coalesce(nullif(v_item->>'name',''),'attachment'),nullif(v_item->>'type',''),nullif(v_item->>'size','')::bigint,v_sha,v_now,jsonb_build_object('immutable_evidence',true,'worksheet_id',p_worksheet_id,'request_key',p_request_key))
    on conflict(submission_id,storage_path) do update set sha256=coalesce(public.submission_files.sha256,excluded.sha256),immutable_at=coalesce(public.submission_files.immutable_at,excluded.immutable_at),metadata=public.submission_files.metadata||excluded.metadata;
  end loop;
  return jsonb_build_object('ok',true,'submission_id',v_sub.id,'worksheet_id',v_sub.worksheet_id,'status',v_sub.status,'submitted_at',v_sub.submitted_at,'attempt_count',v_sub.attempt_count,'request_key',p_request_key,'immutable_evidence',true,'attachment_count',coalesce(jsonb_array_length(p_attachments),0),'server_time',v_now);
end $$;

create or replace function public.admin_import_exam_bank_v18(p_items jsonb)
returns jsonb
language plpgsql security definer
set search_path='public','private','pg_temp'
as $$
declare v_uid uuid:=auth.uid();v_count int:=0;v_bad int:=0;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'EXAM_BANK_ARRAY_REQUIRED'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'EXAM_BANK_CHUNK_TOO_LARGE'; end if;
  with src as (
    select * from jsonb_to_recordset(p_items) as x(source_key text,subject_code text,prompt text,options jsonb,correct_answer text,explanation text,difficulty text,theme text)
  ), valid as (
    select s.id subject_id,x.* from src x join public.subjects s on s.code=x.subject_code and s.active=true and s.subject_type='subject'
    where nullif(trim(x.source_key),'') is not null and nullif(trim(x.prompt),'') is not null
  ), up as (
    insert into public.exam_question_bank(subject_id,source_key,prompt,options,correct_answer,explanation,difficulty,theme,tags,active,created_by,created_at,updated_at)
    select subject_id,source_key,prompt,options,correct_answer,explanation,lower(difficulty),theme,'[]'::jsonb,true,v_uid,clock_timestamp(),clock_timestamp() from valid
    on conflict(source_key) do update set subject_id=excluded.subject_id,prompt=excluded.prompt,options=excluded.options,correct_answer=excluded.correct_answer,explanation=excluded.explanation,difficulty=excluded.difficulty,theme=excluded.theme,active=true,updated_at=clock_timestamp()
    returning 1
  ) select count(*) into v_count from up;
  v_bad:=jsonb_array_length(p_items)-v_count;
  insert into public.audit_logs(actor_id,action,entity_type,metadata) values(v_uid,'IMPORT_EXAM_BANK_V18','exam_question_bank',jsonb_build_object('imported',v_count,'skipped',v_bad));
  return jsonb_build_object('ok',true,'imported',v_count,'skipped',v_bad,'total_active',(select count(*) from public.exam_question_bank where active));
end $$;

revoke all on function public.finalize_digital_submission_v18(uuid,jsonb,jsonb,uuid) from public;
grant execute on function public.finalize_digital_submission_v18(uuid,jsonb,jsonb,uuid) to authenticated;
revoke all on function public.admin_import_exam_bank_v18(jsonb) from public;
grant execute on function public.admin_import_exam_bank_v18(jsonb) to authenticated;

notify pgrst,'reload schema';
