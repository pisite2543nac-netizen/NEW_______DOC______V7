from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/'site/index.html').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
course=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
hard=(ROOT/'site/v16-7-hardening.js').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
doc=(ROOT/'docs/V17_6_11SUBJECTS_17UNITS.md').read_text('utf-8')
errors=[]
def ok(c,m):
    if not c: errors.append(m)
ok('v17-6-full-11subjects-production' in idx,'release marker')
ok('V17.6-FULL-11SUBJECTS' in course,'course release')
ok('/374' in app and '/187' in app and 'subjects_with_17_units' in app,'system health UI counts')
ok('renderDigitalWorksheetPages' in app and 'หน้า ${p+1}/${pageCount}' in app,'digital >=2-page renderer')
ok('pageCount=Math.max(2' in hard,'admin paper >=2-page print')
ok('function unitWorkPair' in course and 'paperDone' in course,'student logical pair state')
ok('my_prepare_late_paper_print' in course,'student late paper RPC')
ok('LOGICAL PAIRS' in platform and 'data-v175-late-paper' in platform,'work-status pair view')
ok('renderStudentCourse' in platform and '17 หน่วย' in platform,'room 17-unit contract')
ok('doc-full-nr-v17-6-full-11subjects-20260915' in sw,'V17.6 cache')
ok(doc.count('## ') == 11,'11 subject documentation')
ok(doc.count('สไลด์ 20 หน้า') >= 188,'17-unit documentation')
if errors:
    print('V17.6 FULLSET CONTRACT FAILED');[print('-',x) for x in errors];raise SystemExit(1)
print('V17.6 FULLSET CONTRACT PASS')
