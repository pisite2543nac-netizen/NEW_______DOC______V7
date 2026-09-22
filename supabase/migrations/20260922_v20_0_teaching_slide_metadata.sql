-- DOC-FULL-NR V20.0 — Teaching metadata + reversible sequential teaching close.
-- Backward compatible: no table drop/reset; assignments/submissions/grades are preserved.

create or replace function public.admin_subject_unit_plan(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_subject jsonb;v_units jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'color_hex',s.color_hex,'description',s.description,'semester',s.semester,'academic_year',s.academic_year)
  into v_subject from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject';
  if v_subject is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  with base as (
    select w.id,w.title,w.reference_code,w.mode,w.status,w.open_at,w.due_at,private.docnr_unit_no(w.settings) unit_no,
      coalesce(w.settings->>'learning_goal','') learning_goal,
      coalesce(w.settings->'key_concepts','[]'::jsonb) key_concepts,
      coalesce(w.settings->'practice_steps','[]'::jsonb) practice_steps,
      coalesce(w.settings->'control_points','[]'::jsonb) control_points,
      nullif(w.settings->>'case_study','') case_study,
      coalesce(w.settings->'exit_questions','[]'::jsonb) exit_questions
    from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null
  ), units as (
    select b.unit_no,bool_and(b.status='published') unlocked,min(b.open_at) filter(where b.status='published') open_at,max(b.due_at) filter(where b.status='published') due_at,
      jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'reference_code',b.reference_code,'mode',b.mode,'status',b.status,'learning_goal',b.learning_goal,
        'key_concepts',b.key_concepts,'practice_steps',b.practice_steps,'control_points',b.control_points,'case_study',b.case_study,'exit_questions',b.exit_questions,
        'open_at',b.open_at,'due_at',b.due_at,'resource_count',(select count(*) from public.subject_files sf where sf.subject_id=p_subject_id and (sf.worksheet_id=b.id or (sf.worksheet_id is null and sf.sequence_no=b.unit_no)))) order by b.mode,b.reference_code) worksheets,
      (select coalesce(jsonb_agg(jsonb_build_object('id',sf.id,'worksheet_id',sf.worksheet_id,'resource_kind',sf.resource_kind,'sequence_no',sf.sequence_no,'original_name',sf.original_name,'storage_path',sf.storage_path,'mime_type',sf.mime_type,'size_bytes',sf.size_bytes) order by sf.created_at),'[]'::jsonb)
       from public.subject_files sf where sf.subject_id=p_subject_id and (sf.sequence_no=b.unit_no or sf.worksheet_id in (select b2.id from base b2 where b2.unit_no=b.unit_no))) resources
    from base b group by b.unit_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'unlocked',u.unlocked,'open_at',u.open_at,'due_at',u.due_at,'worksheets',u.worksheets,'resources',u.resources) order by u.unit_no),'[]'::jsonb) into v_units from units u;
  return jsonb_build_object('subject',v_subject,'units',v_units,'server_time',pg_catalog.clock_timestamp());
end $$;
revoke all on function public.admin_subject_unit_plan(uuid) from public,anon;
grant execute on function public.admin_subject_unit_plan(uuid) to authenticated;

create or replace function public.my_subject_learning_path(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_subject jsonb;v_units jsonb;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  if not exists(select 1 from public.subject_enrollments e where e.subject_id=p_subject_id and e.user_id=v_uid and e.status='approved') then raise exception 'STUDENT_NOT_APPROVED_FOR_SUBJECT'; end if;
  select jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'color_hex',s.color_hex,'description',s.description,'semester',s.semester,'academic_year',s.academic_year)
  into v_subject from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject';
  if v_subject is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  with base as (
    select w.id,w.title,w.reference_code,w.mode,w.status,w.open_at,w.due_at,private.docnr_unit_no(w.settings) unit_no,
      (w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid)) unlocked,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then coalesce(w.settings->>'learning_goal','') else null end learning_goal,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then coalesce(w.settings->'key_concepts','[]'::jsonb) else '[]'::jsonb end key_concepts,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then coalesce(w.settings->'practice_steps','[]'::jsonb) else '[]'::jsonb end practice_steps,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then coalesce(w.settings->'control_points','[]'::jsonb) else '[]'::jsonb end control_points,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then nullif(w.settings->>'case_study','') else null end case_study,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid) then coalesce(w.settings->'exit_questions','[]'::jsonb) else '[]'::jsonb end exit_questions
    from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null
  ), units as (
    select b.unit_no,bool_or(b.unlocked) unlocked,min(b.open_at) filter(where b.unlocked) open_at,max(b.due_at) filter(where b.unlocked) due_at,
      jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'reference_code',b.reference_code,'mode',b.mode,'unlocked',b.unlocked,'open_at',case when b.unlocked then b.open_at else null end,'due_at',case when b.unlocked then b.due_at else null end,'learning_goal',b.learning_goal,'key_concepts',b.key_concepts,'practice_steps',b.practice_steps,'control_points',b.control_points,'case_study',b.case_study,'exit_questions',b.exit_questions) order by b.mode,b.reference_code) worksheets,
      case when bool_or(b.unlocked) then (select coalesce(jsonb_agg(jsonb_build_object('id',sf.id,'worksheet_id',sf.worksheet_id,'resource_kind',sf.resource_kind,'sequence_no',sf.sequence_no,'original_name',sf.original_name,'storage_path',sf.storage_path,'mime_type',sf.mime_type,'size_bytes',sf.size_bytes) order by sf.created_at),'[]'::jsonb) from public.subject_files sf where sf.subject_id=p_subject_id and (sf.sequence_no=b.unit_no or sf.worksheet_id in (select b2.id from base b2 where b2.unit_no=b.unit_no and b2.unlocked))) else '[]'::jsonb end resources
    from base b group by b.unit_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'unlocked',u.unlocked,'open_at',u.open_at,'due_at',u.due_at,'worksheets',u.worksheets,'resources',u.resources) order by u.unit_no),'[]'::jsonb) into v_units from units u;
  return jsonb_build_object('subject',v_subject,'units',v_units,'server_time',pg_catalog.clock_timestamp());
end $$;
revoke all on function public.my_subject_learning_path(uuid) from public,anon;
grant execute on function public.my_subject_learning_path(uuid) to authenticated;
notify pgrst,'reload schema';
