-- DOC-FULL-NR V19.5
-- Ready-made exam preset: 25 course-reference questions + 25 very-hard analytical questions.
-- Keeps 50 MCQ / 4 choices / 75 minutes / 20 points and hides score/answer key from students.

begin;

-- Make the existing 25 hard questions genuinely discriminating by removing
-- answer-choice giveaway wording and strengthening the scenario framing.
update public.exam_question_bank q
set prompt = replace(
      q.prompt,
      'โดยมีข้อจำกัดว่าควรเลือกวิธีที่ตรงกับเป้าหมายและไม่เพิ่มขั้นตอนเกินจำเป็น ข้อใดให้เหตุผลเหมาะสมที่สุด?',
      'โดยมีหลายแนวทางที่ดูสมเหตุผลใกล้เคียงกัน ผู้สอบต้องวิเคราะห์เป้าหมาย ข้อจำกัด ผลกระทบ และความเหมาะสมของหลักการร่วมกัน ข้อใดเป็นการตัดสินใจที่เหมาะสมที่สุด?'
    ),
    options = (
      select jsonb_agg(
        to_jsonb(
          replace(
            replace(e.value #>> '{}',' และตอบเป้าหมายของสถานการณ์โดยตรง',''),
            ' แต่เหมาะกับเป้าหมายอีกลักษณะหนึ่ง',''
          )
        ) order by e.ord
      )
      from jsonb_array_elements(q.options) with ordinality as e(value,ord)
    ),
    correct_answer = replace(replace(q.correct_answer,' และตอบเป้าหมายของสถานการณ์โดยตรง',''),' แต่เหมาะกับเป้าหมายอีกลักษณะหนึ่ง',''),
    explanation = case
      when q.explanation is null then null
      when q.explanation like 'วิเคราะห์เชิงเหตุผล:%' then q.explanation
      else 'วิเคราะห์เชิงเหตุผล: ' || replace(q.explanation,' ซึ่งสัมพันธ์โดยตรงกับ',' โดยพิจารณาความสอดคล้องกับ')
    end,
    tags = coalesce(q.tags,'[]'::jsonb) || '["analysis","very-hard","preset-v19.5"]'::jsonb,
    updated_at = clock_timestamp()
where q.active=true and lower(coalesce(q.difficulty,''))='hard';

update public.exam_question_bank q
set tags = coalesce(q.tags,'[]'::jsonb) || '["course-core","preset-v19.5"]'::jsonb,
    updated_at = clock_timestamp()
where q.active=true and lower(coalesce(q.difficulty,'')) in ('basic','easy');

create or replace function public.admin_create_exam_preset_v195(
  p_subject_id uuid,
  p_exam_kind text,
  p_title text,
  p_open_at timestamptz,
  p_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_exam uuid;
  v_questions jsonb:='[]'::jsonb;
  v_key jsonb:='{}'::jsonb;
  v_count int;
  v_subject public.subjects%rowtype;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_exam_kind not in ('midterm','final','practice') then raise exception 'INVALID_EXAM_KIND'; end if;
  if p_open_at is null or p_due_at is null or p_due_at<=p_open_at then raise exception 'INVALID_EXAM_WINDOW'; end if;

  select * into v_subject from public.subjects
  where id=p_subject_id and active=true and subject_type='subject';
  if v_subject.id is null then raise exception 'SUBJECT_NOT_FOUND'; end if;

  with basic_pick as (
    select * from public.exam_question_bank
    where subject_id=p_subject_id and active=true and lower(coalesce(difficulty,''))='basic'
    order by random() limit 10
  ), easy_pick as (
    select * from public.exam_question_bank
    where subject_id=p_subject_id and active=true and lower(coalesce(difficulty,''))='easy'
    order by random() limit 15
  ), core_pick as (
    select * from basic_pick union all select * from easy_pick
  ), core_numbered as (
    select c.*,row_number() over(order by random())::int as section_no from core_pick c
  ), analysis_pick as (
    select * from public.exam_question_bank
    where subject_id=p_subject_id and active=true and lower(coalesce(difficulty,''))='hard'
    order by random() limit 25
  ), analysis_numbered as (
    select a.*,row_number() over(order by random())::int as section_no from analysis_pick a
  ), numbered as (
    select c.*,c.section_no as n,'course'::text as section,'เนื้อหาจากรายวิชา'::text as section_label from core_numbered c
    union all
    select a.*,(a.section_no+25) as n,'analysis'::text as section,'วิเคราะห์และแยกแยะระดับยากมาก'::text as section_label from analysis_numbered a
  )
  select count(*),
    coalesce(jsonb_agg(jsonb_build_object(
      'id',source_key,
      'type','mcq',
      'prompt',prompt,
      'text',prompt,
      'options',options,
      'order',n,
      'section',section,
      'section_label',section_label,
      'difficulty',difficulty
    ) order by n),'[]'::jsonb),
    coalesce(jsonb_object_agg(source_key,correct_answer),'{}'::jsonb)
  into v_count,v_questions,v_key
  from numbered;

  if v_count<>50 then raise exception 'QUESTION_BANK_PRESET_25_25_NOT_READY'; end if;
  perform private.assert_exam_questions_safe_v18(v_questions);

  insert into public.exams(
    subject_id,title,description,instructions,status,open_at,due_at,duration_minutes,max_attempts,
    shuffle_questions,shuffle_options,questions,created_by,published_at,settings,exam_kind,full_score,
    question_count_target,anti_cheat_enabled,require_fullscreen,violation_limit
  ) values(
    p_subject_id,
    coalesce(nullif(trim(p_title),''),case p_exam_kind when 'midterm' then 'สอบกลางภาค' when 'final' then 'สอบปลายภาค' else 'แบบทดสอบ' end)||' • '||v_subject.code,
    format('ชุดสอบสำเร็จรูป %s: 25 ข้ออ้างอิงรายวิชา + 25 ข้อวิเคราะห์ระดับยากมาก',v_subject.name),
    'ส่วนที่ 1 ข้อ 1-25 เนื้อหาจากรายวิชา • ส่วนที่ 2 ข้อ 26-50 วิเคราะห์และแยกแยะระดับยากมาก • 75 นาที • คะแนนเต็ม 20',
    'draft',p_open_at,p_due_at,75,2,
    false,true,v_questions,v_uid,null,
    jsonb_build_object(
      'source','DOC-FULL-NR V19.5 READY-MADE EXAM PRESET',
      'preset','25_course_25_analysis_very_hard',
      'section_distribution',jsonb_build_object('course',25,'analysis',25),
      'legacy_distribution',jsonb_build_object('basic',10,'easy',15,'hard',25),
      'student_score_visible',false,
      'answer_review_enabled',false,
      'copy_paste_allowed',false,
      'attempts_per_entitlement',2,
      'pass_score',10
    ),
    p_exam_kind,20,50,true,true,0
  ) returning id into v_exam;

  insert into public.exam_answer_keys(exam_id,answer_key,rubric,updated_by,updated_at)
  values(v_exam,v_key,jsonb_build_object(
    'formula','correct_count*20/50',
    'full_score',20,
    'question_count',50,
    'course_questions',25,
    'analysis_questions',25
  ),v_uid,clock_timestamp());

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'CREATE_READY_EXAM_PRESET_V195','exam',v_exam::text,
    jsonb_build_object('subject_id',p_subject_id,'kind',p_exam_kind,'questions',50,'course',25,'analysis',25));

  return jsonb_build_object(
    'ok',true,'exam_id',v_exam,'questions',50,'duration_minutes',75,'full_score',20,
    'course_questions',25,'analysis_questions',25,'analysis_level','very-hard','status','draft'
  );
end;
$$;

revoke all on function public.admin_create_exam_preset_v195(uuid,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_create_exam_preset_v195(uuid,text,text,timestamptz,timestamptz) to authenticated,service_role;

commit;
