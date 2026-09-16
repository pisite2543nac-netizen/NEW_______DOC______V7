import { getClient } from "./v18-supabase.js";

const DOCNR_HARDENING_VERSION = "V18-RUNTIME-HARDENED";
const SUPABASE_URL = "https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF = "thjscmfqunlaqxlievna";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt = d => d ? new Date(d).toLocaleString("th-TH", {dateStyle:"medium", timeStyle:"short"}) : "ไม่กำหนด";

function readSession(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    return s?.access_token && s?.user?.id ? s : null;
  }catch{return null}
}
function client(){return getClient()}
function flash(message, bad=false){
  let e = $("#v167-flash");
  if(!e){ e=document.createElement("div"); e.id="v167-flash"; document.body.appendChild(e); }
  e.textContent = message;
  e.className = `v167-flash show${bad?" bad":""}`;
  clearTimeout(flash.t);
  flash.t = setTimeout(()=>e.className="v167-flash", 4200);
}

function decodeB64UrlUtf8(value){
  try{
    let s = String(value||"").replace(/-/g,"+").replace(/_/g,"/");
    while(s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return ""}
}
function parsePaperPayload(raw){
  const text = String(raw||"").trim();
  if(!text) return {token:"", title:"", due:null, raw:text, structured:false};
  try{
    if(text.includes("token=")){
      const u = new URL(text, location.href);
      const token = u.searchParams.get("token") || "";
      const title = decodeB64UrlUtf8(u.searchParams.get("n64")||"");
      const d = Number(u.searchParams.get("d")||0);
      return {token, title, due:d>0?new Date(d*1000):null, raw:text, structured:true};
    }
  }catch{}
  return {token:text, title:"", due:null, raw:text, structured:false};
}
function showEmbeddedMeta(parsed){
  const host = $("#v167-embedded-meta");
  if(!host) return;
  if(!parsed?.structured){ host.hidden=true; host.innerHTML=""; return; }
  host.hidden=false;
  host.innerHTML = `<b>ข้อมูลที่ฝังใน Barcode</b><span>${esc(parsed.title||"ไม่ระบุชื่อใบงาน")}</span><small>วันหมดอายุ ${parsed.due?esc(fmt(parsed.due)):"ไม่กำหนด"} • ระบบยืนยันซ้ำกับ Server ก่อนบันทึกทุกครั้ง</small>`;
}

function questionHtml(q, i){
  const prompt = q?.text || q?.prompt || q?.question || `ข้อ ${i+1}`;
  const points = Number(q?.points||0);
  const opts = Array.isArray(q?.choices) ? q.choices : (Array.isArray(q?.options) ? q.options : []);
  const options = opts.length
    ? `<div class="v167-options">${opts.map((o,j)=>`<div>□ ${esc(typeof o==="object"?(o.label||o.text||o.value||String.fromCharCode(65+j)):o)}</div>`).join("")}</div>`
    : `<div class="v167-answer-lines"><i></i><i></i><i></i></div>`;
  return `<section class="v167-question"><div><b>${i+1}. ${esc(prompt)}</b>${points?`<small>${points} คะแนน</small>`:""}</div>${options}</section>`;
}
function printPageHtml(w, st){
  const payload=st.barcode_payload||`?token=${encodeURIComponent(st.token||"")}`,tokenOnly=st.token||"",revoked=!!st.revoked_at;
  const questions=Array.isArray(w.questions)?w.questions:[],pageCount=Math.max(2,Number(w.settings?.page_count||2)),per=Math.max(1,Math.ceil(questions.length/pageCount)),classText=`${st.grade_level||""}${st.room_label||""}`||st.class_name||"-";
  const pages=[];for(let p=0;p<pageCount;p++)pages.push(questions.slice(p*per,(p+1)*per));
  return pages.map((page,pi)=>`<article class="v167-print-page ${revoked?"revoked":""}">
    <header class="v167-print-header"><div><div class="v167-school">วิทยาลัยเทคนิคนางรอง</div><div>DOC-FULL-NR • ใบงานพิมพ์ย้อนหลังฉบับรายบุคคล</div></div><div class="v167-ref">${esc(w.reference_code||"")} • หน้า ${pi+1}/${pageCount}</div></header>
    <div class="v167-student-strip"><div><span>รหัสนักศึกษา</span><b>${esc(st.student_code||"-")}</b></div><div><span>ชื่อ-นามสกุล</span><b>${esc(st.full_name||"-")}</b></div><div><span>ชั้น/ห้อง</span><b>${esc(classText)}</b></div></div>
    <div class="v167-title"><small>${esc(w.subject_code||"")} ${esc(w.subject_name||"")}</small><h1>${esc(w.title||"ใบงาน")}</h1><p>${esc(w.description||"")}</p></div>
    ${pi===0?`<div class="v167-code-block"><div class="v167-barcode-box v167-primary-code"><svg class="v167-barcode" data-payload="${esc(payload)}"></svg><small>Barcode หลัก • ผูกกับผู้เรียนรายนี้</small></div><div class="v167-code-fallback"><svg class="v167-token-barcode" data-payload="${esc(tokenOnly)}"></svg><small>Barcode สำรอง • Token เท่านั้น</small></div><div class="v167-qr" data-payload="${esc(payload)}"></div><div class="v167-deadline"><span>Barcode หมดอายุ</span><b>${esc(fmt(st.expires_at||w.due_at))}</b><small>สำหรับส่งย้อนหลัง • คะแนนสูงสุดตามเกณฑ์งานย้อนหลัง</small></div></div>`:`<div class="v167-instructions"><b>ใบงานต่อเนื่อง</b><div>${esc(w.reference_code||"")} • ${esc(st.student_code||"")} • หน้า ${pi+1}/${pageCount}</div></div>`}
    ${revoked?`<div class="v167-revoked">รหัสฉบับนี้ถูกยกเลิก กรุณาสร้าง/พิมพ์ฉบับใหม่ก่อนแจก</div>`:""}${pi===0&&w.instructions?`<div class="v167-instructions"><b>คำชี้แจง</b><div>${esc(w.instructions)}</div></div>`:""}
    <div class="v167-questions">${page.map((q,j)=>questionHtml(q,pi*per+j)).join("")||`<div class="v167-answer-lines tall"><i></i><i></i><i></i><i></i><i></i></div>`}</div>
    <footer>สำเนารายบุคคล • ส่งย้อนหลัง • ${esc(w.reference_code||"")} • หน้า ${pi+1}/${pageCount}</footer>
  </article>`).join("");
}
async function openPaperPrintPack(wid){
  if(!wid) return;
  flash("กำลังเตรียมชุดใบงานพร้อม Barcode...");
  const c = client();
  const {data,error} = await c.rpc("admin_prepare_paper_print_pack", {p_worksheet_id:wid});
  if(error){ flash(String(error.message||error), true); return; }
  const w = data?.worksheet || {};
  const students = Array.isArray(data?.students) ? data.students : [];
  if(!students.length){ flash("ยังไม่มีนักศึกษาที่ได้รับมอบหมายใบงานนี้", true); return; }

  $("#v167-print-overlay")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "v167-print-overlay";
  wrap.innerHTML = `<div class="v167-print-toolbar no-print">
      <div><b>พิมพ์ใบงานรายบุคคลพร้อม Barcode</b><small>${esc(w.reference_code||"")} • ${students.length} คน • ${esc(w.title||"")}</small></div>
      <div><button class="btn" id="v167-print-close">ปิด</button><button class="btn primary" id="v167-print-now">พิมพ์ / Save PDF</button></div>
    </div>
    <main class="v167-print-pages">${students.map(s=>printPageHtml(w,s)).join("")}</main>`;
  document.body.appendChild(wrap);

  $$(".v167-barcode",wrap).forEach(svg=>{
    const payload = svg.dataset.payload||"";
    try{
      if(window.JsBarcode) window.JsBarcode(svg,payload,{format:"CODE128",width:1,height:58,displayValue:false,margin:0});
      else svg.outerHTML=`<code>${esc(payload)}</code>`;
    }catch{ svg.outerHTML=`<code>${esc(payload)}</code>`; }
  });
  $$(".v167-token-barcode",wrap).forEach(svg=>{
    const payload = svg.dataset.payload||"";
    try{
      if(window.JsBarcode) window.JsBarcode(svg,payload,{format:"CODE128",width:1.25,height:42,displayValue:false,margin:0});
    }catch{}
  });
  $$(".v167-qr",wrap).forEach(div=>{
    try{
      if(window.QRCode) new window.QRCode(div,{text:div.dataset.payload||"",width:82,height:82,correctLevel:window.QRCode.CorrectLevel?.M});
    }catch{}
  });
  $("#v167-print-close",wrap).onclick=()=>wrap.remove();
  $("#v167-print-now",wrap).onclick=()=>window.print();
}

function injectPaperPrintButtons(){
  $$(".v14-ws-section").forEach(section=>{
    if(!section.querySelector('[data-v14-select-mode="paper"]')) return;
    $$(".v14-bundle",section).forEach(card=>{
      if(card.querySelector("[data-v167-print-pack]")) return;
      const box = card.querySelector("[data-v14-wselect]");
      const actions = card.querySelector(".v14-actions");
      if(!box?.value || !actions) return;
      const b=document.createElement("button");
      b.type="button";
      b.className="btn sm";
      b.dataset.v167PrintPack=box.value;
      b.textContent="🖨️ พิมพ์รายบุคคล + Barcode";
      actions.appendChild(b);
    });
  });
  $$('[data-token]').forEach(base=>{
    if(base.parentElement?.querySelector("[data-v167-print-pack]")) return;
    const b=document.createElement("button");
    b.type="button";
    b.className="btn sm";
    b.dataset.v167PrintPack=base.dataset.token;
    b.textContent="พิมพ์ชุด Barcode";
    base.insertAdjacentElement("afterend",b);
  });
}

let qrLoopToken = 0;
function stopPaperFallbackScanner(){ qrLoopToken++; }
function startPaperFallbackScanner(){
  if("BarcodeDetector" in window || !window.jsQR) return;
  const my = ++qrLoopToken;
  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  let last="",lastAt=0;
  const tick=()=>{
    if(my!==qrLoopToken) return;
    const video=$("#v16-paper-video");
    if(!video?.srcObject || !video.videoWidth || !document.body.contains(video)){
      requestAnimationFrame(tick);
      return;
    }
    try{
      const max=960, scale=Math.min(1,max/video.videoWidth);
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const img=ctx.getImageData(0,0,canvas.width,canvas.height);
      const raw=window.jsQR(img.data,img.width,img.height,{inversionAttempts:"attemptBoth"})?.data||"";
      const now=Date.now();
      if(raw && (raw!==last || now-lastAt>3000)){
        last=raw; lastAt=now;
        const parsed=parsePaperPayload(raw);
        showEmbeddedMeta(parsed);
        const input=$("#v16-token");
        if(parsed.token && input){
          input.value=parsed.token;
          $("#v16-token-form")?.requestSubmit();
        }
      }
    }catch{}
    setTimeout(()=>requestAnimationFrame(tick),350);
  };
  tick();
}
function injectPaperScanHardening(){
  const page=$(".v16-scan-page");
  if(!page || page.dataset.v167Ready) return;
  page.dataset.v167Ready="1";
  const head=page.querySelector(".v14-section-head");
  if(head){
    const banner=document.createElement("div");
    banner.className="v167-scan-banner";
    banner.innerHTML=`<b>โหมดสำเนาทั้งแผ่น</b><span>วางกระดาษให้เห็นครบ 4 มุม • Barcode เป็นจุดยืนยันหลัก • ระบบตรวจชื่อใบงานและวันหมดอายุซ้ำจาก Server ก่อนรับภาพ</span>`;
    head.insertAdjacentElement("afterend",banner);
  }
  const guide=page.querySelector(".v16-paper-guide");
  if(guide && !guide.querySelector(".v167-corner-grid")){
    guide.insertAdjacentHTML("beforeend",`<div class="v167-corner-grid"><i></i><i></i><i></i><i></i></div>`);
  }
  const form=$("#v16-token-form");
  if(form && !$("#v167-embedded-meta")){
    const meta=document.createElement("div");
    meta.id="v167-embedded-meta";
    meta.className="v167-embedded-meta";
    meta.hidden=true;
    form.insertAdjacentElement("afterend",meta);
  }
  $("#v16-camera-start")?.addEventListener("click",()=>setTimeout(startPaperFallbackScanner,500));
  $("#v16-camera-stop")?.addEventListener("click",stopPaperFallbackScanner);
}

function injectProfileReadonly(){
  const card=$(".profile-readonly");
  if(!card || card.dataset.v167Locked) return;
  card.dataset.v167Locked="1";
  const head=card.querySelector(".section-head");
  if(head){
    const badge=document.createElement("div");
    badge.className="v167-readonly-badge";
    badge.textContent="🔒 ข้อมูลนักศึกษา: ดูได้อย่างเดียว";
    head.appendChild(badge);
  }
  $$('button,input[type="submit"]',card).forEach(el=>{
    const text=String(el.textContent||el.value||"");
    if(/แก้ไขโปรไฟล์|บันทึกโปรไฟล์|บันทึกข้อมูลส่วนตัว/.test(text)) el.remove();
  });
}

function showHealthDialog(data){
  $("#v167-health-overlay")?.remove();
  const ok=!!data?.backend_ok;
  const overlay=document.createElement("div");
  overlay.id="v167-health-overlay";
  overlay.className="v167-health-overlay";
  overlay.innerHTML=`<div class="v167-health-card">
    <div class="v167-health-head"><div><b>🩺 Runtime Health • ${esc(data?.version||DOCNR_HARDENING_VERSION)}</b><small>ตรวจจาก Supabase Production ณ ${esc(fmt(data?.server_time))}</small></div><button class="btn sm" id="v167-health-close">✕</button></div>
    <div class="v167-health-state ${ok?"ok":"bad"}">${ok?"ระบบ Backend หลักพร้อมใช้งาน":"พบจุดที่ต้องตรวจเพิ่ม"}</div>
    <div class="v167-health-grid">
      <div><span>Template มาตรฐาน</span><b>${Number(data?.standard_templates||0)}</b><small>Paper ${Number(data?.paper_templates||0)} / Digital ${Number(data?.digital_templates||0)}</small></div>
      <div><span>รายวิชาหลัก</span><b>${Number(data?.active_subjects||0)}</b><small>Join Code ${Number(data?.active_join_codes||0)}</small></div>
      <div><span>Paper Token</span><b>${Number(data?.paper_tokens||0)}</b><small>สำเนาที่เก็บ ${Number(data?.paper_scans||0)}</small></div>
      <div><span>RPC สำคัญ</span><b>${data?.required_functions_ok?"PASS":"FAIL"}</b><small>Profile Lock ${data?.student_profile_update_locked?"PASS":"FAIL"}</small></div>
      <div><span>Private Storage</span><b>${data?.private_storage_ok?"PASS":"FAIL"}</b><small>ไฟล์สำคัญไม่เปิด Public</small></div>
    </div>
    <div class="v167-health-note">ปุ่มนี้ตรวจ Backend/Schema ที่จำเป็นสำหรับรอบงานปัจจุบัน ไม่แทนการทดสอบกล้องจริงบนแต่ละอุปกรณ์</div>
  </div>`;
  document.body.appendChild(overlay);
  $("#v167-health-close",overlay).onclick=()=>overlay.remove();
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove()});
}
async function runRuntimeHealth(){
  flash("กำลังตรวจระบบ Production...");
  const {data,error}=await client().rpc("admin_runtime_health_v167");
  if(error){ flash(String(error.message||error),true); return; }
  showHealthDialog(data||{});
}
let healthProbeBusy=false;
async function injectHealthButton(){
  if(healthProbeBusy || $("#v167-health-button") || !readSession()) return;
  const bar=$(".topbar .row:last-child");
  if(!bar) return;
  healthProbeBusy=true;
  try{
    const {data}=await client().from("profiles").select("role").eq("id",readSession().user.id).maybeSingle();
    if(data?.role==="admin" && !$("#v167-health-button")){
      const b=document.createElement("button");
      b.type="button"; b.id="v167-health-button"; b.className="btn sm"; b.textContent="🩺 ตรวจระบบ";
      b.onclick=runRuntimeHealth;
      bar.insertBefore(b,bar.firstChild);
    }
  }catch{} finally{healthProbeBusy=false}
}

function installConnectivityGuard(){
  if($("#v167-network")) return;
  const bar=document.createElement("div");
  bar.id="v167-network";
  bar.className="v167-network";
  bar.hidden=true;
  document.body.appendChild(bar);
  const paint=()=>{
    bar.hidden=navigator.onLine;
    bar.textContent=navigator.onLine?"":"ออฟไลน์ • ระบบจะยังไม่ส่งข้อมูลจนกว่าจะเชื่อมต่ออินเทอร์เน็ต";
  };
  addEventListener("online",()=>{paint();flash("กลับมาออนไลน์แล้ว")});
  addEventListener("offline",()=>{paint();flash("อินเทอร์เน็ตขาดการเชื่อมต่อ",true)});
  paint();
}
function installServiceWorkerRefresh(){
  if(!("serviceWorker" in navigator)) return;
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(refreshing) return;
    refreshing=true;
    const key="docnr-v167-controller-reload";
    if(sessionStorage.getItem(key)!==DOCNR_HARDENING_VERSION){
      sessionStorage.setItem(key,DOCNR_HARDENING_VERSION);
      location.reload();
    }
  });
}
function installUnhandledErrorGuard(){
  addEventListener("unhandledrejection",e=>{
    console.error("[DOC-FULL-NR] unhandled rejection",e.reason);
    const msg=String(e.reason?.message||"");
    if(msg && !/AbortError|ResizeObserver/.test(msg)) flash(`ระบบพบข้อผิดพลาด: ${msg.slice(0,180)}`,true);
  });
}

document.addEventListener("submit",e=>{
  if(e.target?.id!=="v16-token-form") return;
  const input=$("#v16-token");
  if(!input) return;
  const parsed=parsePaperPayload(input.value);
  showEmbeddedMeta(parsed);
  if(parsed.structured && parsed.token) input.value=parsed.token;
},true);

document.addEventListener("click",e=>{
  const b=e.target.closest?.("[data-v167-print-pack]");
  if(b){
    e.preventDefault();
    e.stopPropagation();
    openPaperPrintPack(b.dataset.v167PrintPack);
  }
},true);

const observer=new MutationObserver(()=>{
  injectPaperPrintButtons();
  injectPaperScanHardening();
  injectProfileReadonly();
});
observer.observe(document.documentElement,{childList:true,subtree:true});

installConnectivityGuard();
installServiceWorkerRefresh();
installUnhandledErrorGuard();
injectPaperPrintButtons();
injectPaperScanHardening();
injectProfileReadonly();
// V16.10: health is surfaced in the unified Dashboard; do not add a redundant topbar button.

window.DOCNR_HARDENING = Object.freeze({
  version:DOCNR_HARDENING_VERSION,
  parsePaperPayload,
  openPaperPrintPack,
  runRuntimeHealth
});
console.info(`[DOC-FULL-NR] ${DOCNR_HARDENING_VERSION} loaded`);