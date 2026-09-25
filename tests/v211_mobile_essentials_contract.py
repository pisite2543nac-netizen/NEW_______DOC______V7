from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
app=(SITE/'app.js').read_text('utf-8')
platform=(SITE/'v16-platform.js').read_text('utf-8')
runtime=(SITE/'v21-runtime.js').read_text('utf-8')
css=(SITE/'v21-core-ui.css').read_text('utf-8')
index=(SITE/'index.html').read_text('utf-8')
meta=(SITE/'release-meta.js').read_text('utf-8')
version=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert version['release_marker'] in {'V21.1','V21.2'}
assert 'RELEASE_VERSION="V21.1"' in meta or 'RELEASE_VERSION="V21.2"' in meta
assert 'data-docnr-release="v21-1-mobile-essentials-reliable-back"' in index or 'data-docnr-release="v21-2-cross-device-stable"' in index
# Five primary phone actions only; desktop route tables remain intact.
assert 'const phoneRoutes=' in runtime
for token in ['attendance','workcheck','courses','profile']:
    assert token in runtime, token
assert runtime.count("'notifications'")>=3
assert 'data-v21-more aria-label' not in runtime
assert 'MOBILE_ESSENTIAL_NAV' in app
assert "if(kind==='phone')return MOBILE_ESSENTIAL_NAV[role]" in app
assert 'goBack:goBackUnified' in app
assert "#global-back,[data-docnr-back]" in runtime
assert "Promise.resolve(f()).catch(()=>navigate('dashboard'))" in runtime
assert 'html.docnr-phone .sidebar' in css and 'display:none!important' in css
assert 'html.docnr-phone .mobile-menu' in css
assert 'touch-action:manipulation' in css
assert 'docnr-mobile-essential-grid' in css
# Heavy phone entry points hidden but source/full desktop functions retained.
for route in ['exam','printcenter','specialactivity','academic','students','roomgroups','users','audit','system','overrides','promotion']:
    assert f'data-app-route="{route}"' in css
for token in ['renderAdminDashboard','renderTeacherDashboardV207','renderStudentDashboard','renderPaperScanHub','renderAttendance','renderRoomWorkChecklist','renderTeacherChecklistV207']:
    assert token in platform
assert 'งานเต็มใช้บนคอม' in platform
assert 'Mobile Essentials' in platform or 'MOBILE ESSENTIALS' in platform
print('V21.1 MOBILE ESSENTIALS STATIC CONTRACT PASS')
