from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
app=(SITE/'app.js').read_text('utf-8'); runtime=(SITE/'v21-runtime.js').read_text('utf-8'); css=(SITE/'v21-core-ui.css').read_text('utf-8'); idx=(SITE/'index.html').read_text('utf-8'); meta=(SITE/'release-meta.js').read_text('utf-8'); ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert ver['release_marker']=='V21.3'
assert 'RELEASE_VERSION="V21.3"' in meta
assert 'data-docnr-release="v21-3-no-sidebar-stable"' in idx
render=app[app.index('function renderShell()'):app.index('async function waitFeatureRouter')]
assert '<aside class="sidebar"' not in render
assert 'id="menubtn"' not in render
assert 'top-function-nav' in render and 'top-function-btn' in render
for token in ['navigateUnified','goBackUnified','id="global-back"','id="homebtn"','id="logout"','sb.auth.signOut','sb.auth.getSession','sb.auth.onAuthStateChange']:
    assert token in app,token
assert "const RELEASE='V21.3'" in runtime
assert '#sidebar [data-route]' not in runtime
assert '.sidebar,#sidebar,#docnr-v21-backdrop,.mobile-menu,#menubtn{display:none!important}' in css
assert '.top-function-nav{' in css and '.top-function-btn{' in css
for token in ["admin:['attendance','paperscan','workcheck','courses','users','notifications']","teacher:['attendance','workcheck','courses','profile','notifications']","user:['attendance','work','courses','profile','notifications']"]:
    assert token in runtime,token
print('V21.3 NO-SIDEBAR STABILITY STATIC CONTRACT PASS')
