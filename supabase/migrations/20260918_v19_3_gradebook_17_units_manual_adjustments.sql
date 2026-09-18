-- DOC-FULL-NR V19.3
-- Gradebook: fixed 17 official work units => 40 points, editable behavior,
-- midterm/final raw-score adjustments, and automatic vocational grade cut.

begin;

create table if not exists public.subject_score_adjustments_v193 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  midterm_delta numeric not null default 0,
  final_delta numeric not null default 0,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (subject_id,user_id),
  constraint subject_score_adjustments_v193_mid_chk check (midterm_delta between -1000 and 1000),
  constraint subject_score_adjustments_v193_final_chk check (final_delta between -1000 and 1000)
);

alter table public.subject_score_adjustments_v193 enable row level security;
revoke all on table public.subject_score_adjustments_v193 from public,anon,authenticated;
grant all on table public.subject_score_adjustments_v193 to service_role;

create or replace function public.admin_adjust_subject_scores_v193(
  p_subject_id uuid,
  p_user_id uuid,
  p_behavior_score numeric,
  p_midterm_delta numeric default 0,
  p_final_delta numeric default 0,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.subject_grade_settings%rowtype;
  v_behavior_max numeric := 20;
  v_mid_delta numeric := coalesce(p_midterm_delta,0);
  v_final_delta numeric := coalesce(p_final_delta,0);
begin
  if v_uid is null or not private.is_admin(v_uid) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_subject_id is null or p_user_id is null then
    raise exception 'SUBJECT_AND_USER_REQUIRED';
  end if;
  if not exists (
    select 1 from public.subject_enrollments
    where subject_id=p_subject_id and user_id=p_user_id and status='approved'
  ) then
    raise exception 'STUDENT_NOT_ENROLLED';
  end if;

  select * into v_cfg from public.subject_grade_settings where subject_id=p_subject_id;
  if v_cfg.subject_id is not null then
    v_behavior_max := coalesce(v_cfg.behavior_points,20);
  end if;

  if p_behavior_score is null or p_behavior_score < 0 or p_behavior_score > v_behavior_max then
    raise exception 'BEHAVIOR_SCORE_OUT_OF_RANGE';
  end if;
  if v_mid_delta < -1000 or v_mid_delta > 1000 or v_final_delta < -1000 or v_final_delta > 1000 then
    raise exception 'EXAM_ADJUSTMENT_OUT_OF_RANGE';
  end if;

  insert into public.subject_behavior_scores(subject_id,user_id,score,note,updated_by,updated_at)
  values(p_subject_id,p_user_id,p_behavior_score,p_note,v_uid,clock_timestamp())
  on conflict(subject_id,user_id) do update
    set score=excluded.score,
        note=excluded.note,
        updated_by=v_uid,
        updated_at=clock_timestamp();

  insert into public.subject_score_adjustments_v193(subject_id,user_id,midterm_delta,final_delta,note,updated_by,updated_at)
  values(p_subject_id,p_user_id,v_mid_delta,v_final_delta,p_note,v_uid,clock_timestamp())
  on conflict(subject_id,user_id) do update
    set midterm_delta=excluded.midterm_delta,
        final_delta=excluded.final_delta,
        note=excluded.note,
        updated_by=v_uid,
        updated_at=clock_timestamp();

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'ADJUST_SUBJECT_SCORES_V193','subject_enrollment',p_user_id::text,
    jsonb_build_object(
      'subject_id',p_subject_id,
      'behavior_score',p_behavior_score,
      'midterm_delta',v_mid_delta,
      'final_delta',v_final_delta,
      'note',p_note
    ));

  return jsonb_build_object('ok',true,'behavior_score',p_behavior_score,'midterm_delta',v_mid_delta,'final_delta',v_final_delta);
end;
$$;

revoke all on function public.admin_adjust_subject_scores_v193(uuid,uuid,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.admin_adjust_subject_scores_v193(uuid,uuid,numeric,numeric,numeric,text) to authenticated,service_role;

create or replace function public.admin_subject_gradebook_v193(p_subject_id uuid)
returns table(
  user_id uuid,
  student_code text,
  full_name text,
  grade_level text,
  room_label text,
  class_name text,
  assigned_work_count integer,
  completed_work_count integer,
  work_score numeric,
  behavior_score numeric,
  midterm_base_raw numeric,
  midterm_adjustment numeric,
  midterm_raw_score numeric,
  midterm_raw_max numeric,
  midterm_score numeric,
  final_base_raw numeric,
  final_adjustment numeric,
  final_raw_score numeric,
  final_raw_max numeric,
  final_score numeric,
  total_score numeric,
  work_points numeric,
  behavior_points numeric,
  midterm_points numeric,
  final_points numeric,
  midterm_exam_id uuid,
  final_exam_id uuid,
  grade_value numeric,
  pass_status text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  s public.subject_grade_settings%rowtype;
  v_mid uuid;
  v_final uuid;
  v_mid_full numeric := 20;
  v_final_full numeric := 20;
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into s from public.subject_grade_settings where subject_id=p_subject_id;
  if s.subject_id is null then
    s.subject_id:=p_subject_id;
    s.work_points:=40;
    s.behavior_points:=20;
    s.midterm_points:=20;
    s.final_points:=20;
    s.default_behavior_score:=20;
  end if;

  v_mid:=s.midterm_exam_id;
  v_final:=s.final_exam_id;
  if v_mid is null then
    select e.id into v_mid from public.exams e
    where e.subject_id=p_subject_id and e.exam_kind='midterm'
    order by e.published_at desc nulls last,e.created_at desc limit 1;
  end if;
  if v_final is null then
    select e.id into v_final from public.exams e
    where e.subject_id=p_subject_id and e.exam_kind='final'
    order by e.published_at desc nulls last,e.created_at desc limit 1;
  end if;
  select coalesce(e.full_score,20) into v_mid_full from public.exams e where e.id=v_mid;
  select coalesce(e.full_score,20) into v_final_full from public.exams e where e.id=v_final;
  v_mid_full:=coalesce(nullif(v_mid_full,0),20);
  v_final_full:=coalesce(nullif(v_final_full,0),20);

  return query
  with enrolled as (
    select p.id,p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name
    from public.subject_enrollments se
    join public.profiles p on p.id=se.user_id
    where se.subject_id=p_subject_id and se.status='approved'
  ), official_units as (
    select distinct
      (w.settings->>'sequence_no')::int unit_no,
      coalesce(nullif(w.settings->>'work_pair_key',''),nullif(w.settings->>'worksheet_pair_key',''),w.id::text) logical_key
    from public.worksheets w
    where w.subject_id=p_subject_id
      and (w.settings->>'sequence_no') ~ '^[0-9]+$'
      and (w.settings->>'sequence_no')::int between 1 and 17
      and not coalesce((w.settings->>'legacy_seed_archived')::boolean,false)
  ), unit_keys as (
    select unit_no,min(logical_key) logical_key
    from official_units group by unit_no
  ), raw as (
    select en.id learner_id,
           uk.unit_no,
           uk.logical_key,
           case when sub.status in ('submitted','confirmed','graded') then 1 else 0 end completed,
           case when sg.grading_status='final' and coalesce(sg.max_score,0)>0
                then least(1::numeric,greatest(0::numeric,sg.score/sg.max_score))
                else 0::numeric end grade_ratio,
           case when w.mode='paper' or coalesce(sub.is_late,false) then 0.50::numeric else 1.00::numeric end credit_factor
    from enrolled en
    cross join unit_keys uk
    left join public.worksheets w
      on w.subject_id=p_subject_id
     and coalesce(nullif(w.settings->>'work_pair_key',''),nullif(w.settings->>'worksheet_pair_key',''),w.id::text)=uk.logical_key
     and not coalesce((w.settings->>'legacy_seed_archived')::boolean,false)
    left join public.submissions sub on sub.worksheet_id=w.id and sub.user_id=en.id
    left join public.submission_grades sg on sg.submission_id=sub.id
  ), pairs as (
    select learner_id,unit_no,
           max(completed)::int completed,
           max(grade_ratio*credit_factor)::numeric earned_ratio
    from raw group by learner_id,unit_no
  ), works as (
    select en.id learner_id,
           17::int assigned_count,
           coalesce(sum(p.completed),0)::int completed_count,
           coalesce(sum(p.earned_ratio),0)::numeric earned_ratio_sum
    from enrolled en
    left join pairs p on p.learner_id=en.id
    group by en.id
  ), mid_base as (
    select en.id learner_id,
           coalesce(max(case when ea.grading_status='final' then ea.score end),0)::numeric base_score,
           coalesce(max(case when ea.grading_status='final' then ea.max_score end),v_mid_full)::numeric max_score
    from enrolled en
    left join public.exam_attempts ea on ea.user_id=en.id and ea.exam_id=v_mid
    group by en.id
  ), fin_base as (
    select en.id learner_id,
           coalesce(max(case when ea.grading_status='final' then ea.score end),0)::numeric base_score,
           coalesce(max(case when ea.grading_status='final' then ea.max_score end),v_final_full)::numeric max_score
    from enrolled en
    left join public.exam_attempts ea on ea.user_id=en.id and ea.exam_id=v_final
    group by en.id
  ), calc as (
    select en.id,en.student_code,en.full_name,en.grade_level,en.room_label,en.class_name,
      coalesce(wk.assigned_count,17) assigned_count,
      coalesce(wk.completed_count,0) completed_count,
      round(least(s.work_points,coalesce(wk.earned_ratio_sum,0)*s.work_points/17::numeric),2) work_score,
      round(coalesce(bs.score,s.default_behavior_score),2) behavior_score,
      round(coalesce(md.base_score,0),2) mid_base_raw,
      round(coalesce(adj.midterm_delta,0),2) mid_delta,
      round(least(greatest(coalesce(md.base_score,0)+coalesce(adj.midterm_delta,0),0),coalesce(nullif(md.max_score,0),v_mid_full)),2) mid_effective_raw,
      round(coalesce(nullif(md.max_score,0),v_mid_full),2) mid_max,
      round(case when coalesce(nullif(md.max_score,0),v_mid_full)>0
        then least(s.midterm_points,least(greatest(coalesce(md.base_score,0)+coalesce(adj.midterm_delta,0),0),coalesce(nullif(md.max_score,0),v_mid_full))*s.midterm_points/coalesce(nullif(md.max_score,0),v_mid_full)) else 0 end,2) mid_weighted,
      round(coalesce(fn.base_score,0),2) fin_base_raw,
      round(coalesce(adj.final_delta,0),2) fin_delta,
      round(least(greatest(coalesce(fn.base_score,0)+coalesce(adj.final_delta,0),0),coalesce(nullif(fn.max_score,0),v_final_full)),2) fin_effective_raw,
      round(coalesce(nullif(fn.max_score,0),v_final_full),2) fin_max,
      round(case when coalesce(nullif(fn.max_score,0),v_final_full)>0
        then least(s.final_points,least(greatest(coalesce(fn.base_score,0)+coalesce(adj.final_delta,0),0),coalesce(nullif(fn.max_score,0),v_final_full))*s.final_points/coalesce(nullif(fn.max_score,0),v_final_full)) else 0 end,2) fin_weighted
    from enrolled en
    left join works wk on wk.learner_id=en.id
    left join public.subject_behavior_scores bs on bs.subject_id=p_subject_id and bs.user_id=en.id
    left join public.subject_score_adjustments_v193 adj on adj.subject_id=p_subject_id and adj.user_id=en.id
    left join mid_base md on md.learner_id=en.id
    left join fin_base fn on fn.learner_id=en.id
  ), totals as (
    select c.*,
      round(c.work_score+c.behavior_score+c.mid_weighted+c.fin_weighted,2) total
    from calc c
  )
  select t.id,t.student_code,t.full_name,t.grade_level,t.room_label,t.class_name,
    t.assigned_count,t.completed_count,t.work_score,t.behavior_score,
    t.mid_base_raw,t.mid_delta,t.mid_effective_raw,t.mid_max,t.mid_weighted,
    t.fin_base_raw,t.fin_delta,t.fin_effective_raw,t.fin_max,t.fin_weighted,
    t.total,
    s.work_points,s.behavior_points,s.midterm_points,s.final_points,v_mid,v_final,
    case
      when t.total>=80 then 4.0
      when t.total>=75 then 3.5
      when t.total>=70 then 3.0
      when t.total>=65 then 2.5
      when t.total>=60 then 2.0
      when t.total>=55 then 1.5
      when t.total>=50 then 1.0
      else 0.0
    end::numeric as grade_value,
    case when t.total>=50 then 'ผ่าน' else 'ไม่ผ่าน' end::text as pass_status
  from totals t
  order by t.student_code nulls last,t.full_name;
end;
$$;

revoke all on function public.admin_subject_gradebook_v193(uuid) from public,anon;
grant execute on function public.admin_subject_gradebook_v193(uuid) to authenticated,service_role;

commit;
