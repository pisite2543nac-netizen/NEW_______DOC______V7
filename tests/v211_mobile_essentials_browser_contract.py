from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V21.1 MOBILE ESSENTIALS BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
css='\n'.join((SITE/x).read_text('utf-8') for x in ['styles.css','v18-core-ui.css','v16-minimal.css','v16-7-hardening.css','v16-8-course-flow.css','v21-core-ui.css'])
js=(SITE/'v21-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V21.1 MOBILE ESSENTIALS BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
roles={
 'admin':['attendance','paperscan','workcheck','courses','users'],
 'teacher':['attendance','workcheck','courses','profile'],
 'user':['attendance','work','courses','profile']
}
def shell(role):
    desktop_routes=['dashboard','courses','specialactivity','students','roomgroups','workadmin','workcheck','printcenter','paperscan','attendancehub','exam','academic','profile']
    routes=''.join(f'<button data-route="{r}">{r}</button>' for r in desktop_routes)
    return f'''<!doctype html><html data-role="{role}" data-app-route="dashboard"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="app"><aside id="sidebar" class="sidebar"><nav class="nav">{routes}</nav></aside><main class="main"><header id="topbar" class="topbar"><div class="row topbar-leading"><button id="menubtn" class="btn mobile-menu">☰</button><button id="global-back" class="btn sm global-back">← <span>ย้อนกลับ</span></button><b id="pagetitle">หน้าแรก</b></div><div class="row topbar-actions"><button class="btn sm" id="theme-toggle">ธีม</button></div></header><section id="content" class="content"><div class="docnr-mobile-essential-grid"><button class="v1610-flow-card">งานหลัก</button></div></section></main></div><script>window.__nav=[];window.__back=0;window.DOCNR_BASE={{navigate:(r,a)=>{{window.__nav.push([r,a||null]);document.documentElement.dataset.appRoute=r;return true;}},goBack:()=>{{window.__back++;return true;}}}};window.DOCNR_DEVICE_RUNTIME={{classify:()=>innerWidth<=620?'phone':innerWidth<=959?'tablet':'desktop'}};</script><script>{js}</script></body></html>'''
with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for role,expected in roles.items():
    for w,h in [(390,844),(360,800),(320,720),(844,390),(768,1024),(1366,768)]:
      p=b.new_page(viewport={'width':w,'height':h}); errs=[]; p.on('pageerror',lambda e:errs.append(str(e)))
      p.set_content(shell(role),wait_until='domcontentloaded');p.wait_for_timeout(80)
      x=p.evaluate('''()=>({device:document.documentElement.dataset.device,nav:[...document.querySelectorAll('#docnr-mobile-nav [data-v21-route]')].map(x=>x.dataset.v21Route),more:!!document.querySelector('[data-v21-more]'),sidebar:getComputedStyle(document.querySelector('#sidebar')).display,menu:getComputedStyle(document.querySelector('#menubtn')).display,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})''')
      assert not errs,(role,w,h,errs)
      assert x['overflow']<=2,(role,w,h,x)
      if w<=620:
        assert x['device']=='phone' and all(r in x['nav'] for r in expected),(role,w,h,x)
        assert len(x['nav'])<=6,(role,w,h,x)
        assert not x['more'],(role,w,h,x)
        assert x['sidebar']=='none' and x['menu']=='none',(role,w,h,x)
        p.click('#global-back');p.wait_for_timeout(20);assert p.evaluate('()=>window.__back')==1
        p.click('#docnr-mobile-nav [data-v21-route="courses"]');p.wait_for_timeout(20);assert p.evaluate('()=>window.__nav.at(-1)?.[0]')=='courses'
      elif w<=959:
        assert x['device']=='tablet' and not x['nav'],(role,w,h,x)
        assert x['menu']!='none',(role,w,h,x)
        p.evaluate("window.DOCNR_V21.openDrawer()")
        assert p.evaluate("()=>document.documentElement.classList.contains('docnr-drawer-open')")
      else:
        assert x['device']=='desktop' and not x['nav'],(role,w,h,x)
        assert x['sidebar']!='none',(role,w,h,x)
      p.close()
  b.close()
print('V21.1 MOBILE ESSENTIALS BROWSER CONTRACT PASS • 3 roles • phone/tablet/desktop • reliable back')
