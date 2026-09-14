-- DOC-FULL-NR V16 FINAL
-- Additive production delta. It deliberately preserves all existing users, 198 templates,
-- submissions, grades, attendance, enrollments and files.
-- V15 already owns subject_grade_settings, subject_behavior_scores, paper_scans and
-- admin_subject_gradebook/admin_record_paper_scan. V16 integrates those capabilities
-- into Subject Rooms and adds the exam-bank/anti-cheat helpers below.

alter table public.exams add column if not exists exam_kind text not null default 'practice';
alter table public.exams add column if not exists full_score numeric not null default 20;
alter table public.exams add column if not exists question_count_target integer not null default 50;
alter table public.exams add column if not exists anti_cheat_enabled boolean not null default true;
alter table public.exams add column if not exists require_fullscreen boolean not null default true;
alter table public.exams add column if not exists violation_limit integer not null default 0;

alter table public.exam_attempts add column if not exists correct_count integer;
alter table public.exam_attempts add column if not exists violation_count integer not null default 0;
alter table public.exam_attempts add column if not exists tab_switch_count integer not null default 0;
alter table public.exam_attempts add column if not exists fullscreen_exit_count integer not null default 0;
alter table public.exam_attempts add column if not exists copy_paste_count integer not null default 0;
alter table public.exam_attempts add column if not exists context_menu_count integer not null default 0;
alter table public.exam_attempts add column if not exists print_attempt_count integer not null default 0;

create table if not exists public.exam_question_bank (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  source_key text unique,
  prompt text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  difficulty text,
  theme text,
  tags jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint exam_question_bank_four_options_v16 check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4)
);
alter table public.exam_question_bank enable row level security;
drop policy if exists exam_question_bank_admin_all on public.exam_question_bank;
create policy exam_question_bank_admin_all on public.exam_question_bank for all to authenticated using(private.is_admin()) with check(private.is_admin());

create or replace function public.admin_upsert_exam_question(
  p_id uuid,p_subject_id uuid,p_prompt text,p_options jsonb,p_correct_answer text,
  p_explanation text default null,p_difficulty text default null,p_theme text default null,p_active boolean default true
) returns uuid language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_id uuid; begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_prompt,'')),'') is null then raise exception 'QUESTION_REQUIRED'; end if;
  if jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options)<>4 then raise exception 'FOUR_OPTIONS_REQUIRED'; end if;
  if not exists(select 1 from jsonb_array_elements_text(p_options) o where o=trim(coalesce(p_correct_answer,''))) then raise exception 'CORRECT_ANSWER_NOT_IN_OPTIONS'; end if;
  if p_id is null then
    insert into public.exam_question_bank(subject_id,prompt,options,correct_answer,explanation,difficulty,theme,active,created_by,updated_at)
    values(p_subject_id,trim(p_prompt),p_options,trim(p_correct_answer),nullif(trim(coalesce(p_explanation,'')),''),nullif(trim(coalesce(p_difficulty,'')),''),nullif(trim(coalesce(p_theme,'')),''),coalesce(p_active,true),auth.uid(),clock_timestamp()) returning id into v_id;
  else
    update public.exam_question_bank set subject_id=p_subject_id,prompt=trim(p_prompt),options=p_options,correct_answer=trim(p_correct_answer),explanation=nullif(trim(coalesce(p_explanation,'')),''),difficulty=nullif(trim(coalesce(p_difficulty,'')),''),theme=nullif(trim(coalesce(p_theme,'')),''),active=coalesce(p_active,true),updated_at=clock_timestamp() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_id is null then 'CREATE_EXAM_BANK_QUESTION' else 'UPDATE_EXAM_BANK_QUESTION' end,'exam_question_bank',v_id::text,jsonb_build_object('subject_id',p_subject_id));
  return v_id;
end $$;

create or replace function public.admin_delete_exam_question(p_id uuid) returns void language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.exam_question_bank set active=false,updated_at=clock_timestamp() where id=p_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'DEACTIVATE_EXAM_BANK_QUESTION','exam_question_bank',p_id::text,'{}'::jsonb);
end $$;

create or replace function public.admin_create_exam_from_bank(p_subject_id uuid,p_title text,p_exam_kind text,p_open_at timestamptz default null,p_due_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_exam uuid;v_count int;v_questions jsonb;v_key jsonb;begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_exam_kind not in ('midterm','final','practice') then raise exception 'INVALID_EXAM_KIND'; end if;
  if p_open_at is not null and p_due_at is not null and p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  select count(*) into v_count from public.exam_question_bank where subject_id=p_subject_id and active;
  if v_count<50 then raise exception 'QUESTION_BANK_NEEDS_50'; end if;
  with picked as (select * from public.exam_question_bank where subject_id=p_subject_id and active order by random() limit 50)
  select jsonb_agg(jsonb_build_object('id',id::text,'type','mcq','prompt',prompt,'options',options,'points',0.4,'required',true)),jsonb_object_agg(id::text,to_jsonb(correct_answer)) into v_questions,v_key from picked;
  insert into public.exams(subject_id,title,status,open_at,due_at,duration_minutes,max_attempts,shuffle_questions,shuffle_options,questions,created_by,exam_kind,full_score,question_count_target,anti_cheat_enabled,require_fullscreen,settings)
  values(p_subject_id,trim(p_title),'draft',p_open_at,p_due_at,75,1,true,true,v_questions,auth.uid(),p_exam_kind,20,50,true,true,jsonb_build_object('source','question_bank','student_score_visible',false,'score_formula','correct*20/50')) returning id into v_exam;
  insert into public.exam_answer_keys(exam_id,answer_key,rubric,updated_by,updated_at) values(v_exam,v_key,jsonb_build_object('question_count',50,'full_score',20),auth.uid(),clock_timestamp());
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CREATE_EXAM_FROM_BANK','exam',v_exam::text,jsonb_build_object('subject_id',p_subject_id,'kind',p_exam_kind,'questions',50,'duration_minutes',75,'full_score',20));
  return v_exam;
end $$;

create or replace function public.record_exam_violation(p_attempt_id uuid,p_event text) returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_total int;begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event not in ('tab_switch','fullscreen_exit','copy','paste','cut','contextmenu','print') then raise exception 'INVALID_EVENT'; end if;
  update public.exam_attempts set violation_count=violation_count+1,tab_switch_count=tab_switch_count+case when p_event='tab_switch' then 1 else 0 end,fullscreen_exit_count=fullscreen_exit_count+case when p_event='fullscreen_exit' then 1 else 0 end,copy_paste_count=copy_paste_count+case when p_event in ('copy','paste','cut') then 1 else 0 end,context_menu_count=context_menu_count+case when p_event='contextmenu' then 1 else 0 end,print_attempt_count=print_attempt_count+case when p_event='print' then 1 else 0 end,updated_at=clock_timestamp() where id=p_attempt_id and user_id=v_uid and status='draft' returning violation_count into v_total;
  if v_total is null then raise exception 'ATTEMPT_NOT_ACTIVE'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'EXAM_VIOLATION','exam_attempt',p_attempt_id::text,jsonb_build_object('event',p_event,'count',v_total));
  return jsonb_build_object('ok',true,'violation_count',v_total);
end $$;

create or replace function public.admin_reset_exam_user(p_exam_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  delete from public.exam_attempts where exam_id=p_exam_id and user_id=p_user_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'RESET_EXAM_USER','exam',p_exam_id::text,jsonb_build_object('user_id',p_user_id));
end $$;

create or replace function public.admin_delete_exam(p_exam_id uuid) returns void language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  delete from public.exams where id=p_exam_id;
  if not found then raise exception 'EXAM_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'DELETE_EXAM','exam',p_exam_id::text,'{}'::jsonb);
end $$;

do $$ begin
  begin alter publication supabase_realtime add table public.exams; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.exam_assignments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.worksheets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.subject_grade_settings; exception when duplicate_object then null; end;
end $$;

grant execute on function public.admin_upsert_exam_question(uuid,uuid,text,jsonb,text,text,text,text,boolean) to authenticated;
grant execute on function public.admin_delete_exam_question(uuid) to authenticated;
grant execute on function public.admin_create_exam_from_bank(uuid,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.record_exam_violation(uuid,text) to authenticated;
grant execute on function public.admin_reset_exam_user(uuid,uuid) to authenticated;
grant execute on function public.admin_delete_exam(uuid) to authenticated;
