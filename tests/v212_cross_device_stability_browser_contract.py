from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V21.2 CROSS-DEVICE BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
css='\n'.join((SITE/x).read_text('utf-8') for x in ['styles.css','v18-core-ui.css','v16-minimal.css','v16-7-hardening.css','v16-8-course-flow.css','v21-core-ui.css'])
js=(SITE/'v21-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V21.2 CROSS-DEVICE BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
phone_expected={
 'admin':['attendance','paperscan','workcheck','courses','users'],
 'teacher':['attendance','workcheck','courses','profile'],
 'user':['attendance','work','courses','profile']
}
def shell(role):
    routes=['dashboard','courses','specialactivity','students','roomgroups','users','workadmin','workcheck','printcenter','paperscan','attendancehub','exam','academic','profile']
    nav=''.join(f'<button data-route="{r}">{r}</button>' for r in routes)
    return f'''<!doctype html><html data-role="{role}" data-app-route="dashboard"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="app"><aside id="sidebar" class="sidebar"><nav class="nav">{nav}</nav></aside><main class="main"><header id="topbar" class="topbar"><div class="row topbar-leading"><button id="menubtn" class="btn mobile-menu">☰</button><button id="global-back" class="btn sm global-back">← <span>ย้อนกลับ</span></button><button id="homebtn" class="btn sm home-shortcut">⌂</button><b id="pagetitle">หน้าแรก</b></div><div class="row topbar-actions"><button class="btn sm" id="theme-toggle"><span>◐</span><span class="utility-label"> ไนท์โหมด</span></button><button class="btn sm" id="logout"><span>↪</span><span class="utility-label"> ออกจากระบบ</span></button></div></header><section id="content" class="content"><div class="docnr-user-lite-grid"><article class="card">quick</article></div></section></main></div><script>window.__nav=[];window.__back=0;window.__notice=0;window.DOCNR_BASE={{navigate:(r,a)=>{{window.__nav.push([r,a||null]);document.documentElement.dataset.appRoute=r;return true;}},goBack:()=>{{window.__back++;return true;}}}};window.DOCNR_NOTIFICATIONS={{show:()=>{{window.__notice++;return true;}}}};window.DOCNR_DEVICE_RUNTIME={{classify:()=>innerWidth<=620?'phone':innerWidth<=959?'tablet':'desktop'}};</script><script>{js}</script></body></html>'''

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for role,expected in phone_expected.items():
        for w,h in [(320,720),(360,800),(390,844),(844,390),(768,1024),(900,1200),(1366,768),(1920,1080)]:
            p=b.new_page(viewport={'width':w,'height':h}); errs=[]
            p.on('pageerror',lambda e:errs.append(str(e)))
            p.set_content(shell(role),wait_until='domcontentloaded'); p.wait_for_timeout(90)
            x=p.evaluate('''()=>({device:document.documentElement.dataset.device,nav:[...document.querySelectorAll('#docnr-mobile-nav [data-v21-route]')].map(x=>x.dataset.v21Route),actions:[...document.querySelectorAll('#docnr-mobile-nav [data-v21-action]')].map(x=>x.dataset.v21Action),sidebar:getComputedStyle(document.querySelector('#sidebar')).display,menu:getComputedStyle(document.querySelector('#menubtn')).display,home:getComputedStyle(document.querySelector('#homebtn')).display,theme:getComputedStyle(document.querySelector('#theme-toggle')).display,logout:getComputedStyle(document.querySelector('#logout')).display,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})''')
            assert not errs,(role,w,h,errs); assert x['overflow']<=2,(role,w,h,x)
            if w<=620:
                assert x['device']=='phone' and x['nav']==expected,(role,w,h,x)
                assert x['actions']==['notifications'],(role,w,h,x)
                assert len(x['nav'])+len(x['actions'])<=6,(role,w,h,x)
                assert x['sidebar']=='none' and x['menu']=='none',(role,w,h,x)
                assert x['home']!='none' and x['theme']!='none' and x['logout']!='none',(role,w,h,x)
                p.click('#global-back'); p.wait_for_timeout(10); assert p.evaluate('()=>window.__back')==1
                p.click('#docnr-mobile-nav [data-v21-action="notifications"]'); p.wait_for_timeout(10); assert p.evaluate('()=>window.__notice')==1
            elif w<=959:
                assert x['device']=='tablet' and not x['nav'] and not x['actions'],(role,w,h,x)
                assert x['home']!='none' and x['menu']!='none',(role,w,h,x)
                p.evaluate('window.DOCNR_V21.openDrawer()')
                assert p.evaluate("()=>document.documentElement.classList.contains('docnr-drawer-open')")
            else:
                assert x['device']=='desktop' and not x['nav'] and x['sidebar']!='none',(role,w,h,x)
            p.close()
    b.close()
print('V21.2 CROSS-DEVICE BROWSER CONTRACT PASS • phone quick actions • tablet operational shell • desktop full shell')
