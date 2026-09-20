-- DOC-FULL-NR V19.7
-- Special Programming Activities adapted from user-provided Code Typing Academy V6.0.2.
-- Subject scope: 21910-2010 การเขียนโปรแกรมภาษาคอมพิวเตอร์.
-- Existing Supabase auth/enrollment is authoritative. No Firebase dependency is introduced.

begin;

create table if not exists public.programming_activity_settings_v197 (
  subject_id uuid primary key references public.subjects(id) on delete cascade,
  enabled boolean not null default true,
  leaderboard_enabled boolean not null default true,
  official_enabled boolean not null default true,
  quests_enabled boolean not null default true,
  focus_enabled boolean not null default true,
  sequential_unlock boolean not null default true,
  min_accuracy numeric not null default 90 check (min_accuracy between 70 and 100),
  focus_target_minutes integer not null default 60 check (focus_target_minutes between 5 and 180),
  focus_reward_tokens integer not null default 15 check (focus_reward_tokens between 0 and 500),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.programming_activity_stages_v197 (
  id text primary key,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  language text not null check (language in ('html','python')),
  stage_no integer not null check (stage_no between 1 and 50),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  title text not null,
  description text,
  usage text,
  benefit text,
  code_target text not null,
  base_points integer not null default 100 check (base_points > 0),
  reward_points integer not null default 1 check (reward_points between 0 and 500),
  time_limit_seconds integer not null default 90 check (time_limit_seconds between 10 and 1800),
  active boolean not null default true,
  source_version text not null default 'Code Typing Academy V6.0.2',
  unique(subject_id,language,stage_no)
);

create table if not exists public.programming_activity_attempts_v197 (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id text not null references public.programming_activity_stages_v197(id) on delete restrict,
  mode text not null check (mode in ('practice','ranking','official')),
  official_stage_no integer,
  elapsed_seconds numeric not null check (elapsed_seconds > 0 and elapsed_seconds <= 7200),
  wpm numeric not null check (wpm >= 0),
  accuracy numeric not null check (accuracy between 0 and 100),
  mistakes integer not null default 0 check (mistakes between 0 and 100000),
  points integer not null default 0 check (points >= 0),
  reward_tokens integer not null default 0 check (reward_tokens >= 0),
  passed boolean not null default false,
  request_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  unique(user_id,request_key)
);

create index if not exists programming_activity_attempts_v197_user_stage_idx
  on public.programming_activity_attempts_v197(subject_id,user_id,stage_id,created_at desc);
create index if not exists programming_activity_attempts_v197_rank_idx
  on public.programming_activity_attempts_v197(subject_id,mode,created_at desc)
  where mode='ranking';
create index if not exists programming_activity_attempts_v197_official_idx
  on public.programming_activity_attempts_v197(subject_id,user_id,official_stage_no)
  where mode='official';

create table if not exists public.programming_activity_wallets_v197 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tokens integer not null default 0 check (tokens >= 0),
  lifetime_tokens integer not null default 0 check (lifetime_tokens >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,user_id)
);

create table if not exists public.programming_activity_quests_v197 (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  source_key text,
  title text not null,
  description text,
  language text not null check (language in ('html','python')),
  stage_no integer not null check (stage_no between 1 and 50),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  objective_type text not null default 'pass' check (objective_type in ('pass','accuracy','time')),
  target_value numeric not null default 0 check (target_value >= 0),
  reward_tokens integer not null default 1 check (reward_tokens between 0 and 500),
  min_tier text not null default 'bronze' check (min_tier in ('bronze','silver','gold','platinum','diamond','master')),
  open_at timestamptz,
  due_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  unique(subject_id,source_key),
  check (due_at is null or open_at is null or due_at > open_at)
);

create index if not exists programming_activity_quests_v197_active_idx
  on public.programming_activity_quests_v197(subject_id,active,open_at,due_at);

create table if not exists public.programming_activity_quest_completions_v197 (
  quest_id uuid not null references public.programming_activity_quests_v197(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid references public.programming_activity_attempts_v197(id) on delete set null,
  reward_tokens integer not null default 0,
  completed_at timestamptz not null default clock_timestamp(),
  primary key(quest_id,user_id)
);

create table if not exists public.programming_activity_focus_v197 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  focus_date date not null,
  seconds_active integer not null default 0 check (seconds_active between 0 and 86400),
  reward_claimed boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,user_id,focus_date)
);

create table if not exists public.programming_activity_official_map_v197 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  official_stage_no integer not null check (official_stage_no between 1 and 30),
  stage_id text not null references public.programming_activity_stages_v197(id) on delete restrict,
  language text not null check (language in ('html','python')),
  source_stage integer not null check (source_stage between 1 and 50),
  title text not null,
  max_score numeric not null check (max_score > 0),
  required_for_submission boolean not null default true,
  primary key(subject_id,official_stage_no)
);

create table if not exists public.programming_activity_official_results_v197 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  official_stage_no integer not null check (official_stage_no between 1 and 30),
  stage_id text not null references public.programming_activity_stages_v197(id) on delete restrict,
  best_score numeric not null default 0 check (best_score >= 0),
  max_score numeric not null check (max_score > 0),
  wpm numeric not null default 0,
  accuracy numeric not null default 0,
  elapsed_seconds numeric not null default 0,
  attempt_id uuid references public.programming_activity_attempts_v197(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,user_id,official_stage_no)
);

create table if not exists public.programming_activity_official_submissions_v197 (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_stages integer not null default 30,
  total_score numeric not null,
  max_score numeric not null default 40,
  avg_accuracy numeric not null default 0,
  avg_wpm numeric not null default 0,
  submitted_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,user_id)
);

-- No direct client table access. All access is through checked RPCs.
do $$
declare t text;
begin
  foreach t in array array[
    'programming_activity_settings_v197','programming_activity_stages_v197',
    'programming_activity_attempts_v197','programming_activity_wallets_v197',
    'programming_activity_quests_v197','programming_activity_quest_completions_v197',
    'programming_activity_focus_v197','programming_activity_official_map_v197',
    'programming_activity_official_results_v197','programming_activity_official_submissions_v197'
  ]
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
    begin
      execute format('create policy %I on public.%I for all to authenticated using (false) with check (false)',t||'_rpc_only_v197',t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Seed settings only for the requested programming subject.
insert into public.programming_activity_settings_v197(subject_id)
select id from public.subjects
where code='21910-2010' and active=true and subject_type='subject'
on conflict(subject_id) do nothing;

-- Seed 100 learning stages from the user-provided system without bringing Firebase/Auth/PVP/chat dependencies.
with target_subject as (
  select id from public.subjects where code='21910-2010' and active=true and subject_type='subject' limit 1
), src as (
  select *
  from jsonb_to_recordset($v197stages$[{"id":"html_01","language":"html","stage":1,"difficulty":"easy","title":"หัวข้อและย่อหน้า","description":"ด่าน HTML 1: หัวข้อและย่อหน้า","usage":"ใช้ h1 เป็นหัวข้อหลักและ p เป็นย่อหน้า","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<h1>Hello HTML</h1>\n<p>เริ่มต้นเรียนรู้ HTML</p>","outputExplain":"ใช้ h1 เป็นหัวข้อหลักและ p เป็นย่อหน้า","basePoints":110,"rewardPoints":12,"timeLimit":66},{"id":"html_02","language":"html","stage":2,"difficulty":"easy","title":"ตัวหนาและตัวเอียง","description":"ด่าน HTML 2: ตัวหนาและตัวเอียง","usage":"strong เน้นความสำคัญ ส่วน em เน้นข้อความ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>เรียน <strong>HTML</strong> แบบ <em>เข้าใจง่าย</em></p>","outputExplain":"strong เน้นความสำคัญ ส่วน em เน้นข้อความ","basePoints":120,"rewardPoints":13,"timeLimit":73},{"id":"html_03","language":"html","stage":3,"difficulty":"easy","title":"ลิงก์","description":"ด่าน HTML 3: ลิงก์","usage":"แท็ก a ใช้สร้างลิงก์","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<a href=\"https://example.com\">เปิดเว็บไซต์ตัวอย่าง</a>","outputExplain":"แท็ก a ใช้สร้างลิงก์","basePoints":130,"rewardPoints":15,"timeLimit":70},{"id":"html_04","language":"html","stage":4,"difficulty":"easy","title":"รูปภาพ","description":"ด่าน HTML 4: รูปภาพ","usage":"img ใช้แสดงรูปและ alt อธิบายรูป","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<img src=\"https://picsum.photos/240/120\" alt=\"ภาพตัวอย่าง\">","outputExplain":"img ใช้แสดงรูปและ alt อธิบายรูป","basePoints":140,"rewardPoints":16,"timeLimit":74},{"id":"html_05","language":"html","stage":5,"difficulty":"easy","title":"รายการไม่เรียงลำดับ","description":"ด่าน HTML 5: รายการไม่เรียงลำดับ","usage":"ul และ li ใช้สร้างรายการแบบจุด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<ul>\n  <li>HTML</li>\n  <li>CSS</li>\n  <li>JavaScript</li>\n</ul>","outputExplain":"ul และ li ใช้สร้างรายการแบบจุด","basePoints":150,"rewardPoints":17,"timeLimit":77},{"id":"html_06","language":"html","stage":6,"difficulty":"easy","title":"รายการเรียงลำดับ","description":"ด่าน HTML 6: รายการเรียงลำดับ","usage":"ol ใช้สร้างรายการมีลำดับ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<ol>\n  <li>วางแผน</li>\n  <li>เขียนโค้ด</li>\n  <li>ทดสอบ</li>\n</ol>","outputExplain":"ol ใช้สร้างรายการมีลำดับ","basePoints":160,"rewardPoints":18,"timeLimit":79},{"id":"html_07","language":"html","stage":7,"difficulty":"easy","title":"เส้นคั่นและขึ้นบรรทัด","description":"ด่าน HTML 7: เส้นคั่นและขึ้นบรรทัด","usage":"br ขึ้นบรรทัดใหม่และ hr สร้างเส้นแบ่ง","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>บรรทัดแรก<br>บรรทัดที่สอง</p>\n<hr>","outputExplain":"br ขึ้นบรรทัดใหม่และ hr สร้างเส้นแบ่ง","basePoints":170,"rewardPoints":20,"timeLimit":57},{"id":"html_08","language":"html","stage":8,"difficulty":"easy","title":"กล่อง div","description":"ด่าน HTML 8: กล่อง div","usage":"div ใช้จัดกลุ่มองค์ประกอบ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<div class=\"card\">\n  <h2>Card</h2>\n  <p>เนื้อหาภายในการ์ด</p>\n</div>","outputExplain":"div ใช้จัดกลุ่มองค์ประกอบ","basePoints":180,"rewardPoints":21,"timeLimit":81},{"id":"html_09","language":"html","stage":9,"difficulty":"easy","title":"span ในข้อความ","description":"ด่าน HTML 9: span ในข้อความ","usage":"span ใช้ครอบข้อความเฉพาะส่วน","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>คะแนน: <span class=\"score\">100</span> แต้ม</p>","outputExplain":"span ใช้ครอบข้อความเฉพาะส่วน","basePoints":190,"rewardPoints":22,"timeLimit":66},{"id":"html_10","language":"html","stage":10,"difficulty":"easy","title":"ตารางพื้นฐาน","description":"ด่าน HTML 10: ตารางพื้นฐาน","usage":"table, tr, th, td ใช้สร้างตาราง","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<table>\n  <tr><th>ชื่อ</th><th>คะแนน</th></tr>\n  <tr><td>Ann</td><td>90</td></tr>\n</table>","outputExplain":"table, tr, th, td ใช้สร้างตาราง","basePoints":200,"rewardPoints":24,"timeLimit":97},{"id":"html_11","language":"html","stage":11,"difficulty":"easy","title":"หัวตารางและตัวตาราง","description":"ด่าน HTML 11: หัวตารางและตัวตาราง","usage":"thead และ tbody แยกส่วนหัวและข้อมูล","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<table>\n  <thead><tr><th>วิชา</th><th>เกรด</th></tr></thead>\n  <tbody><tr><td>Programming</td><td>A</td></tr></tbody>\n</table>","outputExplain":"thead และ tbody แยกส่วนหัวและข้อมูล","basePoints":210,"rewardPoints":25,"timeLimit":124},{"id":"html_12","language":"html","stage":12,"difficulty":"easy","title":"ปุ่ม","description":"ด่าน HTML 12: ปุ่ม","usage":"button ใช้สร้างปุ่ม","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<button type=\"button\">เริ่มเกม</button>","outputExplain":"button ใช้สร้างปุ่ม","basePoints":220,"rewardPoints":26,"timeLimit":59},{"id":"html_13","language":"html","stage":13,"difficulty":"easy","title":"ช่องข้อความ","description":"ด่าน HTML 13: ช่องข้อความ","usage":"label เชื่อมกับ input เพื่อรับข้อมูล","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"name\">ชื่อ</label>\n<input id=\"name\" type=\"text\">","outputExplain":"label เชื่อมกับ input เพื่อรับข้อมูล","basePoints":230,"rewardPoints":27,"timeLimit":75},{"id":"html_14","language":"html","stage":14,"difficulty":"easy","title":"ช่องอีเมล","description":"ด่าน HTML 14: ช่องอีเมล","usage":"input email ช่วยตรวจรูปแบบอีเมล","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"email\">อีเมล</label>\n<input id=\"email\" type=\"email\" required>","outputExplain":"input email ช่วยตรวจรูปแบบอีเมล","basePoints":240,"rewardPoints":29,"timeLimit":84},{"id":"html_15","language":"html","stage":15,"difficulty":"easy","title":"รหัสผ่าน","description":"ด่าน HTML 15: รหัสผ่าน","usage":"password ซ่อนตัวอักษรขณะพิมพ์","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"password\">รหัสผ่าน</label>\n<input id=\"password\" type=\"password\" minlength=\"6\">","outputExplain":"password ซ่อนตัวอักษรขณะพิมพ์","basePoints":250,"rewardPoints":30,"timeLimit":97},{"id":"html_16","language":"html","stage":16,"difficulty":"medium","title":"ตัวเลือก select","description":"ด่าน HTML 16: ตัวเลือก select","usage":"select และ option สร้างรายการเลือก","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"level\">ระดับ</label>\n<select id=\"level\">\n  <option>ง่าย</option>\n  <option>ปานกลาง</option>\n  <option>ยาก</option>\n</select>","outputExplain":"select และ option สร้างรายการเลือก","basePoints":260,"rewardPoints":30,"timeLimit":132},{"id":"html_17","language":"html","stage":17,"difficulty":"medium","title":"checkbox","description":"ด่าน HTML 17: checkbox","usage":"checkbox ใช้เลือกค่าแบบเปิด/ปิด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label>\n  <input type=\"checkbox\">\n  ยอมรับเงื่อนไข\n</label>","outputExplain":"checkbox ใช้เลือกค่าแบบเปิด/ปิด","basePoints":270,"rewardPoints":31,"timeLimit":74},{"id":"html_18","language":"html","stage":18,"difficulty":"medium","title":"radio","description":"ด่าน HTML 18: radio","usage":"radio ใช้เลือกหนึ่งค่าจากกลุ่ม","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label><input type=\"radio\" name=\"mode\"> Classic</label>\n<label><input type=\"radio\" name=\"mode\"> PVP</label>","outputExplain":"radio ใช้เลือกหนึ่งค่าจากกลุ่ม","basePoints":280,"rewardPoints":32,"timeLimit":110},{"id":"html_19","language":"html","stage":19,"difficulty":"medium","title":"textarea","description":"ด่าน HTML 19: textarea","usage":"textarea ใช้รับข้อความหลายบรรทัด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"note\">หมายเหตุ</label>\n<textarea id=\"note\" rows=\"4\"></textarea>","outputExplain":"textarea ใช้รับข้อความหลายบรรทัด","basePoints":290,"rewardPoints":33,"timeLimit":86},{"id":"html_20","language":"html","stage":20,"difficulty":"medium","title":"ฟอร์มสมัคร","description":"ด่าน HTML 20: ฟอร์มสมัคร","usage":"form รวมช่องข้อมูลและปุ่มส่ง","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<form>\n  <label for=\"student\">รหัสนักศึกษา</label>\n  <input id=\"student\" required>\n  <button type=\"submit\">สมัคร</button>\n</form>","outputExplain":"form รวมช่องข้อมูลและปุ่มส่ง","basePoints":300,"rewardPoints":34,"timeLimit":126},{"id":"html_21","language":"html","stage":21,"difficulty":"medium","title":"header","description":"ด่าน HTML 21: header","usage":"header คือส่วนหัวของหน้า/ส่วน","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<header>\n  <h1>Code Typing</h1>\n  <p>ฝึกพิมพ์โค้ดให้แม่นยำ</p>\n</header>","outputExplain":"header คือส่วนหัวของหน้า/ส่วน","basePoints":310,"rewardPoints":35,"timeLimit":84},{"id":"html_22","language":"html","stage":22,"difficulty":"medium","title":"nav","description":"ด่าน HTML 22: nav","usage":"nav ใช้กับชุดลิงก์นำทาง","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<nav>\n  <a href=\"#home\">หน้าแรก</a>\n  <a href=\"#lesson\">บทเรียน</a>\n  <a href=\"#game\">เกม</a>\n</nav>","outputExplain":"nav ใช้กับชุดลิงก์นำทาง","basePoints":320,"rewardPoints":36,"timeLimit":105},{"id":"html_23","language":"html","stage":23,"difficulty":"medium","title":"main","description":"ด่าน HTML 23: main","usage":"main ครอบเนื้อหาหลัก","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<main>\n  <h1>บทเรียน HTML</h1>\n  <p>เนื้อหาหลักของหน้า</p>\n</main>","outputExplain":"main ครอบเนื้อหาหลัก","basePoints":330,"rewardPoints":37,"timeLimit":79},{"id":"html_24","language":"html","stage":24,"difficulty":"medium","title":"section","description":"ด่าน HTML 24: section","usage":"section แบ่งเนื้อหาเป็นหมวด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<section>\n  <h2>บทที่ 1</h2>\n  <p>พื้นฐาน HTML</p>\n</section>","outputExplain":"section แบ่งเนื้อหาเป็นหมวด","basePoints":340,"rewardPoints":38,"timeLimit":75},{"id":"html_25","language":"html","stage":25,"difficulty":"medium","title":"article","description":"ด่าน HTML 25: article","usage":"article เหมาะกับเนื้อหาอิสระ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<article>\n  <h2>ข่าวการเขียนโปรแกรม</h2>\n  <p>เนื้อหาที่อยู่ได้ด้วยตัวเอง</p>\n</article>","outputExplain":"article เหมาะกับเนื้อหาอิสระ","basePoints":350,"rewardPoints":39,"timeLimit":96},{"id":"html_26","language":"html","stage":26,"difficulty":"medium","title":"aside","description":"ด่าน HTML 26: aside","usage":"aside คือข้อมูลเสริมจากเนื้อหาหลัก","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<main>\n  <article>เนื้อหาหลัก</article>\n  <aside>คำแนะนำเพิ่มเติม</aside>\n</main>","outputExplain":"aside คือข้อมูลเสริมจากเนื้อหาหลัก","basePoints":360,"rewardPoints":41,"timeLimit":90},{"id":"html_27","language":"html","stage":27,"difficulty":"medium","title":"footer","description":"ด่าน HTML 27: footer","usage":"footer คือส่วนท้าย","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<footer>\n  <p> 2026 Code Academy</p>\n</footer>","outputExplain":"footer คือส่วนท้าย","basePoints":370,"rewardPoints":42,"timeLimit":65},{"id":"html_28","language":"html","stage":28,"difficulty":"medium","title":"figure","description":"ด่าน HTML 28: figure","usage":"figure จัดกลุ่มสื่อกับคำอธิบาย","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<figure>\n  <img src=\"https://picsum.photos/220/100\" alt=\"ตัวอย่าง\">\n  <figcaption>ภาพประกอบบทเรียน</figcaption>\n</figure>","outputExplain":"figure จัดกลุ่มสื่อกับคำอธิบาย","basePoints":380,"rewardPoints":43,"timeLimit":120},{"id":"html_29","language":"html","stage":29,"difficulty":"medium","title":"details","description":"ด่าน HTML 29: details","usage":"details สร้างส่วนเปิด/ปิด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<details>\n  <summary>ดูคำอธิบาย</summary>\n  <p>HTML คือภาษาสำหรับโครงสร้างเว็บ</p>\n</details>","outputExplain":"details สร้างส่วนเปิด/ปิด","basePoints":390,"rewardPoints":44,"timeLimit":99},{"id":"html_30","language":"html","stage":30,"difficulty":"medium","title":"progress","description":"ด่าน HTML 30: progress","usage":"progress แสดงความคืบหน้า","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"progress\">ความคืบหน้า</label>\n<progress id=\"progress\" value=\"65\" max=\"100\">65%</progress>","outputExplain":"progress แสดงความคืบหน้า","basePoints":400,"rewardPoints":45,"timeLimit":105},{"id":"html_31","language":"html","stage":31,"difficulty":"medium","title":"meter","description":"ด่าน HTML 31: meter","usage":"meter แสดงค่าภายในช่วง","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"accuracy\">Accuracy</label>\n<meter id=\"accuracy\" min=\"0\" max=\"100\" value=\"92\">92%</meter>","outputExplain":"meter แสดงค่าภายในช่วง","basePoints":410,"rewardPoints":46,"timeLimit":105},{"id":"html_32","language":"html","stage":32,"difficulty":"medium","title":"time","description":"ด่าน HTML 32: time","usage":"time ระบุวันเวลาอย่างมีความหมาย","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>เริ่มเรียนวันที่ <time datetime=\"2026-08-12\">12 สิงหาคม 2569</time></p>","outputExplain":"time ระบุวันเวลาอย่างมีความหมาย","basePoints":420,"rewardPoints":47,"timeLimit":85},{"id":"html_33","language":"html","stage":33,"difficulty":"medium","title":"mark","description":"ด่าน HTML 33: mark","usage":"mark ไฮไลต์ข้อความ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>คำสำคัญคือ <mark>semantic HTML</mark></p>","outputExplain":"mark ไฮไลต์ข้อความ","basePoints":430,"rewardPoints":48,"timeLimit":63},{"id":"html_34","language":"html","stage":34,"difficulty":"medium","title":"code","description":"ด่าน HTML 34: code","usage":"code ใช้แสดงข้อความโค้ด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<p>ใช้คำสั่ง <code>&lt;h1&gt;</code> เพื่อสร้างหัวข้อ</p>","outputExplain":"code ใช้แสดงข้อความโค้ด","basePoints":440,"rewardPoints":49,"timeLimit":72},{"id":"html_35","language":"html","stage":35,"difficulty":"medium","title":"pre","description":"ด่าน HTML 35: pre","usage":"pre รักษาช่องว่างและบรรทัด","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<pre><code>&lt;h1&gt;Hello&lt;/h1&gt;\n&lt;p&gt;World&lt;/p&gt;</code></pre>","outputExplain":"pre รักษาช่องว่างและบรรทัด","basePoints":450,"rewardPoints":50,"timeLimit":86},{"id":"html_36","language":"html","stage":36,"difficulty":"hard","title":"iframe","description":"ด่าน HTML 36: iframe","usage":"iframe ฝังเอกสารอื่น","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<iframe src=\"https://example.com\" title=\"เว็บไซต์ตัวอย่าง\"></iframe>","outputExplain":"iframe ฝังเอกสารอื่น","basePoints":460,"rewardPoints":52,"timeLimit":81},{"id":"html_37","language":"html","stage":37,"difficulty":"hard","title":"audio","description":"ด่าน HTML 37: audio","usage":"audio ฝังเสียงพร้อม controls","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<audio controls>\n  <source src=\"audio.mp3\" type=\"audio/mpeg\">\n  Browser ไม่รองรับเสียง\n</audio>","outputExplain":"audio ฝังเสียงพร้อม controls","basePoints":470,"rewardPoints":53,"timeLimit":101},{"id":"html_38","language":"html","stage":38,"difficulty":"hard","title":"video","description":"ด่าน HTML 38: video","usage":"video ฝังวิดีโอ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<video controls width=\"320\">\n  <source src=\"video.mp4\" type=\"video/mp4\">\n  Browser ไม่รองรับวิดีโอ\n</video>","outputExplain":"video ฝังวิดีโอ","basePoints":480,"rewardPoints":55,"timeLimit":110},{"id":"html_39","language":"html","stage":39,"difficulty":"hard","title":"picture","description":"ด่าน HTML 39: picture","usage":"picture เลือกรูปตามเงื่อนไข","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<picture>\n  <source media=\"(min-width: 800px)\" srcset=\"large.jpg\">\n  <img src=\"small.jpg\" alt=\"Responsive image\">\n</picture>","outputExplain":"picture เลือกรูปตามเงื่อนไข","basePoints":490,"rewardPoints":56,"timeLimit":123},{"id":"html_40","language":"html","stage":40,"difficulty":"hard","title":"data attributes","description":"ด่าน HTML 40: data attributes","usage":"data-* เก็บข้อมูลเพิ่มเติมบน element","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<button data-level=\"10\" data-mode=\"classic\">เล่น Level 10</button>","outputExplain":"data-* เก็บข้อมูลเพิ่มเติมบน element","basePoints":500,"rewardPoints":57,"timeLimit":79},{"id":"html_41","language":"html","stage":41,"difficulty":"hard","title":"ARIA label","description":"ด่าน HTML 41: ARIA label","usage":"aria-label ช่วย Screen Reader","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<button aria-label=\"ปิดหน้าต่าง\"></button>","outputExplain":"aria-label ช่วย Screen Reader","basePoints":510,"rewardPoints":58,"timeLimit":62},{"id":"html_42","language":"html","stage":42,"difficulty":"hard","title":"fieldset","description":"ด่าน HTML 42: fieldset","usage":"fieldset จัดกลุ่มช่องฟอร์ม","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<form>\n  <fieldset>\n    <legend>ข้อมูลผู้เล่น</legend>\n    <label>ชื่อ <input type=\"text\"></label>\n  </fieldset>\n</form>","outputExplain":"fieldset จัดกลุ่มช่องฟอร์ม","basePoints":520,"rewardPoints":60,"timeLimit":120},{"id":"html_43","language":"html","stage":43,"difficulty":"hard","title":"datalist","description":"ด่าน HTML 43: datalist","usage":"datalist ให้คำแนะนำใน input","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<label for=\"lang\">ภาษา</label>\n<input id=\"lang\" list=\"languages\">\n<datalist id=\"languages\">\n  <option value=\"HTML\">\n  <option value=\"Python\">\n</datalist>","outputExplain":"datalist ให้คำแนะนำใน input","basePoints":530,"rewardPoints":61,"timeLimit":144},{"id":"html_44","language":"html","stage":44,"difficulty":"hard","title":"output","description":"ด่าน HTML 44: output","usage":"output แสดงผลการคำนวณ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<form oninput=\"result.value=Number(a.value)+Number(b.value)\">\n  <input id=\"a\" type=\"number\" value=\"2\"> +\n  <input id=\"b\" type=\"number\" value=\"3\"> =\n  <output name=\"result\">5</output>\n</form>","outputExplain":"output แสดงผลการคำนวณ","basePoints":540,"rewardPoints":62,"timeLimit":172},{"id":"html_45","language":"html","stage":45,"difficulty":"hard","title":"template","description":"ด่าน HTML 45: template","usage":"template เก็บ markup ที่ยังไม่ render","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<template id=\"cardTemplate\">\n  <article class=\"card\">\n    <h2>Template Card</h2>\n  </article>\n</template>","outputExplain":"template เก็บ markup ที่ยังไม่ render","basePoints":550,"rewardPoints":64,"timeLimit":108},{"id":"html_46","language":"html","stage":46,"difficulty":"hard","title":"dialog","description":"ด่าน HTML 46: dialog","usage":"dialog ใช้สร้างกล่องโต้ตอบ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<dialog open>\n  <h2>Level Complete</h2>\n  <p>คุณผ่านด่านแล้ว</p>\n  <button>ตกลง</button>\n</dialog>","outputExplain":"dialog ใช้สร้างกล่องโต้ตอบ","basePoints":560,"rewardPoints":65,"timeLimit":103},{"id":"html_47","language":"html","stage":47,"difficulty":"hard","title":"meta viewport","description":"ด่าน HTML 47: meta viewport","usage":"meta viewport ทำให้หน้าเว็บรองรับมือถือ","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Responsive Page</title>\n</head>\n<body>\n  <h1>Responsive HTML</h1>\n</body>\n</html>","outputExplain":"meta viewport ทำให้หน้าเว็บรองรับมือถือ","basePoints":570,"rewardPoints":66,"timeLimit":193},{"id":"html_48","language":"html","stage":48,"difficulty":"hard","title":"หน้า Profile","description":"ด่าน HTML 48: หน้า Profile","usage":"รวม semantic elements เป็นหน้าโปรไฟล์","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<main>\n  <article class=\"profile\">\n    <img src=\"avatar.png\" alt=\"รูปผู้เล่น\">\n    <h1>Pisit</h1>\n    <p>Level 25  2,450 Points</p>\n    <button>แก้ไขตัวละคร</button>\n  </article>\n</main>","outputExplain":"รวม semantic elements เป็นหน้าโปรไฟล์","basePoints":580,"rewardPoints":67,"timeLimit":170},{"id":"html_49","language":"html","stage":49,"difficulty":"hard","title":"หน้า Dashboard","description":"ด่าน HTML 49: หน้า Dashboard","usage":"รวมองค์ประกอบเป็น Dashboard","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<header><h1>Student Dashboard</h1></header>\n<main>\n  <section>\n    <h2>สถิติ</h2>\n    <ul>\n      <li>WPM: 52</li>\n      <li>Accuracy: 98%</li>\n      <li>Points: 3200</li>\n    </ul>\n  </section>\n</main>","outputExplain":"รวมองค์ประกอบเป็น Dashboard","basePoints":590,"rewardPoints":69,"timeLimit":180},{"id":"html_50","language":"html","stage":50,"difficulty":"hard","title":"หน้าเกม Semantic","description":"ด่าน HTML 50: หน้าเกม Semantic","usage":"ด่านสุดท้ายรวมโครงสร้าง HTML5 หลายส่วน","benefit":"ฝึกอ่านและพิมพ์โครงสร้าง HTML ให้แม่นยำ พร้อมเข้าใจหน้าที่ของแท็ก","code":"<!DOCTYPE html>\n<html lang=\"th\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Code Typing Arena</title>\n</head>\n<body>\n  <header>\n    <h1>Code Typing Arena</h1>\n    <nav><a href=\"#classic\">Classic</a> <a href=\"#pvp\">PVP</a></nav>\n  </header>\n  <main>\n    <section id=\"classic\">\n      <h2>Classic Mode</h2>\n      <p>พิมพ์โค้ดให้ถูกต้องและเร็วที่สุด</p>\n      <button type=\"button\">เริ่มเกม</button>\n    </section>\n  </main>\n  <footer> 2026 Nangrong Technical College</footer>\n</body>\n</html>","outputExplain":"ด่านสุดท้ายรวมโครงสร้าง HTML5 หลายส่วน","basePoints":600,"rewardPoints":70,"timeLimit":300},{"id":"python_01","language":"python","stage":1,"difficulty":"easy","title":"print พื้นฐาน","description":"ด่าน Python 1: print พื้นฐาน","usage":"แสดงข้อความ Hello Python","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"print(\"Hello Python\")","outputExplain":"แสดงข้อความ Hello Python","output":"แสดงข้อความ Hello Python","basePoints":112,"rewardPoints":12,"timeLimit":45},{"id":"python_02","language":"python","stage":2,"difficulty":"easy","title":"ตัวแปรข้อความ","description":"ด่าน Python 2: ตัวแปรข้อความ","usage":"เก็บข้อความในตัวแปรแล้วแสดงผล","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"name = \"Pisit\"\nprint(name)","outputExplain":"เก็บข้อความในตัวแปรแล้วแสดงผล","output":"เก็บข้อความในตัวแปรแล้วแสดงผล","basePoints":124,"rewardPoints":13,"timeLimit":49},{"id":"python_03","language":"python","stage":3,"difficulty":"easy","title":"ตัวแปรตัวเลข","description":"ด่าน Python 3: ตัวแปรตัวเลข","usage":"เก็บจำนวนเต็มและแสดงผล","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"score = 95\nprint(score)","outputExplain":"เก็บจำนวนเต็มและแสดงผล","output":"เก็บจำนวนเต็มและแสดงผล","basePoints":136,"rewardPoints":15,"timeLimit":47},{"id":"python_04","language":"python","stage":4,"difficulty":"easy","title":"บวกเลข","description":"ด่าน Python 4: บวกเลข","usage":"คำนวณผลบวก","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"a = 12\nb = 8\nprint(a + b)","outputExplain":"คำนวณผลบวก","output":"คำนวณผลบวก","basePoints":148,"rewardPoints":16,"timeLimit":48},{"id":"python_05","language":"python","stage":5,"difficulty":"easy","title":"คำนวณหลายตัวดำเนินการ","description":"ด่าน Python 5: คำนวณหลายตัวดำเนินการ","usage":"คำนวณราคารวม","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"price = 120\nqty = 3\ntotal = price * qty\nprint(total)","outputExplain":"คำนวณราคารวม","output":"คำนวณราคารวม","basePoints":160,"rewardPoints":17,"timeLimit":69},{"id":"python_06","language":"python","stage":6,"difficulty":"easy","title":"รับข้อความแนวคิด","description":"ด่าน Python 6: รับข้อความแนวคิด","usage":"แสดงหลายค่าในบรรทัดเดียว","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"student = \"Somchai\"\nlevel = \"ปวช.1\"\nprint(student, level)","outputExplain":"แสดงหลายค่าในบรรทัดเดียว","output":"แสดงหลายค่าในบรรทัดเดียว","basePoints":172,"rewardPoints":18,"timeLimit":72},{"id":"python_07","language":"python","stage":7,"difficulty":"easy","title":"f-string","description":"ด่าน Python 7: f-string","usage":"แทรกตัวแปรในข้อความด้วย f-string","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"name = \"Ann\"\nscore = 88\nprint(f\"{name}: {score}\")","outputExplain":"แทรกตัวแปรในข้อความด้วย f-string","output":"แทรกตัวแปรในข้อความด้วย f-string","basePoints":184,"rewardPoints":20,"timeLimit":66},{"id":"python_08","language":"python","stage":8,"difficulty":"easy","title":"boolean","description":"ด่าน Python 8: boolean","usage":"เก็บค่า True/False","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"is_ready = True\nprint(is_ready)","outputExplain":"เก็บค่า True/False","output":"เก็บค่า True/False","basePoints":196,"rewardPoints":21,"timeLimit":53},{"id":"python_09","language":"python","stage":9,"difficulty":"easy","title":"if พื้นฐาน","description":"ด่าน Python 9: if พื้นฐาน","usage":"ตรวจเงื่อนไข","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"score = 70\nif score >= 50:\n    print(\"Pass\")","outputExplain":"ตรวจเงื่อนไข","output":"ตรวจเงื่อนไข","basePoints":208,"rewardPoints":22,"timeLimit":63},{"id":"python_10","language":"python","stage":10,"difficulty":"easy","title":"if else","description":"ด่าน Python 10: if else","usage":"เลือกผลลัพธ์สองทาง","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"score = 45\nif score >= 50:\n    print(\"Pass\")\nelse:\n    print(\"Try again\")","outputExplain":"เลือกผลลัพธ์สองทาง","output":"เลือกผลลัพธ์สองทาง","basePoints":220,"rewardPoints":24,"timeLimit":84},{"id":"python_11","language":"python","stage":11,"difficulty":"easy","title":"if elif else","description":"ด่าน Python 11: if elif else","usage":"ตรวจหลายช่วงคะแนน","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"score = 82\nif score >= 80:\n    print(\"A\")\nelif score >= 70:\n    print(\"B\")\nelse:\n    print(\"C\")","outputExplain":"ตรวจหลายช่วงคะแนน","output":"ตรวจหลายช่วงคะแนน","basePoints":232,"rewardPoints":25,"timeLimit":101},{"id":"python_12","language":"python","stage":12,"difficulty":"easy","title":"and operator","description":"ด่าน Python 12: and operator","usage":"รวมสองเงื่อนไขด้วย and","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"age = 18\nhas_card = True\nif age >= 18 and has_card:\n    print(\"Allowed\")","outputExplain":"รวมสองเงื่อนไขด้วย and","output":"รวมสองเงื่อนไขด้วย and","basePoints":244,"rewardPoints":26,"timeLimit":84},{"id":"python_13","language":"python","stage":13,"difficulty":"easy","title":"or operator","description":"ด่าน Python 13: or operator","usage":"ใช้ or เมื่อผ่านได้อย่างใดอย่างหนึ่ง","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"role = \"teacher\"\nif role == \"admin\" or role == \"teacher\":\n    print(\"Access\")","outputExplain":"ใช้ or เมื่อผ่านได้อย่างใดอย่างหนึ่ง","output":"ใช้ or เมื่อผ่านได้อย่างใดอย่างหนึ่ง","basePoints":256,"rewardPoints":27,"timeLimit":87},{"id":"python_14","language":"python","stage":14,"difficulty":"easy","title":"list","description":"ด่าน Python 14: list","usage":"สร้าง list","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"languages = [\"HTML\", \"CSS\", \"Python\"]\nprint(languages)","outputExplain":"สร้าง list","output":"สร้าง list","basePoints":268,"rewardPoints":29,"timeLimit":70},{"id":"python_15","language":"python","stage":15,"difficulty":"easy","title":"index list","description":"ด่าน Python 15: index list","usage":"เข้าถึงสมาชิกด้วย index","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"languages = [\"HTML\", \"CSS\", \"Python\"]\nprint(languages[0])","outputExplain":"เข้าถึงสมาชิกด้วย index","output":"เข้าถึงสมาชิกด้วย index","basePoints":280,"rewardPoints":30,"timeLimit":72},{"id":"python_16","language":"python","stage":16,"difficulty":"medium","title":"append list","description":"ด่าน Python 16: append list","usage":"เพิ่มสมาชิก list","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"scores = [70, 80]\nscores.append(90)\nprint(scores)","outputExplain":"เพิ่มสมาชิก list","output":"เพิ่มสมาชิก list","basePoints":292,"rewardPoints":30,"timeLimit":66},{"id":"python_17","language":"python","stage":17,"difficulty":"medium","title":"for loop","description":"ด่าน Python 17: for loop","usage":"วนซ้ำสมาชิก","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"for number in [1, 2, 3]:\n    print(number)","outputExplain":"วนซ้ำสมาชิก","output":"วนซ้ำสมาชิก","basePoints":304,"rewardPoints":31,"timeLimit":61},{"id":"python_18","language":"python","stage":18,"difficulty":"medium","title":"range","description":"ด่าน Python 18: range","usage":"วนซ้ำช่วงตัวเลข","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"for i in range(5):\n    print(i)","outputExplain":"วนซ้ำช่วงตัวเลข","output":"วนซ้ำช่วงตัวเลข","basePoints":316,"rewardPoints":32,"timeLimit":53},{"id":"python_19","language":"python","stage":19,"difficulty":"medium","title":"while loop","description":"ด่าน Python 19: while loop","usage":"วนซ้ำด้วย while","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"count = 1\nwhile count <= 3:\n    print(count)\n    count += 1","outputExplain":"วนซ้ำด้วย while","output":"วนซ้ำด้วย while","basePoints":328,"rewardPoints":33,"timeLimit":74},{"id":"python_20","language":"python","stage":20,"difficulty":"medium","title":"break","description":"ด่าน Python 20: break","usage":"หยุด loop ด้วย break","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"for i in range(10):\n    if i == 5:\n        break\n    print(i)","outputExplain":"หยุด loop ด้วย break","output":"หยุด loop ด้วย break","basePoints":340,"rewardPoints":34,"timeLimit":75},{"id":"python_21","language":"python","stage":21,"difficulty":"medium","title":"continue","description":"ด่าน Python 21: continue","usage":"ข้ามรอบด้วย continue","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"for i in range(6):\n    if i == 3:\n        continue\n    print(i)","outputExplain":"ข้ามรอบด้วย continue","output":"ข้ามรอบด้วย continue","basePoints":352,"rewardPoints":35,"timeLimit":77},{"id":"python_22","language":"python","stage":22,"difficulty":"medium","title":"function","description":"ด่าน Python 22: function","usage":"สร้างและเรียกฟังก์ชัน","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def greet():\n    print(\"Hello\")\n\ngreet()","outputExplain":"สร้างและเรียกฟังก์ชัน","output":"สร้างและเรียกฟังก์ชัน","basePoints":364,"rewardPoints":36,"timeLimit":60},{"id":"python_23","language":"python","stage":23,"difficulty":"medium","title":"function parameter","description":"ด่าน Python 23: function parameter","usage":"ส่ง parameter เข้าฟังก์ชัน","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def greet(name):\n    print(f\"Hello {name}\")\n\ngreet(\"Pisit\")","outputExplain":"ส่ง parameter เข้าฟังก์ชัน","output":"ส่ง parameter เข้าฟังก์ชัน","basePoints":376,"rewardPoints":37,"timeLimit":74},{"id":"python_24","language":"python","stage":24,"difficulty":"medium","title":"return","description":"ด่าน Python 24: return","usage":"คืนค่าจากฟังก์ชัน","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def add(a, b):\n    return a + b\n\nresult = add(4, 6)\nprint(result)","outputExplain":"คืนค่าจากฟังก์ชัน","output":"คืนค่าจากฟังก์ชัน","basePoints":388,"rewardPoints":38,"timeLimit":78},{"id":"python_25","language":"python","stage":25,"difficulty":"medium","title":"default parameter","description":"ด่าน Python 25: default parameter","usage":"กำหนดค่าเริ่มต้น parameter","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def greet(name=\"Student\"):\n    print(f\"Hello {name}\")\n\ngreet()\ngreet(\"Ann\")","outputExplain":"กำหนดค่าเริ่มต้น parameter","output":"กำหนดค่าเริ่มต้น parameter","basePoints":400,"rewardPoints":39,"timeLimit":86},{"id":"python_26","language":"python","stage":26,"difficulty":"medium","title":"tuple","description":"ด่าน Python 26: tuple","usage":"ใช้ tuple เก็บค่าคงรูป","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"point = (10, 20)\nprint(point[0], point[1])","outputExplain":"ใช้ tuple เก็บค่าคงรูป","output":"ใช้ tuple เก็บค่าคงรูป","basePoints":412,"rewardPoints":41,"timeLimit":61},{"id":"python_27","language":"python","stage":27,"difficulty":"medium","title":"set","description":"ด่าน Python 27: set","usage":"set ตัดค่าซ้ำ","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"skills = {\"HTML\", \"Python\", \"HTML\"}\nprint(skills)","outputExplain":"set ตัดค่าซ้ำ","output":"set ตัดค่าซ้ำ","basePoints":424,"rewardPoints":42,"timeLimit":66},{"id":"python_28","language":"python","stage":28,"difficulty":"medium","title":"dictionary","description":"ด่าน Python 28: dictionary","usage":"เก็บข้อมูลแบบ key-value","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"student = {\"name\": \"Ann\", \"score\": 90}\nprint(student[\"name\"])","outputExplain":"เก็บข้อมูลแบบ key-value","output":"เก็บข้อมูลแบบ key-value","basePoints":436,"rewardPoints":43,"timeLimit":75},{"id":"python_29","language":"python","stage":29,"difficulty":"medium","title":"dictionary loop","description":"ด่าน Python 29: dictionary loop","usage":"วน dictionary","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"scores = {\"Ann\": 80, \"Boy\": 70}\nfor name, score in scores.items():\n    print(name, score)","outputExplain":"วน dictionary","output":"วน dictionary","basePoints":448,"rewardPoints":44,"timeLimit":96},{"id":"python_30","language":"python","stage":30,"difficulty":"medium","title":"list comprehension","description":"ด่าน Python 30: list comprehension","usage":"สร้าง list แบบย่อ","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"squares = [n * n for n in range(1, 6)]\nprint(squares)","outputExplain":"สร้าง list แบบย่อ","output":"สร้าง list แบบย่อ","basePoints":460,"rewardPoints":45,"timeLimit":69},{"id":"python_31","language":"python","stage":31,"difficulty":"medium","title":"filter comprehension","description":"ด่าน Python 31: filter comprehension","usage":"กรองข้อมูลด้วย comprehension","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"scores = [40, 55, 72, 90]\npassed = [s for s in scores if s >= 50]\nprint(passed)","outputExplain":"กรองข้อมูลด้วย comprehension","output":"กรองข้อมูลด้วย comprehension","basePoints":472,"rewardPoints":46,"timeLimit":89},{"id":"python_32","language":"python","stage":32,"difficulty":"medium","title":"string methods","description":"ด่าน Python 32: string methods","usage":"ใช้ method ของ string","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"text = \"  Python Game  \"\nprint(text.strip().upper())","outputExplain":"ใช้ method ของ string","output":"ใช้ method ของ string","basePoints":484,"rewardPoints":47,"timeLimit":69},{"id":"python_33","language":"python","stage":33,"difficulty":"medium","title":"split join","description":"ด่าน Python 33: split join","usage":"แยกและรวมข้อความ","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"text = \"HTML,CSS,Python\"\nitems = text.split(\",\")\nprint(\" | \".join(items))","outputExplain":"แยกและรวมข้อความ","output":"แยกและรวมข้อความ","basePoints":496,"rewardPoints":48,"timeLimit":84},{"id":"python_34","language":"python","stage":34,"difficulty":"medium","title":"enumerate","description":"ด่าน Python 34: enumerate","usage":"วนพร้อมเลขลำดับ","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"languages = [\"HTML\", \"CSS\", \"Python\"]\nfor index, lang in enumerate(languages, start=1):\n    print(index, lang)","outputExplain":"วนพร้อมเลขลำดับ","output":"วนพร้อมเลขลำดับ","basePoints":508,"rewardPoints":49,"timeLimit":112},{"id":"python_35","language":"python","stage":35,"difficulty":"medium","title":"zip","description":"ด่าน Python 35: zip","usage":"จับคู่หลาย list","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"names = [\"Ann\", \"Boy\"]\nscores = [90, 75]\nfor name, score in zip(names, scores):\n    print(name, score)","outputExplain":"จับคู่หลาย list","output":"จับคู่หลาย list","basePoints":520,"rewardPoints":50,"timeLimit":106},{"id":"python_36","language":"python","stage":36,"difficulty":"hard","title":"try except","description":"ด่าน Python 36: try except","usage":"จัดการข้อผิดพลาด","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"try:\n    number = int(\"abc\")\nexcept ValueError:\n    print(\"Invalid number\")","outputExplain":"จัดการข้อผิดพลาด","output":"จัดการข้อผิดพลาด","basePoints":532,"rewardPoints":52,"timeLimit":86},{"id":"python_37","language":"python","stage":37,"difficulty":"hard","title":"raise","description":"ด่าน Python 37: raise","usage":"สร้าง error เมื่อข้อมูลไม่ถูกต้อง","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def check_score(score):\n    if score < 0:\n        raise ValueError(\"Score must be positive\")\n    return score\n\nprint(check_score(80))","outputExplain":"สร้าง error เมื่อข้อมูลไม่ถูกต้อง","output":"สร้าง error เมื่อข้อมูลไม่ถูกต้อง","basePoints":544,"rewardPoints":53,"timeLimit":129},{"id":"python_38","language":"python","stage":38,"difficulty":"hard","title":"class พื้นฐาน","description":"ด่าน Python 38: class พื้นฐาน","usage":"สร้าง class และ object","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class Student:\n    pass\n\nstudent = Student()\nprint(type(student).__name__)","outputExplain":"สร้าง class และ object","output":"สร้าง class และ object","basePoints":556,"rewardPoints":55,"timeLimit":85},{"id":"python_39","language":"python","stage":39,"difficulty":"hard","title":"constructor","description":"ด่าน Python 39: constructor","usage":"ใช้ __init__ กำหนดค่า object","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class Student:\n    def __init__(self, name):\n        self.name = name\n\nstudent = Student(\"Ann\")\nprint(student.name)","outputExplain":"ใช้ __init__ กำหนดค่า object","output":"ใช้ __init__ กำหนดค่า object","basePoints":568,"rewardPoints":56,"timeLimit":116},{"id":"python_40","language":"python","stage":40,"difficulty":"hard","title":"method","description":"ด่าน Python 40: method","usage":"สร้าง method ภายใน class","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class Counter:\n    def __init__(self):\n        self.value = 0\n\n    def add(self):\n        self.value += 1\n\ncounter = Counter()\ncounter.add()\nprint(counter.value)","outputExplain":"สร้าง method ภายใน class","output":"สร้าง method ภายใน class","basePoints":580,"rewardPoints":57,"timeLimit":150},{"id":"python_41","language":"python","stage":41,"difficulty":"hard","title":"inheritance","description":"ด่าน Python 41: inheritance","usage":"สืบทอด class","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class Player:\n    def move(self):\n        print(\"Move\")\n\nclass Coder(Player):\n    def type_code(self):\n        print(\"Typing\")\n\ncoder = Coder()\ncoder.move()\ncoder.type_code()","outputExplain":"สืบทอด class","output":"สืบทอด class","basePoints":592,"rewardPoints":58,"timeLimit":160},{"id":"python_42","language":"python","stage":42,"difficulty":"hard","title":"property","description":"ด่าน Python 42: property","usage":"ใช้ property","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class Player:\n    def __init__(self, score):\n        self._score = score\n\n    @property\n    def score(self):\n        return self._score\n\nplayer = Player(100)\nprint(player.score)","outputExplain":"ใช้ property","output":"ใช้ property","basePoints":604,"rewardPoints":60,"timeLimit":162},{"id":"python_43","language":"python","stage":43,"difficulty":"hard","title":"lambda","description":"ด่าน Python 43: lambda","usage":"ใช้ lambda ฟังก์ชันสั้น","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"numbers = [3, 1, 2]\nnumbers.sort(key=lambda n: n)\nprint(numbers)","outputExplain":"ใช้ lambda ฟังก์ชันสั้น","output":"ใช้ lambda ฟังก์ชันสั้น","basePoints":616,"rewardPoints":61,"timeLimit":78},{"id":"python_44","language":"python","stage":44,"difficulty":"hard","title":"map","description":"ด่าน Python 44: map","usage":"แปลงข้อมูลด้วย map","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"numbers = [1, 2, 3]\ndoubled = list(map(lambda n: n * 2, numbers))\nprint(doubled)","outputExplain":"แปลงข้อมูลด้วย map","output":"แปลงข้อมูลด้วย map","basePoints":628,"rewardPoints":62,"timeLimit":90},{"id":"python_45","language":"python","stage":45,"difficulty":"hard","title":"generator","description":"ด่าน Python 45: generator","usage":"สร้าง generator ด้วย yield","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nfor value in countdown(3):\n    print(value)","outputExplain":"สร้าง generator ด้วย yield","output":"สร้าง generator ด้วย yield","basePoints":640,"rewardPoints":64,"timeLimit":112},{"id":"python_46","language":"python","stage":46,"difficulty":"hard","title":"decorator","description":"ด่าน Python 46: decorator","usage":"ใช้ decorator ครอบฟังก์ชัน","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def logger(func):\n    def wrapper():\n        print(\"Start\")\n        func()\n        print(\"End\")\n    return wrapper\n\n@logger\ndef play():\n    print(\"Playing\")\n\nplay()","outputExplain":"ใช้ decorator ครอบฟังก์ชัน","output":"ใช้ decorator ครอบฟังก์ชัน","basePoints":652,"rewardPoints":65,"timeLimit":153},{"id":"python_47","language":"python","stage":47,"difficulty":"hard","title":"dataclass","description":"ด่าน Python 47: dataclass","usage":"ใช้ dataclass ลด boilerplate","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"from dataclasses import dataclass\n\n@dataclass\nclass Player:\n    name: str\n    score: int\n\nplayer = Player(\"Ann\", 120)\nprint(player)","outputExplain":"ใช้ dataclass ลด boilerplate","output":"ใช้ dataclass ลด boilerplate","basePoints":664,"rewardPoints":66,"timeLimit":128},{"id":"python_48","language":"python","stage":48,"difficulty":"hard","title":"type hints","description":"ด่าน Python 48: type hints","usage":"ใช้ type hints","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"def average(scores: list[int]) -> float:\n    return sum(scores) / len(scores)\n\nprint(average([80, 90, 100]))","outputExplain":"ใช้ type hints","output":"ใช้ type hints","basePoints":676,"rewardPoints":67,"timeLimit":111},{"id":"python_49","language":"python","stage":49,"difficulty":"hard","title":"async function","description":"ด่าน Python 49: async function","usage":"รู้จัก async/await","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"import asyncio\n\nasync def load_data():\n    await asyncio.sleep(0.1)\n    return \"ready\"\n\nprint(asyncio.run(load_data()))","outputExplain":"รู้จัก async/await","output":"รู้จัก async/await","basePoints":688,"rewardPoints":69,"timeLimit":119},{"id":"python_50","language":"python","stage":50,"difficulty":"hard","title":"Mini Game Logic","description":"ด่าน Python 50: Mini Game Logic","usage":"ด่านสุดท้ายจำลอง logic เกมตรวจตัวอักษร","benefit":"ฝึกไวยากรณ์ Python และการอ่านโค้ดแบบไต่ระดับ","code":"class TypingGame:\n    def __init__(self, target):\n        self.target = target\n        self.position = 0\n        self.mistakes = 0\n\n    def type_char(self, char):\n        expected = self.target[self.position]\n        if char == expected:\n            self.position += 1\n            return True\n        self.mistakes += 1\n        return False\n\n    def completed(self):\n        return self.position == len(self.target)\n\ngame = TypingGame(\"code\")\nfor char in \"code\":\n    game.type_char(char)\n\nprint(game.completed(), game.mistakes)","outputExplain":"ด่านสุดท้ายจำลอง logic เกมตรวจตัวอักษร","output":"ด่านสุดท้ายจำลอง logic เกมตรวจตัวอักษร","basePoints":700,"rewardPoints":70,"timeLimit":300}]$v197stages$::jsonb)
  as x(
    id text, language text, stage integer, difficulty text, title text,
    description text, usage text, benefit text, code text,
    "basePoints" integer, "rewardPoints" integer, "timeLimit" integer, output text, "outputExplain" text
  )
)
insert into public.programming_activity_stages_v197(
  id,subject_id,language,stage_no,difficulty,title,description,usage,benefit,code_target,
  base_points,reward_points,time_limit_seconds,active,source_version
)
select x.id,s.id,x.language,x.stage,x.difficulty,x.title,x.description,x.usage,x.benefit,x.code,
       coalesce(x."basePoints",100),coalesce(x."rewardPoints",1),coalesce(x."timeLimit",90),true,'Code Typing Academy V6.0.2'
from src x cross join target_subject s
on conflict(id) do update set
  subject_id=excluded.subject_id,language=excluded.language,stage_no=excluded.stage_no,difficulty=excluded.difficulty,
  title=excluded.title,description=excluded.description,usage=excluded.usage,benefit=excluded.benefit,
  code_target=excluded.code_target,base_points=excluded.base_points,reward_points=excluded.reward_points,
  time_limit_seconds=excluded.time_limit_seconds,active=true,source_version=excluded.source_version;

with target_subject as (
  select id from public.subjects where code='21910-2010' and active=true and subject_type='subject' limit 1
), src as (
  select *
  from jsonb_to_recordset($v197official$[{"officialStage":1,"language":"html","languageName":"HTML","sourceStage":1,"title":"โครงสร้าง HTML5","maxScore":1,"requiredForSubmission":true},{"officialStage":2,"language":"html","languageName":"HTML","sourceStage":3,"title":"ลิงก์และ Navigation","maxScore":1,"requiredForSubmission":true},{"officialStage":3,"language":"html","languageName":"HTML","sourceStage":5,"title":"รายการข้อมูล","maxScore":1,"requiredForSubmission":true},{"officialStage":4,"language":"html","languageName":"HTML","sourceStage":10,"title":"ตารางพื้นฐาน","maxScore":1,"requiredForSubmission":true},{"officialStage":5,"language":"html","languageName":"HTML","sourceStage":13,"title":"Input และ Label","maxScore":1,"requiredForSubmission":true},{"officialStage":6,"language":"html","languageName":"HTML","sourceStage":16,"title":"Select และ Option","maxScore":1,"requiredForSubmission":true},{"officialStage":7,"language":"html","languageName":"HTML","sourceStage":20,"title":"Form สมัครสมาชิก","maxScore":1,"requiredForSubmission":true},{"officialStage":8,"language":"html","languageName":"HTML","sourceStage":21,"title":"Header","maxScore":1,"requiredForSubmission":true},{"officialStage":9,"language":"html","languageName":"HTML","sourceStage":22,"title":"Nav","maxScore":1,"requiredForSubmission":true},{"officialStage":10,"language":"html","languageName":"HTML","sourceStage":23,"title":"Main","maxScore":1,"requiredForSubmission":true},{"officialStage":11,"language":"html","languageName":"HTML","sourceStage":24,"title":"Section","maxScore":1,"requiredForSubmission":true},{"officialStage":12,"language":"html","languageName":"HTML","sourceStage":25,"title":"Article","maxScore":1,"requiredForSubmission":true},{"officialStage":13,"language":"html","languageName":"HTML","sourceStage":27,"title":"Footer","maxScore":1,"requiredForSubmission":true},{"officialStage":14,"language":"html","languageName":"HTML","sourceStage":28,"title":"Figure","maxScore":1,"requiredForSubmission":true},{"officialStage":15,"language":"html","languageName":"HTML","sourceStage":30,"title":"Progress","maxScore":1,"requiredForSubmission":true},{"officialStage":16,"language":"python","languageName":"Python","sourceStage":1,"title":"print พื้นฐาน","maxScore":1,"requiredForSubmission":true},{"officialStage":17,"language":"python","languageName":"Python","sourceStage":4,"title":"การคำนวณ","maxScore":1,"requiredForSubmission":true},{"officialStage":18,"language":"python","languageName":"Python","sourceStage":9,"title":"if พื้นฐาน","maxScore":1,"requiredForSubmission":true},{"officialStage":19,"language":"python","languageName":"Python","sourceStage":10,"title":"if else","maxScore":1,"requiredForSubmission":true},{"officialStage":20,"language":"python","languageName":"Python","sourceStage":14,"title":"List","maxScore":1,"requiredForSubmission":true},{"officialStage":21,"language":"python","languageName":"Python","sourceStage":17,"title":"For Loop","maxScore":2,"requiredForSubmission":true},{"officialStage":22,"language":"python","languageName":"Python","sourceStage":19,"title":"While Loop","maxScore":2,"requiredForSubmission":true},{"officialStage":23,"language":"python","languageName":"Python","sourceStage":22,"title":"Function","maxScore":2,"requiredForSubmission":true},{"officialStage":24,"language":"python","languageName":"Python","sourceStage":23,"title":"Function Parameter","maxScore":2,"requiredForSubmission":true},{"officialStage":25,"language":"python","languageName":"Python","sourceStage":24,"title":"Return","maxScore":2,"requiredForSubmission":true},{"officialStage":26,"language":"python","languageName":"Python","sourceStage":28,"title":"Dictionary","maxScore":2,"requiredForSubmission":true},{"officialStage":27,"language":"python","languageName":"Python","sourceStage":30,"title":"List Comprehension","maxScore":2,"requiredForSubmission":true},{"officialStage":28,"language":"python","languageName":"Python","sourceStage":36,"title":"Try / Except","maxScore":2,"requiredForSubmission":true},{"officialStage":29,"language":"python","languageName":"Python","sourceStage":39,"title":"Constructor","maxScore":2,"requiredForSubmission":true},{"officialStage":30,"language":"python","languageName":"Python","sourceStage":50,"title":"Mini Game Logic","maxScore":2,"requiredForSubmission":true}]$v197official$::jsonb)
  as x(
    "officialStage" integer, language text, "languageName" text, "sourceStage" integer,
    title text, "maxScore" numeric, "requiredForSubmission" boolean
  )
)
insert into public.programming_activity_official_map_v197(
  subject_id,official_stage_no,stage_id,language,source_stage,title,max_score,required_for_submission
)
select s.id,x."officialStage",x.language||'_'||lpad(x."sourceStage"::text,2,'0'),x.language,x."sourceStage",
       x.title,x."maxScore",coalesce(x."requiredForSubmission",true)
from src x cross join target_subject s
on conflict(subject_id,official_stage_no) do update set
  stage_id=excluded.stage_id,language=excluded.language,source_stage=excluded.source_stage,
  title=excluded.title,max_score=excluded.max_score,required_for_submission=excluded.required_for_submission;

-- Default teacher quests adapted from the source system.
with s as (
  select id from public.subjects where code='21910-2010' and active=true and subject_type='subject' limit 1
), q(source_key,title,description,language,stage_no,difficulty,objective_type,target_value,reward_tokens,min_tier) as (
  values
  ('q_easy_html_03','ฝึก HTML พื้นฐาน','ผ่าน HTML Stage 3 ให้สำเร็จ','html',3,'easy','pass',0,4,'bronze'),
  ('q_easy_python_05','Python แม่นยำ','ผ่าน Python Stage 5 ด้วย Accuracy อย่างน้อย 95%','python',5,'easy','accuracy',95,5,'bronze'),
  ('q_medium_html_20','HTML Speed Challenge','ผ่าน HTML Stage 20 ภายใน 100 วินาที','html',20,'medium','time',100,12,'silver'),
  ('q_medium_python_24','Python Precision','ผ่าน Python Stage 24 ด้วย Accuracy อย่างน้อย 97%','python',24,'medium','accuracy',97,14,'silver'),
  ('q_hard_html_40','HTML Master Run','ผ่าน HTML Stage 40 ภายใน 150 วินาที','html',40,'hard','time',150,18,'platinum'),
  ('q_hard_python_45','Python Perfect Code','ผ่าน Python Stage 45 ด้วย Accuracy อย่างน้อย 99%','python',45,'hard','accuracy',99,20,'platinum')
)
insert into public.programming_activity_quests_v197(
  subject_id,source_key,title,description,language,stage_no,difficulty,objective_type,target_value,reward_tokens,min_tier,active
)
select s.id,q.* ,true from s cross join q
on conflict(subject_id,source_key) do update set
  title=excluded.title,description=excluded.description,language=excluded.language,stage_no=excluded.stage_no,
  difficulty=excluded.difficulty,objective_type=excluded.objective_type,target_value=excluded.target_value,
  reward_tokens=excluded.reward_tokens,min_tier=excluded.min_tier,active=true,updated_at=clock_timestamp();

create or replace function private.programming_activity_access_v197(p_subject_id uuid,p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
  select
    p_uid is not null
    and exists(select 1 from public.subjects s where s.id=p_subject_id and s.code='21910-2010' and s.active=true and s.subject_type='subject')
    and (
      private.is_admin(p_uid)
      or (
        private.can_learn(p_uid)
        and private.subject_classroom_is_open_v194(p_subject_id)
        and exists(
          select 1 from public.subject_enrollments se
          where se.subject_id=p_subject_id and se.user_id=p_uid and se.status='approved'
        )
      )
    )
$$;

revoke all on function private.programming_activity_access_v197(uuid,uuid) from public,anon,authenticated;
grant execute on function private.programming_activity_access_v197(uuid,uuid) to service_role,postgres;

create or replace function private.programming_activity_tier_index_v197(p_tier text)
returns integer language sql immutable
set search_path=pg_catalog
as $$
  select case lower(coalesce(p_tier,'bronze'))
    when 'bronze' then 0 when 'silver' then 1 when 'gold' then 2
    when 'platinum' then 3 when 'diamond' then 4 when 'master' then 5 else 0 end
$$;

create or replace function private.programming_activity_tier_v197(p_rating numeric)
returns text language sql immutable
set search_path=pg_catalog
as $$
  select case
    when coalesce(p_rating,0)>=92 then 'master'
    when coalesce(p_rating,0)>=82 then 'diamond'
    when coalesce(p_rating,0)>=70 then 'platinum'
    when coalesce(p_rating,0)>=55 then 'gold'
    when coalesce(p_rating,0)>=35 then 'silver'
    else 'bronze' end
$$;

revoke all on function private.programming_activity_tier_index_v197(text) from public,anon,authenticated;
revoke all on function private.programming_activity_tier_v197(numeric) from public,anon,authenticated;
grant execute on function private.programming_activity_tier_index_v197(text) to service_role,postgres;
grant execute on function private.programming_activity_tier_v197(numeric) to service_role,postgres;

create or replace function private.programming_activity_rating_v197(p_subject_id uuid,p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_count integer:=0;
  v_speed numeric:=0; v_accuracy numeric:=0; v_mistake numeric:=0; v_progress numeric:=0;
  v_rating numeric:=0; v_best_wpm numeric:=0; v_avg_accuracy numeric:=0;
  v_html integer:=0; v_python integer:=0; v_tier text:='bronze';
begin
  with ranked as (
    select a.*,
      case st.difficulty when 'easy' then 28 when 'medium' then 42 else 58 end::numeric target_wpm,
      case when a.passed then 1::numeric else 0.65::numeric end factor
    from public.programming_activity_attempts_v197 a
    join public.programming_activity_stages_v197 st on st.id=a.stage_id
    where a.subject_id=p_subject_id and a.user_id=p_user_id and a.mode='ranking'
      and a.created_at>=clock_timestamp()-interval '60 days'
  )
  select count(*)::int,
    coalesce(avg(least(100,wpm/nullif(target_wpm,0)*100)*factor),0),
    coalesce(avg(accuracy*factor),0),
    coalesce(avg(greatest(0,100-mistakes*10)*factor),0),
    coalesce(max(wpm),0),coalesce(avg(accuracy),0)
  into v_count,v_speed,v_accuracy,v_mistake,v_best_wpm,v_avg_accuracy
  from ranked;

  select coalesce(max(st.stage_no) filter(where st.language='html'),0),
         coalesce(max(st.stage_no) filter(where st.language='python'),0)
  into v_html,v_python
  from public.programming_activity_attempts_v197 a
  join public.programming_activity_stages_v197 st on st.id=a.stage_id
  where a.subject_id=p_subject_id and a.user_id=p_user_id and a.passed;

  v_progress:=least(100,greatest(0,(v_html+v_python)::numeric));
  if v_count>0 then
    v_rating:=round((least(100,v_speed)*0.35 + least(100,v_accuracy)*0.35 + least(100,v_mistake)*0.20 + v_progress*0.10)::numeric,1);
  end if;
  v_tier:=private.programming_activity_tier_v197(v_rating);

  return jsonb_build_object(
    'rating',v_rating,'tier',v_tier,'ranked_attempts',v_count,
    'speed',round(v_speed,1),'accuracy',round(v_accuracy,1),'mistake_control',round(v_mistake,1),
    'stage_progress',round(v_progress,1),'html_best_stage',v_html,'python_best_stage',v_python,
    'best_wpm',round(v_best_wpm,1),'avg_accuracy',round(v_avg_accuracy,1)
  );
end;
$$;

revoke all on function private.programming_activity_rating_v197(uuid,uuid) from public,anon,authenticated;
grant execute on function private.programming_activity_rating_v197(uuid,uuid) to service_role,postgres;

create or replace function public.my_programming_activity_progress_v197(p_subject_id uuid)
returns table(
  stage_id text, completed boolean, attempts_count integer,
  best_wpm numeric, best_accuracy numeric, best_time numeric
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if not private.programming_activity_access_v197(p_subject_id,auth.uid()) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  return query
  select st.id,
    coalesce(bool_or(a.passed),false),
    count(a.id)::int,
    round(coalesce(max(a.wpm),0),1),
    round(coalesce(max(a.accuracy),0),1),
    round(coalesce(min(a.elapsed_seconds) filter(where a.passed),0),2)
  from public.programming_activity_stages_v197 st
  left join public.programming_activity_attempts_v197 a
    on a.stage_id=st.id and a.user_id=auth.uid() and a.subject_id=p_subject_id
  where st.subject_id=p_subject_id and st.active
  group by st.id;
end;
$$;

revoke all on function public.my_programming_activity_progress_v197(uuid) from public,anon;
grant execute on function public.my_programming_activity_progress_v197(uuid) to authenticated,service_role;

create or replace function public.my_programming_activity_home_v197(p_subject_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_settings public.programming_activity_settings_v197%rowtype;
  v_tokens integer:=0; v_lifetime integer:=0; v_completed integer:=0; v_total_attempts integer:=0;
  v_best_wpm numeric:=0; v_avg_accuracy numeric:=0; v_focus_seconds integer:=0; v_focus_claimed boolean:=false;
  v_rating jsonb:='{}'::jsonb; v_quests jsonb:='[]'::jsonb; v_official jsonb:='{}'::jsonb;
  v_today date:=timezone('Asia/Bangkok',clock_timestamp())::date; v_tier text:='bronze';
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into v_settings from public.programming_activity_settings_v197 where subject_id=p_subject_id;
  if v_settings.subject_id is null then raise exception 'PROGRAMMING_ACTIVITY_NOT_CONFIGURED'; end if;

  select coalesce(w.tokens,0),coalesce(w.lifetime_tokens,0) into v_tokens,v_lifetime
  from (select 1) z left join public.programming_activity_wallets_v197 w on w.subject_id=p_subject_id and w.user_id=v_uid;

  select count(distinct stage_id) filter(where passed),count(*)::int,coalesce(max(wpm),0),coalesce(avg(accuracy),0)
  into v_completed,v_total_attempts,v_best_wpm,v_avg_accuracy
  from public.programming_activity_attempts_v197 where subject_id=p_subject_id and user_id=v_uid;

  select coalesce(f.seconds_active,0),coalesce(f.reward_claimed,false)
  into v_focus_seconds,v_focus_claimed
  from (select 1) z left join public.programming_activity_focus_v197 f
    on f.subject_id=p_subject_id and f.user_id=v_uid and f.focus_date=v_today;

  v_rating:=private.programming_activity_rating_v197(p_subject_id,v_uid);
  v_tier:=coalesce(v_rating->>'tier','bronze');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'title',q.title,'description',q.description,'language',q.language,'stage_no',q.stage_no,
    'difficulty',q.difficulty,'objective_type',q.objective_type,'target_value',q.target_value,
    'reward_tokens',q.reward_tokens,'min_tier',q.min_tier,'open_at',q.open_at,'due_at',q.due_at,
    'completed',(qc.quest_id is not null),
    'locked',(private.programming_activity_tier_index_v197(v_tier)<private.programming_activity_tier_index_v197(q.min_tier))
  ) order by q.difficulty,q.stage_no),'[]'::jsonb)
  into v_quests
  from public.programming_activity_quests_v197 q
  left join public.programming_activity_quest_completions_v197 qc on qc.quest_id=q.id and qc.user_id=v_uid
  where q.subject_id=p_subject_id and q.active
    and (q.open_at is null or q.open_at<=clock_timestamp())
    and (q.due_at is null or q.due_at>=clock_timestamp());

  select jsonb_build_object(
    'completed',count(r.official_stage_no),
    'live_score',round(coalesce(sum(r.best_score),0),2),
    'max_score',40,
    'submitted',(sub.user_id is not null),
    'submitted_score',coalesce(sub.total_score,0),
    'submitted_at',sub.submitted_at
  )
  into v_official
  from public.programming_activity_official_results_v197 r
  right join (select 1) z on true
  left join public.programming_activity_official_submissions_v197 sub
    on sub.subject_id=p_subject_id and sub.user_id=v_uid
  where (r.subject_id=p_subject_id and r.user_id=v_uid) or r.user_id is null
  group by sub.user_id,sub.total_score,sub.submitted_at;

  return jsonb_build_object(
    'settings',to_jsonb(v_settings)-'updated_by',
    'profile',jsonb_build_object(
      'tokens',v_tokens,'lifetime_tokens',v_lifetime,'completed_stages',coalesce(v_completed,0),
      'total_attempts',coalesce(v_total_attempts,0),'best_wpm',round(coalesce(v_best_wpm,0),1),
      'avg_accuracy',round(coalesce(v_avg_accuracy,0),1),'rating',v_rating
    ),
    'focus',jsonb_build_object(
      'date',v_today,'seconds',v_focus_seconds,'target_seconds',v_settings.focus_target_minutes*60,
      'reward_tokens',v_settings.focus_reward_tokens,'reward_claimed',v_focus_claimed
    ),
    'quests',v_quests,'official',coalesce(v_official,'{"completed":0,"live_score":0,"max_score":40,"submitted":false}'::jsonb),
    'server_time',clock_timestamp()
  );
end;
$$;

revoke all on function public.my_programming_activity_home_v197(uuid) from public,anon;
grant execute on function public.my_programming_activity_home_v197(uuid) to authenticated,service_role;

create or replace function public.submit_programming_stage_v197(
  p_subject_id uuid,
  p_stage_id text,
  p_typed_text text,
  p_elapsed_seconds numeric,
  p_mistakes integer default 0,
  p_mode text default 'practice',
  p_official_stage_no integer default null,
  p_request_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); st public.programming_activity_stages_v197%rowtype;
  cfg public.programming_activity_settings_v197%rowtype; existing public.programming_activity_attempts_v197%rowtype;
  v_target text; v_typed text; v_chars integer; v_mistakes integer; v_elapsed numeric;
  v_wpm numeric; v_accuracy numeric; v_target_wpm numeric; v_speed_factor numeric; v_accuracy_factor numeric;
  v_reward integer:=0; v_quest_reward integer:=0; v_points integer:=0; v_passed boolean:=false; v_first_pass boolean:=false;
  v_attempt_id uuid; v_official_max numeric; v_official_score numeric; v_rank jsonb; q record; v_inserted integer;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id for share;
  if cfg.subject_id is null or not cfg.enabled then raise exception 'PROGRAMMING_ACTIVITY_CLOSED'; end if;
  if p_mode not in ('practice','ranking','official') then raise exception 'PROGRAMMING_ACTIVITY_MODE_INVALID'; end if;
  if p_mode='ranking' and not cfg.leaderboard_enabled then raise exception 'PROGRAMMING_RANKING_DISABLED'; end if;
  if p_mode='official' and not cfg.official_enabled then raise exception 'PROGRAMMING_OFFICIAL_DISABLED'; end if;

  perform pg_advisory_xact_lock(hashtextextended('prog-v197:'||v_uid::text||':'||coalesce(p_request_key::text,''),0));

  select * into existing from public.programming_activity_attempts_v197
  where user_id=v_uid and request_key=p_request_key;
  if existing.id is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'attempt_id',existing.id,'passed',existing.passed,
      'wpm',existing.wpm,'accuracy',existing.accuracy,'mistakes',existing.mistakes,
      'points',existing.points,'reward_tokens',existing.reward_tokens);
  end if;

  select * into st from public.programming_activity_stages_v197
  where id=p_stage_id and subject_id=p_subject_id and active;
  if st.id is null then raise exception 'PROGRAMMING_STAGE_NOT_FOUND'; end if;

  if p_mode<>'official' and cfg.sequential_unlock and st.stage_no>1
     and not exists(
       select 1 from public.programming_activity_attempts_v197 a
       join public.programming_activity_stages_v197 p on p.id=a.stage_id
       where a.subject_id=p_subject_id and a.user_id=v_uid and a.passed
         and p.language=st.language and p.stage_no=st.stage_no-1
     )
  then raise exception 'PROGRAMMING_STAGE_LOCKED'; end if;

  if p_mode='official' then
    select m.max_score into v_official_max
    from public.programming_activity_official_map_v197 m
    where m.subject_id=p_subject_id and m.official_stage_no=p_official_stage_no and m.stage_id=st.id;
    if v_official_max is null then raise exception 'PROGRAMMING_OFFICIAL_STAGE_INVALID'; end if;
  end if;

  v_target:=replace(replace(st.code_target,E'\r\n',E'\n'),E'\r',E'\n');
  v_typed:=replace(replace(coalesce(p_typed_text,''),E'\r\n',E'\n'),E'\r',E'\n');
  if v_typed<>v_target then raise exception 'PROGRAMMING_CODE_NOT_COMPLETE'; end if;

  v_elapsed:=greatest(0.1,least(7200,coalesce(p_elapsed_seconds,0)));
  if coalesce(p_elapsed_seconds,0)<=0 then raise exception 'PROGRAMMING_TIME_INVALID'; end if;
  v_mistakes:=greatest(0,least(100000,coalesce(p_mistakes,0)));
  v_chars:=greatest(1,char_length(v_target));
  v_wpm:=round(((v_chars::numeric/5)/(v_elapsed/60))::numeric,2);
  v_accuracy:=round((v_chars::numeric/(v_chars+v_mistakes)*100)::numeric,2);
  v_passed:=v_accuracy>=cfg.min_accuracy;

  select not exists(
    select 1 from public.programming_activity_attempts_v197
    where subject_id=p_subject_id and user_id=v_uid and stage_id=st.id and passed
  ) into v_first_pass;

  v_target_wpm:=case st.difficulty when 'easy' then 28 when 'medium' then 42 else 58 end;
  v_accuracy_factor:=least(1,greatest(0,v_accuracy/100));
  v_speed_factor:=least(1,greatest(0,v_wpm/nullif(v_target_wpm,0)));
  if v_passed and v_first_pass then
    v_reward:=least(70,greatest(1,round(least(70,st.reward_points)*
      greatest(0.35,v_accuracy_factor*0.70+v_speed_factor*0.30))));
  end if;
  v_points:=greatest(0,round(st.base_points*(v_accuracy/100)+least(st.base_points*0.35,v_wpm*2)-v_mistakes*4));

  insert into public.programming_activity_attempts_v197(
    subject_id,user_id,stage_id,mode,official_stage_no,elapsed_seconds,wpm,accuracy,mistakes,points,reward_tokens,passed,request_key
  ) values(
    p_subject_id,v_uid,st.id,p_mode,p_official_stage_no,v_elapsed,v_wpm,v_accuracy,v_mistakes,v_points,v_reward,v_passed,p_request_key
  ) returning id into v_attempt_id;

  if v_passed and p_mode='official' then
    v_official_score:=round(least(v_official_max,
      v_official_max*(least(1,v_accuracy/100)*0.85 + least(1,st.time_limit_seconds/v_elapsed)*0.15)
    )::numeric,2);
    insert into public.programming_activity_official_results_v197(
      subject_id,user_id,official_stage_no,stage_id,best_score,max_score,wpm,accuracy,elapsed_seconds,attempt_id,updated_at
    ) values(
      p_subject_id,v_uid,p_official_stage_no,st.id,v_official_score,v_official_max,v_wpm,v_accuracy,v_elapsed,v_attempt_id,clock_timestamp()
    )
    on conflict(subject_id,user_id,official_stage_no) do update set
      best_score=case when excluded.best_score>public.programming_activity_official_results_v197.best_score then excluded.best_score else public.programming_activity_official_results_v197.best_score end,
      max_score=excluded.max_score,
      wpm=case when excluded.best_score>public.programming_activity_official_results_v197.best_score then excluded.wpm else public.programming_activity_official_results_v197.wpm end,
      accuracy=case when excluded.best_score>public.programming_activity_official_results_v197.best_score then excluded.accuracy else public.programming_activity_official_results_v197.accuracy end,
      elapsed_seconds=case when excluded.best_score>public.programming_activity_official_results_v197.best_score then excluded.elapsed_seconds else public.programming_activity_official_results_v197.elapsed_seconds end,
      attempt_id=case when excluded.best_score>public.programming_activity_official_results_v197.best_score then excluded.attempt_id else public.programming_activity_official_results_v197.attempt_id end,
      updated_at=clock_timestamp();
  end if;

  if v_passed and cfg.quests_enabled then
    v_rank:=private.programming_activity_rating_v197(p_subject_id,v_uid);
    for q in
      select *
      from public.programming_activity_quests_v197 q
      where q.subject_id=p_subject_id and q.active and q.language=st.language and q.stage_no=st.stage_no
        and (q.open_at is null or q.open_at<=clock_timestamp())
        and (q.due_at is null or q.due_at>=clock_timestamp())
        and private.programming_activity_tier_index_v197(coalesce(v_rank->>'tier','bronze'))>=private.programming_activity_tier_index_v197(q.min_tier)
        and (
          q.objective_type='pass'
          or (q.objective_type='accuracy' and v_accuracy>=q.target_value)
          or (q.objective_type='time' and v_elapsed<=q.target_value)
        )
    loop
      insert into public.programming_activity_quest_completions_v197(quest_id,user_id,attempt_id,reward_tokens)
      values(q.id,v_uid,v_attempt_id,q.reward_tokens)
      on conflict(quest_id,user_id) do nothing;
      get diagnostics v_inserted=row_count;
      if v_inserted>0 then v_quest_reward:=v_quest_reward+q.reward_tokens; end if;
    end loop;
  end if;

  if v_reward+v_quest_reward>0 then
    insert into public.programming_activity_wallets_v197(subject_id,user_id,tokens,lifetime_tokens,updated_at)
    values(p_subject_id,v_uid,v_reward+v_quest_reward,v_reward+v_quest_reward,clock_timestamp())
    on conflict(subject_id,user_id) do update set
      tokens=public.programming_activity_wallets_v197.tokens+excluded.tokens,
      lifetime_tokens=public.programming_activity_wallets_v197.lifetime_tokens+excluded.lifetime_tokens,
      updated_at=clock_timestamp();
  end if;

  return jsonb_build_object(
    'ok',true,'duplicate',false,'attempt_id',v_attempt_id,'passed',v_passed,
    'wpm',v_wpm,'accuracy',v_accuracy,'mistakes',v_mistakes,'points',v_points,
    'reward_tokens',v_reward,'quest_reward_tokens',v_quest_reward,'first_pass',v_first_pass,
    'official_score',v_official_score,'official_max_score',v_official_max,
    'next_stage_unlocked',(v_passed and st.stage_no<50),'min_accuracy',cfg.min_accuracy
  );
end;
$$;

revoke all on function public.submit_programming_stage_v197(uuid,text,text,numeric,integer,text,integer,uuid) from public,anon;
grant execute on function public.submit_programming_stage_v197(uuid,text,text,numeric,integer,text,integer,uuid) to authenticated,service_role;

create or replace function public.update_programming_focus_v197(p_subject_id uuid,p_total_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); cfg public.programming_activity_settings_v197%rowtype;
  v_today date:=timezone('Asia/Bangkok',clock_timestamp())::date;
  v_seconds integer; v_claimed boolean; v_award integer:=0; v_target integer;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
  if cfg.subject_id is null or not cfg.enabled or not cfg.focus_enabled then raise exception 'PROGRAMMING_FOCUS_DISABLED'; end if;
  v_target:=cfg.focus_target_minutes*60;

  insert into public.programming_activity_focus_v197(subject_id,user_id,focus_date,seconds_active,reward_claimed,updated_at)
  values(p_subject_id,v_uid,v_today,least(86400,greatest(0,coalesce(p_total_seconds,0))),false,clock_timestamp())
  on conflict(subject_id,user_id,focus_date) do update set
    seconds_active=greatest(public.programming_activity_focus_v197.seconds_active,excluded.seconds_active),
    updated_at=clock_timestamp();

  select seconds_active,reward_claimed into v_seconds,v_claimed
  from public.programming_activity_focus_v197
  where subject_id=p_subject_id and user_id=v_uid and focus_date=v_today for update;

  if v_seconds>=v_target and not v_claimed and cfg.focus_reward_tokens>0 then
    update public.programming_activity_focus_v197 set reward_claimed=true,updated_at=clock_timestamp()
    where subject_id=p_subject_id and user_id=v_uid and focus_date=v_today;
    v_award:=cfg.focus_reward_tokens;v_claimed:=true;
    insert into public.programming_activity_wallets_v197(subject_id,user_id,tokens,lifetime_tokens,updated_at)
    values(p_subject_id,v_uid,v_award,v_award,clock_timestamp())
    on conflict(subject_id,user_id) do update set
      tokens=public.programming_activity_wallets_v197.tokens+excluded.tokens,
      lifetime_tokens=public.programming_activity_wallets_v197.lifetime_tokens+excluded.lifetime_tokens,
      updated_at=clock_timestamp();
  end if;

  return jsonb_build_object('ok',true,'seconds',v_seconds,'target_seconds',v_target,'reward_claimed',v_claimed,'reward_awarded',v_award);
end;
$$;

revoke all on function public.update_programming_focus_v197(uuid,integer) from public,anon;
grant execute on function public.update_programming_focus_v197(uuid,integer) to authenticated,service_role;

create or replace function public.my_programming_official_v197(p_subject_id uuid)
returns table(
  official_stage_no integer,stage_id text,language text,source_stage integer,title text,max_score numeric,
  completed boolean,best_score numeric,wpm numeric,accuracy numeric,elapsed_seconds numeric
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if not private.programming_activity_access_v197(p_subject_id,auth.uid()) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  return query
  select m.official_stage_no,m.stage_id,m.language,m.source_stage,m.title,m.max_score,
    (r.official_stage_no is not null),coalesce(r.best_score,0),coalesce(r.wpm,0),coalesce(r.accuracy,0),coalesce(r.elapsed_seconds,0)
  from public.programming_activity_official_map_v197 m
  left join public.programming_activity_official_results_v197 r
    on r.subject_id=m.subject_id and r.user_id=auth.uid() and r.official_stage_no=m.official_stage_no
  where m.subject_id=p_subject_id order by m.official_stage_no;
end;
$$;

revoke all on function public.my_programming_official_v197(uuid) from public,anon;
grant execute on function public.my_programming_official_v197(uuid) to authenticated,service_role;

create or replace function public.submit_programming_official_v197(p_subject_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); cfg public.programming_activity_settings_v197%rowtype;
  v_count integer; v_total numeric; v_avg_acc numeric; v_avg_wpm numeric; old public.programming_activity_official_submissions_v197%rowtype;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  select * into cfg from public.programming_activity_settings_v197 where subject_id=p_subject_id;
  if cfg.subject_id is null or not cfg.enabled or not cfg.official_enabled then raise exception 'PROGRAMMING_OFFICIAL_DISABLED'; end if;

  select * into old from public.programming_activity_official_submissions_v197 where subject_id=p_subject_id and user_id=v_uid;
  if old.user_id is not null then
    return jsonb_build_object('ok',true,'already_submitted',true,'total_score',old.total_score,'max_score',old.max_score,'submitted_at',old.submitted_at);
  end if;

  select count(*),round(coalesce(sum(best_score),0),2),round(coalesce(avg(accuracy),0),1),round(coalesce(avg(wpm),0),1)
  into v_count,v_total,v_avg_acc,v_avg_wpm
  from public.programming_activity_official_results_v197 where subject_id=p_subject_id and user_id=v_uid;
  if v_count<>30 then raise exception 'PROGRAMMING_OFFICIAL_INCOMPLETE'; end if;

  insert into public.programming_activity_official_submissions_v197(
    subject_id,user_id,completed_stages,total_score,max_score,avg_accuracy,avg_wpm
  ) values(p_subject_id,v_uid,30,v_total,40,v_avg_acc,v_avg_wpm);

  return jsonb_build_object('ok',true,'already_submitted',false,'completed_stages',30,'total_score',v_total,'max_score',40,'avg_accuracy',v_avg_acc,'avg_wpm',v_avg_wpm,'submitted_at',clock_timestamp());
end;
$$;

revoke all on function public.submit_programming_official_v197(uuid) from public,anon;
grant execute on function public.submit_programming_official_v197(uuid) to authenticated,service_role;

create or replace function public.programming_activity_leaderboard_v197(p_subject_id uuid,p_scope text default 'class')
returns table(
  rank_no bigint,user_id uuid,student_code text,full_name text,class_name text,
  rating numeric,tier text,completed_stages integer,best_wpm numeric,avg_accuracy numeric,tokens integer
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_grade text; v_room text;
begin
  if not private.programming_activity_access_v197(p_subject_id,v_uid) then raise exception 'PROGRAMMING_ACTIVITY_ACCESS_DENIED'; end if;
  if p_scope not in ('class','overall') then raise exception 'PROGRAMMING_RANK_SCOPE_INVALID'; end if;
  select grade_level,room_label into v_grade,v_room from public.profiles where id=v_uid;
  return query
  with members as (
    select p.id,p.student_code,p.full_name,p.class_name,p.grade_level,p.room_label
    from public.subject_enrollments se join public.profiles p on p.id=se.user_id
    where se.subject_id=p_subject_id and se.status='approved' and p.role='user' and p.active and p.approval_status='approved'
      and (p_scope='overall' or (p.grade_level is not distinct from v_grade and p.room_label is not distinct from v_room))
  ), metrics as (
    select m.*,private.programming_activity_rating_v197(p_subject_id,m.id) r,
      (select count(distinct a.stage_id)::int from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id and a.passed) completed,
      coalesce((select max(a.wpm) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0) bestw,
      coalesce((select avg(a.accuracy) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0) avga,
      coalesce((select w.tokens from public.programming_activity_wallets_v197 w where w.subject_id=p_subject_id and w.user_id=m.id),0) tok
    from members m
  )
  select row_number() over(order by (r->>'rating')::numeric desc,completed desc,bestw desc,student_code),
    id,student_code,full_name,class_name,round((r->>'rating')::numeric,1),r->>'tier',completed,
    round(bestw,1),round(avga,1),tok
  from metrics
  order by 1
  limit 50;
end;
$$;

revoke all on function public.programming_activity_leaderboard_v197(uuid,text) from public,anon;
grant execute on function public.programming_activity_leaderboard_v197(uuid,text) to authenticated,service_role;

create or replace function public.admin_programming_activity_dashboard_v197(p_subject_id uuid)
returns table(
  user_id uuid,student_code text,full_name text,grade_level text,room_label text,class_name text,
  completed_stages integer,html_best_stage integer,python_best_stage integer,total_attempts integer,
  best_wpm numeric,avg_accuracy numeric,rating numeric,tier text,tokens integer,
  official_completed integer,official_score numeric,official_submitted boolean,focus_seconds_today integer
)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and code='21910-2010' and active=true and subject_type='subject') then raise exception 'PROGRAMMING_SUBJECT_REQUIRED'; end if;
  return query
  with members as (
    select p.id,p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name
    from public.subject_enrollments se join public.profiles p on p.id=se.user_id
    where se.subject_id=p_subject_id and se.status='approved' and p.role='user'
  )
  select m.id,m.student_code,m.full_name,m.grade_level,m.room_label,m.class_name,
    coalesce((select count(distinct a.stage_id)::int from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id and a.passed),0),
    coalesce((select max(st.stage_no) from public.programming_activity_attempts_v197 a join public.programming_activity_stages_v197 st on st.id=a.stage_id where a.subject_id=p_subject_id and a.user_id=m.id and a.passed and st.language='html'),0),
    coalesce((select max(st.stage_no) from public.programming_activity_attempts_v197 a join public.programming_activity_stages_v197 st on st.id=a.stage_id where a.subject_id=p_subject_id and a.user_id=m.id and a.passed and st.language='python'),0),
    coalesce((select count(*)::int from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0),
    round(coalesce((select max(a.wpm) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0),1),
    round(coalesce((select avg(a.accuracy) from public.programming_activity_attempts_v197 a where a.subject_id=p_subject_id and a.user_id=m.id),0),1),
    round((private.programming_activity_rating_v197(p_subject_id,m.id)->>'rating')::numeric,1),
    private.programming_activity_rating_v197(p_subject_id,m.id)->>'tier',
    coalesce((select w.tokens from public.programming_activity_wallets_v197 w where w.subject_id=p_subject_id and w.user_id=m.id),0),
    coalesce((select count(*)::int from public.programming_activity_official_results_v197 r where r.subject_id=p_subject_id and r.user_id=m.id),0),
    round(coalesce((select sum(r.best_score) from public.programming_activity_official_results_v197 r where r.subject_id=p_subject_id and r.user_id=m.id),0),2),
    exists(select 1 from public.programming_activity_official_submissions_v197 s where s.subject_id=p_subject_id and s.user_id=m.id),
    coalesce((select f.seconds_active from public.programming_activity_focus_v197 f where f.subject_id=p_subject_id and f.user_id=m.id and f.focus_date=timezone('Asia/Bangkok',clock_timestamp())::date),0)
  from members m order by m.student_code nulls last,m.full_name;
end;
$$;

revoke all on function public.admin_programming_activity_dashboard_v197(uuid) from public,anon;
grant execute on function public.admin_programming_activity_dashboard_v197(uuid) to authenticated,service_role;

create or replace function public.admin_programming_quests_v197(p_subject_id uuid)
returns setof public.programming_activity_quests_v197
language sql
security definer
set search_path=public,private,pg_temp
as $$
  select q.* from public.programming_activity_quests_v197 q
  where q.subject_id=p_subject_id and private.is_admin(auth.uid())
  order by q.active desc,q.updated_at desc
$$;

revoke all on function public.admin_programming_quests_v197(uuid) from public,anon;
grant execute on function public.admin_programming_quests_v197(uuid) to authenticated,service_role;

create or replace function public.admin_set_programming_activity_settings_v197(
  p_subject_id uuid,
  p_enabled boolean,
  p_leaderboard_enabled boolean,
  p_official_enabled boolean,
  p_quests_enabled boolean,
  p_focus_enabled boolean,
  p_sequential_unlock boolean,
  p_min_accuracy numeric,
  p_focus_target_minutes integer,
  p_focus_reward_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and code='21910-2010' and active=true and subject_type='subject') then raise exception 'PROGRAMMING_SUBJECT_REQUIRED'; end if;
  if p_min_accuracy<70 or p_min_accuracy>100 or p_focus_target_minutes<5 or p_focus_target_minutes>180 or p_focus_reward_tokens<0 or p_focus_reward_tokens>500 then raise exception 'PROGRAMMING_SETTINGS_INVALID'; end if;
  insert into public.programming_activity_settings_v197(
    subject_id,enabled,leaderboard_enabled,official_enabled,quests_enabled,focus_enabled,sequential_unlock,
    min_accuracy,focus_target_minutes,focus_reward_tokens,updated_by,updated_at
  ) values(
    p_subject_id,coalesce(p_enabled,false),coalesce(p_leaderboard_enabled,false),coalesce(p_official_enabled,false),
    coalesce(p_quests_enabled,false),coalesce(p_focus_enabled,false),coalesce(p_sequential_unlock,true),
    p_min_accuracy,p_focus_target_minutes,p_focus_reward_tokens,v_uid,clock_timestamp()
  )
  on conflict(subject_id) do update set
    enabled=excluded.enabled,leaderboard_enabled=excluded.leaderboard_enabled,official_enabled=excluded.official_enabled,
    quests_enabled=excluded.quests_enabled,focus_enabled=excluded.focus_enabled,sequential_unlock=excluded.sequential_unlock,
    min_accuracy=excluded.min_accuracy,focus_target_minutes=excluded.focus_target_minutes,focus_reward_tokens=excluded.focus_reward_tokens,
    updated_by=v_uid,updated_at=clock_timestamp();

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SET_PROGRAMMING_ACTIVITY_SETTINGS_V197','subject',p_subject_id::text,
    jsonb_build_object('enabled',p_enabled,'leaderboard',p_leaderboard_enabled,'official',p_official_enabled,'quests',p_quests_enabled,'focus',p_focus_enabled,'sequential',p_sequential_unlock,'min_accuracy',p_min_accuracy,'focus_minutes',p_focus_target_minutes,'focus_reward',p_focus_reward_tokens));
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.admin_set_programming_activity_settings_v197(uuid,boolean,boolean,boolean,boolean,boolean,boolean,numeric,integer,integer) from public,anon;
grant execute on function public.admin_set_programming_activity_settings_v197(uuid,boolean,boolean,boolean,boolean,boolean,boolean,numeric,integer,integer) to authenticated,service_role;

create or replace function public.admin_upsert_programming_quest_v197(
  p_subject_id uuid,
  p_quest_id uuid,
  p_title text,
  p_description text,
  p_language text,
  p_stage_no integer,
  p_objective_type text,
  p_target_value numeric,
  p_reward_tokens integer,
  p_min_tier text,
  p_open_at timestamptz,
  p_due_at timestamptz,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_diff text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and code='21910-2010' and active=true and subject_type='subject') then raise exception 'PROGRAMMING_SUBJECT_REQUIRED'; end if;
  if p_language not in ('html','python') or p_stage_no<1 or p_stage_no>50 or p_objective_type not in ('pass','accuracy','time') then raise exception 'PROGRAMMING_QUEST_INVALID'; end if;
  if p_reward_tokens<0 or p_reward_tokens>500 or private.programming_activity_tier_index_v197(p_min_tier)<0 then raise exception 'PROGRAMMING_QUEST_INVALID'; end if;
  if p_due_at is not null and p_open_at is not null and p_due_at<=p_open_at then raise exception 'PROGRAMMING_QUEST_SCHEDULE_INVALID'; end if;
  if p_objective_type='accuracy' and (p_target_value<70 or p_target_value>100) then raise exception 'PROGRAMMING_QUEST_TARGET_INVALID'; end if;
  if p_objective_type='time' and p_target_value<=0 then raise exception 'PROGRAMMING_QUEST_TARGET_INVALID'; end if;
  select difficulty into v_diff from public.programming_activity_stages_v197 where subject_id=p_subject_id and language=p_language and stage_no=p_stage_no and active;
  if v_diff is null then raise exception 'PROGRAMMING_STAGE_NOT_FOUND'; end if;

  if p_quest_id is null then
    insert into public.programming_activity_quests_v197(
      subject_id,source_key,title,description,language,stage_no,difficulty,objective_type,target_value,reward_tokens,min_tier,open_at,due_at,active,created_by,updated_at
    ) values(
      p_subject_id,null,nullif(trim(p_title),''),nullif(trim(coalesce(p_description,'')),''),p_language,p_stage_no,v_diff,p_objective_type,
      coalesce(p_target_value,0),p_reward_tokens,lower(p_min_tier),p_open_at,p_due_at,coalesce(p_active,true),v_uid,clock_timestamp()
    ) returning id into v_id;
  else
    update public.programming_activity_quests_v197 set
      title=nullif(trim(p_title),''),description=nullif(trim(coalesce(p_description,'')),''),language=p_language,stage_no=p_stage_no,
      difficulty=v_diff,objective_type=p_objective_type,target_value=coalesce(p_target_value,0),reward_tokens=p_reward_tokens,
      min_tier=lower(p_min_tier),open_at=p_open_at,due_at=p_due_at,active=coalesce(p_active,true),updated_at=clock_timestamp()
    where id=p_quest_id and subject_id=p_subject_id returning id into v_id;
    if v_id is null then raise exception 'PROGRAMMING_QUEST_NOT_FOUND'; end if;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'UPSERT_PROGRAMMING_QUEST_V197','programming_quest',v_id::text,
    jsonb_build_object('subject_id',p_subject_id,'language',p_language,'stage',p_stage_no,'objective',p_objective_type,'active',p_active));
  return jsonb_build_object('ok',true,'quest_id',v_id);
end;
$$;

revoke all on function public.admin_upsert_programming_quest_v197(uuid,uuid,text,text,text,integer,text,numeric,integer,text,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function public.admin_upsert_programming_quest_v197(uuid,uuid,text,text,text,integer,text,numeric,integer,text,timestamptz,timestamptz,boolean) to authenticated,service_role;

create or replace function public.admin_set_programming_quest_active_v197(p_quest_id uuid,p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_subject uuid;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  update public.programming_activity_quests_v197 set active=coalesce(p_active,false),updated_at=clock_timestamp()
  where id=p_quest_id returning subject_id into v_subject;
  if v_subject is null then raise exception 'PROGRAMMING_QUEST_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SET_PROGRAMMING_QUEST_ACTIVE_V197','programming_quest',p_quest_id::text,jsonb_build_object('active',p_active));
  return jsonb_build_object('ok',true,'active',p_active);
end;
$$;

revoke all on function public.admin_set_programming_quest_active_v197(uuid,boolean) from public,anon;
grant execute on function public.admin_set_programming_quest_active_v197(uuid,boolean) to authenticated,service_role;

commit;
