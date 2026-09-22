from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.1 CONTENT SLIDES BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.1 CONTENT SLIDES BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')+'\n'+(ROOT/'site/v20-unified-ui.css').read_text('utf-8')
knowledge=(ROOT/'site/data/teaching-knowledge-v20.js').read_text('utf-8').replace('export const TEACHING_KNOWLEDGE = Object.freeze(','const TEACHING_KNOWLEDGE = Object.freeze(').replace('export default TEACHING_KNOWLEDGE;','')
start=flow.index('function teachingHints('); end=flow.index('\nfunction bindDeck(',start); chunk=flow[start:end]
pre=r'''
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH"):"-";
const cleanTopic=x=>String(x||"").replace(/^ใบงาน(?:อิเล็กทรอนิกส์|พิมพ์)\s*\d+\s*:\s*/i,"").trim();
const unitTopic=u=>{const w=u?.worksheets||[];const d=w.find(x=>x.mode==="digital")||w[0];return cleanTopic(d?.title||u?.topic||"หน่วยทดสอบ")};
function uniq(items){return [...new Set((items||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}
'''
make=r'''
window.__make=()=>{const subject={code:'21910-2010',name:'การเขียนโปรแกรมภาษาคอมพิวเตอร์'};const unit={unit_no:3,worksheets:[{mode:'digital',title:'ใบงานอิเล็กทรอนิกส์ 3: ตัวแปรและชนิดข้อมูล',learning_goal:'อธิบายและเลือกใช้ตัวแปรและชนิดข้อมูลได้',key_concepts:['ตัวแปร','ชนิดข้อมูล','การกำหนดค่า','การแปลงชนิดข้อมูล','การตรวจสอบข้อมูล'],practice_steps:['วิเคราะห์ข้อมูลเข้า','เลือกชนิดข้อมูล','กำหนดค่า','ประมวลผล','ทดสอบผล'],control_points:['ตรวจชนิดข้อมูล','ตรวจค่าขอบเขต','ตรวจผลลัพธ์'],case_study:'โปรแกรมคำนวณคะแนนให้ผลผิดเมื่อรับค่าทศนิยมและข้อความปนกัน'}]};const slides=deckSlides(subject,unit,{admin:false});document.querySelector('#root').innerHTML=renderDeck(slides);return slides.map(s=>({k:s.kicker,title:s.title,body:s.body||[]}));};
'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768}); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.set_content(f'<style>{css}</style><div id="root"></div>')
    page.add_script_tag(content=pre+knowledge+'\n'+chunk+'\n'+make)
    slides=page.evaluate('window.__make()')
    assert len(slides)==20
    assert slides[17]['k']=='ANALYTICAL QUESTIONS'
    assert slides[18]['k']=='COMPARE & DISTINGUISH'
    assert slides[19]['k']=='UNIT SUMMARY'
    forbidden=['WORKSHEET','EXAM ALIGNMENT','TEACHER NOTE']
    for i,s in enumerate(slides):
        text=(s['k']+' '+s['title']).upper()
        assert not any(x in text for x in forbidden),(i+1,text)
    assert len(slides[17]['body'])>=4 and len(slides[18]['body'])>=4
    assert any('เปรียบเทียบ' in q or 'แยก' in q for q in slides[18]['body'])
    assert page.locator('.v174-slide').count()==20
    assert 'คำถาม' in page.locator('.v174-slide').nth(17).inner_text()
    assert not errs,errs
    browser.close()
print('V20.1 CONTENT-FOCUSED SLIDES BROWSER CONTRACT PASS')
