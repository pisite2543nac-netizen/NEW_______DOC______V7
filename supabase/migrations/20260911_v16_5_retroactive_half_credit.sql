-- DOC-FULL-NR V16.5 — half credit for retroactive late submission permission
alter table public.submission_overrides add column if not exists retroactive boolean not null default false;
alter table public.submission_overrides add column if not exists credit_factor numeric(4,2) not null default 1.00;
alter table public.submission_overrides drop constraint if exists submission_overrides_credit_factor_check;
alter table public.submission_overrides add constraint submission_overrides_credit_factor_check check (credit_factor > 0 and credit_factor <= 1.00);

create or replace function public.set_submission_override_credit_factor()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
declare v_due timestamptz;
begin
  select due_at into v_due from public.worksheets where id=new.worksheet_id;
  if coalesce(new.allow_late,false)=true and v_due is not null and clock_timestamp()>v_due then
    new.retroactive:=true; new.credit_factor:=0.50;
  else
    new.retroactive:=false; new.credit_factor:=1.00;
  end if;
  return new;
end $$;

drop trigger if exists trg_submission_override_credit_factor on public.submission_overrides;
create trigger trg_submission_override_credit_factor
before insert or update of worksheet_id,allow_late on public.submission_overrides
for each row execute function public.set_submission_override_credit_factor();

-- admin_subject_gradebook in production uses submission_overrides.credit_factor
-- so a retroactive approved work item contributes 0.5 unit instead of 1.0 unit.
