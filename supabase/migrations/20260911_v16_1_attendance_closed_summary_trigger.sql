create or replace function private.attendance_record_refresh_closed_summary()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if exists(select 1 from public.attendance_sessions s where s.id=new.session_id and s.status='closed') then
    perform private.refresh_attendance_session_summary(new.session_id);
  end if;
  return new;
end;$$;
revoke all on function private.attendance_record_refresh_closed_summary() from public,anon,authenticated;
drop trigger if exists trg_attendance_record_refresh_closed_summary on public.attendance_records;
create trigger trg_attendance_record_refresh_closed_summary
after insert or update of status on public.attendance_records
for each row execute function private.attendance_record_refresh_closed_summary();
