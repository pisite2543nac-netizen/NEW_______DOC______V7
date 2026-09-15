import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const RELEASE = "V16.8-COURSE-SEQUENTIAL-UNITS";
const SUPABASE_URL = "https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF = "thjscmfqunlaqxlievna";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt = d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const localInput = d=>{
  const x=d?new Date(d):new Date();
  return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16);
};

const state={
  coursePath:new Map(),
  loadingStudent:new Set(),
  loadingAdmin:new Set(),
  role:null,
  uid:null
};

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const s=JSON.parse(raw);
    return s?.access_token&&s?.user?.id?s:null;
  }catch{return null}
}
function client(){
  const s=readSession();
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}
  });
}
function flash(message,bad=false){
  let e=$("#v168-flash");
  if(!e){e=document.createElement("div");e.id="v168-flash";document.body.appendChild(e)}
  e.textContent=message;
  e.className=`v168-flash show${bad?" bad":""}`;
  clearTimeout(flash.t);
  flash.t=setTimeout(()=>e.className="v168-flash",4200);
}
function errText(err){
  const raw=String(err?.message||err?.details||err||"เกิดข้อผิดพลาด");
  const map={
    PREVIOUS_UNIT_LOCKED:"ต้องเปิดหน่วยก่อนหน้าให้ครบก่อน",
    ONE_UNIT_AT_A_TIME_REQUIRED:"ระบบอนุญาตให้เปิดทีละ 1 หน่วยเท่านั้น",
    STANDARD_TEMPLATE_MIX_NOT_ALLOWED:"กรุณาเปิดเฉพาะใบงานสำเร็จรูปของหน่วยเดียวกัน",
    INVALID_SCHEDULE:"วันหมดเขตต้องอยู่หลังเวลาเปิด",
    UNIT_NOT_FOUND:"ไม่พบหน่วยเรียนนี้",
    ADMIN_REQUIRED:"ต้องใช้บัญชี Admin",
    STUDENT_NOT_APPROVED_FOR_SUBJECT:"ยังไม่ได้เข้าร่วมรายวิชานี้ด้วย CODE",
    JOIN_CODE_INVALID:"CODE รายวิชาไม่ถูกต้อง"
  };
  for(const [k,v] of Object.entries(map))if(raw.includes(k))return v;
  return raw;
}
async function role(){
  const s=readSession();if(!s)return null;
  if(state.role&&state.uid===s.user.id)return state.role;
  const {data}=await client().from("profiles").select("role").eq("id",s.user.id).maybeSingle();
  state.uid=s.user.id;state.role=data?.role||null;return state.role;
}
function subjectIdFromPage(){
  return $("[data-v16-gradebook]")?.dataset.v16Gradebook
    || $("[data-v16-paper-scan]")?.dataset.v16PaperScan
    || $("[data-v15-room-exam]")?.dataset.v15RoomExam
    || null;
}

function decorateNav(){
  const enroll=$("#sidebar [data-v14-route='enroll']");
  if(enroll){
    const label=enroll.querySelector(".nav-card-label");
    if(label)label.textContent="รายวิชาทั้งหมด";
    enroll.title="ดูรายวิชาทั้งหมดและใส่ CODE เพื่อเข้าเรียน";
  }
  const courses=$("#sidebar [data-v14-route='courses']");
  if(courses){
    const label=courses.querySelector(".nav-card-label");
    if(label&&label.textContent!=="วิชาที่เรียนอยู่")label.textContent="วิชาที่เรียนอยู่";
  }
}

function decorateCatalog(){
  const page=$(".v165-enrollment-home");
  if(!page||page.dataset.v168Catalog)return;
  page.dataset.v168Catalog="1";
  const h=page.querySelector("h1");if(h)h.textContent="รายวิชาเรียนทั้งหมด";
  const p=page.querySelector(".v165-course-home-head p");
  if(p)p.textContent="เลือกรายวิชา → รับ CODE จาก Admin/ครูผู้สอน → กรอก CODE → เข้าเรียนทันที";
  $$("[data-v165-join-course]",page).forEach(b=>b.textContent="เลือกวิชา / ใส่ CODE");
  const help=page.querySelector(".v165-enroll-help");
  if(help)help.innerHTML=`<span>🔐</span><div><b>CODE จาก Admin คือสิทธิ์เข้าเรียนรายวิชา</b><p>เมื่อ CODE ถูกต้อง ระบบจะอนุมัติสมาชิกวิชาทันที แต่ใบงานและสไลด์แต่ละหน่วยยังถูกล็อกไว้ จนกว่า Admin จะกด “เริ่มสอน / ปลดล็อกหน่วย”</p></div>`;
}

function worksheetLine(w){
  const icon=w.mode==="paper"?"🖨️":"💻";
  const type=w.mode==="paper"?"ใบงานปริ้น":"ใบงานอิเล็กทรอนิกส์";
  const stateText=w.unlocked?"เปิดแล้ว":"ล็อก";
  return `<div class="v168-work-row ${w.unlocked?"open":"locked"}">
    <div><span class="v168-mode">${icon} ${type}</span><b>${esc(w.reference_code||"")} • ${esc(w.title||"")}</b></div>
    <div>${w.unlocked?`<button class="btn sm primary" data-v14-open-work="${esc(w.id)}">เปิดใบงาน</button>`:`<span class="v168-lock-pill">🔒 ${stateText}</span>`}</div>
  </div>`;
}
function unitCard(unit,sid){
  const works=unit.worksheets||[];
  const resources=unit.resources||[];
  return `<article class="v168-unit-card ${unit.unlocked?"unlocked":"locked"}">
    <div class="v168-unit-head">
      <div><span class="v168-unit-no">หน่วย ${Number(unit.unit_no||0)}</span><b>${unit.unlocked?"พร้อมเรียน":"ยังไม่เปิดสอน"}</b></div>
      <span class="v168-unit-state">${unit.unlocked?"✅ ปลดล็อกแล้ว":"🔒 ล็อก"}</span>
    </div>
    <div class="v168-work-list">${works.map(worksheetLine).join("")}</div>
    ${unit.unlocked?`<div class="v168-unit-materials">
      <div><b>📊 สไลด์ / สื่อประกอบการสอน</b><small>เปิดได้เมื่อหน่วยนี้ถูกปลดล็อกแล้วเท่านั้น</small></div>
      <div class="v168-resource-buttons">
        <button class="btn sm" data-v168-summary-slide="${sid}:${unit.unit_no}">▶ สไลด์สรุปหน่วย (Built-in)</button>
        ${resources.map(r=>`<button class="btn sm" data-v168-resource="${esc(r.storage_path)}">📎 ${esc(r.original_name||"สื่อประกอบ")}</button>`).join("")}
      </div>
      <div class="v168-time">เปิด ${fmt(unit.open_at)} • ส่งภายใน ${fmt(unit.due_at)}</div>
    </div>`:`<div class="v168-locked-note">ครูยังไม่เริ่มสอนหน่วยนี้ • ไม่สามารถเปิดใบงานหรือสไลด์ล่วงหน้า</div>`}
  </article>`;
}
async function injectStudentPath(){
  const page=$(".v14-page");
  if(!page||page.querySelector(".v15-room-roster")||!page.querySelector(".v15-room-hero"))return;
  const sid=subjectIdFromPage();if(!sid||page.dataset.v168StudentPath===sid||state.loadingStudent.has(sid))return;
  const r=await role();if(r==="admin")return;
  state.loadingStudent.add(sid);
  try{
    const {data,error}=await client().rpc("my_subject_learning_path",{p_subject_id:sid});
    if(error)throw error;
    state.coursePath.set(sid,data);
    page.dataset.v168StudentPath=sid;
    $(".v168-learning-path",page)?.remove();
    const units=data?.units||[],opened=units.filter(x=>x.unlocked).length;
    const hero=page.querySelector(".v15-room-hero");
    const section=document.createElement("section");
    section.className="v168-learning-path";
    section.innerHTML=`<div class="v168-path-head">
      <div><span class="v14-kicker">LEARNING PATH</span><h2>เส้นทางการเรียน • ปลดล็อกทีละหน่วย</h2><p>ใบงานปริ้น ใบงานอิเล็กทรอนิกส์ และสไลด์ถูกจัดไว้ครบตามหน่วย แต่จะเปิดใช้งานเมื่อครูเริ่มสอนเท่านั้น</p></div>
      <div class="v168-path-count"><b>${opened}/${units.length}</b><span>หน่วยที่เปิดแล้ว</span></div>
    </div>
    <div class="v168-unit-grid">${units.map(u=>unitCard(u,sid)).join("")}</div>`;
    hero.insertAdjacentElement("afterend",section);
  }catch(e){
    if(String(e?.message||"").includes("STUDENT_NOT_APPROVED_FOR_SUBJECT"))return;
    flash(errText(e),true);
  }finally{state.loadingStudent.delete(sid)}
}

function adminUnitCard(unit,sid,nextUnit){
  const works=unit.worksheets||[];
  const resourceCount=works.reduce((n,w)=>n+Number(w.resource_count||0),0);
  const action=unit.unlocked
    ? `<button class="btn sm" disabled>✅ เปิดแล้ว</button>`
    : Number(unit.unit_no)===Number(nextUnit)
      ? `<button class="btn sm primary" data-v168-unlock="${sid}:${unit.unit_no}">▶ เริ่มสอน / ปลดล็อก</button>`
      : `<button class="btn sm" disabled>🔒 รอหน่วยก่อนหน้า</button>`;
  return `<article class="v168-admin-unit ${unit.unlocked?"unlocked":"locked"}">
    <div class="v168-admin-unit-top"><div><span>หน่วย ${unit.unit_no}</span><b>${unit.unlocked?"เปิดสอนแล้ว":"ยังไม่เปิด"}</b></div>${action}</div>
    <div class="v168-admin-workchips">${works.map(w=>`<span>${w.mode==="paper"?"🖨️":"💻"} ${esc(w.reference_code||"")}</span>`).join("")}</div>
    <small>${works.length} ใบงาน • ไฟล์สื่อ ${resourceCount} • ${unit.unlocked?`ส่ง ${fmt(unit.due_at)}`:"นักศึกษายังเปิดไม่ได้"}</small>
  </article>`;
}
async function injectAdminPlan(force=false){
  const page=$(".v14-page");
  if(!page||!page.querySelector(".v15-room-roster")||!page.querySelector(".v15-room-hero"))return;
  const sid=subjectIdFromPage();if(!sid||state.loadingAdmin.has(sid))return;
  if(!force&&page.dataset.v168AdminPlan===sid)return;
  const r=await role();if(r!=="admin")return;
  state.loadingAdmin.add(sid);
  try{
    const {data,error}=await client().rpc("admin_subject_unit_plan",{p_subject_id:sid});
    if(error)throw error;
    const units=data?.units||[];
    const next=units.find(x=>!x.unlocked)?.unit_no??null;
    page.dataset.v168AdminPlan=sid;
    page.classList.add("v168-sequential-mode");
    $(".v168-admin-plan",page)?.remove();
    const anchor=page.querySelector(".v165-room-code")||page.querySelector(".v15-room-hero");
    const section=document.createElement("section");
    section.className="card v168-admin-plan";
    section.innerHTML=`<div class="v168-admin-plan-head">
      <div><span class="v14-kicker">SEQUENTIAL TEACHING</span><h2>🎯 ปลดล็อกการสอนทีละหน่วย</h2><p>เมื่อกดเริ่มสอน ระบบจะเปิดทั้งใบงานอิเล็กทรอนิกส์ + ใบงานปริ้นของเลขหน่วยเดียวกัน และมอบหมายให้นักศึกษาที่เข้าเรียนด้วย CODE โดยอัตโนมัติ</p></div>
      <div class="v168-next-actions"><div class="v168-next-unit">${next?`หน่วยถัดไป <b>${next}</b>`:"<b>เปิดครบแล้ว</b>"}</div><button class="btn sm" data-v168-flow-health>🩺 ตรวจ Flow</button></div>
    </div>
    <div class="v168-admin-unit-grid">${units.map(u=>adminUnitCard(u,sid,next)).join("")}</div>
    <div class="v168-sequence-rule">🔒 Server บังคับลำดับจริง: เปิดหน่วยถัดไปไม่ได้จนกว่าหน่วยก่อนหน้าจะถูกเปิดครบ</div>`;
    anchor.insertAdjacentElement("afterend",section);
    const release=page.querySelector(".v14-releasebar");
    if(release){
      release.classList.add("v168-legacy-release");
      const b=release.querySelector("#v14-bulk-release");if(b)b.hidden=true;
      const text=release.querySelector(".muted");if(text)text.textContent="ใช้แผง “ปลดล็อกการสอนทีละหน่วย” ด้านบนแทน เพื่อป้องกันเปิดงานล่วงหน้า";
    }
  }catch(e){flash(errText(e),true)}
  finally{state.loadingAdmin.delete(sid)}
}

function overlay(html){
  $("#v168-overlay")?.remove();
  const o=document.createElement("div");
  o.id="v168-overlay";o.className="v168-overlay";o.innerHTML=`<div class="v168-modal">${html}</div>`;
  document.body.appendChild(o);
  $$("[data-v168-close]",o).forEach(b=>b.onclick=()=>o.remove());
  o.addEventListener("click",e=>{if(e.target===o)o.remove()});
  return o;
}
function openUnlockDialog(sid,unitNo){
  const now=new Date(),due=new Date(now.getTime()+7*86400000);
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">START TEACHING</span><h2>เริ่มสอนหน่วย ${unitNo}</h2><p>เปิดใบงานทั้งหมดของหน่วยนี้ให้นักศึกษาที่เข้าเรียนด้วย CODE</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <form id="v168-unlock-form">
      <label class="field"><span>เวลาเปิด</span><input class="input" name="open_at" type="datetime-local" value="${localInput(now)}" required></label>
      <label class="field"><span>กำหนดส่ง</span><input class="input" name="due_at" type="datetime-local" value="${localInput(due)}" required></label>
      <div class="v168-checks"><label><input type="checkbox" name="allow_late"> อนุญาตส่งช้า</label><label><input type="checkbox" name="allow_resubmit"> อนุญาตส่งซ้ำ</label></div>
      <label class="field"><span>จำนวนครั้งส่งสูงสุด</span><input class="input" name="max_attempts" type="number" min="1" max="20" value="1"></label>
      <div class="v168-unlock-warning">เมื่อยืนยัน นักศึกษาสมาชิกวิชาจะเห็นใบงานและสไลด์ของหน่วยนี้ทันที ส่วนหน่วยถัดไปยังคงล็อก</div>
      <div class="row end"><button type="button" class="btn" data-v168-close>ยกเลิก</button><button class="btn primary">▶ ยืนยันเริ่มสอน</button></div>
    </form>`);
  $("#v168-unlock-form",o).onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target),btn=e.submitter;
    const open=new Date(String(f.get("open_at"))),dueAt=new Date(String(f.get("due_at")));
    if(!(dueAt>open)){flash("กำหนดส่งต้องอยู่หลังเวลาเปิด",true);return}
    btn.disabled=true;btn.textContent="กำลังปลดล็อก...";
    const {data,error}=await client().rpc("admin_unlock_subject_unit",{
      p_subject_id:sid,p_unit_no:Number(unitNo),
      p_due_at:dueAt.toISOString(),p_open_at:open.toISOString(),
      p_allow_late:f.get("allow_late")==="on",
      p_allow_resubmit:f.get("allow_resubmit")==="on",
      p_max_attempts:Number(f.get("max_attempts")||1)
    });
    if(error){btn.disabled=false;btn.textContent="▶ ยืนยันเริ่มสอน";flash(errText(error),true);return}
    o.remove();
    flash(`ปลดล็อกหน่วย ${data?.unit_no||unitNo} แล้ว • มอบหมาย ${data?.assignment_count||0} รายการ`);
    const page=$(".v14-page");if(page)delete page.dataset.v168AdminPlan;
    setTimeout(()=>injectAdminPlan(true),350);
  };
}

async function checkCourseFlowHealth(){
  const {data,error}=await client().rpc("admin_course_flow_health_v168");
  if(error){flash(errText(error),true);return}
  const ok=!!data?.course_flow_ok;
  overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">COURSE FLOW HEALTH</span><h2>${ok?"✅ Flow รายวิชาพร้อม":"⚠️ พบจุดที่ต้องตรวจ"}</h2><p>${esc(data?.version||RELEASE)}</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <div class="v168-health-grid">
      <div><span>รายวิชาหลัก</span><b>${Number(data?.active_subjects||0)}</b></div>
      <div><span>CODE ที่ใช้งาน</span><b>${Number(data?.active_join_codes||0)}</b></div>
      <div><span>ใบงานสำเร็จรูป</span><b>${Number(data?.standard_templates||0)}</b></div>
      <div><span>วิชาที่มี 13 หน่วยครบ</span><b>${Number(data?.subjects_with_13_units||0)}</b></div>
      <div><span>RPC สำคัญ</span><b>${Number(data?.required_rpcs||0)}/4</b></div>
      <div><span>ล็อกสื่อก่อนเปิดหน่วย</span><b>${data?.locked_resource_policy_ok?"PASS":"FAIL"}</b></div>
    </div>`);
}

async function openResource(path){
  const {data,error}=await client().storage.from("subject-files").createSignedUrl(path,600);
  if(error||!data?.signedUrl){flash(errText(error||"เปิดไฟล์ไม่ได้"),true);return}
  window.open(data.signedUrl,"_blank","noopener");
}
function openSummarySlides(sid,unitNo){
  const path=state.coursePath.get(sid),unit=(path?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  if(!unit||!unit.unlocked){flash("หน่วยนี้ยังไม่ถูกปลดล็อก",true);return}
  const works=unit.worksheets||[];
  const goals=[...new Set(works.map(w=>w.learning_goal).filter(Boolean))];
  overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">BUILT-IN TEACHING SLIDES</span><h2>${esc(path?.subject?.code||"")} • หน่วย ${unitNo}</h2><p>สไลด์สรุปอัตโนมัติจากชุดบทเรียนสำเร็จรูปของหน่วยนี้</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <div class="v168-slides">
      <section><span>01</span><h3>หัวข้อการเรียน</h3>${works.map(w=>`<p>${w.mode==="paper"?"🖨️":"💻"} ${esc(w.title||"")}</p>`).join("")}</section>
      <section><span>02</span><h3>เป้าหมายการเรียนรู้</h3>${goals.length?goals.map(g=>`<p>• ${esc(g)}</p>`).join(""):`<p>ศึกษาตามหัวข้อและกิจกรรมประจำหน่วย</p>`}</section>
      <section><span>03</span><h3>กิจกรรมในหน่วย</h3><p>ศึกษาสไลด์/สื่อ → ทำใบงานอิเล็กทรอนิกส์ → ทำใบงานปริ้น (ถ้ามี) → ส่งภายในเวลาที่กำหนด</p></section>
      <section><span>04</span><h3>กำหนดเวลา</h3><p>เปิด ${fmt(unit.open_at)}</p><p>กำหนดส่ง ${fmt(unit.due_at)}</p></section>
    </div>`,true);
}

document.addEventListener("click",e=>{
  const unlock=e.target.closest?.("[data-v168-unlock]");
  if(unlock){e.preventDefault();e.stopPropagation();const [sid,u]=unlock.dataset.v168Unlock.split(":");openUnlockDialog(sid,Number(u));return}
  const res=e.target.closest?.("[data-v168-resource]");
  if(res){e.preventDefault();e.stopPropagation();openResource(res.dataset.v168Resource);return}
  const slide=e.target.closest?.("[data-v168-summary-slide]");
  if(slide){e.preventDefault();e.stopPropagation();const [sid,u]=slide.dataset.v168SummarySlide.split(":");openSummarySlides(sid,Number(u));return}
  const health=e.target.closest?.("[data-v168-flow-health]");
  if(health){e.preventDefault();e.stopPropagation();checkCourseFlowHealth();return}
},true);

let pending=false;
function scan(){
  pending=false;
  decorateNav();
  decorateCatalog();
  injectAdminPlan().catch(()=>{});
  injectStudentPath().catch(()=>{});
}
const mo=new MutationObserver(()=>{
  if(pending)return;pending=true;setTimeout(scan,80);
});
mo.observe(document.documentElement,{childList:true,subtree:true});
scan();

window.DOCNR_COURSE_FLOW=Object.freeze({release:RELEASE,refresh:scan});
console.info(`[DOC-FULL-NR] ${RELEASE} loaded`);