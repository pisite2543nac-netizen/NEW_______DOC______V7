from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]; site=ROOT/'site'
app=(site/'app.js').read_text('utf-8'); plat=(site/'v16-platform.js').read_text('utf-8'); exam=(site/'v16-exam.js').read_text('utf-8'); idx=(site/'index.html').read_text('utf-8'); css=(site/'v20-longterm-ui.css').read_text('utf-8'); ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert 'v20-longterm-ui.css' in idx
assert '--ui-nav-w' in css and '@media(max-width:640px)' in css and 'prefers-reduced-motion' in css
assert 'const isTeacher=()=>S.profile?.role==="teacher"' in app
for r in ['workadmin','workcheck','attendancehub','exam','printcenter']: assert r in app
for rpc in ['my_teacher_assignments_v206','staff_submission_queue_v206','staff_subject_gradebook_v206','staff_attendance_sessions_v206','staff_exam_dashboard_v206','staff_room_groups_v206']: assert rpc in plat
for rpc in ['staff_create_exam_preset_v206','staff_publish_exam_v206','staff_exam_attempts_v206','staff_grade_exam_attempt_v206','staff_reset_exam_user_v206']: assert rpc in exam
for rpc in ['admin_room_groups_v206','admin_replace_room_group_members_v206','admin_bind_room_group_subject_v206','admin_sync_room_group_v206','admin_auto_number_room_group_v206']: assert rpc in plat
assert 'staff_issue_late_attendance_barcode_v206' in plat and 'staff_revoke_late_attendance_barcode_v206' in plat
assert ver['long_term_ui'].get('theme_locked') is False or ver['long_term_ui'].get('theme_lock_removed') is True
assert ver['long_term_ui'].get('phone') and ver['long_term_ui'].get('tablet') and ver['long_term_ui'].get('desktop')
print('V20.6 LONG-TERM UI + TEACHER WORKSPACE CONTRACT PASS')
