from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.2 MOBILE CAMERA BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.2 MOBILE CAMERA BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
runtime=(ROOT/'site/device-camera-runtime.js').read_text('utf-8')
css='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['styles.css','mobile.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css','v20-unified-ui.css'])

def kind(pw,ua,w,h,touch=True,mobile=False):
    ctx=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']).new_context(
        viewport={'width':w,'height':h}, user_agent=ua, has_touch=touch, is_mobile=mobile)
    page=ctx.new_page();page.set_content('<html><body></body></html>');page.add_script_tag(content=runtime)
    val=page.evaluate('DOCNR_DEVICE_RUNTIME.classify()');ctx.browser.close();return val

with sync_playwright() as pw:
    assert kind(pw,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',390,844,True,True)=='phone'
    assert kind(pw,'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 Chrome/130 Safari/537.36',800,1280,True,False)=='tablet'
    assert kind(pw,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36',1366,768,False,False)=='desktop'

    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
    ctx=browser.new_context(viewport={'width':390,'height':844}, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', has_touch=True, is_mobile=True)
    page=ctx.new_page()
    page.set_content(f'''<meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style><div class="v14-page"><div class="v14-camera-grid"><div><video id="v" autoplay muted playsinline></video><canvas id="c"></canvas><div class="v161-att-actions"><button id="v14-start-scan" class="btn primary">เปิดกล้อง</button><label class="btn v202-file-camera">ถ่าย QR</label></div><div id="v202-att-camera-status" class="v202-camera-status"></div></div></div></div>''')
    page.evaluate("Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})")
    page.evaluate('''()=>{const source=document.createElement('canvas');source.width=640;source.height=480;const ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,640,480);const stream=source.captureStream(10);Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>stream}});window.__testStream=stream;}''')
    page.add_script_tag(content=runtime)
    assert page.evaluate("DOCNR_DEVICE_RUNTIME.classify()")=='phone'
    result=page.evaluate('''async()=>{const v=document.querySelector('#v');const x=await DOCNR_CAMERA.startVideo('test',v);const before=x.stream.getTracks().some(t=>t.readyState==='live');DOCNR_CAMERA.stopScanner('test');await new Promise(r=>setTimeout(r,50));const after=x.stream.getTracks().every(t=>t.readyState==='ended');return {before,after,src:v.srcObject};}''')
    assert result['before'] is True and result['after'] is True and result['src'] is None,result
    dims=page.evaluate("()=>({sw:document.body.scrollWidth,cw:document.documentElement.clientWidth,grid:getComputedStyle(document.querySelector('.v14-camera-grid')).gridTemplateColumns,btn:document.querySelector('#v14-start-scan').getBoundingClientRect().height})")
    assert dims['sw']<=dims['cw']+2,dims
    assert dims['btn']>=48,dims
    ctx.close();browser.close()
print('V20.2 ADAPTIVE MOBILE/CAMERA BROWSER CONTRACT PASS')
