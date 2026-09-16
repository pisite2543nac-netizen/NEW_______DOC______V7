from pathlib import Path
import re, shutil, sys, os
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');sys.exit(0)
try:
    from playwright.sync_api import sync_playwright
except Exception as e:
    print('BROWSER CONTRACT SKIP: playwright unavailable:',e);sys.exit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('BROWSER CONTRACT SKIP: Chromium not installed');sys.exit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";','const createClient = globalThis.__createClient;')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
profile={'id':'admin-test','username':'admin','full_name':'Admin Test','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'}
html='''<!doctype html><html><body>
<div id="app"><div class="app"><aside id="sidebar"><div class="brand"><div class="smalltext">ADMIN • V17.0</div></div><nav class="nav"><button data-route="dashboard" class="active">หน้าแรก</button><button data-route="courses">รายวิชา</button><button data-route="students">นักศึกษา</button><button data-route="profile">โปรไฟล์</button></nav></aside><main><header class="topbar"><div class="row"><b id="pagetitle"></b></div><div class="row"><span>Admin Test</span></div></header><section id="content">กำลังโหลด...</section></main></div></div>
</body></html>'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html)
    page.evaluate("""(profile)=>{
      globalThis.__testSession={access_token:'test-token',user:{id:'admin-test'}};
      globalThis.__createClient=function(){
        function chain(table){const self={};for(const m of ['select','eq','neq','in','order','limit','is','filter','gte','lte','contains'])self[m]=()=>self;self.maybeSingle=async()=>({data:table==='profiles'?profile:null,error:null});self.single=async()=>({data:table==='profiles'?profile:{},error:null});self.then=(resolve)=>resolve({data:[],error:null,count:0});return self;}
        return {from:(t)=>chain(t),rpc:async(name,args)=>{if(name==='server_now')return {data:new Date().toISOString(),error:null};if(name==='admin_system_health_v17')return {data:{backend_ok:true,active_subjects:11,standard_templates:374,critical_rpcs:15},error:null};if(name==='my_leader_classrooms')return {data:[],error:null};return {data:null,error:null};},realtime:{setAuth:async()=>true},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null})})}};
      };
      window.DOCNR_BASE={navigate:(route,arg)=>{document.body.dataset.lastRoute=route;document.body.dataset.lastArg=arg||'';return true;},openWorksheet:()=>true};
      document.addEventListener('click',e=>{const b=e.target.closest('[data-app-route]');if(b)window.DOCNR_BASE.navigate(b.dataset.appRoute,b.dataset.appArg||null);},true);
      window.confirm=()=>true;
    }""", profile)
    page.add_script_tag(content=platform,type='module')
    page.wait_for_function('window.DOCNR_V16_6 && typeof window.DOCNR_V16_6.navigate === "function"',timeout=8000)
    page.evaluate("window.DOCNR_V16_6.navigate('dashboard')")
    page.wait_for_selector('[data-app-route="students"]',timeout=8000)
    cards=page.locator('[data-app-route]').count()
    if cards<6: raise AssertionError(f'dashboard cards={cards}')
    page.click('[data-app-route="students"]')
    page.wait_for_function('document.body.dataset.lastRoute === "students"',timeout=2000)
    page.evaluate("window.DOCNR_V16_6.navigate('students')")
    page.wait_for_selector('[data-app-route="users"]',timeout=5000)
    page.click('[data-app-route="users"]')
    page.wait_for_function('document.body.dataset.lastRoute === "users"',timeout=2000)
    if errors: raise AssertionError('page errors: '+' | '.join(errors))
    browser.close()
print('BROWSER CONTRACT PASS')
print('dashboard direct route -> students hub -> users route bridge PASS')
