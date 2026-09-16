from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'site/app.js').read_text('utf-8')
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
exam=(ROOT/'site/v16-exam.js').read_text('utf-8')
minimal=(ROOT/'site/v16-minimal.css').read_text('utf-8')
coursecss=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')
mobile=(ROOT/'site/mobile.css').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260916_v19_attendance_gate_unit_schedule.sql').read_text('utf-8')
hard=(ROOT/'supabase/migrations/20260916_v19_1_security_hardening.sql').read_text('utf-8')
admin_create=(ROOT/'supabase/functions/admin-create-user/index.ts').read_text('utf-8')
admin_ops=(ROOT/'supabase/functions/admin-operations/index.ts').read_text('utf-8')
register_camera=(ROOT/'supabase/functions/register-user-camera/index.ts').read_text('utf-8')
bank=json.loads((ROOT/'site/data/exam-question-bank-v18.json').read_text('utf-8'))
checks={
 'green_white_theme':'--v16-primary:#1f7a4f' in minimal or '#1f7a4f' in minimal,
 'night_mode':'theme-toggle' in app and 'data-theme' in minimal,
 'responsive_mobile':'@media' in mobile and 'viewport-fit=cover' in (ROOT/'site/index.html').read_text('utf-8'),
 'classroom_leader_admin':'เพิ่มสิทธิหัวหน้าห้อง' in app and 'set_classroom_leader' in app,
 'vocational_major_mapping':all(x in app for x in ['(ส.ทส.)','(ส.ทธ.)','(ส.คท.)','(ทส.)','(ทธ.)','(คธ.)']),
 'major_mapping_backend':all('MAJORS_HIGH' in x and 'majorAllowed' in x and '(ส.คท.)' in x for x in [admin_create,admin_ops,register_camera]),
 'room_work_checklist':'V18.6-ROOM-WORK-CHECKLIST-AUDITED' in platform and 'v186-check-table' in platform,
 'room_work_excel_print':'v186-excel' in platform and 'v186-print' in platform,
 'exam_550':'V18.7-EXAM-SOURCE-ADAPTED-550Q' in exam and len(bank)>=550,
 'unit_schedule_admin':'data-v19-unit-schedule' in flow and 'admin_update_unit_schedule_v19' in flow,
 'schedule_exact_datetime':'name="open_at"' in flow and 'name="due_at"' in flow,
 'schedule_hours':'duration_hours' in flow and 'data-v19-hours' in flow,
 'deadline_to_paper':'my_prepare_late_paper_print' in flow and 'data-v167-print-pack' in flow,
 'attendance_gate_client':'my_digital_worksheet_access_v19' in app and 'ATTENDANCE_CHECKIN_REQUIRED' in app,
 'attendance_gate_backend':'digital_attendance_gate_passed' in mig and 'submissions_attendance_gate_v19' in mig,
 'unit_slides':'data-v168-admin-slide' in flow and 'เพิ่มสไลด์/สื่อของครู' in flow,
 'large_action_tiles':'v19-action-tile' in flow and 'v19-action-icon' in coursecss,
 'paper_scan':'admin_record_paper_scan_page_v18' in platform,
 'gradebook':'admin_subject_gradebook' in platform,
 'security_hardening':'revoke execute' in hard and 'enforce_exam_safe_payload_v18' in hard,
}
failed=[k for k,v in checks.items() if not v]
for k,v in checks.items(): print(f'{k}: {"PASS" if v else "FAIL"}')
if failed:
 print('FAILED:', ', '.join(failed)); sys.exit(1)
print('V19.1 COMPLETE USER REQUESTS CONTRACT PASS')
