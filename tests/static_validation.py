from pathlib import Path
import json,sys,re
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
errors=[]
def ok(cond,msg):
    if not cond: errors.append(msg)

required=[
 'index.html','app.js','camera-registration.js','mobile.js','styles.css','mobile.css',
 'v16-minimal.css','v16-platform.js','v16-7-hardening.js','v16-8-course-flow.js',
 'v16-exam.js','exam.html','manifest.webmanifest','sw.js'
]
for f in required: ok((SITE/f).is_file(),f'missing site/{f}')
index=(SITE/'index.html').read_text('utf-8')
exam=(SITE/'exam.html').read_text('utf-8')
sw=(SITE/'sw.js').read_text('utf-8')
app=(SITE/'app.js').read_text('utf-8')
platform=(SITE/'v16-platform.js').read_text('utf-8')
hard=(SITE/'v16-7-hardening.js').read_text('utf-8')
course=(SITE/'v16-8-course-flow.js').read_text('utf-8')

ok('v16-10-unified-production' in index,'index missing V16.10 release marker')
ok('v16-platform.js' in index,'index missing v16-platform.js')
ok('v16-7-hardening.js' in index,'index missing v16-7 hardening')
ok('v16-8-course-flow.js' in index,'index missing v16-8 course flow')
ok('v16-minimal.css' in index,'index missing v16-minimal.css')
ok('v16-exam.js' in exam,'exam missing v16-exam.js')
ok('v16-minimal.css' in exam,'exam missing minimal stylesheet')
for stale in ['v16-9-clean-dashboard.js','v16-9-runtime-rescue.js','v16-9-clean-dashboard.css','v15-tech.css']:
    ok(stale not in index and stale not in sw,f'stale/competing production dependency referenced: {stale}')

refs=set(re.findall(r'["\'](\./[^"\']+?\.(?:js|css))(?:\?[^"\']*)?["\']',index+'\n'+exam+'\n'+sw))
for ref in refs: ok((SITE/ref[2:]).is_file(),f'missing local dependency {ref}')
for legacy in ['v9-features.js','subject-bundles.js','v12-system.js','v13-course-system.js','v14-platform.js','v14-exam.js','v15-platform.js','v15-exam.js']:
    ok(legacy not in index and legacy not in exam,f'legacy production script referenced: {legacy}')

manifest=json.loads((SITE/'manifest.webmanifest').read_text('utf-8'))
ok(manifest.get('display')=='standalone','manifest display must be standalone')
icons=manifest.get('icons') or []
ok(any(x.get('sizes')=='192x192' for x in icons),'manifest missing 192 icon')
ok(any(x.get('sizes')=='512x512' for x in icons),'manifest missing 512 icon')
ok(any('maskable' in str(x.get('purpose','')) for x in icons),'manifest missing maskable icon')
for f in ['icon-48.png.b64','icon-180.png.b64','icon-192.png.b64','icon-512.png.b64','icon-maskable-512.png.b64']:
    ok((SITE/'icons'/f).is_file(),f'missing icon source {f}')
ok('doc-full-nr-v16-10-unified-20260915' in sw,'service worker cache marker is not V16.10')

# Shell/router contract: base router is callable directly; no hidden-button dependency.
ok('navigate:navigateBase' in app,'DOCNR_BASE direct base-router bridge missing')
ok('BASE_ROUTE_TITLES' in app,'base hidden-route titles missing')
nav_block=re.search(r'function navItems\(\)\{[\s\S]*?\n\}',app)
ok(bool(nav_block),'navItems missing')
if nav_block:
    block=nav_block.group(0)
    ok('users' not in block and 'grading' not in block and 'overrides' not in block,'sidebar still exposes advanced Admin routes')
    ok('dashboard' in block and 'profile' in block,'minimal sidebar must keep home/profile')
ok('V16.10-UNIFIED-PRODUCTION' in platform,'V16.10 platform marker missing')
ok('window.DOCNR_BASE?.navigate' in platform,'feature router still depends on clicking hidden base nav')
ok('data-v1610-flow' in platform and 'data-v1610-action' in platform,'V16.10 dashboard flow actions missing')
ok('await syncServerTime();startHeartbeat()' not in platform,'platform boot still blocks on server-time sync')
ok('if(S.session){await loadProfile();await syncServerClock();}' not in app,'initial shell still blocks on server-time sync')

# Registration/profile contract.
ok('verifyOtp' not in platform,'OTP verify flow still present')
ok('set_phone_otp_enforcement' not in platform,'OTP enforcement switch still present')
cam=(SITE/'camera-registration.js').read_text('utf-8')
ok('name="phone"' in cam and 'required' in cam,'registration phone field must remain required')
ok('ไม่มีการส่ง OTP' in cam,'registration phone help must state no OTP')
ok('nickname' in app,'nickname field missing')
ok('พ่อคุณเป็นฝรั่งหรอ' in app,'Thai-name validation message missing')
ok('birth_date' in app,'birth date missing')
ok('บันทึกโปรไฟล์' not in app,'student profile edit UI still present')
ok('profile-readonly' in app,'read-only profile UI marker missing')

# Course/code/sequential unit contract.
for marker in ['join_subject_with_code','v165-course-gallery','v165-room-code','admin_subject_unit_plan','admin_unlock_subject_unit','my_subject_learning_path','PREVIOUS_UNIT_LOCKED']:
    ok(marker in platform or marker in course,f'course flow marker missing: {marker}')
ok('admin_system_health_v1610' in platform,'V16.10 unified backend health check missing')


health_migration=ROOT/'supabase/migrations/20260915_v16_10_unified_system_health.sql'
ok(health_migration.is_file(),'V16.10 backend health migration missing')
if health_migration.is_file():
    health_sql=health_migration.read_text('utf-8')
    for marker in ['admin_system_health_v1610','v_standard=198','v_paper=55','v_digital=143','v_subjects=11','v_codes=11','v_paths=11']:
        ok(marker in health_sql,f'health contract missing {marker}')

# Core Admin/Paper/Gradebook/Attendance contract.
for marker in ['admin_subject_gradebook','admin_set_subject_grade_settings','admin_set_behavior_score','admin_record_paper_scan','admin_subject_paper_scans','paper_scans','data-v16-gradebook','data-v16-paper-scan']:
    ok(marker in platform,f'V16 platform missing {marker}')
for marker in ['admin_prepare_paper_print_pack','parsePaperPayload','data-v167-print-pack','admin_runtime_health_v167']:
    ok(marker in hard,f'V16.7 hardening missing {marker}')
for marker in ['app_notifications','attendance_session_roster_v161','attendance_session_snapshot','admin_set_attendance_status_v161','finalize_due_attendance_session_v161']:
    ok(marker in platform,f'attendance/notification marker missing: {marker}')
for marker in ['my_submission_override_v15','preview_before_submit']:
    ok(marker in app,f'app marker missing: {marker}')

examjs=(SITE/'v16-exam.js').read_text('utf-8')
ok('V16-EXAM-50Q-75MIN-REALTIME' in examjs,'V16 exam marker missing')
for marker in ['admin_create_exam_from_bank','admin_import_exam_bank','admin_upsert_exam_question','admin_delete_exam_question','record_exam_violation','admin_reset_exam_user','my_exam_attempt_status']:
    ok(marker in examjs,f'V16 exam missing {marker}')
ok('score,max_score' not in re.sub(r'adminResults[\s\S]*?function studentHome','',examjs),'student exam path may query score,max_score')

if errors:
    print('STATIC VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('STATIC VALIDATION PASS')
print('release=V16.10 UNIFIED; active_files=',len(required),'manifest_icons=',len(icons))
