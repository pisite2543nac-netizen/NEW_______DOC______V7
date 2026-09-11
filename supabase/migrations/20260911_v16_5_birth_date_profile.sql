alter table public.profiles add column if not exists birth_date date;
alter table public.profiles drop constraint if exists profiles_birth_date_not_future;
alter table public.profiles add constraint profiles_birth_date_not_future check (birth_date is null or birth_date <= current_date) not valid;
alter table public.profiles validate constraint profiles_birth_date_not_future;
create index if not exists profiles_birth_date_idx on public.profiles(birth_date) where birth_date is not null;
