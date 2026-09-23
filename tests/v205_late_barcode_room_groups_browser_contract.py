from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.5 LATE BARCODE/ROOM GROUPS BROWSER CONTRACT SKIP');raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.5 LATE BARCODE/ROOM GROUPS BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
site=ROOT/'site'; css='\n'.join((site/x).read_text('utf-8') for x in ['styles.css','mobile.css','v19-production-ui.css','v20-unified-ui.css']);cam=(site/'device-camera-runtime.js').read_text('utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    p=c.new_page();p.set_content(f'''<meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style><main class="v14-page"><div class="card v205-late-student-card"><button id="late">เปิดกล้อง</button><video id="v" autoplay playsinline muted></video><canvas id="cv" hidden></canvas><div class="v202-camera-status">พร้อม</div></div><div class="v205-roster-list"><div class="v205-roster-row in"><div><b>0001 • นักศึกษา</b><small>ปวช.1/1</small></div><label>เลขที่<input class="input" value="1"></label><button class="btn red">นำออก</button></div></div></main>''')
    p.evaluate("Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})");p.add_script_tag(content=cam)
    out=p.evaluate('''async()=>{const source=document.createElement('canvas');source.width=320;source.height=240;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>source.captureStream(5)}});const v=document.querySelector('#v');Object.defineProperty(v,'videoWidth',{configurable:true,get:()=>320});Object.defineProperty(v,'videoHeight',{configurable:true,get:()=>240});v.play=async()=>{};const x=await DOCNR_CAMERA.startScanner({key:'late-attendance',video:v,canvas:document.querySelector('#cv'),formats:['qr_code','code_128'],fps:4,onCode:()=>{}});const before=x.stream.getVideoTracks().some(t=>t.readyState==='live');DOCNR_CAMERA.stopScanner('late-attendance','test');await new Promise(r=>setTimeout(r,30));return {before,after:x.stream.getVideoTracks().some(t=>t.readyState==='live')}}''')
    assert out['before'] and not out['after'],out
    dims=p.evaluate("()=>({sw:document.body.scrollWidth,cw:document.documentElement.clientWidth,btn:document.querySelector('.v205-roster-row button').getBoundingClientRect().height})")
    assert dims['sw']<=dims['cw']+2,dims
    assert dims['btn']>=40,dims
    c.close();b.close()
print('V20.5 LATE BARCODE/ROOM GROUPS BROWSER CONTRACT PASS')
