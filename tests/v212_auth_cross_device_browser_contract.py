from pathlib import Path
import os, shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V21.2 AUTH CROSS-DEVICE BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
css='\n'.join((SITE/x).read_text('utf-8') for x in ['styles.css','v18-core-ui.css','v16-minimal.css','v16-7-hardening.css','v16-8-course-flow.css','v21-core-ui.css'])
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V21.2 AUTH CROSS-DEVICE BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)

def login_html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="auth-wrap"><div class="auth-card"><div class="brand"><div><h2>DOC-FULL-NR</h2><div class="muted">Smart Worksheet</div></div></div><form id="login"><div class="field"><label>ชื่อผู้ใช้หรืออีเมล</label><input name="login" required></div><div class="field"><label>รหัสผ่าน</label><input name="password" type="password" minlength="8" required></div><button class="btn primary w100" id="loginbtn">เข้าสู่ระบบ</button></form><div class="row center wrap" style="margin-top:14px"><button id="show-signup" class="btn sm ghost">ลงทะเบียนผู้ใช้ใหม่</button><button id="forgot" class="btn sm ghost">ลืมรหัสผ่าน</button></div></div></div></body></html>'''

def register_html():
    fields=''.join(f'<div class="field"><label>Field {i}</label><input required></div>' for i in range(10))
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="modal-bg"><div class="modal wide"><div class="modal-header"><h2>ลงทะเบียนผู้ใช้ใหม่</h2><button class="btn sm">✕</button></div><form class="registration-form"><div class="registration-grid">{fields}</div><div class="row end"><button class="btn">ยกเลิก</button><button class="btn primary">ลงทะเบียน</button></div></form></div></div></body></html>'''

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in [(320,720),(360,800),(390,844),(844,390),(768,1024),(900,1200),(1366,768),(1920,1080)]:
        p=b.new_page(viewport={'width':w,'height':h})
        p.set_content(login_html(),wait_until='domcontentloaded')
        x=p.evaluate('''()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,card:document.querySelector('.auth-card').getBoundingClientRect(),login:getComputedStyle(document.querySelector('#loginbtn')).display,signup:getComputedStyle(document.querySelector('#show-signup')).display})''')
        assert x['overflow']<=2,(w,h,x); assert x['card']['width']<=w,(w,h,x); assert x['login']!='none' and x['signup']!='none',(w,h,x)
        p.set_content(register_html(),wait_until='domcontentloaded')
        y=p.evaluate('''()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,modal:document.querySelector('.modal').getBoundingClientRect(),cols:getComputedStyle(document.querySelector('.registration-grid')).gridTemplateColumns,scroll:getComputedStyle(document.querySelector('.modal')).overflowY})''')
        assert y['overflow']<=2,(w,h,y); assert y['modal']['width']<=w,(w,h,y)
        if w<=780: assert ' ' not in y['cols'].strip() or len(y['cols'].split())==1,(w,h,y)
        p.close()
    b.close()
print('V21.2 AUTH CROSS-DEVICE BROWSER CONTRACT PASS • login/register responsive on phone/tablet/desktop')
