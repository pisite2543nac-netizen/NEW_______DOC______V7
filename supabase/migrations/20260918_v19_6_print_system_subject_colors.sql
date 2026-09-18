-- DOC-FULL-NR V19.6 Print System / Subject Color Identity
begin;

update public.subjects set color_hex=case code
  when '20001-1001' then '#2E7D32'
  when '20001-1004' then '#9A6700'
  when '21900-1005' then '#1565C0'
  when '21901-2008' then '#7B1FA2'
  when '21901-2017' then '#00838F'
  when '21901-2020' then '#455A64'
  when '21910-2010' then '#EF6C00'
  when '31901-2001' then '#512DA8'
  when '31901-2004' then '#00796B'
  when '31901-2009' then '#00897B'
  when '31910-0004' then '#D84315'
  else color_hex
end
where active=true and subject_type='subject';

create or replace function public.admin_prepare_paper_print_pack(p_worksheet_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_w public.worksheets%rowtype;
  v_subject_code text; v_subject_name text; v_subject_color text; v_students jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_w from public.worksheets where id=p_worksheet_id;
  if v_w.id is null then raise exception 'WORKSHEET_NOT_FOUND'; end if;
  if v_w.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  select code,name,color_hex into v_subject_code,v_subject_name,v_subject_color from public.subjects where id=v_w.subject_id;

  insert into public.paper_tokens(worksheet_id,user_id,expires_at,code_kind)
  select v_w.id,a.user_id,v_w.due_at,'barcode'
  from public.worksheet_assignments a where a.worksheet_id=v_w.id
  on conflict(worksheet_id,user_id) do update set expires_at=excluded.expires_at,code_kind='barcode';

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'full_name',p.full_name,'student_code',p.student_code,'class_name',p.class_name,
    'grade_level',p.grade_level,'room_label',p.room_label,'seat_number',p.seat_number,
    'token',pt.token,'expires_at',pt.expires_at,'barcode_payload',pt.barcode_payload,
    'payload_version',pt.payload_version,'revoked_at',pt.revoked_at,'used_at',pt.used_at
  ) order by coalesce(p.student_code,''),coalesce(p.full_name,'')),'[]'::jsonb) into v_students
  from public.worksheet_assignments a
  join public.profiles p on p.id=a.user_id
  join public.paper_tokens pt on pt.worksheet_id=a.worksheet_id and pt.user_id=a.user_id
  where a.worksheet_id=v_w.id;

  return jsonb_build_object('worksheet',jsonb_build_object(
    'id',v_w.id,'subject_id',v_w.subject_id,'subject_code',v_subject_code,'subject_name',v_subject_name,'subject_color',coalesce(v_subject_color,'#1565C0'),
    'title',v_w.title,'description',v_w.description,'instructions',v_w.instructions,
    'reference_code',v_w.reference_code,'questions',coalesce(v_w.questions,'[]'::jsonb),
    'settings',coalesce(v_w.settings,'{}'::jsonb),'open_at',v_w.open_at,'due_at',v_w.due_at,'status',v_w.status
  ),'students',v_students,'server_time',clock_timestamp());
end $$;

revoke all on function public.admin_prepare_paper_print_pack(uuid) from public,anon;
grant execute on function public.admin_prepare_paper_print_pack(uuid) to authenticated;

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
    'subject',jsonb_build_object('id',v_subject.id,'code',v_subject.code,'name',v_subject.name,'color_hex',coalesce(v_subject.color_hex,'#1565C0')),
    'student',jsonb_build_object('id',v_profile.id,'full_name',v_profile.full_name,'student_code',v_profile.student_code,'class_name',v_profile.class_name,'grade_level',v_profile.grade_level,'room_label',v_profile.room_label,'seat_number',v_profile.seat_number),
    'worksheet',jsonb_build_object('id',v_paper.id,'title',v_paper.title,'reference_code',v_paper.reference_code,'instructions',v_paper.instructions,'questions',coalesce(v_paper.questions,'[]'::jsonb),'settings',coalesce(v_paper.settings,'{}'::jsonb),'due_at',v_paper.due_at),
    'digital_due_at',v_digital.due_at,
    'token',jsonb_build_object('id',v_token.id,'token',v_token.token,'barcode_payload',v_token.barcode_payload,'payload_version',v_token.payload_version,'expires_at',v_token.expires_at));
end $$;

revoke all on function public.my_prepare_late_paper_print(uuid) from public,anon;
grant execute on function public.my_prepare_late_paper_print(uuid) to authenticated;

commit;
