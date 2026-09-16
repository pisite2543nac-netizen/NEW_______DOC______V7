from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V19.1.3 RESPONSIVE FIT BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V19.1.3 RESPONSIVE FIT BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V19.1.3 RESPONSIVE FIT BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
styles=(ROOT/'site/styles.css').read_text('utf-8')+'\n'+(ROOT/'site/mobile.css').read_text('utf-8')+'\n'+(ROOT/'site/v16-minimal.css').read_text('utf-8')+'\n'+(ROOT/'site/v19-responsive-fit.css').read_text('utf-8')
html=f'''<!doctype html><html><head><style>{styles}</style></head><body><div id="app"><div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><div><b>DOC-FULL-NR</b></div></div><nav class="nav nav-card-menu"><button class="nav-card-btn active"><span>✅</span><span>ตารางเช็กรวม</span></button></nav></aside><main class="main"><header class="topbar"><div class="row"><button class="btn mobile-menu">☰</button><b>ตารางเช็กรวมการเก็บงานรายห้อง</b></div><div class="row topbar-actions"><button class="btn sm">ไนท์โหมด</button><button class="btn sm">ออกจากระบบ</button></div></header><section class="content"><div class="v186-checklist-page"><div class="v186-hero-shell"><div class="v186-hero-icon">✅</div><div class="v186-hero-copy"><h1>ตารางเช็กรวมการเก็บงานรายห้อง</h1><p>ทดสอบสัดส่วนหน้าจอ</p></div><div class="v186-hero-aside"><div class="v186-hero-note">ข้อมูล</div></div></div><div class="card v186-filter-card"><div class="v186-filter-grid"><label>ปี<select class="input"><option>2569</option></select></label><label>ภาค<select class="input"><option>1</option></select></label><label class="subject">วิชา<select class="input"><option>วิชา</option></select></label></div></div><div class="v186-table-shell"><div class="v186-table-scroll"><table class="v186-check-table"><thead><tr><th>ลำดับ</th><th>รหัส</th><th>ชื่อ</th>{''.join('<th>หน่วย</th>' for _ in range(17))}</tr></thead><tbody><tr><td>1</td><td>111</td><td>ทดสอบ</td>{''.join('<td>—</td>' for _ in range(17))}</tr></tbody></table></div></div></div></section></main></div></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in [(1920,1080),(1366,768),(1024,768),(768,1024),(390,844)]:
    page=browser.new_page(viewport={'width':w,'height':h});page.set_content(html)
    metrics=page.evaluate('''()=>({vw:innerWidth,body:document.body.scrollWidth,app:document.querySelector('.app').getBoundingClientRect().width,content:document.querySelector('.content').getBoundingClientRect().width,sidebar:getComputedStyle(document.querySelector('.sidebar')).position,menu:getComputedStyle(document.querySelector('.mobile-menu')).display,tableW:document.querySelector('.v186-table-scroll').getBoundingClientRect().width})''')
    assert metrics['body'] <= metrics['vw']+2,(w,metrics)
    assert metrics['app'] <= metrics['vw']+2,(w,metrics)
    assert metrics['content'] > 0 and metrics['tableW'] <= metrics['content']+2,(w,metrics)
    if w<=960:
      assert metrics['sidebar']=='fixed' and metrics['menu']!='none',(w,metrics)
    page.close()
  browser.close()
print('V19.1.3 RESPONSIVE FIT BROWSER CONTRACT PASS')
print('1920 / 1366 / 1024 / 768 / 390 viewport layout PASS')
