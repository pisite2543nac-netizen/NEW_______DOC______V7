from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];site=ROOT/'site'
idx=(site/'index.html').read_text(encoding='utf-8');css=(site/'v21-core-ui.css').read_text(encoding='utf-8');js=(site/'v21-runtime.js').read_text(encoding='utf-8');sw=(site/'sw.js').read_text(encoding='utf-8');meta=(site/'release-meta.js').read_text(encoding='utf-8');ver=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
assert ('data-docnr-release="v21-0-major-stability-unified-runtime"' in idx) or ('data-docnr-release="v21-1-mobile-essentials-reliable-back"' in idx) or (('data-docnr-release="v21-2-cross-device-stable"' in idx) or ('data-docnr-release="v21-3-no-sidebar-stable"' in idx))
assert (('v21-core-ui.css?v=20260924-v21-0' in idx and 'v21-runtime.js?v=20260924-v21-0' in idx) or ('v21-core-ui.css?v=20260925-v21-1' in idx and 'v21-runtime.js?v=20260925-v21-1' in idx) or (('v21-core-ui.css?v=20260925-v21-2' in idx and 'v21-runtime.js?v=20260925-v21-2' in idx) or ('v21-core-ui.css?v=20260925-v21-3' in idx and 'v21-runtime.js?v=20260925-v21-3' in idx)))
assert 'v20-stability.css' not in idx and 'v20-stability-runtime.js' not in idx
assert (('RELEASE_VERSION="V21.0"' in meta and ver['version']=='21.0') or ('RELEASE_VERSION="V21.1"' in meta and ver['version']=='21.1') or (('RELEASE_VERSION="V21.2"' in meta and ver['version']=='21.2') or ('RELEASE_VERSION="V21.3"' in meta and ver['version']=='21.3')))
for m in ['--docnr-vh','visualViewport','docnr:viewport-stable','docnr:route-ready','dataset.orientation']: assert m in js,m
for m in ['#docnr-v21-backdrop','max-height:calc(100dvh','html.docnr-tablet','html.docnr-phone','overflow-x:clip','touch-action:manipulation']: assert m in css,m
assert ('doc-full-nr-v21-0-major-stability-unified-runtime-20260924' in sw) or ('doc-full-nr-v21-1-mobile-essentials-reliable-back-20260925' in sw) or (('doc-full-nr-v21-2-cross-device-stable-20260925' in sw) or ('doc-full-nr-v21-3-no-sidebar-stable-20260925' in sw))
print('V20.6 ADAPTIVE STABILITY COMPATIBILITY PASS VIA V21')
