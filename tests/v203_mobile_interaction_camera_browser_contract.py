from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.3 MOBILE INTERACTION/CAMERA BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.3 MOBILE INTERACTION/CAMERA BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
site=ROOT/'site'
cam=(site/'device-camera-runtime.js').read_text('utf-8')
ux=(site/'v19-ux-runtime.js').read_text('utf-8')
mobile=(site/'mobile.js').read_text('utf-8')
css='\n'.join((site/x).read_text('utf-8') for x in ['styles.css','mobile.css','v19-production-ui.css','v20-unified-ui.css'])
ua_phone='Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
    ctx=browser.new_context(viewport={'width':390,'height':844},user_agent=ua_phone,has_touch=True,is_mobile=True)
    page=ctx.new_page()
    page.set_content(f'''<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style>
    <div id="app" class="app"><aside id="sidebar" class="sidebar"><div class="nav">
      <button data-route="dashboard">หน้าแรก</button><button data-route="attendancehub">เช็คชื่อและห้องเรียน</button><button data-route="paperscan">สแกนงานย้อนหลัง</button><button data-route="students">นักศึกษาและสิทธิ์</button><button data-route="courses">รายวิชา</button>
    </div></aside><main class="main"><div class="topbar"><div class="row"><button id="menubtn" class="btn mobile-menu">☰</button></div><div class="row"></div></div><div id="content" class="content"><button id="real-action" class="btn">ACTION</button></div></main></div>''')
    page.evaluate("Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})")
    page.add_script_tag(content=cam)
    page.evaluate("document.querySelector('#menubtn').onclick=()=>document.querySelector('#sidebar').classList.toggle('open'); window.__clicks=0; document.querySelector('#real-action').onclick=()=>window.__clicks++; window.__routeClicks=0; document.querySelector('[data-route=attendancehub]').onclick=()=>window.__routeClicks++; void 0")
    page.add_script_tag(content=ux)
    page.add_script_tag(content=mobile)
    page.wait_for_timeout(120)
    assert page.evaluate("DOCNR_DEVICE_RUNTIME.classify()")=='phone'
    # Closed backdrop must not block ordinary actions.
    page.click('#real-action')
    assert page.evaluate('window.__clicks')==1
    closed=page.evaluate("()=>{const b=document.querySelector('.docnr-sidebar-backdrop');const s=getComputedStyle(b);return {pe:s.pointerEvents,vis:s.visibility,legacy:!!document.querySelector('#mobile-nav-backdrop')}}")
    assert closed['pe']=='none' and closed['legacy'] is False,closed
    # Drawer opens with backdrop below the drawer, so route buttons remain tappable.
    page.click('#menubtn');page.wait_for_timeout(80)
    layers=page.evaluate("()=>({sidebar:+getComputedStyle(document.querySelector('#sidebar')).zIndex,backdrop:+getComputedStyle(document.querySelector('.docnr-sidebar-backdrop')).zIndex,open:document.querySelector('#sidebar').classList.contains('open')})")
    assert layers['open'] and layers['sidebar']>layers['backdrop'],layers
    page.click('[data-route=attendancehub]');page.wait_for_timeout(80)
    assert page.evaluate('window.__routeClicks')==1
    assert page.evaluate("!document.querySelector('#sidebar').classList.contains('open') && getComputedStyle(document.querySelector('.docnr-sidebar-backdrop')).pointerEvents==='none'")
    page.click('#real-action');assert page.evaluate('window.__clicks')==2
    # Camera runtime: double start on the same key must request hardware only once.
    camera=page.evaluate('''async()=>{
      const source=document.createElement('canvas');source.width=640;source.height=480;source.getContext('2d').fillRect(0,0,640,480);
      let calls=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{calls++;await new Promise(r=>setTimeout(r,80));return source.captureStream(10)}}});
      const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;Object.defineProperty(v,'videoWidth',{configurable:true,get:()=>640});Object.defineProperty(v,'videoHeight',{configurable:true,get:()=>480});v.play=async()=>{};document.body.appendChild(v);
      const [a,b]=await Promise.all([DOCNR_CAMERA.startVideo('race',v),DOCNR_CAMERA.startVideo('race',v)]);
      const same=a.stream===b.stream,live=a.stream.getVideoTracks().some(t=>t.readyState==='live');
      let stopEvent=null;addEventListener('docnr:camera-stopped',e=>{if(e.detail?.key==='race')stopEvent=e.detail},{once:true});
      DOCNR_CAMERA.stopScanner('race','test-stop');await new Promise(r=>setTimeout(r,40));
      return {calls,same,live,ended:a.stream.getVideoTracks().every(t=>t.readyState==='ended'),reason:stopEvent?.reason||null};
    }''')
    assert camera['calls']==1 and camera['same'] and camera['live'] and camera['ended'] and camera['reason']=='test-stop',camera
    # Permission-sheet visibility transitions must not tear down a pending camera open (prevents open/close loops on phones).
    permission=page.evaluate('''async()=>{
      const source=document.createElement('canvas');source.width=320;source.height=240;
      let release;const delayed=new Promise(r=>release=r);let calls=0;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{calls++;await delayed;return source.captureStream(5)}}});
      const v=document.createElement('video');Object.defineProperty(v,'videoWidth',{configurable:true,get:()=>320});Object.defineProperty(v,'videoHeight',{configurable:true,get:()=>240});v.play=async()=>{};document.body.appendChild(v);
      let vis='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>vis});
      const p=DOCNR_CAMERA.startVideo('permission',v);
      vis='hidden';document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,1550));
      release();const started=await p;vis='visible';document.dispatchEvent(new Event('visibilitychange'));
      const live=started.stream.getVideoTracks().some(t=>t.readyState==='live');DOCNR_CAMERA.stopScanner('permission','test-stop');
      return {calls,live};
    }''')
    assert permission['calls']==1 and permission['live'],permission
    dims=page.evaluate("()=>({sw:document.body.scrollWidth,cw:document.documentElement.clientWidth,bottom:!!document.querySelector('.docnr-mobile-bottom-nav'),routes:[...document.querySelectorAll('.docnr-mobile-bottom-nav [data-mobile-route]')].map(x=>x.dataset.mobileRoute)})")
    assert dims['sw']<=dims['cw']+2,dims
    assert dims['bottom'] and 'attendancehub' in dims['routes'] and 'paperscan' in dims['routes'],dims
    ctx.close();browser.close()
print('V20.3 MOBILE INTERACTION/CAMERA BROWSER CONTRACT PASS')
