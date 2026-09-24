from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]; site=ROOT/'site'
idx=(site/'index.html').read_text('utf-8'); css=(site/'v20-longterm-ui.css').read_text('utf-8'); stab=(site/'v20-stability-runtime.js').read_text('utf-8'); app=(site/'app.js').read_text('utf-8'); plat=(site/'v16-platform.js').read_text('utf-8'); exam=(site/'v16-exam.js').read_text('utf-8'); ux=(site/'v19-ux-runtime.js').read_text('utf-8'); sw=(site/'sw.js').read_text('utf-8'); meta=(site/'release-meta.js').read_text('utf-8'); ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert 'data-docnr-release="v20-7-long-term-ux-teacher-production-stability"' in idx
assert 'v20-longterm-ui.css?v=20260924-v20-7-lts' in idx and idx.index('v20-longterm-ui.css')>idx.index('v20-stability.css')
assert 'RELEASE_VERSION="V20.7"' in meta and ver['version']=='20.7' and ver['release_marker']=='V20.7'
for t in ['const isTeacher=', 'TEACHER_ROUTES', 'workadmin","ตรวจงานและคะแนน', 'attendancehub","เช็คชื่อ']:
    assert t in app,t
for t in ['my_teacher_assignments_v206','staff_submission_queue_v206','staff_submission_detail_v206','staff_grade_submission_v206','staff_subject_gradebook_v206','staff_room_groups_v206','staff_room_group_user_ids_v206','staff_attendance_sessions_v206','staff_issue_late_attendance_barcode_v206','staff_revoke_late_attendance_barcode_v206','admin_room_groups_v206','admin_replace_room_group_members_v206','admin_auto_number_room_group_v206','admin_bind_room_group_subject_v206','admin_sync_room_group_v206','admin_link_room_group_classroom_v206','JsBarcode']:
    assert t in plat,t
for t in ['staff_exam_dashboard_v206','staff_create_exam_preset_v206','staff_publish_exam_v206','staff_exam_attempts_v206','staff_grade_exam_attempt_v206','staff_reset_exam_user_v206','staff_delete_exam_v206','p.role==="teacher"']:
    assert t in exam,t
for t in ['.docnr-route-loading','.docnr-skeleton-page','.docnr-mobile-bottom-nav','.v165-course-gallery','.docnr-filterbar','@media(max-width:640px)']:
    assert t in css,t
assert "const RELEASE='V20.7'" in stab and "qa('.docnr-route-loading').forEach(x=>x.remove())" in stab
assert 'function isTeacher()' in ux and "role()==='teacher'" in ux
assert 'doc-full-nr-v20-7-long-term-ux-teacher-production-stability-20260924' in sw
assert ver['long_term_ui']['theme_locked'] is False and ver['teacher_role']['admin_privilege_required'] is False
print('V20.7 LONG-TERM UX + TEACHER WORKSPACE STATIC CONTRACT PASS')
