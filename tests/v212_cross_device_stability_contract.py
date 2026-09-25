from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
app=(SITE/'app.js').read_text('utf-8')
runtime=(SITE/'v21-runtime.js').read_text('utf-8')
css=(SITE/'v21-core-ui.css').read_text('utf-8')
platform=(SITE/'v16-platform.js').read_text('utf-8')
index=(SITE/'index.html').read_text('utf-8')
meta=(SITE/'release-meta.js').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert ver['release_marker']=='V21.2'
assert 'RELEASE_VERSION="V21.2"' in meta
assert 'data-docnr-release="v21-2-cross-device-stable"' in index
# Authentication is a cross-device core capability.
for token in ['id="login"','show-signup','ลงทะเบียนผู้ใช้ใหม่','sb.auth.signInWithPassword','sb.auth.signOut','sb.auth.getSession','sb.auth.onAuthStateChange']:
    assert token in app,token
for token in ['id="homebtn"','id="global-back"','id="theme-toggle"','id="logout"']:
    assert token in app,token
# Device-specific navigation/policy contracts.
assert 'TABLET_OPERATIONAL_NAV' in app and 'MOBILE_ESSENTIAL_NAV' in app
assert "if(kind==='tablet')return TABLET_OPERATIONAL_NAV[role]" in app
assert 'PHONE_ALLOWED' in app and 'TABLET_ALLOWED' in app and 'normalizeDeviceRoute' in app
for token in ['["users","ผู้ใช้ด่วน"]','function usersLite','ADMIN LITE','เปิด/ระงับการใช้งาน']:
    assert token in app,token
# Mobile quick actions never exceed six, and notifications use the real notification center.
assert "admin:['attendance','paperscan','workcheck','courses','users','notifications']" in runtime
assert "teacher:['attendance','workcheck','courses','profile','notifications']" in runtime
assert "user:['attendance','work','courses','profile','notifications']" in runtime
assert 'data-v21-action="notifications"' in runtime
assert 'window.DOCNR_NOTIFICATIONS=Object.freeze' in platform
assert 'show:showNotificationPanel' in platform
# Tablet exposes no more than ten top-level operational hubs per role.
block=re.search(r'const TABLET_OPERATIONAL_NAV=\{([\s\S]*?)\n\};',app).group(1)
for role in ['admin','teacher','user']:
    m=re.search(role+r':\[(.*?)\](?:,|$)',block,re.S); assert m,role
    assert m.group(1).count('["')<=10,(role,m.group(1).count('["'))
# Desktop full features remain in source.
for token in ['specialactivity','students','roomgroups','academic','audit','system','promotion','exam','printcenter']:
    assert token in app,token
# Offline work capture/sync remains available.
for token in ['putOfflineDraft','queueOfflineFinal','flushOfflineSubmissionOutbox','window.addEventListener("online"']:
    assert token in app,token
# Responsive shell controls and compact user-lite UI.
for token in ['repeat(6,minmax(0,1fr))','html.docnr-phone .topbar-actions #theme-toggle','html.docnr-phone .topbar-actions #logout','html.docnr-phone .home-shortcut','.docnr-user-lite-grid']:
    assert token in css,token
print('V21.2 CROSS-DEVICE STABILITY STATIC CONTRACT PASS')
