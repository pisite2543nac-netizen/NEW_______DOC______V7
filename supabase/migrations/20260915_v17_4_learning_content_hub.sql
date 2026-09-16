-- DOC-FULL-NR V17.4 Learning Content Hub
-- Additive RPC upgrade: expose unit resource metadata to Admin so slides/files can be opened in the same unit card.
create or replace function public.admin_subject_unit_plan(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_subject jsonb;v_units jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'color_hex',s.color_hex,'description',s.description)
    into v_subject from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject';
  if v_subject is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  with base as (
    select w.id,w.title,w.reference_code,w.mode,w.status,w.open_at,w.due_at,private.docnr_unit_no(w.settings) unit_no,
      coalesce(w.settings->>'learning_goal','') learning_goal
    from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null
  ),units as (
    select b.unit_no,bool_and(b.status='published') unlocked,min(b.open_at) filter(where b.status='published') open_at,
      max(b.due_at) filter(where b.status='published') due_at,
      jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'reference_code',b.reference_code,'mode',b.mode,
        'status',b.status,'learning_goal',b.learning_goal,'open_at',b.open_at,'due_at',b.due_at,
        'resource_count',(select count(*) from public.subject_files sf where sf.subject_id=p_subject_id
          and (sf.worksheet_id=b.id or (sf.worksheet_id is null and sf.sequence_no=b.unit_no))))
        order by b.mode,b.reference_code) worksheets,
      (select coalesce(jsonb_agg(jsonb_build_object('id',sf.id,'worksheet_id',sf.worksheet_id,'resource_kind',sf.resource_kind,
        'sequence_no',sf.sequence_no,'original_name',sf.original_name,'storage_path',sf.storage_path,'mime_type',sf.mime_type,
        'size_bytes',sf.size_bytes) order by sf.created_at),'[]'::jsonb)
       from public.subject_files sf where sf.subject_id=p_subject_id
         and (sf.sequence_no=b.unit_no or sf.worksheet_id in (select b2.id from base b2 where b2.unit_no=b.unit_no))) resources
    from base b group by b.unit_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'unlocked',u.unlocked,'open_at',u.open_at,
    'due_at',u.due_at,'worksheets',u.worksheets,'resources',u.resources) order by u.unit_no),'[]'::jsonb) into v_units from units u;
  return jsonb_build_object('subject',v_subject,'units',v_units,'server_time',clock_timestamp());
end $$;
revoke all on function public.admin_subject_unit_plan(uuid) from public,anon;
grant execute on function public.admin_subject_unit_plan(uuid) to authenticated;
notify pgrst, 'reload schema';
