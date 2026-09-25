from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'site'
app=(site/'app.js').read_text('utf-8')
ux=(site/'v19-ux-runtime.js').read_text('utf-8')
platform=(site/'v16-platform.js').read_text('utf-8')
cam=(site/'device-camera-runtime.js').read_text('utf-8')
css=(site/'v20-unified-ui.css').read_text('utf-8')
idx=(site/'index.html').read_text('utf-8')
meta=(site/'release-meta.js').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))

assert 'data-docnr-release="v20-5-late-teacher-barcode-admin-room-groups"','data-docnr-release="v20-6-adaptive-stability-teacher-room-integration"' in idx
assert any(x in meta for x in ['RELEASE_VERSION="V20.5"','RELEASE_VERSION="V20.6"','RELEASE_VERSION="V20.7"','RELEASE_VERSION="V21.0"','RELEASE_VERSION="V21.1"','RELEASE_VERSION="V21.2"']) and any(x in meta for x in ['20260923-v20-5','20260924-v20-6','20260924-v20-7','20260924-v21-0','20260925-v21-1','20260925-v21-2'])
assert float(ver['version'])>=20.5 and ver['release_marker'] in {'V20.5','V20.6','V20.7','V21.0','V21.1','V21.2'}
# Real phone recording regression: Admin Attendance was missing from route authorization and fell back to dashboard.
m=re.search(r'const ADMIN_ROUTES=new Set\(\[([^\]]+)\]\)',app)
assert m and '"attendance"' in m.group(1), 'Admin attendance subroute must be authorized'
assert 'if(isAdmin()&&route==="attendance")return "attendancehub"' in app
assert 'if(isAdmin()&&S.route==="attendance")return {route:"attendancehub",arg:null}' in app
# Route state/lifecycle is explicit, and async feature renders are epoch/serial protected.
for marker in ['S.navSerial','docnr:route-start','docnr:route-ready','dataset.appRoute','expectedSerial!==S.navSerial']:
    assert marker in app,marker
for marker in ['state.navEpoch','routeEpoch!==state.navEpoch','state.route!=="attendance"','state.route!=="paperscan"']:
    assert marker in platform,marker
# Phone nav must route directly, not click hidden desktop/sidebar controls.
assert "return isAdmin()?['dashboard','attendance','paperscan','students']" in ux
assert 'window.DOCNR_BASE?.navigate' in ux
assert 'data-mobile-route' in ux
# Camera teardown on route lifecycle prevents stale stream ownership after navigation.
assert "addEventListener('docnr:route-start'" in cam
assert "stopAll('route-start')" in cam
# Attendance camera requires room + subject before permission prompt.
assert 'กรุณาเลือกห้องและรายวิชาก่อนเปิดกล้อง' in platform
# Adaptive UX classes exist for real phone/tablet/desktop layouts.
for marker in ['.v204-phone-primary','.v204-phone-primary-actions','.v204-phone-secondary','html.docnr-phone','html.docnr-tablet']:
    assert marker in css,marker
print('V20.4 REAL-DEVICE MOBILE ROUTER/ADAPTIVE CAMERA STATIC CONTRACT PASS')
