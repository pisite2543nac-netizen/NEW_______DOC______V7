create or replace function public.finalize_due_attendance_session_v161(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;v_deadline timestamptz;begin
  if v_uid is null then raise exception 'AUTH_REQUIRED';end if;
  select * into s from public.attendance_sessions where id=p_session_id for update;if not found then raise exception 'NOT_FOUND';end if;
  if not(private.is_admin(v_uid) or private.is_classroom_leader(s.classroom_id,v_uid)) then raise exception 'NOT_ALLOWED';end if;
  if s.status='closed' then return jsonb_build_object('ok',true,'already_closed',true,'summary',s.summary);end if;
  v_deadline:=coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes));
  if clock_timestamp()<v_deadline then return jsonb_build_object('ok',false,'not_due',true,'auto_close_at',v_deadline);end if;
  return private.finalize_attendance_session_internal(s.id,v_uid,'auto_15_minute');
end;$$;
revoke all on function public.finalize_due_attendance_session_v161(uuid) from public,anon;
grant execute on function public.finalize_due_attendance_session_v161(uuid) to authenticated;
