from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V20.7 LONG-TERM UX BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; site=ROOT/'site'
css='\n'.join((site/x).read_text('utf-8') for x in ['styles.css','mobile.css','v19-responsive-fit.css','v19-production-ui.css','v20-unified-ui.css','v20-stability.css','v20-longterm-ui.css'])
js=(site/'v20-stability-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V20.7 LONG-TERM UX BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
viewports=[(1920,1080),(1366,768),(1024,768),(768,1024),(390,844),(844,390)]
html='''<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="app"><div class="app"><aside id="sidebar" class="sidebar"></aside><main class="main"><header class="topbar"><div id="pagetitle">หน้าทดสอบการใช้งานจริง</div><button id="menubtn" class="btn">เมนู</button></header><section id="content" class="content"><div class="docnr-page-hero"><div><span class="v14-kicker">WORKSPACE</span><h1>หน้าทำงาน</h1><p>ข้อมูลสำคัญอ่านง่ายและยังอยู่ระหว่างโหลด</p></div><div class="docnr-page-actions"><button class="btn primary">ทำงานหลัก</button><button class="btn">ตัวเลือก</button></div></div><div class="docnr-kpi-grid"><div class="docnr-kpi"><span>รายการ</span><b>17</b></div><div class="docnr-kpi"><span>เสร็จ</span><b>12</b></div><div class="docnr-kpi"><span>ค้าง</span><b>5</b></div><div class="docnr-kpi"><span>สถานะ</span><b>ดี</b></div></div><div class="v165-course-gallery"><article class="v165-course-tile"><div class="v165-course-cover"><b>รายวิชาทดสอบ</b></div><div class="v165-course-body"><div class="v165-course-actions"><button class="btn primary">เปิดรายวิชา</button></div></div></article></div><div class="table-wrap"><table style="width:980px"><tr><td>ข้อมูลตารางกว้างต้อง scroll ภายใน</td></tr></table></div><div class="docnr-route-loading">กำลังโหลดข้อมูลล่าสุด</div></section></main></div></div><nav class="docnr-mobile-bottom-nav"><button class="active"><i>⌂</i><span>หน้าแรก</span></button><button><i>✓</i><span>เช็คชื่อ</span></button><button><i>▦</i><span>รายวิชา</span></button><button><i>☑</i><span>งาน</span></button></nav><button class="docnr-sidebar-backdrop"></button>'''
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in viewports:
        p=b.new_page(viewport={'width':w,'height':h}); errs=[]; p.on('pageerror',lambda e:errs.append(str(e)))
        p.set_content(f'<style>{css}</style>{html}')
        p.add_script_tag(content="window.DOCNR_DEVICE_RUNTIME={classify:()=>innerWidth<=620?'phone':innerWidth<=960?'tablet':'desktop'};"+js)
        p.wait_for_timeout(120)
        x=p.evaluate("""()=>{const nav=document.querySelector('.docnr-mobile-bottom-nav button');const table=document.querySelector('.table-wrap');const c=document.querySelector('#content');return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,btn:document.querySelector('.btn').getBoundingClientRect().height,navh:nav.getBoundingClientRect().height,navfs:parseFloat(getComputedStyle(nav.querySelector('span')).fontSize),tableOverflow:getComputedStyle(table).overflowX,loader:!!document.querySelector('.docnr-route-loading'),content:!!c.querySelector('.docnr-page-hero')}}""")
        assert x['sw']<=x['cw']+2,(w,h,x); assert x['btn']>=40,(w,h,x); assert x['content']; assert not errs,(w,h,errs)
        if w<=620: assert x['navh']>=50,(w,h,x); assert x['navfs']>=10,(w,h,x)
        p.evaluate("window.dispatchEvent(new CustomEvent('docnr:route-ready'))"); p.wait_for_timeout(80)
        assert not p.evaluate("()=>!!document.querySelector('.docnr-route-loading')"),(w,h)
        p.close()
    b.close()
print('V20.7 LONG-TERM UX BROWSER CONTRACT PASS • 6 viewports/orientations')
