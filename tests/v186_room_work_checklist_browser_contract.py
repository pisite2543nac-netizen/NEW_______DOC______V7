from pathlib import Path
import os,shutil,re
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('V18.6 ROOM CHECKLIST BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try: from playwright.sync_api import sync_playwright
except Exception as e: print('V18.6 ROOM CHECKLIST BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('V18.6 ROOM CHECKLIST BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
platform=platform.replace('import { getClient } from "./v18-supabase.js";','const getClient = ()=>globalThis.__createClient();')
platform=platform.replace('import { RELEASE_VERSION } from "./release-meta.js";','const RELEASE_VERSION = "V20.0";')
platform=re.sub(r'function readSession\(\)\{[\s\S]*?\n\}', 'function readSession(){ return globalThis.__testSession; }', platform, count=1)
css=(ROOT/'site/v18-core-ui.css').read_text('utf-8')+'\n'+(ROOT/'site/v16-minimal.css').read_text('utf-8')
admin={'id':'admin1','username':'admin','full_name':'ผู้ดูแลระบบ','display_name':'Admin','role':'admin','active':True,'approval_status':'approved','academic_status':'studying'}
student={'id':'u1','student_code':'66001','full_name':'สมชาย ทดสอบ','display_name':'ชาย','grade_level':'ปวช.2','room_label':'/1','class_name':'ปวช.2/1','department':'คอมพิวเตอร์','major':'เทคโนโลยีธุรกิจดิจิทัล (ทธ.)','seat_number':1,'role':'user','active':True,'approval_status':'approved'}
subject={'id':'s1','code':'21910-2010','name':'การเขียนโปรแกรมภาษาคอมพิวเตอร์','academic_year':'2569','semester':'1','active':True,'subject_type':'subject'}
works=[
 {'id':'d1','title':'ใบงานอิเล็กทรอนิกส์ 01 : การแก้ปัญหา','reference_code':'D01','mode':'digital','status':'published','due_at':'2099-09-16T12:00:00Z','settings':{'work_pair_key':'21910-2010-U01','sequence_no':1,'unit_topic':'การแก้ปัญหา'}},
 {'id':'p1','title':'ใบงานพิมพ์ย้อนหลัง 01 : การแก้ปัญหา','reference_code':'P01','mode':'paper','status':'published','due_at':None,'settings':{'work_pair_key':'21910-2010-U01','sequence_no':1,'unit_topic':'การแก้ปัญหา'}},
 {'id':'d2','title':'ใบงานอิเล็กทรอนิกส์ 02 : Flowchart','reference_code':'D02','mode':'digital','status':'published','due_at':'2099-09-23T12:00:00Z','settings':{'work_pair_key':'21910-2010-U02','sequence_no':2,'unit_topic':'Flowchart และ Pseudocode'}},
 {'id':'p2','title':'ใบงานพิมพ์ย้อนหลัง 02 : Flowchart','reference_code':'P02','mode':'paper','status':'published','due_at':None,'settings':{'work_pair_key':'21910-2010-U02','sequence_no':2,'unit_topic':'Flowchart และ Pseudocode'}},
]
html=f'''<!doctype html><html class="v14-tech v16-minimal"><head><style>{css}</style></head><body><div id="app"><aside id="sidebar"><nav class="nav"></nav></aside><b id="pagetitle"></b><section id="content"></section></div></body></html>'''
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':900});errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.set_content(html)
  page.evaluate("""({admin,student,subject,works})=>{
    globalThis.__testSession={access_token:'t',user:{id:'admin1'}};
    globalThis.__createClient=function(){
      function chain(table){let eqs={},ins=[];const self={};self.select=()=>self;self.eq=(k,v)=>{eqs[k]=v;return self};self.in=(k,v)=>{ins.push([k,v]);return self};self.order=()=>self;self.limit=()=>self;
        self.single=async()=>({data:table==='profiles'?admin:(table==='subjects'?subject:{}),error:null});self.maybeSingle=self.single;
        self.then=(resolve)=>{let data=[];
          if(table==='subjects')data=[subject];
          if(table==='profiles')data=eqs.role==='user'?[student]:[admin];
          if(table==='subject_enrollments')data=[{user_id:'u1',status:'approved'}];
          if(table==='worksheets')data=works;
          if(table==='worksheet_assignments')data=[{worksheet_id:'d1',user_id:'u1',assigned_at:'2026-09-16T01:00:00Z'},{worksheet_id:'d2',user_id:'u1',assigned_at:'2026-09-16T01:00:00Z'}];
          if(table==='submissions')data=[{worksheet_id:'d1',user_id:'u1',status:'submitted',is_late:false,submitted_at:'2026-09-16T02:00:00Z',confirmed_at:null}];
          return resolve({data,error:null,count:data.length})};return self;
      }
      return {from:t=>chain(t),rpc:async(name,args)=>{if(name==='server_now')return {data:new Date().toISOString(),error:null};if(name==='admin_subject_gradebook')return {data:[{user_id:'u1',work_score:12,work_points:40}],error:null};return {data:[],error:null}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>true,realtime:{setAuth:async()=>true}};
    };window.DOCNR_BASE={navigate:(r,a)=>window.DOCNR_V16_6.navigate(r,a)};
  }""",{'admin':admin,'student':student,'subject':subject,'works':works})
  page.add_script_tag(content=platform,type='module');page.wait_for_function("window.DOCNR_V16_6")
  page.evaluate("window.DOCNR_V16_6.navigate('workcheck')")
  page.wait_for_selector('.v186-check-table')
  txt=page.locator('#content').inner_text()
  assert 'ตารางเช็กรวมการเก็บงานรายห้อง' in txt
  assert 'ใบงานการเขียนโปรแกรมภาษาคอมพิวเตอร์' in txt
  assert 'หน่วยที่ 1' in txt and 'หน่วยที่ 2' in txt
  assert page.locator('.v186-work-head').count()==2, 'Digital/Paper were not collapsed to logical pairs'
  assert page.locator('[data-v186-user="u1"]').count()==2
  assert page.locator('#v186-excel').count()==1 and page.locator('#v186-print').count()==1
  page.locator('[data-v186-user="u1"]').first.click();page.wait_for_selector('#v14-overlay .v186-cell-detail');assert 'ส่งแล้ว' in page.locator('#v14-overlay').inner_text()
  if errs: raise AssertionError('page errors: '+' | '.join(errs))
  browser.close()
print('V18.6 ROOM CHECKLIST BROWSER CONTRACT PASS')
print('registration filters -> subject enrollment -> logical work-pair matrix -> named headers -> detail modal PASS')
