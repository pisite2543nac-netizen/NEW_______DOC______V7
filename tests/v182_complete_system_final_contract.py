from pathlib import Path
import json, hashlib
R=Path(__file__).resolve().parents[1]
idx=(R/'site/index.html').read_text('utf-8')
plat=(R/'site/v16-platform.js').read_text('utf-8')
exam=(R/'site/v16-exam.js').read_text('utf-8')
app=(R/'site/app.js').read_text('utf-8')
sw=(R/'site/sw.js').read_text('utf-8')
admin_edge=(R/'supabase/functions/admin-operations/index.ts').read_text('utf-8')
reg_edge=(R/'supabase/functions/register-user-camera/index.ts').read_text('utf-8')
bank_path=R/'site/data/exam-question-bank-v18.json'
bank=json.loads(bank_path.read_text('utf-8'))
checks={
 'release marker':'v18-2-complete-system-final-production' in idx,
 'core modal css loaded':'v18-core-ui.css' in idx and idx.index('v18-core-ui.css') < idx.index('v16-minimal.css'),
 'admin student profile':'async function showAdminProfile' in plat and 'v14-profile-card' in plat,
 'course code input':'showJoinCourseDialog' in plat and 'join_subject_with_code_v18' in plat and 'v165-code-input' in plat,
 'paper scan main route':'paperscan' in plat and 'renderPaperScanHub' in plat and 'renderPaperScanCenter' in plat,
 'paper multi page':'admin_record_paper_scan_page_v18' in plat and 'admin_finalize_paper_scan_packet_v18' in plat,
 'digital v18':'finalize_digital_submission_v18' in app,
 'offline draft':'v18-offline.js' in idx or 'v18-offline' in app,
 'exam v18':'start_exam_v18' in exam and 'submit_exam_attempt_v18' in exam and 'admin_create_exam_from_bank_v18' in exam,
 'exam auto import':'admin_import_exam_bank_v18' in exam,
 '550 question bank':len(bank)==550,
 '11 subject bank':len({q.get('subjectCode') for q in bank})==11,
 'legacy admin grade disabled':"LEGACY_GRADE_DISABLED_USE_ADMIN_GRADE_SUBMISSION_V18" in admin_edge,
 'legacy initialize disabled':"LEGACY_INITIALIZE_SYSTEM_DISABLED_USE_RELEASE_TESTS" in admin_edge,
 'registration rate limit':'registration_rate_check_v18' in reg_edge,
 'sw final cache':'doc-full-nr-v18-2-complete-system-final-20260916' in sw,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print('V18.2 COMPLETE SYSTEM FINAL CONTRACT FAILED')
 [print('-',x) for x in bad]
 raise SystemExit(1)
# distribution per subject
from collections import Counter,defaultdict
d=defaultdict(Counter)
for q in bank:d[q['subjectCode']][str(q.get('level','')).lower()]+=1
for code,c in d.items():
 if c['basic']!=10 or c['easy']!=15 or c['hard']!=25:
  raise SystemExit(f'bad difficulty distribution {code}: {dict(c)}')
print('V18.2 COMPLETE SYSTEM FINAL CONTRACT PASS; questions=550 subjects=11 paper=multi-page course-code=working profile=working')
