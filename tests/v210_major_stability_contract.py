from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'site'
_v=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
if _v.get('release_marker')!='V21.0':
    print('V21.0 MAJOR STABILITY STATIC CONTRACT SKIP ON NEWER RELEASE'); raise SystemExit(0)
index=(site/'index.html').read_text('utf-8')
exam_html=(site/'exam.html').read_text('utf-8')
app=(site/'app.js').read_text('utf-8')
platform=(site/'v16-platform.js').read_text('utf-8')
runtime=(site/'v21-runtime.js').read_text('utf-8')
css=(site/'v21-core-ui.css').read_text('utf-8')
sw=(site/'sw.js').read_text('utf-8')
meta=(site/'release-meta.js').read_text('utf-8')
version=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
migration=(ROOT/'supabase/migrations/20260924_v21_0_production_alignment.sql').read_text('utf-8')
edge=(ROOT/'supabase/functions/admin-create-user/index.ts').read_text('utf-8')

assert version['version']=='21.0'
assert version['release_marker']=='V21.0'
assert 'RELEASE_VERSION="V21.0"' in meta
assert 'data-docnr-release="v21-0-major-stability-unified-runtime"' in index
assert 'DOC-FULL-NR|V21.0|2026-09-24|MAJOR_STABILITY_UNIFIED_RUNTIME|FINAL' in (site/'RELEASE_BUILD.txt').read_text('utf-8')

# One production presentation authority. Legacy files stay in source for regression but are not loaded.
assert './v21-core-ui.css?v=20260924-v21-0' in index
assert './v21-runtime.js?v=20260924-v21-0' in index
for forbidden in [
    './mobile.css','./v19-responsive-fit.css','./v19-production-ui.css','./v20-unified-ui.css',
    './v20-stability.css','./v20-longterm-ui.css','./mobile.js','./v19-ux-runtime.js','./v20-stability-runtime.js'
]:
    assert forbidden not in index, forbidden
assert index.count('v21-runtime.js')==1
assert 'data-docnr-surface="exam"' in exam_html
assert './v21-core-ui.css?v=20260924-v21-0' in exam_html and './v21-runtime.js?v=20260924-v21-0' in exam_html
for forbidden in ['./mobile.css','./v19-responsive-fit.css','./v19-production-ui.css','./v20-unified-ui.css','./v20-stability.css','./v20-longterm-ui.css','./mobile.js','./v19-ux-runtime.js','./v20-stability-runtime.js']:
    assert forbidden not in exam_html, ('exam',forbidden)
assert "window.DOCNR_V21=Object.freeze" in runtime
assert "window.DOCNR_MOBILE_RUNTIME" not in runtime
assert "toggleDrawer" in runtime and "ensureMobileNav" in runtime and "syncViewport" in runtime
assert "setProperty('--docnr-page-scale','1')" in app
assert 'window.DOCNR_V21?.toggleDrawer?.()' in app
assert 'sidebar-utilities' in app and 'sidebar-theme' in app and 'sidebar-fullscreen' in app

# Admin / Teacher / Student route separation and staff backend use.
assert 'const TEACHER_ROUTES=' in app
assert 'roleValue==="teacher"?"teacher":"admin"' in app
for token in [
    'my_teacher_assignments_v206','staff_submission_queue_v206','staff_submission_detail_v206',
    'staff_grade_submission_v206','staff_subject_gradebook_v206','staff_attendance_sessions_v206',
    'staff_issue_late_attendance_barcode_v206','staff_set_attendance_status_v206',
    'staff_exam_dashboard_v206','staff_room_groups_v206','staff_room_group_user_ids_v206'
]:
    assert token in platform, token

# Production-alignment migration is fail-closed and history preserving.
for token in [
    'teacher_teaching_assignments','admin_room_group_subjects','admin_room_group_subject_members',
    'create policy subjects_read','create policy classrooms_read','create policy attendance_sessions_read','create policy attendance_records_read',
    'private.can_teach_student_subject','staff_subject_gradebook_v206','staff_submission_queue_v206','staff_grade_submission_v206',
    'staff_attendance_sessions_v206','staff_set_attendance_status_v206','staff_exam_dashboard_v206','staff_create_exam_preset_v206',
    'auto_withdrawn','assignment_source=\'subject_history\'','private.enforce_submission_lifecycle',
    'V21_BACKEND_CONTRACT_MISSING'
]:
    assert token in migration, token
assert "V20.6 room-group managed enrollment%" in migration and "V21.0 room-group managed enrollment%" in migration
assert "grant execute on function private.can_teach_subject(uuid,uuid) to authenticated" in migration
assert not re.search(r'(?im)^\s*(drop\s+table|truncate\s+table)', migration)

# Admin create-user path supports the teacher enum explicitly.
assert "b.role==='teacher'?'teacher':'user'" in edge
assert "role!=='user'&&contact" in edge

# Responsive shell invariants.
for token in ['--docnr-shell-w','@media (max-width:959px)','@media (max-width:620px)','@media (max-width:360px)','overflow:auto!important','overscroll-behavior','docnr-drawer-open','#docnr-mobile-nav']:
    assert token in css, token
assert '.topbar-actions{display:none!important}' in css
assert '.sidebar-utilities{display:grid!important}' in css

# PWA cache only includes the active V21 presentation assets.
assert 'doc-full-nr-v21-0-major-stability-unified-runtime-20260924' in sw
assert './v21-core-ui.css?v=20260924-v21-0' in sw and './v21-runtime.js?v=20260924-v21-0' in sw
active_shell=sw.split('const SHELL=[',1)[1].split('];',1)[0]
for forbidden in ['v19-ux-runtime.js','v20-stability-runtime.js','mobile.js','v20-longterm-ui.css','v20-stability.css']:
    assert forbidden not in active_shell, forbidden

print('V21.0 MAJOR STABILITY STATIC CONTRACT PASS')
