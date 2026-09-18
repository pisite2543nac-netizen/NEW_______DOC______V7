from pathlib import Path
import os,shutil,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V19.3 GRADEBOOK BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V19.3 GRADEBOOK BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V19.3 GRADEBOOK BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
css='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['v18-core-ui.css','v16-minimal.css','v19-responsive-fit.css','v19-production-ui.css'])
admin={'id':'admin1','username':'admin','full_name':'ผู้ดูแลระบบ','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'}
subject={'id':'s1','code':'21910-2010','name':'การเขียนโปรแกรมภาษาคอมพิวเตอร์','academic_year':'2569','semester':'1'}
row={'user_id':'u1','student_code':'66001','full_name':'สมชาย ทดสอบ','grade_level':'ปวช.2','room_label':'/1','class_name':'ปวช.2/1','assigned_work_count':17,'completed_work_count':12,'work_score':30.5,'behavior_score':18,'midterm_base_raw':14,'midterm_adjustment':1,'midterm_raw_score':15,'midterm_raw_max':20,'midterm_score':15,'final_base_raw':16,'final_adjustment':0,'final_raw_score':16,'final_raw_max':20,'final_score':16,'total_score':79.5,'work_points':40,'behavior_points':20,'midterm_points':20,'final_points':20,'midterm_exam_id':'m1','final_exam_id':'f1','grade_value':3.5,'pass_status':'ผ่าน'}
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><style>{css}</style></head><body><div id="app"><aside id="sidebar"><nav class="nav"></nav></aside><b id="pagetitle"></b><section id="content"><button id="open" data-v16-gradebook="s1">open</button></section></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1366,'height':768});errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.set_content(html)
  page.evaluate("""({admin,subject,row})=>{
    globalThis.__testSession={access_token:'t',user:{id:'admin1'}};
    globalThis.__createClient=function(){
      function chain(table){const self={};self.select=()=>self;self.eq=()=>self;self.in=()=>self;self.order=()=>self;self.limit=()=>self;
        self.single=async()=>({data:table==='profiles'?admin:(table==='subjects'?subject:{}),error:null});self.maybeSingle=async()=>({data:table==='subject_grade_settings'?null:(table==='profiles'?admin:{}),error:null});
        self.then=(resolve)=>{let data=[];if(table==='exams')data=[{id:'m1',title:'กลางภาค',exam_kind:'midterm',status:'published',full_score:20},{id:'f1',title:'ปลายภาค',exam_kind:'final',status:'published',full_score:20}];if(table==='worksheets'||table==='worksheet_assignments'||table==='submissions')data=[];return resolve({data,error:null,count:data.length})};return self;
      }
      return {from:t=>chain(t),rpc:async(name,args)=>{if(name==='admin_subject_gradebook_v193')return {data:[row],error:null};if(name==='admin_adjust_subject_scores_v193')return {data:{ok:true},error:null};if(name==='admin_set_subject_grade_settings')return {data:{ok:true},error:null};return {data:[],error:null}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,realtime:{setAuth:async()=>true}};
    };
  }""",{'admin':admin,'subject':subject,'row':row})
  page.add_script_tag(content=platform,type='module');page.wait_for_function("window.DOCNR_V16_6")
  page.locator('#open').click();page.wait_for_selector('.v16-grade-table')
  txt=page.locator('#content').inner_text()
  assert 'ใบงาน 17 งาน = 40' in txt
  assert 'เกรด' in txt and 'ผ่าน' in txt
  assert page.locator('.v193-grade-badge').inner_text()=='3.5'
  assert page.locator('.v193-pass-pill.pass').count()==1
  assert page.locator('[data-v193-edit="u1"]').count()==3
  page.locator('[data-v193-edit="u1"]').nth(1).click();page.wait_for_selector('#v193-score-form')
  modal=page.locator('#v14-overlay').inner_text()
  assert 'คะแนนดิบกลางภาค' in modal and 'คะแนนดิบปลายภาค' in modal and 'จิตพิสัย' in modal
  before=page.locator('input[name="midRaw"]').input_value();page.locator('[data-target="midRaw"][data-v193-step="1"]').click();after=page.locator('input[name="midRaw"]').input_value();assert float(after)==float(before)+1
  if errs: raise AssertionError('page errors: '+' | '.join(errs))
  browser.close()
print('V19.3 GRADEBOOK BROWSER CONTRACT PASS')
print('17-unit/40 score + raw mid/final adjustment + grade/pass UI PASS')
