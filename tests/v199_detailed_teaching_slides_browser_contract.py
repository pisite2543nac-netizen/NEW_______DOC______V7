from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V19.9 DETAILED SLIDES BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
try:
    from playwright.sync_api import sync_playwright
except Exception as e:
    print('V19.9 DETAILED SLIDES BROWSER CONTRACT SKIP:',e);raise SystemExit(0)
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V19.9 DETAILED SLIDES BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')
knowledge=(ROOT/'site/data/teaching-knowledge-v20.js').read_text('utf-8').replace('export const TEACHING_KNOWLEDGE = Object.freeze(','const TEACHING_KNOWLEDGE = Object.freeze(').replace('export default TEACHING_KNOWLEDGE;','')
start=flow.index('function teachingHints(')
end=flow.index('\nfunction bindDeck(',start)
chunk=flow[start:end]
pre='''
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH"):"-";
const cleanTopic=x=>String(x||"");
const unitTopic=u=>String(u?.topic||u?.unit_topic||"หน่วยทดสอบ");
function uniq(items){return [...new Set((items||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}
'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for vp in ({'width':1366,'height':768},{'width':390,'height':844}):
        page=browser.new_page(viewport=vp); errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(f'<style>{css}</style><div id="root"></div>')
        page.add_script_tag(content=pre+knowledge+'\n'+chunk+'''\nwindow.__make=()=>{const subject={code:'21910-2010',name:'การเขียนโปรแกรมภาษาคอมพิวเตอร์'};const unit={unit_no:3,topic:'ตัวแปรและชนิดข้อมูล',unlocked:true,open_at:new Date().toISOString(),due_at:new Date(Date.now()+86400000).toISOString(),worksheets:[{mode:'digital',reference_code:'NR219102010-D03',title:'ตัวแปรและชนิดข้อมูล',learning_goal:'อธิบายและเลือกใช้ตัวแปรและชนิดข้อมูลได้',key_concepts:['ตัวแปร','ชนิดข้อมูล','การกำหนดค่า','การแปลงชนิดข้อมูล','การตรวจสอบข้อมูล'],practice_steps:['กำหนดโจทย์','เลือกชนิดข้อมูล','เขียนคำสั่ง','ทดสอบค่า','สรุปผล']},{mode:'paper',reference_code:'NR219102010-P03',title:'ตัวแปรและชนิดข้อมูล'}]};const slides=deckSlides(subject,unit,{admin:false});document.getElementById('root').innerHTML=renderDeck(slides);return slides.length};''')
        assert page.evaluate('window.__make()')==20
        assert page.locator('.v174-slide').count()==20
        assert page.locator('.v199-slide-explain').count()>=18
        assert page.locator('.v199-slide-example').count()>=14
        assert page.locator('text=คำอธิบาย').count()>=18
        assert page.locator('text=ตัวอย่าง / การเชื่อมโยง').count()>=14
        dims=page.evaluate('()=>({vw:innerWidth,bw:document.body.scrollWidth})')
        assert dims['bw']<=dims['vw']+4,(vp,dims)
        assert not errs,errs
        page.close()
    browser.close()
print('V19.9 DETAILED TEACHING SLIDES BROWSER CONTRACT PASS')
print('20-page detailed deck desktop/mobile PASS')
