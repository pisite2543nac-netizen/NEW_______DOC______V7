-- DOC-FULL-NR V17.5/V17.6: student self-print for the paired late Paper worksheet.
create or replace function public.my_prepare_late_paper_print(p_worksheet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_paper public.worksheets%rowtype;
  v_digital public.worksheets%rowtype;
  v_subject public.subjects%rowtype;
  v_profile public.profiles%rowtype;
  v_pair text;
  v_token public.paper_tokens%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  select * into v_paper from public.worksheets where id=p_worksheet_id for share;
  if v_paper.id is null then raise exception 'WORKSHEET_NOT_FOUND'; end if;
  if v_paper.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  if v_paper.status<>'published' then raise exception 'WORKSHEET_NOT_PUBLISHED'; end if;
  if not exists(select 1 from public.worksheet_assignments a where a.worksheet_id=v_paper.id and a.user_id=v_uid) then raise exception 'NOT_ASSIGNED'; end if;
  v_pair:=coalesce(v_paper.settings->>'work_pair_key','');
  if v_pair='' then raise exception 'WORK_PAIR_REQUIRED'; end if;
  select * into v_digital from public.worksheets w where w.subject_id=v_paper.subject_id and w.mode='digital' and coalesce(w.settings->>'work_pair_key','')=v_pair order by w.created_at limit 1;
  if v_digital.id is null then raise exception 'DIGITAL_PAIR_NOT_FOUND'; end if;
  if v_digital.due_at is null or v_now<=v_digital.due_at then raise exception 'LATE_PAPER_NOT_OPEN_YET'; end if;
  if exists(select 1 from public.submissions s where s.worksheet_id=v_digital.id and s.user_id=v_uid and s.status in ('submitted','confirmed','graded')) then raise exception 'DIGITAL_ALREADY_SUBMITTED'; end if;
  select * into v_subject from public.subjects where id=v_paper.subject_id;
  select * into v_profile from public.profiles where id=v_uid;
  insert into public.paper_tokens(worksheet_id,user_id,expires_at,code_kind)
  values(v_paper.id,v_uid,v_now+interval '30 days','barcode')
  on conflict(worksheet_id,user_id) do update set expires_at=greatest(coalesce(public.paper_tokens.expires_at,excluded.expires_at),excluded.expires_at),revoked_at=null,code_kind='barcode'
  returning * into v_token;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PRINT_LATE_PAPER_SELF','worksheet',v_paper.id::text,jsonb_build_object('subject_id',v_paper.subject_id,'pair_key',v_pair,'digital_due_at',v_digital.due_at,'token_id',v_token.id));
  return jsonb_build_object('ok',true,'server_time',v_now,
    'subject',jsonb_build_object('id',v_subject.id,'code',v_subject.code,'name',v_subject.name),
    'student',jsonb_build_object('id',v_profile.id,'full_name',v_profile.full_name,'student_code',v_profile.student_code,'class_name',v_profile.class_name,'grade_level',v_profile.grade_level,'room_label',v_profile.room_label,'seat_number',v_profile.seat_number),
    'worksheet',jsonb_build_object('id',v_paper.id,'title',v_paper.title,'reference_code',v_paper.reference_code,'instructions',v_paper.instructions,'questions',coalesce(v_paper.questions,'[]'::jsonb),'settings',coalesce(v_paper.settings,'{}'::jsonb),'due_at',v_paper.due_at),
    'digital_due_at',v_digital.due_at,
    'token',jsonb_build_object('id',v_token.id,'token',v_token.token,'barcode_payload',v_token.barcode_payload,'payload_version',v_token.payload_version,'expires_at',v_token.expires_at));
end $$;
revoke all on function public.my_prepare_late_paper_print(uuid) from public,anon;
grant execute on function public.my_prepare_late_paper_print(uuid) to authenticated;
