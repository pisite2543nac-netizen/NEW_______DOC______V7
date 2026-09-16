-- DOC-FULL-NR V17.6: one Digital/Paper pair = one logical work item.
-- Paper/late completion is capped at 0.50 work credit.
create or replace function public.admin_subject_gradebook(p_subject_id uuid)
returns table(user_id uuid, student_code text, full_name text, grade_level text, room_label text, class_name text, assigned_work_count integer, completed_work_count integer, work_score numeric, behavior_score numeric, midterm_score numeric, final_score numeric, total_score numeric, work_points numeric, behavior_points numeric, midterm_points numeric, final_points numeric, midterm_exam_id uuid, final_exam_id uuid)
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare s public.subject_grade_settings%rowtype;v_mid uuid;v_final uuid;
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  select * into s from public.subject_grade_settings where subject_id=p_subject_id;
  if s.subject_id is null then s.subject_id:=p_subject_id;s.work_points:=40;s.behavior_points:=20;s.midterm_points:=20;s.final_points:=20;s.default_behavior_score:=20; end if;
  v_mid:=s.midterm_exam_id;v_final:=s.final_exam_id;
  if v_mid is null then select e0.id into v_mid from public.exams e0 where e0.subject_id=p_subject_id and e0.exam_kind='midterm' order by e0.published_at desc nulls last,e0.created_at desc limit 1; end if;
  if v_final is null then select e0.id into v_final from public.exams e0 where e0.subject_id=p_subject_id and e0.exam_kind='final' order by e0.published_at desc nulls last,e0.created_at desc limit 1; end if;
  return query
  with enrolled as (
    select p.id,p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name from public.subject_enrollments se join public.profiles p on p.id=se.user_id where se.subject_id=p_subject_id and se.status='approved'
  ),raw_items as (
    select en.id learner_id,coalesce(nullif(ws.settings->>'work_pair_key',''),ws.id::text) logical_key,ws.id worksheet_id,ws.mode,ws.due_at,sub.status,
      coalesce(sub.submitted_at,sub.confirmed_at,sub.updated_at) completed_at,
      case when sub.status in ('submitted','confirmed','graded') then 1 else 0 end::int completed,
      case when sub.status in ('submitted','confirmed','graded') then
        case when ws.mode='paper' or coalesce(sub.is_late,false)=true or (ws.due_at is not null and coalesce(sub.submitted_at,sub.confirmed_at,sub.updated_at)>ws.due_at)
          then least(0.50::numeric,coalesce(ovf.factor,0.50::numeric)) else coalesce(ovf.factor,1.0::numeric) end
        else 0::numeric end factor
    from enrolled en
    join public.worksheet_assignments wa on wa.user_id=en.id
    join public.worksheets ws on ws.id=wa.worksheet_id and ws.subject_id=p_subject_id
    left join public.submissions sub on sub.worksheet_id=ws.id and sub.user_id=en.id
    left join lateral (
      select min(coalesce(ov.credit_factor,1.0))::numeric factor from public.submission_overrides ov
      where ov.user_id=en.id and ov.worksheet_id=wa.worksheet_id and sub.id is not null
        and ov.created_at<=coalesce(sub.submitted_at,sub.confirmed_at,sub.updated_at)
        and (ov.revoked_at is null or ov.revoked_at>=coalesce(sub.submitted_at,sub.confirmed_at,sub.updated_at))
        and (ov.expires_at is null or ov.expires_at>=coalesce(sub.submitted_at,sub.confirmed_at,sub.updated_at))
    ) ovf on true
  ),pair_items as (
    select learner_id,logical_key,max(completed)::int completed,max(case when completed=1 then factor else 0 end)::numeric earned_factor from raw_items group by learner_id,logical_key
  ),works as (
    select learner_id,count(*)::int assigned_count,sum(completed)::int completed_count,sum(earned_factor)::numeric earned_units from pair_items group by learner_id
  ),mid as (
    select en.id learner_id,max(case when ea.grading_status='final' then ea.score end) score,max(case when ea.grading_status='final' then ea.max_score end) max_score from enrolled en left join public.exam_attempts ea on ea.user_id=en.id and ea.exam_id=v_mid group by en.id
  ),fin as (
    select en.id learner_id,max(case when ea.grading_status='final' then ea.score end) score,max(case when ea.grading_status='final' then ea.max_score end) max_score from enrolled en left join public.exam_attempts ea on ea.user_id=en.id and ea.exam_id=v_final group by en.id
  )
  select en.id,en.student_code,en.full_name,en.grade_level,en.room_label,en.class_name,coalesce(wk.assigned_count,0),coalesce(wk.completed_count,0),
    round(case when coalesce(wk.assigned_count,0)>0 then least(s.work_points,coalesce(wk.earned_units,0)*s.work_points/wk.assigned_count::numeric) else 0 end,2),
    round(coalesce(bs.score,s.default_behavior_score),2),
    round(case when coalesce(md.max_score,0)>0 then least(s.midterm_points,coalesce(md.score,0)*s.midterm_points/md.max_score) else 0 end,2),
    round(case when coalesce(fn.max_score,0)>0 then least(s.final_points,coalesce(fn.score,0)*s.final_points/fn.max_score) else 0 end,2),
    round((case when coalesce(wk.assigned_count,0)>0 then least(s.work_points,coalesce(wk.earned_units,0)*s.work_points/wk.assigned_count::numeric) else 0 end)+coalesce(bs.score,s.default_behavior_score)+(case when coalesce(md.max_score,0)>0 then least(s.midterm_points,coalesce(md.score,0)*s.midterm_points/md.max_score) else 0 end)+(case when coalesce(fn.max_score,0)>0 then least(s.final_points,coalesce(fn.score,0)*s.final_points/fn.max_score) else 0 end),2),
    s.work_points,s.behavior_points,s.midterm_points,s.final_points,v_mid,v_final
  from enrolled en left join works wk on wk.learner_id=en.id left join public.subject_behavior_scores bs on bs.subject_id=p_subject_id and bs.user_id=en.id left join mid md on md.learner_id=en.id left join fin fn on fn.learner_id=en.id order by en.student_code nulls last,en.full_name;
end $$;
revoke all on function public.admin_subject_gradebook(uuid) from public,anon;
grant execute on function public.admin_subject_gradebook(uuid) to authenticated;
