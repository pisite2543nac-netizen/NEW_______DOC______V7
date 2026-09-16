from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/'site/index.html').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
plat=(ROOT/'site/v16-platform.js').read_text('utf-8')
course=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
exam=(ROOT/'site/v16-exam.js').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260916_v17_9_full_system_transaction_integrity.sql').read_text('utf-8')
checks={
'release':'v18-1-complete-learning-system-production' in idx,
'cache':'doc-full-nr-v18-1-complete-learning-system-20260916' in sw,
'grade hardened':'admin_grade_submission_v18' in app and 'hardenedRpc' in app,
'integrity UI':'admin_integrity_report_v18' in app and 'Data Integrity' in app,
'exam start hardened':'start_exam_v18' in exam,
'exam submit idempotent':'submit_exam_attempt_v18' in exam and 'p_request_key' in exam,
'exam grade hardened':'admin_grade_exam_attempt_v179' in mig,
'attendance hardened':'scan_attendance_qr_v179' in plat,
'paper scan hardened':'admin_record_paper_scan_page_v18' in plat and 'admin_finalize_paper_scan_packet_v18' in plat,
'unit unlock hardened':'admin_unlock_subject_unit_v179' in course,
'digital hard deadline UI':'หลังจากนั้นใช้ Paper ย้อนหลัง' in course and 'allow_late:false' in app,
'admin submission popup':'submission_received' in plat,
'action receipt table':'private.action_idempotency' in mig,
'reconcile':'reconcile_subject_deliveries_v179' in mig and '*/5 * * * *' in mig,
'integrity backend':'admin_integrity_report_v179' in mig and 'admin_system_health_v179' in mig,
'submission notification':'submissions_notify_received_v179' in mig,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print('V17.9 FULL SYSTEM HARDENING CONTRACT FAILED');[print('-',x) for x in bad];raise SystemExit(1)
print('V17.9 FULL SYSTEM HARDENING CONTRACT PASS')
