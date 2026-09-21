from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V19.8 HUB BROWSER CONTRACT SKIP'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V19.8 HUB BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
css='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['styles.css','mobile.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css','v19-programming-activity.css'])
html='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'''+css+'''</style></head><body><main id="content"><section class="v14-page v198-hub" id="v198-special-hub"><header class="v198-hub-hero"><div><span class="v14-kicker">SPECIAL ACTIVITIES</span><h1>กิจกรรมพิเศษ</h1><p>พื้นที่กิจกรรมเสริมแยกจากรายวิชาและคะแนนหลัก</p></div></header><div class="v198-activity-grid"><article class="card v198-activity-card" style="--v197-accent:#EF6C00"><div class="v198-activity-icon">⌨️</div><div class="v198-activity-main"><h2>Code Typing Academy</h2><div class="v198-tags"><span>HTML 50</span><span>Python 50</span></div></div><button class="btn primary v198-open-activity">เปิดกิจกรรม</button></article><article class="card v198-activity-card v198-coming"><div class="v198-activity-icon">＋</div><div class="v198-activity-main"><h2>รองรับกิจกรรมเพิ่มเติม</h2></div></article></div></section></main></body></html>'''
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for vp in ({'width':1366,'height':768},{'width':1024,'height':768},{'width':768,'height':1024},{'width':390,'height':844},{'width':844,'height':390}):
        p=b.new_page(viewport=vp);p.set_content(html)
        assert p.locator('#v198-special-hub').count()==1
        assert p.locator('.v198-activity-card').count()==2
        d=p.evaluate('()=>({vw:innerWidth,bw:document.body.scrollWidth,cw:document.querySelector("#content").scrollWidth})')
        assert d['bw']<=d['vw']+4,(vp,d)
        assert d['cw']<=d['vw']+4,(vp,d)
        p.close()
    b.close()
print('V19.8 STANDALONE SPECIAL ACTIVITY HUB BROWSER CONTRACT PASS')
