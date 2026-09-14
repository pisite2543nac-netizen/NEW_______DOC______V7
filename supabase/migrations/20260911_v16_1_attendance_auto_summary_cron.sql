create extension if not exists pg_cron;
do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname='docfullnr-attendance-auto-summary' loop
    perform cron.unschedule(j);
  end loop;
  perform cron.schedule('docfullnr-attendance-auto-summary','* * * * *','select public.auto_finalize_due_attendance_sessions();');
end$$;
