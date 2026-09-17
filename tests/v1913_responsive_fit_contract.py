from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'site/index.html').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
css=(ROOT/'site/v19-responsive-fit.css').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
checks={
  'fit css before production ui':'v19-responsive-fit.css?v=20260917-v19-2' in index and index.index('v19-responsive-fit.css')>index.index('v16-8-course-flow.css') and index.index('v19-production-ui.css')>index.index('v19-responsive-fit.css'),
  'full width content':'max-width:none!important' in css and '.content,#content' in css,
  'fluid sidebar':'--docnr-sidebar-w:clamp(' in css and 'grid-template-columns:var(--docnr-sidebar-w)' in css,
  'tablet drawer':'@media (max-width:960px)' in css and 'transform:translateX(-105%)' in css,
  'mobile layout':'@media (max-width:620px)' in css and '.v186-filter-grid{grid-template-columns:1fr!important}' in css,
  'table internal scroll':'overscroll-behavior:contain' in css and '.v186-table-scroll' in css,
  'zoom compensation':'function syncResponsiveFit()' in app and '--docnr-page-scale' in app and '#app{width:calc(100% / var(--docnr-page-scale))' in css,
  'service worker cache':'v19-responsive-fit.css?v=20260917-v19-2' in sw and 'doc-full-nr-v19-2-production-ux-20260917' in sw,
}
failed=[k for k,v in checks.items() if not v]
if failed: raise SystemExit('V19.1.3 RESPONSIVE FIT CONTRACT FAIL: '+', '.join(failed))
for k in checks: print(k+': PASS')
print('V19.1.3 RESPONSIVE FIT COMPATIBILITY CONTRACT PASS')
