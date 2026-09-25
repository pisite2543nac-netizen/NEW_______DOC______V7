from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V21.3 NO-SIDEBAR BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
css='\n'.join((SITE/x).read_text('utf-8') for x in ['styles.css','v18-core-ui.css','v16-minimal.css','v16-7-hardening.css','v16-8-course-flow.css','v21-core-ui.css'])
js=(SITE/'v21-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V21.3 NO-SIDEBAR BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
phone={'admin':['attendance','paperscan','workcheck','courses','users'],'teacher':['attendance','workcheck','courses','profile'],'user':['attendance','work','courses','profile']}
def page_html(role):
    routes=['dashboard','courses','workadmin','workcheck','attendancehub','exam','printcenter','profile']
    top=''.join(f'<button class="top-function-btn" data-route="{r}">{r}</button>' for r in routes)
    return f"""<!doctype html><html data-role="{role}" data-app-route="dashboard"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="app no-sidebar-shell"><main class="main"><header id="topbar" class="topbar"><div class="topbar-leading"><button id="global-back" class="btn">ย้อนกลับ</button><button id="homebtn" class="btn">หน้าแรก</button><b id="pagetitle">หน้าแรก</b></div><div class="topbar-actions"><button id="theme-toggle" class="btn">ธีม</button><button id="logout" class="btn">ออก</button></div></header><nav id="top-function-nav" class="top-function-nav">{top}</nav><section id="content" class="content"><button id="real-action" class="btn">ทำงาน</button></section></main></div><script>window.__nav=[];window.__back=0;window.DOCNR_BASE={{navigate:(r,a)=>{{window.__nav.push(r);document.documentElement.dataset.appRoute=r;return true;}},goBack:()=>{{window.__back++;return true;}}}};window.DOCNR_DEVICE_RUNTIME={{classify:()=>innerWidth<=620?'phone':innerWidth<=959?'tablet':'desktop'}};document.addEventListener('click',e=>{{const b=e.target.closest('[data-route]');if(b)window.DOCNR_BASE.navigate(b.dataset.route)}});</script><script>{js}</script></body></html>"""
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for role,expected in phone.items():
        for w,h in [(360,800),(390,844),(768,1024),(1366,768),(1920,1080)]:
            p=b.new_page(viewport={'width':w,'height':h}); errs=[]; p.on('pageerror',lambda e:errs.append(str(e))); p.set_content(page_html(role),wait_until='domcontentloaded'); p.wait_for_timeout(80)
            x=p.evaluate('''()=>({device:document.documentElement.dataset.device,sidebar:!!document.querySelector('#sidebar'),menu:!!document.querySelector('#menubtn'),top:getComputedStyle(document.querySelector('#top-function-nav')).display,mobile:[...document.querySelectorAll('#docnr-mobile-nav [data-v21-route]')].map(x=>x.dataset.v21Route),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})''')
            assert not errs,(role,w,h,errs); assert not x['sidebar'] and not x['menu']; assert x['overflow']<=2,(role,w,h,x)
            p.click('#global-back'); p.wait_for_timeout(10); assert p.evaluate('()=>window.__back')==1
            if w<=620:
                assert x['device']=='phone' and x['top']=='none' and x['mobile']==expected,(role,w,h,x)
                p.click('#docnr-mobile-nav [data-v21-route="courses"]'); p.wait_for_timeout(10); assert p.evaluate('()=>window.__nav.at(-1)')=='courses'
            else:
                assert x['top']!='none' and not x['mobile'],(role,w,h,x)
                p.click('#top-function-nav [data-route="courses"]'); p.wait_for_timeout(10); assert p.evaluate('()=>window.__nav.at(-1)')=='courses'
            p.close()
    b.close()
print('V21.3 NO-SIDEBAR BROWSER CONTRACT PASS')
