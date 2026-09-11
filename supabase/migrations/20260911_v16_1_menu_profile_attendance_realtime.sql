-- DOC-FULL-NR V16.1
-- Read-only student profile, in-app notifications, 15-minute attendance window,
-- manual/automatic summary, Admin-only late check-in after the window.

alter table public.attendance_sessions
  add column if not exists auto_close_at timestamptz,
  add column if not exists summary_submitted_at timestamptz,
  add column if not exists summary_submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists close_reason text,
  add column if not exists summary jsonb not null default '{}'::jsonb;

update public.attendance_sessions
set auto_close_at=started_at+make_interval(mins=>greatest(coalesce(late_after_minutes,15),0))
where auto_close_at is null and status='open';

create table if not exists public.app_notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,title text not null,message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create index if not exists app_notifications_user_created_idx on public.app_notifications(user_id,created_at desc);
create index if not exists app_notifications_unread_idx on public.app_notifications(user_id,created_at desc) where read_at is null;
alter table public.app_notifications enable row level security;
drop policy if exists app_notifications_read on public.app_notifications;
create policy app_notifications_read on public.app_notifications for select using(user_id=auth.uid() or private.is_admin());

drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only on public.profiles for update using(private.is_admin()) with check(private.is_admin());

create or replace function private.push_app_notification(p_user_id uuid,p_type text,p_title text,p_message text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_id uuid; begin
  if p_user_id is null then return null; end if;
  insert into public.app_notifications(user_id,type,title,message,metadata)
  values(p_user_id,p_type,p_title,p_message,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;$$;
revoke all on function private.push_app_notification(uuid,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.app_notifications set read_at=clock_timestamp() where id=p_notification_id and user_id=v_uid;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok',true,'notification_id',p_notification_id);
end;$$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function private.finalize_attendance_session_internal(p_session_id uuid,p_actor uuid default null,p_reason text default 'manual')
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare s public.attendance_sessions%rowtype;v_absent integer:=0;v_expected integer:=0;v_present integer:=0;v_late integer:=0;v_absent_total integer:=0;v_excused integer:=0;v_summary jsonb;v_subject text;v_class text;v_date text;a record;
begin
  select * into s from public.attendance_sessions where id=p_session_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.status='closed' then return jsonb_build_object('ok',true,'already_closed',true,'session_id',s.id,'summary',s.summary,'closed_at',s.closed_at,'close_reason',s.close_reason); end if;
  insert into public.attendance_records(session_id,user_id,status,scanned_at,scanned_by,note,updated_at)
  select s.id,m.user_id,'absent',null,p_actor,'ไม่พบการเช็คชื่อภายในเวลาที่กำหนด',clock_timestamp()
  from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved'
  join public.subject_enrollments e on e.user_id=m.user_id and e.subject_id=s.subject_id and e.status='approved'
  where m.classroom_id=s.classroom_id and m.active on conflict(session_id,user_id) do nothing;
  get diagnostics v_absent=row_count;
  select count(*) into v_expected from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved'
  join public.subject_enrollments e on e.user_id=m.user_id and e.subject_id=s.subject_id and e.status='approved' where m.classroom_id=s.classroom_id and m.active;
  select count(*) filter(where status='present'),count(*) filter(where status='late'),count(*) filter(where status='absent'),count(*) filter(where status='excused')
    into v_present,v_late,v_absent_total,v_excused from public.attendance_records where session_id=s.id;
  select coalesce(sub.code||' '||sub.name,'รายวิชา'),coalesce(c.name,'ห้องเรียน'),to_char(s.session_date,'DD/MM/YYYY') into v_subject,v_class,v_date
  from public.subjects sub,public.classrooms c where sub.id=s.subject_id and c.id=s.classroom_id;
  v_summary:=jsonb_build_object('expected',v_expected,'present',v_present,'late',v_late,'absent',v_absent_total,'excused',v_excused,'started_at',s.started_at,'closed_at',clock_timestamp(),'reason',p_reason);
  update public.attendance_sessions set status='closed',closed_at=clock_timestamp(),summary_submitted_at=clock_timestamp(),summary_submitted_by=p_actor,close_reason=p_reason,summary=v_summary where id=s.id;
  for a in select id from public.profiles where role='admin' and active=true and approval_status='approved' loop
    perform private.push_app_notification(a.id,'attendance_summary','สรุปเช็คชื่อแล้ว',
      format('%s • %s • %s: มา %s สาย %s ขาด %s ลา %s จาก %s คน',v_subject,v_class,v_date,v_present,v_late,v_absent_total,v_excused,v_expected),
      jsonb_build_object('session_id',s.id,'subject_id',s.subject_id,'classroom_id',s.classroom_id,'summary',v_summary,'reason',p_reason));
  end loop;
  if p_actor is not null and not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    perform private.push_app_notification(p_actor,'attendance_summary_sent','ส่งสรุปเช็คชื่อให้ Admin แล้ว',
      format('%s • %s: มา %s สาย %s ขาด %s ลา %s จาก %s คน',v_subject,v_class,v_present,v_late,v_absent_total,v_excused,v_expected),
      jsonb_build_object('session_id',s.id,'summary',v_summary,'reason',p_reason));
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor,case when p_reason='auto_15_minute' then 'AUTO_CLOSE_ATTENDANCE_SESSION' else 'CLOSE_ATTENDANCE_SESSION' end,'attendance_session',s.id::text,jsonb_build_object('absent_added',v_absent,'summary',v_summary,'reason',p_reason));
  return jsonb_build_object('ok',true,'session_id',s.id,'absent_added',v_absent,'summary',v_summary,'closed_at',clock_timestamp(),'close_reason',p_reason);
end;$$;
revoke all on function private.finalize_attendance_session_internal(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.close_attendance_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_actor uuid:=auth.uid();s public.attendance_sessions%rowtype; begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.attendance_sessions where id=p_session_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not(private.is_admin(v_actor) or private.is_classroom_leader(s.classroom_id,v_actor)) then raise exception 'NOT_ALLOWED'; end if;
  return private.finalize_attendance_session_internal(p_session_id,v_actor,'manual_summary');
end;$$;

create or replace function public.auto_finalize_due_attendance_sessions()
returns integer language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare r record;n integer:=0;begin
  for r in select id from public.attendance_sessions where status='open' and coalesce(auto_close_at,started_at+make_interval(mins=>late_after_minutes))<=clock_timestamp() order by started_at loop
    perform private.finalize_attendance_session_internal(r.id,null,'auto_15_minute');n:=n+1;
  end loop;return n;
end;$$;
revoke all on function public.auto_finalize_due_attendance_sessions() from public,anon,authenticated;

create or replace function public.scan_attendance_qr(
  p_classroom_id uuid,
  p_subject_id uuid,
  p_token uuid,
  p_late_after_minutes integer default 15
) returns jsonb
language plpgsql security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_actor uuid:=auth.uid();v_is_admin boolean:=false;v_student uuid;v_session uuid;
  v_started timestamptz;v_deadline timestamptz;v_session_status text;v_status text;v_record uuid;v_scanned_at timestamptz;
  v_student_code text;v_full_name text;v_grade text;v_room_label text;v_class_name text;v_subject_label text;v_classroom_name text;
  v_now timestamptz:=clock_timestamp();v_closed_today uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED';end if;
  v_is_admin:=private.is_admin(v_actor);
  if not(v_is_admin or private.is_classroom_leader(p_classroom_id,v_actor)) then raise exception 'ATTENDANCE_SCAN_NOT_ALLOWED';end if;
  if coalesce(p_late_after_minutes,-1) not between 1 and 240 then raise exception 'INVALID_ATTENDANCE_WINDOW';end if;
  select t.user_id into v_student from public.attendance_qr_tokens t where t.token=p_token and t.active;
  if v_student is null then raise exception 'INVALID_QR_TOKEN';end if;
  if not exists(select 1 from public.classroom_memberships m where m.classroom_id=p_classroom_id and m.user_id=v_student and m.active) then raise exception 'STUDENT_NOT_IN_CLASSROOM';end if;
  if not exists(select 1 from public.subject_enrollments e where e.subject_id=p_subject_id and e.user_id=v_student and e.status='approved') then raise exception 'STUDENT_NOT_APPROVED_FOR_SUBJECT';end if;

  select s.id,s.started_at,coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)),s.status
  into v_session,v_started,v_deadline,v_session_status from public.attendance_sessions s
  where s.classroom_id=p_classroom_id and s.subject_id=p_subject_id
    and s.session_date=(timezone('Asia/Bangkok',v_now))::date and s.status='open'
  order by s.started_at desc limit 1 for update;

  if v_session is not null and v_now>=v_deadline then
    perform private.finalize_attendance_session_internal(v_session,null,'auto_15_minute');v_session:=null;
  end if;

  if v_session is null then
    select s.id,s.started_at,coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)),s.status
    into v_closed_today,v_started,v_deadline,v_session_status from public.attendance_sessions s
    where s.classroom_id=p_classroom_id and s.subject_id=p_subject_id
      and s.session_date=(timezone('Asia/Bangkok',v_now))::date and s.status='closed'
    order by s.closed_at desc nulls last,s.started_at desc limit 1;

    if v_closed_today is not null then
      if not v_is_admin then raise exception 'ATTENDANCE_WINDOW_CLOSED_USE_ADMIN';end if;
      v_session:=v_closed_today;v_status:='late';v_session_status:='closed';
    else
      insert into public.attendance_sessions(classroom_id,subject_id,session_date,started_at,late_after_minutes,auto_close_at,created_by,status)
      values(p_classroom_id,p_subject_id,(timezone('Asia/Bangkok',v_now))::date,v_now,p_late_after_minutes,v_now+make_interval(mins=>p_late_after_minutes),v_actor,'open')
      returning id,started_at,auto_close_at,status into v_session,v_started,v_deadline,v_session_status;
      v_status:='present';
    end if;
  else
    v_status:='present';
  end if;

  insert into public.attendance_records(session_id,user_id,scanned_at,status,scanned_by,updated_at)
  values(v_session,v_student,v_now,v_status,v_actor,v_now)
  on conflict(session_id,user_id) do update
  set scanned_at=case when public.attendance_records.status='excused' then public.attendance_records.scanned_at else coalesce(public.attendance_records.scanned_at,excluded.scanned_at) end,
      status=case when public.attendance_records.status='excused' then 'excused' when excluded.status='late' then 'late'
                  when public.attendance_records.status in('absent') then excluded.status else public.attendance_records.status end,
      scanned_by=case when public.attendance_records.status='excused' then public.attendance_records.scanned_by else coalesce(public.attendance_records.scanned_by,excluded.scanned_by) end,
      updated_at=v_now
  returning id,status,scanned_at into v_record,v_status,v_scanned_at;

  select p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name into v_student_code,v_full_name,v_grade,v_room_label,v_class_name
  from public.profiles p where p.id=v_student;
  select coalesce(s.code||' '||s.name,s.name),c.name into v_subject_label,v_classroom_name
  from public.subjects s,public.classrooms c where s.id=p_subject_id and c.id=p_classroom_id;

  perform private.push_app_notification(v_student,'attendance_checked','เช็คชื่อแล้ววันนี้',
    format('%s • %s • รหัส %s • %s • %s',coalesce(v_full_name,'-'),coalesce(v_grade,'')||coalesce(v_room_label,''),coalesce(v_student_code,'-'),
      case when v_status='late' then 'มาสาย' when v_status='excused' then 'ลา' else 'มาเรียน' end,
      to_char(v_scanned_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI:SS')),
    jsonb_build_object('session_id',v_session,'record_id',v_record,'subject_id',p_subject_id,'subject',v_subject_label,'classroom',v_classroom_name,'status',v_status,'scanned_at',v_scanned_at,'student_code',v_student_code,'full_name',v_full_name,'grade_level',v_grade,'room_label',v_room_label,'class_name',v_class_name));

  if v_actor<>v_student then
    perform private.push_app_notification(v_actor,'attendance_scan_result','เช็คชื่อสำเร็จ',
      format('%s • %s • รหัส %s • %s • %s',coalesce(v_full_name,'-'),coalesce(v_grade,'')||coalesce(v_room_label,''),coalesce(v_student_code,'-'),
        case when v_status='late' then 'มาสาย' when v_status='excused' then 'ลา' else 'มาเรียน' end,
        to_char(v_scanned_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI:SS')),
      jsonb_build_object('session_id',v_session,'record_id',v_record,'subject_id',p_subject_id,'status',v_status,'scanned_at',v_scanned_at,'student_code',v_student_code,'full_name',v_full_name,'grade_level',v_grade,'room_label',v_room_label,'class_name',v_class_name));
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'SCAN_ATTENDANCE','attendance_record',v_record::text,
    jsonb_build_object('session_id',v_session,'student_id',v_student,'subject_id',p_subject_id,'classroom_id',p_classroom_id,'status',v_status,'session_status',v_session_status,'server_time',v_now));

  return jsonb_build_object('ok',true,'session_id',v_session,'session_status',v_session_status,'record_id',v_record,'user_id',v_student,
    'student_code',v_student_code,'full_name',v_full_name,'grade_level',v_grade,'room_label',v_room_label,'class_name',v_class_name,
    'status',v_status,'scanned_at',v_scanned_at,'server_time',v_now,'auto_close_at',v_deadline,'subject',v_subject_label,'classroom',v_classroom_name);
exception when unique_violation then
  return public.scan_attendance_qr(p_classroom_id,p_subject_id,p_token,p_late_after_minutes);
end;$$;

create or replace function public.attendance_session_roster_v161(p_session_id uuid)
returns table(record_id uuid,user_id uuid,student_code text,full_name text,grade_level text,room_label text,class_name text,status text,scanned_at timestamptz,note text)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare s public.attendance_sessions%rowtype;begin
  select * into s from public.attendance_sessions where id=p_session_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid())) then raise exception 'NOT_ALLOWED'; end if;
  return query select r.id,p.id,p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name,coalesce(r.status,'pending'),r.scanned_at,r.note
  from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved'
  join public.subject_enrollments e on e.user_id=p.id and e.subject_id=s.subject_id and e.status='approved'
  left join public.attendance_records r on r.session_id=s.id and r.user_id=p.id
  where m.classroom_id=s.classroom_id and m.active order by p.student_code nulls last,p.full_name;
end;$$;

create or replace function public.attendance_session_snapshot(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare s public.attendance_sessions%rowtype;v_expected int;v_present int;v_late int;v_absent int;v_excused int;begin
  select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'NOT_FOUND';end if;
  if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid())) then raise exception 'NOT_ALLOWED';end if;
  select count(*) into v_expected from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved'
  join public.subject_enrollments e on e.user_id=m.user_id and e.subject_id=s.subject_id and e.status='approved' where m.classroom_id=s.classroom_id and m.active;
  select count(*) filter(where status='present'),count(*) filter(where status='late'),count(*) filter(where status='absent'),count(*) filter(where status='excused')
    into v_present,v_late,v_absent,v_excused from public.attendance_records where session_id=s.id;
  return jsonb_build_object('session_id',s.id,'status',s.status,'started_at',s.started_at,'auto_close_at',coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)),'closed_at',s.closed_at,'expected',v_expected,'present',v_present,'late',v_late,'absent',v_absent,'excused',v_excused,'checked',v_present+v_late+v_excused,'summary',s.summary,'close_reason',s.close_reason);
end;$$;

-- Admin can mark leave/late/absent directly in the attendance roster.
create or replace function public.admin_set_attendance_status_v161(p_session_id uuid,p_user_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;v_record uuid;v_now timestamptz:=clock_timestamp();begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
  if p_status not in ('present','late','absent','excused') then raise exception 'INVALID_STATUS';end if;
  select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'NOT_FOUND';end if;
  insert into public.attendance_records(session_id,user_id,status,scanned_at,scanned_by,note,updated_at)
  values(s.id,p_user_id,p_status,case when p_status in ('present','late') then v_now else null end,v_uid,nullif(trim(coalesce(p_note,'')),''),v_now)
  on conflict(session_id,user_id) do update set status=excluded.status,scanned_at=case when excluded.status in ('present','late') then coalesce(public.attendance_records.scanned_at,v_now) else public.attendance_records.scanned_at end,scanned_by=v_uid,note=excluded.note,updated_at=v_now returning id into v_record;
  perform private.push_app_notification(p_user_id,'attendance_status_changed','อัปเดตสถานะการเข้าเรียน',
    format('สถานะวันนี้ถูกปรับเป็น %s%s',case p_status when 'present' then 'มาเรียน' when 'late' then 'มาสาย' when 'absent' then 'ขาด' else 'ลา' end,case when p_note is not null then ' • '||p_note else '' end),
    jsonb_build_object('session_id',s.id,'record_id',v_record,'status',p_status,'updated_at',v_now));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'EDIT_ATTENDANCE','attendance_record',v_record::text,jsonb_build_object('session_id',s.id,'user_id',p_user_id,'status',p_status,'note',p_note));
  return jsonb_build_object('ok',true,'record_id',v_record,'status',p_status,'server_time',v_now);
end;$$;

revoke all on function public.attendance_session_roster_v161(uuid) from public,anon;
revoke all on function public.attendance_session_snapshot(uuid) from public,anon;
revoke all on function public.admin_set_attendance_status_v161(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_session_roster_v161(uuid) to authenticated;
grant execute on function public.attendance_session_snapshot(uuid) to authenticated;
grant execute on function public.admin_set_attendance_status_v161(uuid,uuid,text,text) to authenticated;

do $$begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='app_notifications') then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end$$;
