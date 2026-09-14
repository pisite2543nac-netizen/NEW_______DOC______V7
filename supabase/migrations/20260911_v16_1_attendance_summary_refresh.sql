create or replace function private.refresh_attendance_session_summary(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare s public.attendance_sessions%rowtype;v_expected int:=0;v_present int:=0;v_late int:=0;v_absent int:=0;v_excused int:=0;v_summary jsonb;begin
  select * into s from public.attendance_sessions where id=p_session_id for update;if not found then raise exception 'NOT_FOUND';end if;
  select count(*) into v_expected from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved' join public.subject_enrollments e on e.user_id=m.user_id and e.subject_id=s.subject_id and e.status='approved' where m.classroom_id=s.classroom_id and m.active;
  select count(*) filter(where status='present'),count(*) filter(where status='late'),count(*) filter(where status='absent'),count(*) filter(where status='excused') into v_present,v_late,v_absent,v_excused from public.attendance_records where session_id=s.id;
  v_summary:=coalesce(s.summary,'{}'::jsonb)||jsonb_build_object('expected',v_expected,'present',v_present,'late',v_late,'absent',v_absent,'excused',v_excused,'updated_at',clock_timestamp());
  update public.attendance_sessions set summary=v_summary where id=s.id;return v_summary;
end;$$;
revoke all on function private.refresh_attendance_session_summary(uuid) from public,anon,authenticated;

create or replace function public.admin_set_attendance_status_v161(p_session_id uuid,p_user_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;v_record uuid;v_now timestamptz:=clock_timestamp();v_summary jsonb;begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
  if p_status not in ('present','late','absent','excused') then raise exception 'INVALID_STATUS';end if;
  select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'NOT_FOUND';end if;
  if not exists(select 1 from public.classroom_memberships m where m.classroom_id=s.classroom_id and m.user_id=p_user_id and m.active) then raise exception 'STUDENT_NOT_IN_CLASSROOM';end if;
  insert into public.attendance_records(session_id,user_id,status,scanned_at,scanned_by,note,updated_at)
  values(s.id,p_user_id,p_status,case when p_status in ('present','late') then v_now else null end,v_uid,nullif(trim(coalesce(p_note,'')),''),v_now)
  on conflict(session_id,user_id) do update set status=excluded.status,scanned_at=case when excluded.status in ('present','late') then coalesce(public.attendance_records.scanned_at,v_now) else public.attendance_records.scanned_at end,scanned_by=v_uid,note=excluded.note,updated_at=v_now returning id into v_record;
  if s.status='closed' then v_summary:=private.refresh_attendance_session_summary(s.id);end if;
  perform private.push_app_notification(p_user_id,'attendance_status_changed','อัปเดตสถานะการเข้าเรียน',format('สถานะวันนี้ถูกปรับเป็น %s%s',case p_status when 'present' then 'มาเรียน' when 'late' then 'มาสาย' when 'absent' then 'ขาด' else 'ลา' end,case when p_note is not null then ' • '||p_note else '' end),jsonb_build_object('session_id',s.id,'record_id',v_record,'status',p_status,'updated_at',v_now));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'EDIT_ATTENDANCE','attendance_record',v_record::text,jsonb_build_object('session_id',s.id,'user_id',p_user_id,'status',p_status,'note',p_note,'summary',v_summary));
  return jsonb_build_object('ok',true,'record_id',v_record,'status',p_status,'server_time',v_now,'summary',v_summary);
end;$$;
