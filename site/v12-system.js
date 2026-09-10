import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const FEATURE_VERSION="V12-ACADEMIC-WORKSTATUS-EXAM-TECH";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const fmtDate=d=>d?new Date(d).toLocaleDateString("th-TH",{dateStyle:"medium"}):"-";

let profileCache=null;
let profileUid=null;
let currentPromotionBatchId=null;
let navTimer=null;

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const x=JSON.parse(raw);
    return x?.access_token&&x?.user?.id?x:null;
  }catch{return null}
}
function uid(){return readSession()?.user?.id||null}
function client(){
  const s=readSession();
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}}
  });
}
async function profile(force=false){
  const id=uid();
  if(!id){profileCache=null;profileUid=null;return null}
  if(!force&&profileCache&&profileUid===id)return profileCache;
  const {data,error}=await client().from("profiles")
    .select("id,role,active,full_name,student_code,class_name,grade_level,room_label,department,major")
    .eq("id",id).maybeSingle();
  if(error)return null;
  profileCache=data||null;profileUid=id;return profileCache;
}
function content(){return $("#content")}
function toast(message,bad=false){
  let el=$("#v12-toast");
  if(!el){
    el=document.createElement("div");
    el.id="v12-toast";
    el.className="v12-toast";
    document.body.appendChild(el);
  }
  el.textContent=message;
  el.className=`v12-toast show${bad?" bad":""}`;
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>{el.className="v12-toast"},3600);
}
function setActive(btn){
  const nav=$("#sidebar .nav");
  if(nav)$$("button",nav).forEach(x=>x.classList.remove("active"));
  btn?.classList.add("active");
}
function busy(message="กำลังโหลด..."){
  if(content())content().innerHTML=`<div class="card v12-loading"><div class="v12-spinner"></div><b>${esc(message)}</b></div>`;
}
function errText(e){
  const raw=String(e?.message||e?.details||e||"เกิดข้อผิดพลาด");
  const map={
    ADMIN_REQUIRED:"ต้องเข้าสู่ระบบด้วยบัญชี Admin",
    BATCH_NOT_DRAFT:"รายการนี้ไม่อยู่ในสถานะรอตรวจ",
    BATCH_MUST_BE_APPROVED_FIRST:"ต้องอนุมัติรายการก่อนเลื่อนชั้นจริง",
    STUDENT_ACADEMIC_DATA_CHANGED_REVIEW_REQUIRED:"ข้อมูลระดับชั้นของนักเรียนมีการเปลี่ยนหลังเตรียมรายการ กรุณายกเลิกรายการเดิมและสร้างรายการใหม่",
    BATCH_NOT_EDITABLE:"รายการนี้อนุมัติแล้ว จึงแก้การตัดสินใจไม่ได้",
    NO_NEXT_LEVEL_FOR_STUDENT:"ระดับชั้นนี้ไม่มีระดับถัดไป กรุณาเลือกคงชั้นหรือจบการศึกษา"
  };
  for(const [k,v] of Object.entries(map))if(raw.includes(k))return v;
  return raw;
}

function newNavButton(key,label){
  const b=document.createElement("button");
  b.type="button";
  b.dataset.v12Route=key;
  b.textContent=label;
  b.className="v12-nav-button";
  return b;
}
async function ensureNav(){
  const nav=$("#sidebar .nav");
  if(!nav)return;
  const p=await profile();
  if(!p)return;

  if(p.role==="admin"&&!nav.querySelector('[data-v12-route="promotion"]')){
    const b=newNavButton("promotion","📈 เลื่อนชั้น / ปีการศึกษา");
    const before=nav.querySelector('[data-route="profile"]');
    before?nav.insertBefore(b,before):nav.appendChild(b);
  }
  if(p.role!=="admin"&&!nav.querySelector('[data-v12-route="workstatus"]')){
    const b=newNavButton("workstatus","📋 ตารางสถานะงาน");
    const before=nav.querySelector('[data-route="profile"]');
    before?nav.insertBefore(b,before):nav.appendChild(b);
  }
  if(!nav.querySelector('[data-v12-route="exam"]')){
    const b=newNavButton("exam","🧪 ระบบสอบ");
    const before=nav.querySelector('[data-route="profile"]');
    before?nav.insertBefore(b,before):nav.appendChild(b);
  }

  const brand=$("#sidebar .brand .smalltext");
  if(brand&&!brand.dataset.v12Version){
    brand.dataset.v12Version="1";
    brand.textContent=(p.role==="admin"?"ADMIN":"USER")+" • V12 TECHNOLOGY";
  }
}
function scheduleEnsureNav(){
  if(navTimer)return;
  navTimer=setTimeout(()=>{navTimer=null;ensureNav().catch(()=>{})},60);
}
const navObserver=new MutationObserver(scheduleEnsureNav);
navObserver.observe(document.body||document.documentElement,{childList:true,subtree:true});
setTimeout(scheduleEnsureNav,250);

function workStatusInfo(w,s){
  const now=Date.now();
  const due=w?.due_at?new Date(w.due_at).getTime():null;
  const open=w?.open_at?new Date(w.open_at).getTime():null;
  if(s&&["submitted","confirmed","graded"].includes(s.status)){
    const late=!!s.is_late||(due&&s.submitted_at&&new Date(s.submitted_at).getTime()>due);
    return late
      ?{key:"late",label:"ส่งแล้ว (ช้า)",cls:"v12-status late"}
      :{key:"sent",label:"ส่งแล้ว",cls:"v12-status sent"};
  }
  if(s?.status==="draft")return {key:"draft",label:"บันทึกร่าง",cls:"v12-status draft"};
  if(open&&open>now)return {key:"upcoming",label:"ยังไม่เปิด",cls:"v12-status upcoming"};
  if(due&&due<now)return {key:"overdue",label:"เกินกำหนด / ยังไม่ส่ง",cls:"v12-status overdue"};
  return {key:"pending",label:"ยังไม่ส่ง",cls:"v12-status pending"};
}
function modeLabel(mode){return mode==="paper"?"กระดาษ":"ดิจิทัล"}

async function loadMyWorkRows(){
  const id=uid();
  if(!id)return [];
  const c=client();
  const {data:assignments,error:aerr}=await c.from("worksheet_assignments")
    .select("worksheet_id,assigned_at").eq("user_id",id).order("assigned_at",{ascending:false});
  if(aerr)throw aerr;
  const ids=[...new Set((assignments||[]).map(x=>x.worksheet_id).filter(Boolean))];
  if(!ids.length)return [];

  const [wr,sr]=await Promise.all([
    c.from("worksheets")
      .select("id,subject_id,title,reference_code,mode,status,open_at,due_at,allow_late,subjects(code,name,color_hex)")
      .in("id",ids),
    c.from("submissions")
      .select("worksheet_id,status,submitted_at,confirmed_at,is_late,last_saved_at,attempt_count")
      .eq("user_id",id).in("worksheet_id",ids)
  ]);
  if(wr.error)throw wr.error;
  if(sr.error)throw sr.error;
  const wsMap=new Map((wr.data||[]).map(x=>[x.id,x]));
  const subMap=new Map();
  for(const s of sr.data||[]){
    const old=subMap.get(s.worksheet_id);
    const oldTime=new Date(old?.last_saved_at||old?.submitted_at||0).getTime();
    const newTime=new Date(s.last_saved_at||s.submitted_at||0).getTime();
    if(!old||newTime>=oldTime)subMap.set(s.worksheet_id,s);
  }
  return (assignments||[]).map(a=>{
    const w=wsMap.get(a.worksheet_id);
    if(!w)return null;
    const submission=subMap.get(w.id)||null;
    return {assignment:a,worksheet:w,submission,status:workStatusInfo(w,submission)};
  }).filter(Boolean).sort((a,b)=>{
    const ad=a.worksheet.due_at?new Date(a.worksheet.due_at).getTime():Number.MAX_SAFE_INTEGER;
    const bd=b.worksheet.due_at?new Date(b.worksheet.due_at).getTime():Number.MAX_SAFE_INTEGER;
    return ad-bd;
  });
}

async function renderWorkStatus(){
  const p=await profile();
  if(!p||p.role==="admin")return;
  if(!content())return;
  busy("กำลังตรวจสถานะการส่งงานของคุณ...");
  try{
    const rows=await loadMyWorkRows();
    const counts={sent:0,late:0,draft:0,pending:0,upcoming:0,overdue:0};
    rows.forEach(r=>counts[r.status.key]=(counts[r.status.key]||0)+1);
    const sent=counts.sent+counts.late;
    const need=counts.pending+counts.draft+counts.overdue;
    const subjectKeys=[...new Map(rows.map(r=>[
      r.worksheet.subject_id,
      {id:r.worksheet.subject_id,code:r.worksheet.subjects?.code||"",name:r.worksheet.subjects?.name||""}
    ])).values()];

    content().innerHTML=`<section class="v12-page">
      <div class="v12-hero">
        <div><span class="v12-kicker">STUDENT WORK CONTROL</span><h1>ตารางสถานะงานของฉัน</h1>
          <p>${esc(p.full_name||"")} • ${esc(p.grade_level||"-")}${esc(p.room_label||"")}</p></div>
        <div class="v12-live"><i></i> เชื่อมต่อข้อมูลจริง</div>
      </div>

      <div class="v12-kpi-grid">
        <div class="v12-kpi"><span>งานทั้งหมด</span><b>${rows.length}</b><small>รายการที่ได้รับมอบหมาย</small></div>
        <div class="v12-kpi good"><span>ส่งแล้ว</span><b>${sent}</b><small>รวมงานที่ส่งช้า</small></div>
        <div class="v12-kpi warn"><span>ต้องดำเนินการ</span><b>${need}</b><small>ยังไม่ส่ง / ร่าง / เกินกำหนด</small></div>
        <div class="v12-kpi danger"><span>เกินกำหนด</span><b>${counts.overdue}</b><small>ยังไม่มีการส่งงาน</small></div>
      </div>

      <div class="card v12-controlbar">
        <div class="field"><label>ค้นหา</label><input class="input" id="v12-work-q" placeholder="ชื่อวิชา / ชื่อใบงาน / รหัสใบงาน"></div>
        <div class="field"><label>รายวิชา</label><select class="input" id="v12-work-subject"><option value="">ทุกวิชา</option>
          ${subjectKeys.map(s=>`<option value="${esc(s.id)}">${esc(s.code)} ${esc(s.name)}</option>`).join("")}
        </select></div>
        <div class="field"><label>สถานะ</label><select class="input" id="v12-work-status"><option value="">ทุกสถานะ</option>
          <option value="pending">ยังไม่ส่ง</option><option value="draft">บันทึกร่าง</option>
          <option value="overdue">เกินกำหนด</option><option value="sent">ส่งแล้ว</option>
          <option value="late">ส่งแล้ว (ช้า)</option><option value="upcoming">ยังไม่เปิด</option>
        </select></div>
      </div>

      <div class="card v12-table-card">
        <div class="row between"><div><h2>รายการงาน</h2><div class="muted" id="v12-work-count"></div></div>
          <button class="btn" data-v12-refresh-work>↻ รีเฟรช</button></div>
        <div class="table-wrap"><table class="v12-work-table">
          <thead><tr><th>รายวิชา</th><th>ใบงาน</th><th>ประเภท</th><th>วันเปิด</th><th>กำหนดส่ง</th><th>สถานะ</th><th>ครั้ง</th><th></th></tr></thead>
          <tbody id="v12-work-tbody"></tbody>
        </table></div>
      </div>
    </section>`;

    const redraw=()=>{
      const q=($("#v12-work-q")?.value||"").trim().toLowerCase();
      const subject=$("#v12-work-subject")?.value||"";
      const status=$("#v12-work-status")?.value||"";
      const filtered=rows.filter(r=>{
        const w=r.worksheet;
        const text=`${w.subjects?.code||""} ${w.subjects?.name||""} ${w.title||""} ${w.reference_code||""}`.toLowerCase();
        return (!q||text.includes(q))&&(!subject||w.subject_id===subject)&&(!status||r.status.key===status);
      });
      $("#v12-work-count").textContent=`แสดง ${filtered.length} จาก ${rows.length} รายการ`;
      $("#v12-work-tbody").innerHTML=filtered.map(r=>{
        const w=r.worksheet,s=r.submission,subject=w.subjects||{};
        const actionLabel=["sent","late"].includes(r.status.key)?"ดูงาน":"เปิดทำใบงาน";
        return `<tr>
          <td><span class="v12-subject-chip" style="--subject-color:${esc(subject.color_hex||"#22d3ee")}"><b>${esc(subject.code||"-")}</b><small>${esc(subject.name||"")}</small></span></td>
          <td><b>${esc(w.title||"-")}</b><small class="v12-ref">${esc(w.reference_code||"")}</small></td>
          <td>${esc(modeLabel(w.mode))}</td>
          <td>${fmt(w.open_at)}</td>
          <td>${fmt(w.due_at)}</td>
          <td><span class="${r.status.cls}">${esc(r.status.label)}</span></td>
          <td>${esc(s?.attempt_count??0)}</td>
          <td><button class="btn primary sm" data-open="${esc(w.id)}">${actionLabel}</button></td>
        </tr>`;
      }).join("")||`<tr><td colspan="8" class="empty">ไม่พบงานตามตัวกรอง</td></tr>`;
    };
    ["#v12-work-q","#v12-work-subject","#v12-work-status"].forEach(sel=>{
      const el=$(sel); if(el)el.addEventListener(sel==="#v12-work-q"?"input":"change",redraw);
    });
    redraw();
  }catch(e){
    content().innerHTML=`<div class="alert error"><b>โหลดตารางสถานะงานไม่สำเร็จ</b><div>${esc(errText(e))}</div></div>`;
  }
}

function promotionStatusTH(s){
  return ({draft:"รอตรวจและอนุมัติ",approved:"อนุมัติแล้ว รอดำเนินการ",applied:"เลื่อนชั้นเรียบร้อย",cancelled:"ยกเลิก"})[s]||s;
}
function promotionDecisionTH(s){
  return ({promote:"เลื่อนชั้น",hold:"คงชั้น",graduate:"จบการศึกษา"})[s]||s;
}
function nextLevel(level){
  return ({"ปวช.1":"ปวช.2","ปวช.2":"ปวช.3","ปวส.1":"ปวส.2"})[level]||null;
}
function decisionOptions(item){
  let opts=[];
  if(nextLevel(item.old_grade_level))opts=[["promote","เลื่อนชั้น"],["hold","คงชั้น"]];
  else if(["ปวช.3","ปวส.2"].includes(item.old_grade_level))opts=[["graduate","จบการศึกษา"],["hold","คงชั้น"]];
  else opts=[["hold","คงชั้น"]];
  if(!opts.some(x=>x[0]===item.decision))opts.unshift([item.decision,promotionDecisionTH(item.decision)]);
  return opts.map(([v,l])=>`<option value="${v}" ${item.decision===v?"selected":""}>${l}</option>`).join("");
}
function batchBadge(status){
  const cls=status==="applied"?"sent":status==="approved"?"draft":status==="cancelled"?"overdue":"pending";
  return `<span class="v12-status ${cls}">${esc(promotionStatusTH(status))}</span>`;
}

async function renderPromotionManager(batchId=null){
  const p=await profile();
  if(!p||p.role!=="admin")return;
  if(!content())return;
  busy("กำลังโหลดระบบเลื่อนชั้น...");
  try{
    const c=client();
    const {data:batches,error}=await c.from("promotion_batches").select("*").order("created_at",{ascending:false}).limit(25);
    if(error)throw error;
    const list=batches||[];
    const active=list.find(x=>["draft","approved"].includes(x.status));
    currentPromotionBatchId=batchId||currentPromotionBatchId||active?.id||list[0]?.id||null;
    let selected=list.find(x=>x.id===currentPromotionBatchId)||null;
    let items=[];
    if(selected){
      const ir=await c.from("promotion_items").select("*").eq("batch_id",selected.id)
        .order("old_grade_level").order("old_room_label").order("old_seat_number",{ascending:true,nullsFirst:false}).order("full_name");
      if(ir.error)throw ir.error;
      items=ir.data||[];
    }
    const thisBE=new Date().getFullYear()+543;
    const source=String(thisBE),target=String(thisBE+1);
    const summary={
      promote:items.filter(x=>x.decision==="promote").length,
      hold:items.filter(x=>x.decision==="hold").length,
      graduate:items.filter(x=>x.decision==="graduate").length
    };

    const batchPanel=selected?`<div class="card v12-promo-batch">
      <div class="row between">
        <div><span class="v12-kicker">PROMOTION BATCH</span><h2>ปีการศึกษา ${esc(selected.source_academic_year||"-")} → ${esc(selected.target_academic_year)}</h2>
          <div class="muted">สร้างเมื่อ ${fmt(selected.created_at)} ${selected.note?`• ${esc(selected.note)}`:""}</div></div>
        ${batchBadge(selected.status)}
      </div>
      <div class="v12-promo-summary">
        <span><b>${items.length}</b> นักเรียนทั้งหมด</span>
        <span><b>${summary.promote}</b> เลื่อนชั้น</span>
        <span><b>${summary.hold}</b> คงชั้น</span>
        <span><b>${summary.graduate}</b> จบการศึกษา</span>
      </div>
      <div class="alert ${selected.status==="approved"?"warn":selected.status==="applied"?"success":""}">
        ${selected.status==="draft"
          ?"ขั้นที่ 1: ตรวจรายชื่อและปรับคำสั่งรายคนได้ จากนั้นกด “อนุมัติรายการ” — ยังไม่มีการเปลี่ยนระดับชั้นจริงในขั้นนี้"
          :selected.status==="approved"
          ?"ขั้นที่ 2: Admin อนุมัติแล้ว ตรวจอีกครั้งก่อนกด “ดำเนินการเลื่อนชั้นจริง”"
          :selected.status==="applied"
          ?"รายการนี้ดำเนินการแล้ว ข้อมูลระดับชั้นและห้องเรียนใหม่ถูกอัปเดต โดยประวัติใบงาน/คะแนนเดิมไม่ถูกลบ"
          :"รายการนี้ถูกยกเลิก"}
      </div>
      <div class="table-wrap"><table class="v12-promo-table"><thead><tr>
        <th>เลขนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>เดิม</th><th>หลังดำเนินการ</th><th>คำสั่ง</th><th>ผล</th>
      </tr></thead><tbody>
        ${items.map(i=>`<tr>
          <td><b>${esc(i.student_code||"-")}</b></td>
          <td>${esc(i.full_name||"-")}</td>
          <td>${esc(i.old_grade_level||"-")}${esc(i.old_room_label||"")}</td>
          <td>${esc(i.new_grade_level||"-")}${esc(i.new_room_label||"")}</td>
          <td>${selected.status==="draft"
            ?`<select class="input v12-decision" data-v12-item-decision="${i.id}">${decisionOptions(i)}</select>`
            :`<b>${esc(promotionDecisionTH(i.decision))}</b>`}</td>
          <td>${i.applied?'<span class="v12-status sent">ดำเนินการแล้ว</span>':'-'}</td>
        </tr>`).join("")||`<tr><td colspan="6" class="empty">ไม่มีนักเรียนในรายการ</td></tr>`}
      </tbody></table></div>
      <div class="v12-promo-actions">
        ${selected.status==="draft"?`
          <button class="btn red" data-v12-cancel-batch="${selected.id}">ยกเลิกรายการ</button>
          <button class="btn primary" data-v12-approve-batch="${selected.id}">✓ อนุมัติรายการ</button>`:""}
        ${selected.status==="approved"?`
          <button class="btn red" data-v12-cancel-batch="${selected.id}">ยกเลิกรายการ</button>
          <button class="btn green" data-v12-apply-batch="${selected.id}">🚀 ดำเนินการเลื่อนชั้นจริง</button>`:""}
      </div>
    </div>`:`<div class="card"><div class="empty">ยังไม่มีรายการเลื่อนชั้น</div></div>`;

    content().innerHTML=`<section class="v12-page">
      <div class="v12-hero">
        <div><span class="v12-kicker">ACADEMIC YEAR CONTROL</span><h1>ระบบเลื่อนชั้นโดย Admin อนุมัติ</h1>
          <p>เตรียมรายการ → ตรวจรายคน → อนุมัติ → เลื่อนชั้นจริง โดยเก็บข้อมูลเดิมทั้งหมด</p></div>
        <div class="v12-live"><i></i> ADMIN CONTROLLED</div>
      </div>

      <div class="card v12-promo-create">
        <div><h2>เตรียมรายการปีการศึกษาใหม่</h2><div class="muted">การกดปุ่มนี้สร้างเพียง “รายการรอตรวจ” ยังไม่เปลี่ยนข้อมูลนักเรียน</div></div>
        <div class="v12-promo-form">
          <div class="field"><label>ปีการศึกษาปัจจุบัน</label><input class="input" id="v12-source-year" value="${source}" inputmode="numeric"></div>
          <div class="field"><label>ปีการศึกษาใหม่</label><input class="input" id="v12-target-year" value="${target}" inputmode="numeric"></div>
          <div class="field"><label>หมายเหตุ</label><input class="input" id="v12-promo-note" placeholder="เช่น เลื่อนชั้นประจำปี"></div>
          <button class="btn primary" data-v12-prepare-batch ${active?"disabled":""}>+ เตรียมรายการเลื่อนชั้น</button>
        </div>
        ${active?`<div class="alert warn">มีรายการ “${esc(promotionStatusTH(active.status))}” อยู่แล้ว กรุณาดำเนินการหรือยกเลิกรายการเดิมก่อนสร้างชุดใหม่</div>`:""}
      </div>

      ${batchPanel}

      <div class="card v12-history">
        <h2>ประวัติรายการ</h2>
        <div class="table-wrap"><table><thead><tr><th>ปีการศึกษา</th><th>สถานะ</th><th>สร้างเมื่อ</th><th></th></tr></thead><tbody>
          ${list.map(b=>`<tr><td>${esc(b.source_academic_year||"-")} → <b>${esc(b.target_academic_year)}</b></td><td>${batchBadge(b.status)}</td><td>${fmt(b.created_at)}</td><td><button class="btn sm" data-v12-open-batch="${b.id}">เปิดดู</button></td></tr>`).join("")||`<tr><td colspan="4" class="empty">ยังไม่มีประวัติ</td></tr>`}
        </tbody></table></div>
      </div>
    </section>`;
  }catch(e){
    content().innerHTML=`<div class="alert error"><b>โหลดระบบเลื่อนชั้นไม่สำเร็จ</b><div>${esc(errText(e))}</div></div>`;
  }
}

function openExamWindow(){
  const url=new URL("./exam.html",location.href).href;
  const w=window.open(url,"DOC_FULL_NR_EXAM","noopener,noreferrer");
  if(!w)toast("เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาอนุญาต Pop-up สำหรับระบบสอบ",true);
}

document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");
  if(!t)return;

  if(t.matches('[data-v12-route="workstatus"]')){
    e.preventDefault();e.stopPropagation();setActive(t);await renderWorkStatus();return;
  }
  if(t.matches('[data-v12-route="promotion"]')){
    e.preventDefault();e.stopPropagation();setActive(t);await renderPromotionManager();return;
  }
  if(t.matches('[data-v12-route="exam"]')){
    e.preventDefault();e.stopPropagation();openExamWindow();return;
  }
  if(t.matches("[data-v12-refresh-work]")){
    e.preventDefault();await renderWorkStatus();return;
  }
  if(t.matches("[data-v12-open-batch]")){
    e.preventDefault();currentPromotionBatchId=t.dataset.v12OpenBatch;await renderPromotionManager(currentPromotionBatchId);return;
  }
  if(t.matches("[data-v12-prepare-batch]")){
    e.preventDefault();
    const source=($("#v12-source-year")?.value||"").trim();
    const target=($("#v12-target-year")?.value||"").trim();
    const note=($("#v12-promo-note")?.value||"").trim();
    if(!target)return toast("กรุณาระบุปีการศึกษาใหม่",true);
    if(!confirm(`เตรียมรายการเลื่อนชั้นจากปี ${source||"-"} ไปปี ${target} ?\nขั้นตอนนี้ยังไม่เปลี่ยนระดับชั้นจริง`))return;
    t.disabled=true;
    try{
      const {data,error}=await client().rpc("prepare_promotion_batch",{
        p_source_academic_year:source||null,p_target_academic_year:target,p_note:note||null
      });
      if(error)throw error;
      currentPromotionBatchId=data;
      toast("เตรียมรายการแล้ว กรุณาตรวจรายชื่อก่อนอนุมัติ");
      await renderPromotionManager(data);
    }catch(err){t.disabled=false;toast(errText(err),true)}
    return;
  }
  if(t.matches("[data-v12-approve-batch]")){
    e.preventDefault();
    if(!confirm("ยืนยันอนุมัติรายการนี้?\nการอนุมัติยังไม่เปลี่ยนระดับชั้น จนกว่าจะกดดำเนินการในขั้นถัดไป"))return;
    try{
      const {error}=await client().rpc("approve_promotion_batch",{p_batch_id:t.dataset.v12ApproveBatch});
      if(error)throw error;
      toast("Admin อนุมัติรายการแล้ว");
      await renderPromotionManager(t.dataset.v12ApproveBatch);
    }catch(err){toast(errText(err),true)}
    return;
  }
  if(t.matches("[data-v12-cancel-batch]")){
    e.preventDefault();
    if(!confirm("ยืนยันยกเลิกรายการเลื่อนชั้นนี้?"))return;
    try{
      const {error}=await client().rpc("cancel_promotion_batch",{p_batch_id:t.dataset.v12CancelBatch});
      if(error)throw error;
      currentPromotionBatchId=t.dataset.v12CancelBatch;
      toast("ยกเลิกรายการแล้ว");
      await renderPromotionManager(currentPromotionBatchId);
    }catch(err){toast(errText(err),true)}
    return;
  }
  if(t.matches("[data-v12-apply-batch]")){
    e.preventDefault();
    if(!confirm("ยืนยันดำเนินการเลื่อนชั้นจริง?\nระบบจะอัปเดตระดับชั้น/ห้อง และสร้างห้องปีการศึกษาใหม่ตามรายการที่ Admin อนุมัติ\nประวัติใบงาน คะแนน และการส่งงานเดิมจะไม่ถูกลบ"))return;
    t.disabled=true;t.textContent="กำลังดำเนินการ...";
    try{
      const {data,error}=await client().rpc("apply_promotion_batch",{p_batch_id:t.dataset.v12ApplyBatch});
      if(error)throw error;
      toast(`เลื่อนชั้นสำเร็จ ${data?.applied_count??""} คน`);
      await renderPromotionManager(t.dataset.v12ApplyBatch);
    }catch(err){t.disabled=false;toast(errText(err),true)}
    return;
  }
},false);

document.addEventListener("change",async e=>{
  const t=e.target.closest("[data-v12-item-decision]");
  if(!t)return;
  const itemId=t.dataset.v12ItemDecision;
  t.disabled=true;
  try{
    const {error}=await client().rpc("set_promotion_item_decision",{p_item_id:itemId,p_decision:t.value});
    if(error)throw error;
    toast("อัปเดตคำสั่งรายคนแล้ว");
    await renderPromotionManager(currentPromotionBatchId);
  }catch(err){
    t.disabled=false;
    toast(errText(err),true);
    await renderPromotionManager(currentPromotionBatchId);
  }
});

console.info(`[DOC-FULL-NR] ${FEATURE_VERSION} loaded`);
