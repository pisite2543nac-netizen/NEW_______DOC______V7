from pathlib import Path
import os, shutil, re, json, math
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1':
    print('V20.0 BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1'); raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium:
    print('V20.0 BROWSER CONTRACT SKIP: Chromium missing'); raise SystemExit(0)
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
base_css='\n'.join((ROOT/'site'/x).read_text('utf-8') for x in ['styles.css','mobile.css','v16-minimal.css','v16-8-course-flow.css','v19-responsive-fit.css','v19-production-ui.css','v20-unified-ui.css'])
knowledge=(ROOT/'site/data/teaching-knowledge-v20.js').read_text('utf-8').replace('export const TEACHING_KNOWLEDGE = Object.freeze(','const TEACHING_KNOWLEDGE = Object.freeze(').replace('export default TEACHING_KNOWLEDGE;','')
start=flow.index('function teachingHints(')
end=flow.index('\nfunction unitWorkPair(',start)
chunk=flow[start:end]
# We only need the actual deck rendering helpers; provide browser-safe stubs for surrounding runtime helpers.
pre='''
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH"):"-";
const cleanTopic=x=>String(x||"").replace(/^ใบงาน(?:อิเล็กทรอนิกส์|พิมพ์)\\s*\\d+\\s*:\\s*/i,"").trim();
const unitTopic=u=>{const works=u?.worksheets||[];const d=works.find(w=>w.mode==="digital")||works[0];return cleanTopic(d?.title||u?.topic||u?.unit_topic||"หน่วยทดสอบ")};
function uniq(items){return [...new Set((items||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}
function overlay(html){const o=document.createElement('div');o.id='v168-overlay';o.className='v168-overlay';o.innerHTML='<div class="v168-modal">'+html+'</div>';document.body.appendChild(o);return o;}
'''

def luminance(rgb):
    vals=[]
    for v in rgb:
        c=v/255
        vals.append(c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4)
    return 0.2126*vals[0]+0.7152*vals[1]+0.0722*vals[2]
def ratio(fg,bg):
    a,b=luminance(fg),luminance(bg)
    hi,lo=max(a,b),min(a,b)
    return (hi+0.05)/(lo+0.05)
def parse_rgb(s):
    m=re.search(r'rgba?\((\d+),\s*(\d+),\s*(\d+)',s)
    if not m: raise AssertionError('not rgb: '+s)
    return tuple(map(int,m.groups()))

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    viewports=[(1920,1080),(1366,768),(1024,768),(768,1024),(390,844),(844,390)]
    for w,h in viewports:
        page=browser.new_page(viewport={'width':w,'height':h}); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(f'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{base_css}</style></head><body></body></html>')
        page.add_script_tag(content=pre+knowledge+'\n'+chunk+'''\nwindow.__v20make=()=>{const subject={code:'20001-1001',name:'สุขภาพความปลอดภัยและสิ่งแวดล้อม'};const unit={unit_no:1,unlocked:true,open_at:new Date().toISOString(),due_at:new Date(Date.now()+7200000).toISOString(),worksheets:[{mode:'digital',reference_code:'NR-200011001-D01',title:'ใบงานอิเล็กทรอนิกส์ 1: อาชีวอนามัยและความปลอดภัยในการทำงาน',learning_goal:'อธิบายความหมาย ความสำคัญ บทบาทของผู้เกี่ยวข้อง และหลักการป้องกันอุบัติเหตุ/การเจ็บป่วยจากการทำงานได้',key_concepts:['อาชีวอนามัยและความปลอดภัยในการทำงาน','อันตรายและปัจจัยเสี่ยง','มาตรการควบคุม','การปฏิบัติอย่างปลอดภัย','การตรวจติดตาม'],practice_steps:['สำรวจอันตราย','ประเมินผลกระทบ','เลือกมาตรการควบคุม','ปฏิบัติและสื่อสาร','ติดตามผลและปรับปรุง'],control_points:['ตรวจข้อมูลและเงื่อนไขก่อนเริ่ม','ปฏิบัติตามลำดับขั้น','ตรวจข้อผิดพลาดระหว่างทำ','ตรวจผลลัพธ์เทียบเกณฑ์','บันทึกและสรุปสิ่งที่ต้องปรับปรุง'],case_study:'พื้นที่ฝึกงานพบสายไฟพาดทางเดินและมีน้ำใกล้จุดต่อไฟ ผู้เรียนต้องหยุดงาน ระบุอันตราย ประเมินความเสี่ยง และเลือกมาตรการก่อนเริ่มงาน',exit_questions:['อันตรายต่างจากความเสี่ยงอย่างไร','เหตุใดควรควบคุมที่ต้นเหตุก่อน PPE','จะยืนยันได้อย่างไรว่ามาตรการควบคุมได้ผล']},{mode:'paper',reference_code:'NR-200011001-P01',title:'ใบงานพิมพ์ 1: อาชีวอนามัยและความปลอดภัยในการทำงาน'}]};const slides=deckSlides(subject,unit,{admin:true});const o=slideOverlay(subject,unit,{admin:true});return {count:slides.length,id:o.id};};''')
        r=page.evaluate('window.__v20make()')
        assert r['count']==20 and page.locator('.v174-slide').count()==20
        # User-reported contrast bug: active slide text and all three detail callouts must meet normal-text AA contrast.
        sels=['.v174-slide.active .v174-slide-body p','.v174-slide.active .v199-slide-explain','.v174-slide.active .v199-slide-example','.v174-slide.active .v199-slide-note']
        for sel in sels:
            if page.locator(sel).count()==0: continue
            c=page.locator(sel).first.evaluate("e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})")
            # Callout background is opaque by V20 contract.
            cr=ratio(parse_rgb(c['fg']),parse_rgb(c['bg']))
            assert cr>=4.5,(w,h,sel,c,cr)
        # Presentation class must turn the modal into viewport-sized presentation without horizontal overflow.
        page.evaluate("document.querySelector('#v168-overlay').classList.add('v20-slide-present')")
        dims=page.evaluate("()=>{const o=document.querySelector('#v168-overlay');const m=o.querySelector('.v168-modal');const s=o.querySelector('.v174-slide.active');return {vw:innerWidth,cw:document.documentElement.clientWidth,vh:innerHeight,bw:document.body.scrollWidth,ow:o.getBoundingClientRect().width,mw:m.getBoundingClientRect().width,mh:m.getBoundingClientRect().height,sh:s.getBoundingClientRect().height}}")
        assert dims['bw']<=dims['cw']+4,(w,h,dims)
        assert dims['ow']>=dims['vw']-24 and dims['mw']>=dims['vw']-24,(w,h,dims)
        assert dims['mh']>=dims['vh']-4 and dims['sh']>0,(w,h,dims)
        # Dark mode contrast should also remain readable.
        page.evaluate("document.documentElement.dataset.theme='dark'")
        c=page.locator('.v174-slide.active .v174-slide-body p').first.evaluate("e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})")
        assert ratio(parse_rgb(c['fg']),parse_rgb(c['bg']))>=4.5,(w,h,c)
        assert not errs,errs
        page.close()

    # Reversible sequential teaching UI: only latest opened unit gets Close Teaching.
    page=browser.new_page(viewport={'width':1366,'height':768}); page.set_content('<div id="x"></div>')
    astart=flow.index('function adminUnitCard('); aend=flow.index('\nasync function injectAdminPlan(',astart); achunk=flow[astart:aend]
    page.add_script_tag(content='''const esc=v=>String(v??''); const fmt=v=>String(v||'-'); const unitTopic=u=>(u.worksheets?.[0]?.title||'หน่วย');'''+achunk+'''\nwindow.__cards=()=>{const mk=(n,open)=>({unit_no:n,unlocked:open,worksheets:[{mode:'digital',title:'หน่วย '+n,reference_code:'D'+n,open_at:'2026-09-22T01:00:00Z',due_at:'2026-09-22T03:00:00Z'},{mode:'paper',title:'หน่วย '+n,reference_code:'P'+n}],resources:[]});document.querySelector('#x').innerHTML=[mk(1,true),mk(2,true),mk(3,false)].map(u=>adminUnitCard(u,'s1',3,2)).join('');};''')
    page.evaluate('window.__cards()')
    assert page.locator('[data-v20-lock="s1:2"]').count()==1
    assert page.locator('[data-v20-lock="s1:1"]').count()==0
    assert page.locator('[data-v168-unlock="s1:3"]').count()>=1
    browser.close()
print('V20.0 TEACHING/PRESENTATION/CONTRAST/RESPONSIVE/CLOSE-TEACHING BROWSER CONTRACT PASS')
print('1920x1080 / 1366x768 / 1024x768 / 768x1024 / 390x844 / 844x390 PASS')
