from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
js=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
checks={
'release':'v17-5-17unit-workpair-production' in idx,
'20 slides':'return slides.slice(0,20)' in js and 'LATE WORK' in js and 'ON-TIME WORK' in js,
'unified student':'function unitWorkPair' in js and 'data-v175-late-paper' in js,
'unified admin':'data-v175-admin-pair' in js and 'openAdminWorkPair' in js,
'student late rpc':'my_prepare_late_paper_print' in js,
'2 page paper':'v175-paper-page' in js and 'หน้า ${pi+1}/2' in js,
'barcode':'JsBarcode' in js and 'barcode_payload' in js,
'cache':'doc-full-nr-v17-5-17unit-workpair-20260915' in sw,
'print css':'body.v175-print-paper' in css,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print('V17.5 WORKPAIR CONTRACT FAILED');[print('-',x) for x in bad];raise SystemExit(1)
print('V17.5 WORKPAIR CONTRACT PASS')
