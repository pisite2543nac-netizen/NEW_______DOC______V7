from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V21.0 MAJOR STABILITY BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];site=ROOT/'site'
css='\n'.join((site/x).read_text('utf-8') for x in ['styles.css','v18-core-ui.css','v16-minimal.css','v16-7-hardening.css','v16-8-course-flow.css','v21-core-ui.css'])
js=(site/'v21-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V21.0 MAJOR STABILITY BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
viewports=[(1920,1080),(1366,768),(1024,768),(768,1024),(390,844),(360,800),(320,720),(288,640),(844,390)]

def shell(role='admin'):
    routes=''.join(f'<button data-route="{r}"><span class="nav-card-icon">•</span><span class="nav-card-label">{r}</span></button>' for r in ['dashboard','courses','workadmin','attendancehub','exam','profile'])
    codes=''.join(f'<article class="v171-code-item"><strong>C{i:02}</strong><div class="v171-code-actions"><button class="btn">คัดลอก</button><button class="btn">เปิด</button></div></article>' for i in range(1,12))
    return f'''<!doctype html><html data-role="{role}" data-app-route="dashboard"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div id="app"><div class="app"><aside id="sidebar" class="sidebar"><div class="brand"><b>DOC-FULL-NR</b></div><nav class="nav nav-card-menu">{routes}</nav><div class="sidebar-footer"><div class="sidebar-user"><b>Test User</b><span>{role}</span></div><div class="sidebar-utilities"><button class="btn sm" id="sidebar-theme">ธีม</button><button class="btn sm" id="sidebar-fullscreen">เต็มจอ</button><button class="btn sm" id="sidebar-install">ติดตั้ง</button></div><button class="btn sm" id="sidebar-logout">ออก</button></div></aside><main class="main"><header id="topbar" class="topbar"><div class="row topbar-leading"><button id="menubtn" class="btn mobile-menu">☰</button><button class="btn sm global-back">←</button><b id="pagetitle">หน้าแรก</b></div><div class="row topbar-actions"><button class="btn sm" id="theme-toggle">ธีม</button><button class="btn sm" id="install">ติดตั้ง</button><button class="btn sm" id="fullscreen">เต็มจอ</button><span class="user-name">User</span></div></header><section id="content" class="content"><section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">WORKSPACE</span><h1>หน้าทำงาน</h1><p>ทดสอบการใช้งานจริง</p></div><button class="btn primary">งานหลัก</button></div><div class="v1610-flow-grid"><button class="v1610-flow-card"><span class="v1610-flow-icon">📚</span><div><h3>รายวิชา</h3><p>เปิดรายวิชาและงานที่ต้องทำ</p></div></button><button class="v1610-flow-card"><span class="v1610-flow-icon">📷</span><div><h3>เช็คชื่อ</h3><p>เปิดกล้องและจัดการการเข้าเรียน</p></div></button></div><section class="v171-code-registry"><div class="v171-code-registry-head"><h2>CODE เข้าเรียนทั้งหมด</h2></div><div class="v171-code-grid">{codes}</div></section><div class="table-wrap"><table style="width:1100px"><tr><td>Wide table internal scrolling</td></tr></table></div><div class="docnr-route-loading">กำลังโหลดข้อมูลล่าสุด</div></section></section></main></div></div><script>window.__nav=[];window.DOCNR_BASE={{navigate:(r,a)=>{{window.__nav.push([r,a||null]);document.documentElement.dataset.appRoute=r;return true;}}}};window.DOCNR_DEVICE_RUNTIME={{classify:()=>innerWidth<=620?'phone':innerWidth<=959?'tablet':'desktop'}};</script><script>{js}</script></body></html>'''

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for role in ['admin','teacher','user']:
      for w,h in viewports:
        p=b.new_page(viewport={'width':w,'height':h});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
        p.set_content(shell(role),wait_until='domcontentloaded');p.wait_for_timeout(100)
        x=p.evaluate('''()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,device:document.documentElement.dataset.device,nav:!!document.querySelector('#docnr-mobile-nav'),navCount:document.querySelectorAll('#docnr-mobile-nav button').length,drawer:getComputedStyle(document.querySelector('#sidebar')).transform,topActions:getComputedStyle(document.querySelector('.topbar-actions')).display,utilities:getComputedStyle(document.querySelector('.sidebar-utilities')).display,tableOverflow:getComputedStyle(document.querySelector('.table-wrap')).overflowX,loader:!!document.querySelector('.docnr-route-loading')})''')
        assert x['sw']<=x['cw']+2,(role,w,h,x)
        assert x['tableOverflow'] in ('auto','scroll'),(role,w,h,x)
        assert not errors,(role,w,h,errors)
        if w<=620:
          assert x['device']=='phone' and x['nav'] and x['navCount']==5,(role,w,h,x)
          assert x['topActions']=='none',(role,w,h,x)
          assert x['utilities']=='grid',(role,w,h,x)
          # Registry is collapsed to 3 items until explicitly expanded.
          visible=p.evaluate("()=>[...document.querySelectorAll('.v171-code-item')].filter(x=>getComputedStyle(x).display!=='none').length")
          assert visible==3,(role,w,h,visible)
          p.click('[data-v21-more]');p.wait_for_timeout(30)
          assert p.evaluate("()=>document.documentElement.classList.contains('docnr-drawer-open')")
          assert p.evaluate("()=>getComputedStyle(document.querySelector('#docnr-v21-backdrop')).pointerEvents")=='auto'
          p.click('#docnr-v21-backdrop');p.wait_for_timeout(30)
          assert not p.evaluate("()=>document.documentElement.classList.contains('docnr-drawer-open')")
          p.click('.docnr-registry-toggle');p.wait_for_timeout(20)
          visible=p.evaluate("()=>[...document.querySelectorAll('.v171-code-item')].filter(x=>getComputedStyle(x).display!=='none').length")
          assert visible==11,(role,w,h,visible)
          # A bottom-nav tap maps directly to base navigation and debounce blocks duplicate rapid taps.
          p.click('#docnr-mobile-nav [data-v21-route="courses"]');p.click('#docnr-mobile-nav [data-v21-route="courses"]');p.wait_for_timeout(20)
          assert p.evaluate('()=>window.__nav.filter(x=>x[0]==="courses").length')==1
        elif w<=959:
          assert x['device']=='tablet' and not x['nav'],(role,w,h,x)
          assert x['utilities']=='grid',(role,w,h,x)
          p.evaluate("window.DOCNR_V21.openDrawer()")
          assert p.evaluate("()=>document.documentElement.classList.contains('docnr-drawer-open')")
        else:
          assert x['device']=='desktop' and not x['nav'],(role,w,h,x)
          assert x['utilities']=='none',(role,w,h,x)
        # Route-ready clears non-blocking loader rather than blanking the page.
        p.evaluate("window.dispatchEvent(new CustomEvent('docnr:route-start'))")
        assert p.evaluate("()=>document.documentElement.dataset.navBusy==='1'")
        p.evaluate("window.dispatchEvent(new CustomEvent('docnr:route-ready'))")
        p.wait_for_timeout(20)
        assert not p.evaluate("()=>!!document.querySelector('.docnr-route-loading')")
        p.close()
    b.close()
print('V21.0 MAJOR STABILITY BROWSER CONTRACT PASS • 3 roles × 9 viewport/orientation cases')
