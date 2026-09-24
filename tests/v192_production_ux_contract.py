from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/'site/index.html').read_text('utf-8');css=(ROOT/'site/v21-core-ui.css').read_text('utf-8');js=(ROOT/'site/v21-runtime.js').read_text('utf-8');app=(ROOT/'site/app.js').read_text('utf-8')
checks={
 'V21 loaded last':'v21-core-ui.css' in idx and idx.index('v21-core-ui.css')>idx.index('v19-programming-activity.css'),
 'single runtime':'v21-runtime.js' in idx and 'v19-ux-runtime.js' not in idx and 'mobile.js' not in idx and 'v20-stability-runtime.js' not in idx,
 'dark theme':'html[data-theme="dark"]' in css,
 'phone bottom nav':'#docnr-mobile-nav' in css and 'ensureMobileNav' in js,
 'drawer backdrop':'#docnr-v21-backdrop' in css and 'ensureBackdrop' in js,
 'touch targets':'min-height:44px' in css or 'min-height:46px' in css,
 'reduced motion':'prefers-reduced-motion' in css,
 'safe area':'safe-area-inset-bottom' in css,
 'internal table scroll':'.table-wrap' in css and 'overflow:auto!important' in css,
 'responsive state':'dataset.device' in js and 'dataset.orientation' in js,
 'version label':'RELEASE_VERSION' in app,
}
assert all(checks.values()),[k for k,v in checks.items() if not v]
print('V19.2 PRODUCTION UX COMPATIBILITY CONTRACT PASS VIA V21')
