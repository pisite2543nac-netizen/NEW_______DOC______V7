from pathlib import Path
import json,re,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
errors=[]
def ok(cond,msg):
    if not cond: errors.append(msg)

required=[
 'index.html','app.js','camera-registration.js','mobile.js','styles.css','mobile.css',
 'v15-tech.css','v15-platform.js','v15-exam.js','exam.html','manifest.webmanifest','sw.js'
]
for f in required: ok((SITE/f).is_file(),f'missing site/{f}')
index=(SITE/'index.html').read_text('utf-8')
exam=(SITE/'exam.html').read_text('utf-8')
ok('V15' in index or 'v15' in index,'index missing V15 release marker')
ok('v15-platform.js' in index,'index missing v15-platform.js')
ok('v15-exam.js' in exam,'exam missing v15-exam.js')
for legacy in ['v9-features.js','subject-bundles.js','v12-system.js','v13-course-system.js','v14-platform.js','v14-exam.js']:
    ok(legacy not in index and legacy not in exam,f'legacy production script referenced: {legacy}')
manifest=json.loads((SITE/'manifest.webmanifest').read_text('utf-8'))
ok(manifest.get('display')=='standalone','manifest display must be standalone')
icons=manifest.get('icons') or []
ok(any(x.get('sizes')=='192x192' for x in icons),'manifest missing 192 icon')
ok(any(x.get('sizes')=='512x512' for x in icons),'manifest missing 512 icon')
ok(any('maskable' in str(x.get('purpose','')) for x in icons),'manifest missing maskable icon')
for f in ['icon-48.png.b64','icon-180.png.b64','icon-192.png.b64','icon-512.png.b64','icon-maskable-512.png.b64']:
    ok((SITE/'icons'/f).is_file(),f'missing icon source {f}')
sw=(SITE/'sw.js').read_text('utf-8')
ok('doc-full-nr-v15-1-subject-rooms-20260911' in sw,'service worker cache marker is not V15')
platform=(SITE/'v15-platform.js').read_text('utf-8')
ok('V15.1-SUBJECT-ROOMS-INTEGRATED' in platform,'platform V15 marker missing')
examjs=(SITE/'v15-exam.js').read_text('utf-8')
ok('my_exam_attempt_status' in examjs,'student exam status RPC not used')
# Score may appear in Admin paths, but student exam home must not query score from exam attempts.
ok('score,max_score' not in examjs,'v15 exam contains explicit student-style score,max_score query')
app=(SITE/'app.js').read_text('utf-8')
ok('my_submission_override_v15' in app,'V15 submission override RPC not used')
ok('preview_before_submit' in app,'preview-before-submit behavior marker missing')
if errors:
    print('STATIC VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('STATIC VALIDATION PASS')
print('release=V15.1 SUBJECT ROOMS; files=',len(required),'manifest_icons=',len(icons))
