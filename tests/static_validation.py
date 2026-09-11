from pathlib import Path
import json,sys,re
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
errors=[]
def ok(cond,msg):
    if not cond: errors.append(msg)

required=[
 'index.html','app.js','camera-registration.js','mobile.js','styles.css','mobile.css',
 'v16-minimal.css','v16-platform.js','v16-exam.js','exam.html','manifest.webmanifest','sw.js'
]
for f in required: ok((SITE/f).is_file(),f'missing site/{f}')
index=(SITE/'index.html').read_text('utf-8')
exam=(SITE/'exam.html').read_text('utf-8')
ok('v16-1-menu-attendance' in index,'index missing V16.1 release marker')
ok('v16-platform.js' in index,'index missing v16-platform.js')
ok('v16-minimal.css' in index,'index missing v16-minimal.css')
ok('v16-exam.js' in exam,'exam missing v16-exam.js')
ok('v16-minimal.css' in exam,'exam missing minimal stylesheet')
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
sw=(SITE/'sw.js').read_text('utf-8')
ok('doc-full-nr-v16-1-menu-attendance-20260911' in sw,'service worker cache marker is not V16.1')
platform=(SITE/'v16-platform.js').read_text('utf-8')
ok('V16.1-MENU-PROFILE-ATTENDANCE-REALTIME' in platform,'V16.1 platform marker missing')
for marker in ['admin_subject_gradebook','admin_set_subject_grade_settings','admin_set_behavior_score','admin_record_paper_scan','admin_subject_paper_scans','paper_scans','data-v16-gradebook','data-v16-paper-scan']:
    ok(marker in platform,f'V16 platform missing {marker}')

for marker in ['app_notifications','attendance_session_roster_v161','attendance_session_snapshot','admin_set_attendance_status_v161','data-v161-att-user','v161-summary-submit','v161-notification-button','finalize_due_attendance_session_v161']:
    ok(marker in platform,f'V16.1 attendance/notification marker missing: {marker}')

examjs=(SITE/'v16-exam.js').read_text('utf-8')
ok('V16-EXAM-50Q-75MIN-REALTIME' in examjs,'V16 exam marker missing')
for marker in ['admin_create_exam_from_bank','admin_import_exam_bank','admin_upsert_exam_question','admin_delete_exam_question','record_exam_violation','admin_reset_exam_user','my_exam_attempt_status']:
    ok(marker in examjs,f'V16 exam missing {marker}')
ok('score,max_score' not in re.sub(r'adminResults[\s\S]*?function studentHome','',examjs), 'student exam path may query score,max_score')
app=(SITE/'app.js').read_text('utf-8')
ok('บันทึกโปรไฟล์' not in app,'student profile edit UI still present')
ok('profile-readonly' in app,'read-only profile UI marker missing')
ok('my_submission_override_v15' in app,'submission override RPC not used')
ok('preview_before_submit' in app,'preview-before-submit behavior marker missing')
# Paper scan is now an Admin subject-room function, not the old student token-confirmation nav.
nav_block=re.search(r'function navItems\(\)\{[\s\S]*?\n\}',app)
if nav_block: ok('["scan","ยืนยันงานกระดาษ"]' not in nav_block.group(0),'legacy student scan nav still exposed')
if errors:
    print('STATIC VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('STATIC VALIDATION PASS')
print('release=V16.1 FINAL; files=',len(required),'manifest_icons=',len(icons))
