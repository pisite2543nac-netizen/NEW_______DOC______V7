from pathlib import Path
import os,shutil,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V18.7 EXAM ADMIN BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V18.7 EXAM ADMIN BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V18.7 EXAM ADMIN BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
exam=(ROOT/'site/v16-exam.js').read_text('utf-8')
exam=exam.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
exam=exam.replace('import { RELEASE_VERSION } from "./release-meta.js";','const RELEASE_VERSION = "V20.0";')
exam=re.sub(r'function session\(\)\{[^\n]*\}', 'function session(){ return globalThis.__testSession; }', exam, count=1)
css='\n'.join((ROOT/'site'/n).read_text('utf-8') for n in ['v18-core-ui.css','v16-minimal.css','v18-7-exam-adapted.css'])
admin={'id':'admin1','full_name':'ผู้ดูแลระบบ','student_code':None,'role':'admin','active':True,'approval_status':'approved','academic_status':'studying','class_name':None,'grade_level':None,'room_label':None,'department':None,'major':None}
subject={'id':'s1','code':'21910-2010','name':'การเขียนโปรแกรมภาษาคอมพิวเตอร์','academic_year':'2569','semester':'1','color_hex':'#15803d'}
examrow={'id':'e1','subject_id':'s1','title':'สอบกลางภาค การเขียนโปรแกรมภาษาคอมพิวเตอร์','exam_kind':'midterm','status':'published','open_at':'2026-09-16T01:00:00Z','due_at':'2026-09-16T10:00:00Z','duration_minutes':75,'question_count_target':50,'full_score':20,'subjects':{'code':'21910-2010','name':'การเขียนโปรแกรมภาษาคอมพิวเตอร์','color_hex':'#15803d'}}
bank=[{'subject_id':'s1','difficulty':('basic' if i<10 else 'easy' if i<25 else 'hard'),'active':True} for i in range(50)]
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><style>{css}</style></head><body><div class="exam-shell"><header class="exam-top"><span id="exam-user"></span></header><main id="exam-app" class="exam-main"></main></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':900});errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.set_content(html)
  page.evaluate("""({admin,subject,examrow,bank})=>{
    globalThis.__testSession={access_token:'t',user:{id:'admin1'}};
    globalThis.__createClient=function(){
      function chain(table){let eqs={},head=false;const self={};
        self.select=(cols,opts)=>{head=!!opts?.head;return self};self.eq=(k,v)=>{eqs[k]=v;return self};self.in=()=>self;self.order=()=>self;self.limit=()=>self;
        self.maybeSingle=async()=>({data:table==='profiles'?admin:(table==='subjects'?subject:(table==='exams'?examrow:null)),error:null});self.single=self.maybeSingle;
        self.then=(resolve)=>{let data=[];let count=0;if(table==='subjects')data=[subject];if(table==='exams')data=[examrow];if(table==='exam_question_bank'){data=bank;count=550}if(table==='subject_enrollments')data=[{subject_id:'s1',status:'approved'}];if(table==='exam_attempts')data=[{id:'a1',exam_id:'e1',status:'submitted',score:16,violation_count:0}];return resolve({data:head?null:data,error:null,count:head?count:data.length})};return self;
      }
      return {from:t=>chain(t),rpc:async(name,args)=>{if(name==='server_now')return {data:'2026-09-16T06:00:00Z',error:null};return {data:{},error:null}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true};
    };
  }""",{'admin':admin,'subject':subject,'examrow':examrow,'bank':bank})
  page.add_script_tag(content=exam,type='module')
  page.wait_for_selector('.v187-subject-card')
  txt=page.locator('#exam-app').inner_text()
  assert 'ระบบสอบออนไลน์' in txt and '550' in txt and 'เลือกรายวิชาเพื่อจัดสอบ' in txt
  assert page.locator('.v187-subject-card').count()==1
  assert 'Basic 10/10' in page.locator('.v187-subject-card').inner_text()
  assert 'Easy 15/15' in page.locator('.v187-subject-card').inner_text()
  assert 'Hard 25/25' in page.locator('.v187-subject-card').inner_text()
  assert page.locator('[data-exam-results="e1"]').count()==1
  if errs: raise AssertionError('page errors: '+' | '.join(errs))
  browser.close()
print('V18.7 EXAM ADMIN BROWSER CONTRACT PASS')
print('Admin exam dashboard -> subject readiness -> 550-bank KPI -> exam set controls PASS')
