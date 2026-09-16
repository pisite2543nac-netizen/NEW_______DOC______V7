from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
app=(root/'site/app.js').read_text(encoding='utf-8')
flow=(root/'site/v16-8-course-flow.js').read_text(encoding='utf-8')
css=(root/'site/v16-8-course-flow.css').read_text(encoding='utf-8')
mig=(root/'supabase/migrations/20260916_v19_attendance_gate_unit_schedule.sql').read_text(encoding='utf-8')
checks={
 'class_leader_button':'เพิ่มสิทธิหัวหน้าห้อง' in app and 'set_classroom_leader' in app,
 'digital_access_guard':'my_digital_worksheet_access_v19' in app,
 'attendance_error':'ATTENDANCE_CHECKIN_REQUIRED' in app,
 'admin_schedule_button':'data-v19-unit-schedule' in flow and 'openUnitScheduleDialog' in flow,
 'exact_datetime':'name="open_at"' in flow and 'name="due_at"' in flow,
 'duration_hours':'duration_hours' in flow and 'data-v19-hours' in flow,
 'unlock_v19':'admin_unlock_subject_unit_v19' in flow,
 'update_schedule_v19':'admin_update_unit_schedule_v19' in flow,
 'large_actions':'v19-action-icon' in flow and 'v19-action-tile' in css,
 'light_course_ui':'V19.0 STABILIZED COURSE UI' in css,
 'backend_gate_helper':'digital_attendance_gate_passed' in mig,
 'backend_submit_trigger':'submissions_attendance_gate_v19' in mig,
 'existing_backfill':'Existing published digital units are protected' in mig,
}
failed=[k for k,v in checks.items() if not v]
for k,v in checks.items(): print(f'{k}: {"PASS" if v else "FAIL"}')
if failed:
 print('FAILED:', ', '.join(failed)); sys.exit(1)
print('V19 CLASSROOM FLOW CONTRACT PASS')
