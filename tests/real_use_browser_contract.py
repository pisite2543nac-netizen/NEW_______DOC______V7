from pathlib import Path
import os,shutil
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCNR_RUN_BROWSER_CONTRACT')!='1': print('REAL USE BROWSER CONTRACT SKIP: set DOCNR_RUN_BROWSER_CONTRACT=1');raise SystemExit(0)
from playwright.sync_api import sync_playwright
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if not chromium: print('REAL USE BROWSER CONTRACT SKIP: Chromium missing');raise SystemExit(0)
mobile=(ROOT/'site/mobile.js').read_text('utf-8')
html="""<!doctype html><html><body><header class='topbar'><div class='row'><b id='pagetitle'>ทดสอบ</b></div><div class='row'><button id='install'>ติดตั้งแอป</button></div></header><main id='content'><p id='protected'>ข้อความระบบห้ามคัดลอก</p><input id='editable' value='กรอกข้อมูลได้'><span class='v165-room-code-value' id='code'>ABC123</span></main></body></html>"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)));page.set_content(html);page.add_script_tag(content=mobile);page.wait_for_function("window.DOCNR_MOBILE_RUNTIME && window.DOCNR_MOBILE_RUNTIME.release==='V20.0'")
    assert page.locator('#fullscreen').count()==1,'fullscreen button missing'
    blocked=page.evaluate("""()=>{const el=document.querySelector('#protected');const ev=new ClipboardEvent('copy',{bubbles:true,cancelable:true});el.dispatchEvent(ev);return ev.defaultPrevented;}""");assert blocked,'protected text copy event not blocked'
    allowed=page.evaluate("""()=>{const el=document.querySelector('#editable');const ev=new ClipboardEvent('copy',{bubbles:true,cancelable:true});el.dispatchEvent(ev);return !ev.defaultPrevented;}""");assert allowed,'input copy should remain available'
    code_allowed=page.evaluate("""()=>{const el=document.querySelector('#code');const ev=new ClipboardEvent('copy',{bubbles:true,cancelable:true});el.dispatchEvent(ev);return !ev.defaultPrevented;}""");assert code_allowed,'course CODE copy exception missing'
    if errors: raise AssertionError('page errors: '+' | '.join(errors))
    browser.close()
print('REAL USE BROWSER CONTRACT PASS')
