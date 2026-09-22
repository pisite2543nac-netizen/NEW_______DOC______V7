from pathlib import Path
import os,shutil,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V19.6 PRINT SYSTEM BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V19.6 PRINT SYSTEM BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V19.6 PRINT SYSTEM BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
platform=platform.replace('import { RELEASE_VERSION } from "./release-meta.js";','const RELEASE_VERSION = "V20.0";')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
styles='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['styles.css','mobile.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css','v19-print-system.css'])
admin={'id':'admin1','username':'admin','full_name':'ผู้ดูแลระบบ','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'}
subjects=[
 {'id':'s1','code':'20001-1001','name':'สุขภาพความปลอดภัยและสิ่งแวดล้อม','color_hex':'#2E7D32','academic_year':'2569','semester':'1','active':True,'subject_type':'subject'},
 {'id':'s2','code':'21900-1005','name':'เครือข่ายคอมพิวเตอร์','color_hex':'#1565C0','academic_year':'2569','semester':'1','active':True,'subject_type':'subject'}]
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{styles}</style></head><body><div id="app"><aside id="sidebar"><div class="brand"><span class="smalltext"></span></div><nav class="nav"></nav></aside><b id="pagetitle"></b><section id="content"></section></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for viewport in ({'width':1366,'height':768},{'width':390,'height':844}):
    page=browser.new_page(viewport=viewport); errs=[]; page.on('pageerror',lambda e:errs.append(str(e))); page.set_content(html)
    page.evaluate("""({admin,subjects})=>{
      globalThis.__testSession={access_token:'t',user:{id:'admin1'}};
      globalThis.__createClient=function(){
        function chain(table){const self={};self.select=()=>self;self.eq=()=>self;self.in=()=>self;self.order=()=>self;self.limit=()=>self;
          self.maybeSingle=async()=>({data:table==='profiles'?admin:null,error:null});
          self.single=async()=>({data:table==='profiles'?admin:(table==='subjects'?subjects[0]:{}),error:null});
          self.then=(resolve)=>resolve({data:table==='subjects'?subjects:[],error:null,count:table==='subjects'?subjects.length:0});return self;}
        return {from:t=>chain(t),rpc:async()=>({data:null,error:null}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,realtime:{setAuth:async()=>true}};
      };
    }""",{'admin':admin,'subjects':subjects})
    page.add_script_tag(content=platform,type='module'); page.wait_for_function('window.DOCNR_V16_6')
    page.evaluate("window.DOCNR_V16_6.navigate('printcenter')"); page.wait_for_selector('.v196-print-center')
    assert page.locator('.v196-print-subject').count()==2
    assert page.locator('text=ศูนย์พิมพ์และสรุปผล').count()>=1
    assert page.locator('text=เอกสารและใบงาน').count()>=1
    dims=page.evaluate("""()=>({vw:innerWidth,bw:document.body.scrollWidth,cw:document.querySelector('#content').scrollWidth})""")
    assert dims['bw']<=dims['vw']+4,(viewport,dims)
    assert not errs,errs
    page.close()
  # Dedicated report print-media smoke
  page=browser.new_page(viewport={'width':1440,'height':900})
  page.set_content(f'''<!doctype html><html><head><style>{styles}</style></head><body class="v196-printing"><div id="v196-print-overlay"><main class="v196-print-pages"><article class="v196-report landscape" style="--subject-color:#1565C0"><div class="v196-report-top"></div><header class="v196-report-head"><div></div><div><h1>สรุปคะแนน</h1><p>วิทยาลัยเทคนิคนางรอง</p></div><div class="v196-report-meta">V19.6</div></header><table><thead><tr><th>#</th><th>นักศึกษา</th><th>รวม</th></tr></thead><tbody><tr><td>1</td><td>ทดสอบ</td><td>88</td></tr></tbody></table></article></main></div></body></html>''')
  page.emulate_media(media='print')
  assert page.locator('.v196-report').count()==1
  assert page.locator('.v196-report').evaluate("e=>getComputedStyle(e).display")!='none'
  browser.close()
print('V19.6 PRINT SYSTEM BROWSER CONTRACT PASS')
print('Admin print center desktop/mobile + print-media smoke PASS')
