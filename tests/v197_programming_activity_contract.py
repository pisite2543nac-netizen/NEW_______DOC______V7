from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'site/index.html').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
js=(ROOT/'site/v19-programming-activity.js').read_text('utf-8')
css=(ROOT/'site/v19-programming-activity.css').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
base=(ROOT/'supabase/migrations/20260920_v19_7_programming_special_activity.sql').read_text('utf-8')
align=(ROOT/'supabase/migrations/20260920_v19_7_1_programming_activity_alignment.sql').read_text('utf-8')
dashfix=(ROOT/'supabase/migrations/20260920_v19_7_2_fix_programming_admin_dashboard.sql').read_text('utf-8')
cat=json.loads((ROOT/'site/data/programming-activity-v197.json').read_text('utf-8'))
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))

assert 'data-docnr-release="v19-7-programming-special-activity"' in index
assert 'v19-programming-activity.css?v=20260920-v19-7' in index
assert 'v19-programming-activity.js?v=20260920-v19-7' in index
assert index.index('v19-programming-activity.css') > index.index('v19-production-ui.css')
assert 'doc-full-nr-v19-7-programming-special-activity-20260920' in sw
assert './data/programming-activity-v197.json' in sw
assert './v19-programming-activity.js?v=20260920-v19-7' in sw

# Entry is deliberately scoped to the programming-language subject only.
assert platform.count('data-v197-special') >= 2
assert platform.count('s.code==="21910-2010"') >= 2
assert 'กิจกรรมพิเศษ Code Typing Academy' in platform

stages=cat['stages']
assert len(stages)==100
assert sum(x['language']=='html' for x in stages)==50
assert sum(x['language']=='python' for x in stages)==50
assert len(cat['official_stages'])==30
assert sum(float(x['maxScore']) for x in cat['official_stages'])==40
assert set(x['id'] for x in stages)=={f'html_{i:02d}' for i in range(1,51)}|{f'python_{i:02d}' for i in range(1,51)}

# No second authentication/database stack is introduced into the integrated runtime.
for txt in (js,platform,css):
    assert 'firebase-config' not in txt.lower() and 'initializeapp(' not in txt.lower() and 'firestore' not in txt.lower()
assert 'PVP wagering' in json.dumps(cat,ensure_ascii=False)

# User + Admin functionality and academic separation.
for marker in ['my_programming_activity_home_v197','my_programming_activity_progress_v197','start_programming_stage_v197','submit_programming_stage_v197','update_programming_focus_v197','admin_programming_activity_dashboard_v197','admin_set_programming_activity_settings_v197','admin_upsert_programming_quest_v197']:
    assert marker in js
assert 'ไม่รวมคะแนนรายวิชา 100 คะแนน' in js
assert 'กิจกรรมพิเศษแยกจากคะแนนรายวิชา' in js
assert '30 STAGES / 40 ACTIVITY POINTS' in js
assert 'PROGRAMMING-SPECIAL-ACTIVITY' in js

# Backend reproduction: initial seed + hardened alignment.
assert 'programming_activity_settings_v197' in base
assert 'Code Typing Academy V6.0.2' in base
assert 'programming_activity_sessions_v197' in align
assert 'code_hash' in align and "extensions.digest" in align
assert 'drop column if exists code_target' in align
assert 'start_programming_stage_v197' in align
assert 'submit_programming_stage_v197' in align
assert 'p_session_id uuid' in align
assert 'last_heartbeat_at' in align
assert 'p_heartbeat_seconds integer default 30' in align
assert 'unlocked boolean' in align
assert 'revoke all on table public.programming_activity_sessions_v197 from public,anon,authenticated' in align
assert 'admin_programming_activity_dashboard_v197' in dashfix and 'stt.student_code' in dashfix

assert ver['version']=='19.7'
v=ver['programming_special_activity']
assert v['subject_code']=='21910-2010' and v['total_stages']==100 and v['official_stages']==30 and v['official_activity_points']==40
assert v['separate_from_course_grade_100'] is True and v['server_authoritative_sessions'] is True
print('V19.7 PROGRAMMING SPECIAL ACTIVITY CONTRACT PASS')
