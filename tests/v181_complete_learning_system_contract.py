from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
idx=(SITE/'index.html').read_text('utf-8');app=(SITE/'app.js').read_text('utf-8');plat=(SITE/'v16-platform.js').read_text('utf-8');course=(SITE/'v16-8-course-flow.js').read_text('utf-8');exam=(SITE/'v16-exam.js').read_text('utf-8');sw=(SITE/'sw.js').read_text('utf-8');offline=(SITE/'v18-offline.js').read_text('utf-8')
edge_reg=(ROOT/'supabase/functions/register-user-camera/index.ts').read_text('utf-8');edge_admin=(ROOT/'supabase/functions/admin-operations/index.ts').read_text('utf-8')
align=(ROOT/'supabase/migrations/20260916_v18_1_runtime_alignment.sql').read_text('utf-8')
items=json.loads((SITE/'data/exam-question-bank-v18.json').read_text('utf-8'))
errors=[]
def ok(v,m):
    if not v: errors.append(m)

ok('v18-1-complete-learning-system-production' in idx,'release marker')
ok('v18-core-ui.css' in idx and idx.index('v18-core-ui.css')<idx.index('v16-minimal.css'),'core modal CSS order')
ok('v15-tech.css' not in idx,'stale v15 CSS loaded')
ok('showAdminProfile' in plat and 'data-v14-profile' in plat and 'v14-profile-detail' in plat,'Admin student profile detail')
ok('join_subject_with_code_v18' in plat and 'v165-code-input' in plat,'student course CODE V18')
ok('paperscan' in app and 'renderPaperScanHub' in plat,'top-level Paper Scan route')
ok('admin_record_paper_scan_page_v18' in plat and 'admin_finalize_paper_scan_packet_v18' in plat,'multi-page Paper packet RPCs')
ok('expectedPages' in plat and 'เก็บหลักฐาน ${pages.length}/${current.expectedPages} หน้า' in plat,'Paper page completeness UI')
ok('finalize_digital_submission_v18' in app and 'v18-offline' in app and 'indexedDB' in offline,'Digital immutable/offline V18 flow')
ok('admin_grade_submission_v18' in app and 'p_reason' in app,'transaction grade + revision reason')
ok('admin_integrity_report_v18' in app and 'admin_capacity_report_v18' in app,'integrity/capacity monitor')
ok('start_exam_v18' in exam and 'submit_exam_attempt_v18' in exam and 'admin_import_exam_bank_v18' in exam,'V18 exam runtime')
ok('คะแนนสอบกลางภาค/ปลายภาค เฉลย และความคิดเห็นเป็นข้อมูล Admin เท่านั้น' in exam,'student exam privacy')
ok(len(items)==550,'exam bank must contain 550 questions')
subjects={x.get('subjectCode') for x in items};ok(len(subjects)==11,'exam bank must cover 11 subjects')
for code in subjects:
    rows=[x for x in items if x.get('subjectCode')==code]
    ok(len(rows)==50,f'{code}: must have 50 questions')
    levels={k:sum(1 for x in rows if x.get('level')==k) for k in ('basic','easy','hard')}
    ok(levels=={'basic':10,'easy':15,'hard':25},f'{code}: difficulty 10/15/25')
ok('registration_rate_check_v18' in edge_reg,'registration rate limiting')
ok('LEGACY_INITIALIZE_SYSTEM_DISABLED' in edge_admin and 'LEGACY_GRADE_DISABLED' in edge_admin,'legacy admin mutation disabled')
ok('finalize_digital_submission_v18' in align and 'admin_import_exam_bank_v18' in align,'runtime migration mirror')
ok('return slides.slice(0,20)' in course,'20-slide unit deck')
ok('doc-full-nr-v18-1-complete-learning-system-20260916' in sw,'V18.1 service worker')
ok('exam-question-bank-v18.json' in sw,'exam bank precache')
if errors:
    print('V18.1 COMPLETE LEARNING SYSTEM CONTRACT FAILED')
    for x in errors:print('-',x)
    sys.exit(1)
print('V18.1 COMPLETE LEARNING SYSTEM CONTRACT PASS')
print('subjects=11 exam_questions=550 paper=multi-page profile=detail course_code=V18 offline=IndexedDB')
