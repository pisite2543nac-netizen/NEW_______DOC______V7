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
examjs=(SITE/'v16-exam.js').read_text('utf-8')

# Production release / dependency ownership.
ok('v17-master-flow-production' in index,'index missing V17 release marker')
ok(index.count('app.js')==1,'app.js must load exactly once')
ok(index.count('v16-platform.js')==1,'v16-platform.js must load exactly once')
for f in ['v16-platform.js','v16-7-hardening.js','v16-8-course-flow.js','v16-minimal.css']:
    ok(f in index,f'production dependency missing: {f}')
ok('v16-exam.js' in exam,'exam engine missing from exam page')
ok('v16-minimal.css' in exam,'exam minimal stylesheet missing')
for stale in ['v16-9-clean-dashboard.js','v16-9-runtime-rescue.js','v16-9-clean-dashboard.css','v15-tech.css']:
    ok(stale not in index and stale not in sw,f'competing/stale production dependency referenced: {stale}')
refs=set(re.findall(r'["\'](\./[^"\']+?\.(?:js|css))(?:\?[^"\']*)?["\']',index+'\n'+exam+'\n'+sw))
for ref in refs: ok((SITE/ref[2:]).is_file(),f'missing local dependency {ref}')
for legacy in ['v9-features.js','subject-bundles.js','v12-system.js','v13-course-system.js','v14-platform.js','v14-exam.js','v15-platform.js','v15-exam.js']:
    ok(legacy not in index and legacy not in exam,f'legacy production script referenced: {legacy}')
ok('doc-full-nr-v17-master-flow-20260915' in sw,'service worker cache is not V17')

# PWA contract.
manifest=json.loads((SITE/'manifest.webmanifest').read_text('utf-8'))
ok(manifest.get('display')=='standalone','manifest display must be standalone')
icons=manifest.get('icons') or []
ok(any(x.get('sizes')=='192x192' for x in icons),'manifest missing 192 icon')
ok(any(x.get('sizes')=='512x512' for x in icons),'manifest missing 512 icon')
ok(any('maskable' in str(x.get('purpose','')) for x in icons),'manifest missing maskable icon')
for f in ['icon-48.png.b64','icon-180.png.b64','icon-192.png.b64','icon-512.png.b64','icon-maskable-512.png.b64']:
    ok((SITE/'icons'/f).is_file(),f'missing icon source {f}')

# Single owner router contract.
ok('async function navigateUnified' in app,'unified router missing')
ok('navigate:navigateUnified' in app,'DOCNR_BASE does not expose unified router')
ok('data-app-route' in app,'delegated app route handler missing')
ok('FEATURE_ROUTES' in app and 'ADMIN_ROUTES' in app and 'USER_ROUTES' in app,'route allowlists missing')
ok('data-route belongs exclusively to app.js' in platform,'feature module does not document Sidebar ownership')
ok('$$(`[data-route]`)' not in platform and '$$("[data-route]")' not in platform,'feature module still binds base Sidebar buttons')
ok('window.DOCNR_BASE?.navigate' in platform,'feature views do not bridge to unified router')
ok('V17-MASTER-FLOW' in platform,'feature renderer V17 marker missing')
ok('window.DOCNR_V16_6=Object.freeze({navigate,cleanup,version:"V17-MASTER-FLOW"})' in platform,'feature renderer export/cleanup contract missing')

# Master dashboards / hubs are real direct route controls.
for fn in ['renderAdminDashboard','renderStudentDashboard','renderStudentsHub','renderWorkAdminHub','renderAttendanceHub','renderAcademicHub']:
    ok(f'function {fn}' in platform or f'async function {fn}' in platform,f'missing functional view: {fn}')
for route in ['courses','students','workadmin','attendancehub','exam','academic','catalog','work','attendance','profile']:
    ok(f'dashboardRouteCard("{route}"' in platform or f'hubCard("{route}"' in platform or route in app,f'missing dashboard/hub route: {route}')
for leaf in ['accounts','enrollments','profiles','users','grading','overrides','reports','presence','promotion','audit','system','history']:
    ok(leaf in app+platform,f'missing leaf route/function: {leaf}')

# Registration / identity / profile contract.
ok('verifyOtp' not in platform,'OTP verify flow returned')
ok('set_phone_otp_enforcement' not in platform,'OTP enforcement returned')
cam=(SITE/'camera-registration.js').read_text('utf-8')
ok('name="phone"' in cam and 'required' in cam,'registration phone field must remain required')
ok('ไม่มีการส่ง OTP' in cam,'registration no-OTP help missing')
for marker in ['nickname','birth_date','พ่อคุณเป็นฝรั่งหรอ']:
    ok(marker in app,f'registration/profile marker missing: {marker}')
ok('บันทึกโปรไฟล์' not in app,'student profile edit UI returned')
ok('profile-readonly' in app,'student read-only profile marker missing')

# Course, learning, assignment and resource contracts.
for marker in ['join_subject_with_code','v165-course-gallery','v165-room-code','admin_subject_unit_plan','admin_unlock_subject_unit','my_subject_learning_path']:
    ok(marker in platform+course,f'course flow marker missing: {marker}')
ok('PREVIOUS_UNIT_LOCKED' in course,'sequential unit lock error mapping missing')
scan=re.search(r'function scan\(\)[\s\S]*?\n\}',course)
ok(bool(scan),'V16.8 scan enhancer missing')
if scan:
    ok('decorateNav();' not in scan.group(0),'course enhancer still mutates Sidebar')
    ok('decorateCatalog();' not in scan.group(0),'course enhancer still owns catalog')
for marker in ['save_worksheet_draft','finalize_digital_submission','my_submission_override_v15','preview_before_submit']:
    ok(marker in app+platform,f'digital assignment marker missing: {marker}')
for marker in ['admin_prepare_paper_print_pack','admin_record_paper_scan','parsePaperPayload','data-v167-print-pack']:
    ok(marker in hard+platform,f'paper workflow marker missing: {marker}')
for marker in ['admin_subject_gradebook','admin_set_subject_grade_settings','admin_set_behavior_score']:
    ok(marker in platform,f'gradebook marker missing: {marker}')
for marker in ['app_notifications','attendance_session_roster_v161','attendance_session_snapshot','admin_set_attendance_status_v161','finalize_due_attendance_session_v161']:
    ok(marker in platform,f'attendance/realtime marker missing: {marker}')

# Exam privacy + engine.
ok('V16-EXAM-50Q-75MIN-REALTIME' in examjs,'exam engine marker missing')
for marker in ['admin_create_exam_from_bank','admin_import_exam_bank','admin_upsert_exam_question','admin_delete_exam_question','record_exam_violation','admin_reset_exam_user','my_exam_attempt_status']:
    ok(marker in examjs,f'exam function marker missing: {marker}')
ok('score,max_score' not in re.sub(r'adminResults[\s\S]*?function studentHome','',examjs),'student exam path may query score/max_score')

# V17 health contract + source-of-truth migration.
ok('admin_system_health_v17' in app,'System Health does not use V17 contract')
ok('admin_system_health_v17' in platform,'Dashboard does not use V17 contract')
health=ROOT/'supabase/migrations/20260915_v17_master_flow_health.sql'
ok(health.is_file(),'V17 health migration mirror missing')
if health.is_file():
    hs=health.read_text('utf-8')
    ok('admin_system_health_v17' in hs and 'single-owner' in hs,'V17 health migration contract incomplete')

if errors:
    print('STATIC VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('STATIC VALIDATION PASS')
print('release=V17 MASTER FLOW; active_files=',len(required),'manifest_icons=',len(icons),'router_owner=app.js')
