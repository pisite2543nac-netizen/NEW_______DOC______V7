from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/'site/index.html').read_text('utf-8');app=(ROOT/'site/app.js').read_text('utf-8');mobile=(ROOT/'site/mobile.js').read_text('utf-8');platform=(ROOT/'site/v16-platform.js').read_text('utf-8');course=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8');exam=(ROOT/'site/v16-exam.js').read_text('utf-8');sw=(ROOT/'site/sw.js').read_text('utf-8');manifest=json.loads((ROOT/'site/manifest.webmanifest').read_text('utf-8'));css=(ROOT/'site/mobile.css').read_text('utf-8')
errors=[]
def ok(c,m):
    if not c: errors.append(m)
ok('v17-3-full-system-production' in idx,'release marker missing')
ok(manifest.get('display')=='standalone','manifest fallback display must remain standalone')
ok('fullscreen' in manifest.get('display_override',[]),'fullscreen display_override missing')
ok('beforeinstallprompt' in app and 'installationSteps' in app,'device install guide missing')
ok('auth-install' in app,'install/help control missing on login screen')
ok('id="fullscreen"' in app,'fullscreen topbar button missing')
ok('DOCNR_MOBILE_RUNTIME' in mobile and 'requestFullscreen' in mobile,'fullscreen runtime missing')
for token in ["'copy'","'cut'","'contextmenu'","'selectstart'"]: ok(token in mobile,f'copy protection event missing {token}')
ok('docnr-copy-protected' in css,'copy-protection CSS missing')
ok('location.href=`./exam.html' in app,'exam route is not same-window PWA navigation')
ok('profiles!subject_enrollments_user_id_fkey' in platform,'subject enrollment profile relation is not explicit')
ok('profiles!exam_attempts_user_id_fkey' in exam,'exam attempt profile relation is not explicit')
ok('data-v167-print-pack' in platform and 'data-v167-print-pack' in course,'direct paper print controls missing')
ok('admin_record_paper_scan_page_v18' in platform and 'v16-capture-review' in platform and 'expectedPages' in platform,'multi-page whole-sheet review/confirmation missing')
ok('data-v168-admin-slide' in course and 'สไลด์สรุปพร้อมใช้' in course,'admin ready slide control missing')
ok('เพิ่มสไลด์/สื่อของครู' in course,'unit resource upload control missing')
ok('doc-full-nr-v18-1-complete-learning-system-20260916' in sw,'V18.1 service-worker cache missing')
ok('doc-full-nr-v17-1-course-code-20260915' in sw,'V17.1 compatibility marker missing')
if errors:
    print('V17.3 RUNTIME CONTRACT FAILED');[print('-',e) for e in errors];raise SystemExit(1)
print('V17.3 RUNTIME CONTRACT PASS')
