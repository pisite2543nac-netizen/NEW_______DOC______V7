from pathlib import Path
root=Path(__file__).resolve().parents[1]
app=(root/'site/app.js').read_text(encoding='utf-8')
platform=(root/'site/v16-platform.js').read_text(encoding='utf-8')
css=(root/'site/v19-production-ui.css').read_text(encoding='utf-8')
sql=(root/'supabase/migrations/20260918_v19_4_classroom_open_close.sql').read_text(encoding='utf-8')
exam=(root/'site/exam.html').read_text(encoding='utf-8')
checks={
 'global_back_button':'id="global-back"' in app and 'goBackUnified' in app and 'navHistory' in app,
 'admin_toggle':'data-v194-toggle-classroom' in platform and 'admin_set_subject_classroom_open_v194' in platform,
 'student_closed_gate':'subject_classroom_states_v194' in platform and 'ห้องเรียนนี้ปิดอยู่' in platform,
 'join_backend_gate':'CLASSROOM_CLOSED' in sql and 'subject_classroom_is_open_v194' in sql,
 'audit_open_close':'OPEN_SUBJECT_CLASSROOM_V194' in sql and 'CLOSE_SUBJECT_CLASSROOM_V194' in sql,
 'responsive_css':'v194-room-control' in css and '@media(max-width:720px)' in css,
 'exam_back':'id="exam-global-back"' in exam,
}
failed=[k for k,v in checks.items() if not v]
for k,v in checks.items(): print(f'{k}:', 'PASS' if v else 'FAIL')
if failed: raise SystemExit('FAILED: '+', '.join(failed))
print('V19.4 classroom/back contract PASS')
