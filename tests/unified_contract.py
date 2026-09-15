from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
app=(SITE/'app.js').read_text('utf-8')
platform=(SITE/'v16-platform.js').read_text('utf-8')
index=(SITE/'index.html').read_text('utf-8')
errors=[]
def ok(c,m):
    if not c: errors.append(m)

# Every flow action encoded in the dashboard must resolve to a known router.
actions=set(re.findall(r'"(custom|base):([a-z0-9_-]+)"',platform))
custom_allowed={'dashboard','accounts','courses','enrollments','profiles','attendance','presence','promotion','exam','enroll','work','history'}
base_allowed={'dashboard','users','grading','overrides','reports','audit','system','profile'}
for kind,route in actions:
    ok(route in (custom_allowed if kind=='custom' else base_allowed),f'unknown dashboard action {kind}:{route}')

# Custom route maps must include every custom action except exam (special-cased).
for route in sorted({r for k,r in actions if k=='custom'}-{'exam'}):
    ok(re.search(rf'\b{re.escape(route)}\s*:',platform) or f'route==="{route}"' in platform,f'custom route not wired: {route}')
# Base route bridge must allow every base dashboard action.
for route in sorted({r for k,r in actions if k=='base'}):
    ok(f'"{route}"' in app,f'base route not wired in app: {route}')

# Only one production dashboard/router layer: V16.9 overlay/rescue are not loaded.
ok('v16-9-clean-dashboard.js' not in index,'clean-dashboard overlay still loaded')
ok('v16-9-runtime-rescue.js' not in index,'runtime-rescue overlay still loaded')
ok(index.count('v16-platform.js')==1,'v16-platform must load exactly once')
ok(index.count('app.js')==1,'app shell must load exactly once')

# Base-route actions must use bridge, never hidden DOM click.
block=re.search(r'if\(t\.matches\("\[data-v16-base-route\]"\)\)[\s\S]{0,450}',platform)
ok(bool(block),'base route delegated handler missing')
if block:
    ok('DOCNR_BASE?.navigate' in block.group(0),'base route handler does not use direct bridge')
    ok('.click()' not in block.group(0),'base route handler still clicks a hidden menu')
    ok('state.route=`base:${r}`' in block.group(0),'base route handler does not isolate feature-router state')
    ok('clearRoomChannel()' in block.group(0),'base route handler does not clear room realtime before handoff')

if errors:
    print('UNIFIED CONTRACT FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('UNIFIED CONTRACT PASS')
print('dashboard actions=',len(actions),'custom=',len([1 for k,_ in actions if k=='custom']),'base=',len([1 for k,_ in actions if k=='base']))
