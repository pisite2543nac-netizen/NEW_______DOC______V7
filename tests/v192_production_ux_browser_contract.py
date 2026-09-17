from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V19.2 PRODUCTION UX BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V19.2 PRODUCTION UX BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V19.2 PRODUCTION UX BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
styles='\n'.join((ROOT/'site'/f).read_text('utf-8') for f in ['styles.css','mobile.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css'])
runtime=(ROOT/'site/v19-ux-runtime.js').read_text('utf-8')
html=f'''<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{styles}</style></head><body><div id="app"><div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><b>DOC-FULL-NR</b></div><nav class="nav nav-card-menu"><button data-route="dashboard" class="nav-card-btn active"><span class="nav-card-icon">🏠</span><span>หน้าแรก</span></button><button data-route="courses" class="nav-card-btn"><span class="nav-card-icon">📚</span><span>การสอนและรายวิชา</span></button><button data-route="students" class="nav-card-btn"><span class="nav-card-icon">👨‍🎓</span><span>นักศึกษาและสิทธิ์</span></button><button data-route="workcheck" class="nav-card-btn"><span class="nav-card-icon">✅</span><span>ตารางเช็กรวม</span></button></nav></aside><main class="main"><header class="topbar"><div class="row"><button class="btn mobile-menu" id="menubtn">☰</button><b id="pagetitle">ตารางเช็กรวมการเก็บงานรายห้อง</b></div><div class="row topbar-actions"><button class="btn sm" id="theme-toggle">🌙 ไนท์โหมด</button><button class="btn sm" id="install">ติดตั้งแอป</button><button class="btn sm" id="fullscreen">เต็มจอ</button></div></header><section class="content"><div class="v186-checklist-page"><div class="v186-hero-shell"><div class="v186-hero-icon">✅</div><div class="v186-hero-copy"><h1>ตารางเช็กรวมการเก็บงานรายห้อง</h1><p>ทดสอบ Production UX</p></div><div class="v186-hero-aside"><div class="v186-hero-note">สรุปข้อมูล</div></div></div><div class="card v186-filter-card"><div class="v186-filter-grid"><label>ปี<select class="input"><option>2569</option></select></label><label>ภาค<select class="input"><option>1</option></select></label><label class="subject">วิชา<select class="input"><option>วิชา</option></select></label></div></div><div class="v186-room-summary"><div class="v186-room-ident"><div><h2>ทธ. 2/2</h2><p>วิชา</p></div></div><div class="v186-mini-kpis"><div><span>นักศึกษา</span><b>12</b></div><div><span>งาน</span><b>17</b></div></div></div><div class="v186-table-scroll"><table class="v186-check-table"><thead><tr><th>ลำดับ</th><th>รหัส</th><th>ชื่อ</th>{''.join('<th>หน่วย</th>' for _ in range(17))}</tr></thead><tbody><tr><td>1</td><td>111</td><td>ทดสอบ</td>{''.join('<td>—</td>' for _ in range(17))}</tr></tbody></table></div></div></section></main></div></div><script>{runtime}</script></body></html>'''
viewports=[(2560,1440),(1920,1080),(1440,900),(1366,768),(1280,800),(1024,1366),(834,1194),(820,1180),(768,1024),(430,932),(412,915),(390,844),(360,800),(844,390)]
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in viewports:
    page=browser.new_page(viewport={'width':w,'height':h});page.set_content(html);page.wait_for_timeout(80)
    m=page.evaluate('''()=>({vw:innerWidth,bw:document.body.scrollWidth,aw:document.querySelector('.app').getBoundingClientRect().width,cw:document.querySelector('.content').getBoundingClientRect().width,tw:document.querySelector('.v186-table-scroll').getBoundingClientRect().width,spos:getComputedStyle(document.querySelector('.sidebar')).position,menu:getComputedStyle(document.querySelector('.mobile-menu')).display,bottom:!!document.querySelector('.docnr-mobile-bottom-nav')})''')
    assert m['bw']<=m['vw']+3,(w,h,m);assert m['aw']<=m['vw']+3,(w,h,m);assert m['tw']<=m['cw']+3,(w,h,m)
    if w<=960: assert m['spos']=='fixed' and m['menu']!='none',(w,h,m)
    if w<=620: assert m['bottom'],(w,h,m)
    page.close()
  browser.close()
print('V19.2 PRODUCTION UX BROWSER CONTRACT PASS')
print('14 common viewport/orientation layouts PASS')
