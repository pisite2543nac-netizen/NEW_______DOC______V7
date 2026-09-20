from pathlib import Path
import os,shutil,json,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V19.7 PROGRAMMING ACTIVITY BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1'); raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V19.7 PROGRAMMING ACTIVITY BROWSER CONTRACT SKIP:',e); raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V19.7 PROGRAMMING ACTIVITY BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
css='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['styles.css','mobile.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css','v19-programming-activity.css'])
# Dedicated layout smoke representing the real V19.7 structure; RPC behavior is covered by backend smoke tests.
html=f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><main id="content"><section class="v14-page v197-page" id="v197-root" style="--v197-accent:#EF6C00"><div class="v197-topline"><button class="btn ghost">← กลับห้องเรียนรายวิชา</button><span class="v197-safe-note">กิจกรรมพิเศษ • ไม่รวมคะแนนรายวิชา 100 คะแนน</span></div><header class="v197-hero"><div><span class="v14-kicker">SPECIAL ACTIVITY • 21910-2010</span><h1>⌨️ Code Typing Academy</h1><p>HTML + Python 100 ด่าน</p></div><div class="v197-profile-badge"><b>นักศึกษาทดสอบ</b><span class="v197-tier">Bronze</span></div></header><div class="v197-kpis"><div><span>ผ่านแล้ว</span><b>0/100</b></div><div><span>Best WPM</span><b>0</b></div><div><span>Accuracy</span><b>0%</b></div></div><section class="v197-track-grid"><article class="card v197-track"><div><span>🌐</span><div><h2>HTML</h2><small>0/50 ด่าน</small></div></div></article><article class="card v197-track"><div><span>🐍</span><div><h2>Python</h2><small>0/50 ด่าน</small></div></div></article></section><section class="v197-main-grid"><div class="card v197-stage-panel"><h2>เลือกด่านฝึก</h2><div class="v197-stage-list"><article class="v197-stage"><div class="v197-stage-no">1</div><div><b>ด่านทดสอบ</b><small>พื้นฐาน</small></div><div class="v197-stage-actions"><button class="btn sm">ฝึก</button><button class="btn sm primary">Ranking</button></div></article></div></div><div class="v197-side-stack"><section class="card"><h2>🎯 ภารกิจจากครู</h2></section><section class="card"><h2>🏆 อันดับในห้อง</h2></section></div></section><section class="card v197-official"><h2>🏅 ชุดกิจกรรมทางการ</h2><p>30 ด่าน / 40 คะแนนกิจกรรม</p></section></section></main></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for viewport in ({'width':1366,'height':768},{'width':1024,'height':768},{'width':768,'height':1024},{'width':390,'height':844},{'width':844,'height':390}):
    page=browser.new_page(viewport=viewport); errs=[]; page.on('pageerror',lambda e:errs.append(str(e))); page.set_content(html)
    assert page.locator('.v197-page').count()==1
    assert page.locator('.v197-track').count()==2
    dims=page.evaluate('()=>({vw:innerWidth,bw:document.body.scrollWidth,cw:document.querySelector("#content").scrollWidth})')
    assert dims['bw']<=dims['vw']+4,(viewport,dims)
    assert dims['cw']<=dims['vw']+4,(viewport,dims)
    assert not errs,errs
    page.close()
  browser.close()
print('V19.7 PROGRAMMING ACTIVITY BROWSER CONTRACT PASS')
