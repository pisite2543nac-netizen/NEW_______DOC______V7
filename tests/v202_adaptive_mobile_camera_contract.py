from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'site'
index=(site/'index.html').read_text('utf-8')
sw=(site/'sw.js').read_text('utf-8')
app=(site/'app.js').read_text('utf-8')
mobile=(site/'mobile.js').read_text('utf-8')
css=(site/'mobile.css').read_text('utf-8')
platform=(site/'v16-platform.js').read_text('utf-8')
cam=(site/'device-camera-runtime.js').read_text('utf-8')
meta=(site/'release-meta.js').read_text('utf-8')
version=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
manifest=json.loads((site/'manifest.webmanifest').read_text('utf-8'))

assert 'data-docnr-release="v20-5-late-teacher-barcode-admin-room-groups"','data-docnr-release="v20-6-adaptive-stability-teacher-room-integration"' in index
assert index.index('device-camera-runtime.js') < index.index('app.js') < index.index('v16-platform.js')
assert any(x in sw for x in ['doc-full-nr-v20-5-late-teacher-barcode-admin-room-groups','doc-full-nr-v20-6-adaptive-stability-teacher-room-integration'])
assert any(x in sw for x in ['./device-camera-runtime.js?v=20260923-v20-5','./device-camera-runtime.js?v=20260924-v20-6','./device-camera-runtime.js?v=20260924-v20-7'])
assert any(x in meta for x in ['RELEASE_VERSION="V20.5"','RELEASE_VERSION="V20.6"','RELEASE_VERSION="V20.7"']) and any(x in meta for x in ['20260923-v20-5','20260924-v20-6','20260924-v20-7'])
assert float(version['version'])>=20.5 and version['release_marker'] in {'V20.5','V20.6','V20.7'}
assert any(version['device_usage_policy']['phone'].startswith(x) for x in ['attendance QR scan','camera-first attendance QR scan'])
assert version['camera_runtime']['attendance_scan'] is True
assert manifest['theme_color'].lower()=='#1f7a4f'

# Device policy must not be based on viewport CSS width alone.
for marker in ['navigator.userAgentData?.mobile','iPhone|iPod','iPad','Android','navigator.maxTouchPoints','shortestScreen()']:
    assert marker in cam, marker
assert "return 'phone'" in cam and "return 'tablet'" in cam and "return 'desktop'" in cam

# Camera resilience: rear camera preference -> progressively relaxed constraints + clean shutdown.
for marker in ["facingMode:{exact:'environment'}","facingMode:{ideal:'environment'}","video:true","stopAll","visibilitychange","pagehide","ensureJsQR","normalizeImageBlob"]:
    assert marker in cam, marker
assert 'BarcodeDetector' in cam and 'window.jsQR' in cam

# Attendance and paper evidence must both use managed camera runtime and photo fallback.
for marker in ['id="v202-att-photo"','DOCNR_CAMERA?.scanFile','DOCNR_CAMERA?.stopScanner?.("attendance"']:
    assert marker in platform, marker
for marker in ['id="v202-paper-code-photo"','id="v202-paper-page-photo"','key:"paper-scan"','normalizeImageBlob']:
    assert marker in platform, marker
assert 'window.DOCNR_CAMERA?.stopAll?.(' in platform

# Phone: Digital Worksheet is view-only and final/draft outbox does not submit in the background.
assert 'const phoneReadOnly=isPhoneDevice();' in app
assert 'const canWork=!notOpen&&!deadlineBlocked&&!locked&&!phoneReadOnly;' in app
assert 'docnr-phone-worksheet-policy' in app
assert 'if(isPhoneDevice())return;' in app
assert "form?.classList.add('docnr-worksheet-readonly')" in app

# Fullscreen must not steal camera/file input gestures on phones.
assert 'isInteractiveTarget' in mobile and '!DEVICE.isDesktop' in mobile and 'requestFullscreen' in mobile
assert 'html.docnr-phone .v14-camera-grid' in css
assert 'html.docnr-tablet .v14-camera-grid' in css

print('V20.2 ADAPTIVE MOBILE/CAMERA STATIC CONTRACT PASS')
