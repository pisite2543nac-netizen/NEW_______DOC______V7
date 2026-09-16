from pathlib import Path
import os,shutil,re,sys
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V18.1 CORE BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V18.1 CORE BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V18.1 CORE BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
css=(ROOT/'site/v18-core-ui.css').read_text('utf-8')+'\n'+(ROOT/'site/v16-minimal.css').read_text('utf-8')
profile={'id':'student1','username':'66001','full_name':'สมชาย ทดสอบ','display_name':'ชาย','student_code':'66001','birth_date':'2008-01-01','avatar_path':None,'phone':'+66810000000','grade_level':'ปวช.1','room_label':'/1','class_name':'ปวช.1/1','department':'คอมพิวเตอร์','major':'เทคโนโลยีสารสนเทศ (ทส.)','seat_number':1,'approval_status':'approved','academic_status':'studying','active':True,'last_seen_at':None,'created_at':'2026-09-01T00:00:00Z','approved_at':'2026-09-01T00:00:00Z','contact_email':None}
admin={'id':'admin1','username':'admin','full_name':'ผู้ดูแลระบบ','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'}
subject={'id':'s1','code':'20001-1001','name':'สุขภาพความปลอดภัยและสิ่งแวดล้อม','color_hex':'#587FA2'}
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><style>{css}</style></head><body><div id="app"><aside id="sidebar"><nav class="nav"></nav></aside><b id="pagetitle"></b><section id="content"></section></div></body></html>'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.set_content(html)
    page.evaluate("""({admin,profile,subject})=>{
      globalThis.__testSession={access_token:'t',user:{id:'admin1'}};
      globalThis.__createClient=function(){
        function chain(table){let eqs={};const self={};
          self.select=()=>self;self.eq=(k,v)=>{eqs[k]=v;return self};for(const m of ['neq','in','order','limit','filter','gte','lte','contains'])self[m]=()=>self;
          self.single=async()=>({data:table==='profiles'?(eqs.id==='student1'?profile:admin):(table==='subjects'?subject:{}),error:null});
          self.maybeSingle=async()=>({data:table==='profiles'?(eqs.id==='student1'?profile:admin):null,error:null});
          self.then=(resolve)=>{let data=[];if(table==='profiles'&&eqs.role==='user')data=[profile];if(table==='subjects')data=[subject];return resolve({data,error:null,count:data.length})};return self;
        }
        return {from:t=>chain(t),rpc:async(name,args)=>{if(name==='server_now')return {data:new Date().toISOString(),error:null};if(name==='admin_subject_paper_scans')return {data:[],error:null};if(name==='my_leader_classrooms')return {data:[],error:null};return {data:[],error:null}},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null})})},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,realtime:{setAuth:async()=>true}};
      };window.DOCNR_BASE={navigate:(r,a)=>window.DOCNR_V16_6.navigate(r,a)};window.confirm=()=>true;
    }""",{'admin':admin,'profile':profile,'subject':subject})
    page.add_script_tag(content=platform,type='module');page.wait_for_function("window.DOCNR_V16_6")
    page.evaluate("window.DOCNR_V16_6.navigate('profiles')");page.wait_for_selector('[data-v14-profile="student1"]');page.click('[data-v14-profile="student1"]');page.wait_for_selector('#v14-overlay .v14-profile-detail')
    assert 'สมชาย ทดสอบ' in page.locator('#v14-overlay').inner_text();assert page.eval_on_selector('#v14-overlay','e=>getComputedStyle(e).position')=='fixed'
    page.click('[data-v14-close]');page.evaluate("window.DOCNR_V16_6.navigate('paperscan')");page.wait_for_selector('[data-v181-paper-subject="s1"]');assert 'ศูนย์สแกนใบงานส่งย้อนหลัง' in page.locator('#content').inner_text()
    if errs: raise AssertionError('page errors: '+' | '.join(errs))
    browser.close()
print('V18.1 CORE BROWSER CONTRACT PASS')
print('Admin profile modal + fixed overlay + top-level Paper Scan hub PASS')
