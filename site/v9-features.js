import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF = "thjscmfqunlaqxlievna";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

let profileCache = null;
let profileUid = null;
let reportState = null;
let autosaveTimer = null;
const FEATURE_VERSION="V9-SUBJECT-HUB";

const q = (s,r=document)=>r.querySelector(s);
const qa = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const xmlEsc = v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[m]));
const safeName=s=>String(s||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const dtLocal=d=>d?new Date(new Date(d).getTime()-new Date(d).getTimezoneOffset()*60000).toISOString().slice(0,16):"";

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const x=JSON.parse(raw);
    return x?.access_token&&x?.user?.id?x:null;
  }catch{return null}
}
function client(){
  const s=readSession();
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}}
  });
}
function uid(){return readSession()?.user?.id||null}
async function getProfile(force=false){
  const id=uid();
  if(!id){profileCache=null;profileUid=null;return null}
  if(!force&&profileCache&&profileUid===id)return profileCache;
  const {data,error}=await client().from("profiles").select("id,role,active,full_name,student_code,class_name,grade_level,room_label,department,major").eq("id",id).maybeSingle();
  if(error)return null;
  profileCache=data;profileUid=id;return data;
}
function content(){
  return q("#content");
}
function toast(message,type=""){
  let box=q("#v8-toast");
  if(!box){
    box=document.createElement("div");
    box.id="v8-toast";
    document.body.appendChild(box);
  }
  box.className=`v8-toast show ${type}`;
  box.textContent=message;
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>box.className="v8-toast",3200);
}
function busy(html="กำลังโหลด..."){
  if(content())content().innerHTML=`<div class="card v8-busy">${esc(html)}</div>`;
}
function setActive(btn){
  const nav=q("#sidebar .nav");
  if(!nav)return;
  qa("button",nav).forEach(x=>x.classList.remove("active"));
  btn?.classList.add("active");
}
function closeOverlay(){
  clearTimeout(autosaveTimer);
  q("#v8-root")?.remove();
  if(document.fullscreenElement){
    document.exitFullscreen?.().catch(()=>{});
  }
}
function overlay(html,cls=""){
  closeOverlay();
  document.body.insertAdjacentHTML("beforeend",`<div id="v8-root" class="v8-overlay ${cls}">${html}</div>`);
  qa("[data-v8-close]",q("#v8-root")).forEach(b=>b.addEventListener("click",closeOverlay));
  return q("#v8-root");
}
function subjectColor(s){return s?.color_hex||"#2563eb"}
function worksheetAbbr(w){
  const ref=String(w.reference_code||"");
  const m=ref.match(/-([DP]\d{2})$/);
  return m?m[1]:(w.mode==="paper"?"P":"D");
}
function statusLabel(sub,assigned,w){
  if(!assigned)return {text:"—",cls:"na",title:"ไม่ได้มอบหมาย"};
  if(!sub)return {text:"☐",cls:"missing",title:"ยังไม่ส่ง"};
  if(sub.status==="draft")return {text:"◐",cls:"draft",title:"บันทึกร่าง"};
  if(["submitted","confirmed","graded"].includes(sub.status)){
    const late=w?.due_at&&sub.submitted_at&&new Date(sub.submitted_at)>new Date(w.due_at);
    return {text:late?"⚠":"☑",cls:late?"late":"sent",title:late?"ส่งช้า":"ส่งแล้ว"};
  }
  return {text:"☐",cls:"missing",title:String(sub.status||"ยังไม่ส่ง")};
}

async function enhanceNav(){
  const nav=q("#sidebar .nav");
  if(!nav)return;
  const p=await getProfile();
  if(!p)return;
  // V11/V12 Subject Bundles owns the worksheet label. Never fight another
  // observer over textContent: that previously caused a MutationObserver loop
  // and could freeze the whole UI on mobile and desktop.
  const worksheetBtn=q('[data-route="worksheets"]',nav);
  if(worksheetBtn&&p.role==="admin"&&document.documentElement.dataset.subjectBundles!=="v11"&&worksheetBtn.textContent!=="ใบงานตามรายวิชา"){
    worksheetBtn.textContent="ใบงานตามรายวิชา";
  }
  const subjectBtn=q('[data-route="subjects"]',nav);
  if(subjectBtn&&p.role==="admin"&&!subjectBtn.dataset.v9OriginalLabel)subjectBtn.dataset.v9OriginalLabel="1";
  const myworksBtn=q('[data-route="myworks"]',nav);
  if(myworksBtn&&p.role!=="admin"&&myworksBtn.textContent!=="รายวิชา / ใบงานของฉัน"){
    myworksBtn.textContent="รายวิชา / ใบงานของฉัน";
  }
  if(p.role==="admin"&&!q("[data-v8-report]",nav)){
    const b=document.createElement("button");
    b.type="button";b.dataset.v8Report="1";b.textContent="ตรวจงานรายห้อง";
    nav.appendChild(b);
  }
}
let navEnhanceTimer=null;
const observer=new MutationObserver(()=>{
  if(navEnhanceTimer)return;
  navEnhanceTimer=setTimeout(()=>{
    navEnhanceTimer=null;
    enhanceNav().catch(()=>{});
  },40);
});
observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
setTimeout(()=>enhanceNav().catch(()=>{}),350);

document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");
  if(!t)return;

  if(t.matches("[data-v8-report]")){
    e.preventDefault();e.stopImmediatePropagation();setActive(t);renderReportDashboard();return;
  }
  if(t.matches("[data-v8-back-library]")){
    e.preventDefault();openSubjectLibrary();return;
  }
  if(t.matches("[data-v8-subject]")){
    e.preventDefault();openSubjectDetail(t.dataset.v8Subject,"worksheets");return;
  }
  if(t.matches("[data-v9-tab]")){
    e.preventDefault();openSubjectDetail(t.dataset.v9Subject,t.dataset.v9Tab);return;
  }
  if(t.matches("[data-v8-open-file]")){
    e.preventDefault();openSubjectFile(t.dataset.v8OpenFile);return;
  }
  if(t.matches("[data-v8-preview]")){
    e.preventDefault();previewWorksheetAdmin(t.dataset.v8Preview);return;
  }
  if(t.matches("[data-v8-assign],[data-v9-schedule]")){
    e.preventDefault();scheduleDialog(t.dataset.v8Assign||t.dataset.v9Schedule);return;
  }
  if(t.matches("[data-v9-upload-slide]")){
    e.preventDefault();
    const input=document.createElement("input");
    input.type="file";input.multiple=true;input.accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp";
    input.onchange=()=>uploadSubjectFiles(t.dataset.v9Subject,[...input.files],{
      worksheetId:t.dataset.v9UploadSlide,
      sequenceNo:Number(t.dataset.v9Sequence||0)||null,
      resourceKind:"slide"
    });
    input.click();return;
  }
  if(t.matches("[data-v9-edit-goal]")){
    e.preventDefault();goalDialog(t.dataset.v9EditGoal,t.dataset.v9Subject);return;
  }
  if(t.matches("[data-v8-report-load]")){
    e.preventDefault();loadReportFromForm();return;
  }
  if(t.matches("[data-v8-export-xls]")){
    e.preventDefault();exportReportXls();return;
  }
  if(t.matches("[data-v8-print-report]")){
    e.preventDefault();printReport();return;
  }
  if(t.matches("[data-v8-student-subject]")){
    e.preventDefault();showStudentSubject(t.dataset.v8StudentSubject);return;
  }

  const p=profileCache||await getProfile();
  const route=t.closest("[data-route]")?.dataset.route;
  if(p?.role==="admin"&&route==="worksheets"){
    e.preventDefault();e.stopImmediatePropagation();setActive(t.closest("[data-route]"));openSubjectLibrary();return;
  }
  if(p?.role!=="admin"&&route==="myworks"){
    e.preventDefault();e.stopImmediatePropagation();setActive(t.closest("[data-route]"));renderStudentSubjects();return;
  }

  const open=t.closest("[data-open]");
  if(open&&p?.role!=="admin"&&!open.closest("#v8-root")){
    e.preventDefault();e.stopImmediatePropagation();openWorksheetStudent(open.dataset.open);return;
  }
},true);
async function openSubjectLibrary(){
  if(!content())return;
  busy("กำลังโหลดรายวิชา...");
  const c=client();
  const {data:subjects,error}=await c.from("subjects").select("id,code,name,color_hex,academic_year,semester,subject_type,active").eq("subject_type","subject").eq("active",true).order("code");
  if(error){content().innerHTML=`<div class="alert error">${esc(error.message)}</div>`;return}
  const ids=(subjects||[]).map(x=>x.id);
  let worksheets=[],files=[];
  if(ids.length){
    const [wr,fr]=await Promise.all([
      c.from("worksheets").select("id,subject_id,mode,status,settings,reference_code,open_at,due_at").in("subject_id",ids),
      c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,size_bytes,created_at").in("subject_id",ids)
    ]);
    worksheets=wr.data||[];files=fr.data||[];
  }
  const cards=(subjects||[]).map(s=>{
    const ws=worksheets.filter(w=>w.subject_id===s.id&&w.settings?.template_ready===true);
    const pc=ws.filter(w=>w.mode==="paper").length,dc=ws.filter(w=>w.mode==="digital").length,fc=files.filter(f=>f.subject_id===s.id).length;
    const scheduled=ws.filter(w=>w.open_at&&w.due_at).length;
    return `<article class="card v8-subject-card v9-subject-card" data-v8-card="${s.id}" style="--subject-color:${subjectColor(s)}">
      <div class="v8-subject-head"><div class="v8-subject-dot"></div><div><b>${esc(s.code)}</b><h3>${esc(s.name)}</h3></div></div>
      <div class="v8-counts"><span>🖨️ Paper ${pc}/5</span><span>💻 Digital ${dc}/13</span><span>📚 สไลด์/สื่อ ${fc}</span></div>
      <div class="v9-progress"><div class="v9-progress-bar" style="width:${ws.length?Math.round(scheduled/ws.length*100):0}%"></div></div>
      <div class="row between smalltext muted"><span>ตั้งเวลาแล้ว ${scheduled}/${ws.length}</span><span>ภาคเรียน ${esc(s.semester||"-")}</span></div>
      <button class="btn primary w100 v9-open-subject" data-v8-subject="${s.id}">เปิดรายวิชา</button>
    </article>`;
  }).join("");
  content().innerHTML=`<section class="v8-library">
    <div class="section-head"><div><h1>ใบงานตามรายวิชา</h1><div class="muted">เลือกวิชาก่อน แล้วจึงจัดการใบงาน สไลด์ และเป้าหมายการเรียนในวิชาเดียวกัน</div></div></div>
    <div class="card v9-library-toolbar"><div class="field"><label>ค้นหารายวิชา</label><input id="v8-subject-search" class="input" placeholder="รหัสวิชา / ชื่อวิชา"></div>
      <div class="v9-library-note">ภายในแต่ละวิชามี 3 ส่วน: <b>ใบงาน</b> • <b>สไลด์/สื่อ</b> • <b>แผนการสอนรายวัน</b></div></div>
    <div id="v8-subject-grid" class="v8-subject-grid">${cards}</div>
  </section>`;
  q("#v8-subject-search")?.addEventListener("input",e=>{
    const term=e.target.value.trim().toLowerCase();
    (subjects||[]).forEach(s=>{
      const el=q(`[data-v8-card="${s.id}"]`);
      if(el)el.hidden=term&&!`${s.code} ${s.name}`.toLowerCase().includes(term);
    });
  });
}

function sequenceOf(w){return Number(w?.settings?.lesson_sequence||w?.settings?.sequence_no||w?.settings?.week_no||0)||0}
function scheduleText(w){
  if(!w.open_at&&!w.due_at)return "ยังไม่กำหนดวัน/เวลา";
  return `เปิด ${fmt(w.open_at)} • ส่ง ${fmt(w.due_at)}`;
}
function linkedSlides(files,wid){return (files||[]).filter(f=>f.worksheet_id===wid&&f.resource_kind==="slide")}
function renderSubjectTabs(subjectId,active){
  return `<div class="v9-tabs" role="tablist">
    <button class="v9-tab ${active==="worksheets"?"active":""}" data-v9-tab="worksheets" data-v9-subject="${subjectId}">📝 ใบงาน</button>
    <button class="v9-tab ${active==="slides"?"active":""}" data-v9-tab="slides" data-v9-subject="${subjectId}">📊 สไลด์ / สื่อ</button>
    <button class="v9-tab ${active==="plan"?"active":""}" data-v9-tab="plan" data-v9-subject="${subjectId}">🎯 แผนการสอนรายวัน</button>
  </div>`;
}
function worksheetCard(w,files,subjectId){
  const slides=linkedSlides(files,w.id),seq=sequenceOf(w),goal=w.settings?.learning_goal||"ยังไม่ได้กำหนดเป้าหมายการเรียน";
  return `<article class="v9-work-card ${w.mode}" style="--subject-color:${w.subject_color||'#2563eb'}">
    <div class="v9-work-id"><span class="v9-code">${esc(worksheetAbbr(w))}</span><span class="badge ${w.mode==="paper"?"gray":""}">${w.mode==="paper"?"paper":"digital"}</span></div>
    <div class="v9-work-main"><div class="row wrap gap8"><h3>${esc(w.title)}</h3><span class="badge ${w.status==="published"?"green":"warn"}">${esc(w.status)}</span></div>
      <div class="v9-goal-preview"><b>เป้าหมาย:</b> ${esc(goal)}</div>
      <div class="smalltext ${w.open_at&&w.due_at?"":"v9-unscheduled"}">🗓️ ${esc(scheduleText(w))}</div>
      <div class="smalltext muted">📊 สไลด์/สื่อที่ผูกไว้ ${slides.length} ไฟล์${seq?` • ชุดการเรียน ${seq}`:""}</div>
    </div>
    <div class="v9-work-actions">
      <button class="btn primary v9-schedule-main" data-v9-schedule="${w.id}">🗓 กำหนดวัน/เวลา</button>
      <button class="btn" data-v8-preview="${w.id}">พรีวิว</button>
      <button class="btn" data-v9-upload-slide="${w.id}" data-v9-subject="${subjectId}" data-v9-sequence="${seq}">+ ผูกสไลด์</button>
      <button class="btn ghost" data-v9-edit-goal="${w.id}" data-v9-subject="${subjectId}">แก้เป้าหมาย</button>
    </div>
  </article>`;
}

async function openSubjectDetail(subjectId,tab="worksheets"){
  busy("กำลังเปิดรายวิชา...");
  const c=client();
  const [sr,wr,fr]=await Promise.all([
    c.from("subjects").select("*").eq("id",subjectId).single(),
    c.from("worksheets").select("id,subject_id,title,description,instructions,mode,status,reference_code,settings,open_at,due_at,published_at,classroom_id,allow_late,allow_resubmit,max_attempts,allow_draft,copy_paste_allowed").eq("subject_id",subjectId).order("created_at"),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,mime_type,size_bytes,description,created_at").eq("subject_id",subjectId).order("created_at",{ascending:false})
  ]);
  if(sr.error||wr.error||fr.error){content().innerHTML=`<div class="alert error">${esc((sr.error||wr.error||fr.error).message)}</div>`;return}
  const s=sr.data,all=wr.data||[],ready=all.filter(w=>w.settings?.template_ready===true),files=fr.data||[];
  ready.forEach(w=>w.subject_color=subjectColor(s));
  const papers=ready.filter(w=>w.mode==="paper").sort((a,b)=>sequenceOf(a)-sequenceOf(b));
  const digitals=ready.filter(w=>w.mode==="digital").sort((a,b)=>sequenceOf(a)-sequenceOf(b));
  const legacy=all.filter(w=>!w.settings?.template_ready);
  const scheduled=ready.filter(w=>w.open_at&&w.due_at).length;

  let body="";
  if(tab==="worksheets"){
    body=`<div class="v9-tab-intro"><div><h2>ใบงานสำเร็จรูป</h2><div class="muted">รวมใบงานทั้งหมดไว้ในวิชานี้ ปุ่มกำหนดวัน/เวลาอยู่ด้านขวาของทุกใบงาน</div></div><div class="v9-mini-stats"><span>Paper ${papers.length}/5</span><span>Digital ${digitals.length}/13</span><span>ตั้งเวลา ${scheduled}/${ready.length}</span></div></div>
      <div class="v9-section-title"><h3>💻 ใบงานอิเล็กทรอนิกส์ 13 ชุด</h3><span class="muted smalltext">Fullscreen • บังคับพิมพ์ • Preview ก่อนส่ง</span></div>
      <div class="v9-work-list">${digitals.map(w=>worksheetCard(w,files,subjectId)).join("")}</div>
      <div class="v9-section-title"><h3>🖨️ ใบงานพิมพ์ 5 ชุด</h3><span class="muted smalltext">A4 หน้าเดียว</span></div>
      <div class="v9-work-list">${papers.map(w=>worksheetCard(w,files,subjectId)).join("")}</div>`;
  }else if(tab==="slides"){
    body=`<div class="v9-tab-intro"><div><h2>สไลด์และสื่อที่สอดคล้องกับใบงาน</h2><div class="muted">อัปโหลด PPT/PPTX/PDF/เอกสาร แล้วผูกกับใบงานโดยตรง เพื่อให้นักศึกษาเห็นสื่อของงานนั้นเท่านั้น</div></div></div>
      <div class="v9-slide-list">${ready.sort((a,b)=>sequenceOf(a)-sequenceOf(b)||a.mode.localeCompare(b.mode)).map(w=>{
        const slides=linkedSlides(files,w.id),seq=sequenceOf(w);
        return `<article class="card v9-slide-row"><div class="v9-slide-head"><div><span class="v9-code">${esc(worksheetAbbr(w))}</span> <b>${esc(w.title)}</b><div class="muted smalltext">${esc(w.settings?.learning_goal||"")}</div></div>
          <button class="btn primary" data-v9-upload-slide="${w.id}" data-v9-subject="${subjectId}" data-v9-sequence="${seq}">+ เพิ่มสไลด์/สื่อ</button></div>
          <div class="file-list v9-linked-files">${slides.map(f=>`<div class="file-chip"><div><b>${esc(f.original_name)}</b><div class="smalltext muted">${esc(f.resource_kind||"slide")} • ${Math.round((f.size_bytes||0)/1024)} KB • ${fmt(f.created_at)}</div></div><button class="btn sm" data-v8-open-file="${esc(f.storage_path)}">เปิด</button></div>`).join("")||`<div class="empty">ยังไม่มีสไลด์หรือสื่อที่ผูกกับใบงานนี้</div>`}</div>
        </article>`;
      }).join("")}</div>
      ${files.some(f=>!f.worksheet_id)?`<div class="card"><h3>ไฟล์เดิมที่ยังไม่ได้ผูกกับใบงาน</h3><div class="file-list">${files.filter(f=>!f.worksheet_id).map(f=>`<div class="file-chip"><span>${esc(f.original_name)}</span><button class="btn sm" data-v8-open-file="${esc(f.storage_path)}">เปิด</button></div>`).join("")}</div></div>`:""}`;
  }else{
    const seqs=[...new Set(ready.map(sequenceOf).filter(Boolean))].sort((a,b)=>a-b);
    body=`<div class="v9-tab-intro"><div><h2>แผนการสอนรายวัน</h2><div class="muted">มัดเป้าหมายการเรียน ใบงาน สไลด์ และวันเวลาไว้เป็นชุดเดียวกันในแต่ละลำดับการเรียน</div></div></div>
      <div class="v9-plan-grid">${seqs.map(seq=>{
        const group=ready.filter(w=>sequenceOf(w)===seq).sort((a,b)=>a.mode==="digital"?-1:1);
        const meta=group[0]?.settings?.schedule||{};
        return `<article class="card v9-plan-card"><div class="v9-plan-number">${String(seq).padStart(2,"0")}</div><div class="v9-plan-content"><div class="row between wrap"><div><h3>ชุดการเรียน ${seq}</h3><div class="smalltext muted">${esc(meta.day||"วันเรียนยังไม่ระบุ")} ${esc(meta.time||"")} ${meta.group?`• กลุ่ม ${esc(meta.group)}`:""}</div></div><span class="badge">${group.length} ใบงาน</span></div>
          ${group.map(w=>{const fs=linkedSlides(files,w.id);return `<div class="v9-plan-work"><div class="row between wrap"><div><b>${esc(worksheetAbbr(w))} • ${esc(w.title)}</b><div class="v9-plan-goal">🎯 ${esc(w.settings?.learning_goal||"ยังไม่กำหนดเป้าหมาย")}</div><div class="smalltext muted">📊 สไลด์/สื่อ ${fs.length} ไฟล์ • 🗓 ${esc(scheduleText(w))}</div></div><div class="row"><button class="btn sm" data-v9-edit-goal="${w.id}" data-v9-subject="${subjectId}">เป้าหมาย</button><button class="btn sm primary" data-v9-schedule="${w.id}">กำหนดเวลา</button></div></div></div>`}).join("")}
        </div></article>`;
      }).join("")}</div>`;
  }

  content().innerHTML=`<section class="v9-subject-hub" style="--subject-color:${subjectColor(s)}">
    <div class="v9-subject-hero"><button class="btn sm ghost" data-v8-back-library>← รายวิชาทั้งหมด</button><div class="v9-hero-main"><div class="v8-subject-dot"></div><div><div class="muted smalltext">รายวิชา</div><h1>${esc(s.code)} ${esc(s.name)}</h1><div class="muted">จัดการทุกอย่างของรายวิชาจากหน้าเดียว</div></div></div>
      <div class="v9-hero-stats"><span>📝 ${ready.length} ใบงาน</span><span>📊 ${files.length} สื่อ</span><span>🗓 ${scheduled} ตั้งเวลาแล้ว</span></div></div>
    ${renderSubjectTabs(subjectId,tab)}
    <div class="v9-tab-body">${body}</div>
    ${legacy.length?`<div class="alert warn" style="margin-top:14px">ใบงานเดิมที่ไม่ใช่ชุดสำเร็จรูปยังถูกเก็บไว้ ${legacy.length} รายการ ระบบไม่ได้ลบข้อมูลเดิม</div>`:""}
  </section>`;
}

async function uploadSubjectFiles(subjectId,files,opts={}){
  if(!files.length)return;
  const c=client(),me=uid();
  const worksheetId=opts.worksheetId||null,sequenceNo=opts.sequenceNo||null,resourceKind=opts.resourceKind||"slide";
  for(const file of files){
    if(file.size>50*1024*1024){toast(`${file.name}: ไฟล์เกิน 50MB`,"error");continue}
    const path=`${subjectId}/${worksheetId||"general"}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safeName(file.name)}`;
    toast(`กำลังอัปโหลด ${file.name}...`);
    const up=await c.storage.from("subject-files").upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(up.error){toast(`${file.name}: ${up.error.message}`,"error");continue}
    const ins=await c.from("subject_files").insert({subject_id:subjectId,worksheet_id:worksheetId,resource_kind:resourceKind,sequence_no:sequenceNo,storage_path:path,original_name:file.name,mime_type:file.type||null,size_bytes:file.size,created_by:me});
    if(ins.error){
      await c.storage.from("subject-files").remove([path]);
      toast(`${file.name}: บันทึก metadata ไม่สำเร็จ`,"error");continue;
    }
    toast(`ผูก ${file.name} กับใบงานสำเร็จ`);
  }
  openSubjectDetail(subjectId,"slides");
}

async function goalDialog(wid,subjectId){
  const c=client();
  const {data:w,error}=await c.from("worksheets").select("id,title,settings").eq("id",wid).single();
  if(error){toast(error.message,"error");return}
  overlay(`<div class="v8-dialog card"><div class="modal-header"><div><h2>เป้าหมายการเรียน</h2><div class="muted">${esc(w.title)}</div></div><button class="btn sm" data-v8-close>✕</button></div>
    <form id="v9-goal-form"><div class="field"><label>เมื่อจบบทเรียน นักศึกษาควรทำอะไรได้</label><textarea class="input v9-goal-input" name="goal" required>${esc(w.settings?.learning_goal||"")}</textarea></div>
    <div class="alert">เป้าหมายนี้จะแสดงร่วมกับใบงาน สไลด์ และแผนการสอนของชุดเดียวกัน</div><div class="row end"><button type="button" class="btn" data-v8-close>ยกเลิก</button><button class="btn primary">บันทึกเป้าหมาย</button></div></form></div>`,"v8-dialog-layer");
  q("#v9-goal-form").onsubmit=async e=>{
    e.preventDefault();const goal=new FormData(e.target).get("goal")?.toString().trim();if(!goal)return;
    const settings={...(w.settings||{}),learning_goal:goal};
    const r=await c.from("worksheets").update({settings}).eq("id",wid);
    if(r.error){toast(r.error.message,"error");return}
    closeOverlay();toast("บันทึกเป้าหมายการเรียนแล้ว");openSubjectDetail(subjectId,"plan");
  };
}

async function openSubjectFile(path){
  const {data,error}=await client().storage.from("subject-files").createSignedUrl(path,600);
  if(error||!data?.signedUrl){toast(error?.message||"เปิดไฟล์ไม่สำเร็จ","error");return}
  window.open(data.signedUrl,"_blank","noopener");
}

function localInputValue(d){
  const x=new Date(d);if(!Number.isFinite(x.getTime()))return "";
  const z=new Date(x.getTime()-x.getTimezoneOffset()*60000);return z.toISOString().slice(0,16);
}
function presetTimes(kind,w){
  const now=new Date();let open=new Date(now),due=new Date(now);
  if(kind==="today"){due.setHours(23,59,0,0)}
  else if(kind==="tomorrow"){due.setDate(due.getDate()+1);due.setHours(23,59,0,0)}
  else if(kind==="3days"){due.setDate(due.getDate()+3);due.setHours(23,59,0,0)}
  else if(kind==="class"){
    const map={"อาทิตย์":0,"จันทร์":1,"อังคาร":2,"พุธ":3,"พฤหัสบดี":4,"ศุกร์":5,"เสาร์":6};
    const meta=w.settings?.schedule||{},target=map[meta.day];
    const m=String(meta.time||"").match(/(\d{1,2}):(\d{2})/);
    if(target!==undefined){let delta=(target-now.getDay()+7)%7;if(delta===0&&m){const test=new Date(now);test.setHours(Number(m[1]),Number(m[2]),0,0);if(test<=now)delta=7}open.setDate(now.getDate()+delta)}
    if(m)open.setHours(Number(m[1]),Number(m[2]),0,0);else open.setHours(8,0,0,0);
    due=new Date(open);due.setHours(23,59,0,0);
  }
  return {open,due};
}
async function scheduleDialog(wid){
  const c=client();
  const [wr,cr]=await Promise.all([
    c.from("worksheets").select("id,title,mode,status,open_at,due_at,subject_id,classroom_id,allow_late,allow_resubmit,max_attempts,allow_draft,settings").eq("id",wid).single(),
    c.from("classrooms").select("id,name,level,active").eq("active",true).order("name")
  ]);
  if(wr.error||cr.error){toast((wr.error||cr.error).message,"error");return}
  const w=wr.data;
  overlay(`<div class="v8-dialog card v9-schedule-dialog">
    <div class="modal-header"><div><h2>🗓 กำหนดวันและเวลาส่งงาน</h2><div class="muted">${esc(w.title)}</div></div><button class="btn sm" data-v8-close>✕</button></div>
    <form id="v9-schedule-form">
      <div class="v9-quick-title">ตั้งเวลาแบบเร็ว</div>
      <div class="v9-quick-presets"><button type="button" class="btn" data-v9-preset="today">ส่งวันนี้ 23:59</button><button type="button" class="btn" data-v9-preset="tomorrow">ส่งพรุ่งนี้ 23:59</button><button type="button" class="btn" data-v9-preset="3days">ส่งใน 3 วัน</button><button type="button" class="btn" data-v9-preset="class">ตามวันเรียน</button></div>
      <div class="field"><label>ห้องเรียน / กลุ่มเป้าหมาย</label><select class="input" name="classroom"><option value="">-- เลือกห้อง --</option>${(cr.data||[]).map(x=>`<option value="${x.id}" ${w.classroom_id===x.id?"selected":""}>${esc(x.name)} ${esc(x.level||"")}</option>`).join("")}</select></div>
      <div class="form-grid"><div class="field"><label>เปิดให้ทำ</label><input class="input" type="datetime-local" name="open_at" value="${dtLocal(w.open_at)}" required></div>
      <div class="field"><label>กำหนดส่ง</label><input class="input" type="datetime-local" name="due_at" value="${dtLocal(w.due_at)}" required></div></div>
      <details class="v9-details"><summary>⚙️ ตั้งค่าละเอียดเกี่ยวกับการส่งงาน</summary><div class="v9-detail-grid">
        <label class="v9-check"><input type="checkbox" name="allow_late" ${w.allow_late?"checked":""}> อนุญาตส่งช้า</label>
        <label class="v9-check"><input type="checkbox" name="allow_resubmit" ${w.allow_resubmit?"checked":""}> อนุญาตส่งแก้ไข/ส่งซ้ำ</label>
        <label class="v9-check"><input type="checkbox" name="allow_draft" ${w.allow_draft?"checked":""}> อนุญาตบันทึกร่าง</label>
        <div class="field"><label>จำนวนครั้งสูงสุดที่ส่งได้</label><input class="input" type="number" min="1" max="20" name="max_attempts" value="${Number(w.max_attempts||1)}"></div>
        <div class="v9-detail-note">สถานะปัจจุบัน: <b>${esc(w.status)}</b> • ${w.settings?.schedule?.day?`ตารางเรียน ${esc(w.settings.schedule.day)} ${esc(w.settings.schedule.time||"")}`:"ยังไม่มีข้อมูลวันเรียน"}</div>
      </div></details>
      <div class="row between wrap v9-schedule-actions"><button type="button" class="btn" data-v8-close>ยกเลิก</button><div class="row"><button type="button" class="btn" id="v9-save-time">บันทึกเวลาอย่างเดียว</button><button type="button" class="btn green" id="v9-save-publish">${w.status==="published"?"บันทึก + อัปเดตผู้รับมอบหมาย":"บันทึก + Publish"}</button></div></div>
    </form></div>`,"v8-dialog-layer");
  qa("[data-v9-preset]").forEach(b=>b.onclick=()=>{const x=presetTimes(b.dataset.v9Preset,w);q('[name="open_at"]',q("#v9-schedule-form")).value=localInputValue(x.open);q('[name="due_at"]',q("#v9-schedule-form")).value=localInputValue(x.due)});
  const save=async publish=>{
    const form=q("#v9-schedule-form"),f=new FormData(form),cid=String(f.get("classroom")||"");
    const openAt=new Date(String(f.get("open_at"))),dueAt=new Date(String(f.get("due_at")));
    if(!Number.isFinite(openAt.getTime())||!Number.isFinite(dueAt.getTime())||dueAt<=openAt){toast("วันเวลาไม่ถูกต้อง: กำหนดส่งต้องอยู่หลังเวลาเปิด","error");return}
    if(publish&&!cid){toast("กรุณาเลือกห้องก่อน Publish","error");return}
    if(publish){const members=await c.from("classroom_memberships").select("user_id",{count:"exact",head:true}).eq("classroom_id",cid).eq("active",true);if(members.error){toast(members.error.message,"error");return}if(!members.count){toast("ห้องนี้ยังไม่มีนักศึกษา จึงยังไม่ Publish เพื่อป้องกันการสั่งผิดคน","error");return}}
    const payload={open_at:openAt.toISOString(),due_at:dueAt.toISOString(),allow_late:f.get("allow_late")==="on",allow_resubmit:f.get("allow_resubmit")==="on",allow_draft:f.get("allow_draft")==="on",max_attempts:Math.max(1,Number(f.get("max_attempts")||1))};
    if(cid)payload.classroom_id=cid;
    const ur=await c.from("worksheets").update(payload).eq("id",wid);if(ur.error){toast(ur.error.message,"error");return}
    if(publish){const pr=await c.rpc("publish_worksheet",{p_worksheet_id:wid,p_classroom_ids:[cid],p_user_ids:[]});if(pr.error){toast(pr.error.message,"error");return}}
    closeOverlay();toast(publish?"บันทึกเวลาและมอบหมายใบงานแล้ว":"บันทึกวันเวลาแล้ว");openSubjectDetail(w.subject_id,"worksheets");
  };
  q("#v9-save-time").onclick=()=>save(false);q("#v9-save-publish").onclick=()=>save(true);
}
async function previewWorksheetAdmin(wid){
  const c=client();
  const {data:w,error}=await c.from("worksheets").select("*,subjects(code,name,color_hex)").eq("id",wid).single();
  if(error){toast(error.message,"error");return}
  if(w.mode==="paper"){paperPreview(w);return}
  const max=(w.questions||[]).reduce((a,x)=>a+Number(x.points||0),0);
  overlay(`<div class="v8-preview-shell">
    <div class="v8-preview-toolbar"><div><b>${esc(w.subjects?.code||"")} • ${esc(w.title)}</b><div class="smalltext">Digital • ${max} คะแนน</div></div><button class="btn" data-v8-close>ปิด</button></div>
    <main class="v8-preview-body">${(w.questions||[]).map((x,i)=>`<div class="q-card"><b>${i+1}. ${esc(x.text)}</b><div class="muted smalltext">${Number(x.points||0)} คะแนน</div><div class="v8-answer-placeholder">พื้นที่คำตอบ</div></div>`).join("")}</main>
  </div>`,"v8-fullscreen-layer");
}
function paperPreview(w){
  const max=(w.questions||[]).reduce((a,x)=>a+Number(x.points||0),0);
  overlay(`<div class="v8-paper-preview-wrap">
    <div class="v8-preview-toolbar"><div><b>${esc(w.subjects?.code||"")} • ${esc(w.title)}</b><div class="smalltext">A4 • 1 หน้า • ${max} คะแนน</div></div>
    <div class="row"><button id="v8-print-paper" class="btn primary">พิมพ์ A4</button><button class="btn" data-v8-close>ปิด</button></div></div>
    ${paperHtml(w)}
  </div>`,"v8-fullscreen-layer");
  q("#v8-print-paper").onclick=()=>printPaper(w);
}
function paperHtml(w){
  const max=(w.questions||[]).reduce((a,x)=>a+Number(x.points||0),0);
  return `<article class="v8-a4-sheet">
    <div class="v8-paper-topline"></div>
    <header class="v8-paper-header"><div><h2>วิทยาลัยเทคนิคนางรอง</h2><div>แผนกวิชาคอมพิวเตอร์และเทคโนโลยีสารสนเทศ</div><h3>ใบงานปฏิบัติการ (Laboratory Worksheet)</h3></div>
      <div class="v8-docbox"><b>FM-AC-01</b><div>ฉบับที่ 01 • หน้า 1/1</div><div>${esc(w.reference_code||"")}</div></div></header>
    <div class="v8-paper-band"><div><b>วิชา ${esc(w.subjects?.code||"")}</b> ${esc(w.subjects?.name||"")}</div><div><b>คะแนนเต็ม ${max}</b></div></div>
    <div class="v8-student-lines"><span>ชื่อ-นามสกุล __________________________</span><span>รหัสประจำตัว ______________</span><span>ระดับชั้น __________</span><span>วันที่ __________</span></div>
    <div class="v8-instruction"><b>คำชี้แจง:</b> ${esc(w.instructions||"ตอบคำถามให้ครบถ้วน")}</div>
    <section class="v8-paper-questions">${(w.questions||[]).map((x,i)=>`<div class="v8-paper-q"><div class="v8-qnum">${i+1}</div><div><b>${esc(x.text)}</b><div class="v8-write-space"></div></div></div>`).join("")}</section>
    <footer>วิทยาลัยเทคนิคนางรอง • ${esc(w.reference_code||"")}</footer>
  </article>`;
}
function printPaper(w){
  const win=window.open("","_blank");
  if(!win){toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์","error");return}
  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(w.title)}</title><style>${paperPrintCss()}</style></head><body>${paperHtml(w)}</body></html>`);
  win.document.close();setTimeout(()=>win.print(),300);
}
function paperPrintCss(){
  return `@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,"Sarabun",sans-serif;color:#111}.v8-a4-sheet{width:210mm;height:297mm;padding:9mm 11mm 8mm;overflow:hidden}.v8-paper-topline{height:4px;background:#333;margin-bottom:4mm}.v8-paper-header{display:grid;grid-template-columns:1fr 52mm;gap:5mm;align-items:start}.v8-paper-header h2,.v8-paper-header h3{margin:0 0 2mm}.v8-paper-header h2{font-size:16pt}.v8-paper-header h3{font-size:13pt}.v8-docbox{border:1px solid #333;padding:3mm;font-size:9pt}.v8-paper-band{display:grid;grid-template-columns:1fr 38mm;border:1px solid #333;margin-top:4mm;padding:3mm;font-size:10pt}.v8-student-lines{display:grid;grid-template-columns:1.4fr 1fr;gap:2mm;border:1px solid #aaa;border-top:0;padding:3mm;font-size:9pt}.v8-instruction{margin-top:4mm;border-left:3px solid #333;padding:2.5mm;background:#f5f5f5;font-size:9pt}.v8-paper-questions{margin-top:4mm}.v8-paper-q{display:grid;grid-template-columns:9mm 1fr;gap:3mm;margin-bottom:3mm;font-size:9.5pt}.v8-qnum{border:1px solid #333;text-align:center;padding:2mm;font-weight:bold;height:9mm}.v8-write-space{height:42mm;border-bottom:1px dashed #777;margin-top:2mm}footer{font-size:8pt;text-align:center;border-top:1px solid #aaa;padding-top:2mm;margin-top:2mm}`;
}

async function renderStudentSubjects(){
  if(!content())return;
  busy("กำลังโหลดรายวิชาของฉัน...");
  const c=client(),me=uid();
  const [wr,sr,fr]=await Promise.all([
    c.from("worksheets").select("id,subject_id,title,mode,status,reference_code,due_at,open_at,settings,subjects(id,code,name,color_hex)").eq("status","published").order("due_at"),
    c.from("submissions").select("worksheet_id,status,submitted_at,updated_at").eq("user_id",me),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,size_bytes,created_at").order("created_at",{ascending:false})
  ]);
  if(wr.error||sr.error){content().innerHTML=`<div class="alert error">${esc((wr.error||sr.error).message)}</div>`;return}
  const ws=wr.data||[],subs=new Map((sr.data||[]).map(x=>[x.worksheet_id,x])),files=fr.data||[];
  const groups=new Map();
  ws.forEach(w=>{const s=w.subjects;if(!s)return;if(!groups.has(s.id))groups.set(s.id,{subject:s,works:[]});groups.get(s.id).works.push(w)});
  const cards=[...groups.values()].map(g=>{
    const sent=g.works.filter(w=>["submitted","confirmed","graded"].includes(subs.get(w.id)?.status)).length;
    const fc=files.filter(f=>f.subject_id===g.subject.id).length;
    return `<article class="card v8-subject-card" style="--subject-color:${subjectColor(g.subject)}"><div class="v8-subject-head"><div class="v8-subject-dot"></div><div><b>${esc(g.subject.code)}</b><h3>${esc(g.subject.name)}</h3></div></div>
    <div class="v8-counts"><span>ใบงาน ${g.works.length}</span><span>ส่งแล้ว ${sent}</span><span>สไลด์/สื่อ ${fc}</span></div>
    <button class="btn primary w100" data-v8-student-subject="${g.subject.id}">เปิดรายวิชา</button></article>`;
  }).join("");
  reportState={studentGroups:groups,studentSubs:subs,studentFiles:files};
  content().innerHTML=`<div class="section-head"><div><h1>รายวิชา / ใบงานของฉัน</h1><div class="muted">เปิดวิชาเพื่อดูใบงาน เป้าหมาย และสไลด์ที่ครูผูกกับใบงาน</div></div></div>
  <div class="v8-subject-grid">${cards||`<div class="card empty">ยังไม่มีใบงานที่เผยแพร่ให้บัญชีนี้</div>`}</div>`;
}
function showStudentSubject(subjectId){
  const st=reportState;
  if(!st?.studentGroups?.has(subjectId)){renderStudentSubjects();return}
  const g=st.studentGroups.get(subjectId),subs=st.studentSubs,files=st.studentFiles.filter(f=>f.subject_id===subjectId);
  const works=[...g.works].sort((a,b)=>sequenceOf(a)-sequenceOf(b)||a.mode.localeCompare(b.mode));
  content().innerHTML=`<div class="section-head"><div><button class="btn sm ghost" id="v8-back-my-subjects">← รายวิชาของฉัน</button><h1 style="margin-top:10px">${esc(g.subject.code)} ${esc(g.subject.name)}</h1><div class="muted">ใบงาน + เป้าหมาย + สไลด์ของแต่ละงาน</div></div></div>
  <div class="v9-student-work-list">${works.map(w=>{
    const sub=subs.get(w.id),s=statusLabel(sub,true,w),fs=linkedSlides(files,w.id);
    return `<article class="card v9-student-work"><div class="row between wrap"><div><span class="v9-code">${esc(worksheetAbbr(w))}</span> <b>${esc(w.title)}</b><div class="smalltext muted">${w.mode==="paper"?"Paper":"Digital"} • เปิด ${fmt(w.open_at)} • ส่ง ${fmt(w.due_at)}</div></div><span class="badge ${s.cls==="sent"?"green":s.cls==="late"?"warn":"gray"}">${esc(s.title)}</span></div>
      <div class="v9-student-goal">🎯 <b>เป้าหมาย:</b> ${esc(w.settings?.learning_goal||"ตามที่ครูกำหนด")}</div>
      <div class="v9-student-files">${fs.map(f=>`<button class="btn sm" data-v8-open-file="${esc(f.storage_path)}">📊 ${esc(f.original_name)}</button>`).join("")||`<span class="muted smalltext">ยังไม่มีสไลด์ที่ผูกกับใบงานนี้</span>`}</div>
      <div style="margin-top:10px"><button class="btn primary" data-open="${w.id}">${w.mode==="digital"?"เปิดทำใบงานเต็มหน้า":"ดูรายละเอียดใบงาน"}</button></div></article>`;
  }).join("")}</div>`;
  q("#v8-back-my-subjects").onclick=renderStudentSubjects;
}
async function openWorksheetStudent(id){
  const c=client(),me=uid();
  const [wr,sr]=await Promise.all([
    c.from("worksheets").select("*,subjects(id,code,name,color_hex)").eq("id",id).single(),
    c.from("submissions").select("*").eq("worksheet_id",id).eq("user_id",me).maybeSingle()
  ]);
  if(wr.error){toast(wr.error.message,"error");return}
  const w=wr.data,old=sr.data;
  if(w.mode!=="digital"){
    overlay(`<div class="v8-preview-shell"><div class="v8-preview-toolbar"><div><b>${esc(w.title)}</b><div class="smalltext">${esc(w.subjects?.code||"")} • ใบงานกระดาษ</div></div><button class="btn" data-v8-close>ปิด</button></div><main class="v8-preview-body"><div class="alert">ใบงานนี้เป็นแบบกระดาษ ให้ทำบนเอกสาร A4 และยืนยันการส่งผ่านเมนูงานกระดาษตามที่ครูกำหนด</div><p>${esc(w.instructions||"")}</p></main></div>`,"v8-fullscreen-layer");return;
  }
  const locked=old&&["submitted","confirmed","graded"].includes(old.status);
  const notOpen=w.open_at&&Date.now()<new Date(w.open_at).getTime();
  const manual=w.copy_paste_allowed===false||w.settings?.manual_typing_only===true;
  let attachmentPaths=[...(old?.attachment_paths||[])];
  let uploadedFilePath=null;
  const shell=overlay(`<section id="v8-workspace" class="v8-workspace">
    <header class="v8-workbar"><div><b>${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")}</b><h2>${esc(w.title)}</h2><div class="smalltext">กำหนด ${fmt(w.due_at)} ${manual?"• บังคับพิมพ์คำตอบด้วยตนเอง":""}</div></div>
      <div class="row">${!locked&&!notOpen&&w.allow_draft?`<button id="v8-save-draft" class="btn">บันทึกร่าง</button>`:""}${!locked&&!notOpen?`<button id="v8-preview-submit" class="btn green">ตรวจคำตอบก่อนส่ง</button>`:""}<button class="btn" id="v8-exit-work">ออก</button></div></header>
    <div class="v8-workbody">
      ${notOpen?`<div class="alert warn">ยังไม่ถึงเวลาเปิดทำ ${fmt(w.open_at)}</div>`:""}
      ${locked?`<div class="alert success">ส่งงานแล้ว • ${fmt(old?.submitted_at)}</div>`:""}
      <div class="v8-instructions">${esc(w.instructions||"")}</div>
      <form id="v8-answer-form">${(w.questions||[]).map((x,i)=>studentQuestion(x,i,old?.answers?.[x.id],locked||notOpen)).join("")}
        ${!locked&&!notOpen?`<div class="field"><label>แนบไฟล์คำตอบ (ไม่บังคับ สูงสุด 20MB)</label><input id="v8-attach" class="input" type="file"></div>`:""}
      </form>
      <div id="v8-autosave-state" class="autosave">${w.allow_draft&&!locked&&!notOpen?"ระบบบันทึกร่างอัตโนมัติเมื่อพิมพ์":""}</div>
    </div>
  </section>`,"v8-fullscreen-layer");
  q("#v8-exit-work").onclick=async()=>{
    if(!locked&&!notOpen&&w.allow_draft)await saveDraft(false);
    closeOverlay();
  };
  if(w.settings?.fullscreen_required){
    q("#v8-workspace")?.requestFullscreen?.().catch(()=>{});
  }
  const form=q("#v8-answer-form");
  const collect=()=>{const f=new FormData(form),out={};for(const x of w.questions||[])out[x.id]=f.get("q_"+x.id)??"";return out};
  if(manual&&!locked&&!notOpen){
    ["paste","copy","cut","drop","contextmenu"].forEach(ev=>form.addEventListener(ev,e=>{
      if(e.target.matches("input,textarea")){e.preventDefault();toast("ใบงานนี้กำหนดให้พิมพ์คำตอบด้วยตนเอง","error")}
    }));
    form.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&["v","x","c"].includes(e.key.toLowerCase())&&e.target.matches("input,textarea")){
        e.preventDefault();toast("ไม่อนุญาต Copy/Paste ในช่องคำตอบ","error");
      }
    });
  }
  async function uploadPending(){
    const file=q("#v8-attach")?.files?.[0];
    if(!file||uploadedFilePath)return uploadedFilePath;
    if(file.size>20*1024*1024)throw new Error("ไฟล์เกิน 20MB");
    const path=`${me}/${id}/${Date.now()}-${safeName(file.name)}`;
    const up=await client().storage.from("submissions").upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(up.error)throw up.error;
    uploadedFilePath=path;attachmentPaths.push(path);return path;
  }
  async function saveDraft(withFile){
    if(!w.allow_draft||locked||notOpen)return;
    try{
      if(withFile)await uploadPending();
      const r=await client().rpc("save_worksheet_draft",{p_worksheet_id:id,p_answers:collect(),p_attachment_paths:attachmentPaths});
      const st=q("#v8-autosave-state");
      if(r.error)throw r.error;
      if(st)st.textContent="บันทึกร่างล่าสุด "+new Date().toLocaleTimeString("th-TH");
    }catch(err){toast(err.message||String(err),"error")}
  }
  if(!locked&&!notOpen&&w.allow_draft){
    form.addEventListener("input",()=>{
      clearTimeout(autosaveTimer);
      autosaveTimer=setTimeout(()=>saveDraft(false),1400);
    });
    q("#v8-save-draft").onclick=()=>saveDraft(true);
  }
  q("#v8-preview-submit")?.addEventListener("click",()=>{
    if(!form.reportValidity())return;
    clearTimeout(autosaveTimer);
    const answers=collect(),file=q("#v8-attach")?.files?.[0];
    const preview=document.createElement("div");
    preview.className="v8-submit-preview";
    preview.innerHTML=`<div class="v8-preview-card"><div class="modal-header"><div><h2>ตรวจคำตอบก่อนส่ง</h2><div class="muted">เมื่อกดยืนยัน ระบบจึงจะส่งงานจริง</div></div><button class="btn sm" id="v8-preview-back-x">✕</button></div>
      ${(w.questions||[]).map((x,i)=>`<div class="q-card"><b>${i+1}. ${esc(x.text)}</b><div class="v8-preview-answer">${esc(answers[x.id]||"(ยังไม่ได้ตอบ)")}</div></div>`).join("")}
      ${file?`<div class="alert">ไฟล์แนบ: <b>${esc(file.name)}</b></div>`:""}
      <div class="row end"><button class="btn" id="v8-preview-back">กลับไปแก้ไข</button><button class="btn green" id="v8-confirm-submit">ยืนยันส่งงาน</button></div></div>`;
    q("#v8-workspace").appendChild(preview);
    const back=()=>preview.remove();
    q("#v8-preview-back").onclick=back;q("#v8-preview-back-x").onclick=back;
    q("#v8-confirm-submit").onclick=async()=>{
      const btn=q("#v8-confirm-submit");btn.disabled=true;btn.textContent="กำลังส่ง...";
      try{
        await uploadPending();
        const r=await client().rpc("finalize_digital_submission",{p_worksheet_id:id,p_answers:answers,p_attachment_paths:attachmentPaths});
        if(r.error)throw r.error;
        closeOverlay();toast("ส่งงานสำเร็จ");
        setTimeout(()=>renderStudentSubjects(),250);
      }catch(err){btn.disabled=false;btn.textContent="ยืนยันส่งงาน";toast(err.message||String(err),"error")}
    };
  });
}
function studentQuestion(x,i,val="",disabled=false){
  const name=`q_${x.id}`,dis=disabled?"disabled":"",req=x.required!==false?"required":"";
  if(x.type==="choice")return `<div class="q-card"><div class="q-title">${i+1}. ${esc(x.text)} <span class="muted">(${Number(x.points||0)} คะแนน)</span></div><div class="choice-list">${(x.options||[]).map(o=>`<label><input type="radio" name="${name}" value="${esc(o)}" ${String(val)===String(o)?"checked":""} ${req} ${dis}> ${esc(o)}</label>`).join("")}</div></div>`;
  if(x.type==="textarea")return `<div class="q-card"><div class="q-title">${i+1}. ${esc(x.text)} <span class="muted">(${Number(x.points||0)} คะแนน)</span></div><textarea name="${name}" class="input v8-answer-input" ${req} ${dis}>${esc(val)}</textarea></div>`;
  return `<div class="q-card"><div class="q-title">${i+1}. ${esc(x.text)} <span class="muted">(${Number(x.points||0)} คะแนน)</span></div><input name="${name}" class="input v8-answer-input" value="${esc(val)}" ${req} ${dis}></div>`;
}

async function renderReportDashboard(){
  if(!content())return;
  busy("กำลังโหลด Dashboard ตรวจงาน...");
  const c=client();
  const [cr,sr]=await Promise.all([
    c.from("classrooms").select("id,name,level,semester,academic_year,active").eq("active",true).order("name"),
    c.from("subjects").select("id,code,name,color_hex").eq("subject_type","subject").eq("active",true).order("code")
  ]);
  if(cr.error||sr.error){content().innerHTML=`<div class="alert error">${esc((cr.error||sr.error).message)}</div>`;return}
  content().innerHTML=`<section><div class="section-head"><div><h1>Dashboard ตรวจงานรายห้อง</h1><div class="muted">เช็กส่ง/ไม่ส่งทุกใบงาน • Export .xls • พิมพ์สรุปทั้งห้อง</div></div></div>
    <div class="card"><div class="form-grid"><div class="field"><label>ห้องเรียน</label><select id="v8-report-room" class="input"><option value="">-- เลือกห้อง --</option>${(cr.data||[]).map(x=>`<option value="${x.id}">${esc(x.name)} ${esc(x.level||"")}</option>`).join("")}</select></div>
      <div class="field"><label>รายวิชา</label><select id="v8-report-subject" class="input"><option value="">-- เลือกรายวิชา --</option>${(sr.data||[]).map(x=>`<option value="${x.id}">${esc(x.code)} ${esc(x.name)}</option>`).join("")}</select></div></div>
      <div class="row end"><button class="btn primary" data-v8-report-load>แสดงรายงาน</button></div></div>
    <div id="v8-report-output" style="margin-top:14px"></div></section>`;
}
async function loadReportFromForm(){
  const cid=q("#v8-report-room")?.value,sid=q("#v8-report-subject")?.value;
  if(!cid||!sid){toast("กรุณาเลือกห้องและรายวิชา","error");return}
  const out=q("#v8-report-output");out.innerHTML=`<div class="card">กำลังสร้างตาราง...</div>`;
  const c=client();
  const [roomR,subjR,mr,wr]=await Promise.all([
    c.from("classrooms").select("*").eq("id",cid).single(),
    c.from("subjects").select("*").eq("id",sid).single(),
    c.from("classroom_memberships").select("user_id").eq("classroom_id",cid).eq("active",true),
    c.from("worksheets").select("id,title,mode,status,reference_code,due_at,settings").eq("subject_id",sid).neq("status","archived")
  ]);
  if(roomR.error||subjR.error||mr.error||wr.error){out.innerHTML=`<div class="alert error">${esc((roomR.error||subjR.error||mr.error||wr.error).message)}</div>`;return}
  let userIds=(mr.data||[]).map(x=>x.user_id),students=[];
  if(userIds.length){
    const pr=await c.from("profiles").select("id,student_code,username,full_name,grade_level,room_label,class_name,department,major,active").in("id",userIds).eq("active",true).order("student_code");
    if(pr.error){out.innerHTML=`<div class="alert error">${esc(pr.error.message)}</div>`;return}
    students=pr.data||[];
  }else{
    const pr=await c.from("profiles").select("id,student_code,username,full_name,grade_level,room_label,class_name,department,major,active").eq("class_name",roomR.data.name).eq("active",true).order("student_code");
    students=pr.data||[];userIds=students.map(x=>x.id);
  }
  const worksheets=(wr.data||[]).filter(w=>w.settings?.template_ready===true).sort((a,b)=>{
    if(a.mode!==b.mode)return a.mode==="paper"?-1:1;
    return (a.settings?.sequence_no||0)-(b.settings?.sequence_no||0);
  });
  const wids=worksheets.map(x=>x.id);
  let assignments=[],subs=[];
  if(wids.length&&userIds.length){
    const [ar,xr]=await Promise.all([
      c.from("worksheet_assignments").select("worksheet_id,user_id").in("worksheet_id",wids).in("user_id",userIds),
      c.from("submissions").select("id,worksheet_id,user_id,status,submitted_at,updated_at,confirmed_at").in("worksheet_id",wids).in("user_id",userIds)
    ]);
    assignments=ar.data||[];subs=xr.data||[];
  }
  const assigned=new Set(assignments.map(x=>`${x.user_id}|${x.worksheet_id}`));
  const subMap=new Map(subs.map(x=>[`${x.user_id}|${x.worksheet_id}`,x]));
  const rows=students.map(st=>{
    const cells=worksheets.map(w=>{
      const key=`${st.id}|${w.id}`;
      return statusLabel(subMap.get(key),assigned.has(key),w);
    });
    const sent=cells.filter(x=>["sent","late"].includes(x.cls)).length;
    const missing=cells.filter(x=>x.cls==="missing").length;
    return {student:st,cells,sent,missing};
  });
  reportState={room:roomR.data,subject:subjR.data,worksheets,rows};
  const head=worksheets.map(w=>`<th title="${esc(w.title)}">${esc(worksheetAbbr(w))}</th>`).join("");
  const body=rows.map(r=>`<tr><td class="v8-sticky-id"><b>${esc(r.student.student_code||r.student.username||"-")}</b></td><td class="v8-sticky-name">${esc(r.student.full_name||"-")}</td>${r.cells.map(x=>`<td class="v8-report-status ${x.cls}" title="${esc(x.title)}">${x.text}</td>`).join("")}<td><b>${r.sent}</b></td><td><b>${r.missing}</b></td></tr>`).join("");
  const totalAssigned=rows.reduce((a,r)=>a+r.cells.filter(x=>x.cls!=="na").length,0),totalSent=rows.reduce((a,r)=>a+r.sent,0),totalMissing=rows.reduce((a,r)=>a+r.missing,0);
  out.innerHTML=`<div class="grid"><div class="card stat"><div class="muted">นักศึกษา</div><div class="n">${rows.length}</div></div><div class="card stat"><div class="muted">รายการมอบหมาย</div><div class="n">${totalAssigned}</div></div><div class="card stat"><div class="muted">ส่งแล้ว</div><div class="n">${totalSent}</div></div><div class="card stat"><div class="muted">ยังไม่ส่ง</div><div class="n">${totalMissing}</div></div></div>
  <div class="card" style="margin-top:14px"><div class="row between"><div><h3>${esc(reportState.subject.code)} ${esc(reportState.subject.name)}</h3><div class="muted">${esc(reportState.room.name)} • ☑ ส่งแล้ว • ☐ ยังไม่ส่ง • ◐ ร่าง • — ไม่ได้มอบหมาย • ⚠ ส่งช้า</div></div><div class="row"><button class="btn green" data-v8-export-xls>Export .xls</button><button class="btn primary" data-v8-print-report>พิมพ์สรุป</button></div></div>
  <div class="table-wrap v8-report-wrap"><table class="v8-report-table"><thead><tr><th class="v8-sticky-id">รหัส</th><th class="v8-sticky-name">ชื่อ-นามสกุล</th>${head}<th>ส่ง</th><th>ขาด</th></tr></thead><tbody>${body||`<tr><td colspan="${worksheets.length+4}" class="empty">ไม่พบนักศึกษา</td></tr>`}</tbody></table></div></div>`;
}
function exportReportXls(){
  const st=reportState;if(!st?.rows){toast("ยังไม่มีรายงานสำหรับ Export","error");return}
  const headers=["รหัสนักศึกษา","ชื่อ-นามสกุล","ระดับชั้น","ห้อง","แผนก","สาขา",...st.worksheets.map(w=>worksheetAbbr(w)),"ส่งแล้ว","ยังไม่ส่ง"];
  const data=st.rows.map(r=>[
    r.student.student_code||r.student.username||"",r.student.full_name||"",r.student.grade_level||"",r.student.room_label||r.student.class_name||"",r.student.department||"",r.student.major||"",
    ...r.cells.map(x=>x.cls==="sent"?"☑ ส่งแล้ว":x.cls==="late"?"⚠ ส่งช้า":x.cls==="draft"?"◐ ร่าง":x.cls==="missing"?"☐ ยังไม่ส่ง":"— ไม่ได้มอบหมาย"),
    r.sent,r.missing
  ]);
  const rows=[headers,...data].map((row,ri)=>`<Row>${row.map(v=>`<Cell${ri===0?' ss:StyleID="Header"':""}><Data ss:Type="${typeof v==="number"?"Number":"String"}">${xmlEsc(v)}</Data></Cell>`).join("")}</Row>`).join("");
  const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="สรุปส่งงาน"><Table>${rows}</Table></Worksheet></Workbook>`;
  downloadBlob(new Blob(["\ufeff",xml],{type:"application/vnd.ms-excel;charset=utf-8"}),`DOC-FULL-NR_${safeName(st.subject.code)}_${safeName(st.room.name)}.xls`);
}
function printReport(){
  const st=reportState;if(!st?.rows){toast("ยังไม่มีรายงานสำหรับพิมพ์","error");return}
  const head=st.worksheets.map(w=>`<th><div>${esc(worksheetAbbr(w))}</div></th>`).join("");
  const body=st.rows.map(r=>`<tr><td>${esc(r.student.student_code||r.student.username||"-")}</td><td class="name">${esc(r.student.full_name||"-")}</td>${r.cells.map(x=>`<td>${x.text}</td>`).join("")}<td>${r.sent}</td><td>${r.missing}</td></tr>`).join("");
  const win=window.open("","_blank");if(!win){toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์","error");return}
  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>สรุปการส่งงาน</title><style>@page{size:A4 landscape;margin:7mm}body{font-family:Arial,"Sarabun",sans-serif;margin:0;color:#111}h2{margin:0 0 2mm;font-size:14pt}.meta{font-size:9pt;margin-bottom:3mm}.legend{font-size:8pt;margin:2mm 0}table{border-collapse:collapse;width:100%;font-size:7.2pt}th,td{border:1px solid #777;padding:1.2mm;text-align:center}th{background:#eee}.name{text-align:left;min-width:35mm}thead{display:table-header-group}</style></head><body><h2>สรุปการส่งใบงานรายห้อง</h2><div class="meta">${esc(st.room.name)} • ${esc(st.subject.code)} ${esc(st.subject.name)}</div><div class="legend">☑ ส่งแล้ว • ☐ ยังไม่ส่ง • ◐ ร่าง • — ไม่ได้มอบหมาย • ⚠ ส่งช้า</div><table><thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th>${head}<th>ส่ง</th><th>ขาด</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
  win.document.close();setTimeout(()=>win.print(),300);
}
function downloadBlob(blob,name){
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

window.addEventListener("storage",()=>{profileCache=null;profileUid=null;enhanceNav()});
