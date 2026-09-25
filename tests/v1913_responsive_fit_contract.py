from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'site/index.html').read_text('utf-8');app=(ROOT/'site/app.js').read_text('utf-8');legacy=(ROOT/'site/v19-responsive-fit.css').read_text('utf-8');v21=(ROOT/'site/v21-core-ui.css').read_text('utf-8');sw=(ROOT/'site/sw.js').read_text('utf-8')
assert ('data-docnr-release="v21-0-major-stability-unified-runtime"' in index) or ('data-docnr-release="v21-1-mobile-essentials-reliable-back"' in index)
assert (('v21-core-ui.css?v=20260924-v21-0' in index) or ('v21-core-ui.css?v=20260925-v21-1' in index)) and index.index('v21-core-ui.css')>index.index('v16-8-course-flow.css')
assert '<link rel="stylesheet" href="./v19-responsive-fit.css' not in index
assert 'function syncResponsiveFit()' in app and "setProperty('--docnr-page-scale','1')" in app
assert '--docnr-shell-w' in v21 and '@media (max-width:959px)' in v21 and '@media (max-width:620px)' in v21
assert 'overflow:auto!important' in v21 and 'overscroll-behavior' in v21
assert ('doc-full-nr-v21-0-major-stability-unified-runtime-20260924' in sw) or ('doc-full-nr-v21-1-mobile-essentials-reliable-back-20260925' in sw)
assert 'doc-full-nr-v19-2-production-ux-20260917' in sw
print('V19.1.3 RESPONSIVE FIT COMPATIBILITY CONTRACT PASS VIA V21')
