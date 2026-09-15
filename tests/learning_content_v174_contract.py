from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
js=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260915_v17_4_learning_content_hub.sql').read_text('utf-8')
checks={
 'release marker':'v17-4-learning-content-production' in idx,
 'release runtime':'V17.4-LEARNING-CONTENT-HUB' in js,
 '7+ deck content':'deckSlides(' in js and 'TEACHER NOTE' in js and 'KEY CONCEPTS' in js,
 'deck navigation':'data-v174-prev' in js and 'data-v174-next' in js,
 'print/PDF':'data-v174-print' in js and 'v174-print-slides' in css,
 'fullscreen':'data-v168-slide-fullscreen' in js,
 'unit topic':'unitTopic(unit)' in js,
 'admin resources':'resources.map' in js and "'resources',u.resources" in mig,
 'digital/paper controls':'data-v14-preview' in js and 'data-v167-print-pack' in js,
 'student lock':'if(!unit||!unit.unlocked)' in js,
 'cache':'doc-full-nr-v17-4-learning-content-20260915' in sw,
 'v17.3 compatibility':'doc-full-nr-v17-3-full-system-20260915' in sw,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print('V17.4 LEARNING CONTENT CONTRACT FAILED');[print('-',x) for x in bad];raise SystemExit(1)
print('V17.4 LEARNING CONTENT CONTRACT PASS')
