from pathlib import Path
import os,shutil
if os.getenv('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V20.6 ADAPTIVE STABILITY BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; site=ROOT/'site'; css=(site/'v20-stability.css').read_text('utf-8'); js=(site/'v20-stability-runtime.js').read_text('utf-8')
chromium=shutil.which('chromium') or shutil.which('google-chrome')
if not chromium: print('V20.6 ADAPTIVE STABILITY BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
viewports=[(1920,1080),(1366,768),(1024,768),(768,1024),(390,844),(844,390)]
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in viewports:
        p=b.new_page(viewport={'width':w,'height':h}); errs=[]; p.on('pageerror',lambda e:errs.append(str(e)))
        p.set_content(f'''<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style><div id="app"><div class="app"><aside id="sidebar" class="sidebar"></aside><main class="main"><header class="topbar"><button id="menubtn"></button></header><section id="content" class="content"><div class="card"><div class="v1610-flow-grid"><button class="btn">A</button><button class="btn">B</button></div><div class="table-wrap"><table style="width:1200px"><tr><td>wide</td></tr></table></div></div></section></main></div></div><button class="docnr-sidebar-backdrop"></button>''')
        p.add_script_tag(content="window.DOCNR_DEVICE_RUNTIME={classify:()=>innerWidth<=620?'phone':innerWidth<=960?'tablet':'desktop'};"+js)
        p.wait_for_timeout(120)
        x=p.evaluate("()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,kind:document.documentElement.dataset.device,pe:getComputedStyle(document.querySelector('.docnr-sidebar-backdrop')).pointerEvents,vh:getComputedStyle(document.documentElement).getPropertyValue('--docnr-vh')})")
        assert x['sw']<=x['cw']+1,(w,h,x); assert x['pe']=='none'; assert x['vh']; assert not errs,(w,h,errs)
        p.locator('#sidebar').evaluate("e=>e.classList.add('open')"); p.evaluate("()=>window.DOCNR_STABILITY.stabilizeChrome()")
        if x['kind']!='desktop': assert p.evaluate("()=>getComputedStyle(document.querySelector('.docnr-sidebar-backdrop')).pointerEvents")=='auto'
        p.close()
    b.close()
print('V20.6 ADAPTIVE STABILITY BROWSER CONTRACT PASS • 6 viewports/orientations')
