from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]; site=ROOT/'site'
idx=(site/'index.html').read_text('utf-8'); css=(site/'v20-stability.css').read_text('utf-8'); js=(site/'v20-stability-runtime.js').read_text('utf-8'); sw=(site/'sw.js').read_text('utf-8'); meta=(site/'release-meta.js').read_text('utf-8'); ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert any(x in idx for x in ['data-docnr-release="v20-6-adaptive-stability-teacher-room-integration"','data-docnr-release="v20-7-long-term-ux-teacher-production-stability"'])
assert any(x in idx for x in ['v20-stability.css?v=20260924-v20-6','v20-stability.css?v=20260924-v20-7']) and any(x in idx for x in ['v20-stability-runtime.js?v=20260924-v20-6','v20-stability-runtime.js?v=20260924-v20-7'])
assert idx.index('v20-stability.css') > idx.index('v20-unified-ui.css')
assert any(x in meta for x in ['RELEASE_VERSION="V20.6"','RELEASE_VERSION="V20.7"']) and float(ver['version'])>=20.6 and ver['release_marker'] in {'V20.6','V20.7'}
for m in ['--docnr-vh','visualViewport','docnr:viewport-stable','stabilizeChrome','pointerEvents','docnr:route-ready']:
    assert m in js,m
for m in ['.docnr-sidebar-backdrop{pointer-events:none!important','.docnr-sidebar-backdrop.open{pointer-events:auto!important','max-height:calc(100dvh','html.docnr-tablet','html.docnr-phone','overflow-x:clip','touch-action:manipulation']:
    assert m in css,m
assert any(x in sw for x in ['doc-full-nr-v20-6-adaptive-stability-teacher-room-integration-20260924','doc-full-nr-v20-7-long-term-ux-teacher-production-stability-20260924'])
assert any(x in sw for x in ['./v20-stability.css?v=20260924-v20-6','./v20-stability.css?v=20260924-v20-7']) and any(x in sw for x in ['./v20-stability-runtime.js?v=20260924-v20-6','./v20-stability-runtime.js?v=20260924-v20-7'])
print('V20.6 ADAPTIVE STABILITY STATIC CONTRACT PASS')
