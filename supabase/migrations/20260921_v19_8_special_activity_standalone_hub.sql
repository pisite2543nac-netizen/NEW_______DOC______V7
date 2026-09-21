begin;

create or replace function public.programming_activity_leaderboard_v197(
  p_subject_id uuid,
  p_scope text default 'class'
)
returns table(
  rank_no bigint,
  user_id uuid,
  student_code text,
  full_name text,
  class_name text,
  rating numeric,
  tier text,
  completed_stages integer,
  best_wpm numeric,
  avg_accuracy numeric
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_class text;
  cfg public.programming_activity_settings_v197%rowtype;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
  if cfg.subject_id is null or not cfg.enabled or not cfg.leaderboard_enabled then raise exception 'PROGRAMMING_RANKING_DISABLED'; end if;
  if p_scope not in ('class','overall') then raise exception 'PROGRAMMING_LEADERBOARD_SCOPE_INVALID'; end if;
  select p.class_name into v_class from public.profiles p where p.id=v_uid;
  return query
  with members as (
    select p.id,p.student_code,p.full_name,p.class_name
    from public.profiles p
    where p.role='user' and p.active=true and p.approval_status='approved'
      and coalesce(p.academic_status,'studying')='studying'
      and (p_scope='overall' or p.class_name is not distinct from v_class)
  ), rated as (
    select m.*,r.j,(r.j->>'rating')::numeric rr,(r.j->>'completed_stages')::int cc,
      (r.j->>'best_wpm')::numeric bw,(r.j->>'avg_accuracy')::numeric aa,r.j->>'tier' tt
    from members m cross join lateral (select private.programming_activity_rating_v197(p_subject_id,m.id) j) r
  )
  select row_number() over(order by rated.rr desc,rated.cc desc,rated.bw desc,rated.student_code nulls last),
    rated.id,rated.student_code,rated.full_name,rated.class_name,round(rated.rr,1),rated.tt,rated.cc,round(rated.bw,1),round(rated.aa,1)
  from rated order by rated.rr desc,rated.cc desc,rated.bw desc,rated.student_code nulls last limit 200;
end
$$;

revoke all on function public.programming_activity_leaderboard_v197(uuid,text) from public,anon;
grant execute on function public.programming_activity_leaderboard_v197(uuid,text) to authenticated,service_role;

create or replace function public.admin_programming_activity_dashboard_v197(p_subject_id uuid)
returns table(
  user_id uuid, student_code text, full_name text, class_name text,
  completed_stages integer, html_best_stage integer, python_best_stage integer,
  total_attempts integer, best_wpm numeric, avg_accuracy numeric, rating numeric,
  tier text, tokens integer, official_completed integer, official_score numeric,
  official_submitted boolean, focus_today_seconds integer
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.subjects sb where sb.id=p_subject_id and sb.code='21910-2010' and sb.active=true and sb.subject_type='subject') then raise exception 'PROGRAMMING_SUBJECT_REQUIRED'; end if;
  return query
  with members as (
    select p.id,p.student_code,p.full_name,p.class_name
    from public.profiles p
    where p.role='user' and p.active=true and p.approval_status='approved'
      and coalesce(p.academic_status,'studying')='studying'
  ), stats as (
    select m.*,
      coalesce((select count(distinct a.stage_id)::int from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id and a.passed),0) completed,
      coalesce((select max(ps.stage_no) from public.programming_activity_attempts_v197 a join public.programming_activity_stages_v197 ps on ps.id=a.stage_id where a.subject_id=p_subject_id and a.user_id=m.id and a.passed and ps.language='html'),0) html_stage,
      coalesce((select max(ps.stage_no) from public.programming_activity_attempts_v197 a join public.programming_activity_stages_v197 ps on ps.id=a.stage_id where a.subject_id=p_subject_id and a.user_id=m.id and a.passed and ps.language='python'),0) python_stage,
      coalesce((select count(*)::int from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0) attempts,
      coalesce((select max(a.wpm) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0) bw,
      coalesce((select avg(a.accuracy) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0) aa,
      private.programming_activity_rating_v197(p_subject_id,m.id) rj,
      coalesce((select w.tokens from public.programming_activity_wallets_v197 w where w.subject_id=p_subject_id and w.user_id=m.id),0) tok,
      coalesce((select count(*)::int from public.programming_activity_official_results_v197 r where r.subject_id=p_subject_id and r.user_id=m.id),0) offc,
      coalesce((select sum(r.best_score) from public.programming_activity_official_results_v197 r where r.subject_id=p_subject_id and r.user_id=m.id),0) offs,
      exists(select 1 from public.programming_activity_official_submissions_v197 os where os.subject_id=p_subject_id and os.user_id=m.id) offsub,
      coalesce((select f.seconds_active from public.programming_activity_focus_v197 f where f.subject_id=p_subject_id and f.user_id=m.id and f.focus_date=timezone('Asia/Bangkok',clock_timestamp())::date),0) foc
    from members m
  )
  select stt.id,stt.student_code,stt.full_name,stt.class_name,stt.completed,stt.html_stage,stt.python_stage,stt.attempts,
    round(stt.bw,1),round(stt.aa,1),round((stt.rj->>'rating')::numeric,1),stt.rj->>'tier',stt.tok,stt.offc,round(stt.offs,2),stt.offsub,stt.foc
  from stats stt order by stt.student_code nulls last,stt.full_name;
end
$$;

revoke all on function public.admin_programming_activity_dashboard_v197(uuid) from public,anon;
grant execute on function public.admin_programming_activity_dashboard_v197(uuid) to authenticated,service_role;

commit;
