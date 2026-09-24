from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'site'; mig=(ROOT/'supabase/migrations/20260923_v20_5_teacher_late_barcode_admin_room_groups.sql').read_text('utf-8')
js=(site/'v16-platform.js').read_text('utf-8'); app=(site/'app.js').read_text('utf-8'); css=(site/'v20-unified-ui.css').read_text('utf-8'); idx=(site/'index.html').read_text('utf-8'); meta=(site/'release-meta.js').read_text('utf-8'); ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert 'data-docnr-release="v20-5-late-teacher-barcode-admin-room-groups"','data-docnr-release="v20-6-adaptive-stability-teacher-room-integration"' in idx
assert any(x in meta for x in ['RELEASE_VERSION="V20.5"','RELEASE_VERSION="V20.6"']) and any(x in meta for x in ['20260923-v20-5','20260924-v20-6'])
assert float(ver['version'])>=20.5 and ver['release_marker'] in {'V20.5','V20.6'}
for token in [
 'late_attendance_tokens','admin_room_groups','admin_room_group_members',
 'admin_issue_late_attendance_barcode_v205','my_scan_teacher_late_barcode_v205','scan_attendance_qr_v179',
 'admin_upsert_room_group_v205','admin_room_groups_v205','admin_room_group_members_v205','admin_replace_room_group_members_v205','admin_enroll_room_group_subject_v205',
 'ATTENDANCE_WINDOW_CLOSED_SCAN_TEACHER_BARCODE','DOCNR-LATE:'
]: assert token in mig, token
assert 'v_now>=v_deadline' in mig or 'v_now<v_deadline' in mig
assert "status='late'" in mig
assert "private.action_idempotency" in mig
assert "private.is_admin" in mig and "private.can_learn" in mig
assert 'my_scan_teacher_late_barcode_v205' in js
assert 'admin_issue_late_attendance_barcode_v205' in js
assert 'scan_attendance_qr_v179' in js
assert 'roomgroups:renderAdminRoomGroupsV205' in js
assert 'data-v205-group-roster' in js and 'data-v205-member-check' in js
assert 'admin_enroll_room_group_subject_v205' in js
assert '"roomgroups","จัดกลุ่มห้อง"' in app
assert 'roomgroups:"students"' in app
assert '.v205-late-code' in css and '.v205-roster-row' in css
print('V20.5 LATE TEACHER BARCODE + ADMIN ROOM GROUPS STATIC CONTRACT PASS')
