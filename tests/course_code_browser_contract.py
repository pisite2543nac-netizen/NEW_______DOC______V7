from pathlib import Path
import re, shutil, sys, os
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('COURSE CODE BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');sys.exit(0)
try:
    from playwright.sync_api import sync_playwright
except Exception as e:
    print('COURSE CODE BROWSER CONTRACT SKIP: playwright unavailable:',e);sys.exit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('COURSE CODE BROWSER CONTRACT SKIP: Chromium not installed');sys.exit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
platform=platform.replace('import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";','const createClient = globalThis.__createClient;')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
base_html='''<!doctype html><html><body><div id="app"><div class="app"><aside id="sidebar"><div class="brand"><div class="smalltext"></div></div><nav class="nav"></nav></aside><main><header class="topbar"><div class="row"><b id="pagetitle"></b></div><div class="row"></div></header><section id="content"></section></main></div></div></body></html>'''
subjects=[
 {'id':'s1','code':'20001-1001','name':'สุขภาพความปลอดภัยและสิ่งแวดล้อม','color_hex':'#123456','semester':'1','academic_year':'2569','description':''},
 {'id':'s2','code':'20001-1004','name':'กฎหมายแรงงาน','color_hex':'#654321','semester':'1','academic_year':'2569','description':''}
]
registry={'ok':True,'subjects':[{'subject_id':'s1','subject_code':'20001-1001','subject_name':'สุขภาพความปลอดภัยและสิ่งแวดล้อม','join_code':'9FD46D','member_count':0},{'subject_id':'s2','subject_code':'20001-1004','subject_name':'กฎหมายแรงงาน','join_code':'733ECF','member_count':0}]}

def setup(page,profile):
    page.set_content(base_html)
    page.evaluate("""({profile,subjects,registry})=>{
      globalThis.__testSession={access_token:'test-token',user:{id:profile.id}};
      globalThis.__createClient=function(){
        function chain(table){
          const self={_table:table};
          for(const m of ['select','eq','neq','in','order','limit','is','filter','gte','lte','contains'])self[m]=()=>self;
          self.maybeSingle=async()=>({data:table==='profiles'?profile:null,error:null});
          self.single=async()=>({data:table==='profiles'?profile:(table==='subjects'?subjects[0]:{}),error:null});
          self.then=(resolve)=>{let data=[];if(table==='subjects')data=subjects;if(table==='subject_enrollments')data=[];if(table==='worksheets')data=[];if(table==='worksheet_assignments')data=[];if(table==='submissions')data=[];if(table==='exams')data=[];return resolve({data,error:null,count:0})};
          return self;
        }
        return {from:(t)=>chain(t),rpc:async(name,args)=>{
          if(name==='server_now')return {data:new Date().toISOString(),error:null};
          if(name==='admin_subject_join_code_registry')return {data:registry,error:null};
          if(name==='join_subject_with_code_v18')return {data:{ok:true,status:'approved',subject_id:args.p_subject_id,subject_code:'20001-1001',subject_name:'สุขภาพความปลอดภัยและสิ่งแวดล้อม'},error:null};
          if(name==='my_leader_classrooms')return {data:[],error:null};
          return {data:null,error:null};
        },realtime:{setAuth:async()=>true},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null})})}};
      };
      window.DOCNR_BASE={navigate:(route,arg)=>{document.body.dataset.lastRoute=route;document.body.dataset.lastArg=arg||'';return true;},openWorksheet:()=>true};
      window.confirm=()=>true;
    }""", {'profile':profile,'subjects':subjects,'registry':registry})
    page.add_script_tag(content=platform,type='module')
    page.wait_for_function('window.DOCNR_V16_6 && typeof window.DOCNR_V16_6.navigate === "function"',timeout=8000)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    # Admin sees central saved-code registry
    p=browser.new_page();setup(p,{'id':'admin1','full_name':'Admin','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'})
    p.evaluate("async()=>await window.DOCNR_V16_6.navigate('courses')")
    p.wait_for_selector('.v171-code-registry',timeout=8000)
    txt=p.locator('.v171-code-registry').inner_text()
    assert '9FD46D' in txt and '733ECF' in txt and 'CODE เข้าเรียนทั้งหมด' in txt
    assert p.locator('[data-v165-copy-code="9FD46D"]').count()>=1
    assert p.locator('[data-v165-change-code="s1"]').count()>=1
    p.close()
    # Student enters code and router is sent directly to joined course
    p=browser.new_page();setup(p,{'id':'student1','full_name':'Student Test','display_name':'Stud','student_code':'12345678','role':'user','active':True,'approval_status':'approved','academic_status':'studying'})
    p.evaluate("window.DOCNR_V16_6.navigate('catalog')")
    p.wait_for_selector('[data-v165-join-course="s1"]',timeout=8000)
    p.click('[data-v165-join-course="s1"]')
    p.fill('#v165-join-form input[name=code]','9fd46d')
    assert p.input_value('#v165-join-form input[name=code]')=='9FD46D'
    p.click('#v165-join-form button.primary')
    p.wait_for_function("document.body.dataset.lastRoute==='courses' && document.body.dataset.lastArg==='s1'",timeout=4000)
    p.close();browser.close()
print('COURSE CODE BROWSER CONTRACT PASS')
print('Admin registry -> copy/change controls -> student CODE -> direct course room PASS')
