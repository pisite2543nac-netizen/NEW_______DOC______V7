from pathlib import Path
import os,shutil,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V18.7 EXAM BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V18.7 EXAM BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V18.7 EXAM BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
exam=(ROOT/'site/v16-exam.js').read_text('utf-8')
exam=exam.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
exam=re.sub(r'function session\(\)\{[^\n]*\}', 'function session(){ return globalThis.__testSession; }', exam, count=1)
css='\n'.join((ROOT/'site'/n).read_text('utf-8') for n in ['v18-core-ui.css','v16-minimal.css','v18-7-exam-adapted.css'])
student={'id':'u1','full_name':'สมชาย ทดสอบ','student_code':'66001','role':'user','active':True,'approval_status':'approved','academic_status':'studying','class_name':'ปวช.2/1','grade_level':'ปวช.2','room_label':'/1','department':'คอมพิวเตอร์','major':'เทคโนโลยีธุรกิจดิจิทัล (ทธ.)'}
subject={'id':'s1','code':'21910-2010','name':'การเขียนโปรแกรมภาษาคอมพิวเตอร์','color_hex':'#15803d'}
examrow={'id':'e1','subject_id':'s1','title':'สอบกลางภาค การเขียนโปรแกรมภาษาคอมพิวเตอร์','exam_kind':'midterm','status':'published','open_at':'2026-01-01T00:00:00Z','due_at':'2099-01-01T00:00:00Z','duration_minutes':75,'question_count_target':50,'full_score':20,'max_attempts':1,'shuffle_questions':True,'shuffle_options':True,'require_fullscreen':True,'subjects':subject}
questions=[{'id':f'q{i}','type':'mcq','prompt':f'คำถามข้อ {i}','options':['ก','ข','ค','ง']} for i in range(1,51)]
attempt={'attempt_id':'a1','attempt_no':1,'answers':{},'expires_at':'2099-01-01T00:00:00Z','violation_count':0,'exam':{**examrow,'questions':questions,'subject_code':'21910-2010'}}
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><style>{css}</style></head><body><div class="exam-shell"><header class="exam-top"><div class="exam-brand"><div class="exam-logo"></div><b>DOC-FULL-NR Exam Center</b></div><span id="exam-user"></span></header><main id="exam-app" class="exam-main"></main></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':900});errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.set_content(html)
  page.evaluate("""({student,examrow,attempt})=>{
    globalThis.__testSession={access_token:'t',user:{id:'u1'}};
    globalThis.__createClient=function(){
      function chain(table){let eqs={};const self={};self.select=()=>self;self.eq=(k,v)=>{eqs[k]=v;return self};self.in=()=>self;self.order=()=>self;self.limit=()=>self;
        self.maybeSingle=async()=>({data:table==='profiles'?student:null,error:null});self.single=self.maybeSingle;
        self.then=(resolve)=>{let data=[];if(table==='exam_assignments')data=[{exam_id:'e1',assigned_at:'2026-09-16T00:00:00Z'}];if(table==='exams')data=[examrow];return resolve({data,error:null,count:data.length})};return self;
      }
      return {from:t=>chain(t),rpc:async(name,args)=>{if(name==='server_now')return {data:'2026-09-16T06:00:00Z',error:null};if(name==='my_exam_attempt_status')return {data:[],error:null};if(name==='start_exam_v18')return {data:attempt,error:null};if(name==='save_exam_answers')return {data:{ok:true},error:null};if(name==='record_exam_violation')return {data:{violation_count:1},error:null};if(name==='submit_exam_attempt_v18')return {data:{ok:true},error:null};return {data:[],error:null}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true};
    };
    document.documentElement.requestFullscreen=async()=>{};
    window.confirm=()=>true;
  }""",{'student':student,'examrow':examrow,'attempt':attempt})
  page.add_script_tag(content=exam,type='module')
  page.wait_for_selector('.v187-student-exam-card')
  assert 'ระบบสอบของฉัน' in page.locator('#exam-app').inner_text()
  page.click('[data-exam-action="e1"]')
  page.wait_for_selector('.v187-preexam')
  txt=page.locator('.v187-preexam').inner_text();assert 'คำชี้แจงก่อนเริ่มทำข้อสอบ' in txt and '50 ข้อ' in txt and '75 นาที' in txt
  page.check('#instruction-accept');assert page.locator('#instruction-start').is_enabled();page.click('#instruction-start')
  page.wait_for_selector('.v187-exam-layout')
  assert page.locator('.v187-nav-grid button').count()==50
  assert 'คำถามข้อ' in page.locator('#exam-question-area').inner_text()
  page.locator('input[name="exam-answer"]').first.check()
  assert 'ตอบแล้ว 1/50' in page.locator('#exam-answered').inner_text()
  page.set_viewport_size({'width':390,'height':844})
  page.wait_for_timeout(100)
  assert page.locator('.v187-exam-layout').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===1")
  assert page.locator('.v187-exam-side').evaluate("e=>getComputedStyle(e).position==='static'")
  assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2")
  if errs: raise AssertionError('page errors: '+' | '.join(errs))
  browser.close()
print('V18.7 EXAM SOURCE ADAPTATION BROWSER CONTRACT PASS')
print('student assigned exams -> pre-exam instructions -> V18 start -> 50-question navigator -> answer/autosave UI PASS')
