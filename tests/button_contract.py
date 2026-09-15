from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
files={n:(SITE/n).read_text('utf-8') for n in ['app.js','v16-platform.js','v16-7-hardening.js','v16-8-course-flow.js','v16-exam.js','camera-registration.js']}
errors=[]
def ok(c,m):
    if not c: errors.append(m)

# Every master-flow action must have both a rendered control marker and an implementation marker.
contracts={
 'unified dashboard navigation': ('data-app-route', 'navigateUnified', 'app.js'),
 'account approval': ('data-v15-account', 'decideAccount(', 'v16-platform.js'),
 'course CODE join': ('data-v165-join-course', 'join_subject_with_code', 'v16-platform.js'),
 'course open': ('data-v14-open-course', 'DOCNR_BASE?.navigate?.("courses"', 'v16-platform.js'),
 'copy course CODE': ('data-v165-copy-code', 'navigator.clipboard.writeText', 'v16-platform.js'),
 'change course CODE': ('data-v165-change-code', 'admin_regenerate_subject_join_code', 'v16-platform.js'),
 'enrollment decision': ('data-v14-decide-enroll', 'decide_subject_enrollment', 'v16-platform.js'),
 'sequential unit unlock': ('data-v168-unlock', 'admin_unlock_subject_unit', 'v16-8-course-flow.js'),
 'worksheet preview': ('data-v14-preview', 'previewWorksheet(', 'v16-platform.js'),
 'resource upload': ('data-v14-upload', 'uploadSubjectFile(', 'v16-platform.js'),
 'resource open': ('data-v14-file', 'openSubjectFile(', 'v16-platform.js'),
 'student work open': ('data-v14-open-work', 'openWorksheet', 'v16-platform.js'),
 'paper personalized print': ('data-v167-print-pack', 'admin_prepare_paper_print_pack', 'v16-7-hardening.js'),
 'paper full-sheet scan': ('data-v16-paper-scan', 'admin_record_paper_scan', 'v16-platform.js'),
 'paper evidence view': ('data-v16-view-scan', 'openPaperScanCopy(', 'v16-platform.js'),
 'gradebook': ('data-v16-gradebook', 'admin_subject_gradebook', 'v16-platform.js'),
 'attendance session view': ('data-v14-session', 'loadAttendanceRoster(', 'v16-platform.js'),
 'class leader toggle': ('data-v14-leader-user', 'set_classroom_leader', 'v16-platform.js'),
 'promotion item decision': ('data-v14-promotion-item', 'set_promotion_item_decision_v15', 'v16-platform.js'),
 'room exam': ('data-v15-room-exam', 'openSubjectExam(', 'v16-platform.js'),
 'exam start': ('data-start-exam', 'start_exam', 'v16-exam.js'),
 'exam question jump': ('data-jump', 'dataset.jump', 'v16-exam.js'),
 'exam admin results': ('data-exam-results', 'resultsView(', 'v16-exam.js'),
 'exam publish': ('data-exam-publish', 'publish_exam_to_subject', 'v16-exam.js'),
 'exam question edit': ('data-bank-edit', 'bankQuestionDialog(', 'v16-exam.js'),
 'camera start': ('data-camera-start', 'getUserMedia', 'camera-registration.js'),
 'camera capture': ('data-camera-shoot', 'capture', 'camera-registration.js'),
}
for name,(control,impl,f) in contracts.items():
    t=files[f]
    ok(control in t,f'{name}: control marker missing ({control})')
    ok(impl in t,f'{name}: implementation marker missing ({impl})')

# The V17 teaching flow must not expose the old bulk-release path that bypassed sequential unlock.
platform=files['v16-platform.js'];course=files['v16-8-course-flow.js']
ok('id="v14-bulk-release"' not in platform,'obsolete bulk-release button is still generated')
ok('data-v14-wselect value=' not in platform,'obsolete worksheet release checkboxes are still generated')
ok('<button class="btn sm" data-v14-select-mode=' not in platform,'obsolete select-all release control is still generated')
ok('data-v168-flow-health' not in course,'redundant course health button is still generated')

# Logout and profile rules.
app=files['app.js']
ok('DOCNR_V16_6?.cleanup?.()' in app and 'sb.auth.signOut()' in app,'logout cleanup/signout contract missing')
ok('profile-readonly' in app and 'บันทึกโปรไฟล์' not in app,'student profile must stay read-only')

if errors:
    print('BUTTON CONTRACT FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('BUTTON CONTRACT PASS')
print('critical actions=',len(contracts),'obsolete sequential-bypass controls=0')
