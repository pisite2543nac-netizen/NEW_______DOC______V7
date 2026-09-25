from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v20-unified-ui.css').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
mobile=(ROOT/'site/mobile.js').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
manifest=json.loads((ROOT/'site/manifest.webmanifest').read_text('utf-8'))
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
knowledge=(ROOT/'site/data/teaching-knowledge-v20.js').read_text('utf-8')
mig1=(ROOT/'supabase/migrations/20260922_v20_0_teaching_slide_metadata.sql').read_text('utf-8')
mig2=(ROOT/'supabase/migrations/20260922_v20_0_reversible_teaching_close.sql').read_text('utf-8')

assert ('data-docnr-release="v21-2-cross-device-stable"' in idx) or ('data-docnr-release="v21-1-mobile-essentials-reliable-back"' in idx) or ('data-docnr-release="v21-0-major-stability-unified-runtime"' in idx) or ('data-docnr-release="v20-0-teaching-presentation-unified"' in idx) or (('data-docnr-release="v20-1-content-focused-slides"' in idx) or ('data-docnr-release="v20-2-adaptive-mobile-camera-stability"' in idx) or ('data-docnr-release="v20-3-device-adaptive-interaction-camera-stability"' in idx) or (('data-docnr-release="v20-4-real-device-mobile-router-adaptive-camera"' in idx) or ('data-docnr-release="v20-5-late-teacher-barcode-admin-room-groups"','data-docnr-release="v20-6-adaptive-stability-teacher-room-integration"' in idx)))
assert ((('v21-core-ui.css?v=20260924-v21-0' in idx) or ('v21-core-ui.css?v=20260925-v21-1' in idx) or ('v21-core-ui.css?v=20260925-v21-2' in idx)) and idx.index('v21-core-ui.css')>idx.index('v19-programming-activity.css'))
assert 'release-meta.js' in flow and 'RELEASE_VERSION' in flow
assert 'TEACHING_KNOWLEDGE' in flow and 'teaching-knowledge-v20.js' in flow
for marker in ['DEFINITION','KEY CONCEPTS','PRINCIPLE','PROCESS','CORRECT / INCORRECT','CASE STUDY','COMMON MISTAKE + TROUBLESHOOTING','SAFETY / PRECAUTION','WORKSHEET • DIGITAL','WORKSHEET • PAPER','EXAM ALIGNMENT','TEACHER NOTE + REVIEW','KEY TAKEAWAY']:
    assert marker in flow, marker
assert 'return slides.slice(0,20)' in flow
assert 'Learning Goal' in flow and 'Question Bank' in flow
assert 'Answer Key' in flow and 'ไม่เปิดเผยข้อสอบ' in flow
# Exam bank alignment artifact may contain only explanations, never actual item payload.
assert 'export const TEACHING_KNOWLEDGE' in knowledge
assert '"correct"' not in knowledge and '"options"' not in knowledge and '"q"' not in knowledge
assert knowledge.count('\n  "')==11
assert len(re.findall(r'^    "',knowledge,re.M))>=374
# Contrast + presentation/fullscreen.
for sel in ['.v174-slide{','.v174-slide-body p{','.v199-slide-explain{','html[data-theme="dark"] .v174-slide{','#v168-overlay.v20-slide-present']:
    assert sel in css, sel
assert 'color:#173126!important' in css and 'color:#eefaf2!important' in css
assert 'data-v168-slide-fullscreen' in flow and 'นำเสนอเต็มจอ' in flow and 'requestFullscreen' in flow
# Reversible teaching close is backend-authoritative and preserves existing records.
assert 'admin_lock_subject_unit_v20' in flow and 'data-v20-lock' in flow and 'ปิดการสอน' in flow
assert "status='draft'" in mig2 and 'CLOSE_LATEST_UNIT_FIRST' in mig2
for word in ['preserve_assignments','preserve_submissions','preserve_grades']:
    assert word in mig2
assert 'delete from public.worksheet_assignments' not in mig2.lower()
assert 'delete from public.submissions' not in mig2.lower()
# Metadata RPC delivers unit teaching metadata to both Admin and Student paths.
for word in ['key_concepts','practice_steps','control_points','case_study','exit_questions']:
    assert mig1.count(word)>=2
# Unified dashboard and Print System.
assert platform.count('dashboardRouteCard("specialactivity"')>=2
assert 'v20-print-meta-grid' in platform and 'RELEASE_VERSION' in platform
assert 'หนึ่ง Router = หนึ่ง Backend Contract' not in platform
# PWA/browser focus mode.
assert manifest['display']=='fullscreen' and 'fullscreen' in manifest.get('display_override',[])
assert ('tryFocusFullscreen' in mobile or 'tryDesktopFocusFullscreen' in mobile) and 'enterFullscreen' in mobile and 'pointerdown' in mobile
assert ('doc-full-nr-v20-0-teaching-presentation-unified-20260922' in sw) or (('doc-full-nr-v20-1-content-focused-slides-20260922' in sw) or ('doc-full-nr-v20-2-adaptive-mobile-camera-stability-20260922' in sw) or ('doc-full-nr-v20-3-device-adaptive-interaction-camera-stability-20260922' in sw) or (('doc-full-nr-v20-4-real-device-mobile-router-adaptive-camera-20260923' in sw) or ('doc-full-nr-v20-5-late-teacher-barcode-admin-room-groups-20260923' in sw)))
assert float(ver['version'])>=20.0 and ver['teaching_slides']['logical_slide_pages']==3740
assert ver['print_system']['legacy_engine_retained']=='V19.6'
assert ver['teaching_unit_close']['backend_enforced'] is True
print('V20.0 TEACHING PRESENTATION + UNIFIED UX + PRINT + FULLSCREEN CONTRACT PASS')
