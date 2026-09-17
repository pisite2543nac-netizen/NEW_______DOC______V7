from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/'site/index.html').read_text('utf-8')
css=(ROOT/'site/v19-production-ui.css').read_text('utf-8')
js=(ROOT/'site/v19-ux-runtime.js').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
checks={
 'production ui loaded last':'v19-production-ui.css' in idx and idx.index('v19-production-ui.css')>idx.index('v19-responsive-fit.css'),
 'ux runtime loaded':'v19-ux-runtime.js' in idx,
 'green theme':'--ux-green-700:#1f7a4f' in css,
 'dark theme':'html[data-theme="dark"]' in css,
 'phone bottom nav':'docnr-mobile-bottom-nav' in css and 'buildBottomNav' in js,
 'tablet drawer backdrop':'docnr-sidebar-backdrop' in css and 'ensureBackdrop' in js,
 'touch targets':'@media (pointer:coarse)' in css,
 'reduced motion':'prefers-reduced-motion' in css,
 'high contrast':'prefers-contrast:more' in css,
 'safe area':'safe-area-inset-bottom' in css,
 'compact laptop':'max-height:820px' in css,
 'table accessibility':'enhanceTables' in js,
 'responsive state':'dataset.device' in js and 'dataset.orientation' in js,
 'version label':'V19.2' in app,
}
for k,v in checks.items(): print(f'{k}:', 'PASS' if v else 'FAIL')
assert all(checks.values())
print('V19.2 PRODUCTION UX CONTRACT PASS')
