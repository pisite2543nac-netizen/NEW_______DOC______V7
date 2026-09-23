from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.4 REAL-DEVICE MOBILE ROUTER BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.4 REAL-DEVICE MOBILE ROUTER BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
site=ROOT/'site'
ux=(site/'v19-ux-runtime.js').read_text('utf-8')
cam=(site/'device-camera-runtime.js').read_text('utf-8')
css='\n'.join((site/x).read_text('utf-8') for x in ['styles.css','mobile.css','v19-production-ui.css','v20-unified-ui.css'])
ua='Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    c=b.new_context(viewport={'width':390,'height':844},user_agent=ua,has_touch=True,is_mobile=True)
    p=c.new_page()
    p.set_content(f'''<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style>
    <div id="app" class="app"><aside id="sidebar" class="sidebar"><div class="nav">
    <button data-route="dashboard">หน้าแรก</button><button data-route="attendancehub">เช็คชื่อและห้องเรียน</button><button data-route="paperscan">เก็บงาน</button><button data-route="students">นักศึกษา</button></div></aside>
    <main class="main"><div class="topbar"><button id="menubtn">☰</button></div><div id="content" class="content"><button id="real-action">ACTION</button></div></main></div>''')
    p.evaluate("Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})")
    p.add_script_tag(content=cam)
    p.evaluate("""()=>{window.__routes=[];window.DOCNR_BASE={navigate:r=>{window.__routes.push(r);document.documentElement.dataset.appRoute=r;window.dispatchEvent(new CustomEvent('docnr:route-state',{detail:{route:r}}));}}}""")
    p.add_script_tag(content=ux);p.wait_for_timeout(120)
    assert p.evaluate("DOCNR_DEVICE_RUNTIME.classify()")=='phone'
    routes=p.evaluate("[...document.querySelectorAll('.docnr-mobile-bottom-nav [data-mobile-route]')].map(x=>x.dataset.mobileRoute)")
    assert routes==['dashboard','attendance','paperscan','students'],routes
    # Reproduces user recording path: tapping phone Attendance must request attendance exactly once, never dashboard.
    p.click('.docnr-mobile-bottom-nav [data-mobile-route="attendance"]');p.wait_for_timeout(120)
    got=p.evaluate('window.__routes')
    assert got==['attendance'],got
    # Immediate duplicate tap is debounced instead of causing route loop.
    p.click('.docnr-mobile-bottom-nav [data-mobile-route="attendance"]');p.wait_for_timeout(80)
    assert p.evaluate('window.__routes')==['attendance']
    # Paper capture is direct as well.
    p.click('.docnr-mobile-bottom-nav [data-mobile-route="paperscan"]');p.wait_for_timeout(80)
    assert p.evaluate('window.__routes')==['attendance','paperscan']
    # Closed backdrop cannot steal touches.
    overlay=p.evaluate("()=>{const e=document.querySelector('.docnr-sidebar-backdrop');const s=getComputedStyle(e);return {pe:s.pointerEvents,vis:s.visibility}}")
    assert overlay['pe']=='none',overlay
    # Route lifecycle must stop active camera stream.
    res=p.evaluate('''async()=>{const source=document.createElement('canvas');source.width=320;source.height=240;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>source.captureStream(5)}});const v=document.createElement('video');Object.defineProperty(v,'videoWidth',{configurable:true,get:()=>320});Object.defineProperty(v,'videoHeight',{configurable:true,get:()=>240});v.play=async()=>{};document.body.appendChild(v);const x=await DOCNR_CAMERA.startVideo('route-test',v);const before=x.stream.getVideoTracks().some(t=>t.readyState==='live');window.dispatchEvent(new CustomEvent('docnr:route-start'));await new Promise(r=>setTimeout(r,30));return {before,after:x.stream.getVideoTracks().some(t=>t.readyState==='live')}}''')
    assert res['before'] and not res['after'],res
    dims=p.evaluate("()=>({sw:document.body.scrollWidth,cw:document.documentElement.clientWidth})")
    assert dims['sw']<=dims['cw']+2,dims
    c.close();b.close()
print('V20.4 REAL-DEVICE MOBILE ROUTER/ADAPTIVE CAMERA BROWSER CONTRACT PASS')
