-- V19.3.1: lock official subject score weights to 40/20/20/20.
begin;

update public.subject_grade_settings
set work_points=40,
    behavior_points=20,
    midterm_points=20,
    final_points=20,
    default_behavior_score=least(20,greatest(0,coalesce(default_behavior_score,20)));

create or replace function private.enforce_grade_weights_v193()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.work_points := 40;
  new.behavior_points := 20;
  new.midterm_points := 20;
  new.final_points := 20;
  new.default_behavior_score := least(20,greatest(0,coalesce(new.default_behavior_score,20)));
  return new;
end;
$$;

revoke all on function private.enforce_grade_weights_v193() from public,anon,authenticated;
grant execute on function private.enforce_grade_weights_v193() to service_role,postgres;

drop trigger if exists subject_grade_settings_fixed_weights_v193 on public.subject_grade_settings;
create trigger subject_grade_settings_fixed_weights_v193
before insert or update on public.subject_grade_settings
for each row execute function private.enforce_grade_weights_v193();

commit;
