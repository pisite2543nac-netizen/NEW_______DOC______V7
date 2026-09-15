from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
index=(ROOT/'site/index.html').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
errors=[]
def ok(c,m):
    if not c: errors.append(m)
ok('v17-1-course-code-production' in index,'missing V17.1 release marker')
ok('admin_subject_join_code_registry' in platform,'admin CODE registry RPC missing')
ok('join_subject_with_code' in platform,'student CODE join RPC missing')
ok('data-v165-copy-code' in platform,'copy CODE action missing')
ok('data-v165-change-code' in platform,'change CODE action missing')
ok('CODE เข้าเรียนทั้งหมด' in platform,'central Admin CODE registry UI missing')
ok('window.DOCNR_BASE.navigate("courses",subjectId)' in platform,'successful CODE join does not enter subject room')
ok('doc-full-nr-v17-1-course-code-20260915' in sw,'V17.1 cache marker missing')
if errors:
    print('COURSE CODE CONTRACT FAILED')
    [print('-',x) for x in errors]
    raise SystemExit(1)
print('COURSE CODE CONTRACT PASS')
