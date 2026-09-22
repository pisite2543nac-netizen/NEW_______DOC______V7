from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'site'
idx=(site/'index.html').read_text('utf-8')
sw=(site/'sw.js').read_text('utf-8')
mobile=(site/'mobile.js').read_text('utf-8')
ux=(site/'v19-ux-runtime.js').read_text('utf-8')
cam=(site/'device-camera-runtime.js').read_text('utf-8')
platform=(site/'v16-platform.js').read_text('utf-8')
hard=(site/'v16-7-hardening.js').read_text('utf-8')
css=(site/'v20-unified-ui.css').read_text('utf-8')
meta=(site/'release-meta.js').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))

assert 'data-docnr-release="v20-3-device-adaptive-interaction-camera-stability"' in idx
assert 'doc-full-nr-v20-3-device-adaptive-interaction-camera-stability-20260922' in sw
assert 'RELEASE_VERSION="V20.3"' in meta and '20260922-v20-3' in meta
assert ver['version']=='20.3' and ver['release_marker']=='V20.3'

# One mobile drawer owner: legacy backdrop is removed/disabled and a single docnr backdrop owns tap interception.
assert "document.getElementById('mobile-nav-backdrop')?.remove()" in mobile
assert "document.getElementById('mobile-nav-backdrop')?.remove()" in ux
assert "className='docnr-sidebar-backdrop'" in ux
assert '--v203-drawer-z:70' in css and '--v203-backdrop-z:60' in css
assert '.docnr-sidebar-backdrop:not(.open)' in css and 'pointer-events:none!important' in css
assert '#mobile-nav-backdrop{display:none!important' in css

# Phone navigation is camera-first for Admin.
assert "['dashboard','attendancehub','paperscan','students']" in ux
assert 'v203-phone-hub' in platform and 'PHONE WORK MODE' in platform

# Mobile/touch must not spend the trusted gesture on automatic fullscreen.
assert 'if(!DEVICE.isDesktop' in mobile
assert "isInteractiveTarget(e.target)" in mobile
assert 'contextmenu' in mobile and 'if(DEVICE.touch' in mobile

# Camera starts are race-safe and emit lifecycle events to feature pages.
for marker in ['const starts=new Map()','const epochs=new Map()','starts.has(key)','docnr:camera-stopped','page-hidden','hasLiveTracks']:
    assert marker in cam, marker
assert 'dataset.cameraOpening' in platform
assert 'e.detail?.key!=="attendance"' in platform
assert 'e.detail?.key!=="paper-scan"' in platform
assert 'attPhoto.onclick=()=>stopScanner()' in platform
assert 'codePhoto.onclick=()=>stop()' in platform
assert 'pagePhoto.onclick=()=>stop()' in platform

# Old paper fallback must defer to any managed camera runtime, not an exact version string.
assert 'if(window.DOCNR_CAMERA?.startScanner) return;' in hard
assert 'window.DOCNR_CAMERA?.release==="V20.2"' not in hard

print('V20.3 MOBILE INTERACTION/CAMERA STATIC CONTRACT PASS')
