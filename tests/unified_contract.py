from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
app=(SITE/'app.js').read_text('utf-8')
platform=(SITE/'v16-platform.js').read_text('utf-8')
course=(SITE/'v16-8-course-flow.js').read_text('utf-8')
index=(SITE/'index.html').read_text('utf-8')
sw=(SITE/'sw.js').read_text('utf-8')
errors=[]
def ok(c,m):
    if not c: errors.append(m)

# One production router owner.
ok('navigate:navigateUnified' in app,'app.js does not export unified router')
ok('data-app-route' in app,'app.js delegated route contract missing')
ok('data-route belongs exclusively to app.js' in platform,'platform still owns Sidebar data-route')
ok('DOCNR_BASE?.navigate?.(custom.dataset.v14Route)' in platform,'legacy feature buttons do not return to unified router')
ok('window.DOCNR_BASE?.navigate?.("courses",t.dataset.v14AdminCourse)' in platform,'admin course cards bypass unified router')
ok('window.DOCNR_BASE?.navigate?.("courses",t.dataset.v14OpenCourse)' in platform,'student course cards bypass unified router')
ok('window.DOCNR_BASE?.navigate?.("exam",subjectId||null)' in platform,'room exam bypasses unified router')

# Sidebar main routes required by master flow.
admin_routes=['dashboard','courses','students','workadmin','attendancehub','exam','academic','profile']
user_routes=['dashboard','catalog','courses','work','attendance','exam','profile']
for r in admin_routes:
    ok(f'["{r}",' in app or f',"{r}",' in app,f'admin main route missing: {r}')
for r in user_routes:
    ok(f'["{r}",' in app or f',"{r}",' in app,f'user main route missing: {r}')

# Feature route maps / hubs.
for fn in ['renderStudentsHub','renderWorkAdminHub','renderAttendanceHub','renderAcademicHub','renderAdminDashboard','renderStudentDashboard']:
    ok(f'function {fn}' in platform or f'async function {fn}' in platform,f'missing functional hub: {fn}')
for route in ['accounts','enrollments','profiles','attendance','presence','promotion','catalog','work','history']:
    ok(re.search(rf'\b{route}\s*:',platform) is not None,f'feature route not implemented: {route}')
for route in ['users','grading','overrides','reports','audit','system','profile']:
    ok(route in app,f'base route not implemented: {route}')

# Dashboard cards are direct routes, not decorative flow modal actions.
ok(platform.count('dashboardRouteCard("')>=12 and platform.count('hubCard("')>=8,'dashboard/hub cards are not direct router actions')
ok('dashboardRouteCard("courses"' in platform,'admin teaching card missing')
ok('dashboardRouteCard("catalog"' in platform,'student catalog card missing')
ok('data-v1610-flow="' not in re.search(r'async function renderAdminDashboard[\s\S]*?async function renderStudentDashboard',platform).group(0),'admin dashboard still uses decorative modal flow')

# Course join / sequential unlock / work contracts.
for marker in ['join_subject_with_code','admin_unlock_subject_unit','my_subject_learning_path','save_worksheet_draft','finalize_digital_submission','admin_prepare_paper_print_pack','admin_record_paper_scan','admin_subject_gradebook']:
    ok(marker in (platform+course+(SITE/'v16-7-hardening.js').read_text('utf-8')+app),f'critical learning marker missing: {marker}')
ok('PREVIOUS_UNIT_LOCKED' in course,'sequential unit server error mapping missing')
ok('decorateNav();' not in re.search(r'function scan\(\)[\s\S]*?\n\}',course).group(0),'course enhancer still mutates Sidebar')
ok('decorateCatalog();' not in re.search(r'function scan\(\)[\s\S]*?\n\}',course).group(0),'course enhancer still owns catalog UI')

# Profile / exam safety.
ok('profile-readonly' in app,'student profile read-only marker missing')
ok('บันทึกโปรไฟล์' not in app,'student profile edit UI returned')
exam=(SITE/'v16-exam.js').read_text('utf-8')
ok('V16-EXAM-50Q-75MIN-REALTIME' in exam,'exam engine marker missing')

# Production index must load one shell/feature router, no V16.9 overlay/rescue.
ok('v16-9-clean-dashboard.js' not in index,'V16.9 dashboard overlay loaded')
ok('v16-9-runtime-rescue.js' not in index,'V16.9 rescue loaded')
ok(index.count('app.js')==1,'app.js must load once')
ok(index.count('v16-platform.js')==1,'v16-platform.js must load once')
ok('v17-master-flow' in index.lower(),'V17 release marker missing')
ok('doc-full-nr-v17-master-flow' in sw,'V17 service worker cache missing')

# Health contract.
ok('admin_system_health_v17' in app,'System Health page not using V17 contract')
ok('admin_system_health_v17' in platform,'Dashboard not using V17 health contract')

if errors:
    print('MASTER FLOW CONTRACT FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('MASTER FLOW CONTRACT PASS')
print('admin main routes=',len(admin_routes),'user main routes=',len(user_routes),'single router owner=app.js')
