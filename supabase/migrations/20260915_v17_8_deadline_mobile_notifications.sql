-- DOC-FULL-NR V17.8 deadline mobile notifications
-- Applied to Production project thjscmfqunlaqxlievna.
create table if not exists private.worksheet_notification_dispatch (
  user_id uuid not null references public.profiles(id) on delete cascade,
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('due_1h','due_now')),
  dispatched_at timestamptz not null default clock_timestamp(),
  primary key(user_id,worksheet_id,reminder_kind)
);

create or replace function public.dispatch_worksheet_deadline_notifications()
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_now timestamptz:=clock_timestamp();v_1h integer:=0;v_due integer:=0;
begin
  with candidates as (
    select a.user_id,w.id worksheet_id,w.subject_id,w.due_at,
      coalesce(nullif(w.settings->>'unit_topic',''),w.title) unit_topic,
      coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text) pair_key,
      s.code subject_code,s.name subject_name
    from public.worksheet_assignments a
    join public.worksheets w on w.id=a.worksheet_id and w.mode='digital' and w.status='published'
    join public.subjects s on s.id=w.subject_id and s.active=true and s.subject_type='subject'
    join public.subject_enrollments se on se.subject_id=w.subject_id and se.user_id=a.user_id and se.status='approved'
    join public.profiles p on p.id=a.user_id and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
    where w.due_at is not null and w.due_at>v_now and w.due_at<=v_now+interval '1 hour'
      and not exists(select 1 from public.submissions sub join public.worksheets sw on sw.id=sub.worksheet_id
        where sub.user_id=a.user_id and coalesce(nullif(sw.settings->>'work_pair_key',''),sw.id::text)=coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text)
          and sub.status in ('submitted','confirmed','graded'))
  ), claimed as (
    insert into private.worksheet_notification_dispatch(user_id,worksheet_id,reminder_kind)
    select user_id,worksheet_id,'due_1h' from candidates on conflict do nothing returning user_id,worksheet_id
  ), inserted as (
    insert into public.app_notifications(user_id,type,title,message,metadata)
    select c.user_id,'worksheet_due_1h','⏰ เหลือเวลาส่งงานอีก 1 ชั่วโมง',
      format('%s %s • %s • กรุณาส่งใบงานออนไลน์ก่อนหมดเวลา',c.subject_code,c.subject_name,c.unit_topic),
      jsonb_build_object('worksheet_id',c.worksheet_id,'subject_id',c.subject_id,'subject_code',c.subject_code,'unit_topic',c.unit_topic,'due_at',c.due_at,'route','work','urgency','high','reminder_kind','due_1h')
    from candidates c join claimed x using(user_id,worksheet_id) returning 1
  ) select count(*) into v_1h from inserted;

  with candidates as (
    select a.user_id,w.id worksheet_id,w.subject_id,w.due_at,
      coalesce(nullif(w.settings->>'unit_topic',''),w.title) unit_topic,
      coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text) pair_key,
      s.code subject_code,s.name subject_name
    from public.worksheet_assignments a
    join public.worksheets w on w.id=a.worksheet_id and w.mode='digital' and w.status='published'
    join public.subjects s on s.id=w.subject_id and s.active=true and s.subject_type='subject'
    join public.subject_enrollments se on se.subject_id=w.subject_id and se.user_id=a.user_id and se.status='approved'
    join public.profiles p on p.id=a.user_id and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
    where w.due_at is not null and w.due_at<=v_now and w.due_at>v_now-interval '2 hours'
      and not exists(select 1 from public.submissions sub join public.worksheets sw on sw.id=sub.worksheet_id
        where sub.user_id=a.user_id and coalesce(nullif(sw.settings->>'work_pair_key',''),sw.id::text)=coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text)
          and sub.status in ('submitted','confirmed','graded'))
  ), claimed as (
    insert into private.worksheet_notification_dispatch(user_id,worksheet_id,reminder_kind)
    select user_id,worksheet_id,'due_now' from candidates on conflict do nothing returning user_id,worksheet_id
  ), inserted as (
    insert into public.app_notifications(user_id,type,title,message,metadata)
    select c.user_id,'worksheet_due_now','🚨 หมดเวลาส่งใบงานออนไลน์แล้ว',
      format('%s %s • %s • หากยังไม่ได้ส่ง ให้พิมพ์ใบงานย้อนหลังและนำส่งผู้สอน',c.subject_code,c.subject_name,c.unit_topic),
      jsonb_build_object('worksheet_id',c.worksheet_id,'subject_id',c.subject_id,'subject_code',c.subject_code,'unit_topic',c.unit_topic,'due_at',c.due_at,'route','work','urgency','critical','reminder_kind','due_now')
    from candidates c join claimed x using(user_id,worksheet_id) returning 1
  ) select count(*) into v_due from inserted;
  return jsonb_build_object('ok',true,'server_time',v_now,'due_1h_notifications',v_1h,'due_now_notifications',v_due);
end $$;
revoke all on function public.dispatch_worksheet_deadline_notifications() from public,anon,authenticated;

create or replace function public.my_pending_deadline_notifications()
returns jsonb language sql stable security definer set search_path=public,private,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'type',n.type,'title',n.title,'message',n.message,'metadata',n.metadata,'created_at',n.created_at) order by n.created_at desc),'[]'::jsonb)
 from public.app_notifications n where n.user_id=auth.uid() and n.type in ('worksheet_due_1h','worksheet_due_now') and n.created_at>=clock_timestamp()-interval '24 hours';
$$;
revoke all on function public.my_pending_deadline_notifications() from public,anon;
grant execute on function public.my_pending_deadline_notifications() to authenticated;

do $$ declare j record; begin
 for j in select jobid from cron.job where jobname='docfullnr-worksheet-deadline-reminders' loop perform cron.unschedule(j.jobid); end loop;
 perform cron.schedule('docfullnr-worksheet-deadline-reminders','* * * * *','select public.dispatch_worksheet_deadline_notifications();');
end $$;
notify pgrst,'reload schema';
