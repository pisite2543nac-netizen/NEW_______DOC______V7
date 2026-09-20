-- DOC-FULL-NR V19.7.1
-- Aligns the consolidated V19.7 source migration with the hardened Production model.
-- Server-authoritative timing, hashed target validation, RPC-only tables, no Firebase dependency.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Production keeps only the hash of the target code in Postgres. The visible target remains
-- a static learning asset in the PWA because students must be able to see what they type.
alter table public.programming_activity_stages_v197 add column if not exists code_hash text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='programming_activity_stages_v197' and column_name='code_target'
  ) then
    execute $q$
      update public.programming_activity_stages_v197
      set code_hash=encode(extensions.digest(code_target,'sha256'),'hex')
      where code_hash is null
    $q$;
  end if;
end $$;
alter table public.programming_activity_stages_v197 alter column code_hash set not null;
alter table public.programming_activity_stages_v197 drop column if exists code_target;
alter table public.programming_activity_stages_v197 drop column if exists description;
alter table public.programming_activity_stages_v197 drop column if exists usage;
alter table public.programming_activity_stages_v197 drop column if exists benefit;
alter table public.programming_activity_stages_v197 drop column if exists base_points;

create table if not exists public.programming_activity_sessions_v197 (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id text not null references public.programming_activity_stages_v197(id) on delete restrict,
  mode text not null check (mode in ('practice','ranking','official')),
  official_stage_no integer,
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (expires_at > started_at)
);
create index if not exists programming_activity_sessions_v197_live_idx
  on public.programming_activity_sessions_v197(subject_id,user_id,stage_id,mode,started_at desc)
  where completed_at is null;

alter table public.programming_activity_attempts_v197 add column if not exists session_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='programming_activity_attempts_v197_session_id_fkey'
  ) then
    alter table public.programming_activity_attempts_v197
      add constraint programming_activity_attempts_v197_session_id_fkey
      foreign key(session_id) references public.programming_activity_sessions_v197(id) on delete set null;
  end if;
end $$;
alter table public.programming_activity_attempts_v197 drop column if exists points;
alter table public.programming_activity_focus_v197 add column if not exists last_heartbeat_at timestamptz;

alter table public.programming_activity_sessions_v197 enable row level security;
revoke all on table public.programming_activity_sessions_v197 from public,anon,authenticated;
grant all on table public.programming_activity_sessions_v197 to service_role;
do $$ begin
  create policy programming_activity_sessions_v197_rpc_only_v197
    on public.programming_activity_sessions_v197 for all to authenticated
    using(false) with check(false);
exception when duplicate_object then null; end $$;

-- Remove pre-alignment signatures whose return/input contracts changed.
drop function if exists public.submit_programming_stage_v197(uuid,text,text,numeric,integer,text,integer,uuid);
drop function if exists public.my_programming_activity_progress_v197(uuid);
drop function if exists public.programming_activity_leaderboard_v197(uuid,text);

create or replace function public.my_programming_activity_progress_v197(p_subject_id uuid)
returns table(
  stage_id text, completed boolean, attempts_count integer,
  best_wpm numeric, best_accuracy numeric, best_time numeric, unlocked boolean
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); cfg public.programming_activity_settings_v197%rowtype;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
  return query
  select st.id,
    coalesce(bool_or(a.passed),false),
    count(a.id)::int,
    round(coalesce(max(a.wpm),0),1),
    round(coalesce(max(a.accuracy),0),1),
    round(coalesce(min(a.elapsed_seconds) filter(where a.passed),0),2),
    case when not coalesce(cfg.sequential_unlock,true) or st.stage_no=1 then true
         else exists(select 1 from public.programming_activity_attempts_v197 pa
                     join public.programming_activity_stages_v197 ps on ps.id=pa.stage_id
                     where pa.subject_id=p_subject_id and pa.user_id=v_uid and pa.passed
                       and ps.language=st.language and ps.stage_no=st.stage_no-1) end
  from public.programming_activity_stages_v197 st
  left join public.programming_activity_attempts_v197 a
    on a.stage_id=st.id and a.user_id=v_uid and a.subject_id=p_subject_id
  where st.subject_id=p_subject_id and st.active
  group by st.id,st.language,st.stage_no,cfg.sequential_unlock
  order by st.language,st.stage_no;
end;
$$;
revoke all on function public.my_programming_activity_progress_v197(uuid) from public,anon;
grant execute on function public.my_programming_activity_progress_v197(uuid) to authenticated,service_role;

create or replace function public.start_programming_stage_v197(
  p_subject_id uuid,p_stage_id text,p_mode text default 'practice',p_official_stage_no integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
 v_uid uuid:=auth.uid(); st public.programming_activity_stages_v197%rowtype; cfg public.programming_activity_settings_v197%rowtype;
 v_session public.programming_activity_sessions_v197%rowtype; v_exp timestamptz;
begin
 if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
 select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
 if cfg.subject_id is null or not cfg.enabled then raise exception 'PROGRAMMING_ACTIVITY_CLOSED'; end if;
 if p_mode not in ('practice','ranking','official') then raise exception 'PROGRAMMING_ACTIVITY_MODE_INVALID'; end if;
 if p_mode='ranking' and not cfg.leaderboard_enabled then raise exception 'PROGRAMMING_RANKING_DISABLED'; end if;
 if p_mode='official' and not cfg.official_enabled then raise exception 'PROGRAMMING_OFFICIAL_DISABLED'; end if;
 select * into st from public.programming_activity_stages_v197 where id=p_stage_id and subject_id=p_subject_id and active;
 if st.id is null then raise exception 'PROGRAMMING_STAGE_NOT_FOUND'; end if;
 if p_mode<>'official' and cfg.sequential_unlock and st.stage_no>1 and not exists(
   select 1 from public.programming_activity_attempts_v197 a
   join public.programming_activity_stages_v197 ps on ps.id=a.stage_id
   where a.subject_id=p_subject_id and a.user_id=v_uid and a.passed and ps.language=st.language and ps.stage_no=st.stage_no-1
 ) then raise exception 'PROGRAMMING_STAGE_LOCKED'; end if;
 if p_mode='official' and not exists(
   select 1 from public.programming_activity_official_map_v197 m
   where m.subject_id=p_subject_id and m.official_stage_no=p_official_stage_no and m.stage_id=st.id
 ) then raise exception 'PROGRAMMING_OFFICIAL_STAGE_INVALID'; end if;

 perform pg_advisory_xact_lock(hashtextextended('prog-start:'||v_uid::text||':'||p_stage_id||':'||p_mode||':'||coalesce(p_official_stage_no::text,''),0));
 select * into v_session from public.programming_activity_sessions_v197
 where subject_id=p_subject_id and user_id=v_uid and stage_id=p_stage_id and mode=p_mode
   and coalesce(official_stage_no,0)=coalesce(p_official_stage_no,0)
   and completed_at is null and expires_at>clock_timestamp()
 order by started_at desc limit 1;
 if v_session.id is null then
   v_exp:=clock_timestamp()+make_interval(secs=>least(1800,greatest(300,st.time_limit_seconds*3)));
   insert into public.programming_activity_sessions_v197(subject_id,user_id,stage_id,mode,official_stage_no,started_at,expires_at)
   values(p_subject_id,v_uid,p_stage_id,p_mode,p_official_stage_no,clock_timestamp(),v_exp)
   returning * into v_session;
 end if;
 return jsonb_build_object('ok',true,'session_id',v_session.id,'stage_id',st.id,'mode',p_mode,
   'official_stage_no',p_official_stage_no,'started_at',v_session.started_at,'expires_at',v_session.expires_at,
   'server_time',clock_timestamp(),'time_limit_seconds',st.time_limit_seconds);
end;
$$;
revoke all on function public.start_programming_stage_v197(uuid,text,text,integer) from public,anon;
grant execute on function public.start_programming_stage_v197(uuid,text,text,integer) to authenticated,service_role;

create or replace function public.submit_programming_stage_v197(
  p_session_id uuid,p_typed_text text,p_mistakes integer default 0,p_request_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,extensions,pg_temp
as $$
declare
 v_uid uuid:=auth.uid(); sess public.programming_activity_sessions_v197%rowtype; st public.programming_activity_stages_v197%rowtype;
 cfg public.programming_activity_settings_v197%rowtype; old public.programming_activity_attempts_v197%rowtype;
 v_text text; v_hash text; v_chars int; v_mist int; v_elapsed numeric; v_wpm numeric; v_acc numeric;
 v_target_wpm numeric; v_speed numeric; v_reward int:=0; v_quest_reward int:=0; v_first_pass boolean; v_passed boolean;
 v_attempt uuid; v_official_max numeric; v_official_score numeric:=null; v_rank jsonb; v_tier text; qr record;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('prog-submit:'||v_uid::text||':'||p_session_id::text,0));
 select * into old from public.programming_activity_attempts_v197 where user_id=v_uid and request_key=p_request_key;
 if old.id is not null then
   return jsonb_build_object('ok',true,'duplicate',true,'attempt_id',old.id,'passed',old.passed,
      'wpm',old.wpm,'accuracy',old.accuracy,'mistakes',old.mistakes,'reward_tokens',old.reward_tokens);
 end if;
 select * into sess from public.programming_activity_sessions_v197 where id=p_session_id and user_id=v_uid for update;
 if sess.id is null then raise exception 'PROGRAMMING_SESSION_NOT_FOUND'; end if;
 if sess.completed_at is not null then raise exception 'PROGRAMMING_SESSION_ALREADY_COMPLETED'; end if;
 if clock_timestamp()>sess.expires_at+interval '5 seconds' then raise exception 'PROGRAMMING_SESSION_EXPIRED'; end if;
 if not private.programming_activity_access_v197(sess.subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
 select * into cfg from public.programming_activity_settings_v197 where subject_id=sess.subject_id;
 if cfg.subject_id is null or not cfg.enabled then raise exception 'PROGRAMMING_ACTIVITY_CLOSED'; end if;
 select * into st from public.programming_activity_stages_v197 where id=sess.stage_id and subject_id=sess.subject_id and active;
 if st.id is null then raise exception 'PROGRAMMING_STAGE_NOT_FOUND'; end if;

 v_text:=replace(replace(coalesce(p_typed_text,''),E'\r\n',E'\n'),E'\r',E'\n');
 v_hash:=encode(extensions.digest(v_text,'sha256'),'hex');
 if v_hash<>st.code_hash then raise exception 'PROGRAMMING_CODE_NOT_COMPLETE'; end if;
 v_elapsed:=greatest(1,extract(epoch from (clock_timestamp()-sess.started_at)));
 v_chars:=greatest(1,char_length(v_text));
 v_mist:=least(v_chars*2,greatest(0,coalesce(p_mistakes,0)));
 v_wpm:=round(((v_chars::numeric/5)/(v_elapsed/60))::numeric,2);
 v_acc:=round((v_chars::numeric/(v_chars+v_mist)*100)::numeric,2);
 v_passed:=v_acc>=cfg.min_accuracy;
 select not exists(select 1 from public.programming_activity_attempts_v197
   where subject_id=sess.subject_id and user_id=v_uid and stage_id=st.id and passed)
 into v_first_pass;
 v_target_wpm:=case st.difficulty when 'easy' then 28 when 'medium' then 42 else 58 end;
 v_speed:=least(1,greatest(0,v_wpm/nullif(v_target_wpm,0)));
 if v_passed and v_first_pass then
   v_reward:=least(70,greatest(1,round(st.reward_points*greatest(0.35,(v_acc/100)*0.70+v_speed*0.30))));
 end if;

 insert into public.programming_activity_attempts_v197(
   subject_id,user_id,stage_id,mode,official_stage_no,elapsed_seconds,wpm,accuracy,mistakes,reward_tokens,passed,request_key,session_id
 ) values(sess.subject_id,v_uid,st.id,sess.mode,sess.official_stage_no,v_elapsed,v_wpm,v_acc,v_mist,v_reward,v_passed,p_request_key,sess.id)
 returning id into v_attempt;
 update public.programming_activity_sessions_v197 set completed_at=clock_timestamp() where id=sess.id;

 if v_reward>0 then
   insert into public.programming_activity_wallets_v197(subject_id,user_id,tokens,lifetime_tokens)
   values(sess.subject_id,v_uid,v_reward,v_reward)
   on conflict(subject_id,user_id) do update set tokens=public.programming_activity_wallets_v197.tokens+excluded.tokens,
     lifetime_tokens=public.programming_activity_wallets_v197.lifetime_tokens+excluded.lifetime_tokens,updated_at=clock_timestamp();
 end if;
 if sess.mode='official' and v_passed then
   select max_score into v_official_max from public.programming_activity_official_map_v197
   where subject_id=sess.subject_id and official_stage_no=sess.official_stage_no and stage_id=st.id;
   if v_official_max is not null then
     v_official_score:=round(v_official_max*least(1,(v_acc/100)*0.85+v_speed*0.15),2);
     insert into public.programming_activity_official_results_v197(
       subject_id,user_id,official_stage_no,stage_id,best_score,max_score,wpm,accuracy,elapsed_seconds,attempt_id
     ) values(sess.subject_id,v_uid,sess.official_stage_no,st.id,v_official_score,v_official_max,v_wpm,v_acc,v_elapsed,v_attempt)
     on conflict(subject_id,user_id,official_stage_no) do update set
       best_score=greatest(public.programming_activity_official_results_v197.best_score,excluded.best_score),
       wpm=case when excluded.best_score>=public.programming_activity_official_results_v197.best_score then excluded.wpm else public.programming_activity_official_results_v197.wpm end,
       accuracy=case when excluded.best_score>=public.programming_activity_official_results_v197.best_score then excluded.accuracy else public.programming_activity_official_results_v197.accuracy end,
       elapsed_seconds=case when excluded.best_score>=public.programming_activity_official_results_v197.best_score then excluded.elapsed_seconds else public.programming_activity_official_results_v197.elapsed_seconds end,
       attempt_id=case when excluded.best_score>=public.programming_activity_official_results_v197.best_score then excluded.attempt_id else public.programming_activity_official_results_v197.attempt_id end,
       updated_at=clock_timestamp();
   end if;
 end if;

 v_rank:=private.programming_activity_rating_v197(sess.subject_id,v_uid);
 v_tier:=coalesce(v_rank->>'tier','bronze');
 if cfg.quests_enabled and v_passed then
   for qr in select q.* from public.programming_activity_quests_v197 q
     where q.subject_id=sess.subject_id and q.active and q.language=st.language and q.stage_no=st.stage_no
       and (q.open_at is null or q.open_at<=clock_timestamp()) and (q.due_at is null or q.due_at>=clock_timestamp())
       and private.programming_activity_tier_index_v197(v_tier)>=private.programming_activity_tier_index_v197(q.min_tier)
       and not exists(select 1 from public.programming_activity_quest_completions_v197 qc where qc.quest_id=q.id and qc.user_id=v_uid)
       and (q.objective_type='pass' or (q.objective_type='accuracy' and v_acc>=q.target_value) or (q.objective_type='time' and v_elapsed<=q.target_value))
   loop
     insert into public.programming_activity_quest_completions_v197(quest_id,user_id,attempt_id,reward_tokens)
     values(qr.id,v_uid,v_attempt,qr.reward_tokens) on conflict do nothing;
     if found then v_quest_reward:=v_quest_reward+qr.reward_tokens; end if;
   end loop;
   if v_quest_reward>0 then
     insert into public.programming_activity_wallets_v197(subject_id,user_id,tokens,lifetime_tokens)
     values(sess.subject_id,v_uid,v_quest_reward,v_quest_reward)
     on conflict(subject_id,user_id) do update set tokens=public.programming_activity_wallets_v197.tokens+excluded.tokens,
       lifetime_tokens=public.programming_activity_wallets_v197.lifetime_tokens+excluded.lifetime_tokens,updated_at=clock_timestamp();
   end if;
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_uid,'SUBMIT_PROGRAMMING_STAGE_V197','programming_activity_attempt',v_attempt::text,
   jsonb_build_object('subject_id',sess.subject_id,'stage_id',st.id,'mode',sess.mode,'passed',v_passed,'wpm',v_wpm,'accuracy',v_acc,'mistakes',v_mist,'reward',v_reward,'quest_reward',v_quest_reward));
 return jsonb_build_object('ok',true,'attempt_id',v_attempt,'passed',v_passed,'wpm',v_wpm,'accuracy',v_acc,'mistakes',v_mist,
   'elapsed_seconds',round(v_elapsed,2),'reward_tokens',v_reward,'quest_reward_tokens',v_quest_reward,'rating',v_rank,
   'official_stage_score',v_official_score);
end;
$$;
revoke all on function public.submit_programming_stage_v197(uuid,text,integer,uuid) from public,anon;
grant execute on function public.submit_programming_stage_v197(uuid,text,integer,uuid) to authenticated,service_role;

create or replace function public.update_programming_focus_v197(p_subject_id uuid,p_heartbeat_seconds integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
 v_uid uuid:=auth.uid(); cfg public.programming_activity_settings_v197%rowtype; f public.programming_activity_focus_v197%rowtype;
 v_today date:=timezone('Asia/Bangkok',clock_timestamp())::date; v_now timestamptz:=clock_timestamp();
 v_add int:=0; v_reward int:=0; v_elapsed int:=0;
begin
 if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
 select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
 if cfg.subject_id is null or not cfg.enabled or not cfg.focus_enabled then raise exception 'PROGRAMMING_FOCUS_DISABLED'; end if;
 if p_heartbeat_seconds<1 or p_heartbeat_seconds>60 then raise exception 'PROGRAMMING_FOCUS_HEARTBEAT_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('prog-focus:'||v_uid::text||':'||v_today::text,0));
 select * into f from public.programming_activity_focus_v197 where subject_id=p_subject_id and user_id=v_uid and focus_date=v_today for update;
 if f.subject_id is null then
   v_add:=0;
   insert into public.programming_activity_focus_v197(subject_id,user_id,focus_date,seconds_active,last_heartbeat_at)
   values(p_subject_id,v_uid,v_today,0,v_now) returning * into f;
 else
   v_elapsed:=greatest(0,extract(epoch from (v_now-coalesce(f.last_heartbeat_at,v_now)))::int);
   if v_elapsed>=20 then v_add:=least(p_heartbeat_seconds,60,v_elapsed+5); else v_add:=0; end if;
   update public.programming_activity_focus_v197 set seconds_active=least(86400,seconds_active+v_add),
     last_heartbeat_at=v_now,updated_at=v_now where subject_id=p_subject_id and user_id=v_uid and focus_date=v_today returning * into f;
 end if;
 if not f.reward_claimed and f.seconds_active>=cfg.focus_target_minutes*60 and cfg.focus_reward_tokens>0 then
   v_reward:=cfg.focus_reward_tokens;
   update public.programming_activity_focus_v197 set reward_claimed=true,updated_at=v_now
   where subject_id=p_subject_id and user_id=v_uid and focus_date=v_today returning * into f;
   insert into public.programming_activity_wallets_v197(subject_id,user_id,tokens,lifetime_tokens)
   values(p_subject_id,v_uid,v_reward,v_reward)
   on conflict(subject_id,user_id) do update set tokens=public.programming_activity_wallets_v197.tokens+excluded.tokens,
     lifetime_tokens=public.programming_activity_wallets_v197.lifetime_tokens+excluded.lifetime_tokens,updated_at=v_now;
 end if;
 return jsonb_build_object('ok',true,'date',v_today,'seconds',f.seconds_active,'target_seconds',cfg.focus_target_minutes*60,
   'reward_claimed',f.reward_claimed,'reward_tokens',v_reward,'server_time',v_now);
end;
$$;
revoke all on function public.update_programming_focus_v197(uuid,integer) from public,anon;
grant execute on function public.update_programming_focus_v197(uuid,integer) to authenticated,service_role;

create or replace function public.programming_activity_leaderboard_v197(p_subject_id uuid,p_scope text default 'class')
returns table(rank_no bigint,user_id uuid,student_code text,full_name text,class_name text,rating numeric,tier text,completed_stages integer,best_wpm numeric,avg_accuracy numeric)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_class text; cfg public.programming_activity_settings_v197%rowtype;
begin
 if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
 select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
 if cfg.subject_id is null or not cfg.enabled or not cfg.leaderboard_enabled then raise exception 'PROGRAMMING_RANKING_DISABLED'; end if;
 if p_scope not in ('class','overall') then raise exception 'PROGRAMMING_LEADERBOARD_SCOPE_INVALID'; end if;
 select p.class_name into v_class from public.profiles p where p.id=v_uid;
 return query
 with members as (
   select p.id,p.student_code,p.full_name,p.class_name
   from public.subject_enrollments se join public.profiles p on p.id=se.user_id
   where se.subject_id=p_subject_id and se.status='approved' and p.role='user' and p.active and p.approval_status='approved'
     and (p_scope='overall' or p.class_name is not distinct from v_class)
 ), rated as (
   select m.*,r.j,(r.j->>'rating')::numeric rr,(r.j->>'completed_stages')::int cc,
     (r.j->>'best_wpm')::numeric bw,(r.j->>'avg_accuracy')::numeric aa,r.j->>'tier' tt
   from members m cross join lateral (select private.programming_activity_rating_v197(p_subject_id,m.id) j) r
 )
 select row_number() over(order by rated.rr desc,rated.cc desc,rated.bw desc,rated.student_code nulls last),
   rated.id,rated.student_code,rated.full_name,rated.class_name,round(rated.rr,1),rated.tt,rated.cc,round(rated.bw,1),round(rated.aa,1)
 from rated order by rated.rr desc,rated.cc desc,rated.bw desc,rated.student_code nulls last limit 200;
end;
$$;
revoke all on function public.programming_activity_leaderboard_v197(uuid,text) from public,anon;
grant execute on function public.programming_activity_leaderboard_v197(uuid,text) to authenticated,service_role;

commit;
